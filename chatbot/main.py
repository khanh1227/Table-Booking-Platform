"""
main.py — FastAPI endpoint cho chatbot service.
"""
import uuid
import asyncio
import logging
import time
import random
import string
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from agent import chat_with_agent, chat_with_agent_astream
from session_store import get_chat_history, save_interaction
from tools.context import current_user_id

# Setup logging
logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s")
logger = logging.getLogger(__name__)

def random_string(length=10):
    return ''.join(random.choices(string.ascii_letters + string.digits, k=length))

# ─── RAG Re-index interval (giây) ───────────────────
RAG_REINDEX_INTERVAL = 6 * 3600  # 6 giờ


def _run_ingest():
    """Chạy ingest đồng bộ trong thread riêng (không block event loop)."""
    try:
        from rag.ingest import ingest_all
        ingest_all()
    except Exception as e:
        logger.error(f"[RAG] Ingest failed: {e}", exc_info=True)


async def _periodic_reindex():
    """Background task: re-index ChromaDB mỗi RAG_REINDEX_INTERVAL giây."""
    while True:
        await asyncio.sleep(RAG_REINDEX_INTERVAL)
        logger.info("[RAG] Periodic re-index triggered.")
        loop = asyncio.get_event_loop()
        await loop.run_in_executor(None, _run_ingest)


@asynccontextmanager
async def lifespan(app: FastAPI):
    # ── Startup ──────────────────────────────────────
    import os
    enable_ingest = os.getenv("ENABLE_RAG_INGEST", "true").lower() == "true"
    
    if enable_ingest:
        logger.info("[RAG] ENABLE_RAG_INGEST=true: Running initial ingest in background...")
        asyncio.create_task(asyncio.to_thread(_run_ingest))
        # Bắt đầu periodic re-index task
        reindex_task = asyncio.create_task(_periodic_reindex())
    else:
        logger.info("[RAG] ENABLE_RAG_INGEST=false: Startup ingestion disabled. Using existing chroma_db. ✅")
        reindex_task = None

    yield

    # ── Shutdown ─────────────────────────────────────
    if reindex_task:
        reindex_task.cancel()
        try:
            await reindex_task
        except asyncio.CancelledError:
            pass
        logger.info("[RAG] Periodic reindex task stopped.")


app = FastAPI(title="DatBanNV Chatbot LLM Service", lifespan=lifespan)

# CORS setup for FE
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Nên giới hạn lại port của FE ở môi trường prod
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class ChatRequest(BaseModel):
    message: str | None = None
    postback: dict | None = None
    session_key: str | None = None
    user_token: str | None = None  # Nhận JWT (Mở rộng cho tương lai khi FE truyền sang)
    user_id: int | None = None     # Thêm user_id để định danh người dùng

class ChatResponse(BaseModel):
    session_key: str
    message: str
    action: str
    action_data: dict


