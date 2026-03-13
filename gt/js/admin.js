GT_Auth.initFirebase();

GT_Auth.requireAdmin(async (user, profile) => {
  GT_Auth.setupSidebarUser(user);
  GT_Auth.setupSignOut();
  GT_Auth.setupNavItems();
  GT_Auth.setupCursor();
  new ParticleSystem('pc', { count: 30 });

  document.querySelectorAll('[data-view]').forEach(btn => {
    btn.addEventListener('click', () => {
      if (btn.dataset.view === 'users')    loadUsers();
      if (btn.dataset.view === 'searches') loadSearches();
    });
  });

  loadStats();
});

const db = () => window._db;

async function loadStats() {
  try {
    const [usersSnap, searchSnap] = await Promise.all([
      db().collection('users').get(),
      db().collection('searches').get()
    ]);

    document.getElementById('stat-users').textContent = usersSnap.size;
    document.getElementById('stat-searches').textContent = searchSnap.size;

    const today = new Date(); today.setHours(0,0,0,0);
    const todayCount = searchSnap.docs.filter(d => {
      const ts = d.data().createdAt?.toDate?.();
      return ts && ts >= today;
    }).length;
    document.getElementById('stat-today').textContent = todayCount;

    const confs = searchSnap.docs.map(d => d.data().confidence || 0).filter(Boolean);
    const avg = confs.length ? (confs.reduce((a,b) => a+b, 0) / confs.length).toFixed(1) : '—';
    document.getElementById('stat-conf').textContent = avg + (confs.length ? '%' : '');
  } catch (e) {
    console.error('loadStats', e);
  }
}

async function loadUsers() {
  const tbody = document.getElementById('users-tbody');
  tbody.innerHTML = '<tr><td colspan="5"><div class="loading"><div class="ld"></div><div class="ld"></div></div></td></tr>';
  try {
    const snap = await db().collection('users').orderBy('lastLogin','desc').limit(100).get();
    if (!snap.size) { tbody.innerHTML = '<tr><td colspan="5" style="color:var(--muted)">No users found</td></tr>'; return; }

    const userIds = snap.docs.map(d => d.id);
    const countsMap = {};
    for (const uid of userIds) {
      const s = await db().collection('searches').where('userId','==',uid).get();
      countsMap[uid] = s.size;
    }

    tbody.innerHTML = snap.docs.map(d => {
      const u = d.data();
      return `<tr>
        <td>${esc(u.name || '—')}</td>
        <td style="font-family:var(--mono);font-size:11px">${esc(u.email || '—')}</td>
        <td><span class="role-badge role-${u.role || 'user'}">${u.role || 'user'}</span></td>
        <td style="font-family:var(--mono)">${countsMap[d.id] || 0}</td>
        <td style="font-size:12px;color:var(--muted)">${u.lastLogin?.toDate ? u.lastLogin.toDate().toLocaleDateString() : '—'}</td>
      </tr>`;
    }).join('');
  } catch (e) {
    tbody.innerHTML = `<tr><td colspan="5" style="color:#fca5a5">${e.message}</td></tr>`;
  }
}

async function loadSearches() {
  const tbody = document.getElementById('searches-tbody');
  tbody.innerHTML = '<tr><td colspan="5"><div class="loading"><div class="ld"></div><div class="ld"></div></div></td></tr>';
  try {
    const snap = await db().collection('searches').orderBy('createdAt','desc').limit(100).get();
    if (!snap.size) { tbody.innerHTML = '<tr><td colspan="5" style="color:var(--muted)">No searches yet</td></tr>'; return; }
    tbody.innerHTML = snap.docs.map(d => {
      const s = d.data();
      return `<tr>
        <td style="font-size:12px">${esc(s.fileName || '—')}</td>
        <td style="font-family:var(--mono);font-size:11px;color:var(--c2)">${esc(s.location || '—')}</td>
        <td><span class="conf-badge">${s.confidence || 0}%</span></td>
        <td><span class="ai-method" style="font-size:9px">${esc(s.method || '—')}</span></td>
        <td style="font-size:12px;color:var(--muted)">${s.createdAt?.toDate ? s.createdAt.toDate().toLocaleDateString() : '—'}</td>
      </tr>`;
    }).join('');
  } catch (e) {
    tbody.innerHTML = `<tr><td colspan="5" style="color:#fca5a5">${e.message}</td></tr>`;
  }
}

function esc(s) {
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}
