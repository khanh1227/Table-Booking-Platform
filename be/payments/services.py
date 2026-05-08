import logging
import uuid
from datetime import timedelta
from decimal import Decimal

from django.conf import settings
from django.db import transaction
from django.utils import timezone

from accounts.models import Customer
from bookings.models import Booking

from .models import Transaction, Wallet
from .vnpay import vnpay


logger = logging.getLogger(__name__)
VN_TZ = timezone.get_fixed_timezone(7 * 60)


def now_vn():
    return timezone.now().astimezone(VN_TZ)


def format_vnpay_datetime(dt):
    return dt.astimezone(VN_TZ).strftime("%Y%m%d%H%M%S")


def cleanup_expired_pending_bookings():
    now = timezone.now()
    expired_ids = list(
        Booking.objects.filter(
            status="PENDING",
            is_deposit_paid=False,
            deposit_expires_at__lt=now,
            deposit_expires_at__isnull=False,
        ).values_list("id", flat=True)
    )
    if not expired_ids:
        return 0

    count = Booking.objects.filter(id__in=expired_ids).update(
        status="CANCELLED",
        rejection_reason="Hệ thống tự động hủy do hết thời gian thanh toán cọc",
    )
    Transaction.objects.filter(
        booking_id__in=expired_ids,
        transaction_type="DEPOSIT",
        status="PENDING",
    ).update(status="FAILED", note="Booking hết hạn thanh toán cọc")
    return count


def build_payment_url(tx, request_ip, return_url):
    config = settings.VNPAY_CONFIG
    booking = tx.booking
    vnp = vnpay()
    vnp.request_data["vnp_Version"] = "2.1.0"
    vnp.request_data["vnp_Command"] = "pay"
    vnp.request_data["vnp_TmnCode"] = config["vnp_TmnCode"]
    vnp.request_data["vnp_Amount"] = int(booking.deposit_amount * 100)
    vnp.request_data["vnp_CurrCode"] = "VND"
    vnp.request_data["vnp_TxnRef"] = tx.transaction_id
    vnp.request_data["vnp_OrderInfo"] = f"Thanh toan tien coc booking #{booking.id}"
    vnp.request_data["vnp_OrderType"] = "billpayment"
    vnp.request_data["vnp_Locale"] = "vn"
    vnp.request_data["vnp_CreateDate"] = tx.provider_create_date
    vnp.request_data["vnp_ExpireDate"] = format_vnpay_datetime(booking.deposit_expires_at)
    vnp.request_data["vnp_IpAddr"] = request_ip or "127.0.0.1"
    vnp.request_data["vnp_ReturnUrl"] = return_url
    return vnp.get_payment_url(config["vnp_Url"], config["vnp_HashSecret"])


def prepare_vnpay_payment(booking, request_ip, return_url):
    cleanup_expired_pending_bookings()

    if booking.is_deposit_paid:
        raise ValueError("Đã thanh toán rồi")
    if booking.status != "PENDING":
        raise ValueError("Booking hiện không ở trạng thái chờ thanh toán cọc")
    if booking.deposit_amount <= 0:
        raise ValueError("Booking này không yêu cầu thanh toán cọc")
    if booking.deposit_expires_at and booking.deposit_expires_at <= timezone.now():
        booking.status = "CANCELLED"
        booking.rejection_reason = "Hết thời gian thanh toán cọc"
        booking.save(update_fields=["status", "rejection_reason"])
        raise ValueError("Booking đã hết hạn thanh toán cọc")

    partner = booking.restaurant.partner
    wallet, _ = Wallet.objects.get_or_create(partner=partner)

    pending_tx = (
        Transaction.objects.filter(
            booking=booking,
            transaction_type="DEPOSIT",
            status="PENDING",
        )
        .order_by("-created_at")
        .first()
    )

    if not pending_tx:
        pending_tx = Transaction.objects.create(
            wallet=wallet,
            booking=booking,
            amount=booking.deposit_amount,
            transaction_type="DEPOSIT",
            status="PENDING",
            payment_method="VNPAY",
            transaction_id=f"{booking.id}_{uuid.uuid4().hex[:6]}",
            provider_create_date=format_vnpay_datetime(now_vn()),
        )

    payment_url = build_payment_url(
        pending_tx,
        request_ip=request_ip,
        return_url=return_url,
    )
    return pending_tx, payment_url


def get_client_ip(request_obj):
    forwarded_for = request_obj.META.get("HTTP_X_FORWARDED_FOR")
    if forwarded_for:
        return forwarded_for.split(",")[0].strip()
    return request_obj.META.get("REMOTE_ADDR", "127.0.0.1")


