"""
Context Manager — Lưu & resolve ngữ cảnh hội thoại.

Context được lưu trong Django cache (key = chatbot_ctx_{session_key}).
TTL: 30 phút.

Schema (TypedDict):
    last_intent             : str | None
    pending_intent          : str | None   — intent đang chờ đủ slot
    pending_slots           : list[str]    — slots bot đang hỏi
    paused_stack            : list[dict]   — stack các intent bị tạm dừng
                                            mỗi phần tử: {"intent": str, "slots": list[str]}
    accumulated_entities    : dict         — {entity_type: value} gom qua nhiều lượt
    last_shown_restaurants  : list[int]
    last_shown_dishes       : list[int]
    booking_slots           : dict

Nguyên tắc thiết kế:
  - resolve() KHÔNG mutate dict ctx truyền vào — trả về ctx đã cập nhật cùng với kết quả.
  - UI notification KHÔNG lưu trong context; được trả về qua ResolveResult riêng.
  - Mọi key không hợp lệ được bỏ qua khi load (backward-compat).
"""
from __future__ import annotations

import logging
from typing import TypedDict

from django.core.cache import cache

logger = logging.getLogger(__name__)

CONTEXT_TTL = 60 * 30  # 30 phút

# ── Intent classification sets ────────────────────────────────────────────────

# Intent khi xong thì clear pending ngay (không để lại pending_intent)
TERMINAL_INTENTS: frozenset[str] = frozenset({"book_table"})

# Intent không mang entity hữu ích → không kế thừa, không pending
STATELESS_INTENTS: frozenset[str] = frozenset({"chitchat", "ask_help", "out_of_scope"})

# Intent đủ tự tin có thể interrupt luồng đang chạy (context switch)
INTERRUPTIBLE_INTENTS: frozenset[str] = frozenset({
    "ask_location", "ask_contact", "ask_operating_hours",
    "suggest_restaurant", "suggest_dish",
    "reject_suggestion", "ask_alternative",
})

# Entity slots thuộc luồng book_table
_BOOKING_ENTITIES: frozenset[str] = frozenset({"RESTAURANT", "DATE", "TIME", "PEOPLE_COUNT"})

# Intent tìm kiếm (không phải đặt bàn)
_SEARCH_INTENTS: frozenset[str] = frozenset({"suggest_restaurant", "suggest_dish", "ask_alternative"})

# Confidence tối thiểu để tin intent của PhoBERT
MIN_CONFIDENCE: float = 0.55

# Confidence để cho phép interrupt (context switch)
INTERRUPT_CONFIDENCE: float = 0.85

# Keywords báo hiệu update slot trong book_table
_SLOT_UPDATE_KEYWORDS: tuple[str, ...] = (
    "đổi lại", "sửa lại", "thay đổi", "thay lại", "chuyển sang", "đổi sang",
)


# ── Schema ────────────────────────────────────────────────────────────────────

class PausedFrame(TypedDict):
    intent: str
    slots: list[str]


class ConversationContext(TypedDict):
    last_intent:            str | None
    pending_intent:         str | None
    pending_slots:          list[str]
    paused_stack:           list[PausedFrame]
    accumulated_entities:   dict
    last_shown_restaurants: list[int]
    last_shown_dishes:      list[int]
    all_shown_restaurant_ids: list[int]
    all_shown_dish_ids:     list[int]
    booking_slots:          dict


class ResolveResult(TypedDict):
    """Kết quả của resolve() — không có side effect nào bên ngoài."""
    intent:           str
    entities:         dict
    is_context_switch: bool          # True nếu vừa interrupt một intent khác
    notify_paused:    bool           # True nếu nên nhắc user về task bị tạm ngưng
    should_reset_shown_ids: bool     # True nếu tiêu chí tìm kiếm thay đổi -> reset exclude_ids


def _empty_context() -> ConversationContext:
    return ConversationContext(
        last_intent=None,
        pending_intent=None,
        pending_slots=[],
        paused_stack=[],
        accumulated_entities={},
        last_shown_restaurants=[],
        last_shown_dishes=[],
        all_shown_restaurant_ids=[],
        all_shown_dish_ids=[],
        booking_slots={},
    )


