"""
Post-NER Enhancement Module — Bổ sung entities mà PhoBERT NER bỏ sót.

Pipeline: PhoBERT predict → **enhance()** → context_manager.resolve()

Các enhancer (theo thứ tự gọi):
  1. CUISINE dictionary lookup     — từ điển ẩm thực chuẩn hoá
  2. DATE / TIME extraction        — dateparser + regex fallback có word-boundary
  3. Anaphora resolution           — "ở đây", "quán này" → inject RESTAURANT từ context
  4. LOCATION regex + dictionary   — quận/huyện TP.HCM, HN, Đà Nẵng
  5. PEOPLE_COUNT regex            — "3 người", "4 khách"
  6. Catalog fuzzy (RESTAURANT / DISH) — tìm trong DB nếu NER bỏ sót

Quy tắc bất biến trong file này:
  - Mọi enhancer KHÔNG được mutate dict truyền vào — luôn return dict mới.
  - Mọi entity trả về là string hoặc không có (không có None value trong dict).
  - CUISINE và DISH là 2 slot riêng biệt.
"""
import re
import logging
import unicodedata
from datetime import date, time, timedelta

import dateparser
from rapidfuzz import fuzz, process as fuzz_process

logger = logging.getLogger(__name__)


# ═══════════════════════════════════════════════════════════════════════════════
# HELPERS
# ═══════════════════════════════════════════════════════════════════════════════

def _normalize_text(text: str) -> str:
    """Lowercase + bỏ dấu câu."""
    text = text.lower().strip()
    text = re.sub(r"[^\w\s]", " ", text)
    return re.sub(r"\s+", " ", text)


def _strip_accents(text: str) -> str:
    text = unicodedata.normalize("NFD", text)
    text = "".join(ch for ch in text if unicodedata.category(ch) != "Mn")
    return text.replace("đ", "d").replace("Đ", "D")


_LOCATION_STOP_WORDS = {
    "goi", "y", "nha", "hang", "o", "tai", "gan", "khu", "vuc", "an",
    "mon", "cho", "toi", "minh", "muon", "tim", "kiem", "duoc", "khong", "nhe",
}

_LOCATION_PREFIXES = [
    "thành phố ", "tp ", "tỉnh ", "quận ", "huyện ", "phường ", "xã ", "thị xã ", "thị trấn "
]


def _scrub_location_prefix(text: str) -> str:
    """Xóa tiền tố hành chính để so khớp tập trung vào tên riêng."""
    t = text.lower().strip()
    # Thử bỏ dấu để xóa chính xác hơn
    t_no_accent = _strip_accents(t)
    for p in _LOCATION_PREFIXES:
        p_no_accent = _strip_accents(p)
        if t_no_accent.startswith(p_no_accent):
            # Cần giữ lại chuỗi gốc nhưng cắt đi phần tiền tố
            # Ví dụ: "Thành phố Hải Phòng" -> "Hải Phòng"
            return text[len(p):].strip()
    return text


def _location_tokens(text: str) -> list[str]:
    norm = _normalize_text(_strip_accents(text))
    # Giữ token số ("1", "10") để không bỏ sót cụm như "quận 1", "quận 10".
    return [t for t in norm.split() if (len(t) > 1 or t.isdigit()) and t not in _LOCATION_STOP_WORDS]


def _build_location_catalog() -> tuple[dict[str, str], dict[str, str], dict[str, str]]:
    """
    Catalog location từ bảng Location trong DB.
    Lấy toàn bộ các cấp hành chính đã có dữ liệu.
    """
    from restaurants.models import Location
    from django.core.cache import cache

    CACHE_KEY = "chatbot_location_catalog"
    cached = cache.get(CACHE_KEY)
    if cached:
        return cached

    labels_with_type: set[tuple[str, str]] = set()
    
    # Lấy unique city, district, ward (lọc bỏ các giá trị rỗng hoặc "N/A")
    cities = Location.objects.exclude(city__isnull=True).values_list("city", flat=True).distinct()
    districts = Location.objects.exclude(district__isnull=True).exclude(district="N/A").values_list("district", flat=True).distinct()
    wards = Location.objects.exclude(ward__isnull=True).exclude(ward="N/A").values_list("ward", flat=True).distinct()

    for item in cities:
        if item and item.strip():
            labels_with_type.add(("city", item.strip()))
    for item in districts:
        if item and item.strip():
            labels_with_type.add(("district", item.strip()))
    for item in wards:
        if item and item.strip():
            labels_with_type.add(("ward", item.strip()))

    # Sort để đảm bảo tính nhất quán của index khi đánh ID string
    sorted_labels = sorted(labels_with_type, key=lambda x: (x[0], x[1]))
    
    catalog = {str(i): label for i, (_, label) in enumerate(sorted_labels)}
    catalog_type = {str(i): level for i, (level, _) in enumerate(sorted_labels)}
    catalog_no_accent = {k: _normalize_text(_strip_accents(v)) for k, v in catalog.items()}
    
    result = (catalog, catalog_no_accent, catalog_type)
    cache.set(CACHE_KEY, result, timeout=3600)  # Cache 1 tiếng
    return result


def _detect_requested_location_level(text: str) -> str | None:
    """
    Suy ra cấp location user đang hỏi để ưu tiên đúng granularity.
    """
    norm = _normalize_text(_strip_accents(text))
    if re.search(r"\b(phuong|xa)\b", norm):
        return "ward"
    if re.search(r"\b(quan|huyen|thi xa|thi tran)\b", norm):
        return "district"
    if re.search(r"\b(thanh pho|tp|tinh)\b", norm):
        return "city"
    return None


