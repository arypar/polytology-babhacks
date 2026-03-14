import { Router } from 'express';
import { supabase, DB_ENABLED } from '../lib/supabase.js';
import { log } from '../lib/log.js';

const router = Router();

// In-memory fallback
const mem = new Map<string, unknown>();

// POST /api/trades — record a placed order
router.post('/trades', async (req, res) => {
  const trade = req.body as {
    orderId?: string;
    eoaAddress: string;
    safeAddress?: string;
    strategyId?: string;
    marketId: string;
    marketQuestion?: string;
    tokenId: string;
    side: string;
    price: number;
    size: number;
    negRisk?: boolean;
  };

  if (!trade?.eoaAddress || !trade?.marketId || !trade?.tokenId) {
    return res.status(400).json({ error: 'Missing required fields: eoaAddress, marketId, tokenId' });
  }

  log('trades', `POST /api/trades — ${trade.side} ${trade.size} @ ${trade.price} on ${trade.marketId.slice(0, 10)}…`);

  if (!DB_ENABLED || !supabase) {
    const id = crypto.randomUUID();
    const record = { id, ...trade, status: 'open', pnl: 0, created_at: new Date().toISOString() };
    mem.set(id, record);
    return res.status(201).json(record);
  }

  const { data, error } = await supabase
    .from('trades')
    .insert({
      order_id:        trade.orderId ?? null,
      eoa_address:     trade.eoaAddress,
      safe_address:    trade.safeAddress ?? null,
      strategy_id:     trade.strategyId ?? null,
      market_id:       trade.marketId,
      market_question: trade.marketQuestion ?? null,
      token_id:        trade.tokenId,
      side:            trade.side,
      price:           trade.price,
      size:            trade.size,
      neg_risk:        trade.negRisk ?? false,
      status:          'open',
    })
    .select()
    .single();

  if (error) {
    log('trades', `DB error: ${error.message}`);
    return res.status(500).json({ error: error.message });
  }

  res.status(201).json(data);
});

// GET /api/trades?eoa=0x...
router.get('/trades', async (req, res) => {
  const { eoa, limit = '50' } = req.query as Record<string, string>;

  if (!DB_ENABLED || !supabase) {
    const all = [...mem.values()];
    const filtered = eoa
      ? all.filter((t: any) => t.eoaAddress?.toLowerCase() === eoa.toLowerCase())
      : all;
    return res.json(filtered.slice(0, parseInt(limit)));
  }

  let query = supabase
    .from('trades')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(parseInt(limit));

  if (eoa) query = query.eq('eoa_address', eoa.toLowerCase());

  const { data, error } = await query;
  if (error) return res.status(500).json({ error: error.message });
  res.json(data ?? []);
});

// PATCH /api/trades/:id — update status / pnl
router.patch('/trades/:id', async (req, res) => {
  const { id } = req.params;

  if (!DB_ENABLED || !supabase) {
    const existing = mem.get(id);
    if (!existing) return res.status(404).json({ error: 'Not found' });
    const updated = { ...(existing as object), ...req.body };
    mem.set(id, updated);
    return res.json(updated);
  }

  const { data, error } = await supabase
    .from('trades')
    .update({ ...req.body, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single();

  if (error) return res.status(500).json({ error: error.message });
  if (!data) return res.status(404).json({ error: 'Not found' });
  res.json(data);
});

export default router;
