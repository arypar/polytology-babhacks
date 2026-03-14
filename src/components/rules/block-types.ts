import type { CustomDataSource } from '@/lib/types';

export type BlockCategory = 'market' | 'condition' | 'action';

export interface PaletteItem {
  type: string;
  category: BlockCategory;
  label: string;
  defaultConfig: Record<string, string | number>;
}

export interface CanvasBlock {
  id: string;
  category: BlockCategory;
  type: string;
  label: string;
  config: Record<string, string | number>;
}

export const PALETTE_ITEMS: PaletteItem[] = [
  // ── Market (FOR) ─────────────────────────────────────────
  {
    type: 'market',
    category: 'market',
    label: 'Market',
    defaultConfig: { marketName: '', marketSlug: '' },
  },

  // ── Conditions (IF) ──────────────────────────────────────
  {
    type: 'price_crosses',
    category: 'condition',
    label: 'Price Crosses',
    defaultConfig: { threshold: 0.5, direction: 'above' },
  },
  {
    type: 'volume_spike',
    category: 'condition',
    label: 'Volume Spike',
    defaultConfig: { multiplier: 3, window: '1h' },
  },
  {
    type: 'resolves_soon',
    category: 'condition',
    label: 'Resolves Soon',
    defaultConfig: { hoursBeforeClose: 24 },
  },
  {
    type: 'time_schedule',
    category: 'condition',
    label: 'Time Schedule',
    defaultConfig: { interval: '1h' },
  },
  {
    type: 'cooldown',
    category: 'condition',
    label: 'Cooldown',
    defaultConfig: { minutes: 60 },
  },
  {
    type: 'position_limit',
    category: 'condition',
    label: 'Position Limit',
    defaultConfig: { maxUSD: 500 },
  },
  {
    type: 'daily_limit',
    category: 'condition',
    label: 'Daily Limit',
    defaultConfig: { maxTrades: 5 },
  },
  {
    type: 'custom_datasource',
    category: 'condition',
    label: 'Custom Data',
    defaultConfig: { sourceId: '', sourceName: '', operator: '>', threshold: 0 },
  },

  // ── Actions (THEN) ────────────────────────────────────────
  {
    type: 'buy_yes',
    category: 'action',
    label: 'Buy YES',
    defaultConfig: { amountUSD: 100, slippage: 0.02 },
  },
  {
    type: 'buy_no',
    category: 'action',
    label: 'Buy NO',
    defaultConfig: { amountUSD: 100, slippage: 0.02 },
  },
  {
    type: 'sell_position',
    category: 'action',
    label: 'Sell Position',
    defaultConfig: { percent: 100 },
  },
  {
    type: 'limit_order',
    category: 'action',
    label: 'Limit Order',
    defaultConfig: { side: 'YES', limitPrice: 0.5, amountUSD: 100 },
  },
  {
    type: 'send_alert',
    category: 'action',
    label: 'Send Alert',
    defaultConfig: { message: '' },
  },
];

export const MARKET_ITEMS = PALETTE_ITEMS.filter(p => p.category === 'market');
export const CONDITION_ITEMS = PALETTE_ITEMS.filter(p => p.category === 'condition');
export const ACTION_ITEMS = PALETTE_ITEMS.filter(p => p.category === 'action');

/** Creates a pre-filled palette item for a specific saved data source. */
export function makeCustomSourcePaletteItem(source: CustomDataSource): PaletteItem {
  return {
    type: 'custom_datasource',
    category: 'condition',
    label: source.name,
    defaultConfig: {
      sourceId: source.id,
      sourceName: source.name,
      operator: '>',
      threshold: 0,
    },
  };
}

export const CATEGORY_META = {
  market: {
    tag: 'FOR',
    solidRgb: 'rgb(245, 158, 11)',
    rgb: { r: 245, g: 158, b: 11 },
    hexColor: '#1652F0',
    glow: 'rgba(245,158,11,0.12)',
    shadowOuter: 'rgba(245,158,11,0.08)',
    shadowInner: 'rgba(245,158,11,0.03)',
    textClass: 'text-blue-500',
    bgClass: 'bg-blue-600/[0.06]',
    borderClass: 'border-blue-600/20',
    dotClass: 'bg-blue-500',
  },
  condition: {
    tag: 'IF',
    solidRgb: 'rgb(99, 102, 241)',
    rgb: { r: 99, g: 102, b: 241 },
    hexColor: '#6366f1',
    glow: 'rgba(99,102,241,0.12)',
    shadowOuter: 'rgba(99,102,241,0.08)',
    shadowInner: 'rgba(99,102,241,0.03)',
    textClass: 'text-indigo-400',
    bgClass: 'bg-indigo-500/[0.06]',
    borderClass: 'border-indigo-500/20',
    dotClass: 'bg-indigo-400',
  },
  action: {
    tag: 'THEN',
    solidRgb: 'rgb(16, 185, 129)',
    rgb: { r: 16, g: 185, b: 129 },
    hexColor: '#10b981',
    glow: 'rgba(16,185,129,0.12)',
    shadowOuter: 'rgba(16,185,129,0.08)',
    shadowInner: 'rgba(16,185,129,0.03)',
    textClass: 'text-emerald-400',
    bgClass: 'bg-emerald-500/[0.06]',
    borderClass: 'border-emerald-500/20',
    dotClass: 'bg-emerald-400',
  },
} as const;
