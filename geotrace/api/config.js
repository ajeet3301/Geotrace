/* ================================================================
   GEOTRACE — api/config.js
   Serves Firebase public config from Vercel Environment Variables.
   This way your Firebase config is NEVER hardcoded in your code.

   Add these in Vercel Dashboard → Settings → Environment Variables:
   - FIREBASE_API_KEY
   - FIREBASE_AUTH_DOMAIN
   - FIREBASE_PROJECT_ID
   - FIREBASE_STORAGE_BUCKET
   - FIREBASE_MESSAGING_SENDER_ID
   - FIREBASE_APP_ID
   ================================================================ */

export default function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const config = {
    apiKey:            process.env.FIREBASE_API_KEY,
    authDomain:        process.env.FIREBASE_AUTH_DOMAIN,
    projectId:         process.env.FIREBASE_PROJECT_ID,
    storageBucket:     process.env.FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID,
    appId:             process.env.FIREBASE_APP_ID,
  };

  // Check all values are set
  const missing = Object.entries(config)
    .filter(([, v]) => !v)
    .map(([k]) => k);

  if (missing.length > 0) {
    return res.status(500).json({
      error: 'Missing Vercel environment variables: ' + missing.join(', '),
    });
  }

  // Cache for 1 hour (config rarely changes)
  res.setHeader('Cache-Control', 'public, max-age=3600');
  return res.status(200).json(config);
}
