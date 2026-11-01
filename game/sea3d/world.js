/* ============================================================================
   Builders for the Taproot Sea (/game/sea3d): tropical, pirate-era islands,
   the player's sloop, pirate galleons, barrels, gulls and dolphins.

   Static scenery is merged into a few meshes per material (put() collects
   coloured geometry, flush() merges it). group(fn) builds into its own Group
   for things that move. Every island gets colliders and a shore circle that
   the ocean shader uses for turquoise shallows and foam.
   ============================================================================ */
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

export const GRAD = (() => {
  const t = new THREE.DataTexture(new Uint8Array([95, 175, 255]), 3, 1, THREE.RedFormat);
  t.minFilter = t.magFilter = THREE.NearestFilter;
  t.needsUpdate = true;
  return t;
})();
export const toon = (o) => new THREE.MeshToonMaterial({ gradientMap: GRAD, ...o });

/* ---------- batch ---------- */
const GEO = {
  box: new THREE.BoxGeometry(1, 1, 1), sph: new THREE.SphereGeometry(1, 16, 12), cyl: new THREE.CylinderGeometry(1, 1, 1, 18),
  cone: new THREE.ConeGeometry(1, 1, 12), pyr: new THREE.ConeGeometry(1, 1, 4), tri: new THREE.ConeGeometry(1, 1, 3),
  dod: new THREE.DodecahedronGeometry(1, 0), tor: new THREE.TorusGeometry(1, 0.12, 6, 28),
};
for (const k in GEO) if (GEO[k].index) GEO[k] = GEO[k].toNonIndexed();
const MATS = {
  toon: toon({ vertexColors: true }), flat: toon({ vertexColors: true, flatShading: true }),
  dbl: toon({ vertexColors: true, side: THREE.DoubleSide }), glow: new THREE.MeshBasicMaterial({ vertexColors: true }),
};
let parts = {};
const BASE = new THREE.Matrix4(), M4 = new THREE.Matrix4(), Q = new THREE.Quaternion(), E = new THREE.Euler(), V = new THREE.Vector3(), SV = new THREE.Vector3();
export const at = (x, z, ry = 0, s = 1, y = 0) => BASE.compose(V.set(x, y, z), Q.setFromEuler(E.set(0, ry, 0)), SV.set(s, s, s));
export function put(kind, geo, color, x, y, z, sx, sy = sx, sz = sx, rx = 0, ry = 0, rz = 0) {
  M4.compose(V.set(x, y, z), Q.setFromEuler(E.set(rx, ry, rz)), SV.set(sx, sy, sz)).premultiply(BASE);
  const g = GEO[geo].clone().applyMatrix4(M4), c = new THREE.Color(color), n = g.attributes.position.count, arr = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { arr[i * 3] = c.r; arr[i * 3 + 1] = c.g; arr[i * 3 + 2] = c.b; }
  g.setAttribute('color', new THREE.BufferAttribute(arr, 3));
  (parts[kind] ||= []).push(g);
}
export function flush(target) {
  for (const [kind, list] of Object.entries(parts)) {
    const m = new THREE.Mesh(mergeGeometries(list), MATS[kind]);
    m.castShadow = kind !== 'glow';
    m.receiveShadow = true;
    target.add(m);
    list.forEach((g) => g.dispose());
  }
  parts = {};
}
export function group(fn) {
  const saved = parts, g = new THREE.Group();
  parts = {};
  at(0, 0);
  fn();
  flush(g);
  parts = saved;
  return g;
}

let seed = 11;
const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);

/* ---------- textures ---------- */
function canvas(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return [c, c.getContext('2d')]; }
function tex(c) { const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t; }

// cream canvas with a red double-curl emblem, like a hand-painted sail
export function sailTexture() {
  const [c, x] = canvas(256, 384);
  x.fillStyle = '#f4ecd6'; x.fillRect(0, 0, 256, 384);
  x.strokeStyle = 'rgba(160, 130, 90, 0.18)'; x.lineWidth = 2;
  for (let i = 1; i < 6; i++) { x.beginPath(); x.moveTo(i * 43, 0); x.lineTo(i * 43, 384); x.stroke(); }
  x.strokeStyle = '#c8302a'; x.lineWidth = 24; x.lineCap = 'round';
  const curl = (cx, cy, dir) => {
    x.beginPath();
    for (let t = 0; t <= Math.PI * 2.6; t += 0.05) {
      const r = 10 + t * 13, a = dir * t + (dir > 0 ? Math.PI : 0);
      const px = cx + Math.cos(a) * r, py = cy + Math.sin(a) * r * 0.9;
      t ? x.lineTo(px, py) : x.moveTo(px, py);
    }
    x.stroke();
  };
  curl(128, 150, 1);
  curl(128, 245, -1);
  return tex(c);
}