def _migrate_context(raw: dict) -> ConversationContext:
    """
    Chuyển đổi context cũ (single paused_intent/paused_slots) sang schema mới.
    Đảm bảo backward-compatibility khi deploy.
    """
    ctx = _empty_context()
    ctx.update({
        k: raw[k]
        for k in ConversationContext.__annotations__
        if k in raw
    })

    # Migration: paused_intent + paused_slots → paused_stack
    if "paused_intent" in raw and raw["paused_intent"] and not ctx["paused_stack"]:
        ctx["paused_stack"] = [
            PausedFrame(intent=raw["paused_intent"], slots=raw.get("paused_slots", []))
        ]

    return ctx


# ── Cache helpers ─────────────────────────────────────────────────────────────

def _cache_key(session_key: str) -> str:
    return f"chatbot_ctx_{session_key}"


def load_context(session_key: str) -> ConversationContext:
    raw = cache.get(_cache_key(session_key))
    if raw is None:
        return _empty_context()
    return _migrate_context(raw)


def save_context(session_key: str, ctx: ConversationContext) -> None:
    cache.set(_cache_key(session_key), dict(ctx), timeout=CONTEXT_TTL)


def clear_context(session_key: str) -> None:
    cache.delete(_cache_key(session_key))


# ── Core logic ────────────────────────────────────────────────────────────────

