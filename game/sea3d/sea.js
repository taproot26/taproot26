/* ============================================================================
   Taproot Sea: sail your sloop around a tropical, pirate-era archipelago.

   You board at the 3D docks (/game/world3d/?area=docks, end of the west pier)
   and dock back at Taproot Docks to go ashore. Gold from barrels and treasure
   chests goes into the same save (taproot_field) as the rest of the game;
   looted chests are remembered in taproot_sea_loot.

   - Ocean: one big plane that follows the boat, waved in the vertex shader by
     a sum of sines (the same function the boat samples on the CPU, so it rides
     the swell). The fragment shader paints Wind Waker-style toon water: deep
     blue to cyan by wave height, drifting white wind streaks, turquoise
     shallows and pulsing foam rings around every island, glints, and fog
     into the horizon colour of the sky dome.
   - Boat: throttle by sail level (W/S), steer (A/D), Shift for a gust;
     pitch and roll follow the waves, it leans into turns, the sail billows
     with speed and furls when stopped. Islands and galleons push it back.
   ============================================================================ */
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { makeHero3D } from '/game/lib/hero3d.js';
import { toon, buildIslands, buildPlayerBoat, buildGalleon, buildBarrel, buildGull, buildDolphin, jollyTexture } from './world.js';

const $ = (id) => document.getElementById(id);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const damp = (a, b, k, dt) => a + (b - a) * (1 - Math.exp(-k * dt));
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
const SEA_R = 420; // the sea ends here (fog hides the edge)

/* ---------- save data ---------- */
const FIELD_KEY = 'taproot_field', LOOT_KEY = 'taproot_sea_loot';
let field = null, looted = [];
try { field = JSON.parse(localStorage.getItem(FIELD_KEY)); } catch (e) {}
try { looted = JSON.parse(localStorage.getItem(LOOT_KEY)) || []; } catch (e) {}
field = Object.assign({ xp: 0, kills: 0, gold: 0 }, field);
if (!field.bag || typeof field.bag !== 'object') field.bag = {};
const save = () => { try { localStorage.setItem(FIELD_KEY, JSON.stringify(field)); localStorage.setItem(LOOT_KEY, JSON.stringify(looted)); } catch (e) {} };

/* ---------- renderer, scene, lights ---------- */
const canvas = $('scene');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
const scene = new THREE.Scene();
const HORIZON = new THREE.Color('#d4ecfa');
scene.background = HORIZON;
scene.fog = new THREE.Fog(HORIZON, 160, 720);
const camera = new THREE.PerspectiveCamera(55, innerWidth / innerHeight, 0.1, 4000);

scene.add(new THREE.HemisphereLight('#e8f6ff', '#2a7aa8', 1.35));
const SUN_DIR = new THREE.Vector3(0.5, 0.75, 0.35).normalize();
const sun = new THREE.DirectionalLight('#fff4dc', 2.3);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
Object.assign(sun.shadow.camera, { left: -40, right: 40, top: 40, bottom: -40, near: 1, far: 220 });
sun.shadow.bias = -0.0004;
sun.shadow.normalBias = 0.04;
scene.add(sun, sun.target);

const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
composer.addPass(new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), 0.3, 0.5, 0.86));
composer.addPass(new OutputPass());

/* ---------- sky dome with a sun ---------- */
const sky = new THREE.Mesh(new THREE.SphereGeometry(1800, 32, 16), new THREE.ShaderMaterial({
  side: THREE.BackSide, depthWrite: false, fog: false,
  uniforms: { uTop: { value: new THREE.Color('#2a7ae0') }, uMid: { value: new THREE.Color('#6ab4f2') }, uHor: { value: HORIZON }, uSun: { value: SUN_DIR } },
  vertexShader: 'varying vec3 vDir; void main() { vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
  fragmentShader: `uniform vec3 uTop, uMid, uHor, uSun; varying vec3 vDir;
    void main() {
      float h = vDir.y;
      vec3 c = mix(uHor, uMid, smoothstep(0.0, 0.2, h));
      c = mix(c, uTop, smoothstep(0.2, 0.75, h));
      float s = max(dot(normalize(vDir), uSun), 0.0);
      c += vec3(1.0, 0.92, 0.75) * (smoothstep(0.9993, 0.9996, s) * 2.5 + pow(s, 14.0) * 0.25);
      gl_FragColor = vec4(c, 1.0);
    }`,
}));
scene.add(sky);

