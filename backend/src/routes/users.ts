import { Router } from 'express';

const router = Router();

const DATA_API = 'https://data-api.polymarket.com';
const GAMMA_API = 'https://gamma-api.polymarket.com';

// ── Cache ─────────────────────────────────────────────────────

const cache = new Map<string, { data: unknown; ts: number; ttl: number }>();
const ACTIVITY_TTL_MS  = 60_000;   // 60s
const POSITIONS_TTL_MS = 30_000;   // 30s
const PNL_TTL_MS       = 60_000;   // 60s
const SEARCH_TTL_MS    = 30_000;   // 30s
const PROFILE_TTL_MS   = 120_000;  // 2min

function getCached<T>(key: string): T | null {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.ts > entry.ttl) { cache.delete(key); return null; }
  return entry.data as T;
}
function setCached(key: string, data: unknown, ttl = ACTIVITY_TTL_MS) {
  cache.set(key, { data, ts: Date.now(), ttl });
}

// ── Profile types ─────────────────────────────────────────────

interface DataApiProfile {
  proxyWallet?: string;    // the address used in activity/positions calls
  address?: string;
  name?: string;
  username?: string;
  bio?: string;
  pfpUrl?: string;
  twitterUsername?: string;
  website?: string;
}

interface NormalizedProfile {
  address: string;         // proxyWallet (used for data lookups)
  eoaAddress: string;      // original EOA if different
  name: string;
  username: string;
  bio: string;
  avatarUrl: string;
  twitterUsername: string;
  polymarketUrl: string;
}

function normalizeProfile(p: DataApiProfile): NormalizedProfile {
  const address = p.proxyWallet ?? p.address ?? '';
  return {
    address,
    eoaAddress: p.address ?? address,
    name: p.name ?? p.username ?? '',
    username: p.username ?? '',
    bio: p.bio ?? '',
    avatarUrl: p.pfpUrl ?? '',
    twitterUsername: p.twitterUsername ?? '',
    polymarketUrl: `https://polymarket.com/profile/${address}`,
  };
}

// ── Types ─────────────────────────────────────────────────────

interface DataApiActivity {
  id?: string;
  transactionHash?: string;
  type?: string;
  side?: string;          // 'BUY' | 'SELL'
  outcomeIndex?: number;
  outcome?: string;       // 'Yes' | 'No'
  title?: string;
  conditionId?: string;
  market?: string;        // conditionId fallback
  proxyWallet?: string;
  timestamp?: number;     // unix seconds
  usdcSize?: number | string;
  size?: number | string;
  price?: number | string;
}

interface DataApiPosition {
  conditionId?: string;
  market?: string;
  title?: string;
  outcome?: string;
  outcomeIndex?: number;
  size?: number | string;
  avgPrice?: number | string;
  initialValue?: number | string;
  currentValue?: number | string;
  cashPnl?: number | string;
  percentPnl?: number | string;
  curPrice?: number | string;
  redeemable?: boolean;
}

interface DataApiPortfolio {
  profit?: number | string;
  volume?: number | string;
  tradesCount?: number;
  positionsValue?: number | string;
}

// ── Normalizers ───────────────────────────────────────────────

interface NormalizedActivity {
  id: string;
  date: string;      // ISO date string (YYYY-MM-DD)
  ts: number;        // unix ms
  side: 'BUY' | 'SELL';
  outcome: string;
  market: string;
  title: string;
  notional: number;
  size: number;
  price: number;
}