def mark_booking_paid(tx, input_data, update_booking=True):
    booking = tx.booking
    wallet = tx.wallet
    with transaction.atomic():
        tx.status = "SUCCESS"
        tx.provider_transaction_no = input_data.get("vnp_TransactionNo")
        tx.provider_pay_date = input_data.get("vnp_PayDate")
        tx.provider_response_code = input_data.get("vnp_ResponseCode")
        tx.note = "Thanh toán cọc thành công"
        tx.save()

        if not booking.is_deposit_paid:
            booking.is_deposit_paid = True
            booking.deposit_refund_status = "NONE"
            update_fields = ["is_deposit_paid", "deposit_refund_status"]
            if update_booking:
                booking.status = "CONFIRMED"
                booking.confirmed_at = timezone.now()
                update_fields.extend(["status", "confirmed_at"])
            booking.save(update_fields=update_fields)

        wallet.frozen_balance = Decimal(str(wallet.frozen_balance)) + Decimal(str(tx.amount))
        wallet.save(update_fields=["frozen_balance", "updated_at"])


def refund_booking_deposit(booking, actor_name, ip_addr, reason):
    del actor_name, ip_addr
    if not booking.is_deposit_paid or booking.deposit_amount <= 0:
        return None
    if booking.deposit_refund_status in {"PENDING", "SUCCESS"}:
        return None

    wallet = Wallet.objects.filter(partner=booking.restaurant.partner).first()
    customer_profile, _ = Customer.objects.get_or_create(user=booking.customer)

    with transaction.atomic():
        if wallet:
            wallet.deduct_frozen(booking.deposit_amount)

        customer_profile.credit_balance = Decimal(str(customer_profile.credit_balance)) + Decimal(str(booking.deposit_amount))
        customer_profile.save(update_fields=["credit_balance"])

        booking.deposit_refund_status = "SUCCESS"
        booking.refunded_at = timezone.now()
        booking.save(update_fields=["deposit_refund_status", "refunded_at"])

        Transaction.objects.create(
            wallet=wallet,
            booking=booking,
            amount=booking.deposit_amount,
            transaction_type="REFUND",
            status="SUCCESS",
            payment_method="CUSTOMER_CREDIT",
            transaction_id=f"REF_{booking.id}_{uuid.uuid4().hex[:8]}",
            note=reason,
        )

    return {
        "refund_status": "SUCCESS",
        "credited_amount": booking.deposit_amount,
        "message": "Đã hoàn tiền vào số dư nội bộ của khách hàng",
    }


def credit_customer_balance(booking, amount, reason):
    if amount <= 0:
        return None

    customer_profile, _ = Customer.objects.get_or_create(user=booking.customer)
    with transaction.atomic():
        customer_profile.credit_balance = Decimal(str(customer_profile.credit_balance)) + Decimal(str(amount))
        customer_profile.save(update_fields=["credit_balance"])
        booking.deposit_refund_status = "SUCCESS"
        booking.refunded_at = timezone.now()
        booking.save(update_fields=["deposit_refund_status", "refunded_at"])
        Transaction.objects.create(
            wallet=Wallet.objects.filter(partner=booking.restaurant.partner).first(),
            booking=booking,
            amount=amount,
            transaction_type="REFUND",
            status="SUCCESS",
            payment_method="CUSTOMER_CREDIT",
            transaction_id=f"CRD_{booking.id}_{uuid.uuid4().hex[:8]}",
            note=reason,
        )
    return amount


def award_booking_loyalty_points(booking):
    if not hasattr(booking.customer, "customer"):
        return

    from promotions.models import LoyaltyTransaction

    already_awarded = LoyaltyTransaction.objects.filter(
        booking=booking,
        transaction_type="EARN",
    ).exists()
    if already_awarded:
        return

    customer_profile = booking.customer.customer
    customer_profile.loyalty_points += 100
    customer_profile.save(update_fields=["loyalty_points"])
    LoyaltyTransaction.objects.create(
        user=booking.customer,
        booking=booking,
        points_changed=100,
        transaction_type="EARN",
        description=f"Điểm thưởng cho việc hoàn thành booking #{booking.id}",
    )


