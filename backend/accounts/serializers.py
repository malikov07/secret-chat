from django.contrib.auth import get_user_model
from rest_framework import serializers
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer

from .models import PairRequest

User = get_user_model()


class PublicUserSerializer(serializers.ModelSerializer):
    name = serializers.CharField(read_only=True)

    class Meta:
        model = User
        fields = ["id", "phone", "display_name", "name", "avatar",
                  "role", "is_online", "last_seen"]


class MeSerializer(serializers.ModelSerializer):
    partner = PublicUserSerializer(read_only=True)
    name = serializers.CharField(read_only=True)

    class Meta:
        model = User
        fields = ["id", "phone", "display_name", "name", "avatar",
                  "role", "is_online", "last_seen", "partner"]
        read_only_fields = ["id", "phone", "role", "is_online", "last_seen"]


class RegisterSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, min_length=6)

    class Meta:
        model = User
        fields = ["id", "phone", "password", "display_name"]

    def validate_phone(self, value):
        value = value.strip()
        if User.objects.filter(phone=value).exists():
            raise serializers.ValidationError("This phone number is already registered.")
        return value

    def create(self, validated_data):
        password = validated_data.pop("password")
        return User.objects.create_user(password=password, **validated_data)


class PhoneTokenObtainPairSerializer(TokenObtainPairSerializer):
    """Login with phone + password; also returns the user object."""

    username_field = User.USERNAME_FIELD

    def validate(self, attrs):
        data = super().validate(attrs)
        data["user"] = MeSerializer(self.user, context=self.context).data
        return data


class PairRequestSerializer(serializers.ModelSerializer):
    from_user = PublicUserSerializer(read_only=True)
    to_user = PublicUserSerializer(read_only=True)

    class Meta:
        model = PairRequest
        fields = ["id", "from_user", "to_user", "status", "created_at"]
