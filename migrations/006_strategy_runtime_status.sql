-- ============================================================
-- 006_strategy_runtime_status
-- Track per-strategy runtime state (running / paused / stopped)
-- so pause/stop actions survive page reloads
-- ============================================================

alter table strategies
  add column if not exists runtime_status text not null default 'running';
