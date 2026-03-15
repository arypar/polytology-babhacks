'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { usePrivy, useWallets } from '@privy-io/react-auth';
import { createWalletClient, custom, encodeFunctionData, createPublicClient, http, type WalletClient } from 'viem';
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
  | 'safe-deployed'
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
  /** Transfer USDC.e from the EOA (embedded wallet) to the Safe trading wallet. */
  fundSafe: (amountUsdc: number) => Promise<string>;
  reset: () => void;
}

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

// ── DB-backed helpers ─────────────────────────────────────────

interface StoredCredentials {
  eoa_address: string;
  api_key: string;
  api_secret: string;
  api_passphrase: string;
  safe_address: string | null;
  safe_deployed: boolean;
  tokens_approved: boolean;
}

async function fetchStoredCredentials(eoa: string): Promise<StoredCredentials | null> {
  try {
    const res = await fetch(`${API_BASE}/api/credentials/${eoa.toLowerCase()}`);
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

async function saveCredentials(params: {
  eoaAddress: string;
  apiKey: string;
  apiSecret: string;
  apiPassphrase: string;
  safeAddress?: string | null;
  safeDeployed?: boolean;
  tokensApproved?: boolean;
}): Promise<void> {
  try {
    await fetch(`${API_BASE}/api/credentials`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });
  } catch (e) {
    console.warn('[session] failed to save credentials to backend:', e);
  }
}

async function patchCredentials(eoa: string, updates: Partial<{
  safeAddress: string;
  safeDeployed: boolean;
  tokensApproved: boolean;
}>): Promise<void> {
  try {
    await fetch(`${API_BASE}/api/credentials/${eoa.toLowerCase()}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    });
  } catch (e) {
    console.warn('[session] failed to patch credentials:', e);
  }
}

// ── localStorage fallback (used as fast cache alongside DB) ──

const CREDS_KEY         = (eoa: string) => `polytology_creds_${eoa.toLowerCase()}`;
const ONCHAIN_DONE_KEY  = (eoa: string) => `polytology_onchain_${eoa.toLowerCase()}`;

function loadCredsLocal(eoa: string): ApiKeyCreds | null {
  try {
    const raw = localStorage.getItem(CREDS_KEY(eoa));
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function saveCredsLocal(eoa: string, creds: ApiKeyCreds) {
  try {
    localStorage.setItem(CREDS_KEY(eoa), JSON.stringify(creds));
  } catch { /* ignore */ }
}

/** Marks that on-chain approvals are done so we can skip re-doing them on next load. */
function markOnchainDoneLocal(eoa: string) {
  try {
    localStorage.setItem(ONCHAIN_DONE_KEY(eoa), '1');
  } catch { /* ignore */ }
}

function isOnchainDoneLocal(eoa: string): boolean {
  try {
    return localStorage.getItem(ONCHAIN_DONE_KEY(eoa)) === '1';
  } catch {
    return false;
  }
}

// ── Hook ──────────────────────────────────────────────────────

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

        // Try DB first, fall back to localStorage
        const stored = await fetchStoredCredentials(eoa);
        if (cancelled) return;

        let safeDeployed = stored?.safe_deployed ?? false;
        let tokensApproved = stored?.tokens_approved ?? false;

        let creds: ApiKeyCreds | null = null;
        if (stored?.api_key && stored?.api_secret && stored?.api_passphrase) {
          creds = {
            key: stored.api_key,
            secret: stored.api_secret,
            passphrase: stored.api_passphrase,
          };
          // Also refresh localStorage cache
          saveCredsLocal(eoa, creds);
        } else {
          // DB miss — try localStorage cache
          creds = loadCredsLocal(eoa);
          // Validate all three fields are present to avoid undefined HMAC secret errors
          if (creds && (!creds.key || !creds.secret || !creds.passphrase)) {
            creds = null;
          }
          // Creds are only written to localStorage after approveTokens() succeeds,
          // so if they exist the safe was deployed and tokens were approved.
          if (creds) {
            safeDeployed = true;
            tokensApproved = true;
          }
        }

        // tokensApproved can also come from the localStorage flag (survives backend restarts)
        if (!tokensApproved && isOnchainDoneLocal(eoa)) {
          tokensApproved = true;
        }

        if (!creds && tokensApproved) {
          // On-chain approvals are done but API keys are missing (e.g. backend restart,
          // cleared localStorage, or key-creation failed last time).  Auto-recover silently.
          try {
            const l1Client = createClobClientL1(wc);
            // createOrDeriveApiKey: tries createApiKey first; if the response has no key
            // (key already exists on Polymarket's side), it falls back to deriveApiKey.
            const recovered = await l1Client.createOrDeriveApiKey() as ApiKeyCreds;
            if (recovered?.key && recovered?.secret && recovered?.passphrase) {
              saveCredsLocal(eoa, recovered);
              await saveCredentials({
                eoaAddress: eoa,
                apiKey: recovered.key,
                apiSecret: recovered.secret,
                apiPassphrase: recovered.passphrase,
                safeAddress: safe,
                safeDeployed: true,
                tokensApproved: true,
              });
              clobClientRef.current = createClobClient(wc, recovered, safe);
              if (!cancelled) setStatus('ready');
              return;
            }
          } catch (e) {
            console.warn('[session] auto-recover API key failed, will re-prompt:', e);
          }
          if (!cancelled) setStatus('safe-deployed');
          return;
        }

        if (!creds || !tokensApproved) {
          setStatus(safeDeployed ? 'safe-deployed' : 'wallet-ready');
          return;
        }

        clobClientRef.current = createClobClient(wc, creds, safe);
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
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (msg === 'safe already deployed!') {
        // Safe is already live on-chain — treat as success and fall through
        console.log('[deploySafe] safe already deployed on-chain, skipping deploy');
      } else {
        setError(msg);
        setStatus('error');
        throw e;
      }
    }

    // Reached here either via successful deploy or already-deployed path
    if (eoaAddress) {
      await patchCredentials(eoaAddress, { safeAddress, safeDeployed: true });
    }
    setStatus('safe-deployed');
  }, [safeAddress, eoaAddress]);

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

      if (response?.transactionID) {
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

      // On-chain approvals succeeded — persist this fact immediately so a subsequent
      // key-creation failure doesn't force the user to redo on-chain work.
      if (eoaAddress) {
        markOnchainDoneLocal(eoaAddress);
        await patchCredentials(eoaAddress, { safeAddress: safeAddress ?? undefined, safeDeployed: true, tokensApproved: true });
      }

      // Create/derive API credentials and persist to DB + localStorage
      if (walletClientRef.current && eoaAddress) {
        const l1Client = createClobClientL1(walletClientRef.current);
        // createOrDeriveApiKey: tries createApiKey first; if Polymarket returns a
        // response without a key (meaning a key already exists), it automatically
        // falls back to deriveApiKey to retrieve the existing credentials.
        const creds = await l1Client.createOrDeriveApiKey() as ApiKeyCreds;

        if (!creds.key || !creds.secret || !creds.passphrase) {
          throw new Error('Polymarket returned incomplete API credentials');
        }

        // Save to localStorage cache
        saveCredsLocal(eoaAddress, creds);

        // Persist to DB (will survive backend restarts)
        await saveCredentials({
          eoaAddress,
          apiKey: creds.key,
          apiSecret: creds.secret,
          apiPassphrase: creds.passphrase,
          safeAddress,
          safeDeployed: true,
          tokensApproved: true,
        });

        clobClientRef.current = createClobClient(walletClientRef.current, creds, safeAddress);
      }

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
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const clientCreds = (clobClientRef.current as any).creds;
      if (!clientCreds?.secret) throw new Error('API credentials incomplete — please re-authenticate');

      const { tokenId, price, size, negRisk = false } = params;

      // Both YES and NO are BUY orders — caller passes the correct outcome token ID
      const order = {
        tokenID: tokenId,
        price,
        size,
        side: Side.BUY,
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

  const USDC_E = '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174' as `0x${string}`;
  const ALCHEMY_RPC = 'https://polygon-mainnet.g.alchemy.com/v2/cZH7r--ktRWyIH_1_qQZw';

  const fundSafe = useCallback(async (amountUsdc: number): Promise<string> => {
    if (!walletClientRef.current || !safeAddress || !eoaAddress) {
      throw new Error('Wallet not ready — complete setup first');
    }
    if (amountUsdc <= 0) throw new Error('Amount must be greater than 0');

    const amount = BigInt(Math.round(amountUsdc * 1_000_000)); // 6 decimals

    const data = encodeFunctionData({
      abi: [{
        name: 'transfer',
        type: 'function',
        stateMutability: 'nonpayable',
        inputs: [{ name: 'to', type: 'address' }, { name: 'amount', type: 'uint256' }],
        outputs: [{ name: '', type: 'bool' }],
      }] as const,
      functionName: 'transfer',
      args: [safeAddress as `0x${string}`, amount],
    });

    const hash = await walletClientRef.current.sendTransaction({
      to: USDC_E,
      data,
      account: eoaAddress as `0x${string}`,
      chain: polygon,
    });

    // Wait for the tx to mine before returning so callers can refresh balances
    const publicClient = createPublicClient({ chain: polygon, transport: http(ALCHEMY_RPC) });
    await publicClient.waitForTransactionReceipt({ hash });
    return hash;
  }, [safeAddress, eoaAddress]);

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
    fundSafe,
    reset,
  };
}
