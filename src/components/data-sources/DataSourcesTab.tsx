'use client';

import { useState, useEffect, useRef } from 'react';
import {
  Plus, Database, Trash2, Zap, X,
  Loader2, ChevronDown, ChevronUp, CheckCircle2, AlertCircle,
  ExternalLink, Search,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useDataSources } from '@/hooks/useDataSources';
import type { CustomDataSource } from '@/lib/types';

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL ?? 'http://localhost:4000';

// ── Input primitives ──────────────────────────────────────────
const inputCls =
  'w-full bg-white/[0.05] border border-white/[0.08] text-white/80 text-[13px] rounded-xl px-3.5 h-10 focus:outline-none focus:border-white/20 placeholder:text-white/20 transition-colors';
const labelCls = 'block text-[11px] font-medium text-white/40 mb-1.5';

// ── Empty state ───────────────────────────────────────────────
function EmptyState({ onAdd }: { onAdd: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-24 gap-5">
      <div className="h-16 w-16 rounded-2xl border border-white/[0.06] bg-white/[0.03] flex items-center justify-center">
        <Database className="h-7 w-7 text-white/20" />
      </div>
      <div className="text-center">
        <p className="text-[15px] font-semibold text-white/50">No data sources yet</p>
        <p className="text-[13px] text-white/25 mt-1 max-w-xs">
          Connect any external API and use its data as a condition in your rules
        </p>
      </div>
      <button
        onClick={onAdd}
        className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-[13px] font-semibold text-white transition-all hover:opacity-90"
        style={{ backgroundColor: '#2E5CFF', boxShadow: '0 0 20px rgba(46,92,255,0.25)' }}
      >
        <Plus className="h-4 w-4" />
        Add your first source
      </button>
    </div>
  );
}

// ── URL Preview pane ──────────────────────────────────────────
interface UrlPreviewProps {
  url: string;
  headers: { key: string; value: string }[];
  onSelectPath: (path: string) => void;
}

function UrlPreview({ url, headers, onSelectPath }: UrlPreviewProps) {
  const [state, setState] = useState<{
    status: 'idle' | 'loading' | 'ok' | 'error';
    data?: unknown;
    error?: string;
  }>({ status: 'idle' });
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Debounced auto-fetch whenever url changes
  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    if (!url.trim()) { setState({ status: 'idle' }); return; }
    try { new URL(url); } catch { setState({ status: 'idle' }); return; }

    setState({ status: 'loading' });
    timerRef.current = setTimeout(async () => {
      try {
        const headersMap: Record<string, string> = {};
        for (const h of headers) { if (h.key.trim()) headersMap[h.key.trim()] = h.value; }
        const res = await fetch(`${BACKEND}/api/datasources/test`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url, headers: headersMap }),
        });
        const body = await res.json();
        if (!res.ok || body.error) {
          setState({ status: 'error', error: body.error ?? `HTTP ${res.status}` });
        } else {
          setState({ status: 'ok', data: body.data });
        }
      } catch (e) {
        setState({ status: 'error', error: e instanceof Error ? e.message : 'Fetch failed' });
      }
    }, 700);

    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url]);

  if (state.status === 'idle') return null;

  return (
    <div className="mt-3 rounded-xl border border-white/[0.08] overflow-hidden">
      {/* Status bar */}
      <div className={cn(
        'flex items-center gap-2 px-3.5 py-2.5 border-b',
        state.status === 'loading' ? 'border-white/[0.06] bg-white/[0.02]' :
        state.status === 'ok'      ? 'border-emerald-500/15 bg-emerald-500/[0.05]' :
                                     'border-red-500/15 bg-red-500/[0.04]'
      )}>
        {state.status === 'loading' && <Loader2 className="h-3.5 w-3.5 animate-spin text-white/30" />}
        {state.status === 'ok'      && <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />}
        {state.status === 'error'   && <AlertCircle className="h-3.5 w-3.5 text-red-400" />}
        <span className={cn(
          'text-[11px] font-medium',
          state.status === 'loading' ? 'text-white/30' :
          state.status === 'ok'      ? 'text-emerald-400' : 'text-red-400'
        )}>
          {state.status === 'loading' ? 'Fetching response…' :
           state.status === 'ok'      ? 'Connected — click a value path to use it' :
                                        `Error: ${state.error}`}
        </span>
      </div>

      {/* JSON tree */}
      {state.status === 'ok' && state.data !== undefined && (
        <div className="p-3 max-h-52 overflow-y-auto">
          <JsonTree data={state.data} path="" onSelectPath={onSelectPath} />
        </div>
      )}
    </div>
  );
}

