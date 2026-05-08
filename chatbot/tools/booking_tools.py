"""
booking_tools.py — Tools liên quan đến đặt bàn.

- get_available_slots: Kiểm tra khung giờ còn trống
- prefill_booking: Chuẩn bị dữ liệu đặt bàn để FE điền vào form
- create_booking: Thực sự tạo booking qua Django API (cần JWT token của user)
"""
import json
import os
import logging
import httpx
import re
from langchain_core.tools import tool
from tools.db import query
from tools.utils import _build_tool_result
from tools.restaurant_tools import _serialize_restaurant

logger = logging.getLogger(__name__)

BE_API_URL = os.getenv("BE_API_URL", "http://127.0.0.1:8000")


def _find_restaurant_id(restaurant_name: str) -> tuple[int | None, str | None]:
    """Tìm restaurant_id theo tên. Trả về (id, actual_name) hoặc (None, None)."""
    if not restaurant_name:
        return None, None
    
    # Làm sạch tên: loại bỏ các phần trong ngoặc đơn (vd: "Quán A (Hải sản)" -> "Quán A")
    clean_name = re.sub(r'\(.*?\)', '', restaurant_name).strip()
    
    # Loại bỏ tiền tố phổ biến
    prefixes = ["quán", "nhà hàng", "tiệm", "hàng", "cửa hàng", "lẩu", "nướng", "buffet"]
    search_name = clean_name.lower()
    for p in prefixes:
        if search_name.startswith(p + ' '):
            search_name = search_name[len(p)+1:].strip()
            break
    
    # Tìm kiếm với tên đã làm sạch
    rows = query(
        "SELECT id, name FROM restaurants WHERE status='APPROVED' AND (name LIKE %s OR name LIKE %s OR name LIKE %s) ORDER BY rating DESC LIMIT 1",
        (f"%{clean_name}%", f"%{search_name}%", f"%{restaurant_name}%"),
    )
    if rows:
        return rows[0]["id"], rows[0]["name"]
    return None, None


@tool
def get_available_slots(restaurant_name: str | dict | None = None, date: str | dict | None = None) -> str:
    """
    Kiểm tra khung giờ còn trống (cần Tên nhà hàng và Ngày YYYY-MM-DD).
    """
    try:
        def clean_param(p):
            if p is None: return ""
            if isinstance(p, dict): return ""
            s = str(p).strip()
            if s.startswith("{") and "{" in s: return ""
            return s

        restaurant_name = clean_param(restaurant_name)
        date = clean_param(date)
        
        if not restaurant_name or not date:
             return "Vui lòng cung cấp tên nhà hàng và ngày cụ thể (YYYY-MM-DD)."
             
        rid, rname = _find_restaurant_id(restaurant_name)
        if not rid:
            return f"Không tìm thấy nhà hàng '{restaurant_name}' trong hệ thống."

        # Lấy time slots của nhà hàng
        slots = query(
            "SELECT id, start_time, max_bookings FROM time_slots WHERE restaurant_id=%s AND is_active=1 ORDER BY start_time",
            (rid,),
        )
        if not slots:
            return f"Nhà hàng **{rname}** chưa cài đặt khung giờ đặt bàn."

        # Đếm bookings hiện có cho từng slot vào ngày đó
        available_slots = []
        for slot in slots:
            count_rows = query(
                """SELECT COUNT(*) AS cnt FROM bookings
                   WHERE restaurant_id=%s AND time_slot_id=%s
                     AND booking_date=%s AND status IN ('PENDING','CONFIRMED')""",
                (rid, slot["id"], date),
            )
            booked = count_rows[0]["cnt"] if count_rows else 0
            if booked < (slot["max_bookings"] or 10):
                slot_label = f"{str(slot['start_time'])[:-3]}"
                available_slots.append({
                    "id": slot["id"],
                    "label": slot_label,
                    "available": slot["max_bookings"] - booked,
                })

        if not available_slots:
            return _build_tool_result(
                "SHOW_INFO",
                {},
                f"Nhà hàng **{rname}** đã hết chỗ vào ngày {date}.",
            )

        lines = [f"Nhà hàng **{rname}** còn trống vào ngày {date}:"]
        for s in available_slots:
            lines.append(f"  🕐 {s['label']} (còn {s['available']} chỗ)")
        summary = "\n".join(lines)

        return _build_tool_result(
            "SHOW_INFO",
            {
                "restaurant": {"id": rid, "name": rname},
                "date": date,
                "available_slots": available_slots,
            },
            summary,
        )
    except Exception as e:
        logger.exception(f"[get_available_slots] error: {e}")
        return "Có lỗi khi kiểm tra khung giờ."


