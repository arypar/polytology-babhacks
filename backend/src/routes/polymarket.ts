import { Router } from 'express';
import { supabase, DB_ENABLED } from '../lib/supabase.js';
import { subscribeToMarkets } from '../lib/clob-ws.js';

const router = Router();

const GAMMA_API = 'https://gamma-api.polymarket.com';
const CLOB_API  = 'https://clob.polymarket.com';

// ── In-memory cache (fast layer on top of DB) ─────────────────────────────

const MARKETS_TTL_MS   = 60_000;   // 60s for market list mem-cache
const HISTORY_TTL_MS   = 60_000;   // 60s for price history mem-cache
const MARKET_TTL_MS    = 60_000;   // 60s for single market mem-cache
const ORDERBOOK_TTL_MS =  5_000;   // 5s  for order books (near-real-time)
const TRADES_TTL_MS    = 15_000;   // 15s for trade stream
const NEWS_TTL_MS      = 300_000;  // 5m  for news

const memCache = new Map<string, { data: unknown; ts: number; ttl: number }>();

function getCached<T>(key: string): T | null {
  const entry = memCache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.ts > entry.ttl) { memCache.delete(key); return null; }
  return entry.data as T;
}

function setCached(key: string, data: unknown, ttl = MARKETS_TTL_MS) {
  memCache.set(key, { data, ts: Date.now(), ttl });
}

// conditionId → YES token ID — populated from DB on startup and from live fetches
const tokenIdCache = new Map<string, string>();

// ── Gamma API types ────────────────────────────────────────────────────────

interface GammaMarket {
  id: string;
  conditionId?: string;
  question?: string;
  description?: string;
  endDate?: string;
  endDateIso?: string;
  slug?: string;
  image?: string;
  icon?: string;
  active?: boolean;
  closed?: boolean;
  volume?: string | number;
  volume24hr?: number;
  liquidity?: string | number;
  negRisk?: boolean;
  outcomes?: string;       // JSON string: "[\"Yes\",\"No\"]"
  outcomePrices?: string;  // JSON string: "[\"0.6\",\"0.4\"]"
  clobTokenIds?: string;   // JSON string: "[\"123...\",\"456...\"]"
  oneWeekPriceChange?: number;
}

// ── Normalised shape ───────────────────────────────────────────────────────

interface NormalizedMarket {
  id: string;
  conditionId: string;
  slug: string;
  question: string;
  description: string;
  category: string;
  endDate: string;
  image?: string;
  outcomes: Array<{ name: string; price: number; tokenId?: string }>;
  volume24h: number;
  volumeTotal: number;
  liquidity: number;
  priceChange24h: number;
  active: boolean;
  closed: boolean;
  negRisk: boolean;
  tags?: string[];
}

// ── DB row shape ───────────────────────────────────────────────────────────

interface DbMarketRow {
  condition_id: string;
  gamma_id: string | null;
  slug: string;
  question: string;
  description: string;
  category: string;
  end_date: string | null;
  image: string | null;
  outcomes: Array<{ name: string; price: number; tokenId?: string }>;
  yes_token_id: string | null;
  volume_24h: number;
  volume_total: number;
  liquidity: number;
  price_change_24h: number;
  active: boolean;
  closed: boolean;
  neg_risk: boolean;
  yes_price_history: Array<{ t: number; p: number }> | null;
  history_synced_at: string | null;
  last_synced_at: string;
}

// ── Converters ────────────────────────────────────────────────────────────

function toDbRow(m: NormalizedMarket): Omit<DbMarketRow, 'yes_price_history' | 'history_synced_at'> {
  const yesToken = m.outcomes.find(o => o.name === 'Yes')?.tokenId ?? m.outcomes[0]?.tokenId ?? null;
  return {
    condition_id:    m.conditionId,
    gamma_id:        m.id,
    slug:            m.slug,
    question:        m.question,
    description:     m.description,
    category:        m.category,
    end_date:        m.endDate || null,
    image:           m.image ?? null,
    outcomes:        m.outcomes,
    yes_token_id:    yesToken,
    volume_24h:      m.volume24h,
    volume_total:    m.volumeTotal,
    liquidity:       m.liquidity,
    price_change_24h: m.priceChange24h,
    active:          m.active,
    closed:          m.closed,
    neg_risk:        m.negRisk,
    last_synced_at:  new Date().toISOString(),
  };
}