@app.post("/chat", response_model=ChatResponse)
def chat_endpoint(request: ChatRequest):
    """
    Nhận tin nhắn từ FE, chuyển cho LangChain Agent xử lý bằng tool calling,
    trả về format chuẩn mà FE đang mong đợi.
    """
    message_text = (request.message or "").strip()
    session_key = request.session_key or str(uuid.uuid4())
    user_id = request.user_id
    current_user_id.set(user_id)
    from tools.context import current_session_key
    current_session_key.set(session_key)
    # 1. Handle message vs postback
    # (Nếu có UI postback "Đặt Bàn" thì parse thành text để LLM hiểu)
    if not message_text and request.postback:
        pb = request.postback
        # Giả lập text để truyền vào agent như 1 system instruction ngầm định
        action_type = pb.get("action", "")
        if action_type == "chon_nha_hang":
            message_text = f"Tôi chọn nhà hàng {pb.get('restaurant_name', '')}"
        elif action_type == "xem_menu":
            message_text = f"Cho tôi xem menu của {pb.get('restaurant_name', '')}"
        elif action_type == "booking_success":
            from session_store import clear_booking_state
            clear_booking_state(session_key)
            message_text = "[HỆ THỐNG]: Khách hàng vừa đặt bàn THÀNH CÔNG trên giao diện. Hãy chúc mừng khách chân thành."
        else:
             message_text = "Tiếp tục luồng hiện tại"

    
    if not message_text:
         raise HTTPException(status_code=400, detail="message or postback is required")

    user_id = request.user_id
    session_key = request.session_key or f"sess_{random_string(10)}_{int(time.time())}"
    
    # Lấy ngữ cảnh người dùng ngay từ đầu để tiêm vào Prompt (tránh Agent gọi tool lặp lại)
    user_context_info = "Khách vãng lai (Chưa đăng nhập)"
    if user_id:
        from tools.user_tools import get_user_context, get_user_booking_history
        u_info = get_user_context.invoke({})
        u_history = get_user_booking_history.invoke({})
        user_context_info = f"{u_info}\n{u_history}"
    
    logger.info(f"[{session_key}] User (ID: {user_id}): {message_text}")
    
    # 3. Chạy qua Agent
    msg_out, action, action_data = chat_with_agent(
        message=message_text,
        session_key=session_key,
        user_id=user_id,
        user_context_info=user_context_info
    )
    
    logger.info(f"[{session_key}] Bot: {msg_out} (Action: {action})")

    # 4. Save history
    save_interaction(session_key, message_text, msg_out)

    return ChatResponse(
        session_key=session_key,
        message=msg_out,
        action=action,
        action_data=action_data,
    )


@app.post("/chat/stream")
async def chat_stream_endpoint(request: ChatRequest):
    """
    Endpoint hỗ trợ Streaming trả về từng token và action cuối cùng.
    """
    message_text = (request.message or "").strip()
    session_key = request.session_key or str(uuid.uuid4())
    user_id = request.user_id
    
    if not message_text and request.postback:
        # Xử lý postback giống endpoint cũ
        pb = request.postback
        action_type = pb.get("action", "")
        if action_type == "chon_nha_hang":
            message_text = f"Tôi chọn nhà hàng {pb.get('restaurant_name', '')}"
        elif action_type == "xem_menu":
            message_text = f"Cho tôi xem menu của {pb.get('restaurant_name', '')}"
        elif action_type == "booking_success":
            from session_store import clear_booking_state
            clear_booking_state(session_key)
            message_text = "[HỆ THỐNG]: Khách hàng vừa đặt bàn THÀNH CÔNG trên giao diện. Hãy chúc mừng khách chân thành."

    if not message_text:
         raise HTTPException(status_code=400, detail="message or postback is required")

    user_id = request.user_id
    current_user_id.set(user_id)
    from tools.context import current_session_key
    current_session_key.set(session_key)
    
    # message_text = request.message  <-- BUG: Đã xử lý ở trên, không được overwrite lại
    # Lấy ngữ cảnh người dùng ngay từ đầu
    user_context_info = "Khách vãng lai (Chưa đăng nhập)"
    if user_id:
        from tools.user_tools import get_user_context, get_user_booking_history
        u_info = get_user_context.invoke({})
        u_history = get_user_booking_history.invoke({})
        user_context_info = f"{u_info}\n{u_history}"

    logger.info(f"[{session_key}] User (ID: {user_id}) (Stream): {message_text}")
    
    async def event_generator():
        full_response = ""
        
        async for chunk in chat_with_agent_astream(
            message=message_text,
            session_key=session_key,
            user_id=user_id,
            user_context_info=user_context_info
        ):
            # Chunk từ agent đã là JSON string
            import json
            data = json.loads(chunk)
            
            if data["type"] == "text":
                full_response += data["content"]

            yield f"data: {chunk}\n\n"

        # Sau khi stream xong, lưu vào history
        save_interaction(session_key, message_text, full_response)

    return StreamingResponse(
        event_generator(), 
        media_type="text/event-stream",
        headers={
            "X-Accel-Buffering": "no",
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
        }
    )


@app.get("/health")
def health_check():
    return {"status": "ok", "service": "chatbot_llm"}
