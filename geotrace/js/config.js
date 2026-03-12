// ================================================================
//  GeoTrace — js/config.js
//  THIS IS THE ONLY FILE YOU NEED TO EDIT BEFORE DEPLOYING
//  Follow the 3 steps below, then upload to Vercel
// ================================================================


// ────────────────────────────────────────────────────────────────
//  STEP 1 — PASTE YOUR FIREBASE CONFIG HERE
//
//  How to get it:
//  1. Go to https://console.firebase.google.com
//  2. Open your project → click the gear ⚙️ → "Project settings"
//  3. Scroll down to "Your apps" → copy the firebaseConfig object
//  4. Paste it below, replacing every "REPLACE_..." value
// ────────────────────────────────────────────────────────────────

const firebaseConfig = {
  apiKey:            "REPLACE_WITH_YOUR_API_KEY",
  authDomain:        "REPLACE_WITH_YOUR_PROJECT_ID.firebaseapp.com",
  projectId:         "REPLACE_WITH_YOUR_PROJECT_ID",
  storageBucket:     "REPLACE_WITH_YOUR_PROJECT_ID.appspot.com",
  messagingSenderId: "REPLACE_WITH_YOUR_SENDER_ID",
  appId:             "REPLACE_WITH_YOUR_APP_ID"
};

// Example of what it looks like when filled in:
// const firebaseConfig = {
//   apiKey:            "AIzaSyBxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
//   authDomain:        "geotrace-app.firebaseapp.com",
//   projectId:         "geotrace-app",
//   storageBucket:     "geotrace-app.appspot.com",
//   messagingSenderId: "123456789012",
//   appId:             "1:123456789012:web:abcdef123456"
// };


// ────────────────────────────────────────────────────────────────
//  STEP 2 — ADD YOUR GMAIL AS ADMIN
//
//  Any Gmail address listed here gets full admin access.
//  This person will see the admin dashboard with all users,
//  all searches, traffic analytics, and data export controls.
//  Add as many emails as you want.
// ────────────────────────────────────────────────────────────────

const ADMIN_EMAILS = [
  "REPLACE_WITH_YOUR_GMAIL@gmail.com",

  // Add more admins below if needed:
  // "another.admin@gmail.com",
];


// ────────────────────────────────────────────────────────────────
//  STEP 3 — CUSTOMIZE APP SETTINGS (optional)
//
//  You can change these to customize the app.
//  The Anthropic API key is NOT set here — users paste it in
//  the app UI. It stays in their browser only, never stored.
// ────────────────────────────────────────────────────────────────

const APP_CONFIG = {
  // App branding
  appName:    "GeoTrace",
  appTagline: "AI-Powered Photo Geolocation",

  // Claude AI model to use for image analysis
  // Options (cheapest → most powerful):
  //   "claude-haiku-4-5-20251001"   ← fastest, cheapest
  //   "claude-sonnet-4-6"           ← best balance (default)
  //   "claude-opus-4-6"             ← most powerful, slower
  aiModel: "claude-sonnet-4-6",

  // Max tokens for AI response (don't change unless needed)
  maxTokens: 1000,

  // How many past searches to show in history tab
  maxHistoryItems: 50,

  // Map zoom level when a location is pinned (1=world, 18=street)
  mapDefaultZoom: 13,

  // Free map tiles (OpenStreetMap — no API key needed)
  mapTileUrl: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",

  // Free reverse geocoding (lat/lon → address, no API key needed)
  nominatimUrl: "https://nominatim.openstreetmap.org/reverse",
};


// ════════════════════════════════════════════════════════════════
//  DO NOT EDIT BELOW THIS LINE
// ════════════════════════════════════════════════════════════════

// Safety check — warn in console if config is not filled in
(function checkConfig() {
  const missing = [];

  if (firebaseConfig.apiKey.startsWith("REPLACE"))           missing.push("firebaseConfig.apiKey");
  if (firebaseConfig.projectId.startsWith("REPLACE"))        missing.push("firebaseConfig.projectId");
  if (ADMIN_EMAILS[0].startsWith("REPLACE"))                 missing.push("ADMIN_EMAILS[0]");

  if (missing.length > 0) {
    console.warn(
      "%c⚠️ GeoTrace config.js not set up yet!\n" +
      "Open js/config.js and fill in:\n• " + missing.join("\n• "),
      "color: #fbbf24; font-size: 14px; font-weight: bold;"
    );
  } else {
    console.log(
      "%c✅ GeoTrace config loaded",
      "color: #34d399; font-size: 13px;"
    );
  }
})();