// black flag with a skull and crossbones
export function jollyTexture() {
  const [c, x] = canvas(256, 192);
  x.fillStyle = '#151218'; x.fillRect(0, 0, 256, 192);
  x.strokeStyle = '#f2ead8'; x.fillStyle = '#f2ead8'; x.lineWidth = 16; x.lineCap = 'round';
  for (const [a, b, cc, d] of [[66, 46, 190, 160], [190, 46, 66, 160]]) {
    x.beginPath(); x.moveTo(a, b); x.lineTo(cc, d); x.stroke();
    for (const [px, py] of [[a, b], [cc, d]]) for (const o of [-9, 9]) { x.beginPath(); x.arc(px + o * 0.7, py + (o > 0 ? 6 : -6) * Math.sign(cc - a), 10, 0, Math.PI * 2); x.fill(); }
  }
  x.beginPath(); x.arc(128, 86, 44, 0, Math.PI * 2); x.fill();
  x.fillRect(102, 110, 52, 30);
  x.fillStyle = '#151218';
  x.beginPath(); x.arc(110, 84, 12, 0, Math.PI * 2); x.fill();
  x.beginPath(); x.arc(146, 84, 12, 0, Math.PI * 2); x.fill();
  x.beginPath(); x.moveTo(128, 98); x.lineTo(121, 112); x.lineTo(135, 112); x.fill();
  for (let i = 0; i < 4; i++) x.fillRect(108 + i * 11, 126, 4, 14);
  return tex(c);
}

/* ---------- scenery pieces (absolute coords) ---------- */
const SAND = '#f2dca2', WET = '#d6be86', GRASS = '#64b244', ROCK = '#8a7a6a', WOOD = '#9a6a3a', DARKWOOD = '#5a3a22';

function palm(x, z, y0, h, lean, dir) {
  at(x, z, dir, 1, y0);
  const seg = 6;
  for (let i = 0; i < seg; i++) {
    const t = i / seg;
    put('toon', 'cyl', i % 2 ? '#b08458' : '#9a7048', lean * t * t * h * 0.5, t * h + h / seg / 2, 0, 0.2 - 0.012 * i, h / seg + 0.06, 0.2 - 0.012 * i, 0, 0, -lean * t * 0.9);
  }
  const tx = lean * h * 0.5;
  for (let k = 0; k < 8; k++) {
    const a = (k / 8) * Math.PI * 2;
    put('flat', 'tri', k % 2 ? '#3fae3a' : '#2c9032', tx + Math.cos(a) * 1.0, h, Math.sin(a) * 1.0, 0.36, 2.8, 0.09, 0, -a, -1.2);
  }
  for (let k = 0; k < 3; k++) put('toon', 'sph', '#6a4a2a', tx + Math.cos(k * 2.1) * 0.25, h - 0.25, Math.sin(k * 2.1) * 0.25, 0.17);
}
function rock(x, z, s, y = 0.2, c = ROCK) { at(x, z, rnd() * 6); put('flat', 'dod', c, 0, y, 0, s, s * 0.8, s); }
function bush(x, z, y = 0.7) { at(x, z); put('toon', 'sph', '#3f9a36', 0, y, 0, 0.9, 0.7, 0.9); put('toon', 'sph', '#52b044', 0.5, y + 0.2, 0.2, 0.6); }

