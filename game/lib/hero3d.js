/* ============================================================================
   hero3d.js: the Taproot character as a real-time 3D chibi hero.

   Built from the same saved look the 2D sprite uses ({ skin, hc, hs, equipment })
   with sprite.js's palettes, so the 3D hero matches the Phaser one piece for piece.

     import { makeHero3D } from '/game/lib/hero3d.js';
     const hero = makeHero3D(look);   scene.add(hero.root);
     each frame: hero.root.position / rotation.y = where it is, then
                 hero.update(dt, { atk: -1 | 0..1, lookAt: Vector3 | null, air: bool, vy: vertical speed });
     hero.hurt();  hero.emote('happy', 0.8);

   What makes it tick:
   - Rig: root > body (bank, squash) > hips > legs / spine > arms / neck > head.
     Proportions follow the sprite: big head, short limbs.
   - Look: toon ramp + fresnel rim light on every material, inverted-hull ink
     outlines that keep a steady width with distance, and an anime face painted
     on a canvas shell over the skull (eyes, lashes, brows, blush) that blinks
     and changes expression (attack, hurt, happy).
   - Motion: everything is procedural. Speed is measured from how the root
     moves, so walk / run / idle blend by themselves; stride, bob, hip twist,
     arm swing, lean and banking follow speed, acceleration and turn rate.
     Hair, plumes, tabards, skirts, coat tails and scarves hang on damped
     springs driven by the same motion. Attacks are keyframed per weapon type
     and leave an additive ribbon trail; running kicks up dust; pets follow.
   ============================================================================ */
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const SKINS = (globalThis.SPRITE && globalThis.SPRITE.SKINS) || ['#f6d3b3', '#e8b48a', '#c98c5a', '#9a6238', '#6b4428'];
const HAIRS = (globalThis.SPRITE && globalThis.SPRITE.HAIRS) || ['#2a2630', '#6b3f1d', '#e0b85c', '#b4432e', '#dcd8d0', '#3f5ba0'];
const IRIS = ['#6a4ad8', '#9a6a3a', '#3a8ad8', '#3a9a6a', '#5a6ae8', '#3ab0c8']; // eye colour follows hair colour

// Same outfits and footwear colours as sprite.js (leather_vest / phoenix_plate fall back to the tee, as in 2D).
const OUTFITS = {
  bare:         { shirt: '#d23c34', sleeves: 'short', pants: '#34509e', boots: '#3b3640', extra: 'tee' },
  steel_armor:  { shirt: '#a3acb9', sleeve: '#7d8696', sleeves: 'long', gloves: '#8f98a6', pants: '#6a7280', boots: '#7f8896', belt: '#5a4632', buckle: '#e0b450', extra: 'knight', metal: true },
  mage_robe:    { shirt: '#5b3f9a', sleeves: 'wide', boots: '#2e2244', belt: '#d9b04f', robe: true, extra: 'robe' },
  ranger_tunic: { shirt: '#4f8a3c', sleeves: 'long', bracer: '#7a5230', pants: '#7a5a3a', boots: '#4a3020', bootTop: true, belt: '#6b4a2e', buckle: '#e0b450', extra: 'ranger' },
  rogue_tunic:  { shirt: '#3c3c4a', sleeves: 'long', bracer: '#26232e', pants: '#2c2c38', boots: '#1f1d26', bootTop: true, belt: '#2a2430', buckle: '#9aa3b0', extra: 'rogue' },
  chainmail:    { shirt: '#9aa3b0', sleeve: '#8a93a2', sleeves: 'long', gloves: '#8a93a2', pants: '#5a6270', boots: '#4a4450', belt: '#5a4632', buckle: '#c8ccd4', extra: 'chain' },
  pirate_coat:  { shirt: '#b02a2c', sleeves: 'long', pants: '#2a2a34', boots: '#1f1d26', bootTop: true, belt: '#1a1620', buckle: '#e0b450', extra: 'coat' },
};
const FEET = { leather_boots: '#6b4226', swift_sandals: '#b07a46', iron_greaves: '#8f98a6', dragons_stride: '#7a1a24', sea_boots: '#26232e', shadow_treads: '#3a1a5a', winged_boots: '#e8e0d0' };
const CAPPED = (eq) => !!eq.head && eq.head !== 'gold_crown';

const col = (c) => new THREE.Color(c);
const mixc = (a, b, t) => '#' + col(a).lerp(col(b), t).getHexString();
const dark = (c) => mixc(c, '#2a1840', 0.38);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;
const damp = (a, b, k, dt) => a + (b - a) * (1 - Math.exp(-k * dt));
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
const easeOut = (t) => 1 - Math.pow(1 - clamp(t, 0, 1), 3);
const easeInOut = (t) => { t = clamp(t, 0, 1); return t * t * (3 - 2 * t); };

