/* ================================================================
   GEOTRACE — earth3d.js
   3D rotating Earth using Three.js
   Scroll-driven tilt + parallax. Injected into landing page hero.
   ================================================================ */

(function () {
  'use strict';

  // Only run on landing page
  if (!document.querySelector('.hero-visual')) return;

  /* ── Create canvas container ── */
  const wrap = document.createElement('div');
  wrap.id = 'earth-wrap';
  wrap.setAttribute('aria-hidden', 'true');
  wrap.style.cssText = `
    position: absolute;
    top: 50%; right: -60px;
    transform: translateY(-50%);
    width: 520px; height: 520px;
    pointer-events: none;
    z-index: 0;
    opacity: 0;
    transition: opacity 1.2s ease;
  `;

  const heroVisual = document.querySelector('.hero-visual');
  heroVisual.style.position = 'relative';
  heroVisual.appendChild(wrap);

  /* ── Load Three.js dynamically ── */
  const script = document.createElement('script');
  script.src = 'https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js';
  script.onload = initEarth;
  document.head.appendChild(script);

  function initEarth() {
    const W = 520, H = 520;

    /* ── Scene ── */
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(W, H);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setClearColor(0x000000, 0);
    wrap.appendChild(renderer.domElement);

    const scene  = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(45, W / H, 0.1, 1000);
    camera.position.z = 2.8;

    /* ── Earth sphere ── */
    const geo  = new THREE.SphereGeometry(1, 64, 64);

    // Procedural earth shader (no texture needed)
    const mat = new THREE.ShaderMaterial({
      uniforms: {
        uTime:      { value: 0 },
        uGlowColor: { value: new THREE.Color(0x06b6d4) },
        uLandColor: { value: new THREE.Color(0x0d2a4a) },
        uSeaColor:  { value: new THREE.Color(0x020c1a) },
      },
      vertexShader: `
        varying vec2 vUv;
        varying vec3 vNormal;
        varying vec3 vPosition;
        void main() {
          vUv = uv;
          vNormal = normalize(normalMatrix * normal);
          vPosition = position;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform float uTime;
        uniform vec3 uGlowColor;
        uniform vec3 uLandColor;
        uniform vec3 uSeaColor;
        varying vec2 vUv;
        varying vec3 vNormal;
        varying vec3 vPosition;

        // Simple noise for continent shapes
        float hash(vec2 p) {
          return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
        }
        float noise(vec2 p) {
          vec2 i = floor(p);
          vec2 f = fract(p);
          f = f * f * (3.0 - 2.0 * f);
          return mix(
            mix(hash(i), hash(i + vec2(1,0)), f.x),
            mix(hash(i + vec2(0,1)), hash(i + vec2(1,1)), f.x),
            f.y
          );
        }
        float fbm(vec2 p) {
          float v = 0.0; float a = 0.5;
          for (int i = 0; i < 5; i++) {
            v += a * noise(p);
            p *= 2.1; a *= 0.5;
          }
          return v;
        }

        void main() {
          // Continent mask
          float n = fbm(vUv * 4.0 + vec2(uTime * 0.005, 0.0));
          float land = smoothstep(0.44, 0.56, n);

          // Base color
          vec3 col = mix(uSeaColor, uLandColor, land);

          // City light dots on dark side
          float cityNoise = fbm(vUv * 20.0);
          float cities = smoothstep(0.62, 0.68, cityNoise) * land;
          col += cities * vec3(0.8, 0.9, 1.0) * 0.4;

          // Atmosphere glow on edge
          float edge = 1.0 - abs(dot(vNormal, vec3(0.0, 0.0, 1.0)));
          edge = pow(edge, 2.5);
          col = mix(col, uGlowColor, edge * 0.55);

          // Grid lines (lat/lon)
          float lat = abs(sin(vUv.y * 3.14159 * 12.0));
          float lon = abs(sin(vUv.x * 3.14159 * 24.0));
          float grid = max(
            smoothstep(0.97, 1.0, lat),
            smoothstep(0.97, 1.0, lon)
          );
          col = mix(col, vec3(0.1, 0.6, 0.8), grid * 0.12);

          // Light from top-right
          vec3 lightDir = normalize(vec3(0.6, 0.4, 0.8));
          float diffuse = max(dot(vNormal, lightDir), 0.0);
          col *= 0.4 + diffuse * 0.7;

          gl_FragColor = vec4(col, 0.92);
        }
      `,
      transparent: true,
    });

    const earth = new THREE.Mesh(geo, mat);
    scene.add(earth);

    /* ── Atmosphere halo ── */
    const atmGeo = new THREE.SphereGeometry(1.06, 64, 64);
    const atmMat = new THREE.ShaderMaterial({
      uniforms: { uColor: { value: new THREE.Color(0x06b6d4) } },
      vertexShader: `
        varying vec3 vNormal;
        void main() {
          vNormal = normalize(normalMatrix * normal);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform vec3 uColor;
        varying vec3 vNormal;
        void main() {
          float edge = 1.0 - abs(dot(vNormal, vec3(0,0,1)));
          float alpha = pow(edge, 3.0) * 0.6;
          gl_FragColor = vec4(uColor, alpha);
        }
      `,
      transparent: true,
      side: THREE.FrontSide,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    scene.add(new THREE.Mesh(atmGeo, atmMat));

    /* ── Starfield around earth ── */
    const starGeo = new THREE.BufferGeometry();
    const starPos = new Float32Array(600 * 3);
    for (let i = 0; i < 600; i++) {
      const r = 2.5 + Math.random() * 3;
      const theta = Math.random() * Math.PI * 2;
      const phi   = Math.acos(2 * Math.random() - 1);
      starPos[i*3]   = r * Math.sin(phi) * Math.cos(theta);
      starPos[i*3+1] = r * Math.sin(phi) * Math.sin(theta);
      starPos[i*3+2] = r * Math.cos(phi);
    }
    starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3));
    const starMat = new THREE.PointsMaterial({ color: 0xaaccff, size: 0.012, transparent: true, opacity: 0.7 });
    scene.add(new THREE.Points(starGeo, starMat));

    /* ── Connection points (glowing dots on surface) ── */
    const dotPositions = [
      { lat:  40.7, lon: -74.0  }, // New York
      { lat:  51.5, lon:  -0.12 }, // London
      { lat:  35.7, lon: 139.7  }, // Tokyo
      { lat:  28.6, lon:  77.2  }, // Delhi
      { lat: -33.9, lon:  18.4  }, // Cape Town
      { lat:  48.8, lon:   2.35 }, // Paris
      { lat: -23.5, lon: -46.6  }, // São Paulo
    ];

    const dotGroup = new THREE.Group();
    scene.add(dotGroup);

    dotPositions.forEach((pos) => {
      const phi   = (90 - pos.lat) * (Math.PI / 180);
      const theta = (pos.lon + 180) * (Math.PI / 180);
      const r = 1.02;
      const x = r * Math.sin(phi) * Math.cos(theta);
      const y = r * Math.cos(phi);
      const z = r * Math.sin(phi) * Math.sin(theta);

      // Dot
      const dg = new THREE.SphereGeometry(0.018, 8, 8);
      const dm = new THREE.MeshBasicMaterial({ color: 0x06b6d4 });
      const dot = new THREE.Mesh(dg, dm);
      dot.position.set(x, y, z);
      dotGroup.add(dot);

      // Pulse ring
      const pg = new THREE.RingGeometry(0.025, 0.038, 16);
      const pm = new THREE.MeshBasicMaterial({ color: 0x06b6d4, transparent: true, opacity: 0.5, side: THREE.DoubleSide });
      const ring = new THREE.Mesh(pg, pm);
      ring.position.set(x, y, z);
      ring.lookAt(new THREE.Vector3(x*2, y*2, z*2));
      ring.userData.baseOpacity = 0.5;
      ring.userData.phase = Math.random() * Math.PI * 2;
      dotGroup.add(ring);
    });

    /* ── Draw connection lines ── */
    const lineMat = new THREE.LineBasicMaterial({
      color: 0x7c3aed, transparent: true, opacity: 0.25,
      blending: THREE.AdditiveBlending,
    });
    const connections = [[0,1],[1,2],[2,3],[3,4],[0,5],[5,1],[6,5]];
    connections.forEach(([a, b]) => {
      const pA = new THREE.Vector3(), pB = new THREE.Vector3();

      const toVec = (pos) => {
        const phi   = (90 - pos.lat) * (Math.PI / 180);
        const theta = (pos.lon + 180) * (Math.PI / 180);
        const r = 1.02;
        return new THREE.Vector3(
          r * Math.sin(phi) * Math.cos(theta),
          r * Math.cos(phi),
          r * Math.sin(phi) * Math.sin(theta)
        );
      };

      // Great-circle arc
      const vA = toVec(dotPositions[a]);
      const vB = toVec(dotPositions[b]);
      const points = [];
      for (let i = 0; i <= 24; i++) {
        const t = i / 24;
        const v = new THREE.Vector3().lerpVectors(vA, vB, t).normalize().multiplyScalar(1.06);
        points.push(v);
      }
      const lineGeo = new THREE.BufferGeometry().setFromPoints(points);
      scene.add(new THREE.Line(lineGeo, lineMat));
    });

    /* ── Scroll-driven tilt ── */
    let scrollY = 0;
    let targetRotX = 0, targetRotY = 0;
    let currentRotX = 0, currentRotY = 0;

    window.addEventListener('scroll', () => {
      scrollY = window.scrollY;
      targetRotX = scrollY * 0.0004;
    }, { passive: true });

    document.addEventListener('mousemove', (e) => {
      const cx = window.innerWidth / 2;
      const cy = window.innerHeight / 2;
      targetRotY = (e.clientX - cx) / cx * 0.15;
    });

    /* ── Animate ── */
    let t = 0;
    let animId;

    function animate() {
      animId = requestAnimationFrame(animate);
      t += 0.005;

      mat.uniforms.uTime.value = t;

      // Auto-rotate
      earth.rotation.y += 0.0015;
      dotGroup.rotation.y += 0.0015;

      // Smooth scroll tilt
      currentRotX += (targetRotX - currentRotX) * 0.05;
      currentRotY += (targetRotY - currentRotY) * 0.05;
      earth.rotation.x = currentRotX;
      earth.rotation.z = currentRotY * 0.3;
      dotGroup.rotation.x = currentRotX;

      // Pulse rings
      dotGroup.children.forEach((child) => {
        if (child.userData.baseOpacity !== undefined) {
          const pulse = 0.5 + 0.5 * Math.sin(t * 2.5 + child.userData.phase);
          child.material.opacity = child.userData.baseOpacity * pulse;
          const s = 1 + pulse * 0.4;
          child.scale.set(s, s, s);
        }
      });

      renderer.render(scene, camera);
    }

    animate();
    setTimeout(() => { wrap.style.opacity = '1'; }, 500);

    // Pause when tab hidden
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) cancelAnimationFrame(animId);
      else animate();
    });
  }
})();
