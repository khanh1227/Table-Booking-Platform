from contextvars import ContextVar
from typing import Optional, List, Dict, Any

current_user_id: ContextVar[Optional[int]] = ContextVar("current_user_id", default=None)
current_session_key: ContextVar[Optional[str]] = ContextVar("current_session_key", default=None)

# Ngăn chứa ngầm để lưu kết quả tool (UI actions) mà không gửi cho LLM
# Mỗi item là một dict: {"action": "...", "data": {...}}
current_tool_actions: ContextVar[List[Dict[str, Any]]] = ContextVar("current_tool_actions", default=[])