// ── Interactive JSON tree ─────────────────────────────────────
function JsonTree({
  data,
  path,
  onSelectPath,
  depth = 0,
}: {
  data: unknown;
  path: string;
  onSelectPath: (p: string) => void;
  depth?: number;
}) {
  if (data === null) return <span className="text-white/25 text-[11px] font-mono">null</span>;

  if (typeof data !== 'object') {
    const isLeaf = path !== '';
    return (
      <span
        className={cn(
          'font-mono text-[11px] rounded px-1',
          isLeaf
            ? 'cursor-pointer hover:bg-blue-500/20 text-blue-300/80 hover:text-blue-300 transition-colors'
            : 'text-white/50'
        )}
        onClick={isLeaf ? () => onSelectPath(path) : undefined}
        title={isLeaf ? `Use path: ${path}` : undefined}
      >
        {JSON.stringify(data)}
      </span>
    );
  }

  if (Array.isArray(data)) {
    return (
      <div className="space-y-0.5">
        {data.slice(0, 5).map((item, i) => {
          const childPath = path ? `${path}[${i}]` : `[${i}]`;
          return (
            <div key={i} className="flex gap-1.5 items-start" style={{ paddingLeft: depth * 12 }}>
              <span className="text-[10px] text-white/20 font-mono shrink-0 mt-0.5">[{i}]</span>
              <JsonTree data={item} path={childPath} onSelectPath={onSelectPath} depth={depth + 1} />
            </div>
          );
        })}
        {data.length > 5 && (
          <span className="text-[10px] text-white/20 font-mono" style={{ paddingLeft: (depth + 1) * 12 }}>
            …{data.length - 5} more
          </span>
        )}
      </div>
    );
  }

  const entries = Object.entries(data as Record<string, unknown>);
  return (
    <div className="space-y-0.5">
      {entries.map(([key, val]) => {
        const childPath = path ? `${path}.${key}` : key;
        const isLeaf = val !== null && typeof val !== 'object';
        return (
          <div key={key} className="flex gap-1.5 items-start flex-wrap" style={{ paddingLeft: depth * 12 }}>
            <span
              className={cn(
                'text-[11px] font-mono shrink-0 mt-0.5',
                isLeaf
                  ? 'text-indigo-300/60 cursor-pointer hover:text-indigo-300 transition-colors'
                  : 'text-white/35'
              )}
              onClick={isLeaf ? () => onSelectPath(childPath) : undefined}
              title={isLeaf ? `Use path: ${childPath}` : undefined}
            >
              {key}:
            </span>
            {isLeaf ? (
              <JsonTree data={val} path={childPath} onSelectPath={onSelectPath} depth={depth + 1} />
            ) : (
              <div className="w-full">
                <JsonTree data={val} path={childPath} onSelectPath={onSelectPath} depth={depth + 1} />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── Add Source Modal (centered) ───────────────────────────────
interface ModalProps {
  onSave: (source: Omit<CustomDataSource, 'id'>) => Promise<void>;
  onClose: () => void;
}

function AddSourceModal({ onSave, onClose }: ModalProps) {
  const [name, setName] = useState('');
  const [url, setUrl] = useState('');
  const [valuePath, setValuePath] = useState('');
  const [description, setDescription] = useState('');
  const refreshMs = 1_000;
  const [headers, setHeaders] = useState<{ key: string; value: string }[]>([]);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const addHeader = () => setHeaders(h => [...h, { key: '', value: '' }]);
  const removeHeader = (i: number) => setHeaders(h => h.filter((_, idx) => idx !== i));
  const updateHeader = (i: number, field: 'key' | 'value', val: string) =>
    setHeaders(h => h.map((row, idx) => (idx === i ? { ...row, [field]: val } : row)));

  const validate = () => {
    const e: Record<string, string> = {};
    if (!name.trim()) e.name = 'Required';
    if (!url.trim()) e.url = 'Required';
    else { try { new URL(url.trim()); } catch { e.url = 'Must be a valid URL'; } }
    if (!valuePath.trim()) e.valuePath = 'Required';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSave = async () => {
    if (!validate()) return;
    setSaving(true);
    const headersMap: Record<string, string> = {};
    for (const h of headers) { if (h.key.trim()) headersMap[h.key.trim()] = h.value; }
    await onSave({
      name: name.trim(), url: url.trim(), valuePath: valuePath.trim(),
      description: description.trim(), headers: headersMap, refreshMs,
    });
    setSaving(false);
    onClose();
  };


  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />

      {/* Dialog */}
      <div
        className="relative w-full max-w-2xl max-h-[90vh] flex flex-col rounded-2xl overflow-hidden shadow-2xl"
        style={{
          background: 'linear-gradient(160deg, rgba(14,14,26,0.99), rgba(8,8,18,0.99))',
          border: '1px solid rgba(255,255,255,0.08)',
          boxShadow: '0 0 80px rgba(0,0,0,0.8), 0 0 0 1px rgba(255,255,255,0.04)',
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/[0.06] shrink-0">
          <div>
            <h2 className="text-[15px] font-semibold text-white/90">Add Data Source</h2>
            <p className="text-[12px] text-white/30 mt-0.5">Connect an external API endpoint</p>
          </div>
          <button
            onClick={onClose}
            className="h-8 w-8 rounded-lg border border-white/[0.08] bg-white/[0.04] flex items-center justify-center text-white/40 hover:text-white/70 transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Scrollable body — two-column layout */}
        <div className="flex-1 overflow-y-auto">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-0 divide-x divide-white/[0.05]">

            {/* Left: form fields */}
            <div className="px-6 py-5 space-y-4">
              <div>
                <label className={labelCls}>
                  Source Name <span className="text-red-400/60">*</span>
                </label>
                <input
                  value={name}
                  onChange={e => setName(e.target.value)}
                  className={cn(inputCls, errors.name && 'border-red-500/40')}
                  placeholder="e.g. BTC/USD Price"
                />
                {errors.name && <p className="mt-1 text-[11px] text-red-400">{errors.name}</p>}
              </div>

              <div>
                <label className={labelCls}>
                  API URL <span className="text-red-400/60">*</span>
                </label>
                <input
                  value={url}
                  onChange={e => setUrl(e.target.value)}
                  className={cn(inputCls, errors.url && 'border-red-500/40')}
                  placeholder="https://api.example.com/data"
                />
                {errors.url && <p className="mt-1 text-[11px] text-red-400">{errors.url}</p>}
              </div>

              <div>
                <label className={labelCls}>
                  Value Path <span className="text-red-400/60">*</span>
                </label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-white/20 pointer-events-none" />
                  <input
                    value={valuePath}
                    onChange={e => setValuePath(e.target.value)}
                    className={cn(inputCls, 'font-mono text-[12px] pl-8', errors.valuePath && 'border-red-500/40')}
                    placeholder="bitcoin.usd"
                  />
                </div>
                {errors.valuePath
                  ? <p className="mt-1 text-[11px] text-red-400">{errors.valuePath}</p>
                  : <p className="mt-1.5 text-[10px] text-white/20">Click any value in the preview →</p>
                }
              </div>

              <div>
                <label className={labelCls}>Description <span className="text-white/20">(optional)</span></label>
                <input
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  className={inputCls}
                  placeholder="What does this metric represent?"
                />
              </div>

              {/* Headers */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className={labelCls + ' mb-0'}>Headers <span className="text-white/20">(optional)</span></label>
                  <button onClick={addHeader} className="flex items-center gap-1 text-[10px] text-white/25 hover:text-blue-400 transition-colors">
                    <Plus className="h-3 w-3" /> Add
                  </button>
                </div>
                {headers.length === 0 && (
                  <p className="text-[10px] text-white/20">Use for Authorization, API keys, etc.</p>
                )}
                <div className="space-y-1.5 mt-1">
                  {headers.map((h, i) => (
                    <div key={i} className="flex gap-1.5">
                      <input value={h.key} onChange={e => updateHeader(i, 'key', e.target.value)}
                        className={cn(inputCls, 'flex-1 h-8 text-[11px]')} placeholder="Key" />
                      <input value={h.value} onChange={e => updateHeader(i, 'value', e.target.value)}
                        className={cn(inputCls, 'flex-1 h-8 text-[11px]')} placeholder="Value" />
                      <button onClick={() => removeHeader(i)}
                        className="h-8 w-8 flex items-center justify-center rounded-xl border border-white/[0.06] text-white/20 hover:text-red-400 hover:border-red-500/20 transition-colors shrink-0">
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Right: URL preview */}
            <div className="px-6 py-5">
              <p className="text-[11px] font-medium text-white/40 mb-2">API Response Preview</p>
              {url.trim() === '' ? (
                <div className="flex flex-col items-center justify-center h-40 gap-2 rounded-xl border border-dashed border-white/[0.06]">
                  <ExternalLink className="h-5 w-5 text-white/10" />
                  <p className="text-[11px] text-white/20 text-center">
                    Enter an API URL to see a live preview of its response
                  </p>
                </div>
              ) : (
                <UrlPreview
                  url={url}
                  headers={headers}
                  onSelectPath={path => setValuePath(path)}
                />
              )}
              {valuePath && (
                <div className="mt-3 px-3 py-2 rounded-lg border border-blue-500/20 bg-blue-500/[0.06] flex items-center gap-2">
                  <Search className="h-3 w-3 text-blue-400/60 shrink-0" />
                  <span className="text-[11px] font-mono text-blue-300/80 truncate">{valuePath}</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-white/[0.06] flex gap-3 shrink-0">
          <button onClick={onClose}
            className="flex-1 h-10 rounded-xl border border-white/[0.08] text-[13px] font-medium text-white/40 hover:text-white/60 transition-colors">
            Cancel
          </button>
          <button onClick={handleSave} disabled={saving}
            className="flex-1 h-10 rounded-xl text-[13px] font-semibold text-white flex items-center justify-center gap-2 transition-all hover:opacity-90 disabled:opacity-50"
            style={{ backgroundColor: '#2E5CFF', boxShadow: '0 0 16px rgba(46,92,255,0.2)' }}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            {saving ? 'Saving…' : 'Save Source'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Source card ───────────────────────────────────────────────
interface SourceCardProps {
  source: CustomDataSource;
  onRemove: () => void;
  fetchValue: (id: string) => Promise<{ value: unknown; error?: string }>;
}

function SourceCard({ source, onRemove, fetchValue }: SourceCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [testState, setTestState] = useState<{
    loading: boolean;
    value?: unknown;
    error?: string;
    tested: boolean;
  }>({ loading: false, tested: false });

  const handleTest = async () => {
    setTestState({ loading: true, tested: false });
    const result = await fetchValue(source.id);
    setTestState({ loading: false, tested: true, ...result });
  };


  return (
    <div
      className="rounded-2xl border border-white/[0.06] overflow-hidden transition-all"
      style={{ background: 'linear-gradient(160deg, rgba(255,255,255,0.025), rgba(255,255,255,0.01))' }}
    >
      <div className="flex items-start gap-4 p-5">
        <div className="h-10 w-10 rounded-xl border border-white/[0.08] bg-white/[0.04] flex items-center justify-center shrink-0">
          <Database style={{ height: 18, width: 18 }} className="text-white/30" />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-start gap-3">
            <div className="flex-1 min-w-0">
              <h3 className="text-[14px] font-semibold text-white/85 truncate">{source.name}</h3>
              {source.description && (
                <p className="text-[12px] text-white/35 mt-0.5 line-clamp-1">{source.description}</p>
              )}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-2.5">
            <div className="flex items-center gap-1.5 min-w-0">
              <ExternalLink className="h-3 w-3 text-white/20 shrink-0" />
              <span className="text-[11px] text-white/30 font-mono truncate max-w-[280px]">{source.url}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] text-white/20">→</span>
              <span className="text-[11px] font-mono text-blue-400/60 bg-blue-500/[0.06] border border-blue-500/10 rounded-md px-1.5 py-0.5">
                {source.valuePath}
              </span>
            </div>
          </div>

          {Object.keys(source.headers ?? {}).length > 0 && (
            <div className="mt-2">
              <span className="text-[10px] text-white/20 border border-white/[0.06] rounded px-1.5 py-0.5">
                {Object.keys(source.headers).length} header{Object.keys(source.headers).length > 1 ? 's' : ''}
              </span>
            </div>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2 px-5 pb-4">
        <button
          onClick={handleTest}
          disabled={testState.loading}
          className={cn(
            'flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-[12px] font-medium border transition-all',
            testState.tested && !testState.error
              ? 'border-emerald-500/30 bg-emerald-500/[0.08] text-emerald-400'
              : testState.tested && testState.error
                ? 'border-red-500/30 bg-red-500/[0.06] text-red-400'
                : 'border-white/[0.08] bg-white/[0.03] text-white/40 hover:text-white/60'
          )}
        >
          {testState.loading ? <Loader2 className="h-3 w-3 animate-spin" />
            : testState.tested && !testState.error ? <CheckCircle2 className="h-3 w-3" />
            : testState.tested && testState.error ? <AlertCircle className="h-3 w-3" />
            : <Zap className="h-3 w-3" />}
          Test connection
        </button>

        {testState.tested && (
          <button
            onClick={() => setExpanded(v => !v)}
            className="flex items-center gap-1 text-[11px] text-white/25 hover:text-white/45 transition-colors"
          >
            {expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
            {testState.error ? 'Error details' : 'View result'}
          </button>
        )}

        <div className="flex-1" />

        <button
          onClick={onRemove}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-medium border border-white/[0.06] text-white/25 hover:text-red-400 hover:border-red-500/20 hover:bg-red-500/[0.04] transition-all"
        >
          <Trash2 className="h-3 w-3" />
          Remove
        </button>
      </div>

      {expanded && testState.tested && (
        <div className={cn(
          'mx-5 mb-4 rounded-xl px-4 py-3 border text-[12px] font-mono whitespace-pre-wrap break-all',
          testState.error
            ? 'border-red-500/20 bg-red-500/[0.05] text-red-400'
            : 'border-emerald-500/15 bg-emerald-500/[0.04] text-emerald-300/80'
        )}>
          {testState.error ? `Error: ${testState.error}` : JSON.stringify(testState.value, null, 2)}
        </div>
      )}
    </div>
  );
}

// ── DataSourcesTab ────────────────────────────────────────────
export function DataSourcesTab() {
  const { sources, loading, addSource, removeSource, fetchSourceValue } = useDataSources();
  const [showModal, setShowModal] = useState(false);

  return (
    <div className="max-w-3xl mx-auto py-6 px-1">
      <div className="flex items-center justify-between mb-7">
        <div>
          <h1 className="text-[20px] font-semibold text-white/90">Data Sources</h1>
          <p className="text-[13px] text-white/35 mt-1">
            Connect external APIs and use their values as conditions in your rules
          </p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-[13px] font-semibold text-white transition-all hover:opacity-90 shrink-0"
          style={{ backgroundColor: '#2E5CFF', boxShadow: '0 0 16px rgba(46,92,255,0.2)' }}
        >
          <Plus className="h-4 w-4" />
          Add source
        </button>
      </div>

      {loading && sources.length === 0 ? (
        <div className="flex items-center justify-center py-24 gap-2 text-white/25">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span className="text-[13px]">Loading…</span>
        </div>
      ) : sources.length === 0 ? (
        <EmptyState onAdd={() => setShowModal(true)} />
      ) : (
        <div className="space-y-3">
          {sources.map(source => (
            <SourceCard
              key={source.id}
              source={source}
              onRemove={() => removeSource(source.id)}
              fetchValue={fetchSourceValue}
            />
          ))}
        </div>
      )}

      {sources.length > 0 && (
        <div className="mt-6 rounded-xl border border-white/[0.05] bg-white/[0.02] px-4 py-3">
          <span className="text-[11px] text-white/20 leading-relaxed">
            These sources appear in the <span className="text-white/35 font-medium">Builder → Conditions</span> palette under "Custom". Drag them onto the canvas and set a comparison operator and threshold.
          </span>
        </div>
      )}

      {showModal && (
        <AddSourceModal
          onSave={async s => { await addSource(s); }}
          onClose={() => setShowModal(false)}
        />
      )}
    </div>
  );
}
