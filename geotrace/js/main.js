/* ================================================================
   GEOTRACE — main.js
   Scroll reveals, counters, nav, interactions, marquee
   ================================================================ */

// ── Scroll-triggered reveal ───────────────────────────────────────
function initReveal() {
  const els = document.querySelectorAll('.reveal');
  if (!els.length) return;

  const observer = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('revealed');
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.12, rootMargin: '0px 0px -60px 0px' });

  els.forEach(el => observer.observe(el));
}

// ── Animated counter ──────────────────────────────────────────────
function animateCounter(el, target, duration = 2000) {
  const start     = performance.now();
  const isDecimal = target % 1 !== 0;
  const suffix    = el.dataset.suffix || '';

  function update(now) {
    const elapsed  = now - start;
    const progress = Math.min(elapsed / duration, 1);

    // Ease out expo
    const ease = 1 - Math.pow(2, -10 * progress);
    const value = target * ease;

    el.textContent = isDecimal
      ? value.toFixed(1) + suffix
      : Math.round(value).toLocaleString() + suffix;

    if (progress < 1) requestAnimationFrame(update);
    else el.textContent = (isDecimal ? target.toFixed(1) : target.toLocaleString()) + suffix;
  }

  requestAnimationFrame(update);
}

function initCounters() {
  const counters = document.querySelectorAll('[data-count]');
  if (!counters.length) return;

  const observer = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const el     = entry.target;
        const target = parseFloat(el.dataset.count);
        animateCounter(el, target);
        observer.unobserve(el);
      }
    });
  }, { threshold: 0.5 });

  counters.forEach(el => observer.observe(el));
}

// ── Sticky nav ────────────────────────────────────────────────────
function initNav() {
  const nav    = document.querySelector('.nav');
  const toggle = document.querySelector('.nav-toggle');
  const links  = document.querySelector('.nav-links');
  const cta    = document.querySelector('.nav-cta');

  window.addEventListener('scroll', () => {
    nav.classList.toggle('scrolled', window.scrollY > 40);
  }, { passive: true });

  if (toggle) {
    toggle.addEventListener('click', () => {
      const open = links.classList.toggle('open');
      if (cta) cta.classList.toggle('open', open);

      // Hamburger → X
      const spans = toggle.querySelectorAll('span');
      if (open) {
        spans[0].style.transform = 'rotate(45deg) translate(5px, 5px)';
        spans[1].style.opacity   = '0';
        spans[2].style.transform = 'rotate(-45deg) translate(5px, -5px)';
      } else {
        spans[0].style.transform = '';
        spans[1].style.opacity   = '';
        spans[2].style.transform = '';
      }
    });
  }

  // Smooth scroll for anchor links
  document.querySelectorAll('a[href^="#"]').forEach(a => {
    a.addEventListener('click', e => {
      const id = a.getAttribute('href').slice(1);
      const el = document.getElementById(id);
      if (!el) return;
      e.preventDefault();
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      // Close mobile menu
      links?.classList.remove('open');
      cta?.classList.remove('open');
    });
  });
}

// ── Marquee duplication ───────────────────────────────────────────
function initMarquee() {
  const track = document.querySelector('.marquee-track');
  if (!track) return;
  // Duplicate items for seamless loop
  const items = track.innerHTML;
  track.innerHTML = items + items;
}

// ── Neon image float intensity on scroll ─────────────────────────
function initImageParallaxScroll() {
  const images = document.querySelectorAll('.how-img, .hero-img-float');

  window.addEventListener('scroll', () => {
    const scrollY = window.scrollY;
    images.forEach((img, i) => {
      const rect  = img.getBoundingClientRect();
      const inView = rect.top < window.innerHeight && rect.bottom > 0;
      if (!inView) return;

      const center  = rect.top + rect.height / 2 - window.innerHeight / 2;
      const ratio   = center / window.innerHeight;
      const dir     = i % 2 === 0 ? 1 : -1;
      const offset  = ratio * 25 * dir;

      // Preserve existing transforms from parallax engine by using CSS variable
      img.style.setProperty('--scroll-y', `${offset}px`);
    });
  }, { passive: true });
}

