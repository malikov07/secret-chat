# Deploying to a Kamatera server (or any Linux VPS)

Your Kamatera server is a Linux box you control over SSH, so everything runs on
that one server: **nginx** (reverse proxy + static/media) → **daphne** (Django +
Channels/WebSockets) → **PostgreSQL**. Both the **chats** (in Postgres) and the
**uploaded media** (on disk) are stored on the server.

```
browser ──▶ nginx :80/443 ──┬─ /static/  → backend/staticfiles (React build + admin)
                            ├─ /media/   → backend/media (uploaded photos/videos/…)
                            ├─ /ws/      → daphne (WebSockets: chat, presence, live)
                            └─ /         → daphne (API + React SPA)

PostgreSQL (same server) ── stores all messages, memories, dreams, users
```

Helper files are in `deploy/`: `nginx.conf`, `secret-chat.service`, `deploy.sh`,
`env.prod.example`. The steps below assume you log in as **root** (Kamatera's
default) and put the app in `/opt/secret-chat`.

---

## 1. Create the server (Kamatera console)

- Create a new server: **Ubuntu Server 24.04 LTS**, ~**1–2 vCPU / 2 GB RAM**,
  a public IP, and set a root password or SSH key.
- Note the server's **public IP**.

SSH in:
```bash
ssh root@YOUR_SERVER_IP
```

## 2. Install packages & firewall

```bash
apt update
apt install -y git python3-venv python3-pip build-essential nginx postgresql ufw
# Node.js 22 (Ubuntu's apt node is too old for Vite):
curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
apt install -y nodejs

# Firewall — ALLOW SSH FIRST so you don't lock yourself out, then enable:
ufw allow 22
ufw allow 80
ufw allow 443
ufw --force enable
```

## 3. PostgreSQL database

```bash
sudo -u postgres psql <<'SQL'
CREATE DATABASE secret_chat;
CREATE USER secret WITH PASSWORD 'change-me';
GRANT ALL PRIVILEGES ON DATABASE secret_chat TO secret;
ALTER DATABASE secret_chat OWNER TO secret;
SQL
```

## 4. Get the code

Push this repo to GitHub first (from your PC):
```bash
git remote add origin https://github.com/<you>/secret-chat.git
git push -u origin main
```
Then on the server:
```bash
git clone https://github.com/<you>/secret-chat.git /opt/secret-chat
```

## 5. Configure environment

```bash
cp /opt/secret-chat/deploy/env.prod.example /opt/secret-chat/backend/.env
nano /opt/secret-chat/backend/.env      # set SECRET_KEY, ALLOWED_HOSTS, DB_PASSWORD
```
Generate a secret key:
```bash
python3 -c "import secrets; print(secrets.token_urlsafe(50))"
```
Set `ALLOWED_HOSTS` to your server IP (and domain later, if you get one).

Build & migrate:
```bash
cd /opt/secret-chat
bash deploy/deploy.sh    # venv, deps, React build, collectstatic, migrate
```
(The "service not installed yet" line at the end is expected on the first run.)

## 6. Run daphne as a service

```bash
cp /opt/secret-chat/deploy/secret-chat.service /etc/systemd/system/
systemctl daemon-reload
systemctl enable --now secret-chat
systemctl status secret-chat        # should be "active (running)"
```

## 7. nginx

```bash
cp /opt/secret-chat/deploy/nginx.conf /etc/nginx/sites-available/secret-chat
nano /etc/nginx/sites-available/secret-chat      # set server_name to your IP/domain
ln -s /etc/nginx/sites-available/secret-chat /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl reload nginx
```

## 8. Create your admin user & open the app

```bash
cd /opt/secret-chat/backend
./venv/bin/python manage.py createsuperuser
```
Visit **http://YOUR_SERVER_IP** — register two accounts, pair, and go.
Django admin is at **/admin**.

---

## HTTPS (recommended — required for camera/mic/location)

Browsers only allow camera/mic/location on **https** (or localhost). The chat,
memories and dreams work over http, but the **live camera/location and video-notes
won't** until you have HTTPS, which needs a domain pointed at the server:

```bash
# point an A record: your-domain.com -> YOUR_SERVER_IP, then:
apt install -y certbot python3-certbot-nginx
certbot --nginx -d your-domain.com
```
Then in `backend/.env` set:
```
USE_HTTPS=True
ALLOWED_HOSTS=your-domain.com,YOUR_SERVER_IP
CSRF_TRUSTED_ORIGINS=https://your-domain.com
```
and `systemctl restart secret-chat`.

## Updating after code changes

```bash
cd /opt/secret-chat && bash deploy/deploy.sh
```

## Backups (chats + media live here — back them up)

```bash
# database
sudo -u postgres pg_dump secret_chat > ~/secret_chat_$(date +%F).sql
# media
tar czf ~/media_$(date +%F).tar.gz -C /opt/secret-chat/backend media
```

## Troubleshooting

- **App logs:** `journalctl -u secret-chat -f`
- **nginx logs:** `tail -f /var/log/nginx/error.log`
- **502 Bad Gateway:** daphne isn't running — `systemctl status secret-chat`.
- **DisallowedHost / CSRF error:** add the host/domain to `ALLOWED_HOSTS`
  (and `CSRF_TRUSTED_ORIGINS` on HTTPS), then restart.
- **Camera/mic won't turn on:** you're on http — set up HTTPS (above).
