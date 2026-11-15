/* The game's connection to the server-side economy.

   Gold, XP, kills, the bag, owned gear, looted sea chests and the farm plot all live on the
   server (api/game/[action].js, rules in game/world3d/economy.js). The game still plays every
   action out straight away; it also hands each one to Ledger.act(), which sends them to the
   server in small batches. The server checks each against the rules and answers with the
   account's real state, which is written back into the game (Ledger.on) and into localStorage
   (taproot_field, taproot_owned, taproot_sea_loot, taproot_myfarm) as a cache for the next
   page. If the browser ever got ahead of what the server allows, that answer corrects it.

   Actions not yet sent are kept in localStorage, so closing the tab or losing the connection
   doesn't lose them; they go out at the next chance.

   Load with a plain <script> before the game's own scripts, then Ledger.init(). */
(function () {
  'use strict';
  const SESSION = 'taproot_session';
  const OWNER = 'taproot_owner';   // username the cached state and the queue belong to
  const QUEUE = 'taproot_pending'; // actions not yet accepted by the server
  const CHAR = 'taproot_character';
  const K = { field: 'taproot_field', owned: 'taproot_owned', loot: 'taproot_sea_loot', farm: 'taproot_myfarm' };
  const BATCH = 60;
  const KEEPALIVE_MAX = 60 * 1024;
  // Before multiplayer moved to the accounts' project: used until SUPABASE_ANON_KEY is set.
  const LEGACY_REALTIME = {
    url: 'https://azvdqigaqwbeakjieaps.supabase.co',
    key: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF6dmRxaWdhcXdiZWFramllYXBzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM0OTE0NjEsImV4cCI6MjA5OTA2NzQ2MX0.QXBpcGKsot8A8w6rq76F6lvGjCVJN0NytDmfmE8C-Dw',
  };

  /* Where the game API lives: the Supabase Edge Function `game` on the live site, the dev server
     (game-dev-server.js) when playing locally. window.TAPROOT_API, or a taproot_api entry in
     localStorage, points it anywhere else (a self-hosted server, a staging project). */
  const API = (() => {
    try { if (window.TAPROOT_API) return String(window.TAPROOT_API); } catch (e) {}
    try { const v = window.localStorage.getItem('taproot_api'); if (v) return v; } catch (e) {}
    const local = /^(localhost|127\.0\.0\.1|\[::1\]|10\.\d+\.\d+\.\d+|192\.168\.\d+\.\d+)$/.test(location.hostname);
    return local ? '/api/game/' : 'https://rxplfcuhsdvqposhpzyp.supabase.co/functions/v1/game/';
  })();

  const proto = Storage.prototype;
  const raw = { get: proto.getItem, set: proto.setItem, remove: proto.removeItem };
  const ls = (() => { try { return window.localStorage; } catch (e) { return null; } })();
  const get = (k) => { try { return raw.get.call(ls, k); } catch (e) { return null; } };
  const set = (k, v) => { try { raw.set.call(ls, k, v); } catch (e) {} };
  const del = (k) => { try { raw.remove.call(ls, k); } catch (e) {} };
  const getJSON = (k) => { try { return JSON.parse(get(k)); } catch (e) { return null; } };
  const setJSON = (k, v) => set(k, JSON.stringify(v));
  // A real session key (the browser tests sign in with a placeholder, which never reaches the server).
  const sessionKey = () => { const k = get(SESSION); return k && /^[a-f0-9]{64}$/.test(k) ? k : null; };

  let opts = { syncCharacter: false, fast: false };
  let queue = Array.isArray(getJSON(QUEUE)) ? getJSON(QUEUE) : [];
  let inflight = null, timer = null, retryMs = 0;
  let signedOut = false, notReady = false;
  let offset = 0; // server clock minus this browser's clock
  let last = null; // the last state from the server, in this browser's clock
  const listeners = { state: [], rejected: [] };
  const emit = (type, v) => listeners[type].forEach((f) => { try { f(v); } catch (e) { console.error(e); } });
  const saveQueue = () => { if (queue.length) setJSON(QUEUE, queue); else del(QUEUE); };

  // Server timestamps (crop planting, altar boost, claim time) moved onto this browser's clock.
  function toLocal(farm) {
    if (!farm) return null;
    const f = JSON.parse(JSON.stringify(farm));
    for (const c of Object.values(f.crops || {})) c.t -= offset;
    if (f.boost && f.boost[1]) f.boost = [f.boost[0] - offset, f.boost[1] - offset];
    if (f.claimed) f.claimed -= offset;
    return f;
  }

  function apply(st, username) {
    if (!st || !st.econ) return;
    if (st.now) offset = st.now - Date.now();
    const e = st.econ;
    last = { econ: e, owned: st.owned || [], farm: toLocal(st.farm) };
    setJSON(K.field, { xp: e.xp, kills: e.kills, gold: e.gold, bag: e.bag });
    setJSON(K.owned, last.owned);
    setJSON(K.loot, e.loot || []);
    if (last.farm) setJSON(K.farm, last.farm); else del(K.farm);
    if (username) set(OWNER, username);
    emit('state', last);
  }

  async function call(action, body, keepalive) {
    const key = sessionKey();
    if (!key) return { status: 0, data: {} };
    const isGet = body === undefined;
    const payload = isGet ? undefined : JSON.stringify(body);
    const res = await fetch(API + action, {
      method: isGet ? 'GET' : 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + key },
      body: payload,
      keepalive: !!keepalive && !!payload && payload.length < KEEPALIVE_MAX,
    });
    return { status: res.status, data: await res.json().catch(() => ({})) };
  }

  function lostSession() {
    if (signedOut) return;
    signedOut = true;
    window.dispatchEvent(new CustomEvent('taproot-signed-out'));
    if (!document.body) return;
    const bar = document.createElement('div');
    bar.setAttribute('role', 'alert');
    bar.style.cssText = 'position:fixed;left:50%;top:12px;transform:translateX(-50%);z-index:99999;max-width:calc(100% - 32px);'
      + 'background:#2a1020;color:#fff;border:1px solid #ff3fb4;border-radius:10px;padding:10px 14px;font:600 14px system-ui,sans-serif;'
      + 'box-shadow:0 6px 24px rgba(0,0,0,.4)';
    bar.innerHTML = 'You signed in somewhere else, so nothing you do here is being saved. '
      + '<a href="/game/" style="color:#c8ff2e">Sign in again</a>';
    document.body.appendChild(bar);
  }

  function schedule(ms) {
    clearTimeout(timer);
    timer = setTimeout(() => flush(false), ms);
  }

  // Send queued actions. Resolves true once the queue is empty.
  async function flush(keepalive) {
    clearTimeout(timer); timer = null;
    if (signedOut || !queue.length) return !queue.length;
    if (inflight) { await inflight; return flush(keepalive); }
    inflight = (async () => {
      const batch = queue.slice(0, BATCH);
      let r;
      try { r = await call('act', { actions: batch, fast: opts.fast || undefined, sent: Math.round(performance.timeOrigin + performance.now()) }, keepalive); } catch (e) { r = null; }
      if (!r || r.status === 0) { retryMs = Math.min(30000, (retryMs || 2000) * 2); schedule(retryMs); return; } // offline: try again
      if (r.status === 401) { lostSession(); return; }
      if (r.status === 200) {
        retryMs = 0;
        queue.splice(0, batch.length); saveQueue();
        const bad = batch.map((a, i) => [a, r.data.results[i]]).filter(([, why]) => why);
        if (bad.length) emit('rejected', bad);
        if (!queue.length) apply(r.data.state, get(OWNER));
        return;
      }
      if (r.status === 400) { queue.splice(0, batch.length); saveQueue(); load(); return; } // malformed: drop it, resync
      if (r.status === 503) notReady = true;
      retryMs = Math.min(60000, (retryMs || 5000) * 2); schedule(retryMs);
    })();
    try { await inflight; } finally { inflight = null; }
    if (queue.length && !timer && !signedOut) return flush(keepalive);
    return !queue.length;
  }

  // Watch for gear equipped in the 3D world, to save it to the account.
  let charTimer = null;
  async function pushCharacter() {
    charTimer = null;
    const character = getJSON(CHAR);
    if (!character || !character.cls || signedOut) return;
    try { const r = await call('save', { character }); if (r.status === 401) lostSession(); } catch (e) {}
  }
  proto.setItem = function (k, v) {
    raw.set.call(this, k, v);
    if (this === ls && k === CHAR && opts.syncCharacter) { clearTimeout(charTimer); charTimer = setTimeout(pushCharacter, 1200); }
  };

  const flushNow = () => { if (queue.length) flush(true); if (charTimer) { clearTimeout(charTimer); pushCharacter(); } };
  window.addEventListener('pagehide', flushNow);
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') flushNow(); });
  window.addEventListener('online', () => { if (queue.length) flush(false); });

  // Fetch the account's state from the server (after sending anything still queued).
  async function load() {
    if (!sessionKey()) return null;
    if (queue.length) { await flush(false); if (!queue.length) return last; }
    let r;
    try { r = await call('state'); } catch (e) { return null; }
    if (r.status === 401) { lostSession(); return null; }
    if (r.status === 503) { notReady = true; return null; }
    if (r.status !== 200) return null;
    if (get(OWNER) && get(OWNER) !== r.data.username) { queue = []; saveQueue(); }
    apply(r.data, r.data.username);
    return last;
  }

  // Progress a browser saved before the server kept it, from the old localStorage keys.
  function legacyImport() {
    const field = getJSON(K.field), owned = getJSON(K.owned), loot = getJSON('taproot_sea_loot');
    // the farm plot, saved per character name before farms moved to the server
    let farm = null;
    try { for (let i = 0; i < ls.length && !farm; i++) { const k = ls.key(i); if (k && k.startsWith('taproot_farm2_')) farm = getJSON(k); } } catch (e) {}
    if (!farm || typeof farm !== 'object' || !farm.id) farm = null;
    const any = (field && (field.gold || field.xp || field.kills || Object.keys(field.bag || {}).length))
      || (Array.isArray(owned) && owned.length) || (Array.isArray(loot) && loot.length) || farm;
    return any ? { t: 'import', field: field || {}, owned: owned || [], loot: loot || [], ...(farm ? { farm } : {}) } : null;
  }

  const Ledger = {
    init(o) { Object.assign(opts, o || {}); return Ledger; },
    api: API, // the game API's base address (ends with /)
    // Queue an action for the server: { t: 'kill', m: 'slime' }, { t: 'buy', shop, id, n }, ...
    act(a) {
      if (!a || !sessionKey()) return;
      queue.push(a); saveQueue();
      if (!inflight) schedule(250);
    },
    flush: () => flush(false),
    load,
    // After sign-in (login / me / signup response): line this browser up with the account.
    adopt(user) {
      if (!user || !user.username) return;
      signedOut = false;
      const owner = get(OWNER);
      if (owner && owner !== user.username) { queue = []; saveQueue(); } // another account's unsent actions
      const st = user.state;
      if (!st) { notReady = true; return; }
      if (!owner && !st.econ.imported) { // first sign-in on a browser that played before saves moved to the server
        const imp = legacyImport();
        if (imp) { set(OWNER, user.username); queue.unshift(imp); saveQueue(); flush(false); return; }
      }
      apply(st, user.username);
      if (queue.length) flush(false);
    },
    // Send what's left, then forget this account's progress on this browser.
    async signOut() {
      const sent = await flush(false);
      for (const k of Object.values(K)) del(k);
      if (sent) { del(OWNER); del(QUEUE); } // unsent actions stay, for this account's next sign-in
      last = null;
      return sent;
    },
    // Where multiplayer connects: the accounts' Supabase project once it has a public key set.
    async realtime() {
      try {
        const r = await fetch(API + 'config');
        const d = await r.json();
        if (d && d.realtime && d.realtime.url && d.realtime.key) return d.realtime;
      } catch (e) {}
      return LEGACY_REALTIME;
    },
    // Every claimed plot (for showing farms whose owners are offline), in this browser's clock.
    async farms() {
      try {
        const r = await fetch(API + 'farms');
        if (!r.ok) return [];
        const d = await r.json();
        const off = d.now ? d.now - Date.now() : offset;
        const saved = offset; offset = off;
        try { return (d.farms || []).map(toLocal); } finally { offset = saved; }
      } catch (e) { return []; }
    },
    on(type, fn) { listeners[type].push(fn); return Ledger; },
    // The current state as last cached: { econ: { gold, xp, kills, bag, loot }, owned, farm }.
    cached() {
      if (last) return last;
      const f = getJSON(K.field) || {};
      return { econ: { gold: f.gold || 0, xp: f.xp || 0, kills: f.kills || 0, bag: f.bag || {}, loot: getJSON(K.loot) || [] }, owned: getJSON(K.owned) || [], farm: getJSON(K.farm) };
    },
    get pending() { return queue.length; },
    get status() { return { signedOut, notReady, pending: queue.length, offset }; },
  };
  window.Ledger = Ledger;
})();