function fromDbRow(row: DbMarketRow): NormalizedMarket {
  if (row.yes_token_id) tokenIdCache.set(row.condition_id, row.yes_token_id);
  return {
    id:            row.gamma_id ?? row.condition_id,
    conditionId:   row.condition_id,
    slug:          row.slug,
    question:      row.question,
    description:   row.description,
    category:      row.category,
    endDate:       row.end_date ?? '',
    image:         row.image ?? undefined,
    outcomes:      row.outcomes,
    volume24h:     Number(row.volume_24h),
    volumeTotal:   Number(row.volume_total),
    liquidity:     Number(row.liquidity),
    priceChange24h: Number(row.price_change_24h),
    active:        row.active,
    closed:        row.closed,
    negRisk:       row.neg_risk,
    tags:          [],
  };
}

// ── Category inference ─────────────────────────────────────────────────────

function inferCategory(question: string): string {
  const q = question.toLowerCase();
  if (/bitcoin|btc|ethereum|eth|solana|sol|crypto|defi|nft|blockchain|usdc|polygon|matic|binance|chainlink|doge|xrp|avax/.test(q))
    return 'Crypto';
  if (/trump|biden|harris|election|president|congress|senate|democrat|republican|vote|poll|political|party|white house|zelensky/.test(q))
    return 'Politics';
  if (/nfl|nba|mlb|nhl|soccer|football|basketball|baseball|championship|super bowl|world cup|olympics|fifa|premier league|tennis|golf|ufc|boxing/.test(q))
    return 'Sports';
  if (/ai|gpt|openai|anthropic|gemini|llm|machine learning|climate|nasa|spacex|cancer|vaccine|covid|drug|fda|science|research/.test(q))
    return 'Science';
  if (/oscar|grammy|emmy|movie|film|tv|celebrity|music|award|netflix|spotify|box office|entertainment/.test(q))
    return 'Entertainment';
  if (/fed|fomc|rate|gdp|stock|recession|inflation|treasury|earnings|economy|market cap|s&p|nasdaq|dow|ipo|merger/.test(q))
    return 'Business';
  if (/ukraine|russia|china|war|ceasefire|conflict|geopolit|middle east|north korea|taiwan|iran|israel|india|pakistan|nato|united nations/.test(q))
    return 'World';
  return 'Other';
}

// ── Gamma normaliser ───────────────────────────────────────────────────────

function normalizeGamma(gm: GammaMarket): NormalizedMarket {
  const conditionId = gm.conditionId ?? gm.id;

  let outcomeNames: string[] = ['Yes', 'No'];
  let outcomePrices: number[] = [0.5, 0.5];
  let clobTokenIds: string[] = [];

  try { if (gm.outcomes)      outcomeNames  = JSON.parse(gm.outcomes); }      catch { /* defaults */ }
  try { if (gm.outcomePrices) outcomePrices = JSON.parse(gm.outcomePrices).map(Number); } catch { /* defaults */ }
  try { if (gm.clobTokenIds)  clobTokenIds  = JSON.parse(gm.clobTokenIds); }  catch { /* defaults */ }

  const outcomes = outcomeNames.map((name, i) => ({
    name,
    price:   outcomePrices[i] ?? 0.5,
    tokenId: clobTokenIds[i],
  }));

  const yesTokenId = clobTokenIds[0];
  if (yesTokenId) tokenIdCache.set(conditionId, yesTokenId);

  return {
    id:            gm.id,
    conditionId,
    slug:          gm.slug ?? gm.id,
    question:      gm.question ?? 'Unknown market',
    description:   gm.description ?? '',
    category:      inferCategory(gm.question ?? ''),
    endDate:       gm.endDate ?? gm.endDateIso ?? new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString(),
    image:         gm.image ?? gm.icon,
    outcomes,
    volume24h:     Number(gm.volume24hr ?? 0),
    volumeTotal:   Number(gm.volume ?? 0),
    liquidity:     Number(gm.liquidity ?? 0),
    priceChange24h: Number(gm.oneWeekPriceChange ?? 0) / 7,
    active:        gm.active ?? true,
    closed:        gm.closed ?? false,
    negRisk:       gm.negRisk ?? false,
    tags:          [],
  };
}