def _fuzzy_location_from_text(text: str, location_hint: str | None = None) -> str | None:
    """
    Băm trượt n-gram 1..N từ input rồi fuzzy với toàn bộ catalog địa chỉ DB.
    Chạy 2 pass:
      1) có dấu (normalize thường)
      2) không dấu (input + catalog đều bỏ dấu)
    """
    catalog, catalog_no_accent, catalog_type = _build_location_catalog()
    if not catalog:
        return None, 0, None, []

    source = location_hint or text
    requested_level = _detect_requested_location_level(source or text)
    tokens = _location_tokens(source)
    if not tokens:
        tokens = _location_tokens(text)
    if not tokens:
        return None, 0, None, []

    segments: list[str] = []
    max_n = min(len(tokens), 6)
    for n in range(max_n, 1, -1):  # Chỉ lấy từ 2 token trở lên theo yêu cầu user
        for i in range(len(tokens) - n + 1):
            segments.append(" ".join(tokens[i:i + n]))

    best_key: str | None = None
    best_score = -1
    best_level_bonus = -1
    best_segment: str | None = None
    all_candidates: dict[str, tuple[str, int]] = {} # key -> (label, score)

    # Tạo một catalog phụ đã xóa tiền tố để so khớp
    catalog_scrubbed = {k: _scrub_location_prefix(v) for k, v in catalog.items()}
    catalog_no_accent_scrubbed = {k: _scrub_location_prefix(v) for k, v in catalog_no_accent.items()}

    # So khớp n-gram segments
    for seg in segments:
        seg_norm = _normalize_text(seg)
        seg_no_accent = _normalize_text(_strip_accents(seg))
        seg_token_count = len(seg_norm.split())
        # Threshold theo độ dài: segment ngắn dễ false positive hơn → yêu cầu điểm cao hơn
        # 2 token: 82, 3 token: 75, 4+ token: 70
        dynamic_cutoff = 82 if seg_token_count <= 2 else (75 if seg_token_count == 3 else 70)

        # Thử 4 trường hợp: Full có dấu, Scrubbed có dấu, Full không dấu, Scrubbed không dấu
        checks = [
            (seg_norm, catalog),
            (seg_norm, catalog_scrubbed),
            (seg_no_accent, catalog_no_accent),
            (seg_no_accent, catalog_no_accent_scrubbed),
        ]

        for query, target_catalog in checks:
            res = fuzz_process.extractOne(
                query,
                target_catalog,
                scorer=fuzz.token_set_ratio,
                processor=lambda x: x.lower() if x else "",
                score_cutoff=dynamic_cutoff,
            )
            if res:
                candidate_key = str(res[2])
                candidate_score = int(res[1])
                candidate_level = catalog_type.get(candidate_key)
                level_bonus = 4 if requested_level and candidate_level == requested_level else 0

                all_candidates[candidate_key] = (catalog[candidate_key], candidate_score)

                if (candidate_score > best_score) or (
                    candidate_score == best_score and level_bonus > best_level_bonus
                ):
                    best_key = candidate_key
                    best_score = candidate_score
                    best_level_bonus = level_bonus
                    best_segment = seg

    if best_key is None:
        return None, 0, None, []

    matched_label = catalog.get(best_key)
    if not matched_label:
        return None, 0, None, []

    # Format candidates list for debug
    rankings = sorted(
        [(label, score) for label, score in all_candidates.values()],
        key=lambda x: x[1], reverse=True
    )[:5]  # Giảm xuống 5 để gọn gàng

    return matched_label, best_score, best_segment, rankings


# ═══════════════════════════════════════════════════════════════════════════════
# 1. CUISINE ENHANCEMENT
# ═══════════════════════════════════════════════════════════════════════════════

_CUISINE_DICT: dict[str, str] = {
    # Quốc gia / Vùng miền
    "nhật":       "Nhật",    "nhật bản":  "Nhật",    "japan":     "Nhật",
    "hàn":        "Hàn",     "hàn quốc":  "Hàn",     "korea":     "Hàn",
    "thái":       "Thái",    "thái lan":  "Thái",
    "trung":      "Trung",   "trung quốc": "Trung",  "trung hoa": "Trung",
    "ý":          "Ý",       "italia":    "Ý",        "italian":   "Ý",
    "pháp":       "Pháp",    "france":    "Pháp",
    "việt":       "Việt",    "việt nam":  "Việt",
    "ấn":         "Ấn Độ",  "ấn độ":     "Ấn Độ",
    "mỹ":         "Mỹ",      "âu":        "Âu",       "châu âu":  "Âu",

    # Loại món / phong cách
    "hải sản":    "Hải sản",
    "lẩu":        "Lẩu",
    "nướng":      "Nướng",    "bbq":       "BBQ",      "barbecue": "BBQ",
    "buffet":     "Buffet",
    "chay":       "Chay",     "thuần chay": "Chay",
    "dimsum":     "Dimsum",   "dim sum":   "Dimsum",
    "sushi":      "Sushi",
    "pizza":      "Pizza",
    "steak":      "Steak",    "bít tết":   "Steak",
    "phở":        "Phở",
    "bún":        "Bún",
    "cơm":        "Cơm",
    "bánh":       "Bánh",
    "tây":        "Âu",
}

_CUISINE_PREFIXES:       frozenset[str] = frozenset({"đồ", "món", "ẩm thực", "đồ ăn", "thức ăn", "kiểu"})
_CUISINE_COMBO_PREFIXES: frozenset[str] = frozenset({"lẩu", "nướng", "cơm", "bún", "phở", "bánh"})


