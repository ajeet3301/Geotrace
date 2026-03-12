// ============================================================
//  GeoTrace — Admin Panel Logic (admin.js)
//  Access: Admin emails only (defined in config.js)
// ============================================================

let adminUser   = null;
let allUsers    = [];
let allSearches = [];
let allEvents   = [];
let charts      = {};

// ── Initialize admin panel ────────────────────────────────────
window.addEventListener('DOMContentLoaded', async () => {
  initFirebase();
  adminUser = await requireAdmin();
  renderAdminHeader(adminUser);
  await loadAllData();
  setupRealtimeListeners();
  showTab('dashboard');
});

// ── Render header ─────────────────────────────────────────────
function renderAdminHeader(user) {
  const el = document.getElementById('admin-user');
  if (el) el.innerHTML = `
    <img src="${user.photoURL || ''}" class="avatar" onerror="this.style.display='none'">
    <span>${user.displayName || user.email}</span>
    <span class="badge-admin">ADMIN</span>
  `;
}

// ── Load all data from Firestore ──────────────────────────────
async function loadAllData() {
  setAdminLoading(true);
  try {
    await Promise.all([loadUsers(), loadSearches(), loadAnalytics()]);
    renderDashboard();
  } catch(e) {
    console.error('Load error:', e);
    showAdminToast('Error loading data: ' + e.message, 'error');
  }
  setAdminLoading(false);
}

