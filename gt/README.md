# GeoTrace v2.0

AI-Powered Photo Geolocation + Live GPS Tracker

## Stack
- Frontend: Pure HTML / CSS / Vanilla JS
- Auth: Firebase Authentication (Google Sign-In)
- DB: Firebase Firestore
- AI: Anthropic Claude Vision API
- Maps: Leaflet.js + OpenStreetMap
- Hosting: Vercel (serverless functions)

## Vercel Setup

1. Push this folder to GitHub
2. Connect repo in Vercel
3. **Root Directory** = `geotrace` (or your folder name)
4. Set Environment Variables:

| Variable | Value |
|---|---|
| FIREBASE_API_KEY | from Firebase console |
| FIREBASE_AUTH_DOMAIN | your-project.firebaseapp.com |
| FIREBASE_PROJECT_ID | your-project-id |
| FIREBASE_STORAGE_BUCKET | your-project.appspot.com |
| FIREBASE_MESSAGING_SENDER_ID | number |
| FIREBASE_APP_ID | 1:xxx:web:xxx |
| ADMIN_EMAILS | email@gmail.com |
| ANTHROPIC_API_KEY | sk-ant-… |

5. Deploy → go to your Vercel URL

## Pages
- `/` → Landing page
- `/login` → Google Sign-In
- `/app` → Photo Analyzer
- `/admin` → Admin Dashboard
- `/live` → Live GPS Tracker