def enhance_cuisine(text: str, entities: dict) -> dict:
    """
    Dictionary lookup để bổ sung CUISINE nếu NER bỏ sót.
    Không thay đổi nếu đã có CUISINE.
    """
    if entities.get("CUISINE"):
        # Gán điểm mặc định cho PhoBERT CUISINE nếu chưa có
        if "_scores" not in entities: entities["_scores"] = {}
        if "_debug_rankings" not in entities: entities["_debug_rankings"] = {}
        
        if "CUISINE" not in entities["_scores"]:
            entities["_scores"]["CUISINE"] = 95
            entities["_debug_rankings"]["CUISINE"] = {
                "best_segment": "PhoBERT (AI)",
                "rankings": [(entities["CUISINE"], 95)]
            }
        return entities

    text_lower = _normalize_text(text)
    tokens = text_lower.split()
    found: str | None = None

    # Strategy 1: prefix + cuisine keyword — "đồ nhật", "món hàn"
    for i, token in enumerate(tokens):
        if token in _CUISINE_PREFIXES and i + 1 < len(tokens):
            nxt = tokens[i + 1]
            if nxt in _CUISINE_DICT:
                found = _CUISINE_DICT[nxt]
                break

    # Strategy 2: combo "lẩu thái", "nướng hàn"
    if not found:
        for i, token in enumerate(tokens):
            if token in _CUISINE_COMBO_PREFIXES and i + 1 < len(tokens):
                nxt = tokens[i + 1]
                if nxt in _CUISINE_DICT:
                    prefix_label = _CUISINE_DICT.get(token, token.capitalize())
                    found = f"{prefix_label} {_CUISINE_DICT[nxt]}"
                    break

    # Strategy 3: bigram rồi unigram
    if not found:
        for i in range(len(tokens) - 1):
            bigram = f"{tokens[i]} {tokens[i + 1]}"
            if bigram in _CUISINE_DICT:
                found = _CUISINE_DICT[bigram]
                break
        if not found:
            for token in tokens:
                if token in _CUISINE_DICT and len(token) >= 3:
                    found = _CUISINE_DICT[token]
                    break

    if found:
        result = {**entities, "CUISINE": found}
        if "_scores" not in result: result["_scores"] = {}
        if "_debug_rankings" not in result: result["_debug_rankings"] = {}
        
        result["_scores"]["CUISINE"] = 100
        result["_debug_rankings"]["CUISINE"] = {
            "best_segment": "match from dictionary",
            "rankings": [(found, 100)]
        }
        logger.debug(f"[PostNER] CUISINE enhanced: '{found}' (Score: 100)")
        return result
    return entities


# ═══════════════════════════════════════════════════════════════════════════════
# 2. DATE / TIME ENHANCEMENT
# ═══════════════════════════════════════════════════════════════════════════════

# Dùng compiled pattern với word-boundary để tránh false positive
# "nay" không khớp "ngay", "mai" không khớp "gmail"
_RELATIVE_DATE_PATTERNS: list[tuple[re.Pattern, int]] = [
    (re.compile(r"\bhôm nay\b"),  0),
    (re.compile(r"\bnay\b"),      0),
    (re.compile(r"\bngày mai\b"), 1),
    (re.compile(r"\bmai\b"),      1),
    (re.compile(r"\bngày mốt\b"), 2),
    (re.compile(r"\bmốt\b"),      2),
    (re.compile(r"\bngày kia\b"), 3),
]

_RELATIVE_TIME_MAP: dict[str, time] = {
    "trưa":   time(12, 0),
    "tối":    time(19, 0),
    "chiều":  time(15, 0),
    "sáng":   time(8,  0),
    "khuya":  time(23, 0),
}

_TIME_REGEX = re.compile(r"(\d{1,2})\s*[h:]\s*(\d{2})?")

# Keywords báo hiệu người dùng muốn update slot (không skip nếu đã có)
_UPDATE_KEYWORDS = frozenset(["đổi", "thành", "sửa", "sang", "lại", "thay"])


