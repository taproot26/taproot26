/* The game API: accounts, the server-side economy, combat checks, farms.

   Runs as the Supabase Edge Function `game` (index.ts: Deno.serve(serveGame)), and under node
   for local testing (api/game/[action].js, used by game-dev-server.js and the tests). Plain
   ES module with node:crypto, which Deno supports, so both run this same file.

   The rules it applies live in ./rules/: copies of game/items.js and game/world3d/{economy,
   shops,farm,blocks}.js (Edge Functions can only bundle files inside supabase/functions).
   `node tools/sync-edge-rules.mjs` refreshes them, and tests/edge-rules-sync.test.mjs fails if
   they ever differ from the game's.

   Routes (the last path segment is the action):
     GET  config, farms               public
     POST signup, login               public
     GET  me, state                   signed in (Authorization: Bearer <session key>)
     POST act, save, logout           signed in */
import crypto from 'node:crypto';
import { Buffer } from 'node:buffer';
import './rules/items.js'; // sets globalThis.GAME
import * as E from './rules/economy.js';

const G = globalThis.GAME;
const STYLES = ['short', 'long', 'bald'];
const ALL_ITEMS = Object.keys(G.ITEMS);
/* Rate limits, counted in the database (game_hit(), supabase/migrations/20261114_auth_rate_limits.sql)
   as [max, window seconds]. Per IP, and per IP + username for wrong passwords, so a stranger can't
   lock someone out of their own account; the per-username cap only slows a guesser spread over
   many IPs, and is far above what an owner who forgot their password would hit. */
const RATE = {
  signup: [5, 3600],          // new accounts per IP
  login: [30, 600],           // log-in attempts per IP
  loginFail: [5, 900],        // wrong passwords per IP + username
  loginFailUser: [50, 3600],  // wrong passwords per username, from anywhere
};
const SESSION_MS = 30 * 24 * 60 * 60 * 1000;
const DUMMY_HASH = '00'.repeat(16) + ':' + '00'.repeat(64);
const MAX_ACTIONS = 60; // per request
const ROW = 'id,username,character,inventory,econ,econ_rev,farm,farm_plot';
const GETS = ['me', 'state', 'farms', 'config'];

const sha256 = (s) => crypto.createHash('sha256').update(s).digest('hex');
const scrypt = (pw, salt) => new Promise((ok, no) => crypto.scrypt(pw, salt, 64, (e, k) => (e ? no(e) : ok(k))));
const has = (obj, key) => Object.prototype.hasOwnProperty.call(obj, key);

async function hashPassword(pw) {
  const salt = crypto.randomBytes(16);
  return salt.toString('hex') + ':' + (await scrypt(pw, salt)).toString('hex');
}
async function checkPassword(pw, stored) {
  const [salt, hash] = stored.split(':');
  const got = await scrypt(pw, Buffer.from(salt, 'hex'));
  return crypto.timingSafeEqual(got, Buffer.from(hash, 'hex'));
}

class NotMigrated extends Error {}
// PostgREST answers 400 for a column it doesn't know: the migration hasn't been run.
const notMigrated = (r) => r.status === 400 && /econ|farm/.test(JSON.stringify(r.data || ''));

/* env: {
     url:        the Supabase project URL (SUPABASE_URL)
     serviceKey: its service-role key (server only, never sent to the browser)
     anonKey:    its public anon key, handed to the browser for Realtime multiplayer
     dev:        local testing: every account owns every item, ?farmfast works }
   Returns handle({ method, action, headers, body, ip }) -> { status, body }. */
