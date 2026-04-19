# ==================== accounts/views.py ====================
import logging
from datetime import timedelta
from django.utils import timezone
from django.contrib.auth import authenticate
from rest_framework import status, generics
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework_simplejwt.tokens import RefreshToken
from .models import User, Customer, Partner
from .serializers import (
    CustomerSerializer, PartnerSerializer, LoginSerializer, 
    UserSerializer, CustomerDetailSerializer, PartnerDetailSerializer
)


class CustomerRegisterView(generics.CreateAPIView):
    """Đăng ký tài khoản khách hàng"""
    queryset = Customer.objects.all()
    serializer_class = CustomerSerializer
    permission_classes = [AllowAny]

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        customer = serializer.save()
        
        # Tạo token
        refresh = RefreshToken.for_user(customer.user)
        
        return Response({
            'message': 'Đăng ký khách hàng thành công',
            'user': UserSerializer(customer.user).data,
            'customer': CustomerDetailSerializer(customer).data,
            'tokens': {
                'refresh': str(refresh),
                'access': str(refresh.access_token),
            }
        }, status=status.HTTP_201_CREATED)


class PartnerRegisterView(generics.CreateAPIView):
    """Đăng ký tài khoản đối tác"""
    queryset = Partner.objects.all()
    serializer_class = PartnerSerializer
    permission_classes = [AllowAny]

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        partner = serializer.save()
        
        refresh = RefreshToken.for_user(partner.user)
        
        return Response({
            'message': 'Đăng ký đối tác thành công.',
            'user': UserSerializer(partner.user).data,
            'partner': PartnerDetailSerializer(partner).data,
            'tokens': {
                'refresh': str(refresh),
                'access': str(refresh.access_token),
            }
        }, status=status.HTTP_201_CREATED)


class LoginView(APIView):
    """Đăng nhập cho tất cả user types"""
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = LoginSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        
        phone_number = serializer.validated_data['phone_number']
        password = serializer.validated_data['password']
        
        user = authenticate(phone_number=phone_number, password=password)
        
        if user is None:
            return Response({
                'error': 'Số điện thoại hoặc mật khẩu không đúng'
            }, status=status.HTTP_401_UNAUTHORIZED)
        
        if not user.is_active:
            return Response({
                'error': 'Tài khoản đã bị vô hiệu hóa'
            }, status=status.HTTP_403_FORBIDDEN)
        
        refresh = RefreshToken.for_user(user)
        
        response_data = {
            'message': 'Đăng nhập thành công',
            'user': UserSerializer(user).data,
            'tokens': {
                'refresh': str(refresh),
                'access': str(refresh.access_token),
            }
        }
        
        # Thêm thông tin chi tiết theo role
        if user.role == 'CUSTOMER' and hasattr(user, 'customer'):
            response_data['customer'] = CustomerDetailSerializer(user.customer).data
        elif user.role == 'PARTNER' and hasattr(user, 'partner'):
            response_data['partner'] = PartnerDetailSerializer(user.partner).data
        
        return Response(response_data)


class ProfileView(APIView):
    """Xem thông tin profile của user hiện tại"""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        user = request.user
        data = {
            'user': UserSerializer(user).data
        }
        
        if user.role == 'CUSTOMER' and hasattr(user, 'customer'):
            data['customer'] = CustomerDetailSerializer(user.customer).data
        elif user.role == 'PARTNER' and hasattr(user, 'partner'):
            data['partner'] = PartnerDetailSerializer(user.partner).data
        
        return Response(data)

    def put(self, request):
        """Cập nhật thông tin profile"""
        user = request.user
        
        # Cập nhật thông tin User
        user_data = {}
        if 'full_name' in request.data:
            user_data['full_name'] = request.data['full_name']
        if 'email' in request.data:
            user_data['email'] = request.data['email']
        
        if user_data:
            user_serializer = UserSerializer(user, data=user_data, partial=True)
            user_serializer.is_valid(raise_exception=True)
            user_serializer.save()
        
        # Cập nhật thông tin Customer/Partner
        if user.role == 'CUSTOMER' and hasattr(user, 'customer'):
            customer_data = {k: v for k, v in request.data.items() if k in ['date_of_birth', 'address']}
            if customer_data:
                customer_serializer = CustomerDetailSerializer(user.customer, data=customer_data, partial=True)
                customer_serializer.is_valid(raise_exception=True)
                customer_serializer.save()
        
        elif user.role == 'PARTNER' and hasattr(user, 'partner'):
            partner_data = {k: v for k, v in request.data.items() if k in ['business_name', 'business_license', 'tax_code']}
            if partner_data:
                partner_serializer = PartnerDetailSerializer(user.partner, data=partner_data, partial=True)
                partner_serializer.is_valid(raise_exception=True)
                partner_serializer.save()
        
        return Response({
            'message': 'Cập nhật thông tin thành công',
            'user': UserSerializer(user).data
        })


