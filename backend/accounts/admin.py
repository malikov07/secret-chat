from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin

from .models import PairRequest, User


@admin.register(User)
class UserAdmin(BaseUserAdmin):
    ordering = ("phone",)
    list_display = ("phone", "display_name", "role", "is_online", "partner", "is_staff")
    list_filter = ("role", "is_online", "is_staff")
    search_fields = ("phone", "display_name")
    fieldsets = (
        (None, {"fields": ("phone", "password")}),
        ("Profile", {"fields": ("display_name", "avatar", "partner")}),
        ("Roles", {"fields": ("role", "is_active", "is_staff", "is_superuser",
                              "groups", "user_permissions")}),
        ("Presence", {"fields": ("is_online", "last_seen")}),
    )
    add_fieldsets = (
        (None, {
            "classes": ("wide",),
            "fields": ("phone", "display_name", "password1", "password2",
                       "role", "is_staff", "is_superuser"),
        }),
    )


@admin.register(PairRequest)
class PairRequestAdmin(admin.ModelAdmin):
    list_display = ("from_user", "to_user", "status", "created_at")
    list_filter = ("status",)
