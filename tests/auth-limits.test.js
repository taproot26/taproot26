// Sign-up and log-in rate limits through the real API handler, against the dev server's mock
// database with its game_hit() limits switched on (MOCK_RATE_LIMITS=1).
//   node --test tests/auth-limits.test.js
const test = require('node:test');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const PORT = 20000 + Math.floor(Math.random() * 2000);
const BASE = `http://127.0.0.1:${PORT}`;
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'taproot-limits-'));
let server;

test.before(async () => {
  server = spawn(process.execPath, [path.join(__dirname, '..', 'game-dev-server.js')], {
    env: { ...process.env, PORT: String(PORT), DB_PATH: path.join(dir, 'db.json'), SUPABASE_URL: BASE, SUPABASE_SERVICE_KEY: 'local-mock-key', GAME_DEV: '0', MOCK_RATE_LIMITS: '1' },
    stdio: 'ignore',
  });
  for (let i = 0; i < 50; i++) {
    try { await fetch(BASE + '/game/'); return; } catch (e) { await new Promise((r) => setTimeout(r, 100)); }
  }
  throw new Error('dev server did not start');
});
test.after(() => { server.kill(); fs.rmSync(dir, { recursive: true, force: true }); });

// Each request comes "from" an IP (the platform's x-real-ip header).
async function post(action, ip, body) {
  const res = await fetch(`${BASE}/api/game/${action}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-real-ip': ip },
    body: JSON.stringify(body),
  });
  return { status: res.status, data: await res.json() };
}
const PW = 'hunter2hunter2';
const name = () => 'l' + Math.random().toString(36).slice(2, 10);

test('one IP can only make a few accounts an hour', async () => {
  for (let i = 0; i < 5; i++) assert.equal((await post('signup', '10.0.0.1', { username: name(), password: PW })).status, 200);
  assert.equal((await post('signup', '10.0.0.1', { username: name(), password: PW })).status, 429);
  assert.equal((await post('signup', '10.0.0.2', { username: name(), password: PW })).status, 200); // someone else still can
});

test('wrong passwords lock out the guesser, not the account owner', async () => {
  const username = name();
  assert.equal((await post('signup', '10.1.0.1', { username, password: PW })).status, 200);
  for (let i = 0; i < 5; i++) assert.equal((await post('login', '10.1.6.6', { username, password: 'wrongwrong' })).status, 401);
  // the guesser is stopped, even with the right password
  assert.equal((await post('login', '10.1.6.6', { username, password: 'wrongwrong' })).status, 429);
  assert.equal((await post('login', '10.1.6.6', { username, password: PW })).status, 429);
  // the owner, from their own connection, gets in
  const r = await post('login', '10.1.0.1', { username, password: PW });
  assert.equal(r.status, 200);
  assert.match(r.data.key, /^[a-f0-9]{64}$/);
});

test('one IP can\'t try many accounts quickly', async () => {
  let last;
  for (let i = 0; i < 31; i++) last = await post('login', '10.2.0.1', { username: name(), password: 'wrongwrong' });
  assert.equal(last.status, 429);
});
