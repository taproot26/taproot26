// game/lib/ledger.js in simulated browsers (one vm context per device), against the dev
// server's mock database with local-testing perks off.   node --test tests/ledger.test.js
const test = require('node:test');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const vm = require('node:vm');

const PORT = 20000 + Math.floor(Math.random() * 2000);
const BASE = `http://127.0.0.1:${PORT}`;
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'taproot-ledger-'));
const SRC = fs.readFileSync(path.join(__dirname, '..', 'game', 'lib', 'ledger.js'), 'utf8');
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

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
// A minimal browser: Storage with the real prototype shape, window events, fetch to the server.
function device() {
  class Storage {
    constructor() { Object.defineProperty(this, '_m', { value: new Map() }); }
    get length() { return this._m.size; }
    key(i) { return [...this._m.keys()][i] ?? null; }
    getItem(k) { return this._m.has(k) ? this._m.get(k) : null; }
    setItem(k, v) { this._m.set(String(k), String(v)); }
    removeItem(k) { this._m.delete(k); }
  }
  const handlers = {};
  const on = (t, f) => { (handlers[t] = handlers[t] || []).push(f); };
  const ctx = {
    Storage, localStorage: new Storage(), online: true,
    CustomEvent: class { constructor(t) { this.type = t; } },
    setTimeout, clearTimeout, console, JSON, Promise, Object, Number, String, Array, Date,
    performance, // the ledger stamps each request with the browser clock
    location: { hostname: 'localhost' }, // playing locally: the API is the dev server's /api/game/
    document: { body: null, visibilityState: 'visible', addEventListener: on },
  };
  ctx.fetch = (u, init) => (ctx.online ? fetch(BASE + u, init) : Promise.reject(new Error('offline')));
  ctx.window = ctx;
  ctx.addEventListener = on;
  ctx.dispatchEvent = (e) => (handlers[e.type] || []).forEach((f) => f(e));
  vm.createContext(ctx);
  vm.runInContext(SRC, ctx);
  ctx.read = (k) => JSON.parse(ctx.localStorage.getItem(k));
  ctx.write = (k, v) => ctx.localStorage.setItem(k, JSON.stringify(v));
  return ctx;
}

async function api(action, key, body) {
  const get = ['me', 'state', 'farms', 'config'].includes(action);
  const res = await fetch(`${BASE}/api/game/${action}`, {
    method: get ? 'GET' : 'POST',
    headers: { 'Content-Type': 'application/json', ...(key ? { Authorization: 'Bearer ' + key } : {}) },
    body: get ? undefined : JSON.stringify(body || {}),
  });
  return res.json();
}
const PW = 'hunter2hunter2';
const newName = () => 'l' + Math.random().toString(36).slice(2, 10);
// Sign in on a device the way game/index.html does: store the key, then adopt the account.
async function signIn(d, username, signup) {
  const u = await api(signup ? 'signup' : 'login', null, { username, password: PW });
  d.localStorage.setItem('taproot_session', u.key);
  d.Ledger.init().adopt(u);
  return u;
}

test('actions go to the server, and its answer lands in the game and the cache', async () => {
  const d = device();
  const u = await signIn(d, newName(), true);
  const seen = [];
  d.Ledger.on('state', (st) => seen.push(st));
  d.Ledger.act({ t: 'chest', id: 'wreck' });
  d.Ledger.act({ t: 'buy', shop: 'Potion Shop', id: 'health_potion', n: 2 });
  assert.equal(await d.Ledger.flush(), true);
  const st = seen[seen.length - 1];
  assert.equal(st.econ.gold, 10);
  assert.deepEqual(st.econ.bag, { health_potion: 2 });
  assert.equal(d.read('taproot_field').gold, 10);
  assert.deepEqual(d.read('taproot_sea_loot'), ['wreck']);
  assert.equal((await api('state', u.key)).econ.gold, 10);
});

