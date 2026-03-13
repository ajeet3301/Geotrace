GT_Auth.initFirebase();

let currentUser, currentProfile, currentFile, leafletMap, leafletMarker;

const toast = (msg, type = 'info') => {
  let wrap = document.querySelector('.toast-wrap');
  if (!wrap) { wrap = document.createElement('div'); wrap.className = 'toast-wrap'; document.body.appendChild(wrap); }
  const t = document.createElement('div');
  t.className = `toast toast-${type}`;
  t.textContent = msg;
  wrap.appendChild(t);
  setTimeout(() => t.remove(), 4000);
};

GT_Auth.requireAuth((user, profile) => {
  currentUser = user; currentProfile = profile;
  GT_Auth.setupSidebarUser(user);
  GT_Auth.setupSignOut();
  GT_Auth.setupNavItems();
  GT_Auth.setupCursor();
  new ParticleSystem('pc', { count: 40 });

  const savedKey = sessionStorage.getItem('gt_apikey');
  if (savedKey) document.getElementById('api-input').value = savedKey;
  document.getElementById('btn-save-key').addEventListener('click', () => {
    const k = document.getElementById('api-input').value.trim();
    if (!k) { toast('Please enter your API key', 'error'); return; }
    sessionStorage.setItem('gt_apikey', k);
    toast('API key saved for this session', 'success');
  });

  setupUpload();
  setupAnalyzer();
  setupMap();

  document.querySelectorAll('[data-view]').forEach(btn => {
    btn.addEventListener('click', () => {
      if (btn.dataset.view === 'history') loadHistory();
    });
  });

  if (profile?.isAdmin) {
    const li = document.createElement('button');
    li.className = 'nav-item';
    li.innerHTML = '⚙️ Admin';
    li.onclick = () => window.location.href = '/admin';
    document.querySelector('.nav-sep')?.before(li);
  }
});

function setupUpload() {
  const zone = document.getElementById('upload-zone');
  const input = document.getElementById('file-input');
  const btnA = document.getElementById('btn-analyze');

  zone.addEventListener('click', () => input.click());
  zone.addEventListener('dragover', e => { e.preventDefault(); zone.classList.add('dragover'); });
  zone.addEventListener('dragleave', () => zone.classList.remove('dragover'));
  zone.addEventListener('drop', e => {
    e.preventDefault(); zone.classList.remove('dragover');
    handleFile(e.dataTransfer.files[0]);
  });
  input.addEventListener('change', () => handleFile(input.files[0]));

  async function handleFile(file) {
    if (!file) return;
    if (!file.type.startsWith('image/')) { toast('Please upload an image file', 'error'); return; }
    if (file.size > 10 * 1024 * 1024) { toast('File too large — max 10MB', 'error'); return; }
    currentFile = file;
    btnA.disabled = false;

    const reader = new FileReader();
    reader.onload = e => {
      const prev = document.getElementById('panel-preview');
      document.getElementById('img-preview').src = e.target.result;
      prev.style.display = 'block';
    };
    reader.readAsDataURL(file);

    const exif = await GT_Geo.extractExif(file);
    renderExif(exif);
    const gps = GT_Geo.getGpsFromExif(exif);
    if (gps) {
      toast('📍 GPS coordinates found in EXIF!', 'success');
      renderMap(gps.lat, gps.lon, 'EXIF GPS');
    }
    zone.innerHTML = `<div class="upload-icon">✅</div><div class="upload-txt">${file.name}</div><div class="upload-sub">${(file.size/1024).toFixed(0)} KB — click to change</div>`;
  }
}

