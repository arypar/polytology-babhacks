'use client';

import { useEffect, useState } from 'react';
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
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
    <div className="rounded-md border border-white/[0.1] bg-[#0D0D14] px-3 py-2 text-[12px]">
      <div className="text-white/40 mb-0.5">{label}</div>
      <div className="font-bold text-primary">{(val * 100).toFixed(1)}%</div>
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

  const filteredHistory = (() => {
    const now = Date.now();
    const cutoffs: Record<Range, number> = {
      '24H': now - 24 * 3600 * 1000,
      '7D': now - 7 * 24 * 3600 * 1000,
      '30D': now - 30 * 24 * 3600 * 1000,
    };
    return allHistory.filter(p => p.t >= cutoffs[range]);
  })();

  const chartData = filteredHistory.map(p => ({
    time: formatTime(p.t, range),
    value: p.p,
  }));

  const currentYes = market.outcomes.find(o => o.name === 'Yes')?.price ?? 0.5;
  const change = market.priceChange24h;
  const isUp = change >= 0;

  const RANGES: Range[] = ['24H', '7D', '30D'];

  return (
    <div className="rounded-lg border border-white/[0.08] bg-[#0D0D14] p-5">
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div>
          <p className="text-[11px] font-medium text-white/40 mb-1">YES Probability</p>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-bold text-white">{(currentYes * 100).toFixed(0)}%</span>
            <span className={`text-sm font-semibold ${isUp ? 'text-yes' : 'text-no'}`}>
              {isUp ? '▲' : '▼'} {Math.abs(change * 100).toFixed(1)}pp 24h
            </span>
          </div>
        </div>
        <div className="flex gap-1">
          {RANGES.map(r => (
            <button
              key={r}
              onClick={() => setRange(r)}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-medium transition-all ${
                range === r
                  ? 'bg-primary/15 text-primary border border-primary/30'
                  : 'text-white/40 hover:text-white/70'
              }`}
            >
              {r}
            </button>
          ))}
        </div>
      </div>

      {/* Chart */}
      {loading ? (
        <div className="h-[180px] flex items-center justify-center">
          <div className="h-6 w-6 rounded-full border-2 border-primary/30 border-t-primary animate-spin" />
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={180}>
          <AreaChart data={chartData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
            <defs>
              <linearGradient id="yesGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#2E5CFF" stopOpacity={0.3} />
                <stop offset="100%" stopColor="#2E5CFF" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />
            <XAxis
              dataKey="time"
              tick={{ fill: 'rgba(255,255,255,0.3)', fontSize: 10 }}
              tickLine={false}
              axisLine={false}
              interval="preserveStartEnd"
            />
            <YAxis
              domain={[0, 1]}
              tickFormatter={v => `${(v * 100).toFixed(0)}%`}
              tick={{ fill: 'rgba(255,255,255,0.3)', fontSize: 10 }}
              tickLine={false}
              axisLine={false}
              tickCount={5}
            />
            <Tooltip content={<CustomTooltip />} />
            <Area
              type="monotone"
              dataKey="value"
              stroke="#2E5CFF"
              strokeWidth={1.5}
              fill="url(#yesGrad)"
              dot={false}
              activeDot={{ r: 4, fill: '#2E5CFF', stroke: 'rgba(46,92,255,0.3)', strokeWidth: 4 }}
            />
          </AreaChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
