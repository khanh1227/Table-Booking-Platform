from rest_framework import viewsets, permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView
from django.http import HttpResponseRedirect
from django.db.models import Sum
from django.db.models import Q
from django.utils import timezone
from django.utils.dateparse import parse_date
from datetime import timedelta
from datetime import datetime, time
from decimal import Decimal

from .models import Wallet, Transaction, DepositPolicy
from .serializers import WalletSerializer, TransactionSerializer, DepositPolicySerializer
from bookings.models import Booking
from django.conf import settings
import logging

from .services import (
    get_client_ip,
    prepare_vnpay_payment,
    process_vnpay_payment_result,
)

logger = logging.getLogger(__name__)


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
            return Transaction.objects.filter(
                Q(wallet__partner=self.request.user.partner) |
                Q(
                    transaction_type='PLATFORM_FEE',
                    booking__restaurant__partner=self.request.user.partner,
                )
            ).distinct()
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


class VNPAYPaymentView(APIView):
    """
    POST /api/payments/create-vnpay-url/
    Body: { "booking_id": int }
    Trả về URL để redirect sang VNPAY.
    """
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        booking_id = request.data.get('booking_id')
        try:
            booking = Booking.objects.get(id=booking_id, customer=request.user)
        except Booking.DoesNotExist:
            return Response({'error': 'Booking not found'}, status=status.HTTP_404_NOT_FOUND)

        try:
            _, payment_url = prepare_vnpay_payment(
                booking,
                request_ip=get_client_ip(request),
                return_url=request.build_absolute_uri('/api/payments/vnpay-return/'),
            )
        except ValueError as exc:
            return Response({'error': str(exc)}, status=status.HTTP_400_BAD_REQUEST)

        return Response({'payment_url': payment_url}, status=status.HTTP_200_OK)


class VNPAYIPNView(APIView):
    """
    GET /api/payments/vnpay-ipn/
    VNPAY gọi API này để thông báo kết quả.
    """
    permission_classes = [permissions.AllowAny]

    def get(self, request):
        input_data = request.GET.dict()
        result = process_vnpay_payment_result(input_data)
        response_status = status.HTTP_200_OK if result['rsp_code'] != '99' else status.HTTP_500_INTERNAL_SERVER_ERROR
        return Response(
            {"RspCode": result["rsp_code"], "Message": result["message"]},
            status=response_status,
        )


class VNPAYVerifyReturnView(APIView):
    """
    GET /api/payments/verify-vnpay-return/
    FE/mobile gọi endpoint này để xác minh kết quả và lấy trạng thái booking hiện tại.
    """
    permission_classes = [permissions.AllowAny]

    def get(self, request):
        result = process_vnpay_payment_result(request.GET.dict())
        booking = None
        booking_id = result.get("booking_id")
        if booking_id:
            booking = Booking.objects.filter(id=booking_id).values(
                "id",
                "status",
                "is_deposit_paid",
                "deposit_refund_status",
            ).first()

        return Response(
            {
                "success": result["ok"] and request.GET.get("vnp_ResponseCode") == "00",
                "message": result["message"],
                "booking": booking,
            },
            status=status.HTTP_200_OK if result["rsp_code"] != "99" else status.HTTP_500_INTERNAL_SERVER_ERROR,
        )

class VNPAYReturnView(APIView):
    """
    GET /api/payments/vnpay-return/
    VNPAY redirect trình duyệt người dùng về đây sau khi thanh toán xong.
    Chúng ta xử lý xong rồi redirect tiếp về Frontend.
    """
    permission_classes = [permissions.AllowAny]

    def get(self, request):
        process_vnpay_payment_result(request.GET.dict())
        params = request.GET.urlencode()
        return HttpResponseRedirect(f"{settings.VNPAY_RETURN_URL_FE}?{params}")


