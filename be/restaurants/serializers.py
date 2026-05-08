#restaurants/serializers.py
from rest_framework import serializers
from .models import (
    Location, Restaurant, RestaurantImage, MenuItem, 
    TimeSlot, FavoriteRestaurant, RestaurantReport, TimeSlotOverride,
    RestaurantViewHistory, CuisineAlias
)

class CuisineAliasSerializer(serializers.ModelSerializer):
    class Meta:
        model = CuisineAlias
        fields = ['id', 'canonical_name', 'alias', 'match_target', 'is_active', 'created_at', 'updated_at']
        read_only_fields = ['id', 'created_at', 'updated_at']

class TimeSlotOverrideSerializer(serializers.ModelSerializer):
    time_slot_display = serializers.CharField(source='time_slot.start_time', read_only=True, default="All Slots")
    
    class Meta:
        model = TimeSlotOverride
        fields = [
            'id', 'restaurant', 'time_slot', 'time_slot_display', 
            'date', 'max_bookings', 'max_guests_per_booking', 
            'is_closed', 'reason', 'created_at'
        ]
        read_only_fields = ['id', 'created_at']

    def validate(self, data):
        restaurant = data.get('restaurant')
        date = data.get('date')
        time_slot = data.get('time_slot')
        
        # Check if already exists
        qs = TimeSlotOverride.objects.filter(restaurant=restaurant, date=date, time_slot=time_slot)
        if self.instance:
            qs = qs.exclude(pk=self.instance.pk)
            
        if qs.exists():
            slot_name = time_slot.start_time if time_slot else "Tất cả khung giờ"
            raise serializers.ValidationError(f"Đã có thiết lập điều chỉnh cho {slot_name} vào ngày {date}")
            
        return data
from accounts.models import Partner


def normalize_price_range(value):
    """Chuẩn hoá price_range.
    Nếu là số (dạng chuỗi), trả về định dạng tiền tệ 100.000đ.
    Nếu là nhãn cũ (BUDGET...), trả về nhãn đó.
    """
    if not value:
        return None

    val_str = str(value).strip()
    if val_str.isdigit():
        try:
            amount = int(val_str)
            return f"{amount:,}đ".replace(',', '.')
        except:
            pass
    
    # Map nhãn cũ sang tiếng Việt cho đẹp
    labels = {
        'BUDGET': 'Bình dân',
        'MEDIUM': 'Trung bình',
        'PREMIUM': 'Cao cấp'
    }
    return labels.get(val_str.upper(), val_str)


class LocationSerializer(serializers.ModelSerializer):
    full_address = serializers.CharField(source='get_full_address', read_only=True)

    class Meta:
        model = Location
        fields = [
            'id',
            'city', 'district', 'ward',
            'province_code', 'district_code', 'ward_code',
            'full_address'
        ]


class RestaurantImageSerializer(serializers.ModelSerializer):
    """Serializer cho RestaurantImage - chỉ trả về path tương đối"""
    image_url = serializers.SerializerMethodField()
    
    class Meta:
        model = RestaurantImage
        fields = ['id', 'image_url', 'display_order', 'created_at']
        read_only_fields = ['created_at']
    
    def get_image_url(self, obj):
        """Trả về path tương đối: restaurant_images/abc.jpg"""
        return obj.image.name if obj.image else ''


class MenuItemSerializer(serializers.ModelSerializer):
    """Serializer cho MenuItem - chỉ trả về path tương đối"""
    image_url = serializers.SerializerMethodField()
    
    class Meta:
        model = MenuItem
        fields = [
            'id', 'name', 'description', 'price',
            'image_url', 'category', 'is_available',
            'created_at', 'updated_at'
        ]
        read_only_fields = ['created_at', 'updated_at']
    
    def get_image_url(self, obj):
        """Trả về path tương đối: menu_items/abc.jpg"""
        return obj.image.name if obj.image else ''


