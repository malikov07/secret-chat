# Deploying to Heroku

This repo is set up as **one Heroku app**: Django serves the built React app, the
API, and the WebSockets; Postgres is the database; media (photos/videos/voice/
video-notes) is stored on **Cloudinary** so it survives restarts.

How it fits together:
- `manage.py` (repo root) is a shim so Heroku finds Django (which lives in `backend/`).
- `package.json` → `heroku-postbuild` builds the React app into `frontend/dist`.
- Django `collectstatic` gathers that build; **WhiteNoise** serves it at `/static/`.
- `Procfile` runs **daphne** (ASGI) so WebSockets work; `release` runs migrations.

---

## 1. Cloudinary (media storage) — free

1. Sign up at https://cloudinary.com (free tier is plenty).
2. On the dashboard, copy your **API Environment variable**, which looks like:
   `cloudinary://<API_KEY>:<API_SECRET>@<CLOUD_NAME>`
   You'll paste this as the `CLOUDINARY_URL` config var below.

## 2. Push this code to GitHub

Create an empty repo on github.com (e.g. `secret-chat`), then:

```bash
git remote add origin https://github.com/<you>/secret-chat.git
git push -u origin main
```

## 3. Create the Heroku app (dashboard — no CLI needed)

1. **New → Create new app** → pick a name (this becomes `https://<name>.herokuapp.com`).
2. **Settings → Buildpacks → Add buildpack**, in this exact order:
   1. `heroku/nodejs`
   2. `heroku/python`
   (Node must be **above** Python so the React build exists before `collectstatic`.)
3. **Resources → Add-ons** → add **Heroku Postgres** (`essential-0` plan).
   It sets `DATABASE_URL` automatically.
4. **Settings → Config Vars**, add:
   | Key | Value |
   |-----|-------|
   | `SECRET_KEY` | a long random string (see below) |
   | `DEBUG` | `False` |
   | `CLOUDINARY_URL` | the value from step 1 |

   Generate a secret key:
   ```bash
   python -c "import secrets; print(secrets.token_urlsafe(50))"
   ```
5. **Deploy** tab → **Deployment method: GitHub** → connect your repo →
   **Deploy Branch** (`main`). (You can also enable Automatic Deploys.)

Migrations run automatically on each deploy (the `release` process).

## 4. Create your admin user (one-off command)

Heroku dashboard → **More ▾ (top right) → Run console**:
```
python manage.py createsuperuser
```
Then open `https://<name>.herokuapp.com` and register / pair as normal.
Django admin is at `/admin`.

---

## Heroku CLI (optional alternative to the dashboard)

```bash
heroku login
heroku create <name>
heroku buildpacks:add heroku/nodejs
heroku buildpacks:add heroku/python
heroku addons:create heroku-postgresql:essential-0
heroku config:set DEBUG=False SECRET_KEY="$(python -c 'import secrets;print(secrets.token_urlsafe(50))')" CLOUDINARY_URL="cloudinary://..."
git push heroku main
heroku run python manage.py createsuperuser
heroku open
```

---

## Notes & gotchas

- **Cost:** no free dynos anymore; your GitHub Student Pack Heroku credits cover an
  Eco/Basic dyno + Postgres `essential-0`.
- **WebSockets** work out of the box (daphne + Heroku routing). The client sends a
  heartbeat every 25s so Heroku's 55s idle timeout doesn't drop the chat socket.
- **One web dyno** uses an in-process channel layer, which is fine for a couple.
  If you ever scale to 2+ web dynos, add **Heroku Redis** and set `REDIS_URL`
  (the code already switches to Redis when that var is present).
- **Media = Cloudinary.** Files are stored with Cloudinary's "raw" delivery so every
  type (image/video/voice/video-note) works uniformly. If you later want video
  thumbnails/streaming, switch `STORAGES["default"]` to S3 (`django-storages`) —
  your Student Pack includes AWS credits.
- **Custom domain:** add it in Heroku, then add the host to `ALLOWED_HOSTS` and
  `https://yourdomain` to `CSRF_TRUSTED_ORIGINS` (both read from config vars).
