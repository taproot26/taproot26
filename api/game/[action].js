const crypto = require('crypto');

const TABLE = (process.env.SUPABASE_URL || 'https://azvdqigaqwbeakjieaps.supabase.co') + '/rest/v1/game_players';
const SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

const CLASSES = ['knight', 'mage', 'ranger', 'rogue'];
const STYLES = ['short', 'long', 'bald'];
const MAX_ATTEMPTS = 5;
const LOCK_MS = 5 * 60 * 1000;
const SESSION_MS = 30 * 24 * 60 * 60 * 1000;
const DUMMY_HASH = '00'.repeat(16) + ':' + '00'.repeat(64);

const sha256 = (s) => crypto.createHash('sha256').update(s).digest('hex');
const scrypt = (pw, salt) => new Promise((ok, no) => crypto.scrypt(pw, salt, 64, (e, k) => (e ? no(e) : ok(k))));

async function hashPassword(pw) {
  const salt = crypto.randomBytes(16);
  return salt.toString('hex') + ':' + (await scrypt(pw, salt)).toString('hex');
}

async function checkPassword(pw, stored) {
  const [salt, hash] = stored.split(':');
  const got = await scrypt(pw, Buffer.from(salt, 'hex'));
  return crypto.timingSafeEqual(got, Buffer.from(hash, 'hex'));
}

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
  return { status: res.status, data: text ? JSON.parse(text) : null };
}

function newSession() {
  const key = crypto.randomBytes(32).toString('hex');
  const expires = new Date(Date.now() + SESSION_MS).toISOString();
  return { key, fields: { session_hash: sha256(key), session_expires: expires } };
}

async function sessionUser(req) {
  const m = /^Bearer ([a-f0-9]{64})$/.exec(req.headers.authorization || '');
  if (!m) return null;
  const now = encodeURIComponent(new Date().toISOString());
  const { data } = await db(`?session_hash=eq.${sha256(m[1])}&session_expires=gt.${now}&select=id,username,character`);
  return (data && data[0]) || null;
}

function cleanCharacter(c) {
  if (!c || typeof c !== 'object') return null;
  const skin = Number(c.skin);
  const hc = Number(c.hc);
  if (!CLASSES.includes(c.cls) || !STYLES.includes(c.hs)) return null;
  if (!Number.isInteger(skin) || skin < 0 || skin > 4) return null;
  if (!Number.isInteger(hc) || hc < 0 || hc > 5) return null;
  return { name: String(c.name ?? '').trim().slice(0, 16), cls: c.cls, skin, hs: c.hs, hc };
}

const patch = (id, fields) => db(`?id=eq.${id}`, { method: 'PATCH', body: JSON.stringify(fields) });

module.exports = async (req, res) => {
  const send = (code, body) => res.status(code).json(body);
  if (!SERVICE_KEY) return send(500, { error: 'Server is not set up yet' });

  const action = req.query.action;
  const wantsGet = action === 'me';
  if (req.method !== (wantsGet ? 'GET' : 'POST')) return send(405, { error: 'Method not allowed' });

  const body = typeof req.body === 'object' && req.body ? req.body : {};
  const username = String(body.username ?? '').trim().toLowerCase();
  const password = String(body.password ?? '');

  try {
    if (action === 'signup') {
      if (!/^[a-z0-9_]{3,20}$/.test(username)) return send(400, { error: 'Username must be 3-20 letters, numbers or underscores' });
      if (password.length < 8 || password.length > 128) return send(400, { error: 'Password must be 8-128 characters' });
      const s = newSession();
      const r = await db('', { method: 'POST', body: JSON.stringify({ username, password_hash: await hashPassword(password), ...s.fields }) });
      if (r.status === 409) return send(409, { error: 'That username is taken' });
      if (r.status >= 300) throw new Error('insert failed: ' + r.status);
      return send(200, { key: s.key, username, character: null });
    }

    if (action === 'login') {
      const valid = /^[a-z0-9_]{3,20}$/.test(username) && password.length <= 128;
      const r = valid ? await db(`?username=eq.${username}&select=id,username,password_hash,failed_attempts,locked_until,character`) : { data: null };
      const user = r.data && r.data[0];
      if (user && user.locked_until && new Date(user.locked_until) > new Date()) {
        return send(429, { error: 'Too many attempts. Try again in a few minutes' });
      }
      const ok = valid && (await checkPassword(password, user ? user.password_hash : DUMMY_HASH));
      if (!user || !ok) {
        if (user) {
          const n = user.failed_attempts + 1;
          await patch(user.id, n >= MAX_ATTEMPTS
            ? { failed_attempts: 0, locked_until: new Date(Date.now() + LOCK_MS).toISOString() }
            : { failed_attempts: n });
        }
        return send(401, { error: 'Wrong username or password' });
      }
      const s = newSession();
      await patch(user.id, { ...s.fields, failed_attempts: 0, locked_until: null });
      return send(200, { key: s.key, username: user.username, character: user.character });
    }

    const user = await sessionUser(req);
    if (!user) return send(401, { error: 'Please sign in again' });

    if (action === 'me') return send(200, { username: user.username, character: user.character });

    if (action === 'save') {
      const character = cleanCharacter(body.character);
      if (!character) return send(400, { error: 'Invalid character' });
      await patch(user.id, { character });
      return send(200, { ok: true, character });
    }

    if (action === 'logout') {
      await patch(user.id, { session_hash: null, session_expires: null });
      return send(200, { ok: true });
    }

    return send(404, { error: 'Not found' });
  } catch (e) {
    console.error(e);
    return send(500, { error: 'Something went wrong' });
  }
};
