'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import type {
  AutonomousStrategy,
  StrategyBlock,
  ExecutingTrade,
  StrategyRuntime,
  StrategyStatus,
  TradeStatus,
} from './types';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

async function apiFetch<T>(path: string): Promise<T | null> {
  try {
    const res = await fetch(`${API_BASE}${path}`);
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

async function apiPost(path: string, body: unknown): Promise<Response | null> {
  try {
    return await fetch(`${API_BASE}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  } catch {
    return null;
  }
}

async function apiPatch(path: string, body: unknown): Promise<boolean> {
  try {
    const res = await fetch(`${API_BASE}${path}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    return res.ok;
  } catch {
    return false;
  }
}

async function apiDelete(path: string): Promise<boolean> {
  try {
    const res = await fetch(`${API_BASE}${path}`, { method: 'DELETE' });
    return res.ok;
  } catch {
    return false;
  }
}

// ── Trade recording ───────────────────────────────────────────

export interface RecordTradeParams {
  orderId?: string;
  eoaAddress: string;
  safeAddress?: string;
  strategyId?: string;
  marketId: string;
  marketQuestion?: string;
  tokenId: string;
  side: 'YES' | 'NO';
  price: number;
  size: number;
  negRisk?: boolean;
}

export async function recordTrade(params: RecordTradeParams): Promise<void> {
  await apiPost('/api/trades', params);
}

// ── Strategy store ────────────────────────────────────────────

// localStorage cache is scoped per EOA so different users on the same browser
// don't share strategies.
function cacheKey(eoa: string) { return `pm-strategies-${eoa.toLowerCase()}`; }

function cacheStrategies(eoa: string, strategies: AutonomousStrategy[]) {
  if (typeof window === 'undefined' || !eoa) return;
  try { localStorage.setItem(cacheKey(eoa), JSON.stringify(strategies)); } catch { /* ignore */ }
}

function loadCachedStrategies(eoa: string): AutonomousStrategy[] {
  if (typeof window === 'undefined' || !eoa) return [];
  try {
    const raw = localStorage.getItem(cacheKey(eoa));
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

export function useStrategies(eoaAddress?: string | null) {
  const eoa = eoaAddress?.toLowerCase() ?? '';

  const [strategies, setStrategies] = useState<AutonomousStrategy[]>(() =>
    eoa ? loadCachedStrategies(eoa) : []
  );
  const [loading, setLoading] = useState(true);

  // Re-fetch whenever the EOA changes (e.g. user logs in after mount)
  useEffect(() => {
    if (!eoa) { setStrategies([]); setLoading(false); return; }

    // Show cached data immediately while the server fetch completes
    setStrategies(loadCachedStrategies(eoa));
    setLoading(true);

    let cancelled = false;
    apiFetch<AutonomousStrategy[]>(`/api/strategies?eoa=${eoa}`).then((data) => {
      if (cancelled || !data) { setLoading(false); return; }
      setStrategies(data);
      cacheStrategies(eoa, data);
      setLoading(false);
    });
    return () => { cancelled = true; };
  }, [eoa]);

  const addStrategy = useCallback((strategy: AutonomousStrategy) => {
    if (!eoa) return;
    setStrategies(prev => {
      const next = [strategy, ...prev];
      cacheStrategies(eoa, next);
      return next;
    });
    apiPost('/api/strategies', {
      ...strategy,
      eoaAddress: eoa,
      isActive: strategy.enabled,
      runtimeStatus: strategy.runtimeStatus ?? 'running',
    });
  }, [eoa]);

  const updateStrategy = useCallback((id: string, updates: Partial<AutonomousStrategy>) => {
    if (!eoa) return;
    setStrategies(prev => {
      const next = prev.map(s => s.id === id ? { ...s, ...updates, updatedAt: Date.now() } : s);
      cacheStrategies(eoa, next);
      return next;
    });
    apiPatch(`/api/strategies/${id}?eoa=${eoa}`, updates);
  }, [eoa]);

  const removeStrategy = useCallback((id: string) => {
    if (!eoa) return;
    setStrategies(prev => {
      const next = prev.filter(s => s.id !== id);
      cacheStrategies(eoa, next);
      return next;
    });
    apiDelete(`/api/strategies/${id}?eoa=${eoa}`);
  }, [eoa]);

  const updateBlocks = useCallback((id: string, blocks: StrategyBlock[]) => {
    if (!eoa) return;
    setStrategies(prev => {
      const next = prev.map(s => s.id === id ? { ...s, blocks, updatedAt: Date.now() } : s);
      cacheStrategies(eoa, next);
      return next;
    });
    apiPatch(`/api/strategies/${id}?eoa=${eoa}`, { blocks });
  }, [eoa]);

  return { strategies, loading, addStrategy, updateStrategy, removeStrategy, updateBlocks };
}

// ── DB trade row shape (from backend) ────────────────────────

interface DbTrade {
  id: string;
  order_id: string | null;
  eoa_address: string;
  safe_address: string | null;
  strategy_id: string | null;
  market_id: string;
  market_question: string | null;
  token_id: string;
  side: string;
  price: number;
  size: number;
  status: string;
  pnl: number;
  neg_risk: boolean;
  created_at: string;
  updated_at: string;
}

function dbTradeToExecutingTrade(t: DbTrade, strategyName?: string): ExecutingTrade {
  return {
    id: t.id,
    strategyId: t.strategy_id ?? 'manual',
    strategyName: strategyName ?? 'Manual Trade',
    marketId: t.market_id,
    marketQuestion: t.market_question ?? t.market_id,
    side: t.side as 'YES' | 'NO',
    shares: t.size,
    entryPrice: t.price,
    currentPrice: t.price,   // will be updated by live simulation
    status: t.status as TradeStatus,
    timestamp: new Date(t.created_at).getTime(),
    pnl: t.pnl,
  };
}

function computeRuntimes(
  strategies: AutonomousStrategy[],
  trades: ExecutingTrade[]
): StrategyRuntime[] {
  // Handle both camelCase (localStorage cache) and snake_case (raw DB rows)
  type AnyStrategy = AutonomousStrategy & Record<string, unknown>;
  const activeStrategies = strategies.filter(s => {
    const row = s as AnyStrategy;
    return row.enabled ?? row.is_active;
  });
  if (activeStrategies.length === 0) return [];

  return activeStrategies.map(s => {
    const row = s as AnyStrategy;
    const runtimeStatus: StrategyStatus =
      (row.runtimeStatus as StrategyStatus) ??
      (row.runtime_status as StrategyStatus) ??
      'running';
    const stratTrades = trades.filter(t => t.strategyId === s.id && t.status === 'filled');
    const totalDeployed = stratTrades.reduce((sum, t) => sum + t.entryPrice * t.shares, 0);
    const realizedPnl = stratTrades.reduce((sum, t) => sum + (t.pnl ?? 0), 0);
    const wins = stratTrades.filter(t => (t.pnl ?? 0) > 0).length;
    const createdAt = (row.createdAt as number) ?? new Date(row.created_at as string).getTime();
    return {
      strategyId: s.id,
      strategyName: s.name,
      status: runtimeStatus,
      tradesExecuted: stratTrades.length,
      totalDeployed,
      realizedPnl,
      unrealizedPnl: 0,
      winRate: stratTrades.length > 0 ? wins / stratTrades.length : 0,
      startedAt: createdAt,
      lastTradeAt: stratTrades.length > 0
        ? Math.max(...stratTrades.map(t => t.timestamp))
        : undefined,
    };
  });
}


export function useExecutingTrades(eoaAddress?: string | null, isActive = true) {
  const eoa = eoaAddress?.toLowerCase() ?? '';
  const [trades, setTrades] = useState<ExecutingTrade[]>([]);
  const [runtimes, setRuntimes] = useState<StrategyRuntime[]>([]);
  const [usingRealData, setUsingRealData] = useState(false);
  const [fetchTick, setFetchTick] = useState(0);
  const prevIsActiveRef = useRef(isActive);

  // Re-fetch when the Executing tab becomes active (false → true transition)
  useEffect(() => {
    if (isActive && !prevIsActiveRef.current) {
      setFetchTick(t => t + 1);
    }
    prevIsActiveRef.current = isActive;
  }, [isActive]);

  // Fetch real strategies + trades when we have an EOA address
  useEffect(() => {
    if (!eoa) return;

    let cancelled = false;

    (async () => {
      const [dbTrades, dbStrategies] = await Promise.all([
        apiFetch<DbTrade[]>(`/api/trades?eoa=${eoa}&limit=100`),
        apiFetch<AutonomousStrategy[]>(`/api/strategies?eoa=${eoa}`),
      ]);

      if (cancelled) return;

      const strategies = dbStrategies ?? [];
      const strategyMap = new Map(strategies.map(s => [s.id, s.name]));
      const mapped = (dbTrades ?? []).map(t =>
        dbTradeToExecutingTrade(t, strategyMap.get(t.strategy_id ?? '') ?? undefined)
      );

      if (mapped.length > 0) setTrades(mapped);
      if (strategies.length > 0 || mapped.length > 0) {
        setRuntimes(computeRuntimes(strategies, mapped));
        setUsingRealData(true);
      }
    })();

    return () => { cancelled = true; };
  }, [eoa, fetchTick]);

  // Live price simulation — only runs when the Executing tab is visible
  useEffect(() => {
    if (!isActive) return;
    const interval = setInterval(() => {
      setTrades(prev =>
        prev.map(t => {
          if (t.status !== 'filled') return t;
          const drift = (Math.random() - 0.48) * 0.005;
          const newPrice = Math.max(0.01, Math.min(0.99, t.currentPrice + drift));
          const pnl = (newPrice - t.entryPrice) * t.shares;
          return { ...t, currentPrice: newPrice, pnl };
        })
      );
    }, 3000);
    return () => clearInterval(interval);
  }, [isActive]);

  const updateTradeStatus = useCallback((id: string, status: TradeStatus) => {
    setTrades(prev => prev.map(t => t.id === id ? { ...t, status } : t));
    if (usingRealData) {
      apiPatch(`/api/trades/${id}`, { status });
    }
  }, [usingRealData]);

  const pauseStrategy = useCallback((strategyId: string) => {
    setRuntimes(prev =>
      prev.map(r => r.strategyId === strategyId ? { ...r, status: 'paused' as StrategyStatus } : r)
    );
    if (eoa) apiPatch(`/api/strategies/${strategyId}?eoa=${eoa}`, { runtimeStatus: 'paused' });
  }, [eoa]);

  const stopStrategy = useCallback((strategyId: string) => {
    setRuntimes(prev =>
      prev.map(r => r.strategyId === strategyId ? { ...r, status: 'stopped' as StrategyStatus } : r)
    );
    if (eoa) apiPatch(`/api/strategies/${strategyId}?eoa=${eoa}`, { runtimeStatus: 'stopped' });
  }, [eoa]);

  const resumeStrategy = useCallback((strategyId: string) => {
    setRuntimes(prev =>
      prev.map(r => r.strategyId === strategyId ? { ...r, status: 'running' as StrategyStatus } : r)
    );
    if (eoa) apiPatch(`/api/strategies/${strategyId}?eoa=${eoa}`, { runtimeStatus: 'running' });
  }, [eoa]);

  return { trades, runtimes, usingRealData, updateTradeStatus, pauseStrategy, stopStrategy, resumeStrategy };
}
