"""
user_tools.py — Tools lấy thông tin và ngữ cảnh người dùng.
"""
import logging
from langchain_core.tools import tool
from tools.db import query
from tools.utils import validate_tool_param

from tools.context import current_user_id

logger = logging.getLogger(__name__)

@tool
def get_user_context() -> str:
    """
    Lấy thông tin ngữ cảnh của người dùng từ Database.
    Thông tin bao gồm: Tên, Vị trí gần nhất (Quận/Thành phố), Tọa độ GPS.
    Sử dụng thông tin này để chào hỏi cá nhân hóa và gợi ý quán ăn quanh vị trí của khách.
    """
    try:
        user_id = current_user_id.get()
        if user_id is None:
            return "Khách vãng lai (Chưa đăng nhập)"
            
        sql = """
            SELECT full_name, last_city, last_district, last_latitude, last_longitude
            FROM users
            WHERE id = %s
        """
        rows = query(sql, (user_id,))
        if not rows:
            return "Khách vãng lai (Chưa đăng nhập)"

        user = rows[0]
        name = user['full_name'] or "bạn"
        city = user['last_city'] or "không rõ"
        district = user['last_district'] or "không rõ"
        
        context = f"Thông tin người dùng:\n- Tên: {name}\n- Vị trí gần nhất: {district}, {city}"
        if user['last_latitude'] and user['last_longitude']:
            context += f"\n- Tọa độ: {user['last_latitude']}, {user['last_longitude']}"
            
        return context
    except Exception as e:
        logger.exception(f"[get_user_context] error: {e}")
        return "Lỗi lấy thông tin người dùng."

@tool
def get_user_booking_history() -> str:
    """
    Lấy lịch sử 5 đơn đặt bàn gần nhất của người dùng hiện tại.
    Dùng để hiểu thói quen ẩm thực của khách và đưa ra gợi ý phù hợp.
    """
    try:
        user_id = current_user_id.get()
        if user_id is None:
            return "Người dùng chưa đăng nhập, không có lịch sử."

        sql = """
            SELECT b.booking_date, b.status, b.number_of_guests, 
                   r.name as restaurant_name, r.cuisine_type
            FROM bookings b
            JOIN restaurants r ON b.restaurant_id = r.id
            WHERE b.customer_id = %s
            ORDER BY b.created_at DESC
            LIMIT 5
        """
        rows = query(sql, (user_id,))
        if not rows:
            return "Người dùng này chưa có lịch sử đặt bàn trước đây."

        lines = ["Lịch sử đặt bàn gần đây:"]
        for row in rows:
            status_vn = row['status']
            lines.append(f"- Ngày {row['booking_date']}: {row['restaurant_name']} ({row['cuisine_type']}) | {row['number_of_guests']} khách | Trạng thái: {status_vn}")
        
        return "\n".join(lines)
    except Exception as e:
        logger.exception(f"[get_user_booking_history] error: {e}")
        return f"Lỗi lấy lịch sử đặt bàn: {e}"
