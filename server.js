/**
 * Battery QC — backend server
 *
 * NOTE: this file is NOT used when deployed on Vercel. Vercel runs the
 * individual serverless functions in api/auth/*.js and api/data/[key].js
 * directly (see vercel.json) — that is the deployment path this project
 * is now set up for, and it's what actually serves requests in production.
 *
 * This file is kept only as an alternative if you ever want to
 * self-host on a plain Node server (Render, Railway, a VPS, etc.)
 * instead of Vercel. If you're deploying to Vercel, you can ignore
 * everything below.
 *
 * Implements the two API surfaces index.html calls:
 *   POST /api/auth/login    { mode, name?, pin } -> { user: { role, stage?, name? } }
 *   GET  /api/auth/me       -> { authenticated, user? }
 *   POST /api/auth/logout   -> { ok: true }
 *   GET  /api/data/:key     -> { data: [...] }
 *   PUT  /api/data/:key     { data: [...] } -> { ok: true }
 *
 * Session is a signed, httpOnly cookie (cookie-session) — no server-side
 * session store needed.
 *
 * STORAGE: data is persisted in Supabase (hosted Postgres) via
 * @supabase/supabase-js. This replaced a local SQLite file that lived on
 * Render's container filesystem — that filesystem is EPHEMERAL and is wiped
 * on every redeploy AND on any automatic restart (idle spin-down on
 * free/low tiers, crashes, host maintenance), with no action needed from
 * you to trigger it. Render's free plan does not support persistent disks,
 * so Supabase (which has its own free tier) is the fix that costs nothing
 * extra and needs no plan upgrade.
 *
 * SETUP (one-time):
 *   1. Create a free project at https://supabase.com
 *   2. Run supabase-schema.sql (in this repo) in the Supabase SQL Editor
 *   3. In Render's dashboard, set these environment variables on this
 *      service: SUPABASE_URL, SUPABASE_SECRET_KEY (the Service Role key —
 *      keep it secret, it bypasses row-level security by design here),
 *      and SESSION_SECRET (any long random string).
 *   4. Deploy. No frontend changes are needed.
 */

const path = require('path');
const express = require('express');
const cookieSession = require('cookie-session');
const { createClient } = require('@supabase/supabase-js');

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

