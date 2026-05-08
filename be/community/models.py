from django.db import models
from django.conf import settings
from django.utils.text import slugify
import os

def post_thumbnail_path(instance, filename):
    import time
    ext = filename.split('.')[-1]
    timestamp = int(time.time())
    return f"blog/thumbnails/post_{timestamp}.{ext}"

class Post(models.Model):
    CATEGORY_CHOICES = [
        ('NEWS', 'Tin tức & Sự kiện'),
        ('RECRUITMENT', 'Tuyển dụng'),
        ('SEEKING', 'Tìm việc'),
        ('REVIEW', 'Review ẩm thực'),
        ('OTHER', 'Khác'),
    ]

    STATUS_CHOICES = [
        ('PENDING', 'Chờ duyệt'),
        ('PUBLISHED', 'Đã đăng'),
        ('REJECTED', 'Bị từ chối'),
        ('ARCHIVED', 'Lưu trữ'),
    ]

    author = models.ForeignKey(
        settings.AUTH_USER_MODEL, 
        on_delete=models.CASCADE, 
        related_name='posts'
    )
    title = models.CharField(max_length=255)
    slug = models.SlugField(max_length=255, unique=True, blank=True)
    category = models.CharField(max_length=20, choices=CATEGORY_CHOICES, default='NEWS')
    content = models.TextField()
    excerpt = models.TextField(blank=True, help_text="Tóm tắt ngắn gọn bài viết")
    thumbnail = models.ImageField(upload_to=post_thumbnail_path, null=True, blank=True)
    
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='PENDING')
    is_featured = models.BooleanField(default=False)
    views_count = models.PositiveIntegerField(default=0)
    likes = models.ManyToManyField(
        settings.AUTH_USER_MODEL, 
        related_name='liked_posts', 
        blank=True
    )
    
    # Optional fields for recruitment
    location_city = models.CharField(max_length=100, blank=True, null=True)
    salary_text = models.CharField(max_length=100, blank=True, null=True)
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return self.title

    def save(self, *args, **kwargs):
        if not self.slug:
            self.slug = slugify(self.title)
            # Ensure unique slug
            original_slug = self.slug
            count = 1
            while Post.objects.filter(slug=self.slug).exists():
                self.slug = f"{original_slug}-{count}"
                count += 1
        super().save(*args, **kwargs)

class Comment(models.Model):
    post = models.ForeignKey(Post, on_delete=models.CASCADE, related_name='comments')
    author = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    content = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['created_at']

    def __str__(self):
        return f"Comment by {self.author} on {self.post.title}"
