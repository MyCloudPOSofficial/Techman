require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { backend } = require('./lib/backend-logic');
const { runWithContext } = require('./lib/request-context');

const app = express();

app.use(cors({
  origin: process.env.CORS_ORIGIN === '*' || !process.env.CORS_ORIGIN ? true : process.env.CORS_ORIGIN.split(','),
}));
app.use(express.json({ limit: '15mb' })); // generous limit: backups/imports can carry a full business snapshot

app.get('/health', (req, res) => res.json({ ok: true }));

// Single catch-all: the ported backend.handle() already does its own
// method+pathname routing (this mirrors the original app's api() -> backend
// dispatch exactly), so Express just needs to hand it method/path/query/body
// /token and translate the result back into an HTTP response.
app.use(async (req, res) => {
  const method = req.method.toUpperCase();
  const pathname = req.path;
  const params = new URLSearchParams(req.url.split('?')[1] || '');
  const body = req.body || {};

  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : (authHeader || null);

  const context = {
    ip: (req.headers['x-forwarded-for'] || req.ip || '').split(',')[0].trim() || 'unknown',
    userAgent: req.headers['user-agent'] || '',
  };

  try {
    const result = await runWithContext(context, () => backend.handle(method, pathname, params, body, token));
    res.json(result === undefined ? {} : result);
  } catch (err) {
    const message = (err && err.message) || 'Request failed.';
    const status = classifyError(message);
    res.status(status).json({ error: message });
  }
});

function classifyError(message) {
  const m = message.toLowerCase();
  if (m.includes('not found')) return 404;
  if (m.includes('not authenticated') || m.includes('unauthorized') || m.includes('invalid session') || m.includes('invalid credentials') || m.includes('session expired')) return 401;
  if (m.includes('permission') || m.includes('forbidden') || m.includes('not allowed')) return 403;
  return 400;
}

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log(`Cloud POS backend listening on port ${PORT}`);
});