// big soft clouds far out (no fog, so they stay bright)
const cloudMat = toon({ color: '#ffffff', emissive: '#bcd8ee', emissiveIntensity: 0.35, fog: false });
const CLOUD = new THREE.SphereGeometry(1, 16, 12);
for (let i = 0; i < 26; i++) {
  const a = (i / 26) * Math.PI * 2 + Math.random() * 0.2, r = 350 + Math.random() * 600, y = 60 + Math.random() * 90, s = 14 + Math.random() * 22;
  const g = new THREE.Group();
  for (let k = 0; k < 6; k++) {
    const m = new THREE.Mesh(CLOUD, cloudMat);
    m.position.set((k - 2.5) * s * 0.7, Math.sin(k * 1.9) * s * 0.25, Math.cos(k * 2.3) * s * 0.35);
    m.scale.set(s * (k === 2 || k === 3 ? 1.2 : 0.85), s * (k === 2 || k === 3 ? 0.75 : 0.55), s * 0.8);
    g.add(m);
  }
  g.position.set(Math.cos(a) * r, y, Math.sin(a) * r);
  g.lookAt(0, y, 0);
  scene.add(g);
}

/* ---------- ocean ---------- */
const WAVES = [[0.045, 0.02, 0.9, 0.55], [-0.03, 0.05, 1.1, 0.4], [0.09, -0.07, 1.6, 0.18], [0.15, 0.11, 2.1, 0.09]]; // kx, kz, speed, amplitude
const waveH = (x, z, t) => WAVES.reduce((h, [kx, kz, s, a]) => h + Math.sin(x * kx + z * kz + t * s) * a, 0);
const WAVE_GLSL = WAVES.map(([kx, kz, s, a]) => `sin(p.x * ${kx.toFixed(4)} + p.y * ${kz.toFixed(4)} + t * ${s.toFixed(3)}) * ${a.toFixed(3)}`).join(' + ');

const islands = buildIslands(scene, looted);
const shores = islands.flatMap((I) => I.shores).slice(0, 24);
const oceanU = {
  uTime: { value: 0 }, uCam: { value: new THREE.Vector3() },
  uDeep: { value: new THREE.Color('#1270c8') }, uMid: { value: new THREE.Color('#1c98e4') }, uShallow: { value: new THREE.Color('#3fe0d2') },
  uFoam: { value: new THREE.Color('#ffffff') }, uFog: { value: HORIZON },
  uIsl: { value: Array.from({ length: 24 }, (_, i) => new THREE.Vector3(...(shores[i] || [1e5, 1e5, 0]))) }, uIslN: { value: shores.length },
};
const ocean = new THREE.Mesh(new THREE.PlaneGeometry(1400, 1400, 280, 280).rotateX(-Math.PI / 2), new THREE.ShaderMaterial({
  uniforms: oceanU, fog: false,
  vertexShader: `uniform float uTime; varying vec3 vW; varying float vH;
    float waveH(vec2 p, float t) { return ${WAVE_GLSL}; }
    void main() {
      vec4 w = modelMatrix * vec4(position, 1.0);
      vH = waveH(w.xz, uTime);
      w.y += vH;
      vW = w.xyz;
      gl_Position = projectionMatrix * viewMatrix * w;
    }`,
  fragmentShader: `uniform float uTime; uniform vec3 uDeep, uMid, uShallow, uFoam, uFog, uCam; uniform vec3 uIsl[24]; uniform int uIslN;
    varying vec3 vW; varying float vH;
    float hash2(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
    float vnoise(vec2 p) { vec2 i = floor(p), f = fract(p), u = f * f * (3.0 - 2.0 * f);
      return mix(mix(hash2(i), hash2(i + vec2(1, 0)), u.x), mix(hash2(i + vec2(0, 1)), hash2(i + vec2(1, 1)), u.x), u.y); }
    void main() {
      float shore = 1e4;
      for (int i = 0; i < 24; i++) { if (i >= uIslN) break; shore = min(shore, length(vW.xz - uIsl[i].xy) - uIsl[i].z); }
      vec3 c = mix(uDeep, uMid, smoothstep(-0.7, 0.8, vH));
      c = mix(c, uShallow, (1.0 - smoothstep(0.0, 24.0, shore)) * 0.9);
      // wind streaks: stretched noise drifting in two directions
      vec2 q = vW.xz * vec2(0.05, 0.2) + vec2(uTime * 0.04, uTime * 0.015);
      float n = vnoise(q) * 0.65 + vnoise(q * 2.3 + 7.1) * 0.35;
      float foam = smoothstep(0.775, 0.79, n) * smoothstep(-0.2, 0.4, vH);
      vec2 q2 = vW.xz * vec2(0.1, 0.03) + vec2(-uTime * 0.02, uTime * 0.045);
      foam = max(foam, smoothstep(0.87, 0.885, vnoise(q2 + 3.3)) * 0.8);
      // surf: a solid lip at the beach and rings pulsing outward
      float near = 1.0 - smoothstep(0.0, 7.0, shore);
      foam = max(foam, (1.0 - smoothstep(0.4, 1.6, shore)));
      foam = max(foam, smoothstep(0.62, 0.68, sin(shore * 1.6 - uTime * 2.2) * 0.5 + 0.5) * near * 0.9);
      c = mix(c, uFoam, foam);
      c += step(0.988, hash2(floor(vW.xz * 1.3) + floor(uTime * 4.0))) * smoothstep(0.2, 0.7, vH) * 0.7;
      c = mix(c, uFog, smoothstep(160.0, 720.0, length(vW - uCam)));
      gl_FragColor = vec4(c, 1.0);
    }`,
}));
ocean.frustumCulled = false;
scene.add(ocean);

