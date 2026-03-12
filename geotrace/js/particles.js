/* GeoTrace — js/particles.js */
'use strict';
class ParticleSystem {
  constructor(canvasId, opts={}) {
    this.canvas=document.getElementById(canvasId);
    if(!this.canvas)return;
    this.ctx=this.canvas.getContext('2d');
    this.count=opts.count||55;
    this.cols=opts.colors||['#7c3aed','#06b6d4','#e879f9'];
    this.mouse={x:-999,y:-999};
    this.pts=[];
    this.resize(); this.spawn(); this.listen();
    requestAnimationFrame(this.draw.bind(this));
  }
  resize(){this.canvas.width=window.innerWidth;this.canvas.height=window.innerHeight}
  spawn(){
    this.pts=Array.from({length:this.count},()=>({
      x:Math.random()*this.canvas.width,y:Math.random()*this.canvas.height,
      vx:(Math.random()-.5)*.35,vy:(Math.random()-.5)*.35,
      r:Math.random()*1.8+.4,col:this.cols[Math.floor(Math.random()*this.cols.length)]
    }));
  }
  listen(){
    window.addEventListener('resize',()=>{this.resize();this.spawn()});
    window.addEventListener('mousemove',e=>{this.mouse.x=e.clientX;this.mouse.y=e.clientY});
  }
  draw(){
    const{ctx,canvas,pts,mouse}=this;
    ctx.clearRect(0,0,canvas.width,canvas.height);
    pts.forEach(p=>{
      const dx=p.x-mouse.x,dy=p.y-mouse.y,dist=Math.sqrt(dx*dx+dy*dy);
      if(dist<80){p.vx+=(dx/dist)*.3;p.vy+=(dy/dist)*.3}
      const sp=Math.sqrt(p.vx*p.vx+p.vy*p.vy);
      if(sp>1.5){p.vx*=.95;p.vy*=.95}
      p.x+=p.vx;p.y+=p.vy;
      if(p.x<0||p.x>canvas.width)p.vx*=-1;
      if(p.y<0||p.y>canvas.height)p.vy*=-1;
      ctx.beginPath();ctx.arc(p.x,p.y,p.r,0,Math.PI*2);
      ctx.fillStyle=p.col+'35';ctx.fill();
    });
    for(let i=0;i<pts.length;i++){
      for(let j=i+1;j<pts.length;j++){
        const dx=pts[i].x-pts[j].x,dy=pts[i].y-pts[j].y,d=Math.sqrt(dx*dx+dy*dy);
        if(d<90){
          ctx.beginPath();ctx.moveTo(pts[i].x,pts[i].y);ctx.lineTo(pts[j].x,pts[j].y);
          ctx.strokeStyle=`rgba(124,58,237,${(1-d/90)*.12})`;ctx.lineWidth=.6;ctx.stroke();
        }
      }
    }
    requestAnimationFrame(this.draw.bind(this));
  }
}
window.ParticleSystem=ParticleSystem;
