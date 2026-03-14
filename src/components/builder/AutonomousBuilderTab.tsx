'use client';

import { useState, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  useSensor,
  useSensors,
  useDroppable,
} from '@dnd-kit/core';
import { useDraggable } from '@dnd-kit/core';
import {
  Plus, Trash2, Play, Pause, X, Settings2, Zap, ArrowRight,
  TrendingUp, Target, Flame, AlarmClock, Clock, GitMerge, GitFork,
  ShieldCheck, Lock, CalendarDays, ArrowUpCircle, ArrowDownCircle,
  Wallet, ClipboardList, Bell,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { AutonomousStrategy, StrategyBlock } from '@/lib/types';
import {
  BLOCK_DEFINITIONS,
  TRIGGER_BLOCKS,
  CONDITION_BLOCKS,
  ACTION_BLOCKS,
  createBlock,
  type BlockDefinition,
} from './block-types';

const LUCIDE_ICONS: Record<string, React.ElementType> = {
  TrendingUp, Target, Flame, AlarmClock, Clock, GitMerge, GitFork,
  ShieldCheck, Lock, CalendarDays, ArrowUpCircle, ArrowDownCircle,
  Wallet, ClipboardList, Bell,
};

function ColoredPaletteBlock({ def }: { def: BlockDefinition }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `palette-${def.type}`,
    data: { fromPalette: true, def },
  });
  const Icon = LUCIDE_ICONS[def.icon] ?? Zap;

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      className="flex items-center gap-2.5 rounded cursor-grab active:cursor-grabbing select-none transition-all duration-150"
      style={{
        opacity: isDragging ? 0.3 : 1,
        border: '1px solid var(--border)',
        backgroundColor: 'var(--bg-card)',
        padding: '8px 10px',
      }}
      onMouseEnter={e => {
        e.currentTarget.style.backgroundColor = 'var(--bg-elevated)';
        e.currentTarget.style.borderColor = 'var(--border-strong)';
      }}
      onMouseLeave={e => {
        e.currentTarget.style.backgroundColor = 'var(--bg-card)';
        e.currentTarget.style.borderColor = 'var(--border)';
      }}
    >
      <Icon className="h-3.5 w-3.5 shrink-0" style={{ color: def.color }} />
      <div className="min-w-0">
        <p className="text-[12px] font-medium" style={{ color: 'var(--text)' }}>{def.label}</p>
        <p className="text-[10px] truncate" style={{ color: 'var(--text-tertiary)' }}>{def.description}</p>
      </div>
    </div>
  );
}