/* ---------- shading: toon ramp + rim light, and ink outlines ---------- */
const GRAD = (() => {
  const t = new THREE.DataTexture(new Uint8Array([72, 140, 205, 255]), 4, 1, THREE.RedFormat);
  t.minFilter = t.magFilter = THREE.NearestFilter;
  t.needsUpdate = true;
  return t;
})();
const RIM = { uRimColor: { value: col('#ffe2ff') }, uRimPower: { value: 2.3 }, uRimStrength: { value: 0.55 } };
function rimify(m) {
  m.onBeforeCompile = (s) => {
    Object.assign(s.uniforms, RIM);
    s.fragmentShader = 'uniform vec3 uRimColor;\nuniform float uRimPower;\nuniform float uRimStrength;\n' + s.fragmentShader.replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
      float rimF = pow(1.0 - clamp(dot(normal, normalize(vViewPosition)), 0.0, 1.0), uRimPower);
      totalEmissiveRadiance += mix(diffuseColor.rgb, uRimColor, 0.45) * rimF * uRimStrength;`);
  };
  m.customProgramCacheKey = () => 'hero-rim';
  return m;
}
const MATS = new Map();
function toon(color, o = {}) {
  const key = [color, o.emissive, o.ei, o.side, o.flat, o.opacity].join('|');
  if (!o.map && MATS.has(key)) return MATS.get(key);
  const m = rimify(new THREE.MeshToonMaterial({
    color, gradientMap: GRAD, map: o.map || null, emissive: o.emissive || '#000000', emissiveIntensity: o.ei ?? 1,
    side: o.side ?? THREE.FrontSide, flatShading: !!o.flat, transparent: o.opacity !== undefined, opacity: o.opacity ?? 1,
  }));
  if (!o.map) MATS.set(key, m);
  return m;
}
const glow = (c, i = 1.5) => toon(c, { emissive: c, ei: i });

// Back faces pushed out along the normal in view space; width grows a little with distance so it reads at any zoom.
const OUTLINE_W = { value: 0.0085 };
const OUTLINE = new THREE.MeshBasicMaterial({ color: '#170a22', side: THREE.BackSide });
OUTLINE.onBeforeCompile = (s) => {
  s.uniforms.uOut = OUTLINE_W;
  s.vertexShader = 'uniform float uOut;\n' + s.vertexShader.replace('#include <project_vertex>', `
    vec4 mvPosition = modelViewMatrix * vec4(transformed, 1.0);
    vec3 on = normalMatrix * normal;
    mvPosition.xyz += on * inversesqrt(max(dot(on, on), 1e-8)) * uOut * clamp(-mvPosition.z * 0.2, 0.7, 2.6);
    gl_Position = projectionMatrix * mvPosition;`);
};

/* ---------- geometry ---------- */
const G = {
  sph: new THREE.SphereGeometry(1, 32, 24), sphLo: new THREE.SphereGeometry(1, 14, 10),
  dome: new THREE.SphereGeometry(1, 28, 12, 0, Math.PI * 2, 0, Math.PI / 2),
  cyl: new THREE.CylinderGeometry(1, 1, 1, 24), tube: new THREE.CylinderGeometry(1, 1, 1, 24, 1, true),
  cone: new THREE.ConeGeometry(1, 1, 16),
};
const capsule = (r, len) => new THREE.CapsuleGeometry(r, len, 8, 18);
const rbox = (w, h, d, r) => new RoundedBoxGeometry(w, h, d, 3, Math.min(r, w / 2, h / 2, d / 2) * 0.98);
const lathe = (pts, seg = 32) => new THREE.LatheGeometry(pts.map(([r, y]) => new THREE.Vector2(r, y)), seg);

// A tapered tube along a smooth curve: hair strands, horns, plumes, hat tips.
function strand(pts, r0, r1 = 0, seg = 12, rad = 8) {
  const curve = new THREE.CatmullRomCurve3(pts.map((p) => new THREE.Vector3(...p)));
  const fr = curve.computeFrenetFrames(seg, false), pos = [], idx = [];
  for (let i = 0; i <= seg; i++) {
    const t = i / seg, p = curve.getPointAt(t), N = fr.normals[i], B = fr.binormals[i];
    const r = lerp(r0, r1, Math.pow(t, 0.85)) * (1 - 0.12 * Math.sin(t * Math.PI));
    for (let j = 0; j < rad; j++) {
      const a = (j / rad) * Math.PI * 2, c = Math.cos(a) * r, s = Math.sin(a) * r;
      pos.push(p.x + c * N.x + s * B.x, p.y + c * N.y + s * B.y, p.z + c * N.z + s * B.z);
    }
  }
  for (let i = 0; i < seg; i++) for (let j = 0; j < rad; j++) {
    const a = i * rad + j, b = i * rad + ((j + 1) % rad), c = (i + 1) * rad + j, d = (i + 1) * rad + ((j + 1) % rad);
    idx.push(a, b, c, b, d, c);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

const FIXED = new WeakSet();
function fixNormals(geo) {
  const n = geo.attributes.normal;
  if (!n || FIXED.has(geo)) return;
  FIXED.add(geo);
  for (let i = 0; i < n.count; i++) {
    const x = n.getX(i), y = n.getY(i), z = n.getZ(i), l = Math.hypot(x, y, z);
    if (!(l > 1e-6)) n.setXYZ(i, 0, 1, 0);
  }
}

function part(geo, mat, parent, pos = [0, 0, 0], scl = null, rot = null, outline = true) {
  fixNormals(geo);
  const m = new THREE.Mesh(geo, mat);
  m.position.set(...pos);
  if (scl !== null) m.scale.set(...(typeof scl === 'number' ? [scl, scl, scl] : scl));
  if (rot) m.rotation.set(...rot);
  m.castShadow = true;
  if (outline) m.add(new THREE.Mesh(geo, OUTLINE));
  parent.add(m);
  return m;
}
const group = (parent, pos = [0, 0, 0], rot = null) => {
  const g = new THREE.Group();
  g.position.set(...pos);
  if (rot) g.rotation.set(...rot);
  parent.add(g);
  return g;
};

function mailTexture(c) {
  const cv = document.createElement('canvas');
  cv.width = cv.height = 64;
  const x = cv.getContext('2d');
  x.fillStyle = c; x.fillRect(0, 0, 64, 64);
  x.strokeStyle = dark(c); x.lineWidth = 2.5;
  for (let r = 0; r < 4; r++) for (let k = 0; k < 5; k++) { x.beginPath(); x.arc(k * 16 + (r % 2) * 8, r * 16 + 8, 7, 0, Math.PI * 2); x.stroke(); }
  const t = new THREE.CanvasTexture(cv);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(6, 3);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/* ---------- face: painted on a canvas shell over the front of the skull ---------- */
const F_PHI0 = Math.PI / 2 - 0.95, F_PHI = 1.9, F_TH0 = 1.05, F_TH = 1.0;
const EYE_U = [0.335, 0.665], EYE_V = 0.56;
function facePoint(u, v, r) {
  const phi = F_PHI0 + u * F_PHI, th = F_TH0 + v * F_TH;
  return new THREE.Vector3(-r * Math.cos(phi) * Math.sin(th), r * Math.cos(th), r * Math.sin(phi) * Math.sin(th));
}
function paintFace(x, expr, look) {
  const W = 512, H = 256, EY = H * EYE_V, RX = 50, RY = 60, ink = '#1c0c26';
  const hc = HAIRS[look.hc] || HAIRS[0], iris = IRIS[look.hc] || IRIS[0], skin = SKINS[look.skin] || SKINS[1];
  x.clearRect(0, 0, W, H);
  x.lineCap = x.lineJoin = 'round';
  // blush
  x.fillStyle = 'rgba(255, 105, 135, 0.3)';
  EYE_U.forEach((u, i) => { x.beginPath(); x.ellipse(u * W + (i ? 22 : -22), EY + 64, 30, 11, 0, 0, Math.PI * 2); x.fill(); });
  x.strokeStyle = ink;
  EYE_U.forEach((u, i) => {
    const ex = u * W, out = i ? 1 : -1;
    if (expr === 'blink' || expr === 'happy') {
      x.lineWidth = 9;
      x.beginPath();
      if (expr === 'happy') x.arc(ex, EY + 18, RX * 0.8, Math.PI * 1.15, Math.PI * 1.85);
      else x.arc(ex, EY - 22, RX * 0.85, Math.PI * 0.2, Math.PI * 0.8);
      x.stroke();
      return;
    }
    if (expr === 'hurt') {
      x.lineWidth = 10;
      x.beginPath(); x.moveTo(ex - out * 34, EY - 26); x.lineTo(ex + out * 22, EY); x.lineTo(ex - out * 34, EY + 26); x.stroke();
      return;
    }
    const ry = expr === 'attack' ? RY * 0.7 : RY, ey = EY + (RY - ry) * 0.5;
    x.save();
    x.beginPath(); x.ellipse(ex, ey, RX, ry, 0, 0, Math.PI * 2); x.fillStyle = '#ffffff'; x.fill(); x.clip();
    const g = x.createLinearGradient(0, ey - ry, 0, ey + ry);
    g.addColorStop(0, '#160a24'); g.addColorStop(0.45, iris); g.addColorStop(1, mixc(iris, '#ffffff', 0.55));
    x.fillStyle = g; x.beginPath(); x.ellipse(ex, ey + ry * 0.08, RX * 0.8, ry * 0.88, 0, 0, Math.PI * 2); x.fill();
    x.fillStyle = '#0c0614'; x.beginPath(); x.ellipse(ex, ey + ry * 0.12, RX * 0.36, ry * 0.42, 0, 0, Math.PI * 2); x.fill();
    x.fillStyle = 'rgba(255, 255, 255, 0.35)'; x.beginPath(); x.ellipse(ex, ey + ry * 0.55, RX * 0.55, ry * 0.2, 0, 0, Math.PI * 2); x.fill();
    x.fillStyle = '#ffffff';
    x.beginPath(); x.arc(ex - RX * 0.3 * out * -1 - RX * 0.05, ey - ry * 0.3, RX * 0.27, 0, Math.PI * 2); x.fill();
    x.beginPath(); x.arc(ex + RX * 0.28, ey + ry * 0.36, RX * 0.11, 0, Math.PI * 2); x.fill();
    x.restore();
    // upper lash with a flick at the outer corner
    x.lineWidth = 11;
    x.beginPath(); x.ellipse(ex, ey, RX * 1.04, ry * 1.04, 0, Math.PI * 1.06, Math.PI * 1.94); x.stroke();
    x.lineWidth = 7;
    x.beginPath(); x.moveTo(ex + out * RX * 0.95, ey - ry * 0.35); x.lineTo(ex + out * (RX + 16), ey - ry * 0.62); x.stroke();
    x.lineWidth = 4;
    x.beginPath(); x.ellipse(ex, ey, RX * 0.98, ry * 0.98, 0, Math.PI * 0.25, Math.PI * 0.75); x.stroke();
  });
  // brows
  x.strokeStyle = dark(hc); x.lineWidth = 10;
  EYE_U.forEach((u, i) => {
    const ex = u * W, out = i ? 1 : -1, by = EY - RY - 24;
    x.beginPath();
    if (expr === 'attack') { x.moveTo(ex - out * 30, by + 14); x.lineTo(ex + out * 34, by - 6); }
    else if (expr === 'hurt') { x.moveTo(ex - out * 30, by - 6); x.lineTo(ex + out * 34, by + 10); }
    else { x.moveTo(ex - out * 32, by + 4); x.quadraticCurveTo(ex, by - 10, ex + out * 34, by + 6); }
    x.stroke();
  });
  // mouth
  const mx = W / 2, my = H * 0.9;
  x.strokeStyle = mixc(skin, '#5a1a24', 0.75); x.lineWidth = 6;
  if (expr === 'attack' || expr === 'happy') {
    x.fillStyle = '#5a1a2a';
    x.beginPath();
    if (expr === 'happy') { x.moveTo(mx - 20, my - 6); x.quadraticCurveTo(mx, my + 26, mx + 20, my - 6); x.closePath(); }
    else x.ellipse(mx, my, 12, 14, 0, 0, Math.PI * 2);
    x.fill();
    x.fillStyle = '#ff7a8a'; x.beginPath(); x.ellipse(mx, my + 6, 8, 5, 0, 0, Math.PI * 2); x.fill();
  } else if (expr === 'hurt') {
    x.beginPath(); x.moveTo(mx - 18, my); x.quadraticCurveTo(mx - 9, my - 8, mx, my); x.quadraticCurveTo(mx + 9, my + 8, mx + 18, my); x.stroke();
  } else {
    x.beginPath(); x.moveTo(mx - 13, my - 2); x.quadraticCurveTo(mx, my + 9, mx + 13, my - 2); x.stroke();
  }
}

/* ---------- hair (strands merged per spring group) ---------- */
function hairSpec(look, capped) {
  const H = { bangs: [], sides: [], back: [], top: [] };
  if (look.hs === 'bald') return H;
  const tipY = capped ? 0.13 : 0.09;
  for (let i = 0; i < 6; i++) {
    const x = -0.15 + i * 0.06, j = i % 2 ? 0.014 : -0.014;
    H.bangs.push([[[x * 0.6, 0.23, 0.15], [x, 0.21, 0.26], [x * 1.08, 0.17, 0.31], [x * 1.14 + j, tipY, 0.305]], 0.058]);
  }
  for (const s of [-1, 1]) {
    H.sides.push([[[s * 0.2, 0.17, 0.06], [s * 0.285, 0.08, 0.08], [s * 0.3, -0.05, 0.07], [s * 0.28, -0.15, 0.06]], 0.062]);
    H.sides.push([[[s * 0.22, 0.15, -0.05], [s * 0.3, 0.05, -0.06], [s * 0.31, -0.09, -0.07], [s * 0.29, -0.18, -0.09]], 0.068]);
  }
  if (!capped) {
    for (let k = 0; k < 7; k++) {
      const a = -1.35 + k * 0.45, sx = Math.sin(a), cz = -Math.cos(a);
      H.back.push([[[sx * 0.18, 0.17, cz * 0.18], [sx * 0.31, 0.07, cz * 0.31], [sx * 0.345, -0.07, cz * 0.33], [sx * 0.33, -0.2, cz * 0.29]], 0.075]);
    }
    for (let k = 0; k < 6; k++) {
      const a = -1 + k * 0.4, sx = Math.sin(a), up = k % 2 ? 0.035 : 0;
      H.top.push([[[sx * 0.11, 0.25, 0.02 - Math.abs(sx) * 0.05], [sx * 0.19, 0.33 + up, -0.04], [sx * 0.26, 0.4 + up, -0.13]], 0.07]);
    }
    H.top.push([[[0, 0.28, 0.04], [0.02, 0.38, 0.07], [0.07, 0.43, 0.03], [0.05, 0.4, -0.02]], 0.024]); // ahoge
  }
  if (look.hs === 'long') {
    for (let k = 0; k < 6; k++) {
      const a = -1 + k * 0.4, sx = Math.sin(a), cz = -Math.cos(a);
      H.back.push([[[sx * 0.22, 0.12, cz * 0.24], [sx * 0.3, -0.08, cz * 0.3], [sx * 0.28, -0.34, cz * 0.27], [sx * 0.25, -0.58, cz * 0.2]], 0.08]);
    }
    for (const s of [-1, 1]) H.sides.push([[[s * 0.24, 0.1, 0.06], [s * 0.3, -0.1, 0.08], [s * 0.28, -0.3, 0.08], [s * 0.25, -0.46, 0.07]], 0.06]);
  }
  return H;
}

/* ---------- head gear ---------- */
const HEAD_GEAR = {
  iron_helm(hs, M, ctx) {
    const tilt = group(hs, [0, 0, 0], [-0.42, 0, 0]);
    part(new THREE.SphereGeometry(0.315, 32, 16, 0, Math.PI * 2, 0, 1.45), M.helm, tilt);
    part(new THREE.TorusGeometry(0.315 * Math.sin(1.45), 0.022, 10, 40), M.helmDk, tilt, [0, 0.315 * Math.cos(1.45), 0], null, [Math.PI / 2, 0, 0]);
    part(rbox(0.032, 0.09, 0.03, 0.012), M.helmDk, hs, [0, 0.13, 0.3], null, [-0.35, 0, 0]);
    for (const s of [-1, 1]) {
      part(rbox(0.07, 0.15, 0.035, 0.015), M.helm, hs, [s * 0.27, -0.02, 0.1], null, [0, s * 0.75, 0]);
      part(G.sphLo, M.gold, hs, [s * 0.15, 0.17, 0.26], 0.016, null, false);
    }
    const plume = group(hs, [0, 0.3, 0.02]);
    ctx.springs.push({ obj: plume, k: 50, c: 5, gain: 1.4 });
    part(mergeGeometries([0, 1, 2].map((i) => strand([[0, 0, 0.06 - i * 0.05], [0, 0.11 - i * 0.02, -0.05 - i * 0.04], [0, 0.06 - i * 0.03, -0.24 - i * 0.03], [0, -0.06 - i * 0.03, -0.34]], 0.05 - i * 0.008, 0.008))), toon('#c23b3b'), plume);
  },
  horned_helm(hs, M) {
    const tilt = group(hs, [0, 0, 0], [-0.42, 0, 0]);
    part(new THREE.SphereGeometry(0.315, 32, 16, 0, Math.PI * 2, 0, 1.45), M.helmDk, tilt);
    part(new THREE.TorusGeometry(0.315 * Math.sin(1.45), 0.026, 10, 40), M.gold, tilt, [0, 0.315 * Math.cos(1.45), 0], null, [Math.PI / 2, 0, 0]);
    for (const s of [-1, 1]) part(strand([[s * 0.24, 0.12, 0], [s * 0.38, 0.22, 0], [s * 0.46, 0.4, -0.03], [s * 0.41, 0.55, -0.07]], 0.06, 0.004), toon('#efe6d0'), hs);
  },
  wizard_hat(hs, M, ctx) {
    part(new THREE.CylinderGeometry(0.44, 0.46, 0.025, 40), toon('#4e3588'), hs, [0, 0.2, 0], null, [-0.12, 0, 0]);
    const tip = group(hs, [0, 0.2, 0]);
    ctx.springs.push({ obj: tip, k: 40, c: 4, gain: 0.6 });
    part(strand([[0, 0, 0], [0, 0.24, -0.02], [0.02, 0.42, -0.1], [0.11, 0.5, -0.25]], 0.25, 0.02, 16, 18), toon('#5b3f9a'), tip);
    part(G.tube, M.gold, hs, [0, 0.245, -0.005], [0.238, 0.06, 0.238], null, false);
    const star = new THREE.Shape();
    for (let i = 0; i < 10; i++) { const a = (i / 10) * Math.PI * 2 - Math.PI / 2, r = i % 2 ? 0.022 : 0.05; i ? star.lineTo(Math.cos(a) * r, -Math.sin(a) * r) : star.moveTo(Math.cos(a) * r, -Math.sin(a) * r); }
    part(new THREE.ExtrudeGeometry(star, { depth: 0.012, bevelEnabled: false }), glow('#ffe680', 0.9), hs, [0, 0.36, 0.19], null, [-0.3, 0, 0]);
  },
  ranger_hood(hs, M, ctx) { HEAD_GEAR.hood(hs, M, ctx, '#4f8a3c', '#24381d', false); },
  rogue_hood(hs, M, ctx) { HEAD_GEAR.hood(hs, M, ctx, '#3c3c4a', '#1c1a24', true); },
  hood(hs, M, ctx, c, inner, mask) {
    const tilt = group(hs, [0, 0.01, -0.01], [-0.78, 0, 0]);
    part(new THREE.SphereGeometry(0.34, 32, 18, 0, Math.PI * 2, 0, 2.25), toon(c, { side: THREE.DoubleSide }), tilt);
    part(new THREE.TorusGeometry(0.34 * Math.sin(2.25), 0.03, 8, 36), toon(inner), tilt, [0, 0.34 * Math.cos(2.25), 0], null, [Math.PI / 2, 0, 0]);
    part(lathe([[0.1, 0.3], [0.2, 0.22], [0.25, 0.12], [0.26, 0.1]]), toon(c, { side: THREE.DoubleSide }), ctx.spine, [0, 0, 0], [1, 1, 0.85]);
    if (mask) part(rbox(0.3, 0.1, 0.1, 0.04), toon('#26252f'), hs, [0, -0.12, 0.215]);
  },
  chain_coif(hs, M, ctx) {
    const tilt = group(hs, [0, 0.01, -0.01], [-0.8, 0, 0]), mail = toon('#ffffff', { map: mailTexture('#9aa3b0'), side: THREE.DoubleSide });
    part(new THREE.SphereGeometry(0.335, 32, 18, 0, Math.PI * 2, 0, 2.3), mail, tilt);
    part(lathe([[0.1, 0.3], [0.2, 0.22], [0.24, 0.13], [0.25, 0.11]]), mail, ctx.spine, [0, 0, 0], [1, 1, 0.85]);
  },
  gold_crown(hs) { HEAD_GEAR.crown(hs, '#e0b450', 0.27, ['#e0302a', '#3a7bd5']); },
  dragon_crown(hs) { HEAD_GEAR.crown(hs, '#a8322e', 0.25, ['#ffcf3a', '#ff5a2e']); },
  crown(hs, c, y, gems) {
    const m = toon(c, { side: THREE.DoubleSide });
    part(G.tube, m, hs, [0, y, -0.02], [0.2, 0.08, 0.2]);
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      part(G.cone, m, hs, [Math.sin(a) * 0.19, y + 0.08, Math.cos(a) * 0.19 - 0.02], [0.035, 0.09, 0.035]);
    }
    gems.forEach((g, i) => part(G.sphLo, glow(g, 0.8), hs, [i ? 0.08 : 0, y, 0.18 - (i ? 0.02 : 0)], 0.026, null, false));
  },
  pirate_tricorn(hs) {
    const tri = new THREE.Shape(), R = 0.42;
    for (let i = 0; i < 3; i++) {
      const a = -Math.PI / 2 + (i * 2 * Math.PI) / 3, b = a + Math.PI / 3, n = a + (2 * Math.PI) / 3;
      const p = [Math.cos(a) * R, Math.sin(a) * R], c = [Math.cos(b) * R * 0.45, Math.sin(b) * R * 0.45], q = [Math.cos(n) * R, Math.sin(n) * R];
      if (!i) tri.moveTo(...p);
      tri.quadraticCurveTo(...c, ...q);
    }
    const brim = new THREE.ExtrudeGeometry(tri, { depth: 0.03, bevelEnabled: true, bevelSize: 0.012, bevelThickness: 0.01, bevelSegments: 2 });
    part(brim, toon('#24222c'), hs, [0, 0.19, 0], null, [-Math.PI / 2, 0, 0]);
    part(G.dome, toon('#24222c'), hs, [0, 0.2, -0.01], [0.25, 0.17, 0.25]);
    part(rbox(0.07, 0.06, 0.02, 0.01), toon('#f2ead8'), hs, [0, 0.28, 0.2], null, [-0.6, 0, 0]);
  },
};

/* ---------- eye gear (placed on the painted eyes) ---------- */
function onFace(m, u, v, r) {
  const p = facePoint(u, v, r);
  m.position.copy(p);
  m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), p.clone().normalize());
  return m;
}
const EYE_GEAR = {
  round_specs(hs) {
    const rim = toon('#c8a040');
    EYE_U.forEach((u) => {
      onFace(part(new THREE.TorusGeometry(0.058, 0.007, 8, 28), rim, hs, [0, 0, 0], null, null, false), u, EYE_V, 0.292);
      onFace(part(new THREE.CircleGeometry(0.056, 24), toon('#bfe6ff', { opacity: 0.22 }), hs, [0, 0, 0], null, null, false), u, EYE_V, 0.291);
    });
    onFace(part(G.cyl, rim, hs, [0, 0, 0], [0.006, 0.05, 0.006], null, false), 0.5, EYE_V - 0.08, 0.292).rotateX(Math.PI / 2).rotateZ(Math.PI / 2);
  },
  shadow_visor(hs) {
    part(new THREE.SphereGeometry(0.3, 40, 6, F_PHI0 - 0.15, F_PHI + 0.3, F_TH0 + 0.43, 0.24), toon('#1a1830', { side: THREE.DoubleSide }), hs);
    part(new THREE.SphereGeometry(0.302, 40, 2, F_PHI0, F_PHI, F_TH0 + 0.53, 0.04), glow('#4ae8ff', 1.8), hs, [0, 0, 0], null, null, false);
  },
  mystic_monocle(hs) {
    onFace(part(new THREE.TorusGeometry(0.06, 0.009, 8, 28), toon('#e0b450'), hs, [0, 0, 0], null, null, false), EYE_U[0], EYE_V, 0.294);
    onFace(part(new THREE.CircleGeometry(0.058, 24), toon('#c8a0ff', { opacity: 0.3, emissive: '#8a5aff', ei: 0.4 }), hs, [0, 0, 0], null, null, false), EYE_U[0], EYE_V, 0.292);
    const a = facePoint(EYE_U[0], EYE_V + 0.12, 0.29);
    part(strand([[a.x, a.y, a.z], [a.x - 0.04, a.y - 0.12, a.z - 0.02], [a.x - 0.08, a.y - 0.24, a.z - 0.1]], 0.005, 0.005, 8, 4), toon('#e0b450'), hs, [0, 0, 0], null, null, false);
  },
  eyepatch(hs) {
    onFace(part(new THREE.CircleGeometry(0.062, 24), toon('#1a1620'), hs, [0, 0, 0], null, null, false), EYE_U[0], EYE_V, 0.288);
    part(new THREE.TorusGeometry(0.283, 0.008, 6, 48), toon('#26232e'), hs, [0, 0.04, 0], null, [Math.PI / 2 - 0.35, 0, 0.3], false);
  },
  sun_goggles(hs) {
    EYE_U.forEach((u) => {
      const g = onFace(new THREE.Group(), u, 0.08, 0.3);
      hs.add(g);
      part(G.cyl, toon('#b0802a'), g, [0, 0, 0], [0.065, 0.05, 0.065], [Math.PI / 2, 0, 0]);
      part(G.cyl, glow('#f0a030', 0.7), g, [0, 0, 0.027], [0.05, 0.01, 0.05], [Math.PI / 2, 0, 0], false);
    });
    part(new THREE.TorusGeometry(0.285, 0.014, 6, 48), toon('#6b4a2e'), hs, [0, 0.13, -0.03], null, [Math.PI / 2 - 0.2, 0, 0], false);
  },
};

/* ---------- weapons (blade along +y from the grip) and off-hand items ---------- */
function bladeShape(len, w, curve = 0) {
  const s = new THREE.Shape();
  s.moveTo(-w / 2, 0);
  s.quadraticCurveTo(-w / 2 + curve, len * 0.5, -w / 2 + curve * 1.6, len * 0.88);
  s.lineTo(curve * 1.4, len);
  s.quadraticCurveTo(w / 2 + curve * 1.2, len * 0.6, w / 2, 0);
  const g = new THREE.ExtrudeGeometry(s, { depth: 0.01, bevelEnabled: true, bevelSize: 0.006, bevelThickness: 0.006, bevelSegments: 2 });
  g.translate(0, 0, -0.005);
  return g;
}
const WEAPONS = {
  iron_sword: (w) => WEAPONS.sword(w, 0.5, '#c3ccd8', null),
  ember_blade: (w) => WEAPONS.sword(w, 0.55, '#ff6a2e', '#ff5a10'),
  void_blade: (w) => WEAPONS.sword(w, 0.55, '#8a5ae8', '#7a2aff'),
  shadow_dagger: (w) => WEAPONS.sword(w, 0.28, '#8d93c4', null, '#3c3646'),
  cutlass: (w) => WEAPONS.sword(w, 0.48, '#d0d8e4', null, '#d9b04f', 0.05),
  sword(w, len, c, em, guard = '#d9b04f', curve = 0) {
    part(G.cyl, toon('#5a3a22'), w, [0, 0, 0], [0.019, 0.12, 0.019]);
    part(G.sphLo, toon(guard), w, [0, -0.07, 0], 0.026);
    part(rbox(0.16, 0.028, 0.045, 0.012), toon(guard), w, [0, 0.07, 0]);
    part(bladeShape(len, 0.062, curve), em ? glow(c, 1.3) : toon(c, { emissive: '#ffffff', ei: 0.08 }), w, [0, 0.08, 0]);
    return { type: 'blade', tip: [0, 0.08 + len, 0], base: [0, 0.14, 0], trail: em || '#eaff8a' };
  },
  oak_staff(w) {
    part(G.cyl, toon('#7a5230'), w, [0, 0.2, 0], [0.022, 1.0, 0.022]);
    for (let i = 0; i < 3; i++) part(new THREE.TorusGeometry(0.05, 0.012, 6, 14, Math.PI * 1.3), toon('#7a5230'), w, [0, 0.72, 0], null, [0, (i * Math.PI * 2) / 3, Math.PI / 2], false);
    part(G.sph, glow('#4fc3ff', 1.6), w, [0, 0.78, 0], 0.065, null, false);
    return { type: 'pole', tip: [0, 0.8, 0], base: [0, 0.55, 0], trail: '#4fc3ff', cast: { color: '#4fc3ff', cd: 0.55, range: 14, aoe: 0, size: 1 } };
  },
  trident(w) {
    part(G.cyl, toon('#2aa0a8'), w, [0, 0.25, 0], [0.02, 1.1, 0.02]);
    part(rbox(0.16, 0.025, 0.03, 0.01), toon('#e0b450'), w, [0, 0.8, 0]);
    for (const x of [-0.07, 0, 0.07]) part(G.cone, toon('#e0b450'), w, [x, 0.88 + (x ? 0 : 0.03), 0], [0.018, 0.16 + (x ? 0 : 0.05), 0.018]);
    return { type: 'pole', tip: [0, 0.98, 0], base: [0, 0.6, 0], trail: '#6ae8ff' };
  },
  // casters: attack shoots a magic ball from the tip (see `cast`)
  apprentice_wand: (w) => WEAPONS.wand(w, '#7a5230', '#6fd8ff', 0.3, { color: '#6fd8ff', cd: 0.4, range: 12, aoe: 0, size: 0.8 }),
  fire_wand: (w) => WEAPONS.wand(w, '#4a2418', '#ff6a2e', 0.34, { color: '#ff7a2a', cd: 0.45, range: 14, aoe: 0, size: 1 }),
  wand(w, wood, gem, len, cast) {
    part(new THREE.CylinderGeometry(0.011, 0.018, len, 8), toon(wood), w, [0, len / 2 - 0.05, 0]);
    part(G.cyl, toon('#e0b048'), w, [0, -0.02, 0], [0.024, 0.05, 0.024]);
    part(G.cyl, toon('#e0b048'), w, [0, len - 0.08, 0], [0.02, 0.03, 0.02], null, false);
    part(new THREE.OctahedronGeometry(0.045, 0), glow(gem, 1.8), w, [0, len - 0.02, 0], [1, 1.5, 1], null, false);
    return { type: 'wand', tip: [0, len + 0.02, 0], base: [0, len * 0.5, 0], trail: gem, cast };
  },
  inferno_staff(w) {
    part(new THREE.CylinderGeometry(0.02, 0.028, 1.05, 8), toon('#3a1a14'), w, [0, 0.2, 0]);
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2;
      part(G.cone, toon('#e0b048'), w, [Math.cos(a) * 0.06, 0.78, Math.sin(a) * 0.06], [0.018, 0.12, 0.018], [Math.sin(a) * 0.5, 0, -Math.cos(a) * 0.5], false);
    }
    part(G.sph, glow('#ff5a1a', 2.2), w, [0, 0.83, 0], 0.085, null, false);
    part(G.sph, glow('#ffe08a', 2), w, [0, 0.83, 0], 0.045, null, false);
    return { type: 'pole', tip: [0, 0.86, 0], base: [0, 0.6, 0], trail: '#ff6a2e', cast: { color: '#ff6a2e', cd: 0.6, range: 16, aoe: 1.8, size: 1.5 } };
  },
  hunter_bow: (w) => WEAPONS.bow(w, '#8b5e3c'),
  composite_bow: (w) => WEAPONS.bow(w, '#5a3a5a'),
  bow(w, c) {
    part(new THREE.TorusGeometry(0.34, 0.018, 6, 28, 2.2), toon(c), w, [-0.29, 0.02, 0], null, [0, 0, -1.1]);
    part(G.cyl, toon('#efe6cf'), w, [0.02, 0.02, 0], [0.004, 0.6, 0.004], null, false);
    return { type: 'pole', tip: [0, 0.32, 0], base: [0, -0.2, 0], trail: '#eaff8a', bow: true };
  },
};
const OFFHAND = {
  wooden_shield: (h) => OFFHAND.round(h, 0.19, '#8b6b3e', '#a0a8b4'),
  iron_buckler: (h) => OFFHAND.round(h, 0.13, '#a0a8b4', '#6e7684'),
  aegis: (h) => { OFFHAND.round(h, 0.2, '#e0b450', '#fff2b0'); part(G.sphLo, glow('#7ae0ff', 1.4), h, [0.09, 0, 0.02], 0.05, null, false); },
  round(h, r, c, rim) {
    const g = group(h, [0.07, 0, 0.03], [0, 0, Math.PI / 2]);
    part(G.cyl, toon(c), g, [0, 0, 0], [r, 0.035, r]);
    part(new THREE.TorusGeometry(r, 0.016, 8, 32), toon(rim), g, [0, 0, 0], null, [Math.PI / 2, 0, 0]);
    part(G.dome, toon(rim), g, [0, -0.018, 0], [r * 0.3, r * 0.25, r * 0.3], [Math.PI, 0, 0]);
  },
  tower_shield(h) {
    const g = group(h, [0.07, 0.05, 0.03]);
    part(rbox(0.035, 0.46, 0.3, 0.03), toon('#e0b450'), g, [-0.004, 0, 0]);
    part(rbox(0.04, 0.42, 0.26, 0.03), toon('#9aa3b0'), g);
    part(rbox(0.02, 0.18, 0.04, 0.008), toon('#e0b450'), g, [0.025, 0.02, 0]);
    part(rbox(0.02, 0.04, 0.14, 0.008), toon('#e0b450'), g, [0.025, 0.06, 0]);
  },
  tome_of_sparks(h, ctx) {
    part(rbox(0.05, 0.17, 0.13, 0.012), toon('#6a2a8a'), h, [0.03, -0.04, 0.04]);
    part(rbox(0.04, 0.155, 0.12, 0.006), toon('#f2ead8'), h, [0.035, -0.04, 0.04]);
    ctx.sparks = [0, 1, 2].map(() => part(G.sphLo, glow('#ffc46a', 2), h, [0, 0, 0], 0.018, null, false));
  },
  lantern(h, ctx) {
    const g = group(h, [0, -0.13, 0.02]);
    part(G.cyl, toon('#26232e'), g, [0, 0.07, 0], [0.045, 0.02, 0.045]);
    part(G.cyl, toon('#26232e'), g, [0, -0.07, 0], [0.05, 0.02, 0.05]);
    part(G.sph, glow('#ffc870', 2.2), g, [0, 0, 0], [0.04, 0.055, 0.04], null, false);
    ctx.light = new THREE.PointLight('#ffb84a', 1.4, 3.5, 2);
    g.add(ctx.light);
  },
  crystal_orb(h, ctx) {
    ctx.orb = part(G.sph, glow('#4fc3ff', 1.4), h, [0.03, 0.1, 0.05], 0.06, null, false);
    ctx.orbRing = part(new THREE.TorusGeometry(0.09, 0.006, 6, 32), glow('#c8ff2e', 1.2), h, [0.03, 0.1, 0.05], null, null, false);
  },
};

/* ---------- pets ---------- */
function makePet(type, M) {
  const g = new THREE.Group(), body = group(g), P = { g, body, type, float: false };
  const eyes = (parent, sep, y, z, r) => [-1, 1].forEach((s) => {
    part(G.sphLo, toon('#ffffff'), parent, [s * sep, y, z], r, null, false);
    part(G.sphLo, toon('#140a1e'), parent, [s * sep, y, z + r * 0.6], r * 0.55, null, false);
  });
  if (type === 'baby_slime') {
    part(G.sph, toon('#5ec45e', { emissive: '#1a5a1a', ei: 0.6 }), body, [0, 0.14, 0], [0.17, 0.14, 0.17]);
    eyes(body, 0.05, 0.17, 0.13, 0.035);
  } else if (type === 'forest_fox') {
    const fur = toon('#e07a2e'), white = toon('#fff4e8');
    part(capsule(0.08, 0.14), fur, body, [0, 0.16, 0], null, [Math.PI / 2, 0, 0]);
    part(G.sph, fur, body, [0, 0.27, 0.12], 0.09);
    part(G.cone, fur, body, [0, 0.25, 0.22], [0.035, 0.08, 0.035], [Math.PI / 2, 0, 0]);
    for (const s of [-1, 1]) part(G.cone, fur, body, [s * 0.05, 0.37, 0.1], [0.03, 0.07, 0.025]);
    P.tail = group(body, [0, 0.18, -0.13]);
    part(strand([[0, 0, 0], [0, 0.05, -0.12], [0, 0.12, -0.2]], 0.05, 0.015), fur, P.tail);
    part(G.sphLo, white, P.tail, [0, 0.12, -0.2], 0.03, null, false);
    for (const [x, z] of [[-0.05, 0.08], [0.05, 0.08], [-0.05, -0.08], [0.05, -0.08]]) part(G.cyl, toon('#3a2418'), body, [x, 0.05, z], [0.018, 0.1, 0.018]);
    eyes(body, 0.04, 0.29, 0.19, 0.022);
  } else if (type === 'ember_sprite' || type === 'void_familiar') {
    const c = type === 'ember_sprite' ? '#ff8a3a' : '#9a5aff';
    part(G.sph, glow(c, 1.6), body, [0, 0, 0], 0.09, null, false);
    part(G.sph, glow('#ffffff', 1), body, [0, 0, 0], 0.045, null, false);
    P.ring = part(new THREE.TorusGeometry(0.15, 0.008, 6, 32), glow(c, 1.2), body, [0, 0, 0], null, null, false);
    P.light = new THREE.PointLight(c, 0.8, 2.5, 2);
    body.add(P.light);
    P.float = true;
  } else if (type === 'baby_kraken') {
    part(G.sph, toon('#8a5ab4', { emissive: '#2a0a4a', ei: 0.6 }), body, [0, 0.06, 0], [0.12, 0.14, 0.12]);
    eyes(body, 0.045, 0.06, 0.1, 0.03);
    P.legs = [0, 1, 2, 3, 4].map((i) => {
      const a = (i / 5) * Math.PI * 2, leg = group(body, [Math.sin(a) * 0.07, -0.05, Math.cos(a) * 0.07], [0, a, 0]);
      part(strand([[0, 0, 0], [0, -0.06, 0.04], [0, -0.13, 0.02]], 0.025, 0.004, 8, 6), toon('#8a5ab4'), leg);
      return leg;
    });
    P.float = true;
  } else return null;
  return P;
}

/* ============================================================================ */
export function makeHero3D(look = {}) {
  look = Object.assign({ skin: 1, hc: 0, hs: 'short' }, look);
  const eq = Object.assign({}, look.equipment || {});
  const skin = SKINS[look.skin] || SKINS[1], hc = HAIRS[look.hc] || HAIRS[0];
  const f = OUTFITS[eq.body] || OUTFITS.bare, bootC = FEET[eq.feet] || f.boots;
  const shirtMat = f.extra === 'chain' ? toon('#ffffff', { map: mailTexture(f.shirt) }) : toon(f.shirt);
  const M = {
    skin: toon(skin), skinDk: toon(dark(skin)), hair: toon(hc), hairHi: toon(mixc(hc, '#ffffff', 0.42)),
    shirt: shirtMat, sleeve: toon(f.sleeve || f.shirt), pants: toon(f.pants || f.shirt), gloves: toon(f.gloves || skin),
    boot: toon(bootC), sole: toon(dark(dark(bootC))), belt: toon(f.belt || '#5a4632'), gold: toon('#e0b450'),
    helm: toon('#b4bcc8'), helmDk: toon('#6e7684'), metal: toon('#b4bcc8'),
  };
  const HIP_Y = 0.5, springs = [], J = {}, ctx = { springs };

  const root = new THREE.Group();
  const body = group(root);
  const hips = group(body, [0, HIP_Y, 0]);
  J.body = body; J.hips = hips;
  part(rbox(0.27, 0.13, 0.19, 0.055), f.robe ? M.shirt : M.pants, hips);

  // legs (side -1 = right, on -x; +1 = left)
  for (const side of [-1, 1]) {
    const k = side < 0 ? 'R' : 'L';
    const hip = group(hips, [side * 0.075, -0.04, 0]);
    part(capsule(0.058, 0.09), M.pants, hip, [0, -0.09, 0]);
    const knee = group(hip, [0, -0.19, 0]);
    part(capsule(0.052, 0.09), M.pants, knee, [0, -0.08, 0]);
    if (f.bootTop || eq.feet === 'iron_greaves') part(G.cyl, M.boot, knee, [0, -0.115, 0.004], [0.066, 0.11, 0.07]);
    const ankle = group(knee, [0, -0.18, 0]);
    part(rbox(0.112, 0.1, 0.18, 0.045), M.boot, ankle, [0, -0.035, 0.028]);
    part(rbox(0.118, 0.025, 0.19, 0.011), M.sole, ankle, [0, -0.077, 0.028]);
    if (eq.feet === 'winged_boots') {
      const wing = group(ankle, [side * 0.06, 0.0, -0.02]);
      part(strand([[0, 0, 0], [side * 0.05, 0.04, -0.04], [side * 0.06, 0.09, -0.1]], 0.03, 0.004, 8, 6), toon('#ffffff'), wing, [0, 0, 0], [1, 1, 0.4]);
      (ctx.wings ||= []).push(wing);
    }
    J['hip' + k] = hip; J['knee' + k] = knee; J['ankle' + k] = ankle;
  }

  // torso
  const spine = group(hips, [0, 0.055, 0]);
  J.spine = spine; ctx.spine = spine;
  J.torso = part(lathe([[0, -0.02], [0.135, -0.02], [0.148, 0.05], [0.162, 0.13], [0.164, 0.18], [0.152, 0.22], [0.11, 0.255], [0.06, 0.27], [0, 0.27]]), M.shirt, spine, [0, 0, 0], [1, 1, 0.8]);
  if (f.belt) {
    part(new THREE.CylinderGeometry(0.152, 0.15, 0.05, 32), M.belt, spine, [0, 0.0, 0], [1, 1, 0.83]);
    part(rbox(0.05, 0.045, 0.02, 0.008), toon(f.buckle || '#e0b450'), spine, [0, 0, 0.128]);
  }
  part(G.cyl, M.skinDk, spine, [0, 0.285, 0], [0.05, 0.06, 0.05]);

  // outfit extras
  if (f.extra === 'knight') {
    const tab = group(spine, [0, 0.19, 0.128]);
    springs.push({ obj: tab, k: 70, c: 7, gain: 0.7 });
    part(rbox(0.16, 0.36, 0.018, 0.007), toon('#b2363a'), tab, [0, -0.18, 0]);
    part(rbox(0.05, 0.06, 0.01, 0.004), toon('#e8c060'), tab, [0, -0.1, 0.01], null, [0, 0, Math.PI / 4]);
    part(G.tube, toon('#7d8696', { side: THREE.DoubleSide }), hips, [0, -0.07, 0], [0.165, 0.08, 0.135]);
  } else if (f.extra === 'robe') {
    const skirt = group(hips, [0, 0.03, 0]);
    springs.push({ obj: skirt, k: 55, c: 6, gain: 0.45 });
    part(lathe([[0.15, 0], [0.165, -0.1], [0.205, -0.25], [0.25, -0.42], [0.255, -0.445]]), toon(f.shirt, { side: THREE.DoubleSide }), skirt, [0, 0, 0], [1, 1, 0.9]);
    part(new THREE.TorusGeometry(0.252, 0.016, 8, 40), M.gold, skirt, [0, -0.44, 0], [1, 0.9, 1], [Math.PI / 2, 0, 0]);
    part(rbox(0.03, 0.42, 0.01, 0.005), M.gold, skirt, [0, -0.22, 0.2], null, [0.17, 0, 0], false);
    part(rbox(0.03, 0.26, 0.01, 0.005), M.gold, spine, [0, 0.1, 0.132], null, [-0.05, 0, 0], false);
  } else if (f.extra === 'ranger') {
    part(rbox(0.04, 0.38, 0.02, 0.01), toon('#6b4a2e'), spine, [0, 0.12, 0.126], null, [0, 0, 0.78]);
  } else if (f.extra === 'rogue') {
    part(new THREE.TorusGeometry(0.085, 0.032, 10, 24), toon('#5a3570'), spine, [0, 0.262, 0], [1, 1, 1], [Math.PI / 2, 0, 0]);
    const tails = group(spine, [0.03, 0.25, -0.09]);
    springs.push({ obj: tails, k: 35, c: 4, gain: 1.6 });
    part(rbox(0.05, 0.2, 0.014, 0.006), toon('#5a3570'), tails, [0, -0.1, 0], null, [0.1, 0, 0.12]);
    part(rbox(0.05, 0.16, 0.014, 0.006), toon('#5a3570'), tails, [-0.05, -0.08, 0], null, [0.1, 0, -0.08]);
    part(rbox(0.06, 0.06, 0.04, 0.015), toon('#6b4a2e'), spine, [0.13, -0.02, 0.06]);
  } else if (f.extra === 'coat') {
    const tails = group(hips, [0, 0.02, -0.07]);
    springs.push({ obj: tails, k: 50, c: 5, gain: 0.8 });
    for (const s of [-1, 1]) part(rbox(0.13, 0.3, 0.02, 0.008), toon(f.shirt), tails, [s * 0.07, -0.15, 0], null, [0.05, 0, s * 0.08]);
    for (const s of [-1, 1]) part(rbox(0.035, 0.15, 0.012, 0.006), toon('#f2e8d0'), spine, [s * 0.045, 0.16, 0.128], null, [0, 0, s * 0.22], false);
    for (const [x, y] of [[-0.04, 0.08], [0.04, 0.08], [-0.04, 0.03], [0.04, 0.03]]) part(G.sphLo, M.gold, spine, [x, y, 0.13], 0.012, null, false);
  }

  // arms
  for (const side of [-1, 1]) {
    const k = side < 0 ? 'R' : 'L', short = f.sleeves === 'short';
    const sh = group(spine, [side * 0.17, 0.2, 0]);
    if (short) {
      part(capsule(0.054, 0.03), M.shirt, sh, [0, -0.035, 0]);
      part(capsule(0.043, 0.08), M.skin, sh, [0, -0.085, 0]);
    } else part(capsule(0.047, 0.08), M.sleeve, sh, [0, -0.075, 0]);
    if (f.extra === 'knight') part(G.dome, M.metal, sh, [side * 0.01, 0.0, 0], [0.085, 0.07, 0.085], [0, 0, -side * 0.35]);
    const el = group(sh, [0, -0.15, 0]);
    part(capsule(0.041, 0.065), short ? M.skin : M.sleeve, el, [0, -0.065, 0]);
    if (f.sleeves === 'wide') {
      part(new THREE.CylinderGeometry(0.05, 0.088, 0.11, 18, 1, true), toon(f.shirt, { side: THREE.DoubleSide }), el, [0, -0.07, 0]);
      part(new THREE.TorusGeometry(0.086, 0.01, 6, 24), M.gold, el, [0, -0.125, 0], null, [Math.PI / 2, 0, 0], false);
    }
    if (f.bracer) part(G.cyl, toon(f.bracer), el, [0, -0.085, 0], [0.047, 0.06, 0.047]);
    const hand = group(el, [0, -0.135, 0]);
    part(G.sph, M.gloves, hand, [0, -0.02, 0], [0.05, 0.056, 0.048]);
    part(G.sphLo, M.gloves, hand, [-side * 0.03, -0.005, 0.03], 0.022);
    J['sh' + k] = sh; J['el' + k] = el; J['hand' + k] = hand;
  }

  // weapon in the right hand, off-hand item in the left
  const wpn = group(J.handR, [0, -0.02, 0.0]);
  J.wpn = wpn;
  const W = WEAPONS[eq.rhand] ? WEAPONS[eq.rhand](wpn) : null;
  const wtype = W ? W.type : 'fist';
  if (W && W.bow) {
    const quiver = group(spine, [-0.06, 0.16, -0.13], [0.15, 0, 0.45]);
    part(G.cyl, toon('#7a5230'), quiver, [0, 0, 0], [0.045, 0.3, 0.045]);
    for (let i = 0; i < 3; i++) part(G.cone, toon('#eae4d6'), quiver, [(i - 1) * 0.022, 0.19, 0], [0.018, 0.06, 0.012]);
  }
  if (OFFHAND[eq.lhand]) OFFHAND[eq.lhand](J.handL, ctx);
  const tip = new THREE.Object3D(), base = new THREE.Object3D();
  (W ? wpn : J.handR).add(tip, base);
  if (W) { tip.position.set(...W.tip); base.position.set(...W.base); } else { tip.position.set(0, -0.05, 0.02); base.position.set(0, 0.04, 0); }

  // head
  const head = group(spine, [0, 0.29, 0]);
  const hs = group(head, [0, 0.2, 0]);
  hs.scale.set(1, 0.94, 0.96);
  J.head = head;
  part(G.sph, M.skin, hs, [0, 0, 0], 0.27);
  for (const s of [-1, 1]) part(G.sphLo, M.skin, hs, [s * 0.265, -0.02, 0], [0.03, 0.05, 0.04]);
  part(G.sphLo, M.skinDk, hs, facePoint(0.5, 0.74, 0.268).toArray(), 0.014, null, false);
  const faceCanvas = document.createElement('canvas');
  faceCanvas.width = 512; faceCanvas.height = 256;
  const faceCtx = faceCanvas.getContext('2d'), faceTex = new THREE.CanvasTexture(faceCanvas);
  faceTex.colorSpace = THREE.SRGBColorSpace;
  faceTex.anisotropy = 4;
  const faceMesh = new THREE.Mesh(new THREE.SphereGeometry(0.2725, 48, 24, F_PHI0, F_PHI, F_TH0, F_TH),
    new THREE.MeshToonMaterial({ map: faceTex, gradientMap: GRAD, transparent: true, depthWrite: false }));
  hs.add(faceMesh);

  // hair: a cap plus strands, each group on its own spring
  const capped = CAPPED(eq) && !!HEAD_GEAR[eq.head];
  if (look.hs !== 'bald') {
    const cap = group(hs, [0, 0, 0], [-0.61, 0, 0]);
    part(new THREE.SphereGeometry(0.29, 32, 18, 0, Math.PI * 2, 0, 1.75), M.hair, cap);
    if (!capped) part(new THREE.TorusGeometry(0.296, 0.013, 6, 30, 1.3), M.hairHi, hs, [0, 0, 0], null, [0.75, 0, Math.PI / 2 - 0.65], false);
  }
  const spec = hairSpec(look, capped), HAIR_SPRING = { bangs: [140, 12, 0.25], sides: [70, 7, 0.8], back: [45, 5, 1.1], top: [90, 8, 0.5] };
  for (const [name, list] of Object.entries(spec)) {
    if (!list.length) continue;
    const pivot = group(hs, [0, 0.15, 0]), [k, c, gain] = HAIR_SPRING[name];
    springs.push({ obj: pivot, k, c, gain, offset: [0, -0.15, 0] });
    const g = mergeGeometries(list.map(([pts, r]) => strand(pts.map(([x, y, z]) => [x, y - 0.15, z]), r, 0.003)));
    part(g, M.hair, pivot);
  }
  if (HEAD_GEAR[eq.head]) HEAD_GEAR[eq.head](hs, M, ctx);
  if (EYE_GEAR[eq.eyes]) EYE_GEAR[eq.eyes](hs);

  // pet: the parrot rides the left shoulder, the rest follow on the ground or float
  let pet = null;
  if (eq.pet === 'parrot') {
    const p = group(J.shL, [0.01, 0.07, -0.01]);
    part(G.sph, toon('#d43a3a'), p, [0, 0.06, 0], [0.05, 0.065, 0.05]);
    part(G.sph, toon('#3a6ad8'), p, [0.035, 0.05, -0.01], [0.02, 0.05, 0.04]);
    part(G.cone, toon('#efe6d0'), p, [0, 0.09, 0.05], [0.015, 0.035, 0.015], [Math.PI / 2, 0, 0]);
    part(strand([[0, 0.02, -0.03], [0, -0.04, -0.08], [0, -0.1, -0.1]], 0.02, 0.004, 6, 5), toon('#3a6ad8'), p);
    springs.push({ obj: p, k: 60, c: 5, gain: 0.3 });
  } else if (eq.pet) pet = makePet(eq.pet, M);

  /* ---------- runtime ---------- */
  const st = {
    t: Math.random() * 10, phase: 0, move: 0, first: true, prev: new THREE.Vector3(), vx: 0, vz: 0, ax: 0, az: 0,
    prevH: 0, turn: 0, headYaw: 0, idleLook: 0, idleLookT: 2, blinkT: 1 + Math.random() * 2, blink: 0,
    expr: '', emote: null, emoteT: 0, hurt: 0, prevHipY: HIP_Y, hipVy: 0, lastS: 0, petInit: false,
    airW: 0, wasAir: false, land: 0,
  };
  springs.forEach((s) => { s.px = 0; s.pv = 0; s.rx = 0; s.rv = 0; s.base = s.obj.rotation.clone(); });

  // weapon trail: a ribbon between the blade base and tip, sampled every frame of the swing
  const TRAIL_N = 18, trailPos = new Float32Array(TRAIL_N * 2 * 3), trailCol = new Float32Array(TRAIL_N * 2 * 3), samples = [];
  const trailGeo = new THREE.BufferGeometry();
  trailGeo.setAttribute('position', new THREE.BufferAttribute(trailPos, 3));
  trailGeo.setAttribute('color', new THREE.BufferAttribute(trailCol, 3));
  const tIdx = [];
  for (let i = 0; i < TRAIL_N - 1; i++) { const a = i * 2; tIdx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
  trailGeo.setIndex(tIdx);
  const trail = new THREE.Mesh(trailGeo, new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
  trail.frustumCulled = false;
  const trailColor = col(W ? W.trail : '#ffffff');
  const puffs = [], PUFF_GEO = new THREE.SphereGeometry(1, 8, 6);
  const V1 = new THREE.Vector3(), V2 = new THREE.Vector3();

  function puff(scene, x, z, n, spread, dirX = 0, dirZ = 0) {
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2, pf = new THREE.Mesh(PUFF_GEO, new THREE.MeshBasicMaterial({ color: '#efe4ff', transparent: true, opacity: 0.6, depthWrite: false }));
      pf.position.set(x + (Math.random() - 0.5) * 0.15, 0.05, z + (Math.random() - 0.5) * 0.15);
      pf.scale.setScalar(0.04);
      scene.add(pf);
      puffs.push({ m: pf, age: 0, vy: 0.3 + Math.random() * 0.3, vx: dirX + Math.cos(a) * spread, vz: dirZ + Math.sin(a) * spread });
    }
  }

  function setExpr(e) {
    if (e === st.expr) return;
    st.expr = e;
    paintFace(faceCtx, e, look);
    faceTex.needsUpdate = true;
  }
  setExpr('normal');

  function update(dt, s = {}) {
    dt = Math.min(Math.max(dt, 1e-4), 0.05);
    st.t += dt;
    const t = st.t, pos = root.position, h = root.rotation.y, scene = root.parent;
    if (st.first) { st.prev.copy(pos); st.prevH = h; st.first = false; }
    if (scene && !trail.parent) scene.add(trail);

    // motion measured from the root
    const vx = (pos.x - st.prev.x) / dt, vz = (pos.z - st.prev.z) / dt;
    st.prev.copy(pos);
    const k = 1 - Math.exp(-dt * 18), oldVx = st.vx, oldVz = st.vz;
    st.vx += (vx - st.vx) * k; st.vz += (vz - st.vz) * k;
    st.ax = damp(st.ax, (st.vx - oldVx) / dt, 8, dt); st.az = damp(st.az, (st.vz - oldVz) / dt, 8, dt);
    const speed = Math.hypot(st.vx, st.vz) < 0.05 ? 0 : Math.hypot(st.vx, st.vz);
    const fx = Math.sin(h), fz = Math.cos(h), accF = st.ax * fx + st.az * fz, accR = -st.ax * fz + st.az * fx;
    st.turn = damp(st.turn, wrap(h - st.prevH) / dt, 10, dt);
    st.prevH = h;
    st.move = damp(st.move, Math.min(1.8, speed / 4.2), 9, dt);
    const m = Math.min(1, st.move), r = clamp((st.move - 1) / 0.7, 0, 1);
    if (speed > 0.1) st.phase += dt * Math.PI * 2 * (1.3 + speed * 0.33);
    const s1 = Math.sin(st.phase), c1 = Math.cos(st.phase);

    // locomotion
    const stride = (0.62 + 0.32 * r) * m * (f.robe ? 0.6 : 1);
    J.hipL.rotation.x = -s1 * stride; J.hipR.rotation.x = s1 * stride;
    J.kneeL.rotation.x = (Math.max(0, c1) * (0.95 + 0.55 * r) + 0.06) * m;
    J.kneeR.rotation.x = (Math.max(0, -c1) * (0.95 + 0.55 * r) + 0.06) * m;
    J.ankleL.rotation.x = -(J.hipL.rotation.x + J.kneeL.rotation.x) * 0.8;
    J.ankleR.rotation.x = -(J.hipR.rotation.x + J.kneeR.rotation.x) * 0.8;
    const hipY = HIP_Y + Math.abs(c1) * 0.03 * m - 0.035 * r + Math.sin(t * 2.2) * 0.004 * (1 - m);
    st.hipVy = damp(st.hipVy, (hipY - st.prevHipY) / dt, 20, dt);
    st.prevHipY = hipY;
    let hipZ = 0, sq = 0;
    let spY = -s1 * 0.26 * m + st.headYaw * 0.2 * (1 - m), spX = 0.04 * m + 0.2 * r + clamp(accF * 0.012, -0.15, 0.2), spZ = 0;
    const swing = (0.5 + 0.45 * r) * m, idle = (1 - m) * Math.sin(t * 1.3) * 0.03;
    let shLx = s1 * swing + idle, shRx = -s1 * swing - idle, shLz = 0.1 + 0.2 * r + Math.abs(idle), shRz = -(0.1 + 0.2 * r + Math.abs(idle));
    let elL = -(0.2 + 0.85 * r) * Math.max(m, 0.35), elR = elL, wpx = wtype === 'blade' ? 1.85 : wtype === 'wand' ? 1.5 : 0, shRy = 0;
    if (wtype === 'pole') { shRx = shRx * 0.4 - 0.15; elR = -0.55; wpx = 0.55; }
    if (ctx.light) elL = -1.1;                         // lantern held up in front
    if (ctx.orb || ctx.sparks) elL = -0.9;

    // attack, keyframed per weapon type, then blended back into locomotion
    const p = s.atk ?? -1;
    if (p >= 0) {
      const END = 0.48, w = p < END ? 1 : 1 - easeInOut((p - END) / (1 - END)), q = Math.min(p, END);
      let a;
      if (wtype === 'blade') {
        if (q < 0.2) { const e = easeOut(q / 0.2); a = { spY: -1.1 * e, shRx: -1.45 * e, shRz: -0.7 * e, elR: -0.25, wpx: lerp(1.85, 2.6, e), shLx: -0.3 * e, shLz: 0.1 + 0.3 * e }; }
        else { const e = easeOut((q - 0.2) / 0.28); a = { spY: -1.1 + 2.3 * e, shRx: -1.45, shRz: -0.7 + 1.5 * e, elR: -0.15, wpx: 2.6, shLx: -0.3, shLz: 0.4 }; }
      } else if (wtype === 'wand') { // flick: raise the wand overhead, snap it forward to point
        if (q < 0.2) { const e = easeOut(q / 0.2); a = { spY: -0.3 * e, shRx: -0.6 - 1.5 * e, shRz: -0.25, elR: -0.9 * e, wpx: lerp(1.5, 2.3, e), shLx: -0.25 * e, shLz: 0.25 }; }
        else { const e = easeOut((q - 0.2) / 0.28); a = { spY: -0.3 + 0.35 * e, shRx: -2.1 + 0.6 * e, shRz: -0.25, elR: -0.9 + 0.85 * e, wpx: 2.3 + 0.75 * e, shLx: -0.25, shLz: 0.25 }; }
      } else if (wtype === 'pole') {
        if (q < 0.22) { const e = easeOut(q / 0.22); a = { spY: -0.45 * e, shRx: -0.5 - 0.5 * e, shRz: -0.2, elR: -0.55 - 0.8 * e, wpx: lerp(0.55, 1.45, e), shLx: -0.6 * e, shLz: 0.2 }; }
        else { const e = easeOut((q - 0.22) / 0.26); a = { spY: -0.45 + 0.75 * e, shRx: -1.0 - 0.45 * e, shRz: -0.2, elR: -1.35 + 1.2 * e, wpx: 1.45, shLx: -0.6, shLz: 0.2 }; hipZ = 0.06 * e * w; }
      } else {
        if (q < 0.2) { const e = easeOut(q / 0.2); a = { spY: -0.6 * e, shRx: -1.2 * e, shRz: -0.3 * e, elR: -1.7 * e, wpx: 0, shLx: -0.9 * e, shLz: 0.3 }; }
        else { const e = easeOut((q - 0.2) / 0.28); a = { spY: -0.6 + 1.1 * e, shRx: -1.2 - 0.35 * e, shRz: -0.3 + 0.3 * e, elR: -1.7 + 1.6 * e, wpx: 0, shLx: -0.9, shLz: 0.3 }; }
      }
      spY = lerp(spY, a.spY, w); shRx = lerp(shRx, a.shRx, w); shRz = lerp(shRz, a.shRz, w); elR = lerp(elR, a.elR, w);
      wpx = lerp(wpx, a.wpx, w); shLx = lerp(shLx, a.shLx, w); shLz = lerp(shLz, a.shLz, w);
      spX = lerp(spX, 0.12, w);
      hipZ += Math.sin(Math.min(1, p / END) * Math.PI) * 0.04 * w;
      sq = Math.sin(Math.min(1, p / 0.3) * Math.PI) * 0.06 * w;
    }
    // hurt: flinch back, arms out
    if (st.hurt > 0) {
      st.hurt -= dt;
      const e = Math.sin(clamp(st.hurt / 0.4, 0, 1) * Math.PI);
      spX -= 0.4 * e; shLz += 0.5 * e; shRz -= 0.5 * e; elL -= 0.4 * e; elR -= 0.4 * e;
    }

    // airborne: tuck one leg, stretch the other, arms out (higher while rising); squash on landing
    const air = !!s.air, up = clamp((s.vy || 0) / 7, -1, 1);
    if (st.wasAir && !air) { st.land = 0.22; if (scene) puff(scene, pos.x, pos.z, 8, 0.9); }
    st.wasAir = air;
    st.airW = damp(st.airW, air ? 1 : 0, 16, dt);
    const aw = st.airW;
    if (aw > 0.01) {
      J.hipL.rotation.x = lerp(J.hipL.rotation.x, -0.75, aw); J.hipR.rotation.x = lerp(J.hipR.rotation.x, 0.3, aw);
      J.kneeL.rotation.x = lerp(J.kneeL.rotation.x, 1.15, aw); J.kneeR.rotation.x = lerp(J.kneeR.rotation.x, 0.55, aw);
      J.ankleL.rotation.x = -(J.hipL.rotation.x + J.kneeL.rotation.x) * 0.6; J.ankleR.rotation.x = -(J.hipR.rotation.x + J.kneeR.rotation.x) * 0.6;
      if (p < 0) { shLx = lerp(shLx, -0.3 - 0.5 * up, aw); shRx = lerp(shRx, -0.3 - 0.5 * up, aw); }
      shLz = lerp(shLz, 0.75 + 0.35 * up, aw); shRz = lerp(shRz, -(0.75 + 0.35 * up), aw);
      spX = lerp(spX, 0.12 - 0.1 * up, aw);
    }
    if (st.land > 0) { st.land -= dt; sq += (st.land / 0.22) * 0.16; }

    J.hips.position.set(0, hipY, hipZ);
    J.hips.rotation.set(0, s1 * 0.16 * m, -c1 * 0.035 * m);
    J.spine.rotation.set(spX, spY, spZ);
    J.shL.rotation.set(shLx, 0, shLz); J.shR.rotation.set(shRx, shRy, shRz);
    J.elL.rotation.x = elL; J.elR.rotation.x = elR;
    J.wpn.rotation.x = wpx;
    J.body.rotation.z = -clamp(st.turn * speed * 0.02, -0.28, 0.28);
    J.body.scale.set(1 + sq * 0.6, 1 - sq, 1 + sq * 0.6);
    J.torso.scale.set(1 + Math.sin(t * 2.2) * 0.008, 1 + Math.sin(t * 2.2) * 0.014, 0.8);

    // head: look at something nearby, or glance around when idle
    let yawT = 0;
    if (s.lookAt) yawT = clamp(wrap(Math.atan2(s.lookAt.x - pos.x, s.lookAt.z - pos.z) - h), -1.1, 1.1);
    else if (m < 0.15) {
      st.idleLookT -= dt;
      if (st.idleLookT <= 0) { st.idleLook = Math.random() < 0.35 ? 0 : (Math.random() - 0.5) * 1.2; st.idleLookT = 2.5 + Math.random() * 4; }
      yawT = st.idleLook;
    }
    st.headYaw = damp(st.headYaw, yawT, 6, dt);
    J.head.rotation.set(-spX * 0.6 + Math.sin(st.phase * 2) * 0.03 * m - (st.hurt > 0 ? 0.25 : 0), st.headYaw * 0.8 - spY * 0.55, Math.sin(t * 0.9) * 0.03 * (1 - m));

    // springs: hair, plume, cloth swing with speed, acceleration, turning and step bounce
    const pitchT = clamp(speed * 0.04 + accF * 0.012 - st.hipVy * 0.5 + (air ? up * 0.25 : 0), -0.35, 0.55);
    const rollT = clamp(accR * 0.01 - st.turn * speed * 0.02, -0.4, 0.4);
    for (const sp of springs) {
      sp.pv += (sp.k * (pitchT * sp.gain - sp.px) - sp.c * sp.pv) * dt; sp.px += sp.pv * dt;
      sp.rv += (sp.k * (rollT * sp.gain - sp.rx) - sp.c * sp.rv) * dt; sp.rx += sp.rv * dt;
      sp.obj.rotation.x = sp.base.x + sp.px;
      sp.obj.rotation.z = sp.base.z + sp.rx;
    }

    // face
    st.blinkT -= dt; st.blink -= dt;
    if (st.blinkT <= 0) { st.blink = 0.12; st.blinkT = 1.8 + Math.random() * 3.5; }
    if (st.emoteT > 0) st.emoteT -= dt;
    setExpr(st.hurt > 0 ? 'hurt' : p >= 0 && p < 0.6 ? 'attack' : st.emoteT > 0 ? st.emote : st.blink > 0 ? 'blink' : 'normal');

    // trail
    if (scene) {
      if (p >= 0.08 && p < 0.62) {
        tip.getWorldPosition(V1); base.getWorldPosition(V2);
        samples.unshift([V1.x, V1.y, V1.z, V2.x, V2.y, V2.z]);
        if (samples.length > TRAIL_N) samples.pop();
      } else if (samples.length) samples.splice(-Math.min(samples.length, 3));
      for (let i = 0; i < TRAIL_N; i++) {
        const sm = samples[Math.min(i, samples.length - 1)] || [0, -9, 0, 0, -9, 0], fade = samples.length ? Math.pow(1 - i / TRAIL_N, 1.6) : 0;
        trailPos.set(sm, i * 6);
        for (let j = 0; j < 2; j++) { const b = fade * (j ? 0.25 : 1); trailCol.set([trailColor.r * b, trailColor.g * b, trailColor.b * b], i * 6 + j * 3); }
      }
      trailGeo.attributes.position.needsUpdate = trailGeo.attributes.color.needsUpdate = true;
      trail.visible = samples.length > 1;
    }

    // dust when a running foot lands
    if (scene && !air && speed > 3 && Math.sign(s1) !== Math.sign(st.lastS)) {
      (s1 > 0 ? J.ankleR : J.ankleL).getWorldPosition(V1);
      for (let i = 0; i < 3; i++) {
        const pf = new THREE.Mesh(PUFF_GEO, new THREE.MeshBasicMaterial({ color: '#efe4ff', transparent: true, opacity: 0.6, depthWrite: false }));
        pf.position.set(V1.x + (Math.random() - 0.5) * 0.15, 0.05, V1.z + (Math.random() - 0.5) * 0.15);
        pf.scale.setScalar(0.04);
        scene.add(pf);
        puffs.push({ m: pf, age: 0, vy: 0.3 + Math.random() * 0.3, vx: -fx * 0.6 + (Math.random() - 0.5) * 0.4, vz: -fz * 0.6 + (Math.random() - 0.5) * 0.4 });
      }
    }
    st.lastS = s1;
    for (let i = puffs.length - 1; i >= 0; i--) {
      const pf = puffs[i];
      pf.age += dt / 0.5;
      pf.m.position.x += pf.vx * dt; pf.m.position.y += pf.vy * dt; pf.m.position.z += pf.vz * dt;
      pf.m.scale.setScalar(0.04 + pf.age * 0.1);
      pf.m.material.opacity = 0.6 * (1 - pf.age);
      if (pf.age >= 1) { scene.remove(pf.m); pf.m.material.dispose(); puffs.splice(i, 1); }
    }

    // little extras
    if (ctx.wings) ctx.wings.forEach((w, i) => { w.rotation.y = (i ? -1 : 1) * (0.2 + Math.sin(t * (6 + speed * 3)) * 0.35); });
    if (ctx.orb) { ctx.orb.position.y = 0.1 + Math.sin(t * 2.5) * 0.02; ctx.orbRing.rotation.set(t * 1.7, t * 1.1, 0); }
    if (ctx.sparks) ctx.sparks.forEach((sp, i) => { const a = t * 3 + (i * Math.PI * 2) / 3; sp.position.set(0.04 + Math.cos(a) * 0.1, 0.08 + Math.sin(t * 4 + i) * 0.03, 0.04 + Math.sin(a) * 0.1); });
    if (ctx.light) ctx.light.intensity = 1.3 + Math.sin(t * 17) * 0.1 + Math.sin(t * 7.3) * 0.12;

    // pet follows behind and to the left
    if (pet && scene) {
      if (!pet.g.parent) scene.add(pet.g);
      const tx = pos.x + fz * 0.55 - fx * 0.6, tz = pos.z - fx * 0.55 - fz * 0.6;
      if (!st.petInit) { pet.g.position.set(tx, 0, tz); st.petInit = true; }
      const ox = pet.g.position.x, oz = pet.g.position.z;
      pet.g.position.x = damp(ox, tx, 4, dt); pet.g.position.z = damp(oz, tz, 4, dt);
      const pv = Math.hypot(pet.g.position.x - ox, pet.g.position.z - oz) / dt;
      if (pv > 0.2) pet.g.rotation.y = damp(pet.g.rotation.y, pet.g.rotation.y + wrap(Math.atan2(pet.g.position.x - ox, pet.g.position.z - oz) - pet.g.rotation.y), 8, dt);
      else pet.g.rotation.y += wrap(h - pet.g.rotation.y) * Math.min(1, dt * 3);
      if (pet.float) {
        pet.body.position.y = 0.95 + Math.sin(t * 2.2) * 0.08;
        if (pet.ring) pet.ring.rotation.set(t * 1.3, t * 0.7, 0);
        if (pet.light) pet.light.intensity = 0.7 + Math.sin(t * 9) * 0.15;
        if (pet.legs) pet.legs.forEach((l, i) => { l.rotation.x = Math.sin(t * 5 + i) * 0.35; });
      } else {
        const hop = pet.type === 'baby_slime' ? Math.abs(Math.sin(t * (pv > 0.2 ? 9 : 3))) : (pv > 0.2 ? Math.abs(Math.sin(t * 12)) * 0.4 : 0);
        pet.body.position.y = hop * 0.12;
        if (pet.type === 'baby_slime') pet.body.scale.set(1 + (1 - hop) * 0.12, 1 - (1 - hop) * 0.12, 1 + (1 - hop) * 0.12);
        if (pet.tail) pet.tail.rotation.y = Math.sin(t * (pv > 0.2 ? 12 : 3)) * 0.4;
      }
    }
  }

  return {
    root, update,
    caster: W && W.cast ? W.cast : null,   // { color, cd, range, aoe, size } for wands and staffs
    tipWorld: (v) => tip.getWorldPosition(v),
    hurt() { st.hurt = 0.4; },
    dispose() { // remove the bits that live in the scene rather than under root
      trail.removeFromParent();
      if (pet) pet.g.removeFromParent();
      puffs.forEach((pf) => pf.m.removeFromParent());
    },
    emote(name, dur = 0.8) { st.emote = name; st.emoteT = dur; },
    setVisible(v) { root.visible = v; },
  };
}
