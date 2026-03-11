// admin.js — Admin Dashboard Logic

let adminUser = null;
let allUsers = [];
let allSearches = [];
let allAnalytics = [];
let realtimeUnsubscribe = null;
let weeklyChart = null;
let trafficChart = null;

document.addEventListener('DOMContentLoaded', async () => {
  const { initFirebase, requireAdmin, getCurrentUserProfile } = GeoAuth;
  initFirebase();

  adminUser = await requireAdmin();

  // Load profile into sidebar
  const profile = await getCurrentUserProfile();
  if (profile) {
    document.getElementById('user-name').textContent  = profile.name  || 'Admin';
    document.getElementById('user-email').textContent = profile.email || '';
    const avatarEl = document.getElementById('user-avatar');
    if (profile.photo) avatarEl.innerHTML = `<img src="${profile.photo}" alt="avatar">`;
    else avatarEl.textContent = (profile.name || 'A').charAt(0).toUpperCase();
  }

  // Tab navigation
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      showTab(btn.dataset.tab);
    });
  });

  document.getElementById('btn-signout').addEventListener('click', () => GeoAuth.signOut());

  // Load all data
  showLoadingOverlay(true);
  await loadAllData();
  showLoadingOverlay(false);

  // Start realtime listeners
  setupRealtimeListeners();
});

// ── Data Loading ────────────────────────────────────────
async function loadAllData() {
  const db = GeoAuth.getDb();

  try {
    const [usersSnap, searchesSnap, analyticsSnap] = await Promise.all([
      db.collection('users').orderBy('createdAt', 'desc').get(),
      db.collection('searches').orderBy('timestamp', 'desc').limit(200).get(),
      db.collection('analytics').orderBy('timestamp', 'desc').limit(500).get()
    ]);

    allUsers    = usersSnap.docs.map(d    => ({ id: d.id,    ...d.data() }));
    allSearches = searchesSnap.docs.map(d => ({ id: d.id,    ...d.data() }));
    allAnalytics = analyticsSnap.docs.map(d => ({ id: d.id, ...d.data() }));

    renderDashboard();
    renderUsers();
    renderSearches();
    renderTraffic();
  } catch (err) {
    console.error('Failed to load admin data:', err);
    showToastAdmin('Failed to load data: ' + err.message, 'error');
  }
}

// ── Realtime Listener ───────────────────────────────────
function setupRealtimeListeners() {
  const db = GeoAuth.getDb();
  if (realtimeUnsubscribe) realtimeUnsubscribe();

  realtimeUnsubscribe = db.collection('searches')
    .orderBy('timestamp', 'desc')
    .limit(1)
    .onSnapshot(snap => {
      snap.docChanges().forEach(change => {
        if (change.type === 'added') {
          const newSearch = { id: change.doc.id, ...change.doc.data() };
          // Only add if not already in list
          if (!allSearches.find(s => s.id === newSearch.id)) {
            allSearches.unshift(newSearch);
            renderSearches();
            updateDashboardStats();
          }
        }
      });
    });
}

// ── Dashboard ───────────────────────────────────────────
function renderDashboard() {
  updateDashboardStats();
  renderWeeklyChart();
  renderCountryBreakdown();
  renderActivityFeed();
  renderTopUsers();
}

function updateDashboardStats() {
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const weekAgo = new Date(now - 7 * 24 * 60 * 60 * 1000);

  const todaySearches   = allSearches.filter(s => s.timestamp?.toDate?.() >= todayStart).length;
  const activeUsers     = new Set(allSearches.filter(s => s.timestamp?.toDate?.() >= weekAgo).map(s => s.uid)).size;
  const gpsHits         = allSearches.filter(s => s.exif?.hasGPS).length;
  const gpsRate         = allSearches.length ? Math.round((gpsHits / allSearches.length) * 100) : 0;
  const avgConf         = allSearches.length
    ? Math.round(allSearches.reduce((a, s) => a + (s.result?.confidence || 0), 0) / allSearches.length)
    : 0;

  setText('stat-total-users',    allUsers.length);
  setText('stat-total-searches', allSearches.length);
  setText('stat-today-searches', todaySearches);
  setText('stat-active-users',   activeUsers);
  setText('stat-gps-rate',       `${gpsRate}%`);
  setText('stat-avg-confidence', `${avgConf}%`);
}

function setText(id, val) {
  const el = document.getElementById(id);
  if (el) el.textContent = val;
}

