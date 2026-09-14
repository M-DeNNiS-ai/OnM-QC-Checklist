# Deploying to Vercel

This project is set up to run on Vercel as: static `index.html` +
serverless functions under `api/`, backed by Supabase for persistent
storage. `server.js` is not used on this path (see the note at the top
of that file) — it only exists as a fallback for self-hosting elsewhere.

## One-time setup

1. **Create a free Supabase project** at https://supabase.com.
2. **Run `supabase-schema.sql`** (in this repo) in the Supabase project's
   SQL Editor. This creates the `bqc_records` and `bqc_audit_log` tables
   that `api/data/[key].js` reads and writes.
3. **Get your keys**: Supabase dashboard → Project Settings → API.
   Copy the "Project URL" and the **service_role** secret key (not the
   anon/public key — the service role key is required here).

## Deploy

1. Push this repo to GitHub (or GitLab/Bitbucket), then import it into
   Vercel as a new project. Vercel will detect `vercel.json` and treat
   this as a static site + serverless functions — no build step runs.
2. In the Vercel project's Settings → Environment Variables, add:
   - `SUPABASE_URL` — the Project URL from Supabase
   - `SUPABASE_SECRET_KEY` — the service_role key from Supabase
   - `JWT_SECRET` — any long random string (used to sign the session
     cookie; generate one with e.g. `openssl rand -hex 32`)
   - Optionally, to set real PINs instead of the shipped defaults:
     `OMADMIN_PIN`, `PLANTINV_PIN`, `QUALITY_PIN`, `STAGE1_PIN`,
     `STAGE2_PIN`, `STAGE3_PIN`, `BSA_PIN`
3. Deploy. Vercel functions are stateless per-request by design — since
   all data lives in Supabase (not on any server's local disk), there is
   no ephemeral-filesystem risk here, and nothing is lost between
   deploys, cold starts, or restarts.

## Verifying it's working

1. Visit your Vercel URL, log in with any role, and add a test record.
2. In the Vercel dashboard, trigger a fresh deployment (or just wait —
   serverless functions spin down and back up between requests
   constantly, which is normal and does not affect your data).
3. Refresh and confirm the test record is still there. You can also
   check Supabase's Table Editor (`bqc_records`) directly at any time.

## Safety net

The Quality Engineer's "Download Full Excel Report" and everyone's
"Download My Report" buttons remain a good habit for occasional manual
backups, even with Supabase behind this — cheap insurance against any
future schema or account changes on the Supabase side.
