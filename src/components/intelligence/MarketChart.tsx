'use client';

import { useEffect, useState, useMemo } from 'react';
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from 'recharts';
import { fetchMarketHistory } from '@/lib/polymarket-data';
import type { PolymarketMarket, PolymarketPricePoint } from '@/lib/types';

interface MarketChartProps {
  market: PolymarketMarket;
}

type Range = '24H' | '7D' | '30D';

function formatTime(ts: number, range: Range): string {
  const d = new Date(ts);
  if (range === '24H') return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

interface TooltipPayload {
  value: number;
}

function CustomTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: TooltipPayload[];
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  const val = payload[0].value as number;
  return (
    <div
      className="px-2.5 py-1.5 text-[11px]"
      style={{
        backgroundColor: 'var(--bg-elevated)',
        border: '1px solid var(--border-strong)',
        color: 'var(--text)',
      }}
    >
      <div className="terminal-label mb-0.5">{label}</div>
      <div className="metric font-semibold" style={{ color: '#1652F0' }}>{(val * 100).toFixed(1)}%</div>
    </div>
  );
}

export function MarketChart({ market }: MarketChartProps) {
  const [range, setRange] = useState<Range>('30D');
  const [allHistory, setAllHistory] = useState<PolymarketPricePoint[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetchMarketHistory(market.conditionId).then(data => {
      setAllHistory(data);
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
    return allHistory
      .filter(p => p.t >= cutoffs[range])
      .map(p => ({ time: formatTime(p.t, range), value: p.p }));
  }, [allHistory, range]);

  const currentYes = market.outcomes.find(o => o.name === 'Yes')?.price ?? 0.5;
  const change = market.priceChange24h;
  const isUp = change >= 0;

  const RANGES: Range[] = ['24H', '7D', '30D'];

  return (
    <div
      style={{
        backgroundColor: 'var(--bg-card)',
        border: '1px solid var(--border)',
      }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '6px 10px',
          borderBottom: '1px solid var(--border)',
          backgroundColor: 'var(--bg-elevated)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
          <span className="terminal-label">YES PROB</span>
          <span className="metric text-[15px] font-bold" style={{ color: '#1652F0' }}>
            {(currentYes * 100).toFixed(1)}%
          </span>
          <span
            className="metric text-[11px] font-semibold"
            style={{ color: isUp ? '#22c55e' : '#ef4444' }}
          >
            {isUp ? '▲' : '▼'} {Math.abs(change * 100).toFixed(1)}% 24h
          </span>
        </div>
        <div style={{ display: 'flex', gap: 2 }}>
          {RANGES.map(r => (
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
      </div>

      {/* Chart */}
      <div style={{ padding: '8px 4px 4px 4px' }}>
        {loading ? (
          <div style={{ height: 160, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span className="terminal-label">LOADING…</span>
          </div>
        ) : chartData.length === 0 ? (
          <div style={{ height: 160, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span className="terminal-label">NO PRICE HISTORY</span>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={160}>
            <LineChart data={chartData} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
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
              <Tooltip content={<CustomTooltip />} />
              <Line
                type="monotone"
                dataKey="value"
                stroke="#1652F0"
                strokeWidth={1.5}
                dot={false}
                activeDot={{ r: 3, fill: '#1652F0' }}
              />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
