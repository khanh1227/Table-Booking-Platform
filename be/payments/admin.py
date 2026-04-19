from django.contrib import admin
from .models import Wallet, Transaction, DepositPolicy

@admin.register(Wallet)
class WalletAdmin(admin.ModelAdmin):
    list_display = ('partner', 'balance', 'updated_at')
    search_fields = ('partner__business_name',)

@admin.register(Transaction)
class TransactionAdmin(admin.ModelAdmin):
    list_display = ('transaction_type', 'amount', 'wallet', 'status', 'created_at')
    list_filter = ('transaction_type', 'status')
    search_fields = ('transaction_id', 'wallet__partner__business_name')

@admin.register(DepositPolicy)
class DepositPolicyAdmin(admin.ModelAdmin):
    list_display = ('restaurant', 'is_required', 'deposit_amount', 'minimum_guests_for_deposit')
    list_filter = ('is_required',)
    search_fields = ('restaurant__name',)
