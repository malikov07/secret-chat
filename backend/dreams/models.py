from django.conf import settings
from django.db import models


class Dream(models.Model):
    """A dream entry, shared between partners."""

    created_by = models.ForeignKey(settings.AUTH_USER_MODEL,
                                   on_delete=models.CASCADE, related_name="dreams")
    title = models.CharField(max_length=140)
    body = models.TextField(blank=True)
    emoji = models.CharField(max_length=16, blank=True, default="🌙")
    dream_date = models.DateField(null=True, blank=True)
    media = models.FileField(upload_to="dreams/%Y/%m/", blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)

    # Achievement: when a shared dream comes true.
    is_achieved = models.BooleanField(default=False)
    achieved_date = models.DateField(null=True, blank=True)
    achievement_note = models.TextField(blank=True)
    achievement_media = models.FileField(upload_to="achievements/%Y/%m/", blank=True, null=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"Dream: {self.title}"


class DreamMedia(models.Model):
    """One of possibly several photos/videos attached to a dream."""
    dream = models.ForeignKey(Dream, on_delete=models.CASCADE, related_name="attachments")
    file = models.FileField(upload_to="dreams/%Y/%m/")
    kind = models.CharField(max_length=8, default="image")  # image / video
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["id"]
