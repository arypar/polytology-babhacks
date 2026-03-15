'use client';

import { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import {
  ComposedChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from 'recharts';
import {
  ArrowLeft, RefreshCw, ExternalLink, TrendingUp, TrendingDown,
  Zap, AlertTriangle, Eye, Loader2,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  fetchMarketHistory,
  fetchOrderBook,
  fetchMarketTrades,
  fetchMarketNews,
} from '@/lib/polymarket-data';
import type { PolymarketMarket, PolymarketPricePoint } from '@/lib/types';
import type { OrderBook, NormalizedTrade, AlphaTip, NewsArticle } from '@/lib/polymarket-data';
import type { PolymarketSession } from '@/hooks/usePolymarketSession';
import { recordTrade } from '@/lib/store';
import { cn } from '@/lib/utils';

function fmt$(n: number) {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(1)}K`;
  return `$${n.toFixed(0)}`;
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function fmtTime(ts: number) {
  return new Date(ts).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
}

function fmtChartDate(ts: number, range: Range) {
  const d = new Date(ts);
  if (range === '24H') return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

type Range = '24H' | '7D' | '30D';

const TIP_ICONS: Record<AlphaTip['kind'], React.ElementType> = {
  large_buy: TrendingUp,
  large_sell: TrendingDown,
  one_sided_pressure: Zap,
  unusual_activity: AlertTriangle,
  whale_accumulation: Eye,
};

const TIP_COLORS: Record<AlphaTip['severity'], string> = {
  high: '#ef4444',
  medium: '#1652F0',
  low: '#4a4a5a',
};

// ── Panel wrapper ──────────────────────────────────────────────────────────

function Panel({ title, children, action }: { title: string; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div style={{ border: '1px solid var(--border)', backgroundColor: 'var(--bg-card)' }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '5px 10px',
          borderBottom: '1px solid var(--border)',
          backgroundColor: 'var(--bg-elevated)',
        }}
      >
        <span className="terminal-label">{title}</span>
        {action}
      </div>
      {children}
    </div>
  );
}

// ── Chart tooltip ──────────────────────────────────────────────────────────

function ChartTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ value: number; name: string; color: string }>;
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div
      className="px-2.5 py-1.5 text-[11px]"
      style={{
        backgroundColor: 'var(--bg-elevated)',
        border: '1px solid var(--border-strong)',
        color: 'var(--text)',
      }}
    >
      <div className="terminal-label mb-1">{label}</div>
      {payload.map((p) => (
        <div key={p.name} className="flex items-center gap-2">
          <span className="w-1.5 h-1.5 inline-block" style={{ backgroundColor: p.color }} />
          <span style={{ color: 'var(--text-secondary)' }}>{p.name}:</span>
          <span className="font-mono font-semibold" style={{ color: p.color }}>
            {`${(p.value * 100).toFixed(1)}%`}
          </span>
        </div>
      ))}
    </div>
  );
}

// ── Price chart ────────────────────────────────────────────────────────────

function PriceChart({ market, fullWidth }: { market: PolymarketMarket; fullWidth?: boolean }) {
  const [range, setRange] = useState<Range>('30D');
  const [history, setHistory] = useState<PolymarketPricePoint[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetchMarketHistory(market.conditionId).then(data => {
      setHistory(data);
      setLoading(false);
    });
  }, [market.conditionId]);

  const chartData = useMemo(() => {
    const now = Date.now();
    const cutoffs: Record<Range, number> = {
      '24H': now - 24 * 3600 * 1000,
      '7D': now - 7 * 24 * 3600 * 1000,
      '30D': now - 30 * 24 * 3600 * 1000,
    };
    return history
      .filter(p => p.t >= cutoffs[range])
      .map(p => ({
        time: fmtChartDate(p.t, range),
        yes: p.p,
        no: Math.max(0, 1 - p.p),
      }));
  }, [history, range]);

  return (
    <Panel
      title="PRICE HISTORY"
      action={
        <div style={{ display: 'flex', gap: 2 }}>
          {(['24H', '7D', '30D'] as Range[]).map(r => (
            <button
              key={r}
              onClick={() => setRange(r)}
              className="font-mono text-[9px] font-semibold px-1.5 py-0.5 transition-colors"
              style={
                range === r
                  ? { backgroundColor: 'var(--accent)', color: '#000' }
                  : { backgroundColor: 'transparent', color: 'var(--text-tertiary)', border: '1px solid var(--border)' }
              }
            >
              {r}
            </button>
          ))}
        </div>
      }
    >
      <div style={{ padding: '8px 4px 4px 4px' }}>
        {loading ? (
          <div style={{ height: fullWidth ? 280 : 180, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span className="terminal-label">LOADING…</span>
          </div>
        ) : chartData.length === 0 ? (
          <div style={{ height: fullWidth ? 280 : 180, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span className="terminal-label">NO DATA</span>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={fullWidth ? 280 : 180}>
            <ComposedChart data={chartData} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
              <CartesianGrid strokeDasharray="2 4" stroke="rgba(255,255,255,0.04)" vertical={false} />
              <XAxis
                dataKey="time"
                tick={{ fill: '#4a4a5a', fontSize: 9, fontFamily: 'var(--font-geist-mono)' }}
                tickLine={false}
                axisLine={false}
                interval="preserveStartEnd"
              />
              <YAxis
                domain={[0, 1]}
                tickFormatter={v => `${(v * 100).toFixed(0)}%`}
                tick={{ fill: '#4a4a5a', fontSize: 9, fontFamily: 'var(--font-geist-mono)' }}
                tickLine={false}
                axisLine={false}
                tickCount={5}
              />
              <Tooltip content={<ChartTooltip />} />
              <Line
                type="monotone"
                dataKey="yes"
                name="YES"
                stroke="#22c55e"
                strokeWidth={1.5}
                dot={false}
                activeDot={{ r: 3, fill: '#22c55e' }}
              />
              <Line
                type="monotone"
                dataKey="no"
                name="NO"
                stroke="#ef4444"
                strokeWidth={1}
                strokeDasharray="3 3"
                dot={false}
                activeDot={{ r: 3, fill: '#ef4444' }}
              />
            </ComposedChart>
          </ResponsiveContainer>
        )}
      </div>
    </Panel>
  );
}

// ── Order book ─────────────────────────────────────────────────────────────

function OrderBookPanel({ conditionId }: { conditionId: string }) {
  const [book, setBook] = useState<OrderBook | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState<number>(Date.now());
  const cancelRef = useRef<() => void>(() => {});

  const load = useCallback(() => {
    cancelRef.current();
    let cancelled = false;
    cancelRef.current = () => { cancelled = true; };
    setLoading(true);
    fetchOrderBook(conditionId).then(data => {
      if (cancelled) return;
      setBook(data);
      setLoading(false);
      setLastRefresh(Date.now());
    });
  }, [conditionId]);

  useEffect(() => {
    load();
    return () => { cancelRef.current(); };
  }, [load]);

  const maxSize = useMemo(
    () => Math.max(
      ...(book?.bids ?? []).map(b => b.size),
      ...(book?.asks ?? []).map(a => a.size),
      1,
    ),
    [book],
  );

  return (
    <Panel
      title="ORDER BOOK"
      action={
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {book?.spread !== null && book?.spread !== undefined && (
            <span className="terminal-label">
              SPD {(book.spread * 100).toFixed(1)}¢
            </span>
          )}
          <span className="terminal-label">{fmtTime(lastRefresh)}</span>
          <button
            onClick={load}
            style={{ color: 'var(--text-tertiary)' }}
            onMouseEnter={e => (e.currentTarget.style.color = 'var(--accent)')}
            onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-tertiary)')}
          >
            <RefreshCw className={cn('h-2.5 w-2.5', loading && 'animate-spin')} />
          </button>
        </div>
      }
    >
      {loading && !book ? (
        <div style={{ height: 120, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <span className="terminal-label">LOADING…</span>
        </div>
      ) : (
        <div>
          {/* Column headers */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              padding: '4px 8px',
              borderBottom: '1px solid var(--border)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', paddingRight: 6 }}>
              <span className="terminal-label">SIZE</span>
              <span className="terminal-label" style={{ color: '#22c55e' }}>BID</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', paddingLeft: 6 }}>
              <span className="terminal-label" style={{ color: '#ef4444' }}>ASK</span>
              <span className="terminal-label">SIZE</span>
            </div>
          </div>

          {/* Bids + Asks side by side */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr' }}>
            {/* Bids */}
            <div style={{ borderRight: '1px solid var(--border)' }}>
              {(book?.bids ?? []).slice(0, 10).map((bid, i) => {
                const pct = (bid.size / maxSize) * 100;
                return (
                  <div
                    key={i}
                    style={{
                      position: 'relative',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: '2px 6px',
                      overflow: 'hidden',
                      minHeight: 20,
                    }}
                  >
                    <div
                      style={{
                        position: 'absolute',
                        inset: 0,
                        width: `${pct}%`,
                        backgroundColor: 'rgba(34,197,94,0.07)',
                        left: 'auto',
                        right: 0,
                      }}
                    />
                    <span className="metric text-[10px]" style={{ color: 'var(--text-tertiary)', position: 'relative' }}>
                      {bid.size.toFixed(0)}
                    </span>
                    <span className="metric text-[11px] font-semibold" style={{ color: '#22c55e', position: 'relative' }}>
                      {(bid.price * 100).toFixed(1)}¢
                    </span>
                  </div>
                );
              })}
            </div>

            {/* Asks */}
            <div>
              {(book?.asks ?? []).slice(0, 10).map((ask, i) => {
                const pct = (ask.size / maxSize) * 100;
                return (
                  <div
                    key={i}
                    style={{
                      position: 'relative',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: '2px 6px',
                      overflow: 'hidden',
                      minHeight: 20,
                    }}
                  >
                    <div
                      style={{
                        position: 'absolute',
                        inset: 0,
                        width: `${pct}%`,
                        backgroundColor: 'rgba(239,68,68,0.07)',
                      }}
                    />
                    <span className="metric text-[11px] font-semibold" style={{ color: '#ef4444', position: 'relative' }}>
                      {(ask.price * 100).toFixed(1)}¢
                    </span>
                    <span className="metric text-[10px]" style={{ color: 'var(--text-tertiary)', position: 'relative' }}>
                      {ask.size.toFixed(0)}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Spread bar */}
          {book?.bestBid !== null && book?.bestAsk !== null && book?.bestBid !== undefined && book?.bestAsk !== undefined && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                padding: '4px 8px',
                borderTop: '1px solid var(--border)',
              }}
            >
              <span className="metric text-[10px] font-semibold" style={{ color: '#22c55e' }}>
                {(book.bestBid * 100).toFixed(1)}¢
              </span>
              <div style={{ flex: 1, height: 2, backgroundColor: 'var(--bg-elevated)', position: 'relative', overflow: 'hidden' }}>
                <div style={{
                  position: 'absolute',
                  height: '100%',
                  left: `${book.bestBid * 100}%`,
                  width: `${(book.bestAsk - book.bestBid) * 100}%`,
                  backgroundColor: 'var(--accent)',
                  minWidth: 2,
                }} />
              </div>
              <span className="metric text-[10px] font-semibold" style={{ color: '#ef4444' }}>
                {(book.bestAsk * 100).toFixed(1)}¢
              </span>
            </div>
          )}
        </div>
      )}
    </Panel>
  );
}

// ── Alpha Tips ─────────────────────────────────────────────────────────────

function AlphaTipsPanel({ conditionId }: { conditionId: string }) {
  const [tips, setTips] = useState<AlphaTip[]>([]);
  const [trades, setTrades] = useState<NormalizedTrade[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetchMarketTrades(conditionId).then(data => {
      if (cancelled) return;
      setTips(data.alphaTips);
      setTrades(data.trades);
      setLoading(false);
    });
    return () => { cancelled = true; };
  }, [conditionId]);

  return (
    <Panel
      title={`ALPHA SIGNALS${!loading && tips.length > 0 ? ` (${tips.length})` : ''}`}
    >
      {loading ? (
        <div style={{ height: 80, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <span className="terminal-label">LOADING…</span>
        </div>
      ) : tips.length === 0 ? (
        <div style={{ padding: '12px 10px' }}>
          <span className="terminal-label">NO UNUSUAL ACTIVITY</span>
        </div>
      ) : (
        <div>
          {tips.map((tip, i) => {
            const Icon = TIP_ICONS[tip.kind];
            const color = TIP_COLORS[tip.severity];
            return (
              <div
                key={i}
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: 8,
                  padding: '6px 10px',
                  borderBottom: '1px solid var(--border)',
                  borderLeft: `2px solid ${color}`,
                }}
              >
                <Icon className="h-3 w-3 mt-0.5 shrink-0" style={{ color }} />
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span className="text-[11px] font-medium" style={{ color: 'var(--text)' }}>
                      {tip.label}
                    </span>
                    <span
                      className="font-mono text-[8px] font-bold tracking-wider"
                      style={{ color }}
                    >
                      {tip.severity.toUpperCase()}
                    </span>
                  </div>
                  <p className="text-[10px] mt-0.5" style={{ color: 'var(--text-secondary)' }}>
                    {tip.detail}
                  </p>
                </div>
                {tip.ts && tip.ts > 0 && (
                  <span className="terminal-label shrink-0">{fmtTime(tip.ts)}</span>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Recent trades */}
      {trades.length > 0 && (
        <div>
          <div
            style={{
              padding: '4px 10px',
              borderTop: '1px solid var(--border)',
              borderBottom: '1px solid var(--border)',
              backgroundColor: 'var(--bg-elevated)',
            }}
          >
            <span className="terminal-label">RECENT TRADES</span>
          </div>
          {trades.slice(0, 8).map((t, i) => (
            <div
              key={i}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '3px 10px',
                borderBottom: '1px solid rgba(255,255,255,0.04)',
              }}
            >
              <span
                className="font-mono text-[9px] font-bold w-7 shrink-0"
                style={{ color: t.side === 'BUY' ? '#22c55e' : '#ef4444' }}
              >
                {t.side}
              </span>
              <span className="font-mono text-[10px] shrink-0 w-6" style={{ color: 'var(--text-tertiary)' }}>
                {t.outcome}
              </span>
              <span className="metric text-[10px] font-semibold flex-1 text-center" style={{ color: 'var(--text)' }}>
                {(t.price * 100).toFixed(1)}¢
              </span>
              <span className="metric text-[10px]" style={{ color: 'var(--text-secondary)' }}>
                {fmt$(t.notional)}
              </span>
              {t.ts > 0 && (
                <span className="terminal-label ml-2">{fmtTime(t.ts)}</span>
              )}
            </div>
          ))}
        </div>
      )}
    </Panel>
  );
}

// ── News panel ─────────────────────────────────────────────────────────────

function timeAgo(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const m = Math.floor(ms / 60000);
  if (m < 2) return 'NOW';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

const SOURCE_ACCENT: Record<string, string> = {
  reuters: '#f97316', bloomberg: '#8b5cf6', 'associated press': '#10b981',
  bbc: '#facc15', cnn: '#ef4444', 'fox news': '#3b82f6',
  politico: '#f43f5e', axios: '#6366f1', 'the guardian': '#22d3ee',
  default: '#1652F0',
};

function getSourceColor(source?: string) {
  if (!source) return SOURCE_ACCENT.default;
  return SOURCE_ACCENT[source.toLowerCase()] ?? SOURCE_ACCENT.default;
}

function NewsPanel({ market }: { market: PolymarketMarket }) {
  const [articles, setArticles] = useState<NewsArticle[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetchMarketNews(market.conditionId, market.question).then(data => {
      if (cancelled) return;
      setArticles(data.articles);
      setError(data.error ?? null);
      setLoading(false);
    });
    return () => { cancelled = true; };
  }, [market.conditionId, market.question]);

  return (
    <div style={{ border: '1px solid var(--border)', backgroundColor: 'var(--bg-card)' }}>
      {/* Panel header */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '5px 10px', borderBottom: '1px solid var(--border)',
        backgroundColor: 'var(--bg-elevated)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span
            className="inline-block h-1.5 w-1.5 rounded-full animate-pulse"
            style={{ backgroundColor: '#22c55e', boxShadow: '0 0 5px #22c55e' }}
          />
          <span className="terminal-label">NEWS INTEL</span>
          {!loading && articles.length > 0 && (
            <span
              className="font-mono text-[9px] font-bold px-1.5"
              style={{
                color: 'var(--accent)', border: '1px solid rgba(22,82,240,0.3)',
                backgroundColor: 'rgba(22,82,240,0.08)',
              }}
            >
              {articles.length} SIGNALS
            </span>
          )}
        </div>
        <span className="terminal-label" style={{ color: 'var(--text-tertiary)' }}>LIVE FEED</span>
      </div>

      {/* Loading: skeleton cards */}
      {loading ? (
        <div style={{ padding: '8px 10px', display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div className="skeleton" style={{ height: 80 }} />
          {[0, 1, 2].map(i => (
            <div key={i} className="skeleton" style={{ height: 44, animationDelay: `${0.1 + i * 0.08}s` }} />
          ))}
        </div>
      ) : error ? (
        <div style={{ padding: '14px 10px', display: 'flex', alignItems: 'center', gap: 8 }}>
          <AlertTriangle className="h-3 w-3" style={{ color: '#ef4444' }} />
          <span className="terminal-label" style={{ color: '#ef4444' }}>
            {error.includes('not configured') ? 'SET NEWS_API_KEY IN BACKEND/.ENV' : 'FEED UNAVAILABLE'}
          </span>
        </div>
      ) : articles.length === 0 ? (
        <div style={{ padding: '14px 10px' }}>
          <span className="terminal-label">NO SIGNALS DETECTED</span>
        </div>
      ) : (
        <div>
          {articles.map((a, i) => {
            const isFeatured = i === 0;
            const srcColor = getSourceColor(a.source);
            const delay = `${i * 55}ms`;

            return (
              <a
                key={i}
                href={a.url}
                target="_blank"
                rel="noopener noreferrer"
                className="news-article-enter"
                style={{
                  animationDelay: delay,
                  display: 'flex',
                  borderBottom: '1px solid rgba(255,255,255,0.04)',
                  textDecoration: 'none',
                  position: 'relative',
                  overflow: 'hidden',
                  transition: 'background-color 0.1s',
                }}
                onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'var(--bg-row-hover)')}
                onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
              >
                {/* Left accent bar */}
                <div style={{
                  width: isFeatured ? 3 : 2,
                  flexShrink: 0,
                  backgroundColor: isFeatured ? srcColor : 'rgba(255,255,255,0.06)',
                  transition: 'background-color 0.2s',
                }} />

                {/* Content */}
                <div style={{ flex: 1, padding: isFeatured ? '10px 10px 10px 10px' : '7px 10px', minWidth: 0 }}>

                  {/* Source row */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: isFeatured ? 5 : 3 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                      {isFeatured && (
                        <span
                          className="font-mono text-[8px] font-bold tracking-widest px-1.5 py-0"
                          style={{ backgroundColor: srcColor, color: '#000' }}
                        >
                          TOP
                        </span>
                      )}
                      {a.source && (
                        <span
                          className="font-mono text-[9px] font-bold tracking-wide"
                          style={{ color: srcColor, opacity: isFeatured ? 1 : 0.75 }}
                        >
                          {a.source.toUpperCase()}
                        </span>
                      )}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
                      <span className="terminal-label">{timeAgo(a.publishedAt)}</span>
                      <ExternalLink className="h-2 w-2 shrink-0" style={{ color: 'var(--text-tertiary)' }} />
                    </div>
                  </div>

                  {/* Headline */}
                  <p
                    className="leading-snug"
                    style={{
                      fontSize: isFeatured ? 12 : 11,
                      fontWeight: isFeatured ? 600 : 500,
                      color: isFeatured ? 'var(--text)' : 'var(--text-secondary)',
                      overflow: 'hidden',
                      display: '-webkit-box',
                      WebkitLineClamp: isFeatured ? 2 : 1,
                      WebkitBoxOrient: 'vertical',
                    }}
                  >
                    {a.title}
                  </p>

                  {/* Description — featured only */}
                  {isFeatured && a.description && (
                    <p
                      className="text-[10px] mt-1.5 leading-relaxed"
                      style={{
                        color: 'var(--text-tertiary)',
                        overflow: 'hidden',
                        display: '-webkit-box',
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: 'vertical',
                      }}
                    >
                      {a.description}
                    </p>
                  )}
                </div>
              </a>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Market Detail View ─────────────────────────────────────────────────────


interface MarketDetailViewProps {
  market: PolymarketMarket;
  onBack: () => void;
  sessionStatus?: PolymarketSession['status'];
  placeOrder?: PolymarketSession['placeOrder'];
  eoaAddress?: PolymarketSession['eoaAddress'];
  safeAddress?: PolymarketSession['safeAddress'];
  onNeedOnboarding?: () => void;
}

export function MarketDetailView({
  market,
  onBack,
  sessionStatus,
  placeOrder,
  eoaAddress,
  safeAddress,
  onNeedOnboarding,
}: MarketDetailViewProps) {
  const yes = market.outcomes.find(o => o.name === 'Yes') ?? market.outcomes[0];
  const no = market.outcomes.find(o => o.name === 'No') ?? market.outcomes[1];
  const isUp = market.priceChange24h >= 0;
  const yesPrice = yes?.price ?? 0.5;
  const noPrice = no?.price ?? 0.5;

  const [tradeSide, setTradeSide] = useState<'YES' | 'NO' | null>(null);
  const [tradeAmount, setTradeAmount] = useState('10');
  const [bought, setBought] = useState<'YES' | 'NO' | null>(null);
  const [isTrading, setIsTrading] = useState(false);

  function handleSideClick(side: 'YES' | 'NO') {
    if (sessionStatus !== 'ready') { onNeedOnboarding?.(); return; }
    if (tradeSide === side) {
      setTradeSide(null);
    } else {
      setTradeSide(side);
      setTradeAmount('10');
    }
  }

  async function handleBuy() {
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
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>

      {/* ── Sticky header ── */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          padding: '10px 16px',
          borderBottom: '1px solid var(--border)',
          backgroundColor: 'var(--bg-elevated)',
          position: 'sticky',
          top: 0,
          zIndex: 10,
        }}
      >
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 font-mono text-[10px] font-semibold tracking-wider transition-colors shrink-0"
          style={{ color: 'var(--text-tertiary)' }}
          onMouseEnter={e => (e.currentTarget.style.color = 'var(--accent)')}
          onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-tertiary)')}
          title="Back to markets"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          MARKETS
        </button>

        <div style={{ width: 1, height: 20, backgroundColor: 'var(--border)', flexShrink: 0 }} />

        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, minWidth: 0 }}>
          <span
            className="font-mono text-[9px] font-bold tracking-widest px-1.5 py-0.5 shrink-0"
            style={{ backgroundColor: 'rgba(245,158,11,0.1)', color: 'var(--accent)', border: '1px solid rgba(245,158,11,0.2)' }}
          >
            {market.category.toUpperCase()}
          </span>
          <span
            className="font-mono text-[9px] font-bold tracking-widest shrink-0"
            style={{ color: market.active ? '#22c55e' : 'var(--text-tertiary)' }}
          >
            {market.active ? '● LIVE' : '○ CLOSED'}
          </span>
          <p
            className="text-[13px] font-medium truncate"
            style={{ color: 'var(--text)', minWidth: 0 }}
            title={market.question}
          >
            {market.question}
          </p>
        </div>
      </div>

      {/* ── Stats strip ── */}
      <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', backgroundColor: 'var(--bg-elevated)', flexShrink: 0 }}>
        <div style={{ padding: '8px 16px', borderRight: '1px solid var(--border)' }}>
          <div className="terminal-label">YES</div>
          <div className="metric text-[18px] font-bold" style={{ color: '#22c55e' }}>
            {(yesPrice * 100).toFixed(1)}¢
          </div>
          <div className="metric text-[10px]" style={{ color: isUp ? '#22c55e' : '#ef4444' }}>
            {isUp ? '▲' : '▼'}{Math.abs(market.priceChange24h * 100).toFixed(1)}% 24h
          </div>
        </div>
        <div style={{ padding: '8px 16px', borderRight: '1px solid var(--border)' }}>
          <div className="terminal-label">NO</div>
          <div className="metric text-[18px] font-bold" style={{ color: '#ef4444' }}>
            {(noPrice * 100).toFixed(1)}¢
          </div>
        </div>
        <div style={{ padding: '8px 16px', borderRight: '1px solid var(--border)' }}>
          <div className="terminal-label">VOL 24H</div>
          <div className="metric text-[15px] font-bold" style={{ color: 'var(--text)' }}>
            {fmt$(market.volume24h)}
          </div>
        </div>
        <div style={{ padding: '8px 16px', borderRight: '1px solid var(--border)' }}>
          <div className="terminal-label">LIQUIDITY</div>
          <div className="metric text-[15px] font-bold" style={{ color: 'var(--text)' }}>
            {fmt$(market.liquidity)}
          </div>
        </div>
        <div style={{ padding: '8px 16px', borderRight: '1px solid var(--border)' }}>
          <div className="terminal-label">CLOSES</div>
          <div className="metric text-[13px]" style={{ color: 'var(--text-secondary)' }}>
            {new Date(market.endDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
          </div>
        </div>

        {/* Trade buttons */}
        {market.active && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '0 16px' }}>
            {tradeSide ? (
              <>
                <span className="font-mono text-[10px] font-bold" style={{ color: tradeSide === 'YES' ? '#22c55e' : '#ef4444' }}>
                  BUY {tradeSide}
                </span>
                <span className="font-mono text-[10px]" style={{ color: 'var(--text-tertiary)' }}>$</span>
                <input
                  autoFocus
                  type="number"
                  min="1"
                  value={tradeAmount}
                  onChange={e => setTradeAmount(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') handleBuy(); if (e.key === 'Escape') setTradeSide(null); }}
                  className="font-mono text-[10px] font-bold w-16 px-2 py-1 bg-transparent border outline-none"
                  style={{ color: 'var(--text)', borderColor: tradeSide === 'YES' ? '#22c55e' : '#ef4444' }}
                  placeholder="10"
                />
                <button
                  disabled={isTrading}
                  onClick={handleBuy}
                  className="font-mono text-[10px] font-bold px-3 py-1.5 transition-colors disabled:opacity-40"
                  style={tradeSide === 'YES'
                    ? { backgroundColor: 'rgba(34,197,94,0.2)', color: '#22c55e', border: '1px solid #22c55e' }
                    : { backgroundColor: 'rgba(239,68,68,0.2)', color: '#ef4444', border: '1px solid #ef4444' }
                  }
                >
                  {isTrading ? <Loader2 className="inline h-3 w-3 animate-spin" /> : 'Confirm'}
                </button>
                <button
                  onClick={() => setTradeSide(null)}
                  className="font-mono text-[10px] px-2 py-1.5 transition-colors"
                  style={{ color: 'var(--text-tertiary)' }}
                >✕</button>
              </>
            ) : (
              <>
                <button
                  disabled={isTrading}
                  onClick={() => handleSideClick('YES')}
                  className="font-mono text-[10px] font-bold px-3 py-1.5 transition-colors disabled:opacity-40"
                  style={
                    bought === 'YES'
                      ? { backgroundColor: '#22c55e', color: '#000' }
                      : { backgroundColor: 'rgba(34,197,94,0.08)', color: '#22c55e', border: '1px solid rgba(34,197,94,0.3)' }
                  }
                >
                  {bought === 'YES' ? '✓ YES' : `BUY YES ${(yesPrice * 100).toFixed(0)}¢`}
                </button>
                <button
                  disabled={isTrading}
                  onClick={() => handleSideClick('NO')}
                  className="font-mono text-[10px] font-bold px-3 py-1.5 transition-colors disabled:opacity-40"
                  style={
                    bought === 'NO'
                      ? { backgroundColor: '#ef4444', color: '#000' }
                      : { backgroundColor: 'rgba(239,68,68,0.08)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.3)' }
                  }
                >
                  {bought === 'NO' ? '✓ NO' : `BUY NO ${(noPrice * 100).toFixed(0)}¢`}
                </button>
              </>
            )}
          </div>
        )}
      </div>

      {/* ── Main content ── */}
      <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, overflow: 'hidden' }}>

        {/* Price chart: full width across the top */}
        <div style={{ flexShrink: 0, borderBottom: '1px solid var(--border)' }}>
          <PriceChart market={market} fullWidth />
        </div>

        {/* Bottom row: order book + alpha left, news right — each column independently scrollable */}
        <div style={{ display: 'grid', gridTemplateColumns: '360px 1fr', flex: 1, minHeight: 0, overflow: 'hidden' }}>

          {/* Left: order book stacked above alpha signals */}
          <div style={{ borderRight: '1px solid var(--border)', overflow: 'auto', display: 'flex', flexDirection: 'column' }}>
            <OrderBookPanel conditionId={market.conditionId} />
            <AlphaTipsPanel conditionId={market.conditionId} />
          </div>

          {/* Right: news feed fills remaining width */}
          <div style={{ overflow: 'auto' }}>
            <NewsPanel market={market} />
          </div>
        </div>
      </div>
    </div>
  );
}
