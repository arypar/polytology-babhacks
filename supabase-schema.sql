-- ============================================================
-- Polytology — Supabase Schema
-- Run this entire file in the Supabase SQL editor
-- ============================================================

-- Autonomous trading strategies (built in the Builder tab)
create table if not exists strategies (
  id          text primary key,          -- client-generated UUID
  name        text not null,
  blocks      jsonb not null default '[]',
  is_active   boolean not null default false,
  market_id   text,
  market_question text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- Actual Polymarket orders placed through the app
create table if not exists trades (
  id              uuid primary key default gen_random_uuid(),
  eoa_address     text not null,          -- user's Privy EOA wallet
  safe_address    text,                   -- user's Gnosis Safe
  order_id        text,                   -- CLOB order ID from Polymarket
  strategy_id     text references strategies(id) on delete set null,
  market_id       text not null,          -- condition ID
  market_question text,
  token_id        text not null,          -- outcome token ID used in the order
  side            text not null,          -- 'YES' | 'NO'
  price           numeric(10, 4) not null,
  size            numeric(12, 2) not null,
  status          text not null default 'open',  -- open | filled | cancelled | failed
  pnl             numeric(12, 4) default 0,
  neg_risk        boolean default false,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- Per-user CLOB API credentials (server-side mirror of localStorage)
create table if not exists user_credentials (
  eoa_address       text primary key,
  api_key           text not null,
  api_secret        text not null,
  api_passphrase    text not null,
  safe_address      text,
  safe_deployed     boolean not null default false,
  tokens_approved   boolean not null default false,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

-- ── Indexes ──────────────────────────────────────────────────
create index if not exists trades_eoa_address_idx  on trades (eoa_address);
create index if not exists trades_order_id_idx     on trades (order_id);
create index if not exists trades_created_at_idx   on trades (created_at desc);

-- ── RLS (Row Level Security) ─────────────────────────────────
-- Disable RLS — backend uses service role key which bypasses it anyway.
-- Enable and add policies here if you later add a user-facing Supabase client.
alter table strategies        disable row level security;
alter table trades            disable row level security;
alter table user_credentials  disable row level security;
