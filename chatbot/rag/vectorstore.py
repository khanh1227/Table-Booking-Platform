"""
rag/vectorstore.py — Singleton ChromaDB vectorstore.
"""
import os
import logging
from langchain_chroma import Chroma
from langchain_openai import OpenAIEmbeddings

logger = logging.getLogger(__name__)

# Thư mục lưu vector database trên disk
CHROMA_PERSIST_DIR = os.path.abspath(
    os.path.join(os.path.dirname(__file__), "..", "..", "chroma_db")
)

_vectorstore: Chroma | None = None


def get_embeddings() -> OpenAIEmbeddings:
    return OpenAIEmbeddings(model="text-embedding-3-small")


def get_vectorstore() -> Chroma:
    """Trả về singleton ChromaDB instance. Tự khởi tạo nếu chưa có."""
    global _vectorstore
    if _vectorstore is None:
        _vectorstore = Chroma(
            collection_name="datbanai",
            embedding_function=get_embeddings(),
            persist_directory=CHROMA_PERSIST_DIR,
        )
        logger.info(f"[RAG] ChromaDB loaded from {CHROMA_PERSIST_DIR}")
    return _vectorstore


def reset_vectorstore():
    """Reset singleton để lần gọi tiếp theo sẽ load lại từ disk."""
    global _vectorstore
    _vectorstore = None
    logger.info("[RAG] Vectorstore singleton reset.")
