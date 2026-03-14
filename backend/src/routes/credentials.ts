import { Router } from 'express';
import { supabase, DB_ENABLED } from '../lib/supabase.js';
import { log } from '../lib/log.js';

const router = Router();

// In-memory fallback
const mem = new Map<string, unknown>();

// GET /api/credentials/:eoa — load saved session state for a wallet
router.get('/credentials/:eoa', async (req, res) => {
  const eoa = req.params.eoa.toLowerCase();

  if (!DB_ENABLED || !supabase) {
    return res.json(mem.get(eoa) ?? null);
  }

  const { data, error } = await supabase
    .from('user_credentials')
    .select('*')
    .eq('eoa_address', eoa)
    .single();

  if (error && error.code !== 'PGRST116') {  // PGRST116 = no rows
    return res.status(500).json({ error: error.message });
  }

  res.json(data ?? null);
});

// POST /api/credentials — upsert session state
router.post('/credentials', async (req, res) => {
  const {
    eoaAddress,
    apiKey,
    apiSecret,
    apiPassphrase,
    safeAddress,
    safeDeployed,
    tokensApproved,
  } = req.body as {
    eoaAddress: string;
    apiKey: string;
    apiSecret: string;
    apiPassphrase: string;
    safeAddress?: string;
    safeDeployed?: boolean;
    tokensApproved?: boolean;
  };

  if (!eoaAddress || !apiKey || !apiSecret || !apiPassphrase) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  const eoa = eoaAddress.toLowerCase();
  log('credentials', `Upsert creds for ${eoa.slice(0, 10)}…`);

  if (!DB_ENABLED || !supabase) {
    mem.set(eoa, req.body);
    return res.json({ ok: true });
  }

  const { error } = await supabase
    .from('user_credentials')
    .upsert({
      eoa_address:     eoa,
      api_key:         apiKey,
      api_secret:      apiSecret,
      api_passphrase:  apiPassphrase,
      safe_address:    safeAddress ?? null,
      safe_deployed:   safeDeployed ?? false,
      tokens_approved: tokensApproved ?? false,
      updated_at:      new Date().toISOString(),
    }, { onConflict: 'eoa_address' });

  if (error) return res.status(500).json({ error: error.message });
  res.json({ ok: true });
});

// PATCH /api/credentials/:eoa — update only specific fields (safe_deployed, tokens_approved, etc.)
router.patch('/credentials/:eoa', async (req, res) => {
  const eoa = req.params.eoa.toLowerCase();

  if (!DB_ENABLED || !supabase) {
    const existing = (mem.get(eoa) ?? {}) as object;
    mem.set(eoa, { ...existing, ...req.body });
    return res.json({ ok: true });
  }

  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (req.body.safeAddress   !== undefined) updates.safe_address    = req.body.safeAddress;
  if (req.body.safeDeployed  !== undefined) updates.safe_deployed   = req.body.safeDeployed;
  if (req.body.tokensApproved !== undefined) updates.tokens_approved = req.body.tokensApproved;

  const { error } = await supabase
    .from('user_credentials')
    .update(updates)
    .eq('eoa_address', eoa);

  if (error) return res.status(500).json({ error: error.message });
  res.json({ ok: true });
});

export default router;
