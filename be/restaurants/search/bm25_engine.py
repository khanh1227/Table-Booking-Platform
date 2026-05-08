# restaurants/search/bm25_engine.py
"""
BM25 keyword search engine — v2.

Nâng cấp so với v1:
- Tokenizer underthesea thay vì split whitespace (xử lý từ ghép tiếng Việt đúng hơn)
- Distributed cache lock (Redis SET NX) tránh thundering herd khi rebuild index
- INTENT_EXPAND học từ query logs thay vì chỉ hardcode (data-driven expansion)
- Graceful fallback: nếu underthesea chưa cài → dùng tokenizer đơn giản
"""
import logging
import re
from unidecode import unidecode

logger = logging.getLogger(__name__)

# ── Vietnamese intent keyword mappings ─────────────────────────────────────────
# Base dict — sẽ được bổ sung bởi _load_learned_expansions() từ DB logs
INTENT_EXPAND_BASE = {
    # Dịp / Mood
    "hẹn hò":        ["lãng mạn", "không gian đẹp", "view", "thoáng"],
    "lãng mạn":      ["hẹn hò", "không gian đẹp", "view"],
    "sinh nhật":     ["tiệc", "không gian riêng", "phòng vip"],
    "gia đình":      ["không gian rộng", "trẻ em", "bàn lớn"],
    "bạn bè":        ["nhóm", "đông người", "nhậu"],
    "công việc":     ["yên tĩnh", "sang trọng", "lịch sự"],
    "tiệc":          ["nhóm", "không gian rộng", "đông người"],

    # Price intent
    "rẻ":            ["bình dân", "giá tốt", "tiết kiệm"],
    "bình dân":      ["rẻ", "giá tốt"],
    "tiết kiệm":     ["rẻ", "bình dân"],
    "sang":          ["cao cấp", "fine dining", "premium"],
    "cao cấp":       ["sang", "premium", "fine dining"],
    "không quá đắt": ["bình dân", "trung bình", "vừa phải"],
    "vừa túi tiền":  ["bình dân", "trung bình"],

    # Cuisine shortcuts
    "sushi":         ["món nhật", "nhật bản"],
    "bbq":           ["nướng", "thịt nướng"],
    "hotpot":        ["lẩu"],
    "dimsum":        ["món hoa", "trung hoa", "dim sum"],

    # Time of day
    "buổi tối":      ["tối", "dinner"],
    "tối nay":       ["tối", "buổi tối"],
    "buổi trưa":     ["trưa", "lunch"],
    "sáng sớm":      ["sáng", "breakfast"],
}

# ── Price range keywords → numeric filter hint ─────────────────────────────────
PRICE_KEYWORDS = {
    "rẻ":             ("budget", 100000),
    "bình dân":       ("budget", 100000),
    "tiết kiệm":      ("budget", 100000),
    "giá rẻ":         ("budget", 100000),
    "không quá đắt":  ("medium", 300000),
    "vừa phải":       ("medium", 300000),
    "trung bình":     ("medium", 300000),
    "sang":           ("premium", None),
    "cao cấp":        ("premium", None),
    "fine dining":    ("premium", None),
    "premium":        ("premium", None),
}

# ── Tokenizer ──────────────────────────────────────────────────────────────────

def _try_underthesea_tokenize(text: str) -> list[str] | None:
    """
    Dùng underthesea word_tokenize nếu thư viện có sẵn.
    Trả về None nếu chưa cài để caller fallback sang tokenizer đơn giản.
    """
    try:
        from underthesea import word_tokenize
        tokens = word_tokenize(text, format="text").split()
        return tokens
    except ImportError:
        return None
    except Exception as e:
        logger.warning(f"[BM25] underthesea error: {e}, falling back to simple tokenizer")
        return None


