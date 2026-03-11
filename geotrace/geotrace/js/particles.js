// particles.js — Canvas Particle Animation System

class ParticleSystem {
  constructor(canvasId, config = {}) {
    this.canvas = document.getElementById(canvasId);
    if (!this.canvas) return;

    this.ctx = this.canvas.getContext('2d');
    this.config = {
      count:          config.count       || 80,
      maxRadius:      config.maxRadius   || 2.5,
      minRadius:      config.minRadius   || 0.5,
      speed:          config.speed       || 0.4,
      connectDist:    config.connectDist || 140,
      repelRadius:    config.repelRadius || 100,
      repelStrength:  config.repelStrength || 4,
      colors:         config.colors      || ['#7c3aed','#06b6d4','#e879f9','#10b981','#fbbf24'],
      trailAlpha:     config.trailAlpha  || 0.12
    };

    this.particles = [];
    this.mouse = { x: -9999, y: -9999 };
    this.animFrameId = null;

    this.resize();
    this.initParticles();
    this.bindEvents();
    this.loop();
  }

  resize() {
    this.canvas.width  = window.innerWidth;
    this.canvas.height = window.innerHeight;
  }

  initParticles() {
    this.particles = Array.from({ length: this.config.count }, () => this.createParticle());
  }

  createParticle(x, y) {
    const colors = this.config.colors;
    return {
      x:        x !== undefined ? x : Math.random() * this.canvas.width,
      y:        y !== undefined ? y : Math.random() * this.canvas.height,
      vx:       (Math.random() - 0.5) * this.config.speed * 2,
      vy:       (Math.random() - 0.5) * this.config.speed * 2,
      radius:   this.config.minRadius + Math.random() * (this.config.maxRadius - this.config.minRadius),
      color:    colors[Math.floor(Math.random() * colors.length)],
      alpha:    0.3 + Math.random() * 0.5,
      alphaDir: Math.random() > 0.5 ? 1 : -1,
      alphaSpd: 0.003 + Math.random() * 0.007
    };
  }

  update() {
    this.particles.forEach(p => {
      p.x += p.vx;
      p.y += p.vy;

      // Wrap edges
      if (p.x < -10)                      p.x = this.canvas.width  + 10;
      if (p.x > this.canvas.width  + 10)  p.x = -10;
      if (p.y < -10)                      p.y = this.canvas.height + 10;
      if (p.y > this.canvas.height + 10)  p.y = -10;

      // Pulse alpha
      p.alpha += p.alphaDir * p.alphaSpd;
      if (p.alpha > 0.8 || p.alpha < 0.1) {
        p.alphaDir *= -1;
        p.alpha = Math.max(0.1, Math.min(0.8, p.alpha));
      }

      // Mouse repel
      const dx = p.x - this.mouse.x;
      const dy = p.y - this.mouse.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < this.config.repelRadius && dist > 0) {
        const force = (this.config.repelRadius - dist) / this.config.repelRadius;
        p.vx += (dx / dist) * force * this.config.repelStrength * 0.05;
        p.vy += (dy / dist) * force * this.config.repelStrength * 0.05;
      }

      // Damping
      p.vx *= 0.99;
      p.vy *= 0.99;

      // Clamp speed
      const spd = Math.sqrt(p.vx * p.vx + p.vy * p.vy);
      const maxSpd = this.config.speed * 3;
      if (spd > maxSpd) { p.vx = (p.vx / spd) * maxSpd; p.vy = (p.vy / spd) * maxSpd; }
    });
  }

  draw() {
    const ctx = this.ctx;

    // Trail effect
    ctx.fillStyle = `rgba(2,4,8,${this.config.trailAlpha})`;
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

    // Draw connections
    for (let i = 0; i < this.particles.length; i++) {
      for (let j = i + 1; j < this.particles.length; j++) {
        const a = this.particles[i];
        const b = this.particles[j];
        const dx = a.x - b.x;
        const dy = a.y - b.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist < this.config.connectDist) {
          const lineAlpha = (1 - dist / this.config.connectDist) * 0.25;
          ctx.beginPath();
          ctx.moveTo(a.x, a.y);
          ctx.lineTo(b.x, b.y);

          // Gradient line
          const grad = ctx.createLinearGradient(a.x, a.y, b.x, b.y);
          grad.addColorStop(0, a.color + Math.round(lineAlpha * 255).toString(16).padStart(2,'0'));
          grad.addColorStop(1, b.color + Math.round(lineAlpha * 255).toString(16).padStart(2,'0'));
          ctx.strokeStyle = grad;
          ctx.lineWidth = 0.8;
          ctx.stroke();
        }
      }
    }

    // Draw particles
    this.particles.forEach(p => {
      // Glow
      const glow = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.radius * 4);
      glow.addColorStop(0, p.color + Math.round(p.alpha * 0.6 * 255).toString(16).padStart(2,'0'));
      glow.addColorStop(1, p.color + '00');

      ctx.beginPath();
      ctx.arc(p.x, p.y, p.radius * 4, 0, Math.PI * 2);
      ctx.fillStyle = glow;
      ctx.fill();

      // Core
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
      ctx.fillStyle = p.color + Math.round(p.alpha * 255).toString(16).padStart(2,'0');
      ctx.fill();
    });
  }

  loop() {
    this.update();
    this.draw();
    this.animFrameId = requestAnimationFrame(() => this.loop());
  }

  bindEvents() {
    window.addEventListener('mousemove', e => {
      this.mouse.x = e.clientX;
      this.mouse.y = e.clientY;
    });

    window.addEventListener('mouseleave', () => {
      this.mouse.x = -9999;
      this.mouse.y = -9999;
    });

    window.addEventListener('resize', () => {
      this.resize();
    });
  }

  destroy() {
    if (this.animFrameId) cancelAnimationFrame(this.animFrameId);
  }
}

window.ParticleSystem = ParticleSystem;
