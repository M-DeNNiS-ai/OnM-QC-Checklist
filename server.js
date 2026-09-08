require('dotenv').config();
const express = require('express');
const cookieParser = require('cookie-parser');
const jwt = require('jsonwebtoken');
const { createClient } = require('@supabase/supabase-js');
const path = require('path');

const PORT = Number(process.env.PORT || 3000);
const HOST = process.env.HOST || '0.0.0.0';
const JWT_SECRET = process.env.JWT_SECRET;
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SECRET_KEY = process.env.SUPABASE_SECRET_KEY;

if (!JWT_SECRET || JWT_SECRET.length < 32) {
  console.error('JWT_SECRET must be set to a random value of at least 32 characters.');
  process.exit(1);
}
if (!SUPABASE_URL || !SUPABASE_SECRET_KEY) {
  console.error('SUPABASE_URL and SUPABASE_SECRET_KEY must be set in .env.');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SECRET_KEY, {
  auth: { autoRefreshToken: false, persistSession: false }
});

const COOKIE_NAME = 'bqc_session';
const STORE_ROLES = {
  om_chain_records: ['omtech', 'omadmin', 'quality'],
  plant_records: ['plant', 'quality'],
  new_battery_records: ['inventory', 'quality'],
  inventory_adjustments: ['inventory', 'quality'],
  warranty_records: ['quality']
};
const ALL_STORES = Object.keys(STORE_ROLES);
const DEFAULT_PINS = {
  omadmin: process.env.OMADMIN_PIN || '1234',
  plant: process.env.PLANT_PIN || '2345',
  inventory: process.env.INVENTORY_PIN || '3456',
  quality: process.env.QUALITY_PIN || '9999',
  stage1: process.env.STAGE1_PIN || '1001',
  stage2: process.env.STAGE2_PIN || '1002',
  stage3: process.env.STAGE3_PIN || '1003'
};

function now() { return new Date().toISOString(); }
function sign(user) { return jwt.sign(user, JWT_SECRET, { expiresIn: process.env.SESSION_TTL || '12h' }); }
function canAccess(role, key) { return (STORE_ROLES[key] || []).includes(role); }

async function audit(req, action, storeKey = null, recordId = null, details = null) {
  const u = req.user || {};
  const { error } = await supabase.from('bqc_audit_log').insert({
    username: u.name || u.role || null,
    role: u.role || null,
    action,
    store_key: storeKey,
    record_id: recordId,
    created_at: now(),
    ip: req.ip || null,
    details: details || null
  });
  if (error) console.error('Audit log error:', error.message);
}

function auth(req, res, next) {
  try {
    const token = req.cookies[COOKIE_NAME];
    if (!token) return res.status(401).json({ error: 'Authentication required.' });
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    return res.status(401).json({ error: 'Session expired. Please sign in again.' });
  }
}

async function rowsForStore(key) {
  const { data, error } = await supabase
    .from('bqc_records')
    .select('id,payload,created_at,updated_at')
    .eq('store_key', key)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return (data || []).map(r => r.payload).filter(Boolean);
}

async function upsertMerged(key, incoming, actor) {
  const { data: existing, error: readError } = await supabase
    .from('bqc_records')
    .select('id,created_at')
    .eq('store_key', key);
  if (readError) throw readError;

  const existingIds = new Set((existing || []).map(r => String(r.id)));
  const timestamp = now();
  const rows = [];

  for (const item of incoming) {
    if (!item || !item.id) continue;
    rows.push({
      id: String(item.id),
      store_key: key,
      payload: item,
      created_at: existingIds.has(String(item.id))
        ? (existing || []).find(r => String(r.id) === String(item.id))?.created_at || item.createdAt || timestamp
        : item.createdAt || timestamp,
      updated_at: timestamp,
      updated_by: actor?.name || actor?.role || null
    });
  }

  for (let i = 0; i < rows.length; i += 500) {
    const batch = rows.slice(i, i + 500);
    const { error } = await supabase.from('bqc_records').upsert(batch, { onConflict: 'id' });
    if (error) throw error;
  }
}

const app = express();
app.disable('x-powered-by');
app.set('trust proxy', 1);
app.use(express.json({ limit: '10mb' }));
app.use(cookieParser());
app.use((req, res, next) => { res.setHeader('Cache-Control', 'no-store'); next(); });

