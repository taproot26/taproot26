const crypto = require('crypto');

const TABLE = (process.env.SUPABASE_URL || 'https://azvdqigaqwbeakjieaps.supabase.co') + '/rest/v1/drill_log';
const SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

// Same password hash the /gate page uses (SHA-256 of the admin password).
const ADMIN_HASH = 'd7193ec2f221e36fea3663db6c72fbc1c650aa785795a6d76b9f5d167196ff54';

const sha256 = (s) => crypto.createHash('sha256').update(s).digest();
const isAdmin = (pw) => crypto.timingSafeEqual(sha256(pw), Buffer.from(ADMIN_HASH, 'hex'));
const clip = (v, n) => String(v ?? '').slice(0, n);

async function db(query, init = {}) {
  const res = await fetch(TABLE + query, {
    ...init,
    headers: {
      apikey: SERVICE_KEY,
      Authorization: 'Bearer ' + SERVICE_KEY,
      'Content-Type': 'application/json',
      Prefer: 'return=minimal',
    },
  });
  const text = await res.text();
  return { status: res.status, data: text ? JSON.parse(text) : null };
}

module.exports = async (req, res) => {
  const send = (code, body) => res.status(code).json(body);
  if (!SERVICE_KEY) return send(500, { error: 'Server is not set up yet' });
  if (req.method !== 'POST') return send(405, { error: 'Method not allowed' });

  const body = typeof req.body === 'object' && req.body ? req.body : {};
  if (!isAdmin(String(body.password ?? ''))) return send(401, { error: 'Wrong password' });

  try {
    const action = req.query.action;

    if (action === 'log') {
      const e = body.entry || {};
      if (!e.verb || !e.target || !e.typed || !e.answer || typeof e.ok !== 'boolean') return send(400, { error: 'Bad entry' });
      const r = await db('', {
        method: 'POST',
        body: JSON.stringify({
          verb: clip(e.verb, 50), target: clip(e.target, 100), section: clip(e.section, 30) || null,
          typed: clip(e.typed, 200), answer: clip(e.answer, 100), ok: e.ok,
        }),
      });
      return r.status < 300 ? send(200, { ok: true }) : send(500, { error: 'Could not save' });
    }

    if (action === 'list') {
      const r = await db('?select=verb,target,typed,answer,ok,created_at&order=created_at.desc&limit=200');
      return r.status < 300 ? send(200, { rows: r.data }) : send(500, { error: 'Could not load' });
    }

    if (action === 'clear') {
      const r = await db('?id=gt.0', { method: 'DELETE' });
      return r.status < 300 ? send(200, { ok: true }) : send(500, { error: 'Could not clear' });
    }

    return send(404, { error: 'Unknown action' });
  } catch (err) {
    return send(500, { error: 'Server error' });
  }
};
