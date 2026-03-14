import { Router } from 'express';
import { log } from '../lib/log.js';

const router = Router();

const rules = new Map<string, unknown>();

router.get('/rules', (_req, res) => {
  res.json([...rules.values()]);
});

router.post('/rules', (req, res) => {
  const rule = req.body;
  if (!rule?.id) { res.status(400).json({ error: 'Missing id' }); return; }
  rules.set(rule.id, rule);
  log('rules', `POST /rules — "${rule.name}" (id=${String(rule.id).slice(0, 8)})`);
  res.json({ ok: true });
});

router.patch('/rules/:id', (req, res) => {
  const { id } = req.params;
  const existing = rules.get(id);
  if (!existing) { res.status(404).json({ error: 'Rule not found' }); return; }
  const updated = { ...(existing as object), ...req.body };
  rules.set(id, updated);
  log('rules', `PATCH /rules/${id.slice(0, 8)}`);
  res.json({ ok: true });
});

router.delete('/rules/:id', (req, res) => {
  const { id } = req.params;
  rules.delete(id);
  log('rules', `DELETE /rules/${id.slice(0, 8)}`);
  res.json({ ok: true });
});

export default router;
