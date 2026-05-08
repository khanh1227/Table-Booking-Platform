# bookings/serializers.py
from rest_framework import serializers
from django.utils import timezone
from .models import Booking
from restaurants.models import Restaurant, TimeSlot
from promotions.models import Voucher, UserVoucher


class BookingListSerializer(serializers.ModelSerializer):
    """Serializer cho list view (ít thông tin hơn)"""
    customer_name = serializers.CharField(source='customer.full_name', read_only=True)
    customer_phone = serializers.CharField(source='customer.phone_number', read_only=True)
    restaurant_name = serializers.CharField(source='restaurant.name', read_only=True)
    restaurant_address = serializers.CharField(source='restaurant.address', read_only=True)
    time_slot_display = serializers.SerializerMethodField()
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    has_review = serializers.SerializerMethodField()
    review_details = serializers.SerializerMethodField()
    voucher_code = serializers.CharField(source='voucher.code', read_only=True, default=None)
    can_cancel = serializers.SerializerMethodField()
    is_expired = serializers.BooleanField(read_only=True)

    class Meta:
        model = Booking
        fields = [
            'id', 'restaurant', 'customer_name', 'customer_phone', 'restaurant_name',
            'restaurant_address', 'booking_date', 'time_slot_display',
            'number_of_guests', 'status', 'status_display', 'has_review', 
            'review_details', 'created_at', 'is_deposit_paid', 'deposit_amount',
            'voucher_code', 'discount_amount', 'deposit_expires_at', 'deposit_refund_status', 'settlement_available_at', 'rejection_reason',
            'can_cancel', 'is_expired'
        ]

    def get_time_slot_display(self, obj):
        return f"{obj.time_slot.start_time.strftime('%H:%M')}"

    def get_has_review(self, obj):
        return hasattr(obj, 'review')

    def get_review_details(self, obj):
        if hasattr(obj, 'review'):
            return {
                'rating': obj.review.rating,
                'comment': obj.review.comment,
                'created_at': obj.review.created_at.strftime('%d/%m/%Y')
            }
        return None

    def get_can_cancel(self, obj):
        return obj.can_cancel()


class BookingDetailSerializer(serializers.ModelSerializer):
    """Serializer cho detail view (đầy đủ thông tin)"""
    customer_name = serializers.CharField(source='customer.full_name', read_only=True)
    customer_phone = serializers.CharField(source='customer.phone_number', read_only=True)
    customer_email = serializers.CharField(source='customer.email', read_only=True)
    
    restaurant_name = serializers.CharField(source='restaurant.name', read_only=True)
    restaurant_address = serializers.CharField(source='restaurant.address', read_only=True)
    restaurant_phone = serializers.CharField(source='restaurant.phone_number', read_only=True)
    
    time_slot_info = serializers.SerializerMethodField()
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    
    can_cancel = serializers.SerializerMethodField()
    can_confirm = serializers.SerializerMethodField()
    can_reject = serializers.SerializerMethodField()

    voucher_code = serializers.CharField(source='voucher.code', read_only=True, default=None)
    is_expired = serializers.BooleanField(read_only=True)
    has_review = serializers.SerializerMethodField()
    review_details = serializers.SerializerMethodField()

    class Meta:
        model = Booking
        fields = [
            'id', 'customer_name', 'customer_phone', 'customer_email',
            'restaurant_name', 'restaurant_address', 'restaurant_phone',
            'booking_date', 'time_slot_info', 'number_of_guests',
            'special_request', 'status', 'status_display',
            'created_at', 'confirmed_at',
            'can_cancel', 'can_confirm', 'can_reject',
            'is_deposit_paid', 'deposit_amount',
            'voucher_code', 'discount_amount',
            'deposit_expires_at', 'deposit_refund_status', 'finalized_at', 'settlement_available_at', 'rejection_reason', 'is_expired',
            'has_review', 'review_details'
        ]

    def get_time_slot_info(self, obj):
        return {
            'id': obj.time_slot.id,
            'start_time': obj.time_slot.start_time.strftime('%H:%M'),
            'display': f"{obj.time_slot.start_time.strftime('%H:%M')}"
        }

    def get_can_cancel(self, obj):
        return obj.can_cancel()

    def get_can_confirm(self, obj):
        return obj.can_confirm()

    def get_can_reject(self, obj):
        return obj.can_reject()

    def get_has_review(self, obj):
        return hasattr(obj, 'review')

    def get_review_details(self, obj):
        if hasattr(obj, 'review'):
            return {
                'rating': obj.review.rating,
                'comment': obj.review.comment,
                'created_at': obj.review.created_at.strftime('%d/%m/%Y')
            }
        return None


