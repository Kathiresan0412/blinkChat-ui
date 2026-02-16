# BlinkChat

Random live video chat (OmeTV-style) with Django backend and Next.js frontend.

## Features

- **Random matchmaking** – Redis-backed queue pairs users in real time
- **Real-time text chat** – In-session messaging over WebSockets
- **WebRTC video/audio** – Peer-to-peer with Django Channels signaling
- **Next** – Skip to next stranger; re-queue on disconnect
- **User reporting** – Authenticated users can report with reason + optional details
- **Moderation** – User profiles with ban support; reports in Django admin

## Stack

- **Backend:** Django, Django REST Framework, Django Channels, Redis, MongoDB (match logs), JWT auth
- **Frontend:** Next.js 16, Tailwind CSS, native WebSocket + WebRTC

## Quick start

### Backend (API)

```bash
cd api
python -m venv .venv
source .venv/bin/activate   # or .venv\Scripts\activate on Windows
pip install -r requirements.txt
cp .env.example .env       # edit with your Redis/Mongo/secret
python manage.py migrate
python manage.py runserver  # or: daphne -b 0.0.0.0 -p 8000 config.asgi:application
```

Ensure **Redis** is running (e.g. `redis-server`). MongoDB is optional (match logging).

### Frontend (UI)

```bash
cd ui
npm install
npm run dev
```

Set `NEXT_PUBLIC_API_URL=http://localhost:8000/api` (and optionally `NEXT_PUBLIC_WS_URL=ws://localhost:8000`) if needed. Defaults point to `localhost:8000`.

### Try it

1. Open http://localhost:3000
2. Click **Start Chat** – you join the matchmaking queue
3. Open another tab/window and **Start Chat** again – you should be matched and see video + text chat
4. Use **Next** to skip and find someone else (reconnects and re-queues)

## Project layout

- `api/` – Django project (`config`) and `chat` app (WebSocket consumer, queue, auth, reports)
- `ui/` – Next.js app (landing, `/chat`, `/login`, `/register`)

## Deployment

See [DEPLOYMENT.md](./DEPLOYMENT.md) for Vercel (frontend) and VPS/cloud (backend) steps.
