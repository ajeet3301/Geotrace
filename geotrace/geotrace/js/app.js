// app.js — Main App UI Logic

let currentUser = null;
let currentFile = null;
let currentExif = {};
let leafletMap = null;
let leafletMarker = null;

document.addEventListener('DOMContentLoaded', async () => {
  const { initFirebase, requireAuth, getCurrentUserProfile, logEvent } = GeoAuth;
  initFirebase();

  currentUser = await requireAuth();

  // Load user profile into sidebar
  const profile = await getCurrentUserProfile();
  if (profile) {
    document.getElementById('user-name').textContent  = profile.name  || 'User';
    document.getElementById('user-email').textContent = profile.email || '';

    const avatarEl = document.getElementById('user-avatar');
    if (profile.photo) {
      avatarEl.innerHTML = `<img src="${profile.photo}" alt="avatar">`;
    } else {
      avatarEl.textContent = (profile.name || 'U').charAt(0).toUpperCase();
    }

    // Show admin link if admin
    if (GeoAuth.isAdmin(profile.email)) {
      document.getElementById('admin-nav-item').style.display = 'flex';
    }
  }

  setupUpload();
  setupNavigation();

  logEvent('app_open', {}, currentUser.uid);
});

// ── Navigation ─────────────────────────────────────────
function setupNavigation() {
  document.querySelectorAll('[data-section]').forEach(el => {
    el.addEventListener('click', () => {
      const section = el.dataset.section;
      showSection(section);

      document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
      el.classList.add('active');

      if (section === 'history') refreshHistory();
    });
  });

  document.getElementById('btn-signout').addEventListener('click', () => {
    GeoAuth.signOut();
  });
}

// ── Section Visibility ─────────────────────────────────
function showSection(name) {
  document.querySelectorAll('.app-section').forEach(s => s.classList.remove('active'));
  const target = document.getElementById(`section-${name}`);
  if (target) target.classList.add('active');
}

// ── File Upload Setup ──────────────────────────────────
function setupUpload() {
  const zone = document.getElementById('upload-zone');
  const fileInput = document.getElementById('file-input');

  zone.addEventListener('click', () => fileInput.click());

  zone.addEventListener('dragover', e => {
    e.preventDefault();
    zone.classList.add('drag-over');
  });

  zone.addEventListener('dragleave', () => zone.classList.remove('drag-over'));

  zone.addEventListener('drop', e => {
    e.preventDefault();
    zone.classList.remove('drag-over');
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  });

  fileInput.addEventListener('change', () => {
    const file = fileInput.files[0];
    if (file) handleFile(file);
  });

  document.getElementById('btn-back').addEventListener('click', () => {
    showSection('upload');
    document.querySelector('[data-section="upload"]')?.classList.add('active');
  });

  document.getElementById('btn-analyze').addEventListener('click', runAnalysis);
}

// ── Handle Uploaded File ───────────────────────────────
async function handleFile(file) {
  const maxSizeMB = window.APP_CONFIG?.maxFileSizeMB || 10;
  const supported = window.APP_CONFIG?.supportedTypes || ['image/jpeg','image/png','image/heic','image/webp'];

  if (!supported.includes(file.type)) {
    showToast('Unsupported file type. Use JPG, PNG, HEIC, or WEBP.', 'error');
    return;
  }

  if (file.size > maxSizeMB * 1024 * 1024) {
    showToast(`File too large. Max ${maxSizeMB}MB.`, 'error');
    return;
  }

  currentFile = file;
  showSection('analyzer');

  // Show file info
  document.getElementById('analyzer-file-name').textContent = file.name;
  document.getElementById('analyzer-file-size').textContent = formatFileSize(file.size);

  // Show image preview
  const previewUrl = URL.createObjectURL(file);
  document.getElementById('preview-img').src = previewUrl;
  document.getElementById('preview-img').style.display = 'block';
  document.getElementById('preview-placeholder').style.display = 'none';

  // Reset state
  resetAnalyzerState();

  // Extract EXIF
  showToast('Extracting metadata…', 'info');
  currentExif = await GeoEngine.extractExif(file);
  renderExifTable(currentExif);

  // If GPS found, auto-plot map
  if (currentExif.hasGPS && currentExif.latitude && currentExif.longitude) {
    showToast('GPS coordinates found!', 'success');
    plotMap(currentExif.latitude, currentExif.longitude, 'GPS Location');
    const geocoded = await GeoEngine.reverseGeocode(currentExif.latitude, currentExif.longitude);
    document.getElementById('map-address').textContent = geocoded.display || '';

    // Show a partial AI result from EXIF
    const gpsResult = {
      country: geocoded.country,
      region: geocoded.state,
      city: geocoded.city,
      coordinates: { lat: currentExif.latitude, lon: currentExif.longitude },
      confidence: 99,
      source: 'exif_gps',
      reasoning: 'Location determined from embedded GPS coordinates in EXIF metadata.',
      landmarks: null,
      climate: null,
      timeEstimate: null,
      language: null,
      vehicleTypes: null
    };
    renderAIResult(gpsResult);
    setPanelStatus('ai-status', 'complete');
  }

  document.getElementById('btn-analyze').disabled = false;
}

