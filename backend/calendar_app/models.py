from django.conf import settings
from django.db import models


class CalendarEvent(models.Model):
    """A shared calendar event visible to both partners."""

    created_by = models.ForeignKey(settings.AUTH_USER_MODEL,
                                   on_delete=models.CASCADE, related_name="events")
    title = models.CharField(max_length=140)
    description = models.TextField(blank=True)
    date = models.DateField()
    time = models.TimeField(null=True, blank=True)
    emoji = models.CharField(max_length=16, blank=True)
    color = models.CharField(max_length=16, default="#e07cff")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["date", "time"]

    def __str__(self):
        return f"{self.date} {self.title}"


class Story(models.Model):
    """A memory (photo/video/note) pinned to a date, shared between partners."""

    created_by = models.ForeignKey(settings.AUTH_USER_MODEL,
                                   on_delete=models.CASCADE, related_name="stories")
    date = models.DateField()
    caption = models.TextField(blank=True)
    media = models.FileField(upload_to="stories/%Y/%m/", blank=True, null=True)
    media_type = models.CharField(max_length=8, blank=True)  # image / video
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-date", "-created_at"]

    def __str__(self):
        return f"Story {self.date} by {self.created_by}"


class StoryMedia(models.Model):
    """One of possibly several photos/videos attached to a memory."""
    story = models.ForeignKey(Story, on_delete=models.CASCADE, related_name="attachments")
    file = models.FileField(upload_to="stories/%Y/%m/")
    kind = models.CharField(max_length=8, default="image")  # image / video
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["id"]
