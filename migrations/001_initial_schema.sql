-- ============================================================
-- 001_initial_schema
-- Core tables: strategies, trades, user_credentials
-- ============================================================

create table if not exists strategies (
  id              text primary key,
  name            text not null,
  blocks          jsonb not null default '[]',
  is_active       boolean not null default false,
  market_id       text,
  market_question text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create table if not exists trades (
  id              uuid primary key default gen_random_uuid(),
  eoa_address     text not null,
  safe_address    text,
  order_id        text,
  strategy_id     text references strategies(id) on delete set null,
  market_id       text not null,
  market_question text,
  token_id        text not null,
  side            text not null,          -- 'YES' | 'NO'
  price           numeric(10, 4) not null,
  size            numeric(12, 2) not null,
  status          text not null default 'open',  -- open | filled | cancelled | failed
  pnl             numeric(12, 4) default 0,
  neg_risk        boolean default false,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

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

create index if not exists trades_eoa_address_idx  on trades (eoa_address);
create index if not exists trades_order_id_idx     on trades (order_id);
create index if not exists trades_created_at_idx   on trades (created_at desc);

alter table strategies        disable row level security;
alter table trades            disable row level security;
alter table user_credentials  disable row level security;
