/* ================================================================
   GEOTRACE — app.js
   Main application: EXIF extraction, Leaflet map, Claude AI,
   Firebase auth & Firestore history
   ================================================================ */

import {
  auth, onAuthStateChanged,
  signInWithGoogle, signOutUser,
  saveSearch, getMySearches,
} from './firebase-config.js';

/* ================================================================
   STATE
   ================================================================ */
let currentUser  = null;
let currentFile  = null;
let currentExif  = null;
let mapInstance  = null;
let mapMarker    = null;
let lastResult   = null;

/* ================================================================
   DOM REFS
   ================================================================ */
const $ = (id) => document.getElementById(id);

const uploadZone    = $('uploadZone');
const fileInput     = $('fileInput');
const imgPreviewWrap = $('imgPreviewWrap');
const imgPreview    = $('imgPreview');
const imgFilename   = $('imgFilename');
const clearImgBtn   = $('clearImg');

const exifPanel     = $('exifPanel');
const exifTable     = $('exifTable').querySelector('tbody');
const exifGpsStatus = $('exifGpsStatus');

const aiPanel       = $('aiPanel');
const aiStatus      = $('aiStatus');
const aiContent     = $('aiContent');
const runAIBtn      = $('runAIBtn');

const mapEl         = $('map');
const mapPlaceholder = $('mapPlaceholder');
const locationResult = $('locationResult');
const resultAddress = $('resultAddress');
const resultCoords  = $('resultCoords');
const resultSource  = $('resultSource');
const resultConfidence = $('resultConfidence');
const copyCoordsBtn = $('copyCoords');
const openMapsBtn   = $('openMaps');

const signInBtn     = $('signInBtn');
const signOutBtn    = $('signOutBtn');
const userInfo      = $('userInfo');
const userAvatar    = $('userAvatar');
const userName      = $('userName');

const apiKeyInput   = $('apiKeyInput');
const apiKeyToggle  = $('apiKeyToggle');
const apiKeyStatus  = $('apiKeyStatus');

const historyPanel  = $('historyPanel');
const historyList   = $('historyList');
const refreshHistBtn = $('refreshHistory');

const toast = (msg, type, dur) => window.GeoTrace?.toast(msg, type, dur);

/* ================================================================
   API KEY MANAGEMENT
   ================================================================ */
// Load saved key from sessionStorage (never localStorage for security)
function loadApiKey() {
  const saved = sessionStorage.getItem('gt_api_key');
  if (saved) {
    apiKeyInput.value = saved;
    apiKeyStatus.textContent = '● SAVED';
    apiKeyStatus.className   = 'api-key-status ok';
  }
}

function getApiKey() {
  return apiKeyInput.value.trim();
}

apiKeyInput.addEventListener('input', () => {
  const key = apiKeyInput.value.trim();
  if (key.startsWith('sk-ant-')) {
    sessionStorage.setItem('gt_api_key', key);
    apiKeyStatus.textContent = '● SAVED';
    apiKeyStatus.className   = 'api-key-status ok';
  } else if (key) {
    apiKeyStatus.textContent = '● INVALID';
    apiKeyStatus.className   = 'api-key-status err';
  } else {
    apiKeyStatus.textContent = '';
    sessionStorage.removeItem('gt_api_key');
  }
  updateAIPanel();
});

apiKeyToggle.addEventListener('click', () => {
  apiKeyInput.type = apiKeyInput.type === 'password' ? 'text' : 'password';
});

/* ================================================================
   AUTH
   ================================================================ */
onAuthStateChanged(auth, async (user) => {
  currentUser = user;
  if (user) {
    signInBtn.style.display  = 'none';
    userInfo.style.display   = 'flex';
    userAvatar.src           = user.photoURL || '';
    userName.textContent     = user.displayName || user.email;
    historyPanel.style.display = 'block';
    loadHistory();
  } else {
    signInBtn.style.display  = 'inline-block';
    userInfo.style.display   = 'none';
    historyPanel.style.display = 'none';
  }
});

signInBtn.addEventListener('click', async () => {
  try {
    await signInWithGoogle();
  } catch (e) {
    toast('Sign-in failed: ' + e.message, 'error');
  }
});

