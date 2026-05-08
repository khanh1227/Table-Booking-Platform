"""
rag/ingest.py — Nạp dữ liệu từ DB và FAQ vào ChromaDB.

Chạy thủ công: python -m rag.ingest
Chạy tự động: được gọi khi server khởi động và mỗi 6 giờ.
"""
import json
import logging
import os

import chromadb
from langchain_core.documents import Document

from rag.vectorstore import CHROMA_PERSIST_DIR, get_embeddings, reset_vectorstore
from tools.db import query

logger = logging.getLogger(__name__)

FAQ_PATH = os.path.join(os.path.dirname(__file__), "..", "data", "faq.json")


# ────────────────────────────────────────────────
# Builders
# ────────────────────────────────────────────────

def _build_restaurant_docs() -> tuple[list[Document], list[str]]:
    rows = query(
        """
        SELECT r.id, r.name, r.description, r.cuisine_type, r.price_range,
               r.rating, r.opening_hours,
               l.district, l.city, l.ward
        FROM restaurants r
        LEFT JOIN locations l ON r.location_id = l.id
        WHERE r.status = 'APPROVED'
        """,
        (),
    )

    PRICE_MAP = {
        "budget": "Bình dân",
        "mid": "Trung bình",
        "high": "Cao cấp",
        "premium": "Cao cấp",
    }

    docs, ids = [], []
    for r in rows:
        raw_price = str(r.get("price_range") or "").strip().lower()
        # Thử parse số trước, nếu không được thì dùng map string
        try:
            price_num = int(raw_price)
            if price_num < 100_000:
                price_label = "Bình dân (dưới 100k)"
            elif price_num <= 300_000:
                price_label = "Trung bình (100–300k)"
            else:
                price_label = "Cao cấp (trên 300k)"
        except ValueError:
            price_label = PRICE_MAP.get(raw_price, "Không rõ mức giá")

        parts = [p for p in [r.get("district"), r.get("city")] if p]
        location_str = ", ".join(parts) if parts else "Không rõ địa chỉ"

        cuisine = r.get('cuisine_type') or 'Đa dạng'
        # Boost cuisine (DEMO: lặp lại 3 lần để vector match cực mạnh)
        cuisine_boosted = f"{cuisine}, {cuisine}, {cuisine}"

        content = (
            f"Ẩm thực: {cuisine_boosted}\n"
            f"Nhà hàng: {r['name']} (ID: {r['id']})\n"
            f"Giá: {price_label}\n"
            f"Đánh giá: {float(r.get('rating') or 0):.1f}/5\n"
            f"Khu vực: {location_str}\n"
            f"Giờ mở cửa: {r.get('opening_hours') or 'Chưa cập nhật'}\n"
            f"Mô tả: {(r.get('description') or '').strip()[:300]}"
        )

        docs.append(Document(
            page_content=content,
            metadata={
                "type": "restaurant",
                "id": int(r["id"]),
                "name": r["name"],
                "cuisine": r.get("cuisine_type") or "",
                "location": location_str,
                "rating": float(r.get("rating") or 0),
            },
        ))
        ids.append(f"rest_{r['id']}")

    logger.info(f"[RAG] Built {len(docs)} restaurant documents.")
    return docs, ids


def _build_dish_docs() -> tuple[list[Document], list[str]]:
    rows = query(
        """
        SELECT mi.id, mi.name, mi.price, mi.description, mi.category,
               r.id AS restaurant_id, r.name AS restaurant_name, r.cuisine_type
        FROM menu_items mi
        JOIN restaurants r ON mi.restaurant_id = r.id
        WHERE mi.is_available = 1 AND r.status = 'APPROVED'
        ORDER BY mi.id
        """,
        (),
    )

    docs, ids = [], []
    for row in rows:
        price_vnd = int(row.get("price") or 0)
        cuisine = row.get("cuisine_type") or ''
        cuisine_boosted = f"{cuisine}, {cuisine}"

        content = (
            f"Ẩm thực: {cuisine_boosted}\n"
            f"Món ăn: {row['name']} (ID: {row['id']})\n"
            f"Giá: {price_vnd:,}đ\n"
            f"Danh mục: {row.get('category') or 'Không phân loại'}\n"
            f"Nhà hàng: {row['restaurant_name']} (ID: {row['restaurant_id']})\n"
            f"Mô tả: {(row.get('description') or '').strip()[:200]}"
        )

        docs.append(Document(
            page_content=content,
            metadata={
                "type": "dish",
                "id": int(row["id"]),
                "name": row["name"],
                "restaurant_id": int(row["restaurant_id"]),
                "restaurant_name": row["restaurant_name"],
                "price": price_vnd,
                "category": row.get("category") or "",
            },
        ))
        ids.append(f"dish_{row['id']}")

    logger.info(f"[RAG] Built {len(docs)} dish documents.")
    return docs, ids


def _load_faq_docs() -> tuple[list[Document], list[str]]:
    try:
        path = os.path.abspath(FAQ_PATH)
        with open(path, encoding="utf-8") as f:
            items = json.load(f)
    except FileNotFoundError:
        logger.warning(f"[RAG] FAQ file not found at {FAQ_PATH}")
        return [], []

    docs, ids = [], []
    for i, item in enumerate(items):
        content = f"Câu hỏi: {item['question']}\nTrả lời: {item['answer']}"
        docs.append(Document(
            page_content=content,
            metadata={"type": "faq", "id": i, "tags": ", ".join(item.get("tags", []))},
        ))
        ids.append(f"faq_{i}")

    logger.info(f"[RAG] Built {len(docs)} FAQ documents.")
    return docs, ids


# ────────────────────────────────────────────────
# Main ingest function
# ────────────────────────────────────────────────

def ingest_all():
    """
    Xóa collection cũ và nạp lại toàn bộ dữ liệu vào ChromaDB.
    Thread-safe, có thể gọi từ background task.
    """
    logger.info("[RAG] Starting ingest...")

    # Xây dựng documents
    rest_docs, rest_ids = _build_restaurant_docs()
    dish_docs, dish_ids = _build_dish_docs()
    faq_docs, faq_ids = _load_faq_docs()

    all_docs = rest_docs + dish_docs + faq_docs
    all_ids = rest_ids + dish_ids + faq_ids

    if not all_docs:
        logger.warning("[RAG] No documents to ingest!")
        return

    # Xóa collection cũ hoàn toàn để tránh trùng lặp
    try:
        client = chromadb.PersistentClient(path=CHROMA_PERSIST_DIR)
        try:
            client.delete_collection("datbanai")
            logger.info("[RAG] Old collection deleted.")
        except Exception:
            pass  # Collection chưa tồn tại → bỏ qua
    except Exception as e:
        logger.warning(f"[RAG] Could not delete old collection: {e}")

    # Reset singleton để force tạo mới
    reset_vectorstore()

    # Tạo vectorstore mới và nạp dữ liệu
    from langchain_chroma import Chroma
    embeddings = get_embeddings()
    vs = Chroma(
        collection_name="datbanai",
        embedding_function=embeddings,
        persist_directory=CHROMA_PERSIST_DIR,
    )
    vs.add_documents(all_docs, ids=all_ids)

    # Reset singleton lần nữa để lần gọi tiếp sẽ load từ disk
    reset_vectorstore()

    logger.info(
        f"[RAG] Ingest done: {len(rest_docs)} restaurants, "
        f"{len(dish_docs)} dishes, {len(faq_docs)} FAQs "
        f"— Total: {len(all_docs)} documents."
    )


if __name__ == "__main__":
    import sys
    sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
    logging.basicConfig(level=logging.INFO)
    ingest_all()
