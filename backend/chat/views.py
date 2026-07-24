from django.utils import timezone
from rest_framework import status
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .broadcast import send_to_group, user_group
from .models import Conversation, Message
from .serializers import ConversationSerializer, MessageSerializer


def _require_partner(user):
    return user.partner


class ConversationView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        partner = _require_partner(request.user)
        if not partner:
            return Response({"detail": "You have no partner yet.", "conversation": None},
                            status=status.HTTP_200_OK)
        conv = Conversation.between(request.user, partner)
        return Response(ConversationSerializer(conv, context={"request": request}).data)


class MessageListView(APIView):
    permission_classes = [IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    def _conversation(self, request):
        partner = _require_partner(request.user)
        if not partner:
            return None
        return Conversation.between(request.user, partner)

    def get(self, request):
        conv = self._conversation(request)
        if not conv:
            return Response({"results": []})
        qs = conv.messages.all()
        before = request.query_params.get("before")
        if before:
            qs = qs.filter(id__lt=before)
        limit = min(int(request.query_params.get("limit", 50)), 100)
        # newest slice, returned in chronological order
        msgs = list(qs.order_by("-created_at")[:limit])[::-1]
        data = MessageSerializer(msgs, many=True, context={"request": request}).data
        return Response({"results": data})

    def post(self, request):
        conv = self._conversation(request)
        if not conv:
            return Response({"detail": "You have no partner yet."},
                            status=status.HTTP_400_BAD_REQUEST)

        text = (request.data.get("text") or "").strip()
        media = request.FILES.get("media")
        msg_type = request.data.get("type", Message.Type.TEXT)
        reply_to_id = request.data.get("reply_to")

        if not text and not media:
            return Response({"detail": "Message is empty."},
                            status=status.HTTP_400_BAD_REQUEST)

        msg = Message(conversation=conv, sender=request.user, text=text)
        if media:
            msg.media = media
            msg.media_name = getattr(media, "name", "")
            msg.media_size = getattr(media, "size", 0)
            msg.type = msg_type if msg_type in Message.Type.values else Message.Type.FILE
            try:
                msg.duration = float(request.data.get("duration", 0) or 0)
            except (TypeError, ValueError):
                msg.duration = 0
        else:
            msg.type = Message.Type.TEXT
        if reply_to_id:
            msg.reply_to = conv.messages.filter(id=reply_to_id).first()
        msg.save()

        payload = MessageSerializer(msg, context={"request": request}).data
        send_to_group(conv.group_name, "chat.message", {"message": payload})
        return Response(payload, status=status.HTTP_201_CREATED)


class MessageDetailView(APIView):
    permission_classes = [IsAuthenticated]

    def _get(self, request, pk):
        partner = _require_partner(request.user)
        if not partner:
            return None
        conv = Conversation.between(request.user, partner)
        return conv.messages.filter(id=pk).first()

    def patch(self, request, pk):
        msg = self._get(request, pk)
        if not msg:
            return Response(status=status.HTTP_404_NOT_FOUND)

        # React: either participant can set a reaction.
        if "reaction" in request.data:
            msg.reaction = request.data.get("reaction") or ""
            msg.save(update_fields=["reaction"])

        # Edit text: only the sender, only text messages.
        if "text" in request.data and msg.sender_id == request.user.id:
            msg.text = (request.data.get("text") or "").strip()
            msg.edited_at = timezone.now()
            msg.save(update_fields=["text", "edited_at"])

        payload = MessageSerializer(msg, context={"request": request}).data
        send_to_group(msg.conversation.group_name, "chat.update", {"message": payload})
        return Response(payload)

    def delete(self, request, pk):
        msg = self._get(request, pk)
        if not msg:
            return Response(status=status.HTTP_404_NOT_FOUND)
        if msg.sender_id != request.user.id:
            return Response({"detail": "You can only delete your own messages."},
                            status=status.HTTP_403_FORBIDDEN)
        msg.is_deleted = True
        msg.text = ""
        msg.save(update_fields=["is_deleted", "text"])
        payload = MessageSerializer(msg, context={"request": request}).data
        send_to_group(msg.conversation.group_name, "chat.update", {"message": payload})
        return Response(payload)


class MarkReadView(APIView):
    """Mark all messages sent by the partner as read."""
    permission_classes = [IsAuthenticated]

    def post(self, request):
        partner = _require_partner(request.user)
        if not partner:
            return Response({"updated": 0})
        conv = Conversation.between(request.user, partner)
        unread = conv.messages.filter(sender=partner, is_read=False)
        ids = list(unread.values_list("id", flat=True))
        now = timezone.now()
        unread.update(is_read=True, read_at=now)
        # Notify the partner so their ticks turn to "read".
        send_to_group(conv.group_name, "chat.read",
                      {"reader_id": request.user.id, "message_ids": ids})
        return Response({"updated": len(ids)})