// ── Run AI Analysis ─────────────────────────────────────
async function runAnalysis() {
  const apiKey = document.getElementById('api-key-input').value.trim();
  if (!apiKey) {
    showToast('Please enter your Anthropic API key.', 'error');
    return;
  }

  if (!currentFile) {
    showToast('No file selected.', 'error');
    return;
  }

  const btnAnalyze = document.getElementById('btn-analyze');
  btnAnalyze.disabled = true;
  btnAnalyze.innerHTML = '<span class="spinner"></span> ANALYZING…';

  // Activate scan line
  document.querySelector('.scan-line').classList.add('active');
  setPanelStatus('ai-status', 'scanning');

  try {
    const aiResult = await GeoEngine.analyzeWithAI(currentFile, apiKey, currentExif);

    // Plot map if coordinates
    if (aiResult.coordinates?.lat && aiResult.coordinates?.lon) {
      plotMap(aiResult.coordinates.lat, aiResult.coordinates.lon, aiResult.city || aiResult.country || 'Location');

      const geocoded = await GeoEngine.reverseGeocode(aiResult.coordinates.lat, aiResult.coordinates.lon);
      document.getElementById('map-address').textContent = geocoded.display || '';

      // Save to history
      await GeoEngine.saveSearchHistory(
        currentUser.uid,
        { name: currentFile.name, size: currentFile.size, type: currentFile.type },
        currentExif,
        aiResult,
        geocoded
      );
    }

    renderAIResult(aiResult);
    setPanelStatus('ai-status', 'complete');

    await GeoAuth.logEvent('analysis_complete', {
      confidence: aiResult.confidence,
      source: aiResult.source,
      country: aiResult.country
    }, currentUser.uid);

    showToast('Analysis complete!', 'success');
  } catch (err) {
    setPanelStatus('ai-status', 'error');
    showToast(err.message || 'Analysis failed.', 'error');
    console.error('Analysis error:', err);
  } finally {
    document.querySelector('.scan-line').classList.remove('active');
    btnAnalyze.disabled = false;
    btnAnalyze.innerHTML = 'ANALYZE LOCATION';
  }
}

// ── Render EXIF Table ──────────────────────────────────
function renderExifTable(exif) {
  const rows = [
    { label: 'GPS LAT',  value: exif.latitude  ? exif.latitude.toFixed(6)  : '—', gps: exif.hasGPS },
    { label: 'GPS LON',  value: exif.longitude ? exif.longitude.toFixed(6) : '—', gps: exif.hasGPS },
    { label: 'CAMERA',   value: [exif.make, exif.model].filter(Boolean).join(' ') || '—' },
    { label: 'DATE',     value: exif.dateTaken ? new Date(exif.dateTaken).toLocaleString() : '—' },
    { label: 'FOCAL',    value: exif.focalLength  || '—' },
    { label: 'APERTURE', value: exif.aperture     || '—' },
    { label: 'ISO',      value: exif.iso          || '—' },
    { label: 'EXPOSURE', value: exif.exposureTime || '—' },
    { label: 'FLASH',    value: exif.flash        || '—' },
    { label: 'SOFTWARE', value: exif.software     || '—' }
  ];

  const tbody = document.getElementById('exif-tbody');
  tbody.innerHTML = rows.map(r => `
    <tr>
      <td>${r.label}</td>
      <td class="${r.gps ? 'gps-value' : ''}">${r.value}</td>
    </tr>
  `).join('');
}

