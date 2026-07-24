"""Helpers to push realtime events onto Channels groups."""
from asgiref.sync import async_to_sync
from channels.layers import get_channel_layer


def send_to_group(group, event_type, payload):
    layer = get_channel_layer()
    async_to_sync(layer.group_send)(group, {"type": event_type, **payload})


def user_group(user_id):
    return f"user_{user_id}"