def calculate_customer_cancellation_refund(booking):
    if not booking.is_deposit_paid or booking.deposit_amount <= 0:
        return Decimal("0")

    time_to_booking = booking.reservation_starts_at - timezone.now()
    full_refund_window = timedelta(hours=settings.CUSTOMER_CANCEL_FULL_REFUND_HOURS)
    partial_refund_window = timedelta(hours=settings.CUSTOMER_CANCEL_PARTIAL_REFUND_HOURS)

    if time_to_booking >= full_refund_window:
        return Decimal(str(booking.deposit_amount))
    if time_to_booking >= partial_refund_window:
        return Decimal(str(booking.deposit_amount)) * Decimal(str(settings.CUSTOMER_CANCEL_PARTIAL_REFUND_RATE))
    return Decimal("0")


def hold_partner_settlement_amount(booking, amount, reason):
    if amount <= 0:
        return None

    wallet = Wallet.objects.filter(partner=booking.restaurant.partner).first()
    if not wallet:
        return None

    wallet.move_frozen_to_settlement(amount)
    available_at = timezone.now() + timedelta(hours=settings.PARTNER_SETTLEMENT_HOLD_HOURS)
    booking.settlement_available_at = available_at
    booking.save(update_fields=["settlement_available_at"])

    return Transaction.objects.create(
        wallet=wallet,
        booking=booking,
        amount=amount,
        transaction_type="PAYMENT",
        status="PENDING",
        payment_method="SYSTEM_SETTLEMENT",
        transaction_id=f"SET_{booking.id}_{uuid.uuid4().hex[:8]}",
        note=reason,
    )


def move_booking_deposit_to_settlement(booking):
    if not booking.is_deposit_paid or booking.deposit_amount <= 0:
        return None

    existing_tx = (
        Transaction.objects.filter(
            booking=booking,
            transaction_type="PAYMENT",
        )
        .order_by("-created_at")
        .first()
    )
    if existing_tx:
        return existing_tx

    return hold_partner_settlement_amount(
        booking,
        Decimal(str(booking.deposit_amount)),
        "Tiền đang trong thời gian giữ trước khi cho phép rút",
    )


def settle_customer_cancellation(booking, refund_amount):
    if not booking.is_deposit_paid or booking.deposit_amount <= 0:
        return {"refund_amount": Decimal("0"), "retained_amount": Decimal("0")}

    deposit_amount = Decimal(str(booking.deposit_amount))
    refund_amount = min(Decimal(str(refund_amount)), deposit_amount)
    retained_amount = deposit_amount - refund_amount
    wallet = Wallet.objects.filter(partner=booking.restaurant.partner).first()

    with transaction.atomic():
        if retained_amount > 0:
            hold_partner_settlement_amount(
                booking,
                retained_amount,
                "Khách hủy sát giờ, phần cọc giữ lại đang trong thời gian chờ rút",
            )

        if refund_amount > 0:
            if wallet:
                wallet.deduct_frozen(refund_amount)
            credit_customer_balance(
                booking,
                refund_amount,
                reason=f"Hoàn {refund_amount:,.0f}đ vào số dư nội bộ do khách hủy booking",
            )

        if refund_amount <= 0:
            booking.deposit_refund_status = "NONE"
            booking.refunded_at = None
            booking.save(update_fields=["deposit_refund_status", "refunded_at"])

    return {"refund_amount": refund_amount, "retained_amount": retained_amount}


def auto_finalize_due_bookings():
    now = timezone.now()
    cutoff = now - timedelta(hours=settings.BOOKING_AUTO_COMPLETE_AFTER_HOURS)
    due_bookings = [
        booking
        for booking in Booking.objects.select_related("time_slot", "restaurant", "customer")
        .filter(status="CONFIRMED", finalized_at__isnull=True)
        if booking.reservation_starts_at <= cutoff
    ]

    count = 0
    for booking in due_bookings:
        booking.status = "COMPLETED"
        booking.finalized_at = now
        booking.rejection_reason = "Hệ thống tự động hoàn thành sau thời gian phục vụ"
        booking.save(update_fields=["status", "finalized_at", "rejection_reason"])
        move_booking_deposit_to_settlement(booking)
        award_booking_loyalty_points(booking)
        count += 1
    return count


