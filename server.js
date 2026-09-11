/**
 * Battery QC — backend server
 *
 * Implements the two API surfaces index.html calls:
 *   POST /api/auth/login    { mode, name?, pin } -> { user: { role, stage?, name? } }
 *   GET  /api/auth/me       -> { authenticated, user? }
 *   POST /api/auth/logout   -> { ok: true }
 *   GET  /api/data/:key     -> { data: [...] }
 *   PUT  /api/data/:key     { data: [...] } -> { ok: true }
 *
 * Session is a signed, httpOnly cookie (cookie-session) — no server-side
 * session store needed. Data is persisted in a local SQLite file via
 * better-sqlite3, as one row per store key holding a JSON blob.
 *
 * IMPORTANT — Render free/starter web services use an EPHEMERAL filesystem:
 * the SQLite file (battery_qc.db) is wiped on every redeploy or restart.
 * For real persistence, attach a Render Persistent Disk mounted at /data
 * (set DB_PATH=/data/battery_qc.db) or swap this for a managed database.
 */

const path = require('path');
const express = require('express');
const cookieSession = require('cookie-session');
const Database = require('better-sqlite3');

const app = express();
const PORT = process.env.PORT || 3000;

/* ---------- PINs (override via environment variables in production) ---------- */
const STAGE_PINS = {
  1: process.env.STAGE1_PIN || '1111',
  2: process.env.STAGE2_PIN || '2222',
  3: process.env.STAGE3_PIN || '3333',
};
const ROLE_PINS = {
  omadmin: process.env.OM_MANAGER_PIN || 'omadmin1',
  plantinv: process.env.PLANT_PIN || 'plant1',
  quality: process.env.QUALITY_PIN || 'quality1',
  bsa: process.env.BSA_PIN || 'bsa1',
};

/* ---------- Session cookie ---------- */
app.use(cookieSession({
  name: 'bqc_session',
  keys: [process.env.SESSION_SECRET || 'change-this-secret-in-production'],
  maxAge: 12 * 60 * 60 * 1000, // 12 hours
  sameSite: 'lax',
}));
app.use(express.json({ limit: '5mb' }));

/* ---------- SQLite store ---------- */
const dbPath = process.env.DB_PATH || path.join(__dirname, 'battery_qc.db');
const db = new Database(dbPath);
db.exec(`
  CREATE TABLE IF NOT EXISTS store (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );
`);
const getStmt = db.prepare('SELECT value FROM store WHERE key = ?');
const upsertStmt = db.prepare(`
  INSERT INTO store (key, value) VALUES (?, ?)
  ON CONFLICT(key) DO UPDATE SET value = excluded.value
`);

/* ---------- Auth routes ---------- */
app.post('/api/auth/login', (req, res) => {
  const { mode, name, pin } = req.body || {};

  if (mode === 'omtech') {
    if (!name || !String(name).trim()) {
      return res.status(400).json({ error: 'Name is required.' });
    }
    const stageEntry = Object.entries(STAGE_PINS).find(([, p]) => p === pin);
    if (!stageEntry) {
      return res.status(401).json({ error: 'Incorrect stage PIN.' });
    }
    const stage = parseInt(stageEntry[0], 10);
    req.session.role = 'omtech';
    req.session.stage = stage;
    req.session.name = String(name).trim();
    return res.json({ user: { role: 'omtech', stage, name: req.session.name } });
  }

  if (Object.prototype.hasOwnProperty.call(ROLE_PINS, mode)) {
    if (pin !== ROLE_PINS[mode]) {
      return res.status(401).json({ error: 'Incorrect PIN.' });
    }
    req.session.role = mode;
    req.session.stage = null;
    req.session.name = null;
    return res.json({ user: { role: mode } });
  }

  return res.status(400).json({ error: 'Unknown login mode.' });
});

app.get('/api/auth/me', (req, res) => {
  if (!req.session || !req.session.role) {
    return res.json({ authenticated: false });
  }
  res.json({
    authenticated: true,
    user: { role: req.session.role, stage: req.session.stage || null, name: req.session.name || null },
  });
});

app.post('/api/auth/logout', (req, res) => {
  req.session = null;
  res.json({ ok: true });
});

/* ---------- Auth guard for data routes ---------- */
function requireAuth(req, res, next) {
  if (!req.session || !req.session.role) {
    return res.status(401).json({ error: 'Not signed in.' });
  }
  next();
}

/* ---------- Data routes (one JSON array per key) ---------- */
const ALLOWED_KEYS = new Set([
  'om_chain_records',
  'plant_records',
  'plant_stock_records',
  'new_battery_records',
  'inventory_adjustments',
  'warranty_records',
  'daily_stock_records',
  'iot_given_records',
  'iot_returned_records',
  'day_log_records',
  'bsa_records',
]);

app.get('/api/data/:key', requireAuth, (req, res) => {
  const { key } = req.params;
  if (!ALLOWED_KEYS.has(key)) {
    return res.status(400).json({ error: 'Unknown data key.' });
  }
  const row = getStmt.get(key);
  res.json({ data: row ? JSON.parse(row.value) : [] });
});

app.put('/api/data/:key', requireAuth, (req, res) => {
  const { key } = req.params;
  if (!ALLOWED_KEYS.has(key)) {
    return res.status(400).json({ error: 'Unknown data key.' });
  }
  const { data } = req.body || {};
  if (!Array.isArray(data)) {
    return res.status(400).json({ error: 'Body must be { data: [...] }.' });
  }
  upsertStmt.run(key, JSON.stringify(data));
  res.json({ ok: true });
});

/* ---------- Static frontend ---------- */
app.use(express.static(path.join(__dirname)));
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Battery QC server listening on port ${PORT}`);
  console.log(`SQLite DB path: ${dbPath}`);
});
