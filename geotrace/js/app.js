/* GeoTrace — js/app.js */
'use strict';
let _map=null,_marker=null,_apiKey=null,_currentFile=null;

document.addEventListener('DOMContentLoaded',()=>{
  GT_Auth.initFirebase();
  GT_Auth.requireAuth(async user=>{
    await GT_Auth.saveUserProfile(user);
    populateSidebar(user); loadApiKey(); loadHistory(user.uid); initMap();
    GT_Auth.logEvent('app_open');
  });
  const zone=document.getElementById('upload-zone'),inp=document.getElementById('file-input');
  if(zone){
    zone.addEventListener('click',()=>inp.click());
    zone.addEventListener('dragover',e=>{e.preventDefault();zone.classList.add('drag')});
    zone.addEventListener('dragleave',()=>zone.classList.remove('drag'));
    zone.addEventListener('drop',e=>{e.preventDefault();zone.classList.remove('drag');handleFile(e.dataTransfer.files[0])});
  }
  inp?.addEventListener('change',e=>handleFile(e.target.files[0]));
  document.getElementById('btn-save-key')?.addEventListener('click',saveApiKey);
  document.getElementById('api-input')?.addEventListener('keydown',e=>{if(e.key==='Enter')saveApiKey()});
  document.getElementById('btn-analyze')?.addEventListener('click',analyze);
  document.querySelectorAll('[data-view]').forEach(b=>b.addEventListener('click',()=>switchView(b.dataset.view)));
  document.getElementById('btn-signout')?.addEventListener('click',GT_Auth.signOut);
  new ParticleSystem('particle-canvas');
  initAppCursor();
});

function populateSidebar(user){
  const el=document.getElementById('sb-name'),em=document.getElementById('sb-email'),av=document.getElementById('sb-avatar');
  if(el)el.textContent=user.displayName||user.email;
  if(em)em.textContent=user.email;
  if(av){if(user.photoURL)av.innerHTML=`<img src="${user.photoURL}" alt="">`;
    else av.textContent=(user.displayName||user.email||'?')[0].toUpperCase();}
}

function loadApiKey(){
  _apiKey=localStorage.getItem('gt_api_key')||'';
  const inp=document.getElementById('api-input'),bar=document.getElementById('api-bar');
  if(_apiKey&&bar)bar.classList.add('hidden');
  if(inp)inp.value=_apiKey;
}
function saveApiKey(){
  const val=document.getElementById('api-input')?.value.trim();
  if(!val)return showToast('Enter your Anthropic API key','warn');
  _apiKey=val; localStorage.setItem('gt_api_key',val);
  document.getElementById('api-bar')?.classList.add('hidden');
  showToast('API key saved ✓','ok');
}

async function handleFile(file){
  if(!file||!file.type.startsWith('image/')){showToast('Please upload an image file','warn');return}
  const maxMB=window.APP_CONFIG?.maxFileSizeMB||10;
  if(file.size>maxMB*1024*1024){showToast(`File too large (max ${maxMB}MB)`,'error');return}
  _currentFile=file;
  const preview=document.getElementById('img-preview');
  if(preview){preview.src=URL.createObjectURL(file);preview.style.display='block'}
  document.getElementById('panel-preview')?.classList.remove('hidden');
  showToast('Extracting EXIF data…','info',1500);
  const exif=await GT_Geo.extractExif(file);
  displayExif(exif);
  if(exif.hasGPS){
    placeMapPin(exif.latitude,exif.longitude,'📍 GPS from EXIF');
    const geo=await GT_Geo.reverseGeocode(exif.latitude,exif.longitude);
    displayAddress(geo.display);
    showToast('GPS coordinates found in photo!','ok');
  }
  document.getElementById('btn-analyze')?.removeAttribute('disabled');
  switchView('analyzer');
}

function displayExif(exif){
  const tbody=document.getElementById('exif-body');
  if(!tbody)return;
  const rows=[['Camera',exif.camera],['GPS',exif.hasGPS?`${exif.latitude?.toFixed(6)}, ${exif.longitude?.toFixed(6)}`:'Not found'],
    ['Date taken',exif.dateTaken?.toLocaleString()||null],['Aperture',exif.fNumber],['Shutter',exif.exposure],
    ['ISO',exif.iso],['Focal len',exif.focal],['Resolution',exif.width&&exif.height?`${exif.width} × ${exif.height}`:null],
    ['Software',exif.software]];
  tbody.innerHTML=rows.filter(([,v])=>v!=null).map(([k,v])=>`<tr><td>${k}</td><td>${v}</td></tr>`).join('');
}