def enhance_datetime(text: str, entities: dict) -> dict:
    """
    Bổ sung / cập nhật DATE và TIME từ text.

    Output luôn là string:
        DATE → 'dd/mm/yyyy'
        TIME → 'HH:MM'

    Không parse lại nếu đã có đủ cả hai và không phải lệnh update.
    """
    text_lower = text.lower().strip()
    is_update = any(kw in text_lower for kw in _UPDATE_KEYWORDS)

    if not is_update and entities.get("DATE") and entities.get("TIME"):
        return entities

    today = date.today()
    result = {**entities}

    # --- dateparser (engine chính) ---
    parsed = None
    try:
        parsed = dateparser.parse(
            text,
            languages=["vi"],
            settings={
                "PREFER_DATES_FROM": "future",
                "RETURN_AS_TIMEZONE_AWARE": False,
            },
        )
    except Exception as exc:
        logger.debug(f"[PostNER] dateparser error: {exc}")

    if parsed:
        if not result.get("DATE") or is_update:
            if parsed.date() >= today:
                result["DATE"] = parsed.strftime("%d/%m/%Y")
        if not result.get("TIME") or is_update:
            if parsed.hour != 0 or ":" in text:
                result["TIME"] = parsed.strftime("%H:%M")

    # --- Fallback: relative date keyword (word-boundary safe) ---
    if not result.get("DATE"):
        for pattern, delta in _RELATIVE_DATE_PATTERNS:
            if pattern.search(text_lower):
                result["DATE"] = (today + timedelta(days=delta)).strftime("%d/%m/%Y")
                logger.debug(f"[PostNER] DATE via keyword pattern → {result['DATE']}")
                break

    # --- Fallback: "cuối tuần" ---
    if not result.get("DATE") and "cuối tuần" in text_lower:
        days_ahead = 5 - today.weekday()  # Thứ 7
        if days_ahead <= 0:
            result["DATE"] = today.strftime("%d/%m/%Y")
        else:
            result["DATE"] = (today + timedelta(days=days_ahead)).strftime("%d/%m/%Y")
        logger.debug(f"[PostNER] DATE 'cuối tuần' → {result['DATE']}")

    # --- Các thứ trong tuần ---
    if not result.get("DATE"):
        _WEEKDAY_PATTERNS: list[tuple[re.Pattern, int]] = [
            (re.compile(r"\bthứ\s*2\b|\bthứ\s*hai\b"), 0),
            (re.compile(r"\bthứ\s*3\b|\bthứ\s*ba\b"),  1),
            (re.compile(r"\bthứ\s*4\b|\bthứ\s*tư\b"),  2),
            (re.compile(r"\bthứ\s*5\b|\bthứ\s*năm\b"), 3),
            (re.compile(r"\bthứ\s*6\b|\bthứ\s*sáu\b"), 4),
            (re.compile(r"\bthứ\s*7\b|\bthứ\s*bảy\b"), 5),
            (re.compile(r"\bchủ\s*nhật\b|\bcn\b"),      6),
        ]
        for pattern, wd_num in _WEEKDAY_PATTERNS:
            if pattern.search(text_lower):
                delta = (wd_num - today.weekday()) % 7 or 7
                result["DATE"] = (today + timedelta(days=delta)).strftime("%d/%m/%Y")
                logger.debug(f"[PostNER] DATE weekday → {result['DATE']}")
                break

    # --- Fallback: regex dd/mm hoặc dd-mm ---
    if not result.get("DATE"):
        m = re.search(r"(\d{1,2})[/-](\d{1,2})", text_lower)
        if m:
            try:
                day, month = int(m.group(1)), int(m.group(2))
                d = date(today.year, month, day)
                if d < today:
                    d = d.replace(year=today.year + 1)
                result["DATE"] = d.strftime("%d/%m/%Y")
                logger.debug(f"[PostNER] DATE regex dd/mm → {result['DATE']}")
            except ValueError:
                pass

    # --- Fallback TIME: keyword buổi ---
    if not result.get("TIME"):
        for keyword, t in _RELATIVE_TIME_MAP.items():
            if keyword in text_lower:
                result["TIME"] = t.strftime("%H:%M")
                logger.debug(f"[PostNER] TIME keyword '{keyword}' → {result['TIME']}")
                break

    # --- Fallback TIME: regex giờ cụ thể ---
    if not result.get("TIME"):
        m = _TIME_REGEX.search(text_lower)
        if m:
            hour   = int(m.group(1))
            minute = int(m.group(2) or 0)
            if ("chiều" in text_lower or "tối" in text_lower) and hour < 12:
                hour += 12
            if 0 <= hour <= 23 and 0 <= minute <= 59:
                result["TIME"] = f"{hour:02d}:{minute:02d}"
                logger.debug(f"[PostNER] TIME regex → {result['TIME']}")

    return result


# ═══════════════════════════════════════════════════════════════════════════════
# 3. ANAPHORA RESOLUTION
# ═══════════════════════════════════════════════════════════════════════════════

_RESTAURANT_ANAPHORA: list[str] = [
    "ở đây", "ở chỗ này", "chỗ này", "quán này", "nhà hàng này",
    "nhà hàng đó", "quán đó", "chỗ đó",
]

_RESTAURANT_PRONOUN_PATTERN = re.compile(
    r"(?:^|,\s*)(quán|nhà hàng)\s+(?:có|còn|bán|phục vụ|ở)",
    re.IGNORECASE,
)


def resolve_anaphora(text: str, entities: dict, ctx: dict) -> dict:
    """
    Phát hiện đại từ chỉ định và inject RESTAURANT từ context.
    Không thay đổi nếu đã có RESTAURANT hoặc context rỗng.
    """
    if entities.get("RESTAURANT"):
        return entities

    text_lower = text.lower().strip()
    has_anaphora = any(phrase in text_lower for phrase in _RESTAURANT_ANAPHORA)
    if not has_anaphora:
        has_anaphora = bool(_RESTAURANT_PRONOUN_PATTERN.search(text_lower))

    if not has_anaphora:
        return entities

    shown_ids = ctx.get("last_shown_restaurants", [])
    if not shown_ids:
        logger.debug("[PostNER] Anaphora detected but no restaurants in context")
        return entities

    try:
        from restaurants.models import Restaurant
        restaurant = Restaurant.objects.filter(id=shown_ids[0]).only("id", "name").first()
        if restaurant:
            logger.debug(f"[PostNER] Anaphora → '{restaurant.name}' (id={restaurant.id})")
            return {**entities, "RESTAURANT": restaurant.name}
    except Exception as exc:
        logger.warning(f"[PostNER] Anaphora DB error: {exc}")

    return entities


# ═══════════════════════════════════════════════════════════════════════════════
# 4. LOCATION REGEX + DICTIONARY
# ═══════════════════════════════════════════════════════════════════════════════