// ── Render AI Result ───────────────────────────────────
function renderAIResult(ai) {
  const container = document.getElementById('ai-result-container');

  const tags = [
    ai.country ? `<span class="location-tag tag-country">🌍 ${ai.country}</span>` : '',
    ai.region  ? `<span class="location-tag tag-region">📍 ${ai.region}</span>`  : '',
    ai.city    ? `<span class="location-tag tag-city">🏙️ ${ai.city}</span>`      : '',
    `<span class="location-tag tag-source">${ai.source === 'exif_gps' ? '🛰️ EXIF GPS' : ai.source === 'both' ? '🔀 Both' : '🤖 AI Vision'}</span>`
  ].filter(Boolean).join('');

  const lat = ai.coordinates?.lat;
  const lon = ai.coordinates?.lon;
  const coordText = (lat && lon)
    ? `${lat.toFixed(6)}°, ${lon.toFixed(6)}°`
    : 'Coordinates unavailable';

  container.innerHTML = `
    <div class="location-tags">${tags}</div>

    <div class="ai-coords">${coordText}</div>

    <div class="ai-reasoning">${ai.reasoning || 'No reasoning provided.'}</div>

    <div class="ai-detail-grid">
      <div class="ai-detail-item">
        <div class="ai-detail-label">Landmarks</div>
        <div class="ai-detail-value">${ai.landmarks || '—'}</div>
      </div>
      <div class="ai-detail-item">
        <div class="ai-detail-label">Climate</div>
        <div class="ai-detail-value">${ai.climate || '—'}</div>
      </div>
      <div class="ai-detail-item">
        <div class="ai-detail-label">Time / Season</div>
        <div class="ai-detail-value">${ai.timeEstimate || '—'}</div>
      </div>
      <div class="ai-detail-item">
        <div class="ai-detail-label">Language</div>
        <div class="ai-detail-value">${ai.language || '—'}</div>
      </div>
    </div>

    <div class="confidence-bar-wrap">
      <div class="confidence-header">
        <span class="confidence-label">Confidence</span>
        <span class="confidence-value">${ai.confidence}%</span>
      </div>
      <div class="confidence-bar-bg">
        <div class="confidence-bar-fill" id="conf-bar"></div>
      </div>
    </div>
  `;

  // Animate confidence bar
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      const bar = document.getElementById('conf-bar');
      if (bar) bar.style.width = `${ai.confidence}%`;
    });
  });
}

// ── Leaflet Map ────────────────────────────────────────
function plotMap(lat, lon, label) {
  const mapEl = document.getElementById('leaflet-map');
  const placeholder = document.getElementById('map-placeholder');

  if (placeholder) placeholder.style.display = 'none';
  mapEl.style.display = 'block';

  if (!leafletMap) {
    leafletMap = L.map('leaflet-map', {
      zoomControl: true,
      attributionControl: false
    }).setView([lat, lon], 13);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19
    }).addTo(leafletMap);
  } else {
    leafletMap.setView([lat, lon], 13);
  }

  if (leafletMarker) leafletMarker.remove();

  const icon = L.divIcon({
    html: `<div style="
      width:16px;height:16px;
      background:linear-gradient(135deg,#7c3aed,#06b6d4);
      border-radius:50%;
      border:2px solid #fff;
      box-shadow:0 0 20px rgba(6,182,212,0.6);
    "></div>`,
    iconSize: [16, 16],
    iconAnchor: [8, 8],
    className: ''
  });

  leafletMarker = L.marker([lat, lon], { icon })
    .addTo(leafletMap)
    .bindPopup(`<b>${label}</b><br>${lat.toFixed(5)}, ${lon.toFixed(5)}`)
    .openPopup();

  setTimeout(() => leafletMap.invalidateSize(), 100);
}