async function analyze(){
  if(!_currentFile)return showToast('Upload an image first','warn');
  if(!_apiKey){document.getElementById('api-bar')?.classList.remove('hidden');return showToast('Enter your Anthropic API key first','warn')}
  const btn=document.getElementById('btn-analyze');
  if(btn){btn.disabled=true;btn.classList.add('scanning')}
  showToast('Analyzing with Claude AI…','info',8000);
  try{
    const[exif,aiResult]=await Promise.all([GT_Geo.extractExif(_currentFile),GT_Geo.analyzeWithAI(_currentFile,_apiKey)]);
    const lat=exif.hasGPS?exif.latitude:aiResult.latitude,lon=exif.hasGPS?exif.longitude:aiResult.longitude;
    const src=exif.hasGPS?(aiResult.country?'both':'exif_gps'):'ai_visual';
    const merged={...aiResult,latitude:lat,longitude:lon,source:src};
    displayAIResult(merged);
    let geocoded={display:null};
    if(lat&&lon){placeMapPin(lat,lon,merged.city||merged.country||'Location');geocoded=await GT_Geo.reverseGeocode(lat,lon);displayAddress(geocoded.display)}
    const user=window._auth?.currentUser;
    if(user)await GT_Geo.saveSearch(user.uid,_currentFile,exif,merged,geocoded);
    GT_Auth.logEvent('analysis_complete',{confidence:merged.confidence,source:src});
    showToast('Analysis complete!','ok');
    setTimeout(()=>loadHistory(user?.uid),800);
  }catch(err){
    console.error(err); showToast(err.message||'Analysis failed','error');
    if(err.message?.includes('401')){document.getElementById('api-bar')?.classList.remove('hidden');localStorage.removeItem('gt_api_key')}
  }finally{if(btn){btn.disabled=false;btn.classList.remove('scanning')}}
}

function displayAIResult(r){
  const panel=document.getElementById('panel-ai');
  if(!panel)return;
  panel.innerHTML=`<div class="panel-title">AI ANALYSIS</div>
    <div class="ai-tags">
      ${r.country?`<span class="ai-tag country">🌍 ${r.country}</span>`:''}
      ${r.region?`<span class="ai-tag">📍 ${r.region}</span>`:''}
      ${r.city?`<span class="ai-tag city">🏙 ${r.city}</span>`:''}
      <span class="ai-tag" style="margin-left:auto">${r.source==='exif_gps'?'🛰 GPS':r.source==='both'?'🛰+🤖':'🤖 AI'}</span>
    </div>
    ${r.latitude&&r.longitude?`<div style="font-family:var(--fm);font-size:12px;color:var(--cyan2);margin-bottom:10px">${r.latitude.toFixed(5)}, ${r.longitude.toFixed(5)}</div>`:''}
    <div class="panel-title">CONFIDENCE</div>
    <div class="confidence-bar"><div class="confidence-fill" style="width:${r.confidence||0}%"></div></div>
    <div style="font-family:var(--fm);font-size:12px;color:var(--violet2);margin-bottom:12px">${r.confidence||0}%</div>
    <div class="panel-title">REASONING</div>
    <div class="ai-reasoning">${r.reasoning||'No reasoning provided.'}</div>`;
}

function initMap(){
  if(_map||!document.getElementById('gt-map'))return;
  _map=L.map('gt-map',{zoomControl:false}).setView([20,0],2);
  L.control.zoom({position:'bottomright'}).addTo(_map);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{attribution:'© OpenStreetMap',maxZoom:19}).addTo(_map);
}
function placeMapPin(lat,lon,label){
  if(!_map)return;
  if(_marker)_map.removeLayer(_marker);
  const icon=L.divIcon({className:'',html:'<div class="gt-pin"></div>',iconSize:[14,14],iconAnchor:[7,7]});
  _marker=L.marker([lat,lon],{icon}).addTo(_map).bindPopup(`<b>📍 ${label}</b><br>${lat.toFixed(5)}, ${lon.toFixed(5)}`);
  _map.flyTo([lat,lon],13,{duration:1.4});
}
function displayAddress(addr){
  const el=document.getElementById('address-display');
  if(el&&addr){el.textContent=addr;el.style.display='block'}
}

async function loadHistory(uid){
  const list=document.getElementById('history-list');
  if(!list||!uid||!window._db)return;
  list.innerHTML='<div class="loading"><div class="loading-dot"></div><div class="loading-dot"></div><div class="loading-dot"></div></div>';
  try{
    const limit=window.APP_CONFIG?.historyLimit||50;
    const snap=await window._db.collection('searches').where('uid','==',uid).orderBy('timestamp','desc').limit(limit).get();
    if(snap.empty){list.innerHTML='<div style="color:var(--muted);padding:20px;text-align:center">No searches yet</div>';return}
    list.innerHTML=snap.docs.map(doc=>{
      const d=doc.data(),loc=[d.result?.city,d.result?.country].filter(Boolean).join(', ')||'Unknown',ts=d.timestamp?.toDate()?.toLocaleDateString()||'';
      return`<div class="history-item"><div style="flex:1"><div class="hi-loc">📍 ${loc}</div><div class="hi-meta">${d.fileName||'photo'} · ${ts}</div></div><span class="hi-conf">${d.result?.confidence||0}%</span></div>`;
    }).join('');
  }catch(e){list.innerHTML=`<div style="color:var(--red);padding:16px">Error: ${e.message}</div>`}
}

function switchView(name){
  document.querySelectorAll('.view').forEach(v=>v.classList.remove('active'));
  document.querySelectorAll('[data-view]').forEach(b=>b.classList.remove('active'));
  document.getElementById(`view-${name}`)?.classList.add('active');
  document.querySelector(`[data-view="${name}"]`)?.classList.add('active');
  if(name==='history')loadHistory(window._auth?.currentUser?.uid);
}

function initAppCursor(){
  const dot=document.getElementById('cursor-dot'),ring=document.getElementById('cursor-ring');
  if(!dot||!ring)return;
  window.addEventListener('mousemove',e=>{dot.style.left=e.clientX+'px';dot.style.top=e.clientY+'px';ring.style.left=e.clientX+'px';ring.style.top=e.clientY+'px'});
}
