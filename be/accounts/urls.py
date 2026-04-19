# ==================== accounts/urls.py ====================
from django.urls import path
from .views import (
    CustomerRegisterView,
    PartnerRegisterView,
    LoginView,
    ProfileView,
    LogoutView,
    ChangePasswordView,
    AvatarUploadView,
    ForgotPasswordSendOTPView,
    ResetPasswordView,
    AdminPartnerManagementView,
    AdminPartnerActionView,
    AdminUserManagementView,
    AdminUserActionView
)
from rest_framework_simplejwt.views import TokenRefreshView

app_name = 'accounts'

urlpatterns = [
    path('register/customer/', CustomerRegisterView.as_view(), name='customer-register'),
    path('register/partner/', PartnerRegisterView.as_view(), name='partner-register'),
    path('login/', LoginView.as_view(), name='login'),
    path('token/refresh/', TokenRefreshView.as_view(), name='token_refresh'),
    path('profile/', ProfileView.as_view(), name='profile'),
    path('change-password/', ChangePasswordView.as_view(), name='change-password'),
    path('avatar/upload/', AvatarUploadView.as_view(), name='avatar-upload'),
    path('forgot-password/send-otp/', ForgotPasswordSendOTPView.as_view(), name='forgot-password-send-otp'),
    path('forgot-password/reset/', ResetPasswordView.as_view(), name='forgot-password-reset'),
    path('logout/', LogoutView.as_view(), name='logout'),
    
    # Admin endpoints
    path('admin/partners/', AdminPartnerManagementView.as_view(), name='admin-partners'),
    path('admin/partners/<int:pk>/<str:action_type>/', AdminPartnerActionView.as_view(), name='admin-partner-action'),
    path('admin/users/', AdminUserManagementView.as_view(), name='admin-users'),
    path('admin/users/<int:pk>/<str:action_type>/', AdminUserActionView.as_view(), name='admin-user-action'),
]