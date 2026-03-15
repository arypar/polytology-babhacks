'use client';

import { useState, useEffect, useRef } from 'react';

export interface PolymarketPosition {
  conditionId: string;
  asset: string;
  title: string;
  slug: string;
  outcome: string;
  size: number;
  avgPrice: number;
  currentPrice: number;
  currentValue: number;
  pnl: number;
  image?: string;
}

export interface UsePositionsResult {
  positions: PolymarketPosition[];
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

const POLL_INTERVAL_MS = 30_000;
const DATA_API_URL = 'https://data-api.polymarket.com';

export function usePositions(address: string | null): UsePositionsResult {
  const [positions, setPositions] = useState<PolymarketPosition[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const cancelledRef = useRef(false);
  const fetchCountRef = useRef(0);

  const fetchPositions = async () => {
    if (!address || cancelledRef.current) return;
    setLoading(true);
    setError(null);
    const thisCall = ++fetchCountRef.current;
    try {
      const res = await fetch(
        `${DATA_API_URL}/positions?user=${address}&sizeThreshold=.01`,
        { headers: { Accept: 'application/json' } }
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const raw: any[] = await res.json();
      if (cancelledRef.current || thisCall !== fetchCountRef.current) return;

      const parsed: PolymarketPosition[] = raw.map((item) => ({
        conditionId: item.conditionId ?? '',
        asset: item.asset ?? '',
        title: item.title ?? item.question ?? '',
        slug: item.slug ?? '',
        outcome: item.outcome ?? '',
        size: Number(item.size ?? 0),
        avgPrice: Number(item.avgPrice ?? item.average_price ?? 0),
        currentPrice: Number(item.currentPrice ?? item.cur_price ?? 0),
        currentValue: Number(item.currentValue ?? item.cash_balance ?? 0),
        pnl: Number(item.pnl ?? item.realizedPnl ?? 0),
        image: item.image ?? undefined,
      }));

      setPositions(parsed);
    } catch (err) {
      if (!cancelledRef.current && thisCall === fetchCountRef.current) {
        setError(err instanceof Error ? err.message : 'Failed to fetch positions');
      }
    } finally {
      if (!cancelledRef.current && thisCall === fetchCountRef.current) {
        setLoading(false);
      }
    }
  };

  useEffect(() => {
    if (!address) {
      setPositions([]);
      setError(null);
      return;
    }

    cancelledRef.current = false;
    fetchPositions();
    const id = setInterval(fetchPositions, POLL_INTERVAL_MS);

    return () => {
      cancelledRef.current = true;
      clearInterval(id);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [address]);

  return { positions, loading, error, refetch: fetchPositions };
}