// ── Market quality filter ──────────────────────────────────────────────────
// Reject markets that are effectively resolved (any outcome at ≥98¢ or ≤2¢),
// or markets with no trading activity.

function isLiveMarket(m: NormalizedMarket): boolean {
  if (m.closed || !m.active) return false;
  for (const o of m.outcomes) {
    if (o.price >= 0.98 || o.price <= 0.02) return false;
  }
  return true;
}

// Same check but operates on a DB row (outcomes stored as jsonb array)
function isLiveDbRow(row: DbMarketRow): boolean {
  if (row.closed || !row.active) return false;
  for (const o of row.outcomes) {
    if (Number(o.price) >= 0.98 || Number(o.price) <= 0.02) return false;
  }
  return true;
}

// ── Background sync ────────────────────────────────────────────────────────

const SYNC_INTERVAL_MS = 5 * 60 * 1000;  // run every 5 minutes
const PAGE_SIZE        = 100;             // Gamma API max per page
const MAX_PAGES        = 20;             // safety cap → up to 2 000 markets

let syncInProgress = false;
let lastSyncAt     = 0;

async function fetchAllGammaMarkets(): Promise<GammaMarket[]> {
  const all: GammaMarket[] = [];
  let offset = 0;

  for (let page = 0; page < MAX_PAGES; page++) {
    const params = new URLSearchParams({
      active: 'true', closed: 'false',
      limit: String(PAGE_SIZE),
      offset: String(offset),
      order: 'volume24hr', ascending: 'false',
    });

    const res = await fetch(`${GAMMA_API}/markets?${params}`, {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(15_000),
    });

    if (!res.ok) {
      console.warn(`[market-sync] Gamma API returned ${res.status} on page ${page}`);
      break;
    }

    const page_data: GammaMarket[] = await res.json();
    if (!page_data.length) break;

    all.push(...page_data);
    offset += page_data.length;

    // If we got fewer than a full page, we've reached the end
    if (page_data.length < PAGE_SIZE) break;
  }

  return all;
}

async function syncMarketsToDb(): Promise<void> {
  if (syncInProgress) return;
  syncInProgress = true;

  try {
    const gammaMarkets = await fetchAllGammaMarkets();

    const normalized = gammaMarkets
      .filter(gm => {
        try { return (JSON.parse(gm.outcomes ?? '[]') as string[]).length === 2; } catch { return false; }
      })
      .map(normalizeGamma)
      .filter(isLiveMarket);

    if (DB_ENABLED && supabase) {
      // Upsert in batches of 500 to stay within Supabase payload limits
      const UPSERT_BATCH = 500;
      for (let i = 0; i < normalized.length; i += UPSERT_BATCH) {
        const chunk = normalized.slice(i, i + UPSERT_BATCH).map(toDbRow);
        const { error } = await supabase
          .from('cached_markets')
          .upsert(chunk, { onConflict: 'condition_id' });
        if (error) console.error('[market-sync] Upsert error:', error.message);
      }
      console.log(`\x1b[36m[market-sync] Synced ${normalized.length} markets to DB\x1b[0m`);
    }

    // Subscribe to real-time price updates from the CLOB WebSocket
    const wsEntries = normalized
      .map(m => ({
        tokenId:     m.outcomes.find(o => o.name === 'Yes')?.tokenId ?? m.outcomes[0]?.tokenId ?? '',
        noTokenId:   m.outcomes.find(o => o.name === 'No')?.tokenId  ?? m.outcomes[1]?.tokenId,
        conditionId: m.conditionId,
      }))
      .filter(e => e.tokenId);
    subscribeToMarkets(wsEntries);

    // Warm the mem-cache with the top 30 by volume
    setCached('markets-all-30-0', normalized.slice(0, 30), MARKETS_TTL_MS);
    lastSyncAt = Date.now();
  } catch (err) {
    console.error('[market-sync] Sync failed:', err);
  } finally {
    syncInProgress = false;
  }
}

