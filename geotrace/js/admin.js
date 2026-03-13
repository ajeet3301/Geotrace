/* ================================================================
   GEOTRACE — admin.js
   Admin dashboard: auth guard, user table, search table, charts
   ================================================================ */

import {
  auth, onAuthStateChanged,
  signInWithGoogle, signOutUser,
  isAdmin, getAllUsers, getAllSearches,
} from './firebase-config.js';

/* ── DOM refs ── */
const $ = (id) => document.getElementById(id);

const signInGate      = $('signInGate');
const accessDenied    = $('accessDenied');
const adminDashboard  = $('adminDashboard');
const adminSignInBtn  = $('adminSignInBtn');
const gateSignInBtn   = $('gateSignInBtn');
const adminSignOutBtn = $('adminSignOutBtn');
const adminUserInfo   = $('adminUserInfo');
const adminAvatar     = $('adminAvatar');
const adminUserName   = $('adminUserName');

const statUsers    = $('statUsers');
const statSearches = $('statSearches');
const statExifHits = $('statExifHits');
const statAIHits   = $('statAIHits');

const usersTableBody   = $('usersTableBody');
const searchesTableBody = $('searchesTableBody');
const userSearchInput  = $('userSearch');
const exportUsersBtn   = $('exportUsersBtn');
const exportSearchesBtn = $('exportSearchesBtn');
const refreshAllBtn    = $('refreshAllBtn');

const toast = (msg, type, dur) => window.GeoTrace?.toast(msg, type, dur);

let allUsers    = [];
let allSearches = [];
let sourceChart = null;
let timeChart   = null;

/* ================================================================
   AUTH GUARD
   ================================================================ */
onAuthStateChanged(auth, async (user) => {
  if (!user) {
    signInGate.style.display    = 'flex';
    accessDenied.style.display  = 'none';
    adminDashboard.style.display = 'none';
    adminUserInfo.style.display  = 'none';
    adminSignInBtn.style.display = 'inline-block';
    return;
  }

  // Show user in nav
  adminAvatar.src             = user.photoURL || '';
  adminUserName.textContent   = user.displayName || user.email;
  adminUserInfo.style.display = 'flex';
  adminSignInBtn.style.display = 'none';

  // Check admin role
  const admin = await isAdmin(user.uid);
  if (!admin) {
    signInGate.style.display    = 'none';
    accessDenied.style.display  = 'flex';
    adminDashboard.style.display = 'none';
    toast('Access denied — not an admin account', 'error');
    return;
  }

  // Show dashboard
  signInGate.style.display    = 'none';
  accessDenied.style.display  = 'none';
  adminDashboard.style.display = 'flex';
  toast('Welcome, Admin!', 'success', 2500);
  loadAllData();
});

/* ── Sign-in handlers ── */
[adminSignInBtn, gateSignInBtn].forEach((btn) => {
  btn.addEventListener('click', async () => {
    try { await signInWithGoogle(); }
    catch (e) { toast('Sign-in failed: ' + e.message, 'error'); }
  });
});

adminSignOutBtn.addEventListener('click', async () => {
  await signOutUser();
});

/* ================================================================
   LOAD DATA
   ================================================================ */
async function loadAllData() {
  await Promise.all([loadUsers(), loadSearches()]);
  renderCharts();
}

async function loadUsers() {
  usersTableBody.innerHTML = `<tr><td colspan="5"><div class="admin-loading"><div class="spinner"></div>Loading users...</div></td></tr>`;
  try {
    allUsers = await getAllUsers();
    statUsers.textContent = allUsers.length.toLocaleString();
    renderUsersTable(allUsers);
  } catch (err) {
    usersTableBody.innerHTML = `<tr><td colspan="5" style="color:var(--neon-red);padding:16px;">Failed to load users: ${err.message}</td></tr>`;
  }
}

async function loadSearches() {
  searchesTableBody.innerHTML = `<tr><td colspan="5"><div class="admin-loading"><div class="spinner"></div>Loading searches...</div></td></tr>`;
  try {
    allSearches = await getAllSearches(100);
    const exifHits = allSearches.filter((s) => s.source === 'exif').length;
    const aiHits   = allSearches.filter((s) => s.source === 'ai').length;
    statSearches.textContent = allSearches.length.toLocaleString();
    statExifHits.textContent = exifHits.toLocaleString();
    statAIHits.textContent   = aiHits.toLocaleString();
    renderSearchesTable(allSearches);
  } catch (err) {
    searchesTableBody.innerHTML = `<tr><td colspan="5" style="color:var(--neon-red);padding:16px;">Failed to load searches: ${err.message}</td></tr>`;
  }
}

refreshAllBtn.addEventListener('click', loadAllData);

/* ================================================================
   RENDER TABLES
   ================================================================ */
function renderUsersTable(users) {
  if (!users.length) {
    usersTableBody.innerHTML = `<tr><td colspan="5" style="color:var(--text-muted);padding:24px;text-align:center;">No users yet.</td></tr>`;
    return;
  }

  usersTableBody.innerHTML = users.map((u) => {
    const joined = u.createdAt?.toDate
      ? u.createdAt.toDate().toLocaleDateString()
      : '—';
    const roleClass = u.role === 'admin' ? 'role-admin' : 'role-user';
    return `
      <tr>
        <td>
          <div class="user-cell">
            ${u.photo ? `<img class="user-thumb" src="${escapeHtml(u.photo)}" alt="">` : '<div class="user-thumb" style="background:var(--bg-elevated);"></div>'}
            <span>${escapeHtml(u.name || 'Anonymous')}</span>
          </div>
        </td>
        <td style="color:var(--text-muted);">${escapeHtml(u.email || '—')}</td>
        <td><span class="role-badge ${roleClass}">${u.role?.toUpperCase() || 'USER'}</span></td>
        <td>${(u.searchCount || 0).toLocaleString()}</td>
        <td style="color:var(--text-muted);font-family:var(--font-mono);font-size:11px;">${joined}</td>
      </tr>
    `;
  }).join('');
}

