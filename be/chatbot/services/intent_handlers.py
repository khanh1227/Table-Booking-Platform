"""
Intent Handlers — mỗi intent có handler riêng.

Mỗi handler nhận (entities, ctx, session) và trả về HandlerResult:
{
    "message":       str,
    "action":        str,   # SHOW_INFO | SHOW_RESTAURANTS | SHOW_DISHES |
                            # PREFILL_BOOKING | ASK_CLARIFICATION | NONE
    "action_data":   dict,
    "pending_slots": list[str],
}

Nguyên tắc trong file này:
  - Không parse datetime thủ công — tin tưởng output từ post_ner_enhancer
    (DATE = 'dd/mm/yyyy', TIME = 'HH:MM').
  - Không gọi DB trong serialize nếu data đã được select_related / prefetch_related.
  - dispatch() fallback về handle_auto_fallback, không phải handle_out_of_scope.
"""
from __future__ import annotations

import logging
import random
from datetime import date, datetime
import re

from .entity_extractor import extract_restaurant_from_text, extract_dish_from_text, extract_restaurant_candidates_from_text

logger = logging.getLogger(__name__)


# ── Helpers ───────────────────────────────────────────────────────────────────

def _get_restaurant_by_id(rid: int):
    from restaurants.models import Restaurant
    return (
        Restaurant.objects
        .filter(id=rid)
        .select_related("location")
        .prefetch_related("images")
        .first()
    )


def _get_dish_by_id(did: int):
    from restaurants.models import MenuItem
    return MenuItem.objects.filter(id=did).select_related("restaurant").first()


def _resolve_restaurant(entities: dict, text: str):
    """Tìm nhà hàng qua PhoBERT entity → N-gram fuzzy."""
    phobert_entity = entities.get("RESTAURANT")
    _, rid = extract_restaurant_from_text(text, phobert_entity)
    return _get_restaurant_by_id(rid) if rid else None


def _resolve_restaurant_candidates(entities: dict, text: str, max_candidates: int = 3):
    """Tìm list nhà hàng qua N-gram fuzzy (chặn Context Bleed)."""
    # 1. Thử sweep trên raw Text trước để bắt kịp những lượt user đổi ý (ex: "đặt bàn nhà hàng namaste india")
    candidates_from_text = extract_restaurant_candidates_from_text(text, phobert_entity=None, max_results=max_candidates)
    # Ngưỡng 65 đủ linh hoạt để bắt lỗi sai chính tả như "namates indi", 
    # nhưng không quá yếu thành rác. Nếu có rác, Disambiguation UI sẽ lo liệu.
    valid_from_text = [c for c in candidates_from_text if c[2] >= 65]
    
    if valid_from_text:
        return [(_get_restaurant_by_id(rid), score) for name, rid, score in valid_from_text if rid]

    # 2. Nếu quét chữ mới không ra nhà hàng, fallback về entity từ Context (vì có thể câu mới chỉ có "cho mình đặt bàn lúc 7h")
    phobert_entity = entities.get("RESTAURANT")
    if phobert_entity:
        candidates = extract_restaurant_candidates_from_text(text, phobert_entity, max_candidates)
        return [(_get_restaurant_by_id(rid), score) for name, rid, score in candidates if rid]
        
    return []


def _resolve_dish(entities: dict, text: str):
    """
    Tìm món ăn.
    Ưu tiên: DISH (tên cụ thể) > CUISINE (thể loại).
    """
    phobert_entity = entities.get("DISH") or entities.get("CUISINE")
    _, did = extract_dish_from_text(text, phobert_entity)
    return _get_dish_by_id(did) if did else None


def _fuzzy_match_restaurant(rest_name: str):
    """Fuzzy match từ tên chuỗi, trả về Restaurant object hoặc None."""
    _, rid = extract_restaurant_from_text(rest_name, phobert_entity=rest_name)
    return _get_restaurant_by_id(rid) if rid else None


def _serialize_restaurant(r) -> dict:
    """
    Chuyển Restaurant object → dict cho FE.
    Giả định r đã được select_related('location') và prefetch_related('images').
    """
    address = r.address or ""
    if r.location:
        parts = [p for p in [r.location.district, r.location.city] if p]
        if parts:
            address = f"{address}, {', '.join(parts)}"

    image_url = None
    try:
        # prefetch_related đã load sẵn — không tạo thêm query
        first_img = r.images.all()[0] if r.images.all() else None
        if first_img and hasattr(first_img, "image") and first_img.image:
            image_url = first_img.image.url
    except (IndexError, Exception):
        pass

    return {
        "id":            r.id,
        "name":          r.name,
        "address":       address,
        "phone":         r.phone_number,
        "rating":        float(r.rating),
        "opening_hours": r.opening_hours,
        "description":   (r.description or "")[:200],
        "image_url":     image_url,
    }