export function makeGameApi(env) {
  const BASE_URL = env.url || 'https://rxplfcuhsdvqposhpzyp.supabase.co';
  const TABLE = BASE_URL + '/rest/v1/game_players';
  const SERVICE_KEY = env.serviceKey;
  const ANON_KEY = env.anonKey || '';
  const DEV = !!env.dev;

  async function db(query, init = {}) {
    const res = await fetch(TABLE + query, {
      ...init,
      headers: {
        apikey: SERVICE_KEY,
        Authorization: 'Bearer ' + SERVICE_KEY,
        'Content-Type': 'application/json',
        Prefer: 'return=representation',
      },
    });
    const text = await res.text();
    let data = null;
    try { data = text ? JSON.parse(text) : null; } catch (e) { data = text; }
    return { status: res.status, data };
  }

  /* Counts `cost` hits against a limit and says whether the caller is still within it (cost 0 only
     checks). Until the migration is run the function doesn't exist; then it lets everything through
     and says so in the log, rather than lock everyone out. */
  let warnedNoLimits = false;
  async function within(name, key, cost = 1) {
    const [max, windowS] = RATE[name];
    try {
      const res = await fetch(BASE_URL + '/rest/v1/rpc/game_hit', {
        method: 'POST',
        headers: { apikey: SERVICE_KEY, Authorization: 'Bearer ' + SERVICE_KEY, 'Content-Type': 'application/json' },
        body: JSON.stringify({ k: name + ':' + sha256(key), max_hits: max, window_s: windowS, cost }),
      });
      if (res.ok) return (await res.json()) !== false;
      if (!warnedNoLimits) { warnedNoLimits = true; console.warn('rate limits are off: game_hit() answered ' + res.status + ' (run supabase/migrations)'); }
    } catch (e) { console.error('rate limit check failed', e); }
    return true;
  }
  const TOO_MANY = { error: 'Too many attempts. Try again in a few minutes' };

  function newSession() {
    const key = crypto.randomBytes(32).toString('hex');
    const expires = new Date(Date.now() + SESSION_MS).toISOString();
    return { key, fields: { session_hash: sha256(key), session_expires: expires } };
  }

  async function sessionUser(headers) {
    const m = /^Bearer ([a-f0-9]{64})$/.exec(headers.authorization || '');
    if (!m) return null;
    const now = encodeURIComponent(new Date().toISOString());
    const r = await db(`?session_hash=eq.${sha256(m[1])}&session_expires=gt.${now}&select=${ROW}`);
    if (notMigrated(r)) throw new NotMigrated();
    return (r.data && r.data[0]) || null;
  }

  // The gear an account owns. Local testing owns everything.
  const ownedItems = (user) => {
    const saved = Array.isArray(user.inventory) ? user.inventory.filter((id) => typeof id === 'string' && has(G.ITEMS, id)) : [];
    return [...new Set(DEV ? [...saved, ...ALL_ITEMS] : saved)];
  };
  // A class's starting kit, given with the first character an account makes.
  const kitOf = (cls) => Object.values(G.defaultEquipment(cls) || {}).filter((id) => id && has(G.ITEMS, id));

  // Validates a character. Gear the account doesn't own is taken off rather than refused.
  function cleanCharacter(c, owned) {
    if (!c || typeof c !== 'object') return null;
    const skin = Number(c.skin);
    const hc = Number(c.hc);
    if (!has(G.BASE, c.cls) || !STYLES.includes(c.hs)) return null;
    if (!Number.isInteger(skin) || skin < 0 || skin > 4) return null;
    if (!Number.isInteger(hc) || hc < 0 || hc > 5) return null;

    const wanted = c.equipment && typeof c.equipment === 'object' ? G.migrateEquipment({ ...c.equipment }) : G.defaultEquipment(c.cls);
    const equipment = {};
    for (const slot of G.SLOTS) {
      const id = wanted[slot] ?? null;
      const ok = typeof id === 'string' && has(G.ITEMS, id) && G.fits(G.ITEMS[id], slot) && owned.includes(id);
      equipment[slot] = ok ? id : null;
    }
    if (equipment.lhand && equipment.lhand === equipment.rhand) equipment.lhand = null; // one item, one hand
    return {
      name: String(c.name ?? '').trim().slice(0, 16),
      cls: c.cls, skin, hs: c.hs, hc, equipment,
      stats: G.computeStats(c.cls, equipment),
    };
  }

  const patch = (id, fields) => db(`?id=eq.${id}`, { method: 'PATCH', body: JSON.stringify(fields) });

  // Everything the game needs to know about an account's progress.
  const stateOf = (user) => ({
    econ: E.publicEcon(E.normEcon(user.econ)),
    owned: ownedItems(user),
    farm: user.farm || null,
    now: Date.now(),
  });

  // The player's real attack stats and weapons, from the saved character and only gear they own.
  function fighter(user, owned) {
    const c = user.character;
    if (!c || !has(G.BASE, c.cls)) return { stats: { atk: 10, mag: 2 }, hands: {} };
    const eq = {};
    for (const [slot, id] of Object.entries(G.migrateEquipment({ ...(c.equipment || {}) }))) if (id && owned.includes(id)) eq[slot] = id;
    const st = G.computeStats(c.cls, eq);
    return { stats: { atk: st.atk, mag: st.mag }, hands: { R: eq.rhand || null, L: eq.lhand || null } };
  }

  /* Runs a batch of actions against the account, then saves it in one compare-and-swap write on
     econ_rev, so two requests at once can't both spend the same gold. Retries on a clash. */
  async function act(user, actions, opts) {
    for (let attempt = 0; attempt < 4; attempt++) {
      const s = { econ: E.normEcon(user.econ), owned: ownedItems(user), farm: user.farm ? JSON.parse(JSON.stringify(user.farm)) : null };
      const ctx = {
        now: Date.now(), dev: DEV, isGear: (id) => has(G.ITEMS, id),
        owner: (user.character && user.character.name) || user.username,
        minute: DEV && opts.fast ? 1000 : 60000,
        sent: opts.sent, // the browser's clock when it sent this batch (for the game-clock check)
        plotTaken: opts.plotTaken, // an imported farm skips a plot someone else holds
        rand: () => crypto.randomInt(0, 2 ** 32) / 2 ** 32, // gold drops are rolled here, not in the browser
        ...fighter(user, s.owned),
      };
      let character = user.character;
      const results = actions.map((a) => {
        if (a && a.t === 'claim' && opts.plotTaken === a.plot) return 'plot taken';
        if (a && a.t === 'equip') { // gear changed in the world: in the queue, so later hits use it
          if (!character) return 'no character';
          const c = cleanCharacter({ ...character, equipment: a.eq }, s.owned);
          if (!c) return 'bad gear';
          character = c;
          Object.assign(ctx, fighter({ character }, s.owned));
          return '';
        }
        return E.applyAction(s, a, ctx);
      });
      const rev = user.econ_rev || 0;
      const r = await db(`?id=eq.${user.id}&econ_rev=eq.${rev}`, {
        method: 'PATCH',
        body: JSON.stringify({
          econ: s.econ, econ_rev: rev + 1, inventory: s.owned, farm: s.farm, farm_plot: s.farm ? s.farm.id : null,
          ...(character !== user.character ? { character } : {}),
        }),
      });
      if (notMigrated(r)) throw new NotMigrated();
      if (r.status === 409 && /farm_plot/.test(JSON.stringify(r.data))) { // someone else holds that plot
        // a claim, or a farm brought along by an import: try again without that plot
        const claim = actions.find((a) => a && (a.t === 'claim' || (a.t === 'import' && a.farm && typeof a.farm === 'object')));
        if (!claim || opts.plotTaken) throw new Error('plot conflict');
        opts.plotTaken = claim.t === 'claim' ? claim.plot : claim.farm.id;
        continue;
      }
      if (r.status >= 300) throw new Error('act write failed: ' + r.status);
      const saved = r.data && r.data[0];
      if (saved) return { results, state: stateOf(saved), ...(character !== user.character ? { character } : {}) };
      // econ_rev moved on (another request saved first): reload and run the batch again
      const fresh = await db(`?id=eq.${user.id}&select=${ROW}`);
      user = fresh.data && fresh.data[0];
      if (!user) throw new Error('account vanished');
    }
    throw new Error('too many save conflicts');
  }

  // headers: lower-case names. ip: the caller's address (for rate limits).
  return async function handle({ method, action, headers = {}, body = {}, ip = 'unknown' }) {
    const send = (status, b) => ({ status, body: b });
    if (!SERVICE_KEY) return send(500, { error: 'Server is not set up yet' });
    if (method !== (GETS.includes(action) ? 'GET' : 'POST')) return send(405, { error: 'Method not allowed' });

    body = typeof body === 'object' && body ? body : {};
    const username = String(body.username ?? '').trim().toLowerCase();
    const password = String(body.password ?? '');

    try {
      /* ---- public ---- */
      if (action === 'config') {
        return send(200, { realtime: ANON_KEY ? { url: BASE_URL, key: ANON_KEY } : null });
      }
      if (action === 'farms') { // every claimed plot, so farms show while their owners are offline
        const r = await db('?farm_plot=not.is.null&select=farm');
        if (notMigrated(r)) throw new NotMigrated();
        if (r.status >= 300) throw new Error('farms read failed: ' + r.status);
        return send(200, { farms: (r.data || []).map((row) => row.farm).filter(Boolean), now: Date.now() });
      }

      if (action === 'signup') {
        if (!/^[a-z0-9_]{3,20}$/.test(username)) return send(400, { error: 'Username must be 3-20 letters, numbers or underscores' });
        if (password.length < 8 || password.length > 128) return send(400, { error: 'Password must be 8-128 characters' });
        if (!(await within('signup', ip))) return send(429, { error: 'Too many new accounts from here. Try again later' });
        const s = newSession();
        const inventory = DEV ? ALL_ITEMS : [];
        const econ = E.newEcon();
        if (DEV) econ.bag.smoke_bomb = 5; // local testing: a few to hand
        const r = await db('', {
          method: 'POST',
          body: JSON.stringify({ username, password_hash: await hashPassword(password), inventory, econ, ...s.fields }),
        });
        if (r.status === 409) return send(409, { error: 'That username is taken' });
        if (notMigrated(r)) throw new NotMigrated();
        if (r.status >= 300) throw new Error('insert failed: ' + r.status);
        const user = r.data[0];
        return send(200, { key: s.key, username, character: null, inventory: ownedItems(user), state: stateOf(user) });
      }

      if (action === 'login') {
        const valid = /^[a-z0-9_]{3,20}$/.test(username) && password.length <= 128;
        const ipUser = ip + '|' + username;
        if (!(await within('login', ip))) return send(429, TOO_MANY);
        if (!(await within('loginFail', ipUser, 0)) || !(await within('loginFailUser', username, 0))) return send(429, TOO_MANY);
        const r = valid ? await db(`?username=eq.${username}&select=${ROW},password_hash`) : { data: null };
        if (notMigrated(r)) throw new NotMigrated();
        const user = r.data && r.data[0];
        const ok = valid && (await checkPassword(password, user ? user.password_hash : DUMMY_HASH));
        if (!user || !ok) {
          await within('loginFail', ipUser);
          await within('loginFailUser', username);
          return send(401, { error: 'Wrong username or password' });
        }
        const s = newSession();
        await patch(user.id, s.fields);
        return send(200, { key: s.key, username: user.username, character: user.character, inventory: ownedItems(user), state: stateOf(user) });
      }

      /* ---- signed in ---- */
      const user = await sessionUser(headers);
      if (!user) return send(401, { error: 'Please sign in again' });

      if (action === 'me') {
        return send(200, { username: user.username, character: user.character, inventory: ownedItems(user), state: stateOf(user) });
      }
      if (action === 'state') return send(200, { username: user.username, ...stateOf(user) });

      if (action === 'act') {
        const actions = Array.isArray(body.actions) ? body.actions : null;
        if (!actions || !actions.length || actions.length > MAX_ACTIONS) return send(400, { error: 'Invalid actions' });
        return send(200, await act(user, actions, { fast: !!body.fast, sent: Number(body.sent) }));
      }

      if (action === 'save') {
        let owned = ownedItems(user);
        const first = !user.character;
        if (first && body.character && has(G.BASE, body.character.cls)) owned = [...new Set([...owned, ...kitOf(body.character.cls)])];
        const character = cleanCharacter(body.character, owned);
        if (!character) return send(400, { error: 'Invalid character' });
        await patch(user.id, first ? { character, inventory: owned } : { character });
        return send(200, { ok: true, character, inventory: owned });
      }

      if (action === 'logout') {
        await patch(user.id, { session_hash: null, session_expires: null });
        return send(200, { ok: true });
      }

      return send(404, { error: 'Not found' });
    } catch (e) {
      if (e instanceof NotMigrated) return send(503, { error: 'The game database needs its latest update (supabase/migrations)' });
      console.error(e);
      return send(500, { error: 'Something went wrong' });
    }
  };
}