function beach(I, grass = 0.6, hill = 0) {
  at(I.x, I.z);
  put('toon', 'cyl', WET, 0, -0.4, 0, I.r * 1.05, 1.6, I.r * 1.05);
  for (let k = 0; k < 6; k++) {
    const a = (k / 6) * Math.PI * 2 + rnd(), o = I.r * 0.15, rr = I.r * (0.8 + rnd() * 0.12);
    put('toon', 'cyl', SAND, Math.cos(a) * o, -0.2, Math.sin(a) * o, rr, 1.6, rr);
  }
  if (grass) put('toon', 'cyl', GRASS, 0, 0.75 + hill / 2, 0, I.r * grass, 0.4 + hill, I.r * grass);
  return 0.95 + hill; // height of the grass top
}
function palms(I, n, ring = 0.72, y = 0.6) {
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + rnd() * 0.5, d = I.r * (ring + rnd() * 0.12);
    palm(I.x + Math.cos(a) * d, I.z + Math.sin(a) * d, y, 4.5 + rnd() * 2.5, 0.25 + rnd() * 0.35, -a);
  }
}
function shoreRocks(I, n, s, c = ROCK) {
  for (let i = 0; i < n; i++) {
    const a = rnd() * Math.PI * 2, d = I.r * (0.9 + rnd() * 0.15);
    rock(I.x + Math.cos(a) * d, I.z + Math.sin(a) * d, s * (0.6 + rnd() * 0.6), 0.1, c);
  }
}
function hut(x, z, ry, stilt = false) {
  const b = stilt ? 1.6 : 0.6;
  at(x, z, ry);
  if (stilt) {
    for (const [px, pz] of [[-1.5, -1.5], [1.5, -1.5], [-1.5, 1.5], [1.5, 1.5]]) put('toon', 'cyl', DARKWOOD, px, 0, pz, 0.15, 3.4, 0.15);
    put('toon', 'box', '#b08458', 0, 1.5, 0, 3.6, 0.2, 3.6);
  }
  put('toon', 'box', '#d8b878', 0, b + 0.9, 0, 2.6, 1.8, 2.6);
  for (const [px, pz] of [[-1.3, -1.3], [1.3, -1.3], [-1.3, 1.3], [1.3, 1.3]]) put('toon', 'box', DARKWOOD, px, b + 0.9, pz, 0.14, 1.8, 0.14);
  put('toon', 'box', '#4a3020', 0, b + 0.7, 1.31, 0.8, 1.3, 0.05);
  put('toon', 'box', '#3a5a7a', 0.9, b + 1.1, 1.31, 0.5, 0.45, 0.05);
  put('flat', 'cone', '#d2a85a', 0, b + 2.6, 0, 2.4, 1.7, 2.4);
  put('flat', 'cone', '#b8904a', 0, b + 3.5, 0, 0.5, 0.5, 0.5);
}
function barrelAt(x, z, y) { at(x, z); put('toon', 'cyl', WOOD, 0, y + 0.45, 0, 0.36, 0.9, 0.36); put('toon', 'cyl', '#3a3438', 0, y + 0.2, 0, 0.38, 0.06, 0.38); put('toon', 'cyl', '#3a3438', 0, y + 0.7, 0, 0.38, 0.06, 0.38); }
function crateAt(x, z, y) { at(x, z, rnd()); put('toon', 'box', '#c08a52', 0, y + 0.4, 0, 0.8); put('toon', 'box', DARKWOOD, 0, y + 0.4, 0, 0.82, 0.1, 0.82); }
function lighthouse(x, z, y, h = 10) {
  at(x, z, 0, 1, y);
  const n = 6;
  for (let i = 0; i < n; i++) { const r = 1.6 - i * 0.08; put('toon', 'cyl', i % 2 ? '#d8322e' : '#f6f0e6', 0, (i + 0.5) * (h / n), 0, r, h / n, r); }
  put('toon', 'cyl', '#2a2630', 0, h + 0.1, 0, 1.6, 0.2, 1.6);
  put('glow', 'cyl', '#fff2b0', 0, h + 0.7, 0, 0.8, 1.1, 0.8);
  put('flat', 'cone', '#d8322e', 0, h + 1.7, 0, 1.1, 1.0, 1.1);
}
function flagPole(x, z, y, h, color) {
  at(x, z, 0, 1, y);
  put('toon', 'cyl', '#2a2630', 0, h / 2, 0, 0.08, h, 0.08);
  put('dbl', 'box', color, 0.75, h - 0.5, 0, 1.4, 0.9, 0.04);
}
function cannon(x, z, y, dir) {
  at(x, z, dir, 1, y);
  put('toon', 'box', DARKWOOD, 0, 0.25, 0, 0.9, 0.4, 1.2);
  put('toon', 'cyl', '#2a2a30', 0, 0.6, 0.5, 0.22, 1.7, 0.22, Math.PI / 2 - 0.12, 0, 0);
  for (const s of [-1, 1]) put('toon', 'cyl', '#3a2a1a', s * 0.5, 0.25, 0, 0.3, 0.12, 0.3, 0, 0, Math.PI / 2);
}