// ── History ────────────────────────────────────────────
async function refreshHistory() {
  const container = document.getElementById('history-grid');
  container.innerHTML = '<div style="color:var(--text-muted);font-size:14px;">Loading…</div>';

  try {
    const items = await GeoEngine.loadUserHistory(currentUser.uid, 50);
    if (!items.length) {
      container.innerHTML = '<div style="color:var(--text-muted);font-size:14px;padding:24px 0;">No searches yet. Upload a photo to get started.</div>';
      return;
    }

    container.innerHTML = items.map(item => {
      const ts   = item.timestamp?.toDate ? item.timestamp.toDate() : new Date();
      const conf = item.result?.confidence || 0;
      const loc  = [item.result?.city, item.result?.country].filter(Boolean).join(', ') || 'Unknown Location';
      const isGPS = item.exif?.hasGPS;

      return `
        <div class="history-card" onclick="showHistoryResult('${item.id}')">
          <div class="history-card-img">🖼️</div>
          <div class="history-card-body">
            <div class="history-card-name">${item.fileName || 'Photo'}</div>
            <div class="history-card-location">
              📍 ${loc}
              ${isGPS ? '<span class="gps-badge">🛰️ GPS</span>' : ''}
            </div>
            <div class="history-card-meta">
              <span class="history-card-date">${ts.toLocaleDateString()}</span>
              <span class="history-card-conf">${conf}%</span>
            </div>
          </div>
          <div class="history-card-actions" onclick="event.stopPropagation()">
            <button class="btn-sm btn-sm-danger" onclick="deleteHistoryItem('${item.id}')">Delete</button>
          </div>
        </div>
      `;
    }).join('');
  } catch (err) {
    container.innerHTML = '<div style="color:#fca5a5;font-size:14px;">Failed to load history.</div>';
    console.error(err);
  }
}

async function deleteHistoryItem(id) {
  await GeoEngine.deleteSearch(id);
  showToast('Entry deleted.', 'info');
  refreshHistory();
}

function showHistoryResult(id) {
  showToast('Loading search result…', 'info');
  // Could expand to show full result in a modal — simplified to show section
}

// ── Utilities ──────────────────────────────────────────
function formatFileSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function resetAnalyzerState() {
  document.getElementById('ai-result-container').innerHTML = `
    <div style="color:var(--text-muted);font-size:14px;padding:24px;text-align:center;">
      Click "ANALYZE LOCATION" to start AI analysis
    </div>`;

  document.getElementById('map-placeholder').style.display = 'flex';
  document.getElementById('leaflet-map').style.display = 'none';
  document.getElementById('map-address').textContent = '';
  document.getElementById('btn-analyze').disabled = true;

  if (leafletMap) { leafletMap.remove(); leafletMap = null; }
  if (leafletMarker) { leafletMarker = null; }

  setPanelStatus('ai-status', 'standby');
}

function setPanelStatus(id, status) {
  const el = document.getElementById(id);
  if (!el) return;
  el.className = `panel-status ${status}`;
  el.textContent = status === 'standby' ? 'STANDBY' : status === 'scanning' ? 'SCANNING...' : status === 'complete' ? 'COMPLETE' : 'ERROR';
}

let toastTimeout;
function showToast(msg, type = 'info') {
  const existing = document.getElementById('app-toast');
  if (existing) existing.remove();
  clearTimeout(toastTimeout);

  const toast = document.createElement('div');
  toast.id = 'app-toast';
  toast.className = `toast toast-${type}`;
  const icons = { success: '✅', error: '❌', info: 'ℹ️' };
  toast.innerHTML = `<span>${icons[type] || 'ℹ️'}</span> ${msg}`;
  document.body.appendChild(toast);

  toastTimeout = setTimeout(() => toast.remove(), 4000);
}

window.deleteHistoryItem = deleteHistoryItem;
window.showHistoryResult = showHistoryResult;
window.showSection = showSection;
