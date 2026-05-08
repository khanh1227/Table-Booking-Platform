from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import WalletViewSet, TransactionViewSet, DepositPolicyViewSet, VNPAYPaymentView, VNPAYIPNView, VNPAYReturnView, VNPAYVerifyReturnView, PlatformRevenueStatsView

router = DefaultRouter()
router.register(r'wallets', WalletViewSet, basename='wallet')
router.register(r'transactions', TransactionViewSet, basename='transaction')
router.register(r'deposit-policies', DepositPolicyViewSet, basename='deposit-policy')

urlpatterns = [
    path('', include(router.urls)),
    path('create-vnpay-url/', VNPAYPaymentView.as_view(), name='create-vnpay-url'),
    path('vnpay-ipn/', VNPAYIPNView.as_view(), name='vnpay-ipn'),
    path('vnpay-return/', VNPAYReturnView.as_view(), name='vnpay-return'),
    path('verify-vnpay-return/', VNPAYVerifyReturnView.as_view(), name='verify-vnpay-return'),
    path('platform-revenue/', PlatformRevenueStatsView.as_view(), name='platform-revenue'),
]
