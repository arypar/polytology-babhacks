import { Router } from 'express';
import { log } from '../lib/log.js';

const router = Router();

const charts = new Map<string, { id: string; title: string; config: unknown; chain: string; createdAt: number }>();

router.get('/charts', (req, res) => {
  const chain = req.query.chain as string | undefined;
  const result = [...charts.values()]
    .filter(c => !chain || c.chain === chain)
    .sort((a, b) => b.createdAt - a.createdAt);
  res.json(result);
});

router.post('/charts', (req, res) => {
  const { id, title, config } = req.body;
  if (!id) { res.status(400).json({ error: 'Missing id' }); return; }
  const chain = (req.body.config?.chain as string) ?? 'eth';
  charts.set(id, { id, title: title ?? 'Chart', config, chain, createdAt: Date.now() });
  log('charts', `Saved chart ${id}`);
  res.json({ ok: true });
});

router.patch('/charts/:id', (req, res) => {
  const { id } = req.params;
  const existing = charts.get(id);
  if (!existing) { res.status(404).json({ error: 'Chart not found' }); return; }
  charts.set(id, { ...existing, ...req.body });
  log('charts', `Updated chart ${id}`);
  res.json({ ok: true });
});

router.delete('/charts/:id', (req, res) => {
  const { id } = req.params;
  charts.delete(id);
  log('charts', `Deleted chart ${id}`);
  res.json({ ok: true });
});

export default router;
