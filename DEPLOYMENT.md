# BlinkChat deployment

## Overview

- **Frontend:** Deploy to **Vercel** (Next.js).
- **Backend:** Deploy to a **VPS or cloud** (e.g. Ubuntu on DigitalOcean, AWS EC2, Railway, Render) with Django, Redis, and optionally MongoDB.

## Frontend (Vercel)

1. Push the repo to GitHub and import the project in [Vercel](https://vercel.com). Set the **root directory** to `ui`.
2. Add environment variables:
   - `NEXT_PUBLIC_API_URL` – Backend API base URL (e.g. `https://api.yourdomain.com/api`)
   - `NEXT_PUBLIC_WS_URL` – Backend WebSocket URL (e.g. `wss://api.yourdomain.com/ws/chat/`). If omitted, the app derives it from `NEXT_PUBLIC_API_URL` (http→ws, https→wss).
3. Deploy. Vercel will build and serve the Next.js app.

## Backend (VPS / cloud)

### Requirements

- Python 3.10+
- Redis (for Channels and matchmaking queue)
- PostgreSQL or SQLite (Django DB; SQLite is fine for small setups)
- Optional: MongoDB (match logs)

### Example: Ubuntu VPS

```bash
# System
sudo apt update && sudo apt install -y python3-venv redis-server

# App
cd /opt/blinkchat/api
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt gunicorn

# Env
cp .env.example .env
# Edit .env: DJANGO_SECRET_KEY, ALLOWED_HOSTS, CORS_ORIGINS, REDIS_URL, DATABASE, etc.
```

### Environment variables (backend)

| Variable | Description |
|----------|-------------|
| `DJANGO_SECRET_KEY` | Secret key (generate a new one for production) |
| `DEBUG` | `False` in production |
| `ALLOWED_HOSTS` | Comma-separated (e.g. `api.yourdomain.com`) |
| `CORS_ORIGINS` | Frontend origin (e.g. `https://yourapp.vercel.app`) |
| `REDIS_URL` | e.g. `redis://localhost:6379` or Redis Cloud URL |
| `MONGO_URI` | Optional; e.g. `mongodb://localhost:27017` |
| `MONGO_DB_NAME` | Optional; e.g. `blinkchat` |

### Run with Gunicorn + Daphne

- **HTTP:** Gunicorn for REST API.
- **WebSockets:** Daphne (ASGI) for `/ws/chat/`.

Use a process manager (e.g. systemd) or a single ASGI server for both:

```bash
daphne -b 0.0.0.0 -p 8000 config.asgi:application
```

Or run Gunicorn for HTTP and Daphne for WebSockets behind a reverse proxy (e.g. Nginx) that routes `/ws/` to Daphne and the rest to Gunicorn.

### Nginx (reverse proxy)

- Proxy `https://api.yourdomain.com` to `http://127.0.0.1:8000`.
- For WebSockets, use `proxy_http_version 1.1`, `proxy_set_header Upgrade $http_upgrade`, `proxy_set_header Connection "upgrade"`, and `proxy_read_timeout` large enough.

### Security checklist

- Set `DEBUG=False` and a strong `SECRET_KEY`.
- Use HTTPS (and wss for WebSockets) in production.
- Restrict `ALLOWED_HOSTS` and `CORS_ORIGINS` to your frontend/API domains.
- Run migrations and collect static files if you serve them from Django: `python manage.py migrate && python manage.py collectstatic --noinput`.
- Consider rate limiting (e.g. django-ratelimit) on auth and report endpoints.

## Summary

| Component | Where | Notes |
|-----------|--------|--------|
| Next.js UI | Vercel | Set `NEXT_PUBLIC_API_URL` and `NEXT_PUBLIC_WS_URL` |
| Django API + WebSockets | VPS/cloud | Daphne (ASGI), Redis, env from table above |
| Redis | Same VPS or managed | Required for Channels and matchmaking |
| MongoDB | Optional | Match logs only |