interface NormalizedPosition {
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

interface NormalizedPnl {
  totalProfit: number;
  totalVolume: number;
  tradesCount: number;
  positionsValue: number;
  winRate: number | null;
}

function normalizeActivity(a: DataApiActivity): NormalizedActivity {
  const tsMs = (Number(a.timestamp ?? 0)) * 1000;
  const date = tsMs ? new Date(tsMs).toISOString().slice(0, 10) : '';
  const price = Number(a.price ?? 0);
  const size  = Number(a.size ?? a.usdcSize ?? 0);
  const notional = price > 0 && size > 0 ? size * price : Number(a.usdcSize ?? 0);

  return {
    id: a.id ?? a.transactionHash ?? `${tsMs}-${Math.random()}`,
    date,
    ts: tsMs,
    side: ((a.side ?? 'BUY').toUpperCase() === 'SELL' ? 'SELL' : 'BUY') as 'BUY' | 'SELL',
    outcome: a.outcome ?? (a.outcomeIndex === 1 ? 'No' : 'Yes'),
    market: a.conditionId ?? a.market ?? '',
    title: a.title ?? a.market ?? '',
    notional,
    size,
    price,
  };
}

function normalizePosition(p: DataApiPosition): NormalizedPosition {
  const initialValue  = Number(p.initialValue ?? 0);
  const currentValue  = Number(p.currentValue ?? 0);
  const unrealizedPnl = Number(p.cashPnl ?? (currentValue - initialValue));
  const unrealizedPnlPct = initialValue > 0
    ? Number(p.percentPnl ?? ((unrealizedPnl / initialValue) * 100))
    : 0;

  return {
    conditionId: p.conditionId ?? p.market ?? '',
    title: p.title ?? '',
    outcome: p.outcome ?? (p.outcomeIndex === 1 ? 'No' : 'Yes'),
    size: Number(p.size ?? 0),
    avgPrice: Number(p.avgPrice ?? 0),
    currentPrice: Number(p.curPrice ?? 0),
    initialValue,
    currentValue,
    unrealizedPnl,
    unrealizedPnlPct,
    redeemable: p.redeemable ?? false,
  };
}

// ── Routes ────────────────────────────────────────────────────

// GET /polymarket/users/search?q=<username>
// Search profiles by username prefix — used for autocomplete
router.get('/users/search', async (req, res) => {
  const { q = '', limit = '8' } = req.query as Record<string, string>;
  const query = q.trim().toLowerCase();
  if (!query || query.length < 2) return res.json({ profiles: [] });

  const cacheKey = `user-search-${query}-${limit}`;
  const cached = getCached<unknown>(cacheKey);
  if (cached) return res.json(cached);

  try {
    const url = `${DATA_API}/profiles?username=${encodeURIComponent(query)}&limit=${limit}`;
    const apiRes = await fetch(url, {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(8_000),
    });

    if (!apiRes.ok) {
      console.error('[users] Data API search returned', apiRes.status);
      return res.json({ profiles: [] });
    }

    const raw: DataApiProfile[] = await apiRes.json();
    const profiles = (Array.isArray(raw) ? raw : [raw]).map(normalizeProfile).filter(p => p.address);

    const result = { profiles };
    setCached(cacheKey, result, SEARCH_TTL_MS);
    return res.json(result);
  } catch (err) {
    console.error('[users] Failed to search profiles:', err);
    return res.json({ profiles: [] });
  }
});

// GET /polymarket/user/:address/profile
// Fetch a single profile by address (proxy wallet or EOA)
router.get('/user/:address/profile', async (req, res) => {
  const { address } = req.params;
  const cacheKey = `user-profile-${address.toLowerCase()}`;

  const cached = getCached<unknown>(cacheKey);
  if (cached) return res.json(cached);

  try {
    const url = `${DATA_API}/profile?address=${address}`;
    const apiRes = await fetch(url, {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(8_000),
    });

    if (!apiRes.ok) {
      // No profile found — return a minimal stub so the UI can still show data
      return res.json({ address, eoaAddress: address, name: '', username: '', bio: '', avatarUrl: '', twitterUsername: '', polymarketUrl: `https://polymarket.com/profile/${address}` });
    }

    const raw: DataApiProfile = await apiRes.json();
    const profile = normalizeProfile(raw);
    // If the API returns a proxyWallet different from the queried address, also cache under proxyWallet
    if (profile.address && profile.address.toLowerCase() !== address.toLowerCase()) {
      setCached(`user-profile-${profile.address.toLowerCase()}`, profile, PROFILE_TTL_MS);
    }

    setCached(cacheKey, profile, PROFILE_TTL_MS);
    return res.json(profile);
  } catch (err) {
    console.error('[users] Failed to fetch profile:', err);
    return res.json({ address, eoaAddress: address, name: '', username: '', bio: '', avatarUrl: '', twitterUsername: '', polymarketUrl: `https://polymarket.com/profile/${address}` });
  }
});

// GET /polymarket/user/:address/activity
// Returns normalized trade activity + daily buckets for heatmap
router.get('/user/:address/activity', async (req, res) => {
  const { address } = req.params;
  const { limit = '500' } = req.query as Record<string, string>;
  const cacheKey = `user-activity-${address.toLowerCase()}-${limit}`;

  const cached = getCached<unknown>(cacheKey);
  if (cached) return res.json(cached);

  try {
    const url = `${DATA_API}/activity?user=${address}&limit=${limit}`;
    const apiRes = await fetch(url, {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(10_000),
    });

    if (!apiRes.ok) {
      console.error('[users] Data API activity returned', apiRes.status);
      return res.json({ trades: [], dailyBuckets: {} });
    }

    const raw: DataApiActivity[] = await apiRes.json();
    const activities = raw.map(normalizeActivity).filter(a => a.date);

    // Aggregate into daily buckets for the heatmap
    const dailyBuckets: Record<string, { buyNotional: number; sellNotional: number; count: number }> = {};
    for (const a of activities) {
      if (!dailyBuckets[a.date]) {
        dailyBuckets[a.date] = { buyNotional: 0, sellNotional: 0, count: 0 };
      }
      if (a.side === 'BUY') dailyBuckets[a.date].buyNotional += a.notional;
      else                  dailyBuckets[a.date].sellNotional += a.notional;
      dailyBuckets[a.date].count++;
    }

    const result = { trades: activities.slice(0, 100), dailyBuckets };
    setCached(cacheKey, result, ACTIVITY_TTL_MS);
    return res.json(result);
  } catch (err) {
    console.error('[users] Failed to fetch activity:', err);
    return res.json({ trades: [], dailyBuckets: {} });
  }
});

// GET /polymarket/user/:address/positions
// Returns open positions with unrealized PnL
router.get('/user/:address/positions', async (req, res) => {
  const { address } = req.params;
  const cacheKey = `user-positions-${address.toLowerCase()}`;

  const cached = getCached<unknown>(cacheKey);
  if (cached) return res.json(cached);

  try {
    const url = `${DATA_API}/positions?user=${address}&sizeThreshold=0.01&redeemable=false&sortBy=currentValue&sortDirection=DESC`;
    const apiRes = await fetch(url, {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(10_000),
    });

    if (!apiRes.ok) {
      console.error('[users] Data API positions returned', apiRes.status);
      return res.json({ positions: [] });
    }

    const raw: DataApiPosition[] = await apiRes.json();
    const positions = raw.map(normalizePosition);

    // Enrich titles from Gamma if missing
    const missing = positions.filter(p => !p.title && p.conditionId);
    if (missing.length > 0) {
      try {
        const ids = missing.map(p => p.conditionId).join(',');
        const gammaRes = await fetch(`${GAMMA_API}/markets?conditionIds=${ids}`, {
          headers: { Accept: 'application/json' },
          signal: AbortSignal.timeout(6_000),
        });
        if (gammaRes.ok) {
          const markets: Array<{ conditionId?: string; question?: string }> = await gammaRes.json();
          const titleMap = new Map(markets.map(m => [m.conditionId, m.question ?? '']));
          for (const p of positions) {
            if (!p.title) p.title = titleMap.get(p.conditionId) ?? p.conditionId;
          }
        }
      } catch { /* skip enrichment */ }
    }

    const result = { positions };
    setCached(cacheKey, result, POSITIONS_TTL_MS);
    return res.json(result);
  } catch (err) {
    console.error('[users] Failed to fetch positions:', err);
    return res.json({ positions: [] });
  }
});

// GET /polymarket/user/:address/pnl
// Returns portfolio-level PnL stats
router.get('/user/:address/pnl', async (req, res) => {
  const { address } = req.params;
  const cacheKey = `user-pnl-${address.toLowerCase()}`;

  const cached = getCached<unknown>(cacheKey);
  if (cached) return res.json(cached);

  try {
    const url = `${DATA_API}/portfolio?user=${address}`;
    const apiRes = await fetch(url, {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(10_000),
    });

    let pnlData: NormalizedPnl = {
      totalProfit: 0, totalVolume: 0, tradesCount: 0,
      positionsValue: 0, winRate: null,
    };

    if (apiRes.ok) {
      const raw: DataApiPortfolio = await apiRes.json();
      pnlData = {
        totalProfit: Number(raw.profit ?? 0),
        totalVolume: Number(raw.volume ?? 0),
        tradesCount: Number(raw.tradesCount ?? 0),
        positionsValue: Number(raw.positionsValue ?? 0),
        winRate: null,
      };
    } else {
      console.error('[users] Data API portfolio returned', apiRes.status);
    }

    setCached(cacheKey, pnlData, PNL_TTL_MS);
    return res.json(pnlData);
  } catch (err) {
    console.error('[users] Failed to fetch PnL:', err);
    return res.json({ totalProfit: 0, totalVolume: 0, tradesCount: 0, positionsValue: 0, winRate: null });
  }
});

export default router;