async function loadUsers() {
  const snap = await db.collection('users').orderBy('createdAt', 'desc').get();
  allUsers = snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

async function loadSearches() {
  const snap = await db.collection('searches').orderBy('timestamp', 'desc').limit(500).get();
  allSearches = snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

async function loadAnalytics() {
  const snap = await db.collection('analytics').orderBy('timestamp', 'desc').limit(1000).get();
  allEvents = snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

// ── Realtime listener for new searches ────────────────────────
function setupRealtimeListeners() {
  db.collection('searches').orderBy('timestamp', 'desc').limit(1)
    .onSnapshot(snap => {
      snap.docChanges().forEach(change => {
        if (change.type === 'added') {
          const doc = { id: change.doc.id, ...change.doc.data() };
          const exists = allSearches.find(s => s.id === doc.id);
          if (!exists) {
            allSearches.unshift(doc);
            updateLiveCounter();
            if (document.getElementById('tab-searches').classList.contains('active')) {
              renderSearches();
            }
          }
        }
      });
    });
}

function updateLiveCounter() {
  const el = document.getElementById('live-count');
  if (el) {
    el.textContent = allSearches.length;
    el.classList.add('pulse');
    setTimeout(() => el.classList.remove('pulse'), 1000);
  }
}

// ── Dashboard stats ───────────────────────────────────────────
function renderDashboard() {
  // Stat cards
  const today   = new Date(); today.setHours(0,0,0,0);
  const todaySearches = allSearches.filter(s => s.timestamp?.toDate?.() >= today).length;
  const activeUsers   = allUsers.filter(u => u.lastSearch?.toDate?.() >= new Date(Date.now() - 7*86400000)).length;
  const gpsHits       = allSearches.filter(s => s.exif?.hasGPS).length;
  const avgConf       = allSearches.length
    ? Math.round(allSearches.reduce((a,s) => a + (s.result?.confidence||0), 0) / allSearches.length)
    : 0;

  setStatCard('stat-users',    allUsers.length,    'Total Users');
  setStatCard('stat-searches', allSearches.length, 'Total Searches');
  setStatCard('stat-today',    todaySearches,       'Searches Today');
  setStatCard('stat-active',   activeUsers,         'Active (7d)');
  setStatCard('stat-gps',      gpsHits,             'GPS Hits');
  setStatCard('stat-conf',     avgConf + '%',       'Avg Confidence');

  // Country breakdown
  renderCountryBreakdown();

  // Recent activity
  renderRecentActivity();

  // Search trend chart
  renderTrendChart();
}

function setStatCard(id, value, label) {
  const el = document.getElementById(id);
  if (el) el.innerHTML = `<div class="stat-number">${value}</div><div class="stat-label">${label}</div>`;
}

function renderCountryBreakdown() {
  const counts = {};
  allSearches.forEach(s => {
    const c = s.result?.country || 'Unknown';
    counts[c] = (counts[c] || 0) + 1;
  });
  const sorted = Object.entries(counts).sort((a,b) => b[1]-a[1]).slice(0, 8);
  const total  = allSearches.length || 1;
  const el = document.getElementById('country-breakdown');
  if (!el) return;
  el.innerHTML = sorted.map(([c,n]) => `
    <div class="breakdown-row">
      <span class="breakdown-label">${c}</span>
      <div class="breakdown-bar-wrap">
        <div class="breakdown-bar" style="width:${(n/total*100).toFixed(1)}%"></div>
      </div>
      <span class="breakdown-num">${n}</span>
    </div>
  `).join('') || '<p class="empty-state">No data yet</p>';
}

function renderRecentActivity() {
  const el = document.getElementById('recent-activity');
  if (!el) return;
  const recent = allEvents.slice(0, 15);
  el.innerHTML = recent.map(ev => {
    const d = ev.timestamp?.toDate?.() || new Date();
    const user = allUsers.find(u => u.uid === ev.uid);
    return `
    <div class="activity-row">
      <span class="activity-type activity-${ev.type}">${ev.type}</span>
      <span class="activity-user">${user?.name || user?.email || ev.uid?.slice(0,8) || '—'}</span>
      <span class="activity-time">${timeAgo(d)}</span>
    </div>`;
  }).join('') || '<p class="empty-state">No activity yet</p>';
}

function renderTrendChart() {
  // Last 7 days search counts
  const days = Array.from({length:7}, (_, i) => {
    const d = new Date(); d.setDate(d.getDate() - (6-i)); d.setHours(0,0,0,0);
    return d;
  });
  const counts = days.map(day => {
    const next = new Date(day); next.setDate(next.getDate()+1);
    return allSearches.filter(s => {
      const t = s.timestamp?.toDate?.();
      return t && t >= day && t < next;
    }).length;
  });
  const labels = days.map(d => d.toLocaleDateString('en',{weekday:'short'}));

  const ctx = document.getElementById('trend-chart');
  if (!ctx) return;
  if (charts.trend) charts.trend.destroy();
  charts.trend = new Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        label: 'Searches',
        data: counts,
        backgroundColor: 'rgba(0,255,135,0.3)',
        borderColor: '#00ff87',
        borderWidth: 2,
        borderRadius: 4
      }]
    },
    options: {
      responsive: true,
      plugins: { legend: { display: false } },
      scales: {
        x: { ticks: { color: '#6b6b85' }, grid: { color: 'rgba(255,255,255,0.05)' } },
        y: { ticks: { color: '#6b6b85', stepSize: 1 }, grid: { color: 'rgba(255,255,255,0.05)' } }
      }
    }
  });
}

// ── Users tab ─────────────────────────────────────────────────
function renderUsers(filter = '') {
  const list = filter
    ? allUsers.filter(u => u.name?.toLowerCase().includes(filter) || u.email?.toLowerCase().includes(filter))
    : allUsers;

  document.getElementById('user-count-display').textContent = list.length + ' users';

  const table = document.getElementById('users-table-body');
  if (!table) return;
  table.innerHTML = list.map(u => {
    const joined  = u.createdAt?.toDate?.()?.toLocaleDateString() || '—';
    const lastLog  = u.lastLogin?.toDate?.()?.toLocaleDateString() || '—';
    const searches = allSearches.filter(s => s.uid === u.uid).length;
    return `
    <tr class="${u.isActive === false ? 'row-disabled' : ''}">
      <td>
        <div class="user-cell">
          <img src="${u.photo || ''}" class="avatar-sm" onerror="this.style.display='none'">
          <span>${u.name || '—'}</span>
        </div>
      </td>
      <td class="mono-sm">${u.email}</td>
      <td><span class="badge-role badge-${u.role}">${u.role || 'user'}</span></td>
      <td>${searches}</td>
      <td>${joined}</td>
      <td>${lastLog}</td>
      <td>
        <div class="action-btns">
          <button class="btn-sm btn-ghost" onclick="viewUserSearches('${u.uid}','${u.name||u.email}')">View</button>
          ${u.isActive !== false
            ? `<button class="btn-sm btn-warn" onclick="toggleUser('${u.id}', false)">Disable</button>`
            : `<button class="btn-sm btn-success" onclick="toggleUser('${u.id}', true)">Enable</button>`}
          <button class="btn-sm btn-danger" onclick="deleteUser('${u.id}','${u.uid}')">Delete</button>
        </div>
      </td>
    </tr>`;
  }).join('') || `<tr><td colspan="7" class="empty-td">No users found</td></tr>`;
}

