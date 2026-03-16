# 🛰️ GeoTrace — AI Photo Geolocation

Upload any photo → extract GPS from EXIF metadata → identify location with Claude AI → pin it on an interactive map.

**Tech stack:** HTML · CSS · Vanilla JS · Leaflet.js · OpenStreetMap · Claude Vision AI · Firebase Auth + Firestore · Vercel

---

## 📁 Project Structure

```
geotrace/
├── index.html              ← Landing page
├── app.html                ← Main app (upload + map)
├── admin.html              ← Admin dashboard
│
├── css/
│   ├── variables.css       ← Design tokens & global reset
│   ├── animations.css      ← All @keyframes
│   ├── style.css           ← Landing page styles
│   ├── app.css             ← App page styles
│   └── admin.css           ← Admin dashboard styles
│
├── js/
│   ├── particles.js        ← Canvas constellation background
│   ├── parallax.js         ← Scroll parallax + section glow
│   ├── main.js             ← Nav, cursor, reveal, typewriter, toast
│   ├── firebase-config.js  ← Firebase init + all DB helpers
│   ├── app.js              ← App logic: EXIF, map, Claude AI, history
│   └── admin.js            ← Admin: auth guard, charts, user table
│
├── api/
│   └── analyze.js          ← Vercel serverless → Claude API proxy
│
├── firestore.rules         ← Firestore security rules (paste into console)
├── vercel.json             ← Vercel deployment config
└── .gitignore
```

---

## 🚀 Setup Guide

### Step 1 — Firebase

1. Go to [https://console.firebase.google.com](https://console.firebase.google.com)
2. **Create a new project** (or use existing)
3. **Add a Web App** → copy the `firebaseConfig` object
4. Open `js/firebase-config.js` and replace the placeholder values:

```js
const firebaseConfig = {
  apiKey:            "YOUR_API_KEY",
  authDomain:        "YOUR_PROJECT_ID.firebaseapp.com",
  projectId:         "YOUR_PROJECT_ID",
  storageBucket:     "YOUR_PROJECT_ID.appspot.com",
  messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
  appId:             "YOUR_APP_ID",
};
```

5. **Enable Google Authentication:**
   - Firebase Console → Authentication → Sign-in method → Google → Enable

6. **Enable Firestore Database:**
   - Firebase Console → Firestore Database → Create database
   - Start in **production mode**

7. **Set Firestore Security Rules:**
   - Firestore → Rules → paste contents of `firestore.rules` → Publish

8. **Make yourself an admin:**
   - Sign in to the app once (creates your user document)
   - Firebase Console → Firestore → `users` collection → your document
   - Change `role` field from `"user"` to `"admin"`

---

### Step 2 — Anthropic API Key

1. Go to [https://console.anthropic.com](https://console.anthropic.com)
2. Create an API key
3. Users enter their own key in the app UI (it is stored only in `sessionStorage`, never on your server)

---

### Step 3 — Deploy to Vercel

```bash
# Install Vercel CLI
npm install -g vercel

# Login
vercel login

# Deploy from project root
cd geotrace
vercel

# Follow prompts:
# - Link to existing project or create new
# - Framework: Other
# - Root directory: ./
# - Build command: (leave empty)
# - Output directory: ./
```

Or connect your GitHub repo directly at [vercel.com](https://vercel.com):
1. Import your GitHub repository
2. Framework Preset: **Other**
3. Root Directory: `/` (or your subfolder)
4. Click **Deploy**

After deploy, update `vercel.json` → `ALLOWED_ORIGIN` to your actual domain.

---

### Step 4 — Upload to GitHub

```bash
cd geotrace

git init
git add .
git commit -m "Initial GeoTrace project"

# Create repo on github.com, then:
git remote add origin https://github.com/YOUR_USERNAME/geotrace.git
git branch -M main
git push -u origin main
```

---

## ⚙️ How It Works

### EXIF GPS Extraction
- Uses [exifr.js](https://github.com/MikeKovarik/exifr) to parse image metadata entirely in the browser
- If GPS coordinates are found, they are immediately plotted on the Leaflet map
- Reverse geocoding via [Nominatim](https://nominatim.openstreetmap.org/) (free, no API key needed)

### Claude AI Vision Analysis
- When no GPS is found (or user requests it), the image is sent to `claude-opus-4-5` with a structured prompt
- Claude analyzes landmarks, architecture, vegetation, signs, and cultural markers
- Returns a JSON response with location, confidence %, coordinates (if identifiable), and reasoning
- API call is proxied through `/api/analyze.js` to avoid CORS issues

### Interactive Map
- [Leaflet.js](https://leafletjs.com/) with [OpenStreetMap](https://openstreetmap.org/) tiles (free, no API key)
- Custom neon-styled marker pin
- Google Maps deep-link for confirmed locations

### Firebase Integration
- **Auth:** Google sign-in via Firebase Authentication
- **Firestore:** Stores search history per user + global search log for admins
- **Admin panel:** Role-based access (`role: "admin"` field in user document)

---

## 🔒 Security Notes

- The Anthropic API key is **never stored on your server** — users enter their own key which lives only in `sessionStorage`
- Firestore rules enforce that users can only read/write their own data
- Admin access is controlled by a `role` field in Firestore, not client-side logic
- The `/api/analyze.js` serverless function validates the key format before forwarding

---

## 📦 Dependencies (all CDN — no npm needed for frontend)

| Library | Purpose | CDN |
|---------|---------|-----|
| Leaflet.js 1.9.4 | Interactive maps | cdnjs |
| exifr | EXIF/GPS extraction | jsDelivr |
| Chart.js 4.4.1 | Admin analytics charts | cdnjs |
| Firebase 10.x | Auth + Firestore | gstatic |
| Google Fonts | Bebas Neue, DM Sans, JetBrains Mono | fonts.googleapis.com |

---

## 📄 License

MIT — free to use, modify, and deploy.

Built with Claude AI · Leaflet.js · OpenStreetMap · Firebase
