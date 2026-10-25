/* ============================================================================
   stylized3d.js: reusable builders for Taproot's stylized low-poly 3D scenes.

   Import it from any page (plain ES module, Three.js r160 from the CDN):
     import { THREE, World, makeHero, animateHero, makeGolem, Slashes } from '/game/lib/stylized3d.js';

   World owns the scene, collision shapes, a seeded random and the uniforms the
   grass shader reads. Every builder adds meshes (shadows on) and registers a
   collider so `world.solid(x, z, r)` answers "is this spot blocked?".
     world.ground(), road(), grass(), flowers(), fence(), barrel(), crate(), wheel(),
     lampPost(), hayCart(), banner(), tree(), house(), well(), stall()
   Each frame: world.uniforms.time.value = t; world.uniforms.player.value.copy(pos).
   ============================================================================ */
import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js';

export { THREE };

export class World {
  constructor(scene, seed = 1337) {
    this.scene = scene;
    this.colliders = [];  // { c: [x, z, r] } circles, { b: [x0, z0, x1, z1], gaps } boxes
    this.roads = [];
    this.uniforms = { time: { value: 0 }, player: { value: new THREE.Vector3() } };
    let s = seed;
    this.rand = () => ((s = (s * 16807) % 2147483647) / 2147483647);
    this.mat = {
      wood: this.std('#8a5a32'), woodDark: this.std('#5e3b20'), woodLight: this.std('#a8743f'),
      iron: this.std('#3c3e46', { roughness: 0.55, metalness: 0.55 }), stone: this.std('#8c867a'),
      plaster: this.std('#efe2c4'), beam: this.std('#5a3a22'),
      glass: this.std('#ffe2a4', { emissive: '#ffb24a', emissiveIntensity: 0.9 }),
    };
  }

  std(color, extra = {}) { return new THREE.MeshStandardMaterial({ color, roughness: 0.85, ...extra }); }

