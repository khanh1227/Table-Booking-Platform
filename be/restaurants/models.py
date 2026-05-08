#restaurants/models.py
import os
from django.db import models
from django.core.validators import MinValueValidator, MaxValueValidator
from django.db.models.signals import pre_delete, pre_save
from django.dispatch import receiver
from accounts.models import Partner, User


class Location(models.Model):
    """Địa điểm (Thành phố, Quận, Phường)"""
    city = models.CharField(max_length=100)
    district = models.CharField(max_length=100, null=True, blank=True)
    ward = models.CharField(max_length=100, null=True, blank=True)
    
    # Mã vùng (dùng để lọc chính xác từ Frontend vn-provinces)
    province_code = models.CharField(max_length=20, null=True, blank=True)
    district_code = models.CharField(max_length=20, null=True, blank=True)
    ward_code = models.CharField(max_length=20, null=True, blank=True)

    class Meta:
        db_table = 'locations'
        verbose_name = 'Location'
        verbose_name_plural = 'Locations'

    def __str__(self):
        return f"{self.city} - {self.district or 'N/A'} - {self.ward or 'N/A'}"

    def get_full_address(self):
        """Trả về địa chỉ đầy đủ"""
        parts = [self.ward, self.district, self.city]
        return ', '.join([p for p in parts if p])


def restaurant_image_upload_path(instance, filename):
    """
    Tạo path cho ảnh nhà hàng: restaurant_images/restaurant_{id}_{timestamp}.ext
    """
    import time
    ext = filename.split('.')[-1]
    timestamp = int(time.time())
    new_filename = f"restaurant_{instance.restaurant.id}_{timestamp}.{ext}"
    return os.path.join('restaurant_images', new_filename)


def menu_item_image_upload_path(instance, filename):
    """
    Tạo path cho ảnh món ăn: menu_items/menuitem_{id}_{timestamp}.ext
    """
    import time
    ext = filename.split('.')[-1]
    timestamp = int(time.time())
    new_filename = f"menuitem_{instance.id or 'new'}_{timestamp}.{ext}"
    return os.path.join('menu_items', new_filename)


