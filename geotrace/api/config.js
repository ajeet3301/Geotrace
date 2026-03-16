/* ================================================================
   GEOTRACE — api/config.js
   Serves Firebase config from Vercel Environment Variables
   ================================================================ */

export default function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin',  '*');
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

  const missing = Object.entries(config).filter(([,v]) => !v).map(([k]) => k);
  if (missing.length > 0) {
    return res.status(500).json({ error: 'Missing env vars: ' + missing.join(', ') });
  }

  res.setHeader('Cache-Control', 'public, max-age=3600');
  return res.status(200).json(config);
}
