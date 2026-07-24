from django.contrib.auth import get_user_model
from django.db import transaction
from rest_framework import generics, status
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.views import TokenObtainPairView

from .models import PairRequest, Role
from .permissions import IsAdmin
from .serializers import (
    MeSerializer,
    PairRequestSerializer,
    PhoneTokenObtainPairSerializer,
    PublicUserSerializer,
    RegisterSerializer,
)

User = get_user_model()


class RegisterView(generics.CreateAPIView):
    queryset = User.objects.all()
    serializer_class = RegisterSerializer
    permission_classes = [AllowAny]


class PhoneTokenObtainPairView(TokenObtainPairView):
    serializer_class = PhoneTokenObtainPairSerializer
    permission_classes = [AllowAny]


class MeView(generics.RetrieveUpdateAPIView):
    """Get / update the authenticated user's own profile (name, avatar)."""
    serializer_class = MeSerializer
    permission_classes = [IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    def get_object(self):
        return self.request.user


class PartnerView(APIView):
    """Current partner and their live presence."""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        partner = request.user.partner
        if not partner:
            return Response({"partner": None})
        return Response({"partner": PublicUserSerializer(partner).data})


class PairRequestView(APIView):
    """Send a pairing invite by phone, or list your incoming/outgoing invites."""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        incoming = PairRequest.objects.filter(
            to_user=request.user, status=PairRequest.Status.PENDING
        )
        outgoing = PairRequest.objects.filter(
            from_user=request.user, status=PairRequest.Status.PENDING
        )
        return Response({
            "incoming": PairRequestSerializer(incoming, many=True).data,
            "outgoing": PairRequestSerializer(outgoing, many=True).data,
        })

    def post(self, request):
        if request.user.partner:
            return Response({"detail": "You already have a partner."},
                            status=status.HTTP_400_BAD_REQUEST)
        phone = (request.data.get("phone") or "").strip()
        if not phone:
            return Response({"detail": "Phone number is required."},
                            status=status.HTTP_400_BAD_REQUEST)
        if phone == request.user.phone:
            return Response({"detail": "You cannot pair with yourself."},
                            status=status.HTTP_400_BAD_REQUEST)
        try:
            target = User.objects.get(phone=phone)
        except User.DoesNotExist:
            return Response({"detail": "No user with that phone number."},
                            status=status.HTTP_404_NOT_FOUND)
        if target.partner:
            return Response({"detail": "That user is already paired."},
                            status=status.HTTP_400_BAD_REQUEST)
        req, _ = PairRequest.objects.get_or_create(
            from_user=request.user, to_user=target,
            status=PairRequest.Status.PENDING,
        )
        return Response(PairRequestSerializer(req).data,
                        status=status.HTTP_201_CREATED)


class PairRespondView(APIView):
    """Accept or decline a pairing invite."""
    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        accept = bool(request.data.get("accept"))
        try:
            req = PairRequest.objects.get(
                pk=pk, to_user=request.user,
                status=PairRequest.Status.PENDING,
            )
        except PairRequest.DoesNotExist:
            return Response({"detail": "Request not found."},
                            status=status.HTTP_404_NOT_FOUND)

        if not accept:
            req.status = PairRequest.Status.DECLINED
            req.save(update_fields=["status"])
            return Response({"detail": "Declined."})

        if request.user.partner or req.from_user.partner:
            return Response({"detail": "One of you already has a partner."},
                            status=status.HTTP_400_BAD_REQUEST)

        with transaction.atomic():
            me = request.user
            other = req.from_user
            me.partner = other
            other.partner = me
            me.save(update_fields=["partner"])
            other.save(update_fields=["partner"])
            req.status = PairRequest.Status.ACCEPTED
            req.save(update_fields=["status"])
        return Response(MeSerializer(request.user).data)


# ---- Admin endpoints ----

class AdminUserListView(generics.ListAPIView):
    serializer_class = PublicUserSerializer
    permission_classes = [IsAdmin]

    def get_queryset(self):
        return User.objects.all().order_by("display_name", "phone")


class AdminSetRoleView(APIView):
    """Admin promotes/demotes a user between user and sub-admin."""
    permission_classes = [IsAdmin]

    def post(self, request, pk):
        new_role = request.data.get("role")
        if new_role not in (Role.USER, Role.SUBADMIN):
            return Response(
                {"detail": "Role must be 'user' or 'subadmin'."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        try:
            target = User.objects.get(pk=pk)
        except User.DoesNotExist:
            return Response({"detail": "User not found."},
                            status=status.HTTP_404_NOT_FOUND)
        if target.role == Role.ADMIN or target.is_superuser:
            return Response({"detail": "Cannot change an admin's role."},
                            status=status.HTTP_400_BAD_REQUEST)
        target.role = new_role
        target.save(update_fields=["role"])
        return Response(PublicUserSerializer(target).data)
