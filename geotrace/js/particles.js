/* ================================================================
   GEOTRACE — particles.js
   Canvas-based moving light particle system with connections
   ================================================================ */

class ParticleSystem {
  constructor(canvasId) {
    this.canvas = document.getElementById(canvasId);
    if (!this.canvas) return;

    this.ctx    = this.canvas.getContext('2d');
    this.width  = 0;
    this.height = 0;
    this.particles    = [];
    this.mouseX       = -9999;
    this.mouseY       = -9999;
    this.animFrameId  = null;

    // Config — edit these freely
    this.config = {
      count:          120,
      maxRadius:      2.2,
      minRadius:      0.4,
      speed:          0.35,
      connectDist:    140,
      mouseRepelDist: 120,
      mouseRepelForce:0.8,
      colors: [
        { r:124, g:58,  b:237 },  // violet
        { r:6,   g:182, b:212 },  // cyan
        { r:232, g:121, b:249 },  // pink
        { r:52,  g:211, b:153 },  // green
        { r:251, g:191, b:36  },  // gold
      ],
      bgColor: 'rgba(2, 4, 8, 0.12)',  // trail fade
    };

    this.init();
  }

  // ── Setup ─────────────────────────────────────────────────────
  init() {
    this.resize();
    this.spawnParticles();
    this.bindEvents();
    this.tick();
  }

  resize() {
    this.width  = this.canvas.width  = window.innerWidth;
    this.height = this.canvas.height = window.innerHeight;
  }

  spawnParticles() {
    this.particles = [];
    for (let i = 0; i < this.config.count; i++) {
      this.particles.push(this.makeParticle());
    }
  }

  makeParticle(x, y) {
    const color = this.config.colors[Math.floor(Math.random() * this.config.colors.length)];
    const angle = Math.random() * Math.PI * 2;
    const speed = (0.2 + Math.random() * 0.8) * this.config.speed;

    return {
      x:    x ?? Math.random() * this.width,
      y:    y ?? Math.random() * this.height,
      vx:   Math.cos(angle) * speed,
      vy:   Math.sin(angle) * speed,
      r:    this.config.minRadius + Math.random() * (this.config.maxRadius - this.config.minRadius),
      color,
      alpha:      0.1 + Math.random() * 0.6,
      alphaDir:   Math.random() > 0.5 ? 1 : -1,
      alphaSpeed: 0.003 + Math.random() * 0.008,
      pulseOffset: Math.random() * Math.PI * 2,
    };
  }

  // ── Events ────────────────────────────────────────────────────
  bindEvents() {
    window.addEventListener('resize', () => {
      this.resize();
      this.spawnParticles();
    }, { passive: true });

    window.addEventListener('mousemove', e => {
      this.mouseX = e.clientX;
      this.mouseY = e.clientY;
    }, { passive: true });

    window.addEventListener('touchmove', e => {
      this.mouseX = e.touches[0].clientX;
      this.mouseY = e.touches[0].clientY;
    }, { passive: true });

    window.addEventListener('mouseleave', () => {
      this.mouseX = -9999;
      this.mouseY = -9999;
    }, { passive: true });
  }

  // ── Render loop ───────────────────────────────────────────────
  tick() {
    this.animFrameId = requestAnimationFrame(() => this.tick());
    this.update();
    this.draw();
  }

  update() {
    const { mouseX, mouseY } = this;
    const repelDist  = this.config.mouseRepelDist;
    const repelForce = this.config.mouseRepelForce;

    for (const p of this.particles) {
      // Mouse repel
      const dx    = p.x - mouseX;
      const dy    = p.y - mouseY;
      const dist2 = dx * dx + dy * dy;

      if (dist2 < repelDist * repelDist && dist2 > 0.1) {
        const dist  = Math.sqrt(dist2);
        const force = (repelDist - dist) / repelDist * repelForce;
        p.vx += (dx / dist) * force * 0.12;
        p.vy += (dy / dist) * force * 0.12;
      }

      // Velocity damping
      p.vx *= 0.995;
      p.vy *= 0.995;

      // Min speed
      const speed = Math.sqrt(p.vx * p.vx + p.vy * p.vy);
      if (speed < 0.05) {
        const angle = Math.random() * Math.PI * 2;
        p.vx += Math.cos(angle) * 0.04;
        p.vy += Math.sin(angle) * 0.04;
      }

      // Move
      p.x += p.vx;
      p.y += p.vy;

      // Wrap
      if (p.x < -10)              p.x = this.width  + 10;
      if (p.x > this.width  + 10) p.x = -10;
      if (p.y < -10)              p.y = this.height + 10;
      if (p.y > this.height + 10) p.y = -10;

      // Pulse alpha
      p.alpha += p.alphaDir * p.alphaSpeed;
      if (p.alpha > 0.75) { p.alpha = 0.75; p.alphaDir = -1; }
      if (p.alpha < 0.08) { p.alpha = 0.08; p.alphaDir =  1; }
    }
  }

  draw() {
    const ctx = this.ctx;

    // Fade trail
    ctx.fillStyle = this.config.bgColor;
    ctx.fillRect(0, 0, this.width, this.height);

    const connectDist2 = this.config.connectDist * this.config.connectDist;

    // Draw connections
    for (let i = 0; i < this.particles.length; i++) {
      const a = this.particles[i];

      for (let j = i + 1; j < this.particles.length; j++) {
        const b  = this.particles[j];
        const dx = a.x - b.x;
        const dy = a.y - b.y;
        const d2 = dx * dx + dy * dy;

        if (d2 < connectDist2) {
          const t       = 1 - d2 / connectDist2;
          const opacity = t * 0.2 * Math.min(a.alpha, b.alpha) * 1.5;

          // Color interpolation
          const r = Math.round((a.color.r + b.color.r) / 2);
          const g = Math.round((a.color.g + b.color.g) / 2);
          const bb = Math.round((a.color.b + b.color.b) / 2);

          ctx.beginPath();
          ctx.strokeStyle = `rgba(${r},${g},${bb},${opacity})`;
          ctx.lineWidth   = t * 0.8;
          ctx.moveTo(a.x, a.y);
          ctx.lineTo(b.x, b.y);
          ctx.stroke();
        }
      }
    }

    // Draw particles
    for (const p of this.particles) {
      const { r, g, b } = p.color;

      // Outer glow
      const gradient = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r * 4);
      gradient.addColorStop(0,   `rgba(${r},${g},${b},${p.alpha * 0.8})`);
      gradient.addColorStop(0.5, `rgba(${r},${g},${b},${p.alpha * 0.2})`);
      gradient.addColorStop(1,   `rgba(${r},${g},${b},0)`);

      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r * 4, 0, Math.PI * 2);
      ctx.fillStyle = gradient;
      ctx.fill();

      // Core dot
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(${r},${g},${b},${p.alpha})`;
      ctx.fill();
    }
  }

  destroy() {
    if (this.animFrameId) cancelAnimationFrame(this.animFrameId);
  }
}

// Initialize on DOM ready
document.addEventListener('DOMContentLoaded', () => {
  window._particles = new ParticleSystem('bg-canvas');
});
