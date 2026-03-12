// ============================================================
//  GeoTrace — Main App Logic (app.js)
// ============================================================

let currentUser    = null;
let currentFile    = null;
let currentExif    = null;
let leafletMap     = null;
let leafletMarker  = null;
let userHistory    = [];

// ── Initialize app ────────────────────────────────────────────
window.addEventListener('DOMContentLoaded', async () => {
  initFirebase();
  currentUser = await requireAuth();

  // Load user profile
  const profile = await getCurrentUserProfile();
  renderUserHeader(profile || currentUser);

  // Setup file upload
  setupUpload();

  // Load history
  await refreshHistory();

  // Admin link
  if (isAdmin(currentUser.email)) {
    document.getElementById('admin-link').style.display = 'inline-flex';
  }
});

// ── Render user info in header ────────────────────────────────
function renderUserHeader(user) {
  const el = document.getElementById('user-info');
  if (!el) return;
  el.innerHTML = `
    <img src="${user.photo || user.photoURL || ''}" alt="" class="avatar" onerror="this.style.display='none'">
    <span>${user.name || user.displayName || user.email}</span>
    ${isAdmin(user.email) ? '<span class="badge-admin">ADMIN</span>' : ''}
  `;
}

// ── File upload setup ─────────────────────────────────────────
function setupUpload() {
  const zone  = document.getElementById('upload-zone');
  const input = document.getElementById('file-input');

  zone.addEventListener('dragover', e => { e.preventDefault(); zone.classList.add('drag-over'); });
  zone.addEventListener('dragleave', () => zone.classList.remove('drag-over'));
  zone.addEventListener('drop', e => {
    e.preventDefault();
    zone.classList.remove('drag-over');
    if (e.dataTransfer.files[0]) handleFile(e.dataTransfer.files[0]);
  });
  zone.addEventListener('click', () => input.click());

  input.addEventListener('change', e => {
    if (e.target.files[0]) handleFile(e.target.files[0]);
  });
}

// ── Handle new file ───────────────────────────────────────────
async function handleFile(file) {
  if (!file.type.startsWith('image/')) {
    showToast('Please upload an image file', 'error');
    return;
  }

  currentFile = file;
  showSection('analyzer');

  // Show image preview
  const reader = new FileReader();
  reader.onload = e => {
    document.getElementById('preview-img').src = e.target.result;
    document.getElementById('file-name').textContent = file.name;
    document.getElementById('file-size').textContent = (file.size / 1024).toFixed(1) + ' KB';
  };
  reader.readAsDataURL(file);

  // Extract EXIF
  setStatus('exif-status', 'scanning');
  currentExif = await extractExif(file);
  renderExifTable(currentExif);
  setStatus('exif-status', 'done');

  // Auto-show GPS on map if available
  if (currentExif.latitude) {
    plotMap(currentExif.latitude, currentExif.longitude, 'GPS from EXIF');
    const geo = await reverseGeocode(currentExif.latitude, currentExif.longitude);
    if (geo) document.getElementById('address-line').textContent = geo.display;
  }

  document.getElementById('analyze-btn').disabled = false;
  logEvent('file_upload', { fileName: file.name, hasGPS: !!currentExif?.latitude });
}

