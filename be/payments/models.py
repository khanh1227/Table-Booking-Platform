from django.db import models
from accounts.models import Partner
from restaurants.models import Restaurant
from bookings.models import Booking

class Wallet(models.Model):
    partner = models.OneToOneField(Partner, on_delete=models.CASCADE, related_name='wallet')
    balance = models.DecimalField(max_digits=12, decimal_places=2, default=0.00)
    frozen_balance = models.DecimalField(max_digits=12, decimal_places=2, default=0.00) # Tiền cọc đang giữ
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'wallets'

    def __str__(self):
        return f"Wallet of {self.partner.business_name}: {self.balance}"

class Transaction(models.Model):
    TRANSACTION_TYPES = [
        ('DEPOSIT', 'Deposit'),
        ('PAYMENT', 'Payment'),
        ('WITHDRAWAL', 'Withdrawal'),
        ('REFUND', 'Refund')
    ]
    STATUS_CHOICES = [
        ('PENDING', 'Pending'),
        ('SUCCESS', 'Success'),
        ('FAILED', 'Failed')
    ]

    wallet = models.ForeignKey(Wallet, on_delete=models.CASCADE, related_name='transactions', null=True, blank=True)
    booking = models.ForeignKey(Booking, on_delete=models.SET_NULL, related_name='transactions', null=True, blank=True)
    amount = models.DecimalField(max_digits=12, decimal_places=2)
    transaction_type = models.CharField(max_length=20, choices=TRANSACTION_TYPES)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='PENDING')
    payment_method = models.CharField(max_length=50, null=True, blank=True) # VD: VNPay, Momo
    transaction_id = models.CharField(max_length=100, unique=True, null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'transactions'

    def __str__(self):
        return f"{self.transaction_type} - {self.amount} - {self.status}"

class DepositPolicy(models.Model):
    restaurant = models.OneToOneField(Restaurant, on_delete=models.CASCADE, related_name='deposit_policy')
    is_required = models.BooleanField(default=False)
    deposit_amount = models.DecimalField(max_digits=12, decimal_places=2, default=0.00)
    deposit_percentage = models.DecimalField(max_digits=5, decimal_places=2, null=True, blank=True) # Nếu thu theo %
    minimum_guests_for_deposit = models.IntegerField(default=1)

    class Meta:
        db_table = 'deposit_policies'

    def __str__(self):
        return f"Deposit Policy for {self.restaurant.name}"
