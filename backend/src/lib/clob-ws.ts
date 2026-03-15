/**
 * CLOB WebSocket client
 *
 * Connects to the Polymarket CLOB real-time feed and re-broadcasts
 * price_update events to all connected frontend clients via broadcastToAll.
 *
 * Message format sent to frontend:
 *   { type: 'price_update', updates: { [conditionId]: { yes: number, no: number } } }
 */

import WebSocket from 'ws';
import { broadcastToAll } from './ws-server.js';

const CLOB_WS_URL = 'wss://ws-subscriptions-clob.polymarket.com/ws/market';

// tokenId → conditionId (populated by subscribeToMarkets)
const tokenToCondition = new Map<string, string>();
// conditionId → { yes: number; no: number } — latest known prices
const latestPrices = new Map<string, { yes: number; no: number }>();

let clobWs: WebSocket | null = null;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
let connected = false;

// Throttled broadcast — accumulate all updates and flush every 250ms max.
// Without this, 1800+ subscribed tokens generate hundreds of WS messages/sec.
const pendingBatch: Record<string, { yes: number; no: number }> = {};
let broadcastTimer: ReturnType<typeof setTimeout> | null = null;

function scheduleBroadcast(updates: Record<string, { yes: number; no: number }>): void {
  Object.assign(pendingBatch, updates);
  if (broadcastTimer) return;
  broadcastTimer = setTimeout(() => {
    broadcastTimer = null;
    const keys = Object.keys(pendingBatch);
    if (keys.length === 0) return;
    const snapshot: Record<string, { yes: number; no: number }> = {};
    for (const k of keys) {
      snapshot[k] = pendingBatch[k];
      delete pendingBatch[k];
    }
    broadcastToAll({ type: 'price_update', updates: snapshot });
  }, 250);
}

// ── Public API ─────────────────────────────────────────────────────────────

/**
 * Register markets for live price tracking.
 * Call this after each market sync with the full active token set.
 * New tokens that aren't yet subscribed will be added to the subscription.
 */
export function subscribeToMarkets(
  entries: Array<{ tokenId: string; conditionId: string; noTokenId?: string }>
): void {
  const newTokenIds: string[] = [];

  for (const { tokenId, conditionId, noTokenId } of entries) {
    if (!tokenToCondition.has(tokenId)) {
      tokenToCondition.set(tokenId, conditionId);
      newTokenIds.push(tokenId);
    }
    if (noTokenId && !tokenToCondition.has(noTokenId)) {
      // Store no-token with a special suffix so we can distinguish yes vs no
      tokenToCondition.set(noTokenId, conditionId + ':no');
      newTokenIds.push(noTokenId);
    }
  }

  if (newTokenIds.length > 0 && connected && clobWs?.readyState === WebSocket.OPEN) {
    sendSubscription(newTokenIds);
  }
}

/** Return the latest known prices snapshot. */
export function getLatestPrices(): Map<string, { yes: number; no: number }> {
  return latestPrices;
}

/** Return the latest YES/NO prices for a single conditionId, or null if unknown. */
export function getLatestPrice(conditionId: string): { yes: number; no: number } | null {
  return latestPrices.get(conditionId) ?? null;
}

// ── WebSocket management ───────────────────────────────────────────────────

function sendSubscription(ids: string[]): void {
  if (!clobWs || clobWs.readyState !== WebSocket.OPEN) return;
  clobWs.send(JSON.stringify({ assets_ids: ids, type: 'market' }));
}

function connect(): void {
  if (reconnectTimer) { clearTimeout(reconnectTimer); reconnectTimer = null; }

  console.log('\x1b[36m[clob-ws] Connecting to CLOB WebSocket…\x1b[0m');
  clobWs = new WebSocket(CLOB_WS_URL);

  clobWs.on('open', () => {
    connected = true;
    console.log('\x1b[36m[clob-ws] Connected — subscribing to', tokenToCondition.size, 'tokens\x1b[0m');
    if (tokenToCondition.size > 0) {
      sendSubscription([...tokenToCondition.keys()]);
    }
  });

  clobWs.on('message', (raw) => {
    try {
      const payload = JSON.parse(raw.toString());
      const events: unknown[] = Array.isArray(payload) ? payload : [payload];

      // Accumulate updates in one batch per message
      const batch: Record<string, { yes: number; no: number }> = {};

      for (const evt of events) {
        if (typeof evt !== 'object' || evt === null) continue;
        const e = evt as Record<string, unknown>;

        const assetId = String(e.asset_id ?? '');
        const price   = parseFloat(String(e.price ?? 'NaN'));

        if (!assetId || isNaN(price)) continue;

        const conditionRaw = tokenToCondition.get(assetId);
        if (!conditionRaw) continue;

        const isNo       = conditionRaw.endsWith(':no');
        const conditionId = isNo ? conditionRaw.slice(0, -3) : conditionRaw;

        // Update our in-memory latest prices
        const current = latestPrices.get(conditionId) ?? { yes: 0.5, no: 0.5 };
        const updated = isNo
          ? { yes: current.yes, no: price }
          : { yes: price, no: 1 - price }; // derive no from yes if no-token not tracked

        latestPrices.set(conditionId, updated);
        batch[conditionId] = updated;
      }

      if (Object.keys(batch).length > 0) {
        scheduleBroadcast(batch);
      }
    } catch { /* malformed message — ignore */ }
  });

  clobWs.on('close', (code) => {
    connected = false;
    console.log(`\x1b[33m[clob-ws] Disconnected (${code}), reconnecting in 5s…\x1b[0m`);
    reconnectTimer = setTimeout(connect, 5_000);
  });

  clobWs.on('error', (err) => {
    console.error('[clob-ws] Error:', err.message);
    // 'close' fires right after 'error', so reconnect is handled there
  });
}

// Start immediately
connect();
