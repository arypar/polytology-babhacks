'use client';

import { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import {
  ComposedChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from 'recharts';
import {
  ArrowLeft, RefreshCw, ExternalLink, TrendingUp, TrendingDown,
  Zap, AlertTriangle, Eye,
} from 'lucide-react';
import {
  fetchMarketHistory,
  fetchOrderBook,
  fetchMarketTrades,
  fetchMarketNews,
} from '@/lib/polymarket-data';
import type { PolymarketMarket, PolymarketPricePoint } from '@/lib/types';
import type { OrderBook, NormalizedTrade, AlphaTip, NewsArticle } from '@/lib/polymarket-data';
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
    <Panel title="RELATED NEWS">
      {loading ? (
        <div style={{ height: 60, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <span className="terminal-label">LOADING…</span>
        </div>
      ) : error ? (
        <div style={{ padding: '10px' }}>
          <span className="terminal-label">
            {error.includes('not configured') ? 'SET NEWS_API_KEY IN BACKEND/.ENV' : 'FAILED TO LOAD'}
          </span>
        </div>
      ) : articles.length === 0 ? (
        <div style={{ padding: '10px' }}>
          <span className="terminal-label">NO RECENT NEWS</span>
        </div>
      ) : (
        <div>
          {articles.map((a, i) => (
            <a
              key={i}
              href={a.url}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: 'flex',
                gap: 8,
                padding: '8px 10px',
                borderBottom: '1px solid rgba(255,255,255,0.04)',
                textDecoration: 'none',
              }}
              onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'var(--bg-row-hover)')}
              onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
            >
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 6 }}>
                  <p
                    className="text-[11px] font-medium leading-snug"
                    style={{ color: 'var(--text)', overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}
                  >
                    {a.title}
                  </p>
                  <ExternalLink className="h-2.5 w-2.5 shrink-0 mt-0.5" style={{ color: 'var(--text-tertiary)' }} />
                </div>
                <div style={{ display: 'flex', gap: 8, marginTop: 3 }}>
                  {a.source && (
                    <span className="font-mono text-[9px]" style={{ color: 'var(--accent)' }}>{a.source}</span>
                  )}
                  {a.publishedAt && (
                    <span className="terminal-label">{fmtDate(a.publishedAt)}</span>
                  )}
                </div>
              </div>
            </a>
          ))}
        </div>
      )}
    </Panel>
  );
}

// ── Market Detail View ─────────────────────────────────────────────────────

interface MarketDetailViewProps {
  market: PolymarketMarket;
  onBack: () => void;
}

export function MarketDetailView({ market, onBack }: MarketDetailViewProps) {
  const yes = market.outcomes.find(o => o.name === 'Yes') ?? market.outcomes[0];
  const no = market.outcomes.find(o => o.name === 'No') ?? market.outcomes[1];
  const isUp = market.priceChange24h >= 0;
  const yesPrice = yes?.price ?? 0.5;
  const noPrice = no?.price ?? 0.5;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100%' }}>

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
        <div style={{ padding: '8px 16px' }}>
          <div className="terminal-label">CLOSES</div>
          <div className="metric text-[13px]" style={{ color: 'var(--text-secondary)' }}>
            {new Date(market.endDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
          </div>
        </div>
      </div>

      {/* ── Main content grid ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', flex: 1, minHeight: 0 }}>

        {/* Left column: chart + news */}
        <div style={{ borderRight: '1px solid var(--border)', overflow: 'auto' }}>
          <PriceChart market={market} fullWidth />
          <NewsPanel market={market} />
        </div>

        {/* Right column: order book + alpha tips */}
        <div style={{ overflow: 'auto' }}>
          <OrderBookPanel conditionId={market.conditionId} />
          <AlphaTipsPanel conditionId={market.conditionId} />
        </div>
      </div>
    </div>
  );
}
