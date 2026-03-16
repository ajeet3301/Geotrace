/* ================================================================
   GEOTRACE — main.js
   Navigation, scroll reveal, counters, typewriter, cursor
   ================================================================ */

(function () {
  'use strict';

  /* ================================================================
     CUSTOM CURSOR
     ================================================================ */
  const dot  = document.getElementById('cursor-dot');
  const ring = document.getElementById('cursor-ring');

  if (dot && ring) {
    let rx = 0, ry = 0; // ring smoothed position
    let mx = 0, my = 0; // actual mouse

    document.addEventListener('mousemove', (e) => {
      mx = e.clientX; my = e.clientY;
      dot.style.left = mx + 'px';
      dot.style.top  = my + 'px';
    });

    // Smooth ring follow
    (function loop() {
      rx += (mx - rx) * 0.14;
      ry += (my - ry) * 0.14;
      ring.style.left = rx + 'px';
      ring.style.top  = ry + 'px';
      requestAnimationFrame(loop);
    })();

    // Hover state on interactive elements
    const hoverEls = document.querySelectorAll('a, button, .feature-card, .testimonial-card, .marquee-item');
    hoverEls.forEach((el) => {
      el.addEventListener('mouseenter', () => ring.classList.add('hovered'));
      el.addEventListener('mouseleave', () => ring.classList.remove('hovered'));
    });

    document.addEventListener('mouseleave', () => { dot.style.opacity = '0'; ring.style.opacity = '0'; });
    document.addEventListener('mouseenter', () => { dot.style.opacity = '1'; ring.style.opacity = '1'; });
  }

  /* ================================================================
     NAVIGATION — scroll shrink
     ================================================================ */
  const nav = document.querySelector('.nav');
  if (nav) {
    window.addEventListener('scroll', () => {
      nav.classList.toggle('scrolled', window.scrollY > 20);
    }, { passive: true });
  }

  /* ================================================================
     MOBILE MENU
     ================================================================ */
  const toggle = document.querySelector('.nav-toggle');
  const links  = document.querySelector('.nav-links');
  const cta    = document.querySelector('.nav-cta');

  if (toggle && links) {
    toggle.addEventListener('click', () => {
      const open = links.classList.toggle('open');
      toggle.setAttribute('aria-expanded', open);
      if (cta) cta.classList.toggle('open', open);

      // Animate hamburger → X
      const spans = toggle.querySelectorAll('span');
      if (open) {
        spans[0].style.transform = 'translateY(7px) rotate(45deg)';
        spans[1].style.opacity   = '0';
        spans[2].style.transform = 'translateY(-7px) rotate(-45deg)';
      } else {
        spans.forEach((s) => { s.style.transform = ''; s.style.opacity = ''; });
      }
    });

    // Close on link click
    links.querySelectorAll('a').forEach((a) => {
      a.addEventListener('click', () => {
        links.classList.remove('open');
        if (cta) cta.classList.remove('open');
        toggle.setAttribute('aria-expanded', 'false');
        const spans = toggle.querySelectorAll('span');
        spans.forEach((s) => { s.style.transform = ''; s.style.opacity = ''; });
      });
    });
  }

  /* ================================================================
     SCROLL REVEAL
     ================================================================ */
  const reveals = document.querySelectorAll('.reveal');
  if ('IntersectionObserver' in window && reveals.length) {
    const io = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('visible');
          io.unobserve(entry.target);
        }
      });
    }, { threshold: 0.1, rootMargin: '0px 0px -60px 0px' });

    reveals.forEach((el) => io.observe(el));
  } else {
    reveals.forEach((el) => el.classList.add('visible'));
  }

  /* ================================================================
     COUNTER ANIMATION
     ================================================================ */
  function animateCounters() {
    const counters = document.querySelectorAll('[data-count]');
    counters.forEach((el) => {
      const target = parseFloat(el.dataset.count);
      const suffix = el.dataset.suffix || '';
      const duration = 2000;
      const start = performance.now();

      (function step(now) {
        const progress = Math.min((now - start) / duration, 1);
        const ease     = 1 - Math.pow(1 - progress, 4); // ease out quart
        const current  = target * ease;

        // Format
        if (target >= 1000000) {
          el.textContent = (current / 1000000).toFixed(1) + 'M' + suffix;
        } else if (target >= 1000) {
          el.textContent = Math.round(current).toLocaleString() + suffix;
        } else if (target % 1 !== 0) {
          el.textContent = current.toFixed(1) + suffix;
        } else {
          el.textContent = Math.round(current) + suffix;
        }

        if (progress < 1) requestAnimationFrame(step);
      })(start);
    });
  }

  // Fire counters when hero is visible
  const heroStats = document.querySelector('.hero-stats');
  if (heroStats && 'IntersectionObserver' in window) {
    let fired = false;
    const io = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting && !fired) {
        fired = true;
        animateCounters();
        io.disconnect();
      }
    }, { threshold: 0.3 });
    io.observe(heroStats);
  } else {
    animateCounters();
  }

  /* ================================================================
     TYPEWRITER
     ================================================================ */
  const tw = document.getElementById('typewriter');
  if (tw) {
    const words = ['PHOTO', 'IMAGE', 'LOCATION', 'MOMENT', 'MEMORY'];
    let wi = 0, ci = 0, deleting = false;

    function type() {
      const word = words[wi];
      if (deleting) {
        ci--;
        tw.textContent = word.substring(0, ci);
        if (ci === 0) { deleting = false; wi = (wi + 1) % words.length; setTimeout(type, 400); return; }
        setTimeout(type, 60);
      } else {
        ci++;
        tw.textContent = word.substring(0, ci);
        if (ci === word.length) { deleting = true; setTimeout(type, 2000); return; }
        setTimeout(type, 110);
      }
    }
    setTimeout(type, 1500);
  }

  /* ================================================================
     DUPLICATE MARQUEE for seamless scroll
     ================================================================ */
  const track = document.querySelector('.marquee-track');
  if (track) {
    track.innerHTML += track.innerHTML; // duplicate items
  }

  /* ================================================================
     SMOOTH ANCHOR SCROLL
     ================================================================ */
  document.querySelectorAll('a[href^="#"]').forEach((a) => {
    a.addEventListener('click', (e) => {
      const id = a.getAttribute('href').slice(1);
      const target = document.getElementById(id);
      if (target) {
        e.preventDefault();
        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    });
  });

  /* ================================================================
     TOAST UTILITY — exposed globally
     ================================================================ */
  window.GeoTrace = window.GeoTrace || {};
  window.GeoTrace.toast = function (msg, type = 'info', duration = 4000) {
    let container = document.getElementById('toast-container');
    if (!container) {
      container = document.createElement('div');
      container.id = 'toast-container';
      container.style.cssText = `
        position: fixed; bottom: 24px; right: 24px; z-index: 9999;
        display: flex; flex-direction: column; gap: 12px;
      `;
      document.body.appendChild(container);
    }

    const colors = {
      info:    'var(--neon-cyan)',
      success: 'var(--neon-green)',
      error:   'var(--neon-red)',
      warn:    'var(--neon-gold)',
    };

    const toast = document.createElement('div');
    toast.style.cssText = `
      padding: 12px 20px; border-radius: 10px;
      background: rgba(8,13,24,0.95); border: 1px solid ${colors[type] || colors.info};
      color: var(--text-primary); font-size: 14px; font-family: var(--font-body);
      box-shadow: 0 4px 24px rgba(0,0,0,0.4);
      animation: toast-in 0.3s ease; max-width: 340px;
      display: flex; align-items: center; gap: 10px;
    `;

    const icons = { info: 'ℹ️', success: '✅', error: '❌', warn: '⚠️' };
    toast.innerHTML = `<span>${icons[type] || ''}</span><span>${msg}</span>`;
    container.appendChild(toast);

    setTimeout(() => {
      toast.style.animation = 'toast-out 0.3s ease forwards';
      setTimeout(() => toast.remove(), 300);
    }, duration);
  };

})();
