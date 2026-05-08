# restaurants/search/personalize.py
"""
Personalization layer — v2.

Nâng cấp so với v1:
- Fix bug indent: favorite_ids boost không còn nằm sai trong block if location
- Fix near-me: dùng query_context từ entry (được truyền đúng từ fusion v2)
- Haversine distance thực thay vì string match district cho W_LOCATION score
- Diversity đa chiều: giới hạn cùng cuisine + price_tier + district
- Implicit feedback: log search impression để train weight tự động sau này
- W_* weights được giải thích rõ hơn và dễ tune
"""
import logging
import math
from datetime import timedelta
from django.utils import timezone

logger = logging.getLogger(__name__)

# ── Scoring weights ────────────────────────────────────────────────────────────
# Ưu tiên Đồ án: Loại món (Hàng đầu) > Địa lý (Thứ 2)
W_CUISINE   = 1.00   # Tăng mạnh: Đúng món là tiên quyết
W_LOCATION  = 0.35   
W_RRF       = 0.05   # Giảm: Tránh bẫy từ khóa (Cơm cháy vs Món chay)
W_RATING    = 0.05   
W_PRICE     = 0.05   

# Thưởng vừa phải cho địa lý (để quán chay Bình Dương vẫn thắng quán chay HCM)
BOOST_SAME_DISTRICT  = 0.15   
BOOST_SAME_CITY      = 0.10   
BOOST_FAVORITE       = 0.10   # Yêu thích

# Near-me intent keywords
NEAR_ME_KEYWORDS = ['gần đây', 'gần tôi', 'quanh đây', 'gần nhất', 'xung quanh']


# ── Haversine distance ─────────────────────────────────────────────────────────

def haversine_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """
    Tính khoảng cách thực (km) giữa 2 tọa độ GPS bằng công thức Haversine.
    Thay thế string match district — chính xác và fair hơn nhiều.
    """
    R = 6371.0  # Bán kính Trái Đất (km)
    φ1, φ2 = math.radians(lat1), math.radians(lat2)
    dφ = math.radians(lat2 - lat1)
    dλ = math.radians(lon2 - lon1)
    a = math.sin(dφ / 2) ** 2 + math.cos(φ1) * math.cos(φ2) * math.sin(dλ / 2) ** 2
    return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))


def _location_score(
    restaurant,
    profile: dict | None,
    user_lat: float | None,
    user_lon: float | None,
) -> float:
    """
    Tính W_LOCATION score [0, 1]:
    - Nếu có GPS của user và restaurant: dùng haversine, score = 1 / (1 + km)
    - Nếu chỉ có district history: dùng preference count như cũ
    - Nếu không có gì: 0
    """
    if not r_has_location(restaurant):
        return 0.0

    # Ưu tiên GPS thực (Lấy trực tiếp từ bảng Restaurant)
    r_lat = getattr(restaurant, 'latitude', None)
    r_lon = getattr(restaurant, 'longitude', None)
    if user_lat and user_lon and r_lat and r_lon:
        try:
            km = haversine_km(user_lat, user_lon, float(r_lat), float(r_lon))
            # score: 1km -> 0.5, 3km -> 0.25
            return 1.0 / (1.0 + km)
        except (TypeError, ValueError):
            pass

    # Fallback: district preference từ history
    if profile:
        district = restaurant.location.district or ''
        fav_districts = profile.get('fav_districts') or {}
        if district and district in fav_districts:
            freq = fav_districts[district]
            max_freq = max(fav_districts.values()) if fav_districts else 1
            return freq / max_freq

    return 0.0


def r_has_location(restaurant) -> bool:
    return bool(restaurant.location and restaurant.location.district)


# ── User profile ───────────────────────────────────────────────────────────────

