#!/usr/bin/env bash
# Build & (re)deploy Secret Chat on the VM.
# Usage (from the repo root):  bash deploy/deploy.sh
set -euo pipefail

APP_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$APP_DIR"

echo "==> Pulling latest code"
git pull --ff-only || echo "   (skipped git pull)"

echo "==> Backend dependencies"
cd backend
[ -d venv ] || python3 -m venv venv
./venv/bin/pip install --upgrade pip -q
./venv/bin/pip install -r requirements.txt -q

echo "==> Building frontend"
cd ../frontend
npm ci
npm run build

echo "==> collectstatic + migrate"
cd ../backend
./venv/bin/python manage.py collectstatic --noinput
./venv/bin/python manage.py migrate --noinput

echo "==> Restarting service"
sudo systemctl restart secret-chat 2>/dev/null \
  || echo "   (secret-chat service not installed yet — see DEPLOY.md step 6)"

echo "==> Done."
