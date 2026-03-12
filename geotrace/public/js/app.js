/**
 * GeoTrace Live — Frontend App
 * Real-time tracking, geofencing, heatmap, analytics, route playback
 */

'use strict';

/* ═══════════════════════════════════════════
   GLOBALS
═══════════════════════════════════════════ */
const API = ''; // same origin
let token = localStorage.getItem('gt_token');
let currentUser = null;
let socket = null;
let trackingActive = false;
let watchId = null;
let sessionPoints = []; // live session
let fences = [];
let speedHistory = [];

// Maps
let mainMap      = null;
let historyMap   = null;
let heatmapMap   = null;
let fenceMap     = null;
let fenceClickLatLon = null;

// Layers
let myMarker     = null;
let myPath       = null;
let myPathCoords = [];
let trailMarkers = [];
let otherMarkers = {};    // userId → marker
let fenceCircles = [];
let heatDots     = [];
let histMarker   = null;
let histPath     = null;

// Map tiles
const TILES = {
  street:    { url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',          attr: '© OpenStreetMap' },
  satellite: { url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', attr: '© Esri' },
  terrain:   { url: 'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png',            attr: '© OpenTopoMap' }
};
let currentTile = 'street';
let tileLayers  = {};

/* ═══════════════════════════════════════════
   AUTH
═══════════════════════════════════════════ */
function showAuth()  { document.getElementById('auth-overlay').style.display = 'flex'; document.getElementById('app').style.display = 'none'; }
function showApp()   { document.getElementById('auth-overlay').style.display = 'none'; document.getElementById('app').style.display = 'flex'; }

async function apiFetch(path, opts = {}) {
  const res = await fetch(API + path, {
    ...opts,
    headers: { 'Content-Type':'application/json', ...(token ? { Authorization:'Bearer '+token } : {}), ...(opts.headers||{}) }
  });
  return res.json();
}

async function doLogin() {
  const email = document.getElementById('login-email').value.trim();
  const pass  = document.getElementById('login-pass').value;
  setAuthError('');
  if (!email || !pass) return setAuthError('Fill all fields');
  try {
    const r = await apiFetch('/api/auth/login', { method:'POST', body: JSON.stringify({ email, password:pass }) });
    if (r.error) return setAuthError(r.error);
    token = r.token; localStorage.setItem('gt_token', token);
    currentUser = r.user;
    onLoggedIn();
  } catch(e) { setAuthError('Server unreachable. Is the server running?'); }
}

async function doRegister() {
  const name  = document.getElementById('reg-name').value.trim();
  const email = document.getElementById('reg-email').value.trim();
  const pass  = document.getElementById('reg-pass').value;
  setAuthError('');
  if (!name || !email || !pass) return setAuthError('Fill all fields');
  if (pass.length < 6) return setAuthError('Password min 6 chars');
  try {
    const r = await apiFetch('/api/auth/register', { method:'POST', body: JSON.stringify({ name, email, password:pass }) });
    if (r.error) return setAuthError(r.error);
    token = r.token; localStorage.setItem('gt_token', token);
    currentUser = r.user;
    onLoggedIn();
  } catch(e) { setAuthError('Server unreachable'); }
}

function setAuthError(msg) { document.getElementById('auth-error').textContent = msg; }

function onLoggedIn() {
  showApp();
  // Set user info
  document.getElementById('sb-name').textContent  = currentUser.name;
  document.getElementById('sb-email').textContent = currentUser.email;
  const av = document.getElementById('sb-av');
  av.textContent = currentUser.name[0].toUpperCase();
  av.style.background = `linear-gradient(135deg, ${currentUser.color}, #06b6d4)`;

  initMaps();
  connectSocket();
  loadFences();
  initParticles();
}

function doSignout() {
  token = null; localStorage.removeItem('gt_token');
  if (watchId) navigator.geolocation.clearWatch(watchId);
  if (socket) socket.disconnect();
  showAuth();
}

/* ═══════════════════════════════════════════
   SOCKET.IO
═══════════════════════════════════════════ */
function connectSocket() {
  const wsUrl = API || window.location.origin;
  socket = io(wsUrl, { auth: { token }, transports: ['websocket','polling'] });

  socket.on('connect', () => {
    document.getElementById('ws-badge').classList.add('connected');
    document.getElementById('ws-badge').textContent = '● WS';
  });

  socket.on('disconnect', () => {
    document.getElementById('ws-badge').classList.remove('connected');
    document.getElementById('ws-badge').textContent = '●';
  });

  // Other users' locations
  socket.on('location:broadcast', (data) => {
    if (data.userId === currentUser?.id) return;
    updateOtherMarker(data);
    updateOnlineList(data);
  });

  socket.on('user:joined', (u) => showToast(`👤 ${u.name} joined`, 'info'));
  socket.on('user:left',   (u) => {
    showToast(`👤 ${u.name} left`, 'info');
    if (otherMarkers[u.id]) { mainMap?.removeLayer(otherMarkers[u.id]); delete otherMarkers[u.id]; }
    refreshOnlineList();
  });

  // Geofence alerts
  socket.on('geofence:alert', (evt) => {
    const entering = evt.type === 'enter';
    showGeofenceAlert(evt.fenceName, entering);
    showToast(`${entering ? '➡️ Entered' : '⬅️ Left'} "${evt.fenceName}"`, entering ? 'ok' : 'warn');
    // Browser notification
    if (Notification.permission === 'granted') {
      new Notification(`GeoTrace: ${entering ? 'Entered' : 'Left'} ${evt.fenceName}`, {
        icon: '📍', body: new Date().toLocaleTimeString()
      });
    }
  });
}

/* ═══════════════════════════════════════════
   MAPS INIT
═══════════════════════════════════════════ */
function initMaps() {
  // ── MAIN MAP ──
  mainMap = L.map('main-map', { zoomControl:false, attributionControl:true }).setView([20, 0], 3);
  L.control.zoom({ position:'topright' }).addTo(mainMap);

  Object.keys(TILES).forEach(key => {
    tileLayers[key] = L.tileLayer(TILES[key].url, { attribution: TILES[key].attr, maxZoom:19 });
  });
  tileLayers.street.addTo(mainMap);

  // Map style buttons
  document.getElementById('mc-street').addEventListener('click',    () => switchTile('street'));
  document.getElementById('mc-satellite').addEventListener('click', () => switchTile('satellite'));
  document.getElementById('mc-terrain').addEventListener('click',   () => switchTile('terrain'));
  document.getElementById('mc-center').addEventListener('click',    () => { if (myMarker) mainMap.flyTo(myMarker.getLatLng(), 16, { duration:1.2 }); });
  document.getElementById('mc-3d').addEventListener('click',        toggle3D);

  // ── HISTORY MAP ──
  historyMap = L.map('history-map', { zoomControl:true }).setView([20,0], 3);
  L.tileLayer(TILES.street.url, { attribution: TILES.street.attr }).addTo(historyMap);

  // ── HEATMAP MAP ──
  heatmapMap = L.map('heatmap-map', { zoomControl:true }).setView([20,0], 3);
  L.tileLayer(TILES.satellite.url, { attribution: TILES.satellite.attr, maxZoom:19 }).addTo(heatmapMap);

  // ── FENCE MAP ──
  fenceMap = L.map('fence-map', { zoomControl:true }).setView([20,0], 3);
  L.tileLayer(TILES.street.url, { attribution: TILES.street.attr }).addTo(fenceMap);
  fenceMap.on('click', (e) => {
    fenceClickLatLon = e.latlng;
    document.getElementById('gf-lat').value = e.latlng.lat.toFixed(6);
    document.getElementById('gf-lon').value = e.latlng.lng.toFixed(6);
    showToast('📍 Coords set from map click', 'ok');
  });
}

function switchTile(key) {
  if (currentTile === key) return;
  mainMap.removeLayer(tileLayers[currentTile]);
  tileLayers[key].addTo(mainMap);
  currentTile = key;
  document.querySelectorAll('.mc-btn').forEach(b => b.classList.remove('active'));
  document.getElementById(`mc-${key}`).classList.add('active');
}

let tiltActive = false;
function toggle3D() {
  tiltActive = !tiltActive;
  const btn = document.getElementById('mc-3d');
  if (tiltActive) {
    mainMap.getContainer().style.transform = 'perspective(800px) rotateX(18deg)';
    mainMap.getContainer().style.transformOrigin = 'center bottom';
    btn.classList.add('active');
    showToast('🧊 3D perspective enabled', 'info');
  } else {
    mainMap.getContainer().style.transform = '';
    btn.classList.remove('active');
  }
}

/* ═══════════════════════════════════════════
   TRACKING
═══════════════════════════════════════════ */
function toggleTracking() {
  if (trackingActive) stopTracking(); else startTracking();
}

function startTracking() {
  if (!navigator.geolocation) return showToast('Geolocation not supported', 'error');
  Notification.requestPermission();

  trackingActive = true;
  sessionPoints = [];
  myPathCoords  = [];
  speedHistory  = [];
  document.getElementById('btn-track').textContent = '⏹ STOP TRACKING';
  document.getElementById('btn-track').classList.add('tracking');
  document.getElementById('tracking-dot').classList.add('active');
  document.getElementById('tracking-status').textContent = 'Tracking…';

  watchId = navigator.geolocation.watchPosition(onPosition, onGeoError, {
    enableHighAccuracy: true, maximumAge: 1000, timeout: 10000
  });
}

function stopTracking() {
  trackingActive = false;
  if (watchId) navigator.geolocation.clearWatch(watchId);
  watchId = null;
  document.getElementById('btn-track').textContent = '▶ START TRACKING';
  document.getElementById('btn-track').classList.remove('tracking');
  document.getElementById('tracking-dot').classList.remove('active');
  document.getElementById('tracking-status').textContent = `${sessionPoints.length} pts recorded`;
  showToast(`✅ Session saved — ${sessionPoints.length} points`, 'ok');
}

function onPosition(pos) {
  const { latitude: lat, longitude: lon, accuracy, speed, heading } = pos.coords;
  const ts = Date.now();
  const kmh = speed ? Math.round(speed * 3.6) : 0;

  const point = { lat, lon, accuracy: Math.round(accuracy), speed: kmh, heading: heading||0, ts };
  sessionPoints.push(point);
  speedHistory.push({ ts, speed: kmh });
  if (speedHistory.length > 60) speedHistory.shift();

  // Update stats
  document.getElementById('stat-speed').textContent = kmh;
  document.getElementById('stat-pts').textContent   = sessionPoints.length;
  if (sessionPoints.length > 1) {
    const total = calcTotalDistance(sessionPoints);
    document.getElementById('stat-dist').textContent = total.toFixed(2);
  }

  // Map overlay
  document.getElementById('mo-coords').textContent = `${lat.toFixed(5)}, ${lon.toFixed(5)}`;
  reverseGeocode(lat, lon).then(addr => {
    document.getElementById('mo-address').textContent = addr;
  });

  // My marker
  myPathCoords.push([lat, lon]);
  if (!myMarker) {
    const icon = L.divIcon({ className:'', html:'<div class="my-pin-live"></div>', iconSize:[14,14], iconAnchor:[7,7] });
    myMarker = L.marker([lat, lon], { icon }).addTo(mainMap).bindPopup('<b>📍 You</b>');
    mainMap.setView([lat, lon], 16);
  } else {
    myMarker.setLatLng([lat, lon]);
  }

  // Trail
  if (myPath) mainMap.removeLayer(myPath);
  myPath = L.polyline(myPathCoords, { color:'#7c3aed', weight:3, opacity:.8 }).addTo(mainMap);

  // Trail dots (last 10)
  trailMarkers.forEach(m => mainMap.removeLayer(m));
  trailMarkers = [];
  const trail = myPathCoords.slice(-12);
  trail.forEach((c, i) => {
    if (i === trail.length-1) return;
    const op = (i+1)/trail.length * 0.5;
    const sz = 4 + i/trail.length * 4;
    const dot = L.divIcon({ className:'', html:`<div style="width:${sz}px;height:${sz}px;border-radius:50%;background:#06b6d4;opacity:${op}"></div>`, iconSize:[sz,sz], iconAnchor:[sz/2,sz/2] });
    trailMarkers.push(L.marker(c, { icon: dot }).addTo(mainMap));
  });

  // Accuracy circle
  if (window._accCircle) mainMap.removeLayer(window._accCircle);
  window._accCircle = L.circle([lat,lon], { radius:accuracy, color:'#7c3aed', fillColor:'#7c3aed', fillOpacity:.07, weight:1 }).addTo(mainMap);

  // Emit to server via socket
  if (socket?.connected) {
    socket.emit('location:update', { lat, lon, accuracy, speed: kmh, heading: heading||0 });
  }
}

function onGeoError(err) {
  const m = { 1:'Permission denied', 2:'Position unavailable', 3:'Timeout' };
  showToast('GPS: ' + (m[err.code]||'Error'), 'error');
}

/* ═══════════════════════════════════════════
   OTHER USERS
═══════════════════════════════════════════ */
function updateOtherMarker(data) {
  if (!mainMap) return;
  const { userId, name, color, lat, lon } = data;
  const icon = L.divIcon({
    className:'',
    html: `<div class="other-pin" style="background:${color};box-shadow:0 0 10px ${color}60;"></div>`,
    iconSize:[12,12], iconAnchor:[6,6]
  });
  if (otherMarkers[userId]) {
    otherMarkers[userId].setLatLng([lat,lon]);
  } else {
    otherMarkers[userId] = L.marker([lat,lon], { icon })
      .addTo(mainMap)
      .bindPopup(`<b>👤 ${name}</b><br>${lat.toFixed(4)}, ${lon.toFixed(4)}`);
  }
}

function updateOnlineList(data) {
  const list = document.getElementById('up-list');
  let el = document.getElementById('up-' + data.userId);
  if (!el) {
    el = document.createElement('div');
    el.className = 'up-user';
    el.id = 'up-' + data.userId;
    el.innerHTML = `<div class="up-dot" style="background:${data.color};box-shadow:0 0 6px ${data.color}80"></div><span class="up-name">${data.name}</span>`;
    list.appendChild(el);
  }
}

function refreshOnlineList() {
  apiFetch('/api/users/online').then(r => {
    const list = document.getElementById('up-list');
    list.innerHTML = '';
    (r.users||[]).forEach(u => {
      if (u.id === currentUser?.id) return;
      const el = document.createElement('div');
      el.className = 'up-user';
      el.id = 'up-' + u.id;
      el.innerHTML = `<div class="up-dot" style="background:${u.color}"></div><span class="up-name">${u.name}</span>`;
      list.appendChild(el);
    });
  });
}

/* ═══════════════════════════════════════════
   HISTORY & ROUTE PLAYBACK
═══════════════════════════════════════════ */
async function loadHistory() {
  const r = await apiFetch('/api/location/history');
  const pts = r.points || [];

  // Points list
  const list = document.getElementById('points-list');
  list.innerHTML = '';
  pts.slice().reverse().forEach((p, i) => {
    const row = document.createElement('div');
    row.className = 'pt-row';
    row.innerHTML = `
      <span class="pt-num">#${pts.length-i}</span>
      <span class="pt-lat">${p.lat.toFixed(5)}</span>
      <span class="pt-lon">${p.lon.toFixed(5)}</span>
      <span class="pt-spd">${p.speed||0}km/h</span>
      <span class="pt-ts">${new Date(p.ts).toLocaleTimeString()}</span>
    `;
    list.appendChild(row);
  });

  // Draw on history map
  if (pts.length < 1) return;
  if (histPath)   historyMap.removeLayer(histPath);
  if (histMarker) historyMap.removeLayer(histMarker);

  const coords = pts.map(p => [p.lat, p.lon]);
  histPath = L.polyline(coords, { color:'#7c3aed', weight:3, opacity:.8 }).addTo(historyMap);
  historyMap.fitBounds(histPath.getBounds(), { padding:[20,20] });

  // Start/end markers
  const iconStart = L.divIcon({ className:'', html:'<div class="my-pin" style="background:#10b981;box-shadow:0 0 12px #10b981"></div>', iconSize:[14,14], iconAnchor:[7,7] });
  const iconEnd   = L.divIcon({ className:'', html:'<div class="my-pin"></div>', iconSize:[14,14], iconAnchor:[7,7] });
  L.marker(coords[0], { icon: iconStart }).addTo(historyMap).bindPopup('🟢 Start');
  L.marker(coords[coords.length-1], { icon: iconEnd }).addTo(historyMap).bindPopup('🔴 End');
}

async function playRoute() {
  const r = await apiFetch('/api/location/history');
  const pts = r.points || [];
  if (pts.length < 2) return showToast('Not enough points to play', 'warn');

  // Clear
  if (window._playMarker) historyMap.removeLayer(window._playMarker);
  if (window._playPath)   historyMap.removeLayer(window._playPath);
  let playCoords = [];
  window._playPath = L.polyline([], { color:'#e879f9', weight:3, dashArray:'6 6' }).addTo(historyMap);

  const icon = L.divIcon({ className:'', html:'<div class="my-pin" style="background:#e879f9;box-shadow:0 0 14px #e879f9"></div>', iconSize:[14,14], iconAnchor:[7,7] });
  window._playMarker = L.marker([pts[0].lat, pts[0].lon], { icon }).addTo(historyMap);

  showToast(`▶ Playing ${pts.length} points…`, 'info');
  let i = 0;
  const step = () => {
    if (i >= pts.length) { showToast('✅ Playback complete', 'ok'); return; }
    const p = pts[i];
    window._playMarker.setLatLng([p.lat, p.lon]);
    playCoords.push([p.lat, p.lon]);
    window._playPath.setLatLngs(playCoords);
    historyMap.panTo([p.lat, p.lon], { animate:true, duration:.4 });
    i++;
    setTimeout(step, 100);
  };
  step();
}

async function clearHistory() {
  if (!confirm('Clear all location history?')) return;
  await apiFetch('/api/location/history', { method:'DELETE' });
  loadHistory();
  showToast('History cleared', 'ok');
}

function exportGPX() {
  apiFetch('/api/location/history').then(r => {
    const pts = r.points || [];
    if (!pts.length) return showToast('No points to export', 'error');
    let gpx = `<?xml version="1.0" encoding="UTF-8"?>\n<gpx version="1.1" creator="GeoTrace">\n<trk><name>GeoTrace Route</name><trkseg>\n`;
    pts.forEach(p => {
      gpx += `<trkpt lat="${p.lat}" lon="${p.lon}"><time>${new Date(p.ts).toISOString()}</time><speed>${p.speed||0}</speed></trkpt>\n`;
    });
    gpx += `</trkseg></trk></gpx>`;
    const blob = new Blob([gpx], { type:'application/gpx+xml' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'geotrace-route.gpx'; a.click();
    showToast('GPX exported!', 'ok');
  });
}

/* ═══════════════════════════════════════════
   HEATMAP
═══════════════════════════════════════════ */
async function loadHeatmap() {
  const r = await apiFetch('/api/location/heatmap');
  const pts = r.points || [];

  // Clear old dots
  heatDots.forEach(d => heatmapMap.removeLayer(d));
  heatDots = [];

  if (!pts.length) { showToast('No heatmap data yet. Start tracking!', 'info'); return; }

  const maxW = Math.max(...pts.map(p => p.weight), 1);
  pts.forEach(p => {
    const pct = p.weight / maxW;
    const r   = Math.max(20, pct * 60);
    const op  = 0.15 + pct * 0.55;
    const col = pct > 0.7 ? 'rgba(239,68,68,' : pct > 0.4 ? 'rgba(251,191,36,' : 'rgba(6,182,212,';
    const icon = L.divIcon({
      className: '',
      html: `<div style="width:${r*2}px;height:${r*2}px;border-radius:50%;background:radial-gradient(circle,${col}${op}) 0%,${col}${op*.4}) 50%,transparent 80%);pointer-events:none"></div>`,
      iconSize: [r*2, r*2], iconAnchor: [r, r]
    });
    const m = L.marker([p.lat, p.lon], { icon, interactive:false }).addTo(heatmapMap);
    heatDots.push(m);
  });

  if (pts.length > 0) heatmapMap.setView([pts[0].lat, pts[0].lon], 14);
}

/* ═══════════════════════════════════════════
   GEOFENCES
═══════════════════════════════════════════ */
async function loadFences() {
  const r = await apiFetch('/api/geofences');
  fences = r.fences || [];
  renderFenceList();
  renderFenceMapCircles();
}

function renderFenceList() {
  const list = document.getElementById('fence-list');
  list.innerHTML = '';
  if (!fences.length) { list.innerHTML = '<div style="color:var(--mu);font-size:13px">No geofences yet</div>'; return; }
  fences.forEach(f => {
    const colors = ['#7c3aed','#06b6d4','#e879f9','#fbbf24','#10b981'];
    const col = colors[fences.indexOf(f) % colors.length];
    const el = document.createElement('div');
    el.className = 'fence-item';
    el.innerHTML = `
      <div class="fi-color" style="background:${col};box-shadow:0 0 8px ${col}80"></div>
      <div class="fi-name">${f.name}</div>
      <div class="fi-radius">${f.radius}m</div>
      <button class="fi-del" data-id="${f.id}">✕</button>
    `;
    el.querySelector('.fi-del').addEventListener('click', () => deleteFence(f.id));
    list.appendChild(el);
  });
}

function renderFenceMapCircles() {
  if (!fenceMap) return;
  fenceCircles.forEach(c => { fenceMap.removeLayer(c.circle); fenceMap.removeLayer(c.marker); });
  fenceCircles = [];
  const colors = ['#7c3aed','#06b6d4','#e879f9','#fbbf24','#10b981'];
  fences.forEach((f, i) => {
    const col = colors[i % colors.length];
    const circle = L.circle([f.lat, f.lon], {
      radius: f.radius, color: col, fillColor: col, fillOpacity:.1, weight:2,
      dashArray:'6 4'
    }).addTo(fenceMap);
    const icon = L.divIcon({ className:'', html:`<div style="background:${col};width:10px;height:10px;border-radius:50%;border:2px solid #fff;box-shadow:0 0 10px ${col}"></div>`, iconSize:[10,10], iconAnchor:[5,5] });
    const marker = L.marker([f.lat, f.lon], { icon }).addTo(fenceMap).bindPopup(`<b>⬡ ${f.name}</b><br>Radius: ${f.radius}m`);
    fenceCircles.push({ circle, marker });
  });
  if (fences.length) fenceMap.setView([fences[0].lat, fences[0].lon], 14);
}

async function addFence() {
  const name   = document.getElementById('gf-name').value.trim();
  const lat    = parseFloat(document.getElementById('gf-lat').value);
  const lon    = parseFloat(document.getElementById('gf-lon').value);
  const radius = parseInt(document.getElementById('gf-radius').value);
  const alertOn= document.getElementById('gf-alert').value;

  if (!name || isNaN(lat) || isNaN(lon) || !radius)
    return showToast('Fill all geofence fields or click map', 'error');

  const r = await apiFetch('/api/geofences', { method:'POST', body: JSON.stringify({ name, lat, lon, radius, alertOn }) });
  if (r.error) return showToast(r.error, 'error');

  showToast(`✅ Geofence "${name}" added`, 'ok');
  document.getElementById('gf-name').value = '';
  loadFences();
}

async function deleteFence(id) {
  await apiFetch(`/api/geofences/${id}`, { method:'DELETE' });
  loadFences();
  showToast('Geofence deleted', 'ok');
}

function showGeofenceAlert(name, entering) {
  const box = document.getElementById('fence-alerts');
  const el  = document.createElement('div');
  el.className = `fence-alert ${entering ? 'fa-enter' : 'fa-exit'}`;
  el.textContent = `${entering ? '➡️ ENTERED' : '⬅️ LEFT'}: ${name}`;
  box.appendChild(el);
  setTimeout(() => { el.style.transition='opacity .5s'; el.style.opacity='0'; setTimeout(()=>el.remove(),500); }, 4000);
}

/* ═══════════════════════════════════════════
   ANALYTICS
═══════════════════════════════════════════ */
async function loadAnalytics() {
  const r = await apiFetch('/api/analytics');
  document.getElementById('an-dist').textContent  = r.distance ?? '—';
  document.getElementById('an-dur').textContent   = r.duration  ?? '—';
  document.getElementById('an-avg').textContent   = r.avgSpeed  ?? '—';
  document.getElementById('an-max').textContent   = r.maxSpeed  ?? '—';
  document.getElementById('an-pts').textContent   = r.points    ?? '—';
  document.getElementById('an-start').textContent = r.startTime ? new Date(r.startTime).toLocaleTimeString() : '—';
  drawSpeedChart();
}

function drawSpeedChart() {
  const canvas = document.getElementById('speed-chart');
  const ctx    = canvas.getContext('2d');
  const W = canvas.offsetWidth || 600;
  const H = 160;
  canvas.width  = W;
  canvas.height = H;
  ctx.clearRect(0,0,W,H);

  const pts = speedHistory;
  if (pts.length < 2) {
    ctx.fillStyle = '#475569';
    ctx.font = '13px DM Sans, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Start tracking to see speed chart', W/2, H/2);
    return;
  }

  const maxS = Math.max(...pts.map(p=>p.speed), 1);
  const step  = W / (pts.length - 1);

  // Gradient fill
  const grad = ctx.createLinearGradient(0,0,0,H);
  grad.addColorStop(0, 'rgba(124,58,237,.5)');
  grad.addColorStop(1, 'rgba(124,58,237,.02)');

  ctx.beginPath();
  pts.forEach((p,i) => {
    const x = i * step;
    const y = H - (p.speed / maxS) * (H - 20) - 10;
    i === 0 ? ctx.moveTo(x,y) : ctx.lineTo(x,y);
  });
  ctx.lineTo(W, H); ctx.lineTo(0, H); ctx.closePath();
  ctx.fillStyle = grad; ctx.fill();

  // Line
  ctx.beginPath();
  pts.forEach((p,i) => {
    const x = i * step;
    const y = H - (p.speed / maxS) * (H - 20) - 10;
    i === 0 ? ctx.moveTo(x,y) : ctx.lineTo(x,y);
  });
  ctx.strokeStyle = '#7c3aed'; ctx.lineWidth = 2; ctx.stroke();

  // Max label
  ctx.fillStyle = '#a78bfa'; ctx.font = '11px JetBrains Mono, monospace';
  ctx.textAlign = 'left';
  ctx.fillText(`${maxS} km/h`, 6, 14);
}

/* ═══════════════════════════════════════════
   USERS VIEW
═══════════════════════════════════════════ */
async function loadUsers() {
  const r = await apiFetch('/api/users/online');
  const grid = document.getElementById('users-grid');
  grid.innerHTML = '';
  const users = r.users || [];
  if (!users.length) { grid.innerHTML = '<div style="color:var(--mu)">No other users online</div>'; return; }
  users.forEach(u => {
    const el = document.createElement('div');
    el.className = 'user-card';
    const loc = u.lastLocation ? `${u.lastLocation.lat?.toFixed(4)}, ${u.lastLocation.lon?.toFixed(4)}` : 'No location';
    el.innerHTML = `
      <div class="uc-top">
        <div class="uc-av" style="background:linear-gradient(135deg,${u.color},#06b6d4)">${u.name[0]}</div>
        <div><div class="uc-name">${u.name}</div><div class="uc-status">● Online</div></div>
      </div>
      <div class="uc-loc">${loc}</div>
    `;
    grid.appendChild(el);
  });
}

/* ═══════════════════════════════════════════
   UTILS
═══════════════════════════════════════════ */
function haversine(a, b) {
  const R = 6371, d2r = Math.PI/180;
  const dLat = (b.lat - a.lat)*d2r, dLon = (b.lon - a.lon)*d2r;
  const s = Math.sin(dLat/2)**2 + Math.cos(a.lat*d2r)*Math.cos(b.lat*d2r)*Math.sin(dLon/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(s), Math.sqrt(1-s));
}

function calcTotalDistance(pts) {
  let d = 0;
  for (let i=1;i<pts.length;i++) d += haversine(pts[i-1], pts[i]);
  return d;
}

let geocodeCache = {};
async function reverseGeocode(lat, lon) {
  const key = `${lat.toFixed(3)},${lon.toFixed(3)}`;
  if (geocodeCache[key]) return geocodeCache[key];
  try {
    const r = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json`);
    const d = await r.json();
    const addr = (d.display_name||'').split(',').slice(0,3).join(',');
    geocodeCache[key] = addr;
    return addr;
  } catch { return `${lat.toFixed(4)}, ${lon.toFixed(4)}`; }
}

/* ═══════════════════════════════════════════
   TOAST
═══════════════════════════════════════════ */
const toastBox = document.createElement('div');
toastBox.style.cssText = 'position:fixed;top:18px;right:18px;z-index:9999;display:flex;flex-direction:column;gap:8px;';
document.body.appendChild(toastBox);

function showToast(msg, type='info') {
  const colors = {
    ok:   { bg:'rgba(16,185,129,.15)',  bd:'rgba(16,185,129,.4)',  tx:'#6ee7b7', ic:'✅' },
    error:{ bg:'rgba(239,68,68,.15)',   bd:'rgba(239,68,68,.4)',   tx:'#fca5a5', ic:'❌' },
    warn: { bg:'rgba(251,191,36,.15)',  bd:'rgba(251,191,36,.4)',  tx:'#fde68a', ic:'⚠️' },
    info: { bg:'rgba(6,182,212,.15)',   bd:'rgba(6,182,212,.4)',   tx:'#67e8f9', ic:'ℹ️' }
  };
  const c = colors[type] || colors.info;
  const el = document.createElement('div');
  el.style.cssText = `padding:11px 17px;border-radius:11px;font-size:13px;font-weight:500;backdrop-filter:blur(20px);background:${c.bg};border:1px solid ${c.bd};color:${c.tx};display:flex;align-items:center;gap:9px;max-width:320px;animation:toast-s .3s ease;font-family:'DM Sans',sans-serif`;
  el.innerHTML = `<span>${c.ic}</span><span>${msg}</span>`;
  toastBox.appendChild(el);
  const style = document.createElement('style');
  style.textContent = '@keyframes toast-s{from{opacity:0;transform:translateX(44px)}to{opacity:1;transform:translateX(0)}}';
  document.head.appendChild(style);
  setTimeout(() => { el.style.transition='all .3s'; el.style.opacity='0'; el.style.transform='translateX(44px)'; setTimeout(()=>el.remove(),320); }, 3600);
}

/* ═══════════════════════════════════════════
   PARTICLES
═══════════════════════════════════════════ */
function initParticles() {
  const canvas = document.getElementById('particle-canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  canvas.width  = window.innerWidth;
  canvas.height = window.innerHeight;
  window.addEventListener('resize', () => { canvas.width=window.innerWidth; canvas.height=window.innerHeight; });

  const N = 60;
  const particles = Array.from({length:N}, () => ({
    x:  Math.random() * canvas.width,
    y:  Math.random() * canvas.height,
    vx: (Math.random()-.5)*.3,
    vy: (Math.random()-.5)*.3,
    r:  Math.random()*2+.5,
    op: Math.random()*.5+.1,
    col: ['#7c3aed','#06b6d4','#e879f9'][Math.floor(Math.random()*3)]
  }));

  function draw() {
    ctx.clearRect(0,0,canvas.width,canvas.height);
    particles.forEach(p => {
      p.x += p.vx; p.y += p.vy;
      if (p.x<0||p.x>canvas.width)  p.vx*=-1;
      if (p.y<0||p.y>canvas.height) p.vy*=-1;
      ctx.beginPath(); ctx.arc(p.x,p.y,p.r,0,Math.PI*2);
      ctx.fillStyle = p.col + Math.round(p.op*255).toString(16).padStart(2,'0');
      ctx.fill();
    });
    // Lines between close particles
    for (let i=0;i<particles.length;i++) {
      for (let j=i+1;j<particles.length;j++) {
        const dx=particles[i].x-particles[j].x, dy=particles[i].y-particles[j].y;
        const dist=Math.sqrt(dx*dx+dy*dy);
        if (dist<80) {
          ctx.beginPath();
          ctx.moveTo(particles[i].x,particles[i].y);
          ctx.lineTo(particles[j].x,particles[j].y);
          ctx.strokeStyle = `rgba(124,58,237,${(1-dist/80)*.12})`;
          ctx.lineWidth=.5; ctx.stroke();
        }
      }
    }
    requestAnimationFrame(draw);
  }
  draw();
}

/* ═══════════════════════════════════════════
   VIEW SWITCHING
═══════════════════════════════════════════ */
function switchView(name) {
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  document.querySelectorAll('.ni[data-view]').forEach(b => b.classList.remove('active'));
  const v = document.getElementById('view-' + name);
  if (v) v.classList.add('active');
  const b = document.querySelector(`.ni[data-view="${name}"]`);
  if (b) b.classList.add('active');

  const titles = { tracker:'Live Tracker', history:'Route History', heatmap:'Heatmap', geofence:'Geofences', analytics:'Analytics', users:'Online Users' };
  document.getElementById('view-title').textContent = titles[name] || name;

  // Lazy loads
  if (name === 'history')   loadHistory();
  if (name === 'heatmap')   { setTimeout(() => { heatmapMap.invalidateSize(); loadHeatmap(); }, 100); }
  if (name === 'analytics') loadAnalytics();
  if (name === 'geofence')  { setTimeout(() => fenceMap.invalidateSize(), 100); }
  if (name === 'users')     loadUsers();
}

/* ═══════════════════════════════════════════
   BOOTSTRAP
═══════════════════════════════════════════ */
document.addEventListener('DOMContentLoaded', () => {

  // Auth tabs
  document.querySelectorAll('.auth-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.auth-tab,.auth-form').forEach(el => el.classList.remove('active'));
      tab.classList.add('active');
      document.getElementById('auth-' + tab.dataset.tab).classList.add('active');
    });
  });

  document.getElementById('btn-login').addEventListener('click',    doLogin);
  document.getElementById('btn-register').addEventListener('click', doRegister);
  document.getElementById('login-pass').addEventListener('keydown', e => { if(e.key==='Enter') doLogin(); });
  document.getElementById('reg-pass').addEventListener('keydown',   e => { if(e.key==='Enter') doRegister(); });

  // Sidebar nav
  document.querySelectorAll('.ni[data-view]').forEach(btn => {
    btn.addEventListener('click', () => switchView(btn.dataset.view));
  });

  document.getElementById('btn-signout').addEventListener('click', doSignout);
  document.getElementById('btn-track').addEventListener('click',   toggleTracking);

  // History actions
  document.getElementById('btn-playback').addEventListener('click',    playRoute);
  document.getElementById('btn-export').addEventListener('click',      exportGPX);
  document.getElementById('btn-clear-hist').addEventListener('click',  clearHistory);

  // Analytics
  document.getElementById('btn-refresh-analytics').addEventListener('click', loadAnalytics);
  document.getElementById('btn-refresh-users').addEventListener('click',     loadUsers);

  // Geofence
  document.getElementById('btn-add-fence').addEventListener('click', addFence);

  // Speed chart on resize
  window.addEventListener('resize', () => { if (speedHistory.length) drawSpeedChart(); });

  // Auto-login if token exists
  if (token) {
    apiFetch('/api/users/online')
      .then(r => {
        if (r.error) { localStorage.removeItem('gt_token'); showAuth(); return; }
        // Token valid — try to get user from token
        const payload = JSON.parse(atob(token.split('.')[1]));
        // We'll use a lightweight user object; real app would have /api/me
        currentUser = { id: payload.userId, name: 'User', email: '', color: '#7c3aed' };
        // We'll re-use demo login to get full profile if needed
        showApp();
        document.getElementById('sb-name').textContent = 'Welcome back';
        initMaps();
        connectSocket();
        loadFences();
        initParticles();
      })
      .catch(() => { localStorage.removeItem('gt_token'); showAuth(); });
  } else {
    showAuth();
  }
});
