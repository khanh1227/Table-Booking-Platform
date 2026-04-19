from rest_framework import serializers
from .models import Wallet, Transaction, DepositPolicy

class WalletSerializer(serializers.ModelSerializer):
    partner_name = serializers.ReadOnlyField(source='partner.business_name')
    
    class Meta:
        model = Wallet
        fields = ['id', 'partner', 'partner_name', 'balance', 'frozen_balance', 'created_at', 'updated_at']
        read_only_fields = ['id', 'partner', 'balance', 'frozen_balance']

class TransactionSerializer(serializers.ModelSerializer):
    class Meta:
        model = Transaction
        fields = '__all__'
        read_only_fields = ['id', 'created_at']

class DepositPolicySerializer(serializers.ModelSerializer):
    class Meta:
        model = DepositPolicy
        fields = ['id', 'restaurant', 'is_required', 'deposit_amount', 'deposit_percentage', 'minimum_guests_for_deposit']
        read_only_fields = ['id', 'restaurant']
