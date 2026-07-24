from rest_framework import serializers

from accounts.serializers import PublicUserSerializer
from .models import LiveSession


class LiveSessionSerializer(serializers.ModelSerializer):
    viewer = PublicUserSerializer(read_only=True)
    target = PublicUserSerializer(read_only=True)

    class Meta:
        model = LiveSession
        fields = ["id", "kind", "viewer", "target", "status", "acknowledged",
                  "requested_at", "accepted_at", "ended_at",
                  "last_lat", "last_lng", "last_accuracy", "last_location_at"]
