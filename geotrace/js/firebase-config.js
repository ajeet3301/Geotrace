/* ================================================================
   GEOTRACE — js/firebase-config.js
   Firebase config fetched from Vercel env vars via /api/config
   ================================================================ */

import { initializeApp }
  from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js';
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged }
  from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js';
import { getFirestore, collection, addDoc, getDocs, query, orderBy, limit, where, serverTimestamp, doc, getDoc, setDoc, updateDoc, increment }
  from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';

/* Fetch config from Vercel serverless — no hardcoded keys */
const configRes      = await fetch('/api/config');
const firebaseConfig = await configRes.json();
if (firebaseConfig.error) throw new Error('Firebase config error: ' + firebaseConfig.error);

const app            = initializeApp(firebaseConfig);
const auth           = getAuth(app);
const db             = getFirestore(app);
const googleProvider = new GoogleAuthProvider();

async function signInWithGoogle() {
  const result = await signInWithPopup(auth, googleProvider);
  await ensureUserDoc(result.user);
  return result.user;
}

async function signOutUser() {
  await signOut(auth);
}

async function ensureUserDoc(user) {
  const ref  = doc(db, 'users', user.uid);
  const snap = await getDoc(ref);
  if (!snap.exists()) {
    await setDoc(ref, {
      uid: user.uid, email: user.email, name: user.displayName,
      photo: user.photoURL, role: 'user',
      createdAt: serverTimestamp(), searchCount: 0,
    });
  }
}

async function isAdmin(uid) {
  const snap = await getDoc(doc(db, 'users', uid));
  return snap.exists() && snap.data().role === 'admin';
}

async function saveSearch(uid, data) {
  const ref = await addDoc(collection(db, 'searches'), {
    uid, filename: data.filename, lat: data.lat || null, lng: data.lng || null,
    address: data.address || null, source: data.source,
    aiSummary: data.aiSummary || null, confidence: data.confidence || null,
    createdAt: serverTimestamp(),
  });
  await updateDoc(doc(db, 'users', uid), { searchCount: increment(1) });
  return ref.id;
}

async function getMySearches(uid, limitN = 20) {
  const q    = query(collection(db,'searches'), where('uid','==',uid), orderBy('createdAt','desc'), limit(limitN));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

async function getAllSearches(limitN = 100) {
  const q    = query(collection(db,'searches'), orderBy('createdAt','desc'), limit(limitN));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

async function getAllUsers() {
  const q    = query(collection(db,'users'), orderBy('createdAt','desc'));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export {
  auth, db, onAuthStateChanged,
  signInWithGoogle, signOutUser, isAdmin,
  saveSearch, getMySearches, getAllSearches, getAllUsers,
};
