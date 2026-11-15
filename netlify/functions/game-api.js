// Netlify adapter for the Vercel-style game API handler in api/game/[action].js.
// netlify.toml rewrites /api/game/:action to this function with ?action=:action.
const handler = require('../../api/game/[action].js');

exports.handler = async (event) => {
  let body = {};
  try {
    const raw = event.isBase64Encoded ? Buffer.from(event.body || '', 'base64').toString() : event.body;
    body = raw ? JSON.parse(raw) : {};
  } catch (e) { /* leave empty; the handler validates fields */ }

  // The rewrite's ?action=:action is not always forwarded to the function, so fall back
  // to the last segment of the original /api/game/<action> path.
  const fromPath = (p) => { const m = /\/api\/game\/([a-z]+)\/?$/.exec(p || ''); return m && m[1]; };
  let rawPath = '';
  try { rawPath = event.rawUrl ? new URL(event.rawUrl).pathname : ''; } catch (e) { /* ignore */ }
  const action = (event.queryStringParameters || {}).action || fromPath(event.path) || fromPath(rawPath);

  const req = {
    method: event.httpMethod,
    headers: event.headers || {},
    query: { action },
    body,
  };

  return new Promise((resolve) => {
    const res = {
      _code: 200,
      status(code) { this._code = code; return this; },
      json(obj) {
        resolve({ statusCode: this._code, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(obj) });
      },
    };
    Promise.resolve(handler(req, res)).catch((e) => {
      console.error(e);
      resolve({ statusCode: 500, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ error: 'Something went wrong' }) });
    });
  });
};
