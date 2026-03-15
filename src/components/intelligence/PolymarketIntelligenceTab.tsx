'use client';

import { useState, useMemo, useEffect, useCallback, useRef, memo } from 'react';
import { Search, RefreshCw, TrendingUp, TrendingDown, ChevronUp, ChevronDown } from 'lucide-react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { MarketCard } from './MarketCard';
import { MarketDetailView } from './MarketDetailView';
import { fetchMarkets, CATEGORIES } from '@/lib/polymarket-data';
import type { PolymarketMarket, MarketCategory } from '@/lib/types';
import { useLivePricesCtx } from '@/lib/LivePricesContext';
import { usePolymarketSession } from '@/hooks/usePolymarketSession';
import { OnboardingFlow } from '@/components/onboarding/OnboardingFlow';
import type { PolymarketSession } from '@/hooks/usePolymarketSession';

type SortKey = 'yesPrice' | 'volume' | 'liquidity' | 'closes' | null;
type SortDir = 'asc' | 'desc';

// Shared grid template — must match MarketCard's GRID_COLS constant
export const GRID_COLS = '40px 1fr 80px 54px 54px 72px 72px 72px 52px 180px';
export const ROW_HEIGHT = 36;

function fmt(n: number) {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`;
  return `$${n.toFixed(0)}`;
}

function SortIcon({ col, sortKey, sortDir }: { col: SortKey; sortKey: SortKey; sortDir: SortDir }) {
  if (sortKey !== col) return null;
  return sortDir === 'asc'
    ? <ChevronUp className="inline h-2.5 w-2.5 ml-0.5" />
    : <ChevronDown className="inline h-2.5 w-2.5 ml-0.5" />;
}

// ─────────────────────────────────────────────────────────────────────────────
// VirtualMarketList — isolated component that owns the live-price subscription.
// Only this component (and its visible ~20 rows) re-renders on WS price ticks;
// the parent tab with its stats strip and filter bar stays untouched.
// ─────────────────────────────────────────────────────────────────────────────
interface VirtualMarketListProps {
  filtered: PolymarketMarket[];
  loading: boolean;
  markets: PolymarketMarket[];
  sortKey: SortKey;
  sortDir: SortDir;
  onSort: (key: SortKey) => void;
  onSelectMarket: (m: PolymarketMarket) => void;
  sessionStatus: PolymarketSession['status'];
  placeOrder: PolymarketSession['placeOrder'];
  eoaAddress: PolymarketSession['eoaAddress'];
  safeAddress: PolymarketSession['safeAddress'];
  onNeedOnboarding: () => void;
}

const VirtualMarketList = memo(function VirtualMarketList({
  filtered,
  loading,
  markets,
  sortKey,
  sortDir,
  onSort,
  onSelectMarket,
  sessionStatus,
  placeOrder,
  eoaAddress,
  safeAddress,
  onNeedOnboarding,
}: VirtualMarketListProps) {
  // This is the ONLY place that subscribes to live prices.
  // The parent tab does NOT subscribe, so it won't re-render on price ticks.
  const livePrices = useLivePricesCtx();

  const scrollRef = useRef<HTMLDivElement>(null);
  const rowVirtualizer = useVirtualizer({
    count: filtered.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 8,
  });

  const thStyle: React.CSSProperties = { cursor: 'pointer', userSelect: 'none' };

  return (
    <div ref={scrollRef} style={{ flex: 1, overflow: 'auto', minHeight: 0 }}>
      {/* Sticky header row */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: GRID_COLS,
          position: 'sticky',
          top: 0,
          zIndex: 2,
          backgroundColor: 'var(--bg-elevated)',
          borderBottom: '1px solid var(--border)',
        }}
      >
        <div className="th" style={{ paddingLeft: 10 }}>#</div>
        <div className="th">Market</div>
        <div className="th">Category</div>
        <div className="th" style={{ ...thStyle }} onClick={() => onSort('yesPrice')}>
          Yes <SortIcon col="yesPrice" sortKey={sortKey} sortDir={sortDir} />
        </div>
        <div className="th">No</div>
        <div className="th" style={{ ...thStyle }} onClick={() => onSort('volume')}>
          Vol 24h <SortIcon col="volume" sortKey={sortKey} sortDir={sortDir} />
        </div>
        <div className="th" style={{ ...thStyle }} onClick={() => onSort('liquidity')}>
          Liquidity <SortIcon col="liquidity" sortKey={sortKey} sortDir={sortDir} />
        </div>
        <div className="th" style={{ ...thStyle }} onClick={() => onSort('closes')}>
          Closes <SortIcon col="closes" sortKey={sortKey} sortDir={sortDir} />
        </div>
        <div className="th">Status</div>
        <div className="th">Trade</div>
      </div>

      {loading ? (
        <div>
          {Array.from({ length: 14 }).map((_, i) => (
            <div
              key={i}
              style={{
                display: 'grid',
                gridTemplateColumns: GRID_COLS,
                height: ROW_HEIGHT,
                borderBottom: '1px solid var(--border)',
                alignItems: 'center',
              }}
            >
              {Array.from({ length: 10 }).map((__, j) => (
                <div key={j} style={{ padding: '0 8px' }}>
                  <div className="skeleton h-3 w-full" style={{ opacity: 0.4 }} />
                </div>
              ))}
            </div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 120 }}>
          <span className="terminal-label">
            {markets.length === 0 ? 'Backend not responding' : 'No results'}
          </span>
        </div>
      ) : (
        <div style={{ height: rowVirtualizer.getTotalSize(), position: 'relative' }}>
          {rowVirtualizer.getVirtualItems().map(vr => {
            const market = filtered[vr.index];
            return (
              <div
                key={market.id}
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  transform: `translateY(${vr.start}px)`,
                }}
              >
                <MarketCard
                  market={market}
                  selected={false}
                  onClick={onSelectMarket}
                  livePrice={livePrices[market.conditionId]}
                  index={vr.index}
                  sessionStatus={sessionStatus}
                  placeOrder={placeOrder}
                  eoaAddress={eoaAddress}
                  safeAddress={safeAddress}
                  onNeedOnboarding={onNeedOnboarding}
                />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// Main tab — manages data fetching, filtering, sorting, and layout.
// Does NOT subscribe to live prices, so it only re-renders on meaningful
// state changes (filter, sort, market data), not on every WS tick.
// ─────────────────────────────────────────────────────────────────────────────
export function PolymarketIntelligenceTab() {
  const [markets, setMarkets] = useState<PolymarketMarket[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedMarket, setSelectedMarket] = useState<PolymarketMarket | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<MarketCategory | 'All'>('All');
  const [search, setSearch] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('volume');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [showOnboarding, setShowOnboarding] = useState(false);


  const { status: sessionStatus, placeOrder, eoaAddress, safeAddress } = usePolymarketSession();
  const handleNeedOnboarding = useCallback(() => setShowOnboarding(true), []);

  const loadMarkets = useCallback(() => {
    setLoading(true);
    setError(null);
    fetchMarkets({ limit: 300 })
      .then((data) => {
        if (data.length === 0) {
          setError('No markets returned — is the backend running?');
        } else {
          setMarkets(data);
          if (!selectedMarket) setSelectedMarket(data[0]);
        }
      })
      .catch(() => setError('Failed to load markets'))
      .finally(() => setLoading(false));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { loadMarkets(); }, [loadMarkets]);

  const filtered = useMemo(() => {
    let list = markets;
    if (selectedCategory !== 'All') list = list.filter(m => m.category === selectedCategory);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(m => m.question.toLowerCase().includes(q) || m.category.toLowerCase().includes(q));
    }
    if (sortKey) {
      list = [...list].sort((a, b) => {
        let va = 0, vb = 0;
        if (sortKey === 'yesPrice') {
          // Use static market outcome price (live prices live in VirtualMarketList)
          va = a.outcomes.find(o => o.name === 'Yes')?.price ?? 0.5;
          vb = b.outcomes.find(o => o.name === 'Yes')?.price ?? 0.5;
        } else if (sortKey === 'volume') {
          va = a.volume24h; vb = b.volume24h;
        } else if (sortKey === 'liquidity') {
          va = a.liquidity; vb = b.liquidity;
        } else if (sortKey === 'closes') {
          va = new Date(a.endDate).getTime(); vb = new Date(b.endDate).getTime();
        }
        return sortDir === 'asc' ? va - vb : vb - va;
      });
    }
    return list;
  }, [markets, selectedCategory, search, sortKey, sortDir]);

  const totalVolume = useMemo(() => markets.reduce((s, m) => s + m.volume24h, 0), [markets]);
  const totalLiquidity = useMemo(() => markets.reduce((s, m) => s + m.liquidity, 0), [markets]);
  const topMover = useMemo(
    () => [...markets].sort((a, b) => Math.abs(b.priceChange24h) - Math.abs(a.priceChange24h))[0],
    [markets],
  );

  const handleSelectMarket = useCallback((market: PolymarketMarket) => setSelectedMarket(market), []);

  const handleSort = useCallback((key: SortKey) => {
    setSortKey(prev => {
      if (prev === key) return prev; // direction toggled separately
      return key;
    });
    setSortDir(prev => {
      if (sortKey === key) return prev === 'asc' ? 'desc' : 'asc';
      return 'desc';
    });
  }, [sortKey]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden', height: 'calc(100vh - 40px)' }}>

      {/* ── Stats strip ── */}
      <div
        style={{
          display: 'flex',
          borderBottom: '1px solid var(--border)',
          backgroundColor: 'var(--bg-elevated)',
          flexShrink: 0,
        }}
      >
        {loading ? (
          <div className="flex items-center gap-8 px-4 py-2">
            {[1,2,3,4].map(i => (
              <div key={i} className="h-4 w-24 skeleton" />
            ))}
          </div>
        ) : (
          <>
            <StatMetric label="Vol 24h" value={fmt(totalVolume)} />
            <div style={{ width: 1, backgroundColor: 'var(--border)', alignSelf: 'stretch' }} />
            <StatMetric label="Active Markets" value={String(markets.filter(m => m.active).length)} />
            <div style={{ width: 1, backgroundColor: 'var(--border)', alignSelf: 'stretch' }} />
            <StatMetric label="Total Liquidity" value={fmt(totalLiquidity)} />
            <div style={{ width: 1, backgroundColor: 'var(--border)', alignSelf: 'stretch' }} />
            {topMover && (
              <StatMetric
                label="Top Mover"
                value={`${topMover.priceChange24h >= 0 ? '+' : ''}${(topMover.priceChange24h * 100).toFixed(1)}%`}
                sub={topMover.question.slice(0, 30) + '…'}
                color={topMover.priceChange24h >= 0 ? '#22c55e' : '#ef4444'}
                icon={topMover.priceChange24h >= 0 ? TrendingUp : TrendingDown}
              />
            )}
            <div className="flex-1" />
            <div style={{ width: 1, backgroundColor: 'var(--border)', alignSelf: 'stretch' }} />
            <button
              onClick={loadMarkets}
              className="flex items-center gap-1 px-3 transition-colors"
              style={{ color: 'var(--text-tertiary)' }}
              title="Refresh"
              onMouseEnter={e => (e.currentTarget.style.color = 'var(--accent)')}
              onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-tertiary)')}
            >
              <RefreshCw className={`h-3 w-3 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </>
        )}
      </div>

      {/* ── Filter bar ── */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '6px 10px',
          borderBottom: '1px solid var(--border)',
          backgroundColor: 'var(--bg)',
          flexShrink: 0,
          flexWrap: 'wrap',
        }}
      >
        <div style={{ position: 'relative', flex: '0 0 220px' }}>
          <Search
            className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3"
            style={{ color: 'var(--text-tertiary)', pointerEvents: 'none' }}
          />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Filter markets…"
            className="w-full font-mono text-[11px] focus:outline-none"
            style={{
              paddingLeft: 24,
              paddingRight: 8,
              paddingTop: 4,
              paddingBottom: 4,
              backgroundColor: 'var(--bg-elevated)',
              border: '1px solid var(--border)',
              color: 'var(--text)',
            }}
            onFocus={e => (e.currentTarget.style.borderColor = 'var(--accent)')}
            onBlur={e => (e.currentTarget.style.borderColor = 'var(--border)')}
          />
        </div>

        <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap', alignItems: 'center' }}>
          {(['All', ...CATEGORIES] as const).map(cat => {
            const isActive = selectedCategory === cat;
            return (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat as MarketCategory | 'All')}
                className="font-mono text-[9px] font-semibold tracking-wider uppercase px-2 py-1 transition-colors"
                style={{
                  border: `1px solid ${isActive ? 'var(--accent)' : 'var(--border)'}`,
                  backgroundColor: isActive ? 'rgba(245,158,11,0.1)' : 'transparent',
                  color: isActive ? 'var(--accent)' : 'var(--text-tertiary)',
                }}
              >
                {cat}
              </button>
            );
          })}
        </div>

        <div style={{ marginLeft: 'auto' }}>
          <span className="terminal-label">{loading ? '…' : `${filtered.length} results`}</span>
        </div>
      </div>

      {/* ── Error ── */}
      {error && (
        <div
          className="flex items-center justify-between px-4 py-2"
          style={{ borderBottom: '1px solid var(--border)', backgroundColor: 'rgba(239,68,68,0.05)' }}
        >
          <span className="font-mono text-[11px]" style={{ color: '#ef4444' }}>{error}</span>
          <button
            onClick={loadMarkets}
            className="flex items-center gap-1 px-2 py-1 font-mono text-[10px] transition-colors"
            style={{ border: '1px solid var(--border)', color: 'var(--text-secondary)' }}
          >
            <RefreshCw className="h-2.5 w-2.5" /> Retry
          </button>
        </div>
      )}

      <OnboardingFlow open={showOnboarding} onClose={() => setShowOnboarding(false)} />

      {/* ── Full-screen detail view ── */}
      {selectedMarket ? (
        <div style={{ flex: 1, overflow: 'hidden', minHeight: 0, backgroundColor: 'var(--bg)' }}>
          <MarketDetailView
            market={selectedMarket}
            onBack={() => setSelectedMarket(null)}
            sessionStatus={sessionStatus}
            placeOrder={placeOrder}
            eoaAddress={eoaAddress}
            safeAddress={safeAddress}
            onNeedOnboarding={handleNeedOnboarding}
          />
        </div>
      ) : (
        <VirtualMarketList
          filtered={filtered}
          loading={loading}
          markets={markets}
          sortKey={sortKey}
          sortDir={sortDir}
          onSort={handleSort}
          onSelectMarket={handleSelectMarket}
          sessionStatus={sessionStatus}
          placeOrder={placeOrder}
          eoaAddress={eoaAddress}
          safeAddress={safeAddress}
          onNeedOnboarding={handleNeedOnboarding}
        />
      )}
    </div>
  );
}


function StatMetric({
  label,
  value,
  sub,
  color,
  icon: Icon,
}: {
  label: string;
  value: string;
  sub?: string;
  color?: string;
  icon?: React.ElementType;
}) {
  return (
    <div className="flex items-center gap-3 px-4 py-2">
      {Icon && <Icon className="h-3 w-3 shrink-0" style={{ color: color ?? 'var(--text-tertiary)' }} />}
      <div>
        <div className="terminal-label">{label}</div>
        <div
          className="metric text-[13px] font-bold leading-tight"
          style={{ color: color ?? 'var(--text)' }}
        >
          {value}
        </div>
        {sub && (
          <div className="font-mono text-[9px] truncate max-w-[140px]" style={{ color: 'var(--text-tertiary)' }}>
            {sub}
          </div>
        )}
      </div>
    </div>
  );
}
