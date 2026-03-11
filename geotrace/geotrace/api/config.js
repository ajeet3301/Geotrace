export default function handler(req, res) {
  const adminEmails = (process.env.ADMIN_EMAILS || '')
    .split(',')
    .map(e => e.trim())
    .filter(Boolean);
  const config = `
window.firebaseConfig = {
  apiKey: ${JSON.stringify(process.env.FIREBASE_API_KEY || '')},
  authDomain: ${JSON.stringify(process.env.FIREBASE_AUTH_DOMAIN || '')},
  projectId: ${JSON.stringify(process.env.FIREBASE_PROJECT_ID || '')},
  storageBucket: ${JSON.stringify(process.env.FIREBASE_STORAGE_BUCKET || '')},
  messagingSenderId: ${JSON.stringify(process.env.FIREBASE_MESSAGING_SENDER_ID || '')},
  appId: ${JSON.stringify(process.env.FIREBASE_APP_ID || '')}
};
window.ADMIN_EMAILS = ${JSON.stringify(adminEmails)};
window.ANTHROPIC_API_KEY = "${process.env.ANTHROPIC_API_KEY || ''}";
window.APP_CONFIG = {
  appName: 'GeoTrace',
  version: '1.0.0',
  maxFileSizeMB: 10,
  supportedTypes: ['image/jpeg', 'image/png', 'image/heic', 'image/webp'],
  nominatimUrl: 'https://nominatim.openstreetmap.org/reverse',
  historyLimit: 50
};
`;
  res.setHeader('Content-Type', 'application/javascript');
  res.setHeader('Cache-Control', 'no-store');
  res.send(config);
}
