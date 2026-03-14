-- User funding table — tracks $5 USDC auto-fund drops for new wallets.
-- Each user gets exactly one funding event (PK on eoa_address).
-- The backend processes pending rows and marks them completed/failed after transfer.

create table if not exists user_funding (
  eoa_address  text        primary key,
  safe_address text        not null,
  amount_usdc  numeric(10, 2) not null default 5.00,
  status       text        not null default 'pending'
    check (status in ('pending', 'processing', 'completed', 'failed')),
  tx_hash      text,
  funded_at    timestamptz,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

-- Fast lookup for the background worker that processes pending rows
create index if not exists user_funding_status_idx on user_funding(status);

-- RLS disabled — accessed exclusively via service-role backend
alter table user_funding disable row level security;
