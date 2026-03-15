import { Router } from 'express';
import { supabase, DB_ENABLED } from '../lib/supabase.js';

const router = Router();

// In-memory fallback (keyed by eoa_address → strategy[])
const mem = new Map<string, Map<string, unknown>>();

function memForEoa(eoa: string): Map<string, unknown> {
  if (!mem.has(eoa)) mem.set(eoa, new Map());
  return mem.get(eoa)!;
}

// GET /api/strategies?eoa=0x...
router.get('/strategies', async (req, res) => {
  const eoa = (req.query.eoa as string | undefined)?.toLowerCase();
  if (!eoa) return res.status(400).json({ error: 'eoa query param required' });

  if (!DB_ENABLED || !supabase) {
    return res.json([...memForEoa(eoa).values()]);
  }

  const { data, error } = await supabase
    .from('strategies')
    .select('*')
    .eq('eoa_address', eoa)
    .order('created_at', { ascending: false });

  if (error) return res.status(500).json({ error: error.message });
  res.json(data ?? []);
});

// POST /api/strategies  — body must include eoaAddress
router.post('/strategies', async (req, res) => {
  const strategy = req.body;
  if (!strategy?.id) return res.status(400).json({ error: 'Missing id' });

  const eoa = (strategy.eoaAddress as string | undefined)?.toLowerCase();
  if (!eoa) return res.status(400).json({ error: 'Missing eoaAddress' });

  if (!DB_ENABLED || !supabase) {
    memForEoa(eoa).set(strategy.id, strategy);
    return res.status(201).json(strategy);
  }

  const { data, error } = await supabase
    .from('strategies')
    .upsert({
      id:              strategy.id,
      eoa_address:     eoa,
      name:            strategy.name ?? 'Untitled',
      blocks:          strategy.blocks ?? [],
      is_active:       strategy.isActive ?? false,
      runtime_status:  strategy.runtimeStatus ?? 'running',
      market_id:       strategy.marketId ?? null,
      market_question: strategy.marketQuestion ?? null,
      updated_at:      new Date().toISOString(),
    }, { onConflict: 'id' })
    .select()
    .single();

  if (error) return res.status(500).json({ error: error.message });
  res.status(201).json(data);
});

// PATCH /api/strategies/:id?eoa=0x...
router.patch('/strategies/:id', async (req, res) => {
  const { id } = req.params;
  const eoa = (req.query.eoa as string | undefined)?.toLowerCase()
    ?? (req.body.eoaAddress as string | undefined)?.toLowerCase();

  if (!eoa) return res.status(400).json({ error: 'eoa query param or eoaAddress body field required' });

  if (!DB_ENABLED || !supabase) {
    const store = memForEoa(eoa);
    const existing = store.get(id);
    if (!existing) return res.status(404).json({ error: 'Not found' });
    const updated = { ...(existing as object), ...req.body };
    store.set(id, updated);
    return res.json(updated);
  }

  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (req.body.name !== undefined)           updates.name            = req.body.name;
  if (req.body.blocks !== undefined)         updates.blocks          = req.body.blocks;
  if (req.body.isActive !== undefined)       updates.is_active       = req.body.isActive;
  if (req.body.marketId !== undefined)       updates.market_id       = req.body.marketId;
  if (req.body.marketQuestion !== undefined) updates.market_question = req.body.marketQuestion;
  if (req.body.runtimeStatus !== undefined)  updates.runtime_status  = req.body.runtimeStatus;

  const { data, error } = await supabase
    .from('strategies')
    .update(updates)
    .eq('id', id)
    .eq('eoa_address', eoa)   // ownership check
    .select()
    .single();

  if (error) return res.status(500).json({ error: error.message });
  if (!data) return res.status(404).json({ error: 'Not found' });
  res.json(data);
});

// DELETE /api/strategies/:id?eoa=0x...
router.delete('/strategies/:id', async (req, res) => {
  const { id } = req.params;
  const eoa = (req.query.eoa as string | undefined)?.toLowerCase();

  if (!eoa) return res.status(400).json({ error: 'eoa query param required' });

  if (!DB_ENABLED || !supabase) {
    memForEoa(eoa).delete(id);
    return res.status(204).end();
  }

  const { error } = await supabase
    .from('strategies')
    .delete()
    .eq('id', id)
    .eq('eoa_address', eoa);  // ownership check

  if (error) return res.status(500).json({ error: error.message });
  res.status(204).end();
});

export default router;
