# Battery QC — Namanve (single-file build)

Everything is in `index.html`. No Node server, no Vercel functions, no build step.
Open it from any static host (or even a local file) and it stores records in your
Supabase project directly.

## 1. Create the table (once)

Supabase → SQL Editor → New query → paste `supabase-schema.sql` → Run.
The same SQL is also inside the app: click the status pill (bottom right) →
"Database setup".

## 2. Connect the app

Open `index.html`. On first run the connection panel asks for:

- **Project URL** — Supabase → Project Settings → API → Project URL
- **Anon / publishable key** — same page

Click *Test & connect*. The settings are kept in the browser, so each device is
connected once. To ship it already connected, edit this line near the top of the
script block in `index.html`:

```js
const DEFAULT_CLOUD = { url: 'https://xxxx.supabase.co', key: 'eyJhbGciOi...' };
```

There is also a *Use this device only* option, which keeps everything in the
browser with no cloud at all.

## 3. Host it

Any static host works: GitHub Pages, Netlify drop, Cloudflare Pages, or an
internal web server. Just `index.html` — nothing else needs to be uploaded.
Opening the file directly from disk (`file://`) works too.

## How storage works now

- Every record is written **individually** (upsert by record id), instead of the
  old "replace the whole store" PUT. A dropped response can no longer erase a
  table.
- Deletes are **soft deletes** (`deleted = true`). Anything removed by mistake
  comes back with:
  `update bqc_records set deleted = false where id = '...';`
- A save that would remove half a store (5+ records) asks for confirmation first.
- Every store is cached in the browser, so the app opens instantly and keeps
  working with no network. Changes made offline sit in an outbox and upload on
  their own when the connection returns — the pill at the bottom right shows how
  many are waiting.
- Closing the tab with unsent changes triggers a browser warning.
- The settings panel exports and imports a full JSON backup of all stores.

## Sign-in PINs

PINs are now checked in the browser (there is no server to check them). Edit them
in `index.html`:

```js
const ROLE_ACCOUNTS = {
  omadmin:  { pin:'5634', name:'O&M Manager' },
  plantinv: { pin:'9876', name:'Plant & Inventory' },
  quality:  { pin:'6396', name:'Quality Engineer' },
  bsa:      { pin:'7521', name:'BSA Engineer' }
};
const STAGE_PINS = { '1101':1, '1202':2, '1303':3 };
```

They separate roles for your team, but anyone who opens the page source can read
them, and the anon key allows read/write to `bqc_records`. That is the trade-off
for having no backend. Treat the URL as internal — don't index it publicly. If
you need real enforcement later, the previous Vercel + serverless setup is the
way back, or Supabase Auth with per-role RLS policies.