/* ---------- island kinds ---------- */
const KIND = {
  harbor(I) {
    const top = beach(I, 0.62, 1.4);
    palms(I, 6);
    shoreRocks(I, 8, 1.6);
    hut(I.x - 6, I.z - 4, 0.3);
    hut(I.x + 7, I.z - 6, -0.4);
    lighthouse(I.x - 11, I.z + 7, top - 0.2, 9);
    flagPole(I.x + 3, I.z + 2, top - 0.2, 6, '#3f9a3a');
    // pier out to the south, where you board and dock
    const z0 = I.z + I.r * 0.7, z1 = I.z + I.r + 12;
    at(0, 0);
    put('toon', 'box', '#c8925e', I.x, 1.0, (z0 + z1) / 2, 3.2, 0.25, z1 - z0);
    for (let z = z0; z <= z1; z += 2.5) for (const s of [-1, 1]) put('toon', 'cyl', DARKWOOD, I.x + s * 1.5, -0.4, z, 0.16, 3, 0.16);
    for (let z = z0 + 1; z < z1; z += 1) put('toon', 'box', '#b07a48', I.x, 1.14, z, 3.2, 0.03, 0.06);
    barrelAt(I.x - 1, z1 - 2, 1.12); crateAt(I.x + 1, z1 - 4, 1.12); barrelAt(I.x - 1.1, z1 - 3, 1.12);
    at(I.x, z1 + 1.5);
    put('glow', 'tor', '#ffd84a', 0, 0.35, 0, 2.6, 2.6, 3, Math.PI / 2, 0, 0);
    I.dock = { x: I.x, z: z1 + 2 };
    for (let z = z0 + 2; z <= z1; z += 3) I.colliders.push([I.x, z, 2]);
  },
  fort(I, jolly) {
    const top = beach(I, 0.72, 2.5);
    shoreRocks(I, 16, 3.2, '#8a8478');
    palms(I, 5, 0.85);
    const S = 9, y = top, wall = '#a8a294';
    at(I.x, I.z);
    for (const [dx, dz, w, d] of [[0, -S, 2 * S, 1.2], [0, S, 2 * S, 1.2], [-S, 0, 1.2, 2 * S], [S, 0, 1.2, 2 * S]]) {
      put('toon', 'box', wall, dx, y + 1.6, dz, w, 3.2, d);
      const n = 9;
      for (let i = 0; i < n; i++) {
        const t = (i + 0.5) / n - 0.5;
        put('toon', 'box', '#9a948a', dx + (w > d ? t * w : 0), y + 3.55, dz + (w > d ? 0 : t * d), 1.0, 0.7, 1.3);
      }
    }
    put('toon', 'box', '#3a2a22', 0, y + 1.1, S + 0.62, 2.4, 2.2, 0.1);
    for (const [cx, cz] of [[-S, -S], [S, -S], [-S, S], [S, S]]) {
      put('toon', 'cyl', '#9a948a', cx, y + 2.6, cz, 2.2, 5.2, 2.2);
      for (let k = 0; k < 6; k++) { const a = (k / 6) * Math.PI * 2; put('toon', 'box', '#8a847a', cx + Math.cos(a) * 1.9, y + 5.5, cz + Math.sin(a) * 1.9, 0.8, 0.7, 0.8); }
    }
    for (const [dx, dz, dir] of [[-4, -S, Math.PI], [4, -S, Math.PI], [-4, S, 0], [4, S, 0], [-S, -4, -Math.PI / 2], [-S, 4, -Math.PI / 2], [S, -4, Math.PI / 2], [S, 4, Math.PI / 2]]) cannon(I.x + dx, I.z + dz, y + 3.2, dir);
    I.flags.push({ x: I.x + S, z: I.z - S, y: y + 5.9, h: 4.5, tex: jolly });
    I.flags.push({ x: I.x - S, z: I.z + S, y: y + 5.9, h: 4.5, tex: jolly });
  },
  skull(I) {
    beach(I, 0, 0);
    shoreRocks(I, 10, 2.4, '#7a7470');
    at(I.x, I.z, 0.6);
    put('toon', 'sph', '#cfc6b4', 0, 6.5, 0, 9, 8, 8);
    put('toon', 'box', '#bdb4a2', 0, 2.0, 1.5, 10, 3.6, 7.5);
    for (const s of [-1, 1]) put('toon', 'sph', '#221a20', s * 3.3, 6.6, 6.9, 2.3, 2.6, 1.6);
    put('toon', 'tri', '#221a20', 0, 4.5, 7.7, 1.0, 1.6, 0.6, 0, 0, Math.PI);
    for (let i = 0; i < 6; i++) put('toon', 'box', '#efe6d2', -3.2 + i * 1.28, 3.0, 5.3, 0.9, 1.3, 0.6);
    put('toon', 'box', '#221a20', 0, 1.6, 5.3, 7.5, 1.2, 0.5);
  },
  arch(I) {
    I.colliders = [[I.x - 9, I.z, 4], [I.x + 9, I.z, 4]];
    I.shores = [[I.x - 9, I.z, 4.5], [I.x + 9, I.z, 4.5]];
    for (const s of [-1, 1]) {
      at(I.x + s * 9, I.z);
      put('toon', 'cyl', SAND, 0, -0.3, 0, 4.6, 1.6, 4.6);
      palm(I.x + s * 11.5, I.z + 2.5, 0.5, 4.5, 0.4, s > 0 ? 0 : Math.PI);
    }
    at(I.x, I.z);
    for (let i = 0; i <= 14; i++) {
      const a = (Math.PI * i) / 14, r = 2.4 + Math.sin(a * 3) * 0.3;
      put('flat', 'dod', i % 2 ? '#8a7a68' : '#7a6c5c', Math.cos(a) * 9, Math.sin(a) * 9 + 1.5, (rnd() - 0.5) * 0.8, r, r, r * 1.1, rnd(), rnd(), rnd());
    }
    for (let i = 4; i <= 10; i++) { const a = (Math.PI * i) / 14; put('toon', 'sph', '#5aa83a', Math.cos(a) * 9, Math.sin(a) * 9 + 3.6, 0, 1.6, 0.8, 1.8); }
  },
  wreck(I) {
    beach(I, 0, 0);
    shoreRocks(I, 8, 1.4);
    at(I.x + 3, I.z - 3, 0.7, 1, -0.4);
    put('toon', 'box', '#5a3420', 0, 0.8, 0, 3.6, 2.6, 11, 0.12, 0, 0.42);
    put('toon', 'box', '#7a4a2a', 0, 2.0, 0, 3.4, 0.15, 10, 0.12, 0, 0.42);
    for (let i = 0; i < 5; i++) put('toon', 'box', DARKWOOD, 0.4, 2.6, -4 + i * 2, 0.2, 1.8, 0.2, 0, 0, 0.42 + 0.3);
    put('toon', 'cyl', DARKWOOD, -1.2, 4.0, 1, 0.2, 6, 0.2, 0.3, 0, 0.9);
    put('dbl', 'box', '#d8ccb0', -2.4, 4.4, 1.2, 0.05, 2.4, 2.2, 0.3, 0, 0.9);
    barrelAt(I.x - 4, I.z + 3, 0.5); barrelAt(I.x - 5.2, I.z + 1.5, 0.4); crateAt(I.x - 3, I.z + 5, 0.4);
  },
  village(I) {
    const top = beach(I, 0.55, 0.6);
    palms(I, 9);
    hut(I.x - 5, I.z - 3, 0.5); hut(I.x + 4, I.z - 6, -0.3); hut(I.x + 2, I.z + 4, 2.4);
    for (let i = 0; i < 4; i++) {
      const a = 0.6 + i * 0.55, hx = I.x + Math.cos(a) * I.r * 1.18, hz = I.z + Math.sin(a) * I.r * 1.18;
      hut(hx, hz, -a + Math.PI / 2, true);
      I.colliders.push([hx, hz, 3]);
      const bx = I.x + Math.cos(a) * I.r * 0.98, bz = I.z + Math.sin(a) * I.r * 0.98;
      at(bx, bz, -a + Math.PI / 2);
      put('toon', 'box', '#b08458', 0, 1.5, 0, 1.4, 0.15, I.r * 0.3);
    }
    at(I.x, I.z);
    for (let k = 0; k < 4; k++) put('toon', 'cyl', DARKWOOD, Math.cos(k) * 0.3, top + 0.15, Math.sin(k) * 0.3, 0.12, 1.2, 0.12, Math.PI / 2, k, 0);
    put('glow', 'cone', '#ff8a2a', 0, top + 0.7, 0, 0.5, 1.2, 0.5);
    put('glow', 'cone', '#ffe08a', 0, top + 0.55, 0, 0.28, 0.7, 0.28);
    for (const [cx, cz, ry] of [[I.r * 1.02, 4, 0.3], [-I.r * 0.4, I.r * 0.98, 1.4]]) {
      at(I.x + cx, I.z + cz, ry);
      put('toon', 'box', '#7a4a28', 0, 0.35, 0, 0.8, 0.35, 3.4);
    }
  },
  sandbar(I) {
    beach(I, 0, 0);
    palm(I.x - I.r * 0.3, I.z, 0.6, 5, 0.5, rnd() * 6);
    if (rnd() > 0.4) palm(I.x + I.r * 0.2, I.z - I.r * 0.3, 0.6, 4, 0.3, rnd() * 6);
    shoreRocks(I, 3, 1.0);
    at(I.x + 1, I.z + 1.5);
    put('toon', 'box', '#b8322e', 0, 0.62, 0, 1.6, 0.04, 0.3, 0, 0.78, 0);
    put('toon', 'box', '#b8322e', 0, 0.62, 0, 1.6, 0.04, 0.3, 0, -0.78, 0);
  },
  peak(I) {
    const top = beach(I, 0.78, 1);
    at(I.x, I.z);
    put('flat', 'cone', '#4f9a3a', 0, top + 9, 0, I.r * 0.62, 18, I.r * 0.62);
    put('flat', 'cone', '#5aa844', 9, top + 5, 6, I.r * 0.35, 10, I.r * 0.35);
    put('flat', 'cone', '#8a7a68', 0, top + 15.5, 0, I.r * 0.2, 5, I.r * 0.2);
    put('toon', 'box', '#cff4ff', -3, top + 5, I.r * 0.42, 1.6, 10, 0.4, -0.45, 0, 0);
    put('toon', 'sph', '#ffffff', -3, top + 0.2, I.r * 0.62, 2.2, 0.5, 1.6);
    for (let i = 0; i < 14; i++) { const a = rnd() * Math.PI * 2, d = I.r * (0.45 + rnd() * 0.2); bush(I.x + Math.cos(a) * d, I.z + Math.sin(a) * d, top); }
    palms(I, 8, 0.8);
    shoreRocks(I, 10, 2.2);
  },
  lighthouse(I) {
    const top = beach(I, 0.55, 2);
    shoreRocks(I, 12, 2.4, '#8a8478');
    lighthouse(I.x, I.z, top - 0.2, 12);
    hut(I.x + 4, I.z + 3, -0.6);
  },
};

