'use client';

import { useState } from 'react';
import { useDraggable } from '@dnd-kit/core';
import { GripVertical, Layers, Globe, Filter, Play, Plus, Trash2, ChevronDown, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  MARKET_ITEMS,
  CONDITION_ITEMS,
  ACTION_ITEMS,
  CATEGORY_META,
  makeCustomSourcePaletteItem,
  type PaletteItem,
} from './block-types';
import type { CustomDataSource } from '@/lib/types';

function DraggablePaletteItem({
  item,
  onAdd,
}: {
  item: PaletteItem;
  onAdd: () => void;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `palette-${item.type}`,
    data: { fromPalette: true, type: item.type },
  });

  const meta = CATEGORY_META[item.category];

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      onClick={onAdd}
      className={cn(
        'group flex items-center gap-2.5 rounded-lg px-2.5 py-2 cursor-grab active:cursor-grabbing select-none transition-all hover:bg-white/[0.05]',
        isDragging && 'opacity-40'
      )}
    >
      <GripVertical className="h-3 w-3 text-white/10 group-hover:text-white/25 shrink-0 transition-colors" />
      <span
        className={cn('h-1.5 w-1.5 rounded-full shrink-0', meta.dotClass)}
        style={{ boxShadow: `0 0 4px ${meta.glow}` }}
      />
      <span className="text-[12px] font-medium text-white/50 group-hover:text-white/75 transition-colors min-w-0 truncate">
        {item.label}
      </span>
    </div>
  );
}

// ── Draggable custom source item ─────────────────────────────
function DraggableCustomItem({
  item,
  onAdd,
  onRemove,
}: {
  item: PaletteItem;
  onAdd: () => void;
  onRemove: () => void;
}) {
  const dragId = `palette-custom-${item.defaultConfig.sourceId}`;
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: dragId,
    data: { fromPalette: true, type: 'custom_datasource', customItem: item },
  });

  const meta = CATEGORY_META['condition'];

  return (
    <div
      ref={setNodeRef}
      className={cn(
        'group flex items-center gap-2 rounded-lg px-2.5 py-2 select-none transition-all hover:bg-white/[0.05]',
        isDragging && 'opacity-40'
      )}
    >
      <div
        {...listeners}
        {...attributes}
        onClick={onAdd}
        className="flex items-center gap-2 flex-1 min-w-0 cursor-grab active:cursor-grabbing"
      >
        <GripVertical className="h-3 w-3 text-white/10 group-hover:text-white/25 shrink-0 transition-colors" />
        <span
          className={cn('h-1.5 w-1.5 rounded-full shrink-0', meta.dotClass)}
          style={{ boxShadow: `0 0 4px ${meta.glow}` }}
        />
        <span className="text-[12px] font-medium text-indigo-300/60 group-hover:text-indigo-300/90 transition-colors min-w-0 truncate">
          {item.label}
        </span>
      </div>
      <button
        onClick={e => { e.stopPropagation(); onRemove(); }}
        className="shrink-0 opacity-0 group-hover:opacity-100 text-white/20 hover:text-red-400 transition-all p-0.5 rounded"
      >
        <Trash2 className="h-3 w-3" />
      </button>
    </div>
  );
}

// ── BlockPalette ──────────────────────────────────────────────
interface BlockPaletteProps {
  onAddBlock: (item: PaletteItem) => void;
  sources: CustomDataSource[];
  onRemoveSource: (id: string) => void;
  onNavigateToSources: () => void;
}

const CATEGORY_ICONS = {
  market: Globe,
  condition: Filter,
  action: Play,
} as const;

const GROUPS = [
  { category: 'market' as const, items: MARKET_ITEMS },
  { category: 'condition' as const, items: CONDITION_ITEMS },
  { category: 'action' as const, items: ACTION_ITEMS },
];

