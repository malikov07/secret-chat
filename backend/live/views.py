from django.db.models import Q
from django.utils import timezone
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .broadcast import notify_session
from .models import LiveSession
from .serializers import LiveSessionSerializer


class LiveRequestView(APIView):
    """A viewer asks their partner to share camera+mic or live location.

    This only *requests*. Nothing on the partner's device turns on until the
    partner accepts on their own screen.
    """
    permission_classes = [IsAuthenticated]

    def post(self, request):
        partner = request.user.partner
        if not partner:
            return Response({"detail": "You have no partner yet."},
                            status=status.HTTP_400_BAD_REQUEST)
        kind = request.data.get("kind")
        if kind not in LiveSession.Kind.values:
            return Response({"detail": "Invalid kind."},
                            status=status.HTTP_400_BAD_REQUEST)

        # Reuse an existing open session of this kind if present.
        existing = LiveSession.objects.filter(
            viewer=request.user, target=partner, kind=kind,
            status__in=[LiveSession.Status.REQUESTED, LiveSession.Status.ACTIVE],
        ).first()
        if existing:
            return Response(LiveSessionSerializer(existing).data)

        session = LiveSession.objects.create(
            kind=kind, viewer=request.user, target=partner,
            status=LiveSession.Status.REQUESTED,
        )
        notify_session(session, "live.request")
        return Response(LiveSessionSerializer(session).data,
                        status=status.HTTP_201_CREATED)


class LiveRespondView(APIView):
    """Only the TARGET may accept/decline — this is the consent gate."""
    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        try:
            session = LiveSession.objects.get(pk=pk)
        except LiveSession.DoesNotExist:
            return Response(status=status.HTTP_404_NOT_FOUND)

        if session.target_id != request.user.id:
            return Response({"detail": "Only the person being asked can respond."},
                            status=status.HTTP_403_FORBIDDEN)
        if session.status != LiveSession.Status.REQUESTED:
            return Response({"detail": "This request is no longer pending."},
                            status=status.HTTP_400_BAD_REQUEST)

        accept = bool(request.data.get("accept"))
        if not accept:
            session.status = LiveSession.Status.DECLINED
            session.ended_at = timezone.now()
            session.ended_by = request.user
            session.save(update_fields=["status", "ended_at", "ended_by"])
            notify_session(session, "live.declined")
            return Response(LiveSessionSerializer(session).data)

        # Require explicit acknowledgement of the honest warning.
        if not request.data.get("acknowledged"):
            return Response(
                {"detail": "You must acknowledge what you are sharing."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        session.status = LiveSession.Status.ACTIVE
        session.acknowledged = True
        session.accepted_at = timezone.now()
        session.save(update_fields=["status", "acknowledged", "accepted_at"])
        notify_session(session, "live.accepted")
        return Response(LiveSessionSerializer(session).data)


class LiveEndView(APIView):
    """Either participant can end. The target can always stop instantly."""
    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        try:
            session = LiveSession.objects.get(pk=pk)
        except LiveSession.DoesNotExist:
            return Response(status=status.HTTP_404_NOT_FOUND)
        if not session.is_participant(request.user):
            return Response(status=status.HTTP_403_FORBIDDEN)
        if session.status in (LiveSession.Status.ENDED, LiveSession.Status.DECLINED):
            return Response(LiveSessionSerializer(session).data)

        session.status = LiveSession.Status.ENDED
        session.ended_at = timezone.now()
        session.ended_by = request.user
        session.save(update_fields=["status", "ended_at", "ended_by"])
        notify_session(session, "live.ended")
        return Response(LiveSessionSerializer(session).data)


class LiveActiveView(APIView):
    """Open sessions (requested or active) involving this user — to restore UI."""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        sessions = LiveSession.objects.filter(
            Q(viewer=request.user) | Q(target=request.user),
            status__in=[LiveSession.Status.REQUESTED, LiveSession.Status.ACTIVE],
        )
        return Response(LiveSessionSerializer(sessions, many=True).data)