/* ---- the Edge Function: a web Request in, a Response out ---- */

// The game page is on another domain, and signs in with its own Bearer session key, not cookies,
// so any origin may call. Date is exposed for the arena's shared clock.
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, content-type, apikey, x-client-info',
  'Access-Control-Expose-Headers': 'Date',
  'Access-Control-Max-Age': '86400',
};

/* The caller's address. Supabase's edge sits behind Cloudflare, which sets cf-connecting-ip to the
   real client; x-forwarded-for's first entry is the fallback (the client can't remove what the
   proxies add after it, only prepend). */
export function callerIp(h) {
  const xff = String(h.get('x-forwarded-for') || '').split(',').map((x) => x.trim()).filter(Boolean);
  return String(h.get('cf-connecting-ip') || h.get('x-real-ip') || xff[0] || 'unknown').slice(0, 64);
}

let handler = null;
// env: as makeGameApi; read once, on the first request.
export async function serveGame(req, env) {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
  handler ||= makeGameApi(env);
  const url = new URL(req.url);
  const action = url.pathname.split('/').filter(Boolean).pop() || '';
  let body = {};
  if (req.method === 'POST') { try { body = await req.json(); } catch (e) { body = {}; } }
  const headers = {};
  req.headers.forEach((v, k) => { headers[k.toLowerCase()] = v; });
  const out = await handler({ method: req.method, action, headers, body, ip: callerIp(req.headers) });
  return new Response(JSON.stringify(out.body), { status: out.status, headers: { ...CORS, 'Content-Type': 'application/json' } });
}
