# restaurants/views.py
from rest_framework import viewsets, status, filters
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser
from rest_framework.pagination import PageNumberPagination
from django.db.models import Q
from django_filters.rest_framework import DjangoFilterBackend

from .models import Location, Restaurant, RestaurantImage, MenuItem, TimeSlot, CuisineAlias, TimeSlotOverride, RestaurantViewHistory
from .serializers import (
    LocationSerializer,
    RestaurantListSerializer,
    RestaurantCardSerializer,
    RestaurantDetailSerializer,
    RestaurantCreateUpdateSerializer,
    RestaurantImageSerializer,
    MenuItemSerializer,
    MenuItemCreateUpdateSerializer,
    TimeSlotSerializer,
    TimeSlotAvailabilitySerializer,
    RestaurantReportSerializer,
    TimeSlotOverrideSerializer,
    RestaurantViewHistorySerializer,
    CuisineAliasSerializer
)
from .permissions import IsPartnerOwner, IsActivePartner, IsPartnerOrReadOnly


class RestaurantPagination(PageNumberPagination):
    page_size_query_param = 'page_size'
    max_page_size = 50


class LocationViewSet(viewsets.ModelViewSet):
    """
    API endpoint cho Location
    - GET: Public
    - POST/PUT/DELETE: Admin hoặc Partner
    """
    queryset = Location.objects.all()
    serializer_class = LocationSerializer

    def get_permissions(self):
        if self.action in ['list', 'retrieve']:
            return [AllowAny()]
        return [IsAuthenticated()]

    def create(self, request, *args, **kwargs):
        # Admin hoặc Partner mới tạo được location
        if not request.user.is_authenticated:
            return Response(
                {'error': 'Authentication required'},
                status=status.HTTP_401_UNAUTHORIZED
            )

        if getattr(request.user, 'role', None) not in ['ADMIN', 'PARTNER']:
            return Response(
                {'error': 'Only admin or partner can create locations'},
                status=status.HTTP_403_FORBIDDEN
            )

        return super().create(request, *args, **kwargs)