class PlatformRevenueStatsView(APIView):
    """
    GET /api/payments/platform-revenue/
    Admin-only thống kê thu nhập nền tảng từ PLATFORM_FEE.
    """
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        if request.user.role != "ADMIN":
            return Response({"error": "Permission denied"}, status=status.HTTP_403_FORBIDDEN)

        time_range = request.query_params.get("time_range", "30days")
        now = timezone.now()
        start_date = None
        end_date = now

        if time_range == "7days":
            start_date = now - timedelta(days=7)
        elif time_range == "thisMonth":
            start_date = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        elif time_range == "custom":
            start = parse_date(request.query_params.get("start_date", ""))
            end = parse_date(request.query_params.get("end_date", ""))
            if not start or not end:
                return Response({"error": "Thiếu start_date hoặc end_date"}, status=status.HTTP_400_BAD_REQUEST)
            start_date = timezone.make_aware(
                datetime.combine(start, time.min),
                timezone.get_current_timezone(),
            )
            end_date = timezone.make_aware(
                datetime.combine(end, time.max),
                timezone.get_current_timezone(),
            )
        else:
            start_date = now - timedelta(days=30)

        fee_rate = Decimal(str(getattr(settings, "PLATFORM_FEE_RATE", Decimal("0.10"))))

        fees_qs = Transaction.objects.filter(
            transaction_type="PLATFORM_FEE",
            status="SUCCESS",
            created_at__gte=start_date,
            created_at__lte=end_date,
        ).select_related("booking", "booking__restaurant")

        realized_fee_total = fees_qs.aggregate(total=Sum("amount"))["total"] or Decimal("0")
        realized_count = fees_qs.count()

        # Backfill cho booking cũ: đã hoàn thành, đã thanh toán cọc nhưng chưa có transaction PLATFORM_FEE.
        legacy_bookings_qs = Booking.objects.filter(
            status__in=["COMPLETED", "NO_SHOW", "CANCELLED"],
            is_deposit_paid=True,
            deposit_amount__gt=0,
            created_at__gte=start_date,
            created_at__lte=end_date,
        ).exclude(
            transactions__transaction_type="PLATFORM_FEE",
            transactions__status="SUCCESS",
        ).select_related("restaurant")

        legacy_fee_total = Decimal("0")
        legacy_entries = []
        for booking in legacy_bookings_qs[:50]:
            fee_amount = (Decimal(str(booking.deposit_amount)) * fee_rate).quantize(Decimal("1.00"))
            legacy_fee_total += fee_amount
            legacy_entries.append(
                {
                    "id": f"legacy-{booking.id}",
                    "booking_id": booking.id,
                    "restaurant_name": booking.restaurant.name if booking.restaurant else "N/A",
                    "amount": fee_amount,
                    "created_at": booking.created_at,
                    "note": f"Hồi tố phí nền tảng {int(fee_rate * 100)}% từ booking cũ (chưa có transaction PLATFORM_FEE)",
                }
            )

        total_fee = realized_fee_total + legacy_fee_total
        total_bookings = realized_count + legacy_bookings_qs.count()
        avg_fee = (total_fee / total_bookings) if total_bookings > 0 else Decimal("0")

        recent_real_fees = [
            {
                "id": tx.id,
                "booking_id": tx.booking_id,
                "restaurant_name": tx.booking.restaurant.name if tx.booking and tx.booking.restaurant else "N/A",
                "amount": tx.amount,
                "created_at": tx.created_at,
                "note": tx.note,
            }
            for tx in fees_qs.order_by("-created_at")[:20]
        ]
        recent_fees = sorted(
            [*recent_real_fees, *legacy_entries],
            key=lambda x: x["created_at"],
            reverse=True
        )[:20]

        return Response(
            {
                "summary": {
                    "platform_fee_rate": str(fee_rate),
                    "total_platform_revenue": total_fee,
                    "total_fee_transactions": total_bookings,
                    "average_fee_per_booking": avg_fee,
                    "realized_platform_revenue": realized_fee_total,
                    "legacy_estimated_platform_revenue": legacy_fee_total,
                },
                "recent_fees": recent_fees,
            }
        )
