class ParticleSystem {
  constructor(canvasId, opts = {}) {
    this.canvas = document.getElementById(canvasId);
    if (!this.canvas) return;
    this.ctx = this.canvas.getContext('2d');
    this.count = opts.count || 55;
    this.color = opts.color || null; // null = mixed
    this.pts = [];
    this.resize();
    this.init();
    this.draw();
    window.addEventListener('resize', () => { this.resize(); this.init(); });
  }
  resize() {
    this.W = this.canvas.width  = window.innerWidth;
    this.H = this.canvas.height = window.innerHeight;
  }
  init() {
    const cols = this.color ? [this.color] : ['#7c3aed','#06b6d4','#e879f9','#10b981'];
    this.pts = Array.from({ length: this.count }, () => ({
      x: Math.random() * this.W,
      y: Math.random() * this.H,
      vx: (Math.random() - .5) * .35,
      vy: (Math.random() - .5) * .35,
      r:  Math.random() * 1.6 + .4,
      c:  cols[Math.floor(Math.random() * cols.length)]
    }));
  }
  draw() {
    const { ctx, W, H, pts } = this;
    ctx.clearRect(0, 0, W, H);
    pts.forEach(p => {
      p.x += p.vx; p.y += p.vy;
      if (p.x < 0 || p.x > W) p.vx *= -1;
      if (p.y < 0 || p.y > H) p.vy *= -1;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fillStyle = p.c + '30';
      ctx.fill();
    });
    for (let i = 0; i < pts.length; i++) {
      for (let j = i + 1; j < pts.length; j++) {
        const dx = pts[i].x - pts[j].x, dy = pts[i].y - pts[j].y;
        const d  = Math.sqrt(dx * dx + dy * dy);
        if (d < 90) {
          ctx.beginPath();
          ctx.moveTo(pts[i].x, pts[i].y);
          ctx.lineTo(pts[j].x, pts[j].y);
          ctx.strokeStyle = `rgba(124,58,237,${(1 - d / 90) * .09})`;
          ctx.lineWidth = .5;
          ctx.stroke();
        }
      }
    }
    requestAnimationFrame(() => this.draw());
  }
}