signOutBtn.addEventListener('click', async () => {
  await signOutUser();
  toast('Signed out', 'info');
});

/* ================================================================
   FILE UPLOAD
   ================================================================ */
function setupUpload() {
  // Click to browse
  uploadZone.addEventListener('click', () => fileInput.click());
  uploadZone.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') fileInput.click();
  });

  fileInput.addEventListener('change', (e) => {
    if (e.target.files[0]) handleFile(e.target.files[0]);
  });

  // Drag & drop
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
  resetResults();

  // Show preview
  const url = URL.createObjectURL(file);
  imgPreview.src        = url;
  imgFilename.textContent = file.name;
  imgPreviewWrap.style.display = 'block';
  uploadZone.style.display     = 'none';

  // Parse EXIF
  try {
    toast('Reading EXIF metadata...', 'info', 2000);
    const exif = await exifr.parse(file, {
      tiff: true, exif: true, gps: true,
      icc: false, iptc: false, xmp: false,
      mergeOutput: false,
    });
    currentExif = exif;
    renderExif(exif);
  } catch (err) {
    console.warn('EXIF parse error:', err);
    renderExif(null);
  }

  // Show AI panel
  aiPanel.style.display = 'block';
  updateAIPanel();
}

function clearAll() {
  currentFile = null;
  currentExif = null;
  lastResult  = null;
  imgPreview.src = '';
  imgPreviewWrap.style.display = 'none';
  uploadZone.style.display     = 'block';
  exifPanel.style.display      = 'none';
  aiPanel.style.display        = 'none';
  resetMapUI();
  fileInput.value = '';
}

function resetResults() {
  resetMapUI();
}

/* ================================================================
   EXIF RENDERING
   ================================================================ */
const EXIF_LABELS = {
  Make:             'Camera make',
  Model:            'Camera model',
  Software:         'Software',
  DateTime:         'Date & time',
  DateTimeOriginal: 'Taken at',
  ExposureTime:     'Exposure',
  FNumber:          'Aperture',
  ISOSpeedRatings:  'ISO',
  FocalLength:      'Focal length',
  Flash:            'Flash',
  GPSLatitude:      'GPS Latitude',
  GPSLongitude:     'GPS Longitude',
  GPSAltitude:      'GPS Altitude',
  ImageWidth:       'Width',
  ImageHeight:      'Height',
  Orientation:      'Orientation',
  ColorSpace:       'Color space',
  WhiteBalance:     'White balance',
  PixelXDimension:  'Pixel width',
  PixelYDimension:  'Pixel height',
};

function renderExif(exif) {
  exifPanel.style.display = 'block';
  exifTable.innerHTML = '';

  if (!exif || Object.keys(exif).length === 0) {
    exifGpsStatus.textContent = 'NO EXIF';
    exifGpsStatus.className   = 'exif-badge badge-red';
    const row = exifTable.insertRow();
    row.innerHTML = `<td colspan="2" style="color:var(--text-muted);padding:var(--s4)">No EXIF metadata found in this image.</td>`;
    return;
  }

  // Flatten nested exif sections
  const flat = {};
  Object.entries(exif).forEach(([section, data]) => {
    if (data && typeof data === 'object' && !Array.isArray(data)) {
      Object.entries(data).forEach(([k, v]) => { flat[k] = v; });
    }
  });

  // Check for GPS
  const lat = flat.latitude  ?? flat.GPSLatitude;
  const lng = flat.longitude ?? flat.GPSLongitude;
  const hasGPS = lat != null && lng != null;

  if (hasGPS) {
    exifGpsStatus.textContent = '✓ GPS FOUND';
    exifGpsStatus.className   = 'exif-badge badge-green';
    // Auto-locate from EXIF GPS
    setTimeout(() => locateFromGPS(lat, lng), 300);
  } else {
    exifGpsStatus.textContent = 'NO GPS';
    exifGpsStatus.className   = 'exif-badge badge-red';
  }

  // Render table
  const allKeys = new Set([
    ...Object.keys(EXIF_LABELS),
    ...Object.keys(flat).slice(0, 30),
  ]);

  let rowCount = 0;
  allKeys.forEach((key) => {
    let val = flat[key];
    if (val == null) return;
    if (rowCount > 25) return;

    const label = EXIF_LABELS[key] || key;
    const isGPS = key.startsWith('GPS') || key === 'latitude' || key === 'longitude';

    // Format values
    if (typeof val === 'number') val = Number(val.toFixed(6)).toString();
    if (val instanceof Date)     val = val.toLocaleString();
    if (typeof val === 'object') val = JSON.stringify(val).slice(0, 60);
    val = String(val).slice(0, 80);

    const row = exifTable.insertRow();
    row.innerHTML = `
      <td>${label}</td>
      <td class="${isGPS ? 'gps-highlight' : ''}">${escapeHtml(val)}</td>
    `;
    rowCount++;
  });
}

