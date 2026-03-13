/* ================================================================
   GEOTRACE — parallax.js
   Scroll-driven parallax and section glow effects
   ================================================================ */

(function () {
  'use strict';

  let ticking = false;
  const orb1 = document.querySelector('.orb-1');
  const orb2 = document.querySelector('.orb-2');
  const orb3 = document.querySelector('.orb-3');
  const orb4 = document.querySelector('.orb-4');

  /* ── Section ambient glow ── */
  const glowOverlay = document.createElement('div');
  glowOverlay.style.cssText = `
    position: fixed; inset: 0; pointer-events: none; z-index: 0;
    transition: background 1.2s ease;
  `;
  document.body.appendChild(glowOverlay);

  const sections = document.querySelectorAll('[data-glow]');

  function onScroll() {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => {
      const sy = window.scrollY;
      const vh = window.innerHeight;

      /* Parallax orbs */
      if (orb1) orb1.style.transform = `translateY(${sy * 0.12}px)`;
      if (orb2) orb2.style.transform = `translateY(${-sy * 0.08}px)`;
      if (orb3) orb3.style.transform = `translateY(${sy * 0.06}px)`;
      if (orb4) orb4.style.transform = `translateY(${-sy * 0.05}px)`;

      /* Section ambient color */
      let activeGlow = null;
      sections.forEach((sec) => {
        const rect = sec.getBoundingClientRect();
        if (rect.top < vh * 0.6 && rect.bottom > vh * 0.2) {
          activeGlow = sec.dataset.glow;
        }
      });
      if (activeGlow) {
        glowOverlay.style.background = `radial-gradient(ellipse 60% 50% at 50% 50%, ${activeGlow}, transparent 70%)`;
      } else {
        glowOverlay.style.background = 'none';
      }

      ticking = false;
    });
  }

  window.addEventListener('scroll', onScroll, { passive: true });

  /* ── Hero images subtle tilt on mouse ── */
  const heroVisual = document.querySelector('.hero-visual');
  if (heroVisual) {
    document.addEventListener('mousemove', (e) => {
      const cx = window.innerWidth  / 2;
      const cy = window.innerHeight / 2;
      const dx = (e.clientX - cx) / cx;
      const dy = (e.clientY - cy) / cy;
      heroVisual.style.transform = `perspective(1000px) rotateY(${dx * 4}deg) rotateX(${-dy * 3}deg)`;
    });
    document.addEventListener('mouseleave', () => {
      heroVisual.style.transform = '';
    });
  }
})();
