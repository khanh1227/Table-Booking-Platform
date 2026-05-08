"""
ui_tools.py — Tools điều khiển giao diện hiển thị cho người dùng.
"""
import logging
import os
from langchain_core.tools import tool
from tools.db import query
from tools.utils import _build_tool_result # Import hàm chung
from tools.restaurant_tools import _serialize_restaurant

logger = logging.getLogger(__name__)

@tool
async def display_results(restaurant_ids: list = None, dish_ids: list = None) -> str:
    """
    Kích hoạt giao diện hiển thị (UI Cards) cho các nhà hàng hoặc món ăn mà bạn đã chọn lọc.
    Chỉ gọi tool này SAU KHI bạn đã dùng search_restaurants hoặc search_dishes để lấy ID.
    Args:
        restaurant_ids: Danh sách ID các nhà hàng muốn hiển thị.
        dish_ids: Danh sách ID các món ăn muốn hiển thị.
    """
    try:
        # Lọc bỏ các giá trị None hoặc không phải số để tránh lỗi SQL
        valid_restaurant_ids = [int(rid) for rid in (restaurant_ids or []) if rid is not None and str(rid).isdigit()]
        valid_dish_ids = [int(did) for did in (dish_ids or []) if did is not None and str(did).isdigit()]

        results_data = []
        action = "SHOW_INFO"
        
        # 1. Xử lý hiển thị nhà hàng
        if valid_restaurant_ids:
            sql = f"""
                SELECT DISTINCT r.id, r.name, r.address, r.phone_number, r.rating,
                       r.opening_hours, r.description, r.cuisine_type, r.price_range,
                       r.status,
                       l.district, l.city,
                       ri.image as thumbnail
                FROM restaurants r
                LEFT JOIN locations l ON r.location_id = l.id
                LEFT JOIN restaurant_images ri ON r.id = ri.restaurant_id 
                AND ri.display_order = (
                    SELECT MIN(display_order) 
                    FROM restaurant_images 
                    WHERE restaurant_id = r.id
                )
                WHERE r.id IN ({", ".join(map(str, valid_restaurant_ids))})
            """
            
            rows = query(sql)
            id_map = {r['id']: r for r in rows}
            restaurants = [_serialize_restaurant(id_map[rid]) for rid in valid_restaurant_ids if rid in id_map]
            
            # Debug log để kiểm tra dữ liệu gửi về FE
            # print(f"DEBUG: Serialized restaurants for UI: {restaurants}")
            
            if restaurants:
                llm_summary = f"Đã hiển thị {len(restaurants)} nhà hàng: " + \
                              ", ".join([f"{r['name']} ({r['address'][:20]}..., {r['rating']}⭐)" for r in restaurants])
                return _build_tool_result("SHOW_RESTAURANTS", {"restaurants": restaurants}, llm_summary, hide_from_llm=True)

        # 2. Xử lý hiển thị món ăn (nêu chưa có nhà hàng hoặc ưu tiên món ăn)
        elif valid_dish_ids:
            sql = f"""
                SELECT mi.id, mi.name as name, mi.price, mi.description, mi.category, mi.image,
                       r.id as restaurant_id, r.name as restaurant_name, r.cuisine_type
                FROM menu_items mi
                JOIN restaurants r ON mi.restaurant_id = r.id
                WHERE mi.id IN ({", ".join(map(str, valid_dish_ids))})
            """
            
            rows = query(sql)
            if rows:
                formatted_dishes = []
                for row in rows:
                    raw_dish_img = row.get("image")
                    clean_dish_img = raw_dish_img.replace("\\", "/").lstrip("/") if raw_dish_img else None
                    dish = {
                        "id": row["id"],
                        "name": row["name"],
                        "price": float(row["price"]) if row.get("price") else 0,
                        "description": row.get("description"),
                        "category": row.get("category"),
                        "image_url": clean_dish_img,
                        "cuisine_type": row.get("cuisine_type"),
                        "restaurant": {"id": row["restaurant_id"], "name": row["restaurant_name"]}
                    }
                    formatted_dishes.append(dish)
                
                llm_summary = f"Đã hiển thị {len(formatted_dishes)} món ăn: " + \
                              ", ".join([f"{d['name']} ({d['restaurant']['name']})" for d in formatted_dishes])
                return _build_tool_result("SHOW_DISHES", {"dishes": formatted_dishes}, llm_summary, hide_from_llm=True)

        return "Không có dữ liệu hợp lệ để hiển thị UI."

    except Exception as e:
        logger.exception(f"[display_results] error: {e}")
        return f"Lỗi khi kích hoạt giao diện: {e}"
