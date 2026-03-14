'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { usePrivy, useWallets } from '@privy-io/react-auth';
import { createWalletClient, custom, type WalletClient } from 'viem';
import { polygon } from 'viem/chains';
import { Side, OrderType } from '@polymarket/clob-client';
import { RelayerTransactionState } from '@polymarket/builder-relayer-client';
import {
  deriveSafeAddress,
  createClobClient,
  createClobClientL1,
  createRelayClient,
  buildApprovalTransactions,
  type ApiKeyCreds,
} from '@/lib/polymarket-client';

export type SessionStatus =
  | 'idle'
  | 'wallet-ready'
  | 'safe-deploying'
  | 'approving'
  | 'ready'
  | 'error';

export interface PlaceOrderParams {
  tokenId: string;
  side: 'YES' | 'NO';
  price: number;
  size: number;
  negRisk?: boolean;
}

export interface PolymarketSession {
  status: SessionStatus;
  error: string | null;
  safeAddress: string | null;
  eoaAddress: string | null;
  login: () => void;
  logout: () => void;
  deploySafe: () => Promise<void>;
  approveTokens: () => Promise<void>;
  placeOrder: (params: PlaceOrderParams) => Promise<{ orderId: string } | null>;
  reset: () => void;
}

const CREDS_KEY = (eoa: string) => `polytology_creds_${eoa.toLowerCase()}`;

