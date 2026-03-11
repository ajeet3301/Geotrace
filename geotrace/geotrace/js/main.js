// main.js — Scroll Reveal, Counters, Nav, Typewriter, etc.

// ── Scroll Reveal ──────────────────────────────────────
function initReveal() {
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('revealed');
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.12 });

  document.querySelectorAll('.reveal').forEach(el => observer.observe(el));
}

// ── Animated Counters ──────────────────────────────────
function easeOutExpo(t) {
  return t === 1 ? 1 : 1 - Math.pow(2, -10 * t);
}

function animateCounter(el, target, duration = 1800) {
  const isFloat   = String(target).includes('.');
  const isPercent = el.dataset.suffix === '%';
  const suffix    = el.dataset.suffix || '';
  const start     = performance.now();

  function tick(now) {
    const elapsed = now - start;
    const progress = Math.min(elapsed / duration, 1);
    const eased = easeOutExpo(progress);
    const current = isFloat
      ? (eased * parseFloat(target)).toFixed(1)
      : Math.round(eased * parseInt(target));

    el.textContent = current + suffix;

    if (progress < 1) requestAnimationFrame(tick);
  }

  requestAnimationFrame(tick);
}

function initCounters() {
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const target  = entry.target.dataset.count;
        animateCounter(entry.target, target);
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.5 });

  document.querySelectorAll('[data-count]').forEach(el => observer.observe(el));
}

// ── Navigation ─────────────────────────────────────────
function initNav() {
  const nav    = document.querySelector('.nav');
  const toggle = document.querySelector('.nav-toggle');
  const links  = document.querySelector('.nav-links');

  // Scroll class
  window.addEventListener('scroll', () => {
    if (window.scrollY > 60) nav.classList.add('scrolled');
    else                      nav.classList.remove('scrolled');
  });

  // Mobile toggle
  if (toggle && links) {
    toggle.addEventListener('click', () => {
      const isOpen = links.style.display === 'flex';
      links.style.display = isOpen ? 'none' : 'flex';
      links.style.flexDirection = 'column';
      links.style.position = 'absolute';
      links.style.top = '100%';
      links.style.left = '0';
      links.style.right = '0';
      links.style.background = 'rgba(2,4,8,0.95)';
      links.style.backdropFilter = 'blur(20px)';
      links.style.padding = '16px 24px';
      links.style.borderBottom = '1px solid rgba(255,255,255,0.08)';

      // Animate toggle icon
      const spans = toggle.querySelectorAll('span');
      if (!isOpen) {
        spans[0].style.transform = 'translateY(7px) rotate(45deg)';
        spans[1].style.opacity = '0';
        spans[2].style.transform = 'translateY(-7px) rotate(-45deg)';
      } else {
        spans[0].style.transform = '';
        spans[1].style.opacity = '1';
        spans[2].style.transform = '';
      }
    });
  }

  // Smooth scroll for anchor links
  document.querySelectorAll('a[href^="#"]').forEach(a => {
    a.addEventListener('click', e => {
      e.preventDefault();
      const target = document.querySelector(a.getAttribute('href'));
      if (target) target.scrollIntoView({ behavior: 'smooth' });
      if (links) links.style.display = '';
    });
  });
}

// ── Active Nav Links ────────────────────────────────────
function initActiveLinks() {
  const sections = document.querySelectorAll('section[id]');
  const navLinks = document.querySelectorAll('.nav-links a[href^="#"]');

  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        navLinks.forEach(link => {
          link.classList.toggle('active', link.getAttribute('href') === `#${entry.target.id}`);
        });
      }
    });
  }, { threshold: 0.5 });

  sections.forEach(s => observer.observe(s));
}

// ── Marquee ────────────────────────────────────────────
function initMarquee() {
  const track = document.querySelector('.marquee-track');
  if (!track) return;

  // Duplicate items for seamless loop
  const items = track.innerHTML;
  track.innerHTML = items + items;
}

// ── Typewriter Effect ──────────────────────────────────
function initTypewriter() {
  const el = document.querySelector('.typewriter-text');
  if (!el) return;

  const words = ['PHOTO', 'IMAGE', 'MEMORY', 'MOMENT'];
  let wIdx    = 0;
  let cIdx    = 0;
  let deleting = false;
  const PAUSE = 1800;
  const TYPE_SPEED = 90;
  const DEL_SPEED  = 50;

  function tick() {
    const word = words[wIdx];

    if (!deleting) {
      cIdx++;
      el.textContent = word.slice(0, cIdx);

      if (cIdx === word.length) {
        deleting = true;
        setTimeout(tick, PAUSE);
        return;
      }
    } else {
      cIdx--;
      el.textContent = word.slice(0, cIdx);

      if (cIdx === 0) {
        deleting = false;
        wIdx = (wIdx + 1) % words.length;
      }
    }

    setTimeout(tick, deleting ? DEL_SPEED : TYPE_SPEED);
  }

  tick();
}

// ── Click Burst Effect ─────────────────────────────────
function initClickBurst() {
  document.addEventListener('click', e => {
    const burst = document.createElement('div');
    burst.style.cssText = `
      position: fixed;
      left: ${e.clientX}px;
      top: ${e.clientY}px;
      width: 20px;
      height: 20px;
      border: 2px solid rgba(124,58,237,0.6);
      border-radius: 50%;
      pointer-events: none;
      z-index: 9998;
      animation: click-burst 0.5s var(--ease-expo) forwards;
    `;
    document.body.appendChild(burst);
    setTimeout(() => burst.remove(), 500);
  });
}

// ── Neon Image Hover ───────────────────────────────────
function initNeonImages() {
  document.querySelectorAll('.neon-img').forEach(img => {
    const colors = ['#7c3aed', '#06b6d4', '#e879f9'];
    let colorIdx = 0;

    img.addEventListener('mouseenter', () => {
      img.style.borderColor = colors[colorIdx];
      img.style.boxShadow   = `0 0 30px ${colors[colorIdx]}60, 0 0 60px ${colors[colorIdx]}30`;
      colorIdx = (colorIdx + 1) % colors.length;
    });

    img.addEventListener('mouseleave', () => {
      img.style.borderColor = '';
      img.style.boxShadow   = '';
    });
  });
}

// ── Init all ───────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  initReveal();
  initCounters();
  initNav();
  initActiveLinks();
  initMarquee();
  initTypewriter();
  initClickBurst();
  initNeonImages();
});

window.main = {
  initReveal,
  initCounters,
  initNav,
  initMarquee,
  initTypewriter,
  initClickBurst
};
