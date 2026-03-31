/* ================================================================
   GEOTRACE — js/app.js
   GeoSpy-style map: Satellite tiles, cinematic flyTo,
   neon crosshair markers, confidence radius, HUD overlay
   ================================================================ */

import { auth, onAuthStateChanged, signInWithGoogle, signOutUser, saveSearch, getMySearches }
  from './firebase-config.js';

/* ── State ── */
let currentUser = null, currentFile = null, currentExif = null;
let mapInstance = null, mapMarker = null, confidenceCircle = null, lastResult = null;

/* ── Map tile layers ── */
const TILES = {
  satellite: {
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    opts: {
      attribution: 'Tiles © Esri — Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community',
      maxZoom: 19,
    },
    label: 'SATELLITE',
  },
  dark: {
    url: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
    opts: {
      attribution: '© OpenStreetMap contributors © CARTO',
      maxZoom: 19,
      subdomains: 'abcd',
    },
    label: 'DARK STREET',
  },
};

let activeTileLayer = null;
let activeLayerKey  = 'satellite';

/* ── DOM refs ── */
const $ = (id) => document.getElementById(id);
const uploadZone     = $('uploadZone');
const fileInput      = $('fileInput');
const imgPreviewWrap = $('imgPreviewWrap');
const imgPreview     = $('imgPreview');
const imgFilename    = $('imgFilename');
const clearImgBtn    = $('clearImg');
const exifPanel      = $('exifPanel');
const exifTable      = $('exifTable').querySelector('tbody');
const exifGpsStatus  = $('exifGpsStatus');
const aiPanel        = $('aiPanel');
const aiStatus       = $('aiStatus');
const aiContent      = $('aiContent');
const runAIBtn       = $('runAIBtn');
const mapEl          = $('map');
const mapPlaceholder = $('mapPlaceholder');
const locationResult = $('locationResult');
const resultAddress  = $('resultAddress');
const resultCoords   = $('resultCoords');
const resultSource   = $('resultSource');
const resultConfidence = $('resultConfidence');
const resultIcon     = $('resultIcon');
const copyCoordsBtn  = $('copyCoords');
const openMapsBtn    = $('openMaps');
const signInBtn      = $('signInBtn');
const signOutBtn     = $('signOutBtn');
const userInfo       = $('userInfo');
const userAvatar     = $('userAvatar');
const userName       = $('userName');
const historyPanel   = $('historyPanel');
const historyList    = $('historyList');
const refreshHistBtn = $('refreshHistory');

/* HUD elements */
const mapHud    = $('mapHud');
const hudCoords = $('hudCoords');
const hudLoc    = $('hudLocation');
const hudConfPct = $('hudConfPct');
const hudConfBar = $('hudConfBar');
const hudSourceText = $('hudSourceText');

const toast = (msg, type, dur) => window.GeoTrace?.toast(msg, type, dur);

/* ================================================================
   AUTH
   ================================================================ */
onAuthStateChanged(auth, async (user) => {
  currentUser = user;
  if (user) {
    signInBtn.style.display    = 'none';
    userInfo.style.display     = 'flex';
    userAvatar.src             = user.photoURL || '';
    userName.textContent       = user.displayName || user.email;
    historyPanel.style.display = 'block';
    loadHistory();
  } else {
    signInBtn.style.display    = 'inline-block';
    userInfo.style.display     = 'none';
    historyPanel.style.display = 'none';
  }
});

signInBtn.addEventListener('click', async () => {
  try { await signInWithGoogle(); }
  catch (e) { toast('Sign-in failed: ' + e.message, 'error'); }
});

signOutBtn.addEventListener('click', async () => {
  await signOutUser();
  toast('Signed out', 'info');
});

/* ================================================================
   UPLOAD
   ================================================================ */
function setupUpload() {
  uploadZone.addEventListener('click', () => fileInput.click());
  uploadZone.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') fileInput.click();
  });
  fileInput.addEventListener('change', (e) => {
    if (e.target.files[0]) handleFile(e.target.files[0]);
  });
  uploadZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    uploadZone.classList.add('drag-over');
  });
  uploadZone.addEventListener('dragleave', () => uploadZone.classList.remove('drag-over'));
  uploadZone.addEventListener('drop', (e) => {
    e.preventDefault();
    uploadZone.classList.remove('drag-over');
    const f = e.dataTransfer.files[0];
    if (f && f.type.startsWith('image/')) handleFile(f);
    else toast('Please drop an image file', 'warn');
  });
  clearImgBtn.addEventListener('click', clearAll);
}

