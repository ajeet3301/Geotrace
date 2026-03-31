/* GEOTRACE — parallax.js (original) */
(function(){
'use strict';
let ticking=false;
const orb1=document.querySelector('.orb-1'),orb2=document.querySelector('.orb-2'),orb3=document.querySelector('.orb-3'),orb4=document.querySelector('.orb-4');
const glowOverlay=document.createElement('div');
glowOverlay.style.cssText='position:fixed;inset:0;pointer-events:none;z-index:0;transition:background 1.2s ease;';
document.body.appendChild(glowOverlay);
const sections=document.querySelectorAll('[data-glow]');
function onScroll(){if(ticking)return;ticking=true;requestAnimationFrame(()=>{const sy=window.scrollY,vh=window.innerHeight;if(orb1)orb1.style.transform=`translateY(${sy*0.12}px)`;if(orb2)orb2.style.transform=`translateY(${-sy*0.08}px)`;if(orb3)orb3.style.transform=`translateY(${sy*0.06}px)`;if(orb4)orb4.style.transform=`translateY(${-sy*0.05}px)`;let activeGlow=null;sections.forEach(sec=>{const rect=sec.getBoundingClientRect();if(rect.top<vh*0.6&&rect.bottom>vh*0.2){activeGlow=sec.dataset.glow;}});if(activeGlow){glowOverlay.style.background=`radial-gradient(ellipse 60% 50% at 50% 50%,${activeGlow},transparent 70%)`;}else{glowOverlay.style.background='none';}ticking=false;});}
window.addEventListener('scroll',onScroll,{passive:true});
const heroVisual=document.querySelector('.hero-visual');
if(heroVisual){document.addEventListener('mousemove',(e)=>{const cx=window.innerWidth/2,cy=window.innerHeight/2,dx=(e.clientX-cx)/cx,dy=(e.clientY-cy)/cy;heroVisual.style.transform=`perspective(1000px) rotateY(${dx*4}deg) rotateX(${-dy*3}deg)`;});document.addEventListener('mouseleave',()=>{heroVisual.style.transform='';});}
})();
