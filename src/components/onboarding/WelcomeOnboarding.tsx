'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X,
  ArrowRight,
  ArrowLeft,
  Wallet,
  Shield,
  Coins,
  CheckCircle2,
  Loader2,
  TrendingUp,
  Zap,
  DollarSign,
  ExternalLink,
  BarChart2,
  Activity,
} from 'lucide-react';
import { usePolymarketSession } from '@/hooks/usePolymarketSession';
import { useFunding } from '@/hooks/useFunding';
import { cn } from '@/lib/utils';

interface WelcomeOnboardingProps {
  open: boolean;
  onClose: () => void;
}

// ─── Shared background particles (seeded, no hydration issues) ────────────────
function seededRandom(seed: number) {
  const x = Math.sin(seed * 9301 + 49297) * 49297;
  return x - Math.floor(x);
}

function FloatingParticles({ color = '#2E5CFF', seed = 0 }: { color?: string; seed?: number }) {
  const particles = useMemo(() =>
    Array.from({ length: 12 }).map((_, i) => ({
      x: Math.round(seededRandom(seed + i * 7) * 100),
      y: Math.round(seededRandom(seed + i * 13) * 100),
      size: Math.round(seededRandom(seed + i * 19) * 3 + 2),
      delay: Math.round(seededRandom(seed + i * 23) * 60) / 10,
      duration: Math.round(seededRandom(seed + i * 29) * 80 + 100) / 10,
      drift: Math.round((seededRandom(seed + i * 37) - 0.5) * 80),
    })),
  [seed]);

  const rgb = color.replace('#', '');
  const r = parseInt(rgb.slice(0, 2), 16);
  const g = parseInt(rgb.slice(2, 4), 16);
  const b = parseInt(rgb.slice(4, 6), 16);

  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden z-0">
      {particles.map((p, i) => (
        <motion.div
          key={i}
          className="absolute rounded-full"
          style={{
            left: `${p.x}%`,
            top: `${p.y}%`,
            width: p.size,
            height: p.size,
            backgroundColor: color,
            boxShadow: `0 0 ${p.size * 3}px rgba(${r},${g},${b},0.4)`,
          }}
          initial={{ opacity: 0 }}
          animate={{ opacity: [0, 0.1, 0.05, 0.1, 0], y: [0, p.drift, -p.drift, 0] }}
          transition={{ duration: p.duration, delay: p.delay, repeat: Infinity, ease: 'linear' }}
        />
      ))}
    </div>
  );
}

// ─── Full-screen feature previews ─────────────────────────────────────────────

