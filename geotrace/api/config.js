export default function handler(req, res) {
  res.setHeader('Content-Type', 'application/javascript');
  res.setHeader('Cache-Control', 'no-store');

  const adminEmails = (process.env.ADMIN_EMAILS || '')
    .split(',').map(e => e.trim().toLowerCase()).filter(Boolean);

  res.send(`
window.firebaseConfig = {
  apiKey:            "${process.env.FIREBASE_API_KEY            || ''}",
  authDomain:        "${process.env.FIREBASE_AUTH_DOMAIN        || ''}",
  projectId:         "${process.env.FIREBASE_PROJECT_ID         || ''}",
  storageBucket:     "${process.env.FIREBASE_STORAGE_BUCKET     || ''}",
  messagingSenderId: "${process.env.FIREBASE_MESSAGING_SENDER_ID|| ''}",
  appId:             "${process.env.FIREBASE_APP_ID             || ''}"
};

window.APP_CONFIG = {
  appName:        "GeoTrace",
  version:        "2.0.0",
  adminEmails:    ${JSON.stringify(adminEmails)},
  maxFileSizeMB:  10,
  historyLimit:   50,
  anthropicModel: "claude-sonnet-4-6"
};
`);
}