class RestaurantViewSet(viewsets.ModelViewSet):
    """
    API endpoint cho Restaurant
    - Public/Customer: chỉ xem APPROVED
    - Partner:
        + /restaurants/: thấy nhà hàng của mình (mọi trạng thái) + APPROVED của người khác
        + /restaurants/my-restaurants/: chỉ nhà hàng của mình (mọi trạng thái) -> dùng cho trang quản lý
    - Admin: xem tất cả
    """
    queryset = Restaurant.objects.all()
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['location', 'status']
    search_fields = ['name', 'description', 'address']
    ordering_fields = ['rating', 'created_at']
    ordering = ['-rating']
    pagination_class = RestaurantPagination

    def get_permissions(self):
        """Phân quyền cho từng action"""
        # Public cho xem danh sách / detail / available-slots / search / top-rated / autocomplete-data / smart-search
        if self.action in ['list', 'retrieve', 'available_slots', 'search', 'top_rated', 'autocomplete_data', 'smart_search']:
            return [AllowAny()]
        
        # Tạo nhà hàng: Partner ACTIVE
        elif self.action == 'create':
            return [IsAuthenticated(), IsActivePartner()]
        
        # My restaurants, favorites, toggle-favorite, report, record_view, view_history: cần đăng nhập
        elif self.action in ['my_restaurants', 'toggle_favorite', 'favorites', 'report', 'record_view', 'view_history']:
            return [IsAuthenticated()]
        
        # Các action khác: update/delete...
        else:
            return [IsAuthenticated(), IsPartnerOwner()]

    def get_serializer_class(self):
        """Chọn serializer phù hợp với action"""
        if self.action in ['list', 'search', 'top_rated']:
            return RestaurantCardSerializer
        elif self.action in ['create', 'update', 'partial_update']:
            return RestaurantCreateUpdateSerializer
        return RestaurantDetailSerializer

    @action(detail=True, methods=['post'], permission_classes=[IsAuthenticated])
    def report(self, request, pk=None):
        """Khách hàng báo cáo nhà hàng"""
        restaurant = self.get_object()
        serializer = RestaurantReportSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        serializer.save(user=request.user, restaurant=restaurant)
        return Response({'message': 'Báo cáo của bạn đã được ghi nhận. Cảm ơn bạn!'}, status=status.HTTP_201_CREATED)

    def get_queryset(self):
        """
        GET /api/restaurants/restaurants/ (endpoint gốc)
        - Public: chỉ thấy APPROVED
        - Customer: chỉ thấy APPROVED
        - Partner: thấy nhà hàng của mình (mọi trạng thái) + APPROVED của người khác
        - Admin: thấy tất cả
        """
        queryset = Restaurant.objects.all().select_related(
            'location', 
            'partner__user'
        ).prefetch_related('images')

        # Detail view cần thêm menu_items + time_slots; list/search chỉ cần images
        if self.action in ('retrieve',):
            queryset = queryset.prefetch_related('menu_items', 'time_slots')
        user = self.request.user

        # Chưa đăng nhập -> chỉ APPROVED
        if not user.is_authenticated:
            return queryset.filter(status='APPROVED')

        role = getattr(user, "role", None)

        # Admin thấy tất cả
        if role == 'ADMIN':
            return queryset

        # Partner: nhà hàng của mình + APPROVED của người khác
        if role == 'PARTNER':
            return queryset.filter(
                Q(partner__user=user) | Q(status='APPROVED')
            )

        # Customer: chỉ APPROVED
        return queryset.filter(status='APPROVED')

    def perform_create(self, serializer):
        """Tự động gán partner hiện tại khi tạo nhà hàng"""
        partner = self.request.user.partner
        serializer.save(partner=partner, status='PENDING')

    def create(self, request, *args, **kwargs):
        """
        POST /api/restaurants/restaurants/
        Tạo nhà hàng mới (status = PENDING)
        """
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        self.perform_create(serializer)

        # Return detail serializer
        instance = serializer.instance
        detail_serializer = RestaurantDetailSerializer(instance)

        return Response(
            {
                'message': 'Restaurant created successfully. Waiting for admin approval.',
                'data': detail_serializer.data
            },
            status=status.HTTP_201_CREATED
        )

    @action(
        detail=False,
        methods=['get'],
        url_path='my-restaurants'
    )
    def my_restaurants(self, request):
        """
        GET /api/restaurants/restaurants/my-restaurants/
        Dùng cho trang quản lý của Partner:
        - Partner: chỉ nhà hàng của mình (mọi trạng thái: PENDING, APPROVED, REJECTED...)
        - Admin: thấy tất cả
        """
        user = request.user
        role = getattr(user, "role", None)

        if role == 'ADMIN':
            restaurants = Restaurant.objects.all()
        elif role == 'PARTNER':
            restaurants = Restaurant.objects.filter(partner__user=user)
        else:
            return Response(
                {'error': 'Only partners and admins can access this endpoint'},
                status=status.HTTP_403_FORBIDDEN
            )

        # Sắp xếp theo thời gian tạo mới nhất
        restaurants = restaurants.order_by('-created_at')
                
        serializer = self.get_serializer(restaurants, many=True)
        return Response(serializer.data)

    @action(
        detail=True,
        methods=['post'],
        permission_classes=[IsAuthenticated],
        url_path='admin-action'
    )
    def admin_action(self, request, pk=None):
        """
        POST /api/restaurants/restaurants/<id>/admin-action/
        action_type = approve | reject | suspend
        """
        if request.user.role != 'ADMIN':
            return Response({'error': 'Forbidden'}, status=status.HTTP_403_FORBIDDEN)
            
        action_type = request.data.get('action_type')
        restaurant = self.get_object()
        
        if action_type == 'approve':
            restaurant.status = 'APPROVED'
            msg = 'Nhà hàng đã được duyệt'
        elif action_type == 'reject':
            restaurant.status = 'REJECTED'
            msg = 'Đã từ chối nhà hàng'
        elif action_type == 'suspend':
            restaurant.status = 'SUSPENDED'
            msg = 'Nhà hàng đã bị tạm ngưng'
        else:
            return Response({'error': 'action_type (approve, reject, suspend) required'}, status=status.HTTP_400_BAD_REQUEST)
            
        restaurant.save()
        return Response({'message': msg, 'status': restaurant.status})

    @action(
        detail=False,
        methods=['get'],
        permission_classes=[AllowAny],
        url_path='top-rated'
    )
    def top_rated(self, request):
        """
        GET /api/restaurants/restaurants/top-rated/?limit=4
        Trả về top nhà hàng có điểm đánh giá cao nhất (đang APPROVED).
        """
        limit = request.query_params.get('limit', '4')
        try:
            limit = int(limit)
        except ValueError:
            limit = 4
            
        queryset = self.get_queryset().filter(status='APPROVED').order_by('-rating')[:limit]
        serializer = RestaurantCardSerializer(queryset, many=True, context={'request': request})
        return Response(serializer.data)

    @action(
        detail=False,
        methods=['get'],
        permission_classes=[AllowAny],
        url_path='search'
    )
    def search(self, request):
        """
        GET /api/restaurants/restaurants/search/

        Params:
          city, district, ward     — lọc theo địa điểm (auto-strip prefix)
          cuisine                  — loại ẩm thực (icontains)
          query                    — tìm tên nhà hàng / món ăn (có fuzzy fallback)
          min_rating               — float, lọc rating >= value
          high_rating              — true => chỉ nhà hàng đánh giá >= 4.0
          price_range              — BUDGET | MEDIUM | PREMIUM (multi: BUDGET,MEDIUM)
                                     Lọc theo trường restaurants.price_range trong DB
          sort_by                  — rating_desc | rating_asc | newest | price_asc | price_desc
          collection_id            — filter by collection
        """
        import re

        city         = request.query_params.get('city', '').strip()
        district     = request.query_params.get('district', '').strip()
        ward         = request.query_params.get('ward', '').strip()
        city_code    = request.query_params.get('city_code', '').strip()
        district_code= request.query_params.get('district_code', '').strip()
        ward_code    = request.query_params.get('ward_code', '').strip()
        cuisine      = request.query_params.get('cuisine', '').strip()
        query        = request.query_params.get('query', '').strip()
        min_rating   = request.query_params.get('min_rating')
        high_rating  = request.query_params.get('high_rating', '').lower() == 'true'
        sort_by      = request.query_params.get('sort_by', 'rating_desc')
        collection_id= request.query_params.get('collection_id', '').strip()
        
        # ── Lấy tọa độ & địa chỉ để chấm điểm (Ưu tiên Param > DB) ───────────
        lat = request.query_params.get('lat')
        lng = request.query_params.get('lng')
        rank_city = city
        rank_dist = district
        
        if request.user.is_authenticated:
            if not (lat and lng) and request.user.last_latitude and request.user.last_longitude:
                lat = request.user.last_latitude
                lng = request.user.last_longitude
            if not rank_city: rank_city = request.user.last_city
            if not rank_dist: rank_dist = request.user.last_district
        
        
        price_range  = request.query_params.get('price_range', '').strip()

        # ── Helper: strip location prefix ─────────────────────────────────────
        # "Thành phố Hồ Chí Minh" → "Hồ Chí Minh" để icontains match dc cả 2 dạng
        def strip_loc_prefix(name):
            if not name or not isinstance(name, str):
                return ""
            return re.sub(
                r'^(Thành phố |Tỉnh |TP\.\s*|Quận |Huyện |Thị xã |Phường |Xã |Thị trấn )',
                '', name
            ).strip()

        queryset = self.get_queryset().filter(status='APPROVED')

        # ── Collection ────────────────────────────────────────────────────────
        if collection_id and collection_id.isdigit():
            queryset = queryset.filter(collectionitem__collection_id=collection_id)

        # ── Location (Mã vùng HOẶC Tên tương đối) ─────────────────────────────
        if city_code:
            core = strip_loc_prefix(city)
            q_city = Q(location__province_code=city_code)
            if core:
                q_city |= Q(location__city__icontains=core)
            queryset = queryset.filter(q_city)
        elif city:
            core = strip_loc_prefix(city)
            if core:
                queryset = queryset.filter(location__city__icontains=core)

        if district_code:
            core = strip_loc_prefix(district)
            q_district = Q(location__district_code=district_code)
            if core:
                q_district |= Q(location__district__icontains=core)
            queryset = queryset.filter(q_district)
        elif district:
            core = strip_loc_prefix(district)
            if core:
                queryset = queryset.filter(location__district__icontains=core)

        if ward_code:
            core = strip_loc_prefix(ward)
            q_ward = Q(location__ward_code=ward_code)
            if core:
                q_ward |= Q(location__ward__icontains=core)
            queryset = queryset.filter(q_ward)
        elif ward:
            core = strip_loc_prefix(ward)
            if core:
                queryset = queryset.filter(location__ward__icontains=core)

        # ── Cuisine ───────────────────────────────────────────────────────────
        if cuisine:
            cuisine_input = cuisine.strip().lower()
            q_cuisine = Q(cuisine_type__icontains=cuisine) | Q(menu_items__name__icontains=cuisine)

            from django.core.cache import cache
            cache_key = 'cuisine_aliases_grouped_v1'
            alias_groups = cache.get(cache_key)
            if alias_groups is None:
                alias_groups = {}
                alias_qs = CuisineAlias.objects.filter(is_active=True).values(
                    'canonical_name', 'alias', 'match_target'
                )
                for item in alias_qs:
                    canonical = (item['canonical_name'] or '').strip().lower()
                    alias = (item['alias'] or '').strip().lower()
                    target = item['match_target']
                    if not canonical or not alias:
                        continue
                    alias_groups.setdefault(canonical, {'CUISINE': set(), 'DISH': set()})
                    alias_groups[canonical][target].add(alias)
                cache.set(cache_key, alias_groups, timeout=60 * 30)

            for canonical, targets in alias_groups.items():
                if cuisine_input == canonical or cuisine_input in canonical or canonical in cuisine_input:
                    for kw in targets.get('CUISINE', set()):
                        q_cuisine |= Q(cuisine_type__icontains=kw)
                    for kw in targets.get('DISH', set()):
                        q_cuisine |= (
                            Q(menu_items__name__icontains=kw) |
                            Q(menu_items__category__icontains=kw)
                        )

            queryset = queryset.filter(q_cuisine).distinct()

        # ── Annotate numeric_price để hỗ trợ lọc và sắp xếp dạng số ──
        from django.db.models import Case, When, Value, IntegerField
        from django.db.models.functions import Cast

        queryset = queryset.annotate(
            numeric_price=Case(
                When(price_range='BUDGET', then=Value(50000)),
                When(price_range='MEDIUM', then=Value(200000)),
                When(price_range='PREMIUM', then=Value(500000)),
                When(price_range__regex=r'^[0-9]+$', then=Cast('price_range', output_field=IntegerField())),
                default=Value(0),
                output_field=IntegerField(),
            )
        )

        # ── Price range filter (Áp dụng theo khoảng giá số) ──
        if price_range:
            values = [v.strip().upper() for v in price_range.split(',') if v.strip()]
            q_price = Q()
            if 'BUDGET' in values:
                # Dưới 100k (lớn hơn 0 để bỏ qua các record lỗi/null)
                q_price |= Q(numeric_price__gt=0, numeric_price__lt=100000)
            if 'MEDIUM' in values:
                # Từ 100k đến 300k
                q_price |= Q(numeric_price__gte=100000, numeric_price__lte=300000)
            if 'PREMIUM' in values:
                # Trên 300k
                q_price |= Q(numeric_price__gt=300000)
                
            if q_price:
                queryset = queryset.filter(q_price)

        # ── High rating toggle ────────────────────────────────────────────────
        if high_rating:
            queryset = queryset.filter(rating__gte=4.0)

        # ── Min rating ────────────────────────────────────────────────────────
        if min_rating:
            try:
                queryset = queryset.filter(rating__gte=float(min_rating))
            except ValueError:
                pass

        # Mặc định: Đánh giá cao -> Mới nhất
        is_geo_available = bool(lat and lng)
        default_sort = ['-rating', '-created_at']
        
        if is_geo_available or rank_city:
            try:
                from django.db.models import FloatField, ExpressionWrapper, Case, When, Value, IntegerField
                from django.db.models.functions import Cast
                
                # Ưu tiên cùng Thành phố/Quận (Dùng rank_city đã bốc từ DB/Param)
                user_city_normalized = strip_loc_prefix(rank_city)
                
                # Ưu tiên đúng loại món (Cuisine)
                cuisine_query = cuisine or query
                
                queryset = queryset.annotate(
                    city_priority=Case(
                        When(location__city__icontains=user_city_normalized, then=Value(1)) if user_city_normalized else When(pk=None, then=Value(0)),
                        default=Value(0),
                        output_field=IntegerField()
                    ),
                    cuisine_priority=Case(
                        When(cuisine_type__icontains=cuisine_query, then=Value(1)) if cuisine_query else When(pk=None, then=Value(0)),
                        default=Value(0),
                        output_field=IntegerField()
                    )
                )
                
                if is_geo_available:
                    u_lat = float(lat)
                    u_lng = float(lng)
                    queryset = queryset.annotate(
                        dist_sq=ExpressionWrapper(
                            (Cast('latitude', FloatField()) - u_lat)**2 + 
                            (Cast('longitude', FloatField()) - u_lng)**2,
                            output_field=FloatField()
                        )
                    )
                    # Sắp xếp: Đúng món -> Cùng khu vực -> Gần nhất -> Đánh giá cao
                    default_sort = ['-cuisine_priority', '-city_priority', 'dist_sq', '-rating']
                else:
                    # Chỉ có Tỉnh -> Sắp xếp: Đúng món -> Theo Tỉnh -> Đánh giá cao
                    default_sort = ['-cuisine_priority', '-city_priority', '-rating']
            except Exception as e:
                print(f"DEBUG RANKING ERROR: {str(e)}")
                pass

        order_by_args = default_sort
        if sort_by == 'rating_desc':
            order_by_args = ['-rating', '-created_at']
        elif sort_by == 'rating_asc':
            order_by_args = ['rating', '-created_at']
        elif sort_by == 'newest':
            order_by_args = ['-created_at']
        elif sort_by == 'price_asc':
            order_by_args = ['numeric_price', '-rating']
        elif sort_by == 'price_desc':
            order_by_args = ['-numeric_price', '-rating']
        elif sort_by == 'near_me' and lat and lng:
            # Đã xử lý annotate ở phần default_sort
            order_by_args = ['dist_sq', '-rating']

        # ── Text query (DB match + fuzzy fallback) ────────────────────────────
        if query:
            db_matches = queryset.filter(
                Q(name__icontains=query) |
                Q(menu_items__name__icontains=query) |
                Q(cuisine_type__icontains=query) |
                Q(address__icontains=query)
            ).distinct()

            if db_matches.count() >= 3:
                results = db_matches.order_by(*order_by_args)
            else:
                try:
                    from rapidfuzz import fuzz
                    limited_qs = list(queryset.order_by(*order_by_args)[:200])
                    scored = [
                        (r, fuzz.token_set_ratio(query.lower(), r.name.lower()))
                        for r in limited_qs
                    ]
                    scored = [(r, s) for r, s in scored if s >= 60]
                    scored.sort(key=lambda x: x[1], reverse=True)
                    results = [r for r, _ in scored]
                except ImportError:
                    results = db_matches.order_by(*order_by_args)
        else:
            results = queryset.order_by(*order_by_args)

        # ── Paginate ──────────────────────────────────────────────────────────
        page = self.paginate_queryset(results)
        if page is not None:
            serializer = RestaurantCardSerializer(page, many=True, context={'request': request})
            return self.get_paginated_response(serializer.data)

        # Serialize results
        serializer = RestaurantCardSerializer(results, many=True, context={'request': request})
        data = serializer.data
        
        return Response({'count': totalCount, 'results': data})


    @action(
        detail=True,
        methods=['get'],
        permission_classes=[AllowAny],
        url_path='available-slots'
    )
    def available_slots(self, request, pk=None):
        """
        GET /api/restaurants/restaurants/{id}/available-slots/?date=2025-01-20
        Trả về danh sách time slots còn trống cho ngày cụ thể
        """
        restaurant = self.get_object()
        date_str = request.query_params.get('date')

        if not date_str:
            return Response(
                {'error': 'Date parameter is required'},
                status=status.HTTP_400_BAD_REQUEST
            )

        from datetime import datetime
        try:
            date = datetime.strptime(date_str, '%Y-%m-%d').date()
        except ValueError:
            return Response(
                {'error': 'Invalid date format. Use YYYY-MM-DD'},
                status=status.HTTP_400_BAD_REQUEST
            )

        available_slots = restaurant.get_available_slots(date)
        serializer = TimeSlotSerializer(available_slots, many=True)

        return Response({
            'date': date_str,
            'available_slots': serializer.data
        })

    @action(
        detail=True,
        methods=['post'],
        permission_classes=[IsAuthenticated],
        url_path='toggle-favorite'
    )
    def toggle_favorite(self, request, pk=None):
        """Toggle favorite status for a restaurant"""
        restaurant = self.get_object()
        from .models import FavoriteRestaurant
        
        fav, created = FavoriteRestaurant.objects.get_or_create(
            user=request.user, 
            restaurant=restaurant
        )
        
        if not created:
            fav.delete()
            return Response({'status': 'unfavorited', 'message': 'Đã huỷ yêu thích nhà hàng'})
            
        return Response({'status': 'favorited', 'message': 'Đã thêm vào danh sách yêu thích'})

    @action(
        detail=True,
        methods=['post'],
        permission_classes=[IsAuthenticated],
        url_path='record-view'
    )
    def record_view(self, request, pk=None):
        """Lưu hoặc cập nhật lịch sử xem nhà hàng cho user"""
        restaurant = self.get_object()
        # get_or_create và sau đó save() để trigger auto_now (viewed_at)
        obj, created = RestaurantViewHistory.objects.get_or_create(
            user=request.user,
            restaurant=restaurant
        )
        if not created:
            obj.save() # Cập nhật viewed_at
            
        return Response({'status': 'success'})

    @action(
        detail=False,
        methods=['get'],
        permission_classes=[IsAuthenticated],
        url_path='view-history'
    )
    def view_history(self, request):
        """Lấy lịch sử xem nhà hàng của user"""
        history = RestaurantViewHistory.objects.filter(user=request.user).select_related('restaurant').prefetch_related('restaurant__images', 'restaurant__location')
        
        # Paginate results
        page = self.paginate_queryset(history)
        if page is not None:
            serializer = RestaurantViewHistorySerializer(page, many=True, context={'request': request})
            return self.get_paginated_response(serializer.data)

        serializer = RestaurantViewHistorySerializer(history, many=True, context={'request': request})
        return Response(serializer.data)

    @action(
        detail=False,
        methods=['get'],
        permission_classes=[IsAuthenticated],
        url_path='favorites'
    )
    def favorites(self, request):
        """Lấy danh sách nhà hàng yêu thích của user"""
        from .models import FavoriteRestaurant
        
        # Tìm tất cả FavoriteRestaurant của user này, prefetch restaurant để tránh N+1
        favs = FavoriteRestaurant.objects.filter(user=request.user).select_related('restaurant')
        restaurant_ids = [fav.restaurant_id for fav in favs]
        
        # Lấy queryset chuẩn (đã filter APPROVED, prefetch, select_related)
        queryset = self.get_queryset().filter(id__in=restaurant_ids, status='APPROVED')
        
        page = self.paginate_queryset(queryset)
        if page is not None:
            serializer = RestaurantCardSerializer(page, many=True, context={'request': request})
            return self.get_paginated_response(serializer.data)

        serializer = RestaurantCardSerializer(queryset, many=True, context={'request': request})
        return Response(serializer.data)

    @action(
        detail=False,
        methods=['get'],
        permission_classes=[AllowAny],
        url_path='autocomplete-data'
    )
    def autocomplete_data(self, request):
        """
        GET /api/restaurants/restaurants/autocomplete-data/
        Trả về danh sách tối giản (nhà hàng & món ăn) để Frontend dùng Fuse.js.
        """
        from django.core.cache import cache
        cache_key = "fe_autocomplete_data_v1"
        cached_data = cache.get(cache_key)
        
        if cached_data is not None:
            # We skip request.build_absolute_uri for cached data if using local storage
            return Response(cached_data)

        restaurants = Restaurant.objects.filter(status='APPROVED').prefetch_related('images')
        dishes = MenuItem.objects.filter(is_available=True, restaurant__status='APPROVED').select_related('restaurant')
        
        data = []
        for r in restaurants:
            image_url = None
            first_img = r.images.first()
            if first_img and hasattr(first_img, 'image') and first_img.image:
                try:
                    image_url = request.build_absolute_uri(first_img.image.url)
                except Exception:
                    pass
                    
            data.append({
                "id": f"r_{r.id}",
                "type": "restaurant",
                "name": r.name,
                "restaurant_id": r.id,
                "subtitle": r.address,
                "rating": float(r.rating) if r.rating else None,
                "image_url": image_url
            })
            
        for d in dishes:
            data.append({
                "id": f"d_{d.id}",
                "type": "dish",
                "name": d.name,
                "restaurant_id": d.restaurant_id,
                "dish_id": d.id,
                "subtitle": d.restaurant.name
            })
            
        cache.set(cache_key, data, timeout=60 * 30) # Cache 30 mins
        return Response(data)

    @action(
        detail=False,
        methods=['get'],
        permission_classes=[AllowAny],
        url_path='smart-search'
    )
    def smart_search(self, request):
        """
        GET /api/restaurants/restaurants/smart-search/?q=<query>&top_n=5

        Hybrid search: BM25 (keyword) + Vector (semantic) → RRF Fusion → Personalized Ranking.

        Params:
          q       — câu hỏi tự nhiên (bắt buộc)
          top_n   — số lượng kết quả trả về (mặc định 5, tối đa 10)
          city    — lọc theo thành phố (optional)
          district— lọc theo quận (optional)

        Response:
          {
            query_info: { original, price_hint, group_size },
            mode: 'hybrid' | 'bm25_only',
            results: [{ id, name, cuisine_type, rating, price_range, thumbnail,
                        reason, match_type, location }, ...]
          }
        """
        import time
        t0 = time.time()

        from .search.bm25_engine import bm25_search, extract_price_hint, extract_group_size
        from .search.vector_engine import vector_search
        from .search.fusion import reciprocal_rank_fusion
        from .search.personalize import personalized_rerank
        from .serializers import RestaurantCardSerializer

        query = request.query_params.get('q', '').strip()
        if not query:
            return Response(
                {'error': 'Tham số q (câu hỏi) là bắt buộc'},
                status=status.HTTP_400_BAD_REQUEST
            )

        try:
            top_n = min(int(request.query_params.get('top_n', 5)), 10)
        except (ValueError, TypeError):
            top_n = 5

        city     = request.query_params.get('city', '').strip()
        district = request.query_params.get('district', '').strip()

        # Lấy thông tin GPS từ query params nếu có, nếu không lấy từ DB
        user_lat = request.query_params.get('lat')
        user_lon = request.query_params.get('lng')
        
        # Lấy thông tin GPS & địa chỉ để chấm điểm
        user_lat = request.query_params.get('lat')
        user_lon = request.query_params.get('lng')
        rank_city = city
        rank_dist = district
        
        if request.user.is_authenticated:
            if not (user_lat and user_lon) and request.user.last_latitude and request.user.last_longitude:
                user_lat = request.user.last_latitude
                user_lon = request.user.last_longitude
            if not rank_city: rank_city = request.user.last_city
            if not rank_dist: rank_dist = request.user.last_district

        if user_lat: user_lat = float(user_lat)
        if user_lon: user_lon = float(user_lon)

        user_id = request.user.id if request.user.is_authenticated else None
        from .search.personalize import get_user_profile
        user_profile = get_user_profile(user_id) if user_id else None

        # ── 1. Extract intent từ query ─────────────────────────────────────────
        price_hint  = extract_price_hint(query)
        group_size  = extract_group_size(query)

        # ── 2. BM25 search (luôn chạy) ────────────────────────────────────────
        bm25_results = bm25_search(query, top_k=30)

        # ── 3. Vector search (v2: có personalization ngay từ bước embed) ──────
        vec_results = vector_search(query, top_k=30, user_profile=user_profile, city_filter=city)
        mode = 'hybrid' if vec_results else 'bm25_only'

        # ── 4. RRF Fusion (v2: tích hợp geo pre-filter ngay tại đây) ──────────
        candidates = reciprocal_rank_fusion(
            bm25_results=bm25_results,
            vector_results=vec_results,
            query=query,
            top_k=30,
            city_filter=city,
            district_filter=district
        )

        # ── 5. Personalized re-ranking (v2: hỗ trợ haversine distance) ────────
        top_results = personalized_rerank(
            candidates=candidates,
            user_id=user_id,
            price_hint=price_hint,
            current_city=rank_city,
            current_district=rank_dist,
            user_lat=user_lat,
            user_lon=user_lon,
            top_n=top_n,
        )

        # ── 7. Serialize & Split ──────────────────────────────────────────────
        def _get_thumbnail(restaurant):
            first = restaurant.images.first()
            if first and first.image:
                try:
                    return request.build_absolute_uri(first.image.url)
                except Exception:
                    pass
            return None

        def _format_res(item):
            r = item['restaurant']
            return {
                'id': r.id,
                'name': r.name,
                'cuisine_type': r.cuisine_type,
                'address': r.address,
                'rating': float(r.rating or 0),
                'price_range': r.price_range,
                'opening_hours': r.opening_hours,
                'thumbnail': _get_thumbnail(r),
                'location': {
                    'city': r.location.city if r.location else None,
                    'district': r.location.district if r.location else None,
                    'ward': r.location.ward if r.location else None,
                } if r.location else None,
                'reason': item.get('reason', ''),
                'match_type': item.get('match_type', ''),
                'final_score': round(item.get('final_score', 0), 4),
                'distance': item.get('distance_km'),
            }

        # ── 7. Phân tách theo ngưỡng điểm (Threshold = 1.0) ───────────────────
        all_formatted = [_format_res(item) for item in top_results]
        recommendations = [r for r in all_formatted if r['final_score'] >= 1.0]
        others = [r for r in all_formatted if r['final_score'] < 1.0]

        # Nếu top_results quá ít, lấy thêm từ candidates ban đầu
        top_ids = {item['restaurant'].id for item in top_results}
        for entry in candidates:
            if entry['restaurant'].id not in top_ids:
                others.append(_format_res({**entry, 'final_score': 0}))
            if len(others) >= 20: 
                break

        elapsed = round((time.time() - t0) * 1000)

        return Response({
            'query_info': {
                'original': query,
                'price_hint': price_hint,
                'group_size': group_size,
                'mode': mode,
                'elapsed_ms': elapsed,
            },
            'total_candidates': len(candidates),
            'recommendations': recommendations,
            'other_results': others,
        })