/* ---------- the player's sloop with the hero on deck ---------- */
const harbor = islands.find((I) => I.id === 'harbor');
const boat = buildPlayerBoat();
scene.add(boat.g);
let look = null;
try { look = JSON.parse(localStorage.getItem('taproot_character')); } catch (e) {}
if (look && look.equipment) { const e = look.equipment; if (e.weapon) { e.rhand = e.rhand || e.weapon; delete e.weapon; } if (e.hands) { e.rhand = e.rhand || e.hands; delete e.hands; } }
look = look || { skin: 1, hc: 0, hs: 'short', equipment: {} };
const hero = makeHero3D(look);
hero.root.position.set(0, 0.75, -1.25);
boat.g.add(hero.root);
if (globalThis.SPRITE) document.querySelector('.avatar').style.background = `url(${SPRITE.renderDir(look, 'down', 0, true).toDataURL()}) center 18% / 150% no-repeat, radial-gradient(circle at 35% 30%, #bff0ff, #3aa8e0)`;

const SAILS = [0, 5, 9, 14], SAIL_NAMES = ['Furled', 'Quarter sail', 'Half sail', 'Full sail'];
const B = { x: harbor.dock.x, z: harbor.dock.z + 7, h: 0, speed: 0, level: 0, yawRate: 0, bump: 0 };

// a soft shadow on the water under the hull
const blob = new THREE.Mesh(new THREE.CircleGeometry(1, 24).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: '#06345a', transparent: true, opacity: 0.32, depthWrite: false }));
blob.scale.set(1.5, 1, 3.4);
scene.add(blob);

/* ---------- pirate galleons on patrol ---------- */
const jolly = jollyTexture();
const galleons = [[60, -120, 70, 0.03], [-120, -20, 90, -0.025], [160, 20, 60, 0.035]].map(([cx, cz, R, w], i) => {
  const g = buildGalleon(jolly);
  scene.add(g);
  return { g, cx, cz, R, w, a: i * 2, x: cx + Math.cos(i * 2) * R, z: cz + Math.sin(i * 2) * R };
});

/* ---------- floating barrels (gold), gulls, dolphins ---------- */
const inIsland = (x, z, pad) => islands.some((I) => I.colliders.some(([cx, cz, r]) => Math.hypot(x - cx, z - cz) < r + pad));
function openSea(pad = 10) {
  for (let i = 0; i < 300; i++) {
    const a = Math.random() * Math.PI * 2, r = 30 + Math.random() * (SEA_R - 60), x = Math.cos(a) * r, z = Math.sin(a) * r;
    if (!inIsland(x, z, pad)) return [x, z];
  }
  return [0, 60];
}
const barrels = Array.from({ length: 26 }, () => { const g = buildBarrel(); scene.add(g); const [x, z] = openSea(); return { g, x, z, ph: Math.random() * 6, gone: 0 }; });
const gulls = Array.from({ length: 16 }, (_, i) => {
  const b = buildGull(), I = islands[i % islands.length];
  scene.add(b.g);
  return { ...b, cx: I.x, cz: I.z, r: I.r + 6 + Math.random() * 14, y: 12 + Math.random() * 10, w: (0.25 + Math.random() * 0.25) * (i % 2 ? 1 : -1), a: Math.random() * 6 };
});
const dolphins = [0, 1].map(() => { const g = buildDolphin(); g.visible = false; scene.add(g); return { g, t: -3 - Math.random() * 4 }; });

