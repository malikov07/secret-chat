from rest_framework.permissions import BasePermission

from .models import Role


class IsAdmin(BasePermission):
    message = "Admin access required."

    def has_permission(self, request, view):
        return bool(
            request.user
            and request.user.is_authenticated
            and (request.user.role == Role.ADMIN or request.user.is_superuser)
        )


class IsSubadminOrAdmin(BasePermission):
    message = "Sub-admin or admin access required."

    def has_permission(self, request, view):
        return bool(
            request.user
            and request.user.is_authenticated
            and (
                request.user.role in (Role.ADMIN, Role.SUBADMIN)
                or request.user.is_superuser
            )
        )
