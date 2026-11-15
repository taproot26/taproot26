// Movement and reach checks on hits, faint warps, and bringing an old browser farm along in the
// one-time import (game/world3d/economy.js).   node --test tests/movement-farms.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { applyAction, newEcon, reachOf, PLAYER_SPEED, CASTERS, IMPORT_CAPS } from '../game/world3d/economy.js';
import { BUILDS } from '../game/world3d/farm.js';
import { unpack, pack, Voxels } from '../game/world3d/blocks.js';

const T0 = 1_800_000_000_000;
function player(over = {}) {
  const s = { econ: newEcon(), owned: [], farm: null };
  const ctx = { now: T0, isGear: () => false, owner: 'Hero', stats: { atk: 10, mag: 2 }, hands: {}, ...over };
  const run = (a, dt = 0) => { ctx.now += dt; return applyAction(s, a, ctx); };
  return { s, ctx, run };
}
let n = 0;
// a swing at `t` ms after T0, with the player at (px, pz) and the monster at (mx, mz)
const swing = (id, t, px, pz, mx, mz) => ({ t: 'hit', id, k: 'swing', hand: 'R', a: 'a' + n++, at: T0 + t, pt: T0 + t, dmg: 1, px, pz, mx, mz });

test('a hit must be within the weapon\'s reach', () => {
  const { run } = player();
  run({ t: 'spawn', id: 'slime1', m: 'slime' });
  assert.equal(run(swing('slime1', 0, 10, 10, 11, 10)), '');
  run({ t: 'spawn', id: 'slime2', m: 'slime' });
  assert.equal(run(swing('slime2', 500, 10, 10, 20, 10), 500), 'out of reach');
  const { run: mage } = player({ hands: { R: 'fire_wand' } });
  mage({ t: 'spawn', id: 'bat01', m: 'bat' });
  mage({ t: 'spawn', id: 'bat02', m: 'bat' });
  const shot = (id, t, d) => ({ ...swing(id, t, 0, 0, d, 0), k: 'shot' });
  assert.equal(mage(shot('bat01', 0, 14)), ''); // a 14-tile wand
  assert.equal(mage(shot('bat02', 600, reachOf('shot', 'fire_wand') + 1), 600), 'out of reach');
  assert.ok(reachOf('chain', 'thunder_staff') > CASTERS.thunder_staff.range);
});

test('nobody moves faster than a sprint, and monsters no faster than they walk', () => {
  const { run } = player();
  run({ t: 'spawn', id: 'slime1', m: 'slime' });
  run({ t: 'spawn', id: 'slime2', m: 'slime' });
  assert.equal(run(swing('slime1', 0, 0, 0, 1, 0)), '');
  // one second later, 30 tiles away: nobody sprints that fast
  assert.equal(run(swing('slime2', 1000, 30, 0, 31, 0), 1000), 'moved too fast');
  // 5 seconds later the same 30 tiles is fine (7.4 a second)
  assert.equal(run(swing('slime2', 5000, 30, 0, 31, 0), 4000), '');
  assert.ok(30 < 5 * PLAYER_SPEED);
  // the first slime "follows" across the map in half a second: slimes don't do that
  assert.equal(run(swing('slime1', 5500, 30, 0, 31, 1), 500), 'monster moved too fast');
});

test('fainting warps you back to the start, but only a couple of times a minute', () => {
  const { run } = player();
  run({ t: 'spawn', id: 'slime1', m: 'slime' });
  assert.equal(run(swing('slime1', 0, 50, 50, 51, 50)), '');
  assert.equal(run({ t: 'warp', x: 2, z: 2, at: T0 + 800 }, 800), '');
  run({ t: 'spawn', id: 'slime2', m: 'slime' });
  assert.equal(run(swing('slime2', 1200, 2, 2, 3, 2), 400), ''); // fighting at the start right away is fine
  assert.equal(run({ t: 'warp', x: 50, z: 50, at: T0 + 1500 }, 300), '');
  assert.equal(run({ t: 'warp', x: 2, z: 2, at: T0 + 1700 }, 200), 'too fast');
  assert.equal(run({ t: 'area' }), '');
  run({ t: 'spawn', id: 'slime3', m: 'slime' });
  assert.equal(run(swing('slime3', 1800, 90, 90, 91, 90), 100), ''); // a new map: anywhere goes
});

