#!/usr/bin/env node
// Checks a deployed game: is the site up with the new game files, is the game API (the Supabase
// Edge Function `game`) deployed and set up, has the database update been run? Prints what's
// missing and how to fix it. Read-only unless you pass --signup.
//
//   node tools/healthcheck.js                     the site in CNAME, the API on Supabase
//   node tools/healthcheck.js https://example.com
//   node tools/healthcheck.js --api http://localhost:8137/api/game    (a local dev server)
//   node tools/healthcheck.js --signup            also make a throwaway account and play a little
//
// Exit code 0 when everything passes, 1 otherwise.
const fs = require('fs');
const path = require('path');

const args = process.argv.slice(2);
const SIGNUP = args.includes('--signup');
let base = args.find((a) => /^https?:\/\//.test(a));
if (!base) {
  try { base = 'https://' + fs.readFileSync(path.join(__dirname, '..', 'CNAME'), 'utf8').trim(); } catch (e) {}
}
if (!base) { console.error('Usage: node tools/healthcheck.js https://your-site'); process.exit(2); }
base = base.replace(/\/+$/, '');
const apiArg = args.indexOf('--api');
const API = (apiArg >= 0 && args[apiArg + 1] ? args[apiArg + 1] : 'https://rxplfcuhsdvqposhpzyp.supabase.co/functions/v1/game').replace(/\/+$/, '') + '/';
const DEPLOY = 'deploy it: supabase functions deploy game --no-verify-jwt (from the repo root, after supabase link)';

const results = [];
const check = (ok, name, fix) => { results.push({ ok, name, fix }); console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${ok || !fix ? '' : `\n      -> ${fix}`}`); return ok; };
const warn = (name, fix) => console.log(`WARN  ${name}\n      -> ${fix}`);

async function get(p, init) {
  try {
    const r = await fetch(/^https?:/.test(p) ? p : base + p, { ...init, signal: AbortSignal.timeout(15000) });
    let body = null;
    try { body = await r.json(); } catch (e) {}
    return { status: r.status, body };
  } catch (e) { return { status: 0, body: null, err: e.message }; }
}

(async () => {
  console.log(`Checking ${base} (game API: ${API})\n`);

  const page = await get('/game/');
  check(page.status === 200, 'the game page loads', page.status ? `got HTTP ${page.status}` : `can't reach the site (${page.err})`);

  const ledger = await get('/game/lib/ledger.js');
  const economy = await get('/game/world3d/economy.js');
  check(ledger.status === 200 && economy.status === 200, 'the new game files are deployed (ledger.js, economy.js)',
    'merge and publish the site with the server economy (taproot26/taproot26 PR #4)');

  const cfg = await get(API + 'config', { headers: { Origin: base } });
  const msg = cfg.body && (cfg.body.message || cfg.body.msg || '');
  const newApi = check(cfg.status === 200 && cfg.body && 'realtime' in cfg.body, 'the game API (Edge Function) is deployed',
    cfg.status === 404 ? `the function isn't there yet: ${DEPLOY}`
      : cfg.status === 401 && /authorization|jwt/i.test(msg) ? `it was deployed with JWT checks on, which blocks the game's own sign-in: ${DEPLOY}`
        : cfg.status === 500 ? 'it says it is not set up: check SUPABASE_SERVICE_ROLE_KEY in the function\'s secrets'
          : cfg.status ? `got HTTP ${cfg.status}${msg ? ' (' + msg + ')' : ''}` : `can't reach it (${cfg.err})`);
  if (newApi) {
    const crossOrigin = new URL(API).origin !== new URL(base).origin; // the live site: the page and the API are on different domains
    const pre = !crossOrigin ? null : await fetch(API + 'act', { method: 'OPTIONS', headers: { Origin: base, 'Access-Control-Request-Method': 'POST', 'Access-Control-Request-Headers': 'authorization, content-type' }, signal: AbortSignal.timeout(15000) }).catch(() => null);
    if (crossOrigin) check(!!pre && pre.ok && !!pre.headers.get('access-control-allow-origin'), `the game page (${base}) may call it (CORS)`, 'the function must answer OPTIONS with Access-Control-Allow-* headers (supabase/functions/game/api.js)');
    if (cfg.body.realtime) check(true, `multiplayer uses the accounts' Supabase project (${cfg.body.realtime.url})`);
    else warn('multiplayer still uses the old Supabase project', 'SUPABASE_ANON_KEY is missing from the function\'s environment (Supabase normally provides it)');
  }

  const farms = await get(API + 'farms');
  if (newApi) {
    check(farms.status === 200, 'the database update has been run', farms.status === 503
      ? 'run supabase/migrations/20261114_server_economy.sql in the Supabase SQL editor (and any newer files in supabase/migrations)'
      : farms.status === 500 ? 'the API failed: check the function\'s logs in the Supabase dashboard'
        : `got HTTP ${farms.status}`);
    if (farms.status === 200) console.log(`      ${farms.body.farms.length} claimed plot(s)`);
  }

  const me = newApi ? await get(API + 'me') : { status: 401 };
  if (newApi) check(me.status === 401, 'signed-out requests are refused', `expected 401, got ${me.status}`);

  if (SIGNUP && newApi && farms.status === 200) {
    const username = 'hc_' + Date.now().toString(36);
    const post = (a, body, key) => get(API + a, { method: 'POST', headers: { 'Content-Type': 'application/json', ...(key ? { Authorization: 'Bearer ' + key } : {}) }, body: JSON.stringify(body) });
    const su = await post('signup', { username, password: 'healthcheck-' + Math.random().toString(36).slice(2) });
    if (check(su.status === 200, `sign-up works (made ${username})`, su.body && su.body.error)) {
      const key = su.body.key;
      check(Array.isArray(su.body.inventory) && su.body.inventory.length === 0, 'a new account owns no gear (dev perks are off)',
        'GAME_DEV is set on the live site: the function must not run with dev settings (GAME_DEV)');
      const sv = await post('save', { character: { name: 'Health', cls: 'knight', skin: 1, hs: 'short', hc: 0 } }, key);
      check(sv.status === 200 && sv.body.inventory.includes('iron_sword'), 'the first character gets its class kit', sv.body && sv.body.error);
      const act = await post('act', { actions: [{ t: 'chest', id: 'wreck' }, { t: 'kill', m: 'slime' }] }, key);
      check(act.status === 200 && act.body.results[0] === '' && act.body.state.econ.gold > 0, 'actions are saved to the account', act.body && act.body.error);
      check(act.status === 200 && act.body.results[1] !== '', 'kills reported without hits are refused', 'GAME_DEV is set on the live site');
      await post('logout', {}, key);
      console.log(`      (the test account ${username} was left in place; delete it from game_players if you like)`);
    }
  }

  const failed = results.filter((r) => !r.ok).length;
  console.log(`\n${failed ? `${failed} check(s) failed` : 'All checks passed'}${SIGNUP ? '' : ' (add --signup to also test sign-up and saving)'}`);
  process.exit(failed ? 1 : 0);
})();