def release_partner_settlements():
    now = timezone.now()
    releasable_bookings = Booking.objects.filter(
        status__in=["COMPLETED", "NO_SHOW", "CANCELLED"],
        settlement_available_at__isnull=False,
        settlement_available_at__lte=now,
    ).select_related("restaurant__partner")

    count = 0
    for booking in releasable_bookings:
        tx = (
            Transaction.objects.filter(
                booking=booking,
                transaction_type="PAYMENT",
                status="PENDING",
            )
            .order_by("-created_at")
            .first()
        )
        if not tx or not tx.wallet:
            continue

        wallet = tx.wallet
        gross_amount = Decimal(str(tx.amount))
        fee_rate = Decimal(str(getattr(settings, "PLATFORM_FEE_RATE", Decimal("0.10"))))
        platform_fee = (gross_amount * fee_rate).quantize(Decimal("1.00"))
        partner_net = gross_amount - platform_fee

        # Release full settlement amount but only credit net amount to partner wallet.
        if wallet.settlement_balance < gross_amount:
            continue
        wallet.settlement_balance = Decimal(str(wallet.settlement_balance)) - gross_amount
        wallet.balance = Decimal(str(wallet.balance)) + partner_net
        wallet.save(update_fields=["settlement_balance", "balance", "updated_at"])

        tx.status = "SUCCESS"
        tx.note = f"Đã mở khóa settlement. Gross={gross_amount:,.0f}đ, Fee={platform_fee:,.0f}đ, Net={partner_net:,.0f}đ"
        tx.save(update_fields=["status", "note"])

        if platform_fee > 0:
            Transaction.objects.create(
                wallet=None,
                booking=booking,
                amount=platform_fee,
                transaction_type="PLATFORM_FEE",
                status="SUCCESS",
                payment_method="SYSTEM_FEE",
                transaction_id=f"FEE_{booking.id}_{uuid.uuid4().hex[:8]}",
                note=f"Phí nền tảng {int(fee_rate * 100)}% từ tiền cọc booking #{booking.id}",
            )

        booking.settlement_available_at = None
        booking.save(update_fields=["settlement_available_at"])
        count += 1
    return count


def process_vnpay_payment_result(input_data):
    vnp = vnpay()
    vnp.response_data = dict(input_data)
    config = settings.VNPAY_CONFIG

    if not vnp.validate_response(config["vnp_HashSecret"]):
        return {"ok": False, "rsp_code": "97", "message": "Invalid Signature"}

    order_id = input_data.get("vnp_TxnRef")
    response_code = input_data.get("vnp_ResponseCode")
    try:
        tx = Transaction.objects.select_related("booking", "wallet").get(transaction_id=order_id)
    except Transaction.DoesNotExist:
        return {"ok": False, "rsp_code": "01", "message": "Order not found"}

    tx.provider_response_code = response_code
    tx.provider_transaction_no = input_data.get("vnp_TransactionNo")
    tx.provider_pay_date = input_data.get("vnp_PayDate")

    amount = int(input_data.get("vnp_Amount", 0))
    expected_amount = int(tx.amount * 100)
    if amount != expected_amount:
        tx.status = "FAILED"
        tx.note = f"Sai số tiền. Received={amount}, Expected={expected_amount}"
        tx.save(update_fields=["status", "note", "provider_response_code", "provider_transaction_no", "provider_pay_date"])
        return {"ok": False, "rsp_code": "04", "message": "Invalid amount"}

    if tx.status == "SUCCESS":
        return {
            "ok": True,
            "rsp_code": "00",
            "message": "Already confirmed",
            "booking_id": tx.booking_id,
        }

    if response_code != "00":
        tx.status = "FAILED"
        tx.note = "Thanh toán thất bại hoặc bị hủy bên VNPay"
        tx.save(update_fields=["status", "note", "provider_response_code", "provider_transaction_no", "provider_pay_date"])
        return {"ok": True, "rsp_code": "00", "message": "Payment failed", "booking_id": tx.booking_id}

    booking = tx.booking
    expired_or_invalid = (
        booking.status not in {"PENDING", "CONFIRMED"}
        or (booking.deposit_expires_at and booking.deposit_expires_at < timezone.now())
    )

    mark_booking_paid(tx, input_data, update_booking=not expired_or_invalid)

    if expired_or_invalid and booking.deposit_refund_status == "NONE":
        try:
            refund_booking_deposit(
                booking,
                actor_name="system",
                ip_addr="127.0.0.1",
                reason="Thanh toán đến sau khi booking đã hết hiệu lực",
            )
        except Exception as exc:
            logger.exception("Auto refund failed for booking %s: %s", booking.id, exc)
            booking.deposit_refund_status = "FAILED"
            booking.save(update_fields=["deposit_refund_status"])
        return {
            "ok": True,
            "rsp_code": "00",
            "message": "Payment received and refund initiated",
            "booking_id": booking.id,
        }

    return {"ok": True, "rsp_code": "00", "message": "Confirm Success", "booking_id": booking.id}
