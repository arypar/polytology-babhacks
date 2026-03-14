'use client';

import { useState, useMemo } from 'react';
import { Search, TrendingUp, TrendingDown, Activity, DollarSign, BarChart3, Filter } from 'lucide-react';
import { MarketCard } from './MarketCard';
import { MarketChart } from './MarketChart';
import { MOCK_MARKETS, CATEGORIES } from '@/lib/polymarket-data';
import type { PolymarketMarket, MarketCategory } from '@/lib/types';
import { cn } from '@/lib/utils';

function StatCard({ label, value, sub, icon: Icon }: {
  label: string;
  value: string;
  sub?: string;
  icon: React.ElementType;
}) {
  return (
    <div className="rounded-lg border border-white/[0.08] bg-[#0D0D14] p-4">
      <div className="flex items-center justify-between mb-3">
        <span className="text-[11px] font-medium text-white/40">{label}</span>
        <Icon className="h-4 w-4 text-white/20" />
      </div>
      <div className="text-[22px] font-bold text-white tracking-tight">{value}</div>
      {sub && <div className="text-[11px] text-white/35 mt-1">{sub}</div>}
    </div>
  );
}

export function PolymarketIntelligenceTab() {
  const [selectedMarket, setSelectedMarket] = useState<PolymarketMarket | null>(MOCK_MARKETS[0]);
  const [selectedCategory, setSelectedCategory] = useState<MarketCategory | 'All'>('All');
  const [search, setSearch] = useState('');

  const filtered = useMemo(() => {
    let markets = MOCK_MARKETS;
    if (selectedCategory !== 'All') {
      markets = markets.filter(m => m.category === selectedCategory);
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      markets = markets.filter(m =>
        m.question.toLowerCase().includes(q) ||
        m.category.toLowerCase().includes(q) ||
        m.tags?.some(t => t.toLowerCase().includes(q))
      );
    }
    return markets;
  }, [selectedCategory, search]);

  const topMovers = useMemo(() =>
    [...MOCK_MARKETS]
      .sort((a, b) => Math.abs(b.priceChange24h) - Math.abs(a.priceChange24h))
      .slice(0, 4),
    []
  );

  const totalVolume = MOCK_MARKETS.reduce((s, m) => s + m.volume24h, 0);
  const totalLiquidity = MOCK_MARKETS.reduce((s, m) => s + m.liquidity, 0);

  function fmt(n: number) {
    if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
    if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`;
    return `$${n}`;
  }

  return (
    <div className="space-y-8">
      {/* Stats bar */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard label="24h Volume" value={fmt(totalVolume)} sub="across all markets" icon={DollarSign} />
        <StatCard label="Active Markets" value={String(MOCK_MARKETS.filter(m => m.active).length)} sub="live prediction markets" icon={Activity} />
        <StatCard label="Total Liquidity" value={fmt(totalLiquidity)} sub="market depth" icon={BarChart3} />
        <StatCard
          label="Top Mover"
          value={`${topMovers[0]?.priceChange24h >= 0 ? '+' : ''}${(topMovers[0]?.priceChange24h * 100).toFixed(1)}pp`}
          sub={topMovers[0]?.question.slice(0, 24) + '…'}
          icon={topMovers[0]?.priceChange24h >= 0 ? TrendingUp : TrendingDown}
        />
      </div>

      {/* Top Movers */}
      <div>
        <div className="flex items-center justify-between pb-3 border-b border-white/[0.06] mb-4">
          <h2 className="text-[15px] font-semibold text-white">Top Movers 24h</h2>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          {topMovers.map(m => {
            const yes = m.outcomes.find(o => o.name === 'Yes') ?? m.outcomes[0];
            const isUp = m.priceChange24h >= 0;
            return (
              <button
                key={m.id}
                onClick={() => setSelectedMarket(m)}
                className={cn(
                  'text-left rounded-lg border p-3 transition-colors',
                  selectedMarket?.id === m.id
                    ? 'border-primary/40 bg-primary/[0.05]'
                    : 'border-white/[0.08] bg-[#0D0D14] hover:border-white/[0.14]'
                )}
              >
                <p className="text-[11px] text-white/55 line-clamp-2 leading-[1.4] mb-2.5">{m.question}</p>
                <div className="flex items-center justify-between">
                  <span className="text-[15px] font-bold text-white">{((yes?.price ?? 0.5) * 100).toFixed(0)}%</span>
                  <span className={cn('text-[11px] font-semibold', isUp ? 'text-yes' : 'text-no')}>
                    {isUp ? '+' : ''}{(m.priceChange24h * 100).toFixed(1)}pp
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Selected market chart */}
      {selectedMarket && (
        <div>
          <div className="flex items-center justify-between pb-3 border-b border-white/[0.06] mb-4">
            <h2 className="text-[15px] font-semibold text-white">Market Detail</h2>
            <span className="text-[12px] text-white/40 truncate max-w-[60%]">{selectedMarket.question}</span>
          </div>
          <MarketChart market={selectedMarket} />
        </div>
      )}

      {/* Category filters + search */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-white/25" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search markets…"
            className="w-full rounded-md border border-white/[0.08] bg-[#0D0D14] pl-9 pr-4 py-2 text-[13px] text-white placeholder:text-white/25 focus:outline-none focus:border-primary/40 transition-colors"
          />
        </div>
        <div className="flex items-center gap-1.5 flex-wrap">
          <Filter className="h-3.5 w-3.5 text-white/25 mr-0.5" />
          {(['All', ...CATEGORIES] as const).map(cat => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat as MarketCategory | 'All')}
              className={cn(
                'px-2.5 py-1 rounded-md text-[12px] font-medium transition-colors border',
                selectedCategory === cat
                  ? 'bg-primary/15 text-primary border-primary/30'
                  : 'text-white/40 border-white/[0.06] hover:text-white/65 hover:border-white/[0.1]'
              )}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Markets grid */}
      <div>
        <div className="flex items-center justify-between pb-3 border-b border-white/[0.06] mb-4">
          <h2 className="text-[15px] font-semibold text-white">Markets</h2>
          <span className="text-[12px] text-white/30">{filtered.length} results</span>
        </div>
        {filtered.length === 0 ? (
          <div className="rounded-lg border border-white/[0.08] bg-[#0D0D14] p-12 text-center">
            <p className="text-white/30 text-[14px]">No markets match your filters.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {filtered.map(market => (
              <MarketCard
                key={market.id}
                market={market}
                selected={selectedMarket?.id === market.id}
                onClick={() => setSelectedMarket(market)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
