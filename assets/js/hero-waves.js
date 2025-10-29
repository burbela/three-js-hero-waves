(function () {
  const canvas = document.getElementById('hero-canvas');
  if (!canvas) return;

  const DPR = Math.min(window.devicePixelRatio || 1, 2);

  /**
   * Scene setup
   */
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(55, 1, 0.1, 100);
  camera.position.set(0, 1.2, 2.2);

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(DPR);
  renderer.setClearColor(0x000000, 0.0);

  /**
   * Plane geometry with custom shader for sine waves
   * Use adaptive subdivisions to ensure a smooth surface with no visible angles
   */
  let geometry = null;

  const uniforms = {
    uTime: { value: 0 },
    uAmp: { value: 0.22 },
    uFreq: { value: 1.6 },
    uSpeed: { value: 0.7 },
    uColorA: { value: new THREE.Color(0x6ee7ff) },
    uColorB: { value: new THREE.Color(0xa78bfa) },
    uFog: { value: new THREE.Color(0x0a0c10) }
  };

  function createMaterial(layerUniforms) {
    const u = Object.assign({}, uniforms, layerUniforms);
    return new THREE.ShaderMaterial({
      uniforms: u,
      vertexShader: /* glsl */`
      varying vec2 vUv;
      uniform float uTime;
      uniform float uAmp;
      uniform float uFreq;
      uniform float uSpeed;

      // 2D rotation helper for subtle swirl
      mat2 rot(float a){ float s=sin(a), c=cos(a); return mat2(c,-s,s,c); }

      void main() {
        vUv = uv;
        vec3 pos = position;

        // Centered coordinates for nicer symmetry
        vec2 c = (uv - 0.5) * rot(0.35);

        float t = uTime * uSpeed;
        float wave1 = sin((c.x * 6.2831 * uFreq) + t * 1.35);
        float wave2 = cos((c.y * 6.2831 * (uFreq * 0.6)) - t * 1.1);
        float wave3 = sin((c.x + c.y) * 6.2831 * (uFreq * 0.35) + t * 0.7);

        float displacement = (wave1 * 0.55 + wave2 * 0.35 + wave3 * 0.25) * uAmp;
        pos.z += displacement;        // depth ripple
        pos.y += displacement * 0.55; // vertical sway

        gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
      }
    `,
      fragmentShader: /* glsl */`
      varying vec2 vUv;
      uniform vec3 uColorA;
      uniform vec3 uColorB;
      uniform vec3 uFog;
      uniform float uOpacity;

      void main() {
        // Soft gradient blend with slight vignette
        float g = smoothstep(0.0, 1.0, vUv.y);
        vec3 col = mix(uColorB, uColorA, g);

        float vignette = smoothstep(1.2, 0.2, distance(vUv, vec2(0.5)));
        col *= mix(0.85, 1.0, vignette);

        float alpha = uOpacity;

        // Gentle fog to blend with background
        col = mix(uFog, col, 0.80);
        gl_FragColor = vec4(col, alpha);
      }
    `,
      wireframe: false,
      transparent: true,
      depthWrite: false,
      depthTest: true,
      blending: THREE.NormalBlending
    });
  }

  const layers = [];
  const wavesGroup = new THREE.Group();
  scene.add(wavesGroup);

  function computeSegments() {
    // Base segment density relative to viewport, clamped for performance
    const w = canvas.clientWidth || window.innerWidth;
    const h = canvas.clientHeight || window.innerHeight;
    const density = 0.08; // segments per pixel (lower is fewer segments)
    const segX = Math.max(180, Math.min(420, Math.round(w * density)));
    const segY = Math.max(120, Math.min(300, Math.round(h * density)));
    return { segX, segY };
  }

  function buildMesh() {
    const { segX, segY } = computeSegments();
    if (geometry) geometry.dispose();
    geometry = new THREE.PlaneGeometry(16, 10, segX, segY);

    if (layers.length === 0) {
      // Create multiple wave layers with different speeds/colors
      const palette = [
        { a: 0x6ee7ff, b: 0xa78bfa, opacity: 0.65, amp: 0.20, freq: 1.5, speed: 0.65, y: -0.60, tilt: -0.88, z: 0.0 },
        { a: 0x99f6e4, b: 0x93c5fd, opacity: 0.50, amp: 0.16, freq: 1.1, speed: 0.52, y: -0.70, tilt: -0.92, z: -0.15 },
        { a: 0xf5d0fe, b: 0xbae6fd, opacity: 0.42, amp: 0.12, freq: 0.9, speed: 0.40, y: -0.80, tilt: -0.96, z: -0.30 }
      ];

      palette.forEach((cfg) => {
        const mat = createMaterial({
          uAmp: { value: cfg.amp },
          uFreq: { value: cfg.freq },
          uSpeed: { value: cfg.speed },
          uColorA: { value: new THREE.Color(cfg.a) },
          uColorB: { value: new THREE.Color(cfg.b) },
          uOpacity: { value: cfg.opacity }
        });
        const m = new THREE.Mesh(geometry, mat);
        m.rotation.x = cfg.tilt;
        m.position.y = cfg.y;
        m.position.z = cfg.z;
        wavesGroup.add(m);
        layers.push(m);
      });
    } else {
      // Reassign updated geometry to all layers
      layers.forEach((m) => { m.geometry = geometry; });
    }
  }

  buildMesh();

  /**
   * Resize handling
   */
  function resize() {
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    if (w === 0 || h === 0) return;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    // Rebuild geometry if segment targets changed significantly
    buildMesh();
    // Update aspect uniform on all layers for mask correctness
    const aspect = w / h;
    layers.forEach((m) => {
      if (m.material && m.material.uniforms && m.material.uniforms.uAspect) {
        m.material.uniforms.uAspect.value = aspect;
      }
    });
  }

  const ro = new ResizeObserver(resize);
  ro.observe(canvas);

  // Initial size (in case observer fires late)
  resize();

  /**
   * Animation loop
   */
  let start = performance.now();
  let rafId = 0;

  function animate() {
    const now = performance.now();
    uniforms.uTime.value = (now - start) / 1000;

    renderer.render(scene, camera);
    rafId = requestAnimationFrame(animate);
  }

  // Respect prefers-reduced-motion
  const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)');
  function updateMotionPreference() {
    if (prefersReduced.matches) {
      if (rafId) cancelAnimationFrame(rafId);
      renderer.setAnimationLoop(null);
      renderer.render(scene, camera);
    } else {
      if (!rafId) rafId = requestAnimationFrame(animate);
    }
  }
  prefersReduced.addEventListener?.('change', updateMotionPreference);
  updateMotionPreference();

  // Cleanup on page hide (helps on mobile)
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      if (rafId) cancelAnimationFrame(rafId);
      rafId = 0;
    } else {
      if (!prefersReduced.matches && !rafId) rafId = requestAnimationFrame(animate);
    }
  });
})();