def tokenize_vi(text: str) -> list[str]:
    """
    Tokenize tiếng Việt:
    1. Lowercase + strip
    2. Thử underthesea word_tokenize (xử lý từ ghép như "hải sản", "không gian")
    3. Fallback: split whitespace nếu underthesea chưa cài
    4. Thêm bản unidecode để match không dấu ("pho" → "phở")
    """
    if not text:
        return []
    text = text.lower().strip()

    # Thử underthesea trước
    tokens = _try_underthesea_tokenize(text)

    if tokens is None:
        # Fallback: split whitespace
        tokens = text.split()

    # Thêm version không dấu để tăng recall
    no_accent = unidecode(text)
    if no_accent != text:
        # Tokenize version không dấu bằng cùng method
        no_accent_tokens = _try_underthesea_tokenize(no_accent) or no_accent.split()
        tokens = tokens + no_accent_tokens

    # Loại bỏ token quá ngắn (≤1 ký tự) và dedup nhưng giữ thứ tự
    seen = set()
    result = []
    for t in tokens:
        if len(t) > 1 and t not in seen:
            seen.add(t)
            result.append(t)
    return result


# ── Query expansion ────────────────────────────────────────────────────────────

def _load_learned_expansions() -> dict[str, list[str]]:
    """
    Load learned intent expansions từ DB (QueryLog model).
    Hai query thường xuyên dẫn đến cùng clicked restaurant → là synonym.
    Cache 6 giờ vì không thay đổi thường xuyên.

    Returns {} nếu model chưa tồn tại (graceful fallback).
    """
    try:
        from django.core.cache import cache
        cached = cache.get("learned_intent_expansions_v1")
        if cached is not None:
            return cached

        from restaurants.models import QueryLog  # optional model
        # Tìm các cặp query share nhiều restaurant kết quả
        # Đây là stub — implement theo schema thực của QueryLog
        expansions = {}
        logs = (
            QueryLog.objects
            .filter(clicked=True)
            .values("query_text", "restaurant_id")
            .order_by("restaurant_id")
        )

        # Group: restaurant_id → [query texts]
        rest_queries: dict[int, set[str]] = {}
        for log in logs:
            rid = log["restaurant_id"]
            q = log["query_text"].lower().strip()
            if rid not in rest_queries:
                rest_queries[rid] = set()
            rest_queries[rid].add(q)

        # Nếu 2+ query dẫn đến cùng restaurant → thêm vào expansions lẫn nhau
        for queries in rest_queries.values():
            q_list = list(queries)
            for i, q in enumerate(q_list):
                others = q_list[:i] + q_list[i+1:]
                if q not in expansions:
                    expansions[q] = []
                expansions[q] = list(set(expansions[q] + others))[:5]  # max 5 expansions

        cache.set("learned_intent_expansions_v1", expansions, timeout=6 * 60 * 60)
        logger.info(f"[BM25] Loaded {len(expansions)} learned intent expansions")
        return expansions

    except (ImportError, Exception) as e:
        logger.debug(f"[BM25] Could not load learned expansions: {e}")
        return {}


def expand_query(query: str) -> str:
    """
    Mở rộng query với từ đồng nghĩa từ cả base dict và learned expansions.
    "hẹn hò rẻ" → "hẹn hò rẻ lãng mạn không gian đẹp view bình dân giá tốt"
    """
    expanded = query
    query_lower = query.lower()

    # Base expansions (hardcoded)
    for keyword, expansions in INTENT_EXPAND_BASE.items():
        if keyword in query_lower:
            expanded += " " + " ".join(expansions)

    # Learned expansions (data-driven)
    learned = _load_learned_expansions()
    for keyword, expansions in learned.items():
        if keyword in query_lower:
            expanded += " " + " ".join(expansions)

    return expanded


def extract_price_hint(query: str) -> str | None:
    """Trả về 'BUDGET' | 'MEDIUM' | 'PREMIUM' | None từ query."""
    query_lower = query.lower()
    for keyword, (tier, _) in PRICE_KEYWORDS.items():
        if keyword in query_lower:
            return tier.upper()
    return None


def extract_group_size(query: str) -> int | None:
    """Extract số người từ query: "4 người" → 4"""
    m = re.search(r'(\d+)\s*(người|pax|khách|người ăn)', query.lower())
    if m:
        return int(m.group(1))
    return None


# ── Index building ─────────────────────────────────────────────────────────────