function CanvasBlock({
  block,
  selected,
  onSelect,
  onRemove,
}: {
  block: StrategyBlock;
  selected: boolean;
  onSelect: () => void;
  onRemove: () => void;
}) {
  const def = BLOCK_DEFINITIONS.find(d => d.type === block.type);
  const color = def?.color ?? '#8b5cf6';
  const Icon = LUCIDE_ICONS[def?.icon ?? ''] ?? Zap;

  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: block.id,
    data: { fromCanvas: true, block },
  });

  const categoryLabels: Record<string, string> = {
    trigger: 'TRIGGER',
    condition: 'CONDITION',
    action: 'ACTION',
  };

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      onClick={onSelect}
      className="w-[180px] rounded-md cursor-grab active:cursor-grabbing select-none transition-all duration-150"
      style={{
        position: 'absolute',
        left: block.position.x,
        top: block.position.y,
        opacity: isDragging ? 0.3 : 1,
        backgroundColor: 'var(--bg-card)',
        border: selected
          ? '1px solid var(--accent)'
          : '1px solid var(--border)',
        boxShadow: selected ? '0 0 0 2px var(--accent-subtle)' : '0 1px 3px rgba(0,0,0,0.06)',
        borderLeft: `3px solid ${color}`,
      }}
    >
      <div
        className="px-2.5 py-1.5 flex items-center justify-between"
        style={{ borderBottom: '1px solid var(--border)' }}
      >
        <span
          className="font-mono text-[9px] font-bold tracking-widest uppercase"
          style={{ color }}
        >
          {categoryLabels[block.category]}
        </span>
        <button
          onClick={e => { e.stopPropagation(); onRemove(); }}
          className="flex h-4 w-4 items-center justify-center rounded transition-colors"
          style={{ color: 'var(--text-tertiary)' }}
          onMouseEnter={e => (e.currentTarget.style.color = '#dc2626')}
          onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-tertiary)')}
        >
          <X className="h-2.5 w-2.5" />
        </button>
      </div>
      <div className="px-2.5 py-2">
        <div className="flex items-center gap-2">
          <Icon className="h-3.5 w-3.5 shrink-0" style={{ color }} />
          <span className="text-[12px] font-semibold" style={{ color: 'var(--text)' }}>{block.label}</span>
        </div>
        {Object.keys(block.params).length > 0 && (
          <div className="mt-1.5 space-y-0.5">
            {Object.entries(block.params).slice(0, 2).map(([k, v]) => (
              <div key={k} className="text-[10px] flex items-center justify-between">
                <span style={{ color: 'var(--text-tertiary)' }} className="capitalize">{k.replace(/_/g, ' ')}</span>
                <span className="font-medium" style={{ color: 'var(--text-secondary)' }}>{String(v)}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function CanvasDropZone({
  blocks,
  selectedBlockId,
  onSelectBlock,
  onRemoveBlock,
  isEmpty,
}: {
  blocks: StrategyBlock[];
  selectedBlockId: string | null;
  onSelectBlock: (id: string) => void;
  onRemoveBlock: (id: string) => void;
  isEmpty: boolean;
}) {
  const { isOver, setNodeRef } = useDroppable({ id: 'canvas' });

  return (
    <div
      ref={setNodeRef}
      className="relative w-full h-full min-h-[500px] rounded-md overflow-hidden transition-colors"
      style={{
        border: isOver
          ? '2px dashed var(--accent)'
          : '2px dashed var(--border-strong)',
        backgroundColor: isOver ? 'var(--accent-subtle)' : 'var(--bg-elevated)',
      }}
    >
      {/* Light dot grid */}
      <svg className="absolute inset-0 w-full h-full pointer-events-none" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <pattern id="lightgrid" width="24" height="24" patternUnits="userSpaceOnUse">
            <circle cx="1" cy="1" r="0.7" fill="rgba(0,0,0,0.07)" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#lightgrid)" />
      </svg>

      {isEmpty && (
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <div
            className="flex h-10 w-10 items-center justify-center rounded-md mb-4"
            style={{ border: '1px solid var(--border)', backgroundColor: 'var(--bg-card)' }}
          >
            <Zap className="h-5 w-5" style={{ color: 'var(--text-tertiary)' }} />
          </div>
          <p className="text-[13px] font-medium" style={{ color: 'var(--text-tertiary)' }}>
            Drag blocks here to build your strategy
          </p>
          <p className="text-[11px] mt-1" style={{ color: 'var(--text-tertiary)', opacity: 0.6 }}>
            Start with a Trigger, add Conditions, then Actions
          </p>
        </div>
      )}

      {blocks.map(block => (
        <CanvasBlock
          key={block.id}
          block={block}
          selected={selectedBlockId === block.id}
          onSelect={() => onSelectBlock(block.id)}
          onRemove={() => onRemoveBlock(block.id)}
        />
      ))}
    </div>
  );
}

function BlockConfigPanel({
  block,
  onUpdate,
  onClose,
}: {
  block: StrategyBlock;
  onUpdate: (params: Record<string, string | number | boolean>) => void;
  onClose: () => void;
}) {
  const def = BLOCK_DEFINITIONS.find(d => d.type === block.type);
  if (!def) return null;
  const Icon = LUCIDE_ICONS[def.icon] ?? Zap;

  return (
    <div
      className="rounded-md p-4"
      style={{
        backgroundColor: 'var(--bg-card)',
        border: '1px solid var(--border)',
      }}
    >
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Icon className="h-4 w-4" style={{ color: def.color }} />
          <div>
            <p className="text-[13px] font-semibold" style={{ color: 'var(--text)' }}>{def.label}</p>
            <p className="text-[11px]" style={{ color: 'var(--text-tertiary)' }}>{def.description}</p>
          </div>
        </div>
        <button
          onClick={onClose}
          className="transition-colors"
          style={{ color: 'var(--text-tertiary)' }}
          onMouseEnter={e => (e.currentTarget.style.color = 'var(--text)')}
          onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-tertiary)')}
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {def.paramSchema.length === 0 ? (
        <p className="text-[12px] text-center py-3" style={{ color: 'var(--text-tertiary)' }}>
          No configuration needed
        </p>
      ) : (
        <div className="space-y-3">
          {def.paramSchema.map(param => (
            <div key={param.key}>
              <label
                className="block text-xs font-medium mb-1"
                style={{ color: 'var(--text-secondary)' }}
              >
                {param.label}
              </label>
              {param.type === 'select' ? (
                <select
                  value={String(block.params[param.key] ?? '')}
                  onChange={e => onUpdate({ ...block.params, [param.key]: e.target.value })}
                  className="w-full rounded px-3 py-2 text-sm focus:outline-none transition-colors"
                  style={{
                    backgroundColor: 'var(--bg)',
                    border: '1px solid var(--border)',
                    color: 'var(--text)',
                  }}
                  onFocus={e => (e.currentTarget.style.borderColor = 'var(--accent)')}
                  onBlur={e => (e.currentTarget.style.borderColor = 'var(--border)')}
                >
                  {param.options?.map(opt => (
                    <option key={opt} value={opt}>{opt}</option>
                  ))}
                </select>
              ) : param.type === 'boolean' ? (
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={Boolean(block.params[param.key])}
                    onChange={e => onUpdate({ ...block.params, [param.key]: e.target.checked })}
                    className="h-4 w-4 rounded"
                    style={{ accentColor: 'var(--accent)' }}
                  />
                  <span className="text-[12px]" style={{ color: 'var(--text-secondary)' }}>Enabled</span>
                </label>
              ) : (
                <input
                  type={param.type === 'number' ? 'number' : 'text'}
                  value={String(block.params[param.key] ?? '')}
                  min={param.min}
                  max={param.max}
                  step={param.step}
                  placeholder={param.placeholder}
                  onChange={e => onUpdate({
                    ...block.params,
                    [param.key]: param.type === 'number' ? parseFloat(e.target.value) : e.target.value,
                  })}
                  className="w-full rounded px-3 py-2 text-sm focus:outline-none transition-colors"
                  style={{
                    backgroundColor: 'var(--bg)',
                    border: '1px solid var(--border)',
                    color: 'var(--text)',
                  }}
                  onFocus={e => (e.currentTarget.style.borderColor = 'var(--accent)')}
                  onBlur={e => (e.currentTarget.style.borderColor = 'var(--border)')}
                />
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function StrategyListItem({
  strategy,
  isActive,
  onSelect,
  onToggle,
  onDelete,
}: {
  strategy: AutonomousStrategy;
  isActive: boolean;
  onSelect: () => void;
  onToggle: () => void;
  onDelete: () => void;
}) {
  const blockCount = strategy.blocks.length;
  const triggerCount = strategy.blocks.filter(b => b.category === 'trigger').length;
  const actionCount = strategy.blocks.filter(b => b.category === 'action').length;

  return (
    <div
      className="group rounded cursor-pointer transition-all duration-150 p-3"
      style={{
        border: isActive ? '1px solid var(--accent)' : '1px solid var(--border)',
        backgroundColor: isActive ? 'var(--accent-subtle)' : 'var(--bg-card)',
      }}
      onClick={onSelect}
      onMouseEnter={e => {
        if (!isActive) {
          e.currentTarget.style.backgroundColor = 'var(--bg-elevated)';
          e.currentTarget.style.borderColor = 'var(--border-strong)';
        }
      }}
      onMouseLeave={e => {
        if (!isActive) {
          e.currentTarget.style.backgroundColor = 'var(--bg-card)';
          e.currentTarget.style.borderColor = 'var(--border)';
        }
      }}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="text-[13px] font-medium truncate" style={{ color: 'var(--text)' }}>
            {strategy.name}
          </p>
          <p className="text-[11px] mt-0.5" style={{ color: 'var(--text-tertiary)' }}>
            {blockCount} block{blockCount !== 1 ? 's' : ''} · {triggerCount}T · {actionCount}A
          </p>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <button
            onClick={e => { e.stopPropagation(); onToggle(); }}
            className="flex h-5 w-9 rounded-full border transition-colors"
            style={strategy.enabled
              ? { borderColor: '#16a34a60', backgroundColor: '#16a34a18' }
              : { borderColor: 'var(--border)', backgroundColor: 'transparent' }
            }
          >
            <span
              className="my-auto h-3 w-3 rounded-full transition-all mx-0.5"
              style={{
                backgroundColor: strategy.enabled ? '#16a34a' : 'var(--text-tertiary)',
                marginLeft: strategy.enabled ? 'auto' : '2px',
                marginRight: strategy.enabled ? '2px' : 'auto',
              }}
            />
          </button>
          <button
            onClick={e => { e.stopPropagation(); onDelete(); }}
            className="transition-colors"
            style={{ color: 'var(--text-tertiary)' }}
            onMouseEnter={e => (e.currentTarget.style.color = '#dc2626')}
            onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-tertiary)')}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}

interface AutonomousBuilderTabProps {
  strategies: AutonomousStrategy[];
  onAddStrategy: (s: AutonomousStrategy) => void;
  onUpdateStrategy: (id: string, updates: Partial<AutonomousStrategy>) => void;
  onRemoveStrategy: (id: string) => void;
}

export function AutonomousBuilderTab({
  strategies,
  onAddStrategy,
  onUpdateStrategy,
  onRemoveStrategy,
}: AutonomousBuilderTabProps) {
  const [activeStrategyId, setActiveStrategyId] = useState<string | null>(
    strategies[0]?.id ?? null
  );
  const [selectedBlockId, setSelectedBlockId] = useState<string | null>(null);
  const [draggingDef, setDraggingDef] = useState<BlockDefinition | null>(null);
  const [activePaletteCategory, setActivePaletteCategory] = useState<'trigger' | 'condition' | 'action'>('trigger');
  const dropPositionRef = useRef({ x: 200, y: 150 });

  const activeStrategy = strategies.find(s => s.id === activeStrategyId) ?? null;
  const selectedBlock = activeStrategy?.blocks.find(b => b.id === selectedBlockId) ?? null;

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } })
  );

  const handleDragStart = useCallback((event: DragStartEvent) => {
    const { data } = event.active;
    if (data.current?.fromPalette) {
      setDraggingDef(data.current.def);
    }
  }, []);

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    setDraggingDef(null);
    const { active, over } = event;
    if (!over || over.id !== 'canvas') return;
    if (!activeStrategy) return;

    const data = active.data.current;

    if (data?.fromPalette) {
      const def: BlockDefinition = data.def;
      const canvasEl = document.getElementById('canvas-drop');
      const rect = canvasEl?.getBoundingClientRect();
      const x = rect ? Math.max(10, dropPositionRef.current.x - rect.left - 90) : 200;
      const y = rect ? Math.max(10, dropPositionRef.current.y - rect.top - 50) : 150;
      const newBlock = createBlock(def, { x: Math.max(10, x), y: Math.max(10, y) });
      const blocks = [...activeStrategy.blocks, newBlock];
      onUpdateStrategy(activeStrategy.id, { blocks });
    } else if (data?.fromCanvas) {
      const block: StrategyBlock = data.block;
      const newX = Math.max(10, block.position.x + (event.delta?.x ?? 0));
      const newY = Math.max(10, block.position.y + (event.delta?.y ?? 0));
      const blocks = activeStrategy.blocks.map(b =>
        b.id === block.id ? { ...b, position: { x: newX, y: newY } } : b
      );
      onUpdateStrategy(activeStrategy.id, { blocks });
    }
  }, [activeStrategy, onUpdateStrategy]);

  const handleCreateStrategy = useCallback(() => {
    const strategy: AutonomousStrategy = {
      id: crypto.randomUUID(),
      name: `Strategy ${strategies.length + 1}`,
      blocks: [],
      enabled: false,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    onAddStrategy(strategy);
    setActiveStrategyId(strategy.id);
    setSelectedBlockId(null);
  }, [strategies.length, onAddStrategy]);

  const paletteBlocks = {
    trigger: TRIGGER_BLOCKS,
    condition: CONDITION_BLOCKS,
    action: ACTION_BLOCKS,
  }[activePaletteCategory];

  const paletteCategoryStyle = (cat: 'trigger' | 'condition' | 'action') => {
    const colors = {
      trigger: 'var(--accent)',
      condition: '#8b5cf6',
      action: '#16a34a',
    };
    const c = colors[cat];
    if (activePaletteCategory === cat) {
      return {
        backgroundColor: `${c}14`,
        color: c,
        border: `1px solid ${c}40`,
      };
    }
    return {
      backgroundColor: 'transparent',
      color: 'var(--text-tertiary)',
      border: '1px solid var(--border)',
    };
  };

  return (
    <DndContext
      sensors={sensors}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div
        className="flex gap-4 h-[calc(100vh-9rem)]"
        onMouseMove={e => { dropPositionRef.current = { x: e.clientX, y: e.clientY }; }}
      >
        {/* Left: Strategy list + palette */}
        <div className="w-[220px] shrink-0 flex flex-col gap-4 overflow-y-auto">
          {/* Strategy list */}
          <div>
            <div
              className="flex items-center justify-between pb-2.5 mb-3"
              style={{ borderBottom: '1px solid var(--border)' }}
            >
              <span className="text-[13px] font-semibold" style={{ color: 'var(--text)' }}>Strategies</span>
              <button
                onClick={handleCreateStrategy}
                className="flex items-center gap-1 text-[12px] font-medium transition-colors"
                style={{ color: 'var(--accent)' }}
                onMouseEnter={e => (e.currentTarget.style.opacity = '0.75')}
                onMouseLeave={e => (e.currentTarget.style.opacity = '1')}
              >
                <Plus className="h-3 w-3" />
                New
              </button>
            </div>
            {strategies.length === 0 ? (
              <button
                onClick={handleCreateStrategy}
                className="w-full rounded p-4 text-center text-[12px] transition-colors"
                style={{
                  border: '1px dashed var(--border-strong)',
                  color: 'var(--text-tertiary)',
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.borderColor = 'var(--accent)';
                  e.currentTarget.style.color = 'var(--accent)';
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.borderColor = 'var(--border-strong)';
                  e.currentTarget.style.color = 'var(--text-tertiary)';
                }}
              >
                + Create first strategy
              </button>
            ) : (
              <div className="space-y-1.5">
                {strategies.map(s => (
                  <StrategyListItem
                    key={s.id}
                    strategy={s}
                    isActive={s.id === activeStrategyId}
                    onSelect={() => { setActiveStrategyId(s.id); setSelectedBlockId(null); }}
                    onToggle={() => onUpdateStrategy(s.id, { enabled: !s.enabled })}
                    onDelete={() => {
                      onRemoveStrategy(s.id);
                      if (activeStrategyId === s.id) {
                        setActiveStrategyId(strategies.filter(x => x.id !== s.id)[0]?.id ?? null);
                      }
                    }}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Block palette */}
          {activeStrategy && (
            <div className="flex-1 min-h-0">
              <div
                className="pb-2.5 mb-3"
                style={{ borderBottom: '1px solid var(--border)' }}
              >
                <p
                  className="font-mono text-[10px] font-semibold tracking-widest uppercase"
                  style={{ color: 'var(--text-tertiary)', opacity: 0.7 }}
                >
                  Block Palette
                </p>
              </div>
              <div className="flex gap-1 mb-3">
                {(['trigger', 'condition', 'action'] as const).map(cat => (
                  <button
                    key={cat}
                    onClick={() => setActivePaletteCategory(cat)}
                    className="flex-1 py-1 rounded text-[10px] font-semibold uppercase tracking-wide transition-all"
                    style={paletteCategoryStyle(cat)}
                  >
                    {cat}
                  </button>
                ))}
              </div>
              <div className="space-y-1.5">
                {paletteBlocks.map(def => (
                  <ColoredPaletteBlock key={def.type} def={def} />
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Center: Canvas */}
        <div className="flex-1 min-w-0 flex flex-col gap-3">
          {activeStrategy ? (
            <>
              {/* Strategy header */}
              <div className="flex items-center gap-3">
                <input
                  value={activeStrategy.name}
                  onChange={e => onUpdateStrategy(activeStrategy.id, { name: e.target.value })}
                  className="text-[16px] font-semibold bg-transparent focus:outline-none transition-colors px-1 py-0.5 min-w-0 flex-1 rounded"
                  style={{
                    color: 'var(--text)',
                    borderBottom: '1px solid var(--border)',
                  }}
                  onFocus={e => (e.currentTarget.style.borderBottomColor = 'var(--accent)')}
                  onBlur={e => (e.currentTarget.style.borderBottomColor = 'var(--border)')}
                />
                <div className="flex items-center gap-2 shrink-0">
                  <span
                    className="px-2.5 py-1 rounded text-[11px] font-semibold border"
                    style={activeStrategy.enabled
                      ? { color: '#16a34a', borderColor: '#16a34a40', backgroundColor: '#16a34a0d' }
                      : { color: 'var(--text-tertiary)', borderColor: 'var(--border)', backgroundColor: 'transparent' }
                    }
                  >
                    {activeStrategy.enabled ? '● ACTIVE' : '○ INACTIVE'}
                  </span>
                  <button
                    onClick={() => onUpdateStrategy(activeStrategy.id, { enabled: !activeStrategy.enabled })}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded text-[12px] font-medium transition-colors"
                    style={activeStrategy.enabled
                      ? { border: '1px solid var(--border)', color: 'var(--text-secondary)', backgroundColor: 'var(--bg-elevated)' }
                      : { border: '1px solid #16a34a40', color: '#16a34a', backgroundColor: '#16a34a0d' }
                    }
                  >
                    {activeStrategy.enabled ? <Pause className="h-3 w-3" /> : <Play className="h-3 w-3" />}
                    {activeStrategy.enabled ? 'Pause' : 'Activate'}
                  </button>
                </div>
              </div>

              {/* Flow hint */}
              {activeStrategy.blocks.length < 3 && (
                <div className="flex items-center gap-2 text-[11px]" style={{ color: 'var(--text-tertiary)' }}>
                  <div
                    className="px-2 py-1 rounded text-[10px] font-medium"
                    style={{ border: '1px solid var(--accent)', color: 'var(--accent)', opacity: 0.6 }}
                  >
                    Trigger
                  </div>
                  <ArrowRight className="h-3 w-3" />
                  <div
                    className="px-2 py-1 rounded text-[10px] font-medium"
                    style={{ border: '1px solid rgba(139,92,246,0.3)', color: '#8b5cf6', opacity: 0.6 }}
                  >
                    Condition
                  </div>
                  <ArrowRight className="h-3 w-3" />
                  <div
                    className="px-2 py-1 rounded text-[10px] font-medium"
                    style={{ border: '1px solid rgba(22,163,74,0.3)', color: '#16a34a', opacity: 0.6 }}
                  >
                    Action
                  </div>
                  <span className="ml-2 opacity-60">← Drag blocks to build your flow</span>
                </div>
              )}

              <div id="canvas-drop" className="flex-1">
                <CanvasDropZone
                  blocks={activeStrategy.blocks}
                  selectedBlockId={selectedBlockId}
                  onSelectBlock={setSelectedBlockId}
                  onRemoveBlock={id => {
                    const blocks = activeStrategy.blocks.filter(b => b.id !== id);
                    onUpdateStrategy(activeStrategy.id, { blocks });
                    if (selectedBlockId === id) setSelectedBlockId(null);
                  }}
                  isEmpty={activeStrategy.blocks.length === 0}
                />
              </div>
            </>
          ) : (
            <div
              className="flex-1 flex flex-col items-center justify-center rounded-md"
              style={{ border: '2px dashed var(--border-strong)', backgroundColor: 'var(--bg-elevated)' }}
            >
              <div
                className="flex h-10 w-10 items-center justify-center rounded-md mb-4"
                style={{ border: '1px solid var(--border)', backgroundColor: 'var(--bg-card)' }}
              >
                <Zap className="h-5 w-5" style={{ color: 'var(--text-tertiary)' }} />
              </div>
              <p className="text-[15px] font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>
                No strategy selected
              </p>
              <p className="text-[13px] mb-6" style={{ color: 'var(--text-tertiary)' }}>
                Create a strategy to get started
              </p>
              <button
                onClick={handleCreateStrategy}
                className="flex items-center gap-2 px-4 py-2 rounded text-xs font-medium transition-colors"
                style={{
                  backgroundColor: 'var(--accent)',
                  color: '#ffffff',
                }}
                onMouseEnter={e => (e.currentTarget.style.opacity = '0.9')}
                onMouseLeave={e => (e.currentTarget.style.opacity = '1')}
              >
                <Plus className="h-3.5 w-3.5" />
                New Strategy
              </button>
            </div>
          )}
        </div>

        {/* Right: Config panel */}
        <div className="w-[220px] shrink-0">
          <AnimatePresence mode="wait">
            {selectedBlock ? (
              <motion.div
                key={selectedBlock.id}
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 10 }}
                transition={{ duration: 0.15 }}
              >
                <div
                  className="flex items-center gap-1.5 pb-2.5 mb-3"
                  style={{ borderBottom: '1px solid var(--border)' }}
                >
                  <Settings2 className="h-3.5 w-3.5" style={{ color: 'var(--text-tertiary)' }} />
                  <span className="text-[13px] font-semibold" style={{ color: 'var(--text)' }}>Config</span>
                </div>
                <BlockConfigPanel
                  block={selectedBlock}
                  onUpdate={params => {
                    if (!activeStrategy) return;
                    const blocks = activeStrategy.blocks.map(b =>
                      b.id === selectedBlock.id ? { ...b, params } : b
                    );
                    onUpdateStrategy(activeStrategy.id, { blocks });
                  }}
                  onClose={() => setSelectedBlockId(null)}
                />
              </motion.div>
            ) : (
              <motion.div
                key="empty"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="rounded-md p-4 text-center h-40 flex flex-col items-center justify-center"
                style={{
                  border: '1px solid var(--border)',
                  backgroundColor: 'var(--bg-card)',
                }}
              >
                <Settings2 className="h-6 w-6 mb-2" style={{ color: 'var(--text-tertiary)' }} />
                <p className="text-[12px]" style={{ color: 'var(--text-tertiary)' }}>
                  Click a block to configure it
                </p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Drag overlay */}
      <DragOverlay>
        {draggingDef && (() => {
          const Icon = LUCIDE_ICONS[draggingDef.icon] ?? Zap;
          return (
            <div
              className="flex items-center gap-2.5 rounded px-3 py-2.5 pointer-events-none shadow-xl"
              style={{
                border: '1px solid var(--accent)',
                backgroundColor: 'var(--bg-card)',
              }}
            >
              <Icon className="h-3.5 w-3.5" style={{ color: draggingDef.color }} />
              <span className="text-[12px] font-medium" style={{ color: 'var(--text)' }}>{draggingDef.label}</span>
            </div>
          );
        })()}
      </DragOverlay>
    </DndContext>
  );
}
