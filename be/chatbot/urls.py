from django.urls import path
from .views import ChatbotMessageView, ChatHistoryView, ChatSessionView

urlpatterns = [
    path('message/', ChatbotMessageView.as_view(), name='chatbot-message'),
    path('history/', ChatHistoryView.as_view(), name='chatbot-history'),
    path('session/', ChatSessionView.as_view(), name='chatbot-session'),
]