def resolve(
    phobert_result: dict,
    ctx: ConversationContext,
    text: str,
) -> ResolveResult:
    """
    Phân giải intent + entities cuối cùng sau khi xét ngữ cảnh.

    KHÔNG mutate ctx — trả về ResolveResult thuần.
    Caller dùng update_after_response() để ghi ctx mới vào cache.
    """
    raw_intent   = phobert_result["intent"]
    confidence   = phobert_result["intent_confidence"]
    new_entities = phobert_result["entities"]

    # 0. Phát hiện thay đổi tiêu chí cốt lõi (LOCATION, CUISINE, DISH)
    # Nếu user đổi khu vực hoặc món ăn, ta nên reset danh sách đã hiển thị.
    should_reset_shown_ids = False
    if raw_intent in _SEARCH_INTENTS:
        for slot in ("LOCATION", "CUISINE", "DISH"):
            if slot in new_entities and new_entities[slot]:
                old_val = ctx["accumulated_entities"].get(slot)
                if old_val and old_val != new_entities[slot]:
                    logger.debug(f"[CTX] Core criteria changed ({slot}: {old_val} -> {new_entities[slot]}). Will reset shown IDs.")
                    should_reset_shown_ids = True
                    break

    # Merge entities: accumulated + new (new wins on conflict)
    merged = {**ctx["accumulated_entities"], **new_entities}

    # Nếu câu mới có entity cùng loại thì luôn ưu tiên thay thế entity cũ.
    # (đặc biệt cho các câu tìm kiếm liên tiếp theo location/cuisine).
    for slot in ("LOCATION", "CUISINE", "DISH", "PRICE", "RESTAURANT"):
        if slot in new_entities and new_entities.get(slot):
            merged[slot] = new_entities[slot]
            if slot == "RESTAURANT" and "restaurant_id" not in new_entities:
                merged.pop("restaurant_id", None)

    # Search intents nên ưu tiên entity "fresh" ở lượt hiện tại để tránh context bleed
    # (vd: CUISINE cũ "indi" bám sang câu mới "gợi ý món ở salad stop").
    if raw_intent in _SEARCH_INTENTS:
        transient_slots = {"CUISINE", "DISH", "dish_id", "PRICE", "LOCATION"}
        for slot in transient_slots:
            if slot not in new_entities:
                merged.pop(slot, None)

    current_pending = ctx.get("pending_intent")
    paused_stack    = ctx.get("paused_stack", [])
    current_paused  = paused_stack[-1]["intent"] if paused_stack else None

    logger.debug(
        f"[RESOLVE] text='{text}' raw='{raw_intent}' ({confidence:.2f}) "
        f"new_ent={list(new_entities.keys())} "
        f"pending='{current_pending}' paused='{current_paused}'"
    )

    # ── book_table slot priority ───────────────────────────────────────────
    # Nếu đang pending hoặc paused book_table và user cung cấp booking slot
    # → force về book_table, bất kể intent model đoán là gì
    in_booking_flow = "book_table" in [current_pending, current_paused]
    if in_booking_flow:
        provided_booking = set(new_entities.keys()) & _BOOKING_ENTITIES
        if provided_booking:
            logger.debug(
                f"[CTX] book_table priority: user provided {provided_booking}"
            )
            return ResolveResult(
                intent="book_table",
                entities=merged,
                is_context_switch=False,
                notify_paused=False,
            )

        text_lower = text.lower()
        if any(kw in text_lower for kw in _SLOT_UPDATE_KEYWORDS):
            logger.debug("[CTX] book_table slot-update detected, forcing resolve")
            return ResolveResult(
                intent="book_table",
                entities=merged,
                is_context_switch=False,
                notify_paused=False,
            )

    # ── Intent inheritance ─────────────────────────────────────────────────
    is_context_switch = False
    resolved_intent   = raw_intent

    if _should_inherit(raw_intent, confidence, new_entities, ctx):
        resolved_intent = current_pending
        logger.debug(f"[CTX] Inherit intent '{resolved_intent}' (raw='{raw_intent}')")

        # Nếu model không bắt được entity nào, thử map raw text → slot đầu tiên
        if not new_entities and ctx.get("pending_slots"):
            first_slot = ctx["pending_slots"][0]
            if first_slot not in merged:
                _CATALOG_SLOTS = ["RESTAURANT", "DISH", "CUISINE", "LOCATION"]
                
                if first_slot == "RESTAURANT":
                    # Ép gọi Validation bằng Fuzzy với DB
                    from .entity_extractor import extract_restaurant_candidates_from_text
                    # Quét xem có nhà hàng nào vượt mốc 65 không, nếu có thì mới gán
                    candidates = extract_restaurant_candidates_from_text(text.strip(), max_results=1)
                    if candidates and candidates[0][2] >= 65:
                        # Chỉ lưu canonical từ DB, không lưu raw text user.
                        merged[first_slot] = candidates[0][0]
                        merged["restaurant_id"] = candidates[0][1]
                elif first_slot in _CATALOG_SLOTS:
                    # Tạm thời các slot catalog khác không áp dụng bế nguyên câu
                    pass 
                else:
                    # Các slot linh hoạt (DATE, TIME, PEOPLE_COUNT) thì thoải mái gán
                    merged[first_slot] = text.strip()
    else:
        # Context switch: đang có task dở nhưng user chuyển sang intent khác
        if current_pending and current_pending != raw_intent:
            is_context_switch = True

    return ResolveResult(
        intent=resolved_intent,
        entities=merged,
        is_context_switch=is_context_switch,
        notify_paused=False,   # sẽ được tính lại trong update_after_response
        should_reset_shown_ids=should_reset_shown_ids,
    )


def _should_inherit(
    raw_intent: str,
    confidence: float,
    new_entities: dict,
    ctx: ConversationContext,
) -> bool:
    """Quyết định có kế thừa pending_intent không."""
    if not ctx.get("pending_intent"):
        return False

    # Stateless intent (chào hỏi, trợ giúp) → luôn kế thừa
    if raw_intent in STATELESS_INTENTS:
        return True

    # Model rất tự tin về intent mới và intent đó có thể interrupt → cho switch
    if confidence >= INTERRUPT_CONFIDENCE and raw_intent in INTERRUPTIBLE_INTENTS:
        return False

    # Đang chờ slot cho book_table nhưng user chuyển sang search với entity không phải booking
    if ctx["pending_intent"] == "book_table" and raw_intent in _SEARCH_INTENTS:
        non_booking = set(new_entities.keys()) - _BOOKING_ENTITIES
        provided_booking = set(new_entities.keys()) & _BOOKING_ENTITIES
        if non_booking and not provided_booking:
            return False

    # Đang trong trạng thái điền form
    if ctx.get("pending_slots"):
        if not new_entities:
            # Không bắt được entity nào → nếu không phải intent từ chối rõ ràng thì kế thừa
            if raw_intent in {"reject_suggestion", "ask_alternative"}:
                return False
            return True

    if confidence < MIN_CONFIDENCE:
        return True

    # Có entity mới → đang điền slot
    if new_entities:
        return True

    return False