// The archipelago: harbour near the start, the rest spread around it.
export const ISLANDS = [
  { id: 'harbor', name: 'Taproot Docks', kind: 'harbor', x: 0, z: -40, r: 24 },
  { id: 'fort', name: 'Fort Cutlass', kind: 'fort', x: 170, z: -150, r: 28 },
  { id: 'skull', name: 'Skull Rock', kind: 'skull', x: -180, z: -120, r: 18 },
  { id: 'arch', name: 'The Old Arch', kind: 'arch', x: -90, z: 110, r: 12 },
  { id: 'wreck', name: 'Wreck Reef', kind: 'wreck', x: 120, z: 130, r: 14, treasure: 40 },
  { id: 'village', name: 'Palmhaven', kind: 'village', x: -250, z: 60, r: 26 },
  { id: 'lonely', name: 'Lonely Key', kind: 'sandbar', x: 55, z: 45, r: 8, treasure: 25 },
  { id: 'gull', name: 'Gull Cay', kind: 'sandbar', x: -70, z: -210, r: 9, treasure: 25 },
  { id: 'verde', name: 'Mount Verde', kind: 'peak', x: 270, z: 70, r: 32 },
  { id: 'doubloon', name: 'Doubloon Spit', kind: 'sandbar', x: 230, z: -290, r: 8, treasure: 30 },
  { id: 'beacon', name: 'Beacon Isle', kind: 'lighthouse', x: 40, z: -240, r: 12 },
];

