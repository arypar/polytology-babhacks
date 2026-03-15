import { Router } from 'express';
import { log } from '../lib/log.js';

const router = Router();

interface CustomDataSource {
  id: string;
  name: string;
  url: string;
  headers: Record<string, string>;
  valuePath: string;
  description: string;
  refreshMs: number;
}

const sources = new Map<string, CustomDataSource>();

// Cache of proxy-fetched values: sourceId → { value, fetchedAt }
const fetchCache = new Map<string, { value: unknown; fetchedAt: number }>();

/**
 * Walk a dot-notation path through an object.
 * Supports array indices: "results[0].price" or "results.0.price"
 */
function getByPath(obj: unknown, path: string): unknown {
  if (!path) return obj;
  const parts = path.replace(/\[(\d+)\]/g, '.$1').split('.').filter(Boolean);
  let cur: unknown = obj;
  for (const part of parts) {
    if (cur === null || cur === undefined) return undefined;
    cur = (cur as Record<string, unknown>)[part];
  }
  return cur;
}

router.get('/datasources', (_req, res) => {
  res.json([...sources.values()]);
});

router.post('/datasources', (req, res) => {
  const source = req.body as CustomDataSource;
  if (!source?.id || !source?.url || !source?.valuePath) {
    res.status(400).json({ error: 'Missing required fields: id, url, valuePath' });
    return;
  }
  source.headers = source.headers ?? {};
  source.refreshMs = source.refreshMs ?? 60_000;
  source.description = source.description ?? '';
  sources.set(source.id, source);
  log('datasources', `POST /datasources — "${source.name}" (id=${source.id.slice(0, 8)})`);
  res.json({ ok: true });
});

router.delete('/datasources/:id', (req, res) => {
  const { id } = req.params;
  if (!sources.has(id)) {
    res.status(404).json({ error: 'Data source not found' });
    return;
  }
  sources.delete(id);
  fetchCache.delete(id);
  log('datasources', `DELETE /datasources/${id.slice(0, 8)}`);
  res.json({ ok: true });
});

// One-off proxy fetch for previewing a URL before saving
router.post('/datasources/test', async (req, res) => {
  const { url, headers: extraHeaders } = req.body as {
    url?: string;
    headers?: Record<string, string>;
  };
  if (!url) {
    res.status(400).json({ error: 'Missing url' });
    return;
  }
  try {
    new URL(url);
  } catch {
    res.status(400).json({ error: 'Invalid URL' });
    return;
  }
  try {
    const response = await fetch(url, {
      headers: { Accept: 'application/json', ...(extraHeaders ?? {}) },
    });
    const text = await response.text();
    let data: unknown;
    try {
      data = JSON.parse(text);
    } catch {
      res.status(502).json({ error: 'Response is not valid JSON', raw: text.slice(0, 500) });
      return;
    }
    res.json({ ok: true, data, status: response.status });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(502).json({ error: `Fetch failed: ${msg}` });
  }
});

router.get('/datasources/:id/fetch', async (req, res) => {
  const { id } = req.params;
  const source = sources.get(id);
  if (!source) {
    res.status(404).json({ error: 'Data source not found' });
    return;
  }

  const cached = fetchCache.get(id);
  if (cached && Date.now() - cached.fetchedAt < source.refreshMs) {
    res.json({ value: cached.value, extractedAt: cached.fetchedAt, cached: true });
    return;
  }

  try {
    const response = await fetch(source.url, {
      headers: { 'Accept': 'application/json', ...source.headers },
    });
    if (!response.ok) {
      res.status(502).json({ error: `Upstream returned ${response.status}` });
      return;
    }
    const data = await response.json();
    const value = getByPath(data, source.valuePath);
    const entry = { value, fetchedAt: Date.now() };
    fetchCache.set(id, entry);
    log('datasources', `FETCH "${source.name}" → ${JSON.stringify(value)}`);
    res.json({ value, extractedAt: entry.fetchedAt, cached: false });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    log('datasources', `FETCH ERROR "${source.name}": ${msg}`);
    res.status(502).json({ error: `Failed to fetch: ${msg}` });
  }
});

export default router;
