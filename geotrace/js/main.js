/* GeoTrace — js/main.js */
'use strict';

function initCursor(){
  const dot=document.getElementById('cursor-dot'),ring=document.getElementById('cursor-ring');
  if(!dot||!ring)return;
  let rx=0,ry=0;
  window.addEventListener('mousemove',e=>{dot.style.left=e.clientX+'px';dot.style.top=e.clientY+'px';});
  (function loop(){
    rx+=(parseFloat(dot.style.left||0)-rx)*.13;
    ry+=(parseFloat(dot.style.top||0)-ry)*.13;
    ring.style.left=rx+'px';ring.style.top=ry+'px';
    requestAnimationFrame(loop);
  })();
}

function initReveal(){
  const els=document.querySelectorAll('.reveal');
  if(!els.length)return;
  const io=new IntersectionObserver(entries=>{
    entries.forEach(e=>{if(e.isIntersecting){e.target.classList.add('visible');io.unobserve(e.target)}});
  },{threshold:.12});
  els.forEach(el=>io.observe(el));
}

function initCounters(){
  const els=document.querySelectorAll('[data-count]');
  if(!els.length)return;
  const io=new IntersectionObserver(entries=>{
    entries.forEach(e=>{
      if(!e.isIntersecting)return;
      const el=e.target,end=parseFloat(el.dataset.count),dur=1800,start=performance.now();
      (function tick(now){
        const p=Math.min((now-start)/dur,1),ease=1-Math.pow(1-p,3),val=end*ease;
        el.textContent=Number.isInteger(end)?Math.round(val).toLocaleString():val.toFixed(1);
        if(p<1)requestAnimationFrame(tick);
      })(start);
      io.unobserve(el);
    });
  },{threshold:.5});
  els.forEach(el=>io.observe(el));
}

function initNav(){
  const nav=document.querySelector('nav');
  if(!nav)return;
  window.addEventListener('scroll',()=>{
    nav.style.background=window.scrollY>40?'rgba(2,4,8,.96)':'rgba(2,4,8,.8)';
  },{passive:true});
}

function initMarquee(){
  const track=document.querySelector('.marquee-track');
  if(track)track.innerHTML+=track.innerHTML;
}

// ── Global toast ──
(function(){
  const box=document.createElement('div');box.id='toast-box';document.body.appendChild(box);
  window.showToast=function(msg,type='info',dur=3600){
    const icons={ok:'✅',error:'❌',warn:'⚠️',info:'ℹ️'};
    const cls={ok:'toast-ok',error:'toast-error',warn:'toast-warn',info:'toast-info'};
    const el=document.createElement('div');
    el.className=`toast ${cls[type]||'toast-info'}`;
    el.innerHTML=`<span>${icons[type]||'ℹ️'}</span><span>${msg}</span>`;
    box.appendChild(el);
    setTimeout(()=>{el.style.transition='all .3s';el.style.opacity='0';el.style.transform='translateX(44px)';setTimeout(()=>el.remove(),320);},dur);
  };
})();

document.addEventListener('DOMContentLoaded',()=>{
  initCursor(); initReveal(); initCounters(); initNav(); initMarquee();
  new ParticleSystem('particle-canvas');
});
