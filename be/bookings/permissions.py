# bookings/permissions.py
from rest_framework import permissions


class IsCustomer(permissions.BasePermission):
    """
    Permission: Chỉ cho phép user đã đăng nhập (bất kỳ role nào cũng có thể đặt bàn)
    """
    def has_permission(self, request, view):
        return request.user and request.user.is_authenticated


class IsPartner(permissions.BasePermission):
    """
    Permission: Chỉ cho phép user có role=PARTNER
    """
    def has_permission(self, request, view):
        return request.user and request.user.is_authenticated and request.user.role == 'PARTNER'


class IsPartnerOfRestaurant(permissions.BasePermission):
    """
    Permission: Partner chỉ thao tác với booking của nhà hàng mình
    """
    def has_object_permission(self, request, view, obj):
        # obj là Booking
        if request.user.role != 'PARTNER':
            return False
        return obj.restaurant.partner == request.user


class IsOwnerOrPartner(permissions.BasePermission):
    """
    Permission: Customer chỉ thao tác booking của mình,
    Partner chỉ thao tác booking của nhà hàng mình HOẶC booking mình tự đặt,
    Admin có thể thao tác tất cả
    """
    def has_object_permission(self, request, view, obj):
        # obj là Booking
        if request.user.role == 'ADMIN':
            return True
        # Bất kỳ ai cũng có thể thao tác booking mà họ là người đặt
        if obj.customer == request.user:
            return True
        # Partner có thể thao tác booking của nhà hàng mình quản lý
        if request.user.role == 'PARTNER':
            return hasattr(request.user, 'partner') and obj.restaurant.partner == request.user.partner
        return False