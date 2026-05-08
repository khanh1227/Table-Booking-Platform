import os
from django.db import models
from restaurants.models import Restaurant

def collection_image_path(instance, filename):
    return os.path.join('collections', filename)

def banner_image_path(instance, filename):
    return os.path.join('banners', filename)

class Collection(models.Model):
    title = models.CharField(max_length=200)
    description = models.TextField(null=True, blank=True)
    cover_image = models.ImageField(upload_to=collection_image_path, null=True, blank=True)
    cover_image_url = models.CharField(max_length=255, null=True, blank=True, help_text="Link ảnh ngoài (nếu không upload file)")
    badge_label = models.CharField(max_length=50, null=True, blank=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        db_table = 'collections'
        ordering = ['-created_at']

    def __str__(self):
        return self.title

    @property
    def final_image_url(self):
        if self.cover_image:
            return self.cover_image.url
        return self.cover_image_url

class CollectionItem(models.Model):
    collection = models.ForeignKey(Collection, on_delete=models.CASCADE, related_name='items')
    restaurant = models.ForeignKey(Restaurant, on_delete=models.CASCADE)
    added_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'collection_items'
        unique_together = ('collection', 'restaurant')

    def __str__(self):
        return f"{self.restaurant.name} in {self.collection.title}"

class Banner(models.Model):
    title = models.CharField(max_length=200)
    image = models.ImageField(upload_to=banner_image_path, null=True, blank=True)
    image_url = models.CharField(max_length=255, null=True, blank=True, help_text="Link ảnh ngoài (nếu không upload file)")
    target_url = models.CharField(max_length=255, null=True, blank=True)
    display_order = models.IntegerField(default=0)
    is_active = models.BooleanField(default=True)
    valid_from = models.DateTimeField(null=True, blank=True)
    valid_to = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = 'banners'
        ordering = ['display_order']

    def __str__(self):
        return self.title

    @property
    def final_image_url(self):
        if self.image:
            return self.image.url
        return self.image_url
