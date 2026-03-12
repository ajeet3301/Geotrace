/* GeoTrace Live — js/live.js */
'use strict';

const API = '/api/socket';
let _map=null, _myMarker=null, _pathLine=null, _trackingId=null, _userId=null;
let _tracking=false, _watchId=null, _points=[], _heatLayer=null, _playTimer=null;
let _otherMarkers={}, _geofenceMarkers=[];

document.addEventListener('DOMContentLoaded',()=>{
  GT_Auth.initFirebase();
  GT_Auth.requireAuth(async user=>{
    await GT_Auth.saveUserProfile(user);
    _userId=user.uid;
    populateSidebar(user); initMap(); initPoll();
    loadHistory(); loadGeofences();
    GT_Auth.logEvent('live_open');
  });
  document.querySelectorAll('[data-view]').forEach(b=>b.addEventListener('click',()=>switchView(b.dataset.view)));
  document.getElementById('btn-signout')?.addEventListener('click',GT_Auth.signOut);
  document.getElementById('btn-toggle-track')?.addEventListener('click',toggleTracking);
  document.getElementById('btn-clear-history')?.addEventListener('click',clearHistory);
  document.getElementById('btn-show-heatmap')?.addEventListener('click',toggleHeatmap);
  document.getElementById('btn-load-analytics')?.addEventListener('click',loadAnalytics);
  document.getElementById('btn-add-fence')?.addEventListener('click',addGeofence);
  document.getElementById('btn-play-route')?.addEventListener('click',playRoute);
  document.getElementById('btn-stop-play')?.addEventListener('click',stopPlay);
  document.getElementById('btn-center-me')?.addEventListener('click',centerOnMe);
  document.getElementById('btn-toggle-path')?.addEventListener('click',togglePath);
  new ParticleSystem('particle-canvas-live',{colors:['#10b981','#7c3aed','#06b6d4']});
  initCursor();
});

/* ── Sidebar ── */
function populateSidebar(user){
  const el=document.getElementById('sb-name'),em=document.getElementById('sb-email'),av=document.getElementById('sb-avatar');
  if(el)el.textContent=user.displayName||user.email;
  if(em)em.textContent=user.email;
  if(av){if(user.photoURL)av.innerHTML=`<img src="${user.photoURL}" alt="">`;
    else av.textContent=(user.displayName||user.email||'?')[0].toUpperCase();}
}

/* ── Map init ── */
function initMap(){
  if(_map)return;
  _map=L.map('live-map',{zoomControl:false}).setView([20,0],2);
  L.control.zoom({position:'bottomright'}).addTo(_map);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{attribution:'© OpenStreetMap',maxZoom:19}).addTo(_map);
}

/* ── Tracking toggle ── */
function toggleTracking(){
  if(_tracking) stopTracking(); else startTracking();
}
function startTracking(){
  if(!navigator.geolocation){showToast('Geolocation not supported','error');return}
  _tracking=true;
  const btn=document.getElementById('btn-toggle-track');
  if(btn){btn.textContent='⏹ Stop Tracking';btn.classList.add('btn-green')}
  setStatus('active','Tracking active…');
  _watchId=navigator.geolocation.watchPosition(onPosition,onGeoError,{enableHighAccuracy:true,maximumAge:3000,timeout:10000});
  showToast('Location tracking started','ok');
}
function stopTracking(){
  _tracking=false;
  if(_watchId!=null){navigator.geolocation.clearWatch(_watchId);_watchId=null}
  const btn=document.getElementById('btn-toggle-track');
  if(btn){btn.textContent='▶ Start Tracking';btn.classList.remove('btn-green')}
  setStatus('','Tracking stopped');
  showToast('Tracking stopped','warn');
}

