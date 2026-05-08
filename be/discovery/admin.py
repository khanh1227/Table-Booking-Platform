from django.contrib import admin
from django.utils.html import format_html
from .models import Collection, CollectionItem, Banner

class CollectionItemInline(admin.TabularInline):
    model = CollectionItem
    extra = 1
    autocomplete_fields = ['restaurant']

@admin.register(Collection)
class CollectionAdmin(admin.ModelAdmin):
    list_display = ('title', 'image_preview', 'is_active', 'created_at')
    inlines = [CollectionItemInline]
    list_filter = ('is_active',)
    search_fields = ('title', 'description')
    
    def image_preview(self, obj):
        url = obj.final_image_url
        if url:
            return format_html('<img src="{}" style="width: 50px; height: 30px; object-fit: cover; border-radius: 4px;" />', url)
        return "-"
    image_preview.short_description = 'Ảnh bìa'

@admin.register(Banner)
class BannerAdmin(admin.ModelAdmin):
    list_display = ('title', 'image_preview', 'display_order', 'is_active', 'valid_to')
    list_filter = ('is_active',)
    search_fields = ('title',)

    def image_preview(self, obj):
        url = obj.final_image_url
        if url:
            return format_html('<img src="{}" style="width: 80px; height: 40px; object-fit: cover; border-radius: 4px;" />', url)
        return "-"
    image_preview.short_description = 'Hình ảnh'
