// ============================================================
//  GeoTrace — Authentication Module (auth.js)
//  Handles: Google Sign-In, sign-out, session, admin check
// ============================================================

// Initialize Firebase (called after config is loaded)
let db, auth, provider;

function initFirebase() {
  firebase.initializeApp(firebaseConfig);
  auth = firebase.auth();
  db   = firebase.firestore();
  provider = new firebase.auth.GoogleAuthProvider();
  provider.addScope('email');
  provider.addScope('profile');
}

// ── Google Sign In ────────────────────────────────────────────
async function signInWithGoogle() {
  try {
    showAuthLoading(true);
    const result = await auth.signInWithPopup(provider);
    const user   = result.user;
    await saveUserToFirestore(user);
    await logEvent('login', { method: 'google' }, user.uid);
    redirectAfterLogin(user);
  } catch (err) {
    showAuthLoading(false);
    showAuthError(err.message);
  }
}

// ── Sign Out ──────────────────────────────────────────────────
async function signOut() {
  const uid = auth.currentUser?.uid;
  if (uid) await logEvent('logout', {}, uid);
  await auth.signOut();
  window.location.href = 'index.html';
}

// ── Save / update user record in Firestore ────────────────────
async function saveUserToFirestore(user) {
  const ref = db.collection('users').doc(user.uid);
  const snap = await ref.get();

  if (!snap.exists) {
    // New user — create record
    await ref.set({
      uid:         user.uid,
      name:        user.displayName,
      email:       user.email,
      photo:       user.photoURL,
      role:        ADMIN_EMAILS.includes(user.email) ? 'admin' : 'user',
      createdAt:   firebase.firestore.FieldValue.serverTimestamp(),
      lastLogin:   firebase.firestore.FieldValue.serverTimestamp(),
      searchCount: 0,
      isActive:    true
    });
  } else {
    // Existing user — update last login
    await ref.update({
      lastLogin: firebase.firestore.FieldValue.serverTimestamp(),
      name:      user.displayName,
      photo:     user.photoURL
    });
  }
}

// ── Redirect after login ──────────────────────────────────────
function redirectAfterLogin(user) {
  if (ADMIN_EMAILS.includes(user.email)) {
    window.location.href = 'admin.html';
  } else {
    window.location.href = 'app.html';
  }
}

// ── Auth guard — call at top of protected pages ───────────────
function requireAuth(redirectTo = 'index.html') {
  return new Promise((resolve) => {
    auth.onAuthStateChanged(user => {
      if (!user) {
        window.location.href = redirectTo;
      } else {
        resolve(user);
      }
    });
  });
}

// ── Admin guard ───────────────────────────────────────────────
function requireAdmin(redirectTo = 'app.html') {
  return new Promise((resolve) => {
    auth.onAuthStateChanged(user => {
      if (!user) {
        window.location.href = 'index.html';
      } else if (!ADMIN_EMAILS.includes(user.email)) {
        window.location.href = redirectTo;
      } else {
        resolve(user);
      }
    });
  });
}

// ── Check if current user is admin ───────────────────────────
function isAdmin(email) {
  return ADMIN_EMAILS.includes(email);
}

// ── Log event to Firestore analytics ─────────────────────────
async function logEvent(eventType, data = {}, uid = null) {
  try {
    await db.collection('analytics').add({
      type:      eventType,
      uid:       uid || auth.currentUser?.uid || 'anonymous',
      data:      data,
      timestamp: firebase.firestore.FieldValue.serverTimestamp(),
      userAgent: navigator.userAgent,
      page:      window.location.pathname
    });
  } catch (e) { /* silent fail for analytics */ }
}

// ── UI helpers ────────────────────────────────────────────────
function showAuthLoading(show) {
  const btn = document.getElementById('google-btn');
  const spinner = document.getElementById('auth-spinner');
  if (btn) btn.style.display = show ? 'none' : 'flex';
  if (spinner) spinner.style.display = show ? 'flex' : 'none';
}

function showAuthError(msg) {
  const el = document.getElementById('auth-error');
  if (el) { el.textContent = msg; el.style.display = 'block'; }
}

// ── Get current user profile from Firestore ──────────────────
async function getCurrentUserProfile() {
  const user = auth.currentUser;
  if (!user) return null;
  const snap = await db.collection('users').doc(user.uid).get();
  return snap.exists ? { ...snap.data(), uid: user.uid } : null;
}
