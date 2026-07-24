"""JWT authentication for Channels WebSocket connections (via ?token= query param)."""
from urllib.parse import parse_qs

from channels.db import database_sync_to_async
from channels.middleware import BaseMiddleware
from django.contrib.auth.models import AnonymousUser
from rest_framework_simplejwt.exceptions import TokenError
from rest_framework_simplejwt.tokens import AccessToken


@database_sync_to_async
def get_user(user_id):
    from django.contrib.auth import get_user_model
    User = get_user_model()
    try:
        return User.objects.get(id=user_id)
    except User.DoesNotExist:
        return AnonymousUser()


class JWTAuthMiddleware(BaseMiddleware):
    async def __call__(self, scope, receive, send):
        query = parse_qs(scope.get("query_string", b"").decode())
        token = (query.get("token") or [None])[0]
        scope["user"] = AnonymousUser()
        if token:
            try:
                access = AccessToken(token)
                scope["user"] = await get_user(access["user_id"])
            except TokenError:
                pass
        return await super().__call__(scope, receive, send)
