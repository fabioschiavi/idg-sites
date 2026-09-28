import * as THREE from "three";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";

export function initPointCloud(canvas, { reducedMotion = false } = {}) {
  const POINT_COUNT = 84000;
  const TAU = Math.PI * 2;
  const clamp = (v, min = 0, max = 1) => Math.min(max, Math.max(min, v));
  const vec = (a) => new THREE.Vector3(...a);
  let disposed = false, active = false;
  let targetProgress = 0, progress = 0, appliedProgress = 0, lastTime = null;
  let width = 0, height = 0, pixelRatio = 0;
  const pointer = new THREE.Vector2();
  const geometries = new Set(), materials = new Set();

  const renderer = new THREE.WebGLRenderer({
    canvas, antialias: true, alpha: false, preserveDrawingBuffer: true
  });
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.NoToneMapping;
  renderer.setClearColor(0x070c1a, 1);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x070c1a);
  const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 200);
  const focus = new THREE.Vector3(0, 0.8, 0);
  const viewDirection = new THREE.Vector3(1, 0.85, 1.15).normalize();

  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  composer.addPass(new UnrealBloomPass(new THREE.Vector2(800, 600), 0.5, 0.4, 0.2));
  composer.addPass(new OutputPass());

  const uniforms = {
    uTime: { value: 0 },
    uProgress: { value: 0 },
    uMotion: { value: reducedMotion ? 0 : 1 },
    uPointer: { value: new THREE.Vector2() },
    uPixelRatio: { value: 1 },
    uPointScale: { value: 30 },
    uBlue: { value: new THREE.Color(0x3d7bff) },
    uHigh: { value: new THREE.Color(0xeaf3ff) },
    uOrange: { value: new THREE.Color(0xf59d00) }
  };

  // Amostragem determinística, somente nas superfícies.
  let seed = 0x91d6a537;
  function random() {
    seed ^= seed << 13; seed ^= seed >>> 17; seed ^= seed << 5;
    return (seed >>> 0) / 4294967296;
  }
  const gauss = () => (random() + random() + random() - 1.5) * 2;
  const patches = [], wire = [];
  const patch = (weight, sample) => patches.push({ weight, sample });
  const line = (a, b) => wire.push(...a, ...b);

  function frame(a, b) {
    const axis = vec(b).sub(vec(a)), length = axis.length();
    axis.divideScalar(length);
    const u = Math.abs(axis.y) > 0.99
      ? new THREE.Vector3(1, 0, 0)
      : new THREE.Vector3().crossVectors(new THREE.Vector3(0, 1, 0), axis).normalize();
    const v = new THREE.Vector3().crossVectors(axis, u).normalize();
    return {
      length,
      at: (t, x, z) => [
        a[0] + axis.x * t + u.x * x + v.x * z,
        a[1] + axis.y * t + u.y * x + v.y * z,
        a[2] + axis.z * t + u.z * x + v.z * z
      ]
    };
  }

  function prism(a, b, w, d, weight, outlined = true) {
    const { length: L, at } = frame(a, b);
    patch(weight, () => {
      let t = random() * L, x = (random() - 0.5) * w, z = (random() - 0.5) * d;
      const face = random() * (L * d + L * w + w * d);
      if (face < L * d) x = (random() < 0.5 ? -0.5 : 0.5) * w;
      else if (face < L * (d + w)) z = (random() < 0.5 ? -0.5 : 0.5) * d;
      else t = random() < 0.5 ? 0 : L;
      return at(t, x, z);
    });
    if (!outlined) return;
    // BIM: perfis finos viram eixo; lajes só o contorno superior.
    if (Math.max(w, d) < 0.3) return line(at(0, 0, 0), at(L, 0, 0));
    const corners = [[-w / 2, -d / 2], [w / 2, -d / 2], [w / 2, d / 2], [-w / 2, d / 2]];
    for (let i = 0; i < 4; i++) {
      const a0 = corners[i], b0 = corners[(i + 1) % 4];
      line(at(L, ...a0), at(L, ...b0));
      if (L < 0.3) continue;
      line(at(0, ...a0), at(0, ...b0));
      line(at(0, ...a0), at(L, ...a0));
    }
  }

  function tube(a, b, radius, weight, outlined = true, caps = true) {
    const { length: L, at } = frame(a, b);
    patch(weight, () => {
      let t = random() * L, r = radius;
      if (caps && random() > L / (L + radius)) {
        t = random() < 0.5 ? 0 : L;
        r *= Math.sqrt(random());
      }
      const angle = random() * TAU;
      return at(t, r * Math.cos(angle), r * Math.sin(angle));
    });
    if (!outlined) return;
    if (outlined === "axis") return line(at(0, 0, 0), at(L, 0, 0));
    for (const t of [0, L]) {
      for (let i = 0; i < 64; i++) {
        const a0 = i / 64 * TAU, a1 = (i + 1) / 64 * TAU;
        line(at(t, radius * Math.cos(a0), radius * Math.sin(a0)),
             at(t, radius * Math.cos(a1), radius * Math.sin(a1)));
      }
    }
    for (let i = 0; i < 4; i++) {
      const a0 = i * Math.PI / 2;
      line(at(0, radius * Math.cos(a0), radius * Math.sin(a0)),
           at(L, radius * Math.cos(a0), radius * Math.sin(a0)));
    }
  }

  function circle(x, y, z, r) {
    for (let i = 0; i < 64; i++) {
      const a = i / 64 * TAU, b = (i + 1) / 64 * TAU;
      line([x + r * Math.cos(a), y, z + r * Math.sin(a)],
           [x + r * Math.cos(b), y, z + r * Math.sin(b)]);
    }
  }

  function hoop(x, y, z, r, weight = 180) {
    patch(weight, () => {
      const a = random() * TAU, b = random() * TAU;
      const radius = r + 0.035 * Math.cos(b);
      return [x + radius * Math.cos(a), y + 0.035 * Math.sin(b), z + radius * Math.sin(a)];
    });
  }

  function dome(x, y, z, r, h) {
    patch(1300, () => {
      const c = random(), s = Math.sqrt(1 - c * c), a = random() * TAU;
      return [x + r * s * Math.cos(a), y + h * c, z + r * s * Math.sin(a)];
    });
    for (let k = 0; k < 4; k++) {
      const a = k * Math.PI / 2;
      const at = (t) => [x + r * Math.cos(t) * Math.cos(a),
        y + h * Math.sin(t), z + r * Math.cos(t) * Math.sin(a)];
      for (let j = 0; j < 16; j++) line(at(j * Math.PI / 32), at((j + 1) * Math.PI / 32));
    }
  }

  // Terreno e tanques.
  patch(16000, () => {
    // Bordas rarefeitas, como o limite real de um levantamento.
    let x = 0, z = 0;
    for (let k = 0; k < 8; k++) {
      x = (random() - 0.5) * 23; z = (random() - 0.5) * 14.4;
      const edge = Math.min(11.5 - Math.abs(x), 7.2 - Math.abs(z));
      if (random() < edge / 2.2) break;
    }
    return [x, -0.08 + 0.035 * Math.sin(x * 0.8) * Math.cos(z * 0.7), z];
  });
  for (const [x, z, r, h] of [[-7.5, -3.3, 1.95, 3.9], [-2.9, -3.3, 1.8, 3.2], [-7.2, 4.15, 1.5, 2.65]]) {
    prism([x, -0.04, z], [x, 0.12, z], r * 2.25, r * 2.25, 260, false);
    tube([x, 0.12, z], [x, h, z], r, 4800, true, false);
    dome(x, h, z, r, r * 0.3);
    hoop(x, 0.28, z, r); hoop(x, h - 0.07, z, r);
  }

  // Torre de processo e passarelas.
  tube([7, 0.1, 3.9], [7, 8.4, 3.9], 0.68, 3600);
  tube([7, 8.4, 3.9], [7, 10.5, 3.9], 0.34, 500);
  for (const y of [2.8, 5.5, 8]) {
    patch(320, () => {
      const a = random() * TAU, r = Math.sqrt(0.68 ** 2 + random() * (1.12 ** 2 - 0.68 ** 2));
      return [7 + r * Math.cos(a), y, 3.9 + r * Math.sin(a)];
    });
    circle(7, y, 3.9, 1.12);
    hoop(7, y + 0.55, 3.9, 1.12, 200);
    for (let i = 0; i < 4; i++) {
      const a = i * Math.PI / 2, x = 7 + 1.12 * Math.cos(a), z = 3.9 + 1.12 * Math.sin(a);
      prism([x, y, z], [x, y + 0.55, z], 0.04, 0.04, 35);
    }
  }

  // Pipe rack elevado com quatro linhas.
  for (const x of [-9, -6, -3, 0, 3, 6, 8.7]) {
    for (const z of [-0.4, 2.12]) prism([x, 0, z], [x, 3.6, z], 0.15, 0.15, 140);
    prism([x, 3.6, -0.5], [x, 3.6, 2.22], 0.18, 0.18, 140);
  }
  for (let i = 0; i < 4; i++) {
    tube([-9.2, 3.85, i * 0.57], [8.8, 3.85, i * 0.57], [0.11, 0.14, 0.09, 0.13][i], 2200, "axis");
  }

  // Galpão metálico aberto.
  prism([4.7, 0, -3.25], [4.7, 0.12, -3.25], 9.1, 5.2, 1100);
  for (const x of [0.5, 3.3, 6.1, 8.9]) {
    for (const z of [-5.6, -0.9]) {
      prism([x, 0.12, z], [x, 4.7, z], 0.18, 0.18, 230);
      prism([x, 4.7, z], [x, 5.4, -3.25], 0.12, 0.16, 160);
    }
    prism([x, 4.7, -5.6], [x, 4.7, -0.9], 0.13, 0.16, 150);
  }
  for (const z of [-5.6, -0.9]) {
    for (const y of [2.45, 4.7]) prism([0.5, y, z], [8.9, y, z], 0.13, 0.18, 350);
    prism([0.5, 0.2, z], [3.3, 4.7, z], 0.06, 0.06, 220);
    prism([6.1, 4.7, z], [8.9, 0.2, z], 0.06, 0.06, 220);
  }
  prism([0.5, 5.4, -3.25], [8.9, 5.4, -3.25], 0.12, 0.15, 300);

  // Correia transportadora inclinada, com treliças.
  const conveyor = (t, z = 0, y = 0) => [-3.8 + 10.6 * t, 0.65 + 5.85 * t + y, 5.15 - 1.25 * t + z];
  prism(conveyor(0), conveyor(1), 1.3, 0.12, 1500);
  prism(conveyor(0, 0, 1), conveyor(1, 0, 1), 1.42, 0.045, 800, false);
  for (const side of [-0.63, 0.63]) {
    for (const y of [0, 0.88]) prism(conveyor(0, side, y), conveyor(1, side, y), 0.075, 0.075, 450, y > 0);
    for (let i = 0; i <= 6; i++) {
      const t = i / 6;
      prism(conveyor(t, side), conveyor(t, side, 0.88), 0.055, 0.055, 45);
      if (i < 6) prism(conveyor(t, side), conveyor(t + 1 / 6, side, 0.88), 0.045, 0.045, 85);
    }
  }
  for (let i = 0; i <= 6; i++) prism(conveyor(i / 6, -0.67, 0.9), conveyor(i / 6, 0.67, 0.9), 0.06, 0.06, 65);
  for (const t of [0.15, 0.5, 0.82]) {
    for (const z of [-0.6, 0.6]) {
      const top = conveyor(t, z);
      prism([top[0], 0, top[2]], top, 0.13, 0.13, 95);
    }
  }

  const positions = new Float32Array(POINT_COUNT * 3);
  const offsets = new Float32Array(POINT_COUNT * 3);
  const seeds = new Float32Array(POINT_COUNT);
  const totalWeight = patches.reduce((sum, p) => sum + p.weight, 0);
  let written = 0, accumulated = 0;
  for (const p of patches) {
    accumulated += p.weight;
    const end = Math.round(accumulated / totalWeight * POINT_COUNT);
    for (; written < end; written++) {
      const point = p.sample(), j = written * 3;
      for (let axis = 0; axis < 3; axis++) positions[j + axis] = point[axis] + (random() - 0.5) * 0.035;
      // Nuvem solta inicial: distribuição quase gaussiana, bordas suaves.
      offsets[j] = gauss() * 3.5 - positions[j];
      offsets[j + 1] = 3 + gauss() * 1.7 - positions[j + 1];
      offsets[j + 2] = gauss() * 2.7 - positions[j + 2];
      seeds[written] = random();
    }
  }
  patches.length = 0;

  // Movimento compartilhado: equivale à órbita da câmera.
  const common = `
    uniform float uTime, uProgress, uMotion, uPixelRatio, uPointScale;
    uniform vec2 uPointer;
    uniform vec3 uBlue, uHigh, uOrange;
    float bim() { return smoothstep(0.7, 1.0, uProgress); }
    float scanOn() { return smoothstep(0.18, 0.3, uProgress) * (1.0 - smoothstep(0.62, 0.74, uProgress)); }
    float scanX() {
      float p = clamp(uProgress, 0.0, 1.0);
      float sweep = fract(uTime * 0.07);
      float tracked = smoothstep(0.27, 0.7, p);
      float motion = 0.28 * uMotion * (1.0 - smoothstep(0.6, 0.72, p));
      return mix(-12.0, 12.0, mix(tracked, sweep, motion));
    }
    vec3 pose(vec3 p) {
      float yaw = uMotion * ((smoothstep(0.3, 0.7, uProgress) - 0.5) * 0.610865
        + sin(uTime * 0.12) * 0.045 + uPointer.x * 0.069813);
      float pitch = uMotion * uPointer.y * 0.069813;
      vec3 q = p - vec3(0.0, 2.8, 0.0);
      q.xz = mat2(cos(yaw), -sin(yaw), sin(yaw), cos(yaw)) * q.xz;
      q.yz = mat2(cos(pitch), -sin(pitch), sin(pitch), cos(pitch)) * q.yz;
      return q + vec3(0.0, 2.8, 0.0);
    }
  `;
  function shader(vertex, fragment, extra = {}) {
    const material = new THREE.ShaderMaterial({
      uniforms, vertexShader: common + vertex, fragmentShader: common + fragment,
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, ...extra
    });
    materials.add(material);
    return material;
  }
  function add(geometry, material, Type = THREE.Mesh, order = 0) {
    geometries.add(geometry);
    const object = new Type(geometry, material);
    object.frustumCulled = false;
    object.renderOrder = order;
    scene.add(object);
    return object;
  }

  const cloudGeometry = new THREE.BufferGeometry()
    .setAttribute("position", new THREE.BufferAttribute(positions, 3))
    .setAttribute("aOffset", new THREE.BufferAttribute(offsets, 3))
    .setAttribute("aSeed", new THREE.BufferAttribute(seeds, 1));
  const cloud = add(cloudGeometry, shader(`
    attribute vec3 aOffset;
    attribute float aSeed;
    varying float vHeight, vDistance, vSeed;
    void main() {
      // A nuvem gira devagar e converge para a planta (assemble).
      float t0 = aSeed * 0.14;
      float loose = 1.0 - smoothstep(t0, t0 + 0.16, uProgress);
      vec3 c = position + aOffset - vec3(0.0, 3.0, 0.0);
      float spin = uTime * 0.1 * uMotion;
      c.xz = mat2(cos(spin), -sin(spin), sin(spin), cos(spin)) * c.xz;
      vec3 p = mix(position, c + vec3(0.0, 3.0, 0.0), loose);
      vHeight = position.y;
      vDistance = p.x - scanX();
      vSeed = aSeed;
      vec4 mv = modelViewMatrix * vec4(pose(p), 1.0);
      gl_Position = projectionMatrix * mv;
      gl_PointSize = clamp((1.5 + 1.3 * aSeed) * uPointScale / max(0.1, -mv.z),
        1.0, 6.0) * uPixelRatio;
    }
  `, `
    varying float vHeight, vDistance, vSeed;
    void main() {
      float r = length(gl_PointCoord - 0.5) * 2.0;
      if (r >= 1.0) discard;
      float soft = pow(1.0 - smoothstep(0.12, 1.0, r), 1.25);
      // Antes de montar a planta a nuvem é só um enxame azul, sem varredura.
      float scanning = smoothstep(0.18, 0.3, uProgress);
      float captured = (1.0 - smoothstep(-0.015, 0.015, vDistance)) * scanning;
      float band = (1.0 - smoothstep(0.055, 0.25, abs(vDistance))) * scanning;
      vec3 heightColor = mix(uBlue, uHigh, 0.85 * smoothstep(0.0, 10.5, vHeight));
      vec3 color = mix(uBlue * 0.65, heightColor * (0.7 + 0.35 * vSeed), captured);
      color = mix(color, uOrange * 1.6, band);
      float ghost = mix(0.24, 0.08, scanning);
      float alpha = mix(mix(ghost, 0.45, captured), 0.95, band);
      gl_FragColor = vec4(color, soft * alpha * (1.0 - 0.6 * bim()));
    }
  `), THREE.Points, 2);

  const orders = new Float32Array(wire.length / 3);
  for (let i = 0; i < orders.length; i++) orders[i] = (Math.floor(i / 2) + (i % 2)) / (orders.length / 2);
  add(new THREE.BufferGeometry()
    .setAttribute("position", new THREE.Float32BufferAttribute(wire, 3))
    .setAttribute("aOrder", new THREE.BufferAttribute(orders, 1)), shader(`
    attribute float aOrder;
    varying float vOrder;
    void main() {
      vOrder = aOrder;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(pose(position), 1.0);
    }
  `, `
    varying float vOrder;
    void main() {
      float reveal = mix(-0.02, 1.02, bim());
      float ink = 1.0 - smoothstep(reveal - 0.006, reveal + 0.006, vOrder);
      // Ponta do traço mais clara enquanto o modelo BIM é desenhado.
      float head = ink * (1.0 - smoothstep(0.0, 0.04, reveal - vOrder)) * (1.0 - step(1.0, reveal));
      float alpha = ink * smoothstep(0.7, 0.77, uProgress) * 0.5;
      if (alpha < 0.002) discard;
      gl_FragColor = vec4(mix(uOrange, vec3(1.0, 0.85, 0.6), head), alpha);
    }
  `), THREE.LineSegments, 3);
  wire.length = 0;

  add(new THREE.PlaneGeometry(14.4, 10).rotateY(Math.PI / 2).translate(0, 4.9, 0), shader(`
    varying vec2 vUv;
    void main() {
      vUv = uv;
      vec3 p = position;
      p.x = scanX();
      gl_Position = projectionMatrix * modelViewMatrix * vec4(pose(p), 1.0);
    }
  `, `
    varying vec2 vUv;
    void main() {
      // Lâmina de luz: forte junto ao solo, some para cima.
      float edge = 1.0 - smoothstep(0.35, 1.0, abs(vUv.x - 0.5) * 2.0);
      float rise = pow(1.0 - vUv.y, 2.5);
      float fade = smoothstep(0.2, 0.3, uProgress) * (1.0 - smoothstep(0.7, 0.84, uProgress));
      gl_FragColor = vec4(uOrange, 0.04 * edge * rise * fade);
    }
  `, { side: THREE.DoubleSide }), THREE.Mesh, 1);

  // Tripé e raios discretos.
  const origin = [-10.2, 1.1, 6.1], rays = [], moving = [], strengths = [];
  function ray(a, b, moves, strength) {
    rays.push(...a, ...b); moving.push(0, moves); strengths.push(strength, strength);
  }
  for (let i = 0; i < 3; i++) {
    const a = i / 3 * TAU;
    ray(origin, [origin[0] + 0.42 * Math.cos(a), 0, origin[2] + 0.42 * Math.sin(a)], 0, 0.5);
  }
  for (const [y, z] of [[0.3, -5.6], [2.7, -2], [5.2, 1], [7.5, 4.7]]) ray(origin, [0, y, z], 1, 0.045);
  add(new THREE.BufferGeometry()
    .setAttribute("position", new THREE.Float32BufferAttribute(rays, 3))
    .setAttribute("aMoving", new THREE.Float32BufferAttribute(moving, 1))
    .setAttribute("aStrength", new THREE.Float32BufferAttribute(strengths, 1)), shader(`
    attribute float aMoving, aStrength;
    varying float vStrength;
    void main() {
      vec3 p = position;
      p.x = mix(p.x, scanX(), aMoving);
      vStrength = aStrength;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(pose(p), 1.0);
    }
  `, `
    varying float vStrength;
    void main() { gl_FragColor = vec4(uOrange, vStrength * scanOn()); }
  `), THREE.LineSegments, 3);
  add(new THREE.BufferGeometry().setAttribute("position", new THREE.Float32BufferAttribute(origin, 3)), shader(`
    void main() {
      vec4 mv = modelViewMatrix * vec4(pose(position), 1.0);
      gl_Position = projectionMatrix * mv;
      gl_PointSize = clamp(220.0 / max(0.1, -mv.z), 2.0, 6.0) * uPixelRatio;
    }
  `, `
    void main() {
      float r = length(gl_PointCoord - 0.5) * 2.0;
      if (r >= 1.0) discard;
      gl_FragColor = vec4(uOrange * 1.6, (1.0 - smoothstep(0.0, 1.0, r)) * scanOn());
    }
  `), THREE.Points, 4);

  // Chamadas manuais renderizam mesmo fora da viewport.
  function step(t) {
    if (disposed) return;
    const stamp = Number.isFinite(t) ? t : performance.now();
    const dt = lastTime === null ? 0 : clamp((stamp - lastTime) / 1000, 0, 0.05);
    lastTime = stamp;
    const injected = Number(uniforms.uProgress.value);
    if (Number.isFinite(injected) && injected !== appliedProgress) targetProgress = progress = clamp(injected);
    progress = reducedMotion ? targetProgress : progress + (targetProgress - progress) * 0.08;
    if (Math.abs(progress - targetProgress) < 0.00001) progress = targetProgress;
    uniforms.uProgress.value = appliedProgress = progress;
    if (!reducedMotion) uniforms.uTime.value += dt;
    uniforms.uPointer.value.lerp(pointer, reducedMotion ? 1 : 0.08);
    composer.render(dt);
  }
  function updateLoop() {
    if (disposed) return;
    lastTime = null;
    renderer.setAnimationLoop(active && !document.hidden ? step : null);
  }
  function resize() {
    if (disposed) return;
    const w = canvas.clientWidth || 800, h = canvas.clientHeight || 600;
    const ratio = Math.min(window.devicePixelRatio || 1, 1.5);
    if (w === width && h === height && ratio === pixelRatio) return;
    width = w; height = h; pixelRatio = ratio;
    renderer.setPixelRatio(ratio);
    renderer.setSize(w, h, false);
    composer.setPixelRatio(ratio);
    composer.setSize(w, h);
    camera.aspect = w / h;
    const tangent = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
    const distance = Math.max(33, 13.5 / (tangent * camera.aspect));
    camera.position.copy(viewDirection).multiplyScalar(distance).add(focus);
    camera.far = distance + 100;
    camera.lookAt(focus);
    camera.updateProjectionMatrix();
    uniforms.uPixelRatio.value = ratio;
    uniforms.uPointScale.value = h * 0.035 / (2 * tangent);
    step(performance.now());
  }
  function snap(p) {
    if (disposed || !Number.isFinite(p)) return;
    targetProgress = progress = appliedProgress = clamp(p);
    uniforms.uProgress.value = progress;
    step(performance.now());
  }

  const observer = new ResizeObserver(resize);
  observer.observe(canvas);
  document.addEventListener("visibilitychange", updateLoop);
  const debug = {
    get progress() { return uniforms.uProgress.value; },
    uniforms: cloud.material.uniforms,
    get pointCount() { return POINT_COUNT; },
    snap
  };
  window.__pcStep = step;
  window.__pointcloud = debug;
  resize();

  return {
    setProgress(p) {
      if (!disposed && Number.isFinite(p)) targetProgress = clamp(p);
    },
    setPointer(x, y) {
      if (!disposed) pointer.set(Number.isFinite(x) ? clamp(x, -1, 1) : 0, Number.isFinite(y) ? clamp(y, -1, 1) : 0);
    },
    setActive(on) {
      if (disposed || active === Boolean(on)) return;
      active = Boolean(on);
      updateLoop();
    },
    dispose() {
      if (disposed) return;
      disposed = true; active = false;
      renderer.setAnimationLoop(null);
      observer.disconnect();
      document.removeEventListener("visibilitychange", updateLoop);
      for (const geometry of geometries) geometry.dispose();
      for (const material of materials) material.dispose();
      for (const pass of composer.passes) pass.dispose?.();
      composer.dispose();
      renderer.dispose();
      scene.clear();
      geometries.clear(); materials.clear();
      if (window.__pcStep === step) delete window.__pcStep;
      if (window.__pointcloud === debug) delete window.__pointcloud;
    }
  };
}
