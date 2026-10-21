// Local dev server — runs the game fully offline.
//
//   node game-dev-server.js      then open http://localhost:8137/game/
//
// It serves the static site, runs the real api/game/[action].js handler, and
// fakes the database with a tiny local mock of the Supabase REST API backed by
// game-local-db.json. No Supabase, no keys, no network — accounts you make here
// live only in that local file (delete it to wipe them).
const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const PORT = process.env.PORT || 8137;

// Optionally load .env.local, but default everything to the local mock so it just works.
const envPath = path.join(ROOT, '.env.local');
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/.exec(line);
    if (m && m[2] && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
}
// Point the handler at THIS server's mock DB, with a throwaway key.
process.env.SUPABASE_URL = process.env.SUPABASE_URL || `http://127.0.0.1:${PORT}`;
process.env.SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || 'local-mock-key';

const gameApi = require('./api/game/[action].js'); // reads the env vars above at require time

/* ---------- mock DB (a local JSON file standing in for Supabase/PostgREST) ---------- */
const DB_FILE = path.join(ROOT, 'game-local-db.json');
let rows = [];
let nextId = 1;
try {
  if (fs.existsSync(DB_FILE)) {
    const saved = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
    rows = saved.rows || [];
    nextId = saved.nextId || rows.reduce((m, r) => Math.max(m, r.id || 0), 0) + 1;
  }
} catch (e) { /* start empty */ }
const saveDb = () => { try { fs.writeFileSync(DB_FILE, JSON.stringify({ rows, nextId }, null, 2)); } catch (e) {} };

// The handler only ever uses eq. and gt. filters, which is all we implement.
const parseFilters = (params) => {
  const out = [];
  for (const [k, v] of params) {
    if (k === 'select') continue;
    const m = /^(eq|gt)\.([\s\S]*)$/.exec(v);
    if (m) out.push([k, m[1], m[2]]);
  }
  return out;
};
const matchRow = (row, filters) => filters.every(([f, op, val]) =>
  op === 'eq' ? String(row[f]) === val : String(row[f] ?? '') > val);

function handleMockDb(method, params, raw, respond) {
  const filters = parseFilters(params);
  if (method === 'GET') return respond(200, rows.filter((r) => matchRow(r, filters)));

  let body = {};
  try { body = JSON.parse(raw || '{}'); } catch (e) {}

  if (method === 'POST') {
    if (rows.some((r) => r.username === body.username)) return respond(409, { error: 'duplicate key' });
    const row = { id: nextId++, failed_attempts: 0, locked_until: null, character: null, inventory: null, session_hash: null, session_expires: null, ...body };
    rows.push(row); saveDb();
    return respond(201, [row]);
  }
  if (method === 'PATCH') {
    const updated = [];
    for (const r of rows) if (matchRow(r, filters)) { Object.assign(r, body); updated.push(r); }
    saveDb();
    return respond(200, updated);
  }
  respond(405, { error: 'method not allowed' });
}

/* ---------- static files ---------- */
const MIME = {
  '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json',
  '.webp': 'image/webp', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.ico': 'image/x-icon',
};
function serveStatic(req, res) {
  let p = decodeURIComponent(req.url.split('?')[0]);
  if (p.endsWith('/')) p += 'index.html';
  const file = path.normalize(path.join(ROOT, p));
  if (!file.startsWith(ROOT)) { res.writeHead(403); return res.end('Forbidden'); }
  fs.readFile(file, (err, data) => {
    if (err) { res.writeHead(404); return res.end('Not found'); }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' });
    res.end(data);
  });
}

const collectBody = (req) => new Promise((resolve) => {
  let raw = '';
  req.on('data', (c) => { raw += c; });
  req.on('end', () => resolve(raw));
});

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  const respond = (code, obj) => { res.writeHead(code, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(obj)); };

  // Mock Supabase REST endpoint the handler talks to.
  if (url.pathname === '/rest/v1/game_players') {
    const raw = await collectBody(req);
    return handleMockDb(req.method, url.searchParams, raw, respond);
  }

  // The real serverless function, via a Vercel-like (req, res) shim.
  const apiMatch = /^\/api\/game\/([a-z]+)$/.exec(url.pathname);
  if (apiMatch) {
    const raw = await collectBody(req);
    let body = {};
    try { body = raw ? JSON.parse(raw) : {}; } catch (e) {}
    const shimReq = { method: req.method, headers: req.headers, query: { action: apiMatch[1] }, body };
    const shimRes = {
      _code: 200,
      status(code) { this._code = code; return this; },
      json(obj) { res.writeHead(this._code, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(obj)); },
    };
    return Promise.resolve(gameApi(shimReq, shimRes)).catch((e) => {
      console.error(e);
      if (!res.headersSent) respond(500, { error: 'Something went wrong' });
    });
  }

  serveStatic(req, res);
});

server.listen(PORT, () => console.log(`dev server (static + /api + mock db) on http://localhost:${PORT}/game/  [${rows.length} local account(s)]`));
