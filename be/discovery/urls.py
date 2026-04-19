from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import CollectionViewSet, BannerViewSet

router = DefaultRouter()
router.register(r'collections', CollectionViewSet, basename='collection')
router.register(r'banners', BannerViewSet, basename='banner')

urlpatterns = [
    path('', include(router.urls)),
]