# Cấu trúc: {alias_lowercase: tên_chuẩn}
# Ưu tiên match dài hơn trước (sorted by length desc trong hàm)
_DISTRICTS: dict[str, str] = {
    # ── TP. HỒ CHÍ MINH ──────────────────────────────────────────────────────
    # Aliases số ↔ chữ: "quận một" → "Quận 1", "quận 1" → "Quận 1"
    "quận 1":   "Quận 1",  "q1":  "Quận 1",  "q.1": "Quận 1",  "quan 1": "Quận 1",
    "quận một": "Quận 1",  "quan mot": "Quận 1",
    "quận 2":   "Quận 2",  "q2":  "Quận 2",  "q.2": "Quận 2",  "quan 2": "Quận 2",
    "quận hai": "Quận 2",  "quan hai": "Quận 2",
    "quận 3":   "Quận 3",  "q3":  "Quận 3",  "q.3": "Quận 3",  "quan 3": "Quận 3",
    "quận ba":  "Quận 3",  "quan ba":  "Quận 3",
    "quận 4":   "Quận 4",  "q4":  "Quận 4",  "q.4": "Quận 4",  "quan 4": "Quận 4",
    "quận bốn": "Quận 4",  "quan bon": "Quận 4",
    "quận 5":   "Quận 5",  "q5":  "Quận 5",  "q.5": "Quận 5",  "quan 5": "Quận 5",
    "quận năm": "Quận 5",  "quan nam": "Quận 5",
    "quận 6":   "Quận 6",  "q6":  "Quận 6",  "q.6": "Quận 6",  "quan 6": "Quận 6",
    "quận sáu": "Quận 6",  "quan sau": "Quận 6",
    "quận 7":   "Quận 7",  "q7":  "Quận 7",  "q.7": "Quận 7",  "quan 7": "Quận 7",
    "quận bảy": "Quận 7",  "quan bay": "Quận 7",
    "quận 8":   "Quận 8",  "q8":  "Quận 8",  "q.8": "Quận 8",  "quan 8": "Quận 8",
    "quận tám": "Quận 8",  "quan tam": "Quận 8",
    "quận 9":   "Quận 9",  "q9":  "Quận 9",  "q.9": "Quận 9",  "quan 9": "Quận 9",
    "quận chín": "Quận 9", "quan chin": "Quận 9",
    "quận 10":  "Quận 10", "q10": "Quận 10", "q.10": "Quận 10", "quan 10": "Quận 10",
    "quận mười": "Quận 10", "quan muoi": "Quận 10",
    "quận 11":  "Quận 11", "q11": "Quận 11", "q.11": "Quận 11", "quan 11": "Quận 11",
    "quận mười một": "Quận 11", "quan muoi mot": "Quận 11",
    "quận 12":  "Quận 12", "q12": "Quận 12", "q.12": "Quận 12", "quan 12": "Quận 12",
    "quận mười hai": "Quận 12", "quan muoi hai": "Quận 12",
    "tân bình":  "Tân Bình",  "tan binh":  "Tân Bình",
    "tân phú":   "Tân Phú",   "tan phu":   "Tân Phú",
    "phú nhuận": "Phú Nhuận", "phu nhuan": "Phú Nhuận",
    "bình thạnh": "Bình Thạnh", "binh thanh": "Bình Thạnh",
    "gò vấp":    "Gò Vấp",    "go vap":    "Gò Vấp",
    "bình tân":  "Bình Tân",  "binh tan":  "Bình Tân",
    "thủ đức":   "Thủ Đức",   "thu duc":   "Thủ Đức",
    "nhà bè":    "Nhà Bè",    "nha be":    "Nhà Bè",
    "hóc môn":   "Hóc Môn",   "hoc mon":   "Hóc Môn",
    "củ chi":    "Củ Chi",    "cu chi":    "Củ Chi",
    "bình chánh": "Bình Chánh", "binh chanh": "Bình Chánh",
    "cần giờ":   "Cần Giờ",   "can gio":   "Cần Giờ",
    # Aliases chữ → số (nếu DB dùng số)
    "thủ dầu một": "Thủ Dầu Một", "thu dau mot": "Thủ Dầu Một",
    "thủ dầu 1":   "Thủ Dầu Một", "thu dau 1":   "Thủ Dầu Một",

    # ── HÀ NỘI ───────────────────────────────────────────────────────────────
    "hoàn kiếm":  "Hoàn Kiếm",  "hoan kiem":  "Hoàn Kiếm",
    "ba đình":    "Ba Đình",    "ba dinh":    "Ba Đình",
    "đống đa":    "Đống Đa",    "dong da":    "Đống Đa",
    "hai bà trưng": "Hai Bà Trưng", "hai ba trung": "Hai Bà Trưng",
    "tây hồ":     "Tây Hồ",    "tay ho":     "Tây Hồ",
    "cầu giấy":   "Cầu Giấy",  "cau giay":   "Cầu Giấy",
    "thanh xuân": "Thanh Xuân", "thanh xuan": "Thanh Xuân",
    "hoàng mai":  "Hoàng Mai",  "hoang mai":  "Hoàng Mai",
    "long biên":  "Long Biên",  "long bien":  "Long Biên",
    "nam từ liêm": "Nam Từ Liêm", "bắc từ liêm": "Bắc Từ Liêm",
    "hà đông":    "Hà Đông",   "ha dong":    "Hà Đông",
    "gia lâm":    "Gia Lâm",   "gia lam":    "Gia Lâm",

    # ── ĐÀ NẴNG ──────────────────────────────────────────────────────────────
    "hải châu":   "Hải Châu",   "hai chau":   "Hải Châu",
    "thanh khê":  "Thanh Khê",  "thanh khe":  "Thanh Khê",
    "sơn trà":    "Sơn Trà",    "son tra":    "Sơn Trà",
    "ngũ hành sơn": "Ngũ Hành Sơn",
    "liên chiểu": "Liên Chiểu", "lien chieu": "Liên Chiểu",
    "cẩm lệ":     "Cẩm Lệ",    "cam le":     "Cẩm Lệ",

    # ── CÁC TỈNH THÀNH PHỔ BIẾN ──────────────────────────────────────────────
    "biên hoà":   "Biên Hoà",   "bien hoa":   "Biên Hoà",
    "vũng tàu":   "Vũng Tàu",   "vung tau":   "Vũng Tàu",
    "nha trang":  "Nha Trang",
    "đà lạt":     "Đà Lạt",     "da lat":     "Đà Lạt",
    "hội an":     "Hội An",     "hoi an":     "Hội An",
    "huế":        "Huế",        "hue":        "Huế",
    "cần thơ":    "Cần Thơ",    "can tho":    "Cần Thơ",
}

# Pre-build sorted keys (dài trước, tránh "quận 1" match trước "quận 10")
_DISTRICT_KEYS_SORTED: list[str] = sorted(_DISTRICTS, key=len, reverse=True)