function IntelligencePreview() {
  const [yesPrice, setYesPrice] = useState(0.67);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const id = setInterval(() => {
      setYesPrice(p => Math.max(0.42, Math.min(0.88, p + (Math.random() - 0.48) * 0.022)));
      setTick(t => t + 1);
    }, 850);
    return () => clearInterval(id);
  }, []);

  const trending = tick % 7 < 4;

  const markets = [
    { q: 'Will the Fed cut rates before June 2026?', yes: yesPrice, vol: '2.4M', live: true },
    { q: 'Bitcoin above $100k by end of 2026?', yes: 0.52 + Math.sin(tick / 5) * 0.05, vol: '8.1M', live: false },
    { q: '2026 US recession probability', yes: 0.29, vol: '1.2M', live: false },
    { q: 'Will SpaceX land on Mars by 2028?', yes: 0.14, vol: '890K', live: false },
  ];

  return (
    <div className="w-full h-full flex flex-col gap-3 overflow-hidden">
      {markets.map((m, i) => (
        <motion.div
          key={m.q}
          className="rounded-xl border border-white/[0.08] bg-white/[0.03] p-4 backdrop-blur-sm"
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: i * 0.1 }}
        >
          <div className="flex items-start justify-between gap-3 mb-3">
            <p className="text-[13px] font-medium text-white/85 leading-snug flex-1">{m.q}</p>
            <div className="flex items-center gap-1.5 shrink-0">
              {m.live && (
                <span className="flex items-center gap-1 text-[9px] font-bold px-2 py-0.5 rounded-full bg-[#2E5CFF]/15 text-[#2E5CFF]">
                  <motion.span
                    className="w-1 h-1 rounded-full bg-[#2E5CFF] inline-block"
                    animate={{ opacity: [1, 0.2, 1] }}
                    transition={{ duration: 1, repeat: Infinity }}
                  />
                  LIVE
                </span>
              )}
              <span className="text-[9px] text-white/25 font-mono">${m.vol}</span>
            </div>
          </div>
          <div className="flex gap-3">
            <div className="flex-1">
              <div className="flex justify-between mb-1.5">
                <span className="text-[11px] font-semibold text-yes/80">YES</span>
                <span className="text-[12px] font-mono font-bold text-yes">
                  {(m.yes * 100).toFixed(0)}¢
                  {m.live && (
                    <span className={cn('ml-1 text-[10px]', trending ? 'text-yes' : 'text-no')}>
                      {trending ? '▲' : '▼'}
                    </span>
                  )}
                </span>
              </div>
              <div className="h-1.5 rounded-full bg-white/[0.06] overflow-hidden">
                <motion.div
                  className="h-full rounded-full"
                  style={{ background: 'linear-gradient(90deg, rgba(0,200,83,0.5), rgba(0,200,83,0.8))' }}
                  animate={{ width: `${m.yes * 100}%` }}
                  transition={{ duration: 0.7, ease: 'easeOut' }}
                />
              </div>
            </div>
            <div className="flex-1">
              <div className="flex justify-between mb-1.5">
                <span className="text-[11px] font-semibold text-no/80">NO</span>
                <span className="text-[12px] font-mono font-bold text-no">
                  {((1 - m.yes) * 100).toFixed(0)}¢
                </span>
              </div>
              <div className="h-1.5 rounded-full bg-white/[0.06] overflow-hidden">
                <motion.div
                  className="h-full rounded-full"
                  style={{ background: 'linear-gradient(90deg, rgba(255,61,87,0.4), rgba(255,61,87,0.7))' }}
                  animate={{ width: `${(1 - m.yes) * 100}%` }}
                  transition={{ duration: 0.7, ease: 'easeOut' }}
                />
              </div>
            </div>
          </div>
        </motion.div>
      ))}
      <motion.p
        className="text-[11px] text-white/20 text-center"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.5 }}
      >
        847 live markets · real-time updates
      </motion.p>
    </div>
  );
}

