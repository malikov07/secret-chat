from rest_framework import generics
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.permissions import IsAuthenticated

from accounts.utils import couple_user_ids
from .models import CalendarEvent, Story, StoryMedia
from .serializers import CalendarEventSerializer, StorySerializer


class CoupleScopedMixin:
    permission_classes = [IsAuthenticated]

    def couple_qs(self, model):
        return model.objects.filter(created_by_id__in=couple_user_ids(self.request.user))

    def get_serializer_context(self):
        return {"request": self.request}


def _media_type(f):
    if not f:
        return ""
    ctype = getattr(f, "content_type", "") or ""
    return "video" if ctype.startswith("video") else "image"


def _save_story_media(story, files):
    for f in files:
        StoryMedia.objects.create(story=story, file=f, kind=_media_type(f) or "image")


class EventListCreateView(CoupleScopedMixin, generics.ListCreateAPIView):
    serializer_class = CalendarEventSerializer

    def get_queryset(self):
        qs = self.couple_qs(CalendarEvent)
        month = self.request.query_params.get("month")
        year = self.request.query_params.get("year")
        if month:
            qs = qs.filter(date__month=month)
        if year:
            qs = qs.filter(date__year=year)
        return qs

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)


class EventDetailView(CoupleScopedMixin, generics.RetrieveUpdateDestroyAPIView):
    serializer_class = CalendarEventSerializer

    def get_queryset(self):
        return self.couple_qs(CalendarEvent)


class StoryListCreateView(CoupleScopedMixin, generics.ListCreateAPIView):
    serializer_class = StorySerializer
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    def get_queryset(self):
        qs = self.couple_qs(Story)
        date = self.request.query_params.get("date")
        if date:
            qs = qs.filter(date=date)
        return qs

    def perform_create(self, serializer):
        story = serializer.save(created_by=self.request.user)
        _save_story_media(story, self.request.FILES.getlist("media"))


class StoryDetailView(CoupleScopedMixin, generics.RetrieveUpdateDestroyAPIView):
    serializer_class = StorySerializer
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    def get_queryset(self):
        return self.couple_qs(Story)

    def perform_update(self, serializer):
        story = serializer.save()
        _save_story_media(story, self.request.FILES.getlist("media"))
