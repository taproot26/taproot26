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

  /* ---------- materials ---------- */
  const CAST = new Set(['hair', 'helm', 'helmDark', 'hat', 'hatBand', 'brim', 'hood', 'hoodIn', 'crown']);

  function materials(o, f, eq) {
    const skin = SKINS[o.skin] || SKINS[1], hc = HAIRS[o.hc] || HAIRS[0];
    const rogue = eq.head === 'rogue_hood';
    const blade = { ember_blade: ['#ff5a2e', '#ffd36e'], shadow_dagger: ['#8d93c4', '#dfe3ff'] }[eq.weapon] || ['#c3ccd8', '#f4f8fc'];
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
      guard: { c: eq.weapon === 'shadow_dagger' ? '#3c3646' : '#d9b04f' }, grip: { c: '#5a3a22' },
      staff: { c: '#7a5230' }, orb: { c: '#4fc3ff' }, orbHi: { c: '#e8fbff', flat: true, base: 'orb' },
      bow: { c: '#8b5e3c' }, string: { c: '#efe6cf', flat: true, noLine: true },
      quiver: { c: '#7a5230' }, fletch: { c: '#eae4d6' },
      spark: { c: eq.weapon === 'oak_staff' ? '#9fe6ff' : '#ffc46a', flat: true, noLine: true, a: 0.85 },
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
    const weapon = WEAPONS[eq.weapon];

    if (o.hs === 'long') fill(10, 12, 29, 31, 'hairBack');
    if (eq.weapon === 'hunter_bow') { fill(7, 20, 9, 31, 'quiver'); fill(7, 17, 9, 19, 'fletch'); px(8, 16, 'fletch'); }
    body(d, f);
    face(d, o);
    hair(d, o, eq.head && eq.head !== 'gold_crown' && !!HEADS[eq.head]);
    if (HEADS[eq.head]) HEADS[eq.head](d);
    if (weapon) { weapon(d); fill(28, 34, 31, 36, 'hand'); }
    else { fill(27, 34, 29, 35, 'hand'); fill(27, 36, 28, 36, 'hand'); }
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
    const key = [o.skin, o.hc, o.hs, eq.head, eq.body, eq.weapon].join('|');
    if (!cache.has(key)) cache.set(key, render(o).toDataURL());
    return `<img class="sprite" src="${cache.get(key)}" width="${W}" height="${H}" alt="" draggable="false">`;
  }

  root.SPRITE = { W, H, SKINS, HAIRS, render, html };
})(this);
