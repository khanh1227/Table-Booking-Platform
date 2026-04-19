"""
entity_extractor.py — Trích xuất tên Nhà hàng / Món ăn từ văn bản người dùng bằng N-gram Fuzzy.

Chiến lược 3 lớp:
  1. PhoBERT NER entity (tin cậy nhất)
  2. N-gram fuzzy: cửa sổ 1–4 từ với threshold tăng dần khi n nhỏ
  3. Fallback full-text normalized

Cache: danh sách tên nhà hàng / món ăn được load 1 lần và cache 30 phút.

Quy ước kiểu:
  - Catalog key: str(id), luôn là string khi lưu trong cache.
  - Return id:   int, convert tại điểm trả về duy nhất (_extract_from_catalog).
"""

import logging
import re
import unicodedata

from django.core.cache import cache
from rapidfuzz import fuzz, process as fuzz_process

logger = logging.getLogger(__name__)

# ── Cấu hình ─────────────────────────────────────────────────────────────────
_CACHE_KEY_RESTAURANTS = "nlp_extractor_restaurants"
_CACHE_KEY_DISHES      = "nlp_extractor_dishes"
_CACHE_TTL             = 30 * 60   # 30 phút

# Ngưỡng fuzzy theo n-gram: n nhỏ → yêu cầu khớp chặt hơn (ổn định)
_NGRAM_THRESHOLDS: dict[int, int] = {4: 70, 3: 78, 2: 85, 1: 90}

# Ngưỡng khi có PhoBERT entity làm anchor (đã khoanh vùng rồi, nới lỏng được)
_ENTITY_THRESHOLD = 65

# Ngưỡng fallback full-text không có anchor (phải chặt để tránh nhận vơ)
_FULLTEXT_THRESHOLD = 85

_STOP_WORDS: frozenset[str] = frozenset({
    "nhà", "hàng", "quán", "ăn", "tôi", "mình", "bạn", "cần", "muốn",
    "xin", "cho", "biết", "hỏi", "của", "ở", "tại", "có", "không",
    "được", "gì", "nào", "nơi", "là", "thì", "và", "hoặc", "đặt", "bàn",
    "món", "thức", "uống", "ẩm", "thực", "gợi", "ý", "tìm", "kiếm",
    "địa", "chỉ", "số", "điện", "thoại", "giờ", "mở", "cửa",
})


# ── Normalizer helpers ────────────────────────────────────────────────────────

def _normalize(text: str) -> str:
    """Lowercase + bỏ dấu câu + khoảng trắng thừa."""
    text = text.lower().strip()
    text = re.sub(r"[^\w\s]", " ", text)
    return re.sub(r"\s+", " ", text)


def _strip_accents(text: str) -> str:
    """
    Bỏ dấu tiếng Việt để tạo thêm một lượt fuzzy "không dấu".
    Giữ nguyên số/chữ cái để match các tên có hậu tố số như "Corner 97".
    """
    text = unicodedata.normalize("NFD", text)
    text = "".join(ch for ch in text if unicodedata.category(ch) != "Mn")
    return text.replace("đ", "d").replace("Đ", "D")


def _tokenize(text: str) -> list[str]:
    """Tách từ theo khoảng trắng, lọc stop-words và token quá ngắn."""
    return [t for t in _normalize(text).split() if len(t) > 1 and t not in _STOP_WORDS]


def _make_ngrams(tokens: list[str], n: int) -> list[str]:
    return [" ".join(tokens[i: i + n]) for i in range(len(tokens) - n + 1)]


# ── Cache loaders ─────────────────────────────────────────────────────────────

def _get_restaurant_catalog() -> dict[str, str]:
    """Dict {str(id): name} của tất cả nhà hàng APPROVED."""
    catalog = cache.get(_CACHE_KEY_RESTAURANTS)
    if catalog is None:
        from restaurants.models import Restaurant
        rows = Restaurant.objects.filter(status="APPROVED").values_list("id", "name")
        catalog = {str(rid): name for rid, name in rows}
        cache.set(_CACHE_KEY_RESTAURANTS, catalog, timeout=_CACHE_TTL)
        logger.debug(f"[EntityExtractor] Loaded {len(catalog)} restaurants into cache.")
    return catalog