/* ---------- wake and splashes ---------- */
const WAKE_N = 420;
const wake = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 8, 4), new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.75, depthWrite: false }), WAKE_N);
wake.frustumCulled = false;
scene.add(wake);
const W = Array.from({ length: WAKE_N }, () => ({ x: 0, z: 0, vx: 0, vz: 0, age: 1, life: 1, s: 0 }));
let wakeI = 0;
const spawnFoam = (x, z, vx, vz, life, s) => { Object.assign(W[wakeI], { x, z, vx, vz, age: 0, life, s }); wakeI = (wakeI + 1) % WAKE_N; };
const splash = (x, z, n = 14, s = 0.5) => { for (let i = 0; i < n; i++) { const a = (i / n) * Math.PI * 2; spawnFoam(x, z, Math.cos(a) * 3, Math.sin(a) * 3, 0.9, s); } };
const M = new THREE.Matrix4(), Qn = new THREE.Quaternion(), Vp = new THREE.Vector3(), Vs = new THREE.Vector3();

/* ---------- labels and floating text ---------- */
const labelsEl = $('labels'), PV = new THREE.Vector3();
function toScreen(x, y, z) {
  PV.set(x, y, z).project(camera);
  return PV.z < 1 && Math.abs(PV.x) < 1.1 && Math.abs(PV.y) < 1.1 ? [(PV.x + 1) / 2 * innerWidth, (1 - PV.y) / 2 * innerHeight] : null;
}
islands.forEach((I) => {
  I.el = document.createElement('div');
  I.el.className = 'tag';
  I.el.textContent = I.name;
  labelsEl.appendChild(I.el);
});
const floats = [];
function floatText(x, y, z, msg, color) {
  const el = document.createElement('div');
  el.className = 'float';
  el.textContent = msg;
  el.style.color = color;
  labelsEl.appendChild(el);
  floats.push({ el, x, y, z, age: 0 });
}
const treasures = islands.filter((I) => I.treasure);
const updateHud = () => { $('goldText').textContent = field.gold; $('foundText').textContent = `${treasures.filter((I) => looted.includes(I.id)).length}/${treasures.length}`; };
updateHud();

/* ---------- input ---------- */
const keys = {};
let camYaw = Math.PI, camPitch = 0.28, camDist = 16, camMode = 0, lastDrag = -1e9;
const CAM_MODES = [{ dist: 16, pitch: 0.26 }, { dist: 26, pitch: 0.5 }, { dist: 48, pitch: 1.0 }];
let camDistT = camDist, camPitchT = camPitch;
const sailUp = () => { B.level = Math.min(3, B.level + 1); };
const sailDown = () => { B.level = Math.max(0, B.level - 1); };
function cycleCam() { camMode = (camMode + 1) % CAM_MODES.length; camDistT = CAM_MODES[camMode].dist; camPitchT = CAM_MODES[camMode].pitch; }
addEventListener('keydown', (e) => {
  if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault();
  if (e.repeat) return;
  keys[e.code] = true;
  if (e.code === 'KeyW' || e.code === 'ArrowUp') sailUp();
  if (e.code === 'KeyS' || e.code === 'ArrowDown') sailDown();
  if (e.code === 'KeyF' || e.code === 'Space') act();
  if (e.code === 'KeyC') cycleCam();
});
addEventListener('keyup', (e) => { keys[e.code] = false; });
addEventListener('blur', () => { for (const k in keys) keys[k] = false; });
let drag = null, joy = null;
canvas.addEventListener('pointerdown', (e) => {
  canvas.setPointerCapture(e.pointerId);
  if (e.pointerType === 'touch' && e.clientX < innerWidth / 2 && !joy) { joy = { id: e.pointerId, sx: e.clientX, sy: e.clientY, fx: 0, fy: 0 }; return; }
  drag = { id: e.pointerId, x: e.clientX, y: e.clientY };
  canvas.classList.add('drag');
});
canvas.addEventListener('pointermove', (e) => {
  if (joy && e.pointerId === joy.id) { const dx = e.clientX - joy.sx, dy = e.clientY - joy.sy, d = Math.max(40, Math.hypot(dx, dy)); joy.fx = dx / d; joy.fy = -dy / d; }
  else if (drag && e.pointerId === drag.id) {
    camYaw -= (e.clientX - drag.x) * 0.006;
    camPitchT = clamp(camPitchT + (e.clientY - drag.y) * 0.004, 0.05, 1.3);
    drag.x = e.clientX; drag.y = e.clientY;
    lastDrag = performance.now();
  }
});
const endPointer = (e) => { if (joy && e.pointerId === joy.id) joy = null; if (drag && e.pointerId === drag.id) { drag = null; canvas.classList.remove('drag'); } };
canvas.addEventListener('pointerup', endPointer);
canvas.addEventListener('pointercancel', endPointer);
canvas.addEventListener('wheel', (e) => { e.preventDefault(); camDistT = clamp(camDistT + e.deltaY * 0.02, 9, 70); }, { passive: false });
const tap = (id, fn) => $(id).addEventListener('pointerdown', (e) => { e.preventDefault(); fn(); });
tap('upBtn', sailUp); tap('downBtn', sailDown); tap('camBtn', cycleCam); tap('actBtn', () => act());
addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
  composer.setSize(innerWidth, innerHeight);
});

