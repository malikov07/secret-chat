from django.urls import path

from . import views

urlpatterns = [
    path("calendar/events", views.EventListCreateView.as_view()),
    path("calendar/events/<int:pk>", views.EventDetailView.as_view()),
    path("calendar/stories", views.StoryListCreateView.as_view()),
    path("calendar/stories/<int:pk>", views.StoryDetailView.as_view()),
]
