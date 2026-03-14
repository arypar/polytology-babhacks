import { Router } from 'express';
import { supabase, DB_ENABLED } from '../lib/supabase.js';
import { log, logWarn, logError } from '../lib/log.js';

const router = Router();

// In-memory fallback when DB is not available
const mem = new Map<string, FundingRow>();

interface FundingRow {
  eoa_address: string;
  safe_address: string;
  amount_usdc: number;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  tx_hash: string | null;
  funded_at: string | null;
  created_at: string;
  updated_at: string;
}

// ── Transfer stub ────────────────────────────────────────────────────────────
//
// TODO: Replace this stub with a real USDC transfer once the admin funding
// wallet is set up and loaded. Implementation steps:
//
//   1. Set env vars: FUNDING_WALLET_PRIVATE_KEY, POLYGON_RPC_URL
//   2. Import viem: createWalletClient, http, parseUnits
//   3. Use the USDC contract on Polygon (0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174)
//      or USDC.e (0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359)
//   4. Send `amount * 1e6` (6 decimals) to safeAddress
//   5. Return the transaction hash
//
async function sendUsdc(_safeAddress: string, _amountUsdc: number): Promise<string> {
  const privateKey = process.env.FUNDING_WALLET_PRIVATE_KEY;
  const rpcUrl = process.env.POLYGON_RPC_URL;

  if (!privateKey || !rpcUrl) {
    throw new Error('FUNDING_WALLET_PRIVATE_KEY or POLYGON_RPC_URL not configured');
  }

  // Real implementation will go here. For now we throw so the caller
  // can mark the row as pending without attempting a transfer.
  throw new Error('USDC transfer not yet implemented — awaiting admin wallet funding');
}

// ── POST /api/funding/queue ──────────────────────────────────────────────────
// Called by the frontend once the user's wallet is fully set up (status === 'ready').
// Idempotent — if a row already exists we return its current status.
router.post('/funding/queue', async (req, res) => {
  const { eoaAddress, safeAddress } = req.body as {
    eoaAddress?: string;
    safeAddress?: string;
  };

  if (!eoaAddress || !safeAddress) {
    return res.status(400).json({ error: 'eoaAddress and safeAddress are required' });
  }

  const eoa = eoaAddress.toLowerCase();
  const safe = safeAddress.toLowerCase();
  log('funding', `Queue request for ${eoa.slice(0, 10)}… → safe ${safe.slice(0, 10)}…`);

  if (!DB_ENABLED || !supabase) {
    // In-memory path
    if (mem.has(eoa)) {
      const existing = mem.get(eoa)!;
      return res.json({ status: existing.status, alreadyQueued: true });
    }
    const now = new Date().toISOString();
    const row: FundingRow = {
      eoa_address: eoa,
      safe_address: safe,
      amount_usdc: 5.0,
      status: 'pending',
      tx_hash: null,
      funded_at: null,
      created_at: now,
      updated_at: now,
    };
    mem.set(eoa, row);
    return res.json({ status: 'pending' });
  }

  // Check for existing row
  const { data: existing } = await supabase
    .from('user_funding')
    .select('status')
    .eq('eoa_address', eoa)
    .single();

  if (existing) {
    return res.json({ status: existing.status, alreadyQueued: true });
  }

  const { error } = await supabase.from('user_funding').insert({
    eoa_address:  eoa,
    safe_address: safe,
    amount_usdc:  5.0,
    status:       'pending',
    updated_at:   new Date().toISOString(),
  });

  if (error) {
    logError('funding', `Insert failed: ${error.message}`);
    return res.status(500).json({ error: error.message });
  }

  res.json({ status: 'pending' });
});

// ── GET /api/funding/status/:eoa ─────────────────────────────────────────────
// Polled by the frontend to show real-time funding status in the onboarding UI.
router.get('/funding/status/:eoa', async (req, res) => {
  const eoa = req.params.eoa.toLowerCase();

  if (!DB_ENABLED || !supabase) {
    const row = mem.get(eoa);
    if (!row) return res.json({ status: 'not_found' });
    return res.json(row);
  }

  const { data, error } = await supabase
    .from('user_funding')
    .select('*')
    .eq('eoa_address', eoa)
    .single();

  if (error && error.code !== 'PGRST116') {
    return res.status(500).json({ error: error.message });
  }

  res.json(data ?? { status: 'not_found' });
});

// ── POST /api/funding/process ────────────────────────────────────────────────
// Internal admin endpoint. Picks the oldest pending row and attempts the USDC
// transfer. Call this from a cron job or manually once the admin wallet is funded.
//
// Once FUNDING_WALLET_PRIVATE_KEY is configured, this will:
//   1. Mark the row as 'processing'
//   2. Call sendUsdc()
//   3. Mark as 'completed' with tx_hash, or 'failed' on error
router.post('/funding/process', async (req, res) => {
  log('funding', 'Processing next pending funding row…');

  // Fetch one pending row
  let row: FundingRow | null = null;

  if (!DB_ENABLED || !supabase) {
    for (const r of mem.values()) {
      if (r.status === 'pending') { row = r; break; }
    }
  } else {
    const { data } = await supabase
      .from('user_funding')
      .select('*')
      .eq('status', 'pending')
      .order('created_at', { ascending: true })
      .limit(1)
      .single();
    row = data ?? null;
  }

  if (!row) {
    return res.json({ message: 'No pending funding rows' });
  }

  const eoa = row.eoa_address;
  log('funding', `Processing ${eoa.slice(0, 10)}… safe=${row.safe_address.slice(0, 10)}…`);

  // Mark as processing
  const now = new Date().toISOString();
  if (!DB_ENABLED || !supabase) {
    mem.set(eoa, { ...row, status: 'processing', updated_at: now });
  } else {
    await supabase
      .from('user_funding')
      .update({ status: 'processing', updated_at: now })
      .eq('eoa_address', eoa);
  }

  try {
    const txHash = await sendUsdc(row.safe_address, row.amount_usdc);
    const fundedAt = new Date().toISOString();
    log('funding', `✓ Funded ${eoa.slice(0, 10)}… tx=${txHash}`);

    if (!DB_ENABLED || !supabase) {
      mem.set(eoa, { ...row, status: 'completed', tx_hash: txHash, funded_at: fundedAt, updated_at: fundedAt });
    } else {
      await supabase
        .from('user_funding')
        .update({ status: 'completed', tx_hash: txHash, funded_at: fundedAt, updated_at: fundedAt })
        .eq('eoa_address', eoa);
    }

    res.json({ status: 'completed', txHash });
  } catch (e) {
    const errMsg = e instanceof Error ? e.message : String(e);
    logWarn('funding', `Transfer failed for ${eoa.slice(0, 10)}…: ${errMsg}`);

    if (!DB_ENABLED || !supabase) {
      mem.set(eoa, { ...row, status: 'failed', updated_at: now });
    } else {
      await supabase
        .from('user_funding')
        .update({ status: 'failed', updated_at: now })
        .eq('eoa_address', eoa);
    }

    res.status(500).json({ error: errMsg });
  }
});

export default router;
