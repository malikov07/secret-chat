"""Django settings for the Secret Chat project."""
from pathlib import Path
import os
from datetime import timedelta

from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent.parent
load_dotenv(BASE_DIR / ".env")


def env(key, default=None):
    return os.environ.get(key, default)


def env_bool(key, default=False):
    val = os.environ.get(key)
    if val is None:
        return default
    return val.strip().lower() in ("1", "true", "yes", "on")


def env_list(key, default=""):
    raw = os.environ.get(key, default) or ""
    return [item.strip() for item in raw.split(",") if item.strip()]


SECRET_KEY = env("SECRET_KEY", "dev-insecure-change-me")
DEBUG = env_bool("DEBUG", True)
ALLOWED_HOSTS = env_list("ALLOWED_HOSTS", "localhost,127.0.0.1") + [".herokuapp.com"]

# Path to the built React app (produced by `npm run build` in frontend/)
FRONTEND_DIST = BASE_DIR.parent / "frontend" / "dist"

INSTALLED_APPS = [
    "daphne",  # must precede django.contrib.staticfiles for ASGI runserver
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    # third-party
    "rest_framework",
    "rest_framework_simplejwt.token_blacklist",
    "corsheaders",
    "channels",
    # media storage (Cloudinary) — active when CLOUDINARY_URL is set
    "cloudinary_storage",
    "cloudinary",
    # local
    "accounts",
    "chat",
    "calendar_app",
    "dreams",
    "live",
]

MIDDLEWARE = [
    "corsheaders.middleware.CorsMiddleware",
    "django.middleware.security.SecurityMiddleware",
    "whitenoise.middleware.WhiteNoiseMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]

ROOT_URLCONF = "config.urls"

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    },
]

WSGI_APPLICATION = "config.wsgi.application"
ASGI_APPLICATION = "config.asgi.application"

# On Heroku, DATABASE_URL is provided by the Postgres add-on and wins.
# Otherwise: DB_ENGINE=sqlite gives a zero-config local DB; default is local Postgres.
if os.environ.get("DATABASE_URL"):
    import dj_database_url
    DATABASES = {
        "default": dj_database_url.config(
            conn_max_age=600, ssl_require=not DEBUG
        )
    }
elif env("DB_ENGINE", "postgres") == "sqlite":
    DATABASES = {
        "default": {
            "ENGINE": "django.db.backends.sqlite3",
            "NAME": BASE_DIR / "db.sqlite3",
        }
    }
else:
    DATABASES = {
        "default": {
            "ENGINE": "django.db.backends.postgresql",
            "NAME": env("DB_NAME", "secret_chat"),
            "USER": env("DB_USER", "postgres"),
            "PASSWORD": env("DB_PASSWORD", "postgres"),
            "HOST": env("DB_HOST", "127.0.0.1"),
            "PORT": env("DB_PORT", "5432"),
        }
    }

AUTH_USER_MODEL = "accounts.User"

AUTH_PASSWORD_VALIDATORS = [
    {"NAME": "django.contrib.auth.password_validation.MinimumLengthValidator",
     "OPTIONS": {"min_length": 6}},
    {"NAME": "django.contrib.auth.password_validation.CommonPasswordValidator"},
]

LANGUAGE_CODE = "en-us"
TIME_ZONE = "UTC"
USE_I18N = True
USE_TZ = True

STATIC_URL = "/static/"
STATIC_ROOT = BASE_DIR / "staticfiles"
STATICFILES_DIRS = [FRONTEND_DIST] if FRONTEND_DIST.exists() else []

MEDIA_URL = "/media/"
MEDIA_ROOT = BASE_DIR / "media"

# Static via WhiteNoise; media via Cloudinary when configured, else local disk (dev).
STORAGES = {
    "default": {"BACKEND": "django.core.files.storage.FileSystemStorage"},
    "staticfiles": {"BACKEND": "whitenoise.storage.CompressedStaticFilesStorage"},
}
if os.environ.get("CLOUDINARY_URL"):
    # RawMediaCloudinaryStorage stores any file type (image/video/audio) uniformly.
    STORAGES["default"] = {"BACKEND": "cloudinary_storage.storage.RawMediaCloudinaryStorage"}

DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

# --- Production security (only when DEBUG is off) ---
if not DEBUG:
    SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")
    SECURE_SSL_REDIRECT = env_bool("SECURE_SSL_REDIRECT", True)
    SESSION_COOKIE_SECURE = True
    CSRF_COOKIE_SECURE = True
    CSRF_TRUSTED_ORIGINS = ["https://*.herokuapp.com"] + env_list("CSRF_TRUSTED_ORIGINS")

# Uploads: allow large media (videos)
DATA_UPLOAD_MAX_MEMORY_SIZE = 50 * 1024 * 1024  # 50 MB
FILE_UPLOAD_MAX_MEMORY_SIZE = 50 * 1024 * 1024

# --- Django REST Framework ---
REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": (
        "rest_framework_simplejwt.authentication.JWTAuthentication",
    ),
    "DEFAULT_PERMISSION_CLASSES": (
        "rest_framework.permissions.IsAuthenticated",
    ),
    "DEFAULT_RENDERER_CLASSES": (
        "rest_framework.renderers.JSONRenderer",
    ),
}

SIMPLE_JWT = {
    "ACCESS_TOKEN_LIFETIME": timedelta(days=1),
    "REFRESH_TOKEN_LIFETIME": timedelta(days=30),
    "ROTATE_REFRESH_TOKENS": True,
    "BLACKLIST_AFTER_ROTATION": True,
    "USER_ID_FIELD": "id",
    "USER_ID_CLAIM": "user_id",
}

# --- Channels ---
_redis_url = env("REDIS_URL", "")
if _redis_url:
    CHANNEL_LAYERS = {
        "default": {
            "BACKEND": "channels_redis.core.RedisChannelLayer",
            "CONFIG": {"hosts": [_redis_url]},
        }
    }
else:
    # In-memory layer for single-process development (no Redis required).
    CHANNEL_LAYERS = {
        "default": {"BACKEND": "channels.layers.InMemoryChannelLayer"}
    }

# --- CORS ---
CORS_ALLOWED_ORIGINS = env_list("FRONTEND_ORIGIN", "http://localhost:5173")
CORS_ALLOW_CREDENTIALS = True
