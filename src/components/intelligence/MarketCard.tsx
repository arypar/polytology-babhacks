'use client';

import { memo, useEffect, useRef, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import type { PolymarketMarket } from '@/lib/types';
import type { PolymarketSession } from '@/hooks/usePolymarketSession';
import { recordTrade } from '@/lib/store';
import { GRID_COLS, ROW_HEIGHT } from './PolymarketIntelligenceTab';

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
  const [tradeAmount, setTradeAmount] = useState('10');
  const [bought, setBought] = useState<'YES' | 'NO' | null>(null);
  const [isTrading, setIsTrading] = useState(false);

  function handleSideClick(e: React.MouseEvent, side: 'YES' | 'NO') {
    e.stopPropagation();
    if (sessionStatus !== 'ready') { onNeedOnboarding?.(); return; }
    if (tradeSide === side) {
      setTradeSide(null);
    } else {
      setTradeSide(side);
      setTradeAmount('10');
    }
  }

  async function handleBuy(e: React.MouseEvent) {
    e.stopPropagation();
    if (!placeOrder || !tradeSide) return;
    const size = parseFloat(tradeAmount);
    if (!size || size <= 0) { toast.error('Enter a valid amount'); return; }

    setIsTrading(true);
    try {
      const side = tradeSide;
      const outcome = side === 'YES' ? yes : no;
      const price = side === 'YES' ? yesPrice : noPrice;
      const tokenId = outcome?.tokenId ?? market.conditionId;
      const result = await placeOrder({ tokenId, side, price, size });
      if (result) {
        setBought(side);
        setTradeSide(null);
        toast.success('Order placed', {
          description: `$${size} ${side} @ ${Math.round(price * 100)}¢`,
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
            size,
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
    <div
      onClick={() => onClick?.(market)}
      className={cn('market-row', selected && 'row-selected')}
      style={{
        display: 'grid',
        gridTemplateColumns: GRID_COLS,
        height: ROW_HEIGHT,
        borderLeft: selected ? '2px solid var(--accent)' : '2px solid transparent',
      }}
    >
      {/* Row num */}
      <div className="market-cell metric text-[10px]" style={{ color: 'var(--text-tertiary)', paddingLeft: 10 }}>
        {index !== undefined ? index + 1 : ''}
      </div>

      {/* Market question */}
      <div className="market-cell" style={{ overflow: 'hidden' }}>
        <div className="flex items-center gap-2 min-w-0">
          {livePrice && (
            <span
              className="inline-block h-1.5 w-1.5 rounded-full shrink-0"
              style={{ backgroundColor: '#22c55e', boxShadow: '0 0 4px #22c55e' }}
            />
          )}
          <span
            className="text-[12px] truncate"
            style={{ color: 'var(--text)' }}
            title={market.question}
          >
            {market.question}
          </span>
        </div>
      </div>

      {/* Category */}
      <div className="market-cell">
        <span className="font-mono text-[10px]" style={{ color: catColor }}>
          {market.category}
        </span>
      </div>

      {/* YES price */}
      <div className="market-cell">
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
      </div>

      {/* NO price */}
      <div className="market-cell">
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
      </div>

      {/* Vol 24H */}
      <div className="market-cell">
        <span className="metric text-[11px]" style={{ color: 'var(--text-secondary)' }}>
          {formatVolume(market.volume24h)}
        </span>
      </div>

      {/* Liquidity */}
      <div className="market-cell">
        <span className="metric text-[11px]" style={{ color: 'var(--text-secondary)' }}>
          {formatVolume(market.liquidity)}
        </span>
      </div>

      {/* Closes */}
      <div className="market-cell">
        <span className="metric text-[11px]" style={{ color: 'var(--text-tertiary)' }}>
          {formatDate(market.endDate)}
        </span>
      </div>

      {/* Status */}
      <div className="market-cell">
        <span
          className="font-mono text-[9px] font-bold tracking-wider"
          style={{ color: market.active ? '#22c55e' : 'var(--text-tertiary)' }}
        >
          {market.active ? 'Live' : 'Closed'}
        </span>
      </div>

      {/* Trade buttons */}
      <div className="market-cell" style={{ paddingRight: 10, overflow: 'visible' }} onClick={e => e.stopPropagation()}>
        {market.active && (
          <div className="flex gap-1 items-center">
            {tradeSide ? (
              <>
                <span className="font-mono text-[9px] font-bold" style={{ color: tradeSide === 'YES' ? '#22c55e' : '#ef4444' }}>
                  {tradeSide}
                </span>
                <span className="font-mono text-[9px]" style={{ color: 'var(--text-tertiary)' }}>$</span>
                <input
                  autoFocus
                  type="number"
                  min="1"
                  value={tradeAmount}
                  onChange={e => setTradeAmount(e.target.value)}
                  onClick={e => e.stopPropagation()}
                  onKeyDown={e => { if (e.key === 'Enter') handleBuy(e as unknown as React.MouseEvent); if (e.key === 'Escape') setTradeSide(null); }}
                  className="font-mono text-[9px] font-bold w-12 px-1 py-0.5 bg-transparent border outline-none"
                  style={{ color: 'var(--text)', borderColor: tradeSide === 'YES' ? '#22c55e' : '#ef4444' }}
                />
                <button
                  disabled={isTrading}
                  onClick={handleBuy}
                  className="font-mono text-[9px] font-bold px-2 py-1 transition-colors disabled:opacity-40"
                  style={tradeSide === 'YES'
                    ? { backgroundColor: 'rgba(34,197,94,0.2)', color: '#22c55e', border: '1px solid #22c55e' }
                    : { backgroundColor: 'rgba(239,68,68,0.2)', color: '#ef4444', border: '1px solid #ef4444' }
                  }
                >
                  {isTrading ? <Loader2 className="inline h-2.5 w-2.5 animate-spin" /> : 'OK'}
                </button>
                <button
                  onClick={e => { e.stopPropagation(); setTradeSide(null); }}
                  className="font-mono text-[9px] px-1 py-1 transition-colors"
                  style={{ color: 'var(--text-tertiary)' }}
                >✕</button>
              </>
            ) : (
              <>
                <button
                  disabled={isTrading}
                  onClick={e => handleSideClick(e, 'YES')}
                  className="font-mono text-[9px] font-bold px-2 py-1 transition-colors disabled:opacity-40"
                  style={
                    bought === 'YES'
                      ? { backgroundColor: '#22c55e', color: '#000' }
                      : { backgroundColor: 'rgba(34,197,94,0.08)', color: '#22c55e', border: '1px solid rgba(34,197,94,0.2)' }
                  }
                >
                  {bought === 'YES' ? '✓ YES' : 'YES'}
                </button>
                <button
                  disabled={isTrading}
                  onClick={e => handleSideClick(e, 'NO')}
                  className="font-mono text-[9px] font-bold px-2 py-1 transition-colors disabled:opacity-40"
                  style={
                    bought === 'NO'
                      ? { backgroundColor: '#ef4444', color: '#000' }
                      : { backgroundColor: 'rgba(239,68,68,0.08)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.2)' }
                  }
                >
                  {bought === 'NO' ? '✓ NO' : 'NO'}
                </button>
              </>
            )}
          </div>
        )}
      </div>
    </div>
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
);
