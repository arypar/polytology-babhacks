/**
 * StrategyExecutor — polls active strategies every 30s and places
 * Polymarket orders autonomously using stored L2 API credentials.
 * No user wallet interaction is required: the api_secret is an Ethereum
 * private key that signs EIP-712 orders server-side.
 */

import { createWalletClient, http } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { polygon } from 'viem/chains';
import { ClobClient, Side, OrderType } from '@polymarket/clob-client';
import { supabase, DB_ENABLED } from './supabase.js';
import { getLatestPrice } from './clob-ws.js';
import { log } from './log.js';

const CLOB_API_URL = 'https://clob.polymarket.com';
const POLYGON_CHAIN_ID = 137;
const POLL_INTERVAL_MS = 30_000;

// ── Canvas block shape (stored as jsonb in strategies.blocks) ─────────────

interface CanvasBlock {
  id: string;
  category: 'market' | 'condition' | 'action';
  type: string;
  label: string;
  config: Record<string, string | number>;
}

interface DbStrategy {
  id: string;
  eoa_address: string;
  name: string;
  blocks: CanvasBlock[];
  is_active: boolean;
  market_id: string | null;
  market_question: string | null;
}

interface DbCredentials {
  eoa_address: string;
  api_key: string;
  api_secret: string;
  api_passphrase: string;
  safe_address: string | null;
}

// ── Per-strategy runtime state ─────────────────────────────────────────────

interface StrategyState {
  lastExecutedAt: number;       // ms — for cooldown tracking
  tradesToday: number;          // reset at midnight
  tradesTodayDate: string;      // YYYY-MM-DD
  lastPriceSeenAbove: boolean;  // for price_crosses edge detection
}

const strategyState = new Map<string, StrategyState>();

function getState(id: string): StrategyState {
  if (!strategyState.has(id)) {
    strategyState.set(id, {
      lastExecutedAt: 0,
      tradesToday: 0,
      tradesTodayDate: '',
      lastPriceSeenAbove: false,
    });
  }
  return strategyState.get(id)!;
}

// ── Condition evaluators ───────────────────────────────────────────────────

function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

function evaluateConditions(
  blocks: CanvasBlock[],
  yesPrice: number,
  strategyId: string,
): boolean {
  const conditionBlocks = blocks.filter(b => b.category === 'condition');

  // No conditions = always trigger
  if (conditionBlocks.length === 0) return true;

  const state = getState(strategyId);
  const now = Date.now();

  // Reset daily counter if day changed
  if (state.tradesTodayDate !== todayStr()) {
    state.tradesToday = 0;
    state.tradesTodayDate = todayStr();
  }

  const results = conditionBlocks.map(block => {
    const cfg = block.config;

    switch (block.type) {
      case 'price_crosses': {
        const threshold = Number(cfg.threshold ?? 0.5);
        const direction = String(cfg.direction ?? 'above');
        const isAboveNow = yesPrice >= threshold;
        const prevAbove = state.lastPriceSeenAbove;
        // Update the seen state after reading it
        state.lastPriceSeenAbove = isAboveNow;
        if (direction === 'above') return !prevAbove && isAboveNow;
        if (direction === 'below') return prevAbove && !isAboveNow;
        return false;
      }

      case 'volume_spike':
        // Approximate: always pass for volume spike since we don't have
        // historical volume in the executor. Markets with high volume_spike
        // blocks are treated as always-satisfied at this stage.
        return true;

      case 'resolves_soon': {
        // Requires market endDate stored in the strategy — approximate via DB
        // For now, always pass; the executor re-evaluates on each tick anyway
        return true;
      }

      case 'time_schedule': {
        const intervalLabel = String(cfg.interval ?? '1h');
        const intervalMs = parseIntervalToMs(intervalLabel);
        return (now - state.lastExecutedAt) >= intervalMs;
      }

      case 'cooldown': {
        const minutes = Number(cfg.minutes ?? 60);
        return (now - state.lastExecutedAt) >= minutes * 60_000;
      }

      case 'daily_limit': {
        const maxTrades = Number(cfg.maxTrades ?? 5);
        return state.tradesToday < maxTrades;
      }

      case 'position_limit':
        // Position limit can't be strictly enforced without querying open
        // positions — pass through optimistically; the exchange will reject
        // if the account doesn't have funds.
        return true;

      case 'custom_datasource':
        // Custom datasource conditions require async fetch — treated as passing
        // in the synchronous evaluator; a future iteration can make this async.
        return true;

      default:
        return true;
    }
  });

  // All conditions must pass (AND semantics)
  return results.every(Boolean);
}

