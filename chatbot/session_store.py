"""
session_store.py — Lưu trữ memory của LangChain cho từng session_key.
Sử dụng TTLCache (in-memory) cho đơn giản, có thể đổi sang Redis nếu cần cluster.
"""
from cachetools import TTLCache
from langchain_core.messages import HumanMessage, AIMessage

# Cache memory, hết hạn sau 2 tiếng (7200 giây)
_memory_cache = TTLCache(maxsize=1000, ttl=7200)
# Cache riêng cho trạng thái đặt bàn (Booking State)
_booking_state_cache = TTLCache(maxsize=1000, ttl=7200)
# Cache lưu các hành động UI tạm thời (Card, Form) để gửi về FE ở cuối lượt chat
_ui_action_cache = TTLCache(maxsize=1000, ttl=300) # Lưu trong 5 phút

def push_ui_action(session_key: str, action: str, data: dict):
    """Lưu một hành động UI vào cache để gửi về FE sau."""
    if not session_key:
        return
    actions = _ui_action_cache.get(session_key, [])
    actions.append({"action": action, "data": data})
    _ui_action_cache[session_key] = actions

def pop_ui_actions(session_key: str) -> list:
    """Lấy và xoá toàn bộ hành động UI của session hiện tại."""
    if not session_key:
        return []
    actions = _ui_action_cache.pop(session_key, [])
    return actions

MAX_HISTORY_MESSAGES = 10  # Giữ tối đa 10 tin nhắn gần nhất (5 lượt hội thoại)


def get_chat_history(session_key: str) -> list:
    """Lấy lịch sử hội thoại dưới dạng list[BaseMessage] của LangChain."""
    return _memory_cache.get(session_key, [])


def save_interaction(session_key: str, user_message: str, ai_message: str):
    """Lưu 1 lượt user hỏi + AI trả lời vào history."""
    history = _memory_cache.get(session_key, [])
    
    # Bỏ qua nếu user message rỗng (postback)
    if user_message:
        history.append(HumanMessage(content=user_message))
    
    history.append(AIMessage(content=ai_message))
    
    # Trimming
    if len(history) > MAX_HISTORY_MESSAGES:
        history = history[-MAX_HISTORY_MESSAGES:]
        
    _memory_cache[session_key] = history


# ── Booking State Helpers ───────────────────────────────────────────────────

def get_booking_state(session_key: str) -> dict:
    """Lấy trạng thái đặt bàn hiện tại (dict)."""
    return _booking_state_cache.get(session_key, {})


def update_booking_state(session_key: str, new_data: dict):
    """Cập nhật và merge dữ liệu mới vào trạng thái đặt bàn."""
    state = _booking_state_cache.get(session_key, {})
    # Merge dữ liệu, loại bỏ các giá trị None/Empty
    for k, v in new_data.items():
        if v not in [None, "", 0]:
            state[k] = v
    _booking_state_cache[session_key] = state


def clear_booking_state(session_key: str):
    """Xóa trạng thái đặt bàn (sau khi đặt thành công)."""
    if session_key in _booking_state_cache:
        del _booking_state_cache[session_key]