function renderSearchesTable(searches) {
  if (!searches.length) {
    searchesTableBody.innerHTML = `<tr><td colspan="5" style="color:var(--text-muted);padding:24px;text-align:center;">No searches yet.</td></tr>`;
    return;
  }

  searchesTableBody.innerHTML = searches.map((s) => {
    const time = s.createdAt?.toDate
      ? s.createdAt.toDate().toLocaleString()
      : '—';
    const addr = s.address
      ? s.address.split(',').slice(0, 2).join(',')
      : (s.lat ? `${Number(s.lat).toFixed(4)}°N` : '—');
    const srcClass = `src-${s.source || 'none'}`;
    const conf = s.confidence ? Math.round(s.confidence) : null;
    return `
      <tr>
        <td style="max-width:180px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${escapeHtml(s.filename || 'image')}</td>
        <td style="max-width:220px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--text-secondary);">${escapeHtml(addr)}</td>
        <td><span class="${srcClass}">${(s.source || 'none').toUpperCase()}</span></td>
        <td>
          ${conf != null ? `
            <div class="conf-bar-wrap">
              <div class="conf-bar" style="width:${conf}px;max-width:80px;"></div>
              <span style="font-family:var(--font-mono);font-size:11px;">${conf}%</span>
            </div>
          ` : '<span style="color:var(--text-muted);">—</span>'}
        </td>
        <td style="color:var(--text-muted);font-family:var(--font-mono);font-size:11px;white-space:nowrap;">${time}</td>
      </tr>
    `;
  }).join('');
}

/* ================================================================
   USER SEARCH FILTER
   ================================================================ */
userSearchInput.addEventListener('input', () => {
  const q = userSearchInput.value.toLowerCase();
  const filtered = allUsers.filter((u) =>
    (u.name  || '').toLowerCase().includes(q) ||
    (u.email || '').toLowerCase().includes(q)
  );
  renderUsersTable(filtered);
});

/* ================================================================
   CHARTS
   ================================================================ */
Chart.defaults.color = 'rgba(240,244,255,0.5)';
Chart.defaults.borderColor = 'rgba(255,255,255,0.06)';

function renderCharts() {
  renderSourceChart();
  renderTimeChart();
}

function renderSourceChart() {
  const exif = allSearches.filter((s) => s.source === 'exif').length;
  const ai   = allSearches.filter((s) => s.source === 'ai').length;
  const none = allSearches.filter((s) => !s.source || s.source === 'none').length;

  if (sourceChart) sourceChart.destroy();

  const ctx = document.getElementById('sourceChart').getContext('2d');
  sourceChart = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: ['EXIF GPS', 'AI Vision', 'No Result'],
      datasets: [{
        data: [exif, ai, none],
        backgroundColor: [
          'rgba(52,211,153,0.7)',
          'rgba(6,182,212,0.7)',
          'rgba(248,113,113,0.7)',
        ],
        borderColor: [
          'rgba(52,211,153,1)',
          'rgba(6,182,212,1)',
          'rgba(248,113,113,1)',
        ],
        borderWidth: 1,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'bottom',
          labels: { padding: 16, font: { family: "'JetBrains Mono'", size: 11 } },
        },
      },
    },
  });
}

function renderTimeChart() {
  // Group searches by day (last 14 days)
  const days = {};
  const now  = new Date();
  for (let i = 13; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    const key = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    days[key] = 0;
  }

  allSearches.forEach((s) => {
    try {
      const d = s.createdAt?.toDate ? s.createdAt.toDate() : new Date(s.createdAt);
      const key = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      if (days[key] !== undefined) days[key]++;
    } catch {}
  });

  if (timeChart) timeChart.destroy();

  const ctx = document.getElementById('timeChart').getContext('2d');
  timeChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels: Object.keys(days),
      datasets: [{
        label: 'Searches',
        data:  Object.values(days),
        borderColor: 'rgba(6,182,212,0.8)',
        backgroundColor: 'rgba(6,182,212,0.08)',
        borderWidth: 2,
        fill: true,
        tension: 0.4,
        pointBackgroundColor: 'rgba(6,182,212,1)',
        pointRadius: 4,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: {
          grid: { color: 'rgba(255,255,255,0.04)' },
          ticks: { font: { family: "'JetBrains Mono'", size: 10 } },
        },
        y: {
          beginAtZero: true,
          grid: { color: 'rgba(255,255,255,0.04)' },
          ticks: { stepSize: 1, font: { family: "'JetBrains Mono'", size: 10 } },
        },
      },
    },
  });
}

/* ================================================================
   EXPORT
   ================================================================ */
exportUsersBtn.addEventListener('click', () => {
  downloadJSON(allUsers, 'geotrace-users.json');
  toast('Users exported!', 'success');
});

exportSearchesBtn.addEventListener('click', () => {
  downloadJSON(allSearches, 'geotrace-searches.json');
  toast('Searches exported!', 'success');
});

function downloadJSON(data, filename) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url  = URL.createObjectURL(blob);
  const a    = Object.assign(document.createElement('a'), { href: url, download: filename });
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/* ── Escape HTML ── */
function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