/* ---------- docking and looting ---------- */
let action = null, leaving = false;
function findAction() {
  if (Math.hypot(B.x - harbor.dock.x, B.z - harbor.dock.z) < 12) return { label: 'Dock at Taproot Docks', icon: '⚓', run: dock };
  for (const I of treasures) if (I.chest && Math.hypot(B.x - I.x, B.z - I.z) < I.r + 8) return { label: `Loot the chest on ${I.name}`, icon: '💰', run: () => loot(I) };
  return null;
}
function act() { if (action && !leaving) action.run(); }
function dock() {
  leaving = true;
  B.level = 0;
  $('fade').style.opacity = 1;
  setTimeout(() => { location.href = '/game/world3d/?area=docks&from=sea'; }, 650);
}
function loot(I) {
  scene.remove(I.chest);
  I.chest = null;
  looted.push(I.id);
  field.gold += I.treasure;
  save();
  updateHud();
  floatText(B.x, 5, B.z, `+${I.treasure} gold! Treasure found`, '#ffd34a');
  hero.emote('happy', 1.5);
  splash(B.x, B.z, 10, 0.4);
}

/* ---------- minimap (sea chart) ---------- */
const mctx = $('minimap').getContext('2d');
function drawChart() {
  const S = 240, ppu = 0.8;
  mctx.clearRect(0, 0, S, S);
  mctx.save();
  mctx.beginPath(); mctx.arc(S / 2, S / 2, S / 2, 0, Math.PI * 2); mctx.clip();
  mctx.fillStyle = '#1a6aa8'; mctx.fillRect(0, 0, S, S);
  mctx.translate(S / 2, S / 2);
  mctx.rotate(camYaw);
  mctx.scale(ppu, ppu);
  mctx.translate(-B.x, -B.z);
  mctx.strokeStyle = 'rgba(255, 255, 255, 0.25)'; mctx.lineWidth = 2 / ppu;
  mctx.beginPath(); mctx.arc(0, 0, SEA_R, 0, Math.PI * 2); mctx.stroke();
  for (const I of islands) for (const [x, z, r] of I.shores) {
    mctx.fillStyle = '#3fe0d2'; mctx.beginPath(); mctx.arc(x, z, r + 6, 0, Math.PI * 2); mctx.fill();
    mctx.fillStyle = '#f2dca2'; mctx.beginPath(); mctx.arc(x, z, r, 0, Math.PI * 2); mctx.fill();
    mctx.fillStyle = '#64b244'; mctx.beginPath(); mctx.arc(x, z, r * 0.55, 0, Math.PI * 2); mctx.fill();
  }
  mctx.fillStyle = '#ffd84a';
  mctx.beginPath(); mctx.arc(harbor.dock.x, harbor.dock.z, 6, 0, Math.PI * 2); mctx.fill();
  for (const I of treasures) if (I.chest) { mctx.fillStyle = '#ffcf3a'; mctx.font = `${18 / ppu}px sans-serif`; mctx.fillText('★', I.x - 8 / ppu, I.z + 6 / ppu); }
  for (const b of barrels) if (!b.gone) { mctx.fillStyle = '#a8743f'; mctx.fillRect(b.x - 2, b.z - 2, 4, 4); }
  for (const g of galleons) { mctx.fillStyle = '#151218'; mctx.beginPath(); mctx.arc(g.x, g.z, 5, 0, Math.PI * 2); mctx.fill(); }
  mctx.translate(B.x, B.z);
  mctx.rotate(Math.atan2(Math.cos(B.h), Math.sin(B.h)));
  mctx.fillStyle = '#ffffff'; mctx.strokeStyle = '#0a2238'; mctx.lineWidth = 2;
  mctx.beginPath(); mctx.moveTo(9, 0); mctx.lineTo(-6, -6); mctx.lineTo(-3, 0); mctx.lineTo(-6, 6); mctx.closePath(); mctx.fill(); mctx.stroke();
  mctx.restore();
}

/* ---------- main loop ---------- */
const clock = new THREE.Clock();
const camPos = new THREE.Vector3(), lookAt = new THREE.Vector3();
let first = true, fov = 55, shake = 0;