// ── Run AI analysis ───────────────────────────────────────────
async function runAnalysis() {
  const apiKey = document.getElementById('api-key').value.trim();
  if (!apiKey) { showToast('Enter your Anthropic API key', 'error'); return; }
  if (!currentFile) { showToast('Upload an image first', 'error'); return; }

  const btn = document.getElementById('analyze-btn');
  btn.disabled = true;
  btn.innerHTML = '<span class="spinner"></span> ANALYZING...';
  setStatus('ai-status', 'scanning');
  document.getElementById('scan-overlay').classList.add('active');

  try {
    // Run AI
    const aiResult = await analyzeWithAI(currentFile, apiKey, currentExif);

    // Render results
    renderAIResult(aiResult);

    // Plot map
    if (aiResult.coordinates?.lat) {
      plotMap(aiResult.coordinates.lat, aiResult.coordinates.lon,
        `${aiResult.city || ''} ${aiResult.country || ''}`.trim());
    }

    // Reverse geocode AI coords
    let geocoded = null;
    if (aiResult.coordinates?.lat) {
      geocoded = await reverseGeocode(aiResult.coordinates.lat, aiResult.coordinates.lon);
      if (geocoded) document.getElementById('address-line').textContent = geocoded.display;
    }

    // Save to history
    const searchId = await saveSearchHistory(
      currentUser.uid,
      { name: currentFile.name, size: currentFile.size, type: currentFile.type },
      currentExif, aiResult, geocoded
    );

    setStatus('ai-status', 'done');
    showToast('Analysis complete! Saved to history.', 'success');
    logEvent('analysis_complete', { searchId, confidence: aiResult.confidence });

    await refreshHistory();
  } catch (err) {
    setStatus('ai-status', 'error');
    showToast('AI Error: ' + err.message, 'error');
    console.error(err);
  }

  btn.disabled = false;
  btn.innerHTML = '🔍 ANALYZE LOCATION';
  document.getElementById('scan-overlay').classList.remove('active');
}

// ── Render EXIF table ─────────────────────────────────────────
function renderExifTable(exif) {
  const rows = [
    ['GPS Latitude',  exif.latitude  ? exif.latitude.toFixed(6) + '°'  : '—', !!exif.latitude],
    ['GPS Longitude', exif.longitude ? exif.longitude.toFixed(6) + '°' : '—', !!exif.longitude],
    ['Camera',        [exif.make, exif.model].filter(Boolean).join(' ') || '—', false],
    ['Date Taken',    exif.dateTaken ? new Date(exif.dateTaken).toLocaleString() : '—', false],
    ['Focal Length',  exif.focalLength  || '—', false],
    ['Aperture',      exif.aperture     || '—', false],
    ['ISO',           exif.iso          || '—', false],
    ['Exposure',      exif.exposureTime || '—', false],
    ['Flash',         exif.flash        || '—', false],
    ['Software',      exif.software     || '—', false],
  ];

  document.getElementById('exif-table').innerHTML = rows.map(([label, val, hl]) => `
    <tr>
      <td class="exif-label">${label}</td>
      <td class="exif-val ${hl ? 'highlight' : ''}">${val}</td>
    </tr>
  `).join('');
}

// ── Render AI result panel ────────────────────────────────────
function renderAIResult(ai) {
  const conf = ai.confidence || 0;
  document.getElementById('confidence-fill').style.width = conf + '%';
  document.getElementById('confidence-num').textContent = conf + '%';

  document.getElementById('ai-result-body').innerHTML = `
    <div class="result-tags">
      ${ai.country  ? `<span class="tag tag-green">🌍 ${ai.country}</span>`  : ''}
      ${ai.region   ? `<span class="tag tag-blue">📍 ${ai.region}</span>`    : ''}
      ${ai.city     ? `<span class="tag tag-blue">🏙️ ${ai.city}</span>`      : ''}
      ${ai.source   ? `<span class="tag tag-gray">📡 ${ai.source.replace('_',' ').toUpperCase()}</span>` : ''}
    </div>
    ${ai.coordinates?.lat ? `
    <div class="coord-block">
      <span class="mono">${ai.coordinates.lat.toFixed(5)}, ${ai.coordinates.lon.toFixed(5)}</span>
    </div>` : ''}
    <p class="reasoning">${ai.reasoning || ''}</p>
    <div class="detail-grid">
      ${ai.landmarks    ? `<div class="detail-item"><span>Landmarks</span><span>${ai.landmarks}</span></div>`    : ''}
      ${ai.climate      ? `<div class="detail-item"><span>Climate</span><span>${ai.climate}</span></div>`          : ''}
      ${ai.timeEstimate ? `<div class="detail-item"><span>Time/Season</span><span>${ai.timeEstimate}</span></div>` : ''}
      ${ai.language     ? `<div class="detail-item"><span>Language</span><span>${ai.language}</span></div>`        : ''}
    </div>
  `;
}