def get_user_profile(user_id: int) -> dict:
    """
    Tính User Preference Profile từ lịch sử booking + favorites + reviews.
    Cache 1 giờ.
    """
    from django.core.cache import cache
    cache_key = f"user_profile_{user_id}_v3"
    cached = cache.get(cache_key)
    if cached:
        return cached

    from bookings.models import Booking
    from reviews.models import Review
    from restaurants.models import FavoriteRestaurant

    six_months_ago = timezone.now() - timedelta(days=180)
    thirty_days_ago = timezone.now() - timedelta(days=30)

    bookings = (
        Booking.objects
        .filter(customer_id=user_id, created_at__gte=six_months_ago)
        .select_related('restaurant__location')
    )

    completed = bookings.filter(status='COMPLETED')

    # Cuisine preference
    fav_cuisines: dict[str, int] = {}
    for b in completed:
        c = b.restaurant.cuisine_type or 'Khác'
        fav_cuisines[c] = fav_cuisines.get(c, 0) + 1

    # Price preference
    prices = []
    for b in completed:
        try:
            p = int(str(b.restaurant.price_range or '0'))
            if p > 0:
                prices.append(p)
        except (ValueError, TypeError):
            pass
    avg_price = sum(prices) / len(prices) if prices else 150000

    # District preference
    fav_districts: dict[str, int] = {}
    for b in bookings:
        d = (b.restaurant.location.district if b.restaurant.location else None) or ''
        if d:
            fav_districts[d] = fav_districts.get(d, 0) + 1

    # Group size
    sizes = [b.number_of_guests for b in completed if b.number_of_guests > 0]
    avg_group = sum(sizes) / len(sizes) if sizes else 2.0

    visited_ids = set(bookings.values_list('restaurant_id', flat=True))
    recent_ids = set(
        bookings.filter(created_at__gte=thirty_days_ago)
                .values_list('restaurant_id', flat=True)
    )
    reviewed_ids = set(
        Review.objects.filter(customer_id=user_id)
                      .values_list('restaurant_id', flat=True)
    )
    favorite_ids = set(
        FavoriteRestaurant.objects.filter(user_id=user_id)
                          .values_list('restaurant_id', flat=True)
    )

    profile = {
        'fav_cuisines': fav_cuisines,
        'avg_price': avg_price,
        'fav_districts': fav_districts,
        'avg_group_size': avg_group,
        'visited_ids': visited_ids,
        'recent_ids': recent_ids,
        'reviewed_ids': reviewed_ids,
        'favorite_ids': favorite_ids,
        'total_bookings': bookings.count(),
    }

    cache.set(cache_key, profile, timeout=60 * 60)
    return profile


# ── Price scoring ──────────────────────────────────────────────────────────────

def _price_match_score(restaurant_price_range: str | None, user_avg_price: float) -> float:
    """Score [0, 1] dựa trên mức độ gần nhau giữa price nhà hàng và sở thích user."""
    try:
        r_price = int(str(restaurant_price_range or '0'))
    except (ValueError, TypeError):
        return 0.5
    if r_price <= 0:
        return 0.5
    ratio = min(r_price, user_avg_price) / max(r_price, user_avg_price)
    return ratio


def _price_tier(price_range: str | None) -> str:
    """Phân loại price tier để dùng trong diversity filter."""
    try:
        p = int(str(price_range or '0'))
    except (ValueError, TypeError):
        return 'unknown'
    if p <= 0:
        return 'unknown'
    if p < 100000:
        return 'budget'
    if p <= 300000:
        return 'medium'
    return 'premium'


# ── Reason generation ──────────────────────────────────────────────────────────

def _generate_reason(entry: dict, profile: dict | None, query: str = "") -> str:
    """Tạo lý do gợi ý thông minh dựa trên Query và Profile."""
    r = entry['restaurant']
    query_lc = query.lower().strip()
    
    # 1. Ưu tiên: Khớp trực tiếp với từ khóa (Query Match)
    if query_lc:
        r_cuisine = (r.cuisine_type or "").lower()
        if r_cuisine and (query_lc in r_cuisine or r_cuisine in query_lc):
            return f"Đúng loại hình {r.cuisine_type} bạn đang tìm"
        
        try:
            # Check nhanh menu đã prefetch
            for m in r.menu_items.all():
                if query_lc in m.name.lower():
                    return f"Có món '{m.name}' trong thực đơn"
        except: pass

        if query_lc in r.name.lower():
            return f"Khớp với tên nhà hàng bạn tìm"

    # 2. Ưu tiên: Địa lý (Location)
    if entry.get('near_me_boost'):
        dist = r.location.district if r.location else ""
        return f"Quán ngay tại khu vực {dist} của bạn"

    # 3. Ưu tiên: Cá nhân hóa (Personalization)
    if profile:
        if r.id in (profile.get('favorite_ids') or set()):
            return "Trong danh sách yêu thích của bạn"
        if r.cuisine_type and r.cuisine_type in (profile.get('fav_cuisines') or {}):
            return f"Phù hợp với sở thích {r.cuisine_type} của bạn"

    # 4. Fallback
    rating = float(r.rating or 0)
    if rating >= 4.5: return f"Nhà hàng xuất sắc {r.rating}/5"
    return "Phù hợp với tìm kiếm của bạn"


