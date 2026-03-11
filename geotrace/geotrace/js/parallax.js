// parallax.js — Mouse Parallax + 3D Card Tilt + Custom Cursor

class ParallaxEngine {
  constructor() {
    this.mouseX = 0;
    this.mouseY = 0;
    this.targetX = 0;
    this.targetY = 0;
    this.rafId = null;

    this.layers = [];
    this.running = false;
  }

  lerp(a, b, t) { return a + (b - a) * t; }

  normalizeMousePos(e) {
    this.targetX = (e.clientX / window.innerWidth  - 0.5) * 2;
    this.targetY = (e.clientY / window.innerHeight - 0.5) * 2;
  }

  addLayer(selector, depthX, depthY, extra = {}) {
    const els = document.querySelectorAll(selector);
    els.forEach(el => {
      this.layers.push({ el, depthX, depthY, ...extra });
    });
  }

  start() {
    if (this.running) return;
    this.running = true;

    window.addEventListener('mousemove', e => this.normalizeMousePos(e));

    const tick = () => {
      this.mouseX = this.lerp(this.mouseX, this.targetX, 0.06);
      this.mouseY = this.lerp(this.mouseY, this.targetY, 0.06);

      this.layers.forEach(layer => {
        const tx = this.mouseX * layer.depthX;
        const ty = this.mouseY * layer.depthY;

        let transform = `translate(${tx}px, ${ty}px)`;
        if (layer.rotate) {
          transform += ` rotate(${this.mouseX * layer.rotate}deg)`;
        }

        layer.el.style.transform = transform;
      });

      this.rafId = requestAnimationFrame(tick);
    };

    tick();
  }

  stop() {
    this.running = false;
    if (this.rafId) cancelAnimationFrame(this.rafId);
  }
}

function initParallax() {
  const engine = new ParallaxEngine();

  // Hero floating images
  engine.addLayer('.float-1', 20, 15);
  engine.addLayer('.float-2', 30, 20);
  engine.addLayer('.float-3', 15, 25);
  engine.addLayer('.float-4', 25, 10);

  // Orbit rings
  engine.addLayer('.orbit-1', 5, 5, { rotate: 0.5 });
  engine.addLayer('.orbit-2', 3, 3, { rotate: -0.3 });

  // How section images
  engine.addLayer('.how-img-1', 12, 10);
  engine.addLayer('.how-img-2', 20, 15);
  engine.addLayer('.how-img-3', 8, 12);

  // Ambient orbs
  engine.addLayer('.orb-1', 8, 6);
  engine.addLayer('.orb-2', 6, 8);
  engine.addLayer('.orb-3', 4, 5);

  engine.start();
  return engine;
}

// 3D Card Tilt
function initCardTilt() {
  document.querySelectorAll('.glass').forEach(card => {
    card.addEventListener('mousemove', e => {
      const rect = card.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const cx = rect.width  / 2;
      const cy = rect.height / 2;
      const rotX = ((y - cy) / cy) * -8;
      const rotY = ((x - cx) / cx) *  8;

      card.style.transform = `translateY(-6px) scale(1.01) perspective(800px) rotateX(${rotX}deg) rotateY(${rotY}deg)`;
    });

    card.addEventListener('mouseleave', () => {
      card.style.transform = '';
    });
  });
}

// Custom Cursor
function initCursor() {
  const dot  = document.querySelector('.cursor-dot');
  const ring = document.querySelector('.cursor-ring');

  if (!dot || !ring) return;

  let dotX = 0, dotY = 0;
  let ringX = 0, ringY = 0;
  let mouseX = 0, mouseY = 0;

  window.addEventListener('mousemove', e => {
    mouseX = e.clientX;
    mouseY = e.clientY;
    dot.style.left = `${e.clientX}px`;
    dot.style.top  = `${e.clientY}px`;
  });

  function animRing() {
    ringX += (mouseX - ringX) * 0.12;
    ringY += (mouseY - ringY) * 0.12;
    ring.style.left = `${ringX}px`;
    ring.style.top  = `${ringY}px`;
    requestAnimationFrame(animRing);
  }

  animRing();
}

window.ParallaxEngine = ParallaxEngine;
window.initParallax   = initParallax;
window.initCardTilt   = initCardTilt;
window.initCursor     = initCursor;