class Restaurant(models.Model):
    """Nhà hàng"""
    STATUS_CHOICES = [
        ('PENDING', 'Pending'),
        ('APPROVED', 'Approved'),
        ('SUSPENDED', 'Suspended'),
        ('CLOSED', 'Closed'),
    ]

    PRICE_RANGE_CHOICES = [
        ('BUDGET',  'Bình dân (dưới 100k/người)'),
        ('MEDIUM',  'Trung bình (100k–300k/người)'),
        ('PREMIUM', 'Cao cấp (trên 300k/người)'),
    ]

    partner = models.ForeignKey(
        Partner,
        on_delete=models.CASCADE,
        related_name='restaurants'
    )
    name = models.CharField(max_length=150)
    address = models.CharField(max_length=255)
    phone_number = models.CharField(max_length=20, null=True, blank=True)
    description = models.TextField(null=True, blank=True)
    opening_hours = models.CharField(
        max_length=100,
        null=True,
        blank=True,
        help_text="VD: 10:00-22:00"
    )
    status = models.CharField(
        max_length=20,
        choices=STATUS_CHOICES,
        default='PENDING'
    )
    rating = models.DecimalField(
        max_digits=3,
        decimal_places=2,
        default=0.00,
        validators=[MinValueValidator(0), MaxValueValidator(5)]
    )

    def is_within_opening_hours(self, check_time):
        """Kiểm tra một đối tượng time có nằm trong giờ mở cửa không"""
        if not self.opening_hours or '-' not in self.opening_hours:
            return True
        
        from datetime import datetime
        try:
            start_str, end_str = self.opening_hours.split('-')
            start_time = datetime.strptime(start_str.strip(), '%H:%M').time()
            end_time = datetime.strptime(end_str.strip(), '%H:%M').time()
            
            if isinstance(check_time, str):
                check_time = datetime.strptime(check_time, '%H:%M').time()

            if start_time <= end_time:
                return start_time <= check_time <= end_time
            else: # Đóng cửa qua đêm
                return check_time >= start_time or check_time <= end_time
        except:
            return True
    cuisine_type = models.CharField(
        max_length=100,
        null=True,
        blank=True,
        help_text="VD: Món Việt, Nhật Bản, Ý, BBQ..."
    )
    # NOTE FOR AI: price_range lưu GIÁ TRUNG BÌNH dạng SỐ NGUYÊN (VND/người),
    # KHÔNG dùng nhãn chữ như BUDGET/MEDIUM/PREMIUM.
    # Ví dụ: 80000 (bình dân), 150000 (trung bình), 350000 (cao cấp).
    price_range = models.CharField(
        max_length=20,
        null=True,
        blank=True,
        help_text="Giá trung bình mỗi người - lưu dạng SỐ NGUYÊN VND, vd: 80000, 150000, 350000"
    )
    location = models.ForeignKey(
        Location,
        on_delete=models.SET_NULL,
        null=True,
        related_name='restaurants'
    )
    latitude = models.DecimalField(max_digits=12, decimal_places=9, null=True, blank=True)
    longitude = models.DecimalField(max_digits=12, decimal_places=9, null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True, null=True, blank=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'restaurants'
        verbose_name = 'Restaurant'
        verbose_name_plural = 'Restaurants'
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['partner']),
            models.Index(fields=['location']),
            models.Index(fields=['status']),
            models.Index(fields=['rating']),
        ]

    def __str__(self):
        return self.name

    def is_slot_available(self, restaurant_id, booking_date, time_slot_id):
        """
        Kiểm tra slot còn chỗ trống không cho một ngày cụ thể
        """
        try:
            time_slot = TimeSlot.objects.get(id=time_slot_id)
            
            # 1. Kiểm tra Override cho slot này vào ngày này
            override = TimeSlotOverride.objects.filter(
                restaurant_id=restaurant_id, 
                date=booking_date,
                time_slot_id=time_slot_id
            ).first()
            
            # Nếu không có override cho slot cụ thể, kiểm tra override cho "tất cả slot" (time_slot is null)
            if not override:
                override = TimeSlotOverride.objects.filter(
                    restaurant_id=restaurant_id,
                    date=booking_date,
                    time_slot__isnull=True
                ).first()

            if override:
                if override.is_closed:
                    return False
                max_bookings = override.max_bookings if override.max_bookings is not None else time_slot.max_bookings
            else:
                max_bookings = time_slot.max_bookings

            count = self.count_bookings_for_slot(restaurant_id, booking_date, time_slot_id)
            return count < (max_bookings or 999)
        except TimeSlot.DoesNotExist:
            return False

    def get_available_slots(self, date):
        """Lấy danh sách time slots còn trống cho ngày cụ thể (có tính đến Overrides)"""
        from django.db.models import Count, Q
        
        # 1. Kiểm tra xem cả ngày có bị đóng cửa không (Override với time_slot=null và is_closed=true)
        day_override = TimeSlotOverride.objects.filter(restaurant=self, date=date, time_slot__isnull=True).first()
        if day_override and day_override.is_closed:
            return []

        slots = self.time_slots.filter(is_active=True).annotate(
            booking_count=Count(
                'bookings',
                filter=Q(
                    bookings__booking_date=date,
                    bookings__status__in=['PENDING', 'CONFIRMED']
                )
            )
        )
        
        available = []
        for slot in slots:
            # Kiểm tra override cho từng slot
            slot_override = TimeSlotOverride.objects.filter(restaurant=self, date=date, time_slot=slot).first()
            
            if slot_override:
                if slot_override.is_closed:
                    continue
                max_limit = slot_override.max_bookings if slot_override.max_bookings is not None else slot.max_bookings
            else:
                max_limit = slot.max_bookings
                
            if slot.booking_count < (max_limit or 999):
                # Gắn tạm max_limit vào object để serializer có thể dùng (nếu cần)
                slot.temp_max_limit = max_limit
                available.append(slot)
                
        return available



