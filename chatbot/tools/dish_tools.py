"""
dish_tools.py — Tools tìm kiếm món ăn.
"""
import logging
from langchain_core.tools import tool
from tools.db import query
from tools.utils import validate_tool_param

logger = logging.getLogger(__name__)

@tool
def search_dishes(dish_name: str | dict | None = None, restaurant_name: str | dict | None = None, restaurant_ids: list[int] | str | None = None) -> str:
    """
    Tìm kiếm món ăn trong thực đơn các nhà hàng.
    Hỗ trợ tìm theo tên món, tên nhà hàng hoặc danh sách ID nhà hàng.
    
    Args:
        dish_name: Tên món cần tìm (VD: "Sashimi").
        restaurant_name: Tên nhà hàng cần xem thực đơn.
        restaurant_ids: Danh sách ID nhà hàng (VD: [1, 2, 3] hoặc "1,2,3") để lấy món của nhiều quán một lúc.
    """
    try:
        dish_name = validate_tool_param(dish_name, "dish_name")
        restaurant_name = validate_tool_param(restaurant_name, "restaurant_name")
        
        conditions = ["mi.is_available = 1", "r.status = 'APPROVED'"]
        params = []

        if restaurant_ids:
            # Chấp nhận cả list [1, 2] hoặc string "1,2,3"
            if isinstance(restaurant_ids, str):
                ids = [idx.strip() for idx in restaurant_ids.split(",") if idx.strip().isdigit()]
            elif isinstance(restaurant_ids, list):
                ids = [str(idx) for idx in restaurant_ids if str(idx).isdigit()]
            else:
                ids = []
            
            if ids:
                conditions.append(f"r.id IN ({','.join(['%s'] * len(ids))})")
                params.extend(ids)

        if dish_name:
            conditions.append("(mi.name LIKE %s OR mi.description LIKE %s OR mi.category LIKE %s)")
            p = f"%{dish_name}%"
            params.extend([p, p, p])

        if restaurant_name:
            conditions.append("r.name LIKE %s")
            params.append(f"%{restaurant_name}%")

        where_clause = " AND ".join(conditions)
        limit_val = 24 if restaurant_ids else 12 # Tăng limit khi search nhiều quán

        sql = f"""
            SELECT mi.id, mi.name as dish_name, mi.price, mi.description, mi.category, mi.image,
                   r.id as restaurant_id, r.name as restaurant_name
            FROM menu_items mi
            JOIN restaurants r ON mi.restaurant_id = r.id
            WHERE {where_clause}
            ORDER BY r.rating DESC, mi.name ASC
            LIMIT {limit_val}
        """
        
        rows = query(sql, tuple(params))
        if not rows:
            return "Hệ thống xác nhận: KHÔNG tìm thấy món ăn nào thỏa mãn tiêu chí."

        # Group theo nhà hàng để Agent dễ đọc và phân tích
        grouped = {}
        for row in rows:
            r_name = row['restaurant_name']
            if r_name not in grouped:
                grouped[r_name] = []
            grouped[r_name].append(row)

        lines = [f"Tìm thấy thực đơn của {len(grouped)} nhà hàng:"]
        for r_name, dishes in grouped.items():
            lines.append(f"\n### Nhà hàng: {r_name} (ID quán: {dishes[0]['restaurant_id']})")
            for d in dishes:
                desc = f" - {d['description'][:80]}..." if d['description'] else ""
                lines.append(f"- [ID món: {d['id']}] {d['dish_name']} | Giá: {int(d['price']):,}đ | Loại: {d['category']}{desc}")
        
        return "\n".join(lines)
    except Exception as e:
        logger.exception(f"[search_dishes] error: {e}")
        return f"Lỗi tìm kiếm món ăn: {e}"
