'use client';

import { useState, useMemo, useEffect, useCallback } from 'react';
import { Search, RefreshCw, TrendingUp, TrendingDown, ChevronUp, ChevronDown } from 'lucide-react';
import { MarketCard } from './MarketCard';
import { MarketDetailView } from './MarketDetailView';
import { fetchMarkets, CATEGORIES } from '@/lib/polymarket-data';
import type { PolymarketMarket, MarketCategory } from '@/lib/types';
import { useLivePricesCtx } from '@/lib/LivePricesContext';

type SortKey = 'yesPrice' | 'change' | 'volume' | 'liquidity' | 'closes' | null;
type SortDir = 'asc' | 'desc';

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

export function PolymarketIntelligenceTab() {
  const [markets, setMarkets] = useState<PolymarketMarket[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedMarket, setSelectedMarket] = useState<PolymarketMarket | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<MarketCategory | 'All'>('All');
  const [search, setSearch] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>(null);
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const livePrices = useLivePricesCtx();

  const loadMarkets = useCallback(() => {
    setLoading(true);
    setError(null);
    fetchMarkets({ limit: 1000 })
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

  // Only pass livePrices as a dep when we're actually sorting by price —
  // this prevents the full filter+sort from recomputing on every WS tick
  const lpForSort = sortKey === 'yesPrice' ? livePrices : null;

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
          va = lpForSort?.[a.conditionId]?.yes ?? a.outcomes.find(o => o.name === 'Yes')?.price ?? 0.5;
          vb = lpForSort?.[b.conditionId]?.yes ?? b.outcomes.find(o => o.name === 'Yes')?.price ?? 0.5;
        } else if (sortKey === 'change') {
          va = a.priceChange24h; vb = b.priceChange24h;
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
  }, [markets, selectedCategory, search, sortKey, sortDir, lpForSort]);

  const totalVolume = useMemo(() => markets.reduce((s, m) => s + m.volume24h, 0), [markets]);
  const totalLiquidity = useMemo(() => markets.reduce((s, m) => s + m.liquidity, 0), [markets]);
  const topMover = useMemo(
    () => [...markets].sort((a, b) => Math.abs(b.priceChange24h) - Math.abs(a.priceChange24h))[0],
    [markets],
  );

  const handleSelectMarket = useCallback((market: PolymarketMarket) => setSelectedMarket(market), []);

  function handleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortDir('desc');
    }
  }

  const thStyle: React.CSSProperties = { cursor: 'pointer', userSelect: 'none' };

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
        {/* Search */}
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

        {/* Category toggles */}
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

      {/* ── Full-screen detail view ── */}
      {selectedMarket ? (
        <div style={{ flex: 1, overflow: 'auto', backgroundColor: 'var(--bg)' }}>
          <MarketDetailView
            market={selectedMarket}
            onBack={() => setSelectedMarket(null)}
          />
        </div>
      ) : (
        /* ── Market table (selector) ── */
        <div style={{ flex: 1, overflow: 'auto' }}>
          <table className="terminal-table" style={{ width: '100%' }}>
            <thead>
              <tr>
                <th style={{ width: 32 }}>#</th>
                <th>Market</th>
                <th style={{ width: 80 }}>Category</th>
                <th style={{ ...thStyle, width: 54 }} onClick={() => handleSort('yesPrice')}>
                  Yes <SortIcon col="yesPrice" sortKey={sortKey} sortDir={sortDir} />
                </th>
                <th style={{ width: 54 }}>No</th>
                <th style={{ ...thStyle, width: 64 }} onClick={() => handleSort('change')}>
                  Δ 24h <SortIcon col="change" sortKey={sortKey} sortDir={sortDir} />
                </th>
                <th style={{ ...thStyle, width: 72 }} onClick={() => handleSort('volume')}>
                  Vol 24h <SortIcon col="volume" sortKey={sortKey} sortDir={sortDir} />
                </th>
                <th style={{ ...thStyle, width: 72 }} onClick={() => handleSort('liquidity')}>
                  Liquidity <SortIcon col="liquidity" sortKey={sortKey} sortDir={sortDir} />
                </th>
                <th style={{ ...thStyle, width: 72 }} onClick={() => handleSort('closes')}>
                  Closes <SortIcon col="closes" sortKey={sortKey} sortDir={sortDir} />
                </th>
                <th style={{ width: 60 }}>Status</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 12 }).map((_, i) => (
                  <tr key={i}>
                    {Array.from({ length: 10 }).map((__, j) => (
                      <td key={j}>
                        <div className="skeleton h-3 w-full" style={{ opacity: 0.5 }} />
                      </td>
                    ))}
                  </tr>
                ))
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={10} className="text-center py-12">
                    <span className="terminal-label">
                      {markets.length === 0 ? 'Backend not responding' : 'No results'}
                    </span>
                  </td>
                </tr>
              ) : (
                filtered.map((market, idx) => (
                  <MarketCard
                    key={market.id}
                    market={market}
                    selected={false}
                    onClick={handleSelectMarket}
                    livePrice={livePrices[market.conditionId]}
                    index={idx}
                  />
                ))
              )}
            </tbody>
          </table>
        </div>
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
