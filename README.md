# Secret 💌 — a private space for two

A Telegram-style private app for a couple: a one-to-one chat with media, voice
notes, read receipts and presence, plus a shared **Calendar** (events + memories)
and a **Dreams** journal. Optional **consent-based** live camera/mic and live
location sharing between partners.

- **Backend:** Django + Django REST Framework + Channels (WebSockets), PostgreSQL
- **Frontend:** React (Vite), Leaflet for maps, WebRTC for live video/audio

---

## ⚠️ About the live camera / mic / location feature — read this

This app can share a person's live **camera + microphone** and **live location**
with their partner. It is deliberately built to be **consensual, never covert**:

1. **Only the person being viewed can start it.** The other partner can *request*,
   but nothing on your device turns on until **you accept** on your own screen.
   (Enforced server-side: a viewer cannot accept their own request; the target must.)
2. **Honest consent.** Accepting shows a red danger dialog spelling out exactly what
   you're allowing, with a checkbox you must tick.
3. **Always visible while active.** While your camera/mic/location are live, a red
   banner stays on *your* screen and a sound/vibration fires when it starts.
4. **One-tap stop.** You can end any live session instantly, and if you go offline
   it stops automatically.

A hidden/secret surveillance mode is intentionally **not** part of this project.

---

## Prerequisites

- Python 3.13, Node 20+, and (for the default setup) PostgreSQL 14+.

## 1. Backend

The virtualenv already exists in `backend/venv`. From `backend/`:

```powershell
# (deps already installed; to reinstall: venv\Scripts\pip install -r requirements.txt)
copy .env.example .env   # then edit .env
```

### Database

**Option A — PostgreSQL (default).** Create the database and set credentials in `.env`:

```sql
-- in psql as a superuser
CREATE DATABASE secret_chat;
```

Set `DB_NAME/DB_USER/DB_PASSWORD/DB_HOST/DB_PORT` in `.env`.

**Option B — instant, no setup.** Put `DB_ENGINE=sqlite` in `.env`.

### Migrate, create an admin, run

```powershell
venv\Scripts\python manage.py migrate
venv\Scripts\python manage.py createsuperuser --phone "+10000000"
.\run.ps1     # serves http://127.0.0.1:8000 (HTTP + WebSockets)
```

## 2. Frontend

From `frontend/`:

```powershell
npm install      # already done
npm run dev      # http://localhost:5173  (proxies /api, /media, /ws to :8000)
```

Open **http://localhost:5173**.

---

## Using it

1. **Register** with a phone number + password (two accounts, e.g. in two browsers).
2. On first launch you'll be asked to **allow camera / mic / location** (honest, optional).
3. **Pair**: enter your partner's phone number → they accept the invite. Now you share
   one chat, one calendar, and one dreams journal.
4. **Chat** with text, emoji (there's a big romantic set 💗), photos, videos, files,
   voice notes, replies, reactions (double-tap ❤️), and ✓✓ read receipts.
5. **Calendar / Dreams** tabs for shared events, memories, and dreams.

### Roles & admin

- Visit **`/admin`** in the app as an **admin** (the superuser you created) to view
  users and promote someone to **sub-admin**.
- A **sub-admin** sees 📹 / 📍 buttons in the chat header to *request* their partner's
  live camera+mic or location — which the partner must consent to (see the box above).
- Django's own admin is at **http://127.0.0.1:8000/admin/**.

### If you ran with SQLite here already

Seed/test accounts created during verification (password `pass1234`):
`+1555xxxx` (Alice) & `+1666xxxx` (Bob) were random — just register your own.
Admin: **`+10000000`** / **`admin1234`**.

---

## Notes

- Live video uses WebRTC with a public STUN server; across different networks a TURN
  server would be needed for reliable connectivity. Same machine / LAN works out of the box.
- For production, set `REDIS_URL` (Channels layer), a real `SECRET_KEY`, `DEBUG=False`,
  and serve media/static properly.