def _serialize_dish(d) -> dict:
    return {
        "id":          d.id,
        "name":        d.name,
        "price":       float(d.price),
        "category":    d.category,
        "description": (d.description or "")[:150],
        "restaurant":  {"id": d.restaurant_id, "name": d.restaurant.name},
        "image_url":   None,
    }


def _resolve_restaurant_for_info(entities: dict, text: str, max_candidates: int = 3):
    """
    Dùng cho intent hỏi thông tin 1 nhà hàng.
    - Nếu có restaurant_id rõ ràng -> trả direct.
    - Nếu fuzzy ra đúng 1 ứng viên nổi trội -> trả direct.
    - Nếu mơ hồ -> trả top candidates để user chọn.
    """
    if entities.get("restaurant_id"):
        restaurant = _get_restaurant_by_id(entities["restaurant_id"])
        if restaurant:
            return restaurant, []

    candidates = _resolve_restaurant_candidates(entities, text, max_candidates=max_candidates)
    valid_candidates = [(r, score) for r, score in candidates if r is not None]
    if not valid_candidates:
        return None, []

    best_res, best_score = valid_candidates[0]
    if len(valid_candidates) == 1 and best_score >= 75:
        return best_res, []
    if len(valid_candidates) >= 2 and best_score >= 90 and (best_score - valid_candidates[1][1]) >= 10:
        return best_res, []

    return None, [_serialize_restaurant(r) for r, _ in valid_candidates[:max_candidates]]


def _build_top_restaurants_message(restaurants: list[dict], info_type: str) -> str:
    if info_type == "location":
        title = "Mình gợi ý top nhà hàng khớp nhất kèm địa chỉ:"
        lines = [
            f"{idx + 1}. **{r['name']}** — {r.get('address') or 'Chưa cập nhật'} 📍"
            for idx, r in enumerate(restaurants)
        ]
        return f"{title}\n" + "\n".join(lines)

    if info_type == "contact":
        title = "Mình gợi ý top nhà hàng khớp nhất kèm số điện thoại:"
        lines = [
            f"{idx + 1}. **{r['name']}** — 📞 {r.get('phone') or 'Chưa cập nhật'}"
            for idx, r in enumerate(restaurants)
        ]
        return f"{title}\n" + "\n".join(lines)

    title = "Mình gợi ý top nhà hàng khớp nhất kèm giờ mở cửa:"
    lines = [
        f"{idx + 1}. **{r['name']}** — 🕐 {r.get('opening_hours') or 'Chưa cập nhật'}"
        for idx, r in enumerate(restaurants)
    ]
    return f"{title}\n" + "\n".join(lines)


def _parse_date_str(date_str: str | None) -> date | None:
    """
    Parse chuỗi 'dd/mm/yyyy' (output chuẩn của post_ner_enhancer) thành date object.
    Không tự parse lại từ text thô.
    """
    if not date_str:
        return None
    try:
        return datetime.strptime(date_str, "%d/%m/%Y").date()
    except ValueError:
        logger.debug(f"[Handler] Không parse được DATE: '{date_str}'")
        return None


# ── Book table helpers ────────────────────────────────────────────────────────

BOOK_SLOTS = ["RESTAURANT", "DATE", "TIME", "PEOPLE_COUNT"]


def _missing_slots(entities: dict, required: list[str] = BOOK_SLOTS) -> list[str]:
    return [s for s in required if not entities.get(s)]


def _find_time_slot(restaurant, time_str: str | None, booking_date: date | None):
    """
    Tìm TimeSlot khả dụng theo giờ ('HH:MM') và ngày đặt.
    Trả về TimeSlot object hoặc None.
    """
    if not time_str or not booking_date:
        return None

    from restaurants.models import TimeSlot
    from bookings.models import Booking

    try:
        hour = int(time_str.split(":")[0])
    except (ValueError, IndexError):
        return None

    slots = TimeSlot.objects.filter(
        restaurant=restaurant,
        is_active=True,
        start_time__hour__lte=hour,
        end_time__hour__gt=hour,
    ).order_by("start_time")

    for slot in slots:
        booked = Booking.objects.filter(
            restaurant=restaurant,
            time_slot=slot,
            booking_date=booking_date,
            status__in=["PENDING", "CONFIRMED"],
        ).count()
        if booked < slot.max_bookings:
            return slot
    return None


# ═══════════════════════════════════════════════════════════════════════════════
# Handlers
# ═══════════════════════════════════════════════════════════════════════════════