class BookingCreateSerializer(serializers.ModelSerializer):
    """Serializer cho tạo booking mới"""
    voucher_code = serializers.CharField(required=False, allow_blank=True, write_only=True)
    
    class Meta:
        model = Booking
        fields = [
            'restaurant', 'time_slot', 'booking_date',
            'number_of_guests', 'special_request', 'voucher_code'
        ]

    def validate_booking_date(self, value):
        """Validate ngày đặt không được ở quá khứ"""
        if value < timezone.now().date():
            raise serializers.ValidationError("Không thể đặt bàn cho ngày trong quá khứ")
        return value

    def validate_number_of_guests(self, value):
        """Validate số khách > 0"""
        if value <= 0:
            raise serializers.ValidationError("Số khách phải lớn hơn 0")
        return value

    def validate(self, data):
        """Cross-field validation"""
        restaurant = data.get('restaurant')
        time_slot = data.get('time_slot')
        booking_date = data.get('booking_date')

        # 1. Kiểm tra time_slot thuộc về restaurant
        if time_slot.restaurant != restaurant:
            raise serializers.ValidationError({
                'time_slot': 'Khung giờ không thuộc về nhà hàng này'
            })

        # 2. Kiểm tra time_slot có active không
        if not time_slot.is_active:
            raise serializers.ValidationError({
                'time_slot': 'Khung giờ này hiện không khả dụng'
            })

        # 3. Kiểm tra restaurant có APPROVED không
        if restaurant.status != 'APPROVED':
            raise serializers.ValidationError({
                'restaurant': 'Nhà hàng này hiện không nhận đặt bàn'
            })

        # 4. Kiểm tra slot còn chỗ trống không
        available, message = Booking.is_slot_available(
            restaurant.id, booking_date, time_slot.id
        )
        if not available:
            raise serializers.ValidationError({
                'time_slot': message
            })

        # 5. Kiểm tra trùng lặp (Idempotency check)
        user = self.context['request'].user
        existing_booking = Booking.objects.filter(
            customer=user,
            restaurant=restaurant,
            booking_date=booking_date,
            time_slot=time_slot,
            status__in=['PENDING', 'CONFIRMED']
        ).exists()
        if existing_booking:
            raise serializers.ValidationError({
                'non_field_errors': 'Bạn đã có một đơn đặt bàn cho khung giờ này. Vui lòng kiểm tra lại trong "Đặt bàn của tôi".'
            })

        # 6. Kiểm tra số khách tối đa của slot
        guests = data.get('number_of_guests')
        if time_slot.max_guests_per_booking and guests and guests > time_slot.max_guests_per_booking:
            raise serializers.ValidationError({
                'number_of_guests': f"Khung giờ này chỉ nhận tối đa {time_slot.max_guests_per_booking} khách/đơn. Vui lòng liên hệ trực tiếp nhà hàng để đặt bàn đoàn lớn."
            })

        # 7. Chặn chủ nhà hàng tự đặt bàn tại chính nhà hàng mình
        if False and restaurant.partner and restaurant.partner.user == user:
            raise serializers.ValidationError({
                'non_field_errors': 'Bạn không thể đặt bàn tại nhà hàng do chính bạn sở hữu.'
            })

        # 5. Validate voucher nếu có
        voucher_code = data.pop('voucher_code', None)
        if voucher_code:
            try:
                voucher = Voucher.objects.get(code=voucher_code)
            except Voucher.DoesNotExist:
                raise serializers.ValidationError({
                    'voucher_code': 'Mã voucher không tồn tại'
                })

            now = timezone.now()
            if not voucher.is_active:
                raise serializers.ValidationError({'voucher_code': 'Voucher đã bị vô hiệu hóa'})
            if voucher.valid_from > now:
                raise serializers.ValidationError({'voucher_code': 'Voucher chưa tới ngày bắt đầu'})
            if voucher.valid_to < now:
                raise serializers.ValidationError({'voucher_code': 'Voucher đã hết hạn'})
            if voucher.used_count >= voucher.usage_limit:
                raise serializers.ValidationError({'voucher_code': 'Voucher đã hết lượt sử dụng'})

            # Kiểm tra restaurant match (nếu voucher gắn với NH cụ thể)
            if voucher.restaurant and voucher.restaurant != restaurant:
                raise serializers.ValidationError({
                    'voucher_code': 'Voucher này không áp dụng cho nhà hàng này'
                })

            # Kiểm tra user đã thu thập voucher chưa
            user = self.context['request'].user
            user_voucher = UserVoucher.objects.filter(user=user, voucher=voucher).first()
            if not user_voucher:
                raise serializers.ValidationError({
                    'voucher_code': 'Bạn chưa thu thập voucher này'
                })
            if user_voucher.is_used:
                raise serializers.ValidationError({
                    'voucher_code': 'Bạn đã sử dụng voucher này rồi'
                })

            # Lưu vào validated data
            data['_voucher'] = voucher
            data['_user_voucher'] = user_voucher

        return data

    def create(self, validated_data):
        """Tạo booking mới với customer từ request.user - AUTO CONFIRM"""
        from datetime import timedelta
        from payments.models import DepositPolicy
        
        user = self.context['request'].user
        validated_data['customer'] = user
        validated_data['status'] = 'CONFIRMED' # Mặc định tự động xác nhận
        validated_data['confirmed_at'] = timezone.now()
        
        # Thiết lập thời hạn cọc (5 phút)
        restaurant = validated_data['restaurant']
        guests = validated_data['number_of_guests']
        
        try:
            policy = DepositPolicy.objects.get(restaurant=restaurant)
            if policy.is_required and guests >= policy.minimum_guests_for_deposit:
                # Nếu yêu cầu cọc, chuyển trạng thái về PENDING
                validated_data['status'] = 'PENDING'
                validated_data['confirmed_at'] = None
                
                # Ưu tiên dùng deposit_per_guest nếu có set
                if policy.deposit_per_guest > 0:
                    validated_data['deposit_amount'] = policy.deposit_per_guest * guests
                else:
                    validated_data['deposit_amount'] = policy.deposit_amount
                
                validated_data['deposit_expires_at'] = timezone.now() + timedelta(minutes=5)
        except DepositPolicy.DoesNotExist:
            pass
            
        voucher = validated_data.pop('_voucher', None)
        user_voucher = validated_data.pop('_user_voucher', None)

        # Tính discount
        discount_amount = 0
        if voucher:
            if voucher.voucher_type == 'PERCENTAGE':
                # Giảm % - ở đây ta lưu giá trị % để FE hiển thị nếu cần, hoặc tính toán nếu có tổng bill
                discount_amount = voucher.discount_value
            else:
                discount_amount = voucher.discount_value

            if voucher.max_discount_amount and discount_amount > voucher.max_discount_amount:
                discount_amount = voucher.max_discount_amount

            validated_data['voucher'] = voucher
            validated_data['discount_amount'] = discount_amount

        booking = Booking.objects.create(**validated_data)
        
        # Cập nhật voucher usage
        if voucher and user_voucher:
            voucher.used_count += 1
            voucher.save(update_fields=['used_count'])
            user_voucher.is_used = True
            user_voucher.used_at = timezone.now()
            user_voucher.save(update_fields=['is_used', 'used_at'])
        
        return booking


class CheckAvailabilitySerializer(serializers.Serializer):
    """Serializer để check availability"""
    restaurant_id = serializers.IntegerField()
    booking_date = serializers.DateField()
    time_slot_id = serializers.IntegerField(required=False)

    def validate_booking_date(self, value):
        if value < timezone.now().date():
            raise serializers.ValidationError("Không thể kiểm tra ngày trong quá khứ")
        return value

    def validate_restaurant_id(self, value):
        if not Restaurant.objects.filter(id=value, status='APPROVED').exists():
            raise serializers.ValidationError("Nhà hàng không tồn tại hoặc chưa được phê duyệt")
        return value


class PartnerDashboardStatsSerializer(serializers.Serializer):
    """Serializer cho partner dashboard stats"""
    total_restaurants = serializers.IntegerField()
    bookings_today = serializers.IntegerField()
    bookings_this_week = serializers.IntegerField()
    bookings_pending = serializers.IntegerField()
    upcoming_bookings_next_2h = serializers.IntegerField()
    upcoming_bookings_next_24h = serializers.IntegerField()
    peak_hours_today = serializers.ListField()
    bookings_7days = serializers.ListField()
