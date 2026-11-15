/* ============================================================================
   glbhero.js: a ready-made, Mixamo-rigged character GLB (e.g. from Tripo) as the hero.

     await loadGlbHero('/game/assets/characterart/rogue.glb');
     const hero = makeGlbHero(look);   // same API as makeHero3D / makeBlenderHero

   Uses the model's own textures and named clips: idle / walk / run as the base layer, an air pose
   scrubbed by vertical speed, and attack / hurt / emote clips laid over the upper body,
   scales it to the hero's height and hangs hero3d weapons off the mixamo hand bones.
   ============================================================================ */
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';
import { buildWeapon } from '/game/lib/hero3d.js';

const HEIGHT = 1.55; // matches HERO_H in world3d
const HURT = 0.45;   // seconds the hit reaction plays over
// Windows inside rouge.glb's clips, read off its bone curves: box_01's punch peaks at 0.46s and is
// back by ~1s; chop winds up 0.75-2.0s and strikes at ~2.1s. Tune here if a new model differs.
const OVERLAYS = {
  punch: { clip: 'box_01', from: 0.05, to: 1.0 },
  chop: { clip: 'chop', from: 1.0, to: 2.6 },
  hurt: { clip: 'hit_to_body_01', from: 0.0, to: 0.9 },
  happy: { clip: 'agree', from: 0.0, to: 2.0 },
};
// Airborne: jump_down's leap (hips rise 1.25-1.5s) into its drop (2.0-2.3s), scrubbed by vertical speed.
const AIR = { clip: 'jump_down', rise: 1.45, fall: 2.2 };
const UPPER = /(Spine|Neck|Head|Shoulder|Arm|Hand)/;
let SRC = null;
export async function loadGlbHero(url) { SRC = await new GLTFLoader().loadAsync(url); }

const damp = (a, b, k, dt) => a + (b - a) * (1 - Math.exp(-k * dt));
const clip = (name) => SRC.animations.find((a) => a.name.toLowerCase() === name);