function update(dt) {
  const t = clock.elapsedTime;
  oceanU.uTime.value = t;

  // sailing
  const gust = (keys.ShiftLeft || keys.ShiftRight) && B.level > 0;
  let target = SAILS[B.level] * (gust ? 1.4 : 1);
  if (joy) target = Math.max(target, Math.max(0, joy.fy) * 14);
  if (leaving) target = 0;
  B.speed = damp(B.speed, target, B.speed < target ? 0.6 : 0.9, dt);
  const steer = (keys.KeyA || keys.ArrowLeft ? 1 : 0) - (keys.KeyD || keys.ArrowRight ? 1 : 0) - (joy ? joy.fx : 0);
  B.yawRate = damp(B.yawRate, steer * 0.7 * (0.35 + 0.65 * Math.min(1, B.speed / 8)), 3, dt);
  B.h += B.yawRate * dt;
  const fx = Math.sin(B.h), fz = Math.cos(B.h);
  B.x += fx * B.speed * dt;
  B.z += fz * B.speed * dt;
  // islands, galleons and the edge of the sea push back
  const solids = islands.flatMap((I) => I.colliders).concat(galleons.map((g) => [g.x, g.z, 6]));
  for (const [cx, cz, r] of solids) {
    const dx = B.x - cx, dz = B.z - cz, d = Math.hypot(dx, dz) || 1, min = r + 2.4;
    if (d < min) { B.x = cx + (dx / d) * min; B.z = cz + (dz / d) * min; if (B.speed > 3) { shake = 0.25; B.bump = 0.4; } B.speed *= 0.6; }
  }
  const dc = Math.hypot(B.x, B.z);
  if (dc > SEA_R) { B.x *= SEA_R / dc; B.z *= SEA_R / dc; B.speed *= 0.9; }

  // ride the swell: height from the wave, pitch bow-to-stern, roll side-to-side, lean into turns
  const y = waveH(B.x, B.z, t);
  const pitch = Math.atan2(waveH(B.x - fx * 2.5, B.z - fz * 2.5, t) - waveH(B.x + fx * 2.5, B.z + fz * 2.5, t), 5);
  const roll = Math.atan2(waveH(B.x + fz, B.z - fx, t) - waveH(B.x - fz, B.z + fx, t), 2) * 0.6;
  B.bump = Math.max(0, B.bump - dt);
  boat.g.position.set(B.x, y - 0.05, B.z);
  boat.g.rotation.set(pitch, B.h, roll - B.yawRate * B.speed * 0.025 + Math.sin(B.bump * 30) * B.bump * 0.2, 'YXZ');
  blob.position.set(B.x + SUN_DIR.x * -0.6, y + 0.04, B.z + SUN_DIR.z * -0.6);
  blob.rotation.y = B.h;

  // sail: furls when stopped, billows with speed, swings a little into turns
  const sp = boat.sailPivot, open = B.level > 0 || B.speed > 1 ? 1 : 0.12;
  sp.scale.y = damp(sp.scale.y, open, 4, dt);
  sp.rotation.y = damp(sp.rotation.y, clamp(B.yawRate * 0.9, -0.5, 0.5), 3, dt);
  const billow = clamp(B.speed / 14, 0, 1.3), pos = boat.sailGeo.attributes.position, base = boat.base;
  for (let i = 0; i < pos.count; i++) {
    const bz = base[i * 3 + 2], by = base[i * 3 + 1], u = clamp(-bz / 2.8, 0, 1), v = clamp(by / 4.2, 0, 1);
    pos.setX(i, base[i * 3] + (billow * 0.95 + 0.06) * Math.sin(Math.PI * u) * Math.sin(Math.PI * (v * 0.85 + 0.1)) + Math.sin(t * 7 + u * 6 + v * 4) * 0.035 * (1.2 - billow));
  }
  pos.needsUpdate = true;
  boat.sailGeo.computeVertexNormals();
  hero.update(dt, {});

  // wake: foam peels off the stern corners, spray at the bow when fast
  B.foamAcc = (B.foamAcc || 0) + B.speed * dt; // one puff per side every ~0.6 units travelled
  if (B.speed > 1.2) {
    const n = Math.floor(B.foamAcc / 0.6);
    B.foamAcc -= n * 0.6;
    for (let k = 0; k < n; k++) for (const s of [-1, 1]) {
      const lx = s * 0.95, lz = -2.6;
      spawnFoam(B.x + fz * lx + fx * lz + (Math.random() - 0.5) * 0.4, B.z - fx * lx + fz * lz + (Math.random() - 0.5) * 0.4,
        fz * s * 1.6 - fx * 0.8, -fx * s * 1.6 - fz * 0.8, 1.8 + Math.random() * 0.8, 0.16 + B.speed * 0.008);
    }
    if (B.speed > 8 && Math.random() < 0.5) for (const s of [-1, 1]) spawnFoam(B.x + fx * 3.4 + fz * s * 0.7, B.z + fz * 3.4 - fx * s * 0.7, fz * s * 3 + fx * B.speed * 0.4, -fx * s * 3 + fz * B.speed * 0.4, 0.6, 0.25);
  }
  for (let i = 0; i < WAKE_N; i++) {
    const p = W[i];
    if (p.age >= p.life) { M.makeScale(0, 0, 0); wake.setMatrixAt(i, M); continue; }
    p.age += dt;
    p.x += p.vx * dt; p.z += p.vz * dt; p.vx *= 1 - dt * 0.8; p.vz *= 1 - dt * 0.8;
    const k = p.age / p.life, s = p.s * (k < 0.1 ? k / 0.1 : 1 - (k - 0.1) / 0.9) * (1 + k * 1.5);
    M.compose(Vp.set(p.x, waveH(p.x, p.z, t) + 0.06, p.z), Qn, Vs.set(s * 1.3, s * 0.2, s * 1.3));
    wake.setMatrixAt(i, M);
  }
  wake.instanceMatrix.needsUpdate = true;

  // galleons on patrol
  for (const g of galleons) {
    g.a += g.w * dt;
    g.x = g.cx + Math.cos(g.a) * g.R; g.z = g.cz + Math.sin(g.a) * g.R;
    const h = Math.atan2(-Math.sin(g.a) * g.w, Math.cos(g.a) * g.w);
    g.g.position.set(g.x, waveH(g.x, g.z, t) - 0.4, g.z);
    g.g.rotation.set(Math.sin(t * 0.7 + g.a) * 0.03, h, Math.sin(t * 0.9 + g.a * 2) * 0.05, 'YXZ');
    if (Math.random() < dt * 2) spawnFoam(g.x - Math.sin(h) * 7, g.z - Math.cos(h) * 7, 0, 0, 2.5, 0.8);
  }

  // barrels bob; sail through one for gold
  for (const b of barrels) {
    if (b.gone > 0) { b.gone -= dt; if (b.gone <= 0) { [b.x, b.z] = openSea(); b.g.visible = true; } continue; }
    b.g.position.set(b.x, waveH(b.x, b.z, t) + 0.1, b.z);
    b.g.rotation.set(Math.sin(t + b.ph) * 0.3, t * 0.2 + b.ph, Math.cos(t * 0.8 + b.ph) * 0.3);
    if (Math.hypot(b.x - B.x, b.z - B.z) < 3) {
      b.gone = 25; b.g.visible = false;
      field.gold += 3; save(); updateHud();
      floatText(b.x, 3, b.z, '+3 gold', '#ffd34a');
      splash(b.x, b.z, 8, 0.3);
    }
  }

  // gulls circle the islands; dolphins leap alongside when you sail fast
  for (const g of gulls) {
    g.a += g.w * dt;
    g.g.position.set(g.cx + Math.cos(g.a) * g.r, g.y + Math.sin(t * 0.7 + g.a) * 1.5, g.cz + Math.sin(g.a) * g.r);
    g.g.rotation.set(0, Math.atan2(-Math.sin(g.a) * g.w, Math.cos(g.a) * g.w), -Math.sign(g.w) * 0.3);
    g.wings.forEach((w, i) => { w.rotation.z = (i ? -1 : 1) * Math.sin(t * 7 + g.a * 3) * 0.45; });
  }
  for (const d of dolphins) {
    d.t += dt;
    if (d.t < 0) continue;
    if (!d.from) {
      if (B.speed < 5) { d.t = -1; continue; }
      const s = Math.random() > 0.5 ? 1 : -1;
      d.from = [B.x + fz * s * 5 + fx * 4, B.z - fx * s * 5 + fz * 4]; d.h = B.h; d.g.visible = true;
      splash(...d.from, 10, 0.4);
    }
    const k = d.t / 1.2, x = d.from[0] + Math.sin(d.h) * 9 * k, z = d.from[1] + Math.cos(d.h) * 9 * k;
    d.g.position.set(x, waveH(x, z, t) + Math.sin(Math.PI * k) * 2.4 - 0.4, z);
    d.g.rotation.set(-Math.cos(Math.PI * k) * 0.9, d.h, 0, 'YXZ');
    if (k >= 1) { splash(x, z, 12, 0.45); d.g.visible = false; d.from = null; d.t = -2 - Math.random() * 5; }
  }

  // island flags flutter
  for (const I of islands) for (const f of I.flags) {
    const p = f.mesh.geometry.attributes.position;
    for (let i = 0; i < p.count; i++) { const x = f.base[i * 3]; p.setZ(i, Math.sin(t * 6 + x * 2.5) * 0.18 * (x / 2.2)); }
    p.needsUpdate = true;
  }

  // camera: chase behind the boat, drifting back behind it unless you are looking around
  if (performance.now() - lastDrag > 1500) camYaw += wrap(B.h + Math.PI - camYaw) * Math.min(1, dt * 1.2);
  camDist = damp(camDist, camDistT, 4, dt);
  camPitch = damp(camPitch, camPitchT, 4, dt);
  fov = damp(fov, 55 + clamp(B.speed - 9, 0, 10) * 0.9, 3, dt);
  camera.fov = fov;
  camera.updateProjectionMatrix();
  const cp = Math.cos(camPitch), ty = y + 2.2;
  const want = Vp.set(B.x + Math.sin(camYaw) * camDist * cp, ty + Math.sin(camPitch) * camDist + 1.5, B.z + Math.cos(camYaw) * camDist * cp);
  want.y = Math.max(want.y, waveH(want.x, want.z, t) + 1.5);
  if (first) { camPos.copy(want); first = false; } else camPos.lerp(want, Math.min(1, dt * 5));
  camera.position.copy(camPos);
  if (shake > 0) { shake -= dt; camera.position.x += (Math.random() - 0.5) * 0.4; camera.position.y += (Math.random() - 0.5) * 0.4; }
  const ahead = 5 * Math.max(0, Math.cos(camPitch));
  lookAt.set(B.x - Math.sin(camYaw) * ahead, ty, B.z - Math.cos(camYaw) * ahead);
  camera.lookAt(lookAt);
  oceanU.uCam.value.copy(camera.position);
  sky.position.copy(camera.position);
  ocean.position.set(Math.round(B.x / 5) * 5, 0, Math.round(B.z / 5) * 5);
  sun.position.set(B.x + SUN_DIR.x * 90, SUN_DIR.y * 90, B.z + SUN_DIR.z * 90);
  sun.target.position.set(B.x, 0, B.z);

  // HUD
  action = leaving ? null : findAction();
  let chip = action ? action.label : null, icon = action ? action.icon : '⚓';
  if (!chip) {
    const I = islands.find((I) => Math.hypot(B.x - I.x, B.z - I.z) < I.r + 30);
    if (I) { chip = I.name; icon = '🏝'; } else if (dc > SEA_R - 20) { chip = 'The edge of the known sea'; icon = '🧭'; }
  }
  $('chip').hidden = !chip;
  if (chip) { $('chipText').textContent = chip; $('chip').querySelector('.dot').textContent = icon; }
  $('actBtn').hidden = !action;
  if (action) $('actText').textContent = action.run === dock ? 'Dock' : 'Loot';
  $('sailText').textContent = gust ? 'Gust!' : SAIL_NAMES[B.level];
  document.querySelectorAll('.gauge .bars i').forEach((el, i) => el.classList.toggle('on', i < B.level));
  $('knots').textContent = `${Math.round(B.speed * 1.4)} knots`;
  $('needle').style.transform = `rotate(${(camYaw * 180) / Math.PI}deg)`;
  for (const I of islands) {
    const d = Math.hypot(B.x - I.x, B.z - I.z), p = d < 170 ? toScreen(I.x, I.kind === 'peak' ? 30 : 16, I.z) : null;
    I.el.hidden = !p;
    if (p) I.el.style.transform = `translate(${p[0]}px, ${p[1]}px) translate(-50%, -100%)`;
  }
  for (let i = floats.length - 1; i >= 0; i--) {
    const f = floats[i];
    f.age += dt / 1.4;
    const p = toScreen(f.x, f.y + f.age * 3, f.z);
    f.el.style.opacity = Math.max(0, 1 - f.age * f.age);
    if (p) f.el.style.transform = `translate(${p[0]}px, ${p[1]}px) translate(-50%, -50%)`;
    if (f.age >= 1) { f.el.remove(); floats.splice(i, 1); }
  }
  drawChart();
}

setTimeout(() => { $('fade').style.opacity = 0; }, 60);
(function frame() {
  const dt = Math.min(clock.getDelta(), 0.05);
  update(dt);
  composer.render();
  requestAnimationFrame(frame);
})();