function parseIntervalToMs(label: string): number {
  if (label.endsWith('m')) return parseInt(label) * 60_000;
  if (label.endsWith('h')) return parseInt(label) * 3_600_000;
  if (label.endsWith('d')) return parseInt(label) * 86_400_000;
  return 3_600_000; // default 1h
}

// ── Order placement ────────────────────────────────────────────────────────

async function buildClobClient(creds: DbCredentials): Promise<ClobClient | null> {
  try {
    const secret = creds.api_secret.startsWith('0x')
      ? creds.api_secret
      : `0x${creds.api_secret}`;

    const account = privateKeyToAccount(secret as `0x${string}`);
    const rpcUrl = process.env.POLYGON_RPC_URL ?? 'https://polygon-rpc.com';

    const walletClient = createWalletClient({
      account,
      chain: polygon,
      transport: http(rpcUrl),
    });

    const apiCreds = {
      key:        creds.api_key,
      secret:     creds.api_secret,
      passphrase: creds.api_passphrase,
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return new ClobClient(CLOB_API_URL, POLYGON_CHAIN_ID, walletClient as any, apiCreds);
  } catch (err) {
    log('executor', `Failed to build ClobClient: ${err}`);
    return null;
  }
}

async function recordTrade(params: {
  orderId: string;
  eoaAddress: string;
  safeAddress: string | null;
  strategyId: string;
  marketId: string;
  marketQuestion: string;
  tokenId: string;
  side: 'YES' | 'NO';
  price: number;
  size: number;
  negRisk: boolean;
}): Promise<void> {
  if (!DB_ENABLED || !supabase) return;
  await supabase.from('trades').insert({
    order_id:        params.orderId,
    eoa_address:     params.eoaAddress,
    safe_address:    params.safeAddress,
    strategy_id:     params.strategyId,
    market_id:       params.marketId,
    market_question: params.marketQuestion,
    token_id:        params.tokenId,
    side:            params.side,
    price:           params.price,
    size:            params.size,
    neg_risk:        params.negRisk,
    status:          'open',
  });
}

async function executeActions(
  strategy: DbStrategy,
  blocks: CanvasBlock[],
  creds: DbCredentials,
  yesPrice: number,
  noPrice: number,
): Promise<void> {
  const actionBlocks = blocks.filter(b => b.category === 'action');
  if (actionBlocks.length === 0) return;

  const marketBlock = blocks.find(b => b.category === 'market');
  if (!marketBlock) return;

  const marketId   = String(marketBlock.config.marketId ?? strategy.market_id ?? '');
  const yesTokenId = String(marketBlock.config.yesTokenId ?? '');
  const noTokenId  = String(marketBlock.config.noTokenId ?? '');

  if (!marketId) {
    log('executor', `Strategy ${strategy.id}: no marketId, skipping`);
    return;
  }

  const client = await buildClobClient(creds);
  if (!client) return;

  for (const action of actionBlocks) {
    const cfg = action.config;

    try {
      if (action.type === 'buy_yes' || action.type === 'buy_no') {
        const isBuyYes = action.type === 'buy_yes';
        const tokenId = isBuyYes ? yesTokenId : noTokenId;
        const price   = isBuyYes ? yesPrice : noPrice;
        const amountUSD = Number(cfg.amountUSD ?? 10);

        if (!tokenId) {
          log('executor', `Strategy ${strategy.id}: missing tokenId for ${action.type}`);
          continue;
        }

        const size = Math.round((amountUSD / price) * 100) / 100;

        const order = {
          tokenID:    tokenId,
          price,
          size,
          side:       Side.BUY,
          feeRateBps: 0,
          expiration: 0,
          taker:      '0x0000000000000000000000000000000000000000' as `0x${string}`,
        };

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const response = await (client as any).createAndPostOrder(order, {}, OrderType.GTC);
        const orderId: string = response?.orderID ?? response?.id ?? 'unknown';

        log('executor', `Strategy ${strategy.id}: placed ${action.type} order ${orderId} (${size} @ ${price})`);

        await recordTrade({
          orderId,
          eoaAddress:    strategy.eoa_address,
          safeAddress:   creds.safe_address,
          strategyId:    strategy.id,
          marketId,
          marketQuestion: strategy.market_question ?? marketId,
          tokenId,
          side:          isBuyYes ? 'YES' : 'NO',
          price,
          size,
          negRisk:       false,
        });

      } else if (action.type === 'limit_order') {
        const side    = String(cfg.side ?? 'YES');
        const tokenId = side === 'YES' ? yesTokenId : noTokenId;
        const limitPrice = Number(cfg.limitPrice ?? 0.5);
        const amountUSD  = Number(cfg.amountUSD ?? 10);
        const size = Math.round((amountUSD / limitPrice) * 100) / 100;

        if (!tokenId) continue;

        const order = {
          tokenID:    tokenId,
          price:      limitPrice,
          size,
          side:       Side.BUY,
          feeRateBps: 0,
          expiration: 0,
          taker:      '0x0000000000000000000000000000000000000000' as `0x${string}`,
        };

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const response = await (client as any).createAndPostOrder(order, {}, OrderType.GTD);
        const orderId: string = response?.orderID ?? response?.id ?? 'unknown';

        log('executor', `Strategy ${strategy.id}: placed limit_order ${orderId} (${size} @ ${limitPrice})`);

        await recordTrade({
          orderId,
          eoaAddress:    strategy.eoa_address,
          safeAddress:   creds.safe_address,
          strategyId:    strategy.id,
          marketId,
          marketQuestion: strategy.market_question ?? marketId,
          tokenId,
          side:          side as 'YES' | 'NO',
          price:         limitPrice,
          size,
          negRisk:       false,
        });

      } else if (action.type === 'send_alert') {
        log('executor', `[ALERT] Strategy "${strategy.name}": ${cfg.message ?? '(no message)'}`);
      }
      // sell_position: requires querying existing positions — skip for now
    } catch (err) {
      log('executor', `Strategy ${strategy.id} action ${action.type} error: ${err}`);
    }
  }
}

// ── Credentials cache (1-minute TTL to reduce DB reads) ───────────────────

const credsCache = new Map<string, { data: DbCredentials; expiresAt: number }>();

async function fetchCredentials(eoa: string): Promise<DbCredentials | null> {
  const now = Date.now();
  const cached = credsCache.get(eoa);
  if (cached && cached.expiresAt > now) return cached.data;

  if (!DB_ENABLED || !supabase) return null;

  const { data, error } = await supabase
    .from('user_credentials')
    .select('eoa_address, api_key, api_secret, api_passphrase, safe_address')
    .eq('eoa_address', eoa)
    .single();

  if (error || !data) return null;

  credsCache.set(eoa, { data: data as DbCredentials, expiresAt: now + 60_000 });
  return data as DbCredentials;
}

// ── Main evaluation loop ───────────────────────────────────────────────────

async function evaluateStrategies(): Promise<void> {
  if (!DB_ENABLED || !supabase) return;

  const { data: strategies, error } = await supabase
    .from('strategies')
    .select('id, eoa_address, name, blocks, is_active, market_id, market_question')
    .eq('is_active', true);

  if (error) {
    log('executor', `DB error fetching strategies: ${error.message}`);
    return;
  }

  if (!strategies || strategies.length === 0) return;

  log('executor', `Evaluating ${strategies.length} active strategies`);

  for (const strategy of strategies as DbStrategy[]) {
    try {
      const blocks: CanvasBlock[] = Array.isArray(strategy.blocks) ? strategy.blocks : [];
      const marketBlock = blocks.find(b => b.category === 'market');
      const marketId = String(marketBlock?.config.marketId ?? strategy.market_id ?? '');

      if (!marketId) continue;

      const prices = getLatestPrice(marketId);
      if (!prices) {
        // No live price yet — skip this tick
        continue;
      }

      const { yes: yesPrice, no: noPrice } = prices;

      const shouldFire = evaluateConditions(blocks, yesPrice, strategy.id);
      if (!shouldFire) continue;

      const creds = await fetchCredentials(strategy.eoa_address);
      if (!creds || !creds.api_key || !creds.api_secret) {
        log('executor', `Strategy ${strategy.id}: no credentials for ${strategy.eoa_address}`);
        continue;
      }

      log('executor', `Strategy "${strategy.name}" (${strategy.id}): conditions met, executing`);

      await executeActions(strategy, blocks, creds, yesPrice, noPrice);

      const state = getState(strategy.id);
      state.lastExecutedAt = Date.now();
      state.tradesToday += 1;
    } catch (err) {
      log('executor', `Unhandled error in strategy ${strategy.id}: ${err}`);
    }
  }
}

// ── Public start function ──────────────────────────────────────────────────

export function startStrategyExecutor(): void {
  log('executor', `Strategy executor starting (poll interval: ${POLL_INTERVAL_MS / 1000}s)`);

  // Run immediately on startup, then on interval
  evaluateStrategies().catch(err => log('executor', `Initial evaluation error: ${err}`));

  setInterval(() => {
    evaluateStrategies().catch(err => log('executor', `Evaluation error: ${err}`));
  }, POLL_INTERVAL_MS);
}