def handle_ask_location(entities: dict, ctx: dict, text: str = "", **_) -> dict:
    restaurant, restaurant_candidates = _resolve_restaurant_for_info(entities, text, max_candidates=3)
    if not restaurant:
        if restaurant_candidates:
            return {
                "message":      _build_top_restaurants_message(restaurant_candidates, info_type="location"),
                "action":       "SHOW_INFO",
                "action_data":  {"restaurants": restaurant_candidates},
                "pending_slots": [],
            }
        if not entities.get("RESTAURANT"):
            return {
                "message":      "Bạn muốn hỏi địa chỉ nhà hàng nào ạ? 😊",
                "action":       "ASK_CLARIFICATION",
                "action_data":  {},
                "pending_slots": ["RESTAURANT"],
            }
        return {
            "message":      "Mình không tìm thấy nhà hàng trong hệ thống ạ. Bạn thử tên khác nhé?",
            "action":       "SHOW_INFO",
            "action_data":  {},
            "pending_slots": [],
        }
    return {
        "message":      f"Nhà hàng **{restaurant.name}** tọa lạc tại: {_serialize_restaurant(restaurant)['address']} ạ! 📍",
        "action":       "SHOW_INFO",
        "action_data":  {"restaurant": _serialize_restaurant(restaurant)},
        "pending_slots": [],
    }


def handle_ask_contact(entities: dict, ctx: dict, text: str = "", **_) -> dict:
    restaurant, restaurant_candidates = _resolve_restaurant_for_info(entities, text, max_candidates=3)
    if not restaurant:
        if restaurant_candidates:
            return {
                "message":      _build_top_restaurants_message(restaurant_candidates, info_type="contact"),
                "action":       "SHOW_INFO",
                "action_data":  {"restaurants": restaurant_candidates},
                "pending_slots": [],
            }
        if not entities.get("RESTAURANT"):
            return {
                "message":      "Bạn muốn hỏi số điện thoại của nhà hàng nào ạ?",
                "action":       "ASK_CLARIFICATION",
                "action_data":  {},
                "pending_slots": ["RESTAURANT"],
            }
        return {
            "message":      "Mình không tìm thấy nhà hàng đó ạ. Bạn thử tên khác nhé!",
            "action":       "SHOW_INFO",
            "action_data":  {},
            "pending_slots": [],
        }
    phone = restaurant.phone_number or "Chưa cập nhật"
    return {
        "message":      f"Số điện thoại nhà hàng **{restaurant.name}**: 📞 {phone}",
        "action":       "SHOW_INFO",
        "action_data":  {"restaurant": _serialize_restaurant(restaurant)},
        "pending_slots": [],
    }


def handle_ask_operating_hours(entities: dict, ctx: dict, text: str = "", **_) -> dict:
    from restaurants.models import TimeSlot

    restaurant, restaurant_candidates = _resolve_restaurant_for_info(entities, text, max_candidates=3)
    if not restaurant:
        if restaurant_candidates:
            return {
                "message":      _build_top_restaurants_message(restaurant_candidates, info_type="hours"),
                "action":       "SHOW_INFO",
                "action_data":  {"restaurants": restaurant_candidates},
                "pending_slots": [],
            }
        if not entities.get("RESTAURANT"):
            return {
                "message":      "Bạn muốn hỏi giờ mở cửa của nhà hàng nào ạ?",
                "action":       "ASK_CLARIFICATION",
                "action_data":  {},
                "pending_slots": ["RESTAURANT"],
            }
        return {
            "message":      "Mình không tìm thấy nhà hàng đó ạ.",
            "action":       "SHOW_INFO",
            "action_data":  {},
            "pending_slots": [],
        }

    slots = TimeSlot.objects.filter(
        restaurant=restaurant, is_active=True
    ).order_by("start_time")

    slot_str = ", ".join(
        f"{s.start_time.strftime('%H:%M')}–{s.end_time.strftime('%H:%M')}"
        for s in slots
    ) or "Chưa cập nhật"

    return {
        "message": (
            f"🕐 Nhà hàng **{restaurant.name}** mở cửa: {restaurant.opening_hours or 'Chưa cập nhật'}\n"
            f"Các khung giờ đặt bàn: {slot_str}"
        ),
        "action":       "SHOW_INFO",
        "action_data":  {"restaurant": _serialize_restaurant(restaurant)},
        "pending_slots": [],
    }