test('refused actions are reported and the server state wins', async () => {
  const d = device();
  await signIn(d, newName(), true);
  let bad = null;
  d.Ledger.on('rejected', (b) => { bad = b; });
  d.write('taproot_field', { gold: 9999, xp: 0, kills: 0, bag: {} }); // a browser that edited its save
  d.Ledger.act({ t: 'buy', shop: 'The Armoury', id: 'mirror_shield' });
  await d.Ledger.flush();
  assert.equal(bad[0][1], 'not enough gold');
  assert.equal(d.read('taproot_field').gold, 0);
  assert.deepEqual(d.read('taproot_owned'), []);
});

test('actions taken offline are kept and sent when the connection is back', async () => {
  const d = device();
  const u = await signIn(d, newName(), true);
  d.online = false;
  d.Ledger.act({ t: 'chest', id: 'gull' });
  assert.equal(await d.Ledger.flush(), false);
  assert.equal(d.Ledger.pending, 1);
  assert.equal(JSON.parse(d.localStorage.getItem('taproot_pending')).length, 1);
  d.online = true;
  assert.equal(await d.Ledger.flush(), true);
  assert.equal((await api('state', u.key)).econ.gold, 25);
});

test('two accounts on one browser never see or send each other\'s progress', async () => {
  const d = device();
  const alice = newName(), bob = newName();
  const a = await signIn(d, alice, true);
  d.Ledger.act({ t: 'chest', id: 'doubloon' });
  await d.Ledger.flush();
  assert.equal(await d.Ledger.signOut(), true);
  assert.equal(d.localStorage.getItem('taproot_field'), null);

  const b = await signIn(d, bob, true);
  assert.equal(d.read('taproot_field').gold, 0);
  assert.equal(b.state.econ.imported, false); // no leftover progress was imported into Bob
  await signIn(d, alice);
  assert.equal(d.read('taproot_field').gold, 30);
  assert.equal((await api('state', a.key)).error, 'Please sign in again'); // the old session ended at the second sign-in
});

test('a browser that played before saves moved to the server brings its progress along once', async () => {
  const d = device();
  d.write('taproot_field', { xp: 300, kills: 30, gold: 120, bag: { bat_fang: 4 } }); // no owner: an old save
  d.write('taproot_owned', ['cutlass']);
  const name = newName();
  const u = await signIn(d, name, true);
  await d.Ledger.flush();
  await sleep(50);
  const st = await api('state', u.key);
  assert.equal(st.econ.gold, 120);
  assert.equal(st.econ.bag.bat_fang, 4);
  assert.deepEqual(st.owned, ['cutlass']);
  assert.equal(st.econ.imported, true);
});

test('signing in elsewhere stops this browser from saving, and says so', async () => {
  const name = newName();
  const a = device(), b = device();
  await signIn(a, name, true);
  await signIn(b, name);
  let told = false;
  a.addEventListener('taproot-signed-out', () => { told = true; });
  a.Ledger.act({ t: 'barrel' });
  assert.equal(await a.Ledger.flush(), false);
  assert.equal(told, true);
});

test('farm timestamps are moved onto this browser\'s clock', async () => {
  const d = device();
  await signIn(d, newName(), true);
  d.Ledger.act({ t: 'chest', id: 'wreck' });
  d.Ledger.act({ t: 'claim', plot: 3 });
  d.Ledger.act({ t: 'buy', shop: 'Seed Shop', id: 'carrot_seed', n: 1 });
  d.Ledger.act({ t: 'plant', k: 'carrot', i: 0, j: 0 });
  await d.Ledger.flush();
  const farm = d.Ledger.cached().farm;
  if (!farm) return; // plot 3 already taken by another test account
  assert.ok(Math.abs(farm.crops['0,0'].t - Date.now()) < 3000);
  const all = await d.Ledger.farms();
  assert.ok(all.some((f) => f.id === farm.id));
});

test('the realtime config falls back to the old project until a key is set', async () => {
  const d = device();
  const rt = await d.Ledger.realtime();
  assert.match(rt.url, /supabase\.co$/);
  assert.ok(rt.key.length > 100);
});
