import re

from rest_framework import serializers

from .models import Dream

VIDEO_RE = re.compile(r"\.(mp4|webm|mov|m4v|ogg)$", re.I)


class DreamSerializer(serializers.ModelSerializer):
    created_by_name = serializers.CharField(source="created_by.name", read_only=True)
    media_url = serializers.SerializerMethodField()
    media_items = serializers.SerializerMethodField()
    achievement_media_url = serializers.SerializerMethodField()

    class Meta:
        model = Dream
        fields = ["id", "title", "body", "emoji", "dream_date", "media_url", "media_items",
                  "is_achieved", "achieved_date", "achievement_note", "achievement_media_url",
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
            url = self._url(obj.media)
            items.append({"id": None, "url": url,
                          "type": "video" if VIDEO_RE.search(url or "") else "image"})
        return items

    def get_achievement_media_url(self, obj):
        return self._url(obj.achievement_media)
