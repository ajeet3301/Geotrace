GT_Auth.initFirebase();

let currentUser, watchId, isTracking = false;
let liveMap, myMarker, myPath, heatLayer, otherMarkers = {}, pathPoints = [];
let speedChart, speedData = [], pollInterval;

const BASE = '/api/socket';
const toast = (msg, type='info') => {
  let wrap = document.querySelector('.toast-wrap');
  if (!wrap) { wrap = document.createElement('div'); wrap.className='toast-wrap'; document.body.appendChild(wrap); }
  const t = document.createElement('div'); t.className=`toast toast-${type}`; t.textContent=msg;
  wrap.appendChild(t); setTimeout(()=>t.remove(),4000);
};

GT_Auth.requireAuth(async (user) => {
  currentUser = user;
  GT_Auth.setupSidebarUser(user);
  GT_Auth.setupSignOut();
  GT_Auth.setupNavItems();
  GT_Auth.setupCursor();
  new ParticleSystem('pc', { count: 35, color: '#10b981' });

  initMap();
  loadHistory();
  loadGeofences();

  document.getElementById('btn-toggle-track').addEventListener('click', toggleTracking);
  document.getElementById('btn-center-me').addEventListener('click', centerOnMe);
  document.getElementById('btn-toggle-path').addEventListener('click', () => {
    const btn = document.getElementById('btn-toggle-path');
    btn.classList.toggle('active');
    if (myPath) myPath.setStyle({ opacity: btn.classList.contains('active') ? 1 : 0 });
  });
  document.getElementById('btn-show-heatmap').addEventListener('click', toggleHeatmap);
  document.getElementById('btn-play-route').addEventListener('click', playRoute);
  document.getElementById('btn-stop-play').addEventListener('click', stopPlay);
  document.getElementById('btn-clear-history').addEventListener('click', clearHistory);
  document.getElementById('btn-load-analytics').addEventListener('click', loadAnalytics);
  document.getElementById('btn-add-fence').addEventListener('click', addGeofence);

  document.querySelectorAll('[data-view]').forEach(btn => {
    btn.addEventListener('click', () => {
      if (btn.dataset.view === 'analytics') loadAnalytics();
      if (btn.dataset.view === 'geofences') loadGeofences();
    });
  });

  pollOtherUsers();
  pollInterval = setInterval(pollOtherUsers, 5000);
});

/* ── MAP ── */
function initMap() {
  liveMap = L.map('live-map', { zoomControl: true }).setView([20, 0], 2);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© OpenStreetMap', maxZoom: 19
  }).addTo(liveMap);
  myPath = L.polyline([], { color: '#10b981', weight: 3, opacity: 1 }).addTo(liveMap);
}

/* ── TRACKING ── */
function toggleTracking() {
  isTracking ? stopTracking() : startTracking();
}

function startTracking() {
  if (!navigator.geolocation) { toast('Geolocation not supported', 'error'); return; }
  isTracking = true;
  setStatus(true, 'Acquiring GPS…');
  document.getElementById('btn-toggle-track').textContent = '⏹ Stop Tracking';
  document.getElementById('btn-toggle-track').style.color = '#fca5a5';

  watchId = navigator.geolocation.watchPosition(onPosition, onGeoError, {
    enableHighAccuracy: true, timeout: 15000, maximumAge: 0
  });
}

function stopTracking() {
  if (watchId != null) { navigator.geolocation.clearWatch(watchId); watchId = null; }
  isTracking = false;
  setStatus(false, 'Tracking stopped');
  document.getElementById('btn-toggle-track').textContent = '▶ Start Tracking';
  document.getElementById('btn-toggle-track').style.color = '';
}

async function onPosition(pos) {
  const { latitude: lat, longitude: lon, speed, heading, accuracy } = pos.coords;
  const kmh = speed != null ? (speed * 3.6) : 0;

  setStatus(true, `GPS active — accuracy ±${Math.round(accuracy)}m`);
  document.getElementById('live-coords').textContent =
    `${lat.toFixed(5)}, ${lon.toFixed(5)} • ${kmh.toFixed(1)} km/h`;

  pathPoints.push([lat, lon]);
  myPath.setLatLngs(pathPoints);
  document.getElementById('history-point-count').textContent = pathPoints.length + ' points';

  if (!myMarker) {
    myMarker = L.circleMarker([lat, lon], {
      radius: 10, color: '#10b981', fillColor: '#6ee7b7', fillOpacity: .9, weight: 2
    }).addTo(liveMap).bindPopup('You');
  } else {
    myMarker.setLatLng([lat, lon]);
  }

  speedData.push({ t: Date.now(), v: kmh });
  if (speedData.length > 60) speedData.shift();
  updateSpeedChart();

  reverseGeocodeDisplay(lat, lon);

  try {
    const resp = await fetch(BASE + '/location', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId: currentUser.uid,
        name:   currentUser.displayName,
        color:  '#10b981',
        lat, lon,
        speed: kmh, heading: heading || 0, accuracy
      })
    });
    const data = await resp.json();
    if (data.alerts?.length) {
      data.alerts.forEach(a => showFenceAlert(a));
    }
  } catch (e) { console.warn('POST location', e); }
}