async function handleFile(file) {
  currentFile = file;
  resetMapUI();
  const url = URL.createObjectURL(file);
  imgPreview.src = url;
  imgFilename.textContent = file.name;
  imgPreviewWrap.style.display = 'block';
  uploadZone.style.display     = 'none';
  exifPanel.style.display      = 'none';
  aiPanel.style.display        = 'none';

  try {
    toast('Reading EXIF metadata...', 'info', 2000);
    const exif = await exifr.parse(file, {
      tiff: true, exif: true, gps: true,
      icc: false, iptc: false, xmp: false, mergeOutput: false,
    });
    currentExif = exif;
    renderExif(exif);
  } catch (err) {
    console.warn('EXIF error:', err);
    renderExif(null);
  }
  aiPanel.style.display = 'block';
  aiContent.innerHTML = '<p class="ai-placeholder">Click "Run AI Analysis" to identify location from visual landmarks using Claude AI.</p>';
  runAIBtn.style.display = 'inline-block';
}

function clearAll() {
  currentFile = null; currentExif = null; lastResult = null;
  imgPreview.src = ''; imgPreviewWrap.style.display = 'none';
  uploadZone.style.display = 'block'; exifPanel.style.display = 'none';
  aiPanel.style.display = 'none'; fileInput.value = '';
  resetMapUI();
}

/* ================================================================
   EXIF
   ================================================================ */
const EXIF_LABELS = {
  Make: 'Camera make', Model: 'Camera model', Software: 'Software',
  DateTime: 'Date & time', DateTimeOriginal: 'Taken at', ExposureTime: 'Exposure',
  FNumber: 'Aperture', ISOSpeedRatings: 'ISO', FocalLength: 'Focal length',
  Flash: 'Flash', GPSLatitude: 'GPS Latitude', GPSLongitude: 'GPS Longitude',
  GPSAltitude: 'GPS Altitude', ImageWidth: 'Width', ImageHeight: 'Height',
  PixelXDimension: 'Pixel width', PixelYDimension: 'Pixel height',
};

function renderExif(exif) {
  exifPanel.style.display = 'block';
  exifTable.innerHTML     = '';
  if (!exif || Object.keys(exif).length === 0) {
    exifGpsStatus.textContent = 'NO EXIF';
    exifGpsStatus.className   = 'exif-badge badge-red';
    exifTable.innerHTML = '<tr><td colspan="2" style="color:var(--text-muted);padding:var(--s4)">No EXIF metadata found.</td></tr>';
    return;
  }
  const flat = {};
  Object.entries(exif).forEach(([, section]) => {
    if (section && typeof section === 'object' && !Array.isArray(section))
      Object.entries(section).forEach(([k, v]) => { flat[k] = v; });
  });
  const lat = flat.latitude  ?? flat.GPSLatitude;
  const lng = flat.longitude ?? flat.GPSLongitude;
  const hasGPS = lat != null && lng != null;
  if (hasGPS) {
    exifGpsStatus.textContent = '✓ GPS FOUND';
    exifGpsStatus.className   = 'exif-badge badge-green';
    setTimeout(() => locateFromGPS(lat, lng), 300);
  } else {
    exifGpsStatus.textContent = 'NO GPS';
    exifGpsStatus.className   = 'exif-badge badge-red';
  }
  let rowCount = 0;
  new Set([...Object.keys(EXIF_LABELS), ...Object.keys(flat).slice(0, 30)]).forEach((key) => {
    let val = flat[key];
    if (val == null || rowCount > 25) return;
    const label = EXIF_LABELS[key] || key;
    const isGPS = key.startsWith('GPS') || key === 'latitude' || key === 'longitude';
    if (typeof val === 'number') val = Number(val.toFixed(6)).toString();
    if (val instanceof Date)     val = val.toLocaleString();
    if (typeof val === 'object') val = JSON.stringify(val).slice(0, 60);
    val = String(val).slice(0, 80);
    const row = exifTable.insertRow();
    row.innerHTML = `<td>${escapeHtml(label)}</td><td class="${isGPS ? 'gps-highlight' : ''}">${escapeHtml(val)}</td>`;
    rowCount++;
  });
}

/* ================================================================
   GPS & MAP
   ================================================================ */