  mesh(geo, mat, parent = this.scene, x = 0, y = 0, z = 0) {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z);
    m.castShadow = m.receiveShadow = true;
    parent.add(m);
    return m;
  }

  box(w, h, d, mat, parent, x, y, z) { return this.mesh(new THREE.BoxGeometry(w, h, d), mat, parent, x, y, z); }

  solid(x, z, r) {
    return this.colliders.some((o) => (o.c
      ? Math.hypot(x - o.c[0], z - o.c[1]) < o.c[2] + r
      : x > o.b[0] - r && x < o.b[2] + r && z > o.b[1] - r && z < o.b[3] + r
        && !(o.gaps || []).some(([gx, gz, gr]) => Math.hypot(x - gx, z - gz) < gr - r)));
  }

  onRoad(x, z, m = 0) { return this.roads.some(([x0, z0, x1, z1]) => x > x0 - m && x < x1 + m && z > z0 - m && z < z1 + m); }

  ground(color = '#4a7e2a', size = 160) {
    const g = this.mesh(new THREE.PlaneGeometry(size, size), this.std(color, { roughness: 1 }));
    g.rotation.x = -Math.PI / 2;
    g.castShadow = false;
    return g;
  }

  // Cobblestones painted on a canvas once and shared by every road.
  cobbleTexture() {
    if (this._cobble) return this._cobble;
    const c = document.createElement('canvas');
    c.width = c.height = 512;
    const g = c.getContext('2d');
    g.fillStyle = '#5a544b';
    g.fillRect(0, 0, 512, 512);
    const cell = 32;
    for (let gy = 0; gy < 16; gy++) for (let gx = 0; gx < 16; gx++) {
      const cx = gx * cell + cell / 2 + (gy % 2) * cell / 2 + (this.rand() - 0.5) * 6, cy = gy * cell + cell / 2 + (this.rand() - 0.5) * 6;
      const w = cell * 0.4 + this.rand() * 4, h = cell * 0.36 + this.rand() * 4, s = 150 + Math.floor(this.rand() * 45);
      for (const ox of [-512, 0, 512]) for (const oy of [-512, 0, 512]) {
        const grd = g.createLinearGradient(cx + ox - w, cy + oy - h, cx + ox + w, cy + oy + h);
        grd.addColorStop(0, `rgb(${s + 34},${s + 30},${s + 22})`);
        grd.addColorStop(1, `rgb(${s - 40},${s - 42},${s - 48})`);
        g.fillStyle = grd;
        g.beginPath(); g.roundRect(cx + ox - w, cy + oy - h, w * 2, h * 2, 7); g.fill();
      }
    }
    const t = new THREE.CanvasTexture(c);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 8;
    return (this._cobble = t);
  }

  road(x0, z0, x1, z1) {
    this.roads.push([x0, z0, x1, z1]);
    const t = this.cobbleTexture().clone();
    t.repeat.set((x1 - x0) / 3.2, (z1 - z0) / 3.2);
    t.needsUpdate = true;
    const r = this.mesh(new THREE.PlaneGeometry(x1 - x0, z1 - z0), this.std('#ffffff', { map: t, roughness: 0.95 }));
    r.rotation.x = -Math.PI / 2;
    r.position.set((x0 + x1) / 2, 0.012 + this.roads.length * 0.001, (z0 + z1) / 2);
    r.castShadow = false;
    return r;
  }

  // Instanced grass blades: wind sway + they bend away from uniforms.player. Up-facing
  // normals light the blades like the ground, which gives the soft stylized look.
  grass({ x0, z0, x1, z1, count = 90000, height = 0.32, avoid = null }) {
    const g = new THREE.BufferGeometry();
    const w = 0.058, pts = [[-w, 0], [w, 0], [-w * 0.75, 0.35], [w * 0.75, 0.35], [-w * 0.4, 0.7], [w * 0.4, 0.7], [0, 1]];
    const pos = [], col = [], nrm = [];
    const base = new THREE.Color('#477f24'), tip = new THREE.Color('#b6e86c');
    for (const [x, y] of pts) {
      pos.push(x, y * height, 0);
      nrm.push(0, 1, 0);
      const c = base.clone().lerp(tip, Math.pow(y, 0.8));
      col.push(c.r, c.g, c.b);
    }
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(nrm, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    g.setIndex([0, 1, 2, 1, 3, 2, 2, 3, 4, 3, 5, 4, 4, 5, 6]);
    const mat = new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide });
    const U = this.uniforms;
    mat.onBeforeCompile = (shader) => {
      shader.uniforms.uTime = U.time;
      shader.uniforms.uPlayer = U.player;
      shader.vertexShader = 'uniform float uTime;\nuniform vec3 uPlayer;\n' + shader.vertexShader.replace('#include <project_vertex>', `
        vec4 local = vec4(transformed, 1.0);
        #ifdef USE_INSTANCING
          local = instanceMatrix * local;
          vec2 root = (modelMatrix * instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xz;
        #else
          vec2 root = vec2(0.0);
        #endif
        vec4 wp = modelMatrix * local;
        float h = clamp(position.y / ${height.toFixed(3)}, 0.0, 1.0), h2 = h * h;
        float wind = sin(uTime * 1.6 + root.x * 0.55 + root.y * 0.35) * 0.13 + sin(uTime * 2.9 + root.x * 1.7 - root.y) * 0.05;
        wp.x += wind * h2; wp.z += wind * 0.6 * h2;
        vec2 away = root - uPlayer.xz;
        float push = (1.0 - smoothstep(0.0, 0.95, length(away))) * h;
        wp.xz += normalize(away + 0.0001) * push * 0.42;
        wp.y -= push * 0.22;
        vec4 mvPosition = viewMatrix * wp;
        gl_Position = projectionMatrix * mvPosition;`);
    };
    const spots = [];
    for (let i = 0; i < count * 1.8 && spots.length < count; i++) {
      const x = x0 + this.rand() * (x1 - x0), z = z0 + this.rand() * (z1 - z0);
      if (this.onRoad(x, z, 0.15) || (avoid && avoid(x, z))) continue;
      spots.push([x, z]);
    }
    const inst = new THREE.InstancedMesh(g, mat, spots.length);
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), sc = new THREE.Vector3(), p = new THREE.Vector3(), tint = new THREE.Color();
    spots.forEach(([x, z], i) => {
      e.set((this.rand() - 0.5) * 0.22, this.rand() * Math.PI * 2, (this.rand() - 0.5) * 0.22);
      m4.compose(p.set(x, 0, z), q.setFromEuler(e), sc.set(1, 0.7 + this.rand() * 0.6, 1));
      inst.setMatrixAt(i, m4);
      inst.setColorAt(i, tint.setHSL(0.26 + (this.rand() - 0.5) * 0.04, 0.6 + this.rand() * 0.15, 0.5 + this.rand() * 0.08));
    });
    inst.receiveShadow = true;
    inst.frustumCulled = false;
    this.scene.add(inst);
    return inst;
  }

  flowers(n, x0, z0, x1, z1) {
    const pink = this.std('#ff8fb4', { emissive: '#ff5a90', emissiveIntensity: 0.15 }), cream = this.std('#fff2a8'), stem = this.std('#3c7a26');
    for (let i = 0; i < n; i++) {
      const x = x0 + this.rand() * (x1 - x0), z = z0 + this.rand() * (z1 - z0);
      if (this.onRoad(x, z, 0.5) || this.solid(x, z, 0.3)) continue;
      this.mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.42, 4), stem, this.scene, x, 0.21, z);
      this.mesh(new THREE.IcosahedronGeometry(0.07, 0), this.rand() > 0.3 ? pink : cream, this.scene, x, 0.45, z);
    }
  }

  fence(x0, z0, x1, z1, gaps = []) {
    const M = this.mat, len = Math.hypot(x1 - x0, z1 - z0), n = Math.max(1, Math.round(len / 1.7)), ang = Math.atan2(z1 - z0, x1 - x0);
    const at = (t) => [x0 + (x1 - x0) * t, z0 + (z1 - z0) * t];
    const inGap = (x, z) => gaps.some(([gx, gz, r]) => Math.hypot(x - gx, z - gz) < r);
    for (let i = 0; i <= n; i++) {
      const [x, z] = at(i / n);
      if (!inGap(x, z)) {
        const p = this.box(0.17, 1.05, 0.17, M.wood, this.scene, x, 0.52, z);
        p.rotation.set((this.rand() - 0.5) * 0.08, this.rand(), (this.rand() - 0.5) * 0.08);
      }
      if (i === n) break;
      const [xn, zn] = at((i + 1) / n), mx = (x + xn) / 2, mz = (z + zn) / 2;
      if (inGap(mx, mz)) continue;
      for (const y of [0.42, 0.78]) {
        const r = this.box(len / n + 0.1, 0.09, 0.07, y > 0.5 ? M.woodLight : M.wood, this.scene, mx, y, mz);
        r.rotation.y = -ang;
        r.rotation.z = (this.rand() - 0.5) * 0.05;
      }
    }
    const pad = 0.12;
    this.colliders.push({ b: [Math.min(x0, x1) - pad, Math.min(z0, z1) - pad, Math.max(x0, x1) + pad, Math.max(z0, z1) + pad], gaps });
  }

  barrel(x, z, y = 0) {
    const M = this.mat, prof = [];
    for (let i = 0; i <= 8; i++) { const t = i / 8; prof.push(new THREE.Vector2(0.34 + Math.sin(t * Math.PI) * 0.06, t * 0.9)); }
    const g = new THREE.Group();
    this.mesh(new THREE.LatheGeometry(prof, 14), M.wood, g);
    for (const by of [0.16, 0.74]) this.mesh(new THREE.CylinderGeometry(0.385, 0.385, 0.06, 14, 1, true), M.iron, g, 0, by, 0);
    this.mesh(new THREE.CircleGeometry(0.34, 14), M.woodDark, g, 0, 0.9, 0).rotation.x = -Math.PI / 2;
    g.position.set(x, y, z);
    this.scene.add(g);
    if (!y) this.colliders.push({ c: [x, z, 0.42] });
    return g;
  }

  crate(x, z, s = 0.9, ry = 0, y = 0) {
    const M = this.mat, g = new THREE.Group();
    this.box(s, s, s, M.woodLight, g);
    for (const [a, b] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) this.box(0.09, s + 0.02, 0.09, M.woodDark, g, a * (s / 2 - 0.03), 0, b * (s / 2 - 0.03));
    for (const k of [-1, 1]) this.box(0.08, s * 1.25, 0.02, M.woodDark, g, 0, 0, k * (s / 2 + 0.01)).rotation.z = 0.78 * k;
    g.position.set(x, y + s / 2, z);
    g.rotation.y = ry;
    this.scene.add(g);
    if (!y) this.colliders.push({ c: [x, z, s * 0.6] });
    return g;
  }

  wheel(x, z) {
    const M = this.mat, g = new THREE.Group();
    this.mesh(new THREE.TorusGeometry(0.55, 0.08, 6, 20), M.woodDark, g);
    this.mesh(new THREE.TorusGeometry(0.6, 0.03, 4, 20), M.iron, g);
    this.mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.2, 10), M.iron, g).rotation.x = Math.PI / 2;
    for (let i = 0; i < 6; i++) this.box(0.06, 1.04, 0.05, M.wood, g).rotation.z = (i / 6) * Math.PI;
    g.position.set(x, 0.6, z);
    g.rotation.set(-0.25, 0.6, 0);
    this.scene.add(g);
    this.colliders.push({ c: [x, z, 0.5] });
    return g;
  }

  lampPost(x, z, ry = 0) {
    const M = this.mat, g = new THREE.Group();
    this.box(0.2, 3.4, 0.2, M.woodDark, g, 0, 1.7, 0);
    this.box(1.3, 0.14, 0.14, M.woodDark, g, -0.55, 3.25, 0);
    this.box(0.1, 0.8, 0.1, M.woodDark, g, -0.25, 2.9, 0).rotation.z = -0.78;
    this.box(0.03, 0.3, 0.03, M.iron, g, -1.05, 3.05, 0);
    this.box(0.3, 0.42, 0.3, M.iron, g, -1.05, 2.72, 0);
    this.box(0.22, 0.3, 0.32, this.std('#fff2c0', { emissive: '#ffcc66', emissiveIntensity: 1.6 }), g, -1.05, 2.72, 0);
    const light = new THREE.PointLight('#ffc470', 6, 6, 2);
    light.position.set(-1.05, 2.6, 0);
    g.add(light);
    g.position.set(x, 0, z);
    g.rotation.y = ry;
    this.scene.add(g);
    this.colliders.push({ c: [x, z, 0.25] });
    return g;
  }

  hayCart(x, z, ry = -0.5) {
    const M = this.mat, g = new THREE.Group();
    this.box(2.2, 0.16, 1.4, M.wood, g, 0, 0.7, 0);
    for (const k of [-1, 1]) this.box(2.3, 0.45, 0.1, M.woodDark, g, 0, 0.98, k * 0.7);
    this.mesh(new THREE.SphereGeometry(1, 14, 10), this.std('#e2b442', { roughness: 1 }), g, 0, 1.15, 0).scale.set(1.15, 0.62, 0.75);
    for (const [wx, wz] of [[-0.75, 0.82], [0.75, 0.82], [-0.75, -0.82], [0.75, -0.82]]) {
      this.mesh(new THREE.TorusGeometry(0.4, 0.08, 6, 16), M.woodDark, g, wx, 0.42, wz);
      this.mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.14, 8), M.iron, g, wx, 0.42, wz).rotation.x = Math.PI / 2;
    }
    for (const k of [-1, 1]) this.box(1.6, 0.1, 0.1, M.wood, g, 1.8, 0.62, k * 0.45).rotation.z = -0.15;
    g.position.set(x, 0, z);
    g.rotation.y = ry;
    this.scene.add(g);
    this.colliders.push({ c: [x, z, 1.35] });
    return g;
  }

  banner(x, z, color = '#2a3a7a') {
    this.mesh(new THREE.CylinderGeometry(0.07, 0.09, 4.2, 8), this.mat.woodDark, this.scene, x, 2.1, z);
    const cloth = this.mesh(new THREE.PlaneGeometry(0.8, 1.5, 4, 6), this.std(color, { side: THREE.DoubleSide }), this.scene, x + 0.42, 3.2, z);
    this.colliders.push({ c: [x, z, 0.15] });
    return cloth;
  }

  tree(x, z, s = 1) {
    this.mesh(new THREE.CylinderGeometry(0.22 * s, 0.32 * s, 2.4 * s, 7), this.mat.woodDark, this.scene, x, 1.2 * s, z);
    const leaf = ['#2f6a24', '#3f8a2c', '#4f9e36'].map((c) => this.std(c, { flatShading: true }));
    for (let i = 0; i < 6; i++) {
      const r = (1.0 + this.rand() * 0.6) * s;
      this.mesh(new THREE.IcosahedronGeometry(r, 0), leaf[i % 3], this.scene, x + (this.rand() - 0.5) * 1.8 * s, (2.6 + this.rand() * 1.4) * s, z + (this.rand() - 0.5) * 1.8 * s);
    }
    this.colliders.push({ c: [x, z, 0.4 * s] });
  }

  // Timber-framed house: stone base, plaster walls with beams, a pitched roof with
  // overhang, chimney, door, glowing windows with flower boxes, optional hanging sign.
  // Built facing local +Z, then rotated by `facing` (radians) around Y.
  house({ x, z, w = 5, d = 4.4, h = 3.2, roof = '#b4482e', facing = 0, chimney = true, sign = null, floors = 1 }) {
    const M = this.mat, g = new THREE.Group(), r = this.rand;
    const roofMat = this.std(roof, { flatShading: true }), trim = this.std(new THREE.Color(roof).multiplyScalar(0.6).getStyle(), { flatShading: true });
    this.box(w + 0.12, 0.7, d + 0.12, M.stone, g, 0, 0.35, 0);
    this.box(w, h - 0.7, d, M.plaster, g, 0, 0.7 + (h - 0.7) / 2, 0);
    for (const [cx, cz] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) this.box(0.16, h - 0.7, 0.16, M.beam, g, cx * w / 2, 0.7 + (h - 0.7) / 2, cz * d / 2);
    for (const y of floors > 1 ? [0.75, (h + 0.7) / 2, h] : [0.75, h]) {
      this.box(w + 0.04, 0.15, 0.15, M.beam, g, 0, y, d / 2); this.box(w + 0.04, 0.15, 0.15, M.beam, g, 0, y, -d / 2);
      this.box(0.15, 0.15, d + 0.04, M.beam, g, w / 2, y, 0); this.box(0.15, 0.15, d + 0.04, M.beam, g, -w / 2, y, 0);
    }
    const rh = d * 0.45, o = 0.4, run = d / 2 + o, drop = rh * run / (d / 2), L = Math.hypot(run, drop), th = Math.atan2(rh, d / 2);
    for (const k of [1, -1]) {
      const slab = this.box(w + 0.7, 0.16, L, roofMat, g, 0, h + rh - drop / 2, k * run / 2);
      slab.rotation.x = k * th;
    }
    this.box(w + 0.75, 0.18, 0.22, trim, g, 0, h + rh + 0.02, 0);  // ridge cap
    const tri = new THREE.Shape([new THREE.Vector2(-w / 2, 0), new THREE.Vector2(w / 2, 0), new THREE.Vector2(0, rh)]);
    this.mesh(new THREE.ExtrudeGeometry(tri, { depth: d - 0.04, bevelEnabled: false }), M.plaster, g, 0, h, -d / 2 + 0.02);
    if (chimney) this.box(0.55, 1.7, 0.55, M.stone, g, w / 4, h + rh * 0.75, -d / 6);
    const front = d / 2 + 0.05, doorX = w > 4.6 ? -w / 4 : 0;
    this.box(0.98, 1.66, 0.1, M.beam, g, doorX, 0.83, front - 0.01);
    this.box(0.8, 1.5, 0.08, this.std('#6e4428'), g, doorX, 0.78, front + 0.01);
    this.box(0.06, 0.06, 0.04, this.std('#e0b048', { metalness: 0.7, roughness: 0.35 }), g, doorX + 0.28, 0.8, front + 0.06);
    this.box(1.2, 0.12, 0.5, M.stone, g, doorX, 0.06, front + 0.25);
    const win = (wx, wy, wz, ry) => {
      const wg = new THREE.Group();
      this.box(0.86, 0.86, 0.1, M.beam, wg);
      this.box(0.66, 0.66, 0.08, M.glass, wg, 0, 0, 0.02);
      this.box(0.06, 0.66, 0.1, M.beam, wg, 0, 0, 0.03); this.box(0.66, 0.06, 0.1, M.beam, wg, 0, 0, 0.03);
      this.box(0.96, 0.08, 0.2, M.beam, wg, 0, -0.47, 0.06);
      if (r() > 0.35) {  // flower box
        this.box(0.84, 0.16, 0.18, this.std('#6a4228'), wg, 0, -0.6, 0.12);
        for (let i = 0; i < 4; i++) this.mesh(new THREE.IcosahedronGeometry(0.07, 0), this.std(['#ff7aa8', '#ffe066', '#ff5a5a', '#c08aff'][Math.floor(r() * 4)]), wg, -0.3 + i * 0.2, -0.48, 0.14);
      }
      wg.position.set(wx, wy, wz);
      wg.rotation.y = ry;
      g.add(wg);
    };
    const wy = floors > 1 ? 1.75 : 1.9;
    win(w > 4.6 ? w / 4 : w / 2 - 0.9, wy, front, 0);
    if (floors > 1) { win(-w / 4, h - 0.85, front, 0); win(w / 4, h - 0.85, front, 0); }
    win(w / 2 + 0.05, wy, 0, Math.PI / 2); win(-w / 2 - 0.05, wy, 0, -Math.PI / 2);
    if (sign) {
      this.box(0.08, 0.08, 0.9, M.iron, g, doorX + 0.9, 2.2, front + 0.4);
      const board = this.box(0.7, 0.5, 0.06, this.std(sign), g, doorX + 0.9, 1.85, front + 0.75);
      board.rotation.y = Math.PI / 2;
    }
    g.position.set(x, 0, z);
    g.rotation.y = facing;
    this.scene.add(g);
    const side = Math.abs(Math.sin(facing)) > 0.5, hw = (side ? d : w) / 2 + 0.1, hd = (side ? w : d) / 2 + 0.1;
    this.colliders.push({ b: [x - hw, z - hd, x + hw, z + hd] });
    return g;
  }

  well(x, z) {
    const M = this.mat, g = new THREE.Group();
    this.mesh(new THREE.CylinderGeometry(0.85, 0.9, 0.85, 14), M.stone, g, 0, 0.42, 0);
    this.mesh(new THREE.CircleGeometry(0.68, 14), this.std('#1e3a4a', { roughness: 0.2 }), g, 0, 0.86, 0).rotation.x = -Math.PI / 2;
    for (const k of [-1, 1]) this.box(0.14, 2.0, 0.14, M.woodDark, g, k * 0.75, 1.0, 0);
    for (const k of [-1, 1]) this.box(2.0, 0.12, 0.9, this.std('#7a3a24', { flatShading: true }), g, 0, 2.15 - 0.05, k * 0.32).rotation.x = k * 0.6;
    this.box(1.5, 0.08, 0.08, M.wood, g, 0, 1.55, 0);
    this.mesh(new THREE.CylinderGeometry(0.14, 0.11, 0.22, 8), M.wood, g, 0.2, 1.25, 0);
    g.position.set(x, 0, z);
    this.scene.add(g);
    this.colliders.push({ c: [x, z, 1.0] });
    return g;
  }

  // Market stall with a striped awning and a counter of goods.
  stall(x, z, stripe = '#c8383a', ry = 0) {
    const M = this.mat, g = new THREE.Group();
    const c = document.createElement('canvas');
    c.width = 64; c.height = 8;
    const ctx = c.getContext('2d');
    for (let i = 0; i < 8; i++) { ctx.fillStyle = i % 2 ? '#f4ead6' : stripe; ctx.fillRect(i * 8, 0, 8, 8); }
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    for (const [px, pz] of [[-1.3, -0.7], [1.3, -0.7], [-1.3, 0.7], [1.3, 0.7]]) this.box(0.12, 2.3, 0.12, M.woodDark, g, px, 1.15, pz);
    this.box(2.8, 0.9, 0.9, M.wood, g, 0, 0.45, 0.35);
    this.box(2.9, 0.08, 1.0, M.woodLight, g, 0, 0.94, 0.35);
    const awning = this.box(3.0, 0.06, 1.9, this.std('#ffffff', { map: tex }), g, 0, 2.35, 0.15);
    awning.rotation.x = 0.22;
    const goods = ['#e0402e', '#f0952a', '#7ac23a', '#ffd84a'];
    for (let i = 0; i < 9; i++) this.mesh(new THREE.SphereGeometry(0.11, 8, 6), this.std(goods[i % 4]), g, -1.05 + (i % 9) * 0.26, 1.06, 0.2 + (i % 2) * 0.22);
    g.position.set(x, 0, z);
    g.rotation.y = ry;
    this.scene.add(g);
    this.colliders.push({ c: [x, z, 1.5] });
    return g;
  }
}