// Preload tokenIdCache from DB on startup so history/orderbook endpoints
// don't need to make extra Gamma API calls after a restart.
async function warmTokenIdCacheFromDb(): Promise<void> {
  if (!DB_ENABLED || !supabase) return;
  try {
    const { data } = await supabase
      .from('cached_markets')
      .select('condition_id, yes_token_id')
      .not('yes_token_id', 'is', null);
    if (data) {
      data.forEach((row: { condition_id: string; yes_token_id: string | null }) => {
        if (row.yes_token_id) tokenIdCache.set(row.condition_id, row.yes_token_id);
      });
      console.log(`\x1b[36m[market-sync] Loaded ${data.length} token IDs from DB\x1b[0m`);
    }
  } catch { /* not fatal */ }
}

// Kick off immediately on startup, then repeat
warmTokenIdCacheFromDb().then(() => syncMarketsToDb());
setInterval(syncMarketsToDb, SYNC_INTERVAL_MS);

// ── Routes ─────────────────────────────────────────────────────────────────

// GET /polymarket/markets
router.get('/markets', async (req, res) => {
  const { category, limit = '30', offset = '0' } = req.query as Record<string, string>;
  const lim = parseInt(limit);
  const off = parseInt(offset);
  const cacheKey = `markets-${category ?? 'all'}-${limit}-${offset}`;

  // 1. In-memory cache
  const memHit = getCached<NormalizedMarket[]>(cacheKey);
  if (memHit) return res.json(memHit);

  // 2. Database (primary source)
  if (DB_ENABLED && supabase) {
    try {
      // Fetch extra rows to account for post-filter (resolved markets in DB)
      const dbFetchLimit = lim * 3;
      let query = supabase
        .from('cached_markets')
        .select('*')
        .eq('active', true)
        .eq('closed', false)
        .order('volume_24h', { ascending: false })
        .range(off, off + dbFetchLimit - 1);

      if (category) query = query.eq('category', category);

      const { data, error } = await query;

      if (!error && data && data.length > 0) {
        const markets = (data as DbMarketRow[])
          .filter(isLiveDbRow)
          .map(fromDbRow)
          .slice(0, lim);

        // Trigger background re-sync if data is stale (> 5 min)
        const oldest = Math.min(...data.map(r => new Date(r.last_synced_at).getTime()));
        if (Date.now() - oldest > SYNC_INTERVAL_MS && !syncInProgress) {
          syncMarketsToDb(); // fire-and-forget
        }

        setCached(cacheKey, markets, MARKETS_TTL_MS);
        return res.json(markets);
      }
    } catch (dbErr) {
      console.warn('[polymarket] DB query failed, falling back to live API:', dbErr);
    }
  }

  // 3. Live API fallback (DB empty or unavailable) — kick off a full background sync
  //    and return at least `limit` markets directly from Gamma for this request.
  try {
    // Fetch a bigger page than requested so the filter doesn't starve small requests
    const fetchLimit = String(Math.max(lim * 4, 100));
    const params = new URLSearchParams({
      active: 'true', closed: 'false',
      limit: fetchLimit, offset,
      order: 'volume24hr', ascending: 'false',
    });
    if (category) params.set('category', category);

    const gammaRes = await fetch(`${GAMMA_API}/markets?${params}`, {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(10_000),
    });

    if (!gammaRes.ok) return res.status(502).json({ error: 'Gamma API unavailable' });

    const gammaMarkets: GammaMarket[] = await gammaRes.json();
    const normalized = gammaMarkets
      .filter(gm => {
        try { return (JSON.parse(gm.outcomes ?? '[]') as string[]).length === 2; } catch { return false; }
      })
      .map(normalizeGamma)
      .filter(isLiveMarket)
      .slice(0, lim);

    setCached(cacheKey, normalized, MARKETS_TTL_MS);

    // Kick off a DB write in the background
    if (DB_ENABLED && supabase && !syncInProgress) syncMarketsToDb();

    return res.json(normalized);
  } catch (err) {
    console.error('[polymarket] Failed to fetch markets:', err);
    return res.status(502).json({ error: 'Failed to fetch Polymarket data' });
  }
});