def _get_dish_catalog() -> dict[str, str]:
    """Dict {str(id): name} của tất cả món ăn available."""
    catalog = cache.get(_CACHE_KEY_DISHES)
    if catalog is None:
        try:
            from restaurants.models import MenuItem
            rows = MenuItem.objects.filter(is_available=True).values_list("id", "name")
            catalog = {str(did): name for did, name in rows}
        except Exception:
            catalog = {}
        cache.set(_CACHE_KEY_DISHES, catalog, timeout=_CACHE_TTL)
        logger.debug(f"[EntityExtractor] Loaded {len(catalog)} dishes into cache.")
    return catalog


def invalidate_cache() -> None:
    """Gọi khi có nhà hàng / món ăn mới được thêm / sửa."""
    cache.delete(_CACHE_KEY_RESTAURANTS)
    cache.delete(_CACHE_KEY_DISHES)


# ── Core fuzzy ────────────────────────────────────────────────────────────────

def _fuzzy_one(
    query: str,
    catalog: dict[str, str],
    threshold: int,
) -> tuple[str, int, str] | None:
    """
    Fuzzy match một query với catalog.
    Trả về (matched_name, score, str_id) hoặc None.
    """
    if not query or not catalog:
        return None
    return fuzz_process.extractOne(
        query,
        catalog,
        scorer=fuzz.token_set_ratio,
        score_cutoff=threshold,
    )


def _extract_from_catalog(
    text: str,
    catalog: dict[str, str],
    phobert_entity: str | None,
    entity_threshold: int,
) -> tuple[str | None, int | None]:
    """
    Thuật toán chung cho restaurant và dish:
      1. PhoBERT entity (nếu có)
      2. N-gram (4 → 3 → 2 → 1), chọn score cao nhất
      3. Fallback full-text

    Trả về (matched_name, int_id) hoặc (None, None).
    """
    if not catalog:
        return None, None, 0, []

    candidates_by_id: dict[int, tuple[str, int]] = {}
    catalog_no_accent = {k: _strip_accents(v).lower() for k, v in catalog.items()}

    # Bước 1: PhoBERT entity
    if phobert_entity:
        res = _fuzzy_one(_normalize(phobert_entity), catalog, entity_threshold)
        if res:
            logger.debug(
                f"[Extractor] PhoBERT entity '{phobert_entity}' → '{res[0]}' ({res[1]}%)"
            )
            candidates_by_id[int(res[2])] = (res[0], int(res[1]))
            return res[0], int(res[2]), int(res[1]), [(res[0], int(res[2]), int(res[1]))]

    # Bước 2: N-gram sliding window
    tokens = _tokenize(text)
    if not tokens:
        # Nếu câu chỉ toàn stop-words và không có anchor entity → skip
        if not phobert_entity:
            return None, None

    best_name:  str | None = None
    best_score: int        = 0
    best_n:     int        = 0

    for n in [4, 3, 2]:  # Chỉ lấy từ 2 token trở lên theo yêu cầu user
        if len(tokens) < n:
            continue
        threshold = _NGRAM_THRESHOLDS[n]
        for gram in _make_ngrams(tokens, n):
            # Lớp 1: Có dấu (với processor=lower)
            matches_acc = fuzz_process.extract(
                gram, catalog, scorer=fuzz.token_set_ratio, 
                processor=lambda x: x.lower() if x else "", score_cutoff=threshold, limit=5
            )
            # Lớp 2: Không dấu (cả query và target)
            gram_no_acc = _strip_accents(gram).lower()
            matches_no_acc = fuzz_process.extract(
                gram_no_acc, catalog_no_accent, scorer=fuzz.token_set_ratio, 
                score_cutoff=threshold, limit=5
            )
            
            # Gộp và lấy điểm cao nhất
            for m_name, m_score, m_key in (list(matches_acc) + list(matches_no_acc)):
                m_rid = int(m_key)
                m_score_i = int(m_score)
                # Vì matches_no_acc m_name là tên không dấu, ta lấy lại m_name gốc từ catalog
                real_name = catalog.get(str(m_rid), m_name)
                
                if m_rid not in candidates_by_id or m_score_i > candidates_by_id[m_rid][1]:
                    candidates_by_id[m_rid] = (real_name, m_score_i)
                
                if m_score_i > best_score:
                    best_score = m_score_i
                    best_name  = real_name
                    best_n     = n

    # Chuyển candidates_by_id sang list sorted
    all_candidates = sorted(
        [(name, rid, score) for rid, (name, score) in candidates_by_id.items()],
        key=lambda x: x[2], reverse=True
    )[:5]  # Giảm xuống 5 để gọn gàng

    if best_name is not None:
        # Tìm lại key để lấy id
        for k, v in catalog.items():
            if v == best_name:
                return best_name, int(k), best_score, all_candidates

    # Bước 3: Fallback full-text
    fallback_thresh = entity_threshold if phobert_entity else _FULLTEXT_THRESHOLD
    res = _fuzzy_one(_normalize(text), catalog, fallback_thresh)
    if res:
        logger.debug(f"[Extractor] Fallback full-text → '{res[0]}' ({res[1]}%)")
        cand = (res[0], int(res[2]), int(res[1]))
        if cand not in all_candidates:
            all_candidates.append(cand)
        return res[0], int(res[2]), int(res[1]), sorted(all_candidates, key=lambda x: x[2], reverse=True)

    return None, None, 0, all_candidates