async function onPosition(pos){
  const{latitude:lat,longitude:lon,speed,heading,accuracy}=pos.coords;
  _points.push({lat,lon,speed:speed||0,heading:heading||0,accuracy:accuracy||0,ts:Date.now()});

  // Update my marker
  if(!_myMarker){
    const icon=L.divIcon({className:'',html:'<div class="gt-pin-me"></div>',iconSize:[14,14],iconAnchor:[7,7]});
    _myMarker=L.marker([lat,lon],{icon}).addTo(_map).bindPopup('📍 You are here');
    _map.setView([lat,lon],15);
  } else {
    _myMarker.setLatLng([lat,lon]);
  }

  // Update path
  if(_pathLine)_map.removeLayer(_pathLine);
  if(_points.length>1){
    _pathLine=L.polyline(_points.map(p=>[p.lat,p.lon]),{color:'#10b981',weight:3,opacity:.8}).addTo(_map);
  }

  // Update status
  setStatus('active',`Tracking · ±${Math.round(accuracy)}m accuracy`);
  setEl('live-coords',`${lat.toFixed(5)}, ${lon.toFixed(5)}`);

  // Reverse geocode (throttled)
  if(_points.length%10===1){
    try{
      const geo=await GT_Geo.reverseGeocode(lat,lon);
      setEl('live-address',geo.display||'');
    }catch{}
  }

  // Push to backend
  try{
    const user=window._auth?.currentUser;
    const resp=await apiFetch('/location','POST',{
      userId:_userId,name:user?.displayName||'Me',color:'#10b981',lat,lon,speed:speed||0,heading:heading||0,accuracy:accuracy||0
    });
    if(resp.alerts?.length) handleFenceAlerts(resp.alerts);
  }catch{}
}

function onGeoError(err){
  setStatus('','GPS error: '+err.message);
  showToast('GPS error: '+err.message,'error');
}

/* ── Live users poll (every 5s) ── */
function initPoll(){
  updateLiveUsers();
  setInterval(updateLiveUsers,5000);
}
async function updateLiveUsers(){
  try{
    const data=await apiFetch('/location/live','GET');
    const panel=document.getElementById('users-panel-list');
    if(!panel)return;
    const users=data.users||[];
    panel.innerHTML=users.length?users.map(u=>
      `<div class="user-dot-row"><div class="user-dot" style="background:${u.color||'#7c3aed'}"></div><span>${u.name||'User'}</span></div>`
    ).join(''):'<div style="color:var(--muted);font-size:12px">No one online</div>';
    setEl('online-count',users.length);

    // Update other markers
    users.forEach(u=>{
      if(!u.lastLocation)return;
      const{lat,lon}=u.lastLocation;
      if(_otherMarkers[u.name]){
        _otherMarkers[u.name].setLatLng([lat,lon]);
      } else {
        const icon=L.divIcon({className:'',html:`<div class="gt-pin-other" style="background:${u.color||'#7c3aed'}"></div>`,iconSize:[12,12],iconAnchor:[6,6]});
        _otherMarkers[u.name]=L.marker([lat,lon],{icon}).addTo(_map).bindPopup(`👤 ${u.name}`);
      }
    });
  }catch{}
}

/* ── History / route ── */
async function loadHistory(){
  if(!_userId)return;
  try{
    const data=await apiFetch(`/location/history?userId=${_userId}`,'GET');
    _points=data.points||[];
    if(_points.length>1&&_pathLine===null){
      _pathLine=L.polyline(_points.map(p=>[p.lat,p.lon]),{color:'#10b981',weight:3,opacity:.7}).addTo(_map);
      _map.fitBounds(_pathLine.getBounds(),{padding:[20,20]});
    }
    setEl('history-point-count',`${_points.length} points`);
  }catch{}
}

async function clearHistory(){
  if(!confirm('Clear all location history?'))return;
  try{
    await apiFetch(`/location/history?userId=${_userId}`,'DELETE',{userId:_userId});
    _points=[];
    if(_pathLine){_map.removeLayer(_pathLine);_pathLine=null}
    if(_myMarker){_map.removeLayer(_myMarker);_myMarker=null}
    showToast('History cleared','ok');
    setEl('history-point-count','0 points');
  }catch(e){showToast('Error: '+e.message,'error')}
}