def build_bm25_index(restaurant_queryset):
    """
    Build BM25Okapi index từ queryset.
    Trả về (bm25, restaurants_list).
    """
    from rank_bm25 import BM25Okapi

    restaurants = list(
        restaurant_queryset
        .select_related('location')
        .prefetch_related('menu_items')
        .filter(status='APPROVED')
    )

    if not restaurants:
        return None, []

    corpus = []
    for r in restaurants:
        cuisine = r.cuisine_type or ''
        # Boost cuisine bằng cách lặp lại 3 lần (Trọng tâm Đồ án)
        cuisine_boosted = f"{cuisine} {cuisine} {cuisine}"
        
        parts = [
            r.name or '',
            cuisine_boosted,
            r.address or '',
            # Giảm tầm quan trọng của description bằng cách để nó ở cuối và không lặp lại
            r.description or '',
        ]
        if r.location:
            parts += [r.location.district or '', r.location.city or '']

        # Thêm tên món ăn (top 15)
        menu_names = [m.name for m in r.menu_items.all()[:15]]
        parts += menu_names

        # Price label để match keyword "rẻ", "bình dân"
        try:
            price = int(str(r.price_range or '0'))
            if price < 100000:
                parts.append('bình dân rẻ tiết kiệm')
            elif price <= 300000:
                parts.append('trung bình vừa phải')
            else:
                parts.append('cao cấp sang premium')
        except (ValueError, TypeError):
            pass

        text = ' '.join(parts)
        tokens = tokenize_vi(text)
        corpus.append(tokens)

    bm25 = BM25Okapi(corpus)
    logger.info(f"[BM25] Built index for {len(restaurants)} restaurants")
    return bm25, restaurants


# ── Cache helpers ──────────────────────────────────────────────────────────────

CACHE_KEY = "bm25_index_v3"
CACHE_LOCK_KEY = "bm25_index_lock_v3"
CACHE_LOCK_TIMEOUT = 30       # giây — TTL của lock
CACHE_INDEX_TIMEOUT = 30 * 60 # 30 phút


def _acquire_rebuild_lock(cache) -> bool:
    """
    Distributed lock dùng cache.add (atomic SET NX trong Redis/Memcached).
    Trả về True nếu lock được acquire, False nếu process khác đang rebuild.
    """
    # cache.add chỉ set nếu key chưa tồn tại → atomic, tránh race condition
    return cache.add(CACHE_LOCK_KEY, "1", timeout=CACHE_LOCK_TIMEOUT)


def _release_rebuild_lock(cache):
    cache.delete(CACHE_LOCK_KEY)


def bm25_search(query: str, top_k: int = 30) -> list[tuple]:
    """
    BM25 search với query expansion.

    Nâng cấp: distributed lock khi rebuild index tránh thundering herd.
    Returns: [(restaurant_obj, normalized_score), ...]  — score in [0, 1]
    """
    from django.core.cache import cache
    from restaurants.models import Restaurant

    cached = cache.get(CACHE_KEY)

    if cached is None:
        # Thử acquire lock
        if _acquire_rebuild_lock(cache):
            try:
                # Double-check sau khi có lock (process khác có thể đã rebuild)
                cached = cache.get(CACHE_KEY)
                if cached is None:
                    qs = Restaurant.objects.filter(status='APPROVED')
                    bm25, restaurants = build_bm25_index(qs)
                    if bm25 is None:
                        return []
                    cache.set(CACHE_KEY, (bm25, restaurants), timeout=CACHE_INDEX_TIMEOUT)
                    cached = (bm25, restaurants)
            finally:
                _release_rebuild_lock(cache)
        else:
            # Process khác đang rebuild — đợi tối đa 3s rồi trả về rỗng
            import time
            for _ in range(6):
                time.sleep(0.5)
                cached = cache.get(CACHE_KEY)
                if cached is not None:
                    break
            if cached is None:
                logger.warning("[BM25] Index not ready after waiting, returning empty")
                return []

    bm25, restaurants = cached

    # Expand query
    expanded = expand_query(query)
    tokens = tokenize_vi(expanded)

    if not tokens:
        return []

    scores = bm25.get_scores(tokens)

    max_score = max(scores) if max(scores) > 0 else 1
    normalized = [
        (restaurants[i], scores[i] / max_score)
        for i in range(len(scores)) if scores[i] > 0
    ]

    normalized.sort(key=lambda x: x[1], reverse=True)
    return normalized[:top_k]


def invalidate_bm25_cache():
    """Gọi sau khi thêm/sửa nhà hàng để rebuild index."""
    from django.core.cache import cache
    cache.delete(CACHE_KEY)
    # Xóa luôn learned expansions cache để pick up data mới
    cache.delete("learned_intent_expansions_v1")
    logger.info("[BM25] Cache invalidated")
