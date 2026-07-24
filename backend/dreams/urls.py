from django.urls import path

from . import views

urlpatterns = [
    path("dreams", views.DreamListCreateView.as_view()),
    path("dreams/<int:pk>", views.DreamDetailView.as_view()),
]