function BuilderPreview() {
  const [activeBlock, setActiveBlock] = useState(0);
  const [flowActive, setFlowActive] = useState(false);

  useEffect(() => {
    const id = setInterval(() => {
      setActiveBlock(b => {
        const next = (b + 1) % 3;
        if (next === 0) setFlowActive(true);
        return next;
      });
    }, 1800);
    return () => clearInterval(id);
  }, []);

  const blocks = [
    {
      type: 'TRIGGER',
      label: 'Price crosses 0.65',
      sub: 'YES probability spike',
      detail: 'When market price goes above threshold',
      color: '#2E5CFF',
      colorRgb: '46,92,255',
      icon: BarChart2,
    },
    {
      type: 'CONDITION',
      label: 'Max 3 trades / day',
      sub: 'Risk limit enforced',
      detail: 'Safety guard to prevent over-trading',
      color: '#FFB300',
      colorRgb: '255,179,0',
      icon: Shield,
    },
    {
      type: 'ACTION',
      label: 'Buy YES · $10 USDC',
      sub: 'Market order placed',
      detail: 'Execute immediately at best price',
      color: '#00C853',
      colorRgb: '0,200,83',
      icon: Zap,
    },
  ];

  return (
    <div className="w-full h-full flex flex-col justify-center gap-4">
      {/* Block pipeline */}
      <div className="flex items-center gap-2">
        {blocks.map((block, i) => {
          const Icon = block.icon;
          const isActive = activeBlock === i;
          const isPast = activeBlock > i || flowActive;
          return (
            <div key={block.type} className="flex items-center flex-1 min-w-0">
              <motion.div
                className="flex-1 rounded-xl border p-4 min-w-0"
                animate={{
                  borderColor: isActive
                    ? `rgba(${block.colorRgb},0.5)`
                    : isPast
                    ? `rgba(${block.colorRgb},0.2)`
                    : 'rgba(255,255,255,0.07)',
                  backgroundColor: isActive
                    ? `rgba(${block.colorRgb},0.08)`
                    : 'rgba(255,255,255,0.02)',
                  boxShadow: isActive
                    ? `0 0 20px rgba(${block.colorRgb},0.12)`
                    : 'none',
                }}
                transition={{ duration: 0.4 }}
              >
                <div
                  className="w-8 h-8 rounded-lg flex items-center justify-center mb-3"
                  style={{ background: `rgba(${block.colorRgb},0.15)` }}
                >
                  <Icon style={{ width: 16, height: 16, color: block.color }} />
                </div>
                <p
                  className="text-[9px] font-bold uppercase tracking-[0.12em] mb-1.5"
                  style={{ color: isActive ? block.color : 'rgba(255,255,255,0.3)' }}
                >
                  {block.type}
                </p>
                <p
                  className="text-[13px] font-semibold leading-tight mb-1"
                  style={{ color: isActive ? '#fff' : 'rgba(255,255,255,0.4)' }}
                >
                  {block.label}
                </p>
                <p
                  className="text-[11px] leading-snug"
                  style={{ color: isActive ? 'rgba(255,255,255,0.45)' : 'rgba(255,255,255,0.2)' }}
                >
                  {block.detail}
                </p>
              </motion.div>
              {i < blocks.length - 1 && (
                <motion.div
                  className="flex items-center justify-center w-8 shrink-0"
                  animate={{ opacity: activeBlock > i || flowActive ? 1 : 0.15 }}
                >
                  <ArrowRight
                    style={{
                      width: 16,
                      height: 16,
                      color: activeBlock > i || flowActive ? blocks[i].color : 'rgba(255,255,255,0.2)',
                    }}
                  />
                </motion.div>
              )}
            </div>
          );
        })}
      </div>

      {/* Available block tags */}
      <div>
        <p className="text-[10px] text-white/25 uppercase tracking-[0.1em] mb-2">Available blocks</p>
        <div className="flex flex-wrap gap-1.5">
          {['Price Crosses', 'Probability Range', 'Volume Spike', 'Time Based', 'AND / OR', 'Cooldown', 'Position Limit', 'Buy YES', 'Buy NO', 'Notify'].map(tag => (
            <span
              key={tag}
              className="text-[10px] font-medium px-2 py-1 rounded-md"
              style={{ background: 'rgba(255,255,255,0.04)', color: 'rgba(255,255,255,0.35)', border: '1px solid rgba(255,255,255,0.06)' }}
            >
              {tag}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

function ExecutionPreview() {
  const [pnl1, setPnl1] = useState(12.4);
  const [pnl2, setPnl2] = useState(8.2);
  const [trades, setTrades] = useState(14);
  const [log, setLog] = useState<string[]>([
    'BUY YES 10 USDC @ 0.67 — filled',
    'BUY YES 10 USDC @ 0.71 — filled',
  ]);

  useEffect(() => {
    const id = setInterval(() => {
      setPnl1(p => +(p + (Math.random() - 0.35) * 0.4).toFixed(2));
      setPnl2(p => +(p + (Math.random() - 0.38) * 0.25).toFixed(2));
      if (Math.random() > 0.65) {
        setTrades(t => t + 1);
        const sides = ['YES', 'NO'];
        const side = sides[Math.floor(Math.random() * 2)];
        const price = (0.5 + Math.random() * 0.35).toFixed(2);
        const size = [5, 10, 15, 20][Math.floor(Math.random() * 4)];
        setLog(l => [`BUY ${side} ${size} USDC @ ${price} — filled`, ...l.slice(0, 3)]);
      }
    }, 1400);
    return () => clearInterval(id);
  }, []);

  const strategies = [
    { name: 'Crypto Momentum', pnl: pnl1, winRate: 67, trades: 8, status: 'RUNNING', color: '#00C853' },
    { name: 'Election Alpha', pnl: pnl2, winRate: 72, trades: 5, status: 'RUNNING', color: '#00C853' },
    { name: 'Rate Watch', pnl: -1.8, winRate: 40, trades: 1, status: 'PAUSED', color: '#FFB300' },
  ];

  return (
    <div className="w-full h-full flex flex-col gap-3 overflow-hidden">
      {/* Strategy cards */}
      <div className="space-y-2">
        {strategies.map((s, i) => (
          <motion.div
            key={s.name}
            className="rounded-xl border border-white/[0.07] bg-white/[0.03] p-4"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
          >
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <motion.div
                  className="w-2 h-2 rounded-full"
                  style={{ background: s.color }}
                  animate={s.status === 'RUNNING' ? { opacity: [1, 0.2, 1], scale: [1, 0.7, 1] } : { opacity: 0.4 }}
                  transition={{ duration: 1.4, repeat: Infinity }}
                />
                <span className="text-[13px] font-semibold text-white/85">{s.name}</span>
              </div>
              <span
                className="text-[9px] font-bold px-2 py-0.5 rounded-full"
                style={{ background: `${s.color}18`, color: s.color }}
              >
                {s.status}
              </span>
            </div>
            <div className="flex gap-5">
              <div>
                <p className="text-[9px] text-white/30 mb-0.5">P&amp;L</p>
                <motion.p
                  className="text-[15px] font-mono font-bold"
                  style={{ color: s.pnl >= 0 ? '#00C853' : '#FF3D57' }}
                  key={s.pnl.toFixed(1)}
                >
                  {s.pnl >= 0 ? '+' : ''}${s.pnl.toFixed(2)}
                </motion.p>
              </div>
              <div>
                <p className="text-[9px] text-white/30 mb-0.5">Win Rate</p>
                <p className="text-[15px] font-mono font-bold text-white/70">{s.winRate}%</p>
              </div>
              <div>
                <p className="text-[9px] text-white/30 mb-0.5">Trades</p>
                <p className="text-[15px] font-mono font-bold text-white/70">{s.trades}</p>
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Live trade log */}
      <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3">
        <p className="text-[9px] font-bold uppercase tracking-[0.12em] text-white/25 mb-2 flex items-center gap-1.5">
          <Activity style={{ width: 10, height: 10 }} />
          Live trade log
        </p>
        <div className="space-y-1">
          <AnimatePresence>
            {log.map((entry, i) => (
              <motion.p
                key={entry + i}
                className="text-[11px] font-mono text-white/40"
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1 - i * 0.2, y: 0 }}
                transition={{ duration: 0.25 }}
              >
                <span className="text-[#00C853]/60 mr-1.5">›</span>{entry}
              </motion.p>
            ))}
          </AnimatePresence>
        </div>
      </div>

      <p className="text-[11px] text-white/20 text-center">
        {trades} trades executed · strategies run 24/7
      </p>
    </div>
  );
}

// ─── Tour slide data ───────────────────────────────────────────────────────────
const TOUR_SLIDES = [
  {
    id: 0,
    step: '01',
    tag: 'Market Intelligence',
    title: 'See every market,\nlive.',
    description: 'Browse 800+ prediction markets with real-time probability updates, sparkline charts, and volume data. Filter by category, spot top movers.',
    color: '#2E5CFF',
    colorRgb: '46,92,255',
    particleSeed: 42,
    Preview: IntelligencePreview,
  },
  {
    id: 1,
    step: '02',
    tag: 'Strategy Builder',
    title: 'Automate your\nedge.',
    description: 'Drag trigger, condition, and action blocks onto a canvas to build autonomous trading strategies. No code. No limits.',
    color: '#FFB300',
    colorRgb: '255,179,0',
    particleSeed: 99,
    Preview: BuilderPreview,
  },
  {
    id: 2,
    step: '03',
    tag: 'Autonomous Execution',
    title: 'Trade while\nyou sleep.',
    description: 'Your strategies execute on Polymarket 24/7. Live P&L, win rates, and trade logs so you\'re always in control.',
    color: '#00C853',
    colorRgb: '0,200,83',
    particleSeed: 200,
    Preview: ExecutionPreview,
  },
] as const;

// ─── Tour phase (full screen split layout) ────────────────────────────────────
function TourPhase({ onComplete, onSkip }: { onComplete: () => void; onSkip: () => void }) {
  const [slide, setSlide] = useState(0);
  const total = TOUR_SLIDES.length;
  const current = TOUR_SLIDES[slide];
  const Preview = current.Preview;

  const next = useCallback(() => {
    if (slide < total - 1) setSlide(s => s + 1);
    else onComplete();
  }, [slide, total, onComplete]);

  const prev = useCallback(() => {
    if (slide > 0) setSlide(s => s - 1);
  }, [slide]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') next();
      if (e.key === 'ArrowLeft') prev();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [next, prev]);

  return (
    <div className="relative flex h-full flex-col overflow-hidden">
      <FloatingParticles color={`#${current.colorRgb.split(',').map(n => parseInt(n).toString(16).padStart(2, '0')).join('')}`} seed={current.particleSeed} />

      {/* Radial glow */}
      <div
        className="absolute inset-0 pointer-events-none z-0 transition-all duration-700"
        style={{
          background: `radial-gradient(ellipse 60% 50% at 25% 50%, rgba(${current.colorRgb},0.07) 0%, transparent 70%)`,
        }}
      />

      {/* Top bar */}
      <div className="relative z-10 flex items-center justify-between px-8 py-5 shrink-0">
        <span className="text-[11px] font-mono text-white/20">
          {current.step} / {total.toString().padStart(2, '0')}
        </span>
        <button
          onClick={onSkip}
          className="text-[11px] uppercase tracking-[0.15em] text-white/30 hover:text-white/60 transition-colors"
        >
          Skip →
        </button>
      </div>

      {/* Main content: left preview + right text */}
      <div className="relative z-10 flex flex-1 min-h-0 gap-0">
        {/* Left: Feature preview */}
        <div className="flex-1 flex items-center justify-center px-8 pb-4 overflow-hidden">
          <AnimatePresence mode="wait">
            <motion.div
              key={slide}
              className="w-full h-full max-h-full"
              initial={{ opacity: 0, x: -30, scale: 0.97 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: 30, scale: 0.97 }}
              transition={{ duration: 0.35, ease: 'easeOut' }}
            >
              <Preview />
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Divider */}
        <div className="w-px bg-white/[0.05] shrink-0 my-8" />

        {/* Right: Text + nav */}
        <div className="w-[340px] shrink-0 flex flex-col justify-between px-8 py-4">
          <AnimatePresence mode="wait">
            <motion.div
              key={slide}
              className="flex flex-col gap-4"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.3 }}
            >
              <div>
                <p
                  className="text-[10px] font-bold uppercase tracking-[0.18em] mb-3"
                  style={{ color: current.color }}
                >
                  {current.tag}
                </p>
                <h2
                  className="text-[36px] font-bold leading-[1.1] tracking-[-0.03em] text-white mb-4"
                  style={{ whiteSpace: 'pre-line' }}
                >
                  {current.title}
                </h2>
                <p className="text-[14px] text-white/45 leading-relaxed">
                  {current.description}
                </p>
              </div>

              {/* Feature bullets */}
              <div className="space-y-2">
                {[
                  slide === 0 ? ['Live price streams', 'Sort by volume & movers', '800+ markets'] :
                  slide === 1 ? ['No code required', '6 trigger types', 'Runs 24/7 automatically'] :
                               ['Real-time P&L tracking', 'Live trade log', 'Pause or stop anytime']
                ][0].map((bullet) => (
                  <div key={bullet} className="flex items-center gap-2">
                    <div className="w-1 h-1 rounded-full" style={{ background: current.color }} />
                    <span className="text-[12px] text-white/50">{bullet}</span>
                  </div>
                ))}
              </div>
            </motion.div>
          </AnimatePresence>

          {/* Navigation */}
          <div className="space-y-4">
            {/* Progress dots */}
            <div className="flex gap-1.5">
              {TOUR_SLIDES.map((s) => (
                <motion.button
                  key={s.id}
                  onClick={() => setSlide(s.id)}
                  className="rounded-full focus:outline-none"
                  animate={{
                    width: slide === s.id ? 28 : 8,
                    height: 8,
                    backgroundColor:
                      slide > s.id
                        ? 'rgba(255,255,255,0.2)'
                        : slide === s.id
                        ? current.color
                        : 'rgba(255,255,255,0.08)',
                    boxShadow: slide === s.id ? `0 0 10px rgba(${current.colorRgb},0.5)` : 'none',
                  }}
                  transition={{ type: 'spring', stiffness: 400, damping: 25 }}
                />
              ))}
            </div>

            {/* Buttons */}
            <div className="flex gap-2">
              {slide > 0 && (
                <button
                  onClick={prev}
                  className="flex items-center justify-center w-11 h-11 rounded-xl border border-white/[0.08] text-white/35 hover:text-white/60 hover:bg-white/[0.04] transition-colors shrink-0"
                >
                  <ArrowLeft style={{ width: 17, height: 17 }} />
                </button>
              )}
              <motion.button
                onClick={next}
                className="flex-1 h-11 rounded-xl font-semibold text-[14px] text-white flex items-center justify-center gap-2"
                style={{ background: current.color }}
                whileHover={{ filter: 'brightness(1.12)' }}
                whileTap={{ scale: 0.97 }}
              >
                {slide < total - 1 ? (
                  <>Next <ArrowRight style={{ width: 15, height: 15 }} /></>
                ) : (
                  <>Set up wallet <Wallet style={{ width: 15, height: 15 }} /></>
                )}
              </motion.button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Wallet phase (full screen, centered) ────────────────────────────────────
type WalletStep = 0 | 1 | 2 | 3;

const WALLET_STEPS = [
  {
    id: 0,
    icon: Wallet,
    title: 'Connect wallet',
    description: 'Sign in to create your embedded wallet. No seed phrase needed — Privy handles it securely using email or social login.',
    action: 'Sign in',
    color: '#2E5CFF',
    colorRgb: '46,92,255',
  },
  {
    id: 1,
    icon: Shield,
    title: 'Deploy Safe',
    description: 'A Gnosis Safe is deployed as your trading account on Polygon. Completely gasless — Polymarket covers the deployment fee.',
    action: 'Deploy Safe',
    color: '#00C853',
    colorRgb: '0,200,83',
  },
  {
    id: 2,
    icon: Coins,
    title: 'Approve tokens',
    description: 'One-time approval for USDC.e and outcome tokens. This lets your Safe execute orders on Polymarket on your behalf.',
    action: 'Approve tokens',
    color: '#FFB300',
    colorRgb: '255,179,0',
  },
  {
    id: 3,
    icon: CheckCircle2,
    title: 'Ready to trade',
    description: "Your wallet is fully set up. We're sending $5.00 USDC to your Safe so you can start trading immediately.",
    action: 'Enter Polytology',
    color: '#00C853',
    colorRgb: '0,200,83',
  },
] as const;

function WalletPhase({ onComplete, onBack }: { onComplete: () => void; onBack: () => void }) {
  const { status, error, login, deploySafe, approveTokens, eoaAddress, safeAddress } =
    usePolymarketSession();
  const { fundingStatus, txHash } = useFunding(eoaAddress, safeAddress, status === 'ready');
  const [loading, setLoading] = useState(false);
  const [stepError, setStepError] = useState<string | null>(null);

  useEffect(() => { setStepError(error); }, [error]);

  const currentStep: WalletStep =
    status === 'idle' ? 0
    : status === 'wallet-ready' ? 1
    : status === 'safe-deploying' ? 1
    : status === 'safe-deployed' ? 2
    : status === 'approving' ? 2
    : status === 'ready' ? 3
    : 0;

  const isStepLoading = loading || status === 'safe-deploying' || status === 'approving';

  const handleAction = async () => {
    setStepError(null);
    try {
      if (currentStep === 0) { login(); return; }
      if (currentStep === 1) { setLoading(true); await deploySafe(); return; }
      if (currentStep === 2) { setLoading(true); await approveTokens(); return; }
      if (currentStep === 3) { onComplete(); return; }
    } catch (e) {
      setStepError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  };

  const step = WALLET_STEPS[currentStep];

  const getFundingLabel = () => {
    if (fundingStatus === 'idle' || fundingStatus === 'queuing') return 'Queueing $5.00 USDC…';
    if (fundingStatus === 'pending') return '$5.00 USDC queued · sending soon';
    if (fundingStatus === 'processing') return 'Sending $5.00 USDC to your Safe…';
    if (fundingStatus === 'completed') return '$5.00 USDC sent to your Safe ✓';
    if (fundingStatus === 'failed') return 'Funding failed — contact support';
    return '$5.00 USDC will be sent to your Safe';
  };

  const fundingColor = fundingStatus === 'completed' ? '#00C853' : fundingStatus === 'failed' ? '#FF3D57' : '#2E5CFF';

  return (
    <div className="relative flex h-full flex-col overflow-hidden">
      <FloatingParticles color={step.color} seed={777} />

      {/* Radial glow behind current step */}
      <div
        className="absolute inset-0 pointer-events-none z-0 transition-all duration-700"
        style={{
          background: `radial-gradient(ellipse 50% 60% at 50% 50%, rgba(${step.colorRgb},0.06) 0%, transparent 70%)`,
        }}
      />

      {/* Top bar */}
      <div className="relative z-10 flex items-center justify-between px-8 py-5 shrink-0">
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 text-[11px] text-white/30 hover:text-white/60 transition-colors"
        >
          <ArrowLeft style={{ width: 13, height: 13 }} /> Back
        </button>
        <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/20">
          Wallet Setup
        </span>
        <div className="w-16" />
      </div>

      {/* Centered content */}
      <div className="relative z-10 flex-1 flex items-center justify-center px-8 pb-8">
        <div className="w-full max-w-lg">

          {/* Header */}
          <motion.div
            className="text-center mb-10"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <h2 className="text-[32px] font-bold tracking-[-0.03em] text-white mb-2">
              Set up your trading account
            </h2>
            <p className="text-[14px] text-white/35">
              One-time setup · all transactions are gasless on Polygon
            </p>
          </motion.div>

          {/* Step indicators row */}
          <div className="flex items-center mb-10">
            {WALLET_STEPS.map((s, i) => {
              const isDone = currentStep > s.id;
              const isActive = currentStep === s.id;
              const Icon = s.icon;
              return (
                <div key={s.id} className="flex items-center flex-1">
                  <div className="flex flex-col items-center flex-1">
                    <motion.div
                      className={cn(
                        'w-10 h-10 rounded-full border-2 flex items-center justify-center mb-2 transition-colors duration-400',
                        isDone ? 'border-yes/50 bg-yes/10'
                        : isActive ? 'border-white/30 bg-white/[0.06]'
                        : 'border-white/[0.08] bg-transparent'
                      )}
                      animate={isActive && !isStepLoading ? { scale: [1, 1.06, 1] } : { scale: 1 }}
                      transition={{ duration: 2, repeat: Infinity }}
                    >
                      {isDone ? (
                        <CheckCircle2 style={{ width: 18, height: 18, color: '#00C853' }} />
                      ) : isActive && isStepLoading ? (
                        <Loader2 style={{ width: 16, height: 16, color: s.color }} className="animate-spin" />
                      ) : (
                        <Icon style={{ width: 16, height: 16, color: isActive ? s.color : 'rgba(255,255,255,0.2)' }} />
                      )}
                    </motion.div>
                    <p
                      className="text-[11px] font-medium text-center"
                      style={{ color: isDone ? 'rgba(255,255,255,0.45)' : isActive ? '#fff' : 'rgba(255,255,255,0.2)' }}
                    >
                      {s.title}
                    </p>
                  </div>
                  {i < WALLET_STEPS.length - 1 && (
                    <motion.div
                      className="h-px flex-1 mx-2 mb-5"
                      animate={{ backgroundColor: currentStep > i ? '#00C853' : 'rgba(255,255,255,0.06)' }}
                      transition={{ duration: 0.5 }}
                    />
                  )}
                </div>
              );
            })}
          </div>

          {/* Active step detail card */}
          <AnimatePresence mode="wait">
            <motion.div
              key={currentStep}
              className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-6 mb-6"
              initial={{ opacity: 0, y: 16, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -16, scale: 0.98 }}
              transition={{ duration: 0.25 }}
              style={{ borderColor: `rgba(${step.colorRgb},0.2)`, background: `rgba(${step.colorRgb},0.04)` }}
            >
              <div className="flex items-start gap-4">
                <div
                  className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0"
                  style={{ background: `rgba(${step.colorRgb},0.15)` }}
                >
                  <step.icon style={{ width: 22, height: 22, color: step.color }} />
                </div>
                <div className="flex-1">
                  <h3 className="text-[17px] font-bold text-white mb-1">{step.title}</h3>
                  <p className="text-[13px] text-white/45 leading-relaxed">{step.description}</p>
                  {eoaAddress && currentStep === 0 && (
                    <p className="mt-2 font-mono text-[11px] text-white/25">
                      {eoaAddress.slice(0, 10)}…{eoaAddress.slice(-8)}
                    </p>
                  )}
                  {safeAddress && currentStep >= 1 && (
                    <p className="mt-2 font-mono text-[11px] text-white/25">
                      Safe: {safeAddress.slice(0, 10)}…{safeAddress.slice(-8)}
                    </p>
                  )}

                  {/* Funding badge on final step */}
                  {currentStep === 3 && (
                    <motion.div
                      className="mt-3 inline-flex items-center gap-2 rounded-lg px-3 py-2"
                      style={{ background: `${fundingColor}14`, border: `1px solid ${fundingColor}28` }}
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: 0.4 }}
                    >
                      <DollarSign style={{ width: 13, height: 13, color: fundingColor }} />
                      <span className="text-[12px] font-semibold" style={{ color: fundingColor }}>
                        {getFundingLabel()}
                      </span>
                      {(fundingStatus === 'pending' || fundingStatus === 'processing' || fundingStatus === 'queuing') && (
                        <Loader2 style={{ width: 11, height: 11, color: fundingColor }} className="animate-spin" />
                      )}
                      {fundingStatus === 'completed' && txHash && (
                        <a href={`https://polygonscan.com/tx/${txHash}`} target="_blank" rel="noreferrer">
                          <ExternalLink style={{ width: 11, height: 11, color: fundingColor }} />
                        </a>
                      )}
                    </motion.div>
                  )}
                </div>
              </div>
            </motion.div>
          </AnimatePresence>

          {/* Error */}
          {stepError && (
            <div className="rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-[12px] text-red-400/80 mb-4">
              {stepError.length > 140 ? stepError.slice(0, 140) + '…' : stepError}
            </div>
          )}

          {/* CTA button */}
          <motion.button
            onClick={handleAction}
            disabled={isStepLoading}
            className={cn(
              'w-full h-12 rounded-xl font-bold text-[15px] text-white flex items-center justify-center gap-2 transition-all',
              isStepLoading && 'opacity-60 cursor-not-allowed'
            )}
            style={{ background: step.color, boxShadow: `0 4px 24px rgba(${step.colorRgb},0.25)` }}
            whileHover={!isStepLoading ? { filter: 'brightness(1.1)', y: -1 } : {}}
            whileTap={!isStepLoading ? { scale: 0.98 } : {}}
          >
            {isStepLoading ? (
              <>
                <Loader2 style={{ width: 16, height: 16 }} className="animate-spin" />
                {currentStep === 1 ? 'Deploying Safe…' : 'Approving tokens…'}
              </>
            ) : (
              step.action
            )}
          </motion.button>
        </div>
      </div>
    </div>
  );
}

// ─── Root ─────────────────────────────────────────────────────────────────────
type Phase = 'tour' | 'wallet';

export function WelcomeOnboarding({ open, onClose }: WelcomeOnboardingProps) {
  const [phase, setPhase] = useState<Phase>('tour');

  useEffect(() => {
    if (open) setPhase('tour');
  }, [open]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[100] overflow-hidden"
          style={{ background: '#07070E' }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
        >
          <AnimatePresence mode="wait">
            {phase === 'tour' ? (
              <motion.div
                key="tour"
                className="absolute inset-0"
                initial={{ opacity: 0, x: 40 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -40 }}
                transition={{ duration: 0.3, ease: 'easeOut' }}
              >
                <TourPhase
                  onComplete={() => setPhase('wallet')}
                  onSkip={onClose}
                />
              </motion.div>
            ) : (
              <motion.div
                key="wallet"
                className="absolute inset-0"
                initial={{ opacity: 0, x: 40 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -40 }}
                transition={{ duration: 0.3, ease: 'easeOut' }}
              >
                <WalletPhase
                  onComplete={onClose}
                  onBack={() => setPhase('tour')}
                />
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