function renderWeeklyChart() {
  const ctx = document.getElementById('weekly-chart');
  if (!ctx) return;

  const labels = [];
  const counts = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    labels.push(d.toLocaleDateString('en', { weekday: 'short' }));
    const dayStart = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    const dayEnd   = new Date(dayStart.getTime() + 86400000);
    counts.push(allSearches.filter(s => {
      const t = s.timestamp?.toDate?.();
      return t && t >= dayStart && t < dayEnd;
    }).length);
  }

  if (weeklyChart) weeklyChart.destroy();
  weeklyChart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        label: 'Searches',
        data: counts,
        backgroundColor: 'rgba(124,58,237,0.5)',
        borderColor: '#7c3aed',
        borderWidth: 2,
        borderRadius: 6
      }]
    },
    options: {
      responsive: true,
      plugins: { legend: { display: false } },
      scales: {
        y: { ticks: { color: '#475569' }, grid: { color: 'rgba(255,255,255,0.05)' } },
        x: { ticks: { color: '#475569' }, grid: { display: false } }
      }
    }
  });
}

function renderCountryBreakdown() {
  const counts = {};
  allSearches.forEach(s => {
    const c = s.result?.country;
    if (c) counts[c] = (counts[c] || 0) + 1;
  });

  const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 8);
  const max    = sorted[0]?.[1] || 1;

  const container = document.getElementById('country-breakdown');
  if (!container) return;
  container.innerHTML = sorted.map(([country, count]) => `
    <div class="country-bar-item">
      <span class="country-bar-name">${country}</span>
      <div class="country-bar-track">
        <div class="country-bar-fill" style="--bar-width:${Math.round((count/max)*100)}%"></div>
      </div>
      <span class="country-bar-count">${count}</span>
    </div>
  `).join('');
}

function renderActivityFeed() {
  const feed = document.getElementById('activity-feed');
  if (!feed) return;
  const recent = allAnalytics.slice(0, 20);

  feed.innerHTML = recent.map(ev => {
    const iconMap = { app_open: '🟢', analysis_complete: '🔍', login: '🔐', upload: '📤' };
    const icon = iconMap[ev.type] || '📝';
    const bgMap = { app_open: 'var(--green-subtle)', analysis_complete: 'var(--cyan-subtle)', login: 'var(--violet-subtle)' };
    const bg = bgMap[ev.type] || 'var(--glass-bg)';
    const ts = ev.timestamp?.toDate ? ev.timestamp.toDate() : new Date();
    return `
      <div class="activity-item">
        <div class="activity-icon" style="background:${bg}">${icon}</div>
        <div class="activity-text">
          <div class="activity-main">${formatEventType(ev.type)}</div>
          <div class="activity-time">${ts.toLocaleTimeString()}</div>
        </div>
      </div>
    `;
  }).join('');
}

function renderTopUsers() {
  const container = document.getElementById('top-users');
  if (!container) return;

  const sorted = [...allUsers].sort((a, b) => (b.searchCount || 0) - (a.searchCount || 0)).slice(0, 5);
  container.innerHTML = sorted.map((u, i) => `
    <div style="display:flex;align-items:center;gap:12px;padding:10px 0;border-bottom:var(--glass-border);">
      <span style="font-family:var(--font-mono);color:var(--text-muted);width:20px;">${i+1}</span>
      <div style="width:32px;height:32px;border-radius:50%;background:linear-gradient(135deg,var(--violet),var(--cyan));display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:700;">
        ${(u.name||'?').charAt(0).toUpperCase()}
      </div>
      <div style="flex:1;">
        <div style="font-size:13px;font-weight:500;">${u.name || 'Unknown'}</div>
        <div style="font-size:11px;color:var(--text-muted);">${u.email || ''}</div>
      </div>
      <span style="font-family:var(--font-mono);font-size:13px;color:var(--cyan);">${u.searchCount || 0}</span>
    </div>
  `).join('');
}

function formatEventType(type) {
  const map = {
    app_open: 'App opened',
    analysis_complete: 'Analysis completed',
    login: 'User logged in',
    upload: 'File uploaded'
  };
  return map[type] || type;
}

