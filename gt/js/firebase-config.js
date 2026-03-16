/* ================================================================
   GEOTRACE — firebase-config.js
   Firebase + Google Auth + Firestore initialization

   SETUP:
   1. Go to https://console.firebase.google.com
   2. Create a project → Add Web App
   3. Copy your firebaseConfig object values below
   4. Enable: Authentication > Google sign-in
   5. Enable: Firestore Database (start in production mode)
   6. Set Firestore rules (see README.md)
   ================================================================ */

import { initializeApp }        from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js';
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged }
  from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js';
import { getFirestore, collection, addDoc, getDocs, query, orderBy, limit, where, serverTimestamp, doc, getDoc, setDoc, updateDoc, increment }
  from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';

/* ──────────────────────────────────────────────────────────────
   ✅ AUTO CONFIG — fetched from Vercel Environment Variables
   Set these in Vercel Dashboard → Settings → Environment Variables:
     FIREBASE_API_KEY
     FIREBASE_AUTH_DOMAIN
     FIREBASE_PROJECT_ID
     FIREBASE_STORAGE_BUCKET
     FIREBASE_MESSAGING_SENDER_ID
     FIREBASE_APP_ID
   NO hardcoded values needed. NO .env file needed.
   ────────────────────────────────────────────────────────────── */

// Fetch config from our Vercel serverless endpoint
const configRes      = await fetch('/api/config');
const firebaseConfig = await configRes.json();

if (firebaseConfig.error) {
  throw new Error('Firebase config error: ' + firebaseConfig.error);
}

const app  = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db   = getFirestore(app);
const googleProvider = new GoogleAuthProvider();

/* ── Auth helpers ── */
async function signInWithGoogle() {
  try {
    const result = await signInWithPopup(auth, googleProvider);
    await ensureUserDoc(result.user);
    return result.user;
  } catch (err) {
    console.error('Google sign-in failed:', err);
    throw err;
  }
}

async function signOutUser() {
  await signOut(auth);
}

/* ── Ensure user document exists in Firestore ── */
async function ensureUserDoc(user) {
  const ref = doc(db, 'users', user.uid);
  const snap = await getDoc(ref);
  if (!snap.exists()) {
    await setDoc(ref, {
      uid:        user.uid,
      email:      user.email,
      name:       user.displayName,
      photo:      user.photoURL,
      role:       'user',           // 'user' | 'admin'
      createdAt:  serverTimestamp(),
      searchCount: 0,
    });
  }
}

/* ── Check if user is admin ── */
async function isAdmin(uid) {
  const ref  = doc(db, 'users', uid);
  const snap = await getDoc(ref);
  return snap.exists() && snap.data().role === 'admin';
}

/* ── Save a geolocation result ── */
async function saveSearch(uid, data) {
  const ref = await addDoc(collection(db, 'searches'), {
    uid,
    filename:    data.filename,
    lat:         data.lat || null,
    lng:         data.lng || null,
    address:     data.address || null,
    source:      data.source,   // 'exif' | 'ai' | 'none'
    aiSummary:   data.aiSummary || null,
    exifData:    data.exifData || null,
    confidence:  data.confidence || null,
    createdAt:   serverTimestamp(),
  });

  // Increment user search count
  const userRef = doc(db, 'users', uid);
  await updateDoc(userRef, { searchCount: increment(1) });

  return ref.id;
}

/* ── Get user's own search history ── */
async function getMySearches(uid, limitN = 20) {
  const q    = query(
    collection(db, 'searches'),
    where('uid', '==', uid),
    orderBy('createdAt', 'desc'),
    limit(limitN)
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

/* ── Admin: get all searches ── */
async function getAllSearches(limitN = 100) {
  const q    = query(collection(db, 'searches'), orderBy('createdAt', 'desc'), limit(limitN));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

/* ── Admin: get all users ── */
async function getAllUsers() {
  const q    = query(collection(db, 'users'), orderBy('createdAt', 'desc'));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export {
  auth, db,
  onAuthStateChanged,
  signInWithGoogle, signOutUser,
  isAdmin,
  saveSearch, getMySearches,
  getAllSearches, getAllUsers,
};
