from django.conf import settings
from django.http import FileResponse, HttpResponse
from django.views.static import serve


def spa(request, path=""):
    """Serve the built React app. Returns a real file if it exists (checked in
    the collected static dir, then the raw build), otherwise index.html so that
    client-side routes resolve. Hashed assets are served by WhiteNoise at /static/."""
    roots = [r for r in (settings.STATIC_ROOT, settings.FRONTEND_DIST) if r]
    if path:
        for root in roots:
            if (root / path).is_file():
                return serve(request, path, document_root=root)
    for root in roots:
        index = root / "index.html"
        if index.exists():
            return FileResponse(open(index, "rb"), content_type="text/html")
    return HttpResponse(
        "Frontend not built yet. Run `npm run build` in frontend/.", status=200
    )