class RestaurantImage(models.Model):
    """Ảnh nhà hàng"""
    restaurant = models.ForeignKey(
        Restaurant,
        on_delete=models.CASCADE,
        related_name='images'
    )
    image = models.ImageField(
        upload_to=restaurant_image_upload_path,
        null=True,    
        blank=True, 
        help_text="Upload ảnh nhà hàng (JPG, PNG)"
    )
    display_order = models.IntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True, null=True, blank=True)

    class Meta:
        db_table = 'restaurant_images'
        verbose_name = 'Restaurant Image'
        verbose_name_plural = 'Restaurant Images'
        ordering = ['display_order', '-created_at']

    def __str__(self):
        return f"Image of {self.restaurant.name}"
    
    @property
    def image_url(self):
        """Trả về path tương đối kèm MEDIA_URL (ví dụ: /media/restaurant_images/abc.jpg)"""
        if self.image:
            return self.image.url
        return ''


@receiver(pre_delete, sender=RestaurantImage)
def delete_restaurant_image_file(sender, instance, **kwargs):
    """Xóa file ảnh khi xóa record"""
    if instance.image:
        if os.path.isfile(instance.image.path):
            os.remove(instance.image.path)


@receiver(pre_save, sender=RestaurantImage)
def delete_old_restaurant_image_on_update(sender, instance, **kwargs):
    """Xóa ảnh cũ khi update ảnh mới"""
    if not instance.pk:
        return
    
    try:
        old_image = RestaurantImage.objects.get(pk=instance.pk).image
    except RestaurantImage.DoesNotExist:
        return
    
    new_image = instance.image
    if old_image and old_image != new_image:
        if os.path.isfile(old_image.path):
            os.remove(old_image.path)


class MenuItem(models.Model):
    """Món ăn"""
    restaurant = models.ForeignKey(
        Restaurant,
        on_delete=models.CASCADE,
        related_name='menu_items'
    )
    name = models.CharField(max_length=150)
    description = models.TextField(null=True, blank=True)
    price = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        validators=[MinValueValidator(0)]
    )
    image = models.ImageField(
        upload_to=menu_item_image_upload_path,
        null=True,
        blank=True,
        help_text="Upload ảnh món ăn (JPG, PNG)"
    )
    category = models.CharField(
        max_length=100,
        null=True,
        blank=True,
        help_text="VD: Món chính, Đồ uống"
    )
    is_available = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True, null=True, blank=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'menu_items'
        verbose_name = 'Menu Item'
        verbose_name_plural = 'Menu Items'
        ordering = ['category', 'name']

    def __str__(self):
        return f"{self.name} - {self.restaurant.name}"
    
    @property
    def image_url(self):
        """Trả về path tương đối kèm MEDIA_URL (ví dụ: /media/menu_items/abc.jpg)"""
        if self.image:
            return self.image.url
        return ''


@receiver(pre_delete, sender=MenuItem)
def delete_menu_item_image_file(sender, instance, **kwargs):
    """Xóa file ảnh khi xóa món ăn"""
    if instance.image:
        if os.path.isfile(instance.image.path):
            os.remove(instance.image.path)


@receiver(pre_save, sender=MenuItem)
def delete_old_menu_item_image_on_update(sender, instance, **kwargs):
    """Xóa ảnh cũ khi update ảnh mới"""
    if not instance.pk:
        return
    
    try:
        old_image = MenuItem.objects.get(pk=instance.pk).image
    except MenuItem.DoesNotExist:
        return
    
    new_image = instance.image
    if old_image and old_image != new_image:
        if os.path.isfile(old_image.path):
            os.remove(old_image.path)


class TimeSlot(models.Model):
    """Khung giờ đặt bàn"""
    restaurant = models.ForeignKey(
        Restaurant,
        on_delete=models.CASCADE,
        related_name='time_slots'
    )
    start_time = models.TimeField()
    max_bookings = models.IntegerField(
        default=10,
        validators=[MinValueValidator(1)]
    )
    max_guests_per_booking = models.IntegerField(
        default=20,
        validators=[MinValueValidator(1)],
        help_text="Số khách tối đa cho một đơn đặt bàn"
    )
    is_active = models.BooleanField(default=True)

    class Meta:
        db_table = 'time_slots'
        verbose_name = 'Time Slot'
        verbose_name_plural = 'Time Slots'
        ordering = ['start_time']
        indexes = [
            models.Index(fields=['restaurant']),
            models.Index(fields=['is_active']),
        ]



    def __str__(self):
        return f"{self.restaurant.name}: {self.start_time.strftime('%H:%M')}"

    def get_current_booking_count(self, date):
        """Đếm số booking hiện tại cho slot này vào ngày cụ thể"""
        return self.bookings.filter(
            booking_date=date,
            status__in=['PENDING', 'CONFIRMED']
        ).count()