// GET /polymarket/market/:conditionId/history
router.get('/market/:conditionId/history', async (req, res) => {
  const { conditionId } = req.params;
  const cacheKey = `history-${conditionId}`;

  // 1. In-memory cache
  const memHit = getCached(cacheKey);
  if (memHit) return res.json(memHit);

  // 2. Database (check stored history column)
  const HISTORY_STALE_MS = 60 * 60 * 1000; // re-fetch after 1 hour
  if (DB_ENABLED && supabase) {
    try {
      const { data } = await supabase
        .from('cached_markets')
        .select('yes_price_history, history_synced_at, yes_token_id')
        .eq('condition_id', conditionId)
        .single();

      if (data?.yes_price_history && data.history_synced_at) {
        const age = Date.now() - new Date(data.history_synced_at).getTime();
        if (age < HISTORY_STALE_MS) {
          // Warm token cache too
          if (data.yes_token_id) tokenIdCache.set(conditionId, data.yes_token_id);
          setCached(cacheKey, data.yes_price_history, HISTORY_TTL_MS);
          return res.json(data.yes_price_history);
        }
        // Stale — fall through to refresh, but keep token ID
        if (data.yes_token_id) tokenIdCache.set(conditionId, data.yes_token_id);
      }
    } catch { /* fall through */ }
  }

  // 3. Fetch from CLOB API
  try {
    // Resolve YES token ID
    let yesTokenId = tokenIdCache.get(conditionId);

    if (!yesTokenId) {
      const gammaRes = await fetch(
        `${GAMMA_API}/markets?conditionId=${conditionId}`,
        { headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(8_000) }
      );
      if (gammaRes.ok) {
        const data: GammaMarket[] = await gammaRes.json();
        const gm = Array.isArray(data) ? data[0] : data;
        if (gm?.clobTokenIds) {
          try {
            const ids: string[] = JSON.parse(gm.clobTokenIds);
            yesTokenId = ids[0];
            if (yesTokenId) tokenIdCache.set(conditionId, yesTokenId);
          } catch { /* ignore */ }
        }
      }
    }

    if (!yesTokenId) return res.json([]);

    const startTs = Math.floor((Date.now() - 30 * 24 * 3600 * 1000) / 1000);
    const histRes = await fetch(
      `${CLOB_API}/prices-history?market=${yesTokenId}&startTs=${startTs}&resolution=1d`,
      { headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(8_000) }
    );

    if (!histRes.ok) return res.json([]);

    const raw = await histRes.json();
    interface HistoryPoint { t?: number; p?: number; time?: number; price?: number }
    const normalized = (raw.history ?? []).map((pt: HistoryPoint) => ({
      t: (pt.t ?? pt.time ?? 0) * 1000,
      p: pt.p ?? pt.price ?? 0,
    }));

    setCached(cacheKey, normalized, HISTORY_TTL_MS);

    // Persist to DB so future loads are instant
    if (DB_ENABLED && supabase && normalized.length > 0) {
      supabase
        .from('cached_markets')
        .update({ yes_price_history: normalized, history_synced_at: new Date().toISOString() })
        .eq('condition_id', conditionId)
        .then(({ error }) => { if (error) console.warn('[history] DB update failed:', error.message); });
    }

    return res.json(normalized);
  } catch (err) {
    console.error('[polymarket] Failed to fetch history:', err);
    return res.json([]);
  }
});

// GET /polymarket/market/:conditionId — single market detail
router.get('/market/:conditionId', async (req, res) => {
  const { conditionId } = req.params;
  const cacheKey = `market-${conditionId}`;

  const memHit = getCached(cacheKey);
  if (memHit) return res.json(memHit);

  // Try DB first
  if (DB_ENABLED && supabase) {
    try {
      const { data } = await supabase
        .from('cached_markets')
        .select('*')
        .eq('condition_id', conditionId)
        .single();
      if (data) {
        const market = fromDbRow(data as DbMarketRow);
        setCached(cacheKey, market, MARKET_TTL_MS);
        return res.json(market);
      }
    } catch { /* fall through to live */ }
  }

  try {
    const gammaRes = await fetch(
      `${GAMMA_API}/markets?conditionId=${conditionId}`,
      { headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(8_000) }
    );
    if (!gammaRes.ok) return res.status(502).json({ error: 'Gamma API unavailable' });

    const data: GammaMarket[] = await gammaRes.json();
    const gm = Array.isArray(data) ? data[0] : data;
    if (!gm) return res.status(404).json({ error: 'Market not found' });

    const result = normalizeGamma(gm);
    setCached(cacheKey, result, MARKET_TTL_MS);

    // Write to DB
    if (DB_ENABLED && supabase) {
      supabase.from('cached_markets').upsert(toDbRow(result), { onConflict: 'condition_id' })
        .then(({ error }) => { if (error) console.warn('[market] DB upsert failed:', error.message); });
    }

    return res.json(result);
  } catch (err) {
    console.error('[polymarket] Failed to fetch market:', err);
    return res.status(502).json({ error: 'Failed to fetch market' });
  }
});

