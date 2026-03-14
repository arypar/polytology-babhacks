'use client';

import { useState, useEffect, useCallback, useRef } from 'react';

export type FundingStatus = 'idle' | 'queuing' | 'pending' | 'processing' | 'completed' | 'failed';

export interface FundingState {
  fundingStatus: FundingStatus;
  txHash: string | null;
  fundedAt: string | null;
  amount: number;
  queue: () => void;
}

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
const POLL_INTERVAL_MS = 5000;

export function useFunding(
  eoaAddress: string | null,
  safeAddress: string | null,
  walletReady: boolean
): FundingState {
  const [fundingStatus, setFundingStatus] = useState<FundingStatus>('idle');
  const [txHash, setTxHash] = useState<string | null>(null);
  const [fundedAt, setFundedAt] = useState<string | null>(null);
  const [amount] = useState(5.0);

  const queuedRef = useRef(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchStatus = useCallback(async (eoa: string) => {
    try {
      const res = await fetch(`${API_BASE}/api/funding/status/${eoa.toLowerCase()}`);
      if (!res.ok) return;
      const data = await res.json() as {
        status: string;
        tx_hash: string | null;
        funded_at: string | null;
        amount_usdc: number;
      };
      setFundingStatus(data.status as FundingStatus);
      setTxHash(data.tx_hash);
      setFundedAt(data.funded_at);

      if (data.status === 'completed' || data.status === 'failed') {
        if (pollRef.current) {
          clearInterval(pollRef.current);
          pollRef.current = null;
        }
      }
    } catch {
      // silently ignore network errors
    }
  }, []);

  const queue = useCallback(async () => {
    if (!eoaAddress || !safeAddress || queuedRef.current) return;
    queuedRef.current = true;
    setFundingStatus('queuing');

    try {
      const res = await fetch(`${API_BASE}/api/funding/queue`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          eoaAddress: eoaAddress.toLowerCase(),
          safeAddress: safeAddress.toLowerCase(),
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({})) as { error?: string };
        console.warn('[useFunding] queue failed:', err.error);
        setFundingStatus('failed');
        return;
      }

      const data = await res.json() as { status: string };
      setFundingStatus(data.status as FundingStatus);

      // Start polling
      pollRef.current = setInterval(() => {
        if (eoaAddress) fetchStatus(eoaAddress);
      }, POLL_INTERVAL_MS);
    } catch (e) {
      console.warn('[useFunding] queue error:', e);
      setFundingStatus('failed');
    }
  }, [eoaAddress, safeAddress, fetchStatus]);

  // Auto-queue once wallet is ready
  useEffect(() => {
    if (walletReady && eoaAddress && safeAddress && !queuedRef.current) {
      // Check existing status first
      fetchStatus(eoaAddress).then(() => {
        if (!queuedRef.current) {
          queue();
        }
      });
    }
  }, [walletReady, eoaAddress, safeAddress, queue, fetchStatus]);

  // Cleanup polling on unmount
  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  return { fundingStatus, txHash, fundedAt, amount, queue };
}
