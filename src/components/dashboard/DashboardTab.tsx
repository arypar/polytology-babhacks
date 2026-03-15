'use client';

import { RefreshCw, Wallet, TrendingUp, TrendingDown, BarChart2, ExternalLink, ArrowRightLeft, AlertTriangle } from 'lucide-react';
import { usePolymarketSession } from '@/hooks/usePolymarketSession';
import { useWalletBalance } from '@/hooks/useWalletBalance';
import { usePositions, type PolymarketPosition } from '@/hooks/usePositions';

// Uniswap swap link: native USDC → USDC.e on Polygon
const BRIDGE_URL =
  'https://app.uniswap.org/swap?chain=polygon' +
  '&inputCurrency=0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359' +
  '&outputCurrency=0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174';

interface DashboardTabProps {
  onNavigateToIntelligence?: () => void;
}

// ── Formatters ──────────────────────────────────────────────────────────────

function fmt$(n: number, decimals = 2): string {
  const abs = Math.abs(n);
  return `${n < 0 ? '-' : ''}$${abs.toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })}`;
}

function fmtPct(n: number, decimals = 1): string {
  return `${n >= 0 ? '+' : ''}${(n * 100).toFixed(decimals)}%`;
}

function fmtShares(n: number): string {
  return n.toLocaleString('en-US', { maximumFractionDigits: 2 });
}

// ── Stat Card ───────────────────────────────────────────────────────────────

function StatCard({
  label,
  value,
  sub,
  positive,
  neutral,
}: {
  label: string;
  value: string;
  sub?: string;
  positive?: boolean;
  neutral?: boolean;
}) {
  const valueColor = neutral
    ? 'var(--text)'
    : positive === true
    ? 'var(--yes)'
    : positive === false
    ? 'var(--no)'
    : 'var(--text)';

  return (
    <div
      className="flex flex-col gap-1 px-4 py-3"
      style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border)' }}
    >
      <span className="terminal-label">{label}</span>
      <span
        className="metric text-[22px] font-bold leading-none"
        style={{ color: valueColor }}
      >
        {value}
      </span>
      {sub && (
        <span className="font-mono text-[10px]" style={{ color: 'var(--text-tertiary)' }}>
          {sub}
        </span>
      )}
    </div>
  );
}

// ── Outcome Badge ────────────────────────────────────────────────────────────

function OutcomeBadge({ outcome }: { outcome: string }) {
  const isYes = outcome.toLowerCase() === 'yes';
  const color = isYes ? 'var(--yes)' : 'var(--no)';
  return (
    <span
      className="font-mono text-[10px] px-1.5 py-0.5 font-bold"
      style={{
        color,
        backgroundColor: `${isYes ? '#22c55e' : '#ef4444'}15`,
        border: `1px solid ${isYes ? '#22c55e' : '#ef4444'}35`,
      }}
    >
      {outcome.toUpperCase()}
    </span>
  );
}

// ── Position Row ─────────────────────────────────────────────────────────────

