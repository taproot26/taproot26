// The server-side economy in a real browser: plays the 3D world (fight, loot, shop, farm, sail)
// against a fresh dev server with local-testing perks off, then checks the server agrees with
// the game and that cheats made in the browser don't stick.
//
//   node tests/economy.e2e.mjs            (CHROME=/path/to/chrome to pick the browser)
//   EDGE=1 node tests/economy.e2e.mjs     the API runs as the Supabase Edge Function does (serveGame,
//                                         on another origin, so CORS is exercised) instead of /api/game
import { spawn, execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
import WebSocket from 'ws';
import http from 'node:http';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const PORT = 8300 + Math.floor(Math.random() * 500);
const B = `http://127.0.0.1:${PORT}`;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const which = (c) => { try { return execFileSync('which', [c]).toString().trim(); } catch (e) { return null; } };
const CHROME = process.env.CHROME || ['chromium', 'chromium-browser', 'google-chrome', 'google-chrome-stable'].map(which).find(Boolean)
  || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

const tmp = mkdtempSync(join(tmpdir(), 'taproot-e2e-'));
// EDGE=1: the Edge Function's entry point behind a plain HTTP server on its own port (another origin)
const EDGE = process.env.EDGE === '1';
const EPORT = PORT + 1;
let API = `${B}/api/game/`;
if (EDGE) {
  const { serveGame } = await import('../supabase/functions/game/api.js');
  const env = { url: B, serviceKey: 'local-mock-key' };
  http.createServer(async (req, res) => {
    let raw = ''; for await (const c of req) raw += c;
    const r = await serveGame(new Request(`http://127.0.0.1:${EPORT}${req.url}`, { method: req.method, headers: req.headers, body: ['GET', 'HEAD', 'OPTIONS'].includes(req.method) ? undefined : raw }), env);
    res.writeHead(r.status, Object.fromEntries(r.headers)); res.end(r.status === 204 ? undefined : await r.text());
  }).listen(EPORT);
  API = `http://127.0.0.1:${EPORT}/functions/v1/game/`;
}
// always the local mock database, never a real Supabase project
const server = spawn(process.execPath, [join(ROOT, 'game-dev-server.js')], {
  env: { ...process.env, PORT: String(PORT), DB_PATH: join(tmp, 'db.json'), SUPABASE_URL: B, SUPABASE_SERVICE_KEY: 'local-mock-key', GAME_DEV: '0' },
  stdio: 'ignore',
});
const dport = 9400 + Math.floor(Math.random() * 400);
const chrome = spawn(CHROME, ['--headless=new', '--no-sandbox', `--remote-debugging-port=${dport}`, `--user-data-dir=${join(tmp, 'profile')}`,
  '--use-gl=swiftshader', '--enable-unsafe-swiftshader', 'about:blank'], { stdio: 'ignore' });
// close the browser first: it keeps writing to its profile while it shuts down
const done = (code) => {
  server.kill();
  chrome.once('exit', () => { try { rmSync(tmp, { recursive: true, force: true, maxRetries: 5 }); } catch (e) {} process.exit(code); });
  chrome.kill();
  setTimeout(() => process.exit(code), 5000);
};

try {
  for (let i = 0; i < 50; i++) { try { await fetch(B + '/game/'); break; } catch (e) { await sleep(100); } }
  const post = async (a, b, key) => (await fetch(`${API}${a}`, { method: 'POST', headers: { 'Content-Type': 'application/json', ...(key ? { Authorization: 'Bearer ' + key } : {}) }, body: JSON.stringify(b) })).json();
  const state = async (key) => (await fetch(`${API}state`, { headers: { Authorization: 'Bearer ' + key } })).json();
  const u = await post('signup', { username: 'e2e' + Date.now().toString(36), password: 'hunter2hunter2' });
  await post('save', { character: { name: 'Smoke', cls: 'knight', skin: 1, hs: 'short', hc: 0 } }, u.key); // knight kit: iron sword
  await post('act', { actions: [{ t: 'chest', id: 'wreck' }, { t: 'chest', id: 'lonely' }] }, u.key); // 65 gold to shop with

  let tabs; for (let i = 0; i < 50 && !tabs; i++) { await sleep(300); try { tabs = await (await fetch(`http://127.0.0.1:${dport}/json`)).json(); } catch (e) {} }
  const ws = new WebSocket(tabs.find((t) => t.type === 'page').webSocketDebuggerUrl);
  await new Promise((r) => ws.once('open', r));
  let id = 0; const pend = new Map(); const errs = [];
  ws.on('message', (m) => {
    const d = JSON.parse(m);
    if (d.id && pend.has(d.id)) { pend.get(d.id)(d.result); pend.delete(d.id); }
    if (d.method === 'Runtime.exceptionThrown') errs.push(d.params.exceptionDetails.exception?.description || d.params.exceptionDetails.text);
  });
  const send = (method, params = {}) => new Promise((r) => { const i = ++id; pend.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
  const ev = async (e) => {
    const r = await send('Runtime.evaluate', { expression: e, awaitPromise: true, returnByValue: true });
    if (r.exceptionDetails) throw new Error(e.slice(0, 80) + ' -> ' + JSON.stringify(r.exceptionDetails).slice(0, 300));
    return r.result.value;
  };
  await send('Runtime.enable');
  const W = 'window.__world3d';

  // sign in the way the 2D page does it
  await send('Page.navigate', { url: B + '/game/' }); await sleep(1500);
  await ev(`localStorage.setItem('taproot_api', ${JSON.stringify(API)}); localStorage.setItem('taproot_session', ${JSON.stringify(u.key)}); fetch(${JSON.stringify(API + 'me')}, { headers: { Authorization: 'Bearer ${u.key}' } })
    .then(r => r.json()).then(me => { Ledger.adopt(me); localStorage.setItem('taproot_character', JSON.stringify(me.character)); return 1; })`);
  await sleep(500);
  await send('Page.navigate', { url: B + '/game/world3d/?nomp&area=avenues' }); await sleep(10000);

  // a fair fight: sword swings 450 ms apart until the slime drops, then pick up what it dropped
  assert.equal(await ev(`(async () => { const w = ${W}; const m = w.monsters[w.spawn('slime', w.P.x + 1, w.P.z)];
    for (let n = 0; n < 20 && !m.dead; n++) { w.hitMonster(m); await new Promise(r => setTimeout(r, 450)); } return m.dead; })()`), true);
  // a cheat: a goblin "killed" with no hits at all
  await ev(`(() => { const w = ${W}; w.killMonster(w.monsters[w.spawn('goblin', w.P.x - 2, w.P.z)]); return 1; })()`);
  await sleep(1500);
  await ev(`(() => { const w = ${W}; for (const d of [...w.drops]) if (!d.taken) w.collect(d); return 1; })()`);
  // shop, claim a plot, plant
  await ev(`(() => { const w = ${W}; w.openShop('The Armoury'); w.shopAct('buy', 'leather_boots', 25);
    w.openShop('Seed Shop'); w.shopAct.n = 2; w.shopAct('buy', 'carrot_seed', 4); w.claimPlot(w.plots[1]); return 1; })()`);
  await sleep(300);
  await ev(`(() => { ${W}.plant('0,0'); return 1; })()`);
  await sleep(3000);

  // (monsters keep respawning, and each one is registered with the server: send what's queued first)
  const local = await ev(`Ledger.flush().then(() => ({ field: ${W}.field(), owned: ${W}.owned(), farm: ${W}.myFarm(), pending: Ledger.pending }))`);
  const srv = await state(u.key);
  console.log('server after play:', JSON.stringify({ gold: srv.econ.gold, xp: srv.econ.xp, kills: srv.econ.kills, bag: srv.econ.bag, owned: srv.owned, plot: srv.farm && srv.farm.id }));
  assert.equal(local.pending, 0);
  assert.equal(srv.econ.kills, 1, 'only the slime that was really fought counts');
  assert.equal(srv.econ.xp, 5);
  assert.equal(srv.econ.bag.slime_gel, 1);
  assert.ok(!srv.econ.bag.goblin_ear, 'no drops from the faked goblin');
  assert.ok(srv.owned.includes('leather_boots'));
  assert.equal(srv.farm.id, 2);
  assert.ok(srv.farm.crops['0,0']);
  // the browser was corrected to what the server says
  assert.deepEqual({ gold: local.field.gold, xp: local.field.xp, bag: local.field.bag }, { gold: srv.econ.gold, xp: srv.econ.xp, bag: srv.econ.bag });

  // a cheat: gold given in the browser, then spent
  await ev(`(() => { const w = ${W}; w.field().gold += 5000; w.openShop('The Armoury'); w.shopAct('buy', 'mirror_shield', 240); return 1; })()`);
  await ev('Ledger.flush()'); // sent and answered (on a busy machine that takes a few seconds)
  assert.equal(await ev(`${W}.owned().includes('mirror_shield')`), false);
  assert.equal(await ev(`${W}.field().gold`), srv.econ.gold);
  assert.equal((await state(u.key)).econ.gold, srv.econ.gold);

  const farms = await (await fetch(API + 'farms')).json();
  assert.deepEqual(farms.farms.map((f) => [f.id, f.owner]), [[2, 'Smoke']]);

  await send('Page.navigate', { url: B + '/game/sea3d/' }); await sleep(8000);
  assert.equal(await ev(`document.getElementById('goldText').textContent`), String(srv.econ.gold));

  // a barrel sailed through pays; one on the far side of the sea a moment later (a teleport) doesn't
  const S = 'window.__sea3d';
  const sail = (slot) => ev(`(() => { const s = ${S}, b = s.barrels[${slot}]; s.B.x = b.x; s.B.z = b.z; s.B.speed = 0; return 1; })()`);
  const far = await ev(`(() => { const s = ${S}, b0 = s.barrels[0]; let far = 1, best = 0;
    s.barrels.forEach((b, i) => { const d = Math.hypot(b.x - b0.x, b.z - b0.z); if (i && d > best) { best = d; far = i; } }); return far; })()`);
  await sail(0);
  // the game picks a barrel up in its frame loop: wait for it (a busy machine renders slowly)
  for (let i = 0; i < 50 && !(await ev(`${S}.barrelGen[0] || 0`)); i++) await sleep(100);
  await sail(far); await sleep(400);
  await ev('Ledger.flush()'); await sleep(500);
  const sea = (await state(u.key)).econ;
  assert.equal(sea.gold, srv.econ.gold + 3, 'the server pays only the barrel the boat could reach');
  assert.deepEqual(sea.barrels, { 0: 1 });
  assert.equal(await ev(`${S}.field().gold`), sea.gold, 'and the browser is corrected');
  assert.equal(await ev(`${S}.barrelGen[${far}] || 0`), 0, 'the refused barrel floats back where the server expects it');

  assert.deepEqual(errs, [], 'no page errors');
  console.log('economy e2e: all checks passed');
  done(0);
} catch (e) {
  console.error(e);
  done(1);
}