def handle_book_table(entities: dict, ctx: dict, text: str = "", **_) -> dict:
    """
    Agentic slot-filling:
      - Đủ slots → PREFILL_BOOKING hoàn chỉnh
      - Thiếu 1-2 → PREFILL_BOOKING partial + note thiếu gì
      - Thiếu ≥ 3 → ASK_CLARIFICATION

    Tin tưởng hoàn toàn vào DATE/TIME đã được chuẩn hoá bởi post_ner_enhancer
    (format 'dd/mm/yyyy' và 'HH:MM') — không parse lại từ text thô.
    """
    booking_data: dict = {}
    restaurant = None
    restaurant_candidates = []

    # Nếu user khởi động lại yêu cầu đặt bàn với câu mới,
    # cần reset lựa chọn nhà hàng cũ để tránh "kẹt" context.
    restart_booking_pattern = re.compile(r"\b(?:đặt\s*bàn|dat\s*ban)\b", re.IGNORECASE)
    is_booking_restart = bool(text and restart_booking_pattern.search(text))

    # 1. Chỉ chốt nhà hàng khi user chủ động bấm chọn từ FE postback.
    selected_restaurant_id = entities.get("selected_restaurant_id")
    text_stripped = (text or "").strip()
    # Chỉ coi là explicit selection khi request hiện tại là postback chọn nhà hàng
    # (FE gửi postback với message rỗng).
    has_explicit_selection = bool(
        not text_stripped
        and entities.get("restaurant_selected")
        and (selected_restaurant_id or entities.get("restaurant_id"))
    )

    if is_booking_restart and not has_explicit_selection:
        entities.pop("restaurant_id", None)
        entities.pop("selected_restaurant_id", None)
        entities.pop("restaurant_selected", None)
        entities.pop("RESTAURANT", None)
    
    # Request text mới không nên mang "cờ đã chọn" của lượt trước.
    if text_stripped:
        entities.pop("selected_restaurant_id", None)
        entities.pop("restaurant_selected", None)

    if has_explicit_selection:
        rid = selected_restaurant_id or entities.get("restaurant_id")
        if rid:
            restaurant = _get_restaurant_by_id(rid)
            if restaurant:
                booking_data["restaurant_id"] = restaurant.id
                booking_data["restaurant_name"] = restaurant.name
                entities["restaurant_id"] = restaurant.id
                entities["RESTAURANT"] = restaurant.name
    else:
        # Chưa có explicit selection -> luôn đưa candidates để user tự chọn, không auto-pick.
        candidate_map: dict[int, tuple[object, int]] = {}
        entities_for_candidates = dict(entities)
        # Nếu có text mới thì ưu tiên quét theo text mới, tránh fallback về RESTAURANT cũ trong context.
        if text_stripped:
            entities_for_candidates.pop("RESTAURANT", None)
        candidates = _resolve_restaurant_candidates(entities_for_candidates, text, max_candidates=4)
        for r, score in candidates:
            if r is not None:
                prev = candidate_map.get(r.id)
                if prev is None or score > prev[1]:
                    candidate_map[r.id] = (r, score)

        if candidate_map:
            valid_candidates = sorted(candidate_map.values(), key=lambda x: x[1], reverse=True)
            restaurant_candidates = [_serialize_restaurant(r) for r, _ in valid_candidates]

    # 2. KIỂM ĐẾM SLOTS
    missing = _missing_slots(entities, BOOK_SLOTS)

    # Prefill các slot không phụ thuộc việc đã chọn nhà hàng hay chưa,
    # để FE luôn cập nhật được form (ngày/giờ/số người) ngay cả lúc đang disambiguate.
    date_str = entities.get("DATE")
    parsed_date = _parse_date_str(date_str)
    if parsed_date:
        booking_data["booking_date"] = str(parsed_date)
        booking_data["booking_date_raw"] = date_str

    people_str = entities.get("PEOPLE_COUNT", "")
    nums = [int(x) for x in people_str.split() if x.isdigit()]
    if nums:
        booking_data["number_of_guests"] = nums[0]

    time_str = entities.get("TIME")
    if time_str:
        booking_data["time_raw"] = time_str

    occasion = entities.get("OCCASION")
    if occasion:
        booking_data["special_request"] = occasion

    # 3. NẾU CÓ CANDIDATES THÌ BẮT BUỘC CHỌN NHÀ HÀNG TRƯỚC
    if restaurant_candidates:
        missing_real = [m for m in missing if m != "RESTAURANT"]
        extra_msg = ""
        if missing_real:
            extra_msg = " Bạn cũng có thể nhắn thêm số lượng người và giờ đến nhé."
            
        return {
            "message":      "Có nhiều chi nhánh/nhà hàng giống với lựa chọn của bạn. Vui lòng bấm chọn ngay bên dưới:" + extra_msg,
            "action":       "PREFILL_BOOKING",
            "action_data":  {"restaurant_candidates": restaurant_candidates, "booking": booking_data},
            "pending_slots": missing_real + ["RESTAURANT"],
        }

    # 4. NẾU THIẾU TỪ 3 SLOTS TRỞ LÊN VÀ KHÔNG CÓ CANDIDATES
    if len(missing) >= 3:
        if "RESTAURANT" not in missing:
            # Có "RESTAURANT" 
            return {
                "message": (
                    f"Mình đã ghi nhận bạn chọn nhà hàng **{entities['RESTAURANT']}**! "
                    "Bạn cho mình xin thông tin Số lượng người và Thời gian đến nhé 🍽️"
                ),
                "action":       "ASK_CLARIFICATION",
                "action_data":  {},
                "pending_slots": BOOK_SLOTS,
            }
        
        # Hoàn toàn mù (Không có RESTAURANT, không có Date, Time...)
        return {
            "message": (
                "Bạn muốn đặt bàn ở đâu, cho mấy người và vào thời gian nào ạ? "
                "Mình sẽ giúp bạn đặt ngay! 🍽️"
            ),
            "action":       "ASK_CLARIFICATION",
            "action_data":  {},
            "pending_slots": BOOK_SLOTS,
        }

    # Nhà hàng: Dành cho trường hợp đã auto-pick hoặc có sẵn `restaurant_id`
    if not restaurant and entities.get("restaurant_id"):
        from restaurants.models import Restaurant
        try:
           restaurant = Restaurant.objects.get(id=entities["restaurant_id"])
           booking_data["restaurant_id"] = restaurant.id
           booking_data["restaurant_name"] = restaurant.name
           entities["RESTAURANT"] = restaurant.name
        except Restaurant.DoesNotExist:
           pass


    # Khung giờ
    if time_str and restaurant and parsed_date:
        time_slot = _find_time_slot(restaurant, time_str, parsed_date)
        if time_slot:
            booking_data["time_slot_id"]    = time_slot.id
            booking_data["time_slot_label"] = (
                f"{time_slot.start_time.strftime('%H:%M')}–{time_slot.end_time.strftime('%H:%M')}"
            )

    # Thông báo
    if missing:
        slot_labels = {
            "RESTAURANT":   "nhà hàng",
            "DATE":         "ngày",
            "TIME":         "giờ",
            "PEOPLE_COUNT": "số người",
        }
        missing_str = ", ".join(slot_labels.get(s, s) for s in missing)
        message = f"Mình đã điền sẵn một số thông tin! Bạn bổ sung thêm **{missing_str}** rồi xác nhận nhé 😊"
    elif restaurant_candidates:
        message = "Mình đã ghi nhận yêu cầu đặt bàn! Bạn muốn chọn nhà hàng nào dưới đây ạ? 👇"
    else:
        message = "Mình đã điền đầy đủ thông tin đặt bàn! Bạn kiểm tra và xác nhận nhé 🎉"

    # Trả về additional action_data cho disambiguation
    action_data = {"booking": booking_data}
    if restaurant_candidates:
        action_data["restaurant_candidates"] = restaurant_candidates
        # Bỏ RESTAURANT ra khỏi missing vì chúng ta đang xử lý bằng frontend logic
        if "RESTAURANT" in missing:
            missing.remove("RESTAURANT")
            
    return {
        "message":      message,
        "action":       "PREFILL_BOOKING",
        "action_data":  action_data,
        "pending_slots": missing,
    }