// ── Users Tab ───────────────────────────────────────────
function renderUsers(filter = '') {
  const filtered = filter
    ? allUsers.filter(u => (u.name||'').toLowerCase().includes(filter) || (u.email||'').toLowerCase().includes(filter))
    : allUsers;

  const tbody = document.getElementById('users-tbody');
  if (!tbody) return;

  tbody.innerHTML = filtered.map(u => {
    const joined   = u.createdAt?.toDate  ? u.createdAt.toDate().toLocaleDateString() : '—';
    const lastLogin = u.lastLogin?.toDate ? u.lastLogin.toDate().toLocaleDateString() : '—';
    const isActive = u.isActive !== false;

    return `<tr>
      <td>
        <div style="display:flex;align-items:center;gap:10px;">
          <div style="width:32px;height:32px;border-radius:50%;background:linear-gradient(135deg,var(--violet),var(--cyan));display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:700;flex-shrink:0;">
            ${(u.name||'?').charAt(0).toUpperCase()}
          </div>
          <span>${u.name || '—'}</span>
        </div>
      </td>
      <td>${u.email || '—'}</td>
      <td><span class="role-badge role-${u.role || 'user'}">${u.role || 'user'}</span></td>
      <td style="font-family:var(--font-mono)">${u.searchCount || 0}</td>
      <td>${joined}</td>
      <td>${lastLogin}</td>
      <td>
        <div style="display:flex;gap:6px;">
          <button class="btn-sm" onclick="toggleUser('${u.id}', ${isActive})">${isActive ? 'Disable' : 'Enable'}</button>
          <button class="btn-sm btn-sm-danger" onclick="deleteUser('${u.id}', '${u.uid || u.id}')">Delete</button>
        </div>
      </td>
    </tr>`;
  }).join('');
}

async function toggleUser(docId, isActive) {
  const db = GeoAuth.getDb();
  await db.collection('users').doc(docId).update({ isActive: !isActive });
  const idx = allUsers.findIndex(u => u.id === docId);
  if (idx !== -1) allUsers[idx].isActive = !isActive;
  renderUsers();
  showToastAdmin(`User ${!isActive ? 'enabled' : 'disabled'}.`, 'info');
}

async function deleteUser(docId, uid) {
  if (!confirm('Delete this user and all their searches?')) return;
  const db = GeoAuth.getDb();

  // Delete all searches
  const searchSnap = await db.collection('searches').where('uid', '==', uid).get();
  const batch = db.batch();
  searchSnap.docs.forEach(d => batch.delete(d.ref));
  batch.delete(db.collection('users').doc(docId));
  await batch.commit();

  allUsers = allUsers.filter(u => u.id !== docId);
  allSearches = allSearches.filter(s => s.uid !== uid);
  renderUsers();
  renderSearches();
  updateDashboardStats();
  showToastAdmin('User deleted.', 'success');
}

// ── Searches Tab ────────────────────────────────────────
function renderSearches(filterVal = '') {
  const filtered = filterVal
    ? allSearches.filter(s =>
        (s.fileName||'').toLowerCase().includes(filterVal) ||
        (s.result?.country||'').toLowerCase().includes(filterVal) ||
        (s.uid||'').toLowerCase().includes(filterVal)
      )
    : allSearches;

  const tbody = document.getElementById('searches-tbody');
  if (!tbody) return;

  tbody.innerHTML = filtered.slice(0, 100).map(s => {
    const ts  = s.timestamp?.toDate ? s.timestamp.toDate().toLocaleString() : '—';
    const loc = [s.result?.city, s.result?.country].filter(Boolean).join(', ') || '—';
    const user = allUsers.find(u => u.uid === s.uid || u.id === s.uid);

    return `<tr>
      <td style="font-family:var(--font-mono);font-size:12px;">${s.fileName || '—'}</td>
      <td style="font-size:12px;color:var(--text-muted);">${user?.email || s.uid?.slice(0,8) || '—'}</td>
      <td>${loc}</td>
      <td style="font-family:var(--font-mono);color:var(--green);">${s.result?.confidence || 0}%</td>
      <td>${s.exif?.hasGPS ? '<span class="gps-badge">🛰️ GPS</span>' : '—'}</td>
      <td style="font-size:12px;color:var(--text-muted);font-family:var(--font-mono);">${ts}</td>
      <td>
        <button class="btn-sm btn-sm-danger" onclick="deleteSearchAdmin('${s.id}')">Delete</button>
      </td>
    </tr>`;
  }).join('');
}

async function deleteSearchAdmin(id) {
  await GeoEngine.deleteSearch(id);
  allSearches = allSearches.filter(s => s.id !== id);
  renderSearches();
  updateDashboardStats();
  showToastAdmin('Search deleted.', 'info');
}