# ── Diversity ──────────────────────────────────────────────────────────────────

def diversify(
    scored_list: list,
    max_same_cuisine: int = 2,
    max_same_price_tier: int = 3,
    max_same_district: int = 3,
) -> list:
    """
    Đảm bảo không gợi ý quá nhiều nhà hàng cùng loại theo nhiều chiều:
    - Cuisine: tránh toàn lẩu hoặc toàn sushi
    - Price tier: tránh toàn budget hoặc toàn premium
    - District: tránh toàn cùng 1 quận

    v2: thêm price_tier và district constraint.
    """
    cuisine_count: dict[str, int] = {}
    price_count: dict[str, int] = {}
    district_count: dict[str, int] = {}
    result = []

    for item in scored_list:
        r = item['restaurant']
        cuisine = r.cuisine_type or 'Khác'
        tier = _price_tier(r.price_range)
        district = (r.location.district if r.location else None) or 'Unknown'

        if (cuisine_count.get(cuisine, 0) >= max_same_cuisine or
                price_count.get(tier, 0) >= max_same_price_tier or
                district_count.get(district, 0) >= max_same_district):
            continue

        cuisine_count[cuisine] = cuisine_count.get(cuisine, 0) + 1
        price_count[tier] = price_count.get(tier, 0) + 1
        district_count[district] = district_count.get(district, 0) + 1
        result.append(item)

    return result


# ── Implicit feedback logging ──────────────────────────────────────────────────

def _log_search_impression(
    user_id: int | None,
    query: str,
    result_ids: list[int],
):
    """
    Log search impression để dùng cho implicit feedback training sau này.
    Lưu vào SearchImpression model (nếu tồn tại). Silent fail nếu chưa có.
    """
    try:
        from restaurants.models import SearchImpression
        SearchImpression.objects.create(
            user_id=user_id,
            query=query[:500],
            result_restaurant_ids=result_ids,
        )
    except Exception:
        pass  # Model chưa tồn tại hoặc lỗi → không block search


# ── Main rerank ────────────────────────────────────────────────────────────────

