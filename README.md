# Battery QC — Multi-Device Supabase Backend

This version changes the Battery QC app from a single-PC SQLite database to a centralized Supabase Postgres database.

Architecture:

`Phone / Tablet / PC -> Battery QC Node/Express API -> Supabase Postgres`

This lets multiple authorized devices use the same live records instead of each computer having its own local database.

## 1. Create the Supabase tables

1. Open your Supabase project.
2. Open **SQL Editor**.
3. Open `supabase-schema.sql` from this project.
4. Run the complete script.

Supabase provides a full Postgres database, and its connection options include pooled connections for application traffic. See the official documentation: https://supabase.com/docs/guides/database/connecting-to-postgres

## 2. Configure `.env`

Copy `.env.example` to `.env` and set:

- `SUPABASE_URL`
- `SUPABASE_SECRET_KEY`
- `JWT_SECRET`
- your Battery QC PINs

The Supabase **secret** key is server-only. Never place it in `public/index.html`, GitHub, or browser JavaScript.

## 3. Install

```bash
npm install
```

## 4. Start

```bash
npm start
```

Then open:

`http://localhost:3000`

## 5. Verify Supabase

Open:

`http://localhost:3000/api/health`

You should receive JSON showing:

`"ok": true`

and:

`"database": "supabase"`

## 6. Multi-device deployment

For other devices on the same network during testing, use the server computer's LAN address, for example:

`http://192.168.1.20:3000`

For real deployment, host the Node server on a cloud/server platform with HTTPS and a stable domain. Every phone, tablet and PC then connects to the same backend and Supabase database.

## Security

- Supabase secret key stays on the backend.
- Login sessions use an HttpOnly cookie.
- Server-side role permissions control the five application stores.
- Supabase Row Level Security is enabled on the tables with no public policies.
- Audit events are centralized in Supabase.

## Current data model

The existing single-file application stores its existing record collections as JSON payloads inside `bqc_records`. This is intentional for the first migration so the existing UI and data structures remain compatible.

The next production phase can normalize high-volume battery, inspection, repair, warranty, inventory and movement data into relational tables for stronger reporting, FPY calculations, history queries and analytics.