// ── Alpha analysis helpers ─────────────────────────────────────────────────

type AlphaTipKind = 'large_buy' | 'large_sell' | 'one_sided_pressure' | 'unusual_activity' | 'whale_accumulation';

interface AlphaTip {
  kind: AlphaTipKind;
  label: string;
  detail: string;
  severity: 'low' | 'medium' | 'high';
  ts?: number;
}

interface ClobTrade {
  id?: string;
  market?: string;
  asset_id?: string;
  side?: string;
  size?: string | number;
  price?: string | number;
  outcome?: string;
  match_time?: string | number;
  last_update?: string | number;
  maker_address?: string;
  taker_address?: string;
}

function analyseTradesForAlpha(trades: ClobTrade[]): AlphaTip[] {
  const tips: AlphaTip[] = [];
  if (!trades.length) return tips;

  const LARGE_NOTIONAL = 500;
  const WHALE_NOTIONAL = 5_000;
  const recentWindow   = Date.now() - 30 * 60 * 1000;

  let buyCount = 0, sellCount = 0, largeTrades = 0;
  let totalBuyNotional = 0, totalSellNotional = 0;

  for (const t of trades) {
    const size     = Number(t.size ?? 0);
    const price    = Number(t.price ?? 0);
    const notional = size * price;
    const ts       = Number(t.match_time ?? t.last_update ?? 0) * 1000;
    const side     = (t.side ?? '').toUpperCase();
    const isRecent = ts > recentWindow;

    if (side === 'BUY') { buyCount++;  if (isRecent) totalBuyNotional  += notional; }
    else                { sellCount++; if (isRecent) totalSellNotional += notional; }

    if (notional >= WHALE_NOTIONAL) {
      largeTrades++;
      tips.push({ kind: side === 'BUY' ? 'large_buy' : 'large_sell', label: side === 'BUY' ? 'Whale Buy Detected' : 'Whale Sell Detected',
        detail: `${t.outcome ?? side} position: $${notional.toFixed(0)} notional (${size.toFixed(0)} shares @ ${(price * 100).toFixed(1)}¢)`, severity: 'high', ts });
    } else if (notional >= LARGE_NOTIONAL) {
      largeTrades++;
      tips.push({ kind: side === 'BUY' ? 'large_buy' : 'large_sell', label: side === 'BUY' ? 'Large Buy' : 'Large Sell',
        detail: `${t.outcome ?? side} position: $${notional.toFixed(0)} notional (${size.toFixed(0)} shares @ ${(price * 100).toFixed(1)}¢)`, severity: 'medium', ts });
    }
  }

  const total = buyCount + sellCount;
  if (total >= 5) {
    const buyRatio = buyCount / total;
    if (buyRatio >= 0.75)
      tips.push({ kind: 'one_sided_pressure', label: 'Strong Buy Pressure',
        detail: `${(buyRatio * 100).toFixed(0)}% of recent trades are buys — coordinated accumulation possible`,
        severity: buyRatio >= 0.85 ? 'high' : 'medium' });
    else if (buyRatio <= 0.25)
      tips.push({ kind: 'one_sided_pressure', label: 'Strong Sell Pressure',
        detail: `${((1 - buyRatio) * 100).toFixed(0)}% of recent trades are sells — distribution in progress`,
        severity: buyRatio <= 0.15 ? 'high' : 'medium' });
  }

  if (totalBuyNotional > totalSellNotional * 3 && totalBuyNotional > 2_000)
    tips.push({ kind: 'whale_accumulation', label: 'Whale Accumulation',
      detail: `$${totalBuyNotional.toFixed(0)} bought vs $${totalSellNotional.toFixed(0)} sold in the last 30 min`, severity: 'high' });
  else if (totalSellNotional > totalBuyNotional * 3 && totalSellNotional > 2_000)
    tips.push({ kind: 'whale_accumulation', label: 'Whale Distribution',
      detail: `$${totalSellNotional.toFixed(0)} sold vs $${totalBuyNotional.toFixed(0)} bought in the last 30 min`, severity: 'high' });

  if (largeTrades >= 3)
    tips.push({ kind: 'unusual_activity', label: 'Unusual Volume Activity',
      detail: `${largeTrades} large trades detected — elevated institutional activity`,
      severity: largeTrades >= 5 ? 'high' : 'medium' });

  const seen = new Map<string, AlphaTip>();
  for (const tip of tips) {
    const existing = seen.get(tip.kind);
    if (!existing || (tip.severity === 'high' && existing.severity !== 'high')) seen.set(tip.kind, tip);
  }
  return [...seen.values()].sort((a, b) => ({ high: 0, medium: 1, low: 2 }[a.severity] - { high: 0, medium: 1, low: 2 }[b.severity]));
}

