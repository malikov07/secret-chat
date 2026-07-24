"""Root URL configuration."""
from django.conf import settings
from django.conf.urls.static import static
from django.contrib import admin
from django.urls import include, path, re_path

from config.views import spa

api_patterns = [
    path("", include("accounts.urls")),
    path("", include("chat.urls")),
    path("", include("calendar_app.urls")),
    path("", include("dreams.urls")),
    path("", include("live.urls")),
]

urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/", include(api_patterns)),
]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)

# Catch-all: serve the React SPA for everything else (must be last).
urlpatterns += [re_path(r"^(?P<path>.*)$", spa)]
