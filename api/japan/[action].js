const crypto = require('crypto');

const TABLE = (process.env.SUPABASE_URL || 'https://azvdqigaqwbeakjieaps.supabase.co') + '/rest/v1/drill_log';
const SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

// Same password hash the /gate page uses (SHA-256 of the admin password).
const ADMIN_HASH = 'd7193ec2f221e36fea3663db6c72fbc1c650aa785795a6d76b9f5d167196ff54';
// Pages allowed to call this from the browser (so a local copy can sync up).
const ALLOWED_ORIGIN = /^(https:\/\/taproot\.love|http:\/\/(localhost|127\.0\.0\.1)(:\d+)?)$/;
const MAX_BATCH = 200;

const sha256 = (s) => crypto.createHash('sha256').update(s).digest();
const isAdmin = (pw) => crypto.timingSafeEqual(sha256(pw), Buffer.from(ADMIN_HASH, 'hex'));
const clip = (v, n) => String(v ?? '').slice(0, n);

function row(e) {
  const when = Number.isFinite(e.t) ? new Date(e.t) : null;
  return {
    verb: clip(e.verb, 50), target: clip(e.target, 100), section: clip(e.section, 30) || null,
    typed: clip(e.typed, 200), answer: clip(e.answer, 100), ok: e.ok,
    ...(when && !isNaN(when) ? { created_at: when.toISOString() } : {}),
  };
}

const valid = (e) => e && e.verb && e.target && e.typed && e.answer && typeof e.ok === 'boolean';

module.exports = async (req, res) => {
  const send = (code, body) => res.status(code).json(body);
  const origin = req.headers && req.headers.origin;
  if (origin && ALLOWED_ORIGIN.test(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.setHeader('Vary', 'Origin');
  }
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (!SERVICE_KEY) return send(500, { error: 'Server is not set up yet' });
  if (req.method !== 'POST') return send(405, { error: 'Method not allowed' });

  const body = typeof req.body === 'object' && req.body ? req.body : {};
  if (!isAdmin(String(body.password ?? ''))) return send(401, { error: 'Wrong password' });

  try {
    if (req.query.action !== 'sync') return send(404, { error: 'Unknown action' });

    const entries = Array.isArray(body.entries) ? body.entries : [];
    if (!entries.length || entries.length > MAX_BATCH || !entries.every(valid)) return send(400, { error: 'Bad entries' });

    const r = await fetch(TABLE, {
      method: 'POST',
      headers: {
        apikey: SERVICE_KEY,
        Authorization: 'Bearer ' + SERVICE_KEY,
        'Content-Type': 'application/json',
        Prefer: 'return=minimal',
      },
      body: JSON.stringify(entries.map(row)),
    });
    return r.status < 300 ? send(200, { ok: true, saved: entries.length }) : send(500, { error: 'Could not save' });
  } catch (err) {
    return send(500, { error: 'Server error' });
  }
};