/* ---------- hero: a jointed low-poly character ---------- */
export function makeHero(world, look = {}) {
  const C = { skin: '#f0c4a0', leather: '#7a4a2e', leatherDark: '#4a2c1a', cloth: '#3b3654', hair: '#f4f4f8', boots: '#2e2420', shield: '#6a48d8', blade: '#ff4ab8', ...look };
  const m = {
    skin: world.std(C.skin), leather: world.std(C.leather), leatherDark: world.std(C.leatherDark), cloth: world.std(C.cloth),
    metal: world.std('#aab4c0', { roughness: 0.4, metalness: 0.6 }), hair: world.std(C.hair, { roughness: 0.6 }), boots: world.std(C.boots),
    gold: world.std('#e0b048', { roughness: 0.35, metalness: 0.7 }), shield: world.std(C.shield, { roughness: 0.5, metalness: 0.2 }),
    blade: new THREE.MeshStandardMaterial({ color: '#ffc0ec', emissive: C.blade, emissiveIntensity: 1.5, roughness: 0.2 }),
  };
  const W = world, root = new THREE.Group(), hips = new THREE.Group(), J = { hips };
  hips.position.y = 0.95;
  root.add(hips);
  for (const side of [-1, 1]) {
    const hip = new THREE.Group(), knee = new THREE.Group();
    hip.position.x = side * 0.11;
    hips.add(hip);
    W.mesh(new THREE.CapsuleGeometry(0.075, 0.28, 4, 8), m.cloth, hip, 0, -0.2, 0);
    knee.position.y = -0.43;
    hip.add(knee);
    W.mesh(new THREE.CapsuleGeometry(0.065, 0.28, 4, 8), m.cloth, knee, 0, -0.19, 0);
    W.box(0.14, 0.12, 0.25, m.boots, knee, 0, -0.42, 0.04);
    J[side < 0 ? 'hipL' : 'hipR'] = hip;
    J[side < 0 ? 'kneeL' : 'kneeR'] = knee;
  }
  const torso = new THREE.Group();
  hips.add(torso);
  J.torso = torso;
  W.mesh(new THREE.CapsuleGeometry(0.17, 0.3, 4, 10), m.leather, torso, 0, 0.3, 0).scale.set(1.2, 1, 0.82);
  W.box(0.3, 0.22, 0.05, m.leatherDark, torso, 0, 0.36, 0.13);
  W.mesh(new THREE.CylinderGeometry(0.21, 0.22, 0.07, 12), m.leatherDark, torso, 0, 0.08, 0);
  W.box(0.08, 0.07, 0.04, m.gold, torso, 0, 0.08, 0.2);
  const neck = new THREE.Group();
  neck.position.y = 0.62;
  torso.add(neck);
  W.mesh(new THREE.SphereGeometry(0.155, 16, 12), m.skin, neck, 0, 0.12, 0).scale.set(1, 1.08, 1);
  for (const sx of [-0.055, 0.055]) W.box(0.035, 0.045, 0.02, world.std('#2a2230'), neck, sx, 0.13, 0.148);
  W.mesh(new THREE.SphereGeometry(0.168, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.55), m.hair, neck, 0, 0.14, -0.012).rotation.x = -0.25;
  for (let i = 0; i < 9; i++) {  // spiky hair
    const a = (i / 9) * Math.PI * 2;
    const spike = W.mesh(new THREE.ConeGeometry(0.055, 0.2, 5), m.hair, neck, Math.sin(a) * 0.1, 0.26 + Math.cos(a) * 0.02, Math.cos(a) * 0.09 - 0.03);
    spike.rotation.set(-0.6 - Math.cos(a) * 0.6, 0, Math.sin(a) * 0.9);
  }
  for (const side of [-1, 1]) {
    const sh = new THREE.Group(), el = new THREE.Group(), hand = new THREE.Group();
    sh.position.set(side * 0.27, 0.52, 0);
    torso.add(sh);
    W.mesh(new THREE.SphereGeometry(0.1, 10, 8, 0, Math.PI * 2, 0, Math.PI / 2), m.metal, sh, side * 0.02, 0.02, 0);
    W.mesh(new THREE.CapsuleGeometry(0.055, 0.2, 4, 8), m.leather, sh, 0, -0.15, 0);
    el.position.y = -0.3;
    sh.add(el);
    W.mesh(new THREE.CapsuleGeometry(0.05, 0.18, 4, 8), m.skin, el, 0, -0.12, 0);
    W.mesh(new THREE.CylinderGeometry(0.063, 0.058, 0.12, 8), m.leatherDark, el, 0, -0.1, 0);
    hand.position.y = -0.27;
    el.add(hand);
    W.mesh(new THREE.SphereGeometry(0.056, 8, 6), m.skin, hand);
    J[side < 0 ? 'shL' : 'shR'] = sh;
    J[side < 0 ? 'elL' : 'elR'] = el;
    J[side < 0 ? 'handL' : 'handR'] = hand;
  }
  const sword = new THREE.Group();
  J.handR.add(sword);
  W.mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.18, 6), m.leatherDark, sword);
  W.box(0.2, 0.035, 0.05, m.gold, sword, 0, 0.1, 0);
  const blade = W.mesh(new THREE.CylinderGeometry(0, 0.05, 0.85, 4), m.blade, sword, 0, 0.54, 0);
  blade.rotation.y = Math.PI / 4;
  blade.scale.z = 0.35;
  sword.rotation.x = Math.PI / 2;
  const shape = new THREE.Shape();
  shape.moveTo(0, 0.34);
  shape.quadraticCurveTo(0.26, 0.32, 0.25, 0.08); shape.quadraticCurveTo(0.2, -0.2, 0, -0.36);
  shape.quadraticCurveTo(-0.2, -0.2, -0.25, 0.08); shape.quadraticCurveTo(-0.26, 0.32, 0, 0.34);
  const shield = new THREE.Group();
  J.elL.add(shield);
  J.shield = shield;
  W.mesh(new THREE.ExtrudeGeometry(shape, { depth: 0.04, bevelEnabled: true, bevelSize: 0.025, bevelThickness: 0.02, bevelSegments: 1 }), m.gold, shield, 0, 0, -0.012).scale.set(1.08, 1.06, 1);
  W.mesh(new THREE.ExtrudeGeometry(shape, { depth: 0.05, bevelEnabled: false }), m.shield, shield);
  W.mesh(new THREE.OctahedronGeometry(0.06, 0), m.gold, shield, 0, 0.04, 0.075);
  shield.position.set(-0.1, -0.12, 0.02);
  shield.rotation.y = -Math.PI / 2;
  root.userData.J = J;
  world.scene.add(root);
  return root;
}

