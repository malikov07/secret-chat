from channels.db import database_sync_to_async
from channels.generic.websocket import AsyncJsonWebsocketConsumer
from django.utils import timezone

from .broadcast import live_group
from .models import LiveSession


class LiveConsumer(AsyncJsonWebsocketConsumer):
    """WebRTC signaling relay + live location updates for consent-gated sessions."""

    async def connect(self):
        self.user = self.scope["user"]
        if not self.user or not self.user.is_authenticated:
            await self.close()
            return
        self.group = live_group(self.user.id)
        await self.channel_layer.group_add(self.group, self.channel_name)
        await self.accept()

    async def disconnect(self, code):
        if not getattr(self, "user", None) or not self.user.is_authenticated:
            return
        # Fail closed: if the person sharing goes offline, stop the sharing.
        await self._end_active_as_target()
        await self.channel_layer.group_discard(self.group, self.channel_name)

    async def receive_json(self, content):
        action = content.get("action")
        if action == "signal":
            await self._relay_signal(content)
        elif action == "location":
            await self._update_location(content)

    # ---- group handlers -> client ----
    async def live_request(self, event):
        await self.send_json({"event": "request", "session": event["session"]})

    async def live_accepted(self, event):
        await self.send_json({"event": "accepted", "session": event["session"]})

    async def live_declined(self, event):
        await self.send_json({"event": "declined", "session": event["session"]})

    async def live_ended(self, event):
        await self.send_json({"event": "ended", "session": event["session"]})

    async def live_signal(self, event):
        await self.send_json({
            "event": "signal",
            "session_id": event["session_id"],
            "from_id": event["from_id"],
            "data": event["data"],
        })

    async def live_location(self, event):
        await self.send_json({
            "event": "location",
            "session_id": event["session_id"],
            "lat": event["lat"], "lng": event["lng"],
            "accuracy": event.get("accuracy"),
            "at": event["at"],
        })

    # ---- internals ----
    async def _relay_signal(self, content):
        session_id = content.get("session_id")
        data = content.get("data")
        other_id = await self._other_participant(session_id)
        if not other_id:
            return
        await self.channel_layer.group_send(live_group(other_id), {
            "type": "live.signal",
            "session_id": session_id,
            "from_id": self.user.id,
            "data": data,
        })

    async def _update_location(self, content):
        session_id = content.get("session_id")
        lat, lng = content.get("lat"), content.get("lng")
        accuracy = content.get("accuracy")
        viewer_id = await self._save_location(session_id, lat, lng, accuracy)
        if not viewer_id:
            return
        await self.channel_layer.group_send(live_group(viewer_id), {
            "type": "live.location",
            "session_id": session_id,
            "lat": lat, "lng": lng, "accuracy": accuracy,
            "at": timezone.now().isoformat(),
        })

    @database_sync_to_async
    def _other_participant(self, session_id):
        try:
            s = LiveSession.objects.get(pk=session_id,
                                        status=LiveSession.Status.ACTIVE)
        except LiveSession.DoesNotExist:
            return None
        if not s.is_participant(self.user):
            return None
        return s.target_id if self.user.id == s.viewer_id else s.viewer_id

    @database_sync_to_async
    def _save_location(self, session_id, lat, lng, accuracy):
        try:
            s = LiveSession.objects.get(pk=session_id, kind=LiveSession.Kind.LOCATION,
                                        status=LiveSession.Status.ACTIVE)
        except LiveSession.DoesNotExist:
            return None
        # Only the target (the person sharing) may push their location.
        if self.user.id != s.target_id:
            return None
        s.last_lat, s.last_lng = lat, lng
        s.last_accuracy = accuracy
        s.last_location_at = timezone.now()
        s.save(update_fields=["last_lat", "last_lng", "last_accuracy",
                              "last_location_at"])
        return s.viewer_id

    @database_sync_to_async
    def _end_active_as_target_sync(self):
        ended = []
        sessions = LiveSession.objects.filter(
            target=self.user,
            status__in=[LiveSession.Status.ACTIVE, LiveSession.Status.REQUESTED],
        )
        for s in sessions:
            s.status = LiveSession.Status.ENDED
            s.ended_at = timezone.now()
            s.ended_by = self.user
            s.save(update_fields=["status", "ended_at", "ended_by"])
            ended.append(s)
        return ended

    async def _end_active_as_target(self):
        from .serializers import LiveSessionSerializer
        ended = await self._end_active_as_target_sync()
        for s in ended:
            payload = await database_sync_to_async(
                lambda sess=s: LiveSessionSerializer(sess).data)()
            for uid in (s.viewer_id, s.target_id):
                await self.channel_layer.group_send(live_group(uid), {
                    "type": "live.ended", "session": payload,
                })
