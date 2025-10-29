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
      new THREE.Vector2(0.3, -1.0),
      new THREE.Vector2(-1.0, -0.3),
      new THREE.Vector2(0.7, 1.0),
      new THREE.Vector2(-0.2, 0.9)
    ],
    // Base amplitudes per wave (scaled by gradient below)
    amps: [0.008, 0.04, 0.055, 0.03, 0.02, 0.015],
    // Wavelength per wave (bigger = wider/smoother)
    lens: [6.8, 2.3, 3.0, 4.5, 7.0, 9.0],
    // Speed per wave (visual speed)
    speeds: [0.90, 0.76, 0.64, 0.52, 0.44, 0.36],
    // Horizontal steepness (0..1). Lower = smoother crests
    steep: 0.0001,
    // Amplitude gradient bottom→top (multiplier)
    ampBottom: 0.5,
    ampTop: 3.0,
    // Layer visuals (no fog)
    layers: {
      clear: { opacity: 1.0, y: -0.82, gamma: 0.75, foam: 0.25, colorA: 0x9be9ff, colorB: 0x7c3aed },
      foggy: { opacity: 0.40, y: -0.86, gamma: 0.80, foam: 0.15, colorA: 0x67e8f9, colorB: 0x60a5fa }
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
      uDir4: { value: WATER_CONFIG.dirs[3].clone() },
      uDir5: { value: WATER_CONFIG.dirs[4].clone() },
      uDir6: { value: WATER_CONFIG.dirs[5].clone() },
      
      // wavelengths/amps tuned for multiple crests
      uAmp1: { value: WATER_CONFIG.amps[0] }, uLen1: { value: WATER_CONFIG.lens[0] }, uSpeed1: { value: WATER_CONFIG.speeds[0] },
      uAmp2: { value: WATER_CONFIG.amps[1] }, uLen2: { value: WATER_CONFIG.lens[1] }, uSpeed2: { value: WATER_CONFIG.speeds[1] },
      uAmp3: { value: WATER_CONFIG.amps[2] }, uLen3: { value: WATER_CONFIG.lens[2] }, uSpeed3: { value: WATER_CONFIG.speeds[2] },
      uAmp4: { value: WATER_CONFIG.amps[3] }, uLen4: { value: WATER_CONFIG.lens[3] }, uSpeed4: { value: WATER_CONFIG.speeds[3] },
      uAmp5: { value: WATER_CONFIG.amps[4] }, uLen5: { value: WATER_CONFIG.lens[4] }, uSpeed5: { value: WATER_CONFIG.speeds[4] },
      uAmp6: { value: WATER_CONFIG.amps[5] }, uLen6: { value: WATER_CONFIG.lens[5] }, uSpeed6: { value: WATER_CONFIG.speeds[5] },
      
      uSteep: { value: WATER_CONFIG.steep },
      // Amplitude gradient from bottom (uv.y=0.0) to top (uv.y=1.0)
      // Colors and tones (allow per-layer override)
      uColorA: { value: new THREE.Color(options.colorA ?? 0x6ee7ff) },
      uColorB: { value: new THREE.Color(options.colorB ?? 0xa78bfa) },
      uOpacity: { value: options.opacity },
      uAmpBottom: { value: WATER_CONFIG.ampBottom },
      uAmpTop: { value: WATER_CONFIG.ampTop },
      uGamma: { value: options.gamma ?? 1.0 },
      uFoamAmount: { value: options.foam ?? 0.0 }
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
      uniform vec2 uDir4; uniform float uAmp4; uniform float uLen4; uniform float uSpeed4;
      uniform vec2 uDir5; uniform float uAmp5; uniform float uLen5; uniform float uSpeed5;
      uniform vec2 uDir6; uniform float uAmp6; uniform float uLen6; uniform float uSpeed6;
      
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
        p = gerstner(uDir4, uAmp4, uLen4, uSpeed4, p, uTime);
        p = gerstner(uDir5, uAmp5, uLen5, uSpeed5, p, uTime);
        p = gerstner(uDir6, uAmp6, uLen6, uSpeed6, p, uTime);
        
        vHeight = p.z;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
      }
    `,
      fragmentShader: /* glsl */`
      varying vec2 vUv;
      varying float vHeight;
      uniform vec3 uColorA;
      uniform vec3 uColorB;
      uniform float uOpacity;
      uniform float uGamma;
      uniform float uFoamAmount;

      void main(){
        float h = clamp(vHeight * 0.8 + 0.5, 0.0, 1.0);
        h = pow(h, uGamma);
        vec3 col = mix(uColorB, uColorA, h);
        // very light vignette to keep edges crisp
        float vignette = smoothstep(1.10, 0.35, distance(vUv, vec2(0.5)));
        col *= mix(0.95, 1.0, vignette);
        float foam = smoothstep(0.15, 0.35, abs(dFdx(vHeight)) + abs(dFdy(vHeight)));
        col = mix(col, vec3(1.0), foam * uFoamAmount);
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


