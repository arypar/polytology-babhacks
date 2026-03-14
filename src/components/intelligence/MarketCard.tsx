'use client';

import { TrendingUp, TrendingDown, DollarSign, Calendar } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { PolymarketMarket } from '@/lib/types';

interface MarketCardProps {
  market: PolymarketMarket;
  selected?: boolean;
  onClick?: () => void;
}

function formatVolume(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`;
  return `$${n}`;
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

const CATEGORY_BADGE: Record<string, { bg: string; text: string; border: string }> = {
  Politics:      { bg: 'bg-red-50',    text: 'text-red-700',    border: 'border-red-200' },
  Crypto:        { bg: 'bg-blue-50',   text: 'text-blue-700',   border: 'border-blue-200' },
  Sports:        { bg: 'bg-orange-50', text: 'text-orange-700', border: 'border-orange-200' },
  Business:      { bg: 'bg-sky-50',    text: 'text-sky-700',    border: 'border-sky-200' },
  Science:       { bg: 'bg-purple-50', text: 'text-purple-700', border: 'border-purple-200' },
  World:         { bg: 'bg-yellow-50', text: 'text-yellow-700', border: 'border-yellow-200' },
  Entertainment: { bg: 'bg-pink-50',   text: 'text-pink-700',   border: 'border-pink-200' },
  Other:         { bg: 'bg-gray-100',  text: 'text-gray-600',   border: 'border-gray-200' },
};

export function MarketCard({ market, selected, onClick }: MarketCardProps) {
  const yes = market.outcomes.find(o => o.name === 'Yes') ?? market.outcomes[0];
  const no = market.outcomes.find(o => o.name === 'No') ?? market.outcomes[1];
  const yesPrice = yes?.price ?? 0.5;
  const noPrice = no?.price ?? 0.5;
  const change = market.priceChange24h;
  const isUp = change >= 0;
  const badge = CATEGORY_BADGE[market.category] ?? CATEGORY_BADGE.Other;

  return (
    <button
      onClick={onClick}
      className={cn(
        'group w-full cursor-pointer text-left rounded-md border p-4 transition-all duration-150',
        selected
          ? 'border-[var(--accent)] ring-1 ring-[var(--accent)]/20 bg-[var(--bg-card)]'
          : 'border-[var(--border)] bg-[var(--bg-card)] hover:bg-[var(--bg-elevated)] hover:border-[var(--border-strong)]'
      )}
      style={selected ? { boxShadow: '0 2px 8px rgba(139,92,246,0.08)' } : undefined}
    >
      {/* Category badge + price change */}
      <div className="flex items-start justify-between gap-2 mb-3">
        <span
          className={cn(
            'inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-medium rounded border',
            badge.bg, badge.text, badge.border
          )}
        >
          {market.category}
        </span>
        <span
          className={cn(
            'flex items-center gap-1 text-[11px] font-semibold shrink-0',
            isUp ? 'text-emerald-600' : 'text-red-600'
          )}
        >
          {isUp ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
          {isUp ? '+' : ''}{(change * 100).toFixed(1)}pp
        </span>
      </div>

      {/* Question */}
      <p
        className="text-[13px] font-medium leading-[1.45] line-clamp-2 mb-4"
        style={{ color: 'var(--text)' }}
      >
        {market.question}
      </p>

      {/* Segmented YES/NO bar */}
      <div className="mb-1">
        <div
          className="relative h-2 w-full rounded-full overflow-hidden"
          style={{ backgroundColor: 'var(--bg-elevated)' }}
        >
          <div
            className="absolute inset-y-0 left-0"
            style={{
              width: `${yesPrice * 100}%`,
              backgroundColor: '#16a34a',
              transition: 'width 0.5s cubic-bezier(0.4,0,0.2,1)',
            }}
          />
          <div
            className="absolute inset-y-0 right-0"
            style={{
              width: `${noPrice * 100}%`,
              backgroundColor: '#dc2626',
              transition: 'width 0.5s cubic-bezier(0.4,0,0.2,1)',
            }}
          />
        </div>
        <div className="flex justify-between text-[11px] mt-1.5">
          <span className="font-semibold text-emerald-600">YES {(yesPrice * 100).toFixed(0)}¢</span>
          <span className="font-semibold text-red-600">NO {(noPrice * 100).toFixed(0)}¢</span>
        </div>
      </div>

      {/* Footer stats */}
      <div
        className="flex items-center justify-between text-[11px] mt-3 pt-3"
        style={{
          color: 'var(--text-tertiary)',
          borderTop: '1px solid var(--border)',
        }}
      >
        <div className="flex items-center gap-1">
          <DollarSign className="h-3 w-3" />
          <span>{formatVolume(market.volume24h)} 24h</span>
        </div>
        <div className="flex items-center gap-1">
          <Calendar className="h-3 w-3" />
          <span>{formatDate(market.endDate)}</span>
        </div>
      </div>
    </button>
  );
}