def handle_suggest_restaurant(entities: dict, ctx: dict, **_) -> dict:
    from chatbot.services.recommendation_engine import recommendation_engine

    cuisine     = entities.get("CUISINE")
    # ── FALLBACK KEYWORD ──────────────────────────────────────────────────
    # Nếu không có CUISINE rõ ràng, nhưng có tên Nhà hàng/Món ăn từ Fuzzy Match
    # -> Dùng tên đó làm từ khóa để gợi ý các quán liên quan (vd: "hải sản")
    if not cuisine:
        cuisine = entities.get("RESTAURANT") or entities.get("DISH")

    location    = entities.get("LOCATION")
    location_display = location.title() if isinstance(location, str) else location
    price_range = entities.get("PRICE")
    exclude_ids = ctx.get("all_shown_restaurant_ids", [])

    qs, fallback = recommendation_engine.recommend_restaurants(
        cuisine=cuisine, location=location, price_range=price_range,
        exclude_ids=exclude_ids,
    )
    restaurants = list(qs)

    if not restaurants:
        return {
            "message":      "Mình không tìm thấy nhà hàng phù hợp 😔 Bạn thử tìm kiếm khác nhé!",
            "action":       "SHOW_INFO",
            "action_data":  {},
            "pending_slots": [],
        }

    filters = []
    if cuisine:     filters.append(f"ẩm thực {cuisine}")
    if location_display:    filters.append(f"khu vực {location_display}")
    if price_range: filters.append(f"giá {price_range}")
    filter_str = " · ".join(filters) if filters else "phổ biến"

    _FALLBACK_MESSAGES = {
        "EXACT":            f"Mình gợi ý một số nhà hàng **{filter_str}** cho bạn nhé 🍜",
        "FALLBACK_PRICE":   f"Không có nhà hàng **{filter_str}** phù hợp mức giá, nhưng đây là các quán ngon ở **{location_display or 'khu vực này'}**!",
        "FALLBACK_LOCATION": f"Chưa có nhà hàng **{cuisine or ''}** ở **{location_display}**. Bạn xem các nhà hàng **{cuisine or ''}** nổi bật khác nhé!",
        "FALLBACK_CUISINE": f"Không tìm thấy quán **{cuisine}** ở **{location_display}**. Nhưng ở **{location_display}** có những nhà hàng đang rất HOT nè!",
        "LOOP": f"Bạn đã xem hết các nhà hàng phù hợp rồi. Để mình gợi ý lại từ đầu danh sách quán ngon nhất tại **{location_display or 'khu vực này'}** cho bạn nhé! 🔄",
    }
    message = _FALLBACK_MESSAGES.get(
        fallback,
        "Tiêu chí hơi khó tìm 😔 Đây là Top nhà hàng đánh giá cao nhất, bạn tham khảo nhé!",
    )

    return {
        "message":      message,
        "action":       "SHOW_RESTAURANTS",
        "action_data":  {
            "restaurants": [_serialize_restaurant(r) for r in restaurants],
            "filters":     {"cuisine": cuisine, "location": location_display, "price": price_range, "fallback": fallback},
        },
        "pending_slots":             [],
        "_shown_restaurant_ids":     [r.id for r in restaurants],
        "_reset_shown_ids":          (fallback == "LOOP"),
    }


