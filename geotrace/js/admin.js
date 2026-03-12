/* GeoTrace — js/admin.js */
'use strict';

document.addEventListener('DOMContentLoaded',()=>{
  GT_Auth.initFirebase();
  GT_Auth.requireAdmin(async user=>{
    await GT_Auth.saveUserProfile(user);
    populateSidebar(user); loadStats(); loadUsers(); loadSearches();
    GT_Auth.logEvent('admin_open');
  });
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

async function loadStats(){
  if(!window._db)return;
  try{
    const[usersSnap,searchesSnap]=await Promise.all([
      window._db.collection('users').get(),
      window._db.collection('searches').get()
    ]);
    setEl('stat-users',usersSnap.size);
    setEl('stat-searches',searchesSnap.size);
    const today=new Date();today.setHours(0,0,0,0);
    const todaySearches=searchesSnap.docs.filter(d=>{const t=d.data().timestamp?.toDate();return t&&t>=today}).length;
    setEl('stat-today',todaySearches);
    const avgConf=searchesSnap.docs.reduce((s,d)=>s+(d.data().result?.confidence||0),0)/Math.max(searchesSnap.size,1);
    setEl('stat-conf',Math.round(avgConf)+'%');
  }catch(e){console.error(e)}
}

async function loadUsers(){
  const tbody=document.getElementById('users-tbody');
  if(!tbody||!window._db)return;
  tbody.innerHTML='<tr><td colspan="5"><div class="loading"><div class="loading-dot"></div><div class="loading-dot"></div><div class="loading-dot"></div></div></td></tr>';
  try{
    const snap=await window._db.collection('users').orderBy('lastLogin','desc').limit(100).get();
    if(snap.empty){tbody.innerHTML='<tr><td colspan="5" style="color:var(--muted);padding:20px;text-align:center">No users yet</td></tr>';return}
    tbody.innerHTML=snap.docs.map(doc=>{
      const d=doc.data();
      return`<tr>
        <td><div style="display:flex;align-items:center;gap:8px">
          ${d.photo?`<img src="${d.photo}" style="width:28px;height:28px;border-radius:50%" onerror="this.style.display='none'">`:''}
          <span>${d.name||'—'}</span></div></td>
        <td style="color:var(--muted2)">${d.email||'—'}</td>
        <td><span class="badge badge-${d.role==='admin'?'admin':'user'}">${d.role||'user'}</span></td>
        <td style="font-family:var(--fm);color:var(--cyan)">${d.searchCount||0}</td>
        <td style="color:var(--muted)">${d.lastLogin?.toDate()?.toLocaleDateString()||'—'}</td>
      </tr>`;
    }).join('');
  }catch(e){tbody.innerHTML=`<tr><td colspan="5" style="color:var(--red);padding:16px">${e.message}</td></tr>`}
}

async function loadSearches(){
  const tbody=document.getElementById('searches-tbody');
  if(!tbody||!window._db)return;
  tbody.innerHTML='<tr><td colspan="5"><div class="loading"><div class="loading-dot"></div><div class="loading-dot"></div><div class="loading-dot"></div></div></td></tr>';
  try{
    const snap=await window._db.collection('searches').orderBy('timestamp','desc').limit(100).get();
    if(snap.empty){tbody.innerHTML='<tr><td colspan="5" style="color:var(--muted);padding:20px;text-align:center">No searches yet</td></tr>';return}
    tbody.innerHTML=snap.docs.map(doc=>{
      const d=doc.data(),loc=[d.result?.city,d.result?.country].filter(Boolean).join(', ')||'Unknown';
      return`<tr>
        <td>${d.fileName||'—'}</td>
        <td>📍 ${loc}</td>
        <td style="font-family:var(--fm);color:var(--cyan)">${d.result?.confidence||0}%</td>
        <td><span class="badge badge-${d.result?.source==='exif_gps'?'admin':'user'}">${d.result?.source||'—'}</span></td>
        <td style="color:var(--muted)">${d.timestamp?.toDate()?.toLocaleDateString()||'—'}</td>
      </tr>`;
    }).join('');
  }catch(e){tbody.innerHTML=`<tr><td colspan="5" style="color:var(--red);padding:16px">${e.message}</td></tr>`}
}

function setEl(id,val){const el=document.getElementById(id);if(el)el.textContent=val}

function switchView(name){
  document.querySelectorAll('.view').forEach(v=>v.classList.remove('active'));
  document.querySelectorAll('[data-view]').forEach(b=>b.classList.remove('active'));
  document.getElementById(`view-${name}`)?.classList.add('active');
  document.querySelector(`[data-view="${name}"]`)?.classList.add('active');
}

function initAppCursor(){
  const dot=document.getElementById('cursor-dot'),ring=document.getElementById('cursor-ring');
  if(!dot||!ring)return;
  window.addEventListener('mousemove',e=>{dot.style.left=e.clientX+'px';dot.style.top=e.clientY+'px';ring.style.left=e.clientX+'px';ring.style.top=e.clientY+'px'});
}