// ── News helper ────────────────────────────────────────────────────────────

const STOP_WORDS = new Set([
  'will', 'the', 'a', 'an', 'be', 'is', 'are', 'was', 'were', 'do', 'does',
  'did', 'have', 'has', 'had', 'in', 'on', 'at', 'to', 'for', 'of', 'with',
  'by', 'from', 'and', 'or', 'but', 'if', 'then', 'that', 'this', 'it', 'its',
  'end', 'win', 'get', 'hit', 'reach', 'go', 'become', 'make', 'take',
  'which', 'who', 'what', 'when', 'where', 'how', 'any', 'all', 'not', 'no',
  'over', 'under', 'more', 'less', 'than', 'before', 'after', 'during',
  'their', 'they', 'them', 'he', 'she', 'his', 'her', 'we', 'us', 'our', 'you',
]);

function extractKeywords(question: string): string {
  return question
    .replace(/[^a-zA-Z0-9\s$€£%]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 2 && !STOP_WORDS.has(w.toLowerCase()))
    .slice(0, 6)
    .join(' ');
}

// ── Remaining routes (orderbook, trades, news) ─────────────────────────────

// Helper: resolve YES token ID for a conditionId (cache → DB → Gamma)
async function resolveYesTokenId(conditionId: string): Promise<string | null> {
  let id = tokenIdCache.get(conditionId);
  if (id) return id;

  // Check DB
  if (DB_ENABLED && supabase) {
    try {
      const { data } = await supabase
        .from('cached_markets').select('yes_token_id').eq('condition_id', conditionId).single();
      if (data?.yes_token_id) {
        tokenIdCache.set(conditionId, data.yes_token_id);
        return data.yes_token_id;
      }
    } catch { /* fall through */ }
  }

  // Last resort: Gamma API lookup
  try {
    const res = await fetch(`${GAMMA_API}/markets?conditionId=${conditionId}`,
      { headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(8_000) });
    if (res.ok) {
      const data: GammaMarket[] = await res.json();
      const gm = Array.isArray(data) ? data[0] : data;
      if (gm?.clobTokenIds) {
        const ids: string[] = JSON.parse(gm.clobTokenIds);
        id = ids[0];
        if (id) tokenIdCache.set(conditionId, id);
        return id ?? null;
      }
    }
  } catch { /* ignore */ }

  return null;
}