async function locateFromGPS(lat, lng) {
  toast('📍 GPS found! Flying to location...', 'success', 2500);
  showMap(lat, lng, null);
  try {
    const res  = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json`, { headers: { 'Accept-Language': 'en' } });
    const data = await res.json();
    const addr = data.display_name || `${Number(lat).toFixed(4)}°N, ${Number(lng).toFixed(4)}°E`;
    showLocationResult({ lat, lng, address: addr, source: 'EXIF GPS', confidence: null });
    updateHUD({ lat, lng, address: addr, source: 'EXIF GPS', confidence: 100 });
    lastResult = { lat, lng, address: addr, source: 'exif', exifData: currentExif };
    saveResultToFirebase(addr, null);
  } catch {
    showLocationResult({ lat, lng, address: 'Reverse geocode unavailable', source: 'EXIF GPS', confidence: null });
  }
}

/* ── Map init & tile switching ── */
function initMap() {
  if (mapInstance) return;
  mapInstance = L.map('map', {
    zoomControl: true,
    attributionControl: true,
    zoomAnimation: true,
  }).setView([20, 0], 2);

  // Default satellite tile
  activeTileLayer = L.tileLayer(TILES.satellite.url, TILES.satellite.opts).addTo(mapInstance);

  // Build layer toggle buttons
  buildLayerToggle();

  setTimeout(() => mapInstance.invalidateSize(), 100);
}

function buildLayerToggle() {
  // Remove any existing toggle
  const existing = document.querySelector('.map-layer-toggle');
  if (existing) existing.remove();

  const wrap = document.createElement('div');
  wrap.className = 'map-layer-toggle';

  Object.entries(TILES).forEach(([key, tile]) => {
    const btn = document.createElement('button');
    btn.className = 'layer-btn' + (key === activeLayerKey ? ' active' : '');
    btn.textContent = tile.label;
    btn.addEventListener('click', () => switchLayer(key, wrap));
    wrap.appendChild(btn);
  });

  document.querySelector('.map-wrap').appendChild(wrap);
}

function switchLayer(key, toggleWrap) {
  if (key === activeLayerKey) return;
  if (activeTileLayer) mapInstance.removeLayer(activeTileLayer);
  activeTileLayer = L.tileLayer(TILES[key].url, TILES[key].opts).addTo(mapInstance);
  activeLayerKey  = key;

  // Update button states
  toggleWrap.querySelectorAll('.layer-btn').forEach((b, i) => {
    b.classList.toggle('active', Object.keys(TILES)[i] === key);
  });

  toast('Map: ' + TILES[key].label, 'info', 1500);
}

/* ── GeoSpy neon crosshair marker ── */
function createGeoSpyMarker(lat, lng) {
  if (mapMarker) { mapMarker.remove(); mapMarker = null; }

  const icon = L.divIcon({
    className: '',
    html: `
      <div class="geospy-marker-wrap">
        <div class="geospy-marker-ping"></div>
        <div class="geospy-marker-ping"></div>
        <div class="geospy-marker-ping"></div>
        <div class="geospy-marker-scan"></div>
        <div class="geospy-marker-crosshair"></div>
        <div class="geospy-marker-core"></div>
        <div class="geospy-marker-dot"></div>
      </div>`,
    iconSize:   [60, 60],
    iconAnchor: [30, 30],
    popupAnchor:[0, -32],
  });

  mapMarker = L.marker([lat, lng], { icon }).addTo(mapInstance);
  return mapMarker;
}

/* ── Confidence radius circle ── */
function createConfidenceCircle(lat, lng, confidence) {
  if (confidenceCircle) { confidenceCircle.remove(); confidenceCircle = null; }

  // Map confidence to radius in meters:
  // 100% → 200m  |  70% → 10km  |  50% → 40km  |  30% → 100km
  const conf  = Math.max(5, Math.min(100, confidence || 50));
  const t     = 1 - (conf / 100);                // 0=high conf, 1=low conf
  const radius = Math.round(200 + t * t * 120000); // exponential growth

  confidenceCircle = L.circle([lat, lng], {
    radius,
    className:   'confidence-circle',
    color:       '#06b6d4',
    weight:      1.5,
    opacity:     0.7,
    dashArray:   '6 4',
    fillColor:   '#06b6d4',
    fillOpacity: 0.05,
    interactive: false,
  }).addTo(mapInstance);

  return confidenceCircle;
}

/* ── Show map with cinematic flyTo ── */
function showMap(lat, lng, confidence) {
  mapPlaceholder.style.display = 'none';
  mapEl.style.display          = 'block';
  initMap();

  // Determine zoom based on confidence
  const conf = confidence || 85;
  let zoom = 16;
  if (conf < 40) zoom = 7;
  else if (conf < 60) zoom = 10;
  else if (conf < 75) zoom = 13;
  else if (conf < 90) zoom = 15;

  // Cinematic flyTo — the GeoSpy signature move
  mapInstance.flyTo([lat, lng], zoom, {
    animate:  true,
    duration: 2.5,
    easeLinearity: 0.25,
  });

  setTimeout(() => {
    createGeoSpyMarker(lat, lng);
    if (confidence) createConfidenceCircle(lat, lng, confidence);
  }, 800); // place marker mid-flight

  setTimeout(() => mapInstance.invalidateSize(), 100);
}

/* ── HUD update ── */
function updateHUD({ lat, lng, address, source, confidence }) {
  mapHud.classList.add('visible');

  hudCoords.textContent = `${Number(lat).toFixed(5)}°N, ${Number(lng).toFixed(5)}°E`;

  // Short location (first two parts of address)
  const shortAddr = address
    ? address.split(',').slice(0, 2).join(', ')
    : '—';
  hudLoc.textContent = shortAddr;

  const conf = confidence || 0;
  hudConfPct.textContent = conf + '%';
  hudConfBar.style.width = conf + '%';

  // Color confidence bar by level
  if (conf >= 85) {
    hudConfBar.style.background = 'linear-gradient(90deg, #10b981, #06b6d4)';
    hudConfPct.style.color = '#34d399';
  } else if (conf >= 60) {
    hudConfBar.style.background = 'linear-gradient(90deg, #fbbf24, #06b6d4)';
    hudConfPct.style.color = '#fbbf24';
  } else {
    hudConfBar.style.background = 'linear-gradient(90deg, #f87171, #fbbf24)';
    hudConfPct.style.color = '#f87171';
  }

  hudSourceText.textContent = source || '—';
}

function showLocationResult({ lat, lng, address, source, confidence }) {
  locationResult.style.display = 'flex';
  resultAddress.textContent    = address;
  resultCoords.textContent     = `${Number(lat).toFixed(5)}°N, ${Number(lng).toFixed(5)}°E`;
  resultSource.textContent     = `SOURCE: ${source}`;

  if (confidence != null) {
    resultConfidence.textContent = confidence + '%';
    resultIcon.textContent       = '🎯';
  } else {
    resultConfidence.textContent = '';
    resultIcon.textContent       = '📍';
  }

  copyCoordsBtn.style.display = 'inline-block';
  openMapsBtn.style.display   = 'inline-block';

  copyCoordsBtn.onclick = () => {
    navigator.clipboard.writeText(`${lat}, ${lng}`);
    toast('Coordinates copied!', 'success', 2000);
  };
  openMapsBtn.onclick = () => window.open(`https://www.google.com/maps?q=${lat},${lng}`, '_blank');
}

function resetMapUI() {
  mapEl.style.display          = 'none';
  mapPlaceholder.style.display = 'flex';
  locationResult.style.display = 'none';
  copyCoordsBtn.style.display  = 'none';
  openMapsBtn.style.display    = 'none';
  mapHud.classList.remove('visible');
  if (mapMarker)         { mapMarker.remove();         mapMarker         = null; }
  if (confidenceCircle)  { confidenceCircle.remove();  confidenceCircle  = null; }
}

function hasGPSResult() {
  return locationResult.style.display === 'flex' && resultSource.textContent.includes('EXIF');
}

/* ================================================================
   CLAUDE AI — server-side API key via /api/analyze
   ================================================================ */
runAIBtn.addEventListener('click', runAIAnalysis);

async function runAIAnalysis() {
  if (!currentFile) return;
  runAIBtn.disabled    = true;
  runAIBtn.textContent = 'Analyzing...';
  aiStatus.textContent = 'RUNNING';
  aiStatus.className   = 'exif-badge badge-gold';
  aiContent.innerHTML  = `
    <div style="display:flex;flex-direction:column;align-items:center;gap:16px;padding:32px;">
      <div class="spinner"></div>
      <div style="font-family:var(--font-mono);font-size:12px;color:var(--neon-cyan);letter-spacing:2px;">CLAUDE IS ANALYZING...</div>
      <div style="font-size:13px;color:var(--text-muted);">Examining landmarks, architecture, terrain...</div>
    </div>`;
  try {
    const b64       = await fileToBase64(currentFile);
    const mediaType = currentFile.type || 'image/jpeg';
    const response  = await fetch('/api/analyze', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ imageBase64: b64, mediaType }),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'API error ' + response.status);
    const text   = data.content?.[0]?.text || '';
    const parsed = parseAIResponse(text);
    renderAIResult(parsed);
  } catch (err) {
    console.error('AI error:', err);
    aiContent.innerHTML = `<div class="ai-result" style="color:var(--neon-red);"><strong>Analysis failed:</strong><br>${escapeHtml(err.message)}</div>`;
    aiStatus.textContent = 'ERROR';
    aiStatus.className   = 'exif-badge badge-red';
  }
  runAIBtn.disabled    = false;
  runAIBtn.textContent = 'Run AI Analysis →';
}

