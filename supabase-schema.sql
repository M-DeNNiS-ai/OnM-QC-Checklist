-- Run once in your Supabase project: SQL Editor -> New query -> Run
create table if not exists bqc_records (
  id          text primary key,
  store_key   text not null,
  payload     jsonb not null,
  deleted     boolean not null default false,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  updated_by  text
);
create index if not exists bqc_records_store_idx on bqc_records (store_key, deleted);

alter table bqc_records enable row level security;

drop policy if exists bqc_read on bqc_records;
drop policy if exists bqc_insert on bqc_records;
drop policy if exists bqc_update on bqc_records;

create policy bqc_read   on bqc_records for select to anon using (true);
create policy bqc_insert on bqc_records for insert to anon with check (true);
create policy bqc_update on bqc_records for update to anon using (true) with check (true);
-- note: no delete policy on purpose. Records are only ever soft-deleted
-- (deleted = true), so anything removed by mistake can be brought back with
--   update bqc_records set deleted = false where id = '...';
