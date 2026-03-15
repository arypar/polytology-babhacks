'use client';

import { useState, useCallback, useEffect } from 'react';
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import { arrayMove } from '@dnd-kit/sortable';
import { cn } from '@/lib/utils';
import { BlockPalette } from './BlockPalette';
import { RuleCanvas } from './RuleCanvas';
import { PALETTE_ITEMS, CATEGORY_META, type PaletteItem, type CanvasBlock } from './block-types';
import { useDataSources } from '@/hooks/useDataSources';
import { usePrivy } from '@privy-io/react-auth';
import { useStrategies } from '@/lib/store';
import type { AutonomousStrategy } from '@/lib/types';

// ── Drag overlay ghost pill ───────────────────────────────────
function DragOverlayBlock({ item }: { item: PaletteItem | CanvasBlock }) {
  const meta = CATEGORY_META[item.category];
  return (
    <div
      className={cn(
        'rounded-2xl border backdrop-blur-xl px-4 py-3 flex items-center gap-2 pointer-events-none shadow-2xl',
        meta.bgClass,
        meta.borderClass
      )}
    >
      <span
        className={cn('h-1.5 w-1.5 rounded-full shrink-0', meta.dotClass)}
        style={{ boxShadow: `0 0 6px ${meta.glow}` }}
      />
      <span className={cn('text-[9px] font-bold uppercase tracking-[0.08em]', meta.textClass)}>
        {meta.tag}
      </span>
      <span className="text-[12px] font-semibold text-white/80">{item.label}</span>
    </div>
  );
}

// ── RulesTab ──────────────────────────────────────────────────
interface RulesTabProps {
  onNavigateToSources?: () => void;
}

const DRAFT_KEY = 'pm-rule-draft';

interface RuleDraft {
  blocks: CanvasBlock[];
  conditionLogic: 'AND' | 'OR';
  ruleName: string;
}

function loadDraft(): RuleDraft {
  if (typeof window === 'undefined') return { blocks: [], conditionLogic: 'AND', ruleName: '' };
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    return raw ? (JSON.parse(raw) as RuleDraft) : { blocks: [], conditionLogic: 'AND', ruleName: '' };
  } catch {
    return { blocks: [], conditionLogic: 'AND', ruleName: '' };
  }
}

function saveDraft(draft: RuleDraft) {
  if (typeof window === 'undefined') return;
  try { localStorage.setItem(DRAFT_KEY, JSON.stringify(draft)); } catch { /* ignore */ }
}

function clearDraft() {
  if (typeof window === 'undefined') return;
  try { localStorage.removeItem(DRAFT_KEY); } catch { /* ignore */ }
}

