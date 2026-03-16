/* ================================================================
   GEOTRACE — constellation.js
   Click anywhere on hero to place glowing star markers.
   Animate constellation lines between them.
   Removing a point shows particle break effect.
   ================================================================ */

(function () {
  'use strict';

  /* ── Only on landing page ── */
  const hero = document.querySelector('.hero');
  if (!hero) return;

  /* ── Create overlay canvas ── */
  const canvas = document.createElement('canvas');
  canvas.id = 'constellation-canvas';
  canvas.setAttribute('aria-hidden', 'true');
  canvas.style.cssText = `
    position: absolute;
    inset: 0;
    width: 100%; height: 100%;
    pointer-events: none;
    z-index: 2;
  `;
  hero.style.position = 'relative';
  hero.appendChild(canvas);

  /* ── Interaction layer (captures clicks) ── */
  const interactLayer = document.createElement('div');
  interactLayer.style.cssText = `
    position: absolute;
    inset: 0;
    z-index: 3;
    cursor: crosshair;
  `;
  hero.appendChild(interactLayer);

  const ctx = canvas.getContext('2d');

  let W, H;
  const points    = [];
  const particles = [];
  const MAX_POINTS = 8;

  /* ── Resize ── */
  function resize() {
    const rect = hero.getBoundingClientRect();
    W = canvas.width  = rect.width;
    H = canvas.height = rect.height;
  }
  resize();
  window.addEventListener('resize', resize);

  /* ── Spawn star point ── */
  interactLayer.addEventListener('click', (e) => {
    const rect = hero.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    // Remove oldest if max reached
    if (points.length >= MAX_POINTS) {
      const removed = points.shift();
      spawnBreakParticles(removed.x, removed.y);
    }

    points.push({
      x, y,
      r:     0,           // animated radius
      alpha: 0,
      phase: Math.random() * Math.PI * 2,
      hue:   Math.random() > 0.5 ? 192 : 268, // cyan or violet
      rings: [{ r: 0, alpha: 0.8 }],
    });
  });

  /* ── Break particles ── */
  function spawnBreakParticles(x, y) {
    for (let i = 0; i < 12; i++) {
      const angle = (Math.PI * 2 * i) / 12 + Math.random() * 0.5;
      const speed = 1 + Math.random() * 2.5;
      particles.push({
        x, y,
        vx:    Math.cos(angle) * speed,
        vy:    Math.sin(angle) * speed,
        alpha: 0.9,
        r:     2 + Math.random() * 3,
        hue:   192,
        life:  1,
      });
    }
  }

  /* ── Line connection state ── */
  const lineProgress = new Map();

  function lineKey(i, j) { return `${Math.min(i,j)}-${Math.max(i,j)}`; }

  /* ── Main draw loop ── */
  let t = 0;
  function draw() {
    requestAnimationFrame(draw);
    ctx.clearRect(0, 0, W, H);
    t += 0.016;

    /* ── Draw constellation lines ── */
    for (let i = 0; i < points.length; i++) {
      for (let j = i + 1; j < points.length; j++) {
        const a = points[i], b = points[j];
        const dx = b.x - a.x, dy = b.y - a.y;
        const dist = Math.sqrt(dx*dx + dy*dy);
        if (dist > 320) continue;

        const key = lineKey(i, j);
        let prog = lineProgress.get(key) || 0;
        prog = Math.min(prog + 0.03, 1);
        lineProgress.set(key, prog);

        // Draw arc in segments for animated reveal
        const endX = a.x + dx * prog;
        const endY = a.y + dy * prog;

        const opacity = (1 - dist / 320) * 0.5 * Math.min(a.alpha, b.alpha);

        // Outer glow
        ctx.save();
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(endX, endY);
        ctx.strokeStyle = `hsla(${(a.hue + b.hue)/2}, 85%, 65%, ${opacity * 0.3})`;
        ctx.lineWidth = 3;
        ctx.filter = 'blur(3px)';
        ctx.stroke();
        ctx.restore();

        // Core line
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(endX, endY);
        const grad = ctx.createLinearGradient(a.x, a.y, endX, endY);
        grad.addColorStop(0, `hsla(${a.hue}, 85%, 65%, ${opacity})`);
        grad.addColorStop(1, `hsla(${b.hue}, 85%, 65%, ${opacity})`);
        ctx.strokeStyle = grad;
        ctx.lineWidth = 0.8;
        ctx.stroke();

        // Animated travel dot along line
        const dotPos = (Math.sin(t * 1.5 + i + j) * 0.5 + 0.5) * prog;
        const dotX = a.x + dx * dotPos;
        const dotY = a.y + dy * dotPos;
        ctx.beginPath();
        ctx.arc(dotX, dotY, 1.5, 0, Math.PI * 2);
        ctx.fillStyle = `hsla(192, 100%, 75%, ${opacity * 1.5})`;
        ctx.fill();
      }
    }

    /* ── Draw star points ── */
    points.forEach((p, idx) => {
      // Animate in
      p.r     = Math.min(p.r + 0.3, 6);
      p.alpha = Math.min(p.alpha + 0.05, 1);

      const pulse = 0.7 + 0.3 * Math.sin(t * 2 + p.phase);

      // Outer glow halo
      const halo = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, 30);
      halo.addColorStop(0, `hsla(${p.hue}, 90%, 65%, ${0.25 * p.alpha * pulse})`);
      halo.addColorStop(1, `hsla(${p.hue}, 90%, 65%, 0)`);
      ctx.beginPath();
      ctx.arc(p.x, p.y, 30, 0, Math.PI * 2);
      ctx.fillStyle = halo;
      ctx.fill();

      // Pulse rings
      p.rings.forEach((ring, ri) => {
        ring.r     += 0.8;
        ring.alpha -= 0.012;
        if (ring.alpha <= 0) p.rings.splice(ri, 1);

        ctx.beginPath();
        ctx.arc(p.x, p.y, ring.r, 0, Math.PI * 2);
        ctx.strokeStyle = `hsla(${p.hue}, 85%, 65%, ${ring.alpha * p.alpha})`;
        ctx.lineWidth = 1;
        ctx.stroke();
      });

      // Spawn new ring occasionally
      if (Math.random() < 0.02) p.rings.push({ r: p.r, alpha: 0.6 });

      // Core star dot
      const coreGrad = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r * pulse);
      coreGrad.addColorStop(0, `hsla(${p.hue}, 100%, 95%, ${p.alpha})`);
      coreGrad.addColorStop(0.4, `hsla(${p.hue}, 90%, 70%, ${p.alpha * 0.9})`);
      coreGrad.addColorStop(1, `hsla(${p.hue}, 85%, 60%, 0)`);
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r * pulse, 0, Math.PI * 2);
      ctx.fillStyle = coreGrad;
      ctx.fill();

      // Cross/star sparkle
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(t * 0.3 + p.phase);
      ctx.strokeStyle = `hsla(${p.hue}, 100%, 85%, ${p.alpha * 0.6})`;
      ctx.lineWidth = 0.8;
      const sparkLen = p.r * 2.5 * pulse;
      [-1, 1].forEach((d) => {
        ctx.beginPath();
        ctx.moveTo(-sparkLen * d, 0);
        ctx.lineTo( sparkLen * d, 0);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(0, -sparkLen * d);
        ctx.lineTo(0,  sparkLen * d);
        ctx.stroke();
      });
      ctx.restore();

      // Index label
      ctx.font = `9px JetBrains Mono, monospace`;
      ctx.fillStyle = `hsla(${p.hue}, 80%, 70%, ${p.alpha * 0.8})`;
      ctx.fillText(`PT${idx + 1}`, p.x + 10, p.y - 10);
    });

    /* ── Particles (break effect) ── */
    particles.forEach((par, i) => {
      par.x     += par.vx;
      par.y     += par.vy;
      par.vy    += 0.05;
      par.alpha -= 0.025;
      par.r     *= 0.97;

      if (par.alpha <= 0) { particles.splice(i, 1); return; }

      ctx.beginPath();
      ctx.arc(par.x, par.y, par.r, 0, Math.PI * 2);
      ctx.fillStyle = `hsla(${par.hue}, 90%, 70%, ${par.alpha})`;
      ctx.fill();
    });

    // Clean up stale line keys when points removed
    lineProgress.forEach((_, key) => {
      const [ai, bi] = key.split('-').map(Number);
      if (ai >= points.length || bi >= points.length) lineProgress.delete(key);
    });
  }

  draw();

  /* ── Hint tooltip ── */
  const hint = document.createElement('div');
  hint.setAttribute('aria-hidden', 'true');
  hint.style.cssText = `
    position: absolute;
    bottom: 24px; left: 50%;
    transform: translateX(-50%);
    font-family: 'JetBrains Mono', monospace;
    font-size: 10px;
    letter-spacing: 2px;
    color: rgba(6,182,212,0.5);
    pointer-events: none;
    z-index: 4;
    animation: fade-up 0.6s ease 2s both;
    text-transform: uppercase;
  `;
  hint.textContent = '✦ Click anywhere to place location markers ✦';
  hero.appendChild(hint);

  // Fade hint after first click
  interactLayer.addEventListener('click', () => {
    hint.style.opacity = '0';
    hint.style.transition = 'opacity 0.5s';
  }, { once: true });
})();
