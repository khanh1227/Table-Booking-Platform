# restaurants/search/fusion.py
"""
Reciprocal Rank Fusion (RRF) — v2.

Nâng cấp so với v1:
- Adaptive weight: BM25_WEIGHT tự điều chỉnh theo độ dài và loại query
  (query ngắn/keyword → lean BM25; query dài/ngữ nghĩa → lean vector)
- Geo pre-filter: chỉ merge restaurants trong city của user, không merge toàn quốc
- query_context được truyền vào mỗi entry để downstream (personalize) dùng cho near-me boost
- Giữ nguyên công thức RRF chuẩn (Cormack et al., 2009)
"""
import logging

logger = logging.getLogger(__name__)

RRF_K = 60  # Hằng số RRF — không thay đổi


# ── Adaptive weight ────────────────────────────────────────────────────────────

def _compute_bm25_weight(query: str) -> float:
    """
    Tính BM25 weight động dựa theo đặc điểm của query.

    Logic:
    - Query ngắn (≤ 2 từ): thường là keyword cụ thể ("bún bò", "quận 1")
      → BM25 match chính xác tốt hơn → weight cao (0.70)
    - Query trung bình (3-5 từ): cân bằng 50/50
      → weight mặc định (0.50)
    - Query dài (≥ 6 từ): thường là câu tự nhiên ("muốn ăn chỗ lãng mạn view đẹp")
      → vector semantic search tốt hơn → weight thấp (0.30)
    - Query có dấu hỏi hoặc cấu trúc câu → lean vector thêm
    """
    words = query.strip().split()
    n = len(words)

    if n <= 2:
        base_weight = 0.70
    elif n <= 5:
        # Linear interpolation từ 0.70 → 0.50 theo số từ
        base_weight = 0.70 - (n - 2) * 0.067
    else:
        # Linear interpolation từ 0.50 → 0.30 khi query dài dần
        base_weight = max(0.30, 0.50 - (n - 5) * 0.04)

    # Giảm thêm nếu query có cấu trúc câu hỏi tự nhiên
    question_indicators = ["muốn", "tìm", "gợi ý", "đề xuất", "cho tôi", "ở đâu",
                           "như thế nào", "có chỗ nào", "?"]
    query_lower = query.lower()
    if any(ind in query_lower for ind in question_indicators):
        base_weight = max(0.25, base_weight - 0.10)

    logger.debug(f"[RRF] query='{query[:40]}' words={n} bm25_weight={base_weight:.2f}")
    return base_weight


# ── Main fusion ────────────────────────────────────────────────────────────────

def reciprocal_rank_fusion(
    bm25_results: list,          # [(restaurant_obj, score), ...]
    vector_results: list,        # [(restaurant_id: int, score), ...]
    query: str = "",             # Truyền vào để adaptive weight + query_context
    top_k: int = 30,
    city_filter: str | None = None,   # Geo pre-filter: chỉ lấy kết quả trong city này
    district_filter: str | None = None,  # Pre-filter ở level district (hẹp hơn)
) -> list[dict]:
    """
    Kết hợp kết quả BM25 và Vector bằng RRF.

    Nâng cấp:
    - BM25_WEIGHT adaptive theo query
    - Geo pre-filter (city/district) trước khi merge, tránh lãng phí slot ranking
    - query_context lưu vào mỗi entry để personalize.py dùng near-me boost

    Returns: list of {
        'restaurant': Restaurant obj,
        'rrf_score': float,
        'bm25_rank': int | None,
        'vector_rank': int | None,
        'match_type': 'both' | 'bm25_only' | 'vector_only',
        'query_context': str,     ← mới: query gốc để downstream xử lý
    }
    """
    bm25_weight = _compute_bm25_weight(query) if query else 0.5
    vector_weight = 1.0 - bm25_weight

    rrf_map = {}  # restaurant_id → entry dict

    # ── BM25 contribution ──────────────────────────────────────────────────────
    for rank, (restaurant, _bm25_score) in enumerate(bm25_results):
        # Geo pre-filter (flexible match)
        r_city = (restaurant.location.city or '').lower() if restaurant.location else ''
        r_dist = (restaurant.location.district or '').lower() if restaurant.location else ''
        
        if city_filter and city_filter.lower() not in r_city:
            logger.debug(f"[RRF] Skip BM25 {restaurant.name}: city mismatch ('{city_filter}' not in '{r_city}')")
            continue
        if district_filter and district_filter.lower() not in r_dist:
            logger.debug(f"[RRF] Skip BM25 {restaurant.name}: district mismatch ('{district_filter}' not in '{r_dist}')")
            continue

        rid = restaurant.id
        if rid not in rrf_map:
            rrf_map[rid] = _new_entry(restaurant, query)
        
        boost = bm25_weight * (1.0 / (RRF_K + rank + 1))
        rrf_map[rid]['rrf_score'] += boost
        rrf_map[rid]['bm25_rank'] = rank + 1
        logger.debug(f"[RRF] BM25 Rank {rank+1} for {restaurant.name}: +{boost:.6f}")

    # ── Vector contribution ────────────────────────────────────────────────────
    vector_ids = [rid for rid, _ in vector_results]
    if vector_ids:
        from restaurants.models import Restaurant
        rest_by_id = {
            r.id: r
            for r in Restaurant.objects.filter(
                id__in=vector_ids, status='APPROVED'
            ).select_related('location').prefetch_related('images')
        }

        for rank, (rid, _vec_score) in enumerate(vector_results):
            restaurant = rest_by_id.get(rid)
            if restaurant is None:
                continue

            # Geo pre-filter cho vector results
            r_city = (restaurant.location.city or '').lower() if restaurant.location else ''
            r_dist = (restaurant.location.district or '').lower() if restaurant.location else ''
            
            if city_filter and city_filter.lower() not in r_city:
                logger.debug(f"[RRF] Skip Vector {restaurant.name}: city mismatch")
                continue
            if district_filter and district_filter.lower() not in r_dist:
                logger.debug(f"[RRF] Skip Vector {restaurant.name}: district mismatch")
                continue

            if rid not in rrf_map:
                rrf_map[rid] = _new_entry(restaurant, query)
            
            boost = vector_weight * (1.0 / (RRF_K + rank + 1))
            rrf_map[rid]['rrf_score'] += boost
            rrf_map[rid]['vector_rank'] = rank + 1
            logger.debug(f"[RRF] Vector Rank {rank+1} for {restaurant.name}: +{boost:.6f}")

    # ── Xác định match_type ────────────────────────────────────────────────────
    for entry in rrf_map.values():
        if entry['bm25_rank'] and entry['vector_rank']:
            entry['match_type'] = 'both'
        elif entry['bm25_rank']:
            entry['match_type'] = 'bm25_only'
        else:
            entry['match_type'] = 'vector_only'

    # ── Sort by RRF score ──────────────────────────────────────────────────────
    merged = sorted(rrf_map.values(), key=lambda x: x['rrf_score'], reverse=True)

    logger.info(
        f"[RRF] bm25_weight={bm25_weight:.2f} | "
        f"BM25={len(bm25_results)} + Vector={len(vector_results)} "
        f"→ {len(merged)} unique (geo_filter: city={city_filter}, district={district_filter})"
    )
    return merged[:top_k]


def _new_entry(restaurant, query: str) -> dict:
    """Tạo entry mới cho rrf_map với query_context."""
    return {
        'restaurant': restaurant,
        'rrf_score': 0.0,
        'bm25_rank': None,
        'vector_rank': None,
        'match_type': None,
        'query_context': query,  # ← downstream (personalize) dùng near-me boost
    }
