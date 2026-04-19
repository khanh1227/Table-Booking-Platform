"""
Recommendation Engine — Pluggable, dễ nâng cấp.

Hiện tại: rule-based từ DB (filter theo cuisine/location/price, sort by rating).
Tương lai: thay thế logic bên trong mà không ảnh hưởng code ngoài.

Thay đổi v3 (2026-04-09):
  - Cuisine matching mở rộng: tìm trên Restaurant.cuisine_type, description,
    name + MenuItem.category, name thay vì chỉ MenuItem.category.
  - Thêm CUISINE_ALIASES: "Nhật" → ["Nhật", "Sushi", "Ramen", "Japanese"...].
  - Thêm tham số location cho recommend_dishes (lọc món theo vùng).
  - Fallback chain giữ nguyên 5 mức, chỉ cải thiện độ phủ matching.
"""
from __future__ import annotations

import logging
import random
from functools import reduce
from operator import or_

from django.db.models import Avg, Q, QuerySet

logger = logging.getLogger(__name__)

# ── Cuisine alias map ─────────────────────────────────────────────────────────
# Mỗi cuisine chuẩn (value từ post_ner_enhancer) → danh sách từ khoá có thể
# xuất hiện trong DB (cuisine_type, category, tên nhà hàng, tên món, description).
# Không cần viết hoa — sẽ dùng icontains.

CUISINE_ALIASES: dict[str, list[str]] = {
    "Nhật":     ["nhật", "nhật bản", "japanese", "japan", "sushi", "ramen",
                 "sashimi", "tempura", "udon", "takoyaki", "gyoza", "bento",
                 "wagyu", "teriyaki", "miso", "izakaya"],
    "Hàn":      ["hàn", "hàn quốc", "korean", "korea", "bibimbap", "kimchi",
                 "bulgogi", "tokbokki", "tteokbokki", "samgyeopsal", "jjigae",
                 "kimbap"],
    "Thái":     ["thái", "thái lan", "thai", "thailand", "tom yum", "pad thai",
                 "som tam", "tom kha"],
    "Trung":    ["trung", "trung quốc", "trung hoa", "chinese", "china",
                 "dimsum", "dim sum", "há cảo", "xá xíu", "hoành thánh",
                 "mì xào", "vịt quay"],
    "Ý":        ["ý", "italian", "italia", "italy", "pizza", "pasta",
                 "risotto", "spaghetti", "tiramisu", "lasagna"],
    "Pháp":     ["pháp", "french", "france", "croissant", "foie gras",
                 "crème brûlée"],
    "Việt":     ["việt", "việt nam", "vietnamese", "phở", "bún", "cơm tấm",
                 "bánh mì", "gỏi cuốn", "nem", "chả giò"],
    "Ấn Độ":   ["ấn", "ấn độ", "indian", "india", "curry", "naan",
                 "tandoori", "masala", "biryani"],
    "Mỹ":       ["mỹ", "american", "burger", "hot dog", "steak house"],
    "Âu":       ["âu", "châu âu", "european", "western", "tây"],
    "Hải sản":  ["hải sản", "seafood", "tôm", "cua", "ghẹ", "cá",
                 "mực", "sò", "ốc", "hàu"],
    "Lẩu":      ["lẩu", "hotpot", "hot pot", "steamboat"],
    "Nướng":    ["nướng", "bbq", "barbecue", "grill", "grilled"],
    "BBQ":      ["bbq", "barbecue", "nướng", "grill"],
    "Buffet":   ["buffet"],
    "Chay":     ["chay", "thuần chay", "vegetarian", "vegan"],
    "Dimsum":   ["dimsum", "dim sum", "há cảo"],
    "Sushi":    ["sushi", "nhật", "sashimi"],
    "Pizza":    ["pizza", "ý", "italian"],
    "Steak":    ["steak", "bít tết", "beefsteak", "wagyu"],
    "Phở":      ["phở", "pho"],
    "Bún":      ["bún"],
    "Cơm":      ["cơm", "cơm tấm", "cơm niêu"],
    "Bánh":     ["bánh", "bánh mì", "bánh cuốn", "bánh xèo"],
    # Combo cuisines
    "Lẩu Thái": ["lẩu thái", "thái", "tom yum", "lẩu"],
    "Lẩu Hàn":  ["lẩu hàn", "hàn", "jjigae", "lẩu"],
    "Nướng Hàn": ["nướng hàn", "hàn", "korean bbq", "samgyeopsal"],
}


