import * as THREE from "three";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";

const common = /* glsl */ `
uniform float uTime;
uniform float uProgress;
uniform vec2 uPointer;
uniform float uIntro;
uniform float uAspect;
uniform float uPixelRatio;
uniform vec3 uLime;
uniform vec3 uLimeLight;
uniform vec3 uCyan;

float middleWeight() {
  return smoothstep(0.025, 0.17, uProgress) * (1.0 - smoothstep(0.8, 0.94, uProgress));
}

float reveal(float u, float seed) {
  float edge = uIntro * 1.2 - (0.02 + 0.16 * seed);
  return smoothstep(0.0, 0.014, edge - u);
}

vec3 strandColor(float seed, float offset) {
  float core = pow(1.0 - abs(offset), 1.5);
  vec3 lime = mix(uLime, uLimeLight, 0.25 + 0.65 * core);
  return mix(lime, uCyan, step(0.8, seed)) * mix(0.9, 1.2, core);
}
`;

const shape = common + /* glsl */ `
vec2 bezier(vec2 a, vec2 b, vec2 c, vec2 d, float t) {
  float v = 1.0 - t;
  return v*v*v*a + 3.0*v*v*t*b + 3.0*v*t*t*c + t*t*t*d;
}

vec2 hero(float u, float offset) {
  vec2 waist = vec2(-0.15, -0.45);
  if (u < 0.3) {
    float t = u / 0.3;
    vec2 p = bezier(vec2(-0.24, -1.16), vec2(0.12, -1.02),
                    vec2(-0.15, -0.76), waist, t);
    p.x += offset * mix(0.055, 0.009, smoothstep(0.0, 1.0, t));
    return p;
  }
  float t = (u - 0.3) / 0.7;
  float side = step(0.0, offset);
  float spread = abs(offset);
  vec2 end = mix(vec2(-0.43 - 0.74*spread, 1.12 - 0.16*spread),
                 vec2(0.65 + 0.57*spread, 1.08 - 0.37*spread), side);
  vec2 c2 = mix(vec2(-0.43, 0.61), vec2(0.48, 0.63), side);
  vec2 p = bezier(waist, vec2(-0.15, -0.02), c2, end, t);
  p.x += offset * 0.009 * (1.0 - t);
  return p;
}

vec3 streamPosition(float u, float seed, float offset) {
  float ab = smoothstep(0.025, 0.17, uProgress);
  float bc = smoothstep(0.8, 0.94, uProgress);
  float phase = uTime * (0.36 - 0.24*middleWeight()) + uProgress*8.0 + seed*6.283185;
  vec2 a = hero(u, offset);
  vec2 b = vec2(mix(-1.22, 1.22, u), mix(-0.85, 0.87, u));
  b.y += offset*0.34 + 0.13*sin(u*6.283185 + phase*0.32);
  b.x += offset*0.075;
  vec2 c = vec2(mix(-1.2, 1.2, u), -0.57 + offset*0.25);
  c.y += 0.06*sin(u*6.283185 + phase*0.22) + 0.025*sin(u*15.0 - phase*0.3);
  vec2 p = mix(mix(a, b, ab), c, bc);
  float ripple = u*24.0 + phase;
  float amplitude = 0.003 + 0.012*abs(u - 0.3) + 0.014*middleWeight();
  p += amplitude * vec2(sin(ripple), 0.7*cos(ripple*0.81 + seed*4.0));
  p.x *= mix(0.84, 1.0, smoothstep(0.5, 1.0, uAspect));
  p += uPointer * vec2(0.022, 0.018) * (0.35 + 0.65*sin(u*3.141593));
  return vec3(p.x*uAspect*4.0, p.y*4.0, 0.0);
}
`;

const strandVertex = shape + /* glsl */ `
attribute float aU;
attribute float aSeed;
attribute float aOffset;
#ifdef SPARKLES
attribute float aSpeed;
#endif
varying vec3 vColor;
varying float vAlpha;

void main() {
  float u = aU;
  float opacity = 0.052;
  #ifdef SPARKLES
  u = fract(aU + uTime*aSpeed*(1.0 - 0.6*middleWeight()) + uProgress*0.32);
  gl_PointSize = (1.5 + 2.0*fract(aSeed*13.7)) * uPixelRatio;
  opacity = 0.55;
  #endif
  float core = pow(1.0 - abs(aOffset), 0.65);
  float brightness = mix(1.0, 0.35, middleWeight());
  float pulse = 0.5 + 0.5*sin(u*25.0 - uTime*(1.0 - 0.7*middleWeight()) + uProgress*22.0 + aSeed*6.283185);
  vColor = strandColor(aSeed, aOffset) * (1.1 + 0.65*pow(pulse, 5.0));
  vAlpha = opacity * brightness * mix(0.55, 1.0, core) * reveal(u, aSeed);
  vAlpha *= smoothstep(0.0, 0.018, u) * (1.0 - smoothstep(0.982, 1.0, u));
  gl_Position = projectionMatrix * modelViewMatrix * vec4(streamPosition(u, aSeed, aOffset), 1.0);
}
`;

