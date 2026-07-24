from django.urls import path
from rest_framework_simplejwt.views import TokenRefreshView

from . import views

urlpatterns = [
    path("auth/register", views.RegisterView.as_view()),
    path("auth/login", views.PhoneTokenObtainPairView.as_view()),
    path("auth/refresh", TokenRefreshView.as_view()),
    path("me", views.MeView.as_view()),
    path("partner", views.PartnerView.as_view()),
    path("pair/requests", views.PairRequestView.as_view()),
    path("pair/requests/<int:pk>/respond", views.PairRespondView.as_view()),
    # Admin
    path("admin/users", views.AdminUserListView.as_view()),
    path("admin/users/<int:pk>/role", views.AdminSetRoleView.as_view()),
]
