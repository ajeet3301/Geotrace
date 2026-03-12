# GeoTrace 🌍

AI-Powered Photo Geolocation + Live GPS Tracker

## Features
- 📸 **Photo Analyzer** — EXIF GPS extraction + Claude AI Vision location analysis
- 📡 **Live Tracker** — Real-time GPS tracking with path history
- 🔥 **Heatmap** — Visualize movement patterns
- 🔒 **Geofences** — Enter/exit alerts for virtual boundaries
- 📊 **Analytics** — Distance, speed, route playback
- 👥 **Multi-user** — See all online users on one map

## Stack
- Frontend: Pure HTML/CSS/Vanilla JS
- Auth: Firebase Google Sign-In
- DB: Firestore
- AI: Anthropic Claude (claude-sonnet-4-6)
- Maps: Leaflet.js + OpenStreetMap
- Hosting: Vercel

## Folder Structure
```
geotrace/
├── api/
│   ├── config.js      ← Vercel serverless: serves Firebase config
│   └── socket.js      ← Vercel serverless: Live tracker REST API
├── css/
│   ├── variables.css
│   ├── animations.css
│   ├── style.css      ← Landing page
│   ├── login.css
│   ├── app.css        ← Analyzer + Admin
│   └── live.css       ← Live Tracker
├── js/
│   ├── auth.js        ← Firebase auth helpers
│   ├── geo.js         ← EXIF + Claude AI + Geocoding
│   ├── particles.js   ← Canvas particle system
│   ├── main.js        ← Landing page helpers
│   ├── app.js         ← Analyzer logic
│   ├── admin.js       ← Admin dashboard
│   └── live.js        ← Live tracker logic
├── index.html         ← Landing page
├── login.html
├── app.html
├── admin.html
├── live.html
└── vercel.json
```

## Vercel Environment Variables Required
```
FIREBASE_API_KEY
FIREBASE_AUTH_DOMAIN
FIREBASE_PROJECT_ID
FIREBASE_STORAGE_BUCKET
FIREBASE_MESSAGING_SENDER_ID
FIREBASE_APP_ID
ADMIN_EMAILS          ← comma-separated admin emails
ANTHROPIC_API_KEY
```

## Deploy
1. Push this repo to GitHub
2. Import in Vercel → set Root Directory to `geotrace/geotrace`
3. Add all environment variables
4. Deploy!