function parseAIResponse(text) {
  try {
    const m = text.match(/\{[\s\S]*\}/);
    if (m) return JSON.parse(m[0]);
  } catch {}
  return { location: 'Unknown', confidence: 0, reasoning: text, lat: null, lng: null };
}

function renderAIResult(parsed) {
  const conf = parsed.confidence || 0;
  const loc  = parsed.location   || 'Unknown';
  const lat  = parsed.lat;
  const lng  = parsed.lng;

  aiStatus.textContent = 'COMPLETE';
  aiStatus.className   = 'exif-badge badge-green';

  aiContent.innerHTML = `
    <div class="ai-result">
      <h4>📍 ${escapeHtml(loc)}</h4>
      ${parsed.region ? `<div style="color:var(--text-muted);font-size:12px;margin-bottom:8px;">${escapeHtml(parsed.region)}</div>` : ''}
      <div class="ai-confidence">🎯 ${conf}% CONFIDENCE</div>
      <p>${escapeHtml(parsed.reasoning || 'No reasoning provided.')}</p>
      ${lat && lng ? `<div style="font-family:var(--font-mono);font-size:11px;color:var(--neon-cyan);margin-top:4px;">Est: ${Number(lat).toFixed(4)}°N, ${Number(lng).toFixed(4)}°E</div>` : ''}
    </div>`;

  if (lat && lng && !hasGPSResult()) {
    showMap(lat, lng, conf);
    showLocationResult({ lat, lng, address: loc, source: 'Claude AI', confidence: conf });
    updateHUD({ lat, lng, address: loc, source: 'CLAUDE AI', confidence: conf });
    lastResult = { lat, lng, address: loc, source: 'ai', confidence: conf, aiSummary: parsed.reasoning };
    saveResultToFirebase(loc, conf);
  }

  toast(`AI located: ${loc} (${conf}% confidence)`, 'success');
}

