from django.contrib import admin
from .models import Review, ReviewReply, ReviewReport

@admin.register(Review)
class ReviewAdmin(admin.ModelAdmin):
    list_display = ('customer', 'restaurant', 'rating', 'created_at')
    list_filter = ('rating',)
    search_fields = ('customer__full_name', 'restaurant__name')

@admin.register(ReviewReply)
class ReviewReplyAdmin(admin.ModelAdmin):
    list_display = ('review', 'partner', 'created_at')

@admin.register(ReviewReport)
class ReviewReportAdmin(admin.ModelAdmin):
    list_display = ('review', 'partner', 'status', 'created_at')
    list_filter = ('status',)
