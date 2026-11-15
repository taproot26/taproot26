/* ============================================================================
   Building blocks for player plots. Edit the BLOCKS list freely (names, icons,
   prices); the order of BLOCK_IDS is the saved type id, so only add to the end.

   Everything else here is plain logic with no Three.js or DOM, so it runs in
   node tests too: storage for one plot's blocks, packing to a short string
   for saving and sharing, and the questions the game asks (how high is the
   ground here, is this spot blocked, what is the camera pointing at, can a
   block go here).

   Coordinates are plot-local: i along x and j along z (soil tiles, 0 at the
   plot's first soil tile), k is the level (0 sits on the soil). One block is
   1 x 1 x 1 tile.
   ============================================================================ */

export const BLOCKS = {
  planks: { name: 'Wood Planks', emoji: '\u{1FAB5}', price: 1, solid: true, see: false, shape: 'cube' },
  stone:  { name: 'Stone Brick', emoji: '\u{1F9F1}', price: 2, solid: true, see: false, shape: 'cube' },
  grass:  { name: 'Grass Block', emoji: '\u{1F7E9}', price: 1, solid: true, see: false, shape: 'cube' },
  glass:  { name: 'Glass',       emoji: '\u{1FA9F}', price: 3, solid: true, see: true,  shape: 'cube' },
  roof:   { name: 'Roof Tiles',  emoji: '\u{1F53A}', price: 2, solid: true, see: false, shape: 'slope' },
  door:   { name: 'Door',        emoji: '\u{1F6AA}', price: 10, solid: false, see: false, shape: 'door', tall: 2 },
};
export const BLOCK_IDS = ['planks', 'stone', 'grass', 'glass', 'roof', 'door'];
export const MAX_H = 12;

const DIM = 24; // packing assumes plots up to 24 x 24 soil
const MAX_CODE = (((DIM * DIM - 1) * MAX_H + MAX_H - 1) * BLOCK_IDS.length + BLOCK_IDS.length - 1) * 4 + 3;
const STEP_UP = 0.35; // how far up a slope you walk without jumping
const EPS = 0.05;

export class Voxels {
  constructor(nx, nz) { this.nx = nx; this.nz = nz; this.cells = new Map(); }
  key(i, j, k) { return (i * 64 + j) * 16 + k; }
  get(i, j, k) { return this.cells.get(this.key(i, j, k)) || null; }
  set(i, j, k, t, r = 0) {
    this.cells.set(this.key(i, j, k), { t, r });
    if (BLOCKS[t] && BLOCKS[t].tall === 2) this.cells.set(this.key(i, j, k + 1), { t, r, upper: true });
  }
  del(i, j, k) {
    const c = this.get(i, j, k);
    if (!c) return;
    this.cells.delete(this.key(i, j, k));
    if (BLOCKS[c.t] && BLOCKS[c.t].tall === 2) this.cells.delete(this.key(i, j, c.upper ? k - 1 : k + 1));
  }
  count() { let n = 0; this.forEach(() => n++); return n; }
  forEach(fn) {
    for (const [key, c] of this.cells) {
      if (c.upper) continue;
      fn(Math.floor(key / 1024), Math.floor(key / 16) % 64, key % 16, c.t, c.r);
    }
  }
}

export function pack(vox) {
  const codes = [];
  vox.forEach((i, j, k, t, r) => codes.push((((i * DIM + j) * MAX_H + k) * BLOCK_IDS.length + BLOCK_IDS.indexOf(t)) * 4 + r));
  return codes.sort((a, b) => a - b).map((c) => c.toString(36).padStart(4, '0')).join('');
}

export function unpack(str, nx, nz) {
  const v = new Voxels(nx, nz), s = typeof str === 'string' ? str : '';
  for (let p = 0; p + 4 <= s.length; p += 4) {
    const chunk = s.slice(p, p + 4);
    if (!/^[0-9a-z]{4}$/.test(chunk)) continue;
    let c = parseInt(chunk, 36);
    if (c > MAX_CODE) continue;
    const r = c % 4; c = Math.floor(c / 4);
    const t = BLOCK_IDS[c % BLOCK_IDS.length]; c = Math.floor(c / BLOCK_IDS.length);
    const k = c % MAX_H; c = Math.floor(c / MAX_H);
    const j = c % DIM, i = Math.floor(c / DIM);
    if (i >= nx || j >= nz || (BLOCKS[t].tall === 2 && k + 1 >= MAX_H)) continue;
    v.set(i, j, k, t, r);
  }
  return v;
}

// Height of a slope's surface at plot-local (x, z) in cell (i, j, k). r: 0 rises toward +z, 1 +x, 2 -z, 3 -x.
function slopeAt(c, i, j, k, x, z) {
  const fx = Math.min(1, Math.max(0, x - i)), fz = Math.min(1, Math.max(0, z - j));
  return k + [fz, fx, 1 - fz, 1 - fx][c.r % 4];
}
const inside = (v, i, j) => i >= 0 && j >= 0 && i < v.nx && j < v.nz;