const lerp = (a, b, t) => a + (b - a) * t;
const ease = (t) => 1 - Math.pow(1 - t, 3);

// A = { phase, move (0..1.25), atk (-1 idle or 0..1 progress), dir (+1/-1 swing side), block (0..1) }
export function animateHero(hero, A, dt, t) {
  const J = hero.userData.J, sw = Math.sin(A.phase), m = A.move;
  J.hipL.rotation.x = sw * 0.75 * m;
  J.hipR.rotation.x = -sw * 0.75 * m;
  J.kneeL.rotation.x = Math.max(0, Math.sin(A.phase + 1.3)) * 1.1 * m;
  J.kneeR.rotation.x = Math.max(0, Math.sin(A.phase + 1.3 + Math.PI)) * 1.1 * m;
  J.hips.position.y = 0.95 + Math.abs(Math.cos(A.phase)) * 0.05 * m + Math.sin(t * 2.2) * 0.006;
  J.torso.rotation.x = 0.08 * m;
  J.shL.rotation.x = lerp(-sw * 0.55 * m, -1.25, A.block);
  J.shL.rotation.y = lerp(0, 0.6, A.block);
  J.elL.rotation.x = lerp(-0.15, -0.9, A.block);
  J.shield.rotation.y = lerp(-Math.PI / 2, -0.25, A.block);
  if (A.atk >= 0) {
    const p = A.atk, d = A.dir;
    if (p < 0.22) {
      const k = ease(p / 0.22);
      J.torso.rotation.y = d * 0.9 * k; J.shR.rotation.x = -1.45 * k; J.shR.rotation.z = d * 0.3 * k;
    } else if (p < 0.5) {
      const k = ease((p - 0.22) / 0.28);
      J.torso.rotation.y = d * (0.9 - 1.95 * k); J.shR.rotation.x = -1.45; J.shR.rotation.z = d * (0.3 - 0.6 * k);
    } else {
      const k = ease((p - 0.5) / 0.5);
      J.torso.rotation.y = d * -1.05 * (1 - k); J.shR.rotation.x = -1.45 * (1 - k); J.shR.rotation.z = d * -0.3 * (1 - k);
    }
    J.elR.rotation.x = -0.25;
  } else {
    J.torso.rotation.y = lerp(J.torso.rotation.y, 0, Math.min(1, dt * 10));
    J.shR.rotation.x = sw * 0.55 * m - 0.15;
    J.shR.rotation.z = 0;
    J.elR.rotation.x = -0.35;
  }
}

