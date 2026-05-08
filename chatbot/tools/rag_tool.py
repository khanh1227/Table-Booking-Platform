"""
tools/rag_tool.py — Semantic search tool sử dụng ChromaDB vector store.
"""
import logging
from langchain_core.tools import tool

from rag.vectorstore import get_vectorstore

logger = logging.getLogger(__name__)


@tool
def rag_search(query: str) -> str:
    """
    Tìm kiếm ngữ nghĩa (semantic search) nhà hàng, món ăn và FAQ.
    Dùng khi câu hỏi mang tính mô tả, cảm xúc, hoặc không có từ khóa cụ thể.
    Ví dụ: "quán lãng mạn", "phù hợp gia đình có trẻ em", "view đẹp yên tĩnh",
            "đồ ăn healthy", "quán có không gian làm việc", "nhà hàng tốt cho sinh nhật".
    Sau khi nhận được danh sách ID từ tool này, hãy gọi display_results để hiện lên UI.
    Args:
        query: Mô tả hoặc câu hỏi của người dùng bằng tiếng Việt.
    """
    try:
        vs = get_vectorstore()

        # Lấy top 6 kết quả gần nhất về mặt ngữ nghĩa
        results = vs.similarity_search_with_relevance_scores(query, k=6)

        if not results:
            return "RAG: Không tìm thấy kết quả phù hợp với mô tả này."

        restaurants = []
        dishes = []
        faqs = []

        for doc, score in results:
            m = doc.metadata
            doc_type = m.get("type", "unknown")
            relevance = f"{score:.2f}"

            if doc_type == "restaurant":
                restaurants.append((m.get("id"), m.get("name"), relevance))
            elif doc_type == "dish":
                dishes.append((m.get("id"), m.get("name"), m.get("restaurant_name"), relevance))
            elif doc_type == "faq":
                faqs.append(doc.page_content)

        lines = [f"Kết quả tìm kiếm ngữ nghĩa cho '{query}':"]

        if restaurants:
            lines.append("\nNhà hàng phù hợp (dùng ID này với display_results):")
            for rid, name, score in restaurants:
                lines.append(f"  - [ID: {rid}] {name} (độ phù hợp: {score})")

        if dishes:
            lines.append("\nMón ăn phù hợp (dùng ID này với display_results):")
            for did, name, rname, score in dishes:
                lines.append(f"  - [ID: {did}] {name} tại {rname} (độ phù hợp: {score})")

        if faqs:
            lines.append("\nThông tin hữu ích:")
            for faq in faqs[:2]:  # Chỉ lấy 2 FAQ liên quan nhất
                lines.append(f"  {faq}")

        logger.info(f"[RAG] rag_search '{query}': {len(restaurants)} restaurants, {len(dishes)} dishes, {len(faqs)} FAQs")
        return "\n".join(lines)

    except Exception as e:
        logger.error(f"[RAG] rag_search error: {e}", exc_info=True)
        return f"Lỗi tìm kiếm ngữ nghĩa: {e}"