class MenuItemCreateUpdateSerializer(serializers.ModelSerializer):
    """Serializer riêng cho create/update MenuItem (không upload ảnh)"""
    class Meta:
        model = MenuItem
        fields = [
            'name', 'description', 'price',
            'category', 'is_available'
        ]


class TimeSlotSerializer(serializers.ModelSerializer):
    class Meta:
        model = TimeSlot
        fields = [
            'id', 'start_time',
            'max_bookings', 'max_guests_per_booking', 'is_active'
        ]




class RestaurantCardSerializer(serializers.ModelSerializer):
    """Lightweight serializer cho restaurant grid/card — chỉ 1 thumbnail"""
    location = LocationSerializer(read_only=True)
    thumbnail = serializers.SerializerMethodField()
    is_favorite = serializers.SerializerMethodField()
    price_range = serializers.SerializerMethodField()
    distance = serializers.SerializerMethodField()

    class Meta:
        model = Restaurant
        fields = [
            'id', 'name', 'address', 'status',
            'rating', 'cuisine_type', 'price_range', 'location',
            'opening_hours', 'thumbnail', 'is_favorite',
            'latitude', 'longitude', 'distance'
        ]

    def get_thumbnail(self, obj):
        """Trả về URL ảnh đầu tiên (hoặc '' nếu chưa có)"""
        # Dùng prefetch cache nếu có, tránh query thêm
        images = obj.images.all()
        if images:
            first = images[0]
            return first.image.name if first.image else ''
        return ''

    def get_is_favorite(self, obj):
        request = self.context.get('request')
        if request and request.user and request.user.is_authenticated:
            # Dùng in if prefetched
            if hasattr(obj, 'favorited_by_user'):
                return obj.favorited_by_user
            return obj.favorited_by.filter(user=request.user).exists()
        return False

    def get_price_range(self, obj):
        return normalize_price_range(obj.price_range)

    def get_distance(self, obj):
        """Tính khoảng cách thực tế (km) nếu có tọa độ user trong context"""
        request = self.context.get('request')
        if not request:
            return None
            
        user_lat = request.query_params.get('lat')
        user_lng = request.query_params.get('lng')
        
        if not (user_lat and user_lng and obj.latitude and obj.longitude):
            return None
            
        try:
            from .search.personalize import haversine_km
            km = haversine_km(
                float(user_lat), float(user_lng),
                float(obj.latitude), float(obj.longitude)
            )
            return round(km, 2)
        except:
            return None


class RestaurantListSerializer(serializers.ModelSerializer):
    """Serializer cho danh sách nhà hàng (không có chi tiết)"""
    location = LocationSerializer(read_only=True)
    partner_name = serializers.CharField(
        source='partner.business_name',
        read_only=True
    )
    images = RestaurantImageSerializer(many=True, read_only=True)
    image_count = serializers.SerializerMethodField()
    price_range = serializers.SerializerMethodField()

    class Meta:
        model = Restaurant
        fields = [
            'id', 'name', 'address', 'phone_number',
            'description', 'opening_hours', 'status',
            'rating', 'cuisine_type', 'price_range', 'location', 'partner_name',
            'images', 'image_count', 'created_at'
        ]

    def get_image_count(self, obj):
        return obj.images.count()

    def get_price_range(self, obj):
        return normalize_price_range(obj.price_range)