export function BlockPalette({ onAddBlock, sources, onRemoveSource, onNavigateToSources }: BlockPaletteProps) {
  const meta = CATEGORY_META['condition'];
  // Start expanded if there are sources, collapsed if not
  const [customExpanded, setCustomExpanded] = useState(sources.length > 0);

  // Keep expanded when sources are first added
  if (sources.length > 0 && !customExpanded) {
    // noop – let user toggle
  }

  return (
    <div
      className="lg:sticky lg:top-4 self-start rounded-2xl border border-white/[0.06] overflow-hidden"
      style={{
        background:
          'radial-gradient(ellipse at 50% 0%, rgba(255,255,255,0.02), transparent 60%), rgba(8,8,15,0.5)',
      }}
    >
      {/* Header */}
      <div className="flex items-center gap-2.5 px-3.5 py-3">
        <div className="h-7 w-7 rounded-lg border border-white/[0.08] bg-white/[0.04] flex items-center justify-center shrink-0">
          <Layers className="h-3.5 w-3.5 text-white/40" />
        </div>
        <div>
          <p className="text-[13px] font-semibold text-white/80">Blocks</p>
          <p className="text-[10px] text-white/25">Drag or click to add</p>
        </div>
      </div>

      <div className="h-px bg-white/[0.05]" />

      {/* Category groups */}
      <div className="p-2">
        {GROUPS.map((group, gi) => {
          const groupMeta = CATEGORY_META[group.category];
          const Icon = CATEGORY_ICONS[group.category];

          return (
            <div key={group.category}>
              {gi > 0 && <div className="h-px bg-white/[0.04] mx-1 my-2.5" />}

              <div className={cn('flex items-center gap-1.5 px-2.5 py-1.5')}>
                <Icon className={cn('h-3 w-3', groupMeta.textClass)} />
                <span className="text-[10px] uppercase tracking-[0.08em] text-white/30 font-medium">
                  {group.category}
                </span>
              </div>

              <div>
                {group.items.map(item => (
                  <DraggablePaletteItem
                    key={item.type}
                    item={item}
                    onAdd={() => onAddBlock(item)}
                  />
                ))}
              </div>

              {/* Custom sources — nested under the condition group */}
              {group.category === 'condition' && (
                <div className="mt-1">
                  <div className="h-px bg-white/[0.04] mx-1 mb-2" />

                  {/* Custom section header */}
                  <button
                    onClick={() => setCustomExpanded(v => !v)}
                    className="flex items-center gap-1.5 px-2.5 py-1 w-full group"
                  >
                    {customExpanded
                      ? <ChevronDown className={cn('h-2.5 w-2.5', meta.textClass, 'opacity-60')} />
                      : <ChevronRight className={cn('h-2.5 w-2.5', meta.textClass, 'opacity-60')} />
                    }
                    <span className="text-[10px] uppercase tracking-[0.08em] text-white/30 font-medium group-hover:text-white/50 transition-colors">
                      Custom
                    </span>
                    {sources.length > 0 && (
                      <span className="ml-auto text-[9px] text-indigo-400/50 font-medium">
                        {sources.length}
                      </span>
                    )}
                  </button>

                  {customExpanded && (
                    <div>
                      {sources.length === 0 ? (
                        <div className="px-2.5 py-2">
                          <p className="text-[10px] text-white/20 leading-snug mb-1.5">
                            No sources saved yet.
                          </p>
                          <button
                            onClick={onNavigateToSources}
                            className="flex items-center gap-1 text-[10px] text-indigo-400/60 hover:text-indigo-400 transition-colors"
                          >
                            <Plus className="h-2.5 w-2.5" />
                            Add in Sources tab
                          </button>
                        </div>
                      ) : (
                        <>
                          {sources.map(source => {
                            const item = makeCustomSourcePaletteItem(source);
                            return (
                              <DraggableCustomItem
                                key={source.id}
                                item={item}
                                onAdd={() => onAddBlock(item)}
                                onRemove={() => onRemoveSource(source.id)}
                              />
                            );
                          })}
                          <button
                            onClick={onNavigateToSources}
                            className="flex items-center gap-1.5 w-full px-2.5 py-1.5 text-[10px] text-white/20 hover:text-indigo-400 transition-colors rounded-lg hover:bg-white/[0.03]"
                          >
                            <Plus className="h-2.5 w-2.5" />
                            Manage sources
                          </button>
                        </>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