def handle_suggest_dish(entities: dict, ctx: dict, text: str = "", **_) -> dict:
    from chatbot.services.recommendation_engine import recommendation_engine

    rest_name   = entities.get("RESTAURANT")
    rest_id     = entities.get("restaurant_id")
    cuisine     = entities.get("CUISINE")
    dish_name   = entities.get("DISH")
    location    = entities.get("LOCATION")
    exclude_ids = ctx.get("all_shown_dish_ids", [])

    qs, fallback = recommendation_engine.recommend_dishes(
        restaurant_id=rest_id,
        cuisine=cuisine,
        dish_name=dish_name,
        location=location,
        exclude_ids=exclude_ids,
    )
    dishes = list(qs)

    # ── Fallback bridge: miss dish → try suggest restaurant ───────────────
    # Khi không tìm được món phù hợp nhưng có cuisine/location,
    # chuyển sang gợi ý nhà hàng thay vì show top best seller chung chung.
    if (not dishes or fallback == "FALLBACK_TOP") and (cuisine or location):
        rest_qs, rest_fallback = recommendation_engine.recommend_restaurants(
            cuisine=cuisine, location=location,
            exclude_ids=ctx.get("all_shown_restaurant_ids", []),
        )
        restaurants = list(rest_qs)

        if restaurants and rest_fallback != "FALLBACK_TOP":
            # Có nhà hàng phù hợp → redirect sang SHOW_RESTAURANTS
            filter_parts = []
            if cuisine:  filter_parts.append(f"**{cuisine}**")
            if location: filter_parts.append(f"ở **{location}**")
            filter_str = " ".join(filter_parts)

            _BRIDGE_MESSAGES = {
                "EXACT":             f"Mình chưa tìm thấy món cụ thể, nhưng đây là các nhà hàng {filter_str} bạn có thể thử! 🍜",
                "FALLBACK_PRICE":    f"Đây là các nhà hàng {filter_str} phù hợp nhé!",
                "FALLBACK_LOCATION": f"Chưa có nhà hàng {filter_str}, nhưng đây là các nhà hàng **{cuisine}** nổi bật 🌟",
                "FALLBACK_CUISINE":  f"Không tìm thấy quán **{cuisine}** ở **{location}**, nhưng ở **{location}** có những nhà hàng đang rất HOT nè! 🔥",
            }
            message = _BRIDGE_MESSAGES.get(
                rest_fallback,
                f"Đây là các nhà hàng {filter_str} gợi ý cho bạn!",
            )

            return {
                "message":      message,
                "action":       "SHOW_RESTAURANTS",
                "action_data":  {
                    "restaurants": [_serialize_restaurant(r) for r in restaurants],
                    "filters":     {"cuisine": cuisine, "location": location, "fallback": rest_fallback},
                },
                "pending_slots":             [],
                "_shown_restaurant_ids":     [r.id for r in restaurants],
            }

    if not dishes:
        return {
            "message":      "Mình không tìm thấy món nào phù hợp 😔",
            "action":       "SHOW_INFO",
            "action_data":  {},
            "pending_slots": [],
        }

    context_str = (
        f"của nhà hàng **{rest_name}**" if rest_name
        else (f"**{cuisine or dish_name}**" if (cuisine or dish_name) else "ngon")
    )
    location_str = f" ở **{location}**" if location else ""

    _FALLBACK_MESSAGES = {
        "EXACT":               f"Mình gợi ý một số món {context_str}{location_str} cho bạn nhé 🍽️",
        "FALLBACK_DISH":       f"Không tìm thấy món cụ thể, nhưng đây là các món {context_str}{location_str} khác!",
        "FALLBACK_CUISINE":    f"Nhà hàng **{rest_name}** chưa có món **{cuisine}**, nhưng đây là các món ngon khác!",
        "FALLBACK_RESTAURANT": f"Chưa tìm thấy nhà hàng **{rest_name}**. Nếu thích **{cuisine}**, đây là gợi ý từ quán khác!",
        "FALLBACK_LOCATION":   f"Chưa có món **{cuisine}** ở **{location}**, nhưng đây là các món **{cuisine}** nổi bật khác!",
        "LOOP":                f"Bạn đã xem hết các món ăn phù hợp rồi. Để mình gợi ý lại từ đầu các món ngon nhất cho bạn nhé! 🔄",
    }
    message = _FALLBACK_MESSAGES.get(
        fallback,
        "Mình không tìm thấy món bạn yêu cầu. Đây là Top Best Seller trên hệ thống nè!",
    )

    return {
        "message":      message,
        "action":       "SHOW_DISHES",
        "action_data":  {"dishes": [_serialize_dish(d) for d in dishes], "fallback": fallback},
        "pending_slots":         [],
        "_shown_dish_ids":       [d.id for d in dishes],
        "_reset_shown_ids":      (fallback == "LOOP"),
    }