def update_after_response(
    ctx: ConversationContext,
    resolved_intent: str,
    merged_entities: dict,
    pending_slots_remaining: list[str],
    is_context_switch: bool = False,
    should_reset_shown_ids: bool = False,
) -> tuple[ConversationContext, bool]:
    """
    Tính toán context mới sau khi bot trả lời.

    Returns:
        (new_ctx, notify_paused)
        notify_paused = True nếu caller nên nhắc user về task bị tạm ngưng.
    """
    new_ctx = ConversationContext(**ctx)
    new_ctx["last_intent"]          = resolved_intent
    new_ctx["accumulated_entities"] = merged_entities

    if should_reset_shown_ids:
        new_ctx["all_shown_restaurant_ids"] = []
        new_ctx["all_shown_dish_ids"] = []
        new_ctx["last_shown_restaurants"] = []
        new_ctx["last_shown_dishes"] = []

    notify_paused = False
    paused_stack  = list(ctx.get("paused_stack", []))

    # Context switch: đẩy task đang dở vào stack
    if is_context_switch and ctx.get("pending_intent"):
        frame = PausedFrame(
            intent=ctx["pending_intent"],
            slots=list(ctx.get("pending_slots", [])),
        )
        paused_stack.append(frame)
        logger.debug(f"[CTX] Pushed to paused_stack: {frame}")

    if pending_slots_remaining:
        is_info_intent = resolved_intent.startswith("ask_") and resolved_intent != "book_table"

        if is_info_intent and paused_stack:
            # Info intent xen giữa → không ghi đè pending chính
            new_ctx["pending_intent"] = None
            new_ctx["pending_slots"]  = []
            # Nhắc nhẹ user về task đang bị hold
            notify_paused = True
        else:
            new_ctx["pending_intent"] = resolved_intent
            new_ctx["pending_slots"]  = pending_slots_remaining

            # Nếu task hiện tại chính là task đang bị paused → pop stack
            if paused_stack and paused_stack[-1]["intent"] == resolved_intent:
                paused_stack.pop()
    else:
        # Task xong
        new_ctx["pending_intent"] = None
        new_ctx["pending_slots"]  = []

        # Nếu còn task trong stack → resume và nhắc user
        if paused_stack:
            notify_paused = True

    new_ctx["paused_stack"] = paused_stack
    return new_ctx, notify_paused


# ── Entity / booking helpers ──────────────────────────────────────────────────

def set_shown_restaurants(ctx: ConversationContext, ids: list[int]) -> ConversationContext:
    new_ctx = ConversationContext(**ctx)
    new_ctx["last_shown_restaurants"] = list(ids)
    existing = set(new_ctx.get("all_shown_restaurant_ids", []))
    new_ctx["all_shown_restaurant_ids"] = list(existing | set(ids))
    return new_ctx


def set_shown_dishes(ctx: ConversationContext, ids: list[int]) -> ConversationContext:
    new_ctx = ConversationContext(**ctx)
    new_ctx["last_shown_dishes"] = list(ids)
    existing = set(new_ctx.get("all_shown_dish_ids", []))
    new_ctx["all_shown_dish_ids"] = list(existing | set(ids))
    return new_ctx


def merge_booking_slots(ctx: ConversationContext, new_slots: dict) -> ConversationContext:
    new_ctx = ConversationContext(**ctx)
    new_ctx["booking_slots"]          = {**ctx.get("booking_slots", {}), **new_slots}
    new_ctx["accumulated_entities"]   = {**ctx.get("accumulated_entities", {}), **new_slots}
    return new_ctx


def peek_paused(ctx: ConversationContext) -> PausedFrame | None:
    """Trả về frame intent đang bị tạm ngưng gần nhất (không pop)."""
    stack = ctx.get("paused_stack", [])
    return stack[-1] if stack else None
