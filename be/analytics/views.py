from rest_framework import viewsets, permissions, status
from rest_framework.response import Response
from rest_framework.decorators import action
from django.db.models import Count, Sum, Avg, Q, Case, When, IntegerField, DateField
from django.db.models.functions import Cast
from bookings.models import Booking
from restaurants.models import Restaurant
from payments.models import Transaction
from django.utils import timezone
from datetime import timedelta

class AnalyticsViewSet(viewsets.ViewSet):
    permission_classes = [permissions.IsAuthenticated]

    @action(detail=False, methods=['get'])
    def partner_dashboard(self, request):
        if request.user.role != 'PARTNER' or not hasattr(request.user, 'partner'):
            return Response({'error': 'Chỉ đối tác mới có quyền xem thống kê.'}, status=status.HTTP_403_FORBIDDEN)
        
        partner = request.user.partner
        restaurant_id = request.query_params.get('restaurant_id')
        time_range = request.query_params.get('time_range', '30days')
        
        if restaurant_id:
            restaurants = Restaurant.objects.filter(partner=partner, id=restaurant_id)
        else:
            restaurants = Restaurant.objects.filter(partner=partner)
            
        restaurant_ids = restaurants.values_list('id', flat=True)
        
        # Tính start_date dựa trên time_range
        now = timezone.now()
        if time_range == '7days':
            days = 7
        elif time_range == 'thisMonth':
            days = now.day  # Từ đầu tháng đến hôm nay
        else:  # 30days (default)
            days = 30
        
        start_date = now - timedelta(days=days)
        prev_start_date = start_date - timedelta(days=days)  # Kỳ trước để so sánh
        
        # === THỐNG KÊ KỲ HIỆN TẠI ===
        bookings = Booking.objects.filter(restaurant_id__in=restaurant_ids, created_at__gte=start_date)
        total_bookings = bookings.count()
        completed_bookings = bookings.filter(status='COMPLETED').count()
        cancelled_bookings = bookings.filter(status='CANCELLED').count()
        
        total_guests = bookings.filter(status='COMPLETED').aggregate(Sum('number_of_guests'))['number_of_guests__sum'] or 0
        
        # Doanh thu cọc gross = tổng deposit_amount từ booking COMPLETED đã thanh toán cọc
        deposit_revenue = bookings.filter(
            status='COMPLETED', is_deposit_paid=True
        ).aggregate(Sum('deposit_amount'))['deposit_amount__sum'] or 0

        # Doanh thu thực nhận (net) = gross - platform fee đã thu trong cùng kỳ
        platform_fees = Transaction.objects.filter(
            transaction_type='PLATFORM_FEE',
            status='SUCCESS',
            booking__restaurant_id__in=restaurant_ids,
            created_at__gte=start_date,
            created_at__lte=now,
        ).aggregate(total=Sum('amount'))['total'] or 0

        partner_net_revenue = deposit_revenue - platform_fees
        
        # === THỐNG KÊ KỲ TRƯỚC (để tính % thay đổi) ===
        prev_bookings = Booking.objects.filter(
            restaurant_id__in=restaurant_ids, 
            created_at__gte=prev_start_date, 
            created_at__lt=start_date
        )
        prev_total = prev_bookings.count()
        prev_completed = prev_bookings.filter(status='COMPLETED').count()
        prev_cancelled = prev_bookings.filter(status='CANCELLED').count()
        prev_guests = prev_bookings.filter(status='COMPLETED').aggregate(Sum('number_of_guests'))['number_of_guests__sum'] or 0
        prev_deposit_revenue = prev_bookings.filter(
            status='COMPLETED', is_deposit_paid=True
        ).aggregate(Sum('deposit_amount'))['deposit_amount__sum'] or 0
        prev_platform_fees = Transaction.objects.filter(
            transaction_type='PLATFORM_FEE',
            status='SUCCESS',
            booking__restaurant_id__in=restaurant_ids,
            created_at__gte=prev_start_date,
            created_at__lt=start_date,
        ).aggregate(total=Sum('amount'))['total'] or 0
        prev_net_revenue = prev_deposit_revenue - prev_platform_fees

        def calc_change(current, previous):
            if previous == 0:
                return 100 if current > 0 else 0
            return round(((current - previous) / previous) * 100, 1)

        # === BIỂU ĐỒ HOẠT ĐỘNG (OPTIMIZED + FIXED) ===
        # Dùng Cast thay cho TruncDate để tránh lỗi None trên MySQL khi thiếu bảng múi giờ
        daily_stats = bookings.annotate(
            day=Cast('created_at', DateField())
        ).values('day').annotate(
            bookings_count=Count('id'),
            guests_count=Sum('number_of_guests'),
            completed_bookings_count=Count('id', filter=Q(status='COMPLETED')),
            completed_guests_count=Sum('number_of_guests', filter=Q(status='COMPLETED'))
        ).order_by('day')

        stats_map = {item['day'].strftime('%d/%m') if item['day'] else '': item for item in daily_stats}
        
        activity_chart = []
        for i in range(days):
            day_obj = (now - timedelta(days=days-1-i)).date()
            date_str = day_obj.strftime('%d/%m')
            day_data = stats_map.get(date_str, {})
            
            activity_chart.append({
                'date': date_str,
                'bookings': day_data.get('bookings_count', 0),
                'guests': day_data.get('guests_count', 0) or 0,
                'completed_bookings': day_data.get('completed_bookings_count', 0),
                'completed_guests': day_data.get('completed_guests_count', 0) or 0,
            })

        # === TỈ LỆ LẤP ĐẦY ===
        time_slots = restaurants.first().time_slots.filter(is_active=True) if restaurants.exists() else []
        occupancy_chart = []
        for slot in time_slots:
            slot_booking_count = Booking.objects.filter(
                time_slot=slot, booking_date__gte=start_date.date(), 
                status__in=['COMPLETED', 'CONFIRMED', 'PENDING']
            ).count()
            rate = min(100, int(((slot_booking_count / max(days, 1)) / max(slot.max_bookings, 1)) * 100))
            occupancy_chart.append({
                'time': slot.start_time.strftime('%H:%M'),
                'rate': rate
            })

        # === NGUỒN ĐẶT BÀN (thực tế: chỉ có 1 kênh App) ===
        booking_source = [
            {'name': 'Nền tảng ĐặtBànĂn', 'value': 100},
        ]

        # === ĐÁNH GIÁ ===
        from reviews.models import Review
        all_reviews = Review.objects.filter(restaurant_id__in=restaurant_ids)
        total_reviews = all_reviews.count()
        avg_rating = restaurants.aggregate(Avg('rating'))['rating__avg'] or 0
        
        five_star_reviews = all_reviews.filter(rating=5).count()
        five_star_ratio = int((five_star_reviews / total_reviews * 100)) if total_reviews > 0 else 0

        # === INSIGHTS ĐỘNG ===
        insights = []
        
        # Insight 1: Khung giờ đông nhất
        if occupancy_chart:
            peak_slot = max(occupancy_chart, key=lambda x: x['rate'])
            if peak_slot['rate'] > 70:
                insights.append({
                    'title': f"Khung giờ {peak_slot['time']} đang rất Hot!",
                    'description': f"Tỉ lệ lấp đầy đạt {peak_slot['rate']}%. Đề xuất tạo \"Combo Tiết Kiệm\" để quay vòng bàn nhanh hơn.",
                    'color': 'orange'
                })

        # Insight 2: Ngày có ít booking
        if cancelled_bookings > total_bookings * 0.2 and total_bookings > 5:
            insights.append({
                'title': 'Tỉ lệ hủy đơn cao',
                'description': f'{cancelled_bookings}/{total_bookings} đơn bị hủy ({int(cancelled_bookings/total_bookings*100)}%). Bạn có muốn tạo Voucher khuyến mãi để giữ chân khách?',
                'color': 'blue'
            })

        # Insight 3: Rating
        if five_star_ratio > 50:
            insights.append({
                'title': 'Đánh giá xuất sắc!',
                'description': f'Nhà hàng có {five_star_ratio}% nhận xét 5 sao. Tiếp tục phát huy chất lượng phục vụ nhé.',
                'color': 'green'
            })
        elif total_reviews > 0 and avg_rating < 3.5:
            insights.append({
                'title': 'Cần cải thiện đánh giá',
                'description': f'Điểm trung bình hiện tại là {round(avg_rating, 1)}/5. Hãy chú trọng chất lượng phục vụ để nâng rating.',
                'color': 'red'
            })

        if not insights:
            insights.append({
                'title': 'Tiếp tục phát triển!',
                'description': 'Dữ liệu còn ít, hãy tiếp tục kinh doanh để có thêm phân tích chi tiết.',
                'color': 'blue'
            })

        no_show_bookings = bookings.filter(status='NO_SHOW').count()
        pending_bookings = bookings.filter(status='PENDING').count()
        confirmed_bookings = bookings.filter(status='CONFIRMED').count()
        conversion_rate = round((completed_bookings / total_bookings * 100), 1) if total_bookings > 0 else 0
        
        total_guests_all = bookings.aggregate(Sum('number_of_guests'))['number_of_guests__sum'] or 0
        avg_guests_per_booking = round((total_guests_all / total_bookings), 1) if total_bookings > 0 else 0
        
        prev_guests_all = prev_bookings.aggregate(Sum('number_of_guests'))['number_of_guests__sum'] or 0
        prev_avg_guests = round((prev_guests_all / prev_total), 1) if prev_total > 0 else 0

        # === BOOKING GẦN NHẤT ===
        recent_bookings_qs = Booking.objects.filter(
            restaurant_id__in=restaurant_ids
        ).select_related('restaurant', 'customer').order_by('-created_at')[:8]
        recent_bookings_data = [
            {
                'id': b.id,
                'restaurant_name': b.restaurant.name,
                'customer_name': getattr(b.customer, 'full_name', None) or str(b.customer),
                'booking_date': b.booking_date.strftime('%d/%m/%Y') if b.booking_date else '',
                'number_of_guests': b.number_of_guests,
                'status': b.status,
            }
            for b in recent_bookings_qs
        ]

        return Response({
            'summary': {
                'total_bookings': total_bookings,
                'completed_bookings': completed_bookings,
                'cancelled_bookings': cancelled_bookings,
                'no_show_bookings': no_show_bookings,
                'pending_bookings': pending_bookings,
                'confirmed_bookings': confirmed_bookings,
                'conversion_rate': conversion_rate,
                'total_guests': total_guests,
                'avg_guests_per_booking': avg_guests_per_booking,
                'deposit_revenue_gross': int(deposit_revenue),
                'platform_fees': int(platform_fees),
                'partner_net_revenue': int(partner_net_revenue),
                'avg_rating': float(round(avg_rating, 1)),
                'total_reviews': total_reviews,
                'five_star_ratio': five_star_ratio,
                'revenue_change': calc_change(partner_net_revenue, prev_net_revenue),
                'bookings_change': calc_change(total_bookings, prev_total),
                'guests_change': calc_change(total_guests, prev_guests),
                'cancelled_change': calc_change(cancelled_bookings, prev_cancelled),
                'avg_guests_change': calc_change(avg_guests_per_booking, prev_avg_guests),
            },
            'charts': {
                'activity': activity_chart,
                'occupancy': occupancy_chart,
                'booking_status': [
                    {'name': 'Hoàn thành', 'value': completed_bookings},
                    {'name': 'Đã hủy', 'value': cancelled_bookings},
                    {'name': 'No-show', 'value': no_show_bookings},
                    {'name': 'Đang xử lý', 'value': pending_bookings + confirmed_bookings},
                ]
            },
            'insights': insights,
            'recent_bookings': recent_bookings_data,
        })

    @action(detail=False, methods=['get'])
    def admin_dashboard(self, request):
        if request.user.role != 'ADMIN':
            return Response({'error': 'Chỉ Quản trị viên mới có quyền xem thống kê này.'}, status=status.HTTP_403_FORBIDDEN)
        
        try:
            from accounts.models import User, Customer, Partner
            from restaurants.models import Restaurant
            from bookings.models import Booking
            from django.db.models import Sum, F, Count as DjCount
            from django.utils import timezone
            from datetime import timedelta
            
            start_date_str = request.query_params.get('start_date')
            end_date_str = request.query_params.get('end_date')
            time_range = request.query_params.get('time_range', '30days')
            now = timezone.now()

            if start_date_str and end_date_str:
                from django.utils.dateparse import parse_date
                s_date = parse_date(start_date_str)
                e_date = parse_date(end_date_str)
                start_date = timezone.make_aware(timezone.datetime.combine(s_date, timezone.datetime.min.time()))
                end_date = timezone.make_aware(timezone.datetime.combine(e_date, timezone.datetime.max.time()))
                days = (end_date.date() - start_date.date()).days + 1
                time_range = 'custom'
            else:
                if time_range == '7days':
                    days = 7
                elif time_range == 'thisMonth':
                    days = now.day
                else:
                    days = 30
                start_date = now - timedelta(days=days)
                end_date = now

            # User Stats
            total_users = User.objects.exclude(role='ADMIN').count()
            total_customers = Customer.objects.count()
            total_partners = Partner.objects.count()
            new_users = User.objects.exclude(role='ADMIN').filter(created_at__gte=start_date, created_at__lte=end_date).count()

            # Restaurant Stats
            total_restaurants = Restaurant.objects.count()
            pending_restaurants = Restaurant.objects.filter(status='PENDING').count()

            # Booking Stats
            period_bookings = Booking.objects.filter(created_at__gte=start_date, created_at__lte=end_date)
            total_bookings_alltime = Booking.objects.count()
            new_bookings = period_bookings.count()
            completed_bookings = period_bookings.filter(status='COMPLETED').count()
            cancelled_bookings = period_bookings.filter(status='CANCELLED').count()
            pending_bookings  = period_bookings.filter(status='PENDING').count()
            confirmed_bookings = period_bookings.filter(status='CONFIRMED').count()

            # Guest Stats (only from COMPLETED bookings = actual served guests)
            total_guests_period = (
                period_bookings.filter(status='COMPLETED')
                .aggregate(total=Sum('number_of_guests'))['total'] or 0
            )
            total_guests_alltime = (
                Booking.objects.filter(status='COMPLETED')
                .aggregate(total=Sum('number_of_guests'))['total'] or 0
            )

            # Activity Chart: Bookings + Guests per day (OPTIMIZED + FIXED)
            daily_stats = period_bookings.annotate(
                day=Cast('created_at', DateField())
            ).values('day').annotate(
                bookings_count=Count('id'),
                guests_count=Sum('number_of_guests'),
                completed_bookings_count=Count('id', filter=Q(status='COMPLETED')),
                completed_guests_count=Sum('number_of_guests', filter=Q(status='COMPLETED'))
            ).order_by('day')

            stats_map = {item['day'].strftime('%d/%m') if item['day'] else '': item for item in daily_stats}

            activity_chart = []
            for i in range(days):
                day_obj = (start_date + timedelta(days=i)).date()
                date_str = day_obj.strftime('%d/%m')
                day_data = stats_map.get(date_str, {})
                activity_chart.append({
                    'date': date_str,
                    'bookings': day_data.get('bookings_count', 0),
                    'guests': day_data.get('guests_count', 0) or 0,
                    'completed_bookings': day_data.get('completed_bookings_count', 0),
                    'completed_guests': day_data.get('completed_guests_count', 0) or 0,
                })

            # Booking status breakdown
            booking_status_chart = [
                {'name': 'Hoàn thành',   'value': completed_bookings},
                {'name': 'Đã hủy',       'value': cancelled_bookings},
                {'name': 'Chờ xác nhận', 'value': pending_bookings},
                {'name': 'Đã xác nhận', 'value': confirmed_bookings},
            ]

            # Top locations by booking count
            top_locations = (
                period_bookings
                .filter(restaurant__location__isnull=False)
                .values(city=F('restaurant__location__city'))
                .annotate(total=DjCount('id'))
                .order_by('-total')[:10]
            )
            top_locations_data = [{'name': item['city'], 'value': item['total']} for item in top_locations]

            # Top restaurants by booking count
            top_restaurants = (
                period_bookings
                .values(name=F('restaurant__name'), r_id=F('restaurant__id'))
                .annotate(total=DjCount('id'))
                .order_by('-total')[:10]
            )
            top_restaurants_data = [
                {'name': item['name'], 'id': item['r_id'], 'value': item['total']}
                for item in top_restaurants
            ]

            # Top cuisine types by booking count
            top_cuisines = (
                period_bookings
                .filter(restaurant__cuisine_type__isnull=False)
                .exclude(restaurant__cuisine_type='')
                .values(cuisine=F('restaurant__cuisine_type'))
                .annotate(total=DjCount('id'))
                .order_by('-total')[:10]
            )
            top_cuisines_data = [{'name': item['cuisine'], 'value': item['total']} for item in top_cuisines]

            # Group size distribution (how many guests per booking)
            size_ranges = [
                ('1-2 người', 1, 2),
                ('3-5 người', 3, 5),
                ('6-9 người', 6, 9),
                ('10+ người', 10, 9999),
            ]
            guest_size_dist = []
            for label, lo, hi in size_ranges:
                count = period_bookings.filter(
                    number_of_guests__gte=lo,
                    number_of_guests__lte=hi
                ).count()
                guest_size_dist.append({'name': label, 'value': count})

            # Recent Partners
            recent_partners = Partner.objects.order_by('-user__created_at')[:5]
            recent_partners_data = [
                {
                    'id': p.pk,
                    'business_name': p.business_name,
                    'phone': p.user.phone_number,
                    'status': p.status,
                    'joined': p.user.created_at.strftime('%d/%m/%Y') if p.user.created_at else 'N/A',
                }
                for p in recent_partners
            ]

            return Response({
                'summary': {
                    'total_users': total_users,
                    'total_customers': total_customers,
                    'total_partners': total_partners,
                    'new_users': new_users,
                    'total_restaurants': total_restaurants,
                    'pending_restaurants': pending_restaurants,
                    'total_bookings_alltime': total_bookings_alltime,
                    'new_bookings_period': new_bookings,
                    'completed_bookings_period': completed_bookings,
                    'cancelled_bookings_period': cancelled_bookings,
                    'total_guests_period': total_guests_period,
                    'total_guests_alltime': total_guests_alltime,
                },
                'charts': {
                    'activity': activity_chart,
                    'booking_status': booking_status_chart,
                },
                'rankings': {
                    'top_locations': top_locations_data,
                    'top_restaurants': top_restaurants_data,
                    'top_cuisines': top_cuisines_data,
                    'guest_size_dist': guest_size_dist,
                },
                'recent_partners': recent_partners_data,
            })
        except Exception as e:
            import traceback
            tb = traceback.format_exc()
            print(f"[admin_dashboard ERROR] {e}\n{tb}")
            return Response({
                'error': str(e),
                'traceback': tb
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

