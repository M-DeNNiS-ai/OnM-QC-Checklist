-- Run this once in your Supabase project's SQL Editor before deploying.
-- This replaces the local SQLite file with a real, persistent Postgres
-- database that survives Render restarts, redeploys, and spin-downs.

create table if not exists bqc_records (
  id text primary key,
  store_key text not null,
  payload jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by text
);

create index if not exists bqc_records_store_key_idx on bqc_records (store_key);

create table if not exists bqc_audit_log (
  id bigint generated always as identity primary key,
  username text,
  role text,
  action text,
  store_key text,
  record_id text,
  details jsonb,
  created_at timestamptz not null default now()
);

create index if not exists bqc_audit_log_store_key_idx on bqc_audit_log (store_key);
create index if not exists bqc_audit_log_created_at_idx on bqc_audit_log (created_at);
