# GeoTrace — AI-Powered Photo Geolocation

Upload any photo and GeoTrace finds where it was taken — using EXIF GPS metadata and Claude AI Vision analysis. Results are pinned on an interactive Leaflet.js map with a full analysis report.

## Features

- 🛰️ **EXIF GPS Extraction** — reads hidden GPS coordinates from photo metadata
- 🤖 **Claude AI Vision** — analyzes landmarks, architecture, vegetation, and cultural clues
- 🗺️ **Interactive Map** — Leaflet.js + OpenStreetMap, no API key required
- 📊 **Search History** — saved per-user in Firestore
- 🔐 **Google Auth** — Firebase Authentication, one-click sign-in
- ⚙️ **Admin Dashboard** — realtime analytics, user management, export tools

## Tech Stack (100% Free)

| Layer    | Technology                          |
|----------|-------------------------------------|
| Frontend | Pure HTML + CSS + Vanilla JS        |
| Auth     | Firebase Authentication             |
| Database | Firebase Firestore                  |
| AI       | Anthropic Claude Vision API         |
| Maps     | Leaflet.js + OpenStreetMap          |
| EXIF     | exifr.js (browser library)          |
| Charts   | Chart.js (admin panel)              |
| Deploy   | Vercel (free tier)                  |

## Deployment Guide

### STEP 1 — Firebase Setup

1. Go to [console.firebase.google.com](https://console.firebase.google.com)
2. Create a new project
3. Enable **Google Authentication**:
   - Authentication → Sign-in method → Google → Enable
4. Enable **Cloud Firestore**:
   - Firestore Database → Create database → Start in production mode
5. Add Firestore security rules:
   ```
   rules_version = '2';
   service cloud.firestore {
     match /databases/{database}/documents {
       match /users/{uid} {
         allow read, write: if request.auth != null && request.auth.uid == uid;
         allow read: if request.auth != null && get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'admin';
         allow write: if request.auth != null && get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'admin';
       }
       match /searches/{docId} {
         allow read, create: if request.auth != null;
         allow delete: if request.auth != null && (resource.data.uid == request.auth.uid || get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'admin');
       }
       match /analytics/{docId} {
         allow create: if request.auth != null;
         allow read: if request.auth != null && get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'admin';
       }
     }
   }
   ```
6. Note down your Firebase config values (Project Settings → Your apps → Web app)

### STEP 2 — GitHub

1. Upload all project files to a new GitHub repository
2. **Do NOT upload the `.env` file** — it's already in `.gitignore`

### STEP 3 — Vercel Deployment

1. Go to [vercel.com](https://vercel.com) → Import your GitHub repo
2. Add these **Environment Variables** in Vercel dashboard:

| Variable | Value |
|----------|-------|
| `FIREBASE_API_KEY` | Your Firebase API key |
| `FIREBASE_AUTH_DOMAIN` | `your-project.firebaseapp.com` |
| `FIREBASE_PROJECT_ID` | Your project ID |
| `FIREBASE_STORAGE_BUCKET` | `your-project.appspot.com` |
| `FIREBASE_MESSAGING_SENDER_ID` | Your sender ID |
| `FIREBASE_APP_ID` | Your app ID |
| `ADMIN_EMAILS` | `admin@example.com,other@example.com` |

3. Deploy!

### STEP 4 — Using the App

1. Open your Vercel URL
2. Click **Get Started** → Sign in with Google
3. In the Analyzer, paste your [Anthropic API key](https://console.anthropic.com) (never stored)
4. Upload a photo and click **ANALYZE LOCATION**

## Security Notes

- Firebase keys are **never in code** — they're fetched at runtime from `api/config.js` (a Vercel serverless function)
- The Anthropic API key is used directly in the browser and **never saved** anywhere
- All Firestore reads are authenticated — users can only read their own data
- Admin access is controlled by the `ADMIN_EMAILS` environment variable

## File Structure

```
geotrace/
├── .gitignore
├── .env.example
├── vercel.json
├── README.md
├── api/
│   └── config.js          ← Serverless function: Firebase config
├── index.html             ← Landing page
├── login.html             ← Google sign-in
├── app.html               ← Main analyzer app
├── admin.html             ← Admin dashboard
├── css/
│   ├── variables.css
│   ├── animations.css
│   ├── style.css
│   ├── app.css
│   └── login.css
└── js/
    ├── auth.js
    ├── geo.js
    ├── app.js
    ├── admin.js
    ├── particles.js
    ├── parallax.js
    └── main.js
```

## Anthropic API Key

Get your key at [console.anthropic.com](https://console.anthropic.com/api-keys). The app uses `claude-sonnet-4-6` for analysis. Typical cost per analysis is ~$0.01–0.03 depending on image size.
