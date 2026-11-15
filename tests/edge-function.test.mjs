// The Supabase Edge Function's entry point (serveGame in supabase/functions/game/api.js, what
// Deno.serve calls), driven with web Requests the way Supabase delivers them, against the dev
// server's mock database (local-testing perks off).
//   node --test tests/edge-function.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { serveGame, callerIp } from '../supabase/functions/game/api.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const PORT = 21000 + Math.floor(Math.random() * 2000);
const DB = `http://127.0.0.1:${PORT}`;
const FN = 'https://example.supabase.co/functions/v1/game/';
const ENV = { url: DB, serviceKey: 'local-mock-key', anonKey: 'public-anon-key' };
const dir = mkdtempSync(join(tmpdir(), 'taproot-edge-'));
let server;

test.before(async () => {
  server = spawn(process.execPath, [join(ROOT, 'game-dev-server.js')], {
    // always the local mock database, never a real Supabase project; rate limits counted for real
    env: { ...process.env, PORT: String(PORT), DB_PATH: join(dir, 'db.json'), SUPABASE_URL: DB, SUPABASE_SERVICE_KEY: 'local-mock-key', GAME_DEV: '0', MOCK_RATE_LIMITS: '1' },
    stdio: 'ignore',
  });
  for (let i = 0; i < 50; i++) {
    try { await fetch(DB + '/game/'); return; } catch (e) { await new Promise((r) => setTimeout(r, 100)); }
  }
  throw new Error('dev server did not start');
});
test.after(() => { server.kill(); rmSync(dir, { recursive: true, force: true }); });

// One request through the function, as the game sends it.
async function call(action, { method, key, body, ip = '203.0.113.7', origin = 'https://taproot.love' } = {}) {
  const m = method || (['me', 'state', 'farms', 'config'].includes(action) ? 'GET' : 'POST');
  const res = await serveGame(new Request(FN + action, {
    method: m,
    headers: { Origin: origin, 'Content-Type': 'application/json', 'cf-connecting-ip': ip, ...(key ? { Authorization: 'Bearer ' + key } : {}) },
    body: m === 'POST' ? JSON.stringify(body || {}) : undefined,
  }), ENV);
  return { status: res.status, headers: res.headers, data: res.status === 204 ? null : await res.json() };
}
const name = () => 'x' + Math.random().toString(36).slice(2, 10);

test('a browser on another domain may call it (CORS preflight and headers)', async () => {
  const pre = await serveGame(new Request(FN + 'act', { method: 'OPTIONS', headers: { Origin: 'https://taproot.love', 'Access-Control-Request-Method': 'POST', 'Access-Control-Request-Headers': 'authorization, content-type' } }), ENV);
  assert.equal(pre.status, 204);
  assert.equal(pre.headers.get('access-control-allow-origin'), '*');
  assert.match(pre.headers.get('access-control-allow-headers'), /authorization/);
  const cfg = await call('config');
  assert.equal(cfg.status, 200);
  assert.equal(cfg.headers.get('access-control-allow-origin'), '*');
  assert.match(cfg.headers.get('access-control-expose-headers'), /Date/);
  assert.deepEqual(cfg.data.realtime, { url: DB, key: 'public-anon-key' }); // multiplayer on the accounts' project
});

test('the action comes from the last part of the path; wrong methods and paths are refused', async () => {
  assert.equal((await call('config', { method: 'POST' })).status, 405);
  assert.equal((await call('nope', { method: 'POST' })).status, 401); // unknown action, signed out
  assert.equal((await call('me')).status, 401);
});

test('a whole session: sign up, make a character, fight, buy, farm, sign in again', async () => {
  const username = name();
  const su = await call('signup', { body: { username, password: 'hunter2hunter2' } });
  assert.equal(su.status, 200);
  const key = su.data.key;
  const sv = await call('save', { key, body: { character: { name: 'Edge', cls: 'knight', skin: 1, hs: 'short', hc: 0 } } });
  assert.ok(sv.data.inventory.includes('iron_sword'));
  const now = Date.now(), here = { px: 0, pz: 0, mx: 1, mz: 0 };
  const hit = (n) => ({ t: 'hit', id: 'edgeslime', k: 'swing', hand: 'R', a: 'a' + n, at: now + n * 400, dmg: 99, ...here });
  const r = await call('act', { key, body: { sent: now + 2000, actions: [{ t: 'spawn', id: 'edgeslime', m: 'slime' }, hit(1), hit(2), // a knight's sword: two hits
    { t: 'chest', id: 'wreck' }, { t: 'buy', shop: 'Seed Shop', id: 'carrot_seed', n: 1 }, { t: 'claim', plot: 3 }, { t: 'plant', k: 'carrot', i: 0, j: 0 }] } });
  assert.equal(r.status, 200);
  assert.ok(r.data.results.every((x) => x === ''), JSON.stringify(r.data.results));
  assert.equal(r.data.state.econ.kills, 1);
  assert.equal(r.data.state.farm.id, 3);
  const farms = await call('farms');
  assert.ok(farms.data.farms.some((f) => f.id === 3));
  const login = await call('login', { body: { username, password: 'hunter2hunter2' } });
  assert.equal(login.status, 200);
  assert.equal(login.data.state.econ.kills, 1);
  assert.equal(login.data.character.name, 'Edge');
  assert.equal((await call('state', { key })).status, 401); // the old session ended
});

test('rate limits count per caller IP (Cloudflare\'s client address)', async () => {
  const ip = '198.51.100.' + Math.floor(Math.random() * 200);
  const tries = [];
  for (let i = 0; i < 6; i++) tries.push((await call('signup', { ip, body: { username: name(), password: 'hunter2hunter2' } })).status);
  assert.deepEqual(tries, [200, 200, 200, 200, 200, 429]); // five new accounts an hour from one address
  assert.equal((await call('signup', { ip: '192.0.2.99', body: { username: name(), password: 'hunter2hunter2' } })).status, 200);
});

test('the caller IP: Cloudflare first, then the first forwarded address', () => {
  assert.equal(callerIp(new Headers({ 'cf-connecting-ip': '1.2.3.4', 'x-forwarded-for': '9.9.9.9, 5.6.7.8' })), '1.2.3.4');
  assert.equal(callerIp(new Headers({ 'x-forwarded-for': '9.9.9.9, 5.6.7.8' })), '9.9.9.9');
  assert.equal(callerIp(new Headers({})), 'unknown');
});
