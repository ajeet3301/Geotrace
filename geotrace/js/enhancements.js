/* ================================================================
   GEOTRACE — enhancements.js
   Hover glows, scroll animations, map signal pulses,
   animated location connection lines.
   Works on both landing page and app page.
   ================================================================ */

(function () {
  'use strict';

  /* ================================================================
     1. ENHANCED HOVER GLOW — buttons & cards
     ================================================================ */
  function setupHoverGlows() {
    const hoverTargets = document.querySelectorAll(
      '.btn-primary, .btn-ghost, .nav-cta, .feature-card, ' +
      '.stat-card, .testimonial-card, .glass, .panel-card, .upload-zone'
    );

    hoverTargets.forEach((el) => {
      el.addEventListener('mousemove', (e) => {
        const rect  = el.getBoundingClientRect();
        const x     = e.clientX - rect.left;
        const y     = e.clientY - rect.top;
        const xPct  = (x / rect.width)  * 100;
        const yPct  = (y / rect.height) * 100;

        el.style.setProperty('--mouse-x', `${xPct}%`);
        el.style.setProperty('--mouse-y', `${yPct}%`);
        el.classList.add('mouse-glow');
      });

      el.addEventListener('mouseleave', () => {
        el.classList.remove('mouse-glow');
        el.style.removeProperty('--mouse-x');
        el.style.removeProperty('--mouse-y');
      });
    });
  }

  /* ================================================================
     2. ENHANCED SCROLL FADE-IN — stagger children inside sections
     ================================================================ */
  function setupScrollFade() {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        const el = entry.target;
        el.classList.add('enhance-visible');
        observer.unobserve(el);
      });
    }, { threshold: 0.08, rootMargin: '0px 0px -40px 0px' });

    // Stagger cards within grids
    const grids = document.querySelectorAll(
      '.features-grid, .stats-row, .testimonials-grid, .how-steps, .admin-stats-row'
    );

    grids.forEach((grid) => {
      Array.from(grid.children).forEach((child, i) => {
        child.classList.add('enhance-child');
        child.style.transitionDelay = `${i * 80}ms`;
        observer.observe(child);
      });
    });

    // Individual elements
    document.querySelectorAll('.trust-logo, .footer-link, .step-num').forEach((el, i) => {
      el.classList.add('enhance-child');
      el.style.transitionDelay = `${i * 30}ms`;
      observer.observe(el);
    });
  }

  /* ================================================================
     3. BUTTON RIPPLE EFFECT
     ================================================================ */
  function setupRipple() {
    document.querySelectorAll('.btn-primary, .btn-ghost, .nav-cta, .map-btn').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        const rect  = btn.getBoundingClientRect();
        const x     = e.clientX - rect.left;
        const y     = e.clientY - rect.top;

        const ripple = document.createElement('span');
        ripple.className = 'btn-ripple';
        ripple.style.cssText = `
          position: absolute;
          left: ${x}px; top: ${y}px;
          width: 0; height: 0;
          background: rgba(255,255,255,0.25);
          border-radius: 50%;
          transform: translate(-50%, -50%);
          animation: ripple-expand 0.6s ease-out forwards;
          pointer-events: none;
          z-index: 10;
        `;

        const wasRelative = getComputedStyle(btn).position;
        if (wasRelative === 'static') btn.style.position = 'relative';
        btn.style.overflow = 'hidden';
        btn.appendChild(ripple);
        setTimeout(() => ripple.remove(), 700);
      });
    });
  }

  /* ================================================================
     4. MAP SIGNAL PULSES — app page only
     ================================================================ */
  function setupMapSignals() {
    if (!document.getElementById('map')) return;

    // Watch for map marker appearance and add pulse overlay
    const mapEl = document.getElementById('map');
    const observer = new MutationObserver(() => {
      const markers = mapEl.querySelectorAll('.leaflet-marker-icon');
      markers.forEach((marker) => {
        if (marker.dataset.pulsed) return;
        marker.dataset.pulsed = '1';
        addPulseToMarker(marker);
      });
    });

    observer.observe(mapEl, { childList: true, subtree: true });
  }

  function addPulseToMarker(markerEl) {
    const wrap = document.createElement('div');
    wrap.className = 'map-signal-pulse';
    wrap.style.cssText = `
      position: absolute;
      top: 50%; left: 50%;
      transform: translate(-50%, -50%);
      pointer-events: none;
    `;

    for (let i = 0; i < 3; i++) {
      const ring = document.createElement('div');
      ring.style.cssText = `
        position: absolute;
        width: 40px; height: 40px;
        border: 1.5px solid rgba(6,182,212,0.7);
        border-radius: 50%;
        top: 50%; left: 50%;
        transform: translate(-50%, -50%) scale(0);
        animation: signal-pulse 2.4s ease-out ${i * 0.8}s infinite;
      `;
      wrap.appendChild(ring);
    }

    markerEl.style.position = 'relative';
    markerEl.style.overflow = 'visible';
    markerEl.appendChild(wrap);
  }

  /* ================================================================
     5. ANIMATED MAP CONNECTION LINES — app page
     ================================================================ */
  function setupMapConnections() {
    if (!document.getElementById('map')) return;

    const mapContainer = document.getElementById('map');
    const lineCanvas = document.createElement('canvas');
    lineCanvas.id = 'map-lines';
    lineCanvas.setAttribute('aria-hidden', 'true');
    lineCanvas.style.cssText = `
      position: absolute;
      inset: 0;
      pointer-events: none;
      z-index: 400;
      width: 100%; height: 100%;
    `;

    // Append when map is shown
    const observer = new MutationObserver(() => {
      if (mapContainer.style.display !== 'none' && !document.getElementById('map-lines')) {
        mapContainer.style.position = 'relative';
        mapContainer.appendChild(lineCanvas);

        const W = mapContainer.offsetWidth;
        const H = mapContainer.offsetHeight;
        lineCanvas.width  = W;
        lineCanvas.height = H;
        animateMapLines(lineCanvas, W, H);
      }
    });

    observer.observe(mapContainer, { attributes: true, attributeFilter: ['style'] });
  }

  function animateMapLines(canvas, W, H) {
    const ctx = canvas.getContext('2d');
    const cx = W / 2, cy = H / 2;
    let t = 0;

    // Simulate signal propagation from center marker
    const lines = Array.from({ length: 6 }, (_, i) => ({
      angle: (Math.PI * 2 * i) / 6,
      progress: Math.random(),
      speed: 0.004 + Math.random() * 0.003,
      length: 80 + Math.random() * 60,
      opacity: 0.3 + Math.random() * 0.3,
    }));

    function draw() {
      requestAnimationFrame(draw);
      ctx.clearRect(0, 0, W, H);
      t += 0.016;

      lines.forEach((line) => {
        line.progress += line.speed;
        if (line.progress > 1) line.progress = 0;

        const x = cx + Math.cos(line.angle) * line.length * line.progress;
        const y = cy + Math.sin(line.angle) * line.length * line.progress;

        // Fading trail
        const trail = ctx.createLinearGradient(cx, cy, x, y);
        trail.addColorStop(0, `rgba(124,58,237,0)`);
        trail.addColorStop(0.5, `rgba(6,182,212,${line.opacity * line.progress})`);
        trail.addColorStop(1, `rgba(6,182,212,${line.opacity})`);

        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.lineTo(x, y);
        ctx.strokeStyle = trail;
        ctx.lineWidth = 1.5;
        ctx.stroke();

        // Head dot
        ctx.beginPath();
        ctx.arc(x, y, 2.5, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(6,182,212,${line.opacity * 1.5})`;
        ctx.fill();
      });

      // Center pulse
      const pulse = 0.5 + 0.5 * Math.sin(t * 3);
      const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, 20 * pulse);
      grad.addColorStop(0, `rgba(6,182,212,${0.4 * pulse})`);
      grad.addColorStop(1, `rgba(6,182,212,0)`);
      ctx.beginPath();
      ctx.arc(cx, cy, 20 * pulse, 0, Math.PI * 2);
      ctx.fillStyle = grad;
      ctx.fill();
    }

    draw();
  }

  /* ================================================================
     6. SECTION ENTRANCE TEXT GLITCH
     ================================================================ */
  function setupSectionGlitch() {
    const titles = document.querySelectorAll('.section-title, .hero-headline');
    titles.forEach((title) => {
      title.addEventListener('mouseenter', () => {
        title.classList.add('glitch-hover');
        setTimeout(() => title.classList.remove('glitch-hover'), 500);
      });
    });
  }

  /* ================================================================
     7. CARD TILT (3D perspective on mouse)
     ================================================================ */
  function setupCardTilt() {
    const cards = document.querySelectorAll('.feature-card, .stat-card, .glass');
    cards.forEach((card) => {
      card.addEventListener('mousemove', (e) => {
        const rect   = card.getBoundingClientRect();
        const x      = e.clientX - rect.left - rect.width / 2;
        const y      = e.clientY - rect.top  - rect.height / 2;
        const rotX   = (-y / rect.height) * 8;
        const rotY   = ( x / rect.width)  * 8;
        card.style.transform = `perspective(600px) rotateX(${rotX}deg) rotateY(${rotY}deg) scale(1.02)`;
        card.style.transition = 'transform 0.1s linear';
      });

      card.addEventListener('mouseleave', () => {
        card.style.transform = '';
        card.style.transition = 'transform 0.4s ease';
      });
    });
  }

  /* ================================================================
     8. SCROLL PROGRESS BAR
     ================================================================ */
  function setupScrollProgress() {
    // Only on landing page
    if (!document.querySelector('.hero-headline')) return;

    const bar = document.createElement('div');
    bar.setAttribute('aria-hidden', 'true');
    bar.style.cssText = `
      position: fixed;
      top: 0; left: 0;
      height: 2px;
      width: 0%;
      background: linear-gradient(90deg, #7c3aed, #06b6d4, #e879f9);
      z-index: 9999;
      transition: width 0.1s linear;
      box-shadow: 0 0 8px rgba(6,182,212,0.6);
    `;
    document.body.appendChild(bar);

    window.addEventListener('scroll', () => {
      const total  = document.documentElement.scrollHeight - window.innerHeight;
      const pct    = (window.scrollY / total) * 100;
      bar.style.width = `${pct}%`;
    }, { passive: true });
  }

  /* ================================================================
     INIT — run after DOM ready
     ================================================================ */
  function init() {
    setupHoverGlows();
    setupScrollFade();
    setupRipple();
    setupMapSignals();
    setupMapConnections();
    setupSectionGlitch();
    setupCardTilt();
    setupScrollProgress();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
