import re
import json
import logging
from typing import Any
from tools.context import current_session_key
from session_store import push_ui_action

# Mapping viết tắt địa danh phổ biến
LOCATION_ALIAS = {
    "q1": "Quận 1", "q2": "Quận 2", "q3": "Quận 3", "q4": "Quận 4", "q5": "Quận 5",
    "q6": "Quận 6", "q7": "Quận 7", "q8": "Quận 8", "q9": "Quận 9", "q10": "Quận 10",
    "q11": "Quận 11", "q12": "Quận 12",
    "hcm": "Hồ Chí Minh", "tp.hcm": "Hồ Chí Minh", "sai gon": "Hồ Chí Minh", "sài gòn": "Hồ Chí Minh",
    "bt": "Bình Thạnh", "gv": "Gò Vấp", "pn": "Phú Nhuận", "tp": "Thủ Đức",
    "tân bình": "Tân Bình", "tân phú": "Tân Phú", "hóc môn": "Hóc Môn", "củ chi": "Củ Chi",
}

def normalize_location_term(term: str) -> str:
    """Chuẩn hoá tên quận/huyện để search SQL chính xác hơn."""
    if not term: return ""
    t = term.lower().strip()
    
    # 1. Alias lookup
    if t in LOCATION_ALIAS:
        return LOCATION_ALIAS[t]
        
    # 2. Xử lý "q1", "q 1" -> "Quận 1"
    match = re.match(r"^q\s*(\d+)$", t)
    if match:
        return f"Quận {match.group(1)}"
        
    return term

def validate_tool_param(p: Any, param_name: str) -> str:
    """
    Kiểm tra và làm sạch tham số tool để tránh lỗi Dictionary lồng nhau 
    do LLM ảo giác hoặc format sai JSON code block.
    
    Returns: string sạch hoặc raise ValueError nếu dữ liệu quá sai.
    """
    if p is None:
        return ""
        
    # Nếu LLM truyền nhầm dictionary (thường gặp khi LLM cố tạo JSON thay vì gọi tool đúng)
    if isinstance(p, dict):
        # Trả về lỗi có tính hướng dẫn để LLM tự sửa ở turn tiếp theo
        msg = f"Tham số '{param_name}' phải là CHUỖI (string), không được là DICTIONARY. " \
              f"Giá trị bạn truyền: {json.dumps(p)}. Hãy truyền trực tiếp chuỗi text."
        raise ValueError(msg)
        
    s = str(p).strip()
    
    # Xử lý trường hợp chuỗi chứa JSON rác do LLM ảo giác
    if s.startswith("{") and "{" in s and "}" in s:
        msg = f"Tham số '{param_name}' không được chứa chuỗi JSON. " \
              f"Vui lòng chỉ truyền text thuần túy."
        raise ValueError(msg)
        
    return s

def _build_tool_result(action: str, data: dict, summary: str, hide_from_llm: bool = False) -> str:
    """
    Xử lý kết quả tool:
    - Luôn đẩy action/data vào cache (session_store) để Backend xử lý UI.
    - Nếu hide_from_llm=True: Chỉ trả về text tóm tắt cho LLM (tiết kiệm token).
    - Nếu hide_from_llm=False: Trả về cả text và marker JSON cho LLM.
    """
    if action != "SHOW_INFO":
        session_key = current_session_key.get()
        if session_key:
            push_ui_action(session_key, action, data)
    
    marker = json.dumps({"action": action, "data": data}, ensure_ascii=False)
    
    if hide_from_llm:
        return summary
    else:
        return f"{summary}\n__TOOL_RESULT__: {marker}"