// ── Typing effect on hero ─────────────────────────────────────────
function initTypewriter() {
  const el = document.getElementById('typewriter');
  if (!el) return;

  const words   = ['PHOTO', 'IMAGE', 'MEMORY', 'MOMENT'];
  let wordIndex = 0;
  let charIndex = 0;
  let deleting  = false;
  let pausing   = false;

  function type() {
    const word    = words[wordIndex];
    const display = deleting ? word.slice(0, charIndex--) : word.slice(0, charIndex++);
    el.textContent = display;

    let delay = deleting ? 60 : 100;

    if (!deleting && charIndex > word.length) {
      deleting = true;
      delay    = 1800;
    } else if (deleting && charIndex < 0) {
      deleting   = false;
      wordIndex  = (wordIndex + 1) % words.length;
      charIndex  = 0;
      delay      = 400;
    }

    setTimeout(type, delay);
  }

  setTimeout(type, 1200);
}

// ── Hover glow on nav links ───────────────────────────────────────
function initNavGlow() {
  const navLinks = document.querySelectorAll('.nav-link');
  navLinks.forEach(link => {
    link.addEventListener('mouseenter', () => {
      link.style.textShadow = '0 0 20px rgba(6,182,212,0.6)';
    });
    link.addEventListener('mouseleave', () => {
      link.style.textShadow = '';
    });
  });
}

// ── Section background color shift on scroll ─────────────────────
function initSectionGlow() {
  const sections = document.querySelectorAll('.section[data-glow]');

  const observer = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const color  = entry.target.dataset.glow;
        const body   = document.body;
        body.style.setProperty('--active-glow', color);
      }
    });
  }, { threshold: 0.3 });

  sections.forEach(s => observer.observe(s));
}

// ── Particle click burst ──────────────────────────────────────────
function initClickBurst() {
  document.addEventListener('click', e => {
    const burst = document.createElement('div');
    burst.style.cssText = `
      position: fixed;
      left: ${e.clientX}px;
      top: ${e.clientY}px;
      width: 6px; height: 6px;
      background: rgba(6,182,212,0.8);
      border-radius: 50%;
      pointer-events: none;
      z-index: 9997;
      transform: translate(-50%, -50%);
      animation: burst-out 0.6s ease-out forwards;
    `;
    document.body.appendChild(burst);
    setTimeout(() => burst.remove(), 600);
  });

  // Inject burst keyframe if not present
  if (!document.getElementById('burst-style')) {
    const style = document.createElement('style');
    style.id = 'burst-style';
    style.textContent = `
      @keyframes burst-out {
        0%   { transform: translate(-50%,-50%) scale(1); opacity: 1; }
        100% { transform: translate(-50%,-50%) scale(8); opacity: 0; }
      }
    `;
    document.head.appendChild(style);
  }
}

// ── Active link on scroll ─────────────────────────────────────────
function initActiveLinks() {
  const sections = document.querySelectorAll('section[id]');
  const navLinks = document.querySelectorAll('.nav-link[href^="#"]');

  const observer = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        navLinks.forEach(link => {
          link.classList.toggle(
            'active',
            link.getAttribute('href') === '#' + entry.target.id
          );
        });
      }
    });
  }, { threshold: 0.4 });

  sections.forEach(s => observer.observe(s));
}

// ── Initialize all ────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  initReveal();
  initCounters();
  initNav();
  initMarquee();
  initImageParallaxScroll();
  initTypewriter();
  initNavGlow();
  initSectionGlow();
  initClickBurst();
  initActiveLinks();

  // Log for devs
  console.log('%c🛰️ GeoTrace', 'color:#06b6d4;font-size:20px;font-weight:bold;');
  console.log('%cEdit js/config.js to connect Firebase & admin panel', 'color:#7c3aed;font-size:13px;');
});
