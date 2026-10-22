/* ============================================================================
   Character sprite renderer, Gen-3 / GBA style to match the map art (player.webp).

   Everything is drawn procedurally on a 40 x 48 grid of material keys, so skin,
   hair and every piece of gear can be swapped. A shading pass then gives each
   region a top-left highlight and a bottom-right shade (2px on wide parts), hair
   and hats cast a shadow on the face, and every empty pixel touching the sprite
   becomes a dark outline tinted from its neighbour. Output is a cached PNG <img>;
   show it at whole-number scales (40, 80, 120, 160px wide) to keep pixels crisp.
   ============================================================================ */
(function (root) {
  const W = 40, H = 48;
  const SKINS = ['#f6d3b3', '#e8b48a', '#c98c5a', '#9a6238', '#6b4428'];
  const HAIRS = ['#2a2630', '#6b3f1d', '#e0b85c', '#b4432e', '#dcd8d0', '#3f5ba0'];

  const hex = (c) => [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16));
  const mix = (a, b, t) => { const B = hex(b); return '#' + hex(a).map((v, i) => Math.round(v + (B[i] - v) * t).toString(16).padStart(2, '0')).join(''); };
  const lite = (c) => mix(c, '#fff4dc', 0.28);
  const dark = (c) => mix(c, '#2a1840', 0.38);          // shadows shift toward purple, like the map art
  const line = (c) => mix(c, '#100a18', 0.8);

  /* ---------- body: shirt / sleeves / legs per armour piece ---------- */
  const OUTFITS = {
    bare:         { shirt: '#d23c34', sleeves: 'short', pants: '#34509e', boots: '#3b3640', extra: 'tee' },
    steel_armor:  { shirt: '#a3acb9', sleeve: '#7d8696', sleeves: 'long', gloves: '#8f98a6', pants: '#6a7280', boots: '#7f8896', belt: '#5a4632', buckle: '#e0b450', extra: 'knight' },
    mage_robe:    { shirt: '#5b3f9a', sleeves: 'wide', boots: '#2e2244', belt: '#d9b04f', robe: true, extra: 'robe' },
    ranger_tunic: { shirt: '#4f8a3c', sleeves: 'long', bracer: '#7a5230', pants: '#7a5a3a', boots: '#4a3020', bootTop: 40, belt: '#6b4a2e', buckle: '#e0b450', extra: 'ranger' },
    rogue_tunic:  { shirt: '#3c3c4a', sleeves: 'long', bracer: '#26232e', pants: '#2c2c38', boots: '#1f1d26', bootTop: 41, belt: '#2a2430', buckle: '#9aa3b0', extra: 'rogue' },
  };

  const EXTRAS = {
    tee(d) { d.fill(18, 23, 21, 23, 'skinArm'); d.fill(19, 24, 20, 24, 'skinArm'); },
    knight(d) {
      d.fill(13, 35, 26, 36, 'mail');
      d.fill(17, 25, 22, 36, 'tabard'); d.fill(19, 28, 20, 29, 'emblem');
      d.sym(10, 23, 13, 23, 'pauldron'); d.sym(9, 24, 13, 26, 'pauldron');
    },
    robe(d) {
      d.fill(13, 35, 26, 37, 'body'); d.fill(12, 38, 27, 40, 'body'); d.fill(11, 41, 28, 44, 'body');
      d.fill(19, 24, 20, 43, 'trim'); d.fill(11, 44, 28, 44, 'trim'); d.sym(9, 33, 13, 33, 'trim');
      d.fill(14, 45, 18, 45, 'boot'); d.fill(21, 45, 25, 45, 'boot');
    },
    ranger(d) {
      d.fill(13, 35, 26, 36, 'body'); d.fill(19, 36, 20, 36, 'pants');
      for (let i = 0; i < 12; i++) { const y = 24 + Math.floor(i * 0.75); d.px(14 + i, y, 'strap'); d.px(14 + i, y + 1, 'strap'); }
    },
    rogue(d) { d.fill(15, 22, 24, 24, 'scarf'); d.fill(14, 25, 15, 29, 'scarf'); d.fill(23, 35, 25, 37, 'pouch'); },
  };

  function body(d, f) {
    if (!f.robe) {
      const top = f.bootTop || 43;
      d.fill(13, 35, 26, 36, 'pants'); d.fill(13, 37, 18, top - 1, 'pants'); d.fill(21, 37, 26, top - 1, 'pants');
      d.fill(13, top, 18, 44, 'boot'); d.fill(12, 45, 18, 45, 'boot');
      d.fill(21, top, 26, 44, 'boot'); d.fill(21, 45, 27, 45, 'boot');
    }
    d.span(23, 14, 25, 'body'); d.fill(13, 24, 26, 34, 'body');
    d.sym(11, 24, 12, 24, 'arm');
    if (f.sleeves === 'wide') { d.sym(10, 25, 12, 30, 'arm'); d.sym(9, 31, 13, 33, 'arm'); }
    else d.sym(10, 25, 12, f.sleeves === 'short' ? 27 : 33, 'arm');
    if (f.sleeves === 'short') d.sym(10, 28, 12, 33, 'skinArm');
    if (f.bracer) d.sym(10, 31, 12, 33, 'bracer');
    d.fill(10, 34, 12, 35, 'hand'); d.fill(11, 36, 12, 36, 'hand');      // left hand; the right one goes on after the weapon
    if (f.belt) { d.fill(13, 33, 26, 34, 'belt'); if (f.buckle) d.fill(19, 33, 20, 34, 'buckle'); }
    d.fill(17, 22, 22, 22, 'neck');
    EXTRAS[f.extra](d);
  }

  /* ---------- head ---------- */
  function face(d, o) {
    d.rows(7, [[15, 24], [14, 25]], 'skin'); d.fill(13, 9, 26, 18, 'skin'); d.rows(19, [[14, 25], [15, 24], [16, 23]], 'skin');
    if (o.hs === 'bald') { d.rows(4, [[16, 23], [14, 25], [13, 26], [13, 26], [13, 26]], 'skin'); d.fill(15, 12, 16, 12, 'brow'); d.fill(23, 12, 24, 12, 'brow'); }
    d.sym(12, 14, 12, 16, 'ear');
    d.fill(15, 14, 16, 16, 'eye'); d.fill(23, 14, 24, 16, 'eye'); d.px(16, 14, 'eyeHi'); d.px(24, 14, 'eyeHi');
    d.fill(19, 19, 20, 19, 'mouth');
    d.px(14, 17, 'blush'); d.px(25, 17, 'blush');
  }

  // Big messy anime hair like the map sprite. Under a helm / hat / hood only the long locks show.
  function hair(d, o, capped) {
    if (o.hs === 'bald') return;
    if (!capped) {
      d.rows(1, [
        [[17, 18], [23, 24]],
        [[13, 14], [16, 19], [22, 25]],
        [[11, 27]],
        [[10, 29]],
        [[9, 30]],
      ], 'hair');
      d.fill(8, 6, 31, 10, 'hair');
      d.rows(11, [
        [[8, 14], [16, 19], [21, 24], [26, 31]],
        [[8, 13], [17, 18], [22, 23], [27, 31]],
        [[8, 12], [27, 31]],
        [[9, 12], [27, 30]],
        [[9, 11], [28, 30]],
        [[10, 10], [29, 29]],
      ], 'hair');
      d.sym(7, 6, 7, 9, 'hair'); d.px(6, 8, 'hair'); d.px(33, 7, 'hair'); d.px(10, 2, 'hair');   // stray spikes
      [[14, 6], [15, 7], [20, 4], [21, 5], [26, 7], [27, 8]].forEach(([x, y]) => d.px(x, y, 'hairDk'));   // strand lines
      d.rows(4, [[13, 16], [12, 13]], 'hairHi'); d.rows(5, [[21, 22]], 'hairHi');
    }
    if (o.hs === 'long') {
      d.sym(10, 12, 12, 28, 'hair'); d.sym(13, 12, 13, 15, 'hair'); d.sym(11, 29, 12, 29, 'hair');
      d.sym(11, 17, 11, 20, 'hairDk');
    }
  }

  function hood(d) {
    d.rows(2, [[18, 21], [15, 24], [13, 26]], 'hood'); d.fill(11, 5, 28, 10, 'hood');
    d.sym(10, 11, 13, 22, 'hood');
    d.fill(14, 11, 25, 11, 'hoodIn'); d.sym(14, 12, 14, 12, 'hoodIn');
    d.fill(11, 22, 28, 25, 'hood'); d.sym(10, 23, 10, 25, 'hood');     // capelet over the shoulders
  }

  const HEADS = {
    iron_helm(d) {
      d.rows(1, [[20, 22], [19, 24], [18, 24]], 'plume');
      d.rows(4, [[16, 23], [14, 25], [13, 26]], 'helm'); d.fill(12, 7, 27, 11, 'helm'); d.fill(12, 12, 27, 12, 'helmDark');
      d.sym(12, 13, 13, 18, 'helm'); d.fill(19, 13, 20, 15, 'helm');
      d.px(16, 6, 'helmHi'); d.px(15, 7, 'helmHi'); d.px(15, 8, 'helmHi');
      d.px(14, 12, 'rivet'); d.px(25, 12, 'rivet');
    },
    wizard_hat(d) {
      d.rows(1, [[23, 25], [21, 24], [19, 23], [18, 23], [17, 23], [16, 23], [15, 24]], 'hat');
      d.fill(14, 8, 25, 9, 'hatBand');
      d.rows(10, [[10, 29], [7, 32], [9, 30]], 'brim');
      d.px(20, 5, 'star');
    },
    ranger_hood: hood,
    rogue_hood(d) { hood(d); d.rows(17, [[14, 25], [14, 25], [14, 25], [15, 24], [16, 23]], 'mask'); },
    gold_crown(d) {
      d.fill(13, 3, 14, 5, 'crown'); d.fill(19, 2, 20, 5, 'crown'); d.fill(25, 3, 26, 5, 'crown');
      d.fill(13, 6, 26, 7, 'crown'); d.fill(19, 6, 20, 6, 'gem'); d.px(16, 6, 'gem2'); d.px(23, 6, 'gem2');
    },
  };

  /* ---------- weapons (right hand) ---------- */
  function sword(d) {
    d.px(30, 11, 'blade'); d.fill(30, 12, 31, 31, 'blade'); d.fill(30, 13, 30, 30, 'bladeHi');
    d.fill(28, 32, 33, 32, 'guard'); d.fill(30, 33, 31, 38, 'grip'); d.fill(30, 39, 31, 39, 'guard');
  }
  const sparks = (d, pts) => pts.forEach(([x, y]) => d.px(x, y, 'spark'));
  const WEAPONS = {
    iron_sword: sword,
    ember_blade(d) { sword(d); sparks(d, [[33, 14], [27, 19], [33, 23], [28, 27], [34, 29]]); },
    shadow_dagger(d) {
      d.px(30, 25, 'blade'); d.fill(30, 26, 31, 31, 'blade'); d.fill(30, 27, 30, 30, 'bladeHi');
      d.fill(29, 32, 32, 32, 'guard'); d.fill(30, 33, 31, 37, 'grip'); d.fill(30, 38, 31, 38, 'guard');
    },
    oak_staff(d) {
      d.fill(30, 6, 31, 44, 'staff'); d.fill(29, 6, 32, 6, 'staff');
      d.rows(1, [[30, 31], [29, 32], [29, 32], [29, 32], [30, 31]], 'orb'); d.px(30, 2, 'orbHi');
      sparks(d, [[27, 3], [34, 2], [34, 7]]);
    },
    hunter_bow(d) {
      d.fill(30, 23, 30, 44, 'string');
      for (let y = 22; y <= 45; y++) { const k = Math.abs(y - 34), x = 32 - Math.round(k * k / 55); d.fill(x, y, x + 1, y, 'bow'); }
    },
  };

  /* ---------- eyewear ---------- */
  const EYEWEAR = {
    round_specs(d) {
      d.fill(14, 13, 17, 16, 'lens'); d.fill(22, 13, 25, 16, 'lens');
      d.fill(15, 14, 16, 15, 'lensIn'); d.fill(23, 14, 24, 15, 'lensIn');
      d.fill(18, 14, 21, 14, 'lensBridge');
      d.px(13, 14, 'lensBridge'); d.px(26, 14, 'lensBridge');
    },
  };

  /* ---------- left hand ---------- */
  const LHANDS = {
    wooden_shield(d) {
      d.fill(7, 28, 9, 28, 'shield');
      d.fill(6, 29, 10, 32, 'shield');
      d.fill(7, 33, 9, 33, 'shield');
      d.fill(7, 29, 8, 30, 'shieldHi');
      d.px(8, 31, 'shieldBoss');
    },
  };

  /* ---------- feet overlays ---------- */
  const FEET_VIS = {
    winged_boots(d) {
      d.fill(9, 40, 10, 40, 'wing'); d.fill(8, 41, 9, 41, 'wing'); d.fill(9, 42, 11, 42, 'wing'); d.fill(8, 43, 9, 43, 'wing');
      d.px(9, 40, 'wingHi'); d.px(10, 40, 'wingHi');
      d.fill(29, 40, 30, 40, 'wing'); d.fill(30, 41, 31, 41, 'wing'); d.fill(28, 42, 30, 42, 'wing'); d.fill(30, 43, 31, 43, 'wing');
      d.px(29, 40, 'wingHi'); d.px(30, 40, 'wingHi');
    },
  };

  /* ---------- pets ---------- */
  const PETS = {
    baby_slime(d) {
      d.fill(34, 40, 35, 40, 'slime');
      d.fill(33, 41, 36, 41, 'slime');
      d.fill(32, 42, 37, 43, 'slime');
      d.fill(33, 44, 36, 44, 'slime');
      d.px(33, 41, 'slimeHi'); d.px(34, 41, 'slimeHi');
      d.px(34, 42, 'slimeEye'); d.px(36, 42, 'slimeEye');
    },
  };

  /* ---------- materials ---------- */
  const CAST = new Set(['hair', 'helm', 'helmDark', 'hat', 'hatBand', 'brim', 'hood', 'hoodIn', 'crown']);

  function materials(o, f, eq) {
    const skin = SKINS[o.skin] || SKINS[1], hc = HAIRS[o.hc] || HAIRS[0];
    const rogue = eq.head === 'rogue_hood';
    const blade = { ember_blade: ['#ff5a2e', '#ffd36e'], shadow_dagger: ['#8d93c4', '#dfe3ff'] }[eq.rhand] || ['#c3ccd8', '#f4f8fc'];
    return {
      skin: { c: skin }, ear: { c: skin }, skinArm: { c: skin }, hand: { c: f.gloves || skin },
      neck: { c: dark(skin), flat: true },
      eye: { c: '#1a1422', flat: true, base: 'skin' }, eyeHi: { c: '#ffffff', flat: true, base: 'skin' },
      mouth: { c: mix(skin, '#8a2c2c', 0.4), flat: true, base: 'skin' },
      blush: { c: mix(skin, '#ff7a7a', 0.22), flat: true, base: 'skin' },
      brow: { c: dark(hc), flat: true, base: 'skin' },
      hair: { c: hc }, hairBack: { c: dark(hc) }, hairHi: { c: mix(hc, '#ffffff', 0.38), flat: true, base: 'hair' },
      hairDk: { c: dark(dark(hc)), flat: true, base: 'hair' },

      body: { c: f.shirt }, arm: { c: f.sleeve || f.shirt }, pants: { c: f.pants || f.shirt }, boot: { c: f.boots },
      belt: { c: f.belt || f.shirt }, buckle: { c: f.buckle || '#e0b450', flat: true, base: 'belt' }, bracer: { c: f.bracer || f.shirt },
      trim: { c: '#d9b04f' }, pauldron: { c: '#b4bcc8' }, tabard: { c: '#b2363a' }, emblem: { c: '#e8c060', flat: true, base: 'tabard' },
      mail: { c: '#7d8696' }, strap: { c: '#6b4a2e' }, scarf: { c: '#5a3570' }, pouch: { c: '#6b4a2e' },

      helm: { c: '#a9b2bf' }, helmDark: { c: '#6e7684' }, helmHi: { c: '#eef2f7', flat: true, base: 'helm' },
      rivet: { c: '#e0b450', flat: true, base: 'helmDark' }, plume: { c: '#c23b3b' },
      hat: { c: '#5b3f9a' }, hatBand: { c: '#d9b04f' }, brim: { c: '#4e3588' }, star: { c: '#ffe680', flat: true, base: 'hat' },
      hood: { c: rogue ? '#3c3c4a' : '#4f8a3c' }, hoodIn: { c: rogue ? '#1c1a24' : '#24381d', flat: true }, mask: { c: '#26252f' },
      crown: { c: '#e0b450' }, gem: { c: '#e0302a', flat: true, base: 'crown' }, gem2: { c: '#3a7bd5', flat: true, base: 'crown' },

      blade: { c: blade[0] }, bladeHi: { c: blade[1], flat: true, base: 'blade' },
      guard: { c: eq.rhand === 'shadow_dagger' ? '#3c3646' : '#d9b04f' }, grip: { c: '#5a3a22' },
      staff: { c: '#7a5230' }, orb: { c: '#4fc3ff' }, orbHi: { c: '#e8fbff', flat: true, base: 'orb' },
      bow: { c: '#8b5e3c' }, string: { c: '#efe6cf', flat: true, noLine: true },
      quiver: { c: '#7a5230' }, fletch: { c: '#eae4d6' },
      spark: { c: eq.rhand === 'oak_staff' ? '#9fe6ff' : '#ffc46a', flat: true, noLine: true, a: 0.85 },

      lens: { c: '#1a1422' }, lensIn: { c: '#2a3a5a', flat: true, base: 'lens' },
      lensBridge: { c: '#a0a8b4', flat: true, base: 'skin' },
      shield: { c: '#8b6b3e' }, shieldHi: { c: '#c9a664', flat: true, base: 'shield' },
      shieldBoss: { c: '#a0a8b4', flat: true, base: 'shield' },
      slime: { c: '#5ec45e' }, slimeHi: { c: '#a0e8a0', flat: true, base: 'slime' },
      slimeEye: { c: '#1a1422', flat: true, base: 'slime' },
      wing: { c: '#f0e8d8' }, wingHi: { c: '#ffffff', flat: true, base: 'wing' },
    };
  }

  /* ---------- paint ---------- */
  function paint(o) {
    const g = new Array(W * H).fill(null);
    const px = (x, y, m) => { if (x >= 0 && y >= 0 && x < W && y < H) g[y * W + x] = m; };
    const fill = (x0, y0, x1, y1, m) => { for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) px(x, y, m); };
    const span = (y, a, b, m) => fill(a, y, b, y, m);
    const d = {
      px, fill, span,
      rows: (y0, list, m) => list.forEach((s, i) => (Array.isArray(s[0]) ? s : [s]).forEach(([a, b]) => span(y0 + i, a, b, m))),
      sym: (x0, y0, x1, y1, m) => { fill(x0, y0, x1, y1, m); fill(W - 1 - x1, y0, W - 1 - x0, y1, m); },
    };
    const eq = o.equipment || {};
    const f = OUTFITS[eq.body] || OUTFITS.bare;
    const weapon = WEAPONS[eq.rhand];

    if (o.hs === 'long') fill(10, 12, 29, 31, 'hairBack');
    if (eq.rhand === 'hunter_bow') { fill(7, 20, 9, 31, 'quiver'); fill(7, 17, 9, 19, 'fletch'); px(8, 16, 'fletch'); }
    body(d, f);
    if (LHANDS[eq.lhand]) LHANDS[eq.lhand](d);
    if (FEET_VIS[eq.feet]) FEET_VIS[eq.feet](d);
    face(d, o);
    if (EYEWEAR[eq.eyes]) EYEWEAR[eq.eyes](d);
    hair(d, o, eq.head && eq.head !== 'gold_crown' && !!HEADS[eq.head]);
    if (HEADS[eq.head]) HEADS[eq.head](d);
    if (weapon) { weapon(d); fill(28, 34, 31, 36, 'hand'); }
    else { fill(27, 34, 29, 35, 'hand'); fill(27, 36, 28, 36, 'hand'); }
    if (PETS[eq.pet]) PETS[eq.pet](d);
    return { g, M: materials(o, f, eq) };
  }

  function render(o) {
    const { g, M } = paint(o);
    const at = (x, y) => (x >= 0 && y >= 0 && x < W && y < H ? g[y * W + x] : null);
    const c = document.createElement('canvas'); c.width = W; c.height = H;
    const ctx = c.getContext('2d');
    ctx.fillStyle = 'rgba(18, 10, 30, 0.3)';                  // ground shadow
    ctx.fillRect(11, 46, 18, 1); ctx.fillRect(14, 47, 12, 1);
    const img = ctx.getImageData(0, 0, W, H), out = img.data;
    const put = (i, col, a = 1) => {
      const [r, gg, b] = hex(col), k = i * 4, t = a + (out[k + 3] / 255) * (1 - a);
      out[k] = r; out[k + 1] = gg; out[k + 2] = b; out[k + 3] = Math.round(t * 255);
    };

    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const k = at(x, y), i = y * W + x;
      if (k) {
        const m = M[k];
        if (m.flat) { put(i, m.c, m.a || 1); continue; }
        const same = (dx, dy) => { const n = at(x + dx, y + dy); return n === k || (n && M[n].base === k); };
        let col = m.c;
        if (k === 'skin' && CAST.has(at(x, y - 1))) col = dark(m.c);
        else if (!same(1, 0) || !same(0, 1) || (!same(2, 0) && same(-2, 0))) col = dark(m.c);
        else if (!same(-1, 0) || !same(0, -1)) col = lite(m.c);
        put(i, col);
      } else {
        for (const [dx, dy] of [[0, 1], [0, -1], [-1, 0], [1, 0]]) {
          const n = at(x + dx, y + dy);
          if (n && !M[n].noLine) { put(i, line(M[n].base ? M[M[n].base].c : M[n].c)); break; }
        }
      }
    }
    ctx.putImageData(img, 0, 0);
    return c;
  }

  const cache = new Map();
  function html(o) {
    const eq = o.equipment || {};
    const key = [o.skin, o.hc, o.hs, eq.head, eq.eyes, eq.body, eq.rhand, eq.lhand, eq.feet, eq.pet].join('|');
    if (!cache.has(key)) cache.set(key, render(o).toDataURL());
    return `<img class="sprite" src="${cache.get(key)}" width="${W}" height="${H}" alt="" draggable="false">`;
  }

  // --- Direction + walk-frame rendering for map sprites ---

  function paintDir(o, dir, frame) {
    if (dir === 'right') {
      var r = paintDir(o, 'left', frame);
      var fg = new Array(W * H).fill(null);
      for (var yy = 0; yy < H; yy++) for (var xx = 0; xx < W; xx++) fg[yy * W + (W - 1 - xx)] = r.g[yy * W + xx];
      return { g: fg, M: r.M };
    }
    if (dir === 'down' && frame === 0) return paint(o);

    var g = new Array(W * H).fill(null);
    var px = function (x, y, m) { if (x >= 0 && y >= 0 && x < W && y < H) g[y * W + x] = m; };
    var fill = function (x0, y0, x1, y1, m) { for (var yy = y0; yy <= y1; yy++) for (var xx = x0; xx <= x1; xx++) px(xx, yy, m); };
    var span = function (y, a, b, m) { fill(a, y, b, y, m); };
    var d = {
      px: px, fill: fill, span: span,
      rows: function (y0, list, m) { list.forEach(function (s, i) { (Array.isArray(s[0]) ? s : [s]).forEach(function (ab) { span(y0 + i, ab[0], ab[1], m); }); }); },
      sym: function (x0, y0, x1, y1, m) { fill(x0, y0, x1, y1, m); fill(W - 1 - x1, y0, W - 1 - x0, y1, m); },
    };

    var eq = o.equipment || {};
    var f = OUTFITS[eq.body] || OUTFITS.bare;
    var weapon = WEAPONS[eq.rhand];
    var capped = eq.head && eq.head !== 'gold_crown' && !!HEADS[eq.head];

    if (dir === 'left') {
      paintLeftView(d, o, f, eq, frame, capped);
      return { g: g, M: materials(o, f, eq) };
    }

    // Down frame 1 or Up — shared torso + arms
    if (o.hs === 'long') fill(10, 12, 29, 31, 'hairBack');
    if (eq.rhand === 'hunter_bow') { fill(7, 20, 9, 31, 'quiver'); fill(7, 17, 9, 19, 'fletch'); px(8, 16, 'fletch'); }

    if (!f.robe) {
      var top = f.bootTop || 43;
      fill(13, 35, 26, 36, 'pants');
      if (frame === 0) {
        fill(13, 37, 18, top - 1, 'pants'); fill(21, 37, 26, top - 1, 'pants');
        fill(13, top, 18, 44, 'boot'); fill(12, 45, 18, 45, 'boot');
        fill(21, top, 26, 44, 'boot'); fill(21, 45, 27, 45, 'boot');
      } else {
        fill(13, 38, 18, Math.min(top, 44), 'pants');
        fill(13, Math.min(top + 1, 45), 18, 45, 'boot'); fill(12, 46, 18, 46, 'boot');
        fill(21, 36, 26, Math.max(top - 2, 36), 'pants');
        fill(21, Math.max(top - 1, 37), 26, 43, 'boot'); fill(21, 44, 27, 44, 'boot');
      }
    }

    d.span(23, 14, 25, 'body'); fill(13, 24, 26, 34, 'body');
    d.sym(11, 24, 12, 24, 'arm');
    if (f.sleeves === 'wide') { d.sym(10, 25, 12, 30, 'arm'); d.sym(9, 31, 13, 33, 'arm'); }
    else d.sym(10, 25, 12, f.sleeves === 'short' ? 27 : 33, 'arm');
    if (f.sleeves === 'short') d.sym(10, 28, 12, 33, 'skinArm');
    if (f.bracer) d.sym(10, 31, 12, 33, 'bracer');
    fill(10, 34, 12, 35, 'hand'); fill(11, 36, 12, 36, 'hand');
    if (f.belt) { fill(13, 33, 26, 34, 'belt'); if (f.buckle) fill(19, 33, 20, 34, 'buckle'); }
    fill(17, 22, 22, 22, 'neck');
    EXTRAS[f.extra](d);
    if (LHANDS[eq.lhand]) LHANDS[eq.lhand](d);
    if (FEET_VIS[eq.feet]) FEET_VIS[eq.feet](d);

    if (dir === 'up') {
      d.rows(7, [[15, 24], [14, 25]], 'skin'); fill(13, 9, 26, 18, 'skin');
      d.rows(19, [[14, 25], [15, 24], [16, 23]], 'skin');
      if (o.hs === 'bald') {
        d.rows(4, [[16, 23], [14, 25], [13, 26], [13, 26], [13, 26]], 'skin');
      } else {
        fill(13, 7, 26, 20, 'hair');
        d.rows(1, [[[17, 18], [23, 24]], [[13, 14], [16, 19], [22, 25]], [[11, 27]], [[10, 29]], [[9, 30]]], 'hair');
        fill(8, 6, 31, 10, 'hair');
        d.sym(8, 11, 13, 16, 'hair');
        d.sym(7, 6, 7, 9, 'hair'); px(6, 8, 'hair'); px(33, 7, 'hair'); px(10, 2, 'hair');
        [[16, 9], [20, 7], [24, 9], [18, 14], [22, 13]].forEach(function (p) { px(p[0], p[1], 'hairDk'); });
        d.rows(5, [[21, 22]], 'hairHi'); d.rows(4, [[13, 16]], 'hairHi');
      }
      if (o.hs === 'long') {
        d.sym(10, 12, 12, 28, 'hair'); d.sym(13, 12, 13, 15, 'hair');
        d.sym(11, 29, 12, 29, 'hair'); d.sym(11, 17, 11, 20, 'hairDk');
      }
      if (HEADS[eq.head]) HEADS[eq.head](d);
    } else {
      face(d, o);
      if (EYEWEAR[eq.eyes]) EYEWEAR[eq.eyes](d);
      hair(d, o, capped);
      if (HEADS[eq.head]) HEADS[eq.head](d);
    }

    if (weapon) { weapon(d); fill(28, 34, 31, 36, 'hand'); }
    else { fill(27, 34, 29, 35, 'hand'); fill(27, 36, 28, 36, 'hand'); }
    if (PETS[eq.pet]) PETS[eq.pet](d);

    return { g: g, M: materials(o, f, eq) };
  }

  function paintLeftView(d, o, f, eq, frame, capped) {
    if (!f.robe) {
      var top = f.bootTop || 43;
      d.fill(14, 35, 24, 36, 'pants');
      if (frame === 0) {
        d.fill(14, 37, 18, top - 1, 'pants'); d.fill(20, 37, 24, top - 1, 'pants');
        d.fill(14, top, 18, 44, 'boot'); d.fill(13, 45, 18, 45, 'boot');
        d.fill(20, top, 24, 44, 'boot'); d.fill(20, 45, 25, 45, 'boot');
      } else {
        d.fill(12, 37, 16, Math.min(top, 44), 'pants');
        d.fill(12, Math.min(top + 1, 45), 16, 45, 'boot'); d.fill(11, 46, 16, 46, 'boot');
        d.fill(22, 36, 26, Math.max(top - 2, 36), 'pants');
        d.fill(22, Math.max(top - 1, 37), 26, 43, 'boot'); d.fill(22, 44, 27, 44, 'boot');
      }
    }
    d.span(23, 15, 24, 'body'); d.fill(13, 24, 25, 34, 'body');
    d.fill(10, 24, 12, 24, 'arm');
    if (f.sleeves === 'wide') { d.fill(9, 25, 12, 30, 'arm'); d.fill(8, 31, 12, 33, 'arm'); }
    else d.fill(9, 25, 12, f.sleeves === 'short' ? 27 : 33, 'arm');
    if (f.sleeves === 'short') d.fill(9, 28, 12, 33, 'skinArm');
    if (f.bracer) d.fill(9, 31, 12, 33, 'bracer');
    d.fill(9, 34, 11, 35, 'hand'); d.fill(10, 36, 11, 36, 'hand');
    if (f.belt) { d.fill(13, 33, 25, 34, 'belt'); if (f.buckle) d.fill(18, 33, 19, 34, 'buckle'); }
    d.fill(16, 22, 21, 22, 'neck');
    if (f.extra === 'tee') { d.fill(11, 23, 12, 23, 'skinArm'); }
    else if (f.extra === 'knight') {
      d.fill(13, 35, 25, 36, 'mail');
      d.fill(16, 25, 22, 36, 'tabard'); d.fill(18, 28, 19, 29, 'emblem');
      d.fill(8, 23, 12, 23, 'pauldron'); d.fill(7, 24, 12, 26, 'pauldron');
    } else if (f.extra === 'robe') {
      d.fill(13, 35, 25, 37, 'body'); d.fill(12, 38, 26, 40, 'body'); d.fill(11, 41, 27, 44, 'body');
      d.fill(18, 24, 19, 43, 'trim'); d.fill(11, 44, 27, 44, 'trim');
      d.fill(14, 45, 17, 45, 'boot'); d.fill(21, 45, 24, 45, 'boot');
    } else if (f.extra === 'ranger') {
      d.fill(13, 35, 25, 36, 'body');
      for (var i = 0; i < 10; i++) { var y = 24 + Math.floor(i * 0.75); d.px(14 + i, y, 'strap'); }
    } else if (f.extra === 'rogue') {
      d.fill(14, 22, 23, 24, 'scarf'); d.fill(13, 25, 14, 29, 'scarf');
      d.fill(22, 35, 24, 37, 'pouch');
    }

    d.rows(7, [[13, 23], [12, 24]], 'skin');
    d.fill(11, 9, 25, 18, 'skin');
    d.rows(19, [[12, 24], [13, 23], [14, 22]], 'skin');
    d.fill(10, 14, 10, 16, 'ear');
    d.fill(13, 14, 14, 16, 'eye'); d.px(14, 14, 'eyeHi');
    d.fill(15, 19, 16, 19, 'mouth');
    d.px(12, 17, 'blush');

    if (o.hs !== 'bald') {
      if (!capped) {
        d.rows(1, [[[16, 17], [22, 23]], [[15, 18], [21, 25]], [[14, 28]], [[13, 29]], [[12, 30]]], 'hair');
        d.fill(11, 6, 31, 10, 'hair');
        d.fill(25, 11, 31, 15, 'hair'); d.fill(26, 16, 30, 17, 'hair'); d.fill(27, 18, 29, 18, 'hair');
        d.fill(11, 11, 14, 13, 'hair');
        d.px(7, 8, 'hair'); d.px(33, 7, 'hair'); d.px(10, 2, 'hair');
        [[14, 7], [20, 5], [26, 8]].forEach(function (p) { d.px(p[0], p[1], 'hairDk'); });
        d.rows(5, [[21, 22]], 'hairHi'); d.rows(4, [[12, 14]], 'hairHi');
      }
      if (o.hs === 'long') {
        d.fill(25, 12, 28, 28, 'hair'); d.fill(26, 29, 28, 29, 'hair');
        d.fill(26, 17, 26, 20, 'hairDk');
      }
    } else if (!capped) {
      d.rows(4, [[14, 22], [12, 24], [11, 25], [11, 25], [11, 25]], 'skin');
      d.fill(13, 12, 14, 12, 'brow');
    }
    if (HEADS[eq.head]) HEADS[eq.head](d);
  }

  function renderDir(o, dir, frame) {
    var gm = paintDir(o, dir, frame), g = gm.g, M = gm.M;
    var at = function (x, y) { return (x >= 0 && y >= 0 && x < W && y < H ? g[y * W + x] : null); };
    var c = document.createElement('canvas'); c.width = W; c.height = H;
    var ctx = c.getContext('2d');
    ctx.fillStyle = 'rgba(18, 10, 30, 0.3)';
    ctx.fillRect(11, 46, 18, 1); ctx.fillRect(14, 47, 12, 1);
    var img = ctx.getImageData(0, 0, W, H), out = img.data;
    var put = function (i, col, a) {
      if (a === undefined) a = 1;
      var rgb = hex(col), k = i * 4, t = a + (out[k + 3] / 255) * (1 - a);
      out[k] = rgb[0]; out[k + 1] = rgb[1]; out[k + 2] = rgb[2]; out[k + 3] = Math.round(t * 255);
    };
    for (var y = 0; y < H; y++) for (var x = 0; x < W; x++) {
      var k = at(x, y), i = y * W + x;
      if (k) {
        var m = M[k];
        if (m.flat) { put(i, m.c, m.a || 1); continue; }
        var same = function (dx, dy) { var n = at(x + dx, y + dy); return n === k || (n && M[n].base === k); };
        var col = m.c;
        if (k === 'skin' && CAST.has(at(x, y - 1))) col = dark(m.c);
        else if (!same(1, 0) || !same(0, 1) || (!same(2, 0) && same(-2, 0))) col = dark(m.c);
        else if (!same(-1, 0) || !same(0, -1)) col = lite(m.c);
        put(i, col);
      } else {
        for (var di = 0; di < 4; di++) {
          var dd = [[0, 1], [0, -1], [-1, 0], [1, 0]][di];
          var n = at(x + dd[0], y + dd[1]);
          if (n && !M[n].noLine) { put(i, line(M[n].base ? M[M[n].base].c : M[n].c)); break; }
        }
      }
    }
    ctx.putImageData(img, 0, 0);
    return c;
  }

  function renderAll(o) {
    var r = {};
    ['down', 'up', 'left', 'right'].forEach(function (dir) {
      r[dir + '_0'] = renderDir(o, dir, 0);
      r[dir + '_1'] = renderDir(o, dir, 1);
    });
    return r;
  }

  root.SPRITE = { W, H, SKINS, HAIRS, render, html, renderDir, renderAll };
})(this);
