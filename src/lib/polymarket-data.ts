import type { PolymarketMarket, PolymarketPricePoint, MarketCategory } from './types';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

export async function fetchMarkets(params?: {
  category?: MarketCategory;
  limit?: number;
  offset?: number;
}): Promise<PolymarketMarket[]> {
  const qs = new URLSearchParams();
  if (params?.category) qs.set('category', params.category);
  if (params?.limit)    qs.set('limit', String(params.limit));
  if (params?.offset)   qs.set('offset', String(params.offset));

  try {
    const res = await fetch(`${API_BASE}/polymarket/markets?${qs}`);
    if (!res.ok) return [];
    return res.json();
  } catch {
    return [];
  }
}

export async function fetchMarketHistory(conditionId: string): Promise<PolymarketPricePoint[]> {
  try {
    const res = await fetch(`${API_BASE}/polymarket/market/${conditionId}/history`);
    if (!res.ok) return [];
    return res.json();
  } catch {
    return [];
  }
}

export const CATEGORIES: MarketCategory[] = [
  'Politics', 'Crypto', 'Sports', 'Business', 'Science', 'World', 'Entertainment', 'Other',
];

// ── New detail-view fetchers ──────────────────────────────────

export interface OrderBookLevel { price: number; size: number }
export interface OrderBook {
  bids: OrderBookLevel[];
  asks: OrderBookLevel[];
  spread: number | null;
  bestBid: number | null;
  bestAsk: number | null;
}

export async function fetchOrderBook(conditionId: string): Promise<OrderBook> {
  try {
    const res = await fetch(`${API_BASE}/polymarket/market/${conditionId}/orderbook`);
    if (!res.ok) return { bids: [], asks: [], spread: null, bestBid: null, bestAsk: null };
    return res.json();
  } catch {
    return { bids: [], asks: [], spread: null, bestBid: null, bestAsk: null };
  }
}

export interface NormalizedTrade {
  id?: string;
  side: string;
  outcome: string;
  size: number;
  price: number;
  notional: number;
  ts: number;
}

export type AlphaTipKind = 'large_buy' | 'large_sell' | 'one_sided_pressure' | 'unusual_activity' | 'whale_accumulation';

export interface AlphaTip {
  kind: AlphaTipKind;
  label: string;
  detail: string;
  severity: 'low' | 'medium' | 'high';
  ts?: number;
}

export interface TradesResponse {
  trades: NormalizedTrade[];
  alphaTips: AlphaTip[];
}

export async function fetchMarketTrades(conditionId: string): Promise<TradesResponse> {
  try {
    const res = await fetch(`${API_BASE}/polymarket/market/${conditionId}/trades`);
    if (!res.ok) return { trades: [], alphaTips: [] };
    return res.json();
  } catch {
    return { trades: [], alphaTips: [] };
  }
}

export interface NewsArticle {
  title: string;
  description?: string;
  url: string;
  publishedAt: string;
  imageUrl?: string;
  source?: string;
}

export interface NewsResponse {
  articles: NewsArticle[];
  error?: string;
}

export async function fetchMarketNews(conditionId: string, question: string): Promise<NewsResponse> {
  try {
    const qs = new URLSearchParams({ question });
    const res = await fetch(`${API_BASE}/polymarket/market/${conditionId}/news?${qs}`);
    if (!res.ok) return { articles: [] };
    return res.json();
  } catch {
    return { articles: [] };
  }
}
