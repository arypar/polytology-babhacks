'use client';

import { memo, useEffect, useRef, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import type { PolymarketMarket } from '@/lib/types';
import type { PolymarketSession } from '@/hooks/usePolymarketSession';
import { recordTrade } from '@/lib/store';

interface MarketRowProps {
  market: PolymarketMarket;
  selected?: boolean;
  onClick?: (market: PolymarketMarket) => void;
  livePrice?: { yes: number; no: number };
  index?: number;
  sessionStatus?: PolymarketSession['status'];
  placeOrder?: PolymarketSession['placeOrder'];
  eoaAddress?: PolymarketSession['eoaAddress'];
  safeAddress?: PolymarketSession['safeAddress'];
  onNeedOnboarding?: () => void;
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

type FlashDir = 'up' | 'down';

function usePriceFlash(value: number): { animKey: number; dir: FlashDir | null } {
  const prevRef = useRef(value);
  const [anim, setAnim] = useState<{ key: number; dir: FlashDir }>({ key: 0, dir: 'up' });
  const isFirstRef = useRef(true);

  useEffect(() => {
    if (isFirstRef.current) { isFirstRef.current = false; return; }
    if (prevRef.current === value) return;
    const dir: FlashDir = value > prevRef.current ? 'up' : 'down';
    prevRef.current = value;
    setAnim(a => ({ key: a.key + 1, dir }));
  }, [value]);

  return { animKey: anim.key, dir: anim.key === 0 ? null : anim.dir };
}

const TRADE_SIZE = 10;

export const MarketCard = memo(function MarketCard({
  market,
  selected,
  onClick,
  livePrice,
  index,
  sessionStatus,
  placeOrder,
  eoaAddress,
  safeAddress,
  onNeedOnboarding,
}: MarketRowProps) {
  const yes = market.outcomes.find(o => o.name === 'Yes') ?? market.outcomes[0];
  const no = market.outcomes.find(o => o.name === 'No') ?? market.outcomes[1];
  const yesPrice = livePrice?.yes ?? yes?.price ?? 0.5;
  const noPrice  = livePrice?.no  ?? no?.price  ?? 0.5;
  const catColor = CATEGORY_COLORS[market.category] ?? CATEGORY_COLORS.Other;

  const yesFlash = usePriceFlash(yesPrice);
  const noFlash  = usePriceFlash(noPrice);

  const [tradeSide, setTradeSide] = useState<'YES' | 'NO' | null>(null);
  const [bought, setBought] = useState<'YES' | 'NO' | null>(null);
  const [isTrading, setIsTrading] = useState(false);

  async function handleBuy(e: React.MouseEvent, side: 'YES' | 'NO') {
    e.stopPropagation();
    if (sessionStatus !== 'ready') { onNeedOnboarding?.(); return; }
    if (tradeSide !== side) { setTradeSide(side); return; }

    if (!placeOrder) return;
    setIsTrading(true);
    try {
      const outcome = side === 'YES' ? yes : no;
      const price = side === 'YES' ? yesPrice : noPrice;
      const tokenId = outcome?.tokenId ?? market.conditionId;
      const result = await placeOrder({ tokenId, side, price, size: TRADE_SIZE });
      if (result) {
        setBought(side);
        setTradeSide(null);
        toast.success('Order placed', {
          description: `${TRADE_SIZE} ${side} shares @ ${Math.round(price * 100)}¢`,
        });
        if (eoaAddress) {
          recordTrade({
            orderId: result.orderId,
            eoaAddress,
            safeAddress: safeAddress ?? undefined,
            marketId: market.conditionId,
            marketQuestion: market.question,
            tokenId,
            side,
            price,
            size: TRADE_SIZE,
          });
        }
      }
    } catch (err) {
      toast.error('Order failed', { description: err instanceof Error ? err.message : String(err) });
    } finally {
      setIsTrading(false);
    }
  }

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
      <td className="metric text-[10px] pl-3 pr-2" style={{ color: 'var(--text-tertiary)', width: 48 }}>
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
        <span className="font-mono text-[10px]" style={{ color: catColor }}>
          {market.category}
        </span>
      </td>

      {/* YES price */}
      <td style={{ width: 54 }}>
        <span
          key={yesFlash.animKey}
          className={cn(
            'metric text-[12px] font-semibold',
            yesFlash.dir === 'up' && 'price-glow-up',
            yesFlash.dir === 'down' && 'price-glow-down',
          )}
          style={{ color: '#22c55e' }}
        >
          {(yesPrice * 100).toFixed(1)}¢
        </span>
      </td>

      {/* NO price */}
      <td style={{ width: 54 }}>
        <span
          key={noFlash.animKey}
          className={cn(
            'metric text-[12px] font-semibold',
            noFlash.dir === 'up' && 'price-glow-up',
            noFlash.dir === 'down' && 'price-glow-down',
          )}
          style={{ color: '#ef4444' }}
        >
          {(noPrice * 100).toFixed(1)}¢
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
      <td style={{ width: 52 }}>
        <span
          className="font-mono text-[9px] font-bold tracking-wider"
          style={{ color: market.active ? '#22c55e' : 'var(--text-tertiary)' }}
        >
          {market.active ? 'Live' : 'Closed'}
        </span>
      </td>

      {/* Trade buttons */}
      <td style={{ width: 96, paddingRight: 10 }}>
        {market.active && (
          <div className="flex gap-1" onClick={e => e.stopPropagation()}>
            <button
              disabled={isTrading}
              onClick={e => handleBuy(e, 'YES')}
              className="font-mono text-[9px] font-bold px-2 py-1 transition-colors disabled:opacity-40"
              style={
                bought === 'YES'
                  ? { backgroundColor: '#22c55e', color: '#000' }
                  : tradeSide === 'YES'
                  ? { backgroundColor: 'rgba(34,197,94,0.2)', color: '#22c55e', border: '1px solid #22c55e' }
                  : { backgroundColor: 'rgba(34,197,94,0.08)', color: '#22c55e', border: '1px solid rgba(34,197,94,0.2)' }
              }
            >
              {isTrading && tradeSide === 'YES'
                ? <Loader2 className="inline h-2.5 w-2.5 animate-spin" />
                : bought === 'YES' ? '✓ YES'
                : tradeSide === 'YES' ? 'Confirm'
                : 'YES'
              }
            </button>
            <button
              disabled={isTrading}
              onClick={e => handleBuy(e, 'NO')}
              className="font-mono text-[9px] font-bold px-2 py-1 transition-colors disabled:opacity-40"
              style={
                bought === 'NO'
                  ? { backgroundColor: '#ef4444', color: '#000' }
                  : tradeSide === 'NO'
                  ? { backgroundColor: 'rgba(239,68,68,0.2)', color: '#ef4444', border: '1px solid #ef4444' }
                  : { backgroundColor: 'rgba(239,68,68,0.08)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.2)' }
              }
            >
              {isTrading && tradeSide === 'NO'
                ? <Loader2 className="inline h-2.5 w-2.5 animate-spin" />
                : bought === 'NO' ? '✓ NO'
                : tradeSide === 'NO' ? 'Confirm'
                : 'NO'
              }
            </button>
          </div>
        )}
      </td>
    </tr>
  );
}, (prev, next) =>
  prev.market === next.market &&
  prev.selected === next.selected &&
  prev.onClick === next.onClick &&
  prev.livePrice === next.livePrice &&
  prev.sessionStatus === next.sessionStatus &&
  prev.placeOrder === next.placeOrder &&
  prev.eoaAddress === next.eoaAddress &&
  prev.safeAddress === next.safeAddress &&
  prev.onNeedOnboarding === next.onNeedOnboarding
  // `index` intentionally excluded — row reordering shouldn't trigger re-render
);
