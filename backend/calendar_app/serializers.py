from rest_framework import serializers

from .models import CalendarEvent, Story


class CalendarEventSerializer(serializers.ModelSerializer):
    created_by_name = serializers.CharField(source="created_by.name", read_only=True)

    class Meta:
        model = CalendarEvent
        fields = ["id", "title", "description", "date", "time", "emoji",
                  "color", "created_by", "created_by_name", "created_at"]
        read_only_fields = ["created_by", "created_at"]


class StorySerializer(serializers.ModelSerializer):
    created_by_name = serializers.CharField(source="created_by.name", read_only=True)
    media_url = serializers.SerializerMethodField()
    media_items = serializers.SerializerMethodField()

    class Meta:
        model = Story
        fields = ["id", "date", "caption", "media_url", "media_type", "media_items",
                  "created_by", "created_by_name", "created_at"]
        read_only_fields = ["created_by", "created_at"]

    def _url(self, f):
        if not f:
            return None
        request = self.context.get("request")
        return request.build_absolute_uri(f.url) if request else f.url

    def get_media_url(self, obj):
        return self._url(obj.media)

    def get_media_items(self, obj):
        items = [{"id": a.id, "url": self._url(a.file), "type": a.kind}
                 for a in obj.attachments.all()]
        if not items and obj.media:
            items.append({"id": None, "url": self._url(obj.media),
                          "type": obj.media_type or "image"})
        return items
