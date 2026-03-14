import type { PolymarketMarket, PolymarketPricePoint, MarketCategory } from './types';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

export async function fetchMarkets(params?: {
  category?: MarketCategory;
  limit?: number;
  offset?: number;
}): Promise<PolymarketMarket[]> {
  const qs = new URLSearchParams();
  if (params?.category) qs.set('category', params.category);
  if (params?.limit) qs.set('limit', String(params.limit));
  if (params?.offset) qs.set('offset', String(params.offset));

  try {
    const res = await fetch(`${API_BASE}/polymarket/markets?${qs}`);
    if (!res.ok) return MOCK_MARKETS;
    return res.json();
  } catch {
    return MOCK_MARKETS;
  }
}

export async function fetchMarketHistory(conditionId: string): Promise<PolymarketPricePoint[]> {
  try {
    const res = await fetch(`${API_BASE}/polymarket/market/${conditionId}/history`);
    if (!res.ok) return generateMockHistory();
    return res.json();
  } catch {
    return generateMockHistory();
  }
}

function generateMockHistory(days = 30, startPrice?: number): PolymarketPricePoint[] {
  const points: PolymarketPricePoint[] = [];
  const now = Date.now();
  let price = startPrice ?? 0.3 + Math.random() * 0.4;

  for (let i = days * 24; i >= 0; i--) {
    const drift = (Math.random() - 0.48) * 0.015;
    price = Math.max(0.02, Math.min(0.98, price + drift));
    points.push({ t: now - i * 3600 * 1000, p: price });
  }
  return points;
}

