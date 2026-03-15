'use client';

import { useState, useEffect, useRef } from 'react';
import { createPublicClient, http, fallback, formatUnits } from 'viem';
import { polygon } from 'viem/chains';

// Polygon has two USDC variants — query both and sum them
const USDC_E_ADDRESS = '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174' as const; // bridged USDC.e
const USDC_ADDRESS  = '0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359' as const; // native USDC

const BALANCE_OF_ABI = [
  {
    name: 'balanceOf',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }],
  },
] as const;

const publicClient = createPublicClient({
  chain: polygon,
  transport: fallback([
    http('https://polygon-mainnet.g.alchemy.com/v2/cZH7r--ktRWyIH_1_qQZw'),
    http('https://polygon-bor-rpc.publicnode.com'),
  ]),
});

const POLL_INTERVAL_MS = 30_000;

export interface WalletBalance {
  /** USDC.e (bridged) — the token Polymarket actually uses for trading */
  usdce: number;
  /** Native USDC — held but NOT usable on Polymarket without conversion */
  usdc: number;
  /** true when the wallet has native USDC but no USDC.e */
  needsConversion: boolean;
  loading: boolean;
}

export function useWalletBalance(address: string | null): WalletBalance {
  const [usdce, setUsdce] = useState<number>(0);
  const [usdc, setUsdc] = useState<number>(0);
  const [loading, setLoading] = useState(false);
  const cancelledRef = useRef(false);

  useEffect(() => {
    if (!address) {
      setUsdce(0);
      setUsdc(0);
      return;
    }

    cancelledRef.current = false;

    async function fetchBalance() {
      if (cancelledRef.current) return;
      setLoading(true);
      try {
        const addr = address as `0x${string}`;
        const [rawUsdce, rawUsdc] = await Promise.all([
          publicClient.readContract({
            address: USDC_E_ADDRESS,
            abi: BALANCE_OF_ABI,
            functionName: 'balanceOf',
            args: [addr],
          }),
          publicClient.readContract({
            address: USDC_ADDRESS,
            abi: BALANCE_OF_ABI,
            functionName: 'balanceOf',
            args: [addr],
          }),
        ]);
        if (!cancelledRef.current) {
          setUsdce(Number(formatUnits(rawUsdce, 6)));
          setUsdc(Number(formatUnits(rawUsdc, 6)));
        }
      } catch {
        // Silently ignore RPC errors — balances stay at last known values
      } finally {
        if (!cancelledRef.current) setLoading(false);
      }
    }

    fetchBalance();
    const id = setInterval(fetchBalance, POLL_INTERVAL_MS);

    return () => {
      cancelledRef.current = true;
      clearInterval(id);
    };
  }, [address]);

  return {
    usdce,
    usdc,
    needsConversion: usdc > 0 && usdce === 0,
    loading,
  };
}