test('hits with no positions are refused; local testing skips the movement checks', () => {
  const { run } = player();
  run({ t: 'spawn', id: 'slime1', m: 'slime' });
  const { px, pz, mx, mz, ...bare } = swing('slime1', 0, 0, 0, 1, 0);
  assert.equal(run(bare), 'bad hit');
  const dev = player({ dev: true });
  dev.run({ t: 'spawn', id: 'slime1', m: 'slime' });
  assert.equal(dev.run(swing('slime1', 0, 0, 0, 1, 0)), '');
  assert.equal(dev.run(swing('slime1', 500, 80, 80, 99, 99), 500), '');
});

// A farm the way the old game kept it in the browser.
function oldFarm(id, extra = {}) {
  const v = new Voxels(id === 1 ? 24 : 8, id === 1 ? 24 : 8);
  v.set(5, 5, 0, 'stone', 0); v.set(5, 5, 1, 'stone', 0); v.set(6, 5, 0, 'door', 1);
  return {
    id, owner: 'Hero', claimed: 1, boost: [T0, T0 + 1e9],
    crops: { '0,0': { k: 'carrot', t: T0 - 60000 }, '1,0': { k: 'pumpkin', t: T0 + 1e9 }, '99,0': { k: 'carrot', t: 1 }, '2,0': { k: 'mandrake', t: 1 } },
    builds: [{ k: 'altar', i: 3, j: 3, r: 0 }, { k: 'altar', i: 0, j: 6, r: 0 }, { k: 'scarecrow', i: 3, j: 3, r: 0 }],
    blocks: pack(v), members: ['pal', 'pal', '  ', 'a'.repeat(40)],
    ...extra,
  };
}

test('an old farm comes along with the import, rebuilt under the plot rules', () => {
  const { s, run } = player();
  assert.equal(run({ t: 'import', field: {}, farm: oldFarm(2) }), '');
  const f = s.farm;
  assert.equal(f.id, 2);
  assert.equal(f.owner, 'Hero');
  assert.deepEqual(f.builds, [{ k: 'altar', i: 3, j: 3, r: 0 }]); // one altar max; the scarecrow overlapped it
  assert.deepEqual(Object.keys(f.crops).sort(), ['0,0', '1,0']);   // off-plot and unknown crops dropped
  assert.equal(f.crops['1,0'].t, T0);                               // a time in the future is clamped to now
  assert.equal(f.crops['0,0'].t, T0 - 60000);
  assert.deepEqual(f.boost, [0, 0]);                                // no free altar boost
  assert.equal(unpack(f.blocks, 8, 8).count(), 3);
  assert.deepEqual(f.members, ['pal', 'a'.repeat(16)]);
});

test('the farm is paid for out of the same import budget', () => {
  const { s, run } = player();
  // gold first in the field, but the farm takes its share before gold does
  assert.equal(run({ t: 'import', field: { gold: 1e9 }, farm: oldFarm(2) }), '');
  const spent = BUILDS.altar.cost + 2 + 10 + 2 * 2 + 10; // altar, carrot + pumpkin seeds, 2 stone, a door
  assert.equal(s.econ.gold, IMPORT_CAPS.value - spent);
});

test('a farm on a plot someone else holds, or when you already farm, is left behind', () => {
  const taken = player({ plotTaken: 2 });
  assert.equal(taken.run({ t: 'import', field: { gold: 10 }, farm: oldFarm(2) }), '');
  assert.equal(taken.s.farm, null);
  assert.equal(taken.s.econ.gold, 10);
  const has = player();
  has.run({ t: 'claim', plot: 3 });
  has.run({ t: 'import', field: {}, farm: oldFarm(2) });
  assert.equal(has.s.farm.id, 3);
  const bogus = player();
  bogus.run({ t: 'import', field: {}, farm: { id: 9, crops: 'x' } });
  assert.equal(bogus.s.farm, null);
});
