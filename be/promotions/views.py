from django.db import models
from django.db.models import Q, F
from rest_framework import viewsets, permissions, status
from rest_framework.response import Response
from rest_framework.decorators import action
from .models import Voucher, UserVoucher, LoyaltyTransaction
from .serializers import VoucherSerializer, UserVoucherSerializer, LoyaltyTransactionSerializer
from django.utils import timezone


class VoucherViewSet(viewsets.ModelViewSet):
    serializer_class = VoucherSerializer

    def get_permissions(self):
        if self.action in ['create', 'update', 'partial_update', 'destroy']:
            return [permissions.IsAuthenticated()]
        return [permissions.AllowAny()]

    def get_queryset(self):
        queryset = Voucher.objects.all()

        # Lọc theo restaurant_id nếu có
        restaurant_id = self.request.query_params.get('restaurant_id')
        if restaurant_id:
            queryset = queryset.filter(
                models.Q(restaurant_id=restaurant_id) | models.Q(restaurant__isnull=True)
            )

        # Nếu Partner, chỉ hiện voucher của nhà hàng mình
        user = self.request.user
        if user.is_authenticated and user.role == 'PARTNER' and hasattr(user, 'partner'):
            queryset = queryset.filter(restaurant__partner=user.partner)

        return queryset

    def create(self, request, *args, **kwargs):
        """Partner tạo voucher cho nhà hàng của mình"""
        restaurant_id = request.data.get('restaurant')
        if restaurant_id:
            from restaurants.models import Restaurant
            try:
                restaurant = Restaurant.objects.get(id=restaurant_id)
                if request.user.role == 'PARTNER' and restaurant.partner.user != request.user:
                    return Response({'error': 'Bạn chỉ có thể tạo voucher cho nhà hàng của mình'},
                                    status=status.HTTP_403_FORBIDDEN)
            except Restaurant.DoesNotExist:
                return Response({'error': 'Nhà hàng không tồn tại'}, status=status.HTTP_404_NOT_FOUND)

        return super().create(request, *args, **kwargs)

    def update(self, request, *args, **kwargs):
        instance = self.get_object()
        if request.user.role == 'PARTNER':
            if instance.restaurant and instance.restaurant.partner.user != request.user:
                return Response({'error': 'Permission denied'}, status=status.HTTP_403_FORBIDDEN)
        return super().update(request, *args, **kwargs)

    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()
        if request.user.role == 'PARTNER':
            if instance.restaurant and instance.restaurant.partner.user != request.user:
                return Response({'error': 'Permission denied'}, status=status.HTTP_403_FORBIDDEN)
        return super().destroy(request, *args, **kwargs)

    @action(detail=True, methods=['post'], permission_classes=[permissions.IsAuthenticated])
    def collect(self, request, pk=None):
        voucher = self.get_object()
        user = request.user
        
        if user.role != 'CUSTOMER':
            return Response({'error': 'Chỉ khách hàng mới có thể thu thập voucher.'}, status=status.HTTP_403_FORBIDDEN)
            
        if UserVoucher.objects.filter(user=user, voucher=voucher).exists():
            return Response({'error': 'Bạn đã thu thập voucher này rồi.'}, status=status.HTTP_400_BAD_REQUEST)
        
        if voucher.used_count >= voucher.usage_limit:
            return Response({'error': 'Voucher đã hết lượt sử dụng.'}, status=status.HTTP_400_BAD_REQUEST)
            
        # Kiểm tra và trừ điểm đổi thưởng
        if voucher.points_cost > 0:
            if not hasattr(user, 'customer'):
                return Response({'error': 'Không tìm thấy hồ sơ khách hàng.'}, status=status.HTTP_400_BAD_REQUEST)
                
            customer_profile = user.customer
            if customer_profile.loyalty_points < voucher.points_cost:
                return Response({'error': f'Không đủ điểm tích lũy. Yêu cầu: {voucher.points_cost} điểm, Bạn có: {customer_profile.loyalty_points} điểm'}, status=status.HTTP_400_BAD_REQUEST)
                
            # Trừ điểm
            customer_profile.loyalty_points -= voucher.points_cost
            customer_profile.save(update_fields=['loyalty_points'])
            
            # Ghi log giao dịch đổi điểm
            LoyaltyTransaction.objects.create(
                user=user,
                points_changed=-voucher.points_cost,
                transaction_type='REDEEM',
                description=f'Đổi voucher {voucher.code}'
            )
            
        UserVoucher.objects.create(user=user, voucher=voucher)
        return Response({'message': 'Thu thập voucher thành công.', 'loyalty_points': user.customer.loyalty_points if hasattr(user, 'customer') else 0}, status=status.HTTP_201_CREATED)

    @action(detail=False, methods=['get'], url_path='available-for-booking')
    def available_for_booking(self, request):
        """
        GET /api/promotions/vouchers/available-for-booking/?restaurant_id=X
        Trả về danh sách voucher khả dụng mà user đã thu thập, chưa dùng, cho nhà hàng cụ thể.
        """
        restaurant_id = request.query_params.get('restaurant_id')
        if not restaurant_id:
            return Response({'error': 'restaurant_id is required'}, status=status.HTTP_400_BAD_REQUEST)

        if not request.user.is_authenticated:
            return Response({'vouchers': []})

        now = timezone.now()
        
        # Voucher user đã thu thập, chưa dùng
        user_voucher_ids = UserVoucher.objects.filter(
            user=request.user, is_used=False
        ).values_list('voucher_id', flat=True)

        # Lọc voucher hợp lệ cho nhà hàng này
        from django.db.models import Q
        vouchers = Voucher.objects.filter(
            id__in=user_voucher_ids,
            is_active=True,
            valid_from__lte=now,
            valid_to__gte=now,
        ).filter(
            Q(restaurant_id=restaurant_id) | Q(restaurant__isnull=True)
        ).filter(
            used_count__lt=models.F('usage_limit')
        )

        serializer = VoucherSerializer(vouchers, many=True)
        return Response({'vouchers': serializer.data})


class UserVoucherViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = UserVoucherSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return UserVoucher.objects.filter(user=self.request.user)