export function makeGlbHero(look = {}) {
  const eq = look.equipment || {};
  const model = SkeletonUtils.clone(SRC.scene);
  const root = new THREE.Group();
  root.add(model);
  model.traverse((o) => {
    if (!o.isMesh) return;
    o.castShadow = true;
    o.frustumCulled = false; // skinned bounds don't follow the animation
  });

  // stand on the ground, HEIGHT tall
  model.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(model, true);
  const h = Math.max(1e-3, box.max.y - box.min.y);
  model.scale.setScalar(HEIGHT / h);
  model.position.y = -box.min.y * (HEIGHT / h);

  const bone = (n) => model.getObjectByName(n) || model.getObjectByName(n.replace(':', ''));
  const B = { handR: bone('mixamorig:RightHand'), handL: bone('mixamorig:LeftHand'), spine: bone('mixamorig:Spine1') };

  // Base layer: idle / walk / run, plus an air pose, all full-body and weights summing to 1.
  const mixer = new THREE.AnimationMixer(model);
  const act = {};
  const add = (key, c) => { if (c) act[key] = mixer.clipAction(c); };
  add('idle', clip('idle') || SRC.animations[0]);
  add('walk', clip('walk') || clip('run'));
  add('run', clip('run') || clip('walk'));
  add('air', clip(AIR.clip));
  for (const k of ['idle', 'walk', 'run']) if (act[k]) { act[k].play(); act[k].setEffectiveWeight(k === 'idle' ? 1 : 0); }
  if (act.air) { act.air.play(); act.air.paused = true; act.air.setEffectiveWeight(0); }

  // Overlay layer: attack / hurt / emote clips cut down to the upper body and scrubbed by hand,
  // then slerped over the base pose, so the legs keep walking while the arms swing.
  const omix = new THREE.AnimationMixer(model);
  const upper = (c) => c && new THREE.AnimationClip(c.name + '_upper', c.duration,
    c.tracks.filter((t) => t.name.endsWith('.quaternion') && UPPER.test(t.name)));
  const OV = {};
  for (const [k, def] of Object.entries(OVERLAYS)) {
    const c = upper(clip(def.clip));
    if (!c) continue;
    const a = omix.clipAction(c);
    a.play(); a.paused = true; a.enabled = false;
    OV[k] = { ...def, a };
  }
  const oBones = [];
  for (const o of Object.values(OV)) for (const t of o.a.getClip().tracks) {
    const b = model.getObjectByName(t.name.split('.')[0]);
    if (b && !oBones.includes(b)) oBones.push(b);
  }
  const saved = oBones.map(() => new THREE.Quaternion());
  const swingKey = eq.rhand && OV.chop ? 'chop' : OV.punch ? 'punch' : null; // armed: chop, bare hands: punch
  // p 0..1 through the overlay → its weight: quick blend in, slower blend out
  const ramp = (p, i = 0.12, o = 0.25) => Math.min(1, p / i, (1 - p) / o);
  function overlay(key, p) {
    const o = OV[key];
    if (!o) return;
    const w = Math.max(0, Math.min(1, ramp(p)));
    if (w <= 0) return;
    oBones.forEach((b, i) => saved[i].copy(b.quaternion));
    for (const x of Object.values(OV)) x.a.enabled = x === o;
    o.a.time = o.from + (o.to - o.from) * p;
    omix.update(0);
    oBones.forEach((b, i) => b.quaternion.copy(saved[i].slerp(b.quaternion, w)));
  }

  // weapons on the hand bones, oriented from each bone's rest pose so its own axes don't matter
  model.updateMatrixWorld(true);
  const REST = { blade: 1.85, wand: 1.5, pole: 0.75 };
  const hold = (b, id, side) => {
    if (!b || !id) return null;
    const g = new THREE.Group(), qBone = b.getWorldQuaternion(new THREE.Quaternion()).invert();
    b.add(g);
    const W = buildWeapon(id, g);
    if (!W) { g.removeFromParent(); return null; }
    const want = new THREE.Quaternion().setFromEuler(new THREE.Euler(REST[W.type] ?? 1.5, 0, W.type === 'pole' ? -0.3 * side : 0));
    g.quaternion.copy(qBone).multiply(want);
    const ws = b.getWorldScale(new THREE.Vector3()).x || 1;
    g.scale.setScalar(1 / ws); // weapons are built in world units; undo the model's scale
    g.position.copy(new THREE.Vector3(0, -0.04, 0.01).applyQuaternion(qBone).multiplyScalar(1 / ws));
    const tip = new THREE.Object3D();
    tip.position.set(...W.tip);
    g.add(tip);
    return { W, tip };
  };
  const R = hold(B.handR, eq.rhand, -1), L = hold(B.handL, eq.lhand, 1);

  const st = { prev: new THREE.Vector3(), speed: 0, air: 0, hurt: 0, emote: null, emoteT: 0, emoteDur: 1, first: true };
  return {
    root,
    caster: R && R.W.cast ? R.W.cast : null,
    casterL: L && L.W.cast ? L.W.cast : null,
    tipWorld: (v) => (R ? R.tip : B.handR || root).getWorldPosition(v),
    tipWorldL: (v) => (L ? L.tip : B.handL || root).getWorldPosition(v),
    update(dt, s = {}) {
      const pos = root.position;
      if (st.first) { st.prev.copy(pos); st.first = false; }
      const v = Math.hypot(pos.x - st.prev.x, pos.z - st.prev.z) / Math.max(dt, 1e-4);
      st.prev.copy(pos);
      st.speed = damp(st.speed, v < 0.05 ? 0 : v, 10, dt);
      const m = Math.min(1, st.speed / 2.5), r = Math.min(1, Math.max(0, (st.speed - 4.2) / 3.2));
      if (act.walk) act.walk.timeScale = Math.max(0.6, st.speed / 2.5);
      if (act.run) act.run.timeScale = Math.max(0.7, st.speed / 6);
      const airT = s.air ? 1 : 0;
      st.air = damp(st.air, airT, airT ? 14 : 9, dt);
      const g = 1 - (act.air ? st.air : 0);
      act.idle?.setEffectiveWeight((1 - m) * g);
      act.walk?.setEffectiveWeight(m * (1 - r) * g);
      act.run?.setEffectiveWeight(m * r * g);
      if (act.air) {
        act.air.setEffectiveWeight(1 - g);
        const k = Math.max(0, Math.min(1, (7 - (s.vy ?? 0)) / 14)); // vy +7 (take-off) .. -7 (dropping)
        act.air.time = AIR.rise + (AIR.fall - AIR.rise) * k;
      }
      mixer.update(dt);

      // one overlay at a time, by priority: swing > hurt > emote
      const p = Math.max(s.atk ?? -1, s.atkL ?? -1);
      if (p >= 0 && swingKey) overlay(swingKey, Math.min(1, p));
      else if (st.hurt > 0) { st.hurt -= dt; overlay('hurt', 1 - Math.max(0, st.hurt) / HURT); }
      else if (st.emoteT > 0) { st.emoteT -= dt; overlay(st.emote, 1 - Math.max(0, st.emoteT) / st.emoteDur); }
    },
    hurt() { st.hurt = HURT; },
    emote(name, dur = 0.8) { if (OV[name]) { st.emote = name; st.emoteDur = st.emoteT = Math.max(dur, 1.2); } },
    dispose() { mixer.stopAllAction(); omix.stopAllAction(); },
    setVisible(v) { root.visible = v; },
  };
}
