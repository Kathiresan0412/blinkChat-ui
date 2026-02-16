# BlinkChat deployment

## Overview

- **Frontend:** Deploy to **Vercel** (Next.js).
- **Backend:** Deploy to a **host that supports WebSockets** (Railway, Render, Fly.io, or a VPS). **Do not use Vercel for the backend** if you want video/audio/chat: Vercel serverless does not support WebSockets, so users will never get matched.

## Why two devices don’t match when the API is on Vercel

Matchmaking, chat, and video/audio all use a **WebSocket** connection (`/ws/chat/`). Vercel runs serverless functions (short request/response only) and **cannot hold WebSocket connections**. So:

- If your API is at `https://blink-chat-api.vercel.app`, the UI will try to connect to `wss://blink-chat-api.vercel.app/ws/chat/`, but that connection will not work as a real WebSocket.
- Result: both devices stay on “Looking for someone…” and never get matched.

**Fix:** Run the backend on **Railway**, **Render**, **Fly.io**, or a **VPS** (with Daphne + Redis). Then in the **UI** (Vercel) set `NEXT_PUBLIC_API_URL` (and optionally `NEXT_PUBLIC_WS_URL`) to that backend URL. Both devices will then use the same WebSocket server and can match, with video, audio, and chat.

## Frontend (Vercel)

1. Push the repo to GitHub and import the project in [Vercel](https://vercel.com). Set the **root directory** to `ui`.
2. Add environment variables:
   - `NEXT_PUBLIC_API_URL` – Backend API base URL (e.g. `https://api.yourdomain.com/api`)
   - `NEXT_PUBLIC_WS_URL` – Backend WebSocket URL (e.g. `wss://api.yourdomain.com/ws/chat/`). If omitted, the app derives it from `NEXT_PUBLIC_API_URL` (http→ws, https→wss).
3. Deploy. Vercel will build and serve the Next.js app.

## Backend (must support WebSockets)

### Quick path: Railway

1. Go to [Railway](https://railway.app) and create a project.
2. Add **Redis** (one-click) and note its `REDIS_URL`.
3. Deploy the **api** folder (e.g. connect GitHub, set root to `api`, add build command `pip install -r requirements.txt`, start command `daphne -b 0.0.0.0 -p $PORT config.asgi:application`).
4. Set env vars: `ALLOWED_HOSTS` = `*.railway.app` or your custom domain, `CORS_ORIGINS` = `https://blink-chat-ui.vercel.app`, `REDIS_URL`, `DJANGO_SECRET_KEY`, `DEBUG=False`.
5. Copy the public URL (e.g. `https://your-app.railway.app`).
6. In **Vercel** (your UI project): set `NEXT_PUBLIC_API_URL` = `https://your-app.railway.app/api`. Redeploy the UI.
7. Open https://blink-chat-ui.vercel.app/chat on two devices; they should match and get video, audio, and chat.

### Other hosts (Render, Fly.io, VPS)

Same idea: run Daphne (ASGI) + Redis, then point the UI’s `NEXT_PUBLIC_API_URL` (and `NEXT_PUBLIC_WS_URL` if needed) to that backend.

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

## Video / matchmaking not working?

1. **Backend must support WebSockets** (Railway, Render, Fly.io, etc.). Not Vercel serverless.
2. **Railway (backend) – set `CORS_ORIGINS`** to your **exact frontend origin**:
   - If the UI is on Vercel: `CORS_ORIGINS=https://your-project.vercel.app` (no trailing slash).
   - If testing from your machine: add `http://localhost:3000`.
   - You can use multiple origins separated by commas.
3. **Vercel (frontend) – set** `NEXT_PUBLIC_API_URL` to your Railway API URL, e.g. `https://blinkchap-api-production.up.railway.app/api`. The WebSocket URL is derived from this (e.g. `wss://blinkchap-api-production.up.railway.app/ws/chat/`).
4. Redeploy both after changing env vars. Use two different browsers or devices to test matching and video.

## Summary

| Component | Where | Notes |
|-----------|--------|--------|
| Next.js UI | Vercel | Set `NEXT_PUBLIC_API_URL` and `NEXT_PUBLIC_WS_URL` |
| Django API + WebSockets | VPS/cloud | Daphne (ASGI), Redis, env from table above |
| Redis | Same VPS or managed | Required for Channels and matchmaking |
| MongoDB | Optional | Match logs only |