export function buildIslands(scene, looted) {
  const jolly = jollyTexture();
  for (const I of ISLANDS) {
    I.colliders = [[I.x, I.z, I.r]];
    I.shores = [[I.x, I.z, I.r]];
    I.flags = [];
    KIND[I.kind](I, jolly);
    if (I.treasure && !looted.includes(I.id)) {
      const g = group(() => {
        put('toon', 'box', '#8a4a2c', 0, 0.3, 0, 1.1, 0.6, 0.75);
        put('toon', 'box', '#e0b048', 0, 0.66, 0, 1.16, 0.14, 0.8);
        put('toon', 'box', '#e0b048', 0, 0.3, 0, 0.14, 0.64, 0.8);
        put('glow', 'box', '#ffe56a', 0, 0.45, 0.39, 0.18, 0.2, 0.04);
      });
      g.position.set(I.x + I.r * 0.35, 0.6, I.z + I.r * 0.25);
      g.rotation.y = rnd() * 6;
      scene.add(g);
      I.chest = g;
    }
  }
  flush(scene);
  // flags are separate meshes so they can flutter
  for (const I of ISLANDS) for (const f of I.flags) {
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, f.h, 8), toon({ color: '#2a2630' }));
    pole.position.set(f.x, f.y + f.h / 2, f.z);
    const geo = new THREE.PlaneGeometry(2.2, 1.5, 8, 4).translate(1.1, 0, 0);
    const flag = new THREE.Mesh(geo, toon({ map: f.tex, side: THREE.DoubleSide }));
    flag.position.set(f.x, f.y + f.h - 0.8, f.z);
    f.mesh = flag; f.base = geo.attributes.position.array.slice();
    scene.add(pole, flag);
  }
  return ISLANDS;
}

