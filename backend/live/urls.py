from django.urls import path

from . import views

urlpatterns = [
    path("live/request", views.LiveRequestView.as_view()),
    path("live/sessions/<int:pk>/respond", views.LiveRespondView.as_view()),
    path("live/sessions/<int:pk>/end", views.LiveEndView.as_view()),
    path("live/active", views.LiveActiveView.as_view()),
]