@tool
async def prefill_booking(
    restaurant_name: str | dict | None = None,
    date: str | dict | None = None,
    time: str | dict | None = None,
    guests: int | str | dict | None = None,
    special_request: str | dict | None = None,
) -> str:
    """
    Hiện form đặt bàn. Dùng khi khách muốn đặt bàn.
    """
    try:
        from tools.context import current_session_key
        from session_store import get_booking_state, update_booking_state
        
        session_key = current_session_key.get()
        
        def clean_param(p):
            if p is None: return ""
            if isinstance(p, dict): return ""
            s = str(p).strip()
            if s.startswith("{") and "{" in s: return ""
            return s

        restaurant_name = clean_param(restaurant_name)
        date = clean_param(date)
        time = clean_param(time)
        special_request = clean_param(special_request)
        
        try:
             guests = int(guests) if guests is not None and not isinstance(guests, dict) else 0
        except (ValueError, TypeError):
             guests = 0
        
        # 1. Lấy state cũ từ cache (nếu có)
        state = get_booking_state(session_key) if session_key else {}
        
        # 2. Xử lý logic tìm nhà hàng (Nếu có tên mới thì update)
        rid = state.get("restaurant_id")
        rname = state.get("restaurant_name")

        if restaurant_name:
            new_rid, new_rname = _find_restaurant_id(restaurant_name)
            if new_rid:
                rid = new_rid
                rname = new_rname

        # 3. Build data mới từ arguments hiện tại
        new_data = {
            "restaurant_id": rid,
            "restaurant_name": rname,
            "booking_date": date,
            "time_raw": time,
            "number_of_guests": guests,
            "special_request": special_request
        }

        # 4. Cập nhật vào state cache (Merge)
        if session_key:
            update_booking_state(session_key, new_data)
            booking_data = get_booking_state(session_key)
        else:
            booking_data = {k: v for k, v in new_data.items() if v}

        # 5. Logic tìm Time Slot ID
        final_rid = booking_data.get("restaurant_id")
        final_date = booking_data.get("booking_date")
        final_time = booking_data.get("time_raw")
        slot_warning = ""

        if final_rid and final_date and final_time:
            try:
                parts = final_time.split(":")
                h = int(parts[0])
                m = int(parts[1]) if len(parts) > 1 else 0
                time_str = f"{h:02d}:{m:02d}:00"

                slots = query(
                    "SELECT id, start_time, max_bookings FROM time_slots WHERE restaurant_id=%s AND is_active=1 AND start_time=%s LIMIT 1",
                    (final_rid, time_str)
                )
                if not slots:
                    slots = query(
                        "SELECT id, start_time, max_bookings FROM time_slots WHERE restaurant_id=%s AND is_active=1 AND HOUR(start_time)=%s ORDER BY ABS(MINUTE(start_time) - %s) LIMIT 1",
                        (final_rid, h, m)
                    )

                if slots:
                    s = slots[0]
                    # Check available
                    cnt = query(
                        "SELECT COUNT(*) AS cnt FROM bookings WHERE restaurant_id=%s AND time_slot_id=%s AND booking_date=%s AND status IN ('PENDING','CONFIRMED')",
                        (final_rid, s["id"], final_date)
                    )
                    booked = cnt[0]["cnt"] if cnt else 0
                    if booked < (s["max_bookings"] or 10):
                        booking_data["time_slot_id"] = s["id"]
                        booking_data["time_slot_label"] = str(s['start_time'])[:-3]
                        # Cập nhật lại time_raw cho khớp với slot thực tế
                        booking_data["time_raw"] = str(s['start_time'])[:-3]
                    else:
                        slot_warning = f"⚠️ Khung giờ **{str(s['start_time'])[:-3]}** đã hết chỗ."
                        booking_data["time_slot_id"] = None
                else:
                    slot_warning = f"⚠️ Nhà hàng không có khung giờ **{final_time}**."
                    booking_data["time_slot_id"] = None
            except: pass

        # 6. Kiểm tra các trường còn thiếu để nhắc khách
        missing = []
        if not booking_data.get("restaurant_id"): missing.append("tên nhà hàng")
        if not booking_data.get("booking_date"): missing.append("ngày")
        if not booking_data.get("time_raw"): missing.append("giờ")
        if not booking_data.get("number_of_guests"): missing.append("số người")

        if not booking_data.get("restaurant_id"):
             return _build_tool_result("SHOW_INFO", {}, f"Rất tiếc, mình không tìm thấy nhà hàng '{restaurant_name}'. Bạn kiểm tra lại tên quán nhé 🙏")

        if missing:
            msg = f"Mình đã ghi nhận! Bạn bổ sung thêm **{', '.join(missing)}** để mình hoàn tất form nhé 😊"
            llm_summary = f"Đã ghi nhận thông tin đặt bàn, còn thiếu: {', '.join(missing)}."
        elif slot_warning:
            msg = f"{slot_warning} Bạn vui lòng chọn một khung giờ khác nhé 🙏"
            llm_summary = f"Cảnh báo: {slot_warning}"
        else:
            msg = "Mình đã chuẩn bị xong form đặt bàn! Bạn kiểm tra lại rồi bấm **Xác nhận** nhé 🎉"
            llm_summary = f"Đã chuẩn bị form đặt bàn cho {booking_data.get('restaurant_name')} vào {booking_data.get('booking_date')} lúc {booking_data.get('time_raw')}."

        return _build_tool_result("PREFILL_BOOKING", {"booking": booking_data, "msg": msg}, llm_summary)
    except Exception as e:
        logger.exception(f"[prefill_booking] error: {e}")
        return "Có lỗi khi chuẩn bị thông tin đặt bàn."
