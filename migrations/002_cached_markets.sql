-- ============================================================
-- 002_cached_markets
-- Market cache table synced from Polymarket Gamma API every 5 min.
-- Serves as the primary data source so the frontend never waits on Gamma.
-- ============================================================

create table if not exists cached_markets (
  condition_id        text primary key,
  gamma_id            text,
  slug                text,
  question            text not null,
  description         text,
  category            text,
  end_date            timestamptz,
  image               text,
  outcomes            jsonb not null default '[]',   -- [{name, price, tokenId}]
  yes_token_id        text,                          -- YES outcome token ID (fast lookup)
  volume_24h          numeric default 0,
  volume_total        numeric default 0,
  liquidity           numeric default 0,
  price_change_24h    numeric default 0,
  active              boolean default true,
  closed              boolean default false,
  neg_risk            boolean default false,
  yes_price_history   jsonb,                         -- [{t: ms, p: price}] refreshed lazily
  history_synced_at   timestamptz,
  last_synced_at      timestamptz not null default now(),
  created_at          timestamptz not null default now()
);

create index if not exists cached_markets_volume_idx  on cached_markets (volume_24h desc);
create index if not exists cached_markets_active_idx  on cached_markets (active, closed);
create index if not exists cached_markets_synced_idx  on cached_markets (last_synced_at desc);

alter table cached_markets disable row level security;
