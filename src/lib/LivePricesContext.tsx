'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';

export interface LivePrice {
  yes: number;
  no: number;
}

export type LivePriceRecord = Record<string, LivePrice>;

interface LivePricesContextValue {
  prices: LivePriceRecord;
  lastUpdated: Record<string, number>;
}

const LivePricesContext = createContext<LivePricesContextValue>({ prices: {}, lastUpdated: {} });

const WS_URL = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000')
  .replace(/^http/, 'ws') + '/ws';

/**
 * Single shared WebSocket connection for live price data.
 * Uses a plain object with stable per-market references — unchanged markets
 * keep the same reference so React.memo on consumer rows can skip re-renders.
 */
export function LivePricesProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<LivePricesContextValue>({ prices: {}, lastUpdated: {} });
  const wsRef = useRef<WebSocket | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mountedRef = useRef(true);
  // rAF batching: accumulate updates between frames, flush once per frame
  const pendingRef = useRef<Record<string, { yes: number; no: number }>>({});
  const rafRef = useRef<number | null>(null);

  const flushPending = useCallback(() => {
    rafRef.current = null;
    const batch = pendingRef.current;
    if (Object.keys(batch).length === 0) return;
    pendingRef.current = {};
    const now = Date.now();
    setState(prev => {
      const nextPrices = { ...prev.prices };
      let changed = false;
      const changedIds: string[] = [];
      for (const [id, lp] of Object.entries(batch)) {
        const p = prev.prices[id];
        if (!p || p.yes !== lp.yes || p.no !== lp.no) {
          nextPrices[id] = lp;
          changedIds.push(id);
          changed = true;
        }
      }
      if (!changed) return prev;
      const nextLastUpdated = { ...prev.lastUpdated };
      for (const id of changedIds) nextLastUpdated[id] = now;
      return { prices: nextPrices, lastUpdated: nextLastUpdated };
    });
  }, []);

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

        // Accumulate into pending batch; flush on next animation frame
        Object.assign(pendingRef.current, updates);
        if (rafRef.current === null) {
          rafRef.current = requestAnimationFrame(flushPending);
        }
      } catch { /* ignore malformed messages */ }
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
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      wsRef.current?.close();
    };
  }, [connect]);

  return (
    <LivePricesContext.Provider value={state}>
      {children}
    </LivePricesContext.Provider>
  );
}

export function useLivePricesCtx(): LivePriceRecord {
  return useContext(LivePricesContext).prices;
}

export function useLiveLastUpdatedCtx(): Record<string, number> {
  return useContext(LivePricesContext).lastUpdated;
}
