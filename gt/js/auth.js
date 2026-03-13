const GT_Auth = (() => {
  let _app, _auth, _db;

  function initFirebase() {
    if (_app) return;
    if (!window.firebaseConfig?.apiKey) {
      console.warn('GT_Auth: firebaseConfig not loaded yet');
      return;
    }
    _app  = firebase.initializeApp(window.firebaseConfig);
    _auth = firebase.auth();
    _db   = firebase.firestore();
    window._auth = _auth;
    window._db   = _db;
  }

  function signInWithGoogle() {
    const provider = new firebase.auth.GoogleAuthProvider();
    provider.addScope('email');
    provider.addScope('profile');
    return _auth.signInWithPopup(provider);
  }

  function signOut() {
    return _auth.signOut().then(() => { window.location.href = '/'; });
  }

  async function saveUserProfile(user) {
    if (!_db || !user) return;
    const ref = _db.collection('users').doc(user.uid);
    const snap = await ref.get();
    const isAdmin = (window.APP_CONFIG?.adminEmails || [])
      .includes(user.email?.toLowerCase());
    const data = {
      email:     user.email,
      name:      user.displayName,
      photoURL:  user.photoURL,
      lastLogin: firebase.firestore.FieldValue.serverTimestamp(),
      role:      isAdmin ? 'admin' : (snap.exists ? (snap.data().role || 'user') : 'user')
    };
    if (!snap.exists) data.createdAt = firebase.firestore.FieldValue.serverTimestamp();
    await ref.set(data, { merge: true });
    return { ...data, uid: user.uid, isAdmin };
  }

  function requireAuth(cb) {
    initFirebase();
    _auth.onAuthStateChanged(user => {
      if (!user) { window.location.href = '/login'; return; }
      saveUserProfile(user).then(profile => cb(user, profile));
    });
  }

  function requireAdmin(cb) {
    requireAuth((user, profile) => {
      if (!profile?.isAdmin) { window.location.href = '/app'; return; }
      cb(user, profile);
    });
  }

  function setupSidebarUser(user) {
    const av = document.getElementById('sb-avatar');
    const nm = document.getElementById('sb-name');
    const em = document.getElementById('sb-email');
    if (av) {
      if (user.photoURL) {
        av.innerHTML = `<img src="${user.photoURL}" alt="${user.displayName}">`;
      } else {
        av.textContent = (user.displayName || user.email || 'U')[0].toUpperCase();
      }
    }
    if (nm) nm.textContent = user.displayName || 'User';
    if (em) em.textContent = user.email || '';
  }

  function setupSignOut() {
    document.getElementById('btn-signout')?.addEventListener('click', () => signOut());
  }

  function setupNavItems() {
    document.querySelectorAll('[data-view]').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('[data-view]').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
        const target = document.getElementById('view-' + btn.dataset.view);
        if (target) target.classList.add('active');
      });
    });
  }

  function setupCursor() {
    const dot = document.getElementById('cur-dot');
    const ring = document.getElementById('cur-ring');
    if (!dot || !ring) return;
    let mx = 0, my = 0, rx = 0, ry = 0;
    document.addEventListener('mousemove', e => {
      mx = e.clientX; my = e.clientY;
      dot.style.left = mx + 'px'; dot.style.top = my + 'px';
    });
    (function loop() {
      rx += (mx - rx) * .13; ry += (my - ry) * .13;
      ring.style.left = rx + 'px'; ring.style.top = ry + 'px';
      requestAnimationFrame(loop);
    })();
    document.querySelectorAll('a,button').forEach(el => {
      el.addEventListener('mouseenter', () => { ring.style.width = '50px'; ring.style.height = '50px'; });
      el.addEventListener('mouseleave', () => { ring.style.width = '36px'; ring.style.height = '36px'; });
    });
  }

  return { initFirebase, signInWithGoogle, signOut, saveUserProfile, requireAuth, requireAdmin, setupSidebarUser, setupSignOut, setupNavItems, setupCursor };
})();
