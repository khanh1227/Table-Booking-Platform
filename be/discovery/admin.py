from django.contrib import admin
from .models import Collection, CollectionItem, Banner

class CollectionItemInline(admin.TabularInline):
    model = CollectionItem
    extra = 1

@admin.register(Collection)
class CollectionAdmin(admin.ModelAdmin):
    list_display = ('title', 'is_active', 'created_at')
    inlines = [CollectionItemInline]
    list_filter = ('is_active',)

@admin.register(Banner)
class BannerAdmin(admin.ModelAdmin):
    list_display = ('title', 'display_order', 'is_active', 'valid_to')
    list_filter = ('is_active',)
    search_fields = ('title',)
