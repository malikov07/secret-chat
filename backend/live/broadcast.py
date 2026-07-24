from chat.broadcast import send_to_group


def live_group(user_id):
    return f"live_{user_id}"


def notify_session(session, event_type, extra=None):
    """Push a live event to both participants' live groups."""
    from .serializers import LiveSessionSerializer
    payload = {"session": LiveSessionSerializer(session).data}
    if extra:
        payload.update(extra)
    for uid in (session.viewer_id, session.target_id):
        send_to_group(live_group(uid), event_type, payload)