/* ================================================================
   GPS LOCATE & MAP
   ================================================================ */
async function locateFromGPS(lat, lng) {
  toast('📍 GPS data found! Plotting on map...', 'success', 2500);
  showMap(lat, lng);

  // Reverse geocode via Nominatim (free/open-source)
  try {
    const res  = await fetch(
      `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json`,
      { headers: { 'Accept-Language': 'en' } }
    );
    const data = await res.json();
    const addr = data.display_name || `${lat.toFixed(4)}°N, ${lng.toFixed(4)}°E`;

    showLocationResult({
      lat, lng, address: addr, source: 'EXIF GPS', confidence: null,
    });

    lastResult = { lat, lng, address: addr, source: 'exif', exifData: currentExif };
    saveResultToFirebase(addr);
  } catch {
    showLocationResult({ lat, lng, address: 'Reverse geocode unavailable', source: 'EXIF GPS', confidence: null });
  }
}

function showMap(lat, lng) {
  mapPlaceholder.style.display = 'none';
  mapEl.style.display          = 'block';

  if (!mapInstance) {
    mapInstance = L.map('map', {
      zoomControl: true,
      attributionControl: true,
    }).setView([lat, lng], 14);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© <a href="https://openstreetmap.org">OpenStreetMap</a>',
      maxZoom: 19,
    }).addTo(mapInstance);
  } else {
    mapInstance.setView([lat, lng], 14);
    if (mapMarker) mapMarker.remove();
  }

  // Custom neon pin
  const icon = L.divIcon({
    html: `
      <div style="
        width:32px;height:32px;
        background:linear-gradient(135deg,#7c3aed,#06b6d4);
        border-radius:50% 50% 50% 0;
        transform:rotate(-45deg);
        box-shadow:0 0 20px rgba(6,182,212,0.6);
        border:2px solid rgba(255,255,255,0.3);
      "></div>
    `,
    className: '',
    iconSize: [32, 32],
    iconAnchor: [16, 32],
    popupAnchor: [0, -36],
  });

  mapMarker = L.marker([lat, lng], { icon }).addTo(mapInstance);
  mapMarker.bindPopup(`
    <div style="font-family:var(--font-mono);font-size:12px;color:#06b6d4;">
      📍 ${lat.toFixed(5)}°N, ${lng.toFixed(5)}°E
    </div>
  `).openPopup();

  // Fix Leaflet sizing after show
  setTimeout(() => mapInstance.invalidateSize(), 100);
}

function showLocationResult({ lat, lng, address, source, confidence }) {
  locationResult.style.display = 'flex';
  resultAddress.textContent    = address;
  resultCoords.textContent     = `${Number(lat).toFixed(5)}°N, ${Number(lng).toFixed(5)}°E`;
  resultSource.textContent     = `SOURCE: ${source}`;

  if (confidence) {
    resultConfidence.textContent = confidence + '%';
    resultIcon.textContent       = '🎯';
  } else {
    resultConfidence.textContent = '';
    resultIcon.textContent       = '📍';
  }

  // Show map controls
  copyCoordsBtn.style.display = 'inline-block';
  openMapsBtn.style.display   = 'inline-block';

  copyCoordsBtn.onclick = () => {
    navigator.clipboard.writeText(`${lat}, ${lng}`);
    toast('Coordinates copied!', 'success', 2000);
  };

  openMapsBtn.onclick = () => {
    window.open(`https://www.google.com/maps?q=${lat},${lng}`, '_blank');
  };
}

