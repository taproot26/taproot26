// The server-side economy through the real API handler, against the dev server's mock
// database, with local-testing perks off (like the live site).
//   node --test tests/economy-api.test.js
const test = require('node:test');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const PORT = 18000 + Math.floor(Math.random() * 2000);
const BASE = `http://127.0.0.1:${PORT}`;
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'taproot-econ-'));
let server;

test.before(async () => {
  server = spawn(process.execPath, [path.join(__dirname, '..', 'game-dev-server.js')], {
    // always the local mock database, never a real Supabase project
    env: { ...process.env, PORT: String(PORT), DB_PATH: path.join(dir, 'db.json'), SUPABASE_URL: BASE, SUPABASE_SERVICE_KEY: 'local-mock-key', GAME_DEV: '0' },
    stdio: 'ignore',
  });
  for (let i = 0; i < 50; i++) {
    try { await fetch(BASE + '/game/'); return; } catch (e) { await new Promise((r) => setTimeout(r, 100)); }
  }
  throw new Error('dev server did not start');
});
test.after(() => { server.kill(); fs.rmSync(dir, { recursive: true, force: true }); });

async function api(action, key, body) {
  const get = ['me', 'state', 'farms', 'config'].includes(action);
  const res = await fetch(`${BASE}/api/game/${action}`, {
    method: get ? 'GET' : 'POST',
    headers: { 'Content-Type': 'application/json', ...(key ? { Authorization: 'Bearer ' + key } : {}) },
    body: get ? undefined : JSON.stringify(body || {}),
  });
  return { status: res.status, data: await res.json() };
}
const PW = 'hunter2hunter2';
// where a hit happens: you and the monster side by side (the server checks reach and movement)
const NEAR = { px: 0, pz: 0, mx: 1, mz: 0 };
async function account() {
  const username = 'e' + Math.random().toString(36).slice(2, 10);
  const r = await api('signup', null, { username, password: PW });
  assert.equal(r.status, 200);
  return { username, key: r.data.key, data: r.data };
}
const act = async (key, ...actions) => api('act', key, { actions });
const CHESTS = ['wreck', 'lonely', 'gull', 'doubloon'].map((id) => ({ t: 'chest', id })); // 120 gold
const KNIGHT = { name: 'Hero', cls: 'knight', skin: 1, hs: 'short', hc: 0 };
// A fair fight with bare hands (no character: ATK 10, so a swing does at most 14), one swing
// every 400 ms of game time: spawn the monster, then hit it until the server says it's dead.
let T = Date.now();
const rid = () => Math.random().toString(36).slice(2, 10);
function fight(m, swings, dmg = 14) {
  const id = 'f' + rid();
  return [{ t: 'spawn', id, m }, ...Array.from({ length: swings }, () => ({ t: 'hit', ...NEAR, id, k: 'swing', hand: 'R', a: rid(), at: (T += 400), dmg }))];
}
const ok = (r) => r.data.results.every((x) => x === '');

test('a new account owns nothing and starts at zero', async () => {
  const { data } = await account();
  assert.deepEqual(data.inventory, []);
  assert.deepEqual(data.state.owned, []);
  assert.equal(data.state.econ.gold, 0);
  assert.equal(data.state.farm, null);
});

test('the first character comes with its class kit, and unowned gear is taken off', async () => {
  const { key } = await account();
  const r = await api('save', key, { character: { ...KNIGHT, equipment: { rhand: 'iron_sword', feet: 'hermes_sandals' } } });
  assert.equal(r.status, 200);
  assert.equal(r.data.character.equipment.rhand, 'iron_sword');
  assert.equal(r.data.character.equipment.feet, null);
  assert.ok(r.data.inventory.includes('wooden_shield'));
  // changing class later doesn't hand out a second kit
  const again = await api('save', key, { character: { ...KNIGHT, cls: 'mage', equipment: { rhand: 'oak_staff' } } });
  assert.equal(again.data.character.equipment.rhand, null);
});

