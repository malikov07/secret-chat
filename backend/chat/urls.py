from django.urls import path

from . import views

urlpatterns = [
    path("chat/conversation", views.ConversationView.as_view()),
    path("chat/messages", views.MessageListView.as_view()),
    path("chat/messages/<int:pk>", views.MessageDetailView.as_view()),
    path("chat/read", views.MarkReadView.as_view()),
]