/* ---------- vessels and wildlife ---------- */
// The player's sloop: bow at +z. Returns the hull group and the sail (for billowing).
export function buildPlayerBoat() {
  const g = group(() => {
    const hull = '#9a3e26';
    put('toon', 'box', hull, 0, 0.2, -0.3, 2.1, 1.0, 4.6);
    put('toon', 'pyr', hull, 0, 0.2, 2.6, 1.48, 1.4, 0.72, Math.PI / 2, Math.PI / 4, 0);
    put('toon', 'box', '#f2e6d0', 0, 0.55, -0.3, 2.14, 0.2, 4.4);
    put('toon', 'box', '#d8a868', 0, 0.72, -0.3, 1.9, 0.06, 4.4);
    for (const s of [-1, 1]) put('toon', 'box', '#6a3420', s * 1.0, 0.86, -0.3, 0.1, 0.26, 4.4);
    put('toon', 'box', hull, 0, 0.98, -2.3, 2.0, 0.6, 1.0);
    put('glow', 'box', '#ffd84a', 0, 1.0, -2.82, 0.6, 0.25, 0.04);
    put('toon', 'box', '#6a3420', 0, 0.1, -2.9, 0.12, 1.2, 0.6);
    // lion figurehead
    put('toon', 'cyl', '#e6cfa0', 0, 1.0, 3.15, 0.2, 1.0, 0.2, -0.7, 0, 0);
    put('toon', 'sph', '#f0dcb0', 0, 1.5, 3.5, 0.36);
    for (let k = 0; k < 9; k++) { const a = (k / 9) * Math.PI * 2; put('toon', 'cone', '#e8b830', Math.cos(a) * 0.36, 1.5 + Math.sin(a) * 0.36, 3.38, 0.12, 0.42, 0.12, Math.sin(a) * 1.3, 0, -Math.cos(a) * 1.3); }
    put('toon', 'sph', '#c8302a', 0, 1.38, 3.82, 0.12, 0.08, 0.08);
    for (const s of [-1, 1]) put('toon', 'sph', '#1a1420', s * 0.13, 1.6, 3.8, 0.05);
    // mast
    put('toon', 'cyl', '#2f8a5a', 0, 3.4, 0.9, 0.1, 5.6, 0.1);
    put('toon', 'cyl', '#e8e0d0', 0, 6.0, 0.9, 0.18, 0.08, 0.18);
  });
  const sailPivot = new THREE.Group();
  sailPivot.position.set(0, 1.35, 0.9);
  const sailGeo = new THREE.PlaneGeometry(2.8, 4.2, 10, 14).translate(1.4, 2.1, 0).rotateY(Math.PI / 2);
  const sail = new THREE.Mesh(sailGeo, toon({ map: sailTexture(), side: THREE.DoubleSide }));
  sail.castShadow = true;
  const boom = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 2.9, 8).rotateX(Math.PI / 2).translate(0, 0, -1.45), toon({ color: '#2f8a5a' }));
  sailPivot.add(sail, boom);
  g.add(sailPivot);
  return { g, sailPivot, sailGeo, base: sailGeo.attributes.position.array.slice() };
}

