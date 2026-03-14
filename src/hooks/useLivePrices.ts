'use client';

import { useEffect, useRef, useState, useCallback } from 'react';

export interface LivePrice {
  yes: number;
  no: number;
}

type PriceMap = Map<string, LivePrice>;

const WS_URL = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000')
  .replace(/^http/, 'ws') + '/ws';

/**
 * useLivePrices
 *
 * Connects to the backend WebSocket and listens for `price_update` events
 * from the CLOB real-time feed.
 *
 * Returns a Map<conditionId, { yes, no }> that updates in real-time.
 * Components can use `prices.get(conditionId)?.yes ?? fallback` to overlay
 * live prices on top of DB-loaded market data.
 */
export function useLivePrices(): PriceMap {
  const [prices, setPrices] = useState<PriceMap>(new Map());
  const wsRef     = useRef<WebSocket | null>(null);
  const timerRef  = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mountedRef = useRef(true);

  const connect = useCallback(() => {
    if (!mountedRef.current) return;

    const ws = new WebSocket(WS_URL);
    wsRef.current = ws;

    ws.onopen = () => {
      if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null; }
    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data as string);
        if (msg.type !== 'price_update' || !msg.updates) return;

        const updates = msg.updates as Record<string, { yes: number; no: number }>;

        setPrices(prev => {
          const next = new Map(prev);
          for (const [conditionId, lp] of Object.entries(updates)) {
            next.set(conditionId, { yes: Number(lp.yes), no: Number(lp.no) });
          }
          return next;
        });
      } catch { /* ignore malformed */ }
    };

    ws.onclose = () => {
      if (!mountedRef.current) return;
      timerRef.current = setTimeout(connect, 4_000);
    };

    ws.onerror = () => {
      // 'close' fires right after, reconnect handled there
    };
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    connect();
    return () => {
      mountedRef.current = false;
      if (timerRef.current) clearTimeout(timerRef.current);
      wsRef.current?.close();
    };
  }, [connect]);

  return prices;
}
