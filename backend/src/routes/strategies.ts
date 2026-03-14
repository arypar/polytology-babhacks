import { Router } from 'express';
import { supabase, DB_ENABLED } from '../lib/supabase.js';

const router = Router();

// In-memory fallback when Supabase is not configured
const mem = new Map<string, unknown>();

router.get('/strategies', async (_req, res) => {
  if (!DB_ENABLED || !supabase) {
    return res.json([...mem.values()]);
  }
  const { data, error } = await supabase
    .from('strategies')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) return res.status(500).json({ error: error.message });
  res.json(data ?? []);
});

router.post('/strategies', async (req, res) => {
  const strategy = req.body;
  if (!strategy?.id) return res.status(400).json({ error: 'Missing id' });

  if (!DB_ENABLED || !supabase) {
    mem.set(strategy.id, strategy);
    return res.status(201).json(strategy);
  }

  const { data, error } = await supabase
    .from('strategies')
    .upsert({
      id: strategy.id,
      name: strategy.name ?? 'Untitled',
      blocks: strategy.blocks ?? [],
      is_active: strategy.isActive ?? false,
      market_id: strategy.marketId ?? null,
      market_question: strategy.marketQuestion ?? null,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'id' })
    .select()
    .single();

  if (error) return res.status(500).json({ error: error.message });
  res.status(201).json(data);
});

router.patch('/strategies/:id', async (req, res) => {
  const { id } = req.params;

  if (!DB_ENABLED || !supabase) {
    const existing = mem.get(id);
    if (!existing) return res.status(404).json({ error: 'Not found' });
    const updated = { ...(existing as object), ...req.body };
    mem.set(id, updated);
    return res.json(updated);
  }

  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (req.body.name !== undefined)          updates.name = req.body.name;
  if (req.body.blocks !== undefined)        updates.blocks = req.body.blocks;
  if (req.body.isActive !== undefined)      updates.is_active = req.body.isActive;
  if (req.body.marketId !== undefined)      updates.market_id = req.body.marketId;
  if (req.body.marketQuestion !== undefined) updates.market_question = req.body.marketQuestion;

  const { data, error } = await supabase
    .from('strategies')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) return res.status(500).json({ error: error.message });
  if (!data) return res.status(404).json({ error: 'Not found' });
  res.json(data);
});

router.delete('/strategies/:id', async (req, res) => {
  const { id } = req.params;

  if (!DB_ENABLED || !supabase) {
    mem.delete(id);
    return res.status(204).end();
  }

  const { error } = await supabase.from('strategies').delete().eq('id', id);
  if (error) return res.status(500).json({ error: error.message });
  res.status(204).end();
});

export default router;
