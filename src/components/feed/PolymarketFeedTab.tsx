'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence, useMotionValue, useTransform, animate } from 'framer-motion';
import {
  TrendingUp, TrendingDown, DollarSign, Clock,
  Bookmark, Share2, ChevronUp, ChevronDown, Zap, ArrowUp, Loader2,
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { MOCK_MARKETS } from '@/lib/polymarket-data';
import type { PolymarketMarket } from '@/lib/types';
import { usePolymarketSession } from '@/hooks/usePolymarketSession';
import { OnboardingFlow } from '@/components/onboarding/OnboardingFlow';

// ── Category atmosphere ───────────────────────────────────────

const CAT_VIBES: Record<string, {
  glow: string; badge: string; badgeText: string; accent: string;
}> = {
  Politics: {
    glow: 'radial-gradient(ellipse 70% 60% at 50% 30%, rgba(239,68,68,0.18) 0%, transparent 70%)',
    badge: 'bg-red-500/15 border-red-500/30 text-red-400',
    badgeText: '#F87171',
    accent: '#EF4444',
  },
  Crypto: {
    glow: 'radial-gradient(ellipse 70% 60% at 50% 30%, rgba(46,92,255,0.2) 0%, transparent 70%)',
    badge: 'bg-blue-500/15 border-blue-500/30 text-blue-400',
    badgeText: '#60A5FA',
    accent: '#2E5CFF',
  },
  Sports: {
    glow: 'radial-gradient(ellipse 70% 60% at 50% 30%, rgba(249,115,22,0.18) 0%, transparent 70%)',
    badge: 'bg-orange-500/15 border-orange-500/30 text-orange-400',
    badgeText: '#FB923C',
    accent: '#F97316',
  },
  Business: {
    glow: 'radial-gradient(ellipse 70% 60% at 50% 30%, rgba(56,189,248,0.15) 0%, transparent 70%)',
    badge: 'bg-sky-500/15 border-sky-500/30 text-sky-400',
    badgeText: '#38BDF8',
    accent: '#0EA5E9',
  },
  Science: {
    glow: 'radial-gradient(ellipse 70% 60% at 50% 30%, rgba(167,139,250,0.18) 0%, transparent 70%)',
    badge: 'bg-violet-500/15 border-violet-500/30 text-violet-400',
    badgeText: '#A78BFA',
    accent: '#7C3AED',
  },
  World: {
    glow: 'radial-gradient(ellipse 70% 60% at 50% 30%, rgba(251,191,36,0.15) 0%, transparent 70%)',
    badge: 'bg-yellow-500/15 border-yellow-500/30 text-yellow-400',
    badgeText: '#FBB024',
    accent: '#EAB308',
  },
  Entertainment: {
    glow: 'radial-gradient(ellipse 70% 60% at 50% 30%, rgba(236,72,153,0.18) 0%, transparent 70%)',
    badge: 'bg-pink-500/15 border-pink-500/30 text-pink-400',
    badgeText: '#EC4899',
    accent: '#DB2777',
  },
};

const DEFAULT_VIBE = CAT_VIBES.Business;

// ── Helpers ───────────────────────────────────────────────────

function formatVolume(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`;
  return `$${n}`;
}

function daysUntil(dateStr: string): number {
  const d = new Date(dateStr);
  return Math.max(0, Math.ceil((d.getTime() - Date.now()) / (1000 * 60 * 60 * 24)));
}

// ── Animated counter ──────────────────────────────────────────

function AnimatedNumber({ value, className }: { value: number; className?: string }) {
  const count = useMotionValue(0);
  const rounded = useTransform(count, v => Math.round(v));
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    setDisplay(0);
    const controls = animate(count, value, {
      duration: 0.9,
      ease: [0.34, 1.56, 0.64, 1],
      onUpdate: v => setDisplay(Math.round(v)),
    });
    return controls.stop;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  // keep rounded in sync to avoid unused var warning
  void rounded;

  return <span className={className}>{display}</span>;
}

// ── Live trade ticker ─────────────────────────────────────────

const NAMES = ['whale🐋', 'alpha.eth', 'degen', 'anon', 'trader99', 'pm_bot', 'arb_king'];
const VERBS = ['bought', 'sold', 'bought', 'bought', 'sold'];

function useTradeTicker(market: PolymarketMarket) {
  const [trades, setTrades] = useState(() => {
    const seed = market.id.charCodeAt(0);
    return Array.from({ length: 4 }, (_, i) => ({
      id: i,
      name: NAMES[(seed + i) % NAMES.length],
      verb: VERBS[(seed + i) % VERBS.length],
      side: ((seed + i) % 2 === 0) ? 'YES' : 'NO' as 'YES' | 'NO',
      amount: 100 + ((seed * (i + 1) * 37) % 900),
    }));
  });

  useEffect(() => {
    const interval = setInterval(() => {
      const seed = Math.floor(Math.random() * 1000);
      setTrades(prev => [
        {
          id: Date.now(),
          name: NAMES[seed % NAMES.length],
          verb: VERBS[seed % VERBS.length],
          side: (seed % 2 === 0) ? 'YES' : 'NO',
          amount: 50 + (seed % 950),
        },
        ...prev.slice(0, 3),
      ]);
    }, 2500);
    return () => clearInterval(interval);
  }, []);

  return trades;
}

// ── Feed card ─────────────────────────────────────────────────

function FeedCard({ market, isActive }: { market: PolymarketMarket; isActive: boolean }) {
  const yes = market.outcomes.find(o => o.name === 'Yes') ?? market.outcomes[0];
  const no = market.outcomes.find(o => o.name === 'No') ?? market.outcomes[1];
  const yesPrice = yes?.price ?? 0.5;
  const noPrice = no?.price ?? 0.5;
  const change = market.priceChange24h;
  const isUp = change >= 0;
  const vibe = CAT_VIBES[market.category] ?? DEFAULT_VIBE;
  const days = daysUntil(market.endDate);
  const trades = useTradeTicker(market);

  const [bought, setBought] = useState<'YES' | 'NO' | null>(null);
  const [saved, setSaved] = useState(false);
  const [tradeSide, setTradeSide] = useState<'YES' | 'NO' | null>(null);
  const [tradeSize, setTradeSize] = useState(10);
  const [isTrading, setIsTrading] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const { status: sessionStatus, placeOrder } = usePolymarketSession();

  const yesPct = Math.round(yesPrice * 100);
  const noPct = Math.round(noPrice * 100);

  return (
    <div className="relative w-full h-full overflow-hidden select-none">
      {/* Full-bleed background */}
      <div className="absolute inset-0 bg-[#05050A]" />

      {/* Category atmosphere glow */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{ background: vibe.glow }}
      />

      {/* Noise texture overlay */}
      <div
        className="absolute inset-0 pointer-events-none opacity-[0.025]"
        style={{
          backgroundImage: 'url("data:image/svg+xml,%3Csvg viewBox=\'0 0 256 256\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cfilter id=\'noise\'%3E%3CfeTurbulence type=\'fractalNoise\' baseFrequency=\'0.9\' numOctaves=\'4\' stitchTiles=\'stitch\'/%3E%3C/filter%3E%3Crect width=\'100%25\' height=\'100%25\' filter=\'url(%23noise)\'/%3E%3C/svg%3E")',
          backgroundRepeat: 'repeat',
        }}
      />

      {/* Bottom gradient fade */}
      <div
        className="absolute inset-x-0 bottom-0 h-[55%] pointer-events-none"
        style={{ background: 'linear-gradient(to top, rgba(5,5,10,0.97) 0%, rgba(5,5,10,0.7) 45%, transparent 100%)' }}
      />
      <div
        className="absolute inset-x-0 top-0 h-[20%] pointer-events-none"
        style={{ background: 'linear-gradient(to bottom, rgba(5,5,10,0.6) 0%, transparent 100%)' }}
      />

      {/* ── Top bar ── */}
      <div className="absolute top-0 inset-x-0 z-10 flex items-center justify-between px-5 pt-4">
        <motion.span
          initial={{ opacity: 0, x: -10 }}
          animate={{ opacity: isActive ? 1 : 0, x: isActive ? 0 : -10 }}
          transition={{ delay: 0.1, duration: 0.4 }}
          className={cn(
            'inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[11px] font-bold tracking-widest uppercase backdrop-blur-sm',
            vibe.badge
          )}
        >
          {market.category}
        </motion.span>

        <motion.div
          initial={{ opacity: 0, x: 10 }}
          animate={{ opacity: isActive ? 1 : 0, x: isActive ? 0 : 10 }}
          transition={{ delay: 0.15, duration: 0.4 }}
          className={cn(
            'flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[12px] font-bold backdrop-blur-sm',
            isUp ? 'text-yes bg-yes/10 border-yes/25' : 'text-no bg-no/10 border-no/25'
          )}
        >
          {isUp ? <TrendingUp className="h-3.5 w-3.5" /> : <TrendingDown className="h-3.5 w-3.5" />}
          {isUp ? '+' : ''}{(change * 100).toFixed(1)}pp
        </motion.div>
      </div>

      {/* ── HERO: Giant probability display ── */}
      <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
        <motion.div
          initial={{ scale: 0.7, opacity: 0 }}
          animate={{ scale: isActive ? 1 : 0.7, opacity: isActive ? 1 : 0 }}
          transition={{ duration: 0.6, ease: [0.34, 1.56, 0.64, 1], delay: 0.05 }}
          className="flex flex-col items-center"
        >
          {/* YES probability — massive */}
          <div className="relative flex items-end gap-3">
            <div className="flex items-start leading-none">
              <span
                className="text-[110px] sm:text-[140px] font-black tracking-[-0.04em] leading-none"
                style={{ color: '#00C853', textShadow: `0 0 80px rgba(0,200,83,0.35)` }}
              >
                <AnimatedNumber value={yesPct} />
              </span>
              <span className="text-[32px] sm:text-[40px] font-black text-yes/70 mt-4 ml-1">%</span>
            </div>
          </div>

          {/* YES label */}
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: isActive ? 1 : 0, y: isActive ? 0 : 6 }}
            transition={{ delay: 0.4, duration: 0.4 }}
            className="flex items-center gap-3 mt-2"
          >
            <span className="text-[15px] font-bold text-yes/80 tracking-[0.12em] uppercase">Yes</span>
            <div className="h-px w-8 bg-white/10" />
            <span className="text-[15px] font-bold text-no/80 tracking-[0.12em] uppercase">No</span>
            <span
              className="text-[28px] sm:text-[32px] font-black tracking-tight"
              style={{ color: '#FF3D57', textShadow: `0 0 40px rgba(255,61,87,0.2)` }}
            >
              {noPct}%
            </span>
          </motion.div>

          {/* Segmented bar */}
          <motion.div
            initial={{ scaleX: 0, opacity: 0 }}
            animate={{ scaleX: isActive ? 1 : 0, opacity: isActive ? 1 : 0 }}
            transition={{ delay: 0.3, duration: 0.7, ease: [0.4, 0, 0.2, 1] }}
            className="mt-5 w-64 sm:w-80"
          >
            <div className="relative h-2 w-full rounded-full overflow-hidden bg-white/[0.07]">
              <motion.div
                className="absolute inset-y-0 left-0 rounded-full"
                style={{ backgroundColor: '#00C853' }}
                initial={{ width: 0 }}
                animate={{ width: isActive ? `${yesPct}%` : 0 }}
                transition={{ delay: 0.5, duration: 0.9, ease: [0.34, 1.56, 0.64, 1] }}
              />
              <motion.div
                className="absolute inset-y-0 right-0 rounded-full"
                style={{ backgroundColor: '#FF3D57' }}
                initial={{ width: 0 }}
                animate={{ width: isActive ? `${noPct}%` : 0 }}
                transition={{ delay: 0.6, duration: 0.9, ease: [0.34, 1.56, 0.64, 1] }}
              />
            </div>
          </motion.div>
        </motion.div>
      </div>

      {/* ── Right action rail ── */}
      <div className="absolute right-4 top-1/2 -translate-y-1/2 z-20 flex flex-col items-center gap-4">
        <motion.button
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: isActive ? 1 : 0, x: isActive ? 0 : 20 }}
          transition={{ delay: 0.3, duration: 0.4 }}
          onClick={() => setSaved(!saved)}
          className={cn(
            'flex flex-col items-center gap-1 group',
          )}
        >
          <div className={cn(
            'h-12 w-12 rounded-full flex items-center justify-center border backdrop-blur-xl transition-all',
            saved
              ? 'bg-primary/20 border-primary/40 text-primary'
              : 'bg-white/[0.07] border-white/[0.1] text-white/60 group-hover:bg-white/[0.12]'
          )}>
            <Bookmark className={cn('h-5 w-5', saved && 'fill-current')} />
          </div>
          <span className="text-[10px] text-white/40">Save</span>
        </motion.button>

        <motion.button
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: isActive ? 1 : 0, x: isActive ? 0 : 20 }}
          transition={{ delay: 0.35, duration: 0.4 }}
          className="flex flex-col items-center gap-1 group"
        >
          <div className="h-12 w-12 rounded-full flex items-center justify-center border bg-white/[0.07] border-white/[0.1] text-white/60 backdrop-blur-xl group-hover:bg-white/[0.12] transition-all">
            <Share2 className="h-5 w-5" />
          </div>
          <span className="text-[10px] text-white/40">Share</span>
        </motion.button>

        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: isActive ? 1 : 0, x: isActive ? 0 : 20 }}
          transition={{ delay: 0.4, duration: 0.4 }}
          className="flex flex-col items-center gap-1"
        >
          <div className={cn(
            'h-12 w-12 rounded-full flex items-center justify-center border backdrop-blur-xl',
            'bg-white/[0.07] border-white/[0.1]'
          )}>
            <Zap className="h-5 w-5" style={{ color: vibe.accent }} />
          </div>
          <span className="text-[10px] text-white/40">{formatVolume(market.volume24h)}</span>
        </motion.div>
      </div>

      {/* ── Bottom overlay ── */}
      <div className="absolute inset-x-0 bottom-0 z-10 px-5 pb-6">

        {/* Live trade ticker */}
        <div className="mb-4 h-[68px] overflow-hidden relative">
          <AnimatePresence mode="popLayout" initial={false}>
            {trades.slice(0, 3).map((t, i) => (
              <motion.div
                key={t.id}
                initial={{ opacity: 0, y: 20, filter: 'blur(4px)' }}
                animate={{ opacity: 1 - i * 0.28, y: 0, filter: 'blur(0px)' }}
                exit={{ opacity: 0, y: -20, filter: 'blur(4px)' }}
                transition={{ duration: 0.35, ease: 'easeOut' }}
                className="flex items-center gap-2 text-[12px] py-1"
              >
                <ArrowUp className={cn('h-3 w-3 shrink-0', t.verb === 'bought' ? 'text-yes' : 'text-no')} />
                <span className="font-semibold text-white/80">{t.name}</span>
                <span className="text-white/40">{t.verb}</span>
                <span className={cn(
                  'font-black text-[13px]',
                  t.side === 'YES' ? 'text-yes' : 'text-no'
                )}>{t.side}</span>
                <span className="text-white/40">·</span>
                <span className="font-semibold text-white/55">${t.amount.toLocaleString()}</span>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>

        {/* Market question */}
        <motion.h2
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: isActive ? 1 : 0, y: isActive ? 0 : 12 }}
          transition={{ delay: 0.2, duration: 0.5, ease: [0.4, 0, 0.2, 1] }}
          className="text-[20px] sm:text-[24px] font-bold text-white leading-[1.25] tracking-[-0.02em] mb-3 max-w-[85%]"
        >
          {market.question}
        </motion.h2>

        {/* Stats row */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: isActive ? 1 : 0 }}
          transition={{ delay: 0.3, duration: 0.4 }}
          className="flex items-center gap-4 text-[12px] text-white/40 mb-4"
        >
          <div className="flex items-center gap-1">
            <DollarSign className="h-3.5 w-3.5" />
            <span>{formatVolume(market.volume24h)} vol</span>
          </div>
          <div className="w-px h-3 bg-white/10" />
          <div className="flex items-center gap-1">
            <Clock className="h-3.5 w-3.5" />
            <span>{days}d left</span>
          </div>
          <div className="w-px h-3 bg-white/10" />
          <div className="flex items-center gap-1">
            <span>{formatVolume(market.liquidity)} liq</span>
          </div>
        </motion.div>

        {/* BUY buttons */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: isActive ? 1 : 0, y: isActive ? 0 : 12 }}
          transition={{ delay: 0.35, duration: 0.45, ease: [0.4, 0, 0.2, 1] }}
          className="flex flex-col gap-2"
        >
          {/* Size selector — only shown when a side is picked and session is ready */}
          <AnimatePresence>
            {tradeSide && sessionStatus === 'ready' && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="flex items-center justify-between rounded-lg border border-white/[0.1] bg-black/40 px-3 py-2 backdrop-blur-sm"
              >
                <span className="text-[12px] text-white/50">Shares</span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setTradeSize(s => Math.max(1, s - 5))}
                    className="flex h-6 w-6 items-center justify-center rounded-md bg-white/[0.06] text-white/60 hover:bg-white/[0.1] text-[14px] font-bold"
                  >−</button>
                  <span className="w-10 text-center text-[14px] font-bold text-white">{tradeSize}</span>
                  <button
                    onClick={() => setTradeSize(s => s + 5)}
                    className="flex h-6 w-6 items-center justify-center rounded-md bg-white/[0.06] text-white/60 hover:bg-white/[0.1] text-[14px] font-bold"
                  >+</button>
                </div>
                <span className="text-[12px] text-white/40">
                  ≈ ${(tradeSize * (tradeSide === 'YES' ? yesPrice : noPrice)).toFixed(2)}
                </span>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="flex gap-3">
            <button
              disabled={isTrading}
              onClick={async () => {
                if (sessionStatus !== 'ready') { setShowOnboarding(true); return; }
                if (tradeSide === 'YES') {
                  // Confirm trade
                  setIsTrading(true);
                  try {
                    const yesTokenId = yes?.tokenId ?? market.conditionId;
                    const result = await placeOrder({
                      tokenId: yesTokenId,
                      side: 'YES',
                      price: yesPrice,
                      size: tradeSize,
                    });
                    if (result) {
                      setBought('YES');
                      toast.success(`Order placed`, { description: `${tradeSize} YES shares @ ${Math.round(yesPrice * 100)}¢` });
                      setTradeSide(null);
                    }
                  } catch (e) {
                    toast.error('Order failed', { description: e instanceof Error ? e.message : String(e) });
                  } finally {
                    setIsTrading(false);
                  }
                } else {
                  setTradeSide('YES');
                }
              }}
              className={cn(
                'flex-1 py-4 rounded-xl font-black text-[16px] tracking-tight transition-all duration-150 active:scale-[0.97]',
                bought === 'YES'
                  ? 'bg-yes text-white'
                  : tradeSide === 'YES'
                  ? 'bg-yes text-white'
                  : 'bg-yes/12 text-yes border border-yes/30 hover:bg-yes/20 hover:border-yes/50',
                isTrading && tradeSide === 'YES' && 'opacity-70 cursor-not-allowed'
              )}
              style={(bought === 'YES' || tradeSide === 'YES') ? { boxShadow: '0 0 30px rgba(0,200,83,0.3)' } : {}}
            >
              {isTrading && tradeSide === 'YES' ? (
                <Loader2 className="inline h-4 w-4 animate-spin" />
              ) : bought === 'YES' ? (
                '✓ YES'
              ) : tradeSide === 'YES' ? (
                `Confirm YES`
              ) : (
                'BUY YES'
              )}
            </button>

            <button
              disabled={isTrading}
              onClick={async () => {
                if (sessionStatus !== 'ready') { setShowOnboarding(true); return; }
                if (tradeSide === 'NO') {
                  setIsTrading(true);
                  try {
                    const noTokenId = no?.tokenId ?? market.conditionId;
                    const result = await placeOrder({
                      tokenId: noTokenId,
                      side: 'NO',
                      price: noPrice,
                      size: tradeSize,
                    });
                    if (result) {
                      setBought('NO');
                      toast.success(`Order placed`, { description: `${tradeSize} NO shares @ ${Math.round(noPrice * 100)}¢` });
                      setTradeSide(null);
                    }
                  } catch (e) {
                    toast.error('Order failed', { description: e instanceof Error ? e.message : String(e) });
                  } finally {
                    setIsTrading(false);
                  }
                } else {
                  setTradeSide('NO');
                }
              }}
              className={cn(
                'flex-1 py-4 rounded-xl font-black text-[16px] tracking-tight transition-all duration-150 active:scale-[0.97]',
                bought === 'NO'
                  ? 'bg-no text-white'
                  : tradeSide === 'NO'
                  ? 'bg-no text-white'
                  : 'bg-no/12 text-no border border-no/30 hover:bg-no/20 hover:border-no/50',
                isTrading && tradeSide === 'NO' && 'opacity-70 cursor-not-allowed'
              )}
              style={(bought === 'NO' || tradeSide === 'NO') ? { boxShadow: '0 0 30px rgba(255,61,87,0.3)' } : {}}
            >
              {isTrading && tradeSide === 'NO' ? (
                <Loader2 className="inline h-4 w-4 animate-spin" />
              ) : bought === 'NO' ? (
                '✓ NO'
              ) : tradeSide === 'NO' ? (
                `Confirm NO`
              ) : (
                'BUY NO'
              )}
            </button>
          </div>
        </motion.div>
      </div>

      {/* Onboarding modal triggered from this card */}
      <OnboardingFlow open={showOnboarding} onClose={() => setShowOnboarding(false)} />
    </div>
  );
}

// ── Main feed component ───────────────────────────────────────

export function PolymarketFeedTab() {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [direction, setDirection] = useState<'up' | 'down'>('down');
  const markets = MOCK_MARKETS;
  const containerRef = useRef<HTMLDivElement>(null);
  const isAnimating = useRef(false);

  const goNext = useCallback(() => {
    if (isAnimating.current || currentIndex >= markets.length - 1) return;
    isAnimating.current = true;
    setDirection('down');
    setCurrentIndex(i => i + 1);
    setTimeout(() => { isAnimating.current = false; }, 500);
  }, [currentIndex, markets.length]);

  const goPrev = useCallback(() => {
    if (isAnimating.current || currentIndex <= 0) return;
    isAnimating.current = true;
    setDirection('up');
    setCurrentIndex(i => i - 1);
    setTimeout(() => { isAnimating.current = false; }, 500);
  }, [currentIndex]);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown' || e.key === 'j') goNext();
      if (e.key === 'ArrowUp' || e.key === 'k') goPrev();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [goNext, goPrev]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    let startY = 0;
    const onTouchStart = (e: TouchEvent) => { startY = e.touches[0].clientY; };
    const onTouchEnd = (e: TouchEvent) => {
      const dy = startY - e.changedTouches[0].clientY;
      if (Math.abs(dy) > 40) { if (dy > 0) goNext(); else goPrev(); }
    };
    el.addEventListener('touchstart', onTouchStart, { passive: true });
    el.addEventListener('touchend', onTouchEnd, { passive: true });
    return () => {
      el.removeEventListener('touchstart', onTouchStart);
      el.removeEventListener('touchend', onTouchEnd);
    };
  }, [goNext, goPrev]);

  const handleWheel = useCallback((e: React.WheelEvent) => {
    if (e.deltaY > 30) goNext();
    else if (e.deltaY < -30) goPrev();
  }, [goNext, goPrev]);

  const variants = {
    enter: (dir: 'up' | 'down') => ({
      y: dir === 'down' ? '100%' : '-100%',
      opacity: 0.3,
    }),
    center: {
      y: 0,
      opacity: 1,
    },
    exit: (dir: 'up' | 'down') => ({
      y: dir === 'down' ? '-22%' : '22%',
      opacity: 0,
      scale: 0.96,
    }),
  };

  return (
    <div
      ref={containerRef}
      className="relative overflow-hidden bg-[#05050A]"
      style={{ height: 'calc(100vh - 56px)' }}
      onWheel={handleWheel}
    >
      {/* Cards */}
      <AnimatePresence initial={false} custom={direction} mode="wait">
        <motion.div
          key={currentIndex}
          custom={direction}
          variants={variants}
          initial="enter"
          animate="center"
          exit="exit"
          transition={{ duration: 0.45, ease: 'easeInOut' }}
          className="absolute inset-0"
        >
          <FeedCard market={markets[currentIndex]} isActive={true} />
        </motion.div>
      </AnimatePresence>

      {/* Right nav: arrows + dot indicator */}
      <div className="absolute right-4 bottom-1/3 z-30 flex flex-col items-center gap-2 translate-y-[50%]">
        <button
          onClick={goPrev}
          disabled={currentIndex === 0}
          className={cn(
            'h-9 w-9 flex items-center justify-center rounded-full border backdrop-blur-xl transition-all',
            currentIndex === 0
              ? 'border-white/[0.03] text-white/10 cursor-not-allowed'
              : 'border-white/[0.1] text-white/40 bg-black/30 hover:text-white hover:border-white/25'
          )}
        >
          <ChevronUp className="h-4 w-4" />
        </button>

        <div className="flex flex-col items-center gap-1.5 py-1">
          {markets.map((_, i) => (
            <button
              key={i}
              onClick={() => {
                setDirection(i > currentIndex ? 'down' : 'up');
                setCurrentIndex(i);
              }}
              className={cn(
                'rounded-full transition-all duration-300',
                i === currentIndex
                  ? 'h-5 w-1.5 bg-white'
                  : 'h-1.5 w-1.5 bg-white/20 hover:bg-white/45'
              )}
            />
          ))}
        </div>

        <button
          onClick={goNext}
          disabled={currentIndex === markets.length - 1}
          className={cn(
            'h-9 w-9 flex items-center justify-center rounded-full border backdrop-blur-xl transition-all',
            currentIndex === markets.length - 1
              ? 'border-white/[0.03] text-white/10 cursor-not-allowed'
              : 'border-white/[0.1] text-white/40 bg-black/30 hover:text-white hover:border-white/25'
          )}
        >
          <ChevronDown className="h-4 w-4" />
        </button>
      </div>

      {/* Counter + hint */}
      <div className="absolute bottom-4 left-5 z-30 flex items-center gap-3 text-[11px] text-white/25">
        <span className="tabular-nums font-medium">{currentIndex + 1} / {markets.length}</span>
        <span className="hidden sm:inline">· scroll or ↑↓</span>
      </div>
    </div>
  );
}