class LogoutView(APIView):
    """Đăng xuất (blacklist refresh token)"""
    permission_classes = [IsAuthenticated]

    def post(self, request):
        try:
            refresh_token = request.data.get('refresh')
            token = RefreshToken(refresh_token)
            token.blacklist()
            return Response({'message': 'Đăng xuất thành công'})
        except Exception:
            return Response({'error': 'Token không hợp lệ'}, status=status.HTTP_400_BAD_REQUEST)


class ChangePasswordView(APIView):
    """Đổi mật khẩu cho user đang đăng nhập"""
    permission_classes = [IsAuthenticated]

    def put(self, request):
        from .serializers import ChangePasswordSerializer
        serializer = ChangePasswordSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        
        user = request.user
        old_password = serializer.validated_data['old_password']
        new_password = serializer.validated_data['new_password']
        
        if not user.check_password(old_password):
            return Response({'error': 'Mật khẩu cũ không chính xác'}, status=status.HTTP_400_BAD_REQUEST)
        
        user.set_password(new_password)
        user.save()
        
        from .serializers import UserSerializer
        return Response({
            'message': 'Đổi mật khẩu thành công',
            'user': UserSerializer(user).data
        })


class AvatarUploadView(APIView):
    """Upload ảnh đại diện cho user"""
    permission_classes = [IsAuthenticated]

    def post(self, request):
        avatar = request.FILES.get('avatar')
        if not avatar:
            return Response({'error': 'Vui lòng cung cấp file ảnh'}, status=status.HTTP_400_BAD_REQUEST)
            
        allowed_extensions = ['jpg', 'jpeg', 'png']
        ext = avatar.name.split('.')[-1].lower()
        if ext not in allowed_extensions:
            return Response(
                {'error': f'Chỉ cho phép file: {", ".join(allowed_extensions)}'},
                status=status.HTTP_400_BAD_REQUEST
            )
            
        if avatar.size > 5 * 1024 * 1024:
            return Response(
                {'error': 'Kích thước ảnh không được vượt quá 5MB'},
                status=status.HTTP_400_BAD_REQUEST
            )

        user = request.user
        
        # Xóa ảnh cũ nếu có
        import os
        if user.avatar and os.path.isfile(user.avatar.path):
            try:
                os.remove(user.avatar.path)
            except Exception:
                pass
                
        user.avatar = avatar
        user.save()
        
        from .serializers import UserSerializer
        return Response({
            'message': 'Cập nhật ảnh đại diện thành công',
            'user': UserSerializer(user).data
        })


class ForgotPasswordSendOTPView(APIView):
    """Mô phỏng gửi OTP qua điện thoại"""
    permission_classes = [AllowAny]

    def post(self, request):
        from .serializers import ForgotPasswordSendOTPSerializer
        serializer = ForgotPasswordSendOTPSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        
        phone_number = serializer.validated_data['phone_number']
        
        # Kiểm tra xem User có tồn tại không
        if not User.objects.filter(phone_number=phone_number).exists():
            return Response({'error': 'Số điện thoại không tồn tại trong hệ thống'}, status=status.HTTP_404_NOT_FOUND)
            
        # Sinh OTP 6 số
        import random
        otp_code = str(random.randint(100000, 999999))
        
        # Lưu vào bảng OTPVerification
        from .models import OTPVerification
        OTPVerification.objects.create(phone_number=phone_number, otp_code=otp_code)
        
        # Trong thực tế, ở đây sẽ gọi SMS API (ví dụ: Twilio, SMSC,...)
        return Response({
            'message': 'Mã OTP đã được gửi đến số điện thoại của bạn',
            'mock_otp': otp_code  # Trả về luôn để FE dễ test (trong thực tế sẽ ẩn đi)
        })


class ResetPasswordView(APIView):
    """Kiểm tra OTP và đặt lại mật khẩu mới"""
    permission_classes = [AllowAny]

    def post(self, request):
        from .serializers import ResetPasswordSerializer
        serializer = ResetPasswordSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        
        phone_number = serializer.validated_data['phone_number']
        otp_code = serializer.validated_data['otp_code']
        new_password = serializer.validated_data['new_password']
        
        # Tìm OTP mới nhất chưa được verify
        from .models import OTPVerification
        
        # Tìm OTP mới nhất chưa được verify
        otp_record = OTPVerification.objects.filter(
            phone_number=phone_number, 
            otp_code=otp_code, 
            is_verified=False
        ).order_by('-created_at').first()
        
        if not otp_record:
            return Response({'error': 'Mã OTP không hợp lệ hoặc đã hết hạn'}, status=status.HTTP_400_BAD_REQUEST)
            
        # Kiểm tra hạn (ví dụ 5 phút)
        if timezone.now() > otp_record.created_at + timedelta(minutes=5):
            return Response({'error': 'Mã OTP đã hết hạn'}, status=status.HTTP_400_BAD_REQUEST)
            
        # Đánh dấu đã dùng
        otp_record.is_verified = True
        otp_record.save()
        
        try:
            user = User.objects.get(phone_number=phone_number)
            user.set_password(new_password)
            user.save()
            return Response({'message': 'Mật khẩu đã được đặt lại thành công. Bạn có thể đăng nhập ngay bây giờ.'})
        except User.DoesNotExist:
            return Response({'error': 'Không tìm thấy người dùng'}, status=status.HTTP_404_NOT_FOUND)