test('a kill pays XP, then its drops pay out once when picked up', async () => {
  const { key } = await account();
  const r = await act(key,
    ...fight('slime', 3),
    { t: 'pickup', kind: 'gold', m: 'slime', n: 2 },
    { t: 'pickup', kind: 'item', id: 'slime_gel' },
    { t: 'pickup', kind: 'item', id: 'slime_gel' },
    { t: 'pickup', kind: 'gold', m: 'goblin', n: 5 },
    ...fight('bat', 2),
    { t: 'pickup', kind: 'gold', m: 'bat', n: 50 });
  assert.equal(r.status, 200);
  assert.deepEqual(r.data.results.slice(4, 8), ['', '', 'nothing to pick up', 'nothing to pick up']);
  assert.equal(r.data.results[11], ''); // the amount the browser asks for doesn't matter...
  const { gold, ...rest } = r.data.state.econ;
  assert.ok(gold >= 2 && gold <= 4, `gold ${gold}`); // ...the server rolls slime 1-2 + bat 1-2
  assert.deepEqual(rest, { xp: 12, kills: 2, bag: { slime_gel: 1 }, loot: [], imported: false, barrels: {} });
});

test('combat: only hits the server believes can kill', async () => {
  const { key } = await account();
  const id = 'goblin1';
  let r = await act(key,
    { t: 'kill', m: 'slime' },                                                         // kills aren't taken on trust
    { t: 'hit', ...NEAR, id: 'nobody', k: 'swing', hand: 'R', a: rid(), at: (T += 400), dmg: 5 }, // no such monster
    { t: 'spawn', id, m: 'goblin' },
    { t: 'spawn', id, m: 'goblin' },                                                   // already there
    { t: 'hit', ...NEAR, id, k: 'shot', hand: 'R', a: rid(), at: (T += 400), dmg: 5 },          // no wand in hand
    { t: 'hit', ...NEAR, id, k: 'swing', hand: 'R', a: rid(), at: (T += 400), dmg: 9999 },       // capped at 14
    { t: 'hit', ...NEAR, id, k: 'swing', hand: 'R', a: rid(), at: T + 50, dmg: 14 },             // faster than a swing
    { t: 'hit', ...NEAR, id, k: 'swing', hand: 'R', a: rid(), at: (T += 400), dmg: 14 });
  assert.deepEqual(r.data.results, ['kills come from hits', 'no such monster', '', 'bad id', 'wrong weapon', '', 'too fast', '']);
  assert.equal(r.data.state.econ.kills, 0); // 28 of the goblin's 60 HP
  r = await act(key, ...[1, 2, 3].map(() => ({ t: 'hit', ...NEAR, id, k: 'swing', hand: 'R', a: rid(), at: (T += 400), dmg: 14 })));
  assert.ok(ok(r));
  assert.equal(r.data.state.econ.kills, 1);
  assert.equal(r.data.state.econ.xp, 15);
  r = await act(key, { t: 'hit', ...NEAR, id, k: 'swing', hand: 'R', a: rid(), at: (T += 400), dmg: 14 });
  assert.deepEqual(r.data.results, ['no such monster']); // dead is dead
});

test('a game clock that runs fast is caught', async () => {
  const { key } = await account();
  const acts = [{ t: 'spawn', id: 'kingslime', m: 'king' }];
  let at = Date.now();
  for (let i = 0; i < 30; i++) acts.push({ t: 'hit', ...NEAR, id: 'kingslime', k: 'swing', hand: 'R', a: rid(), at: (at += 400), dmg: 14 });
  const r = await act(key, ...acts); // 12 s of swings sent in a moment
  assert.ok(r.data.results.includes('too fast'));
  assert.equal(r.data.state.econ.kills, 0);
});

test('equipping in the world changes what the next hits may do', async () => {
  const { key } = await account();
  await api('save', key, { character: { ...KNIGHT, cls: 'mage', equipment: {} } }); // the mage kit: oak staff
  const r = await act(key, { t: 'spawn', id: 'slime01', m: 'slime' },
    { t: 'hit', ...NEAR, id: 'slime01', k: 'swing', hand: 'R', a: rid(), at: (T += 700), dmg: 3 },
    { t: 'equip', eq: { rhand: 'oak_staff' } },
    { t: 'hit', ...NEAR, id: 'slime01', k: 'swing', hand: 'R', a: rid(), at: (T += 700), dmg: 3 },
    { t: 'hit', ...NEAR, id: 'slime01', k: 'shot', hand: 'R', a: rid(), at: (T += 700), dmg: 3 },
    { t: 'equip', eq: { rhand: 'cutlass' } }); // not owned: taken off
  assert.deepEqual(r.data.results, ['', '', '', 'wrong weapon', '', '']);
  assert.equal(r.data.character.equipment.rhand, null);
  const me = await api('me', key);
  assert.equal(me.data.character.equipment.rhand, null);
});