def enhance_regex_entities(text: str, entities: dict) -> dict:
    """
    Bắt PEOPLE_COUNT bằng regex và LOCATION bằng dictionary lookup.
    Ưu tiên key dài hơn để tránh false match.
    """
    text_lower = text.lower().strip()
    result = {**entities}

    # PEOPLE_COUNT
    if not result.get("PEOPLE_COUNT"):
        m = re.search(
            r"(\d+)\s*(người|ng|nam|nữ|khách|chỗ|bạn|ngừi|ae|anh em)",
            text_lower,
            re.IGNORECASE,
        )
        if m:
            result["PEOPLE_COUNT"] = f"{m.group(1)} người"
            logger.debug(f"[PostNER] PEOPLE_COUNT → '{result['PEOPLE_COUNT']}'")

    # LOCATION
    if not result.get("LOCATION"):
        for key in _DISTRICT_KEYS_SORTED:
            pattern = r"\b" + re.escape(key) + r"\b"
            if re.search(pattern, text_lower):
                result["LOCATION"] = _DISTRICTS[key]
                logger.debug(f"[PostNER] LOCATION → '{result['LOCATION']}'")
                break

    return result


def normalize_location_entity(text: str, entities: dict) -> dict:
    """
    Chuẩn hoá LOCATION theo DB.

    Thứ tự ưu tiên:
      1. Exact / alias match trong _DISTRICTS (xử lý số↔chữ như 'quận một' → 'Quận 1')
      2. Fuzzy DB (n-gram)
      3. Nếu PhoBERT đã cho LOCATION anchor mà cả hai đều fail → vẫn GIỮ giá trị gốc
         (tránh xóa blind khiến RESTAURANT fallback bị kích hoạt sai).
    """
    result = {**entities}
    raw_location = result.get("LOCATION")
    phobert_had_location = raw_location is not None  # PhoBERT đã cho location

    # --- Bước 1: Exact / alias lookup trong _DISTRICTS dict ---
    if raw_location:
        raw_lower = raw_location.lower().strip()
        raw_no_accent = _normalize_text(_strip_accents(raw_location))
        # Thử khớp trực tiếp với keys của _DISTRICTS (bao gồm alias số↔chữ)
        canonical = _DISTRICTS.get(raw_lower) or _DISTRICTS.get(raw_no_accent)
        if canonical:
            result["LOCATION"] = canonical
            if "_scores" not in result: result["_scores"] = {}
            if "_debug_rankings" not in result: result["_debug_rankings"] = {}
            result["_scores"]["LOCATION"] = 100
            result["_debug_rankings"]["LOCATION"] = {
                "best_segment": raw_lower,
                "rankings": [(canonical, 100)]
            }
            logger.debug(f"[PostNER] LOCATION alias match: '{raw_location}' → '{canonical}'")
            return result

    # --- Bước 2: Fuzzy DB ---
    matched_location, score, seg, rankings = _fuzzy_location_from_text(text, raw_location)
    
    if matched_location:
        result["LOCATION"] = matched_location
        if "_scores" not in result: result["_scores"] = {}
        if "_debug_rankings" not in result: result["_debug_rankings"] = {}
        result["_scores"]["LOCATION"] = score
        result["_debug_rankings"]["LOCATION"] = {
            "best_segment": seg,
            "rankings": rankings
        }
    elif phobert_had_location:
        # PhoBERT đã tin tưởng có LOCATION nhưng fuzzy fail → GIỮ nguyên (đừng xóa)
        # để has_location=True vẫn đúng, tránh RESTAURANT false positive scan
        logger.debug(f"[PostNER] LOCATION fuzzy fail but PhoBERT anchor kept: '{raw_location}'")
        if "_scores" not in result: result["_scores"] = {}
        result["_scores"]["LOCATION"] = 50  # Điểm thấp, không ảnh hưởng conflict resolution
    else:
        result.pop("LOCATION", None)
    return result


# ═══════════════════════════════════════════════════════════════════════════════
# 5. CATALOG ENHANCEMENT (Fuzzy Match DB)
# ═══════════════════════════════════════════════════════════════════════════════