// ── Plot Leaflet map ──────────────────────────────────────────
function plotMap(lat, lon, label) {
  const mapEl = document.getElementById('map');
  mapEl.style.display = 'block';
  document.getElementById('map-placeholder').style.display = 'none';

  if (leafletMap) { leafletMap.setView([lat, lon], APP_CONFIG.mapDefaultZoom); }
  else {
    leafletMap = L.map('map').setView([lat, lon], APP_CONFIG.mapDefaultZoom);
    L.tileLayer(APP_CONFIG.mapTileUrl, {
      attribution: '© <a href="https://openstreetmap.org">OpenStreetMap</a> contributors'
    }).addTo(leafletMap);
  }

  if (leafletMarker) leafletMarker.remove();
  const icon = L.divIcon({
    html: '<div class="map-pin"></div>',
    iconSize: [24, 24], iconAnchor: [12, 12], className: ''
  });
  leafletMarker = L.marker([lat, lon], { icon })
    .addTo(leafletMap)
    .bindPopup(`<strong>${label}</strong><br>${lat.toFixed(5)}, ${lon.toFixed(5)}`)
    .openPopup();
}

// ── Load & render history ─────────────────────────────────────
async function refreshHistory() {
  userHistory = await loadUserHistory(currentUser.uid, 30);
  renderHistory(userHistory);
}

function renderHistory(items) {
  const container = document.getElementById('history-list');
  document.getElementById('history-count').textContent = items.length;

  if (!items.length) {
    container.innerHTML = '<p class="empty-state">No searches yet. Upload a photo to get started.</p>';
    return;
  }

  container.innerHTML = items.map(item => {
    const date = item.timestamp?.toDate?.() || new Date();
    const loc  = [item.result?.city, item.result?.country].filter(Boolean).join(', ') || 'Unknown location';
    return `
    <div class="history-card" onclick="viewHistoryItem('${item.id}')">
      <div class="history-meta">
        <span class="history-file">${item.fileName || 'Photo'}</span>
        <span class="history-date">${date.toLocaleDateString()}</span>
      </div>
      <div class="history-loc">📍 ${loc}</div>
      <div class="history-footer">
        ${item.exif?.hasGPS ? '<span class="badge-gps">GPS</span>' : ''}
        ${item.result?.confidence ? `<span class="badge-conf">${item.result.confidence}% conf</span>` : ''}
        <button class="del-btn" onclick="event.stopPropagation(); deleteHistoryItem('${item.id}')">🗑</button>
      </div>
    </div>`;
  }).join('');
}

async function deleteHistoryItem(id) {
  if (!confirm('Delete this search?')) return;
  await deleteSearch(id);
  showToast('Deleted', 'success');
  await refreshHistory();
}

function viewHistoryItem(id) {
  const item = userHistory.find(h => h.id === id);
  if (!item || !item.result?.coordinates) return;
  const { lat, lon } = item.result.coordinates;
  if (lat) {
    showSection('analyzer');
    plotMap(lat, lon, item.result?.city || 'Previous search');
    renderAIResult(item.result);
  }
}

// ── UI helpers ────────────────────────────────────────────────
function showSection(name) {
  ['upload', 'analyzer'].forEach(s => {
    document.getElementById(s + '-section').style.display = s === name ? 'block' : 'none';
  });
}

function setStatus(elId, state) {
  const el = document.getElementById(elId);
  if (!el) return;
  const map = { scanning: ['SCANNING...','status-scanning'], done: ['DONE','status-done'],
                error: ['ERROR','status-error'], ready: ['READY','status-ready'] };
  el.textContent = map[state][0];
  el.className   = 'status-badge ' + map[state][1];
}

function showToast(msg, type = 'info') {
  const t = document.createElement('div');
  t.className = `toast toast-${type}`;
  t.textContent = msg;
  document.body.appendChild(t);
  setTimeout(() => t.classList.add('show'), 10);
  setTimeout(() => { t.classList.remove('show'); setTimeout(() => t.remove(), 300); }, 3000);
}

window.runAnalysis       = runAnalysis;
window.signOut           = signOut;
window.deleteHistoryItem = deleteHistoryItem;
window.viewHistoryItem   = viewHistoryItem;
