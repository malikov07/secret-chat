"""ASGI config: HTTP via Django, WebSocket via Channels."""
import os

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")

from django.core.asgi import get_asgi_application

django_asgi_app = get_asgi_application()

from channels.routing import ProtocolTypeRouter, URLRouter  # noqa: E402
from channels.security.websocket import AllowedHostsOriginValidator  # noqa: E402
from django.urls import path  # noqa: E402

from accounts.ws_auth import JWTAuthMiddleware  # noqa: E402
from chat.consumers import ChatConsumer  # noqa: E402
from live.consumers import LiveConsumer  # noqa: E402

websocket_urlpatterns = [
    path("ws/chat/", ChatConsumer.as_asgi()),
    path("ws/live/", LiveConsumer.as_asgi()),
]

application = ProtocolTypeRouter({
    "http": django_asgi_app,
    "websocket": AllowedHostsOriginValidator(
        JWTAuthMiddleware(URLRouter(websocket_urlpatterns))
    ),
})