def enhance_catalog_entities(text: str, entities: dict) -> dict:
    """
    Validation + Fuzzy match DB để tìm RESTAURANT và DISH.
    - Validate những Entities mà PhoBERT tìm ra. Nếu rác -> Xóa ngay.
    - Fallback: Nếu PhoBERT trượt hoàn toàn, dùng câu gốc quét.
    DISH và CUISINE là 2 slot riêng biệt.

    Quan trọng: Khi đã có LOCATION được xác định rõ, KHÔNG scan câu gốc
    để tìm RESTAURANT, vì nhiều tên địa danh trùng/gần token nhà hàng
    (ví dụ: "quận một" → sai match "Mộc Quán").
    """
    from chatbot.services.entity_extractor import (
        extract_restaurant_from_text,
        extract_dish_from_text,
    )

    result = {**entities}
    has_location = bool(result.get("LOCATION"))

    # -- 1. Validate / Mót RESTAURANT --
    phobert_rest = result.get("RESTAURANT")
    if phobert_rest:
        # PhoBERT đã cho anchor → validate bình thường
        matched_rest_name, rid, score, cands = extract_restaurant_from_text("", phobert_entity=phobert_rest)
    elif not has_location:
        # Không có LOCATION → cho phép scan câu gốc bình thường
        matched_rest_name, rid, score, cands = extract_restaurant_from_text(text, phobert_entity=None)
    else:
        # Đã có LOCATION rõ → KHÔNG scan câu gốc để tránh false positive
        # (vd: "quận một" khớp nhầm "Mộc Quán")
        matched_rest_name, rid, score, cands = None, None, 0, []
        logger.debug("[PostNER] Skipping RESTAURANT fallback scan (LOCATION already found)")
    
    if rid:
        result["RESTAURANT"] = matched_rest_name
        result["restaurant_id"] = rid
        if "_scores" not in result: result["_scores"] = {}
        if "_debug_rankings" not in result: result["_debug_rankings"] = {}
        
        result["_scores"]["RESTAURANT"] = score
        result["_debug_rankings"]["RESTAURANT"] = {"rankings": cands}
        logger.debug(f"[PostNER] Catalog RESTAURANT → '{matched_rest_name}' (Score: {score})")
    else:
        # Ngay cả khi không match được top, vẫn ghi lại candidates nếu có để debug
        if cands:
            if "_debug_rankings" not in result: result["_debug_rankings"] = {}
            result["_debug_rankings"]["RESTAURANT"] = {"rankings": cands}
            
        if "RESTAURANT" in result:
            logger.debug(f"[PostNER] Invalid RESTAURANT from PhoBERT → SCRUBBED!")
            del result["RESTAURANT"]

    # -- 2. Validate / Mót DISH --
    phobert_dish = result.get("DISH")
    if phobert_dish:
        matched_dish_name, did, score, cands = extract_dish_from_text("", phobert_entity=phobert_dish)
    else:
        matched_dish_name, did, score, cands = extract_dish_from_text(text, phobert_entity=None)
    
    if did:
        result["DISH"] = matched_dish_name
        result["dish_id"] = did
        if "_scores" not in result: result["_scores"] = {}
        if "_debug_rankings" not in result: result["_debug_rankings"] = {}
        
        result["_scores"]["DISH"] = score
        result["_debug_rankings"]["DISH"] = {"rankings": cands}
        logger.debug(f"[PostNER] Catalog DISH → '{matched_dish_name}' (Score: {score})")
    else:
        # Ghi lại candidates để debug
        if cands:
            if "_debug_rankings" not in result: result["_debug_rankings"] = {}
            result["_debug_rankings"]["DISH"] = {"rankings": cands}
            
        if "DISH" in result:
            logger.debug(f"[PostNER] Invalid DISH from PhoBERT → SCRUBBED!")
            del result["DISH"]

    return result


# ═══════════════════════════════════════════════════════════════════════════════
# 5.5. ORDINAL REFERENCE RESOLUTION
# ═══════════════════════════════════════════════════════════════════════════════

_ORDINAL_WORD_MAP = {
    "nhất": 0, "đầu tiên": 0, "một": 0, "1": 0,
    "hai": 1, "2": 1,
    "ba": 2, "3": 2,
    "bốn": 3, "tư": 3, "4": 3,
    "năm": 4, "5": 4,
    "sáu": 5, "6": 5,
    "bảy": 6, "7": 6,
    "tám": 7, "8": 7,
    "chín": 8, "9": 8,
    "mười": 9, "10": 9,
    "cuối cùng": -1, "cuối": -1,
}

_ORDINAL_PATTERNS = [
    # "nhà hàng thứ 2", "quán thứ nhất", "cái thứ ba", "món số 2"
    (re.compile(r"(nhà hàng|quán|cái|món)\s+(?:thứ|số)\s+(" + "|".join(_ORDINAL_WORD_MAP.keys()) + r")\b", re.IGNORECASE), True),
    # "cái đầu tiên", "nhà hàng cuối cùng"
    (re.compile(r"(nhà hàng|quán|cái|món)\s+(đầu tiên|cuối cùng|cuối)\b", re.IGNORECASE), True),
    # "thứ 2", "số 3" (không có target đi kèm)
    (re.compile(r"(?:^|\s)(?:thứ|số)\s+(" + "|".join(_ORDINAL_WORD_MAP.keys()) + r")\b", re.IGNORECASE), False),
    # "đầu tiên" (không target)
    (re.compile(r"(?:^|\s)(đầu tiên|cuối cùng)\b", re.IGNORECASE), False),
]

def _parse_ordinal(text: str) -> tuple[int | None, str | None]:
    """Parse text tìm số thứ tự và target rõ ràng."""
    text_lower = text.lower().strip()
    
    for pattern, has_target in _ORDINAL_PATTERNS:
        match = pattern.search(text_lower)
        if match:
            if has_target:
                target_word = match.group(1)
                ordinal_word = match.group(2)
                target_type = "dish" if target_word == "món" else "restaurant"
            else:
                target_type = None
                ordinal_word = match.group(1)
            
            index = _ORDINAL_WORD_MAP.get(ordinal_word)
            return index, target_type
    
    return None, None

def _detect_target(target_type: str | None, text: str, ctx: dict) -> str | None:
    """Xác định target type (restaurant hoặc dish) dựa vào context."""
    if target_type:
        return target_type
    
    last_intent = ctx.get("last_intent")
    if last_intent in ("suggest_dish",):
        return "dish"
    elif last_intent in ("suggest_restaurant", "ask_alternative"):
        return "restaurant"
    
    if "món" in text.lower():
        return "dish"
    if "nhà hàng" in text.lower() or "quán" in text.lower():
        return "restaurant"
        
    return None