// The highest surface you could be standing on at point (x, z), given your feet at feetY.
export function topAt(vox, x, z, feetY) {
  const i = Math.floor(x), j = Math.floor(z);
  if (!inside(vox, i, j)) return 0;
  for (let k = MAX_H - 1; k >= 0; k--) {
    const c = vox.get(i, j, k);
    if (!c || !BLOCKS[c.t].solid) continue;
    if (BLOCKS[c.t].shape === 'slope') { const h = slopeAt(c, i, j, k, x, z); if (h <= feetY + STEP_UP) return h; }
    else if (k + 1 <= feetY + EPS) return k + 1;
  }
  return 0;
}

export function standHeight(vox, x, z, feetY, hw = 0.28, hd = 0.2) {
  return Math.max(topAt(vox, x - hw, z - hd, feetY), topAt(vox, x + hw, z - hd, feetY), topAt(vox, x - hw, z + hd, feetY), topAt(vox, x + hw, z + hd, feetY));
}

// Would a body with its feet at feetY overlap a solid block at (x, z)?
export function blockedAt(vox, x, z, feetY, hw = 0.28, hd = 0.2, bodyH = 1.5) {
  const lo = feetY + EPS, hi = feetY + bodyH;
  for (let i = Math.floor(x - hw); i <= Math.floor(x + hw - 1e-9); i++) for (let j = Math.floor(z - hd); j <= Math.floor(z + hd - 1e-9); j++) {
    if (!inside(vox, i, j)) continue;
    for (let k = Math.max(0, Math.floor(lo)); k <= Math.min(MAX_H - 1, Math.floor(hi)); k++) {
      const c = vox.get(i, j, k);
      if (!c || !BLOCKS[c.t].solid) continue;
      if (BLOCKS[c.t].shape === 'slope') {
        const xs = [Math.max(i, x - hw), Math.min(i + 1, x + hw)], zs = [Math.max(j, z - hd), Math.min(j + 1, z + hd)];
        const top = Math.max(...xs.flatMap((px) => zs.map((pz) => slopeAt(c, i, j, k, px, pz))));
        if (top > feetY + STEP_UP && k < hi) return true;
      } else if (k + 1 > lo && k < hi) return true;
    }
  }
  return false;
}

// Walks the grid from (ox, oy, oz) along (dx, dy, dz) until it meets a block or the soil.
// Returns the cell hit and the face normal it came in through; soil hits have k = -1.
// skip(i, j, k) lets the caller see through cells (e.g. blocks hidden indoors).
export function raycast(vox, ox, oy, oz, dx, dy, dz, maxDist, skip = null) {
  const len = Math.hypot(dx, dy, dz) || 1;
  dx /= len; dy /= len; dz /= len;
  let i = Math.floor(ox), k = Math.floor(oy), j = Math.floor(oz);
  const si = Math.sign(dx), sk = Math.sign(dy), sj = Math.sign(dz);
  const next = (p, d, s) => (s > 0 ? Math.floor(p) + 1 - p : p - Math.floor(p)) / Math.abs(d);
  let tx = si ? next(ox, dx, si) : Infinity, ty = sk ? next(oy, dy, sk) : Infinity, tz = sj ? next(oz, dz, sj) : Infinity;
  const ddx = si ? 1 / Math.abs(dx) : Infinity, ddy = sk ? 1 / Math.abs(dy) : Infinity, ddz = sj ? 1 / Math.abs(dz) : Infinity;
  let n = [0, 1, 0], t = 0;
  for (let steps = 0; steps < 512 && t <= maxDist; steps++) {
    if (k < 0) return inside(vox, i, j) ? { i, j, k: -1, nx: 0, ny: 1, nz: 0, soil: true } : null;
    if (k < MAX_H && inside(vox, i, j) && vox.get(i, j, k) && !(skip && skip(i, j, k))) return { i, j, k, nx: n[0], ny: n[1], nz: n[2], soil: false };
    if (tx <= ty && tx <= tz) { t = tx; tx += ddx; i += si; n = [-si, 0, 0]; }
    else if (ty <= tz) { t = ty; ty += ddy; k += sk; n = [0, -sk, 0]; }
    else { t = tz; tz += ddz; j += sj; n = [0, 0, -sj]; }
  }
  return null;
}

// '' when a block of type t can go at (i, j, k), otherwise the reason it can't.
export function canPlace(vox, i, j, k, t, { crops, builds, players }) {
  const tall = (BLOCKS[t] && BLOCKS[t].tall) || 1;
  if (!inside(vox, i, j) || k < 0) return 'outside your soil';
  if (k + tall > MAX_H) return 'too high';
  for (let d = 0; d < tall; d++) if (vox.get(i, j, k + d)) return 'something is already there';
  if (k === 0 && crops.has(`${i},${j}`)) return 'crops in the way';
  if (builds.some((b) => i >= b.i && i < b.i + b.size && j >= b.j && j < b.j + b.size)) return 'a building is there';
  if (players.some((p) => p.x + 0.28 > i && p.x - 0.28 < i + 1 && p.z + 0.2 > j && p.z - 0.2 < j + 1 && p.y + 1.6 > k && p.y < k + tall)) return 'someone is standing there';
  return '';
}
