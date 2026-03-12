# GeoTrace Live — Real-Time Location Tracker

A production-ready real-time location tracking system with WebSockets, geofencing, heatmaps, analytics, and route playback.

## 🚀 Features

| Feature | Details |
|---------|---------|
| 📡 Real-time tracking | GPS via browser Geolocation API |
| 🔌 WebSocket live updates | Socket.io — multi-user location sharing |
| ⬡ Geofencing | Enter/exit alerts with browser notifications |
| 🔥 Heatmap | Visual frequency map of visited locations |
| 🛤️ Route playback | Animated route replay with speed |
| 📊 Analytics | Distance, duration, avg/max speed |
| 👥 Multi-user tracking | See all online users on the map |
| 🗺️ Map views | Street / Satellite / Terrain (free OSM/Esri) |
| 📥 GPX Export | Standard format for any GPS app |
| 🔑 JWT Auth | Secure login with bcrypt passwords |

## ⚡ Quick Start (Local)

```bash
# Install
npm install

# Run
npm start
# → http://localhost:3001

# Dev (auto-restart)
npm run dev
```

Demo login: `demo@geotrace.io` / `demo123`

## 🌐 Deploy FREE on Railway

1. Go to https://railway.app (free tier)
2. New Project → Deploy from GitHub
3. Upload this folder / connect repo
4. Set env var: `JWT_SECRET=your_secret_here`
5. Done! Railway gives you a free URL like `geotrace.up.railway.app`

## 🌐 Deploy FREE on Render

1. Go to https://render.com
2. New → Web Service → connect GitHub
3. Build command: `npm install`
4. Start command: `npm start`
5. Add env var: `JWT_SECRET=your_secret_here`
6. Free URL: `geotrace.onrender.com`

## 🌐 Deploy on your existing Vercel (as separate service)

> Note: Vercel serverless doesn't support persistent WebSockets.
> Use Railway or Render for WebSocket support.

## Env Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `JWT_SECRET` | `geotrace_secret_change_me_in_prod` | JWT signing secret (CHANGE THIS!) |
| `PORT` | `3001` | Server port |

## API Endpoints

```
POST /api/auth/register   — Register new user
POST /api/auth/login      — Login, returns JWT token

GET  /api/location/history  — Get GPS point history
DEL  /api/location/history  — Clear history
GET  /api/location/heatmap  — Get heatmap data
GET  /api/analytics          — Distance/speed stats

GET  /api/geofences          — List geofences
POST /api/geofences          — Create geofence
DEL  /api/geofences/:id      — Delete geofence

GET  /api/users/online       — List online users
```

## WebSocket Events

```
Client → Server:
  location:update  { lat, lon, accuracy, speed, heading }
  route:request    (request history for playback)

Server → Client:
  location:broadcast  { userId, name, color, lat, lon, ... }
  geofence:alert     { type:'enter'|'exit', fenceName, ... }
  user:joined        { id, name, color }
  user:left          { id, name }
  route:data         { points: [...] }
```

## Architecture

```
Browser (GPS) → Socket.io → Node.js Server
                                  ↓
                          Geofence Check
                          Heatmap Update
                          History Store
                                  ↓
                          Broadcast to all
                          connected clients
```

> Production: Replace in-memory store with PostgreSQL/Redis