export function buildGalleon(jolly) {
  const g = group(() => {
    const hull = '#5a3420';
    put('toon', 'box', hull, 0, 0.5, 0, 4.2, 2.2, 13);
    put('toon', 'pyr', hull, 0, 0.5, 7.3, 2.97, 3, 1.55, Math.PI / 2, Math.PI / 4, 0);
    put('toon', 'box', '#e0b048', 0, 1.3, 0, 4.28, 0.18, 12.6);
    put('toon', 'box', '#8a5a32', 0, 1.62, 0, 3.9, 0.08, 12.4);
    put('toon', 'box', hull, 0, 2.4, -5.2, 4.2, 1.8, 3.2);
    put('glow', 'box', '#ffd84a', 0, 2.5, -6.82, 2.2, 0.5, 0.05);
    for (const s of [-1, 1]) for (let i = 0; i < 5; i++) put('toon', 'box', '#1a1418', s * 2.12, 0.7, -3.6 + i * 1.8, 0.06, 0.45, 0.5);
    put('toon', 'cyl', DARKWOOD, 0, 2.3, 8.6, 0.12, 4.5, 0.12, -1.1, 0, 0);
    for (const z of [-2.6, 1.0, 4.4]) put('toon', 'cyl', DARKWOOD, 0, 6.5, z, 0.16, 10, 0.16);
  });
  const mat = toon({ map: jolly, side: THREE.DoubleSide });
  for (const [z, w, h] of [[-2.6, 4.6, 3.6], [1.0, 5.4, 4.6], [4.4, 4.2, 3.4]]) {
    const sail = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
    sail.position.set(0, 7, z);
    sail.castShadow = true;
    g.add(sail);
  }
  const flag = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 1.1).translate(0.8, 0, 0), mat);
  flag.position.set(0, 11.2, 1.0);
  flag.rotation.y = Math.PI / 2;
  g.add(flag);
  return g;
}

export function buildBarrel() {
  return group(() => {
    put('toon', 'cyl', WOOD, 0, 0, 0, 0.42, 1.0, 0.42, Math.PI / 2, 0, 0.2);
    put('toon', 'cyl', '#3a3438', 0, 0, 0.28, 0.44, 0.07, 0.44, Math.PI / 2, 0, 0);
    put('toon', 'cyl', '#3a3438', 0, 0, -0.28, 0.44, 0.07, 0.44, Math.PI / 2, 0, 0);
  });
}

export function buildGull() {
  const g = new THREE.Group(), white = toon({ color: '#ffffff' }), grey = toon({ color: '#9aa4b0' });
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.22, 10, 8), white);
  body.scale.set(1, 0.8, 2.2);
  g.add(body);
  const wings = [-1, 1].map((s) => {
    const p = new THREE.Group();
    const w = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.04, 0.4).translate(s * 0.6, 0, 0), white);
    const tip = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.05, 0.3).translate(s * 1.3, 0, 0), grey);
    p.add(w, tip);
    g.add(p);
    return p;
  });
  return { g, wings };
}

export function buildDolphin() {
  return group(() => {
    put('toon', 'sph', '#6a8aa8', 0, 0, 0, 0.45, 0.42, 1.3);
    put('toon', 'sph', '#dfe8f0', 0, -0.18, 0.1, 0.32, 0.25, 1.0);
    put('toon', 'cone', '#6a8aa8', 0, 0.45, -0.1, 0.12, 0.5, 0.25, -0.4, 0, 0);
    put('toon', 'cone', '#6a8aa8', 0, 0, 1.4, 0.14, 0.5, 0.14, Math.PI / 2, 0, 0);
    put('flat', 'tri', '#5a7a98', 0, 0, -1.45, 0.5, 0.5, 0.1, -Math.PI / 2, 0, Math.PI / 2);
  });
}
