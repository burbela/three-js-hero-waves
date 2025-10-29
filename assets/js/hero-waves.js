(function () {
  // TUNING GUIDE (edit values below to shape the water):
  // - uAmpBottom / uAmpTop: amplitude gradient from bottom (small) to top (large).
  //   Increase uAmpTop for stronger waves near the top; decrease uAmpBottom to calm the bottom.
  // - uSteep: 0..1. Lower = smoother/rounder crests; Higher = sharper ridges.
  // - uLen1..uLen3: wavelength per wave. Larger = wider, smoother waves; Smaller = more ripples.
  // - uAmp1..uAmp3: base amplitude per wave (before gradient). Lower = subtler waves.
  // - uSpeed1..uSpeed3: motion speed per wave. Lower = slower; Higher = faster.
  // - uDir1..uDir3: 2D wave directions. Rotating these changes interference patterns.
  // Tip: For smoother look: decrease uSteep and/or increase uLen*. For more dynamic: raise uSpeed* slightly.

  // WATER CONFIG (edit these values)
  const WATER_CONFIG = {
    // Wave directions (x, y)
    dirs: [
      new THREE.Vector2(1.0, 0.2),
      new THREE.Vector2(0.6, 1.0),
      new THREE.Vector2(0.3, -1.0)
    ],
    // Base amplitudes per wave (scaled by gradient below)
    amps: [0.008, 0.04, 0.055],
    // Wavelength per wave (bigger = wider/smoother)
    lens: [6.8, 2.3, 3.0],
    // Speed per wave (visual speed)
    speeds: [0.90, 0.76, 0.64],
    // Horizontal steepness (0..1). Lower = smoother crests
    steep: 0.0001,
    // Amplitude gradient bottom→top (multiplier)
    ampBottom: 0.5,
    ampTop: 3.0,
    // Layer visuals
    layers: {
      clear: { opacity: 0.95, fogMix: 0.85, y: -0.82 },
      foggy: { opacity: 0.35, fogMix: 0.65, y: -0.86 }
    }
  };
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

  // Gerstner water shader factory (allows different opacities/tints per layer)
  function createWaterMaterial(options) {
    const uniforms = {
      uTime: { value: 0 },
      // Gerstner wave params
      uDir1: { value: WATER_CONFIG.dirs[0].clone() },
      uDir2: { value: WATER_CONFIG.dirs[1].clone() },
      uDir3: { value: WATER_CONFIG.dirs[2].clone() },
      
      // wavelengths/amps tuned for multiple crests
      uAmp1: { value: WATER_CONFIG.amps[0] }, uLen1: { value: WATER_CONFIG.lens[0] }, uSpeed1: { value: WATER_CONFIG.speeds[0] },
      uAmp2: { value: WATER_CONFIG.amps[1] }, uLen2: { value: WATER_CONFIG.lens[1] }, uSpeed2: { value: WATER_CONFIG.speeds[1] },
      uAmp3: { value: WATER_CONFIG.amps[2] }, uLen3: { value: WATER_CONFIG.lens[2] }, uSpeed3: { value: WATER_CONFIG.speeds[2] },
      
      uSteep: { value: WATER_CONFIG.steep },
      // Amplitude gradient from bottom (uv.y=0.0) to top (uv.y=1.0)
      uAmpBottom: { value: 0.5 },
      uAmpTop: { value: 3.0 },
      // Colors and tones
      uColorA: { value: new THREE.Color(0x6ee7ff) },
      uColorB: { value: new THREE.Color(0xa78bfa) },
      uFog: { value: new THREE.Color(0x0a0c10) },
      uOpacity: { value: options.opacity },
      uFogMix: { value: options.fogMix },
      uAmpBottom: { value: WATER_CONFIG.ampBottom },
      uAmpTop: { value: WATER_CONFIG.ampTop }
    };
    return new THREE.ShaderMaterial({
      uniforms,
      vertexShader: /* glsl */`
      varying vec2 vUv;
      varying float vHeight;
      uniform float uTime;
      uniform vec2 uDir1; uniform float uAmp1; uniform float uLen1; uniform float uSpeed1;
      uniform vec2 uDir2; uniform float uAmp2; uniform float uLen2; uniform float uSpeed2;
      uniform vec2 uDir3; uniform float uAmp3; uniform float uLen3; uniform float uSpeed3;
      
      uniform float uSteep;
      uniform float uAmpBottom;
      uniform float uAmpTop;

      const float PI = 3.14159265359;

      vec3 gerstner(vec2 dir, float amp, float lambda, float speed, vec3 pos, float t){
        vec2 d = normalize(dir);
        float k = 2.0 * PI / lambda;
        float f = k * (d.x * pos.x + d.y * pos.y) - speed * t;
        float ampScale = mix(uAmpBottom, uAmpTop, uv.y);
        float a = amp * ampScale;
        vec3 disp;
        // reduce horizontal displacement via steepness factor so multiple crests are visible
        disp.x = d.x * (a * uSteep) * cos(f);
        disp.y = d.y * (a * uSteep) * cos(f);
        disp.z = a * sin(f);
        return pos + disp;
      }

      void main(){
        vUv = uv;
        vec3 p = position;
        p = gerstner(uDir1, uAmp1, uLen1, uSpeed1, p, uTime);
        p = gerstner(uDir2, uAmp2, uLen2, uSpeed2, p, uTime);
        p = gerstner(uDir3, uAmp3, uLen3, uSpeed3, p, uTime);
        
        vHeight = p.z;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
      }
    `,
      fragmentShader: /* glsl */`
      varying vec2 vUv;
      varying float vHeight;
      uniform vec3 uColorA;
      uniform vec3 uColorB;
      uniform vec3 uFog;
      uniform float uOpacity;
      uniform float uFogMix;

      void main(){
        float h = clamp(vHeight * 0.8 + 0.5, 0.0, 1.0);
        vec3 col = mix(uColorB, uColorA, h);
        float vignette = smoothstep(1.15, 0.25, distance(vUv, vec2(0.5)));
        col *= mix(0.85, 1.0, vignette);
        col = mix(uFog, col, uFogMix);
        gl_FragColor = vec4(col, uOpacity);
      }
    `,
      transparent: true,
      depthWrite: false,
      depthTest: true,
      blending: THREE.NormalBlending
    });
  }

  // Two layers: clear (opaque) and foggy (translucent)
  const materialClear = createWaterMaterial(WATER_CONFIG.layers.clear);
  const materialFoggy = createWaterMaterial(WATER_CONFIG.layers.foggy);
  let meshClear = null;
  let meshFoggy = null;

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
    geometry = new THREE.PlaneGeometry(20, 12, segX, segY);

    if (!meshClear) {
      meshClear = new THREE.Mesh(geometry, materialClear);
      meshClear.rotation.x = -0.9;
      meshClear.position.y = WATER_CONFIG.layers.clear.y;
      meshClear.renderOrder = 1;
      scene.add(meshClear);
    } else {
      meshClear.geometry = geometry;
    }

    if (!meshFoggy) {
      meshFoggy = new THREE.Mesh(geometry, materialFoggy);
      meshFoggy.rotation.x = -0.9;
      meshFoggy.position.y = WATER_CONFIG.layers.foggy.y; // slightly lower to separate layers visually
      meshFoggy.renderOrder = 0;
      scene.add(meshFoggy);
    } else {
      meshFoggy.geometry = geometry;
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
    // No per-layer uniforms to update
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
    const t = (now - start) / 1000;
    materialClear.uniforms.uTime.value = t;
    materialFoggy.uniforms.uTime.value = t;
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