def handle_ask_alternative(entities: dict, ctx: dict, text: str = "", **_) -> dict:
    """
    Gợi ý thêm, loại trừ những gì đã hiện.
    Phát hiện entity nào thay đổi so với accumulated context để routing chính xác.
    """
    last_intent  = ctx.get("last_intent") or ""
    accumulated  = ctx.get("accumulated_entities", {})

    location_changed = (
        entities.get("LOCATION") and entities.get("LOCATION") != accumulated.get("LOCATION")
    )
    cuisine_changed = (
        entities.get("CUISINE") and entities.get("CUISINE") != accumulated.get("CUISINE")
    )

    if location_changed:
        if "dish" in last_intent:
            return handle_suggest_dish(entities, ctx, text=text)
        return handle_suggest_restaurant(entities, ctx)

    if cuisine_changed:
        if "restaurant" in last_intent:
            return handle_suggest_restaurant(entities, ctx)
        return handle_suggest_dish(entities, ctx, text=text)

    if "dish" in last_intent:
        return handle_suggest_dish(entities, ctx, text=text)
    return handle_suggest_restaurant(entities, ctx)


def handle_reject_suggestion(entities: dict, ctx: dict, **_) -> dict:
    cuisine = entities.get("CUISINE")
    if cuisine:
        msg = f"Bạn không thích {cuisine} à, để mình gợi ý kiểu ẩm thực khác nhé! 😊 Bạn thích ăn gì?"
    else:
        msg = "Không sao ạ! Bạn thích ăn gì, ở khu vực nào? Mình sẽ gợi ý phù hợp hơn 😄"
    return {
        "message":      msg,
        "action":       "ASK_CLARIFICATION",
        "action_data":  {},
        "pending_slots": [],
    }


_CHITCHAT_RESPONSES = [
    "Xin chào! Mình là chatbot đặt bàn nhà hàng. Mình có thể giúp bạn tìm nhà hàng, xem menu, hay đặt bàn nhanh chóng đó! 😊",
    "Chào bạn! Bạn đang muốn đặt bàn hay tìm nhà hàng ăn ngon? Mình sẵn sàng giúp ạ! 🍽️",
    "Hi bạn! Hôm nay bạn muốn ăn gì? Mình có thể gợi ý cho bạn đó 😄",
]


def handle_chitchat(entities: dict, ctx: dict, **_) -> dict:
    # Tránh lặp lại response vừa dùng
    last = ctx.get("_last_chitchat_idx", -1)
    candidates = [i for i in range(len(_CHITCHAT_RESPONSES)) if i != last]
    idx = random.choice(candidates)
    return {
        "message":                  _CHITCHAT_RESPONSES[idx],
        "action":                   "SHOW_INFO",
        "action_data":              {},
        "pending_slots":            [],
        "_last_chitchat_idx":       idx,
    }


