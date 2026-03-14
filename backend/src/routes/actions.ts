import { Router } from 'express';
import { log } from '../lib/log.js';

const router = Router();

const actions = new Map<string, { id: string; status: string; timestamp: number; [key: string]: unknown }>();

router.get('/actions', (_req, res) => {
  const sorted = [...actions.values()].sort((a, b) => b.timestamp - a.timestamp);
  res.json(sorted);
});

router.post('/actions', (req, res) => {
  const action = req.body;
  if (!action?.id) { res.status(400).json({ error: 'Missing id' }); return; }
  actions.set(action.id, { ...action, timestamp: action.timestamp ?? Date.now() });
  res.status(201).json({ ok: true });
});

router.patch('/actions/:id', (req, res) => {
  const { id } = req.params;
  const existing = actions.get(id);
  if (!existing) { res.status(404).json({ error: 'Action not found' }); return; }
  actions.set(id, { ...existing, ...req.body });
  res.json({ ok: true });
});

router.delete('/actions', (_req, res) => {
  actions.clear();
  log('actions', 'Cleared all actions');
  res.json({ ok: true });
});

export default router;
