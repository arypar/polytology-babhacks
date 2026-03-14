import type { BlockCategory, BlockType, StrategyBlock } from '@/lib/types';

export interface BlockDefinition {
  type: BlockType;
  category: BlockCategory;
  label: string;
  description: string;
  icon: string; // lucide icon name
  color: string;
  defaultParams: Record<string, string | number | boolean>;
  paramSchema: Array<{
    key: string;
    label: string;
    type: 'number' | 'text' | 'select' | 'boolean';
    options?: string[];
    min?: number;
    max?: number;
    step?: number;
    placeholder?: string;
  }>;
}

export const BLOCK_DEFINITIONS: BlockDefinition[] = [
  // ── Triggers ──────────────────────────────────────────────
  {
    type: 'price_crosses',
    category: 'trigger',
    label: 'Price Crosses',
    description: 'Trigger when YES probability crosses a threshold',
    icon: 'TrendingUp',
    color: '#2E5CFF',
    defaultParams: { threshold: 0.5, direction: 'above' },
    paramSchema: [
      { key: 'threshold', label: 'Probability Threshold', type: 'number', min: 0.01, max: 0.99, step: 0.01, placeholder: '0.50' },
      { key: 'direction', label: 'Direction', type: 'select', options: ['above', 'below'] },
    ],
  },
  {
    type: 'probability_range',
    category: 'trigger',
    label: 'Probability Range',
    description: 'Trigger when YES probability enters a range',
    icon: 'Target',
    color: '#2E5CFF',
    defaultParams: { low: 0.3, high: 0.7 },
    paramSchema: [
      { key: 'low', label: 'Lower Bound', type: 'number', min: 0, max: 1, step: 0.01 },
      { key: 'high', label: 'Upper Bound', type: 'number', min: 0, max: 1, step: 0.01 },
    ],
  },
  {
    type: 'volume_spike',
    category: 'trigger',
    label: 'Volume Spike',
    description: 'Trigger on abnormal trading volume',
    icon: 'Flame',
    color: '#2E5CFF',
    defaultParams: { multiplier: 3, window: '1h' },
    paramSchema: [
      { key: 'multiplier', label: 'Volume Multiplier', type: 'number', min: 1.5, max: 20, step: 0.5 },
      { key: 'window', label: 'Time Window', type: 'select', options: ['15m', '1h', '4h', '24h'] },
    ],
  },
  {
    type: 'market_resolves_soon',
    category: 'trigger',
    label: 'Resolves Soon',
    description: 'Trigger when market is close to resolution',
    icon: 'AlarmClock',
    color: '#2E5CFF',
    defaultParams: { hoursBeforeClose: 24 },
    paramSchema: [
      { key: 'hoursBeforeClose', label: 'Hours Before Close', type: 'number', min: 1, max: 168, step: 1 },
    ],
  },
  {
    type: 'time_based',
    category: 'trigger',
    label: 'Time Schedule',
    description: 'Trigger on a recurring schedule',
    icon: 'Clock',
    color: '#2E5CFF',
    defaultParams: { interval: '1h', startHour: 9, endHour: 17 },
    paramSchema: [
      { key: 'interval', label: 'Interval', type: 'select', options: ['15m', '1h', '4h', '24h'] },
      { key: 'startHour', label: 'Active From (UTC)', type: 'number', min: 0, max: 23, step: 1 },
      { key: 'endHour', label: 'Active Until (UTC)', type: 'number', min: 0, max: 23, step: 1 },
    ],
  },

  // ── Conditions ────────────────────────────────────────────
  {
    type: 'and',
    category: 'condition',
    label: 'AND Gate',
    description: 'All connected inputs must be true',
    icon: 'GitMerge',
    color: '#8B5CF6',
    defaultParams: {},
    paramSchema: [],
  },
  {
    type: 'or',
    category: 'condition',
    label: 'OR Gate',
    description: 'Any connected input must be true',
    icon: 'GitFork',
    color: '#8B5CF6',
    defaultParams: {},
    paramSchema: [],
  },
  {
    type: 'cooldown',
    category: 'condition',
    label: 'Cooldown',
    description: 'Minimum time between executions',
    icon: 'ShieldCheck',
    color: '#8B5CF6',
    defaultParams: { minutes: 60 },
    paramSchema: [
      { key: 'minutes', label: 'Cooldown (minutes)', type: 'number', min: 1, max: 1440, step: 1 },
    ],
  },
  {
    type: 'position_size_limit',
    category: 'condition',
    label: 'Position Limit',
    description: 'Limit total exposure per market',
    icon: 'Lock',
    color: '#8B5CF6',
    defaultParams: { maxUSD: 500 },
    paramSchema: [
      { key: 'maxUSD', label: 'Max Position ($)', type: 'number', min: 10, max: 100000, step: 10 },
    ],
  },
  {
    type: 'max_trades_per_day',
    category: 'condition',
    label: 'Daily Trade Limit',
    description: 'Limit number of trades per day',
    icon: 'CalendarDays',
    color: '#8B5CF6',
    defaultParams: { maxTrades: 5 },
    paramSchema: [
      { key: 'maxTrades', label: 'Max Trades / Day', type: 'number', min: 1, max: 100, step: 1 },
    ],
  },

  // ── Actions ───────────────────────────────────────────────
  {
    type: 'buy_yes',
    category: 'action',
    label: 'Buy YES',
    description: 'Buy YES shares in the target market',
    icon: 'ArrowUpCircle',
    color: '#00C853',
    defaultParams: { amountUSD: 100, slippage: 0.02 },
    paramSchema: [
      { key: 'amountUSD', label: 'Amount ($)', type: 'number', min: 1, max: 100000, step: 1 },
      { key: 'slippage', label: 'Max Slippage', type: 'number', min: 0.001, max: 0.1, step: 0.001 },
    ],
  },
  {
    type: 'buy_no',
    category: 'action',
    label: 'Buy NO',
    description: 'Buy NO shares in the target market',
    icon: 'ArrowDownCircle',
    color: '#FF3D57',
    defaultParams: { amountUSD: 100, slippage: 0.02 },
    paramSchema: [
      { key: 'amountUSD', label: 'Amount ($)', type: 'number', min: 1, max: 100000, step: 1 },
      { key: 'slippage', label: 'Max Slippage', type: 'number', min: 0.001, max: 0.1, step: 0.001 },
    ],
  },
  {
    type: 'sell_position',
    category: 'action',
    label: 'Sell Position',
    description: 'Close out an existing position',
    icon: 'Wallet',
    color: '#FFB300',
    defaultParams: { percent: 100 },
    paramSchema: [
      { key: 'percent', label: 'Sell % of Position', type: 'number', min: 1, max: 100, step: 1 },
    ],
  },
  {
    type: 'set_limit_order',
    category: 'action',
    label: 'Limit Order',
    description: 'Place a limit order at a target price',
    icon: 'ClipboardList',
    color: '#FFB300',
    defaultParams: { side: 'YES', limitPrice: 0.5, amountUSD: 100 },
    paramSchema: [
      { key: 'side', label: 'Side', type: 'select', options: ['YES', 'NO'] },
      { key: 'limitPrice', label: 'Limit Price', type: 'number', min: 0.01, max: 0.99, step: 0.01 },
      { key: 'amountUSD', label: 'Amount ($)', type: 'number', min: 1, max: 100000, step: 1 },
    ],
  },
  {
    type: 'notify',
    category: 'action',
    label: 'Send Alert',
    description: 'Send a notification when triggered',
    icon: 'Bell',
    color: '#8B5CF6',
    defaultParams: { message: 'Strategy triggered!' },
    paramSchema: [
      { key: 'message', label: 'Message', type: 'text', placeholder: 'Strategy triggered!' },
    ],
  },
];

export const TRIGGER_BLOCKS = BLOCK_DEFINITIONS.filter(b => b.category === 'trigger');
export const CONDITION_BLOCKS = BLOCK_DEFINITIONS.filter(b => b.category === 'condition');
export const ACTION_BLOCKS = BLOCK_DEFINITIONS.filter(b => b.category === 'action');

export function createBlock(def: BlockDefinition, position = { x: 200, y: 100 }): StrategyBlock {
  return {
    id: crypto.randomUUID(),
    type: def.type,
    category: def.category,
    label: def.label,
    params: { ...def.defaultParams },
    position,
    connectedTo: [],
  };
}
