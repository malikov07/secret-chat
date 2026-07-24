# Deploying to an Azure Linux VM

One VM runs everything: **nginx** (reverse proxy + static/media) → **daphne**
(Django + Channels/WebSockets) → **PostgreSQL**. Uploaded media is saved on the
VM's own disk (persistent) and served by nginx.

```
browser ──▶ nginx :80/443 ──┬─ /static/  → backend/staticfiles (React build + admin)
                            ├─ /media/   → backend/media (uploads)
                            ├─ /ws/      → daphne (WebSockets)
                            └─ /         → daphne (API + React SPA)
```

Helper files live in `deploy/`: `nginx.conf`, `secret-chat.service`, `deploy.sh`,
`env.prod.example`.

---

## 1. Create the VM

- Azure Portal → **Virtual machines → Create** → Ubuntu Server 24.04 LTS,
  size **B1s** or **B2s**, SSH public-key auth (user e.g. `azureuser`).
- **Networking**: allow inbound ports **22, 80, 443** (Azure NSG).
- Note the VM's **public IP**.

SSH in:
```bash
ssh azureuser@YOUR_VM_PUBLIC_IP
```

## 2. Install system packages

```bash
sudo apt update
sudo apt install -y git python3-venv python3-pip build-essential nginx postgresql
# Node.js 22 (Ubuntu's apt node is too old for Vite):
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt install -y nodejs
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
Then on the VM:
```bash
sudo mkdir -p /opt/secret-chat && sudo chown $USER:$USER /opt/secret-chat
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
Set `ALLOWED_HOSTS` to your VM IP (and domain if you have one).

Now build & migrate:
```bash
cd /opt/secret-chat
bash deploy/deploy.sh        # creates venv, installs deps, builds React, collectstatic, migrate
```
(The "service not installed yet" note at the end is expected on the first run.)

## 6. Run daphne as a service

```bash
sudo cp /opt/secret-chat/deploy/secret-chat.service /etc/systemd/system/
# edit User=/paths if you didn't use azureuser / /opt/secret-chat:
sudo nano /etc/systemd/system/secret-chat.service
sudo systemctl daemon-reload
sudo systemctl enable --now secret-chat
sudo systemctl status secret-chat        # should be "active (running)"
```

## 7. nginx

```bash
sudo cp /opt/secret-chat/deploy/nginx.conf /etc/nginx/sites-available/secret-chat
sudo nano /etc/nginx/sites-available/secret-chat     # set server_name to your IP/domain
sudo ln -s /etc/nginx/sites-available/secret-chat /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t && sudo systemctl reload nginx
```

## 8. Create your admin user & open the app

```bash
cd /opt/secret-chat/backend
./venv/bin/python manage.py createsuperuser
```
Visit **http://YOUR_VM_PUBLIC_IP** — register two accounts, pair, and go.
Django admin is at **/admin**.

---

## HTTPS (recommended, needed for camera/mic on other devices)

Browsers only allow camera/mic/location on **https** (or localhost). To enable it
you need a domain pointed at the VM:

```bash
# point an A record: your-domain.com -> YOUR_VM_PUBLIC_IP, then:
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d your-domain.com
```
Then in `backend/.env` set:
```
USE_HTTPS=True
ALLOWED_HOSTS=your-domain.com,YOUR_VM_PUBLIC_IP
CSRF_TRUSTED_ORIGINS=https://your-domain.com
```
and `sudo systemctl restart secret-chat`.

## Updating after code changes

```bash
cd /opt/secret-chat && bash deploy/deploy.sh
```

## Troubleshooting

- **App logs:** `sudo journalctl -u secret-chat -f`
- **nginx logs:** `sudo tail -f /var/log/nginx/error.log`
- **502 Bad Gateway:** daphne isn't running — `sudo systemctl status secret-chat`.
- **DisallowedHost / CSRF error:** add the host/domain to `ALLOWED_HOSTS`
  (and `CSRF_TRUSTED_ORIGINS` on HTTPS), then restart.
- **Camera/mic won't turn on:** you're on http — set up HTTPS (above).
- Scaling to multiple daphne workers later needs Redis: `sudo apt install redis-server`
  and set `REDIS_URL=redis://127.0.0.1:6379/0` in `.env`.
