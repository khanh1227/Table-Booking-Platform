# bookings/models.py
from django.db import models
from django.core.exceptions import ValidationError
from django.utils import timezone
from datetime import datetime
from accounts.models import User
from restaurants.models import Restaurant, TimeSlot


class Booking(models.Model):
    STATUS_CHOICES = [
        ('PENDING', 'Chờ xác nhận'),
        ('CONFIRMED', 'Đã xác nhận'),
        ('REJECTED', 'Đã từ chối'),
        ('CANCELLED', 'Đã hủy'),
        ('COMPLETED', 'Hoàn thành'),
        ('NO_SHOW', 'Khách không đến'),
    ]
    REFUND_STATUS_CHOICES = [
        ('NONE', 'Không hoàn tiền'),
        ('PENDING', 'Đang hoàn tiền'),
        ('SUCCESS', 'Đã hoàn tiền'),
        ('FAILED', 'Hoàn tiền thất bại'),
    ]

    customer = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name='bookings'
    )
    restaurant = models.ForeignKey(
        Restaurant,
        on_delete=models.CASCADE,
        related_name='bookings'
    )
    time_slot = models.ForeignKey(
        TimeSlot,
        on_delete=models.CASCADE,
        related_name='bookings'
    )
    booking_date = models.DateField()
    number_of_guests = models.IntegerField()
    special_request = models.TextField(blank=True, null=True)
    status = models.CharField(
        max_length=20,
        choices=STATUS_CHOICES,
        default='PENDING'
    )
    created_at = models.DateTimeField(auto_now_add=True)
    confirmed_at = models.DateTimeField(blank=True, null=True)
    finalized_at = models.DateTimeField(null=True, blank=True, help_text="Thời điểm nhà hàng/hệ thống chốt kết quả phục vụ")
    deposit_expires_at = models.DateTimeField(null=True, blank=True, help_text="Thời hạn thanh toán tiền cọc")
    settlement_available_at = models.DateTimeField(null=True, blank=True, help_text="Thời điểm tiền cọc trở thành khả dụng cho nhà hàng")
    rejection_reason = models.TextField(blank=True, null=True, help_text="Lý do từ chối đơn")

    # Thanh toán cọc
    is_deposit_paid = models.BooleanField(default=False)
    deposit_amount = models.DecimalField(max_digits=12, decimal_places=2, default=0.00)
    deposit_refund_status = models.CharField(
        max_length=20,
        choices=REFUND_STATUS_CHOICES,
        default='NONE'
    )
    refunded_at = models.DateTimeField(null=True, blank=True)

    # Voucher / Khuyến mãi
    voucher = models.ForeignKey(
        'promotions.Voucher',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='bookings'
    )
    discount_amount = models.DecimalField(max_digits=12, decimal_places=2, default=0.00)

    class Meta:
        db_table = 'bookings'
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['customer', 'status']),
            models.Index(fields=['restaurant', 'booking_date']),
            models.Index(fields=['status', 'booking_date']),
        ]

    def __str__(self):
        return f"Booking #{self.id} - {self.customer.full_name} at {self.restaurant.name}"

    def clean(self):
        """Validate booking data"""
        errors = {}

        # 1. Kiểm tra ngày không được ở quá khứ
        if self.booking_date < timezone.now().date():
            errors['booking_date'] = "Không thể đặt bàn cho ngày trong quá khứ"

        # 2. Kiểm tra số khách > 0
        if self.number_of_guests <= 0:
            errors['number_of_guests'] = "Số khách phải lớn hơn 0"

        # 3. Kiểm tra time_slot thuộc về restaurant
        if self.time_slot and self.restaurant:
            if self.time_slot.restaurant_id != self.restaurant_id:
                errors['time_slot'] = "Khung giờ không thuộc về nhà hàng này"

        # 4. Kiểm tra time_slot có đang active không
        if self.time_slot and not self.time_slot.is_active:
            errors['time_slot'] = "Khung giờ này hiện không khả dụng"

        # 5. Kiểm tra restaurant có đang APPROVED không
        if self.restaurant and self.restaurant.status != 'APPROVED':
            errors['restaurant'] = "Nhà hàng này hiện không nhận đặt bàn"

        if errors:
            raise ValidationError(errors)

    def save(self, *args, **kwargs):
        # Auto-fill confirmed_at when status changes to CONFIRMED
        if self.status == 'CONFIRMED' and not self.confirmed_at:
            self.confirmed_at = timezone.now()
        
        self.full_clean()
        super().save(*args, **kwargs)

    @property
    def is_expired(self):
        """Kiểm tra đơn hàng đã quá ngày chưa"""
        return self.booking_date < timezone.now().date()

    def can_cancel(self):
        """Kiểm tra có thể hủy booking không"""
        if self.is_expired and self.status in ['PENDING', 'CONFIRMED']:
            return False
        return self.status in ['PENDING', 'CONFIRMED']

    def can_confirm(self):
        """Kiểm tra có thể xác nhận không"""
        if self.is_expired:
            return False
        return self.status == 'PENDING'

    def can_reject(self):
        """Kiểm tra có thể từ chối không"""
        # Cho phép từ chối kể cả khi đã quá hạn để giải quyết khiếu nại (nếu cần)
        return self.status in ['PENDING', 'CONFIRMED']

    def can_complete(self):
        """Kiểm tra có thể đánh dấu hoàn thành không"""
        if self.status != 'CONFIRMED':
            return False
        return timezone.now() >= self.reservation_starts_at

    def can_mark_no_show(self):
        """Kiểm tra có thể đánh dấu no-show không"""
        if self.status != 'CONFIRMED':
            return False
        return timezone.now() >= self.reservation_starts_at

    @property
    def reservation_starts_at(self):
        naive_dt = datetime.combine(self.booking_date, self.time_slot.start_time)
        return timezone.make_aware(naive_dt, timezone.get_current_timezone())

    @staticmethod
    def count_bookings_for_slot(restaurant_id, booking_date, time_slot_id):
        """
        Đếm số booking còn hiệu lực cho một slot cụ thể
        (không tính CANCELLED và REJECTED)
        """
        return Booking.objects.filter(
            restaurant_id=restaurant_id,
            booking_date=booking_date,
            time_slot_id=time_slot_id,
            status__in=['PENDING', 'CONFIRMED', 'COMPLETED', 'NO_SHOW']
        ).exclude(
            status='PENDING',
            is_deposit_paid=False,
            deposit_expires_at__isnull=False,
            deposit_expires_at__lt=timezone.now()
        ).count()

    @staticmethod
    def is_slot_available(restaurant_id, booking_date, time_slot_id):
        """
        Kiểm tra slot còn chỗ trống không (có tính đến Overrides)
        """
        try:
            from restaurants.models import TimeSlot, TimeSlotOverride
            time_slot = TimeSlot.objects.get(id=time_slot_id)
            
            if not time_slot.is_active:
                return False, "Khung giờ này không hoạt động"

            # 1. Kiểm tra Override
            override = TimeSlotOverride.objects.filter(
                restaurant_id=restaurant_id, 
                date=booking_date, 
                time_slot_id=time_slot_id
            ).first()
            
            if not override:
                override = TimeSlotOverride.objects.filter(
                    restaurant_id=restaurant_id,
                    date=booking_date,
                    time_slot__isnull=True
                ).first()

            if override:
                if override.is_closed:
                    return False, f"Nhà hàng thông báo đóng cửa vào ngày {booking_date}"
                max_limit = override.max_bookings if override.max_bookings is not None else time_slot.max_bookings
            else:
                max_limit = time_slot.max_bookings

            current_bookings = Booking.count_bookings_for_slot(
                restaurant_id, booking_date, time_slot_id
            )

            if max_limit and current_bookings >= max_limit:
                return False, f"Khung giờ này đã đầy ({current_bookings}/{max_limit})"

            return True, f"Còn trống ({current_bookings}/{max_limit or 'unlimited'})"

        except TimeSlot.DoesNotExist:
            return False, "Khung giờ không tồn tại"