class RestaurantImageViewSet(viewsets.ModelViewSet):
    """
    API endpoint cho Restaurant Images
    - GET: Public
    - POST/PUT/DELETE: Partner owner hoặc Admin
    """
    queryset = RestaurantImage.objects.all()
    serializer_class = RestaurantImageSerializer
    permission_classes = [IsPartnerOrReadOnly, IsPartnerOwner]
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    def get_queryset(self):
        queryset = super().get_queryset()
        restaurant_id = self.request.query_params.get('restaurant_id')
        if restaurant_id:
            queryset = queryset.filter(restaurant_id=restaurant_id)
        return queryset

    @action(detail=False, methods=['post'], permission_classes=[IsAuthenticated])
    def upload(self, request):
        """
        POST /api/restaurants/images/upload/
        Upload ảnh nhà hàng

        Form-data:
        - image: File (required)
        - restaurant_id: int (required)
        - display_order: int (optional, default=0)
        """
        image_file = request.FILES.get('image')
        restaurant_id = request.data.get('restaurant_id')
        display_order = request.data.get('display_order', 0)

        if not image_file:
            return Response(
                {'error': 'Image file is required'},
                status=status.HTTP_400_BAD_REQUEST
            )

        if not restaurant_id:
            return Response(
                {'error': 'restaurant_id is required'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Validate file extension
        allowed_extensions = ['jpg', 'jpeg', 'png']
        ext = image_file.name.split('.')[-1].lower()
        if ext not in allowed_extensions:
            return Response(
                {'error': f'Only {", ".join(allowed_extensions)} files are allowed'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Validate file size (5MB max)
        if image_file.size > 5 * 1024 * 1024:
            return Response(
                {'error': 'Image size must be less than 5MB'},
                status=status.HTTP_400_BAD_REQUEST
            )

        try:
            restaurant = Restaurant.objects.get(id=restaurant_id)
        except Restaurant.DoesNotExist:
            return Response(
                {'error': 'Restaurant not found'},
                status=status.HTTP_404_NOT_FOUND
            )

        # Check permission
        if request.user.role == 'PARTNER':
            if restaurant.partner.user != request.user:
                return Response(
                    {'error': 'You can only upload images to your own restaurant'},
                    status=status.HTTP_403_FORBIDDEN
                )
        elif request.user.role != 'ADMIN':
            return Response(
                {'error': 'Permission denied'},
                status=status.HTTP_403_FORBIDDEN
            )

        # Create RestaurantImage
        restaurant_image = RestaurantImage.objects.create(
            restaurant=restaurant,
            image=image_file,
            display_order=int(display_order)
        )

        serializer = RestaurantImageSerializer(restaurant_image)

        return Response(
            {
                'message': 'Image uploaded successfully',
                'data': serializer.data
            },
            status=status.HTTP_201_CREATED
        )

    def update(self, request, *args, **kwargs):
        """
        PUT /api/restaurants/images/{id}/
        Chỉ update display_order (không cho update ảnh)
        """
        instance = self.get_object()
        display_order = request.data.get('display_order')

        if display_order is not None:
            instance.display_order = int(display_order)
            instance.save()

        serializer = self.get_serializer(instance)
        return Response({
            'message': 'Display order updated successfully',
            'data': serializer.data
        })


class MenuItemViewSet(viewsets.ModelViewSet):
    """
    API endpoint cho Menu Items
    - GET: Public
    - POST/PUT/DELETE: Partner owner hoặc Admin
    """
    queryset = MenuItem.objects.all()
    permission_classes = [IsPartnerOrReadOnly, IsPartnerOwner]
    parser_classes = [MultiPartParser, FormParser, JSONParser]
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ['category', 'is_available']

    def get_serializer_class(self):
        if self.action in ['create', 'update', 'partial_update']:
            return MenuItemCreateUpdateSerializer
        return MenuItemSerializer

    def get_queryset(self):
        queryset = super().get_queryset()
        restaurant_id = self.request.query_params.get('restaurant_id')
        if restaurant_id:
            queryset = queryset.filter(restaurant_id=restaurant_id)
        return queryset

    def create(self, request, *args, **kwargs):
        """
        POST /api/restaurants/menu-items/
        Tạo menu item (không có ảnh)
        """
        restaurant_id = request.data.get('restaurant_id')

        if not restaurant_id:
            return Response(
                {'error': 'restaurant_id is required'},
                status=status.HTTP_400_BAD_REQUEST
            )

        try:
            restaurant = Restaurant.objects.get(id=restaurant_id)
        except Restaurant.DoesNotExist:
            return Response(
                {'error': 'Restaurant not found'},
                status=status.HTTP_404_NOT_FOUND
            )

        # Check permission
        if request.user.role == 'PARTNER':
            if restaurant.partner.user != request.user:
                return Response(
                    {'error': 'You can only add menu items to your own restaurant'},
                    status=status.HTTP_403_FORBIDDEN
                )

        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        menu_item = serializer.save(restaurant=restaurant)

        # Return với MenuItemSerializer để có image_url
        response_serializer = MenuItemSerializer(menu_item)

        return Response(
            {
                'message': 'Menu item created successfully',
                'data': response_serializer.data
            },
            status=status.HTTP_201_CREATED
        )

    @action(
        detail=True,
        methods=['post'],
        permission_classes=[IsAuthenticated, IsPartnerOwner],
        url_path='upload-image'
    )
    def upload_image(self, request, pk=None):
        """
        POST /api/restaurants/menu-items/{id}/upload-image/
        Upload ảnh cho món ăn

        Form-data:
        - image: File (required)
        """
        menu_item = self.get_object()
        image_file = request.FILES.get('image')

        if not image_file:
            return Response(
                {'error': 'Image file is required'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Validate file extension
        allowed_extensions = ['jpg', 'jpeg', 'png']
        ext = image_file.name.split('.')[-1].lower()
        if ext not in allowed_extensions:
            return Response(
                {'error': f'Only {", ".join(allowed_extensions)} files are allowed'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Validate file size (5MB max)
        if image_file.size > 5 * 1024 * 1024:
            return Response(
                {'error': 'Image size must be less than 5MB'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Update image
        menu_item.image = image_file
        menu_item.save()

        serializer = MenuItemSerializer(menu_item)

        return Response(
            {
                'message': 'Image uploaded successfully',
                'data': serializer.data
            },
            status=status.HTTP_200_OK
        )

    @action(
        detail=True,
        methods=['post'],
        permission_classes=[IsAuthenticated, IsPartnerOwner],
        url_path='toggle-availability'
    )
    def toggle_availability(self, request, pk=None):
        """
        POST /api/restaurants/menu-items/{id}/toggle-availability/
        Bật/tắt is_available
        """
        menu_item = self.get_object()
        menu_item.is_available = not menu_item.is_available
        menu_item.save()

        serializer = MenuItemSerializer(menu_item)
        return Response({
            'message': f'Menu item is now {"available" if menu_item.is_available else "unavailable"}',
            'data': serializer.data
        })


class TimeSlotViewSet(viewsets.ModelViewSet):
    """
    API endpoint cho Time Slots
    - GET: Public
    - POST/PUT/DELETE: Partner owner hoặc Admin
    """
    queryset = TimeSlot.objects.all()
    serializer_class = TimeSlotSerializer
    permission_classes = [IsPartnerOwner] # Chỉ cần owner là đủ

    def get_queryset(self):
        queryset = super().get_queryset()
        restaurant_id = self.request.query_params.get('restaurant_id')
        if restaurant_id:
            queryset = queryset.filter(restaurant_id=restaurant_id)
        return queryset.order_by('start_time')

    def create(self, request, *args, **kwargs):
        restaurant_id = request.data.get('restaurant_id')

        if not restaurant_id:
            return Response(
                {'error': 'restaurant_id is required'},
                status=status.HTTP_400_BAD_REQUEST
            )

        try:
            restaurant = Restaurant.objects.get(id=restaurant_id)
        except Restaurant.DoesNotExist:
            return Response(
                {'error': 'Restaurant not found'},
                status=status.HTTP_404_NOT_FOUND
            )

        # Check permission
        if request.user.role == 'PARTNER':
            if restaurant.partner.user != request.user:
                return Response(
                    {'error': 'You can only add time slots to your own restaurant'},
                    status=status.HTTP_403_FORBIDDEN
                )

        # Validate opening hours
        start_time_val = request.data.get('start_time')
        if not restaurant.is_within_opening_hours(start_time_val):
            return Response(
                {'error': f'Khung giờ phải nằm trong giờ hoạt động ({restaurant.opening_hours})'},
                status=status.HTTP_400_BAD_REQUEST
            )

        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        serializer.save(restaurant=restaurant)

        return Response(
            {
                'message': 'Time slot created successfully',
                'data': serializer.data
            },
            status=status.HTTP_201_CREATED
        )

    @action(
        detail=False,
        methods=['post'],
        permission_classes=[IsAuthenticated, IsActivePartner],
        url_path='bulk-create'
    )
    def bulk_create(self, request):
        """
        POST /api/restaurants/time-slots/bulk-create/
        """
        from datetime import datetime, timedelta
        
        restaurant_id = request.data.get('restaurant_id')
        start_time_str = request.data.get('start_time')
        end_time_str = request.data.get('end_time')
        interval = int(request.data.get('interval', 30))
        max_bookings = request.data.get('max_bookings')
        max_guests = int(request.data.get('max_guests_per_booking', 20))

        if not all([restaurant_id, start_time_str, end_time_str]):
            return Response({'error': 'Missing required fields'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            restaurant = Restaurant.objects.get(id=restaurant_id)
        except Restaurant.DoesNotExist:
            return Response({'error': 'Restaurant not found'}, status=status.HTTP_404_NOT_FOUND)

        if request.user.role == 'PARTNER':
            if restaurant.partner.user != request.user:
                return Response({'error': 'Unauthorized'}, status=status.HTTP_403_FORBIDDEN)

        start_time = datetime.strptime(start_time_str, '%H:%M')
        end_time = datetime.strptime(end_time_str, '%H:%M')
        
        created_slots = []
        current_time = start_time
        
        while current_time <= end_time:
            time_obj = current_time.time()
            if restaurant.is_within_opening_hours(time_obj):
                time_str = current_time.strftime('%H:%M:00')
                if not TimeSlot.objects.filter(restaurant=restaurant, start_time=time_str).exists():
                    slot = TimeSlot.objects.create(
                        restaurant=restaurant,
                        start_time=time_str,
                        max_bookings=max_bookings,
                        max_guests_per_booking=max_guests
                    )
                    created_slots.append(slot)
            
            current_time += timedelta(minutes=interval)

        return Response({
            'message': f'Successfully created {len(created_slots)} time slots',
            'data': TimeSlotSerializer(created_slots, many=True).data
        }, status=status.HTTP_201_CREATED)

    @action(
        detail=True,
        methods=['post'],
        permission_classes=[IsAuthenticated, IsPartnerOwner],
        url_path='toggle-active'
    )
    def toggle_active(self, request, pk=None):
        """
        POST /api/restaurants/time-slots/{id}/toggle-active/
        Bật/tắt is_active
        """
        time_slot = self.get_object()
        time_slot.is_active = not time_slot.is_active
        time_slot.save()

        serializer = self.get_serializer(time_slot)
        return Response({
            'message': f'Time slot is now {"active" if time_slot.is_active else "inactive"}',
            'data': serializer.data
        })

    @action(
        detail=False,
        methods=['post'],
        permission_classes=[AllowAny],
        url_path='check-availability'
    )
    def check_availability(self, request):
        """
        POST /api/restaurants/time-slots/check-availability/
        Body: {
            "restaurant_id": 1,
            "date": "2025-01-20",
            "time_slot_id": 3
        }
        """
        serializer = TimeSlotAvailabilitySerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        restaurant_id = serializer.validated_data['restaurant_id']
        date = serializer.validated_data['date']
        time_slot_id = serializer.validated_data.get('time_slot_id')

        restaurant = Restaurant.objects.get(id=restaurant_id)

        if time_slot_id:
            # Check specific slot
            try:
                time_slot = TimeSlot.objects.get(id=time_slot_id, restaurant=restaurant)
            except TimeSlot.DoesNotExist:
                return Response(
                    {'error': 'Time slot not found for this restaurant'},
                    status=status.HTTP_404_NOT_FOUND
                )

            is_available = time_slot.is_available(date)
            current_count = time_slot.get_current_booking_count(date)

            return Response({
                'available': is_available,
                'time_slot': TimeSlotSerializer(time_slot).data,
                'current_bookings': current_count,
                'max_bookings': time_slot.max_bookings
            })
        else:
            # Return all available slots
            available_slots = restaurant.get_available_slots(date)
            return Response({
                'date': str(date),
                'available_slots': TimeSlotSerializer(available_slots, many=True).data
            })

class TimeSlotOverrideViewSet(viewsets.ModelViewSet):
    queryset = TimeSlotOverride.objects.all()
    serializer_class = TimeSlotOverrideSerializer
    permission_classes = [IsAuthenticated, IsPartnerOwner]
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ['restaurant', 'date']

    def perform_create(self, serializer):
        serializer.save()

class BlockedDateViewSet(viewsets.ModelViewSet):
    # Keep for a bit or delete? I'll delete since I replaced it
    pass

class AdminRestaurantReportViewSet(viewsets.ViewSet):
    permission_classes = [IsAuthenticated]

    def list(self, request):
        if request.user.role != "ADMIN":
            return Response({"error": "Forbidden"}, status=status.HTTP_403_FORBIDDEN)
        
        from .models import RestaurantReport
        reports = RestaurantReport.objects.select_related("restaurant", "user").all().order_by("status", "-created_at")
        
        data = []
        for r in reports:
            data.append({
                "id": r.pk,
                "status": r.status,
                "reason": r.reason,
                "reported_by": r.user.full_name,
                "created_at": r.created_at,
                "restaurant": {
                    "id": r.restaurant.id,
                    "name": r.restaurant.name,
                    "address": r.restaurant.address,
                }
            })
        return Response(data)

    @action(detail=True, methods=["post"])
    def resolve(self, request, pk=None):
        if request.user.role != "ADMIN":
            return Response(status=403)
        from .models import RestaurantReport
        from django.shortcuts import get_object_or_404
        report = get_object_or_404(RestaurantReport, pk=pk)
        report.status = "RESOLVED"
        report.save()
        return Response({"message": "Đã xử lý xong khiếu nại"})

class CuisineAliasViewSet(viewsets.ModelViewSet):
    """
    API endpoint cho CuisineAlias (Từ khóa đồng nghĩa)
    Chỉ dành cho ADMIN
    """
    queryset = CuisineAlias.objects.all()
    serializer_class = CuisineAliasSerializer
    permission_classes = [IsAuthenticated]
    pagination_class = None
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ['canonical_name', 'alias']
    ordering_fields = ['canonical_name', 'created_at']
    ordering = ['canonical_name']

    def get_queryset(self):
        # Chỉ Admin mới thấy hết
        if getattr(self.request.user, 'role', None) == 'ADMIN':
            return CuisineAlias.objects.all()
        return CuisineAlias.objects.none()

    def create(self, request, *args, **kwargs):
        if getattr(request.user, 'role', None) != 'ADMIN':
            return Response({'error': 'Chỉ Admin mới có quyền thực hiện.'}, status=status.HTTP_403_FORBIDDEN)
        return super().create(request, *args, **kwargs)

    def update(self, request, *args, **kwargs):
        if getattr(request.user, 'role', None) != 'ADMIN':
            return Response({'error': 'Chỉ Admin mới có quyền thực hiện.'}, status=status.HTTP_403_FORBIDDEN)
        return super().update(request, *args, **kwargs)

    def destroy(self, request, *args, **kwargs):
        if getattr(request.user, 'role', None) != 'ADMIN':
            return Response({'error': 'Chỉ Admin mới có quyền thực hiện.'}, status=status.HTTP_403_FORBIDDEN)
        return super().destroy(request, *args, **kwargs)
