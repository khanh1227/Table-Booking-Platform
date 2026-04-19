from rest_framework import serializers
from .models import Review, ReviewReply, ReviewReport, ReviewImage
from accounts.models import User
from restaurants.models import Restaurant
from bookings.models import Booking

class ReviewReplySerializer(serializers.ModelSerializer):
    partner_name = serializers.ReadOnlyField(source='partner.business_name')
    
    class Meta:
        model = ReviewReply
        fields = ['id', 'review', 'partner', 'partner_name', 'reply_content', 'created_at']
        read_only_fields = ['id', 'partner', 'created_at']

class ReviewImageSerializer(serializers.ModelSerializer):
    class Meta:
        model = ReviewImage
        fields = ['id', 'image', 'uploaded_at']

class ReviewSerializer(serializers.ModelSerializer):
    customer_name = serializers.ReadOnlyField(source='customer.full_name')
    restaurant_name = serializers.ReadOnlyField(source='restaurant.name')
    reply = ReviewReplySerializer(read_only=True)
    images = ReviewImageSerializer(many=True, read_only=True)
    
    class Meta:
        model = Review
        fields = ['id', 'customer', 'customer_name', 'restaurant', 'restaurant_name', 'booking', 'rating', 'comment', 'image_url', 'reply', 'images', 'created_at']
        read_only_fields = ['id', 'customer', 'restaurant', 'created_at']

    def validate_booking(self, value):
        # Kiểm tra booking phải của customer này và ở trạng thái COMPLETED
        user = self.context['request'].user
        if value.customer != user:
            raise serializers.ValidationError("Bạn không có quyền đánh giá booking này.")
        if value.status != 'COMPLETED':
            raise serializers.ValidationError("Bạn chỉ có thể đánh giá sau khi đã hoàn thành trải nghiệm tại nhà hàng.")
        return value

    def create(self, validated_data):
        review = super().create(validated_data)
        request = self.context.get('request')
        if request and request.FILES:
            images_data = request.FILES.getlist('images')
            for image_data in images_data:
                ReviewImage.objects.create(review=review, image=image_data)
        return review

class ReviewReportSerializer(serializers.ModelSerializer):
    class Meta:
        model = ReviewReport
        fields = ['id', 'review', 'partner', 'reason', 'status', 'created_at']
        read_only_fields = ['id', 'partner', 'status', 'created_at']
