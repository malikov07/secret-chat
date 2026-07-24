from django.contrib.auth.models import AbstractBaseUser, PermissionsMixin
from django.db import models
from django.utils import timezone

from .managers import UserManager


class Role(models.TextChoices):
    USER = "user", "User"
    SUBADMIN = "subadmin", "Sub-admin"
    ADMIN = "admin", "Admin"


class User(AbstractBaseUser, PermissionsMixin):
    """A person identified by phone number. Each user pairs with one partner."""

    phone = models.CharField(max_length=32, unique=True)
    display_name = models.CharField(max_length=80, blank=True)
    avatar = models.ImageField(upload_to="avatars/", blank=True, null=True)
    role = models.CharField(max_length=16, choices=Role.choices, default=Role.USER)

    # The single partner this user chats with (symmetric, set on pairing).
    partner = models.OneToOneField(
        "self", on_delete=models.SET_NULL, null=True, blank=True, related_name="+"
    )

    # Presence
    is_online = models.BooleanField(default=False)
    last_seen = models.DateTimeField(default=timezone.now)

    is_active = models.BooleanField(default=True)
    is_staff = models.BooleanField(default=False)
    date_joined = models.DateTimeField(default=timezone.now)

    USERNAME_FIELD = "phone"
    REQUIRED_FIELDS = []

    objects = UserManager()

    class Meta:
        ordering = ["display_name", "phone"]

    def __str__(self):
        return self.display_name or self.phone

    @property
    def name(self):
        return self.display_name or self.phone

    def set_online(self, online: bool):
        self.is_online = online
        self.last_seen = timezone.now()
        self.save(update_fields=["is_online", "last_seen"])


class PairRequest(models.Model):
    """A pairing invitation from one user to another (by phone)."""

    class Status(models.TextChoices):
        PENDING = "pending", "Pending"
        ACCEPTED = "accepted", "Accepted"
        DECLINED = "declined", "Declined"

    from_user = models.ForeignKey(
        User, on_delete=models.CASCADE, related_name="sent_pair_requests"
    )
    to_user = models.ForeignKey(
        User, on_delete=models.CASCADE, related_name="received_pair_requests"
    )
    status = models.CharField(
        max_length=12, choices=Status.choices, default=Status.PENDING
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.from_user} -> {self.to_user} ({self.status})"
