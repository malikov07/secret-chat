from rest_framework import generics
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.permissions import IsAuthenticated

from accounts.utils import couple_user_ids
from .models import Dream, DreamMedia
from .serializers import DreamSerializer


def _kind(f):
    ctype = getattr(f, "content_type", "") or ""
    return "video" if ctype.startswith("video") else "image"


def _save_dream_media(dream, files):
    for f in files:
        DreamMedia.objects.create(dream=dream, file=f, kind=_kind(f))


class DreamListCreateView(generics.ListCreateAPIView):
    serializer_class = DreamSerializer
    permission_classes = [IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    def get_queryset(self):
        return Dream.objects.filter(created_by_id__in=couple_user_ids(self.request.user))

    def get_serializer_context(self):
        return {"request": self.request}

    def perform_create(self, serializer):
        dream = serializer.save(created_by=self.request.user)
        _save_dream_media(dream, self.request.FILES.getlist("media"))


class DreamDetailView(generics.RetrieveUpdateDestroyAPIView):
    serializer_class = DreamSerializer
    permission_classes = [IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    def get_queryset(self):
        return Dream.objects.filter(created_by_id__in=couple_user_ids(self.request.user))

    def get_serializer_context(self):
        return {"request": self.request}

    def perform_update(self, serializer):
        extra = {}
        if self.request.FILES.get("achievement_media"):
            extra["achievement_media"] = self.request.FILES["achievement_media"]
        dream = serializer.save(**extra)
        _save_dream_media(dream, self.request.FILES.getlist("media"))
