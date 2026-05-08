from rest_framework import serializers
from .models import Collection, CollectionItem, Banner
from restaurants.models import Restaurant
from restaurants.serializers import RestaurantListSerializer, RestaurantCardSerializer, normalize_price_range

class CollectionItemSerializer(serializers.ModelSerializer):
    restaurant = RestaurantCardSerializer(read_only=True)
    
    class Meta:
        model = CollectionItem
        fields = ['id', 'collection', 'restaurant', 'added_at']

class CollectionSerializer(serializers.ModelSerializer):
    items = CollectionItemSerializer(many=True, read_only=True)
    items_count = serializers.SerializerMethodField()
    restaurants = serializers.SerializerMethodField()
    image_url = serializers.SerializerMethodField()
    
    class Meta:
        model = Collection
        fields = [
            'id', 'title', 'description', 'cover_image', 'cover_image_url', 
            'image_url', 'badge_label', 'is_active', 'items_count', 
            'restaurants', 'items', 'created_at'
        ]

    def get_items_count(self, obj):
        return obj.items.count()

    def get_restaurants(self, obj):
        # Trả về top 4 nhà hàng trong collection để hiển thị ở trang chủ
        items = obj.items.all().select_related('restaurant')[:4]
        return [{
            'id': item.restaurant.id,
            'name': item.restaurant.name,
            'address': item.restaurant.address,
            'rating': item.restaurant.rating,
            'price_range': normalize_price_range(item.restaurant.price_range),
            'cuisine_type': item.restaurant.cuisine_type
        } for item in items]

    def get_image_url(self, obj):
        if not obj.cover_image and not obj.cover_image_url:
            return None
        if obj.cover_image:
            request = self.context.get('request')
            if request:
                return request.build_absolute_uri(obj.cover_image.url)
            return obj.cover_image.url
        return obj.cover_image_url

class BannerSerializer(serializers.ModelSerializer):
    image_display_url = serializers.SerializerMethodField()

    class Meta:
        model = Banner
        fields = ['id', 'title', 'image', 'image_url', 'image_display_url', 'target_url', 'display_order', 'is_active']

    def get_image_display_url(self, obj):
        if not obj.image and not obj.image_url:
            return None
        if obj.image:
            request = self.context.get('request')
            if request:
                return request.build_absolute_uri(obj.image.url)
            return obj.image.url
        return obj.image_url
