'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  AreaChart, Area, XAxis, YAxis, Tooltip as RechartsTooltip,
  ResponsiveContainer, CartesianGrid,
} from 'recharts';
import {
  Search, TrendingUp, TrendingDown, RefreshCw, ExternalLink,
  ChevronDown, ChevronUp, Twitter, User, Wallet,
} from 'lucide-react';
import { usePolymarketSession } from '@/hooks/usePolymarketSession';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

// ── Types ──────────────────────────────────────────────────────────────────

interface DailyBucket {
  buyNotional: number;
  sellNotional: number;
  count: number;
}

interface Trade {
  id: string;
  date: string;
  ts: number;
  side: 'BUY' | 'SELL';
  outcome: string;
  market: string;
  title: string;
  notional: number;
  size: number;
  price: number;
}

interface Position {
  conditionId: string;
  title: string;
  outcome: string;
  size: number;
  avgPrice: number;
  currentPrice: number;
  initialValue: number;
  currentValue: number;
  unrealizedPnl: number;
  unrealizedPnlPct: number;
  redeemable: boolean;
}

interface PnlStats {
  totalProfit: number;
  totalVolume: number;
  tradesCount: number;
  positionsValue: number;
  winRate: number | null;
}

interface UserProfile {
  address: string;
  eoaAddress: string;
  name: string;
  username: string;
  bio: string;
  avatarUrl: string;
  twitterUsername: string;
  polymarketUrl: string;
}

// ── Helpers ────────────────────────────────────────────────────────────────