export function RulesTab({ onNavigateToSources }: RulesTabProps) {
  const [blocks, setBlocks] = useState<CanvasBlock[]>(() => loadDraft().blocks);
  const [conditionLogic, setConditionLogic] = useState<'AND' | 'OR'>(() => loadDraft().conditionLogic);
  const [ruleName, setRuleName] = useState<string>(() => loadDraft().ruleName);
  const [activeDrag, setActiveDrag] = useState<{
    item: PaletteItem | CanvasBlock;
  } | null>(null);
  const [activating, setActivating] = useState(false);
  const [activated, setActivated] = useState(false);

  // Persist draft to localStorage whenever it changes
  useEffect(() => {
    saveDraft({ blocks, conditionLogic, ruleName });
  }, [blocks, conditionLogic, ruleName]);

  const { user } = usePrivy();
  const eoaAddress = user?.wallet?.address ?? null;
  const { addStrategy } = useStrategies(eoaAddress);

  const { sources, removeSource, fetchSourceValue } = useDataSources();

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } })
  );

  const addBlock = useCallback((paletteItem: PaletteItem) => {
    const newBlock: CanvasBlock = {
      id: crypto.randomUUID(),
      category: paletteItem.category,
      type: paletteItem.type,
      label: paletteItem.label,
      config: { ...paletteItem.defaultConfig },
    };
    setBlocks(prev => {
      // Market is limited to 1 — new market replaces the old one
      if (paletteItem.category === 'market') {
        const rest = prev.filter(b => b.category !== 'market');
        return [newBlock, ...rest];
      }
      return [...prev, newBlock];
    });
  }, []);

  const removeBlock = useCallback((id: string) => {
    setBlocks(prev => prev.filter(b => b.id !== id));
  }, []);

  const updateBlockConfig = useCallback(
    (id: string, config: Record<string, string | number>) => {
      setBlocks(prev => prev.map(b => (b.id === id ? { ...b, config } : b)));
    },
    []
  );

  const handleDragStart = useCallback(
    (event: DragStartEvent) => {
      const id = String(event.active.id);
      if (id.startsWith('palette-custom-')) {
        // Custom data source item — use the item from drag data
        const item = event.active.data.current?.customItem as PaletteItem | undefined;
        if (item) setActiveDrag({ item });
      } else if (id.startsWith('palette-')) {
        const type = id.replace('palette-', '');
        const item = PALETTE_ITEMS.find(p => p.type === type);
        if (item) setActiveDrag({ item });
      } else {
        const block = blocks.find(b => b.id === id);
        if (block) setActiveDrag({ item: block });
      }
    },
    [blocks]
  );

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      setActiveDrag(null);
      const { active, over } = event;
      if (!over) return;

      const activeId = String(active.id);
      const overId = String(over.id);

      if (activeId.startsWith('palette-')) {
        // Accept drop on canvas droppable OR on any existing block
        const isOnCanvas =
          overId === 'canvas' || blocks.some(b => b.id === overId);
        if (!isOnCanvas) return;

        if (activeId.startsWith('palette-custom-')) {
          // Custom source item — pre-filled PaletteItem in drag data
          const item = active.data.current?.customItem as PaletteItem | undefined;
          if (item) addBlock(item);
          return;
        }

        const type = activeId.replace('palette-', '');
        const paletteItem = PALETTE_ITEMS.find(p => p.type === type);
        if (paletteItem) addBlock(paletteItem);
      } else {
        // Reorder: only within the same category
        const activeBlock = blocks.find(b => b.id === activeId);
        const overBlock = blocks.find(b => b.id === overId);
        if (!activeBlock || !overBlock) return;
        if (activeBlock.category !== overBlock.category) return;

        setBlocks(prev => {
          const catBlocks = prev.filter(b => b.category === activeBlock.category);
          const others = prev.filter(b => b.category !== activeBlock.category);
          const oldIdx = catBlocks.findIndex(b => b.id === activeId);
          const newIdx = catBlocks.findIndex(b => b.id === overId);
          const reordered = arrayMove(catBlocks, oldIdx, newIdx);

          // Preserve category ordering: market → conditions → actions
          const markets =
            activeBlock.category === 'market'
              ? reordered
              : others.filter(b => b.category === 'market');
          const conditions =
            activeBlock.category === 'condition'
              ? reordered
              : others.filter(b => b.category === 'condition');
          const actions =
            activeBlock.category === 'action'
              ? reordered
              : others.filter(b => b.category === 'action');

          return [...markets, ...conditions, ...actions];
        });
      }
    },
    [blocks, addBlock]
  );

  const marketBlock = blocks.find(b => b.category === 'market');
  const canActivate =
    !!marketBlock &&
    !!marketBlock.config.marketId &&
    blocks.some(b => b.category === 'action') &&
    !!eoaAddress;

  const handleActivate = useCallback(async () => {
    if (!canActivate || !eoaAddress || !marketBlock) return;
    setActivating(true);

    const now = Date.now();
    const strategy: AutonomousStrategy = {
      id: crypto.randomUUID(),
      name: ruleName.trim() || `Rule — ${String(marketBlock.config.marketName).slice(0, 40)}`,
      blocks: blocks as unknown as AutonomousStrategy['blocks'],
      enabled: true,
      marketId: String(marketBlock.config.marketId),
      marketQuestion: String(marketBlock.config.marketName),
      createdAt: now,
      updatedAt: now,
    };

    addStrategy(strategy);
    setActivating(false);
    setActivated(true);

    setTimeout(() => {
      setActivated(false);
      setBlocks([]);
      setRuleName('');
      clearDraft();
    }, 2000);
  }, [canActivate, eoaAddress, marketBlock, ruleName, blocks, addStrategy]);

  return (
    <DndContext
      sensors={sensors}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[240px_1fr]">
        <BlockPalette
          onAddBlock={addBlock}
          sources={sources}
          onRemoveSource={removeSource}
          onNavigateToSources={onNavigateToSources ?? (() => {})}
        />
        <RuleCanvas
          blocks={blocks}
          conditionLogic={conditionLogic}
          ruleName={ruleName}
          onRuleNameChange={setRuleName}
          onConditionLogicChange={setConditionLogic}
          onRemoveBlock={removeBlock}
          onUpdateBlockConfig={updateBlockConfig}
          canActivate={canActivate && !activating && !activated}
          onActivate={handleActivate}
          activating={activating}
          activated={activated}
          sources={sources}
          fetchSourceValue={fetchSourceValue}
        />
      </div>

      <DragOverlay dropAnimation={null}>
        {activeDrag ? <DragOverlayBlock item={activeDrag.item} /> : null}
      </DragOverlay>
    </DndContext>
  );
}