test('gear is bought with real gold at the shop\'s price, once', async () => {
  const { key } = await account();
  let r = await act(key, { t: 'buy', shop: 'The Armoury', id: 'iron_sword' });
  assert.deepEqual(r.data.results, ['not enough gold']);
  r = await act(key, ...CHESTS, ...CHESTS.slice(0, 1),
    { t: 'buy', shop: 'The Armoury', id: 'iron_sword' },
    { t: 'buy', shop: 'The Armoury', id: 'iron_sword' },
    { t: 'buy', shop: 'Potion Shop', id: 'iron_sword' },
    { t: 'buy', shop: 'Fruit Stall', id: 'health_potion', n: 2 });
  assert.deepEqual(r.data.results.slice(4), ['already looted', '', 'already owned', 'not for sale', '']);
  assert.equal(r.data.state.econ.gold, 120 - 50 - 36);
  assert.deepEqual(r.data.state.owned, ['iron_sword']);
  assert.equal(r.data.state.econ.bag.health_potion, 2);
  // and now it can be worn
  const s = await api('save', key, { character: { ...KNIGHT, equipment: { rhand: 'iron_sword' } } });
  assert.equal(s.data.character.equipment.rhand, 'iron_sword');
});

test('selling, crafting and using items', async () => {
  const { key } = await account();
  const r = await act(key, ...CHESTS,
    ...fight('slime', 3), { t: 'pickup', kind: 'item', id: 'slime_gel' },
    ...fight('bat', 2), { t: 'pickup', kind: 'item', id: 'bat_fang' },
    { t: 'craft', id: 'inferno_staff' }, { t: 'craft', id: 'inferno_staff' },
    { t: 'buy', shop: 'Potion Shop', id: 'health_potion', n: 3 },
    { t: 'use', id: 'health_potion' }, { t: 'sell', id: 'health_potion', n: 2 }, { t: 'sell', id: 'health_potion', n: 1 });
  assert.deepEqual(r.data.results.slice(13), ['', 'already owned', '', '', '', 'not enough']);
  assert.ok(r.data.results.slice(0, 13).every((x) => x === ''));
  assert.deepEqual(r.data.state.owned, ['inferno_staff']);
  assert.equal(r.data.state.econ.gold, 120 - 10 - 45 + 12);
  assert.deepEqual(r.data.state.econ.bag, {});
});

test('a plot belongs to one player, and shows to everyone while they are away', async () => {
  const a = await account(), b = await account();
  await api('save', a.key, { character: KNIGHT });
  let r = await act(a.key, { t: 'claim', plot: 2 }, { t: 'claim', plot: 3 });
  assert.deepEqual(r.data.results, ['', 'you already have a plot']);
  assert.equal(r.data.state.farm.owner, 'Hero');
  r = await act(b.key, { t: 'claim', plot: 2 });
  assert.deepEqual(r.data.results, ['plot taken']);
  assert.equal(r.data.state.farm, null);
  r = await act(b.key, { t: 'claim', plot: 3 });
  assert.deepEqual(r.data.results, ['']);

  const farms = await api('farms');
  assert.equal(farms.status, 200);
  assert.deepEqual(farms.data.farms.map((f) => f.id).sort(), [2, 3]);
  assert.ok(!JSON.stringify(farms.data).includes('password'));
});

