import { Router } from 'express';
import { supabase, DB_ENABLED } from '../lib/supabase.js';
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

// In-memory fallback when Supabase is not configured
const mem = new Map<string, CustomDataSource>();

// Cache of proxy-fetched values: sourceId → { value, fetchedAt }
const fetchCache = new Map<string, { value: unknown; fetchedAt: number }>();

function dbRowToSource(row: Record<string, unknown>): CustomDataSource {
  return {
    id:          row.id as string,
    name:        row.name as string,
    url:         row.url as string,
    headers:     (row.headers as Record<string, string>) ?? {},
    valuePath:   row.value_path as string,
    description: (row.description as string) ?? '',
    refreshMs:   (row.refresh_ms as number) ?? 60_000,
  };
}

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

router.get('/datasources', async (_req, res) => {
  if (!DB_ENABLED || !supabase) {
    return res.json([...mem.values()]);
  }

  const { data, error } = await supabase
    .from('data_sources')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) return res.status(500).json({ error: error.message });
  res.json((data ?? []).map(dbRowToSource));
});

router.post('/datasources', async (req, res) => {
  const source = req.body as CustomDataSource;
  if (!source?.id || !source?.url || !source?.valuePath) {
    res.status(400).json({ error: 'Missing required fields: id, url, valuePath' });
    return;
  }
  source.headers     = source.headers ?? {};
  source.refreshMs   = source.refreshMs ?? 60_000;
  source.description = source.description ?? '';

  if (!DB_ENABLED || !supabase) {
    mem.set(source.id, source);
    log('datasources', `POST /datasources (mem) — "${source.name}" (id=${source.id.slice(0, 8)})`);
    return res.json({ ok: true });
  }

  const { error } = await supabase.from('data_sources').upsert({
    id:          source.id,
    name:        source.name,
    url:         source.url,
    headers:     source.headers,
    value_path:  source.valuePath,
    description: source.description,
    refresh_ms:  source.refreshMs,
  }, { onConflict: 'id' });

  if (error) return res.status(500).json({ error: error.message });
  log('datasources', `POST /datasources — "${source.name}" (id=${source.id.slice(0, 8)})`);
  res.json({ ok: true });
});

router.delete('/datasources/:id', async (req, res) => {
  const { id } = req.params;

  if (!DB_ENABLED || !supabase) {
    if (!mem.has(id)) return res.status(404).json({ error: 'Data source not found' });
    mem.delete(id);
    fetchCache.delete(id);
    log('datasources', `DELETE /datasources/${id.slice(0, 8)} (mem)`);
    return res.json({ ok: true });
  }

  const { error } = await supabase.from('data_sources').delete().eq('id', id);
  if (error) return res.status(500).json({ error: error.message });
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

  // Resolve source from DB or memory
  let source: CustomDataSource | undefined;

  if (!DB_ENABLED || !supabase) {
    source = mem.get(id);
  } else {
    const { data } = await supabase.from('data_sources').select('*').eq('id', id).single();
    if (data) source = dbRowToSource(data as Record<string, unknown>);
  }

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