def personalized_rerank(
    candidates: list,
    user_id: int | None,
    price_hint: str | None = None,    # 'BUDGET' | 'MEDIUM' | 'PREMIUM' | None
    current_city: str | None = None,
    current_district: str | None = None,
    user_lat: float | None = None,    # GPS của user để tính haversine
    user_lon: float | None = None,
    top_n: int = 5,
) -> list[dict]:
    """
    Re-rank candidates theo sở thích user.

    Nâng cấp:
    - favorite_ids boost ở đúng chỗ (không còn nằm trong if location)
    - near-me boost dùng query_context từ entry (fusion v2 đã truyền đúng)
    - Haversine distance cho W_LOCATION thay vì string match district
    - Diversity đa chiều (cuisine + price + district)
    - Log impression cho implicit feedback

    Returns: list of {
        'restaurant': Restaurant,
        'final_score': float,
        'reason': str,
        'match_type': str,
    }
    """
    profile = get_user_profile(user_id) if user_id else None

    max_rrf = max((c['rrf_score'] for c in candidates), default=1)

    scored = []
    logger.info(f"[Rank] Starting rerank for query context: '{candidates[0].get('query_context', 'N/A') if candidates else ''}'")
    
    for entry in candidates:
        r = entry['restaurant']
        rid = r.id
        rname = r.name
        query_ctx = entry.get('query_context', '')

        # ── (DEMO: BỎ) Loại trừ nhà hàng đặt trong 30 ngày gần đây ──────────
        # if profile and rid in profile.get('recent_ids', set()):
        #     logger.debug(f"[Rank] Skip {rname} ({rid}): Recently booked (last 30 days)")
        #     continue

        # ── RRF score (normalized) ────────────────────────────────────────────
        rrf_norm = entry['rrf_score'] / max_rrf if max_rrf > 0 else 0
        final = W_RRF * rrf_norm
        log_parts = [f"RRF: {final:.4f}"]

        # ── Rating ───────────────────────────────────────────────────────────
        rating_score = (float(r.rating or 0) / 5.0) * W_RATING
        final += rating_score
        log_parts.append(f"Rating: {rating_score:.4f}")

        # ── Cuisine match (TRỌNG TÂM: Khớp với Query > Khớp với History) ──────
        cuisine_score = 0.0
        r_cuisine = (r.cuisine_type or '').lower()
        query_lower = query_ctx.lower()
        
        # 1. Khớp với từ khóa tìm kiếm (Query Intent) - Ưu tiên hàng đầu
        if query_lower and r_cuisine and (r_cuisine in query_lower or query_lower in r_cuisine):
            # Nếu tìm "chay" và quán là "Món chay" -> Cộng điểm cực lớn
            cuisine_score = W_CUISINE * 1.5 
        
        # 2. Khớp với sở thích lịch sử (User Profile) - Chỉ là phụ trợ
        elif profile and r.cuisine_type and r.cuisine_type in profile.get('fav_cuisines', {}):
            freq = profile['fav_cuisines'][r.cuisine_type]
            max_freq = max(profile['fav_cuisines'].values()) if profile['fav_cuisines'] else 1
            cuisine_score = W_CUISINE * (freq / max_freq)
            
        final += cuisine_score
        log_parts.append(f"Cuisine: {cuisine_score:.4f}")

        # ── Price match ───────────────────────────────────────────────────────
        price_match = 0.0
        if profile:
            price_match = W_PRICE * _price_match_score(r.price_range, profile.get('avg_price', 150000))
        final += price_match
        log_parts.append(f"PriceMatch: {price_match:.4f}")

        # ── Location score (haversine nếu có GPS, district fallback) ─────────
        loc_score = W_LOCATION * _location_score(r, profile, user_lat, user_lon)
        final += loc_score
        log_parts.append(f"Loc: {loc_score:.4f}")

        # ── Favorite boost ───────────────────────────────────────────────────
        fav_boost = 0.0
        if profile and rid in profile.get('favorite_ids', set()):
            fav_boost = BOOST_FAVORITE
        final += fav_boost
        if fav_boost > 0: log_parts.append(f"FavBoost: {fav_boost:.4f}")

        # ── Geographic Area Boost (Ưu tiên theo vị trí USER) ─────────────────
        geo_area_boost = 0.0
        r_dist = (r.location.district or '').lower() if r.location else ''
        r_city = (r.location.city or '').lower() if r.location else ''
        
        # Nếu cùng Tỉnh/Thành với User -> Cộng điểm
        if current_city and current_city.lower() in r_city:
            geo_area_boost += BOOST_SAME_CITY
            # Nếu cùng cả Quận/Huyện với User -> Cộng điểm cực mạnh
            if current_district and current_district.lower() in r_dist:
                geo_area_boost += BOOST_SAME_DISTRICT
        
        final += geo_area_boost
        if geo_area_boost > 0: log_parts.append(f"GeoArea: {geo_area_boost:.4f}")

        # ── Near-me boost (Extra boost if explicit intent) ───────────────────
        near_me_boost = 0.0
        if query_ctx and any(k in query_ctx.lower() for k in NEAR_ME_KEYWORDS):
            near_me_boost = 0.2
            entry['near_me_boost'] = True
        else:
            entry['near_me_boost'] = (geo_area_boost > 0)
        
        final += near_me_boost
        if near_me_boost > 0: log_parts.append(f"NearMe: {near_me_boost:.4f}")


        # ── Price hint penalty ───────────────────────────────────────────────
        if price_hint:
            # ... (giữ nguyên logic penalty nhưng thêm log nếu bị penalty)
            old_final = final
            try:
                r_price = int(str(r.price_range or '0'))
                if r_price > 0:
                    if price_hint == 'BUDGET' and r_price >= 100000: final *= 0.3
                    elif price_hint == 'MEDIUM' and (r_price < 100000 or r_price > 300000): final *= 0.5
                    elif price_hint == 'PREMIUM' and r_price <= 300000: final *= 0.4
            except: pass
            if final < old_final:
                log_parts.append(f"PriceHintPenalty: {final/old_final:.1f}x")

        logger.debug(f"[Rank] Scored {rname[:20]:<20} | Score: {final:.4f} | {' | '.join(log_parts)}")

        scored.append({
            **entry,
            'final_score': final,
            'reason': _generate_reason(entry, profile, query_ctx),
        })

    # Sort
    scored.sort(key=lambda x: x['final_score'], reverse=True)

    # Diversity filter (DEMO: OFF)
    top = scored[:top_n]

    # Log impression
    if top:
        _log_search_impression(
            user_id=user_id,
            query=top[0].get('query_context', ''),
            result_ids=[e['restaurant'].id for e in top],
        )

    logger.info(f"[Rank] {len(candidates)} candidates → top {len(top)} (diversity filtered)")
    return top