class AdminPartnerManagementView(APIView):
    """Admin lấy danh sách Partner"""
    permission_classes = [IsAuthenticated]
    
    def get(self, request):
        if request.user.role != 'ADMIN':
            return Response({'error': 'Forbidden'}, status=status.HTTP_403_FORBIDDEN)
        
        try:
            partners = Partner.objects.select_related('user').all().order_by('-user__created_at')
            data = []
            for p in partners:
                data.append({
                    'id': p.pk,
                    'user_id': p.user.id,
                    'business_name': p.business_name,
                    'business_license': p.business_license,
                    'phone': p.user.phone_number,
                    'email': p.user.email,
                    'status': p.status,
                    'is_active': p.user.is_active,
                    'joined': p.user.created_at.strftime('%Y-%m-%d %H:%M:%S') if p.user.created_at else 'N/A',
                })
            from rest_framework.pagination import PageNumberPagination
            paginator = PageNumberPagination()
            paginator.page_size = 20
            page = paginator.paginate_queryset(data, request)
            return paginator.get_paginated_response(page)
        except Exception as e:
            import traceback
            tb = traceback.format_exc()
            print(f"[AdminPartnerManagementView ERROR] {e}\n{tb}")
            return Response({
                'error': str(e),
                'traceback': tb
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

class AdminPartnerActionView(APIView):
    """Admin duyệt / khóa thao tác Partner"""
    permission_classes = [IsAuthenticated]
    
    def post(self, request, pk, action_type):
        if request.user.role != 'ADMIN':
            return Response({'error': 'Forbidden'}, status=status.HTTP_403_FORBIDDEN)
            
        try:
            partner = Partner.objects.get(pk=pk)
            user = partner.user
            
            if action_type == 'approve':
                partner.status = 'ACTIVE'
                user.is_active = True
                msg = 'Duyệt đối tác thành công'
            elif action_type == 'reject' or action_type == 'suspend':
                partner.status = 'SUSPENDED'
                user.is_active = False # Khóa luôn quyền đăng nhập
                msg = 'Đã khóa/từ chối đối tác'
            else:
                return Response({'error': 'Action không hợp lệ'}, status=status.HTTP_400_BAD_REQUEST)
                
            partner.save()
            user.save()
            return Response({'message': msg, 'status': partner.status, 'is_active': user.is_active})
        except Partner.DoesNotExist:
            return Response({'error': 'Không tìm thấy đối tác'}, status=status.HTTP_404_NOT_FOUND)

class AdminUserManagementView(APIView):
    """Admin lấy danh sách Customer"""
    permission_classes = [IsAuthenticated]
    
    def get(self, request):
        if request.user.role != 'ADMIN':
            return Response({'error': 'Forbidden'}, status=status.HTTP_403_FORBIDDEN)
        try:
            from .models import User
            users = User.objects.exclude(role__in=['ADMIN', 'PARTNER']).order_by('-created_at')
            data = []
            for u in users:
                loyalty = 0
                bookings = 0
                if hasattr(u, 'customer') and getattr(u, 'customer', None) is not None:
                    loyalty = u.customer.loyalty_points
                    bookings = u.customer.total_bookings
                    
                data.append({
                    'id': str(u.pk),
                    'user_id': u.pk,
                    'full_name': u.full_name or "Chưa cập nhật",
                    'phone': u.phone_number,
                    'email': u.email,
                    'loyalty_points': loyalty,
                    'total_bookings': bookings,
                    'is_active': u.is_active,
                    'joined': u.created_at.strftime('%Y-%m-%d %H:%M:%S') if u.created_at else 'N/A',
                })
            
            from rest_framework.pagination import PageNumberPagination
            paginator = PageNumberPagination()
            paginator.page_size = 20
            page = paginator.paginate_queryset(data, request)
            return paginator.get_paginated_response(page)
        except Exception as e:
            import traceback
            tb = traceback.format_exc()
            print(f"[AdminUserManagementView ERROR] {e}\n{tb}")
            return Response({
                'error': str(e),
                'traceback': tb
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

class AdminUserActionView(APIView):
    """Admin khóa / mở khóa User"""
    permission_classes = [IsAuthenticated]
    
    def post(self, request, pk, action_type):
        if request.user.role != 'ADMIN':
            return Response({'error': 'Forbidden'}, status=status.HTTP_403_FORBIDDEN)
            
        try:
            from .models import User
            user = User.objects.get(pk=pk)
            
            if action_type == 'ban':
                user.is_active = False
                msg = 'Đã khóa tài khoản'
            elif action_type == 'unban':
                user.is_active = True
                msg = 'Đã mở khóa tài khoản'
            else:
                return Response({'error': 'Action không hợp lệ'}, status=status.HTTP_400_BAD_REQUEST)
                
            user.save()
            return Response({'message': msg, 'is_active': user.is_active})
        except Exception:
            return Response({'error': 'Không tìm thấy người dùng'}, status=status.HTTP_404_NOT_FOUND)
