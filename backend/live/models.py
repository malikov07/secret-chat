from django.conf import settings
from django.db import models


class LiveSession(models.Model):
    """A consent-gated live session where `target` shares their camera+mic or
    location with `viewer`.

    Consent is structural: a session may only become ACTIVE when the *target*
    (the person being seen/heard/located) accepts. The viewer can request, but
    can never start the target's devices. The target can end it at any time.
    """

    class Kind(models.TextChoices):
        WATCH = "watch", "Camera + microphone"
        LOCATION = "location", "Live location"

    class Status(models.TextChoices):
        REQUESTED = "requested", "Requested"
        ACTIVE = "active", "Active"
        DECLINED = "declined", "Declined"
        ENDED = "ended", "Ended"

    kind = models.CharField(max_length=12, choices=Kind.choices)
    viewer = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE,
                               related_name="viewing_sessions")
    target = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE,
                               related_name="watched_sessions")
    status = models.CharField(max_length=12, choices=Status.choices,
                              default=Status.REQUESTED)

    # Explicit acknowledgement the target gave when accepting (honest consent).
    acknowledged = models.BooleanField(default=False)

    requested_at = models.DateTimeField(auto_now_add=True)
    accepted_at = models.DateTimeField(null=True, blank=True)
    ended_at = models.DateTimeField(null=True, blank=True)
    ended_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL,
                                 null=True, blank=True, related_name="+")

    # Latest location snapshot (only for LOCATION sessions).
    last_lat = models.FloatField(null=True, blank=True)
    last_lng = models.FloatField(null=True, blank=True)
    last_accuracy = models.FloatField(null=True, blank=True)
    last_location_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["-requested_at"]

    def __str__(self):
        return f"{self.kind} {self.viewer}->{self.target} ({self.status})"

    def is_participant(self, user):
        return user.id in (self.viewer_id, self.target_id)
