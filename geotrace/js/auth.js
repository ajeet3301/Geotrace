/* GeoTrace — js/auth.js */
'use strict';
let _db=null,_auth=null;

function initFirebase(){
  if(!window.firebaseConfig?.apiKey){console.error('GeoTrace: firebaseConfig missing');return}
  firebase.initializeApp(window.firebaseConfig);
  _auth=firebase.auth(); _db=firebase.firestore();
  window._auth=_auth; window._db=_db;
}

async function signInWithGoogle(){
  const p=new firebase.auth.GoogleAuthProvider();
  p.addScope('profile'); p.addScope('email');
  return _auth.signInWithPopup(p);
}

function requireAuth(cb){
  _auth.onAuthStateChanged(u=>{ if(!u){window.location.href='/login';return} cb(u); });
}

function requireAdmin(cb){
  _auth.onAuthStateChanged(async u=>{
    if(!u){window.location.href='/login';return}
    const isAdmin=(window.APP_CONFIG?.adminEmails||[]).includes((u.email||'').toLowerCase());
    if(!isAdmin){window.location.href='/app';return}
    cb(u);
  });
}

async function saveUserProfile(user){
  if(!_db)return;
  const isAdmin=(window.APP_CONFIG?.adminEmails||[]).includes((user.email||'').toLowerCase());
  const ref=_db.collection('users').doc(user.uid);
  const snap=await ref.get();
  const data={uid:user.uid,name:user.displayName||'',email:user.email||'',photo:user.photoURL||'',
    role:isAdmin?'admin':'user',lastLogin:firebase.firestore.FieldValue.serverTimestamp(),isActive:true};
  if(!snap.exists)data.createdAt=firebase.firestore.FieldValue.serverTimestamp();
  await ref.set(data,{merge:true}); return data;
}

async function logEvent(type,data={}){
  if(!_db||!_auth.currentUser)return;
  try{ await _db.collection('analytics').add({type,uid:_auth.currentUser.uid,data,
    timestamp:firebase.firestore.FieldValue.serverTimestamp(),userAgent:navigator.userAgent,page:window.location.pathname}); }
  catch(e){}
}

function signOut(){ return _auth.signOut().then(()=>{window.location.href='/login'}); }

window.GT_Auth={initFirebase,signInWithGoogle,requireAuth,requireAdmin,saveUserProfile,logEvent,signOut};