def _get_cuisine_terms(cuisine: str) -> list[str]:
    """
    Trả về danh sách các từ khoá tìm kiếm cho cuisine đó.
    Nếu có trong CUISINE_ALIASES → dùng alias; nếu không → dùng chính nó.
    """
    terms = CUISINE_ALIASES.get(cuisine)
    if terms:
        return terms
    # Thử match key khác (case-insensitive)
    cuisine_lower = cuisine.lower().strip()
    for key, aliases in CUISINE_ALIASES.items():
        if key.lower() == cuisine_lower or cuisine_lower in aliases:
            return aliases
    # Fallback: chính cuisine đó
    return [cuisine]


# Map từ khóa giá → khoảng giá (VNĐ/món)
PRICE_MAP: dict[str, tuple[int, int]] = {
    "bình dân":  (0,       150_000),
    "rẻ":        (0,       100_000),
    "tiết kiệm": (0,       120_000),
    "vừa":       (100_000, 300_000),
    "trung bình": (80_000, 250_000),
    "cao cấp":   (300_000, 99_999_999),
    "sang trọng": (500_000, 99_999_999),
    "đắt":       (300_000, 99_999_999),
    # English aliases
    "cheap":     (0,       100_000),
    "affordable": (0,      150_000),
    "mid-range": (100_000, 300_000),
    "luxury":    (300_000, 99_999_999),
}

DEFAULT_RESTAURANT_LIMIT = 5
DEFAULT_DISH_LIMIT       = 6

# Số bản ghi lấy dư để random sampling (tránh bias về đầu bảng)
_SAMPLE_POOL_FACTOR = 3


