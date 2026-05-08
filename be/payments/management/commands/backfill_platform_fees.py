from decimal import Decimal
import uuid

from django.conf import settings
from django.core.management.base import BaseCommand
from django.db import transaction

from bookings.models import Booking
from payments.models import Transaction


class Command(BaseCommand):
    help = "Hồi tố phí nền tảng cho booking cũ và trừ trực tiếp vào số dư khả dụng của partner."

    def add_arguments(self, parser):
        parser.add_argument(
            "--dry-run",
            action="store_true",
            help="Chỉ in kết quả dự kiến, không ghi dữ liệu.",
        )

    def handle(self, *args, **options):
        dry_run = options["dry_run"]
        fee_rate = Decimal(str(getattr(settings, "PLATFORM_FEE_RATE", Decimal("0.10"))))

        eligible_bookings = (
            Booking.objects.filter(
                status__in=["COMPLETED", "NO_SHOW", "CANCELLED"],
                is_deposit_paid=True,
                deposit_amount__gt=0,
            )
            .exclude(
                transactions__transaction_type="PLATFORM_FEE",
                transactions__status="SUCCESS",
            )
            .select_related("restaurant__partner__wallet")
            .distinct()
        )

        total_fee = Decimal("0")
        affected = 0
        for booking in eligible_bookings:
            partner = booking.restaurant.partner
            if not hasattr(partner, "wallet"):
                continue

            wallet = partner.wallet
            fee_amount = (Decimal(str(booking.deposit_amount)) * fee_rate).quantize(Decimal("1.00"))
            total_fee += fee_amount
            affected += 1

            if dry_run:
                continue

            with transaction.atomic():
                wallet.balance = Decimal(str(wallet.balance)) - fee_amount
                wallet.save(update_fields=["balance", "updated_at"])
                Transaction.objects.create(
                    wallet=wallet,
                    booking=booking,
                    amount=fee_amount,
                    transaction_type="PLATFORM_FEE",
                    status="SUCCESS",
                    payment_method="SYSTEM_FEE_BACKFILL",
                    transaction_id=f"FEEBK_{booking.id}_{uuid.uuid4().hex[:8]}",
                    note=f"Hồi tố phí nền tảng {int(fee_rate * 100)}% cho booking cũ #{booking.id}",
                )

        mode = "DRY-RUN" if dry_run else "APPLIED"
        self.stdout.write(
            self.style.SUCCESS(
                f"[{mode}] affected_bookings={affected}, total_fee={total_fee:,.0f}đ, fee_rate={int(fee_rate * 100)}%"
            )
        )
