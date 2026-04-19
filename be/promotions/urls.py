from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import VoucherViewSet, UserVoucherViewSet

router = DefaultRouter()
router.register(r'vouchers', VoucherViewSet, basename='voucher')
router.register(r'my-vouchers', UserVoucherViewSet, basename='user-voucher')

urlpatterns = [
    path('', include(router.urls)),
]