class RecommendationEngine:
    """
    Gợi ý nhà hàng / món ăn dựa trên entities từ context.

    ─── Nâng cấp trong tương lai ────────────────────────────────────────────
    1. Thêm user_profile cho cá nhân hoá.
    2. Thay _rule_based_* bằng ML hoặc collaborative filtering.
    3. Thêm vector similarity cho dish description.
    ──────────────────────────────────────────────────────────────────────────
    """

    # ── Helpers: cuisine Q builders ───────────────────────────────────────────

    @staticmethod
    def _cuisine_q_restaurants(terms: list[str]) -> Q:
        """
        Build Q object tìm nhà hàng theo cuisine trên nhiều trường:
          - Restaurant.cuisine_type  (trường chính, partner chọn khi đăng ký)
          - Restaurant.description   (mô tả tự do)
          - Restaurant.name          (tên nhà hàng có thể chứa keyword)
          - MenuItem.category        (nhóm món ăn)
          - MenuItem.name            (tên món cụ thể)
        """
        # Q cho trường trực tiếp trên Restaurant
        direct_q = Q()
        for term in terms:
            direct_q |= Q(cuisine_type__icontains=term)
            direct_q |= Q(description__icontains=term)
            direct_q |= Q(name__icontains=term)
        return direct_q

    @staticmethod
    def _cuisine_q_menu_items(terms: list[str]) -> Q:
        """Build Q object tìm MenuItem theo cuisine trên category + name."""
        q = Q()
        for term in terms:
            q |= Q(category__icontains=term)
            q |= Q(name__icontains=term)
        return q

    # ── Public API ────────────────────────────────────────────────────────────

    def recommend_restaurants(
        self,
        cuisine:     str | None = None,
        location:    str | None = None,
        price_range: str | None = None,
        exclude_ids: list[int] | None = None,
        limit:       int = DEFAULT_RESTAURANT_LIMIT,
        offset:      int = 0,               # pagination cursor
        context:     dict | None = None,    # reserved cho tương lai
    ) -> tuple[QuerySet, str]:
        """
        Trả về (QuerySet, fallback_level).
        fallback_level: "EXACT" | "FALLBACK_PRICE" | "FALLBACK_LOCATION" |
                        "FALLBACK_CUISINE" | "FALLBACK_TOP" | "LOOP"
        """
        # Mức 1: AND tất cả tiêu chí (Cuisine + Location + Price)
        qs = self._rule_based_restaurants(cuisine, location, price_range, exclude_ids)
        if qs.exists():
            return qs.order_by("-rating")[offset:offset + limit], "EXACT"

        # Mức 2: Bỏ giá (Cuisine + Location)
        if price_range:
            qs = self._rule_based_restaurants(cuisine, location, None, exclude_ids)
            if qs.exists():
                return qs.order_by("-rating")[offset:offset + limit], "FALLBACK_PRICE"

        # ── LOOP TẠI CHỖ (Ưu tiên giữ đúng Địa điểm và Ẩm thực của user) ──────
        # Nếu đã tìm theo Cuisine + Location (không cần price) mà rỗng do exclude_ids
        if exclude_ids and (cuisine or location):
            qs_loop = self._rule_based_restaurants(cuisine, location, None, None)
            if qs_loop.exists():
                return qs_loop.order_by("-rating")[offset:offset + limit], "LOOP"

        # Mức 3: Bỏ địa điểm (Giữ Cuisine, tìm rộng ra nơi khác)
        if location:
            qs = self._rule_based_restaurants(cuisine, None, None, exclude_ids)
            if qs.exists():
                return qs.order_by("-rating")[offset:offset + limit], "FALLBACK_LOCATION"

        # Mức 4: Bỏ ẩm thực (Giữ địa điểm)
        if cuisine and location:
            qs = self._rule_based_restaurants(None, location, None, exclude_ids)
            if qs.exists():
                return qs.order_by("-rating")[offset:offset + limit], "FALLBACK_CUISINE"

        # Mức 5: Top phổ biến (Kể cả không đúng tiêu chí)
        qs = self._rule_based_restaurants(None, None, None, exclude_ids)
        if qs.exists():
            return qs.order_by("-rating")[offset:offset + limit], "FALLBACK_TOP"

        # Nếu đã duyệt hết các fallback mà vẫn rỗng và có exclude_ids đang lọc
        # -> Chạy lại một lần nữa nhưng KHÔNG lọc theo exclude_ids.
        if exclude_ids:
            # Thử tìm lại theo tiêu chí gốc (Cuisine + Location) mà không lọc
            qs_loop = self._rule_based_restaurants(cuisine, location, price_range, None)
            if qs_loop.exists():
                return qs_loop.order_by("-rating")[offset:offset + limit], "LOOP"
            
            # Nếu DB thực sự không có quán nào như vậy, fallback về Top chung (không lọc)
            qs_loop_top = self._rule_based_restaurants(None, None, None, None)
            return qs_loop_top.order_by("-rating")[offset:offset + limit], "LOOP"

        return qs.none(), "FALLBACK_TOP"

    def recommend_dishes(
        self,
        restaurant_id: int | None  = None,
        cuisine:       str | None  = None,
        dish_name:     str | None  = None,
        location:      str | None  = None,
        exclude_ids:   list[int] | None = None,
        limit:         int = DEFAULT_DISH_LIMIT,
        offset:        int = 0,
        context:       dict | None = None,
    ) -> tuple[QuerySet, str]:
        """
        Trả về (QuerySet, fallback_level).
        fallback_level: "EXACT" | "FALLBACK_DISH" | "FALLBACK_CUISINE" |
                        "FALLBACK_RESTAURANT" | "FALLBACK_TOP" | "LOOP"
        """
        # Mức 1: EXACT (restaurant + cuisine + dish_name + location)
        qs = self._rule_based_dishes(restaurant_id, cuisine, dish_name, exclude_ids, location)
        if qs.exists():
            if restaurant_id:
                return qs.order_by("-restaurant__rating", "price")[offset:offset + limit], "EXACT"
            # Khi không có restaurant cụ thể → lấy random sample để đa dạng
            return self._random_sample(qs, limit, offset), "EXACT"

        # ── LOOP TẠI CHỖ (Ưu tiên giữ đúng các tiêu chí User yêu cầu nhất) ─────
        if exclude_ids and (restaurant_id or cuisine or location):
            qs_loop = self._rule_based_dishes(restaurant_id, cuisine, dish_name, None, location)
            if qs_loop.exists():
                return self._random_sample(qs_loop, limit, offset), "LOOP"

        # Mức 2: Bỏ dish_name, giữ restaurant + cuisine + location
        if dish_name:
            qs = self._rule_based_dishes(restaurant_id, cuisine, None, exclude_ids, location)
            if qs.exists():
                ordered = qs.order_by("-restaurant__rating", "price")
                return ordered[offset:offset + limit], "FALLBACK_DISH"

        # Mức 3: Bỏ cuisine, giữ restaurant
        if restaurant_id and cuisine:
            qs = self._rule_based_dishes(restaurant_id, None, None, exclude_ids)
            if qs.exists():
                return qs.order_by("-restaurant__rating", "price")[offset:offset + limit], "FALLBACK_CUISINE"

        # Mức 4: Bỏ restaurant, giữ cuisine + location
        if restaurant_id:
            qs = self._rule_based_dishes(None, cuisine, None, exclude_ids, location)
            if qs.exists():
                return self._random_sample(qs, limit, offset), "FALLBACK_RESTAURANT"

        # Mức 4b: Bỏ location, giữ cuisine (khi không có restaurant nhưng có location)
        if location and cuisine:
            qs = self._rule_based_dishes(None, cuisine, None, exclude_ids, None)
            if qs.exists():
                return self._random_sample(qs, limit, offset), "FALLBACK_LOCATION"

        # Mức 5: Top dishes
        qs = self._rule_based_dishes(None, None, None, exclude_ids)
        if qs.exists():
            return qs.order_by("-restaurant__rating", "price")[offset:offset + limit], "FALLBACK_TOP"

        # ── NEW: TỰ ĐỘNG VÒNG LẶP ────────────────────────────────────────────────
        if exclude_ids:
            # Thử tìm lại theo tiêu chí gốc mà không lọc
            qs_loop = self._rule_based_dishes(restaurant_id, cuisine, dish_name, None, location)
            if qs_loop.exists():
                return self._random_sample(qs_loop, limit, offset), "LOOP"
            
            # Fallback về Top (không lọc)
            qs_loop_top = self._rule_based_dishes(None, None, None, None)
            return qs_loop_top.order_by("-restaurant__rating", "price")[offset:offset + limit], "LOOP"

        return qs.none(), "FALLBACK_TOP"

    # ── Rule-based implementations ────────────────────────────────────────────

    def _rule_based_restaurants(
        self,
        cuisine:     str | None,
        location:    str | None,
        price_range: str | None,
        exclude_ids: list[int] | None,
    ) -> QuerySet:
        from restaurants.models import Restaurant, MenuItem

        qs = (
            Restaurant.objects
            .filter(status="APPROVED")
            .select_related("location")
            .prefetch_related("images")
        )

        if location:
            qs = qs.filter(
                Q(location__district__icontains=location) |
                Q(location__city__icontains=location) |
                Q(location__ward__icontains=location) |
                Q(address__icontains=location)
            )

        if cuisine:
            terms = _get_cuisine_terms(cuisine)
            logger.debug(f"[RecEngine] Cuisine '{cuisine}' → search terms: {terms}")

            # Tìm trên các trường trực tiếp của Restaurant
            direct_q = self._cuisine_q_restaurants(terms)

            # Tìm qua MenuItem (category + name)
            menu_q = self._cuisine_q_menu_items(terms)
            cuisine_restaurant_ids = (
                MenuItem.objects
                .filter(menu_q, is_available=True)
                .values_list("restaurant_id", flat=True)
                .distinct()
            )

            # OR: trực tiếp trên Restaurant HOẶC qua menu
            qs = qs.filter(direct_q | Q(id__in=cuisine_restaurant_ids)).distinct()

        if price_range:
            price_tuple = self._parse_price(price_range)
            if price_tuple:
                low, high = price_tuple
                affordable_ids = (
                    MenuItem.objects
                    .filter(is_available=True)
                    .values("restaurant_id")
                    .annotate(avg_price=Avg("price"))
                    .filter(avg_price__gte=low, avg_price__lte=high)
                    .values_list("restaurant_id", flat=True)
                )
                qs = qs.filter(id__in=affordable_ids)

        if exclude_ids:
            qs = qs.exclude(id__in=exclude_ids)

        return qs

    def _rule_based_dishes(
        self,
        restaurant_id: int | None,
        cuisine:       str | None,
        dish_name:     str | None,
        exclude_ids:   list[int] | None,
        location:      str | None = None,
    ) -> QuerySet:
        from restaurants.models import MenuItem

        qs = MenuItem.objects.filter(is_available=True).select_related(
            "restaurant", "restaurant__location"
        )

        if restaurant_id:
            qs = qs.filter(restaurant_id=restaurant_id)

        if cuisine:
            terms = _get_cuisine_terms(cuisine)
            # Tìm trên category + name + description của MenuItem
            # VÀ cuisine_type của nhà hàng cha
            q = Q()
            for term in terms:
                q |= Q(category__icontains=term)
                q |= Q(name__icontains=term)
                q |= Q(restaurant__cuisine_type__icontains=term)
            qs = qs.filter(q).distinct()

        if dish_name:
            qs = qs.filter(name__icontains=dish_name)

        if location:
            qs = qs.filter(
                Q(restaurant__location__district__icontains=location) |
                Q(restaurant__location__city__icontains=location) |
                Q(restaurant__location__ward__icontains=location) |
                Q(restaurant__address__icontains=location)
            )

        if exclude_ids:
            qs = qs.exclude(id__in=exclude_ids)

        return qs

    # ── Helpers ───────────────────────────────────────────────────────────────

    def _random_sample(self, qs: QuerySet, limit: int, offset: int = 0) -> QuerySet:
        """
        Lấy ngẫu nhiên từ QuerySet mà không dùng ORDER BY RANDOM().
        Chiến lược: lấy pool = limit * _SAMPLE_POOL_FACTOR phần tử đầu (theo rating),
        rồi random.sample trong Python để chọn limit phần tử.

        Trade-off: pool phải load vào memory, nhưng pool nhỏ (mặc định 18 bản ghi)
        nên OK. Thay thế tốt hơn trong tương lai: TABLESAMPLE BERNOULLI trên PostgreSQL.
        """
        pool_size = (limit + offset) * _SAMPLE_POOL_FACTOR
        pool = list(qs.order_by("-restaurant__rating")[:pool_size])

        if not pool:
            return qs.none()

        # Tạo QuerySet từ sample (cần trả về QuerySet để consistent API)
        sampled = random.sample(pool, min(limit, len(pool)))
        sampled_ids = [item.id for item in sampled]
        from restaurants.models import MenuItem
        return MenuItem.objects.filter(id__in=sampled_ids).select_related("restaurant")

    def _parse_price(self, price_str: str) -> tuple[int, int] | None:
        """
        Normalize chuỗi giá rồi lookup trong PRICE_MAP.
        Chịu được viết hoa/thường và khoảng trắng thừa.
        """
        normalized = price_str.lower().strip()
        for keyword, rng in PRICE_MAP.items():
            if keyword in normalized:
                return rng
        return None


# Singleton instance
recommendation_engine = RecommendationEngine()
