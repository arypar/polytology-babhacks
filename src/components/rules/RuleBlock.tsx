'use client';

import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, X, ChevronDown, Search, Loader2, Zap } from 'lucide-react';
import { cn } from '@/lib/utils';
import { CATEGORY_META, type CanvasBlock } from './block-types';
import { fetchMarkets } from '@/lib/polymarket-data';
import type { PolymarketMarket, CustomDataSource } from '@/lib/types';
import { useState, useRef, useEffect, useCallback } from 'react';

// ── Shared input styles ───────────────────────────────────────
const inputClass =
  'h-8 w-full bg-white/[0.06] border border-white/[0.1] text-white/80 text-sm backdrop-blur-sm placeholder:text-white/20 rounded-lg px-2.5 focus:outline-none focus:border-white/20 transition-colors';
const labelClass = 'text-[10px] text-white/30 mb-0.5 block';

// ── CustomSelect ──────────────────────────────────────────────
interface SelectOption {
  value: string;
  label: string;
}

function CustomSelect({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (v: string) => void;
  options: SelectOption[];
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const selected = options.find(o => o.value === value);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className="h-8 w-full bg-white/[0.06] border border-white/[0.1] text-white/80 text-sm backdrop-blur-sm rounded-lg px-2.5 focus:outline-none focus:border-white/20 transition-colors flex items-center justify-between gap-1 cursor-pointer"
      >
        <span className="truncate">{selected?.label ?? value}</span>
        <ChevronDown
          className={cn('h-3 w-3 shrink-0 text-white/30 transition-transform', open && 'rotate-180')}
        />
      </button>

      {open && (
        <div className="absolute z-[100] top-full mt-1 left-0 right-0 rounded-lg border border-white/[0.1] overflow-hidden shadow-2xl"
          style={{ background: 'rgba(10,10,18,0.97)', backdropFilter: 'blur(16px)' }}
        >
          {options.map(opt => (
            <button
              key={opt.value}
              type="button"
              onClick={() => { onChange(opt.value); setOpen(false); }}
              className={cn(
                'w-full px-2.5 py-1.5 text-[12px] text-left transition-colors',
                opt.value === value
                  ? 'text-white bg-white/[0.07]'
                  : 'text-white/50 hover:text-white/80 hover:bg-white/[0.04]'
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ── MarketSearch ──────────────────────────────────────────────
function MarketSearch({
  config,
  onUpdate,
}: {
  config: Record<string, string | number>;
  onUpdate: (c: Record<string, string | number>) => void;
}) {
  const [query, setQuery] = useState(String(config.marketName ?? ''));
  const [markets, setMarkets] = useState<PolymarketMarket[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [fetched, setFetched] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const loadMarkets = useCallback(async () => {
    if (fetched) return;
    setLoading(true);
    const data = await fetchMarkets({ limit: 100 });
    setMarkets(data.filter(m => m.active && !m.closed));
    setFetched(true);
    setLoading(false);
  }, [fetched]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const filtered = query.trim()
    ? markets
        .filter(m => m.question.toLowerCase().includes(query.toLowerCase()))
        .slice(0, 7)
    : markets.slice(0, 7);

  const hasSelected = Boolean(config.marketId);
  const selectedMarket = hasSelected
    ? markets.find(m => m.id === config.marketId)
    : null;
  const yesPrice = selectedMarket?.outcomes.find(o => o.name.toLowerCase() === 'yes')?.price;

  // ── Selected state: show a solid confirmed card ──────────────
  if (hasSelected) {
    return (
      <div
        className="rounded-lg border border-blue-600/30 overflow-hidden"
        style={{ background: 'rgba(245,158,11,0.07)' }}
      >
        <div className="px-2.5 py-2 flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <p className="text-[11px] font-medium text-white/85 leading-snug">
              {String(config.marketName)}
            </p>
            {yesPrice !== undefined && (
              <div className="flex items-center gap-1.5 mt-1">
                <span className="text-[10px] text-white/30">YES</span>
                <span
                  className={cn(
                    'text-[11px] font-bold',
                    yesPrice >= 0.5 ? 'text-emerald-400' : 'text-rose-400'
                  )}
                >
                  {Math.round(yesPrice * 100)}%
                </span>
                <span
                  className="h-1 flex-1 rounded-full overflow-hidden"
                  style={{ background: 'rgba(255,255,255,0.06)' }}
                >
                  <span
                    className={cn(
                      'block h-full rounded-full',
                      yesPrice >= 0.5 ? 'bg-emerald-400' : 'bg-rose-400'
                    )}
                    style={{ width: `${Math.round(yesPrice * 100)}%`, opacity: 0.7 }}
                  />
                </span>
              </div>
            )}
          </div>
          <button
            type="button"
            onClick={() => {
              onUpdate({ ...config, marketId: '', marketName: '', marketSlug: '' });
              setQuery('');
            }}
            className="shrink-0 rounded-md p-0.5 text-white/20 hover:text-blue-500 hover:bg-blue-600/10 transition-all mt-0.5"
            title="Change market"
          >
            <Search className="h-3 w-3" />
          </button>
        </div>
      </div>
    );
  }

  // ── Search state ─────────────────────────────────────────────
  return (
    <div ref={ref} className="relative">
      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3 w-3 text-white/20 pointer-events-none" />
        <input
          value={query}
          onChange={e => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => {
            setOpen(true);
            loadMarkets();
          }}
          placeholder="Search markets…"
          className="h-8 w-full bg-white/[0.06] border border-white/[0.1] text-white/80 text-sm backdrop-blur-sm placeholder:text-white/20 rounded-lg pl-7 pr-2.5 focus:outline-none focus:border-white/20 transition-colors"
          autoFocus
        />
        {loading && (
          <Loader2 className="absolute right-2.5 top-1/2 -translate-y-1/2 h-3 w-3 text-white/20 animate-spin" />
        )}
      </div>

      {open && (loading || filtered.length > 0) && (
        <div
          className="absolute z-[100] top-full mt-1 left-0 right-0 rounded-lg border border-white/[0.1] overflow-hidden shadow-2xl"
          style={{ background: 'rgba(10,10,18,0.97)', backdropFilter: 'blur(16px)' }}
        >
          {loading ? (
            <div className="px-3 py-3 flex items-center gap-2">
              <Loader2 className="h-3 w-3 animate-spin text-white/30" />
              <span className="text-[11px] text-white/30">Loading markets…</span>
            </div>
          ) : filtered.length === 0 ? (
            <div className="px-3 py-2.5 text-[11px] text-white/25">No markets found</div>
          ) : (
            filtered.map(m => {
              const price = m.outcomes.find(o => o.name.toLowerCase() === 'yes')?.price;
              return (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => {
                    onUpdate({
                      ...config,
                      marketName: m.question,
                      marketId: m.id,
                      marketSlug: m.slug,
                      yesTokenId: m.outcomes.find(o => o.name.toLowerCase() === 'yes')?.tokenId ?? '',
                      noTokenId:  m.outcomes.find(o => o.name.toLowerCase() === 'no')?.tokenId ?? '',
                    });
                    setQuery(m.question);
                    setOpen(false);
                  }}
                  className="w-full px-3 py-2 text-left hover:bg-white/[0.05] transition-colors flex items-start justify-between gap-2 group"
                >
                  <span className="text-[11px] text-white/60 group-hover:text-white/85 transition-colors leading-snug line-clamp-2 flex-1">
                    {m.question}
                  </span>
                  {price !== undefined && (
                    <span
                      className={cn(
                        'text-[10px] font-bold shrink-0 mt-0.5',
                        price >= 0.5 ? 'text-emerald-400' : 'text-rose-400'
                      )}
                    >
                      {Math.round(price * 100)}%
                    </span>
                  )}
                </button>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}

// ── Per-block config forms ─────────────────────────────────────
function BlockConfig({
  block,
  onUpdate,
  sources = [],
  fetchSourceValue,
}: {
  block: CanvasBlock;
  onUpdate: (c: Record<string, string | number>) => void;
  sources?: CustomDataSource[];
  fetchSourceValue?: (id: string) => Promise<{ value: unknown; error?: string }>;
}) {
  const set = (key: string, val: string | number) =>
    onUpdate({ ...block.config, [key]: val });

  switch (block.type) {
    case 'market':
      return (
        <div>
          <label className={labelClass}>Market</label>
          <MarketSearch config={block.config} onUpdate={onUpdate} />
        </div>
      );

    case 'price_crosses':
      return (
        <div className="space-y-1.5">
          <div>
            <label className={labelClass}>Threshold</label>
            <input
              type="number"
              min={0.01}
              max={0.99}
              step={0.01}
              value={Number(block.config.threshold ?? 0.5)}
              onChange={e => set('threshold', parseFloat(e.target.value))}
              className={inputClass}
              placeholder="0.50"
            />
          </div>
          <div>
            <label className={labelClass}>Direction</label>
            <CustomSelect
              value={String(block.config.direction ?? 'above')}
              onChange={v => set('direction', v)}
              options={[
                { value: 'above', label: 'Above' },
                { value: 'below', label: 'Below' },
              ]}
            />
          </div>
        </div>
      );

    case 'volume_spike':
      return (
        <div className="space-y-1.5">
          <div>
            <label className={labelClass}>Multiplier</label>
            <input
              type="number"
              min={1.5}
              max={20}
              step={0.5}
              value={Number(block.config.multiplier ?? 3)}
              onChange={e => set('multiplier', parseFloat(e.target.value))}
              className={inputClass}
              placeholder="3"
            />
          </div>
          <div>
            <label className={labelClass}>Window</label>
            <CustomSelect
              value={String(block.config.window ?? '1h')}
              onChange={v => set('window', v)}
              options={[
                { value: '15m', label: '15 min' },
                { value: '1h', label: '1 hour' },
                { value: '4h', label: '4 hours' },
                { value: '24h', label: '24 hours' },
              ]}
            />
          </div>
        </div>
      );

    case 'resolves_soon':
      return (
        <div>
          <label className={labelClass}>Hours Before Close</label>
          <input
            type="number"
            min={1}
            max={168}
            step={1}
            value={Number(block.config.hoursBeforeClose ?? 24)}
            onChange={e => set('hoursBeforeClose', parseInt(e.target.value))}
            className={inputClass}
            placeholder="24"
          />
        </div>
      );

    case 'time_schedule':
      return (
        <div>
          <label className={labelClass}>Interval</label>
          <CustomSelect
            value={String(block.config.interval ?? '1h')}
            onChange={v => set('interval', v)}
            options={[
              { value: '15m', label: '15 min' },
              { value: '1h', label: '1 hour' },
              { value: '4h', label: '4 hours' },
              { value: '24h', label: '24 hours' },
            ]}
          />
        </div>
      );

    case 'cooldown':
      return (
        <div>
          <label className={labelClass}>Cooldown (min)</label>
          <input
            type="number"
            min={1}
            max={1440}
            step={1}
            value={Number(block.config.minutes ?? 60)}
            onChange={e => set('minutes', parseInt(e.target.value))}
            className={inputClass}
            placeholder="60"
          />
        </div>
      );

    case 'position_limit':
      return (
        <div>
          <label className={labelClass}>Max Position ($)</label>
          <input
            type="number"
            min={10}
            max={100000}
            step={10}
            value={Number(block.config.maxUSD ?? 500)}
            onChange={e => set('maxUSD', parseFloat(e.target.value))}
            className={inputClass}
            placeholder="500"
          />
        </div>
      );

    case 'daily_limit':
      return (
        <div>
          <label className={labelClass}>Max Trades / Day</label>
          <input
            type="number"
            min={1}
            max={100}
            step={1}
            value={Number(block.config.maxTrades ?? 5)}
            onChange={e => set('maxTrades', parseInt(e.target.value))}
            className={inputClass}
            placeholder="5"
          />
        </div>
      );

    case 'buy_yes':
    case 'buy_no':
      return (
        <div>
          <label className={labelClass}>Amount ($)</label>
          <input
            type="number"
            min={1}
            max={100000}
            step={1}
            value={Number(block.config.amountUSD ?? 100)}
            onChange={e => set('amountUSD', parseFloat(e.target.value))}
            className={inputClass}
            placeholder="100"
          />
        </div>
      );

    case 'sell_position':
      return (
        <div>
          <label className={labelClass}>Sell %</label>
          <input
            type="number"
            min={1}
            max={100}
            step={1}
            value={Number(block.config.percent ?? 100)}
            onChange={e => set('percent', parseInt(e.target.value))}
            className={inputClass}
            placeholder="100"
          />
        </div>
      );

    case 'limit_order':
      return (
        <div className="space-y-1.5">
          <div>
            <label className={labelClass}>Side</label>
            <CustomSelect
              value={String(block.config.side ?? 'YES')}
              onChange={v => set('side', v)}
              options={[
                { value: 'YES', label: 'YES' },
                { value: 'NO', label: 'NO' },
              ]}
            />
          </div>
          <div>
            <label className={labelClass}>Limit Price</label>
            <input
              type="number"
              min={0.01}
              max={0.99}
              step={0.01}
              value={Number(block.config.limitPrice ?? 0.5)}
              onChange={e => set('limitPrice', parseFloat(e.target.value))}
              className={inputClass}
              placeholder="0.50"
            />
          </div>
          <div>
            <label className={labelClass}>Amount ($)</label>
            <input
              type="number"
              min={1}
              max={100000}
              step={1}
              value={Number(block.config.amountUSD ?? 100)}
              onChange={e => set('amountUSD', parseFloat(e.target.value))}
              className={inputClass}
              placeholder="100"
            />
          </div>
        </div>
      );

    case 'send_alert':
      return (
        <div>
          <label className={labelClass}>Message</label>
          <input
            type="text"
            value={String(block.config.message ?? '')}
            onChange={e => set('message', e.target.value)}
            className={inputClass}
            placeholder="Strategy triggered!"
          />
        </div>
      );

    case 'custom_datasource':
      return (
        <CustomDataSourceConfig
          block={block}
          onUpdate={onUpdate}
          sources={sources}
          fetchSourceValue={fetchSourceValue}
        />
      );

    default:
      return null;
  }
}

// ── Custom data source config ──────────────────────────────────
function CustomDataSourceConfig({
  block,
  onUpdate,
  sources,
  fetchSourceValue,
}: {
  block: CanvasBlock;
  onUpdate: (c: Record<string, string | number>) => void;
  sources: CustomDataSource[];
  fetchSourceValue?: (id: string) => Promise<{ value: unknown; error?: string }>;
}) {
  const set = (key: string, val: string | number) =>
    onUpdate({ ...block.config, [key]: val });

  const [preview, setPreview] = useState<{ value: unknown; error?: string; loading: boolean }>({
    value: undefined,
    loading: false,
  });

  const handlePreview = async () => {
    const sourceId = String(block.config.sourceId ?? '');
    if (!sourceId || !fetchSourceValue) return;
    setPreview({ value: undefined, loading: true });
    const result = await fetchSourceValue(sourceId);
    setPreview({ ...result, loading: false });
  };

  const sourceOptions = sources.map(s => ({ value: s.id, label: s.name }));
  const selectedSource = sources.find(s => s.id === String(block.config.sourceId ?? ''));

  return (
    <div className="space-y-1.5">
      <div>
        <label className={labelClass}>Data Source</label>
        {sourceOptions.length === 0 ? (
          <div className="h-8 w-full flex items-center px-2.5 rounded-lg border border-white/[0.08] bg-white/[0.03]">
            <span className="text-[11px] text-white/25 italic">No sources saved yet</span>
          </div>
        ) : (
          <CustomSelect
            value={String(block.config.sourceId ?? '')}
            onChange={v => {
              const src = sources.find(s => s.id === v);
              onUpdate({ ...block.config, sourceId: v, sourceName: src?.name ?? '' });
              setPreview({ value: undefined, loading: false });
            }}
            options={[{ value: '', label: 'Select a source…' }, ...sourceOptions]}
          />
        )}
      </div>

      {selectedSource && (
        <div className="rounded-md px-2 py-1.5 border border-white/[0.06] bg-white/[0.02]">
          <p className="text-[10px] text-white/30 leading-snug truncate">
            {selectedSource.description || selectedSource.valuePath}
          </p>
        </div>
      )}

      <div>
        <label className={labelClass}>Operator</label>
        <CustomSelect
          value={String(block.config.operator ?? '>')}
          onChange={v => set('operator', v)}
          options={[
            { value: '>', label: 'greater than  >' },
            { value: '<', label: 'less than  <' },
            { value: '>=', label: 'at least  ≥' },
            { value: '<=', label: 'at most  ≤' },
            { value: '==', label: 'equal to  =' },
            { value: '!=', label: 'not equal  ≠' },
          ]}
        />
      </div>

      <div>
        <label className={labelClass}>Threshold</label>
        <input
          type="number"
          step="any"
          value={Number(block.config.threshold ?? 0)}
          onChange={e => set('threshold', parseFloat(e.target.value) || 0)}
          className={inputClass}
          placeholder="0"
        />
      </div>

      {selectedSource && fetchSourceValue && (
        <div>
          <button
            type="button"
            onClick={handlePreview}
            disabled={preview.loading}
            className="flex items-center gap-1.5 text-[10px] text-indigo-400/70 hover:text-indigo-400 transition-colors disabled:opacity-50"
          >
            {preview.loading ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <Zap className="h-3 w-3" />
            )}
            Test live value
          </button>

          {!preview.loading && (preview.value !== undefined || preview.error) && (
            <div className={cn(
              'mt-1 rounded-md px-2 py-1 text-[10px] border',
              preview.error
                ? 'border-red-500/20 bg-red-500/[0.06] text-red-400'
                : 'border-indigo-500/20 bg-indigo-500/[0.06] text-indigo-300'
            )}>
              {preview.error
                ? `Error: ${preview.error}`
                : `Value: ${JSON.stringify(preview.value)}`}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── RuleBlock ─────────────────────────────────────────────────
interface RuleBlockProps {
  block: CanvasBlock;
  onRemove: () => void;
  onUpdateConfig: (config: Record<string, string | number>) => void;
  sources?: CustomDataSource[];
  fetchSourceValue?: (id: string) => Promise<{ value: unknown; error?: string }>;
}

export function RuleBlock({ block, onRemove, onUpdateConfig, sources, fetchSourceValue }: RuleBlockProps) {
  const meta = CATEGORY_META[block.category];

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: block.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 50 : undefined,
    boxShadow: `0 0 24px ${meta.shadowOuter}, inset 0 0 20px ${meta.shadowInner}`,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      data-block-category={block.category}
      data-block-id={block.id}
      className={cn(
        'group rounded-2xl border backdrop-blur-xl transition-all duration-200 overflow-visible',
        meta.bgClass,
        meta.borderClass,
        isDragging ? 'opacity-90 scale-[1.02]' : 'hover:bg-white/[0.06]'
      )}
    >
      <div className="flex items-start gap-2 p-3">
        {/* Drag handle */}
        <button
          {...listeners}
          {...attributes}
          className="rounded-md p-0.5 text-white/15 hover:text-white/30 hover:bg-white/[0.06] cursor-grab active:cursor-grabbing transition-colors mt-0.5 shrink-0"
          onClick={e => e.stopPropagation()}
        >
          <GripVertical className="h-3.5 w-3.5" />
        </button>

        {/* Content */}
        <div className="flex-1 min-w-0">
          {/* Block header */}
          <div className="flex items-center gap-1.5 mb-2">
            <span
              className={cn('h-1.5 w-1.5 rounded-full shrink-0', meta.dotClass)}
              style={{ boxShadow: `0 0 4px ${meta.glow}` }}
            />
            <span
              className={cn(
                'text-[9px] font-bold uppercase tracking-[0.08em]',
                meta.textClass
              )}
            >
              {meta.tag}
            </span>
            <span className="text-[12px] font-semibold text-white/80 truncate">
              {block.label}
            </span>
          </div>

          {/* Config form */}
          <BlockConfig
            block={block}
            onUpdate={onUpdateConfig}
            sources={sources}
            fetchSourceValue={fetchSourceValue}
          />
        </div>

        {/* Remove button */}
        <button
          onClick={onRemove}
          className="rounded-lg p-0.5 text-white/15 hover:text-red-400 hover:bg-red-500/10 opacity-0 group-hover:opacity-100 transition-all shrink-0 mt-0.5"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}
