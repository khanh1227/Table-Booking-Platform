# restaurants/search/vector_engine.py
"""
Vector search engine dùng ChromaDB — v2.

Nâng cấp so với v1:
- Cosine distance thay vì L2 (đúng metric cho OpenAI text-embedding-3-small)
- Query personalization: inject user preference vào query trước khi embed
- Bảo mật: xóa code đọc .env chatbot, chỉ dùng Django settings / env var
- Collection migration helper: tự động tạo collection mới với cosine nếu cần
"""
import logging
import os

logger = logging.getLogger(__name__)

CHROMA_DB_PATH = os.path.abspath(
    os.path.join(os.path.dirname(__file__), '..', '..', '..', 'chroma_db')
)
COLLECTION_NAME = "datbanai"
COLLECTION_NAME_COSINE = "datbanai_cosine"  # collection mới dùng cosine metric
EMBEDDING_MODEL = "text-embedding-3-small"


# ── API key — an toàn ──────────────────────────────────────────────────────────

def _get_openai_key() -> str | None:
    """
    Lấy OpenAI key chỉ từ Django settings hoặc biến môi trường.
    KHÔNG còn đọc file .env từ module khác (security risk đã được loại bỏ).
    """
    # 1. Django settings (ưu tiên — cấu hình tập trung)
    try:
        from django.conf import settings
        key = getattr(settings, 'OPENAI_API_KEY', None)
        if key:
            return key
    except Exception:
        pass

    # 2. OS environ (Docker, k8s secrets, CI/CD)
    return os.environ.get('OPENAI_API_KEY')


# ── Embedding ──────────────────────────────────────────────────────────────────

def build_personalized_query(query: str, user_profile: dict | None) -> str:
    """
    Inject user preference context vào query trước khi embed.

    Ví dụ:
      query = "nhà hàng ngon"
      user_profile = {fav_cuisines: {'Hải sản': 3}, fav_districts: {'Quận 1': 2}}
      → "nhà hàng ngon [preference: Hải sản, Quận 1]"

    Mục đích: đẩy query vector về gần không gian sở thích của user,
    giúp semantic search trả kết quả phù hợp hơn ngay cả khi query chung chung.

    Không inject nếu query đã cụ thể (>= 4 từ) để tránh override intent rõ ràng.
    """
    if not user_profile:
        return query

    query_words = query.strip().split()
    if len(query_words) >= 4:
        # Query đã đủ cụ thể, không cần personalize
        return query

    context_parts = []

    # Top 2 cuisine ưa thích
    fav_cuisines = user_profile.get('fav_cuisines') or {}
    top_cuisines = sorted(fav_cuisines.items(), key=lambda x: x[1], reverse=True)[:2]
    if top_cuisines:
        context_parts.append(", ".join(c for c, _ in top_cuisines))

    # Top 1 district ưa thích
    fav_districts = user_profile.get('fav_districts') or {}
    top_district = sorted(fav_districts.items(), key=lambda x: x[1], reverse=True)
    if top_district:
        context_parts.append(top_district[0][0])

    if not context_parts:
        return query

    context = ", ".join(context_parts)
    personalized = f"{query} [preference: {context}]"
    logger.debug(f"[Vector] Personalized query: '{personalized}'")
    return personalized


def embed_query(query: str, user_profile: dict | None = None) -> list[float] | None:
    """
    Tạo embedding cho query text bằng OpenAI API.
    Nếu có user_profile, inject context trước khi embed.
    Returns None nếu không có API key hoặc lỗi.
    """
    api_key = _get_openai_key()
    if not api_key:
        logger.warning("[Vector] OPENAI_API_KEY not found, skipping vector search")
        return None

    personalized_query = build_personalized_query(query, user_profile)

    try:
        from openai import OpenAI
        client = OpenAI(api_key=api_key)
        response = client.embeddings.create(
            model=EMBEDDING_MODEL,
            input=personalized_query,
        )
        return response.data[0].embedding
    except Exception as e:
        logger.error(f"[Vector] Embedding error: {e}")
        return None


# ── ChromaDB connection ────────────────────────────────────────────────────────

def _get_collection(client):
    """
    Trả về collection với cosine metric.
    Ưu tiên collection mới (cosine), fallback sang collection cũ (L2) nếu chưa migrate.
    """
    # Thử collection cosine trước (đã migrate)
    try:
        col = client.get_collection(COLLECTION_NAME_COSINE)
        return col, "cosine"
    except Exception:
        pass

    # Fallback: collection cũ L2
    try:
        col = client.get_collection(COLLECTION_NAME)
        logger.warning(
            "[Vector] Using legacy L2 collection. Run migrate_to_cosine() to upgrade."
        )
        return col, "l2"
    except Exception as e:
        raise RuntimeError(f"No usable collection found: {e}") from e


def _distance_to_score(dist: float, metric: str) -> float:
    """
    Convert distance → score [0, 1] theo đúng metric.

    - Cosine: distance = 1 - cosine_similarity, range [0, 2]
              score = 1 - (dist / 2)  →  range [0, 1], cao hơn = tốt hơn
    - L2:     score = 1 / (1 + dist)  →  range (0, 1], cao hơn = tốt hơn
              (giữ nguyên behavior cũ cho collection chưa migrate)
    """
    if metric == "cosine":
        return max(0.0, 1.0 - dist / 2.0)
    else:
        return 1.0 / (1.0 + dist)


