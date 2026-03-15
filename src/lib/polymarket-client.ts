import { ClobClient, type ApiKeyCreds, Side, SignatureType } from '@polymarket/clob-client';
import { RelayClient } from '@polymarket/builder-relayer-client';
import { BuilderConfig } from '@polymarket/builder-signing-sdk';
import type { WalletClient } from 'viem';

export { Side, SignatureType };
export type { ApiKeyCreds };

export const POLYGON_CHAIN_ID = 137;
export const CLOB_API_URL = 'https://clob.polymarket.com';
export const RELAYER_URL = 'https://relayer-v2.polymarket.com';

// In the browser, POST requests to clob.polymarket.com are blocked by CORS
// preflight. Route all CLOB client traffic through our Next.js proxy instead.
function getClobUrl(): string {
  if (typeof window === 'undefined') return CLOB_API_URL;
  return `${window.location.origin}/api/clob`;
}

// Proxy URL: relay client requests are routed through our Next.js API to avoid
// CORS issues when calling the relayer directly from the browser.
function getRelayerProxyUrl(): string {
  const origin =
    typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000';
  return `${origin}/api/relayer`;
}

// Contract addresses on Polygon
export const CONTRACTS = {
  NEG_RISK_ADAPTER: '0xd91E80cF2E7be2e162c6513ceD06f1dD0dA35296',
  NEG_RISK_EXCHANGE: '0xC5d563A36AE78145C45a50134d48A1215220f80a',
  CTF_EXCHANGE: '0x4bFb41d5B3570DeFd03C39a9A4D8dE6Bd8B8982E',
  CTF_CONTRACT: '0x4d97dcd97ec945f40cf65f87097ace5ea0476045',
  USDC_E: '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174',
} as const;

/**
 * Creates a BuilderConfig that routes HMAC signing through our
 * server-side Next.js API route so builder credentials never touch the browser.
 */
function makeBuilderConfig(): BuilderConfig {
  const origin = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000';
  return new BuilderConfig({
    remoteBuilderConfig: { url: `${origin}/api/polymarket/sign` },
  });
}

/**
 * Creates a ClobClient with Level 2 auth (API key creds).
 * When safeAddress is provided the client uses POLY_PROXY signature type so
 * the Safe is the on-chain maker/funder while the EOA wallet signs the orders.
 */
export function createClobClient(
  walletClient: WalletClient,
  creds: ApiKeyCreds,
  safeAddress?: string | null
): ClobClient {
  const sigType = safeAddress ? SignatureType.POLY_PROXY : SignatureType.EOA;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return new ClobClient(getClobUrl(), POLYGON_CHAIN_ID, walletClient as any, creds, sigType, safeAddress ?? undefined);
}

/**
 * Creates a ClobClient with Level 1 auth only (for deriving/creating API creds).
 */
export function createClobClientL1(walletClient: WalletClient): ClobClient {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return new ClobClient(getClobUrl(), POLYGON_CHAIN_ID, walletClient as any);
}

/**
 * Creates a RelayClient for gasless Safe deployment and token approvals.
 * Uses the server-side signing endpoint so builder credentials stay secure.
 */
export function createRelayClient(walletClient: WalletClient): RelayClient {
  const builderConfig = makeBuilderConfig();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return new RelayClient(getRelayerProxyUrl(), POLYGON_CHAIN_ID, walletClient as any, builderConfig as any);
}

/**
 * Derives the deterministic Safe address for a given EOA.
 * The same EOA always maps to the same Safe.
 */
export async function deriveSafeAddress(eoaAddress: string): Promise<string> {
  const { deriveSafe } = await import(
    '@polymarket/builder-relayer-client/dist/builder/derive'
  );
  const { getContractConfig } = await import(
    '@polymarket/builder-relayer-client/dist/config'
  );
  const config = getContractConfig(POLYGON_CHAIN_ID);
  return deriveSafe(eoaAddress, config.SafeContracts.SafeFactory);
}

/**
 * Builds the ERC-20/ERC-1155 approval transactions for all Polymarket contracts.
 */
export function buildApprovalTransactions() {
  const MAX_UINT256 =
    '115792089237316195423570985008687907853269984665640564039457584007913129639935';

  const erc20ApproveData = (spender: string) =>
    '0x095ea7b3' +
    spender.slice(2).toLowerCase().padStart(64, '0') +
    BigInt(MAX_UINT256).toString(16).padStart(64, '0');

  const erc1155ApproveData = (spender: string) =>
    '0xa22cb465' +
    spender.slice(2).toLowerCase().padStart(64, '0') +
    '0000000000000000000000000000000000000000000000000000000000000001';

  const erc20Spenders = [
    CONTRACTS.NEG_RISK_ADAPTER,
    CONTRACTS.NEG_RISK_EXCHANGE,
    CONTRACTS.CTF_EXCHANGE,
    CONTRACTS.CTF_CONTRACT,
  ];

  const erc1155Spenders = [
    CONTRACTS.NEG_RISK_ADAPTER,
    CONTRACTS.NEG_RISK_EXCHANGE,
    CONTRACTS.CTF_EXCHANGE,
  ];

  return [
    ...erc20Spenders.map((spender) => ({
      to: CONTRACTS.USDC_E,
      data: erc20ApproveData(spender),
      value: '0',
    })),
    ...erc1155Spenders.map((spender) => ({
      to: CONTRACTS.CTF_CONTRACT,
      data: erc1155ApproveData(spender),
      value: '0',
    })),
  ];
}