async function toggleUser(docId, isActive) {
  await db.collection('users').doc(docId).update({ isActive });
  await loadUsers();
  renderUsers();
  showAdminToast(isActive ? 'User enabled' : 'User disabled', 'success');
}

async function deleteUser(docId, uid) {
  if (!confirm('Delete this user and all their data? This cannot be undone.')) return;
  // Delete user searches
  const snap = await db.collection('searches').where('uid','==',uid).get();
  const batch = db.batch();
  snap.docs.forEach(d => batch.delete(d.ref));
  await batch.commit();
  // Delete user record
  await db.collection('users').doc(docId).delete();
  allUsers    = allUsers.filter(u => u.id !== docId);
  allSearches = allSearches.filter(s => s.uid !== uid);
  renderUsers();
  renderDashboard();
  showAdminToast('User deleted', 'success');
}

function viewUserSearches(uid, name) {
  showTab('searches');
  document.getElementById('search-filter').value = name;
  renderSearches(uid);
}

// ── Searches tab ──────────────────────────────────────────────
function renderSearches(filterUid = null) {
  const filterText = document.getElementById('search-filter')?.value?.toLowerCase() || '';
  let list = filterUid
    ? allSearches.filter(s => s.uid === filterUid)
    : allSearches;

  if (filterText && !filterUid) {
    list = list.filter(s => {
      const u = allUsers.find(u => u.uid === s.uid);
      return s.fileName?.toLowerCase().includes(filterText)
        || s.result?.country?.toLowerCase().includes(filterText)
        || u?.name?.toLowerCase().includes(filterText)
        || u?.email?.toLowerCase().includes(filterText);
    });
  }

  document.getElementById('search-count-display').textContent = list.length + ' searches';
  const table = document.getElementById('searches-table-body');
  if (!table) return;

  table.innerHTML = list.slice(0, 200).map(s => {
    const user = allUsers.find(u => u.uid === s.uid);
    const date = s.timestamp?.toDate?.()?.toLocaleString() || '—';
    const loc  = [s.result?.city, s.result?.country].filter(Boolean).join(', ') || '—';
    return `
    <tr>
      <td class="mono-sm">${s.fileName || '—'}</td>
      <td class="mono-sm">${user?.email || s.uid?.slice(0,10) || '—'}</td>
      <td>${loc}</td>
      <td>${s.result?.confidence ? s.result.confidence + '%' : '—'}</td>
      <td>${s.exif?.hasGPS ? '<span class="badge-gps">GPS</span>' : '—'}</td>
      <td class="mono-sm">${date}</td>
      <td>
        <button class="btn-sm btn-danger" onclick="adminDeleteSearch('${s.id}')">🗑</button>
      </td>
    </tr>`;
  }).join('') || `<tr><td colspan="7" class="empty-td">No searches found</td></tr>`;
}

async function adminDeleteSearch(id) {
  if (!confirm('Delete this search record?')) return;
  await deleteSearch(id);
  allSearches = allSearches.filter(s => s.id !== id);
  renderSearches();
  showAdminToast('Search deleted', 'success');
}

