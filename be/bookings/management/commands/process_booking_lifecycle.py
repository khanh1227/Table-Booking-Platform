from django.core.management.base import BaseCommand

from payments.services import auto_finalize_due_bookings, cleanup_expired_pending_bookings, release_partner_settlements


class Command(BaseCommand):
    help = "Xử lý vòng đời booking: hủy cọc quá hạn, auto complete, mở khóa tiền quyết toán."

    def handle(self, *args, **options):
        expired = cleanup_expired_pending_bookings()
        completed = auto_finalize_due_bookings()
        released = release_partner_settlements()
        self.stdout.write(
            self.style.SUCCESS(
                f"Expired={expired}, AutoCompleted={completed}, ReleasedSettlements={released}"
            )
        )
