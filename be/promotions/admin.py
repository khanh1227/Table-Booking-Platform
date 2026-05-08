from django.contrib import admin
from .models import Voucher, UserVoucher, LoyaltyTransaction

@admin.register(Voucher)
class VoucherAdmin(admin.ModelAdmin):
    list_display = ('code', 'voucher_type', 'discount_value', 'is_active', 'valid_to')
    list_filter = ('voucher_type', 'is_active')
    search_fields = ('code',)

@admin.register(UserVoucher)
class UserVoucherAdmin(admin.ModelAdmin):
    list_display = ('user', 'voucher', 'is_used', 'collected_at')
    list_filter = ('is_used',)

@admin.register(LoyaltyTransaction)
class LoyaltyTransactionAdmin(admin.ModelAdmin):
    list_display = ('user', 'points_changed', 'transaction_type', 'created_at')
    list_filter = ('transaction_type',)
    search_fields = ('user__phone_number',)
