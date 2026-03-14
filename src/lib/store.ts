'use client';

import { useState, useCallback, useEffect } from 'react';
import type {
  AutonomousStrategy,
  StrategyBlock,
  ExecutingTrade,
  StrategyRuntime,
  StrategyStatus,
  TradeStatus,
} from './types';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

async function apiGet<T>(path: string): Promise<T | null> {
  try {
    const res = await fetch(`${API_BASE}${path}`);
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

async function apiPost(path: string, body: unknown): Promise<boolean> {
  try {
    const res = await fetch(`${API_BASE}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    return res.ok;
  } catch {
    return false;
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

// ── Strategy store ────────────────────────────────────────────

const STRATEGIES_KEY = 'pm-strategies';

function loadStrategies(): AutonomousStrategy[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STRATEGIES_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveStrategies(strategies: AutonomousStrategy[]) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STRATEGIES_KEY, JSON.stringify(strategies));
}

export function useStrategies() {
  const [strategies, setStrategies] = useState<AutonomousStrategy[]>(loadStrategies);

  const addStrategy = useCallback((strategy: AutonomousStrategy) => {
    setStrategies(prev => {
      const next = [strategy, ...prev];
      saveStrategies(next);
      return next;
    });
    apiPost('/api/strategies', strategy);
  }, []);

  const updateStrategy = useCallback((id: string, updates: Partial<AutonomousStrategy>) => {
    setStrategies(prev => {
      const next = prev.map(s => s.id === id ? { ...s, ...updates, updatedAt: Date.now() } : s);
      saveStrategies(next);
      return next;
    });
    apiPatch(`/api/strategies/${id}`, updates);
  }, []);

  const removeStrategy = useCallback((id: string) => {
    setStrategies(prev => {
      const next = prev.filter(s => s.id !== id);
      saveStrategies(next);
      return next;
    });
    apiDelete(`/api/strategies/${id}`);
  }, []);

  const updateBlocks = useCallback((id: string, blocks: StrategyBlock[]) => {
    setStrategies(prev => {
      const next = prev.map(s => s.id === id ? { ...s, blocks, updatedAt: Date.now() } : s);
      saveStrategies(next);
      return next;
    });
  }, []);

  return { strategies, addStrategy, updateStrategy, removeStrategy, updateBlocks };
}

// ── Executing trades store ────────────────────────────────────

const MOCK_RUNTIMES: StrategyRuntime[] = [
  {
    strategyId: 'demo-1',
    strategyName: 'Trump 2024 Momentum',
    status: 'running',
    tradesExecuted: 14,
    totalDeployed: 2400,
    realizedPnl: 312.50,
    unrealizedPnl: 88.20,
    winRate: 0.71,
    startedAt: Date.now() - 1000 * 60 * 60 * 8,
    lastTradeAt: Date.now() - 1000 * 60 * 4,
  },
  {
    strategyId: 'demo-2',
    strategyName: 'BTC 100k by EOY',
    status: 'running',
    tradesExecuted: 6,
    totalDeployed: 800,
    realizedPnl: -42.00,
    unrealizedPnl: 124.00,
    winRate: 0.50,
    startedAt: Date.now() - 1000 * 60 * 60 * 2,
    lastTradeAt: Date.now() - 1000 * 60 * 22,
  },
  {
    strategyId: 'demo-3',
    strategyName: 'Fed Rate Cut Fade',
    status: 'paused',
    tradesExecuted: 3,
    totalDeployed: 500,
    realizedPnl: 95.00,
    unrealizedPnl: 0,
    winRate: 1.0,
    startedAt: Date.now() - 1000 * 60 * 60 * 24,
    lastTradeAt: Date.now() - 1000 * 60 * 60 * 3,
  },
];

const MOCK_TRADES: ExecutingTrade[] = [
  {
    id: 't1',
    strategyId: 'demo-1',
    strategyName: 'Trump 2024 Momentum',
    marketId: 'mkt-1',
    marketQuestion: 'Will Donald Trump win the 2024 US Presidential Election?',
    side: 'YES',
    shares: 250,
    entryPrice: 0.61,
    currentPrice: 0.72,
    status: 'filled',
    timestamp: Date.now() - 1000 * 60 * 30,
    pnl: 27.50,
  },
  {
    id: 't2',
    strategyId: 'demo-1',
    strategyName: 'Trump 2024 Momentum',
    marketId: 'mkt-1',
    marketQuestion: 'Will Donald Trump win the 2024 US Presidential Election?',
    side: 'YES',
    shares: 150,
    entryPrice: 0.68,
    currentPrice: 0.72,
    status: 'filled',
    timestamp: Date.now() - 1000 * 60 * 10,
    pnl: 6.00,
  },
  {
    id: 't3',
    strategyId: 'demo-2',
    strategyName: 'BTC 100k by EOY',
    marketId: 'mkt-2',
    marketQuestion: 'Will Bitcoin reach $100,000 by end of 2024?',
    side: 'YES',
    shares: 200,
    entryPrice: 0.44,
    currentPrice: 0.59,
    status: 'filled',
    timestamp: Date.now() - 1000 * 60 * 60,
    pnl: 30.00,
  },
  {
    id: 't4',
    strategyId: 'demo-3',
    strategyName: 'Fed Rate Cut Fade',
    marketId: 'mkt-3',
    marketQuestion: 'Will the Fed cut rates in September 2024?',
    side: 'NO',
    shares: 100,
    entryPrice: 0.38,
    currentPrice: 0.38,
    status: 'filled',
    timestamp: Date.now() - 1000 * 60 * 60 * 3,
    pnl: 0,
  },
  {
    id: 't5',
    strategyId: 'demo-1',
    strategyName: 'Trump 2024 Momentum',
    marketId: 'mkt-4',
    marketQuestion: 'Will there be a US recession in 2024?',
    side: 'NO',
    shares: 300,
    entryPrice: 0.72,
    currentPrice: 0.68,
    status: 'pending',
    timestamp: Date.now() - 1000 * 60 * 2,
    pnl: -12.00,
  },
];

export function useExecutingTrades() {
  const [trades, setTrades] = useState<ExecutingTrade[]>(MOCK_TRADES);
  const [runtimes, setRuntimes] = useState<StrategyRuntime[]>(MOCK_RUNTIMES);

  // Simulate live price updates
  useEffect(() => {
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
  }, []);

  const updateTradeStatus = useCallback((id: string, status: TradeStatus) => {
    setTrades(prev => prev.map(t => t.id === id ? { ...t, status } : t));
  }, []);

  const pauseStrategy = useCallback((strategyId: string) => {
    setRuntimes(prev =>
      prev.map(r => r.strategyId === strategyId ? { ...r, status: 'paused' as StrategyStatus } : r)
    );
  }, []);

  const stopStrategy = useCallback((strategyId: string) => {
    setRuntimes(prev =>
      prev.map(r => r.strategyId === strategyId ? { ...r, status: 'stopped' as StrategyStatus } : r)
    );
  }, []);

  const resumeStrategy = useCallback((strategyId: string) => {
    setRuntimes(prev =>
      prev.map(r => r.strategyId === strategyId ? { ...r, status: 'running' as StrategyStatus } : r)
    );
  }, []);

  return { trades, runtimes, updateTradeStatus, pauseStrategy, stopStrategy, resumeStrategy };
}
