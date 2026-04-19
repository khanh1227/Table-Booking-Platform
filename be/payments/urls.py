from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import WalletViewSet, TransactionViewSet, DepositPolicyViewSet, SimulateDepositView

router = DefaultRouter()
router.register(r'wallets', WalletViewSet, basename='wallet')
router.register(r'transactions', TransactionViewSet, basename='transaction')
router.register(r'deposit-policies', DepositPolicyViewSet, basename='deposit-policy')

urlpatterns = [
    path('', include(router.urls)),
    path('simulate-deposit/', SimulateDepositView.as_view(), name='simulate-deposit'),
]