/* ================================================================
   FIREBASE HISTORY
   ================================================================ */
async function saveResultToFirebase(address, confidence) {
  if (!currentUser || !currentFile) return;
  try {
    await saveSearch(currentUser.uid, {
      filename:   currentFile.name,
      lat:        lastResult?.lat,
      lng:        lastResult?.lng,
      address,
      source:     lastResult?.source || 'exif',
      aiSummary:  lastResult?.aiSummary || null,
      confidence: confidence || null,
    });
    loadHistory();
  } catch (err) { console.warn('Firebase save failed:', err); }
}

async function loadHistory() {
  if (!currentUser) return;
  historyList.innerHTML = '<div class="history-empty"><div class="spinner"></div></div>';
  try {
    const searches = await getMySearches(currentUser.uid, 15);
    if (!searches.length) {
      historyList.innerHTML = '<div class="history-empty">No searches yet. Upload a photo!</div>';
      return;
    }
    historyList.innerHTML = searches.map((s) => {
      const icon = s.source === 'exif' ? '🛰️' : s.source === 'ai' ? '🤖' : '❓';
      const addr = s.address ? s.address.split(',').slice(0, 2).join(',') : 'Unknown location';
      return `<div class="history-item">
        <span class="history-item-icon">${icon}</span>
        <div style="flex:1;min-width:0;">
          <div class="history-item-name">${escapeHtml(s.filename || 'Image')}</div>
          <div class="history-item-addr">${escapeHtml(addr)}</div>
        </div>
        <span class="history-item-src src-${s.source || 'none'}">${(s.source || 'none').toUpperCase()}</span>
      </div>`;
    }).join('');
  } catch {
    historyList.innerHTML = '<div class="history-empty" style="color:var(--neon-red);">Failed to load history</div>';
  }
}

refreshHistBtn.addEventListener('click', loadHistory);

/* ================================================================
   UTILS
   ================================================================ */
function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload  = () => resolve(r.result.split(',')[1]);
    r.onerror = reject;
    r.readAsDataURL(file);
  });
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/* ── Init ── */
setupUpload();