function resetMapUI() {
  mapEl.style.display          = 'none';
  mapPlaceholder.style.display = 'flex';
  locationResult.style.display = 'none';
  copyCoordsBtn.style.display  = 'none';
  openMapsBtn.style.display    = 'none';
  if (mapMarker) { mapMarker.remove(); mapMarker = null; }
}

/* ================================================================
   CLAUDE AI ANALYSIS
   ================================================================ */
function updateAIPanel() {
  if (!currentFile) return;
  const hasKey = getApiKey().startsWith('sk-ant-');
  runAIBtn.style.display = hasKey ? 'inline-block' : 'none';

  if (!hasKey) {
    aiContent.innerHTML = `<p class="ai-placeholder">
      Enter your Anthropic API key above to enable AI visual analysis.
      <a href="https://console.anthropic.com" target="_blank" style="color:var(--neon-cyan)">Get a key →</a>
    </p>`;
  }
}

runAIBtn.addEventListener('click', runAIAnalysis);

async function runAIAnalysis() {
  const key = getApiKey();
  if (!key.startsWith('sk-ant-')) {
    toast('Please enter a valid Anthropic API key', 'error');
    return;
  }
  if (!currentFile) return;

  runAIBtn.disabled = true;
  runAIBtn.textContent = 'Analyzing...';
  aiStatus.textContent = 'RUNNING';
  aiStatus.className   = 'exif-badge badge-gold';

  aiContent.innerHTML = `
    <div style="display:flex;flex-direction:column;align-items:center;gap:16px;padding:32px;">
      <div class="spinner"></div>
      <div style="font-family:var(--font-mono);font-size:12px;color:var(--neon-cyan);letter-spacing:2px;">CLAUDE IS ANALYZING...</div>
      <div style="font-size:13px;color:var(--text-muted);">Examining landmarks, architecture, terrain...</div>
    </div>
  `;

  try {
    // Convert image to base64
    const b64 = await fileToBase64(currentFile);
    const mediaType = currentFile.type || 'image/jpeg';

    // Call Anthropic API via Vercel serverless function
    // (prevents CORS issues and keeps routing clean)
    let response, data;

    try {
      response = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageBase64: b64, mediaType, apiKey: key }),
      });
      data = await response.json();
    } catch (fetchErr) {
      // Fallback: call Claude API directly from browser (requires CORS — may fail on some browsers)
      response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type':         'application/json',
          'x-api-key':            key,
          'anthropic-version':    '2023-06-01',
          'anthropic-dangerous-direct-browser-access': 'true',
        },
        body: JSON.stringify(buildClaudePayload(b64, mediaType)),
      });
      data = await response.json();
    }

    if (!response.ok) throw new Error(data.error?.message || 'API error ' + response.status);

    const text = data.content?.[0]?.text || data.text || '';
    const parsed = parseAIResponse(text);
    renderAIResult(parsed, text);

  } catch (err) {
    console.error('AI analysis error:', err);
    aiContent.innerHTML = `<div class="ai-result" style="color:var(--neon-red);">
      <strong>Analysis failed:</strong><br>${escapeHtml(err.message)}<br><br>
      <span style="color:var(--text-muted);font-size:12px;">
        Make sure your API key is valid and has vision model access.
      </span>
    </div>`;
    aiStatus.textContent = 'ERROR';
    aiStatus.className   = 'exif-badge badge-red';
  }

  runAIBtn.disabled = false;
  runAIBtn.textContent = 'Run AI Analysis →';
}

function buildClaudePayload(imageBase64, mediaType) {
  return {
    model:      'claude-opus-4-5',
    max_tokens: 1024,
    messages: [{
      role: 'user',
      content: [
        {
          type:   'image',
          source: { type: 'base64', media_type: mediaType, data: imageBase64 },
        },
        {
          type: 'text',
          text: `You are a geolocation expert. Analyze this image and determine where it was taken.

Look for:
- Landmarks, monuments, famous buildings
- Street signs, license plates, text in any language
- Architectural style and building materials
- Vegetation, terrain, climate indicators
- Traffic, road markings, vehicle types
- Cultural markers, clothing, signage style

Respond in exactly this JSON format (no markdown, raw JSON only):
{
  "location": "City, Country",
  "confidence": 85,
  "region": "Specific neighborhood or area if known",
  "reasoning": "2-3 sentences explaining visual clues",
  "lat": null_or_decimal,
  "lng": null_or_decimal
}

If you cannot determine the location at all, set confidence to 0 and location to "Unknown".`,
        },
      ],
    }],
  };
}