app.get('/api/health', async (req, res) => {
  const { error } = await supabase.from('bqc_records').select('id', { head: true, count: 'exact' }).limit(1);
  if (error) return res.status(503).json({ ok: false, service: 'Battery QC API', database: 'unavailable', error: error.message });
  res.json({ ok: true, service: 'Battery QC API', database: 'supabase', time: now() });
});

app.post('/api/auth/login', async (req, res) => {
  const { mode, pin, name } = req.body || {};
  let user = null;
  if (mode === 'omtech') {
    if (!name || !String(name).trim()) return res.status(400).json({ error: 'Technician name is required.' });
    const stage = pin === DEFAULT_PINS.stage1 ? 1 : pin === DEFAULT_PINS.stage2 ? 2 : pin === DEFAULT_PINS.stage3 ? 3 : null;
    if (!stage) return res.status(401).json({ error: 'Invalid stage PIN.' });
    user = { role: 'omtech', name: String(name).trim(), stage };
  } else if (['omadmin', 'plant', 'inventory', 'quality'].includes(mode)) {
    if (pin !== DEFAULT_PINS[mode]) return res.status(401).json({ error: 'Invalid PIN.' });
    user = { role: mode, name: mode };
  } else {
    return res.status(400).json({ error: 'Invalid login mode.' });
  }

  res.cookie(COOKIE_NAME, sign(user), {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 12 * 60 * 60 * 1000,
    path: '/'
  });
  await audit({ user, ip: req.ip }, 'LOGIN');
  res.json({ ok: true, user });
});

app.post('/api/auth/logout', async (req, res) => {
  res.clearCookie(COOKIE_NAME, { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', path: '/' });
  res.json({ ok: true });
});

app.get('/api/auth/me', (req, res) => {
  try {
    const token = req.cookies[COOKIE_NAME];
    if (!token) return res.json({ authenticated: false });
    const u = jwt.verify(token, JWT_SECRET);
    res.json({ authenticated: true, user: u });
  } catch {
    res.json({ authenticated: false });
  }
});

app.get('/api/data/:key', auth, async (req, res) => {
  const key = req.params.key;
  if (!ALL_STORES.includes(key)) return res.status(404).json({ error: 'Unknown data store.' });
  if (!canAccess(req.user.role, key)) return res.status(403).json({ error: 'You do not have access to this sector.' });
  try {
    const data = await rowsForStore(key);
    await audit(req, 'READ', key);
    res.json({ data });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Supabase read failed.' });
  }
});

app.put('/api/data/:key', auth, async (req, res) => {
  const key = req.params.key;
  if (!ALL_STORES.includes(key)) return res.status(404).json({ error: 'Unknown data store.' });
  if (!canAccess(req.user.role, key)) return res.status(403).json({ error: 'You do not have permission to write this sector.' });
  if (!Array.isArray(req.body?.data)) return res.status(400).json({ error: 'data must be an array.' });
  if (req.body.data.length > 100000) return res.status(413).json({ error: 'Too many records in one request.' });

  try {
    await upsertMerged(key, req.body.data, req.user);
    await audit(req, 'WRITE', key, null, { count: req.body.data.length });
    res.json({ ok: true, data: await rowsForStore(key) });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Supabase database write failed.', detail: e.message });
  }
});

app.get('/api/audit', auth, async (req, res) => {
  if (!['omadmin', 'quality'].includes(req.user.role)) return res.status(403).json({ error: 'Admin access required.' });
  const { data, error } = await supabase
    .from('bqc_audit_log')
    .select('id,username,role,action,store_key,record_id,created_at,ip,details')
    .order('id', { ascending: false })
    .limit(1000);
  if (error) return res.status(500).json({ error: 'Audit read failed.' });
  res.json({ data });
});

app.get('/api/backup', auth, async (req, res) => {
  if (!['omadmin', 'quality'].includes(req.user.role)) return res.status(403).json({ error: 'Admin access required.' });
  try {
    const backup = { generated_at: now(), stores: {} };
    for (const key of ALL_STORES) backup.stores[key] = await rowsForStore(key);
    await audit(req, 'BACKUP');
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', 'attachment; filename="battery-qc-backup.json"');
    res.send(JSON.stringify(backup, null, 2));
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Backup failed.' });
  }
});

app.use(express.static(path.join(__dirname, 'public'), { extensions: ['html'] }));
app.get(/.*/, (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));

app.listen(PORT, HOST, () => {
  console.log(`Battery QC server listening on http://${HOST === '0.0.0.0' ? 'localhost' : HOST}:${PORT}`);
  console.log('Database: Supabase Postgres');
});
