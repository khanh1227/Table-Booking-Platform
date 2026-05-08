from rest_framework import serializers
from .models import Wallet, Transaction, DepositPolicy

class WalletSerializer(serializers.ModelSerializer):
    partner_name = serializers.ReadOnlyField(source='partner.business_name')
    
    class Meta:
        model = Wallet
        fields = ['id', 'partner', 'partner_name', 'balance', 'frozen_balance', 'settlement_balance', 'created_at', 'updated_at']
        read_only_fields = ['id', 'partner', 'balance', 'frozen_balance', 'settlement_balance']

class TransactionSerializer(serializers.ModelSerializer):
    class Meta:
        model = Transaction
        fields = '__all__'
        read_only_fields = ['id', 'created_at']

class DepositPolicySerializer(serializers.ModelSerializer):
    class Meta:
        model = DepositPolicy
        fields = ['id', 'restaurant', 'is_required', 'deposit_amount', 'deposit_per_guest', 'deposit_percentage', 'minimum_guests_for_deposit']
        read_only_fields = ['id', 'restaurant']

    def validate(self, attrs):
        is_required = attrs.get('is_required', getattr(self.instance, 'is_required', False))
        deposit_amount = attrs.get('deposit_amount', getattr(self.instance, 'deposit_amount', 0))
        deposit_per_guest = attrs.get('deposit_per_guest', getattr(self.instance, 'deposit_per_guest', 0))
        if is_required and deposit_amount <= 0 and deposit_per_guest <= 0:
            raise serializers.ValidationError("Phải cấu hình ít nhất một mức tiền cọc hợp lệ.")
        return attrs

    def validate_deposit_per_guest(self, value):
        if value < 10000:
            raise serializers.ValidationError("Tiền cọc tối thiểu là 10,000đ mỗi khách để đảm bảo uy tín.")
        if value > 1000000:
            raise serializers.ValidationError("Tiền cọc tối đa là 1,000,000đ mỗi khách.")
        return value
