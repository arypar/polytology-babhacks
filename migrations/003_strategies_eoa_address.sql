-- ============================================================
-- 003_strategies_eoa_address
-- Associates each strategy with its owner's EOA wallet address.
-- Safe to run on a fresh DB or one that already has the strategies table.
-- ============================================================

alter table strategies
  add column if not exists eoa_address text not null default '';

create index if not exists strategies_eoa_address_idx on strategies (eoa_address);
