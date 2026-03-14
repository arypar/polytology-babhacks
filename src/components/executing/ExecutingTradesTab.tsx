'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Play, Pause, Square, TrendingUp, TrendingDown, Zap, DollarSign,
  BarChart2, CheckCircle, Clock, AlertCircle, XCircle, ChevronDown, ChevronUp,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ExecutingTrade, StrategyRuntime, TradeStatus, StrategyStatus } from '@/lib/types';

function fmt$(n: number, decimals = 2): string {
  const abs = Math.abs(n);
  return `${n < 0 ? '-' : ''}$${abs.toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}`;
}

function fmtPct(n: number): string {
  return `${(n * 100).toFixed(1)}%`;
}

function timeAgo(ts: number): string {
  const diff = Date.now() - ts;
  if (diff < 60_000) return `${Math.floor(diff / 1000)}s ago`;
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  return `${Math.floor(diff / 86_400_000)}d ago`;
}

function timeRunning(ts: number): string {
  const diff = Date.now() - ts;
  const h = Math.floor(diff / 3_600_000);
  const m = Math.floor((diff % 3_600_000) / 60_000);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

// ── Status badge ──────────────────────────────────────────────

function StatusBadge({ status }: { status: StrategyStatus | TradeStatus }) {
  const config: Record<string, { label: string; color: string; icon: React.ElementType }> = {
    running: { label: 'Running', color: 'text-yes bg-yes/10 border-yes/25', icon: Zap },
    paused: { label: 'Paused', color: 'text-alert bg-alert/10 border-alert/25', icon: Pause },
    stopped: { label: 'Stopped', color: 'text-white/40 bg-white/[0.04] border-white/[0.08]', icon: Square },
    pending: { label: 'Pending', color: 'text-primary bg-primary/10 border-primary/25', icon: Clock },
    filled: { label: 'Filled', color: 'text-yes bg-yes/10 border-yes/25', icon: CheckCircle },
    failed: { label: 'Failed', color: 'text-no bg-no/10 border-no/25', icon: XCircle },
    cancelled: { label: 'Cancelled', color: 'text-white/30 bg-white/[0.03] border-white/[0.06]', icon: AlertCircle },
  };
  const c = config[status] ?? config.stopped;
  const Icon = c.icon;
  return (
    <span className={cn('inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold', c.color)}>
      <Icon className="h-2.5 w-2.5" />
      {c.label}
    </span>
  );
}

// ── Strategy runtime card ─────────────────────────────────────

function StrategyCard({
  runtime,
  trades,
  onPause,
  onStop,
  onResume,
}: {
  runtime: StrategyRuntime;
  trades: ExecutingTrade[];
  onPause: () => void;
  onStop: () => void;
  onResume?: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const totalPnl = runtime.realizedPnl + runtime.unrealizedPnl;
  const isRunning = runtime.status === 'running';
  const isPaused = runtime.status === 'paused';

  return (
    <div
      className={cn(
        'rounded-lg border border-white/[0.08] bg-[#0D0D14] overflow-hidden transition-colors',
        isRunning && 'border-l-[3px] border-l-yes'
      )}
    >
      <div className="p-4">
        <div className="flex items-start justify-between gap-3">
          {/* Left: strategy info */}
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 mb-1">
              <StatusBadge status={runtime.status} />
              {isRunning && (
                <span className="h-1.5 w-1.5 rounded-full bg-yes animate-trade-pulse" />
              )}
            </div>
            <p className="text-[15px] font-semibold text-white/90 mt-1">{runtime.strategyName}</p>
            <p className="text-[11px] text-white/35 mt-0.5">
              {runtime.tradesExecuted} trades · running {timeRunning(runtime.startedAt)}
              {runtime.lastTradeAt && ` · last ${timeAgo(runtime.lastTradeAt)}`}
            </p>
          </div>

          {/* Right: PnL + controls */}
          <div className="flex items-center gap-3 shrink-0">
            <div className="text-right">
              <div className={cn(
                'text-[18px] font-black tracking-tight',
                totalPnl >= 0 ? 'text-yes' : 'text-no'
              )}>
                {totalPnl >= 0 ? '+' : ''}{fmt$(totalPnl)}
              </div>
              <div className="text-[10px] text-white/30">total PnL</div>
            </div>
            <div className="flex items-center gap-1.5">
              {isRunning && (
                <button
                  onClick={onPause}
                  className="h-7 w-7 flex items-center justify-center rounded-md border border-alert/25 bg-alert/8 text-alert hover:bg-alert/16 transition-colors"
                  title="Pause strategy"
                >
                  <Pause className="h-3.5 w-3.5" />
                </button>
              )}
              {isPaused && onResume && (
                <button
                  onClick={onResume}
                  className="h-7 w-7 flex items-center justify-center rounded-md border border-yes/25 bg-yes/8 text-yes hover:bg-yes/16 transition-colors"
                  title="Resume strategy"
                >
                  <Play className="h-3.5 w-3.5" />
                </button>
              )}
              {runtime.status !== 'stopped' && (
                <button
                  onClick={onStop}
                  className="h-7 w-7 flex items-center justify-center rounded-md border border-white/[0.08] text-white/35 hover:border-no/25 hover:text-no hover:bg-no/8 transition-colors"
                  title="Stop strategy"
                >
                  <Square className="h-3.5 w-3.5" />
                </button>
              )}
              <button
                onClick={() => setExpanded(!expanded)}
                className="h-7 w-7 flex items-center justify-center rounded-md border border-white/[0.07] text-white/25 hover:text-white/55 transition-colors"
              >
                {expanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
              </button>
            </div>
          </div>
        </div>

        {/* Metrics row */}
        <div className="grid grid-cols-4 gap-2 mt-4">
          {[
            { label: 'Deployed', value: fmt$(runtime.totalDeployed, 0) },
            { label: 'Realized', value: fmt$(runtime.realizedPnl), color: runtime.realizedPnl >= 0 ? 'text-yes' : 'text-no' },
            { label: 'Unrealized', value: fmt$(runtime.unrealizedPnl), color: runtime.unrealizedPnl >= 0 ? 'text-yes' : 'text-no' },
            { label: 'Win Rate', value: fmtPct(runtime.winRate), color: runtime.winRate >= 0.5 ? 'text-yes' : 'text-no' },
          ].map(m => (
            <div key={m.label} className="rounded-md border border-white/[0.06] p-2.5 text-center">
              <div className={cn('text-[13px] font-bold', m.color ?? 'text-white/75')}>{m.value}</div>
              <div className="text-[10px] text-white/30 mt-0.5">{m.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Expanded trades */}
      <AnimatePresence>
        {expanded && trades.length > 0 && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="border-t border-white/[0.05] px-4 pb-3">
              <p className="text-[11px] font-medium text-white/35 mt-3 mb-2">Recent Trades</p>
              <div className="space-y-1">
                {trades.map(trade => (
                  <TradeRow key={trade.id} trade={trade} />
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── Trade row (inline, for expanded strategy) ─────────────────

function TradeRow({ trade }: { trade: ExecutingTrade }) {
  const pnl = trade.pnl ?? 0;
  const isUp = pnl >= 0;

  return (
    <div className="flex items-center justify-between rounded-md border border-white/[0.04] bg-white/[0.01] px-3 py-2 text-[12px]">
      <div className="flex items-center gap-3 min-w-0">
        <span
          className={cn(
            'inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold border',
            trade.side === 'YES'
              ? 'text-yes border-yes/25 bg-yes/8'
              : 'text-no border-no/25 bg-no/8'
          )}
        >
          {trade.side}
        </span>
        <span className="text-white/55 truncate max-w-[220px]">{trade.marketQuestion}</span>
      </div>
      <div className="flex items-center gap-3 shrink-0">
        <span className="text-[11px] text-white/35 font-mono hidden sm:block">
          {trade.shares} @ {trade.entryPrice.toFixed(2)}
        </span>
        <span className={cn('font-bold min-w-[56px] text-right', isUp ? 'text-yes' : 'text-no')}>
          {isUp ? '+' : ''}{fmt$(pnl)}
        </span>
        <StatusBadge status={trade.status} />
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────

interface ExecutingTradesTabProps {
  trades: ExecutingTrade[];
  runtimes: StrategyRuntime[];
  onUpdateTradeStatus: (id: string, status: TradeStatus) => void;
  onPauseStrategy: (strategyId: string) => void;
  onStopStrategy: (strategyId: string) => void;
  onResumeStrategy?: (strategyId: string) => void;
}

export function ExecutingTradesTab({
  trades,
  runtimes,
  onPauseStrategy,
  onStopStrategy,
  onResumeStrategy,
}: ExecutingTradesTabProps) {
  const totalPnl = runtimes.reduce((s, r) => s + r.realizedPnl + r.unrealizedPnl, 0);
  const totalDeployed = runtimes.reduce((s, r) => s + r.totalDeployed, 0);
  const totalTrades = runtimes.reduce((s, r) => s + r.tradesExecuted, 0);
  const avgWinRate = runtimes.length
    ? runtimes.reduce((s, r) => s + r.winRate, 0) / runtimes.length
    : 0;
  const runningCount = runtimes.filter(r => r.status === 'running').length;

  return (
    <div className="space-y-8">
      {/* Aggregate stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          {
            label: 'Total PnL',
            value: `${totalPnl >= 0 ? '+' : ''}${fmt$(totalPnl)}`,
            color: totalPnl >= 0 ? 'text-yes' : 'text-no',
            icon: totalPnl >= 0 ? TrendingUp : TrendingDown,
            sub: 'realized + unrealized',
          },
          {
            label: 'Deployed Capital',
            value: fmt$(totalDeployed, 0),
            color: 'text-white',
            icon: DollarSign,
            sub: 'across all strategies',
          },
          {
            label: 'Total Trades',
            value: String(totalTrades),
            color: 'text-white',
            icon: BarChart2,
            sub: `${runningCount} strateg${runningCount !== 1 ? 'ies' : 'y'} running`,
          },
          {
            label: 'Avg Win Rate',
            value: fmtPct(avgWinRate),
            color: avgWinRate >= 0.5 ? 'text-yes' : 'text-no',
            icon: Zap,
            sub: 'across strategies',
          },
        ].map(s => (
          <div key={s.label} className="rounded-lg border border-white/[0.08] bg-[#0D0D14] p-4">
            <div className="flex items-center justify-between mb-3">
              <span className="text-[11px] font-medium text-white/40">{s.label}</span>
              <s.icon className="h-4 w-4 text-white/20" />
            </div>
            <div className={cn('text-[22px] font-bold tracking-tight', s.color)}>{s.value}</div>
            <div className="text-[11px] text-white/30 mt-1">{s.sub}</div>
          </div>
        ))}
      </div>

      {/* Strategy cards */}
      <div>
        <div className="flex items-center justify-between pb-3 border-b border-white/[0.06] mb-4">
          <h2 className="text-[15px] font-semibold text-white">Active Strategies</h2>
          <div className="flex items-center gap-2">
            <span className="h-1.5 w-1.5 rounded-full bg-yes animate-trade-pulse" />
            <span className="text-[12px] text-white/35">{runningCount} running</span>
          </div>
        </div>

        {runtimes.length === 0 ? (
          <div className="rounded-lg border border-dashed border-white/[0.07] p-16 text-center">
            <Zap className="h-10 w-10 text-white/10 mx-auto mb-4" />
            <p className="text-[15px] text-white/25 font-medium">No autonomous strategies running</p>
            <p className="text-[13px] text-white/18 mt-1">Build and activate a strategy in the Builder tab</p>
          </div>
        ) : (
          <div className="space-y-3">
            {runtimes.map(runtime => (
              <StrategyCard
                key={runtime.strategyId}
                runtime={runtime}
                trades={trades.filter(t => t.strategyId === runtime.strategyId)}
                onPause={() => onPauseStrategy(runtime.strategyId)}
                onStop={() => onStopStrategy(runtime.strategyId)}
                onResume={onResumeStrategy ? () => onResumeStrategy(runtime.strategyId) : undefined}
              />
            ))}
          </div>
        )}
      </div>

      {/* Trade log — semantic table */}
      <div>
        <div className="flex items-center justify-between pb-3 border-b border-white/[0.06] mb-4">
          <h2 className="text-[15px] font-semibold text-white">Trade Log</h2>
          <span className="text-[12px] text-white/30">{trades.length} trades</span>
        </div>

        <div className="rounded-lg border border-white/[0.08] bg-[#0D0D14] overflow-hidden">
          <table className="w-full text-[12px]">
            <thead>
              <tr className="border-b border-white/[0.06]">
                <th className="px-4 py-2.5 text-left text-[10px] font-semibold text-white/35 uppercase tracking-wider">Market</th>
                <th className="px-4 py-2.5 text-left text-[10px] font-semibold text-white/35 uppercase tracking-wider w-[60px]">Side</th>
                <th className="px-4 py-2.5 text-left text-[10px] font-semibold text-white/35 uppercase tracking-wider w-[120px] hidden sm:table-cell">Position</th>
                <th className="px-4 py-2.5 text-right text-[10px] font-semibold text-white/35 uppercase tracking-wider w-[80px]">PnL</th>
                <th className="px-4 py-2.5 text-left text-[10px] font-semibold text-white/35 uppercase tracking-wider w-[90px]">Status</th>
                <th className="px-4 py-2.5 text-right text-[10px] font-semibold text-white/35 uppercase tracking-wider w-[80px] hidden md:table-cell">When</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.04]">
              {trades.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-white/25">No trades yet</td>
                </tr>
              ) : trades.map(trade => {
                const pnl = trade.pnl ?? 0;
                return (
                  <tr key={trade.id} className="hover:bg-white/[0.02] transition-colors">
                    <td className="px-4 py-3 text-white/65 max-w-[200px] truncate">{trade.marketQuestion}</td>
                    <td className="px-4 py-3">
                      <span
                        className={cn(
                          'inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold border',
                          trade.side === 'YES'
                            ? 'text-yes border-yes/25 bg-yes/8'
                            : 'text-no border-no/25 bg-no/8'
                        )}
                      >
                        {trade.side}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-white/35 font-mono text-[11px] hidden sm:table-cell">
                      {trade.shares} @ {trade.entryPrice.toFixed(2)}
                    </td>
                    <td className={cn('px-4 py-3 font-bold text-right', pnl >= 0 ? 'text-yes' : 'text-no')}>
                      {pnl >= 0 ? '+' : ''}{fmt$(pnl)}
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={trade.status} />
                    </td>
                    <td className="px-4 py-3 text-white/25 text-right text-[11px] hidden md:table-cell">
                      {timeAgo(trade.timestamp)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
