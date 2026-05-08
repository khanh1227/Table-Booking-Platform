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

logger = logging.getLogger(__name__)


class ChatbotMessageView(APIView):
    """
    POST /api/chatbot/message/
    Proxy request tới chatbot_llm service (FastAPI - port 8001).
    """
    permission_classes = [AllowAny]

    def post(self, request):
        message_text = (request.data.get("message") or "").strip()
        postback = request.data.get("postback")

        if not message_text and not postback:
            return Response({"error": "message or postback is required"}, status=status.HTTP_400_BAD_REQUEST)

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

        # Trích xuất JWT token nếu có
        user_token = None
        auth_header = request.headers.get("Authorization")
        if auth_header and auth_header.startswith("Bearer "):
             user_token = auth_header

        # Proxy sang FastAPI service 
        import httpx
        try:
            logger.info(f"[ChatbotProxy] Forwarding message to port 8001: {message_text[:50]}...")
            
            # Gửi post sang LLM chatbot service
            chatbot_service_url = "http://127.0.0.1:8001/chat"
            payload = {
                "message": message_text,
                "postback": postback,
                "session_key": session_key,
                "user_token": user_token
            }
            
            # Tăng timeout lên 600s vì LLM load model rất chậm ở lượt đầu
            with httpx.Client(timeout=600.0) as client:
                 resp = client.post(chatbot_service_url, json=payload)
            
            logger.info(f"[ChatbotProxy] Service 8001 responded with status: {resp.status_code}")
            
            if resp.status_code == 200:
                data = resp.json()
                message_out = data.get("message", "")
                action = data.get("action", "SHOW_INFO")
                action_data = data.get("action_data", {})
                
                # Cập nhật context session_key
                returned_session_key = data.get("session_key", session_key)
                
                # Lưu tin nhắn bot
                ChatMessage.objects.create(
                    session=session,
                    role=ChatMessage.ROLE_BOT,
                    content=message_out,
                    action=action,
                    action_data=action_data,
                )
                
                return Response({
                    "session_key": returned_session_key,
                    "message": message_out,
                    "action": action,
                    "action_data": action_data
                })
            else:
                logger.error(f"Chatbot service trả về lỗi: {resp.status_code} - {resp.text}")
                raise Exception("Service trả về lỗi")
                
        except Exception as e:
            logger.exception(f"[ChatbotProxy] Proxy error: {e}")
            return Response({
                "session_key": session_key,
                "message":     "Xin lỗi bạn, trợ lý của mình đang tạm nghỉ ngơi. Bạn thử lại sau nhé 🙏",
                "action":      "SHOW_INFO",
                "action_data": {},
            }, status=status.HTTP_200_OK)


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