function PositionRow({
  position,
  onMarketClick,
}: {
  position: PolymarketPosition;
  onMarketClick?: () => void;
}) {
  const pnl = position.pnl;
  const pnlPositive = pnl >= 0;
  const pnlColor = pnl === 0 ? 'var(--text-secondary)' : pnlPositive ? 'var(--yes)' : 'var(--no)';

  // P&L % = pnl / (avgPrice * size) if cost basis exists
  const costBasis = position.avgPrice * position.size;
  const pnlPct = costBasis > 0 ? pnl / costBasis : 0;

  return (
    <tr>
      <td>
        <button
          onClick={onMarketClick}
          className="flex items-center gap-1.5 text-left transition-colors max-w-[320px]"
          style={{ color: 'var(--text)' }}
          onMouseEnter={e => (e.currentTarget.style.color = 'var(--accent)')}
          onMouseLeave={e => (e.currentTarget.style.color = 'var(--text)')}
          title={position.title}
        >
          <span className="truncate text-[12px] font-medium">{position.title || '—'}</span>
          {onMarketClick && (
            <ExternalLink className="h-2.5 w-2.5 shrink-0 opacity-50" />
          )}
        </button>
      </td>
      <td>
        <OutcomeBadge outcome={position.outcome} />
      </td>
      <td>
        <span className="metric text-[12px]" style={{ color: 'var(--text)' }}>
          {fmtShares(position.size)}
        </span>
      </td>
      <td>
        <span className="metric text-[12px]" style={{ color: 'var(--text-secondary)' }}>
          {fmtPct(position.avgPrice, 1).replace('+', '')}
        </span>
      </td>
      <td>
        <span
          className="metric text-[12px]"
          style={{
            color:
              position.currentPrice > position.avgPrice
                ? 'var(--yes)'
                : position.currentPrice < position.avgPrice
                ? 'var(--no)'
                : 'var(--text-secondary)',
          }}
        >
          {fmtPct(position.currentPrice, 1).replace('+', '')}
        </span>
      </td>
      <td>
        <span className="metric text-[12px]" style={{ color: 'var(--text)' }}>
          {fmt$(position.currentValue)}
        </span>
      </td>
      <td>
        <div className="flex items-center gap-1.5">
          <span className="metric text-[12px]" style={{ color: pnlColor }}>
            {fmt$(pnl)}
          </span>
          {costBasis > 0 && (
            <span className="metric text-[10px]" style={{ color: pnlColor, opacity: 0.75 }}>
              ({fmtPct(pnlPct)})
            </span>
          )}
        </div>
      </td>
    </tr>
  );
}

// ── Bridge Banner ────────────────────────────────────────────────────────────

function BridgeBanner({ usdc }: { usdc: number }) {
  return (
    <div
      className="flex items-start gap-3 px-4 py-3 shrink-0"
      style={{
        backgroundColor: 'rgba(234, 179, 8, 0.06)',
        border: '1px solid rgba(234, 179, 8, 0.25)',
      }}
    >
      <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" style={{ color: '#eab308' }} />
      <div className="flex-1 min-w-0">
        <p className="font-mono text-[12px] font-semibold" style={{ color: '#eab308' }}>
          Native USDC detected — not usable on Polymarket
        </p>
        <p className="font-mono text-[11px] mt-0.5" style={{ color: 'var(--text-secondary)' }}>
          You have{' '}
          <span className="font-bold" style={{ color: 'var(--text)' }}>
            ${usdc.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} native USDC
          </span>{' '}
          on Polygon. Polymarket only accepts{' '}
          <span className="font-bold" style={{ color: 'var(--text)' }}>USDC.e (bridged)</span>.
          Swap it on Uniswap to start trading.
        </p>
      </div>
      <a
        href={`${BRIDGE_URL}&exactAmount=${usdc.toFixed(6)}`}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center gap-1.5 px-3 py-1.5 font-mono text-[11px] font-bold shrink-0 transition-opacity hover:opacity-80"
        style={{
          backgroundColor: 'rgba(234, 179, 8, 0.15)',
          border: '1px solid rgba(234, 179, 8, 0.4)',
          color: '#eab308',
        }}
      >
        <ArrowRightLeft className="h-3 w-3" />
        Swap on Uniswap
        <ExternalLink className="h-2.5 w-2.5 opacity-60" />
      </a>
    </div>
  );
}

// ── Loading skeleton rows ────────────────────────────────────────────────────

