'use client';

import { useState } from 'react';
import { Play, Pause, Square, Zap, ChevronDown, ChevronUp } from 'lucide-react';
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
  if (diff < 60_000) return `${Math.floor(diff / 1000)}s`;
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h`;
  return `${Math.floor(diff / 86_400_000)}d`;
}

function timeRunning(ts: number): string {
  const diff = Date.now() - ts;
  const h = Math.floor(diff / 3_600_000);
  const m = Math.floor((diff % 3_600_000) / 60_000);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

// ── Status badge ───────────────────────────────────────────────────────────

function StatusChip({ status }: { status: StrategyStatus | TradeStatus }) {
  const colors: Record<string, { color: string; label: string }> = {
    running:   { color: '#22c55e', label: 'Running'   },
    paused:    { color: '#1652F0', label: 'Paused'    },
    stopped:   { color: '#4a4a5a', label: 'Stopped'   },
    pending:   { color: '#1652F0', label: 'Pending'   },
    filled:    { color: '#22c55e', label: 'Filled'    },
    failed:    { color: '#ef4444', label: 'Failed'    },
    cancelled: { color: '#4a4a5a', label: 'Cancelled' },
  };
  const c = colors[status] ?? colors.stopped;
  return (
    <span
      className="font-mono text-[10px] px-1.5 py-0.5"
      style={{
        border: `1px solid ${c.color}40`,
        color: c.color,
        backgroundColor: `${c.color}0d`,
      }}
    >
      {c.label}
    </span>
  );
}

// ── Strategy row ───────────────────────────────────────────────────────────

function StrategyRow({
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
    <>
      <tr
        style={{
          borderLeft: isRunning ? '2px solid #22c55e' : '2px solid transparent',
        }}
      >
        {/* Name */}
        <td style={{ paddingLeft: isRunning ? 10 : 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            {isRunning && (
              <span
                className="inline-block h-1.5 w-1.5 rounded-full shrink-0 animate-trade-pulse"
                style={{ backgroundColor: '#22c55e' }}
              />
            )}
            <span className="text-[12px] font-medium" style={{ color: 'var(--text)' }}>
              {runtime.strategyName}
            </span>
          </div>
          <div className="terminal-label mt-0.5">
            {runtime.tradesExecuted} trades · {timeRunning(runtime.startedAt)}
            {runtime.lastTradeAt && ` · ${timeAgo(runtime.lastTradeAt)} ago`}
          </div>
        </td>

        {/* Status */}
        <td style={{ width: 60 }}>
          <StatusChip status={runtime.status} />
        </td>

        {/* PnL */}
        <td style={{ width: 88 }}>
          <span
            className="metric text-[13px] font-bold"
            style={{ color: totalPnl >= 0 ? '#22c55e' : '#ef4444' }}
          >
            {totalPnl >= 0 ? '+' : ''}{fmt$(totalPnl)}
          </span>
        </td>

        {/* Deployed */}
        <td style={{ width: 80 }}>
          <span className="metric text-[11px]" style={{ color: 'var(--text-secondary)' }}>
            {fmt$(runtime.totalDeployed, 0)}
          </span>
        </td>

        {/* Realized */}
        <td style={{ width: 80 }}>
          <span
            className="metric text-[11px]"
            style={{ color: runtime.realizedPnl >= 0 ? '#22c55e' : '#ef4444' }}
          >
            {fmt$(runtime.realizedPnl)}
          </span>
        </td>

        {/* Unrealized */}
        <td style={{ width: 80 }}>
          <span
            className="metric text-[11px]"
            style={{ color: runtime.unrealizedPnl >= 0 ? '#22c55e' : '#ef4444' }}
          >
            {fmt$(runtime.unrealizedPnl)}
          </span>
        </td>

        {/* Win Rate */}
        <td style={{ width: 72 }}>
          <span
            className="metric text-[11px] font-semibold"
            style={{ color: runtime.winRate >= 0.5 ? '#22c55e' : '#ef4444' }}
          >
            {fmtPct(runtime.winRate)}
          </span>
        </td>

        {/* Controls */}
        <td style={{ width: 100, paddingRight: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            {isRunning && (
              <button
                onClick={onPause}
                className="flex h-5 w-5 items-center justify-center transition-colors"
                style={{ border: '1px solid #1652F040', color: '#1652F0', backgroundColor: '#1652F00d' }}
                title="Pause"
              >
                <Pause className="h-2.5 w-2.5" />
              </button>
            )}
            {isPaused && onResume && (
              <button
                onClick={onResume}
                className="flex h-5 w-5 items-center justify-center transition-colors"
                style={{ border: '1px solid #22c55e40', color: '#22c55e', backgroundColor: '#22c55e0d' }}
                title="Resume"
              >
                <Play className="h-2.5 w-2.5" />
              </button>
            )}
            {runtime.status !== 'stopped' && (
              <button
                onClick={onStop}
                className="flex h-5 w-5 items-center justify-center transition-colors"
                style={{ border: '1px solid var(--border)', color: 'var(--text-tertiary)' }}
                onMouseEnter={e => {
                  e.currentTarget.style.borderColor = '#ef4444';
                  e.currentTarget.style.color = '#ef4444';
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.borderColor = 'var(--border)';
                  e.currentTarget.style.color = 'var(--text-tertiary)';
                }}
                title="Stop"
              >
                <Square className="h-2.5 w-2.5" />
              </button>
            )}
            <button
              onClick={() => setExpanded(!expanded)}
              className="flex h-5 w-5 items-center justify-center transition-colors"
              style={{ border: '1px solid var(--border)', color: 'var(--text-tertiary)' }}
              onMouseEnter={e => (e.currentTarget.style.color = 'var(--text)')}
              onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-tertiary)')}
            >
              {expanded ? <ChevronUp className="h-2.5 w-2.5" /> : <ChevronDown className="h-2.5 w-2.5" />}
            </button>
          </div>
        </td>
      </tr>

      {/* Expanded trades */}
      {expanded && trades.length > 0 && trades.map(trade => (
        <tr
          key={trade.id}
          style={{ backgroundColor: 'rgba(255,255,255,0.02)', borderLeft: '2px solid transparent' }}
        >
          <td style={{ paddingLeft: 24 }}>
            <span
              className="text-[11px] truncate block max-w-[200px]"
              style={{ color: 'var(--text-secondary)' }}
            >
              {trade.marketQuestion}
            </span>
          </td>
          <td>
            <span
              className="font-mono text-[9px] font-bold"
              style={{ color: trade.side === 'YES' ? '#22c55e' : '#ef4444' }}
            >
              {trade.side}
            </span>
          </td>
          <td>
            <span
              className="metric text-[11px] font-semibold"
              style={{ color: (trade.pnl ?? 0) >= 0 ? '#22c55e' : '#ef4444' }}
            >
              {(trade.pnl ?? 0) >= 0 ? '+' : ''}{fmt$(trade.pnl ?? 0)}
            </span>
          </td>
          <td colSpan={3}>
            <span className="metric text-[10px]" style={{ color: 'var(--text-tertiary)' }}>
              {trade.shares} shares @ {trade.entryPrice.toFixed(2)}
            </span>
          </td>
          <td>
            <StatusChip status={trade.status} />
          </td>
          <td style={{ paddingRight: 12 }}>
            <span className="terminal-label">{timeAgo(trade.timestamp)}</span>
          </td>
        </tr>
      ))}
    </>
  );
}

// ── Interface ──────────────────────────────────────────────────────────────

interface ExecutingTradesTabProps {
  trades: ExecutingTrade[];
  runtimes: StrategyRuntime[];
  usingRealData?: boolean;
  onUpdateTradeStatus: (id: string, status: TradeStatus) => void;
  onPauseStrategy: (strategyId: string) => void;
  onStopStrategy: (strategyId: string) => void;
  onResumeStrategy?: (strategyId: string) => void;
}

export function ExecutingTradesTab({
  trades,
  runtimes,
  usingRealData = false,
  onPauseStrategy,
  onStopStrategy,
  onResumeStrategy,
}: ExecutingTradesTabProps) {
  void usingRealData;

  const totalPnl = runtimes.reduce((s, r) => s + r.realizedPnl + r.unrealizedPnl, 0);
  const totalDeployed = runtimes.reduce((s, r) => s + r.totalDeployed, 0);
  const totalTrades = runtimes.reduce((s, r) => s + r.tradesExecuted, 0);
  const avgWinRate = runtimes.length
    ? runtimes.reduce((s, r) => s + r.winRate, 0) / runtimes.length
    : 0;
  const runningCount = runtimes.filter(r => r.status === 'running').length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>

      {/* Stats strip */}
      <div
        style={{
          display: 'flex',
          borderBottom: '1px solid var(--border)',
          backgroundColor: 'var(--bg-elevated)',
          marginBottom: 16,
          flexWrap: 'wrap',
        }}
      >
        <StatMetric
          label="Total PnL"
          value={`${totalPnl >= 0 ? '+' : ''}${fmt$(totalPnl)}`}
          color={totalPnl >= 0 ? '#22c55e' : '#ef4444'}
        />
        <div style={{ width: 1, backgroundColor: 'var(--border)', alignSelf: 'stretch' }} />
        <StatMetric label="Deployed" value={fmt$(totalDeployed, 0)} />
        <div style={{ width: 1, backgroundColor: 'var(--border)', alignSelf: 'stretch' }} />
        <StatMetric
          label="Trades"
          value={String(totalTrades)}
          sub={`${runningCount} running`}
        />
        <div style={{ width: 1, backgroundColor: 'var(--border)', alignSelf: 'stretch' }} />
        <StatMetric
          label="Win Rate"
          value={fmtPct(avgWinRate)}
          color={avgWinRate >= 0.5 ? '#22c55e' : '#ef4444'}
        />
      </div>

      {/* Strategies table */}
      <section style={{ marginBottom: 24 }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '6px 0',
            borderBottom: '1px solid var(--border)',
            marginBottom: 8,
          }}
        >
          <span className="terminal-label">Active Strategies</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span
              className="inline-block h-1.5 w-1.5 rounded-full animate-trade-pulse"
              style={{ backgroundColor: '#22c55e' }}
            />
            <span className="terminal-label">{runningCount} running</span>
          </div>
        </div>

        {runtimes.length === 0 ? (
          <div
            style={{
              padding: '32px 16px',
              textAlign: 'center',
              border: '1px solid var(--border)',
              backgroundColor: 'var(--bg-card)',
            }}
          >
            <Zap className="h-5 w-5 mx-auto mb-3" style={{ color: 'var(--text-tertiary)' }} />
            <p className="terminal-label">No strategies running</p>
            <p className="text-[11px] mt-1" style={{ color: 'var(--text-tertiary)' }}>
              Build and activate a strategy in the Builder tab
            </p>
          </div>
        ) : (
          <div style={{ border: '1px solid var(--border)', backgroundColor: 'var(--bg-card)' }}>
            <table className="terminal-table" style={{ width: '100%' }}>
              <thead>
                <tr>
                  <th>Strategy</th>
                  <th style={{ width: 80 }}>Status</th>
                  <th style={{ width: 88 }}>Total PnL</th>
                  <th style={{ width: 80 }}>Deployed</th>
                  <th style={{ width: 80 }}>Realized</th>
                  <th style={{ width: 80 }}>Unrealized</th>
                  <th style={{ width: 72 }}>Win Rate</th>
                  <th style={{ width: 100 }}>Controls</th>
                </tr>
              </thead>
              <tbody>
                {runtimes.map(runtime => (
                  <StrategyRow
                    key={runtime.strategyId}
                    runtime={runtime}
                    trades={trades.filter(t => t.strategyId === runtime.strategyId)}
                    onPause={() => onPauseStrategy(runtime.strategyId)}
                    onStop={() => onStopStrategy(runtime.strategyId)}
                    onResume={onResumeStrategy ? () => onResumeStrategy(runtime.strategyId) : undefined}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Trade log */}
      <section>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '6px 0',
            borderBottom: '1px solid var(--border)',
            marginBottom: 8,
          }}
        >
          <span className="terminal-label">Trade Log</span>
          <span className="terminal-label">{trades.length} trades</span>
        </div>

        <div style={{ border: '1px solid var(--border)', backgroundColor: 'var(--bg-card)' }}>
          <table className="terminal-table" style={{ width: '100%' }}>
            <thead>
              <tr>
                <th>Market</th>
                <th style={{ width: 44 }}>Side</th>
                <th style={{ width: 120 }} className="hidden sm:table-cell">Position</th>
                <th style={{ width: 80, textAlign: 'right' }}>PnL</th>
                <th style={{ width: 80 }}>Status</th>
                <th style={{ width: 60, textAlign: 'right' }} className="hidden md:table-cell">When</th>
              </tr>
            </thead>
            <tbody>
              {trades.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ textAlign: 'center', padding: '24px 16px' }}>
                    <span className="terminal-label">No trades yet</span>
                  </td>
                </tr>
              ) : trades.map(trade => {
                const pnl = trade.pnl ?? 0;
                return (
                  <tr key={trade.id}>
                    <td style={{ maxWidth: 200 }}>
                      <span
                        className="text-[11px] truncate block"
                        style={{ color: 'var(--text-secondary)' }}
                      >
                        {trade.marketQuestion}
                      </span>
                    </td>
                    <td>
                      <span
                        className="font-mono text-[9px] font-bold"
                        style={{ color: trade.side === 'YES' ? '#22c55e' : '#ef4444' }}
                      >
                        {trade.side}
                      </span>
                    </td>
                    <td className="hidden sm:table-cell">
                      <span className="metric text-[10px]" style={{ color: 'var(--text-tertiary)' }}>
                        {trade.shares} @ {trade.entryPrice.toFixed(2)}
                      </span>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <span
                        className="metric text-[11px] font-bold"
                        style={{ color: pnl >= 0 ? '#22c55e' : '#ef4444' }}
                      >
                        {pnl >= 0 ? '+' : ''}{fmt$(pnl)}
                      </span>
                    </td>
                    <td>
                      <StatusChip status={trade.status} />
                    </td>
                    <td className="hidden md:table-cell" style={{ textAlign: 'right', paddingRight: 12 }}>
                      <span className="terminal-label">{timeAgo(trade.timestamp)}</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function StatMetric({
  label,
  value,
  sub,
  color,
}: {
  label: string;
  value: string;
  sub?: string;
  color?: string;
}) {
  return (
    <div style={{ padding: '8px 16px' }}>
      <div className="terminal-label">{label}</div>
      <div
        className="metric text-[14px] font-bold leading-tight"
        style={{ color: color ?? 'var(--text)' }}
      >
        {value}
      </div>
      {sub && (
        <div className="terminal-label mt-0.5">{sub}</div>
      )}
    </div>
  );
}
