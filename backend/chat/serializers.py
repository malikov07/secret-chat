from rest_framework import serializers

from accounts.serializers import PublicUserSerializer
from .models import Conversation, Message


class ReplyPreviewSerializer(serializers.ModelSerializer):
    sender_name = serializers.CharField(source="sender.name", read_only=True)

    class Meta:
        model = Message
        fields = ["id", "sender_name", "type", "text"]


class MessageSerializer(serializers.ModelSerializer):
    sender = PublicUserSerializer(read_only=True)
    reply_to = ReplyPreviewSerializer(read_only=True)
    media_url = serializers.SerializerMethodField()

    class Meta:
        model = Message
        fields = [
            "id", "conversation", "sender", "type", "text",
            "media_url", "media_name", "media_size", "duration",
            "reply_to", "reaction", "created_at", "edited_at",
            "is_read", "read_at", "is_deleted",
        ]

    def get_media_url(self, obj):
        if not obj.media:
            return None
        request = self.context.get("request")
        url = obj.media.url
        return request.build_absolute_uri(url) if request else url


class ConversationSerializer(serializers.ModelSerializer):
    partner = serializers.SerializerMethodField()

    class Meta:
        model = Conversation
        fields = ["id", "partner", "created_at"]

    def get_partner(self, obj):
        me = self.context["request"].user
        return PublicUserSerializer(obj.other(me)).data