function onGeoError(e) {
  setStatus(false, 'GPS error: ' + e.message);
  toast('GPS error: ' + e.message, 'error');
}

function setStatus(active, text) {
  document.getElementById('status-dot').className = 'status-dot' + (active ? ' active' : '');
  document.getElementById('status-text').textContent = text;
}

function centerOnMe() {
  if (myMarker) liveMap.setView(myMarker.getLatLng(), 16);
}

/* ── REVERSE GEOCODE (debounced) ── */
let lastGeo = 0;
async function reverseGeocodeDisplay(lat, lon) {
  if (Date.now() - lastGeo < 10000) return;
  lastGeo = Date.now();
  try {
    const r = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json`, { headers: { 'Accept-Language': 'en' }});
    const d = await r.json();
    document.getElementById('live-address').textContent = d.display_name || '';
  } catch {}
}

/* ── POLL OTHER USERS ── */
async function pollOtherUsers() {
  try {
    const r = await fetch(BASE + '/location/live');
    const { users = [] } = await r.json();
    const onlineEl = document.getElementById('online-count');
    if (onlineEl) onlineEl.textContent = users.length;

    const panel = document.getElementById('users-panel-list');
    if (!users.length) { if (panel) panel.innerHTML = '<div style="color:var(--muted);font-size:12px">No other users online</div>'; return; }
    if (panel) panel.innerHTML = users.map(u => `
      <div class="user-row">
        <div class="user-dot" style="background:${u.color||'#10b981'}"></div>
        <div class="user-name">${esc(u.name||'User')}</div>
        <div class="user-speed">${(u.lastLocation?.speed||0).toFixed(0)} km/h</div>
      </div>`).join('');

    users.filter(u => u.userId !== currentUser?.uid).forEach(u => {
      const ll = [u.lastLocation.lat, u.lastLocation.lon];
      if (otherMarkers[u.userId]) {
        otherMarkers[u.userId].setLatLng(ll);
      } else {
        otherMarkers[u.userId] = L.circleMarker(ll, {
          radius: 8, color: u.color || '#06b6d4', fillColor: u.color || '#67e8f9',
          fillOpacity: .8, weight: 2
        }).addTo(liveMap).bindPopup(u.name || 'User');
      }
    });
  } catch {}
}

/* ── HEATMAP ── */
async function toggleHeatmap() {
  const btn = document.getElementById('btn-show-heatmap');
  if (heatLayer) { liveMap.removeLayer(heatLayer); heatLayer = null; btn.classList.remove('active'); return; }
  try {
    const r = await fetch(BASE + '/heatmap?userId=' + currentUser.uid);
    const { points = [] } = await r.json();
    if (!points.length) { toast('No heatmap data yet', 'info'); return; }
    const lls = points.map(p => [p.lat, p.lon, p.weight / 100]);
    if (L.heatLayer) {
      heatLayer = L.heatLayer(lls, { radius: 25, blur: 15, maxZoom: 17 }).addTo(liveMap);
      btn.classList.add('active');
    } else {
      toast('Heatmap plugin not loaded', 'error');
    }
  } catch (e) { toast('Heatmap error: ' + e.message, 'error'); }
}

/* ── HISTORY / ROUTE PLAYBACK ── */
async function loadHistory() {
  try {
    const r = await fetch(BASE + '/location/history?userId=' + currentUser.uid);
    const { points = [] } = await r.json();
    pathPoints = points.map(p => [p.lat, p.lon]);
    if (myPath) myPath.setLatLngs(pathPoints);
    document.getElementById('history-point-count').textContent = pathPoints.length + ' points';
  } catch {}
}

let playAnimFrame;
function playRoute() {
  if (pathPoints.length < 2) { toast('Not enough route data', 'info'); return; }
  let i = 0, line = L.polyline([], { color: '#fbbf24', weight: 3 }).addTo(liveMap);
  const marker = L.circleMarker(pathPoints[0], { radius: 9, color: '#fbbf24', fillColor: '#fef3c7', fillOpacity: 1 }).addTo(liveMap);
  function step() {
    if (i >= pathPoints.length) { liveMap.removeLayer(line); liveMap.removeLayer(marker); return; }
    line.addLatLng(pathPoints[i]);
    marker.setLatLng(pathPoints[i]);
    liveMap.panTo(pathPoints[i], { animate: true, duration: .3 });
    i++;
    playAnimFrame = setTimeout(step, 80);
  }
  step();
}
function stopPlay() { clearTimeout(playAnimFrame); }

async function clearHistory() {
  if (!confirm('Clear all route history?')) return;
  await fetch(BASE + '/location/history?userId=' + currentUser.uid, { method: 'DELETE' });
  pathPoints = []; if (myPath) myPath.setLatLngs([]);
  document.getElementById('history-point-count').textContent = '0 points';
  toast('History cleared', 'success');
}

/* ── ANALYTICS ── */
async function loadAnalytics() {
  try {
    const r = await fetch(BASE + '/analytics?userId=' + currentUser.uid);
    const d = await r.json();
    document.getElementById('a-distance').textContent  = d.distance + ' km';
    document.getElementById('a-duration').textContent  = d.duration + ' min';
    document.getElementById('a-avg-speed').textContent = d.avgSpeed + ' km/h';
    document.getElementById('a-max-speed').textContent = d.maxSpeed + ' km/h';
    document.getElementById('a-points').textContent    = d.points;
  } catch (e) { toast('Analytics error: ' + e.message, 'error'); }
}

function updateSpeedChart() {
  const canvas = document.getElementById('speed-chart');
  if (!canvas) return;
  const labels = speedData.map(p => new Date(p.t).toLocaleTimeString());
  const values = speedData.map(p => p.v);
  if (!speedChart) {
    speedChart = new Chart(canvas, {
      type: 'line',
      data: { labels, datasets: [{ label:'Speed (km/h)', data: values, borderColor:'#10b981', backgroundColor:'rgba(16,185,129,.1)', tension:.4, pointRadius:0, fill:true }] },
      options: { responsive:true, animation:false, scales: { x:{display:false}, y:{beginAtZero:true, grid:{color:'rgba(255,255,255,.05)'}, ticks:{color:'rgba(226,228,240,.45)',font:{size:11}}} }, plugins:{legend:{display:false}} }
    });
  } else {
    speedChart.data.labels  = labels;
    speedChart.data.datasets[0].data = values;
    speedChart.update('none');
  }
}

/* ── GEOFENCES ── */
async function loadGeofences() {
  const list = document.getElementById('fences-list');
  list.innerHTML = '<div class="loading"><div class="ld"></div><div class="ld"></div></div>';
  try {
    const r = await fetch(BASE + '/geofences?userId=' + currentUser.uid);
    const { fences = [] } = await r.json();
    if (!fences.length) { list.innerHTML = '<div style="color:var(--muted);font-size:14px;padding:12px 0">No geofences yet. Add one above.</div>'; return; }
    list.innerHTML = fences.map(f => `
      <div class="fence-card" id="fc-${f.id}">
        <div>
          <div class="fence-name">📌 ${esc(f.name)}</div>
          <div class="fence-meta">${f.radius}m • Alert: ${f.alertOn}</div>
        </div>
        <button class="fence-del" onclick="deleteFence('${f.id}')">✕ Remove</button>
      </div>`).join('');
    fences.forEach(f => {
      L.circle([f.lat, f.lon], { radius: f.radius, color: '#fbbf24', fillOpacity: .08, weight: 2 })
        .addTo(liveMap).bindPopup(`📌 ${f.name}`);
    });
  } catch (e) { list.innerHTML = `<div style="color:#fca5a5">${e.message}</div>`; }
}

async function addGeofence() {
  const name   = document.getElementById('fence-name').value.trim();
  const radius = parseInt(document.getElementById('fence-radius').value);
  const alertOn = document.getElementById('fence-alert').value;
  if (!name) { toast('Enter a geofence name', 'error'); return; }
  if (!myMarker) { toast('Start tracking first to set your location', 'error'); return; }
  const { lat, lng: lon } = myMarker.getLatLng();
  try {
    await fetch(BASE + '/geofences', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: currentUser.uid, name, lat, lon, radius, alertOn })
    });
    toast(`Geofence "${name}" added`, 'success');
    document.getElementById('fence-name').value = '';
    loadGeofences();
  } catch (e) { toast('Failed to add geofence: ' + e.message, 'error'); }
}

async function deleteFence(id) {
  await fetch(`${BASE}/geofences/${id}`, { method: 'DELETE' });
  document.getElementById('fc-' + id)?.remove();
  toast('Geofence removed', 'success');
}

function showFenceAlert(a) {
  const bar = document.getElementById('fence-alert-bar');
  bar.textContent = `${a.type === 'enter' ? '▶ Entered' : '◀ Exited'} geofence: ${a.fenceName}`;
  bar.classList.add('show');
  setTimeout(() => bar.classList.remove('show'), 5000);
}

function esc(s) {
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}