// ── Traffic / Analytics tab ───────────────────────────────────
function renderTraffic() {
  // Event type breakdown
  const types = {};
  allEvents.forEach(e => { types[e.type] = (types[e.type]||0) + 1; });

  const breakdown = document.getElementById('event-breakdown');
  if (breakdown) {
    breakdown.innerHTML = Object.entries(types).sort((a,b)=>b[1]-a[1]).map(([t,n])=>`
      <div class="breakdown-row">
        <span class="activity-type activity-${t}">${t}</span>
        <span class="breakdown-num">${n}</span>
      </div>`).join('') || '<p class="empty-state">No events</p>';
  }

  // Hourly distribution chart
  const hourCounts = Array(24).fill(0);
  allEvents.forEach(e => {
    const h = e.timestamp?.toDate?.()?.getHours();
    if (h !== undefined) hourCounts[h]++;
  });
  const hourCtx = document.getElementById('hourly-chart');
  if (hourCtx) {
    if (charts.hourly) charts.hourly.destroy();
    charts.hourly = new Chart(hourCtx, {
      type: 'line',
      data: {
        labels: Array.from({length:24}, (_,i) => i + ':00'),
        datasets: [{
          label: 'Events by Hour',
          data: hourCounts,
          borderColor: '#00c4ff',
          backgroundColor: 'rgba(0,196,255,0.1)',
          fill: true,
          tension: 0.4,
          pointRadius: 3
        }]
      },
      options: {
        responsive: true,
        plugins: { legend: { display: false } },
        scales: {
          x: { ticks: { color:'#6b6b85', maxTicksLimit: 8 }, grid: { color:'rgba(255,255,255,0.05)' } },
          y: { ticks: { color:'#6b6b85' }, grid: { color:'rgba(255,255,255,0.05)' } }
        }
      }
    });
  }

  // Top users by searches
  const userSearchCounts = {};
  allSearches.forEach(s => { userSearchCounts[s.uid] = (userSearchCounts[s.uid]||0) + 1; });
  const topUsers = Object.entries(userSearchCounts).sort((a,b)=>b[1]-a[1]).slice(0,5);
  const topEl = document.getElementById('top-users');
  if (topEl) {
    topEl.innerHTML = topUsers.map(([uid, cnt]) => {
      const u = allUsers.find(u => u.uid === uid);
      return `<div class="breakdown-row">
        <span>${u?.name || u?.email || uid.slice(0,10)}</span>
        <span class="breakdown-num">${cnt}</span>
      </div>`;
    }).join('') || '<p class="empty-state">No data</p>';
  }
}

// ── Tab switcher ──────────────────────────────────────────────
function showTab(name) {
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
  document.getElementById('tab-' + name)?.classList.add('active');
  document.querySelector(`[data-tab="${name}"]`)?.classList.add('active');

  if (name === 'users')    renderUsers();
  if (name === 'searches') renderSearches();
  if (name === 'traffic')  renderTraffic();
  if (name === 'dashboard') renderDashboard();
}

// ── Export all data as JSON ───────────────────────────────────
function exportData(type) {
  let data, filename;
  if (type === 'users')    { data = allUsers;    filename = 'users.json'; }
  if (type === 'searches') { data = allSearches; filename = 'searches.json'; }
  if (type === 'analytics'){ data = allEvents;   filename = 'analytics.json'; }

  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'geotrace_' + filename;
  a.click();
}

// ── Helpers ───────────────────────────────────────────────────
function timeAgo(date) {
  const s = Math.floor((Date.now() - date) / 1000);
  if (s < 60)    return s + 's ago';
  if (s < 3600)  return Math.floor(s/60)  + 'm ago';
  if (s < 86400) return Math.floor(s/3600) + 'h ago';
  return Math.floor(s/86400) + 'd ago';
}

function setAdminLoading(show) {
  const el = document.getElementById('admin-loading');
  if (el) el.style.display = show ? 'flex' : 'none';
}

function showAdminToast(msg, type = 'info') {
  const t = document.createElement('div');
  t.className = `toast toast-${type}`;
  t.textContent = msg;
  document.body.appendChild(t);
  setTimeout(() => t.classList.add('show'), 10);
  setTimeout(() => { t.classList.remove('show'); setTimeout(() => t.remove(), 300); }, 3000);
}

// Expose to HTML
window.showTab         = showTab;
window.signOut         = signOut;
window.renderUsers     = renderUsers;
window.renderSearches  = renderSearches;
window.toggleUser      = toggleUser;
window.deleteUser      = deleteUser;
window.viewUserSearches= viewUserSearches;
window.adminDeleteSearch = adminDeleteSearch;
window.exportData      = exportData;
window.loadAllData     = loadAllData;
