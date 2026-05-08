"""
restaurant_tools.py — Tools tìm kiếm nhà hàng và thông tin nhà hàng.

Mỗi tool trả về chuỗi text cho LLM đọc. Việc hiển thị UI hiện do ui_tools.py đảm nhận.
"""
import json
import re
import logging
import os
from langchain_core.tools import tool
from tools.db import query
from tools.utils import normalize_location_term, validate_tool_param

logger = logging.getLogger(__name__)

# Cuisine alias — dùng để tìm icontains trên nhiều trường
CUISINE_TERMS: dict[str, list[str]] = {
    "nhật": ["nhật", "japanese", "sushi", "ramen", "sashimi"],
    "hàn": ["hàn", "korean", "bibimbap", "kimchi", "samgyeopsal"],
    "thái": ["thái", "thai", "tom yum", "pad thai"],
    "trung": ["trung", "chinese", "dimsum", "hoành thánh"],
    "ý": ["ý", "italian", "pizza", "pasta"],
    "việt": ["việt", "vietnamese", "phở", "bún", "cơm tấm", "bánh mì"],
    "hải sản": ["hải sản", "seafood"],
    "lẩu": ["lẩu", "hotpot", "hot pot"],
    "nướng": ["nướng", "bbq", "barbecue", "grill"],
    "buffet": ["buffet"],
    "chay": ["chay", "vegetarian", "vegan"],
}


def _get_cuisine_terms(cuisine: str) -> list[str]:
    # Phòng ngừa AI truyền nhầm dictionary lồng nhau
    if not isinstance(cuisine, str):
        raise ValueError(f"Tham số 'cuisine' phải là STRING, nhưng nhận được {type(cuisine).__name__}.")
    
    c = cuisine.lower().strip()
    for key, terms in CUISINE_TERMS.items():
        if key in c or c in key or any(t in c for t in terms):
            return terms
    return [c]


def _serialize_restaurant(row: dict) -> dict:
    """Chuẩn hoá row từ DB → dict FE dùng được."""
    address = row.get("address") or ""
    district = row.get("district") or ""
    city = row.get("city") or ""
    if district:
        address = f"{address}, {district}"
    if city and city not in address:
        address = f"{address}, {city}"

    raw_price = row.get("price_range")
    try:
        price_num = int(raw_price) if raw_price and str(raw_price).isdigit() else 0
    except:
        price_num = 0

    if price_num < 100000:
        label, icon = "Bình dân", "💰"
    elif price_num <= 300000:
        label, icon = "Trung bình", "💰💰"
    else:
        label, icon = "Cao cấp", "💰💰💰"

    # Trả về path tương đối y hệt Django API (e.g. restaurants/abc.jpg)
    raw_img = row.get("thumbnail") or row.get("image")
    clean_img = raw_img.replace("\\", "/").lstrip("/") if raw_img else None

    return {
        "id": row["id"],
        "name": row["name"],
        "address": address.strip(", "),
        "status": row.get("status") or "APPROVED",
        "phone": row.get("phone_number"),
        "rating": float(row.get("rating") or 0),
        "opening_hours": row.get("opening_hours"),
        "description": (row.get("description") or "")[:200],
        "cuisine_type": row.get("cuisine_type"),
        "price_range": row.get("price_range"),
        "price_label": label,
        "price_icon": icon,
        "location": {
            "city": row.get("city"),
            "district": row.get("district"),
        },
        "image_url": clean_img,
        "thumbnail": clean_img,
        "image": clean_img,
        "images": [{"image_url": clean_img}] if clean_img else [],
    }