class TimeSlotOverride(models.Model):
    """Điều chỉnh sức chứa hoặc trạng thái đóng/mở cho khung giờ vào ngày đặc biệt"""
    restaurant = models.ForeignKey(Restaurant, on_delete=models.CASCADE, related_name='time_slot_overrides')
    time_slot = models.ForeignKey(TimeSlot, on_delete=models.CASCADE, null=True, blank=True, related_name='overrides', help_text="Để trống nếu áp dụng cho tất cả khung giờ trong ngày")
    date = models.DateField()
    max_bookings = models.IntegerField(null=True, blank=True, help_text="Sức chứa mới cho ngày này (Để trống nếu giữ nguyên)")
    max_guests_per_booking = models.IntegerField(null=True, blank=True)
    is_closed = models.BooleanField(default=False, help_text="Đánh dấu nếu muốn đóng cửa khung giờ/ngày này")
    reason = models.CharField(max_length=255, null=True, blank=True, help_text="Lý do: Lễ, Tết, Bảo trì...")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'time_slot_overrides'
        unique_together = ('restaurant', 'date', 'time_slot')
        ordering = ['date', 'time_slot__start_time']

    def __str__(self):
        slot_str = self.time_slot.start_time if self.time_slot else "All Slots"
        return f"{self.restaurant.name} - {self.date} - {slot_str} ({'Closed' if self.is_closed else 'Override'})"

    def is_available(self, date):
        """Kiểm tra slot còn chỗ trống không cho một ngày cụ thể (có tính đến Overrides)"""
        # 1. Kiểm tra override cho slot này
        override = self.overrides.filter(date=date).first()
        
        # 2. Nếu không có, kiểm tra override "tất cả slot" của nhà hàng
        if not override:
            override = TimeSlotOverride.objects.filter(
                restaurant=self.restaurant,
                date=date,
                time_slot__isnull=True
            ).first()

        if override:
            if override.is_closed:
                return False
            max_limit = override.max_bookings if override.max_bookings is not None else self.max_bookings
        else:
            max_limit = self.max_bookings

        return self.get_current_booking_count(date) < (max_limit or 999)


class FavoriteRestaurant(models.Model):
    """Lưu danh sách nhà hàng yêu thích của người dùng"""
    user = models.ForeignKey(
        'accounts.User',
        on_delete=models.CASCADE,
        related_name='favorite_restaurants'
    )
    restaurant = models.ForeignKey(
        Restaurant,
        on_delete=models.CASCADE,
        related_name='favorited_by'
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'favorite_restaurants'
        verbose_name = 'Favorite Restaurant'
        verbose_name_plural = 'Favorite Restaurants'
        constraints = [
            models.UniqueConstraint(
                fields=['user', 'restaurant'],
                name='unique_user_favorite_restaurant'
            )
        ]
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.user.phone_number} - {self.restaurant.name}"