// ── Traffic Tab ─────────────────────────────────────────
function renderTraffic() {
  renderHourlyChart();
  renderEventBreakdown();
  renderMostActiveUsers();
}

function renderHourlyChart() {
  const ctx = document.getElementById('traffic-chart');
  if (!ctx) return;

  const hours = Array.from({length: 24}, (_, i) => i);
  const counts = hours.map(h => allAnalytics.filter(ev => {
    const t = ev.timestamp?.toDate?.();
    return t && t.getHours() === h;
  }).length);

  if (trafficChart) trafficChart.destroy();
  trafficChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels: hours.map(h => `${h}:00`),
      datasets: [{
        label: 'Events',
        data: counts,
        borderColor: '#06b6d4',
        backgroundColor: 'rgba(6,182,212,0.1)',
        fill: true,
        tension: 0.4,
        pointRadius: 3,
        pointBackgroundColor: '#06b6d4'
      }]
    },
    options: {
      responsive: true,
      plugins: { legend: { display: false } },
      scales: {
        y: { ticks: { color: '#475569' }, grid: { color: 'rgba(255,255,255,0.05)' } },
        x: { ticks: { color: '#475569', maxTicksLimit: 12 }, grid: { display: false } }
      }
    }
  });
}

function renderEventBreakdown() {
  const types = {};
  allAnalytics.forEach(ev => { types[ev.type] = (types[ev.type] || 0) + 1; });
  const container = document.getElementById('event-breakdown');
  if (!container) return;
  container.innerHTML = Object.entries(types).sort((a,b) => b[1]-a[1]).map(([type, count]) => `
    <div style="display:flex;justify-content:space-between;align-items:center;padding:8px 0;border-bottom:var(--glass-border);">
      <span style="font-size:13px;">${formatEventType(type)}</span>
      <span style="font-family:var(--font-mono);color:var(--cyan);">${count}</span>
    </div>
  `).join('');
}

function renderMostActiveUsers() {
  const counts = {};
  allAnalytics.forEach(ev => { if (ev.uid) counts[ev.uid] = (counts[ev.uid] || 0) + 1; });
  const sorted = Object.entries(counts).sort((a,b) => b[1]-a[1]).slice(0, 5);

  const container = document.getElementById('most-active-users');
  if (!container) return;
  container.innerHTML = sorted.map(([uid, count]) => {
    const user = allUsers.find(u => u.uid === uid || u.id === uid);
    return `
      <div style="display:flex;justify-content:space-between;align-items:center;padding:8px 0;border-bottom:var(--glass-border);">
        <span style="font-size:13px;">${user?.name || uid.slice(0,8)}</span>
        <span style="font-family:var(--font-mono);color:var(--violet-light);">${count} events</span>
      </div>
    `;
  }).join('');
}

// ── Tab Switching ───────────────────────────────────────
function showTab(name) {
  document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
  document.getElementById(`tab-${name}`)?.classList.add('active');
}

// ── Export ──────────────────────────────────────────────
function exportData(type) {
  const data   = type === 'users' ? allUsers : allSearches;
  const blob   = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url    = URL.createObjectURL(blob);
  const a      = document.createElement('a');
  a.href       = url;
  a.download   = `geotrace-${type}-${Date.now()}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

// ── Loading Overlay ─────────────────────────────────────
function showLoadingOverlay(visible) {
  const overlay = document.getElementById('loading-overlay');
  if (overlay) overlay.style.display = visible ? 'flex' : 'none';
}

// ── Toast ───────────────────────────────────────────────
function showToastAdmin(msg, type = 'info') {
  const existing = document.getElementById('admin-toast');
  if (existing) existing.remove();

  const toast = document.createElement('div');
  toast.id = 'admin-toast';
  toast.className = `toast toast-${type}`;
  const icons = { success: '✅', error: '❌', info: 'ℹ️' };
  toast.innerHTML = `<span>${icons[type] || 'ℹ️'}</span> ${msg}`;
  document.body.appendChild(toast);

  setTimeout(() => toast.remove(), 4000);
}

// ── Search/filter bindings ──────────────────────────────
window.addEventListener('DOMContentLoaded', () => {
  document.getElementById('user-filter')?.addEventListener('input', e => renderUsers(e.target.value.toLowerCase()));
  document.getElementById('search-filter')?.addEventListener('input', e => renderSearches(e.target.value.toLowerCase()));
});

window.toggleUser = toggleUser;
window.deleteUser = deleteUser;
window.deleteSearchAdmin = deleteSearchAdmin;
window.exportData = exportData;
