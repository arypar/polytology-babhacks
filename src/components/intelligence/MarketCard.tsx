'use client';

import { memo } from 'react';
import { TrendingUp, TrendingDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { PolymarketMarket } from '@/lib/types';

interface MarketRowProps {
  market: PolymarketMarket;
  selected?: boolean;
  onClick?: (market: PolymarketMarket) => void;
  livePrice?: { yes: number; no: number };
  index?: number;
}

function formatVolume(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`;
  return `$${n}`;
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' });
}

const CATEGORY_COLORS: Record<string, string> = {
  Politics:      '#ef4444',
  Crypto:        '#3b82f6',
  Sports:        '#f97316',
  Business:      '#22d3ee',
  Science:       '#a78bfa',
  World:         '#3b82f6',
  Entertainment: '#f472b6',
  Other:         '#6b7280',
};

export const MarketCard = memo(function MarketCard({ market, selected, onClick, livePrice, index }: MarketRowProps) {
  const yes = market.outcomes.find(o => o.name === 'Yes') ?? market.outcomes[0];
  const no = market.outcomes.find(o => o.name === 'No') ?? market.outcomes[1];
  const yesPrice = livePrice?.yes ?? yes?.price ?? 0.5;
  const noPrice  = livePrice?.no  ?? no?.price  ?? 0.5;
  const change = market.priceChange24h;
  const isUp = change >= 0;
  const catColor = CATEGORY_COLORS[market.category] ?? CATEGORY_COLORS.Other;

  return (
    <tr
      onClick={() => onClick?.(market)}
      className={cn(selected && 'row-selected')}
      style={{
        borderLeft: selected ? '2px solid var(--accent)' : '2px solid transparent',
        cursor: 'pointer',
      }}
    >
      {/* Row num */}
      <td
        className="metric text-[10px] pl-3 pr-2"
        style={{ color: 'var(--text-tertiary)', width: 32 }}
      >
        {index !== undefined ? index + 1 : ''}
      </td>

      {/* Market question */}
      <td style={{ maxWidth: 320 }}>
        <div className="flex items-center gap-2">
          {livePrice && (
            <span
              className="inline-block h-1.5 w-1.5 rounded-full shrink-0"
              style={{ backgroundColor: '#22c55e', boxShadow: '0 0 4px #22c55e' }}
            />
          )}
          <span
            className="text-[12px] truncate block"
            style={{ color: 'var(--text)' }}
            title={market.question}
          >
            {market.question}
          </span>
        </div>
      </td>

      {/* Category */}
      <td style={{ width: 80 }}>
        <span
          className="font-mono text-[10px]"
          style={{ color: catColor }}
        >
          {market.category}
        </span>
      </td>

      {/* YES price */}
      <td style={{ width: 54 }}>
        <span
          className="metric text-[12px] font-semibold"
          style={{ color: '#22c55e' }}
        >
          {(yesPrice * 100).toFixed(1)}¢
        </span>
      </td>

      {/* NO price */}
      <td style={{ width: 54 }}>
        <span
          className="metric text-[12px] font-semibold"
          style={{ color: '#ef4444' }}
        >
          {(noPrice * 100).toFixed(1)}¢
        </span>
      </td>

      {/* Δ24H */}
      <td style={{ width: 64 }}>
        <span
          className="metric text-[11px] font-semibold flex items-center gap-0.5"
          style={{ color: isUp ? '#22c55e' : '#ef4444' }}
        >
          {isUp ? <TrendingUp className="h-2.5 w-2.5" /> : <TrendingDown className="h-2.5 w-2.5" />}
          {isUp ? '+' : ''}{(change * 100).toFixed(1)}
        </span>
      </td>

      {/* Vol 24H */}
      <td style={{ width: 72 }}>
        <span className="metric text-[11px]" style={{ color: 'var(--text-secondary)' }}>
          {formatVolume(market.volume24h)}
        </span>
      </td>

      {/* Liquidity */}
      <td style={{ width: 72 }}>
        <span className="metric text-[11px]" style={{ color: 'var(--text-secondary)' }}>
          {formatVolume(market.liquidity)}
        </span>
      </td>

      {/* Closes */}
      <td style={{ width: 72 }}>
        <span className="metric text-[11px]" style={{ color: 'var(--text-tertiary)' }}>
          {formatDate(market.endDate)}
        </span>
      </td>

      {/* Status */}
      <td style={{ width: 52, paddingRight: 12 }}>
        <span
          className="font-mono text-[9px] font-bold tracking-wider"
          style={{ color: market.active ? '#22c55e' : 'var(--text-tertiary)' }}
        >
          {market.active ? 'Live' : 'Closed'}
        </span>
      </td>
    </tr>
  );
});
