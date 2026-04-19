from django.db import models
from accounts.models import User
from restaurants.models import Restaurant
from bookings.models import Booking

class Voucher(models.Model):
    VOUCHER_TYPES = [
        ('PERCENTAGE', 'Percentage Discount'),
        ('FIXED', 'Fixed Amount Discount')
    ]
    
    code = models.CharField(max_length=50, unique=True)
    description = models.TextField(null=True, blank=True)
    voucher_type = models.CharField(max_length=20, choices=VOUCHER_TYPES)
    discount_value = models.DecimalField(max_digits=10, decimal_places=2)
    max_discount_amount = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    min_order_value = models.DecimalField(max_digits=10, decimal_places=2, default=0.00)
    
    # Nếu null thì voucher áp dụng toàn platform (Platform Voucher), nếu có thì áp dụng cho 1 nhà hàng
    restaurant = models.ForeignKey(Restaurant, on_delete=models.CASCADE, related_name='vouchers', null=True, blank=True)
    
    valid_from = models.DateTimeField()
    valid_to = models.DateTimeField()
    is_active = models.BooleanField(default=True)
    usage_limit = models.IntegerField(default=100)
    used_count = models.IntegerField(default=0)
    points_cost = models.IntegerField(default=0)

    class Meta:
        db_table = 'vouchers'
        ordering = ['-valid_to']

    def __str__(self):
        return f"Voucher {self.code} - {self.discount_value} {self.voucher_type}"

class UserVoucher(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='vouchers')
    voucher = models.ForeignKey(Voucher, on_delete=models.CASCADE, related_name='user_vouchers')
    is_used = models.BooleanField(default=False)
    collected_at = models.DateTimeField(auto_now_add=True)
    used_at = models.DateTimeField(null=True, blank=True)
    
    class Meta:
        db_table = 'user_vouchers'
        unique_together = ('user', 'voucher')

    def __str__(self):
        return f"{self.user.phone_number} - {self.voucher.code}"

class LoyaltyTransaction(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='loyalty_transactions')
    booking = models.ForeignKey(Booking, on_delete=models.SET_NULL, null=True, blank=True)
    points_changed = models.IntegerField()
    transaction_type = models.CharField(max_length=20, choices=[('EARN', 'Earn'), ('REDEEM', 'Redeem')])
    description = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'loyalty_transactions'
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.user.phone_number}: {self.points_changed} points ({self.transaction_type})"