// GET /polymarket/market/:conditionId/orderbook
router.get('/market/:conditionId/orderbook', async (req, res) => {
  const { conditionId } = req.params;
  const cacheKey = `orderbook-${conditionId}`;

  const memHit = getCached(cacheKey);
  if (memHit) return res.json(memHit);

  try {
    const yesTokenId = await resolveYesTokenId(conditionId);
    if (!yesTokenId) return res.json({ bids: [], asks: [], spread: null });

    const bookRes = await fetch(`${CLOB_API}/book?token_id=${yesTokenId}`,
      { headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(8_000) });
    if (!bookRes.ok) return res.json({ bids: [], asks: [], spread: null });

    interface BookLevel { price: string | number; size: string | number }
    const raw = await bookRes.json();

    const bids = (raw.bids ?? [])
      .map((l: BookLevel) => ({ price: Number(l.price), size: Number(l.size) }))
      .sort((a: { price: number }, b: { price: number }) => b.price - a.price).slice(0, 15);
    const asks = (raw.asks ?? [])
      .map((l: BookLevel) => ({ price: Number(l.price), size: Number(l.size) }))
      .sort((a: { price: number }, b: { price: number }) => a.price - b.price).slice(0, 15);

    const bestBid = bids[0]?.price ?? null;
    const bestAsk = asks[0]?.price ?? null;
    const result = { bids, asks, spread: bestBid != null && bestAsk != null ? bestAsk - bestBid : null, bestBid, bestAsk };
    setCached(cacheKey, result, ORDERBOOK_TTL_MS);
    return res.json(result);
  } catch (err) {
    console.error('[polymarket] Failed to fetch orderbook:', err);
    return res.json({ bids: [], asks: [], spread: null });
  }
});

// GET /polymarket/market/:conditionId/trades
router.get('/market/:conditionId/trades', async (req, res) => {
  const { conditionId } = req.params;
  const cacheKey = `trades-${conditionId}`;

  const memHit = getCached(cacheKey);
  if (memHit) return res.json(memHit);

  try {
    const tradesRes = await fetch(`${CLOB_API}/trades?market=${conditionId}&limit=50`,
      { headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(8_000) });
    if (!tradesRes.ok) return res.json({ trades: [], alphaTips: [] });

    const raw = await tradesRes.json();
    const trades: ClobTrade[] = Array.isArray(raw) ? raw : (raw.data ?? []);
    const alphaTips = analyseTradesForAlpha(trades);

    const normalizedTrades = trades.map((t: ClobTrade) => ({
      id: t.id, side: (t.side ?? '').toUpperCase(), outcome: t.outcome ?? 'Yes',
      size: Number(t.size ?? 0), price: Number(t.price ?? 0),
      notional: Number(t.size ?? 0) * Number(t.price ?? 0),
      ts: Number(t.match_time ?? t.last_update ?? 0) * 1000,
    }));

    const result = { trades: normalizedTrades, alphaTips };
    setCached(cacheKey, result, TRADES_TTL_MS);
    return res.json(result);
  } catch (err) {
    console.error('[polymarket] Failed to fetch trades:', err);
    return res.json({ trades: [], alphaTips: [] });
  }
});

// GET /polymarket/market/:conditionId/news
router.get('/market/:conditionId/news', async (req, res) => {
  const { conditionId } = req.params;
  const { question } = req.query as Record<string, string>;
  const cacheKey = `news-${conditionId}`;

  const memHit = getCached(cacheKey);
  if (memHit) return res.json(memHit);

  const apiKey = process.env.NEWS_API_KEY;
  if (!apiKey) return res.json({ articles: [], error: 'NEWS_API_KEY not configured' });

  try {
    const keywords = question ? extractKeywords(question) : conditionId;
    const params = new URLSearchParams({ q: keywords, sortBy: 'publishedAt', pageSize: '8', language: 'en', apiKey });
    const newsRes = await fetch(`https://newsapi.org/v2/everything?${params}`,
      { headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(8_000) });

    if (!newsRes.ok) return res.json({ articles: [], error: `NewsAPI returned ${newsRes.status}` });

    interface NewsArticle {
      title?: string; description?: string; url?: string;
      publishedAt?: string; urlToImage?: string; source?: { name?: string };
    }
    const data = await newsRes.json();
    const articles = (data.articles ?? []).map((a: NewsArticle) => ({
      title: a.title, description: a.description, url: a.url,
      publishedAt: a.publishedAt, imageUrl: a.urlToImage, source: a.source?.name,
    }));

    const result = { articles };
    setCached(cacheKey, result, NEWS_TTL_MS);
    return res.json(result);
  } catch (err) {
    console.error('[polymarket] Failed to fetch news:', err);
    return res.json({ articles: [], error: 'Failed to fetch news' });
  }
});

export default router;