const strandFragment = /* glsl */ `
varying vec3 vColor;
varying float vAlpha;
void main() {
  float alpha = vAlpha;
  #ifdef SPARKLES
  float r = length(gl_PointCoord*2.0 - 1.0);
  alpha *= 1.0 - smoothstep(0.08, 1.0, r);
  #endif
  if (alpha < 0.001) discard;
  gl_FragColor = vec4(vColor, alpha);
}
`;

export function initLightStream(canvas, { reducedMotion = false } = {}) {
  if (!canvas || typeof canvas.getContext !== "function") throw new TypeError("A canvas element is required.");
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true });
  renderer.setClearColor(0x060706, 1);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  const scene = new THREE.Scene();
  // Clear via scene.background: com EffectComposer o clearColor sozinho sai com double sRGB (fundo cinza).
  scene.background = new THREE.Color(0x060706);
  const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 50);
  camera.position.z = 4 / Math.tan(THREE.MathUtils.degToRad(22.5));
  const uniforms = {
    uTime: { value: 0 },
    uProgress: { value: 0 },
    uPointer: { value: new THREE.Vector2() },
    uIntro: { value: 1 },
    uAspect: { value: 1 },
    uPixelRatio: { value: 1 },
    uGlowSize: { value: 100 },
    uLime: { value: new THREE.Color("#c6f432") },
    uLimeLight: { value: new THREE.Color("#d8ff5a") },
    uCyan: { value: new THREE.Color("#58c7e8") },
  };
  let targetProgress = 0;
  let disposed = false;

  // Geometry is uploaded once; all movement lives in the shaders.
  const lineCount = 160, samples = 200, pointCount = 1500;
  const seeds = new Float32Array(lineCount);
  const offsets = new Float32Array(lineCount);
  for (let i = 0; i < lineCount; i++) {
    seeds[i] = (i + 0.5) / lineCount;
    offsets[i] = (((i * 73) % lineCount + 0.5) / lineCount) * 2 - 1;
  }
  function makeGeometry(count) {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(new Float32Array(count * 3), 3));
    for (const name of ["aU", "aSeed", "aOffset"]) {
      geometry.setAttribute(name, new THREE.BufferAttribute(new Float32Array(count), 1));
    }
    return geometry;
  }
  const lineGeometry = makeGeometry(lineCount * samples);
  const indices = new Uint16Array(lineCount * (samples - 1) * 2);
  let index = 0;
  for (let i = 0; i < lineCount; i++) {
    for (let j = 0; j < samples; j++) {
      const v = i * samples + j;
      lineGeometry.attributes.aU.array[v] = j / (samples - 1);
      lineGeometry.attributes.aSeed.array[v] = seeds[i];
      lineGeometry.attributes.aOffset.array[v] = offsets[i];
      if (j < samples - 1) {
        indices[index++] = v;
        indices[index++] = v + 1;
      }
    }
  }
  lineGeometry.setIndex(new THREE.BufferAttribute(indices, 1));

  // Fixed random seed keeps screenshots reproducible.
  let randomState = 0x57a3c921;
  function random() {
    randomState = (Math.imul(randomState, 1664525) + 1013904223) >>> 0;
    return randomState / 4294967296;
  }
  const pointGeometry = makeGeometry(pointCount);
  pointGeometry.setAttribute("aSpeed", new THREE.BufferAttribute(new Float32Array(pointCount), 1));
  for (let i = 0; i < pointCount; i++) {
    const line = Math.floor(random() * lineCount);
    pointGeometry.attributes.aU.array[i] = random();
    pointGeometry.attributes.aSeed.array[i] = seeds[line];
    pointGeometry.attributes.aOffset.array[i] = offsets[line];
    pointGeometry.attributes.aSpeed.array[i] = 0.018 + random() * 0.035;
  }

  const materialOptions = {
    uniforms, vertexShader: strandVertex, fragmentShader: strandFragment,
    transparent: true, blending: THREE.AdditiveBlending,
    depthTest: false, depthWrite: false, toneMapped: false,
  };
  const lineMaterial = new THREE.ShaderMaterial(materialOptions);
  const pointMaterial = new THREE.ShaderMaterial({ ...materialOptions, defines: { SPARKLES: 1 } });
  const stream = new THREE.LineSegments(lineGeometry, lineMaterial);
  const sparkles = new THREE.Points(pointGeometry, pointMaterial);
  stream.frustumCulled = sparkles.frustumCulled = false;
  scene.add(stream, sparkles);

  const glowGeometry = new THREE.BufferGeometry();
  glowGeometry.setAttribute("position", new THREE.BufferAttribute(new Float32Array(3), 3));
  const glowMaterial = new THREE.ShaderMaterial({
    ...materialOptions,
    vertexShader: shape + /* glsl */ `
      uniform float uGlowSize;
      varying vec3 vColor;
      varying float vAlpha;
      void main() {
        vColor = strandColor(0.5, 0.0);
        vAlpha = 0.10 * reveal(0.3, 0.5) * (1.0 - smoothstep(0.03, 0.2, uProgress));
        gl_PointSize = uGlowSize * uPixelRatio;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(streamPosition(0.3, 0.5, 0.0), 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      varying vec3 vColor;
      varying float vAlpha;
      void main() {
        vec2 p = gl_PointCoord*2.0 - 1.0;
        float r2 = dot(p, p);
        float a = exp(-4.0*r2) * (1.0 - smoothstep(0.35, 1.0, r2));
        gl_FragColor = vec4(vColor, vAlpha*a);
      }
    `,
  });
  const glow = new THREE.Points(glowGeometry, glowMaterial);
  glow.frustumCulled = false;
  scene.add(glow);

  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  const bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), 1.1, 0.55, 0.05);
  composer.addPass(bloom);
  composer.addPass(new OutputPass());

  function requestFrame() {
    if (!disposed && !document.hidden) renderer.setAnimationLoop(step);
  }

  function resize() {
    if (disposed) return;
    const width = Math.max(1, canvas.clientWidth || window.innerWidth || 1);
    const height = Math.max(1, canvas.clientHeight || window.innerHeight || 1);
    const ratio = Math.min(window.devicePixelRatio || 1, 1.75);
    renderer.setPixelRatio(ratio);
    renderer.setSize(width, height, false);
    composer.setPixelRatio(ratio);
    composer.setSize(width, height);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    uniforms.uAspect.value = camera.aspect;
    uniforms.uPixelRatio.value = ratio;
    uniforms.uGlowSize.value = Math.max(64, Math.min(180, height * 0.14));
    requestFrame();
  }

  function step(t) {
    if (disposed) return;
    const progress = uniforms.uProgress.value;
    const next = THREE.MathUtils.lerp(progress, targetProgress, 0.08);
    uniforms.uProgress.value = Math.abs(next - targetProgress) < 0.00001 ? targetProgress : next;
    uniforms.uTime.value = reducedMotion ? 0 : (Number.isFinite(t) ? t : performance.now()) * 0.001;
    composer.render();
    if (reducedMotion && uniforms.uProgress.value === targetProgress) {
      renderer.setAnimationLoop(null);
    }
  }

  function visibilityChange() {
    if (document.hidden) renderer.setAnimationLoop(null);
    else requestFrame();
  }

  const debug = { get progress() { return uniforms.uProgress.value; }, uniforms };
  window.__step = step;
  window.__lightstream = debug;
  window.addEventListener("resize", resize, { passive: true });
  document.addEventListener("visibilitychange", visibilityChange);
  resize();
  if (!document.hidden) step(0);

  return {
    setProgress(p) {
      if (disposed || !Number.isFinite(p)) return;
      targetProgress = THREE.MathUtils.clamp(p, 0, 1);
      requestFrame();
    },
    setPointer(x, y) {
      if (disposed || !Number.isFinite(x) || !Number.isFinite(y)) return;
      uniforms.uPointer.value.set(THREE.MathUtils.clamp(x, -1, 1), THREE.MathUtils.clamp(y, -1, 1));
      requestFrame();
    },
    setIntro(k) {
      if (disposed || !Number.isFinite(k)) return;
      uniforms.uIntro.value = THREE.MathUtils.clamp(k, 0, 1);
      requestFrame();
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      renderer.setAnimationLoop(null);
      window.removeEventListener("resize", resize);
      document.removeEventListener("visibilitychange", visibilityChange);
      lineGeometry.dispose();
      pointGeometry.dispose();
      glowGeometry.dispose();
      lineMaterial.dispose();
      pointMaterial.dispose();
      glowMaterial.dispose();
      for (const pass of composer.passes) pass.dispose();
      composer.dispose();
      renderer.dispose();
      scene.clear();
      if (window.__step === step) delete window.__step;
      if (window.__lightstream === debug) delete window.__lightstream;
    },
  };
}