/* ── Heatmap ── */
async function toggleHeatmap(){
  const btn=document.getElementById('btn-show-heatmap');
  if(_heatLayer){
    _map.removeLayer(_heatLayer); _heatLayer=null;
    if(btn)btn.classList.remove('active');
    showToast('Heatmap hidden','info'); return;
  }
  try{
    const data=await apiFetch(`/heatmap?userId=${_userId}`,'GET');
    const pts=(data.points||[]).map(p=>[p.lat,p.lon,p.weight/100]);
    if(!pts.length){showToast('No heatmap data yet','warn');return}
    if(typeof L.heatLayer!=='function'){showToast('Heatmap plugin not loaded','warn');return}
    _heatLayer=L.heatLayer(pts,{radius:25,blur:20,maxZoom:17,gradient:{0.4:'#7c3aed',0.6:'#06b6d4',0.8:'#10b981',1.0:'#fbbf24'}}).addTo(_map);
    if(btn)btn.classList.add('active');
    showToast('Heatmap shown','ok');
  }catch(e){showToast('Heatmap error: '+e.message,'error')}
}

/* ── Analytics ── */
async function loadAnalytics(){
  try{
    const data=await apiFetch(`/analytics?userId=${_userId}`,'GET');
    setEl('a-distance',data.distance+' km');
    setEl('a-duration',data.duration+' min');
    setEl('a-avg-speed',data.avgSpeed+' km/h');
    setEl('a-max-speed',data.maxSpeed+' km/h');
    setEl('a-points',data.points);
    drawSpeedChart();
  }catch(e){showToast('Analytics error: '+e.message,'error')}
}
function drawSpeedChart(){
  const canvas=document.getElementById('speed-chart');
  if(!canvas||!_points.length)return;
  const ctx=canvas.getContext('2d');
  const labels=_points.slice(-50).map((_,i)=>i);
  const speeds=_points.slice(-50).map(p=>+(p.speed*3.6).toFixed(1));
  if(window._speedChart)window._speedChart.destroy();
  window._speedChart=new Chart(ctx,{
    type:'line',
    data:{labels,datasets:[{label:'Speed (km/h)',data:speeds,borderColor:'#10b981',backgroundColor:'rgba(16,185,129,.15)',tension:.4,fill:true,pointRadius:0}]},
    options:{responsive:true,plugins:{legend:{labels:{color:'#64748b'}}},scales:{x:{display:false},y:{ticks:{color:'#64748b'},grid:{color:'rgba(255,255,255,.05)'}}}}
  });
}

/* ── Route playback ── */
function playRoute(){
  if(_points.length<2){showToast('No route to play','warn');return}
  stopPlay();
  let i=0;
  const icon=L.divIcon({className:'',html:'<div class="gt-pin-play"></div>',iconSize:[10,10],iconAnchor:[5,5]});
  const marker=L.marker([_points[0].lat,_points[0].lon],{icon}).addTo(_map);
  _playTimer=setInterval(()=>{
    if(i>=_points.length){clearInterval(_playTimer);_map.removeLayer(marker);showToast('Playback complete','ok');return}
    marker.setLatLng([_points[i].lat,_points[i].lon]);
    _map.panTo([_points[i].lat,_points[i].lon],{animate:true,duration:.5});
    i++;
  },200);
  showToast('Playing route…','info');
}
function stopPlay(){if(_playTimer){clearInterval(_playTimer);_playTimer=null}}