# ── Main search ────────────────────────────────────────────────────────────────

def vector_search(
    query: str,
    top_k: int = 30,
    user_profile: dict | None = None,
    city_filter: str | None = None,
) -> list[tuple]:
    """
    Semantic search trong ChromaDB.

    Nâng cấp:
    - Dùng cosine distance (đúng cho OpenAI embeddings)
    - Inject user_profile vào query embedding
    - city_filter: chỉ lấy kết quả trong city, tránh merge toàn quốc

    Returns: [(restaurant_id: int, normalized_score: float), ...]
             score trong [0, 1], cao hơn = tốt hơn
             [] nếu ChromaDB chưa có hoặc lỗi
    """
    # 1. Embed query (có personalization)
    query_embedding = embed_query(query, user_profile=user_profile)
    if query_embedding is None:
        return []

    # 2. Kết nối ChromaDB
    if not os.path.exists(CHROMA_DB_PATH):
        logger.warning(f"[Vector] ChromaDB not found at {CHROMA_DB_PATH}")
        return []

    try:
        import chromadb
        client = chromadb.PersistentClient(path=CHROMA_DB_PATH)
        collection, metric = _get_collection(client)
    except Exception as e:
        logger.error(f"[Vector] ChromaDB connection error: {e}")
        return []

    # 3. Build where filter
    where_filter: dict = {"type": "restaurant"}
    if city_filter:
        # Nếu collection có metadata city, filter trước để tránh merge toàn quốc
        where_filter = {"$and": [{"type": "restaurant"}, {"city": city_filter}]}

    # 4. Query
    try:
        n_results = min(top_k, collection.count())
        if n_results == 0:
            return []

        results = collection.query(
            query_embeddings=[query_embedding],
            n_results=n_results,
            where=where_filter,
            include=["metadatas", "distances"],
        )
    except Exception as e:
        # Có thể city_filter field không tồn tại trong metadata → retry không filter
        if city_filter:
            logger.warning(f"[Vector] city_filter failed ({e}), retrying without filter")
            try:
                results = collection.query(
                    query_embeddings=[query_embedding],
                    n_results=min(top_k, collection.count()),
                    where={"type": "restaurant"},
                    include=["metadatas", "distances"],
                )
            except Exception as e2:
                logger.error(f"[Vector] Query error: {e2}")
                return []
        else:
            logger.error(f"[Vector] Query error: {e}")
            return []

    if not results or not results.get('metadatas'):
        return []

    metadatas = results['metadatas'][0]
    distances = results['distances'][0]

    if not metadatas:
        return []

    # 5. Convert distance → score theo đúng metric
    scored = []
    for meta, dist in zip(metadatas, distances):
        restaurant_id = meta.get('id')
        if restaurant_id is None:
            continue
        score = _distance_to_score(dist, metric)
        scored.append((int(restaurant_id), score))

    # 6. Normalize về [0, 1] dựa trên max score trong batch
    if scored:
        max_score = max(s for _, s in scored)
        if max_score > 0:
            scored = [(rid, s / max_score) for rid, s in scored]

    logger.info(
        f"[Vector] Found {len(scored)} results (metric={metric}) "
        f"for query: '{query[:50]}'"
    )
    return scored


# ── Migration helper ───────────────────────────────────────────────────────────

def migrate_to_cosine(batch_size: int = 100):
    """
    One-time migration: tạo collection mới với cosine metric từ collection L2 cũ.

    Chạy một lần sau khi deploy:
        from restaurants.search.vector_engine import migrate_to_cosine
        migrate_to_cosine()

    Giữ nguyên collection cũ để rollback nếu cần.
    """
    if not os.path.exists(CHROMA_DB_PATH):
        logger.error("[Vector] ChromaDB not found, cannot migrate")
        return False

    try:
        import chromadb
        client = chromadb.PersistentClient(path=CHROMA_DB_PATH)

        old_col = client.get_collection(COLLECTION_NAME)
        total = old_col.count()
        logger.info(f"[Vector] Starting migration: {total} documents → cosine metric")

        # Tạo collection mới với cosine distance
        try:
            new_col = client.get_collection(COLLECTION_NAME_COSINE)
            logger.info("[Vector] Cosine collection already exists, skipping migration")
            return True
        except Exception:
            new_col = client.create_collection(
                name=COLLECTION_NAME_COSINE,
                metadata={"hnsw:space": "cosine"},
            )

        # Copy theo batch
        offset = 0
        while offset < total:
            batch = old_col.get(
                limit=batch_size,
                offset=offset,
                include=["embeddings", "metadatas", "documents"],
            )
            if not batch["ids"]:
                break

            new_col.add(
                ids=batch["ids"],
                embeddings=batch["embeddings"],
                metadatas=batch["metadatas"],
                documents=batch["documents"],
            )
            offset += len(batch["ids"])
            logger.info(f"[Vector] Migrated {offset}/{total}")

        logger.info(f"[Vector] Migration complete: {COLLECTION_NAME_COSINE} ready")
        return True

    except Exception as e:
        logger.error(f"[Vector] Migration failed: {e}")
        return False
