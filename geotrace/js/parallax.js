/* ================================================================
   GEOTRACE — parallax.js
   Mouse parallax, scroll parallax, dynamic image movement
   ================================================================ */

class ParallaxEngine {
  constructor() {
    this.mouseX   = 0;
    this.mouseY   = 0;
    this.targetX  = 0;
    this.targetY  = 0;
    this.smoothX  = 0;
    this.smoothY  = 0;
    this.rafId    = null;
    this.isMobile = window.matchMedia('(max-width: 768px)').matches;

    this.init();
  }

  init() {
    this.bindMouseParallax();
    this.bindScrollParallax();
    this.loop();
  }

  // ── Mouse move parallax ───────────────────────────────────────
  bindMouseParallax() {
    if (this.isMobile) return;

    window.addEventListener('mousemove', e => {
      // Normalized -1 to 1
      this.targetX = (e.clientX / window.innerWidth  - 0.5) * 2;
      this.targetY = (e.clientY / window.innerHeight - 0.5) * 2;
    }, { passive: true });

    window.addEventListener('mouseleave', () => {
      this.targetX = 0;
      this.targetY = 0;
    }, { passive: true });
  }

  // ── Scroll parallax ───────────────────────────────────────────
  bindScrollParallax() {
    const scrollEls = document.querySelectorAll('[data-parallax]');

    const onScroll = () => {
      const scrollY = window.scrollY;

      scrollEls.forEach(el => {
        const speed  = parseFloat(el.dataset.parallax) || 0.2;
        const rect   = el.getBoundingClientRect();
        const center = rect.top + rect.height / 2 - window.innerHeight / 2;
        const offset = center * speed;

        el.style.transform = `translateY(${offset}px)`;
      });
    };

    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll(); // initial
  }

  // ── RAF loop — smooth mouse parallax ──────────────────────────
  loop() {
    this.rafId = requestAnimationFrame(() => this.loop());

    // Smooth interpolation
    this.smoothX += (this.targetX - this.smoothX) * 0.06;
    this.smoothY += (this.targetY - this.smoothY) * 0.06;

    this.applyMouseParallax(this.smoothX, this.smoothY);
  }

  applyMouseParallax(nx, ny) {
    // Hero floating images — deep movement
    const heroMain = document.querySelector('.hero-img-main');
    if (heroMain) {
      const tx = nx * 18;
      const ty = ny * 12;
      heroMain.style.transform = `translate(calc(-50% + ${tx}px), calc(-50% + ${ty}px))`;
    }

    const float1 = document.querySelector('.hero-img-float-1');
    if (float1) {
      float1.style.transform = `translate(${nx * -28}px, ${ny * -18}px)`;
    }

    const float2 = document.querySelector('.hero-img-float-2');
    if (float2) {
      float2.style.transform = `translate(${nx * 22}px, ${ny * 14}px)`;
    }

    const float3 = document.querySelector('.hero-img-float-3');
    if (float3) {
      float3.style.transform = `translate(${nx * -14}px, ${ny * 20}px)`;
    }

    // Orbit rings
    const ring1 = document.querySelector('.orbit-ring');
    const ring2 = document.querySelector('.orbit-ring-2');
    if (ring1) ring1.style.transform = `translate(calc(-50% + ${nx * 8}px), calc(-50% + ${ny * 6}px)) rotate(${Date.now() / 40000 * 360}deg)`;
    if (ring2) ring2.style.transform = `translate(calc(-50% + ${nx * -10}px), calc(-50% + ${ny * -8}px)) rotate(${-Date.now() / 60000 * 360}deg)`;

    // Ambient orbs — slow drift
    const orbs = document.querySelectorAll('.orb');
    orbs.forEach((orb, i) => {
      const depth = (i + 1) * 0.4;
      const sign  = i % 2 === 0 ? 1 : -1;
      const base  = orb.style.transform || '';
      // Don't override animation — use a CSS var approach
      orb.style.setProperty('--px', `${nx * 30 * depth * sign}px`);
      orb.style.setProperty('--py', `${ny * 20 * depth * sign}px`);
    });

    // How-section images
    const howBack  = document.querySelector('.how-img-back');
    const howFront = document.querySelector('.how-img-front');
    const howPip   = document.querySelector('.how-img-pip');

    if (howBack)  {
      const base = 'rotate(2deg)';
      howBack.style.transform  = `${base} translate(${nx * 12}px, ${ny * 8}px)`;
    }
    if (howFront) {
      const base = 'rotate(-1.5deg)';
      howFront.style.transform = `${base} translate(${nx * -18}px, ${ny * -10}px)`;
    }
    if (howPip) {
      const base = 'rotate(1deg)';
      howPip.style.transform   = `${base} translate(${nx * 8}px, ${ny * 14}px)`;
    }

    // Nav subtle tilt
    const navInner = document.querySelector('.nav-inner');
    if (navInner) {
      navInner.style.transform = `translateX(${nx * 3}px)`;
    }
  }

  destroy() {
    if (this.rafId) cancelAnimationFrame(this.rafId);
  }
}

// ── Card 3D tilt on hover ─────────────────────────────────────────
function initCardTilt() {
  const cards = document.querySelectorAll('.glass');

  cards.forEach(card => {
    card.addEventListener('mousemove', e => {
      const rect   = card.getBoundingClientRect();
      const cx     = rect.left + rect.width  / 2;
      const cy     = rect.top  + rect.height / 2;
      const dx     = (e.clientX - cx) / (rect.width  / 2);
      const dy     = (e.clientY - cy) / (rect.height / 2);
      const tiltX  = dy * -10;
      const tiltY  = dx *  10;

      card.style.transform = `
        translateY(-6px) scale(1.01)
        perspective(800px)
        rotateX(${tiltX}deg)
        rotateY(${tiltY}deg)
      `;

      // Dynamic highlight position
      const glowX = ((e.clientX - rect.left) / rect.width)  * 100;
      const glowY = ((e.clientY - rect.top)  / rect.height) * 100;
      card.style.setProperty('--gx', `${glowX}%`);
      card.style.setProperty('--gy', `${glowY}%`);
    });

    card.addEventListener('mouseleave', () => {
      card.style.transform = '';
    });
  });
}

// ── Smooth cursor ─────────────────────────────────────────────────
function initCursor() {
  const dot  = document.getElementById('cursor-dot');
  const ring = document.getElementById('cursor-ring');
  if (!dot || !ring) return;

  let dotX   = 0, dotY   = 0;
  let ringX  = 0, ringY  = 0;
  let mouseX = 0, mouseY = 0;

  document.addEventListener('mousemove', e => {
    mouseX = e.clientX;
    mouseY = e.clientY;
  }, { passive: true });

  function animCursor() {
    // Dot snaps fast
    dotX += (mouseX - dotX) * 0.8;
    dotY += (mouseY - dotY) * 0.8;
    // Ring lags
    ringX += (mouseX - ringX) * 0.12;
    ringY += (mouseY - ringY) * 0.12;

    dot.style.left  = dotX  + 'px';
    dot.style.top   = dotY  + 'px';
    ring.style.left = ringX + 'px';
    ring.style.top  = ringY + 'px';

    requestAnimationFrame(animCursor);
  }

  animCursor();
}

// Initialize
document.addEventListener('DOMContentLoaded', () => {
  if (!window.matchMedia('(max-width: 768px)').matches) {
    window._parallax = new ParallaxEngine();
    initCursor();
  }
  initCardTilt();
});
