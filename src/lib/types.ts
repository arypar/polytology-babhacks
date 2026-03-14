// ── Polymarket types ──────────────────────────────────────────

export type MarketCategory =
  | 'Politics'
  | 'Crypto'
  | 'Sports'
  | 'Science'
  | 'Entertainment'
  | 'Business'
  | 'World'
  | 'Other';

export interface PolymarketOutcome {
  name: string;      // e.g. "Yes" | "No" or team names
  price: number;     // 0–1 probability
  tokenId?: string;  // CLOB outcome token ID — required to place orders
}

export interface PolymarketMarket {
  id: string;
  conditionId: string;
  slug: string;
  question: string;
  description?: string;
  category: MarketCategory;
  endDate: string;
  image?: string;
  outcomes: PolymarketOutcome[];
  volume24h: number;
  volumeTotal: number;
  liquidity: number;
  /** Probability delta in last 24h for the YES outcome (–1 to 1) */
  priceChange24h: number;
  active: boolean;
  closed: boolean;
  tags?: string[];
}

export interface PolymarketPricePoint {
  t: number;   // unix timestamp
  p: number;   // probability 0–1
}

// ── Autonomous trading block types ───────────────────────────

export type BlockCategory = 'trigger' | 'condition' | 'action';

export type TriggerBlockType =
  | 'price_crosses'
  | 'probability_range'
  | 'volume_spike'
  | 'market_resolves_soon'
  | 'time_based';

export type ConditionBlockType =
  | 'and'
  | 'or'
  | 'cooldown'
  | 'position_size_limit'
  | 'max_trades_per_day';

export type ActionBlockType =
  | 'buy_yes'
  | 'buy_no'
  | 'sell_position'
  | 'set_limit_order'
  | 'notify';

export type BlockType = TriggerBlockType | ConditionBlockType | ActionBlockType;

export interface StrategyBlock {
  id: string;
  type: BlockType;
  category: BlockCategory;
  label: string;
  params: Record<string, string | number | boolean>;
  position: { x: number; y: number };
  connectedTo?: string[];
}

export interface AutonomousStrategy {
  id: string;
  name: string;
  description?: string;
  blocks: StrategyBlock[];
  enabled: boolean;
  marketId?: string;
  marketQuestion?: string;
  createdAt: number;
  updatedAt: number;
}

// ── Custom data sources ───────────────────────────────────────

export interface CustomDataSource {
  id: string;
  name: string;
  url: string;
  headers: Record<string, string>;
  valuePath: string;
  description: string;
  refreshMs: number;
}

// ── Executing trades ──────────────────────────────────────────

export type TradeStatus = 'pending' | 'filled' | 'failed' | 'cancelled';
export type TradeSide = 'YES' | 'NO';
export type StrategyStatus = 'running' | 'paused' | 'stopped';

export interface ExecutingTrade {
  id: string;
  strategyId: string;
  strategyName: string;
  marketId: string;
  marketQuestion: string;
  side: TradeSide;
  shares: number;
  entryPrice: number;
  currentPrice: number;
  status: TradeStatus;
  timestamp: number;
  txHash?: string;
  pnl?: number;
}

export interface StrategyRuntime {
  strategyId: string;
  strategyName: string;
  status: StrategyStatus;
  tradesExecuted: number;
  totalDeployed: number;
  realizedPnl: number;
  unrealizedPnl: number;
  winRate: number;
  startedAt: number;
  lastTradeAt?: number;
}
