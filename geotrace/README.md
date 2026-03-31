# 🛰️ GeoTrace v2.0 — AI Photo Geolocation

Upload any photo → extract GPS from EXIF → identify location with Claude AI → **cinematic satellite map flyover**.

---

## 🗂️ File Structure

```
/
├── index.html              ← Premium landing page
├── app.html                ← Main app (GeoSpy-style map)
├── admin.html              ← Admin dashboard
├── vercel.json             ← Vercel config
├── firestore.rules         ← Paste into Firebase console
│
├── api/
│   ├── analyze.js          ← Claude AI proxy (server-side key)
│   └── config.js           ← Firebase config from env vars
│
├── css/
│   ├── variables.css       ← Design tokens (DO NOT MODIFY)
│   ├── animations.css      ← Keyframes incl. GeoSpy marker anims
│   ├── style.css           ← Landing page styles (DO NOT MODIFY)
│   ├── app.css             ← App + GeoSpy map styles
│   └── enhancements.css    ← Hover/scroll effects
│
└── js/
    ├── particles.js        ← Canvas constellation background
    ├── parallax.js         ← Scroll parallax + orb effects
    ├── main.js             ← Nav, cursor, reveal, toast
    ├── firebase-config.js  ← Firebase init (fetches config from /api/config)
    ├── app.js              ← GeoSpy map: satellite, flyTo, markers, HUD
    ├── admin.js            ← Admin dashboard logic
    ├── constellation.js    ← Click-to-place star markers (landing)
    └── enhancements.js     ← Card tilt, ripple, scroll effects
```

---

## 🗺️ GeoSpy Map Features (NEW in v2)

| Feature | Details |
|---|---|
| **Satellite tiles** | Esri WorldImagery — free, no API key |
| **Dark street mode** | CartoDB DarkMatter toggle |
| **Cinematic flyTo** | `flyTo()` 2.5s animated zoom-in |
| **Neon crosshair marker** | Rotating dashes + radar ping rings + scan sweep |
| **Confidence radius** | Cyan dashed circle — 200m (100%) to 120km (0%) |
| **HUD overlay** | Coordinates, location, confidence bar, source badge |
| **Layer toggle** | SATELLITE / DARK STREET pill buttons |
| **Glassmorphic controls** | Dark zoom buttons with cyan border glow |

---

## 🚀 Setup (3 Steps)

### 1. Vercel Environment Variables

Go to **Vercel Dashboard → Settings → Environment Variables**:

| Variable | Value |
|---|---|
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
5. Sign in to app once, then in Firestore set your user's `role` field to `"admin"`
6. In Firebase Auth → Settings → **Authorized domains** → add your Vercel URL

### 3. GitHub → Vercel Deploy

1. Push this folder to GitHub
2. Connect at [vercel.com](https://vercel.com)
3. Framework: **Other**
4. Root Directory: leave blank (or your subfolder name)
5. Deploy ✅

---

## 🔑 Only 2 API Keys Needed

- **Anthropic API Key** → `sk-ant-...` (get from [console.anthropic.com](https://console.anthropic.com))
- **Firebase config** → 6 values from Firebase console (all free)

No paid map APIs. No extra keys. Everything else is open source.

---

MIT License · Built with Claude AI · Leaflet.js · Esri · Firebase · OpenStreetMap
