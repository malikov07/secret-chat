from django.conf import settings
from django.db import models
from django.utils import timezone


class Conversation(models.Model):
    """The single one-to-one chat shared by a pair. Participants ordered by id."""

    user_a = models.ForeignKey(settings.AUTH_USER_MODEL,
                               on_delete=models.CASCADE, related_name="+")
    user_b = models.ForeignKey(settings.AUTH_USER_MODEL,
                               on_delete=models.CASCADE, related_name="+")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=["user_a", "user_b"],
                                    name="unique_conversation_pair"),
        ]

    def __str__(self):
        return f"Conversation({self.user_a} & {self.user_b})"

    @classmethod
    def between(cls, u1, u2):
        """Get or create the conversation for two users (order-independent)."""
        lo, hi = sorted([u1, u2], key=lambda u: u.id)
        conv, _ = cls.objects.get_or_create(user_a=lo, user_b=hi)
        return conv

    def other(self, user):
        return self.user_b if user.id == self.user_a_id else self.user_a

    def has_participant(self, user):
        return user.id in (self.user_a_id, self.user_b_id)

    @property
    def group_name(self):
        return f"chat_{self.id}"


class Message(models.Model):
    class Type(models.TextChoices):
        TEXT = "text", "Text"
        IMAGE = "image", "Image"
        VIDEO = "video", "Video"
        VOICE = "voice", "Voice"
        VIDEO_NOTE = "video_note", "Video note"  # circular video message
        FILE = "file", "File"

    conversation = models.ForeignKey(Conversation, on_delete=models.CASCADE,
                                     related_name="messages")
    sender = models.ForeignKey(settings.AUTH_USER_MODEL,
                               on_delete=models.CASCADE, related_name="messages")
    type = models.CharField(max_length=16, choices=Type.choices, default=Type.TEXT)

    text = models.TextField(blank=True)
    media = models.FileField(upload_to="chat/%Y/%m/", blank=True, null=True)
    media_name = models.CharField(max_length=255, blank=True)
    media_size = models.BigIntegerField(default=0)
    duration = models.FloatField(default=0)  # seconds, for voice/video

    reply_to = models.ForeignKey("self", on_delete=models.SET_NULL,
                                 null=True, blank=True, related_name="replies")
    reaction = models.CharField(max_length=16, blank=True)  # single partner reaction

    created_at = models.DateTimeField(auto_now_add=True)
    edited_at = models.DateTimeField(null=True, blank=True)
    is_read = models.BooleanField(default=False)
    read_at = models.DateTimeField(null=True, blank=True)
    is_deleted = models.BooleanField(default=False)

    class Meta:
        ordering = ["created_at"]

    def __str__(self):
        return f"{self.sender}: {self.text[:30] or self.type}"

    def mark_read(self):
        if not self.is_read:
            self.is_read = True
            self.read_at = timezone.now()
            self.save(update_fields=["is_read", "read_at"])
