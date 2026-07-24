from channels.db import database_sync_to_async
from channels.generic.websocket import AsyncJsonWebsocketConsumer
from django.utils import timezone

from .broadcast import user_group
from .models import Conversation


class ChatConsumer(AsyncJsonWebsocketConsumer):
    """Realtime chat + presence + typing for a user and their partner."""

    async def connect(self):
        self.user = self.scope["user"]
        if not self.user or not self.user.is_authenticated:
            await self.close()
            return

        self.personal_group = user_group(self.user.id)
        await self.channel_layer.group_add(self.personal_group, self.channel_name)

        self.conv = await self._get_conversation()
        if self.conv:
            await self.channel_layer.group_add(self.conv.group_name, self.channel_name)

        await self.accept()
        await self._set_online(True)
        await self._broadcast_presence(True)

    async def disconnect(self, code):
        if not getattr(self, "user", None) or not self.user.is_authenticated:
            return
        await self._set_online(False)
        await self._broadcast_presence(False)
        await self.channel_layer.group_discard(self.personal_group, self.channel_name)
        if getattr(self, "conv", None):
            await self.channel_layer.group_discard(self.conv.group_name, self.channel_name)

    async def receive_json(self, content):
        action = content.get("action")
        if action == "typing" and self.conv:
            await self.channel_layer.group_send(self.conv.group_name, {
                "type": "chat.typing",
                "user_id": self.user.id,
                "is_typing": bool(content.get("is_typing")),
            })
        elif action == "ping":
            await self.send_json({"event": "pong"})

    # ---- group event handlers ----
    async def chat_message(self, event):
        await self.send_json({"event": "message", "message": event["message"]})

    async def chat_update(self, event):
        await self.send_json({"event": "update", "message": event["message"]})

    async def chat_read(self, event):
        await self.send_json({
            "event": "read",
            "reader_id": event["reader_id"],
            "message_ids": event["message_ids"],
        })

    async def chat_typing(self, event):
        if event["user_id"] == self.user.id:
            return
        await self.send_json({
            "event": "typing",
            "user_id": event["user_id"],
            "is_typing": event["is_typing"],
        })

    async def presence_update(self, event):
        await self.send_json({
            "event": "presence",
            "user_id": event["user_id"],
            "is_online": event["is_online"],
            "last_seen": event["last_seen"],
        })

    # ---- db helpers ----
    @database_sync_to_async
    def _get_conversation(self):
        partner = self.user.partner
        if not partner:
            return None
        return Conversation.between(self.user, partner)

    @database_sync_to_async
    def _set_online(self, online):
        self.user.is_online = online
        self.user.last_seen = timezone.now()
        self.user.save(update_fields=["is_online", "last_seen"])

    async def _broadcast_presence(self, online):
        payload = {
            "type": "presence.update",
            "user_id": self.user.id,
            "is_online": online,
            "last_seen": timezone.now().isoformat(),
        }
        await self.channel_layer.group_send(self.personal_group, payload)
        if getattr(self, "conv", None):
            await self.channel_layer.group_send(self.conv.group_name, payload)