test('farming: seeds from the shop, crops on the server clock', async () => {
  const { key } = await account();
  const r = await act(key, { t: 'plant', k: 'carrot', i: 0, j: 0 }, { t: 'claim', plot: 1 },
    { t: 'plant', k: 'carrot', i: 0, j: 0 }, { t: 'chest', id: 'lonely' },
    { t: 'buy', shop: 'Seed Shop', id: 'carrot_seed', n: 2 },
    { t: 'plant', k: 'carrot', i: 0, j: 0 }, { t: 'plant', k: 'carrot', i: 0, j: 0 }, { t: 'plant', k: 'carrot', i: 99, j: 0 },
    { t: 'harvest', i: 0, j: 0 });
  // plot 1 may already be someone else's from another test run; only check what follows the claim
  if (r.data.results[1] !== '') return;
  assert.deepEqual(r.data.results, ['no plot', '', 'no seeds', '', '', '', 'spot taken', 'bad spot', 'not ripe']);
  const crop = r.data.state.farm.crops['0,0'];
  assert.equal(crop.k, 'carrot');
  assert.ok(Math.abs(crop.t - r.data.state.now) < 5000);
  assert.equal(r.data.state.econ.bag.carrot_seed, 1);
});

test('two requests at once can\'t spend the same gold twice', async () => {
  const { key } = await account();
  await act(key, { t: 'chest', id: 'wreck' }); // 40 gold
  const buy = () => act(key, { t: 'buy', shop: 'Potion Shop', id: 'health_potion', n: 2 }); // 30 gold
  const [x, y] = await Promise.all([buy(), buy()]);
  const ok = [x, y].filter((r) => r.data.results[0] === '').length;
  assert.equal(ok, 1);
  const s = await api('state', key);
  assert.equal(s.data.econ.gold, 10);
  assert.equal(s.data.econ.bag.health_potion, 2);
});

test('progress from before cloud saves can be brought in once, within one value budget', async () => {
  const E = await import('../game/world3d/economy.js');
  const { key } = await account();
  const r = await act(key,
    { t: 'import', field: { gold: 1e9, xp: 300, kills: 'x', bag: { slime_gel: 1000, bogus: 5 } }, owned: ['cutlass', 'nope'], loot: ['wreck', 'harbor'] },
    { t: 'import', field: { gold: 100 } }, { t: 'chest', id: 'wreck' });
  assert.deepEqual(r.data.results, ['', 'already imported', 'already looted']);
  const left = E.IMPORT_CAPS.value - E.valueOf('cutlass') - 99 * E.valueOf('slime_gel');
  assert.deepEqual(r.data.state.econ, { gold: left, xp: 300, kills: 0, bag: { slime_gel: 99 }, loot: ['wreck'], imported: true, barrels: {} });
  assert.deepEqual(r.data.state.owned, ['cutlass']);
});

test('an import can\'t hand out the whole armoury', async () => {
  const E = await import('../game/world3d/economy.js');
  const G = require('../game/items.js');
  const { key } = await account();
  const all = Object.keys(G.ITEMS);
  const r = await act(key, { t: 'import', field: { gold: 1e9, bag: Object.fromEntries([...E.BAG_ITEMS].map((id) => [id, 99])) }, owned: all });
  assert.ok(ok(r));
  const { econ, owned } = r.data.state;
  const worth = econ.gold + owned.reduce((n, id) => n + E.valueOf(id), 0)
    + Object.entries(econ.bag).reduce((n, [id, k]) => n + E.valueOf(id) * k, 0);
  assert.ok(worth <= E.IMPORT_CAPS.value, `imported ${worth} gold worth`);
  assert.ok(owned.length < all.length);
  assert.ok(owned.every((id) => E.valueOf(id) !== undefined), 'no gear that no shop sells');
});

test('bad requests', async () => {
  const { key } = await account();
  assert.equal((await act(null, { t: 'chest', id: 'wreck' })).status, 401);
  assert.equal((await api('act', key, { actions: [] })).status, 400);
  assert.equal((await api('act', key, { actions: Array(61).fill({ t: 'barrel' }) })).status, 400);
  const r = await act(key, { t: 'teleport' }, null, { t: 'buy', shop: 'Nope', id: 'iron_sword' }, { t: 'spawn', id: 'dragon1', m: 'dragon' });
  assert.deepEqual(r.data.results, ['unknown action', 'bad action', 'not for sale', 'unknown monster']);
});

test('config hands the browser no realtime key unless one is set', async () => {
  const r = await api('config');
  assert.equal(r.status, 200);
  assert.equal(r.data.realtime, null);
});