class CuisineAlias(models.Model):
    """Từ khoá đồng nghĩa cho bộ lọc ẩm thực, quản lý được trên Admin CMS."""
    MATCH_TARGET_CHOICES = [
        ('CUISINE', 'Cuisine Type'),
        ('DISH', 'Dish / Menu'),
    ]

    canonical_name = models.CharField(
        max_length=100,
        help_text="Tên chuẩn hiển thị trên FE, ví dụ: Lẩu, Nướng, Món Nhật"
    )
    alias = models.CharField(
        max_length=100,
        help_text="Từ khoá đồng nghĩa để match, ví dụ: hotpot, yakiniku, seafood"
    )
    match_target = models.CharField(
        max_length=20,
        choices=MATCH_TARGET_CHOICES,
        default='CUISINE',
        help_text="Match vào cuisine_type hay menu item"
    )
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'cuisine_aliases'
        verbose_name = 'Cuisine Alias'
        verbose_name_plural = 'Cuisine Aliases'
        ordering = ['canonical_name', 'alias']
        indexes = [
            models.Index(fields=['canonical_name']),
            models.Index(fields=['alias']),
            models.Index(fields=['is_active']),
        ]
        constraints = [
            models.UniqueConstraint(
                fields=['canonical_name', 'alias', 'match_target'],
                name='unique_canonical_alias_target'
            )
        ]

    def __str__(self):
        return f"{self.canonical_name} -> {self.alias} ({self.match_target})"
class RestaurantReport(models.Model):
    """Báo cáo nhà hàng (từ phía khách hàng)"""
    restaurant = models.ForeignKey(Restaurant, on_delete=models.CASCADE, related_name='reports')
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='restaurant_reports')
    reason = models.TextField()
    status = models.CharField(max_length=20, choices=[('PENDING', 'Pending'), ('RESOLVED', 'Resolved')], default='PENDING')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'restaurant_reports'
        ordering = ['-created_at']

    def __str__(self):
        return f"Report for {self.restaurant.name} by {self.user.full_name}"

class QueryLog(models.Model):
    """Lưu lịch sử tìm kiếm để học từ khóa đồng nghĩa (v2 search)"""
    query_text = models.CharField(max_length=255)
    user = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True)
    restaurant_id = models.IntegerField(null=True, blank=True)  # ID quán được click
    clicked = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'search_query_logs'
        ordering = ['-created_at']


class SearchImpression(models.Model):
    """Lưu các quán đã hiển thị cho user để dùng cho implicit feedback"""
    user = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True)
    query = models.CharField(max_length=255)
    result_restaurant_ids = models.JSONField(default=list)  # Danh sách ID các quán đã hiện
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'search_impressions'
        ordering = ['-created_at']


class RestaurantViewHistory(models.Model):
    """Lưu lịch sử xem nhà hàng của người dùng"""
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='view_history')
    restaurant = models.ForeignKey(Restaurant, on_delete=models.CASCADE, related_name='views')
    viewed_at = models.DateTimeField(auto_now=True) # Cập nhật thời gian mỗi khi save()

    class Meta:
        db_table = 'restaurant_view_history'
        ordering = ['-viewed_at']
        constraints = [
            models.UniqueConstraint(fields=['user', 'restaurant'], name='unique_user_restaurant_view')
        ]


    def __str__(self):
        return f"{self.user.phone_number} viewed {self.restaurant.name}"


@receiver(pre_save, sender=Restaurant)
def auto_geocode_restaurant(sender, instance, **kwargs):
    """
    Tự động lấy tọa độ khi nhà hàng được tạo mới hoặc thay đổi địa chỉ/vị trí.
    """
    if not instance.pk:
        # Trường hợp tạo mới
        should_geocode = True
    else:
        try:
            old_instance = Restaurant.objects.get(pk=instance.pk)
            # Chỉ geocode nếu địa chỉ hoặc location thay đổi
            should_geocode = (
                instance.address != old_instance.address or 
                instance.location_id != old_instance.location_id
            )
            
            # Hoặc nếu chưa có tọa độ
            if not instance.latitude or not instance.longitude:
                should_geocode = True
        except Restaurant.DoesNotExist:
            should_geocode = True

    if should_geocode:
        from .utils import geocode_address
        
        # Xây dựng chuỗi địa chỉ đầy đủ
        parts = []
        if instance.address:
            parts.append(instance.address)
            
        loc = instance.location
        if loc:
            if loc.ward: parts.append(loc.ward)
            if loc.district: parts.append(loc.district)
            if loc.city: parts.append(loc.city)
            
        full_address = ", ".join(parts)
        
        if full_address:
            lat, lng = geocode_address(full_address, fallback_parts=parts)
            if lat and lng:
                instance.latitude = lat
                instance.longitude = lng