class RestaurantDetailSerializer(serializers.ModelSerializer):
    """Serializer chi tiết nhà hàng (có images, menu, time_slots)"""
    location = LocationSerializer(read_only=True)
    location_id = serializers.PrimaryKeyRelatedField(
        queryset=Location.objects.all(),
        source='location',
        write_only=True,
        required=False
    )
    partner_name = serializers.CharField(
        source='partner.business_name',
        read_only=True
    )
    images = RestaurantImageSerializer(many=True, read_only=True)
    menu_items = MenuItemSerializer(many=True, read_only=True)
    time_slots = TimeSlotSerializer(many=True, read_only=True)
    is_favorite = serializers.SerializerMethodField()
    price_range = serializers.SerializerMethodField()
    partner_details = serializers.SerializerMethodField()

    class Meta:
        model = Restaurant
        fields = [
            'id', 'partner', 'partner_name', 'name', 'address',
            'phone_number', 'description', 'opening_hours',
            'status', 'rating', 'cuisine_type', 'price_range', 'location',
            'location_id', 'images', 'menu_items', 'time_slots',
            'is_favorite', 'created_at', 'updated_at', 'partner_details'
        ]
        read_only_fields = ['partner', 'status', 'rating', 'created_at', 'updated_at']

    def get_partner_details(self, obj):
        request = self.context.get('request')
        if request and request.user and request.user.is_authenticated and request.user.role == 'ADMIN' and obj.partner:
            return {
                'business_name': obj.partner.business_name,
                'business_license': obj.partner.business_license,
                'tax_code': obj.partner.tax_code,
                'owner_name': getattr(obj.partner.user, 'full_name', ''),
                'owner_phone': getattr(obj.partner.user, 'phone_number', ''),
                'owner_email': getattr(obj.partner.user, 'email', ''),
            }
        return None

    def get_is_favorite(self, obj):
        request = self.context.get('request')
        if request and request.user and request.user.is_authenticated:
            return obj.favorited_by.filter(user=request.user).exists()
        return False

    def get_price_range(self, obj):
        return normalize_price_range(obj.price_range)

    def validate_phone_number(self, value):
        """Validate phone number format"""
        if value and not value.isdigit():
            raise serializers.ValidationError("Phone number must contain only digits")
        if value and (len(value) < 10 or len(value) > 11):
            raise serializers.ValidationError("Phone number must be 10-11 digits")
        return value


class RestaurantCreateUpdateSerializer(serializers.ModelSerializer):
    """Serializer cho create/update nhà hàng (không có nested objects)"""
    location_id = serializers.PrimaryKeyRelatedField(
        queryset=Location.objects.all(),
        source='location',
        required=False
    )

    class Meta:
        model = Restaurant
        fields = [
            'name', 'address', 'phone_number', 'description',
            'opening_hours', 'cuisine_type', 'price_range', 'location_id'
        ]

    def validate_phone_number(self, value):
        if value and not value.isdigit():
            raise serializers.ValidationError("Phone number must contain only digits")
        if value and (len(value) < 10 or len(value) > 11):
            raise serializers.ValidationError("Phone number must be 10-11 digits")
        return value


class TimeSlotAvailabilitySerializer(serializers.Serializer):
    """Serializer để check slot availability"""
    restaurant_id = serializers.IntegerField()
    date = serializers.DateField()
    time_slot_id = serializers.IntegerField(required=False)

    def validate_restaurant_id(self, value):
        if not Restaurant.objects.filter(id=value, status='APPROVED').exists():
            raise serializers.ValidationError("Restaurant not found or not approved")
        return value

    def validate_time_slot_id(self, value):
        if value and not TimeSlot.objects.filter(id=value, is_active=True).exists():
            raise serializers.ValidationError("Time slot not found or inactive")
        return value


class FavoriteRestaurantSerializer(serializers.ModelSerializer):
    restaurant = RestaurantCardSerializer(read_only=True)

    class Meta:
        model = FavoriteRestaurant
        fields = ['id', 'user', 'restaurant', 'created_at']
        read_only_fields = ['user', 'created_at']


class RestaurantReportSerializer(serializers.ModelSerializer):
    class Meta:
        model = RestaurantReport
        fields = ['id', 'reason', 'status', 'created_at']
        read_only_fields = ['id', 'status', 'created_at']


class RestaurantViewHistorySerializer(serializers.ModelSerializer):
    restaurant = RestaurantCardSerializer(read_only=True)

    class Meta:
        model = RestaurantViewHistory
        fields = ['id', 'restaurant', 'viewed_at']