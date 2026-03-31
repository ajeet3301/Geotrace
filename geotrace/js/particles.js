/* GEOTRACE — particles.js (original) */
(function(){
'use strict';
const canvas=document.getElementById('bg-canvas');
if(!canvas)return;
const ctx=canvas.getContext('2d');
let W,H,particles=[],animId;
const COUNT=90,MAX_DIST=140;
function resize(){W=canvas.width=window.innerWidth;H=canvas.height=window.innerHeight;}
function createParticle(){const hues=[268,192,300,165,40],hue=hues[Math.floor(Math.random()*hues.length)];return{x:Math.random()*W,y:Math.random()*H,vx:(Math.random()-0.5)*0.35,vy:(Math.random()-0.5)*0.35,r:Math.random()*1.6+0.4,hue,alpha:Math.random()*0.6+0.2,pulse:Math.random()*Math.PI*2,pulseSpeed:Math.random()*0.02+0.005};}
function init(){resize();particles=Array.from({length:COUNT},createParticle);}
function draw(){ctx.clearRect(0,0,W,H);for(let i=0;i<particles.length;i++){const p=particles[i];p.x+=p.vx;p.y+=p.vy;p.pulse+=p.pulseSpeed;if(p.x<-5)p.x=W+5;if(p.x>W+5)p.x=-5;if(p.y<-5)p.y=H+5;if(p.y>H+5)p.y=-5;const a=p.alpha*(0.7+0.3*Math.sin(p.pulse));const grad=ctx.createRadialGradient(p.x,p.y,0,p.x,p.y,p.r*4);grad.addColorStop(0,`hsla(${p.hue},85%,65%,${a})`);grad.addColorStop(1,`hsla(${p.hue},85%,65%,0)`);ctx.beginPath();ctx.arc(p.x,p.y,p.r*4,0,Math.PI*2);ctx.fillStyle=grad;ctx.fill();ctx.beginPath();ctx.arc(p.x,p.y,p.r,0,Math.PI*2);ctx.fillStyle=`hsla(${p.hue},85%,72%,${Math.min(a*1.8,1)})`;ctx.fill();for(let j=i+1;j<particles.length;j++){const q=particles[j],dx=p.x-q.x,dy=p.y-q.y,d=Math.sqrt(dx*dx+dy*dy);if(d<MAX_DIST){const opacity=(1-d/MAX_DIST)*0.18;ctx.beginPath();ctx.moveTo(p.x,p.y);ctx.lineTo(q.x,q.y);ctx.strokeStyle=`hsla(${(p.hue+q.hue)/2},80%,65%,${opacity})`;ctx.lineWidth=0.6;ctx.stroke();}}}animId=requestAnimationFrame(draw);}
let mouseX=-9999,mouseY=-9999;
document.addEventListener('mousemove',(e)=>{mouseX=e.clientX;mouseY=e.clientY;particles.forEach(p=>{const dx=p.x-mouseX,dy=p.y-mouseY,d=Math.sqrt(dx*dx+dy*dy);if(d<100){const force=(100-d)/100;p.vx+=(dx/d)*force*0.3;p.vy+=(dy/d)*force*0.3;const speed=Math.sqrt(p.vx*p.vx+p.vy*p.vy);if(speed>2){p.vx=(p.vx/speed)*2;p.vy=(p.vy/speed)*2;}}});});
setInterval(()=>{particles.forEach(p=>{p.vx*=0.98;p.vy*=0.98;});},50);
window.addEventListener('resize',()=>{resize();});
document.addEventListener('visibilitychange',()=>{if(document.hidden){cancelAnimationFrame(animId);}else{draw();}});
init();draw();
})();