function setupAnalyzer() {
  document.getElementById('btn-analyze').addEventListener('click', async () => {
    if (!currentFile) return;
    const apiKey = sessionStorage.getItem('gt_apikey');
    if (!apiKey) { toast('Please enter your Anthropic API key first', 'error'); document.getElementById('api-input').focus(); return; }

    const btn = document.getElementById('btn-analyze');
    btn.disabled = true; btn.textContent = '🔍 Analyzing with Claude AI…';

    const panelAI = document.getElementById('panel-ai');
    panelAI.innerHTML = '<div class="panel-title">AI ANALYSIS</div><div style="display:flex;align-items:center;gap:10px;color:var(--muted2)"><div style="width:18px;height:18px;border:2px solid var(--v);border-top-color:transparent;border-radius:50%;animation:spin .7s linear infinite"></div>Claude is analyzing your photo…</div>';

    try {
      const exif = await GT_Geo.extractExif(currentFile);
      const gps  = GT_Geo.getGpsFromExif(exif);
      let result, method;

      if (gps) {
        const address = await GT_Geo.reverseGeocode(gps.lat, gps.lon);
        result = { location: address || `${gps.lat.toFixed(4)}, ${gps.lon.toFixed(4)}`, latitude: gps.lat, longitude: gps.lon, confidence: 100, reasoning: 'GPS coordinates extracted directly from EXIF metadata.', city: '', country: '' };
        method = 'EXIF GPS';
      } else {
        result = await GT_Geo.analyzeWithClaude(currentFile, apiKey);
        method = 'Claude AI';
      }

      renderAIResult(result, method);
      renderMap(result.latitude, result.longitude, result.location);

      const addr = document.getElementById('address-display');
      addr.textContent = `📍 ${result.location}`;
      addr.style.display = 'block';

      await GT_Geo.saveSearch(window._db, currentUser.uid, {
        fileName:   currentFile.name,
        location:   result.location,
        latitude:   result.latitude,
        longitude:  result.longitude,
        confidence: result.confidence,
        method,
        reasoning:  result.reasoning || ''
      });
      toast('Analysis saved to history', 'success');
    } catch (e) {
      console.error(e);
      toast('Analysis failed: ' + e.message, 'error');
      panelAI.innerHTML = '<div class="panel-title">AI ANALYSIS</div><div style="color:#fca5a5">❌ ' + (e.message || 'Unknown error') + '</div>';
    }
    btn.disabled = false;
    btn.innerHTML = '<div class="scan-line"></div>🔍 ANALYZE LOCATION';
  });
}

function renderExif(exif) {
  const rows = GT_Geo.formatExifForDisplay(exif);
  const tbody = document.getElementById('exif-body');
  if (!rows.length) { tbody.innerHTML = '<tr><td colspan="2" style="color:var(--muted)">No EXIF data found</td></tr>'; return; }
  tbody.innerHTML = rows.map(r => `<tr><td>${r.label}</td><td>${escHtml(String(r.value))}</td></tr>`).join('');
}

function renderAIResult(r, method) {
  const panel = document.getElementById('panel-ai');
  panel.innerHTML = `<div class="panel-title">AI ANALYSIS</div>
  <div class="ai-result">
    <div><span class="ai-method">${method}</span></div>
    <div class="ai-loc">📍 ${escHtml(r.location)}</div>
    <div class="ai-conf-row">
      <div class="ai-conf-bar"><div class="ai-conf-fill" style="width:${r.confidence}%"></div></div>
      <span class="ai-conf-pct">${r.confidence}%</span>
    </div>
    ${r.reasoning ? `<div class="ai-reasoning">${escHtml(r.reasoning)}</div>` : ''}
  </div>`;
}

function setupMap() {
  leafletMap = L.map('gt-map', { zoomControl: true, attributionControl: true }).setView([20, 0], 2);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© OpenStreetMap', maxZoom: 19
  }).addTo(leafletMap);
}

function renderMap(lat, lon, label) {
  if (!leafletMap) return;
  if (leafletMarker) leafletMarker.remove();
  leafletMap.setView([lat, lon], 13);
  leafletMarker = L.marker([lat, lon]).addTo(leafletMap).bindPopup(label || '').openPopup();
}

async function loadHistory() {
  const container = document.getElementById('history-list');
  container.innerHTML = '<div class="loading"><div class="ld"></div><div class="ld"></div><div class="ld"></div></div>';
  try {
    const items = await GT_Geo.getHistory(window._db, currentUser.uid);
    if (!items.length) { container.innerHTML = '<div style="color:var(--muted);font-size:14px;padding:20px 0">No searches yet. Analyze a photo to get started.</div>'; return; }
    container.innerHTML = items.map(item => `
      <div class="hist-card" onclick="showHistoryItem('${item.id}')">
        <div class="hist-thumb"><div style="width:100%;height:100%;background:rgba(124,58,237,.1);display:flex;align-items:center;justify-content:center;font-size:20px">📸</div></div>
        <div>
          <div class="hist-title">${escHtml(item.fileName || 'Unknown file')}</div>
          <div class="hist-loc">📍 ${escHtml(item.location || '—')}</div>
          <div class="hist-date">${item.createdAt?.toDate ? item.createdAt.toDate().toLocaleDateString() : '—'}</div>
        </div>
        <span class="conf-badge">${item.confidence || 0}%</span>
      </div>`).join('');
  } catch (e) {
    container.innerHTML = '<div style="color:#fca5a5;font-size:14px">Failed to load history: ' + e.message + '</div>';
  }
}

function escHtml(str) {
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