function loadCreds(eoa: string): ApiKeyCreds | null {
  try {
    const raw = localStorage.getItem(CREDS_KEY(eoa));
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function saveCreds(eoa: string, creds: ApiKeyCreds) {
  try {
    localStorage.setItem(CREDS_KEY(eoa), JSON.stringify(creds));
  } catch { /* ignore */ }
}

function loadSafeDeployed(safeAddress: string): boolean {
  try {
    return localStorage.getItem(`safe_deployed_${safeAddress.toLowerCase()}`) === '1';
  } catch {
    return false;
  }
}

function markSafeDeployed(safeAddress: string) {
  try {
    localStorage.setItem(`safe_deployed_${safeAddress.toLowerCase()}`, '1');
  } catch { /* ignore */ }
}

function loadTokensApproved(safeAddress: string): boolean {
  try {
    return localStorage.getItem(`tokens_approved_${safeAddress.toLowerCase()}`) === '1';
  } catch {
    return false;
  }
}

function markTokensApproved(safeAddress: string) {
  try {
    localStorage.setItem(`tokens_approved_${safeAddress.toLowerCase()}`, '1');
  } catch { /* ignore */ }
}

export function usePolymarketSession(): PolymarketSession {
  const { login, logout: privyLogout, authenticated } = usePrivy();
  const { wallets } = useWallets();

  const [status, setStatus] = useState<SessionStatus>('idle');
  const [error, setError] = useState<string | null>(null);
  const [safeAddress, setSafeAddress] = useState<string | null>(null);
  const [eoaAddress, setEoaAddress] = useState<string | null>(null);

  const walletClientRef = useRef<WalletClient | null>(null);
  const clobClientRef = useRef<ReturnType<typeof createClobClient> | null>(null);
  const relayClientRef = useRef<ReturnType<typeof createRelayClient> | null>(null);

  const getViemWalletClient = useCallback(async (): Promise<WalletClient | null> => {
    const embeddedWallet = wallets.find((w) => w.walletClientType === 'privy');
    if (!embeddedWallet) return null;

    try {
      await embeddedWallet.switchChain(137);
      const eip1193Provider = await embeddedWallet.getEthereumProvider();
      const walletClient = createWalletClient({
        chain: polygon,
        transport: custom(eip1193Provider),
      });
      return walletClient;
    } catch (e) {
      console.error('[session] failed to get wallet client:', e);
      return null;
    }
  }, [wallets]);

  // Bootstrap the session when the user is authenticated
  useEffect(() => {
    if (!authenticated) {
      setStatus('idle');
      setEoaAddress(null);
      setSafeAddress(null);
      walletClientRef.current = null;
      clobClientRef.current = null;
      relayClientRef.current = null;
      return;
    }

    const embeddedWallet = wallets.find((w) => w.walletClientType === 'privy');
    if (!embeddedWallet) return;

    const eoa = embeddedWallet.address;
    setEoaAddress(eoa);

    let cancelled = false;

    (async () => {
      try {
        const safe = await deriveSafeAddress(eoa);
        if (cancelled) return;
        setSafeAddress(safe);

        const wc = await getViemWalletClient();
        if (!wc || cancelled) return;
        walletClientRef.current = wc;

        relayClientRef.current = createRelayClient(wc);

        const storedCreds = loadCreds(eoa);
        const safeDeployed = loadSafeDeployed(safe);
        const tokensApproved = loadTokensApproved(safe);

        if (!storedCreds || !safeDeployed || !tokensApproved) {
          setStatus('wallet-ready');
          return;
        }

        clobClientRef.current = createClobClient(wc, storedCreds);
        setStatus('ready');
      } catch (e) {
        if (!cancelled) {
          setError(String(e));
          setStatus('error');
        }
      }
    })();

    return () => { cancelled = true; };
  }, [authenticated, wallets, getViemWalletClient]);

  const deploySafe = useCallback(async () => {
    if (!relayClientRef.current || !safeAddress) throw new Error('No relay client');
    setStatus('safe-deploying');
    setError(null);

    try {
      const response = await relayClientRef.current.deploy();
      await relayClientRef.current.pollUntilState(
        response.transactionID,
        [
          RelayerTransactionState.STATE_MINED,
          RelayerTransactionState.STATE_CONFIRMED,
          RelayerTransactionState.STATE_FAILED,
        ],
        '120',
        3000
      );
      markSafeDeployed(safeAddress);
      setStatus('wallet-ready');
    } catch (e) {
      setError(String(e));
      setStatus('error');
      throw e;
    }
  }, [safeAddress]);

  const approveTokens = useCallback(async () => {
    if (!relayClientRef.current || !safeAddress) throw new Error('No relay client');
    setStatus('approving');
    setError(null);

    try {
      const txs = buildApprovalTransactions();
      const response = await relayClientRef.current.execute(
        txs as Parameters<typeof relayClientRef.current.execute>[0],
        'Set Polymarket token approvals'
      );

      if (response && response.transactionID) {
        await relayClientRef.current.pollUntilState(
          response.transactionID,
          [
            RelayerTransactionState.STATE_MINED,
            RelayerTransactionState.STATE_CONFIRMED,
            RelayerTransactionState.STATE_FAILED,
          ],
          '120',
          3000
        );
      }

      // Derive or create API credentials
      if (walletClientRef.current && eoaAddress) {
        const l1Client = createClobClientL1(walletClientRef.current);
        let creds: ApiKeyCreds;
        try {
          creds = await l1Client.deriveApiKey() as ApiKeyCreds;
        } catch {
          creds = await l1Client.createApiKey() as ApiKeyCreds;
        }
        saveCreds(eoaAddress, creds);
        clobClientRef.current = createClobClient(walletClientRef.current, creds);
      }

      markTokensApproved(safeAddress);
      setStatus('ready');
    } catch (e) {
      setError(String(e));
      setStatus('error');
      throw e;
    }
  }, [safeAddress, eoaAddress]);

  const placeOrder = useCallback(
    async (params: PlaceOrderParams): Promise<{ orderId: string } | null> => {
      if (!clobClientRef.current) throw new Error('Trading session not ready');

      const { tokenId, side, price, size, negRisk = false } = params;

      const order = {
        tokenID: tokenId,
        price,
        size,
        side: side === 'YES' ? Side.BUY : Side.SELL,
        feeRateBps: 0,
        expiration: 0,
        taker: '0x0000000000000000000000000000000000000000' as `0x${string}`,
      };

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const response = await clobClientRef.current.createAndPostOrder(order as any, { negRisk }, OrderType.GTC);
      return { orderId: response.orderID };
    },
    []
  );

  const logout = useCallback(async () => {
    await privyLogout();
    setStatus('idle');
    setEoaAddress(null);
    setSafeAddress(null);
    walletClientRef.current = null;
    clobClientRef.current = null;
    relayClientRef.current = null;
  }, [privyLogout]);

  const reset = useCallback(() => {
    setStatus(authenticated ? 'wallet-ready' : 'idle');
    setError(null);
  }, [authenticated]);

  return {
    status,
    error,
    safeAddress,
    eoaAddress,
    login,
    logout,
    deploySafe,
    approveTokens,
    placeOrder,
    reset,
  };
}
