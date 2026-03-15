'use client';

import { useState, useEffect, useCallback } from 'react';
import type { CustomDataSource } from '@/lib/types';

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL ?? 'http://localhost:4000';
const LS_KEY = 'pm-datasources';

function loadCache(): CustomDataSource[] {
  try {
    const raw = localStorage.getItem(LS_KEY);
    return raw ? (JSON.parse(raw) as CustomDataSource[]) : [];
  } catch {
    return [];
  }
}

function saveCache(sources: CustomDataSource[]) {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(sources));
  } catch {}
}

export function useDataSources() {
  const [sources, setSources] = useState<CustomDataSource[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const cached = loadCache();
    if (cached.length > 0) setSources(cached);

    setLoading(true);
    fetch(`${BACKEND}/api/datasources`)
      .then(r => r.json())
      .then((data: CustomDataSource[]) => {
        setSources(data);
        saveCache(data);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const addSource = useCallback(async (source: Omit<CustomDataSource, 'id'>) => {
    const newSource: CustomDataSource = { ...source, id: crypto.randomUUID() };
    await fetch(`${BACKEND}/api/datasources`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newSource),
    });
    setSources(prev => {
      const updated = [...prev, newSource];
      saveCache(updated);
      return updated;
    });
    return newSource;
  }, []);

  const removeSource = useCallback(async (id: string) => {
    await fetch(`${BACKEND}/api/datasources/${id}`, { method: 'DELETE' });
    setSources(prev => {
      const updated = prev.filter(s => s.id !== id);
      saveCache(updated);
      return updated;
    });
  }, []);

  const fetchSourceValue = useCallback(async (id: string): Promise<{ value: unknown; error?: string }> => {
    try {
      const res = await fetch(`${BACKEND}/api/datasources/${id}/fetch`);
      const data = await res.json();
      if (!res.ok) return { value: undefined, error: data.error };
      return { value: data.value };
    } catch (err) {
      return { value: undefined, error: err instanceof Error ? err.message : 'Fetch failed' };
    }
  }, []);

  return { sources, loading, addSource, removeSource, fetchSourceValue };
}
