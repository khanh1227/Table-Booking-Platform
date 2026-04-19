"""
Views cho Chatbot API.
Endpoints:
  POST /api/chatbot/message/   — Gửi tin nhắn
  GET  /api/chatbot/history/   — Lịch sử chat của session
"""
import uuid
import logging

from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import AllowAny

from .models import ChatSession, ChatMessage
from .services import context_manager as ctx_mgr
from .services.phobert_service import PhoBERTService
from .services.intent_handlers import dispatch

logger = logging.getLogger(__name__)


class ChatbotMessageView(APIView):
    """
    POST /api/chatbot/message/
    Body: { "message": str, "session_key": str (optional) }
    """
    permission_classes = [AllowAny]

    def post(self, request):
        message_text = (request.data.get("message") or "").strip()
        postback = request.data.get("postback")

        if not message_text and not postback:
            return Response({"error": "message or postback is required"}, status=status.HTTP_400_BAD_REQUEST)

        # ── Session ──────────────────────────────────────────────────────────
        session_key = request.data.get("session_key") or str(uuid.uuid4())
        session, _ = ChatSession.objects.get_or_create(
            session_key=session_key,
            defaults={"user": request.user if request.user.is_authenticated else None}
        )

        # Lưu tin user
        if message_text:
            ChatMessage.objects.create(
                session=session, role=ChatMessage.ROLE_USER, content=message_text
            )

        # ── PhoBERT inference or Postback ─────────────────────────────────
        if postback:
            phobert_result = {
                "intent": postback.get("intent", "auto_fallback"),
                "intent_confidence": 1.0,
                "entities": postback.get("entities", {})
            }
        else:
            try:
                phobert_result = PhoBERTService.get_instance().predict(message_text)
            except Exception as e:
                logger.exception(f"[Chatbot] PhoBERT error: {e}")
                return Response({
                    "session_key": session_key,
                    "message":     "Xin lỗi bạn, mình gặp sự cố kỹ thuật. Bạn thử lại sau nhé 🙏",
                    "action":      "SHOW_INFO",
                    "action_data": {},
                }, status=status.HTTP_200_OK)

        # ── Context load (cần sớm cho enhancer) ────────────────────────────
        ctx = ctx_mgr.load_context(session_key)

        # ── Post-NER Enhancement ───────────────────────────────────────────
        # Bổ sung entities mà PhoBERT NER bỏ sót (CUISINE, DATE/TIME, anaphora)
        if not postback:
            try:
                from .services.post_ner_enhancer import enhance as post_ner_enhance
                phobert_result["entities"] = post_ner_enhance(message_text, phobert_result, ctx)
            except Exception as e:
                logger.error(f"[PostNER] Enhancement failed: {e}", exc_info=True)

        # ── Tiền xử lý Low Confidence ──────────────────────────────────────
        if phobert_result.get("intent_confidence", 0) < 0.4 and not phobert_result.get("entities"):
            # Model ngơ ngác và không bắt được cả Entity -> Ép Fallback Action
            phobert_result["intent"] = "auto_fallback"

        # ── Context resolve ───────────────────────────────────────────────
        resolve_res = ctx_mgr.resolve(phobert_result, ctx, message_text)
        resolved_intent = resolve_res["intent"]
        merged_entities = resolve_res["entities"]
        is_context_switch = resolve_res["is_context_switch"]

        # RESET BEFORE DISPATCH: Nếu tiêu chí tìm kiếm thay đổi, xóa bộ lọc exclude_ids ngay
        if resolve_res.get("should_reset_shown_ids"):
            ctx["all_shown_restaurant_ids"] = []
            ctx["all_shown_dish_ids"] = []
            ctx["last_shown_restaurants"] = []
            ctx["last_shown_dishes"] = []
            logger.debug("[Chatbot] Pre-dispatch reset of shown IDs triggered.")

        # ── Dispatch tới handler ──────────────────────────────────────────
        handler_result = dispatch(resolved_intent, merged_entities, ctx, text=message_text)

        message_out   = handler_result["message"]
        action        = handler_result["action"]
        action_data   = handler_result.get("action_data", {})
        pending_slots = handler_result.get("pending_slots", [])

        # ── Cập nhật context ──────────────────────────────────────────────
        ctx, notify_paused = ctx_mgr.update_after_response(
            ctx, resolved_intent, merged_entities, pending_slots, is_context_switch,
            should_reset_shown_ids=resolve_res.get("should_reset_shown_ids", False)
        )

        if handler_result.get("_reset_shown_ids"):
            # RESET LOOP: Xóa lịch sử để bắt đầu vòng lặp mới
            ctx["all_shown_restaurant_ids"] = []
            ctx["all_shown_dish_ids"] = []
            ctx["last_shown_restaurants"] = []
            ctx["last_shown_dishes"] = []
            logger.debug("[Chatbot] Loop reset triggered by handler.")

        # Cập nhật danh sách đã hiện (để ask_alternative loại trừ)
        if "_shown_restaurant_ids" in handler_result:
            ctx = ctx_mgr.set_shown_restaurants(ctx, handler_result["_shown_restaurant_ids"])
        if "_shown_dish_ids" in handler_result:
            ctx = ctx_mgr.set_shown_dishes(ctx, handler_result["_shown_dish_ids"])

        ctx_mgr.save_context(session_key, ctx)

        # Cập nhật metadata tin nhắn user
        ChatMessage.objects.filter(
            session=session, role=ChatMessage.ROLE_USER
        ).last().delete()  # xóa rồi tạo lại với entity
        ChatMessage.objects.create(
            session=session,
            role=ChatMessage.ROLE_USER,
            content=message_text,
            intent=resolved_intent,
            entities_json=merged_entities,
        )

        # Lưu tin bot
        ChatMessage.objects.create(
            session=session,
            role=ChatMessage.ROLE_BOT,
            content=message_out,
            action=action,
            action_data=action_data,
        )

        return Response({
            "session_key":  session_key,
            "message":      message_out,
            "action":       action,
            "action_data":  action_data,
            # Debug info (có thể tắt ở production)
            "debug": {
                "raw_intent":       phobert_result["intent"],
                "intent_confidence": phobert_result.get("intent_confidence", 0),
                "resolved_intent":  resolved_intent,
                "entities":         merged_entities,
            },
        })


class ChatHistoryView(APIView):
    """GET /api/chatbot/history/?session_key=xxx"""
    permission_classes = [AllowAny]

    def get(self, request):
        session_key = request.query_params.get("session_key")
        if not session_key:
            return Response({"error": "session_key is required"}, status=status.HTTP_400_BAD_REQUEST)

        try:
            session = ChatSession.objects.get(session_key=session_key)
        except ChatSession.DoesNotExist:
            return Response({"messages": []})

        messages = session.messages.order_by('created_at').values(
            'role', 'content', 'intent', 'entities_json', 'action', 'action_data', 'created_at'
        )
        return Response({"session_key": session_key, "messages": list(messages)})


class ChatSessionView(APIView):
    """POST /api/chatbot/session/  — Tạo session mới"""
    permission_classes = [AllowAny]

    def post(self, request):
        session_key = str(uuid.uuid4())
        ChatSession.objects.create(
            session_key=session_key,
            user=request.user if request.user.is_authenticated else None
        )
        return Response({"session_key": session_key})