function SkeletonRows() {
  return (
    <>
      {[...Array(5)].map((_, i) => (
        <tr key={i}>
          {[...Array(7)].map((__, j) => (
            <td key={j}>
              <div
                className="skeleton h-3 rounded-sm"
                style={{ width: j === 0 ? '200px' : '60px' }}
              />
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}

// ── Main Component ───────────────────────────────────────────────────────────

export function DashboardTab({ onNavigateToIntelligence }: DashboardTabProps) {
  const { status, safeAddress, eoaAddress } = usePolymarketSession();

  // Check balance on BOTH the Safe (trading wallet) and the EOA (embedded wallet).
  // Users often receive funds on their EOA before completing onboarding.
  const safeBalance = useWalletBalance(safeAddress);
  const eoaBalance  = useWalletBalance(eoaAddress);

  // Combine: prefer Safe values for the trading balance; surface EOA native USDC too
  const usdce           = safeBalance.usdce + eoaBalance.usdce;
  const usdc            = safeBalance.usdc  + eoaBalance.usdc;
  const balanceLoading  = safeBalance.loading || eoaBalance.loading;
  // needsConversion: either wallet has native USDC but neither has USDC.e
  const needsConversion = usdc > 0 && usdce === 0;

  const { positions, loading: positionsLoading, error, refetch } = usePositions(safeAddress);

  const isReady   = status === 'ready';
  const hasWallet = eoaAddress !== null;   // authenticated enough to show balances
  const isLoading = positionsLoading || balanceLoading;

  // Portfolio stats
  const totalPositionValue = positions.reduce((sum, p) => sum + p.currentValue, 0);
  const portfolioValue = totalPositionValue + usdce;
  const totalPnl = positions.reduce((sum, p) => sum + p.pnl, 0);
  const openCount = positions.length;

  // ── Not authenticated at all ───────────────────────────────────────────────
  if (!hasWallet) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4" style={{ color: 'var(--text-tertiary)' }}>
        <Wallet className="h-8 w-8 opacity-30" />
        <div className="text-center">
          <p className="font-mono text-[13px]" style={{ color: 'var(--text-secondary)' }}>
            Connect your wallet to view your balance
          </p>
          <p className="font-mono text-[11px] mt-1" style={{ color: 'var(--text-tertiary)' }}>
            Complete setup in the top-right corner to get started
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 h-full min-h-0">

      {/* ── Stats strip ───────────────────────────────────────────────────── */}
      <div className={`grid gap-3 shrink-0 ${usdc > 0 ? 'grid-cols-5' : 'grid-cols-4'}`}>
        <StatCard
          label="Portfolio Value"
          value={fmt$(portfolioValue)}
          sub={`${fmt$(totalPositionValue)} in positions`}
          neutral
        />
        <StatCard
          label="Available USDC.e"
          value={fmt$(usdce)}
          sub="Ready to deploy"
          neutral
        />
        {usdc > 0 && (
          <StatCard
            label="Native USDC"
            value={fmt$(usdc)}
            sub="Needs conversion ↓"
            positive={false}
          />
        )}
        <StatCard
          label="Unrealized P&L"
          value={fmt$(totalPnl)}
          positive={totalPnl > 0 ? true : totalPnl < 0 ? false : undefined}
          neutral={totalPnl === 0}
        />
        <StatCard
          label="Open Positions"
          value={String(openCount)}
          sub={openCount === 1 ? '1 market' : `${openCount} markets`}
          neutral
        />
      </div>

      {/* ── Bridge banner (shown when user has native USDC but no USDC.e) ── */}
      {needsConversion && <BridgeBanner usdc={usdc} />}

      {/* ── Setup prompt (wallet connected but onboarding incomplete) ─────── */}
      {!isReady && (
        <div
          className="flex items-center gap-2 px-4 py-2.5 shrink-0"
          style={{
            backgroundColor: 'rgba(99,102,241,0.06)',
            border: '1px solid rgba(99,102,241,0.2)',
          }}
        >
          <Wallet className="h-3 w-3 shrink-0" style={{ color: 'var(--accent)' }} />
          <p className="font-mono text-[11px]" style={{ color: 'var(--text-secondary)' }}>
            Complete wallet setup in the top-right corner to unlock trading and view open positions.
          </p>
        </div>
      )}

      {/* ── Positions panel ───────────────────────────────────────────────── */}
      <div
        className="flex flex-col min-h-0 flex-1 panel"
      >
        {/* Panel header */}
        <div className="panel-header justify-between">
          <div className="flex items-center gap-2">
            <BarChart2 className="h-3 w-3" style={{ color: 'var(--accent)' }} />
            <span className="terminal-label">Open Positions</span>
          </div>
          <div className="flex items-center gap-3">
            {error && (
              <span className="font-mono text-[10px]" style={{ color: 'var(--no)' }}>
                {error}
              </span>
            )}
            {isReady && (
              <button
                onClick={refetch}
                disabled={isLoading}
                className="flex items-center gap-1 transition-opacity"
                style={{ color: 'var(--text-tertiary)', opacity: isLoading ? 0.4 : 1 }}
                onMouseEnter={e => (e.currentTarget.style.color = 'var(--text-secondary)')}
                onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-tertiary)')}
                title="Refresh"
              >
                <RefreshCw className={`h-3 w-3 ${isLoading ? 'animate-spin' : ''}`} />
                <span className="terminal-label">Refresh</span>
              </button>
            )}
          </div>
        </div>

        {/* Table — only available after full onboarding */}
        <div className="flex-1 overflow-y-auto min-h-0">
          {!isReady ? (
            <div className="flex flex-col items-center justify-center h-full gap-3 py-16">
              <TrendingUp className="h-6 w-6 opacity-20" />
              <p className="font-mono text-[12px]" style={{ color: 'var(--text-tertiary)' }}>
                Finish wallet setup to see your positions
              </p>
            </div>
          ) : !isLoading && positions.length === 0 && !error ? (
            <div className="flex flex-col items-center justify-center h-full gap-3 py-16">
              {totalPnl === 0 && (
                <>
                  <TrendingUp className="h-6 w-6 opacity-20" />
                  <p className="font-mono text-[12px]" style={{ color: 'var(--text-tertiary)' }}>
                    No open positions
                  </p>
                  {onNavigateToIntelligence && (
                    <button
                      onClick={onNavigateToIntelligence}
                      className="font-mono text-[11px] transition-colors"
                      style={{ color: 'var(--accent)' }}
                      onMouseEnter={e => (e.currentTarget.style.opacity = '0.75')}
                      onMouseLeave={e => (e.currentTarget.style.opacity = '1')}
                    >
                      Browse markets →
                    </button>
                  )}
                </>
              )}
            </div>
          ) : (
            <table className="terminal-table">
              <thead>
                <tr>
                  <th>Market</th>
                  <th>Outcome</th>
                  <th>Shares</th>
                  <th>Avg Price</th>
                  <th>Current</th>
                  <th>Value</th>
                  <th>P&amp;L</th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <SkeletonRows />
                ) : (
                  positions.map((pos, i) => (
                    <PositionRow
                      key={`${pos.conditionId}-${pos.outcome}-${i}`}
                      position={pos}
                      onMarketClick={onNavigateToIntelligence}
                    />
                  ))
                )}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* ── Footer note ───────────────────────────────────────────────────── */}
      {positions.length > 0 && (
        <div className="shrink-0 flex items-center justify-between">
          <span className="terminal-label">
            {positions.length} position{positions.length !== 1 ? 's' : ''} · refreshes every 30s
          </span>
          <div className="flex items-center gap-1" style={{ color: 'var(--text-tertiary)' }}>
            {totalPnl >= 0 ? (
              <TrendingUp className="h-3 w-3" style={{ color: 'var(--yes)' }} />
            ) : (
              <TrendingDown className="h-3 w-3" style={{ color: 'var(--no)' }} />
            )}
            <span className="metric text-[11px]" style={{ color: totalPnl >= 0 ? 'var(--yes)' : 'var(--no)' }}>
              {fmt$(totalPnl)} total P&L
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