function fmt$(n: number, compact = false): string {
  if (compact && Math.abs(n) >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (compact && Math.abs(n) >= 1_000) return `$${(n / 1_000).toFixed(1)}K`;
  return new Intl.NumberFormat('en-US', {
    style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 2,
  }).format(n);
}

function relativeTime(ts: number): string {
  const diff = Date.now() - ts;
  const m = Math.floor(diff / 60_000);
  if (m < 1) return 'now';
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  return `${Math.floor(h / 24)}d`;
}

function isValidAddress(addr: string): boolean {
  return /^0x[0-9a-fA-F]{40}$/.test(addr.trim());
}

function looksLikeUsername(s: string): boolean {
  const trimmed = s.trim();
  return trimmed.length >= 2 && !trimmed.startsWith('0x') && /^[a-zA-Z0-9_.-]+$/.test(trimmed);
}

function buildWeekGrid(): string[] {
  const days: string[] = [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  for (let i = 363; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    days.push(d.toISOString().slice(0, 10));
  }
  return days;
}

function cellColor(bucket: DailyBucket | undefined, maxNotional: number): string {
  if (!bucket || bucket.count === 0) return 'rgba(255,255,255,0.04)';
  const net = bucket.buyNotional - bucket.sellNotional;
  const intensity = Math.min(Math.abs(net) / (maxNotional || 1), 1);
  const alpha = 0.15 + intensity * 0.7;
  if (net >= 0) return `rgba(34, 197, 94, ${alpha.toFixed(2)})`;
  return `rgba(239, 68, 68, ${alpha.toFixed(2)})`;
}

// ── Heatmap ────────────────────────────────────────────────────────────────

interface HeatmapTooltipState {
  date: string;
  bucket: DailyBucket;
  x: number;
  y: number;
}

function TradeHeatmap({ dailyBuckets }: { dailyBuckets: Record<string, DailyBucket> }) {
  const days = useMemo(() => buildWeekGrid(), []);
  const [tooltip, setTooltip] = useState<HeatmapTooltipState | null>(null);

  const maxNotional = useMemo(() => {
    return Math.max(1, ...Object.values(dailyBuckets).map(b => Math.abs(b.buyNotional - b.sellNotional)));
  }, [dailyBuckets]);

  const weeks: string[][] = [];
  for (let i = 0; i < days.length; i += 7) weeks.push(days.slice(i, i + 7));

  const monthLabels: { label: string; col: number }[] = [];
  let lastMonth = '';
  weeks.forEach((week, col) => {
    const month = new Date(week[0]).toLocaleString('en-US', { month: 'short' });
    if (month !== lastMonth) { monthLabels.push({ label: month, col }); lastMonth = month; }
  });

  const DAY_SIZE = 10;
  const DAY_GAP = 2;
  const step = DAY_SIZE + DAY_GAP;

  return (
    <div style={{ border: '1px solid var(--border)', backgroundColor: 'var(--bg-card)' }}>
      <div
        style={{
          padding: '5px 10px',
          borderBottom: '1px solid var(--border)',
          backgroundColor: 'var(--bg-elevated)',
        }}
      >
        <span className="terminal-label">Trade activity — 52 weeks</span>
      </div>
      <div style={{ padding: '10px', position: 'relative' }}>
        <div style={{ overflowX: 'auto' }}>
          <div style={{ minWidth: weeks.length * step + 40 }}>
            <div style={{ display: 'flex', marginBottom: 3, paddingLeft: 16, gap: 0 }}>
              {weeks.map((_, col) => {
                const ml = monthLabels.find(m => m.col === col);
                return (
                  <div key={col} style={{ width: step, flexShrink: 0 }}>
                    <span className="terminal-label" style={{ fontSize: 8 }}>{ml?.label ?? ''}</span>
                  </div>
                );
              })}
            </div>
            <div style={{ display: 'flex' }}>
              <div style={{ display: 'flex', flexDirection: 'column', marginRight: 3, gap: DAY_GAP }}>
                {['S','M','T','W','T','F','S'].map((d, i) => (
                  <div key={i} style={{ width: 12, height: DAY_SIZE, lineHeight: `${DAY_SIZE}px`, textAlign: 'right' }}>
                    <span className="terminal-label" style={{ fontSize: 7 }}>{i % 2 === 1 ? d : ''}</span>
                  </div>
                ))}
              </div>
              <div style={{ display: 'flex', gap: DAY_GAP }}>
                {weeks.map((week, col) => (
                  <div key={col} style={{ display: 'flex', flexDirection: 'column', gap: DAY_GAP }}>
                    {week.map(day => {
                      const bucket = dailyBuckets[day];
                      return (
                        <div
                          key={day}
                          style={{
                            width: DAY_SIZE,
                            height: DAY_SIZE,
                            backgroundColor: cellColor(bucket, maxNotional),
                            cursor: bucket?.count ? 'pointer' : 'default',
                          }}
                          onMouseEnter={e => {
                            if (!bucket) return;
                            const rect = e.currentTarget.getBoundingClientRect();
                            const parent = e.currentTarget.closest('.heatmap-root')?.getBoundingClientRect();
                            setTooltip({
                              date: day, bucket,
                              x: rect.left - (parent?.left ?? 0) + DAY_SIZE / 2,
                              y: rect.top - (parent?.top ?? 0) - 8,
                            });
                          }}
                          onMouseLeave={() => setTooltip(null)}
                        />
                      );
                    })}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {tooltip && (
          <div
            className="pointer-events-none absolute z-20 px-2 py-1.5 text-[10px]"
            style={{
              left: tooltip.x,
              top: tooltip.y,
              transform: 'translate(-50%, -100%)',
              backgroundColor: 'var(--bg-elevated)',
              border: '1px solid var(--border-strong)',
              color: 'var(--text)',
              whiteSpace: 'nowrap',
            }}
          >
            <div className="terminal-label mb-0.5">{tooltip.date}</div>
            <div style={{ color: '#22c55e' }}>B {fmt$(tooltip.bucket.buyNotional, true)}</div>
            <div style={{ color: '#ef4444' }}>S {fmt$(tooltip.bucket.sellNotional, true)}</div>
            <div className="terminal-label">{tooltip.bucket.count} trades</div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── PnL chart ──────────────────────────────────────────────────────────────

function PnlChart({ trades }: { trades: Trade[] }) {
  const chartData = useMemo(() => {
    const sorted = [...trades].sort((a, b) => a.ts - b.ts);
    let cumulative = 0;
    return sorted.map(t => {
      const delta = t.side === 'BUY' ? -t.notional : t.notional;
      cumulative += delta;
      return {
        date: t.date,
        pnl: parseFloat(cumulative.toFixed(2)),
        label: new Date(t.ts).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      };
    });
  }, [trades]);

  if (chartData.length === 0) return null;

  const minPnl = Math.min(...chartData.map(d => d.pnl));
  const maxPnl = Math.max(...chartData.map(d => d.pnl));
  const isPositive = chartData[chartData.length - 1]?.pnl >= 0;
  const lineColor = isPositive ? '#22c55e' : '#ef4444';

  return (
    <div style={{ border: '1px solid var(--border)', backgroundColor: 'var(--bg-card)' }}>
      <div
        style={{
          padding: '5px 10px',
          borderBottom: '1px solid var(--border)',
          backgroundColor: 'var(--bg-elevated)',
        }}
      >
        <span className="terminal-label">Cumulative P&amp;L</span>
      </div>
      <div style={{ padding: '8px 4px 4px 4px' }}>
        <ResponsiveContainer width="100%" height={140}>
          <AreaChart data={chartData} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
            <defs>
              <linearGradient id="pnlGradT" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={lineColor} stopOpacity={0.15} />
                <stop offset="95%" stopColor={lineColor} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="2 4" stroke="rgba(255,255,255,0.04)" vertical={false} />
            <XAxis
              dataKey="label"
              tick={{ fontSize: 8, fill: '#4a4a5a', fontFamily: 'var(--font-geist-mono)' }}
              axisLine={false}
              tickLine={false}
              interval="preserveStartEnd"
            />
            <YAxis
              domain={[Math.min(minPnl * 1.1, -1), Math.max(maxPnl * 1.1, 1)]}
              tick={{ fontSize: 8, fill: '#4a4a5a', fontFamily: 'var(--font-geist-mono)' }}
              axisLine={false}
              tickLine={false}
              tickFormatter={v => fmt$(v, true)}
              width={52}
            />
            <RechartsTooltip
              contentStyle={{
                backgroundColor: 'var(--bg-elevated)',
                border: '1px solid var(--border-strong)',
                color: 'var(--text)',
                fontSize: 10,
                fontFamily: 'var(--font-geist-mono)',
              }}
              formatter={(v: number | undefined) => [fmt$(v ?? 0), 'Cumulative P&L']}
            />
            <Area
              type="monotone"
              dataKey="pnl"
              stroke={lineColor}
              strokeWidth={1.5}
              fill="url(#pnlGradT)"
              dot={false}
              activeDot={{ r: 3, fill: lineColor }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

// ── Positions table ────────────────────────────────────────────────────────

function PositionsTable({ positions }: { positions: Position[] }) {
  const [expanded, setExpanded] = useState(true);
  if (positions.length === 0) return null;

  return (
    <div style={{ border: '1px solid var(--border)', backgroundColor: 'var(--bg-card)' }}>
      <button
        onClick={() => setExpanded(e => !e)}
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '5px 10px',
          borderBottom: expanded ? '1px solid var(--border)' : 'none',
          backgroundColor: 'var(--bg-elevated)',
        }}
      >
        <span className="terminal-label">Open positions ({positions.length})</span>
        {expanded
          ? <ChevronUp className="h-3 w-3" style={{ color: 'var(--text-tertiary)' }} />
          : <ChevronDown className="h-3 w-3" style={{ color: 'var(--text-tertiary)' }} />
        }
      </button>

      {expanded && (
        <div style={{ overflowX: 'auto' }}>
          <table className="terminal-table" style={{ width: '100%' }}>
            <thead>
              <tr>
                <th>Market</th>
                <th style={{ width: 44 }}>Side</th>
                <th style={{ width: 60 }}>Size</th>
                <th style={{ width: 70 }}>Avg Entry</th>
                <th style={{ width: 70 }}>Current</th>
                <th style={{ width: 100, textAlign: 'right', paddingRight: 12 }}>Unrealized P&amp;L</th>
              </tr>
            </thead>
            <tbody>
              {positions.map((p, i) => (
                <tr key={p.conditionId + p.outcome + i}>
                  <td style={{ maxWidth: 280 }}>
                    <span
                      className="text-[11px] font-medium truncate block"
                      style={{ color: 'var(--text)' }}
                      title={p.title}
                    >
                      {p.title || p.conditionId.slice(0, 12) + '…'}
                    </span>
                  </td>
                  <td>
                    <span
                      className="font-mono text-[9px] font-bold"
                      style={{ color: p.outcome.toLowerCase() === 'yes' ? '#22c55e' : '#ef4444' }}
                    >
                      {p.outcome.toUpperCase()}
                    </span>
                  </td>
                  <td>
                    <span className="metric text-[11px]" style={{ color: 'var(--text-secondary)' }}>
                      {p.size.toFixed(0)}
                    </span>
                  </td>
                  <td>
                    <span className="metric text-[11px]" style={{ color: 'var(--text-secondary)' }}>
                      {(p.avgPrice * 100).toFixed(1)}¢
                    </span>
                  </td>
                  <td>
                    <span className="metric text-[11px]" style={{ color: 'var(--text-secondary)' }}>
                      {p.currentPrice > 0 ? `${(p.currentPrice * 100).toFixed(1)}¢` : '—'}
                    </span>
                  </td>
                  <td style={{ textAlign: 'right', paddingRight: 12 }}>
                    <span
                      className="metric text-[11px] font-semibold"
                      style={{ color: p.unrealizedPnl >= 0 ? '#22c55e' : '#ef4444' }}
                    >
                      {fmt$(p.unrealizedPnl)}
                      {p.unrealizedPnlPct !== 0 && (
                        <span className="ml-1 text-[9px] font-normal" style={{ color: 'var(--text-tertiary)' }}>
                          ({p.unrealizedPnlPct >= 0 ? '+' : ''}{p.unrealizedPnlPct.toFixed(1)}%)
                        </span>
                      )}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ── Recent trades ──────────────────────────────────────────────────────────

function RecentTrades({ trades }: { trades: Trade[] }) {
  const [showAll, setShowAll] = useState(false);
  const visible = showAll ? trades : trades.slice(0, 20);
  if (trades.length === 0) return null;

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
        <span className="terminal-label">Recent trades ({trades.length})</span>
      </div>

      <div>
        {visible.map((t, i) => (
          <div
            key={t.id + i}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '5px 10px',
              borderBottom: '1px solid rgba(255,255,255,0.04)',
            }}
            onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'var(--bg-row-hover)')}
            onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
          >
            <span
              className="font-mono text-[9px] font-bold shrink-0 w-7"
              style={{ color: t.side === 'BUY' ? '#22c55e' : '#ef4444' }}
            >
              {t.side}
            </span>
            <span
              className="font-mono text-[9px] shrink-0 px-1 py-0.5"
              style={{
                border: '1px solid var(--border)',
                color: 'var(--text-secondary)',
                backgroundColor: 'var(--bg-elevated)',
              }}
            >
              {t.outcome}
            </span>
            <span
              className="text-[11px] flex-1 truncate"
              style={{ color: 'var(--text)', minWidth: 0 }}
              title={t.title}
            >
              {t.title || t.market.slice(0, 20) + '…'}
            </span>
            <span
              className="metric text-[11px] font-semibold shrink-0"
              style={{ color: t.side === 'BUY' ? '#ef4444' : '#22c55e' }}
            >
              {fmt$(t.notional, true)}
            </span>
            <span
              className="terminal-label shrink-0 w-10 text-right"
            >
              {t.ts ? relativeTime(t.ts) : t.date}
            </span>
          </div>
        ))}
      </div>

      {trades.length > 20 && (
        <button
          onClick={() => setShowAll(s => !s)}
          style={{
            width: '100%',
            padding: '6px',
            borderTop: '1px solid var(--border)',
            color: 'var(--accent)',
            backgroundColor: 'transparent',
            fontFamily: 'var(--font-geist-mono)',
            fontSize: 9,
            fontWeight: 600,
            letterSpacing: '0.05em',
            textTransform: 'uppercase',
          }}
          onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'var(--bg-elevated)')}
          onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
        >
          {showAll ? 'SHOW LESS' : `SHOW ALL ${trades.length} TRADES`}
        </button>
      )}
    </div>
  );
}

// ── Username dropdown ──────────────────────────────────────────────────────

function UsernameDropdown({
  results,
  onSelect,
  visible,
}: {
  results: UserProfile[];
  onSelect: (p: UserProfile) => void;
  visible: boolean;
}) {
  if (!visible || results.length === 0) return null;
  return (
    <div
      style={{
        position: 'absolute',
        left: 0,
        right: 0,
        top: '100%',
        marginTop: 2,
        zIndex: 50,
        backgroundColor: 'var(--bg-elevated)',
        border: '1px solid var(--border-strong)',
      }}
    >
      {results.map(p => (
        <button
          key={p.address}
          onMouseDown={e => { e.preventDefault(); onSelect(p); }}
          style={{
            width: '100%',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '6px 10px',
            textAlign: 'left',
            backgroundColor: 'transparent',
          }}
          onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'var(--bg-row-hover)')}
          onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
        >
          {p.avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={p.avatarUrl}
              alt={p.username}
              style={{ width: 24, height: 24, borderRadius: '50%', objectFit: 'cover', flexShrink: 0, border: '1px solid var(--border)' }}
              onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
            />
          ) : (
            <div style={{ width: 24, height: 24, borderRadius: '50%', backgroundColor: 'var(--bg-elevated)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <User className="h-3 w-3" style={{ color: 'var(--text-tertiary)' }} />
            </div>
          )}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              {p.name && <span className="text-[11px] font-medium truncate" style={{ color: 'var(--text)' }}>{p.name}</span>}
              {p.username && <span className="terminal-label">@{p.username}</span>}
            </div>
            <span className="terminal-label">{p.address.slice(0, 8)}…{p.address.slice(-4)}</span>
          </div>
        </button>
      ))}
    </div>
  );
}

// ── Main tab ───────────────────────────────────────────────────────────────

export function UsersTab() {
  const { eoaAddress } = usePolymarketSession();

  const [inputValue, setInputValue] = useState('');
  const [searchAddress, setSearchAddress] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [pnl, setPnl] = useState<PnlStats | null>(null);
  const [trades, setTrades] = useState<Trade[]>([]);
  const [dailyBuckets, setDailyBuckets] = useState<Record<string, DailyBucket>>({});
  const [positions, setPositions] = useState<Position[]>([]);
  const [profile, setProfile] = useState<UserProfile | null>(null);

  const [suggestions, setSuggestions] = useState<UserProfile[]>([]);
  const [searchingUsers, setSearchingUsers] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (eoaAddress && !inputValue && !searchAddress) {
      setInputValue(eoaAddress);
    }
  }, [eoaAddress]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleInputChange = useCallback((val: string) => {
    setInputValue(val);
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    if (!looksLikeUsername(val) || val.trim().length < 2) {
      setSuggestions([]); setDropdownOpen(false); return;
    }
    searchTimerRef.current = setTimeout(async () => {
      setSearchingUsers(true);
      try {
        const res = await fetch(`${API_BASE}/polymarket/users/search?q=${encodeURIComponent(val.trim())}&limit=8`);
        if (res.ok) {
          const data = await res.json();
          setSuggestions(data.profiles ?? []);
          setDropdownOpen((data.profiles ?? []).length > 0);
        }
      } catch { /* ignore */ } finally { setSearchingUsers(false); }
    }, 300);
  }, []);

  const fetchUserData = useCallback(async (addr: string) => {
    setLoading(true); setError(null); setDropdownOpen(false); setSuggestions([]);
    setSearchAddress(addr.trim().toLowerCase());
    try {
      const [pnlRes, actRes, posRes, profileRes] = await Promise.all([
        fetch(`${API_BASE}/polymarket/user/${addr}/pnl`),
        fetch(`${API_BASE}/polymarket/user/${addr}/activity?limit=500`),
        fetch(`${API_BASE}/polymarket/user/${addr}/positions`),
        fetch(`${API_BASE}/polymarket/user/${addr}/profile`),
      ]);
      const [pnlData, actData, posData, profileData] = await Promise.all([
        pnlRes.ok ? pnlRes.json() : null,
        actRes.ok ? actRes.json() : null,
        posRes.ok ? posRes.json() : null,
        profileRes.ok ? profileRes.json() : null,
      ]);
      if (pnlData) setPnl(pnlData);
      if (actData) { setTrades(actData.trades ?? []); setDailyBuckets(actData.dailyBuckets ?? {}); }
      if (posData) setPositions(posData.positions ?? []);
      if (profileData) setProfile(profileData);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  const handleSelectSuggestion = useCallback((p: UserProfile) => {
    setInputValue(p.username ? `@${p.username}` : p.address);
    setDropdownOpen(false); setSuggestions([]);
    fetchUserData(p.address);
  }, [fetchUserData]);

  const handleSearch = useCallback(() => {
    const val = inputValue.trim();
    if (!val) return;
    if (isValidAddress(val)) {
      fetchUserData(val);
    } else if (looksLikeUsername(val)) {
      const clean = val.replace(/^@/, '');
      const exact = suggestions.find(s => s.username?.toLowerCase() === clean.toLowerCase());
      if (exact) { handleSelectSuggestion(exact); return; }
      setLoading(true); setError(null);
      fetch(`${API_BASE}/polymarket/users/search?q=${encodeURIComponent(clean)}&limit=1`)
        .then(r => r.ok ? r.json() : null)
        .then(data => {
          const top = data?.profiles?.[0];
          if (top) { setInputValue(top.username ? `@${top.username}` : top.address); fetchUserData(top.address); }
          else { setLoading(false); setError(`No user found for "${clean}"`); }
        })
        .catch(() => { setLoading(false); setError('Username lookup failed'); });
    } else {
      setError('Enter a valid address (0x…) or username');
    }
  }, [inputValue, suggestions, fetchUserData, handleSelectSuggestion]);

  const hasData = pnl !== null || trades.length > 0 || positions.length > 0;
  const totalPnl = pnl?.totalProfit ?? 0;
  const hasProfile = profile && (profile.username || profile.name);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

      {/* Search bar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '8px 10px',
          border: '1px solid var(--border)',
          backgroundColor: 'var(--bg-card)',
        }}
      >
        <div style={{ position: 'relative', flex: 1 }}>
          <Search
            className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 pointer-events-none"
            style={{ color: 'var(--text-tertiary)' }}
          />
          {searchingUsers && (
            <RefreshCw
              className="absolute right-2 top-1/2 -translate-y-1/2 h-2.5 w-2.5 animate-spin pointer-events-none"
              style={{ color: 'var(--text-tertiary)' }}
            />
          )}
          <input
            ref={inputRef}
            type="text"
            value={inputValue}
            onChange={e => handleInputChange(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter') handleSearch();
              if (e.key === 'Escape') setDropdownOpen(false);
            }}
            onFocus={e => {
              e.currentTarget.style.borderColor = 'var(--accent)';
              if (suggestions.length > 0) setDropdownOpen(true);
            }}
            onBlur={e => { e.currentTarget.style.borderColor = 'var(--border)'; }}
            placeholder="Search by username or 0x address…"
            className="w-full font-mono text-[11px] focus:outline-none"
            style={{
              paddingLeft: 24,
              paddingRight: 24,
              paddingTop: 5,
              paddingBottom: 5,
              backgroundColor: 'var(--bg-elevated)',
              border: '1px solid var(--border)',
              color: 'var(--text)',
            }}
          />
          <UsernameDropdown
            results={suggestions}
            onSelect={handleSelectSuggestion}
            visible={dropdownOpen}
          />
        </div>

        <button
          onClick={handleSearch}
          disabled={loading || !inputValue.trim()}
          className="flex h-7 items-center gap-1.5 px-3 font-mono text-[9px] font-bold tracking-wider transition-colors disabled:opacity-40"
          style={{ backgroundColor: 'var(--accent)', color: '#000' }}
        >
          {loading ? <RefreshCw className="h-2.5 w-2.5 animate-spin" /> : <Search className="h-2.5 w-2.5" />}
          {loading ? 'Loading…' : 'Analyse'}
        </button>

        {eoaAddress && inputValue.toLowerCase() !== eoaAddress.toLowerCase() && (
          <button
            onClick={() => { setInputValue(eoaAddress); fetchUserData(eoaAddress); }}
            className="flex h-7 items-center gap-1.5 px-2.5 font-mono text-[9px] font-bold tracking-wider transition-colors"
            style={{ border: '1px solid var(--border)', backgroundColor: 'var(--bg-elevated)', color: 'var(--text-secondary)' }}
            onMouseEnter={e => (e.currentTarget.style.borderColor = 'var(--accent)')}
            onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--border)')}
          >
            <Wallet className="h-2.5 w-2.5" />
            MY WALLET
          </button>
        )}
      </div>

      {/* Error */}
      {error && (
        <div
          style={{
            padding: '8px 10px',
            backgroundColor: 'rgba(239,68,68,0.05)',
            border: '1px solid rgba(239,68,68,0.2)',
          }}
        >
          <span className="font-mono text-[11px]" style={{ color: '#ef4444' }}>{error}</span>
        </div>
      )}

      {/* Empty state */}
      {!hasData && !loading && !error && (
        <div
          style={{
            padding: '40px 16px',
            textAlign: 'center',
            border: '1px solid var(--border)',
            backgroundColor: 'var(--bg-card)',
          }}
        >
          <span className="terminal-label">Enter an address or username to analyse a trader</span>
          {eoaAddress && (
            <div style={{ marginTop: 12 }}>
              <button
                onClick={() => fetchUserData(eoaAddress)}
                className="flex items-center gap-1.5 mx-auto px-3 py-1.5 font-mono text-[9px] font-bold tracking-wider transition-colors"
                style={{ backgroundColor: 'var(--accent)', color: '#000' }}
              >
                <Search className="h-2.5 w-2.5" />
                ANALYSE MY WALLET
              </button>
            </div>
          )}
        </div>
      )}

      {/* Loading skeleton */}
      {loading && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div className="skeleton" style={{ height: 48, border: '1px solid var(--border)' }} />
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 1, border: '1px solid var(--border)', backgroundColor: 'var(--border)' }}>
            {[...Array(4)].map((_, i) => (
              <div key={i} className="skeleton" style={{ height: 56, backgroundColor: 'var(--bg-card)' }} />
            ))}
          </div>
          <div className="skeleton" style={{ height: 120, border: '1px solid var(--border)' }} />
        </div>
      )}

      {/* Data content */}
      {hasData && !loading && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>

          {/* Profile header */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              padding: '8px 10px',
              border: '1px solid var(--border)',
              backgroundColor: 'var(--bg-card)',
            }}
          >
            {hasProfile && profile.avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={profile.avatarUrl}
                alt={profile.username}
                style={{ width: 32, height: 32, borderRadius: '50%', objectFit: 'cover', flexShrink: 0, border: '1px solid var(--border)' }}
                onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
              />
            ) : (
              <div style={{ width: 32, height: 32, borderRadius: '50%', backgroundColor: 'var(--bg-elevated)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <User className="h-4 w-4" style={{ color: 'var(--text-tertiary)' }} />
              </div>
            )}

            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                {hasProfile && profile.name && (
                  <span className="text-[12px] font-semibold" style={{ color: 'var(--text)' }}>{profile.name}</span>
                )}
                {hasProfile && profile.username && (
                  <span className="terminal-label">@{profile.username}</span>
                )}
                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <span className="inline-block h-1.5 w-1.5" style={{ backgroundColor: '#22c55e' }} />
                  <span className="font-mono text-[9px]" style={{ color: 'var(--text-tertiary)' }}>
                    {searchAddress.slice(0, 6)}…{searchAddress.slice(-4)}
                  </span>
                </div>
              </div>
              {hasProfile && profile.bio && (
                <p className="text-[10px] mt-0.5 truncate" style={{ color: 'var(--text-secondary)' }}>
                  {profile.bio}
                </p>
              )}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
              {hasProfile && profile.twitterUsername && (
                <a
                  href={`https://twitter.com/${profile.twitterUsername}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ color: 'var(--text-tertiary)', display: 'flex', alignItems: 'center' }}
                  onMouseEnter={e => (e.currentTarget.style.color = '#1d9bf0')}
                  onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-tertiary)')}
                >
                  <Twitter className="h-3 w-3" />
                </a>
              )}
              <a
                href={`https://polymarket.com/profile/${searchAddress}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 font-mono text-[9px] font-bold tracking-wider px-2 py-1 transition-opacity hover:opacity-70"
                style={{ border: '1px solid rgba(245,158,11,0.3)', color: 'var(--accent)', backgroundColor: 'rgba(245,158,11,0.06)' }}
              >
                <ExternalLink className="h-2.5 w-2.5" />
                POLYMARKET
              </a>
            </div>
          </div>

          {/* Stats strip */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(4, 1fr)',
              gap: 1,
              backgroundColor: 'var(--border)',
              border: '1px solid var(--border)',
            }}
          >
            {[
              {
                label: 'TOTAL P&L',
                value: pnl ? fmt$(totalPnl) : '—',
                sub: pnl?.totalVolume ? `${fmt$(pnl.totalVolume, true)} vol` : undefined,
                color: pnl ? (totalPnl >= 0 ? '#22c55e' : '#ef4444') : undefined,
                icon: totalPnl >= 0 ? TrendingUp : TrendingDown,
              },
              {
                label: 'WIN RATE',
                value: pnl?.winRate != null ? `${(pnl.winRate * 100).toFixed(1)}%` : '—',
                sub: pnl?.tradesCount ? `${pnl.tradesCount} trades` : undefined,
                color: pnl?.winRate != null ? (pnl.winRate >= 0.5 ? '#22c55e' : '#ef4444') : undefined,
              },
              {
                label: 'TOTAL VOLUME',
                value: pnl?.totalVolume ? fmt$(pnl.totalVolume, true) : '—',
                sub: pnl?.tradesCount ? `${pnl.tradesCount} trades` : undefined,
              },
              {
                label: 'OPEN POSITIONS',
                value: String(positions.length),
                sub: positions.length > 0
                  ? `${fmt$(positions.reduce((s, p) => s + p.currentValue, 0), true)} val`
                  : undefined,
              },
            ].map(s => (
              <div key={s.label} style={{ padding: '8px 12px', backgroundColor: 'var(--bg-card)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 3 }}>
                  <span className="terminal-label">{s.label}</span>
                  {s.icon && <s.icon className="h-2.5 w-2.5" style={{ color: s.color ?? 'var(--text-tertiary)' }} />}
                </div>
                <div
                  className="metric text-[14px] font-bold"
                  style={{ color: s.color ?? 'var(--text)' }}
                >
                  {s.value}
                </div>
                {s.sub && <div className="terminal-label mt-0.5">{s.sub}</div>}
              </div>
            ))}
          </div>

          {/* Heatmap */}
          <div className="heatmap-root relative">
            <TradeHeatmap dailyBuckets={dailyBuckets} />
          </div>

          {/* PnL chart */}
          {trades.length > 1 && <PnlChart trades={trades} />}

          {/* Positions */}
          <PositionsTable positions={positions} />

          {/* Trades */}
          <RecentTrades trades={trades} />

          {trades.length === 0 && positions.length === 0 && pnl && (
            <div
              style={{
                padding: '24px 16px',
                textAlign: 'center',
                border: '1px solid var(--border)',
                backgroundColor: 'var(--bg-card)',
              }}
            >
              <span className="terminal-label">No trade activity found for this address</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
