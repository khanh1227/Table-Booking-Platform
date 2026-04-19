from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import ReviewViewSet, AdminReviewReportViewSet

router = DefaultRouter()
router.register(r'reports', AdminReviewReportViewSet, basename='review-report')
router.register(r'', ReviewViewSet, basename='review')

urlpatterns = [
    path('', include(router.urls)),
]
