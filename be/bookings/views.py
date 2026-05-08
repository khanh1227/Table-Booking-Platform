# bookings/views.py
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.pagination import PageNumberPagination
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django.utils import timezone

from django.db.models import Q
from .models import Booking
from .serializers import (
    BookingListSerializer,
    BookingDetailSerializer,
    BookingCreateSerializer,
    CheckAvailabilitySerializer
)
from restaurants.models import Restaurant, TimeSlot
from .permissions import IsCustomer, IsPartnerOfRestaurant
from payments.services import (
    auto_finalize_due_bookings,
    award_booking_loyalty_points,
    calculate_customer_cancellation_refund,
    cleanup_expired_pending_bookings,
    move_booking_deposit_to_settlement,
    release_partner_settlements,
    refund_booking_deposit,
    settle_customer_cancellation,
)


class BookingPagination(PageNumberPagination):
    page_size_query_param = 'page_size'
    max_page_size = 50


class BookingViewSet(viewsets.ModelViewSet):
    """
    ViewSet cho quản lý bookings
    - Customer: Tạo, xem, hủy booking của mình
    - Partner: Xem, confirm, reject, complete booking của nhà hàng mình
    """
    permission_classes = [IsAuthenticated]
    pagination_class = BookingPagination
    
    def get_serializer_class(self):
        if self.action == 'create':
            return BookingCreateSerializer
        elif self.action == 'retrieve':
            return BookingDetailSerializer
        return BookingListSerializer

    def get_queryset(self):
        user = self.request.user
        is_personal = self.request.query_params.get('is_personal', 'false').lower() == 'true'
        
        if user.role == 'CUSTOMER':
            # Customer chỉ xem booking của mình
            return Booking.objects.filter(customer=user).select_related(
                'restaurant', 'time_slot', 'customer'
            )
        elif user.role == 'PARTNER':
            # Nếu yêu cầu xem booking cá nhân
            if is_personal:
                return Booking.objects.filter(customer=user).select_related(
                    'restaurant', 'time_slot', 'customer'
                )
            
            # Mặc định (quản lý): 
            # - Nếu là hành động 'list' (danh sách): Chỉ hiện booking của nhà hàng mình quản lý
            # - Nếu là hành động 'retrieve' (chi tiết) hoặc khác: Cho phép xem cả booking mình tự đặt 
            #   để tránh lỗi 404 khi Partner truy cập booking cá nhân của họ.
            base_qs = Booking.objects.all().select_related(
                'restaurant', 'time_slot', 'customer'
            ).distinct()

            if self.action == 'list':
                return base_qs.filter(restaurant__partner__user=user)
            
            return base_qs.filter(
                Q(restaurant__partner__user=user) | Q(customer=user)
            )
        elif user.role == 'ADMIN':
            if is_personal:
                return Booking.objects.filter(customer=user).select_related(
                    'restaurant', 'time_slot', 'customer'
                )
            return Booking.objects.all().select_related(
                'restaurant', 'time_slot', 'customer'
            )
        
        return Booking.objects.none()

    def list(self, request, *args, **kwargs):
        """
        GET /api/bookings/
        List bookings với filter options
        """
        queryset = self.get_queryset()

        cleanup_expired_pending_bookings()
        auto_finalize_due_bookings()
        release_partner_settlements()

        
        # Filter by status
        status_filter = request.query_params.get('status')
        if status_filter:
            queryset = queryset.filter(status=status_filter.upper())
        
        # Filter by date range
        start_date = request.query_params.get('start_date')
        end_date = request.query_params.get('end_date')
        if start_date:
            queryset = queryset.filter(booking_date__gte=start_date)
        if end_date:
            queryset = queryset.filter(booking_date__lte=end_date)
            
        # Filter by restaurant (for partner/admin)
        restaurant_id = request.query_params.get('restaurant_id')
        if restaurant_id and request.user.role in ['PARTNER', 'ADMIN']:
            queryset = queryset.filter(restaurant_id=restaurant_id)
        
        # Order by
        order_by = request.query_params.get('order_by', '-created_at')
        queryset = queryset.order_by(order_by)
        
        page = self.paginate_queryset(queryset)
        if page is not None:
            serializer = self.get_serializer(page, many=True)
            return self.get_paginated_response(serializer.data)
        
        serializer = self.get_serializer(queryset, many=True)
        return Response({
            'message': 'Lấy danh sách booking thành công',
            'data': serializer.data
        })

    def create(self, request, *args, **kwargs):
        """
        POST /api/bookings/
        Tạo booking mới (tất cả user đã đăng nhập)
        """
        from accounts.models import Customer as CustomerProfile

        # Tự động tạo Customer profile nếu chưa có (cho Partner/Admin)
        if not hasattr(request.user, 'customer') or request.user.customer is None:
            CustomerProfile.objects.get_or_create(user=request.user)
            # Làm mới lại đối tượng user để có relation mới
            request.user.refresh_from_db()

        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        booking = serializer.save()

        # Tăng total_bookings cho customer profile
        if hasattr(request.user, 'customer') and request.user.customer:
            customer_profile = request.user.customer
            customer_profile.total_bookings += 1
            customer_profile.save()

        return Response({
            'message': 'Đặt bàn thành công',
            'data': BookingDetailSerializer(booking).data
        }, status=status.HTTP_201_CREATED)

    def retrieve(self, request, *args, **kwargs):
        """
        GET /api/bookings/{id}/
        Xem chi tiết booking
        """
        booking = self.get_object()
        serializer = self.get_serializer(booking)
        return Response({
            'message': 'Lấy thông tin booking thành công',
            'data': serializer.data
        })

    @action(detail=True, methods=['put'], permission_classes=[IsAuthenticated])
    def cancel(self, request, pk=None):
        """
        PUT /api/bookings/{id}/cancel/
        Hủy booking (Customer only, chỉ khi status = PENDING/CONFIRMED)
        """
        booking = self.get_object()
        
        # Kiểm tra booking có thuộc về customer này không
        if booking.customer != request.user:
            return Response(
                {'error': 'Bạn không có quyền hủy booking này'},
                status=status.HTTP_403_FORBIDDEN
            )
        if not booking.can_cancel():
            return Response(
                {'error': f'Không thể hủy booking ở trạng thái {booking.get_status_display()}'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        try:
            if booking.is_deposit_paid and booking.deposit_amount > 0:
                refund_amount = calculate_customer_cancellation_refund(booking)
                settlement = settle_customer_cancellation(booking, refund_amount)
                refund_amount = settlement['refund_amount']
                retained_amount = settlement['retained_amount']
                booking.rejection_reason = (
                    f'Khach hang huy booking. Hoan noi bo {refund_amount:,.0f}d, '
                    f'giu lai {retained_amount:,.0f}d theo chinh sach huy.'
                )
            else:
                booking.rejection_reason = 'Khach hang huy booking'
        except Exception as exc:
            return Response(
                {'error': f'Khong the xu ly hoan coc: {str(exc)}'},
                status=status.HTTP_400_BAD_REQUEST
            )

        booking.status = 'CANCELLED'
        booking.save(update_fields=['status', 'rejection_reason'])


        return Response({
            'message': 'Hủy booking thành công',
            'data': BookingDetailSerializer(booking).data
        })

    # Removed confirm action as bookings are now auto-confirmed

    @action(detail=True, methods=['put'], permission_classes=[IsAuthenticated])
    def reject(self, request, pk=None):
        """
        PUT /api/bookings/{id}/reject/
        Từ chối booking (Partner only, chỉ khi status = PENDING)
        """
        booking = self.get_object()
        
        # Kiểm tra quyền
        if request.user.role != 'PARTNER' or not hasattr(request.user, 'partner') or booking.restaurant.partner != request.user.partner:
            return Response(
                {'error': 'Bạn không có quyền từ chối booking này'},
                status=status.HTTP_403_FORBIDDEN
            )
        
        if not booking.can_reject():
            return Response(
                {'error': f'Không thể từ chối booking ở trạng thái {booking.get_status_display()}'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        try:
            rejection_reason = request.data.get('rejection_reason', '')

            if booking.is_deposit_paid and booking.deposit_amount > 0:
                refund_booking_deposit(
                    booking,
                    actor_name=request.user.full_name or request.user.phone_number,
                    ip_addr='127.0.0.1',
                    reason=f'Từ chối booking: {rejection_reason or "Không có lý do"}',
                )

            booking.status = 'REJECTED'
            booking.rejection_reason = rejection_reason
            booking.save(update_fields=['status', 'rejection_reason'])

            from notifications.models import Notification
            Notification.create_notification(
                user=booking.customer,
                title="Đơn đặt bàn bị từ chối",
                message=(
                    f"Nhà hàng {booking.restaurant.name} đã từ chối đơn đặt bàn #{booking.id} của bạn.\n"
                    f"Lý do: {rejection_reason}\n"
                    + (f"Số tiền {booking.deposit_amount:,.0f}đ đã được hoàn vào số dư nội bộ của bạn." if booking.is_deposit_paid else "")
                ),
                notification_type='BOOKING',
                related_type='BOOKING',
                related_id=booking.id
            )
            
            return Response({
                'message': 'Từ chối booking, hoàn tiền cọc và gửi thông báo thành công',
                'data': BookingDetailSerializer(booking).data
            })
        except Exception as e:
            return Response(
                {'error': f'Lỗi khi từ chối: {str(e)}'},
                status=status.HTTP_400_BAD_REQUEST
            )

    @action(detail=True, methods=['put'], permission_classes=[IsAuthenticated])
    def complete(self, request, pk=None):
        """
        PUT /api/bookings/{id}/complete/
        Đánh dấu hoàn thành (Partner only, chỉ khi status = CONFIRMED)
        """
        booking = self.get_object()
        
        if request.user.role != 'PARTNER' or not hasattr(request.user, 'partner') or booking.restaurant.partner != request.user.partner:
            return Response(
                {'error': 'Bạn không có quyền cập nhật booking này'},
                status=status.HTTP_403_FORBIDDEN
            )
        
        if not booking.can_complete():
            return Response(
                {'error': f'Khong the hoan thanh booking o trang thai {booking.get_status_display()}'},
                status=status.HTTP_400_BAD_REQUEST
            )

        try:
            booking.status = 'COMPLETED'
            booking.finalized_at = timezone.now()
            booking.save(update_fields=['status', 'finalized_at'])
            move_booking_deposit_to_settlement(booking)
            award_booking_loyalty_points(booking)

            return Response({
                'message': 'Danh dau hoan thanh thanh cong',
                'data': BookingDetailSerializer(booking).data
            })
        except Exception as e:
            return Response(
                {'error': f'Loi khi cap nhat hoan thanh: {str(e)}'},
                status=status.HTTP_400_BAD_REQUEST
            )
    @action(detail=True, methods=['put'], permission_classes=[IsAuthenticated])
    def no_show(self, request, pk=None):
        """
        PUT /api/bookings/{id}/no-show/
        Đánh dấu khách không đến (Partner only, chỉ khi status = CONFIRMED)
        """
        booking = self.get_object()
        
        if request.user.role != 'PARTNER' or not hasattr(request.user, 'partner') or booking.restaurant.partner != request.user.partner:
            return Response(
                {'error': 'Bạn không có quyền cập nhật booking này'},
                status=status.HTTP_403_FORBIDDEN
            )
        
        if not booking.can_mark_no_show():
            return Response(
                {'error': f'Không thể đánh dấu no-show ở trạng thái {booking.get_status_display()}'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        try:
            booking.status = 'NO_SHOW'
            booking.finalized_at = timezone.now()
            booking.save(update_fields=['status', 'finalized_at'])
            move_booking_deposit_to_settlement(booking)
            
            return Response({
                'message': 'Đánh dấu no-show thành công',
                'data': BookingDetailSerializer(booking).data
            })
        except Exception as e:
            return Response(
                {'error': f'Lỗi khi cập nhật no-show: {str(e)}'},
                status=status.HTTP_400_BAD_REQUEST
            )

    @action(detail=False, methods=['post'], permission_classes=[IsAuthenticated])
    def check_availability(self, request):
        """
        POST /api/bookings/check-availability/
        Kiểm tra khung giờ còn chỗ trống
        Body: {
            "restaurant_id": 1,
            "booking_date": "2025-01-20",
            "time_slot_id": 3  // optional - nếu có thì check slot cụ thể
        }
        """
        serializer = CheckAvailabilitySerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        
        restaurant_id = serializer.validated_data['restaurant_id']
        booking_date = serializer.validated_data['booking_date']
        time_slot_id = serializer.validated_data.get('time_slot_id')
        
        if time_slot_id:
            # Check slot cụ thể
            available, message = Booking.is_slot_available(
                restaurant_id, booking_date, time_slot_id
            )
            
            time_slot = TimeSlot.objects.get(id=time_slot_id)
            current_bookings = Booking.count_bookings_for_slot(
                restaurant_id, booking_date, time_slot_id
            )
            
            return Response({
                'available': available,
                'message': message,
                'time_slot': {
                    'id': time_slot.id,
                    'start_time': time_slot.start_time.strftime('%H:%M'),
                    'end_time': time_slot.end_time.strftime('%H:%M'),
                    'max_bookings': time_slot.max_bookings,
                    'current_bookings': current_bookings,
                }
            })
        else:
            # Trả về tất cả slots available
            restaurant = Restaurant.objects.get(id=restaurant_id)
            time_slots = TimeSlot.objects.filter(
                restaurant=restaurant,
                is_active=True
            ).order_by('start_time')
            
            available_slots = []
            for slot in time_slots:
                current_bookings = Booking.count_bookings_for_slot(
                    restaurant_id, booking_date, slot.id
                )
                is_available = not slot.max_bookings or current_bookings < slot.max_bookings
                
                available_slots.append({
                    'id': slot.id,
                    'start_time': slot.start_time.strftime('%H:%M'),
                    'end_time': slot.end_time.strftime('%H:%M'),
                    'max_bookings': slot.max_bookings,
                    'max_guests_per_booking': slot.max_guests_per_booking, # Thêm giới hạn khách
                    'current_bookings': current_bookings,
                    'available': is_available
                })
            
            return Response({
                'date': booking_date,
                'restaurant_id': restaurant_id,
                'restaurant_name': restaurant.name,
                'available_slots': available_slots
            })

    @action(detail=False, methods=['post'], permission_classes=[IsAuthenticated])
    def expire_unpaid(self, request):
        """
        POST /api/bookings/expire_unpaid/
        Tự động hủy các booking PENDING chưa thanh toán cọc và đã hết hạn.
        """
        count = cleanup_expired_pending_bookings()

        return Response({
            'message': f'Đã tự động hủy {count} đơn đặt bàn quá hạn cọc.',
            'expired_count': count
        })

    @action(detail=False, methods=['post'], permission_classes=[IsAuthenticated])
    def auto_finalize(self, request):
        completed_count = auto_finalize_due_bookings()
        released_count = release_partner_settlements()
        return Response({
            'message': 'Đã xử lý tự động booking sau giờ hẹn và mở khóa quyết toán.',
            'completed_count': completed_count,
            'released_count': released_count,
        })

    @action(
        detail=False,
        methods=['get'],
        permission_classes=[IsAuthenticated],
        url_path='partner-dashboard-stats'
    )
    def partner_dashboard_stats(self, request):
        """
        GET /api/bookings/partner-dashboard-stats/?restaurant_id=...
        
        Trả về thống kê cho partner dashboard:
        - total_restaurants: Tổng số nhà hàng của partner
        - bookings_today: Booking hôm nay
        - bookings_this_week: Booking tuần này
        - bookings_pending: Booking chờ xác nhận
        - upcoming_bookings_next_2h: Booking sắp diễn ra (2h tới)
        - upcoming_bookings_next_24h: Booking sắp diễn ra (24h tới)
        - peak_hours_today: Top 3 khung giờ có booking hôm nay
        - bookings_7days: Booking 7 ngày gần nhất (cho biểu đồ)
        """
        from datetime import datetime, timedelta
        from collections import Counter
        
        user = request.user
        
        # Chỉ partner mới xem được
        if user.role != 'PARTNER':
            return Response(
                {'error': 'Only partners can access this endpoint'},
                status=status.HTTP_403_FORBIDDEN
            )
        
        # Lấy tất cả nhà hàng của partner
        restaurants = Restaurant.objects.filter(partner__user=user)
        total_restaurants = restaurants.count()
        restaurant_ids = list(restaurants.values_list('id', flat=True))
        
        # Nếu có restaurant_id param, chỉ lọc nhà hàng đó
        restaurant_id_param = request.query_params.get('restaurant_id')
        if restaurant_id_param:
            if int(restaurant_id_param) not in restaurant_ids:
                return Response(
                    {'error': 'Restaurant not found or not owned by you'},
                    status=status.HTTP_404_NOT_FOUND
                )
            restaurant_ids = [int(restaurant_id_param)]
        
        # Base queryset
        bookings_qs = Booking.objects.filter(restaurant_id__in=restaurant_ids)
        
        # 1. Bookings today
        today = timezone.now().date()
        bookings_today = bookings_qs.filter(booking_date=today).count()
        
        # 2. Bookings this week (Mon-Sun)
        now = timezone.now()
        day = now.weekday()
        week_start = now - timedelta(days=day)
        week_end = week_start + timedelta(days=6)
        week_start_date = week_start.date()
        week_end_date = week_end.date()
        bookings_this_week = bookings_qs.filter(
            booking_date__gte=week_start_date,
            booking_date__lte=week_end_date
        ).count()
        
        # 3. Bookings pending
        bookings_pending = bookings_qs.filter(status='PENDING').count()
        
        # 4. Upcoming bookings next 2h
        now = timezone.now()
        two_hours_later = now + timedelta(hours=2)
        upcoming_2h = bookings_qs.filter(
            booking_date=today,
            time_slot__start_time__lte=two_hours_later.time(),
            time_slot__start_time__gte=now.time(),
            status__in=['PENDING', 'CONFIRMED']
        ).count()
        
        # 5. Upcoming bookings next 24h
        tomorrow = today + timedelta(days=1)
        upcoming_24h = bookings_qs.filter(
            booking_date__in=[today, tomorrow],
            status__in=['PENDING', 'CONFIRMED']
        ).count()
        
        # 6. Peak hours today (top 3)
        today_bookings = bookings_qs.filter(booking_date=today)
        time_slot_counts = Counter(
            slot.time_slot.start_time for slot in today_bookings if slot.time_slot
        )
        peak_hours = [
            {
                'time': str(time.strftime('%H:%M')),
                'count': count
            }
            for time, count in time_slot_counts.most_common(3)
        ]
        
        # 7. Bookings 7 days (for chart)
        bookings_7days_data = []
        for i in range(6, -1, -1):  # 6 days ago to today
            day_date = today - timedelta(days=i)
            count = bookings_qs.filter(booking_date=day_date).count()
            bookings_7days_data.append({
                'date': day_date.strftime('%Y-%m-%d'),
                'day': day_date.strftime('%a'),
                'count': count
            })
        
        return Response({
            'total_restaurants': total_restaurants,
            'bookings_today': bookings_today,
            'bookings_this_week': bookings_this_week,
            'bookings_pending': bookings_pending,
            'upcoming_bookings_next_2h': upcoming_2h,
            'upcoming_bookings_next_24h': upcoming_24h,
            'peak_hours_today': peak_hours,
            'bookings_7days': bookings_7days_data
        })
