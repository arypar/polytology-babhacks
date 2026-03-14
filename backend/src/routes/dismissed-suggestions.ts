import { Router } from 'express';

const router = Router();

const dismissed = new Set<string>();

router.get('/dismissed-suggestions', (_req, res) => {
  res.json([...dismissed]);
});

router.post('/dismissed-suggestions', (req, res) => {
  const { pool } = req.body;
  if (!pool || typeof pool !== 'string') {
    res.status(400).json({ error: 'Missing pool name' });
    return;
  }
  dismissed.add(pool);
  res.json({ ok: true });
});

export default router;
