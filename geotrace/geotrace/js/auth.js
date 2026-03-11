// auth.js — Firebase Authentication Logic

let _firebaseApp = null;
let _auth = null;
let _db = null;

// Initialize Firebase — call first on every page
function initFirebase() {
  if (_firebaseApp) return { auth: _auth, db: _db };

  _firebaseApp = firebase.initializeApp(window.firebaseConfig);
  _auth = firebase.auth();
  _db = firebase.firestore();

  return { auth: _auth, db: _db };
}

function getAuth() { return _auth; }
function getDb()   { return _db; }

// Sign in with Google popup
async function signInWithGoogle() {
  const provider = new firebase.auth.GoogleAuthProvider();
  provider.setCustomParameters({ prompt: 'select_account' });
  const result = await _auth.signInWithPopup(provider);
  return result.user;
}

// Sign out and redirect
async function signOut() {
  await _auth.signOut();
  window.location.href = '/login';
}

// Save or update user in Firestore
async function saveUserToFirestore(user) {
  const userRef = _db.collection('users').doc(user.uid);
  const snap = await userRef.get();

  const role = isAdmin(user.email) ? 'admin' : 'user';
  const now = firebase.firestore.FieldValue.serverTimestamp();

  if (!snap.exists) {
    await userRef.set({
      uid:         user.uid,
      name:        user.displayName || '',
      email:       user.email || '',
      photo:       user.photoURL || '',
      role:        role,
      createdAt:   now,
      lastLogin:   now,
      searchCount: 0,
      lastSearch:  null,
      isActive:    true
    });
  } else {
    await userRef.update({
      name:      user.displayName || snap.data().name || '',
      photo:     user.photoURL  || snap.data().photo  || '',
      lastLogin: now,
      role:      role
    });
  }

  return userRef;
}

// Redirect after login based on role
function redirectAfterLogin(user) {
  if (isAdmin(user.email)) {
    window.location.href = '/admin';
  } else {
    window.location.href = '/app';
  }
}

// Require authentication — returns user or redirects
function requireAuth() {
  return new Promise((resolve) => {
    const unsubscribe = _auth.onAuthStateChanged((user) => {
      unsubscribe();
      if (user) {
        resolve(user);
      } else {
        window.location.href = '/login';
      }
    });
  });
}

// Require admin role — returns user or redirects to app
function requireAdmin() {
  return new Promise((resolve) => {
    const unsubscribe = _auth.onAuthStateChanged((user) => {
      unsubscribe();
      if (user && isAdmin(user.email)) {
        resolve(user);
      } else if (user) {
        window.location.href = '/app';
      } else {
        window.location.href = '/login';
      }
    });
  });
}

// Check if email is admin
function isAdmin(email) {
  if (!email) return false;
  const adminEmails = window.ADMIN_EMAILS || [];
  return adminEmails.includes(email.toLowerCase().trim());
}

// Log an analytics event to Firestore
async function logEvent(type, data = {}, uid = null) {
  try {
    await _db.collection('analytics').add({
      type,
      uid,
      data,
      timestamp: firebase.firestore.FieldValue.serverTimestamp(),
      userAgent: navigator.userAgent,
      page: window.location.pathname
    });
  } catch (e) {
    console.warn('Analytics log failed:', e);
  }
}

// Fetch user profile from Firestore
async function getCurrentUserProfile() {
  const user = _auth.currentUser;
  if (!user) return null;
  const snap = await _db.collection('users').doc(user.uid).get();
  return snap.exists ? snap.data() : null;
}

// Expose globals
window.GeoAuth = {
  initFirebase,
  getAuth,
  getDb,
  signInWithGoogle,
  signOut,
  saveUserToFirestore,
  redirectAfterLogin,
  requireAuth,
  requireAdmin,
  isAdmin,
  logEvent,
  getCurrentUserProfile
};
