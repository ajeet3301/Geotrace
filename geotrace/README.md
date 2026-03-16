# 🛰️ GeoTrace — AI Photo Geolocation

Upload any photo → extract GPS from EXIF → identify location with Claude AI → pin on interactive map.

**Free to use — no API key needed from users.**

---

## 📁 File Structure

```
/
├── index.html              ← Landing page
├── app.html                ← Main app
├── admin.html              ← Admin dashboard
├── vercel.json             ← Vercel config
├── firestore.rules         ← Paste into Firebase console
├── .gitignore
│
├── css/
│   ├── variables.css       ← Design tokens
│   ├── animations.css      ← Keyframes
│   ├── style.css           ← Landing page styles
│   ├── app.css             ← App page styles
│   ├── admin.css           ← Admin styles
│   └── enhancements.css    ← Extra animation effects
│
├── js/
│   ├── particles.js        ← Canvas constellation background
│   ├── parallax.js         ← Scroll parallax
│   ├── main.js             ← Nav, cursor, reveal, toast
│   ├── firebase-config.js  ← Firebase init (fetches config from /api/config)
│   ├── app.js              ← App logic: EXIF, map, Claude AI, history
│   ├── admin.js            ← Admin dashboard logic
│   ├── earth3d.js          ← Three.js 3D rotating Earth
│   ├── constellation.js    ← Click-to-place star markers
│   └── enhancements.js     ← Hover glows, ripple, map pulses
│
└── api/
    ├── analyze.js          ← Vercel function → Claude AI proxy
    └── config.js           ← Vercel function → Firebase config
```

---

## 🚀 Setup (3 steps)

### 1. Vercel Environment Variables

Go to **Vercel Dashboard → Settings → Environment Variables** and add:

| Variable | Value |
|----------|-------|
| `ANTHROPIC_API_KEY` | `sk-ant-...` |
| `FIREBASE_API_KEY` | from Firebase console |
| `FIREBASE_AUTH_DOMAIN` | `yourapp.firebaseapp.com` |
| `FIREBASE_PROJECT_ID` | `yourapp` |
| `FIREBASE_STORAGE_BUCKET` | `yourapp.appspot.com` |
| `FIREBASE_MESSAGING_SENDER_ID` | `123456789` |
| `FIREBASE_APP_ID` | `1:123:web:abc` |

### 2. Firebase Setup

1. Create project at [console.firebase.google.com](https://console.firebase.google.com)
2. Enable **Authentication → Google**
3. Enable **Firestore Database** (production mode)
4. Paste `firestore.rules` content into **Firestore → Rules → Publish**
5. Sign in to app once, then set your user's `role` field to `"admin"` in Firestore

### 3. Deploy to Vercel

Connect your GitHub repo at [vercel.com](https://vercel.com):
- Framework: **Other**
- Root Directory: `/` (or your subfolder)
- Click **Deploy**

---

## ⚙️ How It Works

1. User uploads image → EXIF GPS extracted in browser
2. If GPS found → plotted on Leaflet map via Nominatim reverse geocode
3. If no GPS → user clicks "Run AI Analysis" → image sent to `/api/analyze`
4. `/api/analyze` calls Claude API using server-side `ANTHROPIC_API_KEY`
5. Claude returns location JSON → pinned on map
6. Result saved to Firebase Firestore (if signed in)

---

MIT License · Built with Claude AI · Leaflet.js · Firebase · OpenStreetMap
