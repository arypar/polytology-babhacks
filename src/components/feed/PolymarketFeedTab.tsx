'use client';

import { memo, useState, useEffect } from 'react';
import { TrendingUp, TrendingDown, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { fetchMarkets } from '@/lib/polymarket-data';
import type { PolymarketMarket } from '@/lib/types';
import { usePolymarketSession, type PolymarketSession } from '@/hooks/usePolymarketSession';
import { OnboardingFlow } from '@/components/onboarding/OnboardingFlow';
import { recordTrade } from '@/lib/store';
import { useLivePricesCtx } from '@/lib/LivePricesContext';

const CAT_COLOR: Record<string, string> = {
  Politics:      '#ef4444',
  Crypto:        '#3b82f6',
  Sports:        '#f97316',
  Business:      '#22d3ee',
  Science:       '#a78bfa',
  World:         '#3b82f6',
  Entertainment: '#f472b6',
  Other:         '#6b7280',
};

function formatVolume(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`;
  return `$${n}`;
}

function daysUntil(dateStr: string): number {
  return Math.max(0, Math.ceil((new Date(dateStr).getTime() - Date.now()) / (1000 * 60 * 60 * 24)));
}

// ── Market feed row ────────────────────────────────────────────────────────

type FeedRowProps = {
  market: PolymarketMarket;
  livePrice?: { yes: number; no: number };
  sessionStatus: PolymarketSession['status'];
  placeOrder: PolymarketSession['placeOrder'];
  eoaAddress: PolymarketSession['eoaAddress'];
  safeAddress: PolymarketSession['safeAddress'];
};

const FeedRow = memo(function FeedRow({
  market,
  livePrice,
  sessionStatus,
  placeOrder,
  eoaAddress,
  safeAddress,
}: FeedRowProps) {
  const yes = market.outcomes.find(o => o.name === 'Yes') ?? market.outcomes[0];
  const no = market.outcomes.find(o => o.name === 'No') ?? market.outcomes[1];
  const yesPrice = livePrice?.yes ?? yes?.price ?? 0.5;
  const noPrice = livePrice?.no ?? no?.price ?? 0.5;
  const change = market.priceChange24h;
  const isUp = change >= 0;
  const days = daysUntil(market.endDate);
  const catColor = CAT_COLOR[market.category] ?? '#6b7280';

  const [tradeSide, setTradeSide] = useState<'YES' | 'NO' | null>(null);
  const [bought, setBought] = useState<'YES' | 'NO' | null>(null);
  const [isTrading, setIsTrading] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);

  const tradeSize = 10;

  async function handleBuy(side: 'YES' | 'NO') {
    if (sessionStatus !== 'ready') { setShowOnboarding(true); return; }
    if (tradeSide !== side) { setTradeSide(side); return; }

    setIsTrading(true);
    try {
      const outcome = side === 'YES' ? yes : no;
      const price = side === 'YES' ? yesPrice : noPrice;
      const tokenId = outcome?.tokenId ?? market.conditionId;
      const result = await placeOrder({ tokenId, side, price, size: tradeSize });
      if (result) {
        setBought(side);
        setTradeSide(null);
        toast.success('Order placed', {
          description: `${tradeSize} ${side} shares @ ${Math.round(price * 100)}¢`,
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
            size: tradeSize,
          });
        }
      }
    } catch (e) {
      toast.error('Order failed', { description: e instanceof Error ? e.message : String(e) });
    } finally {
      setIsTrading(false);
    }
  }

  return (
    <>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          padding: '7px 14px',
          gap: 10,
          borderBottom: '1px solid rgba(255,255,255,0.05)',
          cursor: 'default',
        }}
        onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'var(--bg-row-hover)')}
        onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
      >
        {/* Category dot */}
        <div
          style={{
            width: 6,
            height: 6,
            borderRadius: '50%',
            backgroundColor: catColor,
            flexShrink: 0,
          }}
        />

        {/* Category label */}
        <span
          className="font-mono text-[10px] shrink-0 hidden sm:inline"
          style={{ color: catColor, minWidth: 72 }}
        >
          {market.category}
        </span>

        {/* Live dot */}
        {livePrice && (
          <span
            style={{
              display: 'inline-block',
              width: 5,
              height: 5,
              borderRadius: '50%',
              backgroundColor: '#22c55e',
              flexShrink: 0,
            }}
          />
        )}

        {/* Question */}
        <span
          className="text-[12px] flex-1 min-w-0 truncate"
          style={{ color: 'var(--text)' }}
          title={market.question}
        >
          {market.question}
        </span>

        {/* Prob bar + prices */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
          <div
            style={{
              width: 56,
              height: 2,
              backgroundColor: 'rgba(255,255,255,0.08)',
              position: 'relative',
              overflow: 'hidden',
              flexShrink: 0,
            }}
          >
            <div
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                bottom: 0,
                width: `${yesPrice * 100}%`,
                backgroundColor: '#22c55e',
              }}
            />
          </div>
          <span className="metric text-[11px] font-semibold" style={{ color: '#22c55e', minWidth: 30 }}>
            {(yesPrice * 100).toFixed(0)}¢
          </span>
          <span className="metric text-[11px] font-semibold" style={{ color: '#ef4444', minWidth: 30 }}>
            {(noPrice * 100).toFixed(0)}¢
          </span>
        </div>

        {/* Δ24H */}
        <span
          className="metric text-[11px] font-semibold"
          style={{ color: isUp ? '#22c55e' : '#ef4444', minWidth: 48, textAlign: 'right', flexShrink: 0 }}
        >
          {isUp ? <TrendingUp className="inline h-2.5 w-2.5 mr-0.5" /> : <TrendingDown className="inline h-2.5 w-2.5 mr-0.5" />}
          {isUp ? '+' : ''}{(change * 100).toFixed(1)}
        </span>

        {/* Vol */}
        <span
          className="terminal-label hidden md:inline"
          style={{ minWidth: 52, textAlign: 'right', flexShrink: 0 }}
        >
          {formatVolume(market.volume24h)}
        </span>

        {/* Days */}
        <span
          className="terminal-label hidden lg:inline"
          style={{ minWidth: 36, textAlign: 'right', flexShrink: 0 }}
        >
          {days}d
        </span>

        {/* Buy buttons */}
        <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
          <button
            disabled={isTrading}
            onClick={() => handleBuy('YES')}
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
            onClick={() => handleBuy('NO')}
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
      </div>
      <OnboardingFlow open={showOnboarding} onClose={() => setShowOnboarding(false)} />
    </>
  );
});

// ── Main feed component ────────────────────────────────────────────────────

export function PolymarketFeedTab() {
  const [markets, setMarkets] = useState<PolymarketMarket[]>([]);
  const [loading, setLoading] = useState(true);
  const livePrices = useLivePricesCtx();
  const { status: sessionStatus, placeOrder, eoaAddress, safeAddress } = usePolymarketSession();

  useEffect(() => {
    fetchMarkets({ limit: 30 })
      .then(data => setMarkets(data))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flex: 1,
          backgroundColor: 'var(--bg)',
          gap: 8,
        }}
      >
        <Loader2 className="h-4 w-4 animate-spin" style={{ color: 'var(--text-tertiary)' }} />
        <span className="terminal-label">Loading markets…</span>
      </div>
    );
  }

  if (markets.length === 0) {
    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flex: 1,
          backgroundColor: 'var(--bg)',
        }}
      >
        <span className="terminal-label">Backend not responding</span>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>

      {/* Column headers */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          padding: '5px 14px',
          gap: 10,
          borderBottom: '1px solid var(--border)',
          backgroundColor: 'var(--bg-elevated)',
          flexShrink: 0,
        }}
      >
        <div style={{ width: 16, flexShrink: 0 }} />
        <span className="terminal-label hidden sm:inline" style={{ minWidth: 72 }}>Category</span>
        <span className="terminal-label flex-1">Market</span>
        <span className="terminal-label" style={{ minWidth: 56 + 8 + 30 + 8 + 30 }}>YES / NO</span>
        <span className="terminal-label" style={{ minWidth: 48, textAlign: 'right' }}>Δ 24h</span>
        <span className="terminal-label hidden md:inline" style={{ minWidth: 52, textAlign: 'right' }}>Volume</span>
        <span className="terminal-label hidden lg:inline" style={{ minWidth: 36, textAlign: 'right' }}>Left</span>
        <span className="terminal-label" style={{ minWidth: 88 }}>Trade</span>
      </div>

      {/* Rows */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {markets.map(market => (
          <FeedRow
            key={market.id}
            market={market}
            livePrice={livePrices[market.conditionId]}
            sessionStatus={sessionStatus}
            placeOrder={placeOrder}
            eoaAddress={eoaAddress}
            safeAddress={safeAddress}
          />
        ))}
      </div>
    </div>
  );
}
