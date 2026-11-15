// Headless Chrome harness for /game/world3d checks. Needs the game server on :8137
// (node game-dev-server.js, the "game" entry in .claude/launch.json).
import { spawn } from 'node:child_process';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import WebSocket from 'ws';

export const BASE = 'http://localhost:8137';
export const OUT = join(dirname(fileURLToPath(import.meta.url)), 'out');
export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const CHROME = process.env.CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

export async function launch() {
  mkdirSync(OUT, { recursive: true });
  const port = 9400 + Math.floor(Math.random() * 400);
  const prof = mkdtempSync(join(tmpdir(), 'w3d-'));
  const chrome = spawn(CHROME, ['--headless=new', `--remote-debugging-port=${port}`, `--user-data-dir=${prof}`, '--window-size=1280,720',
    '--disable-renderer-backgrounding', '--disable-background-timer-throttling', '--disable-backgrounding-occluded-windows', ...(process.platform === 'darwin' ? ['--use-angle=metal'] : ['--use-angle=swiftshader', '--enable-unsafe-swiftshader']), 'about:blank'],
  { stdio: 'ignore', detached: true });
  const kill = () => { try { process.kill(-chrome.pid); } catch (e) {} };
  process.on('exit', kill);
  let ver;
  for (let i = 0; i < 40 && !ver; i++) { await sleep(500); try { ver = await (await fetch(`http://127.0.0.1:${port}/json/version`)).json(); } catch (e) {} }
  const ws = new WebSocket(ver.webSocketDebuggerUrl);
  await new Promise((r) => ws.once('open', r));
  let id = 0;
  const pend = new Map();
  ws.on('message', (m) => {
    const d = JSON.parse(m);
    if (d.id && pend.has(d.id)) { pend.get(d.id)(d); pend.delete(d.id); }
    if (d.method === 'Runtime.exceptionThrown') console.log('PAGE EXCEPTION', d.params.exceptionDetails.exception?.description?.slice(0, 400));
  });
  const send = (method, params = {}, sessionId) => new Promise((r) => { const i = ++id; pend.set(i, r); ws.send(JSON.stringify({ id: i, method, params, sessionId })); });

  async function player(name, { mobile = false } = {}) {
    const { result: { browserContextId } } = await send('Target.createBrowserContext');
    const { result: { targetId } } = await send('Target.createTarget', { url: 'about:blank', browserContextId, newWindow: true, background: false });
    const { result: { sessionId } } = await send('Target.attachToTarget', { targetId, flatten: true });
    const s = (m, p) => send(m, p, sessionId);
    await s('Page.enable');
    await s('Runtime.enable');
    await s('Emulation.setFocusEmulationEnabled', { enabled: true });
    await s('Page.bringToFront');
    await s('Emulation.setDeviceMetricsOverride', mobile ? { width: 390, height: 844, deviceScaleFactor: 2, mobile: true } : { width: 1280, height: 720, deviceScaleFactor: 1, mobile: false });
    if (mobile) await s('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 });
    const p = {
      name, send: s,
      ev: async (expr) => {
        const r = await s('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true });
        if (r.result?.exceptionDetails) throw new Error(`${name}: ${r.result.exceptionDetails.exception?.description || r.result.exceptionDetails.text}`);
        const v = r.result?.result;
        return v && 'unserializableValue' in v ? Number(v.unserializableValue) : v?.value; // -0, NaN, Infinity
      },
      go: async (url) => { await s('Page.navigate', { url }); await sleep(300); },
      key: async (code, key = code, hold = 40) => { await s('Input.dispatchKeyEvent', { type: 'keyDown', code, key }); await sleep(hold); await s('Input.dispatchKeyEvent', { type: 'keyUp', code, key }); await sleep(40); },
      down: (code, key = code) => s('Input.dispatchKeyEvent', { type: 'keyDown', code, key }),
      up: (code, key = code) => s('Input.dispatchKeyEvent', { type: 'keyUp', code, key }),
      mouse: (type, x, y, button = 'left', extra = {}) => s('Input.dispatchMouseEvent', { type, x, y, button, clickCount: 1, ...extra }),
      touch: (type, points) => s('Input.dispatchTouchEvent', { type, touchPoints: points.map(([x, y], i) => ({ x, y, id: i })) }),
      shot: async (file) => { const r = await s('Page.captureScreenshot', { format: 'png' }); writeFileSync(join(OUT, file), Buffer.from(r.result.data, 'base64')); },
    };
    await p.go(`${BASE}/game/`);
    await sleep(500);
    await p.ev(`localStorage.setItem('taproot_session', 'test'); localStorage.setItem('taproot_character', JSON.stringify({ name: ${JSON.stringify(name)}, skin: 1, hc: 0, hs: 'short', equipment: {} })); 1`);
    return p;
  }
  return { player, kill };
}

// Waits for the game to boot and join the multiplayer channel.
export const ready = (p) => p.ev(`new Promise((r) => { const t = setInterval(() => { if (window.__world3d && __world3d.mp.live) { clearInterval(t); r(true); } }, 200); setTimeout(() => r(false), 25000); })`);
// The prompt in the near-chip (F actions), or '' when hidden.
export const near = (p) => p.ev(`document.getElementById('nearChip').hidden ? '' : document.getElementById('nearText').textContent`);
export const AVENUES = `${BASE}/game/world3d/?area=avenues&farmfast=1&hour=13`;

// For arena tests that measure a fighter's HP: stand the Gladiator down and park the hazard
// clock in a gap between events, so the only damage is the damage the test causes.
export const calm = (p) => p.ev(`(() => {
  for (const m of __world3d.monsters) m.dead = true;
  const a = __world3d.arenaMod;
  let n = Math.round(Date.now() / a.PERIOD_MS);
  while (a.eventAt(n).endMs + 2000 >= a.eventAt(n + 1).tellMs) n++;
  __world3d.hazardClock(a.eventAt(n).endMs + 1000);
  return true;
})()`);