/* ---------- training golem ---------- */
export function makeGolem(world, color = '#ee7a3a', light = '#f8964e') {
  const W = world, g = new THREE.Group();
  const body = W.std(color), lite = W.std(light), dark = W.std('#4a2414');
  const parts = { mats: [body, lite] };
  W.box(0.66, 0.64, 0.48, body, g, 0, 0.8, 0);
  const head = W.box(0.52, 0.46, 0.46, lite, g, 0, 1.37, 0.02);
  for (const sx of [-0.12, 0.12]) W.box(0.09, 0.07, 0.02, dark, head, sx, 0.02, 0.235);
  W.box(0.3, 0.05, 0.02, dark, head, 0, 0.12, 0.235).rotation.z = 0.08;
  for (const sx of [-1, 1]) {
    W.box(0.1, 0.22, 0.1, lite, head, sx * 0.3, 0.12, 0).rotation.z = -sx * 0.4;
    parts[sx < 0 ? 'armL' : 'armR'] = W.box(0.2, 0.58, 0.2, body, g, sx * 0.46, 0.76, 0);
    W.box(0.22, 0.42, 0.24, dark, g, sx * 0.17, 0.22, 0);
  }
  world.scene.add(g);
  return Object.assign(parts, { g, head });
}

/* ---------- slash VFX: additive crescents + sparkles ---------- */
function crescent(R, w, arc) {
  const pos = [], idx = [], n = 28;
  for (let i = 0; i <= n; i++) {
    const t = i / n, a = -arc / 2 + arc * t, th = Math.sin(Math.PI * t);
    const ri = R - w * th, ro = R + w * th * 0.25;
    pos.push(Math.sin(a) * ri, 0, Math.cos(a) * ri, Math.sin(a) * ro, 0, Math.cos(a) * ro);
    if (i < n) idx.push(i * 2, i * 2 + 1, i * 2 + 2, i * 2 + 1, i * 2 + 3, i * 2 + 2);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  return g;
}

export class Slashes {
  constructor(world) {
    this.world = world;
    this.fx = [];
    this.geo = [crescent(1.25, 0.34, 2.7), crescent(1.0, 0.18, 2.3)];
  }

  spawn(x, z, heading, dir, colors = ['#ffffff', '#dcffb4']) {
    const scene = this.world.scene, rand = this.world.rand, grp = new THREE.Group();
    colors.forEach((color, i) => grp.add(new THREE.Mesh(this.geo[i], new THREE.MeshBasicMaterial({
      color, transparent: true, opacity: 0.95, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, depthWrite: false,
    }))));
    grp.position.set(x, 1.0, z);
    grp.rotation.y = heading;
    grp.scale.x = dir;
    scene.add(grp);
    this.fx.push({ obj: grp, life: 0.24, age: 0, spin: -dir * 0.7 });
    for (let i = 0; i < 10; i++) {
      const a = heading + (rand() - 0.5) * 2.4;
      const s = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.05, 0.05), new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true }));
      s.position.set(x + Math.sin(a) * 1.2, 0.9 + rand() * 0.4, z + Math.cos(a) * 1.2);
      scene.add(s);
      this.fx.push({ obj: s, life: 0.45, age: 0, v: [Math.sin(a) * 2.2, 1.2 + rand(), Math.cos(a) * 2.2] });
    }
  }

  update(dt) {
    for (let i = this.fx.length - 1; i >= 0; i--) {
      const f = this.fx[i];
      f.age += dt;
      const k = f.age / f.life;
      if (f.v) { f.obj.position.x += f.v[0] * dt; f.obj.position.y += f.v[1] * dt; f.obj.position.z += f.v[2] * dt; f.v[1] -= 6 * dt; }
      else { f.obj.rotation.y += f.spin * dt * 4; const s = 0.85 + k * 0.3; f.obj.scale.set(Math.sign(f.obj.scale.x) * s, 1, s); }
      f.obj.traverse((o) => { if (o.material) o.material.opacity = Math.max(0, 1 - k * k); });
      if (k >= 1) { this.world.scene.remove(f.obj); this.fx.splice(i, 1); }
    }
  }
}