# ── Public API ────────────────────────────────────────────────────────────────

def extract_restaurant_from_text(
    text: str,
    phobert_entity: str | None = None,
    threshold_entity: int = _ENTITY_THRESHOLD,
) -> tuple[str | None, int | None, int]:
    """
    Trích xuất tên nhà hàng từ câu nói người dùng.

    Returns:
        (matched_name, restaurant_id, score, candidates) hoặc (None, None, 0, [])
    """
    catalog = _get_restaurant_catalog()
    return _extract_from_catalog(text, catalog, phobert_entity, threshold_entity)


def extract_restaurant_candidates_from_text(
    text: str,
    phobert_entity: str | None = None,
    max_results: int = 3,
    threshold: int = 50,
) -> list[tuple[str, int, int]]:
    """
    Trả về top N candidates: [(name, id, score), ...]
    Sorted by score desc.
    """
    catalog = _get_restaurant_catalog()
    if not catalog:
        return []
    
    query = _normalize(phobert_entity or text)
    if not query:
        return []

    # ── Pass 1: quét trượt n-gram có dấu ────────────────────────────────────
    # Mục tiêu: với câu dài "tôi muốn đặt bàn hàn quốc corner" vẫn tách được
    # cụm "hàn quốc corner" để fuzzy chính xác hơn quét full-text thô.
    tokens = _tokenize(phobert_entity or text)
    segments: list[str] = []

    if tokens:
        max_n = min(len(tokens), 6)  # giới hạn để tránh nổ số lần fuzzy
        for n in range(max_n, 0, -1):
            segments.extend(_make_ngrams(tokens, n))

    # fallback an toàn khi tokenization quá nghèo dữ liệu
    if not segments:
        segments = [query]

    best_by_id: dict[int, tuple[str, int]] = {}

    for segment in segments:
        matches = fuzz_process.extract(
            segment,
            catalog,
            scorer=fuzz.token_set_ratio,
            score_cutoff=threshold,
            limit=max_results * 3,
        )
        for name, score, key in matches:
            rid = int(key)
            score_i = int(score)
            prev = best_by_id.get(rid)
            if prev is None or score_i > prev[1]:
                best_by_id[rid] = (name, score_i)

    # ── Pass 2: quét trượt n-gram không dấu ─────────────────────────────────
    # Mục tiêu: tăng độ bền khi user nhập không dấu/sai dấu hoặc model NER tách chưa tốt.
    catalog_no_accent = {k: _strip_accents(v).lower() for k, v in catalog.items()}
    segments_no_accent = [_strip_accents(s).lower() for s in segments if s]

    for segment in segments_no_accent:
        if not segment:
            continue
        matches = fuzz_process.extract(
            segment,
            catalog_no_accent,
            scorer=fuzz.token_set_ratio,
            score_cutoff=threshold,
            limit=max_results * 3,
        )
        for _, score, key in matches:
            rid = int(key)
            score_i = int(score)
            canonical_name = catalog.get(str(rid))
            if not canonical_name:
                continue
            prev = best_by_id.get(rid)
            if prev is None or score_i > prev[1]:
                best_by_id[rid] = (canonical_name, score_i)

    sorted_hits = sorted(best_by_id.items(), key=lambda x: x[1][1], reverse=True)[:max_results]
    return [(name, rid, score) for rid, (name, score) in sorted_hits]


def extract_dish_from_text(
    text: str,
    phobert_entity: str | None = None,
    threshold_entity: int = _ENTITY_THRESHOLD,
) -> tuple[str | None, int | None, int]:
    """
    Trích xuất tên món ăn từ câu nói người dùng.

    Returns:
        (matched_name, dish_id, score, candidates) hoặc (None, None, 0, [])
    """
    catalog = _get_dish_catalog()
    return _extract_from_catalog(text, catalog, phobert_entity, threshold_entity)