export const MOCK_MARKETS: PolymarketMarket[] = [
  {
    id: 'mkt-trump-win',
    conditionId: 'cond-trump-win',
    slug: 'will-trump-win-2024',
    question: 'Will Donald Trump win the 2024 US Presidential Election?',
    description: 'This market resolves YES if Donald Trump wins the 2024 US Presidential Election.',
    category: 'Politics',
    endDate: '2024-11-06T00:00:00Z',
    outcomes: [
      { name: 'Yes', price: 0.72 },
      { name: 'No', price: 0.28 },
    ],
    volume24h: 4_820_000,
    volumeTotal: 89_400_000,
    liquidity: 12_300_000,
    priceChange24h: 0.04,
    active: true,
    closed: false,
    tags: ['US Election', 'Trump', '2024'],
  },
  {
    id: 'mkt-btc-100k',
    conditionId: 'cond-btc-100k',
    slug: 'btc-100k-eoy',
    question: 'Will Bitcoin reach $100,000 by end of 2024?',
    description: 'Resolves YES if Bitcoin closes at or above $100,000 on any day before January 1, 2025.',
    category: 'Crypto',
    endDate: '2025-01-01T00:00:00Z',
    outcomes: [
      { name: 'Yes', price: 0.59 },
      { name: 'No', price: 0.41 },
    ],
    volume24h: 2_140_000,
    volumeTotal: 34_700_000,
    liquidity: 6_800_000,
    priceChange24h: 0.08,
    active: true,
    closed: false,
    tags: ['Bitcoin', 'Crypto', 'Price'],
  },
  {
    id: 'mkt-fed-cut',
    conditionId: 'cond-fed-cut',
    slug: 'fed-rate-cut-sept',
    question: 'Will the Federal Reserve cut rates in September 2024?',
    description: 'Resolves YES if the FOMC announces a rate cut at the September 2024 meeting.',
    category: 'Business',
    endDate: '2024-09-20T00:00:00Z',
    outcomes: [
      { name: 'Yes', price: 0.38 },
      { name: 'No', price: 0.62 },
    ],
    volume24h: 980_000,
    volumeTotal: 14_200_000,
    liquidity: 3_100_000,
    priceChange24h: -0.06,
    active: true,
    closed: false,
    tags: ['Fed', 'Interest Rates', 'Macro'],
  },
  {
    id: 'mkt-eth-etf',
    conditionId: 'cond-eth-etf',
    slug: 'eth-spot-etf-2024',
    question: 'Will a spot Ethereum ETF be approved by the SEC before August 2024?',
    description: 'Resolves YES if the SEC approves any spot Ethereum ETF application before August 1, 2024.',
    category: 'Crypto',
    endDate: '2024-08-01T00:00:00Z',
    outcomes: [
      { name: 'Yes', price: 0.88 },
      { name: 'No', price: 0.12 },
    ],
    volume24h: 1_670_000,
    volumeTotal: 22_800_000,
    liquidity: 5_200_000,
    priceChange24h: 0.11,
    active: true,
    closed: false,
    tags: ['Ethereum', 'ETF', 'SEC'],
  },
  {
    id: 'mkt-recession',
    conditionId: 'cond-recession',
    slug: 'us-recession-2024',
    question: 'Will there be a US recession in 2024?',
    description: 'Resolves YES if two consecutive quarters of negative GDP growth are reported for 2024.',
    category: 'Business',
    endDate: '2025-01-31T00:00:00Z',
    outcomes: [
      { name: 'Yes', price: 0.22 },
      { name: 'No', price: 0.78 },
    ],
    volume24h: 540_000,
    volumeTotal: 8_900_000,
    liquidity: 2_400_000,
    priceChange24h: -0.03,
    active: true,
    closed: false,
    tags: ['US Economy', 'Macro', 'Recession'],
  },
  {
    id: 'mkt-nfl-super',
    conditionId: 'cond-nfl-super',
    slug: 'super-bowl-lviii-winner',
    question: 'Will the Kansas City Chiefs win Super Bowl LVIII?',
    description: 'Resolves YES if the Kansas City Chiefs win Super Bowl LVIII.',
    category: 'Sports',
    endDate: '2024-02-12T00:00:00Z',
    outcomes: [
      { name: 'Yes', price: 0.55 },
      { name: 'No', price: 0.45 },
    ],
    volume24h: 3_290_000,
    volumeTotal: 45_600_000,
    liquidity: 8_900_000,
    priceChange24h: 0.02,
    active: true,
    closed: false,
    tags: ['NFL', 'Super Bowl', 'Kansas City'],
  },
  {
    id: 'mkt-ai-gpt5',
    conditionId: 'cond-ai-gpt5',
    slug: 'gpt5-released-2024',
    question: 'Will OpenAI release GPT-5 before end of 2024?',
    description: 'Resolves YES if OpenAI officially releases GPT-5 as a product before January 1, 2025.',
    category: 'Science',
    endDate: '2025-01-01T00:00:00Z',
    outcomes: [
      { name: 'Yes', price: 0.44 },
      { name: 'No', price: 0.56 },
    ],
    volume24h: 1_230_000,
    volumeTotal: 16_400_000,
    liquidity: 3_800_000,
    priceChange24h: -0.04,
    active: true,
    closed: false,
    tags: ['AI', 'OpenAI', 'GPT'],
  },
  {
    id: 'mkt-sol-price',
    conditionId: 'cond-sol-price',
    slug: 'sol-300-2024',
    question: 'Will Solana (SOL) reach $300 before end of 2024?',
    description: 'Resolves YES if SOL/USD closes at or above $300 on any exchange before January 1, 2025.',
    category: 'Crypto',
    endDate: '2025-01-01T00:00:00Z',
    outcomes: [
      { name: 'Yes', price: 0.31 },
      { name: 'No', price: 0.69 },
    ],
    volume24h: 890_000,
    volumeTotal: 11_200_000,
    liquidity: 2_700_000,
    priceChange24h: 0.05,
    active: true,
    closed: false,
    tags: ['Solana', 'Crypto', 'Price'],
  },
  {
    id: 'mkt-harris-win',
    conditionId: 'cond-harris-win',
    slug: 'harris-2024-win',
    question: 'Will Kamala Harris win the 2024 US Presidential Election?',
    category: 'Politics',
    endDate: '2024-11-06T00:00:00Z',
    outcomes: [
      { name: 'Yes', price: 0.28 },
      { name: 'No', price: 0.72 },
    ],
    volume24h: 3_200_000,
    volumeTotal: 62_100_000,
    liquidity: 9_800_000,
    priceChange24h: -0.04,
    active: true,
    closed: false,
    tags: ['US Election', 'Harris', '2024'],
  },
  {
    id: 'mkt-ukraine',
    conditionId: 'cond-ukraine',
    slug: 'ukraine-ceasefire-2024',
    question: 'Will Ukraine and Russia agree to a ceasefire in 2024?',
    category: 'World',
    endDate: '2025-01-01T00:00:00Z',
    outcomes: [
      { name: 'Yes', price: 0.14 },
      { name: 'No', price: 0.86 },
    ],
    volume24h: 430_000,
    volumeTotal: 7_200_000,
    liquidity: 1_900_000,
    priceChange24h: 0.01,
    active: true,
    closed: false,
    tags: ['Geopolitics', 'Ukraine', 'War'],
  },
  {
    id: 'mkt-tesla',
    conditionId: 'cond-tesla',
    slug: 'tesla-300-2024',
    question: 'Will Tesla stock reach $300 in 2024?',
    category: 'Business',
    endDate: '2025-01-01T00:00:00Z',
    outcomes: [
      { name: 'Yes', price: 0.48 },
      { name: 'No', price: 0.52 },
    ],
    volume24h: 720_000,
    volumeTotal: 9_800_000,
    liquidity: 2_300_000,
    priceChange24h: -0.07,
    active: true,
    closed: false,
    tags: ['Tesla', 'Stocks', 'Equities'],
  },
  {
    id: 'mkt-nba',
    conditionId: 'cond-nba',
    slug: 'nba-finals-celtics',
    question: 'Will the Boston Celtics win the 2024 NBA Championship?',
    category: 'Sports',
    endDate: '2024-06-30T00:00:00Z',
    outcomes: [
      { name: 'Yes', price: 0.62 },
      { name: 'No', price: 0.38 },
    ],
    volume24h: 1_820_000,
    volumeTotal: 18_400_000,
    liquidity: 4_200_000,
    priceChange24h: 0.09,
    active: true,
    closed: false,
    tags: ['NBA', 'Basketball', 'Celtics'],
  },
];

export const CATEGORIES: MarketCategory[] = [
  'Politics', 'Crypto', 'Sports', 'Business', 'Science', 'World', 'Entertainment', 'Other',
];
