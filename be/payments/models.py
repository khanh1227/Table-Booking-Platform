from django.db import models
from accounts.models import Partner
from restaurants.models import Restaurant
from bookings.models import Booking

class Wallet(models.Model):
    partner = models.OneToOneField(Partner, on_delete=models.CASCADE, related_name='wallet')
    balance = models.DecimalField(max_digits=12, decimal_places=2, default=0.00)
    frozen_balance = models.DecimalField(max_digits=12, decimal_places=2, default=0.00) # Tiền cọc đang giữ
    settlement_balance = models.DecimalField(max_digits=12, decimal_places=2, default=0.00) # Tiền chờ mở khóa sau hoàn thành
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'wallets'

    def __str__(self):
        return f"Wallet of {self.partner.business_name}: {self.balance}"

    def add_frozen(self, amount):
        self.frozen_balance += amount
        self.save()

    def release_frozen(self, amount):
        """Chuyển tiền từ đóng băng sang số dư thực tế (khi hoàn thành đơn)"""
        if self.frozen_balance >= amount:
            self.frozen_balance -= amount
            self.balance += amount
            self.save()

    def deduct_frozen(self, amount):
        """Trừ tiền đóng băng (khi hoàn tiền cho khách)"""
        if self.frozen_balance >= amount:
            self.frozen_balance -= amount
            self.save()

    def move_frozen_to_settlement(self, amount):
        if self.frozen_balance >= amount:
            self.frozen_balance -= amount
            self.settlement_balance += amount
            self.save()

    def release_settlement(self, amount):
        if self.settlement_balance >= amount:
            self.settlement_balance -= amount
            self.balance += amount
            self.save()

class Transaction(models.Model):
    TRANSACTION_TYPES = [
        ('DEPOSIT', 'Deposit'),
        ('PAYMENT', 'Payment'),
        ('WITHDRAWAL', 'Withdrawal'),
        ('REFUND', 'Refund'),
        ('PLATFORM_FEE', 'Platform fee'),
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
    provider_transaction_no = models.CharField(max_length=100, null=True, blank=True)
    provider_create_date = models.CharField(max_length=14, null=True, blank=True)
    provider_pay_date = models.CharField(max_length=14, null=True, blank=True)
    provider_response_code = models.CharField(max_length=10, null=True, blank=True)
    note = models.TextField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'transactions'

    def __str__(self):
        return f"{self.transaction_type} - {self.amount} - {self.status}"

class DepositPolicy(models.Model):
    restaurant = models.OneToOneField(Restaurant, on_delete=models.CASCADE, related_name='deposit_policy')
    is_required = models.BooleanField(default=True)
    deposit_amount = models.DecimalField(max_digits=12, decimal_places=2, default=0.00)
    deposit_per_guest = models.DecimalField(max_digits=12, decimal_places=2, default=0.00, help_text="Tiền cọc tính trên mỗi đầu người")
    deposit_percentage = models.DecimalField(max_digits=5, decimal_places=2, null=True, blank=True) # Nếu thu theo %
    minimum_guests_for_deposit = models.IntegerField(default=1)

    class Meta:
        db_table = 'deposit_policies'

    def __str__(self):
        return f"Deposit Policy for {self.restaurant.name}"