def handle_ask_help(entities: dict, ctx: dict, **_) -> dict:
    return {
        "message": (
            "Mình có thể giúp bạn:\n"
            "• 🏠 **Tìm nhà hàng** theo khu vực, ẩm thực, hoặc mức giá\n"
            "• 🍜 **Gợi ý món ăn** ngon\n"
            "• 📍 **Hỏi địa chỉ, số điện thoại** nhà hàng\n"
            "• 🕐 **Xem giờ mở cửa**\n"
            "• 📅 **Đặt bàn nhanh** — bạn chỉ cần nói nhà hàng, số người và giờ!\n\n"
            "Bạn cần giúp gì ạ? 😊"
        ),
        "action":       "SHOW_INFO",
        "action_data":  {},
        "pending_slots": [],
    }


def handle_out_of_scope(entities: dict, ctx: dict, **_) -> dict:
    return {
        "message":      "Xin lỗi bạn, mình chỉ hỗ trợ các câu hỏi liên quan đến nhà hàng và đặt bàn thôi ạ 🙏 Bạn cần giúp gì không?",
        "action":       "SHOW_INFO",
        "action_data":  {},
        "pending_slots": [],
    }


def handle_auto_fallback(entities: dict, ctx: dict, **_) -> dict:
    return {
        "message":      "Xin lỗi, mình chưa hiểu ý bạn lắm 🥲. Bạn có thể diễn đạt lại hoặc chọn các chức năng bên dưới nhé 👇",
        "action":       "SHOW_SUGGESTIONS_CHIPS",
        "action_data":  {
            "chips": ["Gợi ý quán ăn", "Món ngon nổi bật", "Đặt bàn ngay", "Cần hỗ trợ"]
        },
        "pending_slots": [],
    }


# ── Router ────────────────────────────────────────────────────────────────────

INTENT_HANDLERS: dict[str, callable] = {
    "ask_location":        handle_ask_location,
    "ask_contact":         handle_ask_contact,
    "ask_operating_hours": handle_ask_operating_hours,
    "book_table":          handle_book_table,
    "suggest_restaurant":  handle_suggest_restaurant,
    "suggest_dish":        handle_suggest_dish,
    "ask_alternative":     handle_ask_alternative,
    "reject_suggestion":   handle_reject_suggestion,
    "chitchat":            handle_chitchat,
    "ask_help":            handle_ask_help,
    "out_of_scope":        handle_out_of_scope,
    "auto_fallback":       handle_auto_fallback,
}

_RESTAURANT_INFO_HINT_PATTERNS: tuple[re.Pattern, ...] = (
    re.compile(r"\b(thế nào|the nao|sao|ổn không|on khong|ok không|tot khong)\b", re.IGNORECASE),
    re.compile(r"\b(thông tin|chi tiết|review|đánh giá|danh gia)\b", re.IGNORECASE),
)


def _should_route_to_restaurant_info(intent: str, entities: dict, text: str) -> bool:
    """
    Heuristic: khi user hỏi "nhà hàng ... thế nào" nhưng model lỡ bắt thành
    suggest_restaurant/ask_alternative, ưu tiên trả thông tin nhà hàng cụ thể.
    """
    if intent not in {"suggest_restaurant", "ask_alternative", "auto_fallback"}:
        return False
    if not entities.get("RESTAURANT"):
        return False
    normalized = (text or "").strip().lower()
    if not normalized:
        return False
    return any(pattern.search(normalized) for pattern in _RESTAURANT_INFO_HINT_PATTERNS)


def dispatch(intent: str, entities: dict, ctx: dict, text: str = "") -> dict:
    """
    Route intent đến handler tương ứng.
    Fallback về handle_auto_fallback (có suggestion chips) khi intent không tồn tại.
    """
    if _should_route_to_restaurant_info(intent, entities, text):
        # Trả overview thay vì tiếp tục gợi ý danh sách theo khu vực.
        restaurant, restaurant_candidates = _resolve_restaurant_for_info(entities, text, max_candidates=3)
        if restaurant:
            data = _serialize_restaurant(restaurant)
            return {
                "message": (
                    f"Nhà hàng **{restaurant.name}** có địa chỉ: {data.get('address') or 'Chưa cập nhật'}\n"
                    f"📞 SĐT: {data.get('phone') or 'Chưa cập nhật'}\n"
                    f"🕐 Giờ mở cửa: {data.get('opening_hours') or 'Chưa cập nhật'}\n"
                    f"⭐ Đánh giá: {data.get('rating', 0):.1f}/5"
                ),
                "action": "SHOW_INFO",
                "action_data": {"restaurant": data},
                "pending_slots": [],
            }
        if restaurant_candidates:
            return {
                "message": _build_top_restaurants_message(restaurant_candidates, info_type="hours"),
                "action": "SHOW_INFO",
                "action_data": {"restaurants": restaurant_candidates},
                "pending_slots": [],
            }

    handler = INTENT_HANDLERS.get(intent, handle_auto_fallback)
    return handler(entities=entities, ctx=ctx, text=text)
