from rest_framework import viewsets, permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.decorators import action
from django.db import transaction

from .models import Wallet, Transaction, DepositPolicy
from .serializers import WalletSerializer, TransactionSerializer, DepositPolicySerializer
from bookings.models import Booking


class WalletViewSet(viewsets.ModelViewSet):
    serializer_class = WalletSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        if self.request.user.role == 'PARTNER' and hasattr(self.request.user, 'partner'):
            return Wallet.objects.filter(partner=self.request.user.partner)
        return Wallet.objects.none()


class TransactionViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = TransactionSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        if self.request.user.role == 'PARTNER' and hasattr(self.request.user, 'partner'):
            return Transaction.objects.filter(wallet__partner=self.request.user.partner)
        return Transaction.objects.filter(booking__customer=self.request.user)


class DepositPolicyViewSet(viewsets.ModelViewSet):
    """
    CRUD cho chính sách đặt cọc của nhà hàng.
    - Partner: chỉ xem/sửa deposit policy của nhà hàng mình
    - Admin: xem/sửa tất cả
    - Public: xem (GET) deposit policy theo restaurant_id
    """
    serializer_class = DepositPolicySerializer

    def get_permissions(self):
        if self.action in ['list', 'retrieve']:
            return [permissions.AllowAny()]
        return [permissions.IsAuthenticated()]

    def get_queryset(self):
        queryset = DepositPolicy.objects.all()
        restaurant_id = self.request.query_params.get('restaurant_id')
        if restaurant_id:
            queryset = queryset.filter(restaurant_id=restaurant_id)

        user = self.request.user
        if user.is_authenticated and user.role == 'PARTNER' and hasattr(user, 'partner'):
            queryset = queryset.filter(restaurant__partner=user.partner)
        
        return queryset

    def create(self, request, *args, **kwargs):
        restaurant_id = request.data.get('restaurant_id')
        if not restaurant_id:
            return Response({'error': 'restaurant_id is required'}, status=status.HTTP_400_BAD_REQUEST)

        from restaurants.models import Restaurant
        try:
            restaurant = Restaurant.objects.get(id=restaurant_id)
        except Restaurant.DoesNotExist:
            return Response({'error': 'Restaurant not found'}, status=status.HTTP_404_NOT_FOUND)

        # Check quyền
        if request.user.role == 'PARTNER':
            if restaurant.partner.user != request.user:
                return Response({'error': 'Bạn chỉ có thể tạo deposit policy cho nhà hàng của mình'},
                                status=status.HTTP_403_FORBIDDEN)

        # Check đã có policy chưa
        if DepositPolicy.objects.filter(restaurant=restaurant).exists():
            return Response({'error': 'Nhà hàng này đã có deposit policy. Hãy cập nhật thay vì tạo mới.'},
                            status=status.HTTP_400_BAD_REQUEST)

        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        serializer.save(restaurant=restaurant)

        return Response({
            'message': 'Deposit policy created successfully',
            'data': serializer.data
        }, status=status.HTTP_201_CREATED)

    def update(self, request, *args, **kwargs):
        instance = self.get_object()

        if request.user.role == 'PARTNER':
            if instance.restaurant.partner.user != request.user:
                return Response({'error': 'Permission denied'}, status=status.HTTP_403_FORBIDDEN)

        serializer = self.get_serializer(instance, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()

        return Response({
            'message': 'Deposit policy updated successfully',
            'data': serializer.data
        })


class SimulateDepositView(APIView):
    """
    POST /api/payments/simulate-deposit/
    Body: { "booking_id": int }

    Giả lập thanh toán cọc (không qua cổng thanh toán thật).
    - Tìm booking → tìm deposit policy của nhà hàng
    - Đánh dấu booking.is_deposit_paid = True
    - Tạo Transaction (DEPOSIT, SUCCESS)
    - Cập nhật Wallet.frozen_balance
    """
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        booking_id = request.data.get('booking_id')
        if not booking_id:
            return Response({'error': 'booking_id is required'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            booking = Booking.objects.get(id=booking_id)
        except Booking.DoesNotExist:
            return Response({'error': 'Booking not found'}, status=status.HTTP_404_NOT_FOUND)

        # Chỉ customer sở hữu booking mới thanh toán được
        if booking.customer != request.user:
            return Response({'error': 'Bạn không có quyền thanh toán booking này'},
                            status=status.HTTP_403_FORBIDDEN)

        # Kiểm tra đã thanh toán chưa
        if booking.is_deposit_paid:
            return Response({'error': 'Booking này đã được thanh toán cọc rồi'},
                            status=status.HTTP_400_BAD_REQUEST)

        # Tìm deposit policy
        try:
            policy = DepositPolicy.objects.get(restaurant=booking.restaurant)
        except DepositPolicy.DoesNotExist:
            return Response({'error': 'Nhà hàng này không yêu cầu đặt cọc'},
                            status=status.HTTP_400_BAD_REQUEST)

        if not policy.is_required:
            return Response({'error': 'Nhà hàng này không yêu cầu đặt cọc'},
                            status=status.HTTP_400_BAD_REQUEST)

        # Tính số tiền cọc
        deposit_amount = policy.deposit_amount
        if policy.deposit_percentage and policy.deposit_percentage > 0:
            # Nếu có tỉ lệ %, ưu tiên dùng deposit_amount cố định
            pass

        with transaction.atomic():
            # 1. Cập nhật booking
            booking.is_deposit_paid = True
            booking.deposit_amount = deposit_amount
            booking.save(update_fields=['is_deposit_paid', 'deposit_amount'])

            # 2. Tạo/lấy wallet cho partner
            partner = booking.restaurant.partner
            wallet, _ = Wallet.objects.get_or_create(partner=partner)

            # 3. Cộng vào frozen_balance (tiền cọc bị đóng băng cho tới khi COMPLETED)
            wallet.frozen_balance += deposit_amount
            wallet.save(update_fields=['frozen_balance'])

            # 4. Tạo transaction record
            import uuid
            tx = Transaction.objects.create(
                wallet=wallet,
                booking=booking,
                amount=deposit_amount,
                transaction_type='DEPOSIT',
                status='SUCCESS',
                payment_method='SIMULATED',
                transaction_id=f'SIM-{uuid.uuid4().hex[:12].upper()}'
            )

        return Response({
            'message': 'Thanh toán cọc thành công (giả lập)',
            'data': {
                'booking_id': booking.id,
                'deposit_amount': str(deposit_amount),
                'transaction_id': tx.transaction_id,
                'is_deposit_paid': True
            }
        }, status=status.HTTP_200_OK)