function parseAIResponse(text) {
  try {
    const match = text.match(/\{[\s\S]*\}/);
    if (match) return JSON.parse(match[0]);
  } catch {}
  return { location: 'Unknown', confidence: 0, reasoning: text, lat: null, lng: null };
}

function renderAIResult(parsed, rawText) {
  const conf = parsed.confidence || 0;
  const loc  = parsed.location  || 'Unknown';
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
      ${lat && lng ? `<div style="font-family:var(--font-mono);font-size:11px;color:var(--neon-cyan);">Estimated: ${lat.toFixed(4)}°N, ${lng.toFixed(4)}°E</div>` : ''}
    </div>
  `;

  // Show on map if we have coordinates and no GPS was found
  if (lat && lng && !hasGPSResult()) {
    showMap(lat, lng);
    showLocationResult({ lat, lng, address: loc, source: 'Claude AI', confidence: conf });
    lastResult = { lat, lng, address: loc, source: 'ai', confidence: conf, aiSummary: parsed.reasoning };
    saveResultToFirebase(loc, conf);
  }

  toast(`AI located: ${loc} (${conf}% confidence)`, 'success');
}

function hasGPSResult() {
  return locationResult.style.display === 'flex' && resultSource.textContent.includes('EXIF');
}

/* ================================================================
   FIREBASE HISTORY
   ================================================================ */
async function saveResultToFirebase(address, confidence) {
  if (!currentUser || !currentFile) return;
  try {
    const flat = currentExif ? flattenExif(currentExif) : null;
    await saveSearch(currentUser.uid, {
      filename:   currentFile.name,
      lat:        lastResult?.lat,
      lng:        lastResult?.lng,
      address:    address,
      source:     lastResult?.source || 'exif',
      aiSummary:  lastResult?.aiSummary || null,
      confidence: confidence || null,
      exifData:   flat ? JSON.stringify(flat).slice(0, 2000) : null,
    });
    loadHistory();
  } catch (err) {
    console.warn('Failed to save to Firebase:', err);
  }
}

async function loadHistory() {
  if (!currentUser) return;
  historyList.innerHTML = `<div class="history-empty"><div class="spinner"></div></div>`;
  try {
    const searches = await getMySearches(currentUser.uid, 15);
    if (!searches.length) {
      historyList.innerHTML = `<div class="history-empty">No searches yet. Upload a photo to get started!</div>`;
      return;
    }

    historyList.innerHTML = searches.map((s) => {
      const icon = s.source === 'exif' ? '🛰️' : s.source === 'ai' ? '🤖' : '❓';
      const srcClass = `src-${s.source || 'none'}`;
      const srcLabel = (s.source || 'none').toUpperCase();
      const addr = s.address ? s.address.split(',').slice(0, 2).join(',') : 'Unknown location';
      return `
        <div class="history-item">
          <span class="history-item-icon">${icon}</span>
          <div style="flex:1;min-width:0;">
            <div class="history-item-name">${escapeHtml(s.filename || 'Image')}</div>
            <div class="history-item-addr">${escapeHtml(addr)}</div>
          </div>
          <span class="history-item-src ${srcClass}">${srcLabel}</span>
        </div>
      `;
    }).join('');
  } catch (err) {
    historyList.innerHTML = `<div class="history-empty" style="color:var(--neon-red);">Failed to load history</div>`;
  }
}

refreshHistBtn.addEventListener('click', loadHistory);

/* ================================================================
   UTILITIES
   ================================================================ */
function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload  = () => resolve(reader.result.split(',')[1]);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function flattenExif(exif) {
  const flat = {};
  if (!exif) return flat;
  Object.entries(exif).forEach(([, section]) => {
    if (section && typeof section === 'object') {
      Object.entries(section).forEach(([k, v]) => {
        if (typeof v !== 'object') flat[k] = v;
      });
    }
  });
  return flat;
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/* ================================================================
   INIT
   ================================================================ */
loadApiKey();
setupUpload();