/* ---------- Supabase (persistent) store ---------- */
let supabase = null;
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SECRET_KEY = process.env.SUPABASE_SECRET_KEY;
if (SUPABASE_URL && SUPABASE_SECRET_KEY) {
  supabase = createClient(SUPABASE_URL, SUPABASE_SECRET_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
} else {
  console.error(
    '✗ SUPABASE_URL / SUPABASE_SECRET_KEY are not set. Data cannot be read or ' +
    'saved until these are configured in your Render environment variables — see ' +
    'the setup notes at the top of server.js. The server will still start so you ' +
    'can sign in and see this, but every /api/data request will fail with a clear error.'
  );
}

function uid() {
  return 'r' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

async function audit(user, action, storeKey, recordId, details) {
  if (!supabase) return;
  const { error } = await supabase.from('bqc_audit_log').insert({
    username: user.name || null,
    role: user.role || null,
    action,
    store_key: storeKey,
    record_id: recordId || null,
    details: details || null,
  });
  if (error) console.error('Audit log error:', error.message);
}

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

app.get('/api/data/:key', requireAuth, async (req, res) => {
  const { key } = req.params;
  if (!ALLOWED_KEYS.has(key)) {
    return res.status(400).json({ error: 'Unknown data key.' });
  }
  if (!supabase) {
    return res.status(500).json({ error: 'Database is not configured — set SUPABASE_URL and SUPABASE_SECRET_KEY.' });
  }
  try {
    const { data, error } = await supabase
      .from('bqc_records')
      .select('id, payload, created_at, updated_at, updated_by')
      .eq('store_key', key)
      .order('created_at', { ascending: true });
    if (error) {
      console.error('GET error:', error.message);
      return res.status(500).json({ error: error.message });
    }
    const records = (data || []).map((row) => ({ ...(row.payload || {}), id: row.id }));
    return res.json({ data: records });
  } catch (err) {
    console.error('GET store error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

app.put('/api/data/:key', requireAuth, async (req, res) => {
  const { key } = req.params;
  if (!ALLOWED_KEYS.has(key)) {
    return res.status(400).json({ error: 'Unknown data key.' });
  }
  if (!supabase) {
    return res.status(500).json({ error: 'Database is not configured — set SUPABASE_URL and SUPABASE_SECRET_KEY.' });
  }
  const { data: records } = req.body || {};
  if (!Array.isArray(records)) {
    return res.status(400).json({ error: 'Body must be { data: [...] }.' });
  }
  const user = { role: req.session.role, name: req.session.name };

  try {
    const { data: existing, error: existingError } = await supabase
      .from('bqc_records')
      .select('id')
      .eq('store_key', key);
    if (existingError) {
      console.error('Existing records error:', existingError.message);
      return res.status(500).json({ error: existingError.message });
    }

    const incomingIds = new Set(records.map((r) => r?.id).filter(Boolean).map(String));
    const idsToDelete = (existing || []).map((row) => String(row.id)).filter((id) => !incomingIds.has(id));

    /*
     * SAFETY GUARDRAIL: this endpoint does a full replace of the store —
     * anything not in the incoming array gets deleted. A race condition
     * (saving before the initial GET finished loading), a dropped response
     * treated as "empty", or any other bug that hands this endpoint a
     * too-small array would otherwise silently wipe real data with no
     * error shown to the user — which is the exact failure mode that lost
     * data before. If a write would delete most of an existing,
     * non-trivial store, refuse it unless explicitly confirmed via the
     * x-confirm-wipe header.
     */
    const existingCount = (existing || []).length;
    const wipingMost = existingCount >= 5 && idsToDelete.length >= existingCount * 0.8;
    if (wipingMost && req.headers['x-confirm-wipe'] !== 'true') {
      console.error(
        `Refused suspicious write to ${key}: would delete ${idsToDelete.length} of ${existingCount} existing records (user: ${user.name || user.role})`
      );
      await audit(user, 'PUT_STORE_BLOCKED', key, null, {
        existingCount, incomingCount: records.length, wouldDelete: idsToDelete.length,
      });
      return res.status(409).json({
        error: `This save would delete ${idsToDelete.length} of ${existingCount} existing records in "${key}". Refused as a safety check. Refresh the page to reload the latest data before retrying.`,
      });
    }

    if (idsToDelete.length > 0) {
      const { error: deleteError } = await supabase.from('bqc_records').delete().eq('store_key', key).in('id', idsToDelete);
      if (deleteError) {
        console.error('Delete error:', deleteError.message);
        return res.status(500).json({ error: deleteError.message });
      }
    }

    if (records.length > 0) {
      const rows = records.map((record) => {
        const id = record?.id || uid();
        const { id: _ignored, ...payload } = record || {};
        return {
          id: String(id),
          store_key: key,
          payload,
          updated_at: new Date().toISOString(),
          updated_by: user.name || user.role,
        };
      });
      const { error: upsertError } = await supabase.from('bqc_records').upsert(rows, { onConflict: 'id' });
      if (upsertError) {
        console.error('Upsert error:', upsertError.message);
        return res.status(500).json({ error: upsertError.message });
      }
    }

    await audit(user, 'PUT_STORE', key, null, { count: records.length });
    return res.json({ ok: true });
  } catch (err) {
    console.error('PUT store error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/* ---------- Static frontend ---------- */
app.use(express.static(path.join(__dirname)));
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Battery QC server listening on port ${PORT}`);
  console.log(supabase ? 'Storage: Supabase (persistent)' : '✗ Storage: NOT CONFIGURED — set SUPABASE_URL and SUPABASE_SECRET_KEY');
});
