from django.db.models.signals import post_save
from django.dispatch import receiver

from bookings.models import Booking


@receiver(post_save, sender=Booking)
def handle_booking_completion(sender, instance, created, **kwargs):
    """
    Settlement được xử lý tập trung trong bookings.views/payments.services.
    Signal này giữ lại để tránh import side-effects cũ nhưng không còn thực hiện ghi tiền.
    """
    return None
