from rest_framework import serializers
from .models import Collection, CollectionItem, Banner
from restaurants.models import Restaurant

class CollectionItemSerializer(serializers.ModelSerializer):
    restaurant_name = serializers.ReadOnlyField(source='restaurant.name')
    restaurant_address = serializers.ReadOnlyField(source='restaurant.address')
    restaurant_rating = serializers.ReadOnlyField(source='restaurant.rating')
    
    class Meta:
        model = CollectionItem
        fields = ['id', 'collection', 'restaurant', 'restaurant_name', 'restaurant_address', 'restaurant_rating', 'added_at']

class CollectionSerializer(serializers.ModelSerializer):
    items = CollectionItemSerializer(many=True, read_only=True)
    items_count = serializers.SerializerMethodField()
    restaurants = serializers.SerializerMethodField()
    
    class Meta:
        model = Collection
        fields = ['id', 'title', 'description', 'cover_image_url', 'badge_label', 'is_active', 'items_count', 'restaurants', 'items', 'created_at']

    def get_items_count(self, obj):
        return obj.items.count()

    def get_restaurants(self, obj):
        # Trả về top 4 nhà hàng trong collection để hiển thị ở trang chủ
        items = obj.items.all().select_related('restaurant')[:4]
        return [{
            'id': item.restaurant.id,
            'name': item.restaurant.name,
            'address': item.restaurant.address,
            'rating': item.restaurant.rating
        } for item in items]

class BannerSerializer(serializers.ModelSerializer):
    class Meta:
        model = Banner
        fields = ['id', 'title', 'image_url', 'target_url', 'display_order', 'is_active']