def resolve_ordinal_reference(text: str, entities: dict, ctx: dict) -> dict:
    """
    "nhà hàng thứ 2" → ctx["last_shown_restaurants"][1] → inject RESTAURANT name.
    "món thứ 3"       → ctx["last_shown_dishes"][2] → inject DISH name.
    """
    # Nếu đã có rồi thì bỏ qua
    if entities.get("RESTAURANT") or entities.get("DISH"):
        return entities

    index, target_type = _parse_ordinal(text)
    if index is None:
        return entities

    resolved_type = _detect_target(target_type, text, ctx)
    if not resolved_type:
        return entities

    # Get id list from context
    if resolved_type == "restaurant":
        ids = ctx.get("last_shown_restaurants", [])
    else:
        ids = ctx.get("last_shown_dishes", [])

    if not ids:
        logger.debug(f"[PostNER] Found ordinal {index} but no {resolved_type}s in context")
        return entities

    # Resolve -1
    if index == -1:
        index = len(ids) - 1

    if index < 0 or index >= len(ids):
        logger.debug(f"[PostNER] Ordinal index {index} out of bounds for {resolved_type}")
        return entities

    item_id = ids[index]

    try:
        if resolved_type == "restaurant":
            from restaurants.models import Restaurant
            item = Restaurant.objects.filter(id=item_id).only("id", "name").first()
            if item:
                logger.debug(f"[PostNER] Ordinal {index} → RESTAURANT: '{item.name}'")
                return {**entities, "RESTAURANT": item.name}
        else:
            from restaurants.models import MenuItem
            item = MenuItem.objects.filter(id=item_id).only("id", "name").first()
            if item:
                logger.debug(f"[PostNER] Ordinal {index} → DISH: '{item.name}'")
                return {**entities, "DISH": item.name}
    except Exception as exc:
        logger.warning(f"[PostNER] DB error in ordinal resolution: {exc}")

    return entities


# ═══════════════════════════════════════════════════════════════════════════════
# 6. ORCHESTRATOR
# ═══════════════════════════════════════════════════════════════════════════════

def enhance(text: str, phobert_result: dict, ctx: dict) -> dict:
    """
    Gọi tất cả enhancers theo thứ tự ưu tiên.
    Sau đó thực hiện Resolve Conflicts dựa trên điểm số tin cậy.
    """
    entities: dict = dict(phobert_result.get("entities", {}))

    # Chạy chuỗi Enhancers
    entities = enhance_cuisine(text, entities)
    entities = enhance_datetime(text, entities)
    entities = resolve_anaphora(text, entities, ctx)
    entities = enhance_regex_entities(text, entities)
    entities = normalize_location_entity(text, entities)
    entities = resolve_ordinal_reference(text, entities, ctx)
    entities = enhance_catalog_entities(text, entities)

    # ── DEFAULT SCORES FOR PhoBERT NER ───────────────────────────────────────
    # Nếu entity đến từ PhoBERT mà chưa qua Enhancer (chưa có điểm) -> Gán 95.
    if "_scores" not in entities: entities["_scores"] = {}
    for etype in ["RESTAURANT", "DISH", "LOCATION", "PEOPLE_COUNT", "DATE", "TIME"]:
        if entities.get(etype) and etype not in entities["_scores"]:
            entities["_scores"][etype] = 95

    # ── RESOLVE CONFLICTS (Winner-Takes-All by Score) ────────────────────────
    scores = entities.pop("_scores", {})
    
    # Ưu tiên giải quyết Xung đột giữa CUISINE (Ẩm thực) và LOCATION (Địa điểm)
    # Vì đây là cặp thường xuyên bị nhầm lẫn nhất (ví dụ: "Hải sản" vs "Hải An")
    cuisine_val = entities.get("CUISINE")
    loc_val     = entities.get("LOCATION")
    
    if cuisine_val and loc_val:
        cuisine_score = scores.get("CUISINE", 0)
        loc_score     = scores.get("LOCATION", 0)
        
        # Kiểm tra sự chồng lấn về ngữ nghĩa (có chung token quan trọng)
        # normalize để so sánh không dấu
        c_norm = _normalize_text(_strip_accents(cuisine_val))
        l_norm = _normalize_text(_strip_accents(loc_val))
        
        common_tokens = set(c_norm.split()) & set(l_norm.split())
        
        # Nếu có chung token (ví dụ: "hải") -> So điểm
        if common_tokens:
            if cuisine_score >= loc_score:
                logger.debug(f"[PostNER] Conflict Resolved: CUISINE({cuisine_score}) outranks LOCATION({loc_score}) for overlapping context.")
                entities.pop("LOCATION", None)
            else:
                logger.debug(f"[PostNER] Conflict Resolved: LOCATION({loc_score}) outranks CUISINE({cuisine_score}).")
                entities.pop("CUISINE", None)

    # Giải quyết Xung đột giữa RESTAURANT (Nhà hàng) và CUISINE
    rest_val = entities.get("RESTAURANT")
    cuisine_val = entities.get("CUISINE")
    if rest_val and cuisine_val:
        rest_score = scores.get("RESTAURANT", 0)
        cuisine_score = scores.get("CUISINE", 0)
        # Nếu một cái là con của cái kia -> GIỮ CẢ HAI (để search rộng hơn)
        if cuisine_val.lower() in rest_val.lower() or rest_val.lower() in cuisine_val.lower():
            logger.debug(f"[PostNER] Overlapping RESTAURANT & CUISINE -> KEPING BOTH for broader search.")
        else:
            # Nếu chéo nhau hoàn toàn (hiếm khi xảy ra n-gram overlapping mà không chứa nhau) -> So điểm
            if rest_score >= cuisine_score:
                entities.pop("CUISINE", None)
            else:
                entities.pop("RESTAURANT", None)

    # Giải quyết Xung đột giữa DISH (Món ăn) và CUISINE
    dish_val = entities.get("DISH")
    cuisine_val = entities.get("CUISINE")
    if dish_val and cuisine_val:
        dish_score = scores.get("DISH", 0)
        cuisine_score = scores.get("CUISINE", 0)
        # Nếu CUISINE nằm trong DISH (ví dụ "hải sản" trong "lẩu hải sản") -> GIỮ CẢ HAI
        if cuisine_val.lower() in dish_val.lower() or dish_val.lower() in cuisine_val.lower():
            logger.debug(f"[PostNER] Overlapping DISH & CUISINE -> KEPING BOTH for broader search.")
        else:
            if dish_score >= cuisine_score:
                entities.pop("CUISINE", None)
            else:
                entities.pop("DISH", None)

    return entities