/* ── Geofences ── */
async function loadGeofences(){
  if(!_userId)return;
  try{
    const data=await apiFetch(`/geofences?userId=${_userId}`,'GET');
    renderFences(data.fences||[]);
  }catch{}
}
async function addGeofence(){
  const name=document.getElementById('fence-name')?.value.trim();
  const radius=parseFloat(document.getElementById('fence-radius')?.value||'100');
  const alertOn=document.getElementById('fence-alert')?.value||'both';
  if(!name){showToast('Enter a geofence name','warn');return}
  if(!_points.length&&!_myMarker){showToast('Start tracking first to set geofence at your location','warn');return}
  const last=_points[_points.length-1]||{lat:0,lon:0};
  try{
    const data=await apiFetch('/geofences','POST',{userId:_userId,name,lat:last.lat,lon:last.lon,radius,alertOn});
    showToast(`Geofence "${name}" created ✓`,'ok');
    if(document.getElementById('fence-name'))document.getElementById('fence-name').value='';
    drawFenceCircle(data.fence);
    loadGeofences();
  }catch(e){showToast('Error: '+e.message,'error')}
}
async function deleteFence(id){
  try{
    await apiFetch(`/geofences/${id}`,'DELETE',{userId:_userId});
    showToast('Geofence deleted','ok'); loadGeofences();
  }catch(e){showToast('Error: '+e.message,'error')}
}
function drawFenceCircle(fence){
  const circle=L.circle([fence.lat,fence.lon],{radius:fence.radius,color:'#e879f9',fillColor:'rgba(232,121,249,.12)',fillOpacity:.5,weight:2}).addTo(_map).bindPopup(`🔒 ${fence.name}<br>Radius: ${fence.radius}m`);
  _geofenceMarkers.push(circle);
}
function renderFences(fences){
  const list=document.getElementById('fences-list');
  if(!list)return;
  _geofenceMarkers.forEach(m=>_map.removeLayer(m));
  _geofenceMarkers=[];
  if(!fences.length){list.innerHTML='<div style="color:var(--muted);padding:16px;text-align:center">No geofences yet</div>';return}
  fences.forEach(f=>drawFenceCircle(f));
  list.innerHTML=fences.map(f=>`
    <div class="fence-item">
      <div class="fence-color"></div>
      <div style="flex:1"><div class="fence-name">${f.name}</div><div class="fence-meta">Radius: ${f.radius}m · Alert: ${f.alertOn}</div></div>
      <button class="btn btn-sm btn-danger" onclick="deleteFence('${f.id}')">🗑</button>
    </div>`).join('');
}
function handleFenceAlerts(alerts){
  alerts.forEach(a=>{
    const msg=a.type==='enter'?`📍 Entered "${a.fenceName}"`:`🚪 Left "${a.fenceName}"`;
    const al=document.getElementById('fence-alert-bar');
    if(al){al.textContent=msg;al.classList.add('show');setTimeout(()=>al.classList.remove('show'),4000)}
    showToast(msg,'warn',5000);
  });
}

/* ── Map controls ── */
function centerOnMe(){
  if(_myMarker)_map.flyTo(_myMarker.getLatLng(),16,{duration:1});
  else showToast('No location yet — start tracking','warn');
}
function togglePath(){
  if(!_pathLine)return;
  const btn=document.getElementById('btn-toggle-path');
  if(_map.hasLayer(_pathLine)){_map.removeLayer(_pathLine);if(btn)btn.classList.remove('active')}
  else{_map.addLayer(_pathLine);if(btn)btn.classList.add('active')}
}

/* ── View switch ── */
function switchView(name){
  document.querySelectorAll('.view').forEach(v=>v.classList.remove('active'));
  document.querySelectorAll('[data-view]').forEach(b=>b.classList.remove('active'));
  document.getElementById(`view-${name}`)?.classList.add('active');
  document.querySelector(`[data-view="${name}"]`)?.classList.add('active');
  if(name==='analytics')loadAnalytics();
  if(name==='geofences')loadGeofences();
  if(name==='map')setTimeout(()=>_map?.invalidateSize(),100);
}

/* ── Helpers ── */
async function apiFetch(path,method='GET',body=null){
  const opts={method,headers:{'Content-Type':'application/json','x-user-id':_userId||''}};
  if(body&&method!=='GET')opts.body=JSON.stringify(body);
  const resp=await fetch(API+path,opts);
  if(!resp.ok)throw new Error(`API ${resp.status}`);
  return resp.json();
}
function setEl(id,val){const el=document.getElementById(id);if(el)el.textContent=val}
function setStatus(type,text){
  const dot=document.getElementById('status-dot'),txt=document.getElementById('status-text');
  if(dot){dot.className='status-dot';if(type==='active')dot.classList.add('active')}
  if(txt)txt.textContent=text;
}
function initCursor(){
  const dot=document.getElementById('cursor-dot'),ring=document.getElementById('cursor-ring');
  if(!dot||!ring)return;
  window.addEventListener('mousemove',e=>{dot.style.left=e.clientX+'px';dot.style.top=e.clientY+'px';ring.style.left=e.clientX+'px';ring.style.top=e.clientY+'px'});
}

// expose for inline onclick
window.deleteFence=deleteFence;
