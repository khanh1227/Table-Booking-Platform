from django.db import models
from accounts.models import User, Partner
from restaurants.models import Restaurant
from bookings.models import Booking
from django.core.validators import MinValueValidator, MaxValueValidator
from django.db.models.signals import post_save
from django.dispatch import receiver
from django.db.models import Avg

class Review(models.Model):
    customer = models.ForeignKey(User, on_delete=models.CASCADE, related_name='reviews', limit_choices_to={'role': 'CUSTOMER'})
    restaurant = models.ForeignKey(Restaurant, on_delete=models.CASCADE, related_name='reviews')
    booking = models.OneToOneField(Booking, on_delete=models.CASCADE, related_name='review')
    rating = models.IntegerField(validators=[MinValueValidator(1), MaxValueValidator(5)])
    comment = models.TextField(null=True, blank=True)
    image_url = models.CharField(max_length=255, null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'reviews'
        ordering = ['-created_at']

    def __str__(self):
        return f"Review by {self.customer.full_name} for {self.restaurant.name} - {self.rating} stars"

class ReviewImage(models.Model):
    review = models.ForeignKey(Review, on_delete=models.CASCADE, related_name='images')
    image = models.ImageField(upload_to='review_images/')
    uploaded_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'review_images'

    def __str__(self):
        return f"Image for Review {self.review.id}"

class ReviewReply(models.Model):
    review = models.OneToOneField(Review, on_delete=models.CASCADE, related_name='reply')
    partner = models.ForeignKey(Partner, on_delete=models.CASCADE, related_name='review_replies')
    reply_content = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'review_replies'

    def __str__(self):
        return f"Reply to review {self.review.id} by {self.partner.business_name}"

class ReviewReport(models.Model):
    review = models.ForeignKey(Review, on_delete=models.CASCADE, related_name='reports')
    partner = models.ForeignKey(Partner, on_delete=models.CASCADE, related_name='review_reports')
    reason = models.TextField()
    status = models.CharField(max_length=20, choices=[('PENDING', 'Pending'), ('RESOLVED', 'Resolved')], default='PENDING')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'review_reports'

    def __str__(self):
        return f"Report for review {self.review.id}"

# Signals to update restaurant rating
def refresh_restaurant_rating(restaurant):
    """Tính toán lại và cập nhật điểm rating trung bình cho nhà hàng"""
    avg_rating = Review.objects.filter(restaurant=restaurant).aggregate(Avg('rating'))['rating__avg']
    restaurant.rating = round(avg_rating, 2) if avg_rating is not None else 0.00
    restaurant.save(update_fields=['rating'])

@receiver(post_save, sender=Review)
def handle_review_save(sender, instance, **kwargs):
    refresh_restaurant_rating(instance.restaurant)

@receiver(models.signals.post_delete, sender=Review)
def handle_review_delete(sender, instance, **kwargs):
    refresh_restaurant_rating(instance.restaurant)
