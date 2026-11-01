/* ============================================================================
   blenderhero.js: the fully modelled, rigged hero from tools/blender/character.py.

     await loadBlenderHero('/game/assets3d/hero_blender.glb');
     const hero = makeBlenderHero(look);   // same API as makeHero3D (root, update, caster, tipWorld, ...)

   The model is skinned to a 19-bone rig; its one animation timeline is cut into
   idle / walk / run / attack clips. Idle, walk and run blend by how fast the
   root moves (like hero3d), the attack plays once per swing, the eyes bone
   squashes for blinks, and weapons from hero3d hang off the hand bones.
   The look is fixed for now (default hair and clothes); gear only adds weapons.
   ============================================================================ */
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';
import { heroToon, HERO_OUTLINE, buildWeapon } from '/game/lib/hero3d.js';

const CLIPS = { idle: [1, 48], walk: [60, 84], run: [100, 116], attack: [130, 148] };
let SRC = null;
export async function loadBlenderHero(url) { SRC = await new GLTFLoader().loadAsync(url); }

const damp = (a, b, k, dt) => a + (b - a) * (1 - Math.exp(-k * dt));

export function makeBlenderHero(look = {}) {
  const eq = look.equipment || {};
  const model = SkeletonUtils.clone(SRC.scene);
  const root = new THREE.Group();
  root.add(model);
  const mat = heroToon('#ffffff', { vc: true });
  model.traverse((o) => {
    if (!o.isSkinnedMesh) return;
    o.material = mat;
    o.castShadow = true;
    o.frustumCulled = false;
    const shell = new THREE.SkinnedMesh(o.geometry, HERO_OUTLINE); // ink outline: back faces pushed out, same skeleton
    shell.bind(o.skeleton, o.bindMatrix);
    shell.frustumCulled = false;
    o.parent.add(shell);
  });
  const bone = (n) => model.getObjectByName(n);
  const B = { eyes: bone('eyes'), chest: bone('chest'), handR: bone('handR'), handL: bone('handL') };

  // clips cut from the single timeline
  const mixer = new THREE.AnimationMixer(model), base = SRC.animations[0];
  const act = {};
  for (const [name, [a, b]] of Object.entries(CLIPS)) {
    act[name] = mixer.clipAction(THREE.AnimationUtils.subclip(base, name, a, b, 24));
    if (name === 'attack') { act[name].setLoop(THREE.LoopOnce); act[name].clampWhenFinished = false; }
    else { act[name].play(); act[name].setEffectiveWeight(name === 'idle' ? 1 : 0); }
  }

  // weapons on the hand bones: held the way hero3d holds them (blade forward, poles upright and leaning out),
  // worked out from each hand bone's rest orientation so the bone's own axes don't matter
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
    g.position.copy(new THREE.Vector3(0, -0.04, 0.01).applyQuaternion(qBone)); // into the fist
    const tip = new THREE.Object3D();
    tip.position.set(...W.tip);
    g.add(tip);
    return { W, tip };
  };
  const R = hold(B.handR, eq.rhand, -1), L = hold(B.handL, eq.lhand, 1);

  const st = { prev: new THREE.Vector3(), speed: 0, atk: -1, atkL: -1, blinkT: 2, blink: 0, hurt: 0, first: true };
  return {
    root,
    caster: R && R.W.cast ? R.W.cast : null,
    casterL: L && L.W.cast ? L.W.cast : null,
    tipWorld: (v) => (R ? R.tip : B.handR).getWorldPosition(v),
    tipWorldL: (v) => (L ? L.tip : B.handL).getWorldPosition(v),
    update(dt, s = {}) {
      const pos = root.position;
      if (st.first) { st.prev.copy(pos); st.first = false; }
      const v = Math.hypot(pos.x - st.prev.x, pos.z - st.prev.z) / Math.max(dt, 1e-4);
      st.prev.copy(pos);
      st.speed = damp(st.speed, v < 0.05 ? 0 : v, 10, dt);
      const m = Math.min(1, st.speed / 2.5), r = Math.min(1, Math.max(0, (st.speed - 4.2) / 3.2));
      act.idle.setEffectiveWeight(1 - m);
      act.walk.setEffectiveWeight(m * (1 - r));
      act.run.setEffectiveWeight(m * r);
      act.walk.timeScale = Math.max(0.6, st.speed / 4.2);
      act.run.timeScale = Math.max(0.7, st.speed / 7.4);
      for (const k of ['atk', 'atkL']) { // a new swing from either hand plays the slash once
        const p = s[k] ?? -1;
        if (p >= 0 && (st[k] < 0 || p < st[k])) act.attack.reset().setEffectiveWeight(1).play();
        st[k] = p;
      }
      mixer.update(dt);
      // blink: squash the eyes bone for a moment every few seconds
      st.blinkT -= dt; st.blink -= dt;
      if (st.blinkT <= 0) { st.blink = 0.12; st.blinkT = 1.8 + Math.random() * 3.5; }
      if (B.eyes) B.eyes.scale.set(1, 1, st.blink > 0 ? 0.12 : 1);
      if (st.hurt > 0) { st.hurt -= dt; if (B.chest) B.chest.rotation.x -= Math.sin(Math.min(1, st.hurt / 0.4) * Math.PI) * 0.35; }
    },
    hurt() { st.hurt = 0.4; },
    emote() {},
    dispose() {},
    setVisible(v) { root.visible = v; },
  };
}
