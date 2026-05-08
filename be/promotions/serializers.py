from rest_framework import serializers
from .models import Voucher, UserVoucher, LoyaltyTransaction

class VoucherSerializer(serializers.ModelSerializer):
    restaurant_name = serializers.ReadOnlyField(source='restaurant.name')
    
    class Meta:
        model = Voucher
        fields = ['id', 'code', 'description', 'voucher_type', 'discount_value', 'max_discount_amount', 'min_order_value', 'restaurant', 'restaurant_name', 'valid_from', 'valid_to', 'is_active', 'usage_limit', 'used_count', 'points_cost']
        read_only_fields = ['id', 'used_count']

class UserVoucherSerializer(serializers.ModelSerializer):
    voucher_details = VoucherSerializer(source='voucher', read_only=True)
    
    class Meta:
        model = UserVoucher
        fields = ['id', 'user', 'voucher', 'voucher_details', 'is_used', 'collected_at', 'used_at']
        read_only_fields = ['id', 'collected_at']

class LoyaltyTransactionSerializer(serializers.ModelSerializer):
    class Meta:
        model = LoyaltyTransaction
        fields = '__all__'
        read_only_fields = ['id', 'created_at']
