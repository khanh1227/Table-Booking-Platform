from django.db import models


class ChatSession(models.Model):
    """Phiên chat — anonymous hoặc có user."""
    session_key = models.CharField(max_length=64, unique=True, db_index=True)
    # Không yêu cầu login nên user có thể null
    user = models.ForeignKey(
        'accounts.User',
        null=True, blank=True,
        on_delete=models.SET_NULL,
        related_name='chat_sessions'
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'chatbot_sessions'

    def __str__(self):
        return f"Session {self.session_key}"


class ChatMessage(models.Model):
    ROLE_USER = 'USER'
    ROLE_BOT = 'BOT'
    ROLE_CHOICES = [(ROLE_USER, 'User'), (ROLE_BOT, 'Bot')]

    session = models.ForeignKey(
        ChatSession, on_delete=models.CASCADE, related_name='messages'
    )
    role = models.CharField(max_length=4, choices=ROLE_CHOICES)
    content = models.TextField()

    # Metadata từ PhoBERT (chỉ có ở tin nhắn user)
    intent = models.CharField(max_length=50, blank=True, null=True)
    entities_json = models.JSONField(default=dict, blank=True)

    # Action bot trả về (chỉ có ở tin nhắn bot)
    action = models.CharField(max_length=30, blank=True, null=True)
    action_data = models.JSONField(default=dict, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'chatbot_messages'
        ordering = ['created_at']

    def __str__(self):
        return f"[{self.role}] {self.content[:50]}"
