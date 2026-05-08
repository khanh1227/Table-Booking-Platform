from django.core.management.base import BaseCommand

from payments.services import cleanup_expired_pending_bookings


class Command(BaseCommand):
    help = "Hủy các booking quá hạn thanh toán cọc."

    def handle(self, *args, **options):
        count = cleanup_expired_pending_bookings()
        self.stdout.write(self.style.SUCCESS(f"Expired {count} unpaid booking(s)."))