@tool
def search_restaurants(cuisine: str | dict | None = None, location: str | dict | None = None, sort: str | dict | None = "rating_desc") -> str:
    """
    Tìm kiếm nhà hàng trong cơ sở dữ liệu.
    Trả về danh sách tối đa 12 nhà hàng dưới dạng văn bản để bạn lọc và chọn hiển thị.
    Args:
        cuisine: Tên món ăn hoặc loại hình ẩm thực (VD: Sushi, Lẩu, Buffet).
        location: Quận, thành phố hoặc khu vực.
        sort: rating_desc (đánh giá), price_asc (rẻ nhất), price_desc (đắt nhất).
    """
    try:
        cuisine = validate_tool_param(cuisine, "cuisine")
        location = validate_tool_param(location, "location")
        sort = validate_tool_param(sort, "sort")
        
        conditions = ["r.status = 'APPROVED'"]
        params: list = []

        if location:
            loc_parts = [p.strip() for p in location.split(",") if p.strip()]
            loc_conditions = []
            for lp in loc_parts[:3]:
                norm_lp = normalize_location_term(lp)
                if not norm_lp: continue
                
                # Cải tiến: Nếu là "Quận X", ưu tiên so khớp chính xác để tránh "Quận 1" dính "Quận 10"
                if re.match(r"^Quận \d+$", norm_lp):
                    loc_conditions.append("(l.district = %s OR l.city = %s OR l.ward = %s)")
                    params.extend([norm_lp, norm_lp, norm_lp])
                else:
                    p_loc = f"%{norm_lp}%"
                    loc_conditions.append("(l.district LIKE %s OR l.city LIKE %s OR l.ward LIKE %s)")
                    params.extend([p_loc, p_loc, p_loc])
            if loc_conditions:
                conditions.append(f"({' OR '.join(loc_conditions)})")

        if cuisine:
            terms = _get_cuisine_terms(cuisine)
            cuisine_parts = []
            for term in terms[:5]:
                t = f"%{term}%"
                cuisine_parts.append("(r.cuisine_type LIKE %s OR r.name LIKE %s OR mi.category LIKE %s)")
                params.extend([t, t, t])
            conditions.append(f"({' OR '.join(cuisine_parts)})")

        where = " AND ".join(conditions)
        limit_val = 12 # Tăng lên 12 để AI có nhiều lựa chọn hơn
        
        if sort == "price_asc":
            order_by = "CAST(r.price_range AS SIGNED) ASC, r.rating DESC"
        elif sort == "price_desc":
            order_by = "CAST(r.price_range AS SIGNED) DESC, r.rating DESC"
        elif sort == "newest":
            order_by = "r.id DESC"
        else:
            order_by = "(CASE WHEN r.cuisine_type LIKE %s THEN 2 WHEN r.name LIKE %s THEN 1 ELSE 0 END) DESC, r.rating DESC"

        sql = f"""
            SELECT DISTINCT r.id, r.name, r.address, r.phone_number, r.rating,
                   r.opening_hours, r.description, r.cuisine_type, r.price_range,
                   l.district, l.city,
                   (SELECT image FROM restaurant_images WHERE restaurant_id = r.id ORDER BY display_order ASC LIMIT 1) as thumbnail
            FROM restaurants r
            LEFT JOIN locations l ON r.location_id = l.id
            LEFT JOIN menu_items mi ON mi.restaurant_id = r.id
            WHERE {where}
            ORDER BY {order_by}
            LIMIT {limit_val}
        """
        
        q_term = f"%{cuisine}%" if cuisine else "%"
        params_with_final = (params + [q_term, q_term]) if "CASE" in order_by else params
            
        rows = query(sql, tuple(params_with_final))
        restaurants = [_serialize_restaurant(r) for r in rows]

        if not restaurants:
            return "Hệ thống xác nhận: KHÔNG tìm thấy nhà hàng nào thỏa mãn tiêu chí."

        lines = [f"Dưới đây là {len(restaurants)} nhà hàng tìm thấy. Bạn hãy đọc kĩ mô tả để lọc ra 3-5 quán phù hợp nhất cho khách (Ưu tiên quán đúng Quận và có Rating cao):"]
        for r in restaurants:
            # Chỉ lấy 80 ký tự mô tả để tiết kiệm context nhưng vẫn đủ để Agent suy luận
            desc_snippet = (r['description'] or "Không có mô tả.").strip()[:80] + "..."
            lines.append(f"- [ID: {r['id']}] {r['name']} | GIÁ: {r['price_range']}đ | SAO: {r['rating']} | ĐỊA CHỈ: {r['address']}\n  Mô tả: {desc_snippet}")
        
        return "\n".join(lines)
    except Exception as e:
        logger.exception(f"[search_restaurants] error: {e}")
        return f"Lỗi tìm kiếm: {e}"


@tool
def get_restaurant_info(restaurant_name: str | dict | None = None) -> str:
    """Lấy thông tin chi tiết của nhà hàng theo tên."""
    try:
        restaurant_name = validate_tool_param(restaurant_name, "restaurant_name")
        if not restaurant_name: return "Vui lòng cung cấp tên nhà hàng."
            
        like = f"%{restaurant_name}%"
        sql = """
            SELECT r.id, r.name, r.address, r.phone_number, r.rating,
                   r.opening_hours, r.description, r.cuisine_type, r.price_range,
                   l.district, l.city,
                   (SELECT image FROM restaurant_images WHERE restaurant_id = r.id ORDER BY display_order ASC LIMIT 1) as thumbnail
            FROM restaurants r
            LEFT JOIN locations l ON r.location_id = l.id
            WHERE r.status = 'APPROVED' AND (r.name LIKE %s OR r.description LIKE %s)
            ORDER BY r.rating DESC LIMIT 3
        """
        rows = query(sql, (like, like))
        if not rows: return f"Không tìm thấy nhà hàng '{restaurant_name}'."

        res = [_serialize_restaurant(row) for row in rows]
        lines = ["Thông tin nhà hàng:"]
        for r in res:
            lines.append(f"- [ID: {r['id']}] {r['name']} | Đ/C: {r['address']} | SĐT: {r['phone']} | GIÁ: {r['price_range']} | SAO: {r['rating']}\nMô tả: {r['description']}")
        
        return "\n".join(lines)
    except Exception as e:
        return f"Lỗi lấy thông tin: {e}"
