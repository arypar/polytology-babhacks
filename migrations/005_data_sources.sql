-- ============================================================
-- 005_data_sources
-- Persist custom data sources to Supabase (previously in-memory)
-- ============================================================

create table if not exists data_sources (
  id           text primary key,
  name         text not null,
  url          text not null,
  headers      jsonb not null default '{}',
  value_path   text not null,
  description  text not null default '',
  refresh_ms   integer not null default 60000,
  created_at   timestamptz not null default now()
);

alter table data_sources disable row level security;
