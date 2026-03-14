'use client';

import { useRef, useEffect, useState, useCallback } from 'react';
import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { cn } from '@/lib/utils';
import { CATEGORY_META, type CanvasBlock } from './block-types';
import { RuleBlock } from './RuleBlock';
import type { CustomDataSource } from '@/lib/types';

// ── Step path algorithm ───────────────────────────────────────
function stepPath(sx: number, sy: number, ex: number, ey: number): string {
  const dy = ey - sy;
  if (Math.abs(dy) < 1 || ex <= sx) {
    return `M ${sx} ${sy} L ${ex} ${ey}`;
  }
  const midX = (sx + ex) / 2;
  const r = Math.min(10, Math.abs(dy) / 2, midX - sx, ex - midX);
  if (r < 1) {
    return `M ${sx} ${sy} L ${midX} ${sy} L ${midX} ${ey} L ${ex} ${ey}`;
  }
  const sign = dy > 0 ? 1 : -1;
  return [
    `M ${sx} ${sy}`,
    `L ${midX - r} ${sy}`,
    `Q ${midX} ${sy} ${midX} ${sy + sign * r}`,
    `L ${midX} ${ey - sign * r}`,
    `Q ${midX} ${ey} ${midX + r} ${ey}`,
    `L ${ex} ${ey}`,
  ].join(' ');
}

interface Conn {
  id: string;
  from: { x: number; y: number };
  to: { x: number; y: number };
  fromColor: string;
  toColor: string;
  d: string;
}

// ── FlowSVG ───────────────────────────────────────────────────
function FlowSVG({
  gridRef,
  blocks,
}: {
  gridRef: React.RefObject<HTMLDivElement | null>;
  blocks: CanvasBlock[];
}) {
  const [conns, setConns] = useState<Conn[]>([]);
  const [size, setSize] = useState({ w: 0, h: 0 });

  const measure = useCallback(() => {
    if (!gridRef.current) return;
    const cr = gridRef.current.getBoundingClientRect();
    setSize({ w: cr.width, h: cr.height });

    const marketEls = Array.from(
      gridRef.current.querySelectorAll<HTMLElement>('[data-block-category="market"]')
    );
    const condEls = Array.from(
      gridRef.current.querySelectorAll<HTMLElement>('[data-block-category="condition"]')
    );
    const actEls = Array.from(
      gridRef.current.querySelectorAll<HTMLElement>('[data-block-category="action"]')
    );

    const rightOf = (el: HTMLElement) => {
      const r = el.getBoundingClientRect();
      return { x: r.right - cr.left, y: r.top - cr.top + r.height / 2 };
    };
    const leftOf = (el: HTMLElement) => {
      const r = el.getBoundingClientRect();
      return { x: r.left - cr.left, y: r.top - cr.top + r.height / 2 };
    };

    const newConns: Conn[] = [];
    let idx = 0;

    // market → condition
    marketEls.forEach((me, mi) => {
      condEls.forEach((ce, ci) => {
        const from = rightOf(me);
        const to = leftOf(ce);
        newConns.push({
          id: `mc-${mi}-${ci}-${idx++}`,
          from,
          to,
          fromColor: 'rgb(245,158,11)',
          toColor: 'rgb(99,102,241)',
          d: stepPath(from.x, from.y, to.x, to.y),
        });
      });
    });

    if (condEls.length > 0) {
      // condition → action
      condEls.forEach((ce, ci) => {
        actEls.forEach((ae, ai) => {
          const from = rightOf(ce);
          const to = leftOf(ae);
          newConns.push({
            id: `ca-${ci}-${ai}-${idx++}`,
            from,
            to,
            fromColor: 'rgb(99,102,241)',
            toColor: 'rgb(16,185,129)',
            d: stepPath(from.x, from.y, to.x, to.y),
          });
        });
      });
    } else {
      // market → action (no conditions present)
      marketEls.forEach((me, mi) => {
        actEls.forEach((ae, ai) => {
          const from = rightOf(me);
          const to = leftOf(ae);
          newConns.push({
            id: `ma-${mi}-${ai}-${idx++}`,
            from,
            to,
            fromColor: 'rgb(245,158,11)',
            toColor: 'rgb(16,185,129)',
            d: stepPath(from.x, from.y, to.x, to.y),
          });
        });
      });
    }

    setConns(newConns);
  }, [gridRef]);

  useEffect(() => {
    if (!gridRef.current) return;
    requestAnimationFrame(measure);

    const ro = new ResizeObserver(() => requestAnimationFrame(measure));
    const mo = new MutationObserver(() => requestAnimationFrame(measure));

    ro.observe(gridRef.current);
    mo.observe(gridRef.current, { childList: true, subtree: true, attributes: true });

    return () => {
      ro.disconnect();
      mo.disconnect();
    };
  }, [gridRef, measure, blocks]);

  if (conns.length === 0) return null;

  return (
    <svg
      style={{
        position: 'absolute',
        inset: 0,
        width: size.w,
        height: size.h,
        pointerEvents: 'none',
        overflow: 'visible',
        zIndex: 1,
      }}
    >
      <defs>
        <filter id="flow-glow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="4" result="blur" />
        </filter>
        {conns.map(conn => (
          <linearGradient
            key={`grad-${conn.id}`}
            id={`grad-${conn.id}`}
            x1={conn.from.x}
            y1={conn.from.y}
            x2={conn.to.x}
            y2={conn.to.y}
            gradientUnits="userSpaceOnUse"
          >
            <stop offset="0%" stopColor={conn.fromColor} />
            <stop offset="100%" stopColor={conn.toColor} />
          </linearGradient>
        ))}
      </defs>

      {conns.map((conn, i) => {
        const pathId = `fp-${conn.id}`;
        const dur = `${2.2 + (i % 4) * 0.6}s`;
        const gradUrl = `url(#grad-${conn.id})`;

        return (
          <g key={conn.id}>
            <path
              d={conn.d}
              fill="none"
              stroke={gradUrl}
              strokeWidth={8}
              opacity={0.08}
              filter="url(#flow-glow)"
            />
            <path
              id={pathId}
              d={conn.d}
              fill="none"
              stroke={gradUrl}
              strokeWidth={1.5}
              opacity={0.55}
            />
            <circle r={2} fill={conn.toColor} opacity={0.9}>
              <animateMotion dur={dur} repeatCount="indefinite">
                <mpath href={`#${pathId}`} />
              </animateMotion>
            </circle>
            <circle r={5} fill={conn.toColor} opacity={0.15} filter="url(#flow-glow)">
              <animateMotion dur={dur} repeatCount="indefinite">
                <mpath href={`#${pathId}`} />
              </animateMotion>
            </circle>
            <circle cx={conn.from.x} cy={conn.from.y} fill={conn.fromColor}>
              <animate attributeName="r" values="2;3.5;2" dur="2.5s" repeatCount="indefinite" />
              <animate attributeName="opacity" values="0.6;1;0.6" dur="2.5s" repeatCount="indefinite" />
            </circle>
            <circle cx={conn.to.x} cy={conn.to.y} fill={conn.toColor}>
              <animate attributeName="r" values="2;3.5;2" dur="2.5s" repeatCount="indefinite" begin="1s" />
              <animate attributeName="opacity" values="0.6;1;0.6" dur="2.5s" repeatCount="indefinite" begin="1s" />
            </circle>
          </g>
        );
      })}
    </svg>
  );
}

// ── LogicToggle ───────────────────────────────────────────────
function LogicToggle({
  value,
  onChange,
}: {
  value: 'AND' | 'OR';
  onChange: (v: 'AND' | 'OR') => void;
}) {
  return (
    <div className="flex justify-center my-1.5 relative z-10">
      <div className="rounded-full border border-white/[0.08] bg-white/[0.03] p-0.5 flex items-center">
        {(['AND', 'OR'] as const).map(opt => (
          <button
            key={opt}
            onClick={() => onChange(opt)}
            className={cn(
              'px-3 py-0.5 rounded-full text-[10px] font-bold tracking-wider transition-all',
              value === opt
                ? 'bg-indigo-500/20 text-indigo-300'
                : 'text-white/25 hover:text-white/40'
            )}
          >
            {opt}
          </button>
        ))}
      </div>
    </div>
  );
}

// ── BlockColumn ───────────────────────────────────────────────
interface BlockColumnProps {
  category: 'market' | 'condition' | 'action';
  label: string;
  blocks: CanvasBlock[];
  conditionLogic: 'AND' | 'OR';
  onConditionLogicChange: (v: 'AND' | 'OR') => void;
  onRemoveBlock: (id: string) => void;
  onUpdateBlockConfig: (id: string, config: Record<string, string | number>) => void;
  sources?: CustomDataSource[];
  fetchSourceValue?: (id: string) => Promise<{ value: unknown; error?: string }>;
}

function BlockColumn({
  category,
  label,
  blocks,
  conditionLogic,
  onConditionLogicChange,
  onRemoveBlock,
  onUpdateBlockConfig,
  sources,
  fetchSourceValue,
}: BlockColumnProps) {
  const meta = CATEGORY_META[category];
  const { r, g, b } = meta.rgb;
  const populated = blocks.length > 0;

  const emptyHint =
    category === 'market'
      ? 'Drop a market block here'
      : category === 'condition'
        ? 'Add optional IF conditions'
        : 'Drop THEN actions here';

  return (
    <div className="flex flex-col gap-2 relative z-10">
      {/* Column header */}
      <div className="flex items-center gap-2 px-1 mb-0.5">
        <span
          className="h-[7px] w-[7px] rounded-full shrink-0 transition-all duration-300"
          style={{
            backgroundColor: populated ? meta.solidRgb : `rgba(${r},${g},${b},0.25)`,
            boxShadow: populated ? `0 0 6px ${meta.solidRgb}` : undefined,
            animation: populated ? 'energy-node-pulse 2.5s ease-in-out infinite' : undefined,
          }}
        />
        <span
          className={cn(
            'text-[10px] font-bold uppercase tracking-[0.1em] transition-colors',
            populated ? meta.textClass : 'text-white/20'
          )}
        >
          {label}
        </span>
        <div
          className="flex-1 h-px transition-all duration-300"
          style={{
            background: populated
              ? `linear-gradient(to right, rgba(${r},${g},${b},0.25), transparent)`
              : 'rgba(255,255,255,0.04)',
          }}
        />
      </div>

      {/* Block list or empty placeholder */}
      {populated ? (
        <SortableContext
          items={blocks.map(b => b.id)}
          strategy={verticalListSortingStrategy}
        >
          <div className="flex flex-col gap-2">
            {blocks.map((block, i) => (
              <div key={block.id}>
                <RuleBlock
                  block={block}
                  onRemove={() => onRemoveBlock(block.id)}
                  onUpdateConfig={config => onUpdateBlockConfig(block.id, config)}
                  sources={sources}
                  fetchSourceValue={fetchSourceValue}
                />
                {category === 'condition' && i < blocks.length - 1 && (
                  <LogicToggle
                    value={conditionLogic}
                    onChange={onConditionLogicChange}
                  />
                )}
              </div>
            ))}
          </div>
        </SortableContext>
      ) : (
        <div
          className="rounded-xl border border-dashed py-8 px-3 flex items-center justify-center min-h-[96px] transition-colors"
          style={{
            borderColor: `rgba(${r},${g},${b},0.12)`,
            background: `rgba(${r},${g},${b},0.02)`,
          }}
        >
          <span className="text-[11px] text-white/15 text-center leading-relaxed">
            {emptyHint}
          </span>
        </div>
      )}
    </div>
  );
}

// ── RuleCanvas ────────────────────────────────────────────────
interface RuleCanvasProps {
  blocks: CanvasBlock[];
  conditionLogic: 'AND' | 'OR';
  ruleName: string;
  onRuleNameChange: (v: string) => void;
  onConditionLogicChange: (v: 'AND' | 'OR') => void;
  onRemoveBlock: (id: string) => void;
  onUpdateBlockConfig: (id: string, config: Record<string, string | number>) => void;
  canActivate: boolean;
  onActivate: () => void;
  sources?: CustomDataSource[];
  fetchSourceValue?: (id: string) => Promise<{ value: unknown; error?: string }>;
}

export function RuleCanvas({
  blocks,
  conditionLogic,
  ruleName,
  onRuleNameChange,
  onConditionLogicChange,
  onRemoveBlock,
  onUpdateBlockConfig,
  canActivate,
  onActivate,
  sources,
  fetchSourceValue,
}: RuleCanvasProps) {
  const { isOver, setNodeRef } = useDroppable({ id: 'canvas' });
  const gridRef = useRef<HTMLDivElement | null>(null);

  const markets = blocks.filter(b => b.category === 'market');
  const conditions = blocks.filter(b => b.category === 'condition');
  const actions = blocks.filter(b => b.category === 'action');

  return (
    <div className="flex flex-col gap-3">
      {/* Rule name */}
      <input
        value={ruleName}
        onChange={e => onRuleNameChange(e.target.value)}
        placeholder="Name this rule…"
        className="h-11 w-full bg-white/[0.04] border border-white/[0.08] backdrop-blur-xl text-[14px] font-medium text-white rounded-xl px-4 placeholder:text-white/20 focus:outline-none focus:border-white/[0.15] transition-colors"
      />

      {/* Drop zone — always visible as 3 columns */}
      <div
        ref={setNodeRef}
        className="relative rounded-2xl transition-all duration-200"
        style={{
          border: isOver
            ? '1px solid rgba(245,158,11,0.3)'
            : '1px solid rgba(255,255,255,0.06)',
          background: isOver
            ? 'rgba(245,158,11,0.04)'
            : 'rgba(255,255,255,0.02)',
          padding: '1.5rem',
        }}
      >
        {/* Subtle grid overlay */}
        <div
          className="absolute inset-0 rounded-2xl overflow-hidden pointer-events-none"
          style={{
            backgroundImage: `
              linear-gradient(rgba(255,255,255,0.025) 1px, transparent 1px),
              linear-gradient(90deg, rgba(255,255,255,0.025) 1px, transparent 1px)
            `,
            backgroundSize: '24px 24px',
          }}
        />

        <div ref={gridRef} className="relative grid grid-cols-3 gap-10">
          <FlowSVG gridRef={gridRef} blocks={blocks} />

          <BlockColumn
            category="market"
            label="FOR"
            blocks={markets}
            conditionLogic={conditionLogic}
            onConditionLogicChange={onConditionLogicChange}
            onRemoveBlock={onRemoveBlock}
            onUpdateBlockConfig={onUpdateBlockConfig}
            sources={sources}
            fetchSourceValue={fetchSourceValue}
          />
          <BlockColumn
            category="condition"
            label="IF"
            blocks={conditions}
            conditionLogic={conditionLogic}
            onConditionLogicChange={onConditionLogicChange}
            onRemoveBlock={onRemoveBlock}
            onUpdateBlockConfig={onUpdateBlockConfig}
            sources={sources}
            fetchSourceValue={fetchSourceValue}
          />
          <BlockColumn
            category="action"
            label="THEN"
            blocks={actions}
            conditionLogic={conditionLogic}
            onConditionLogicChange={onConditionLogicChange}
            onRemoveBlock={onRemoveBlock}
            onUpdateBlockConfig={onUpdateBlockConfig}
            sources={sources}
            fetchSourceValue={fetchSourceValue}
          />
        </div>
      </div>

      {/* Activate Rule button */}
      <button
        disabled={!canActivate}
        onClick={canActivate ? onActivate : undefined}
        className={cn(
          'w-full rounded-xl h-10 text-[13px] font-semibold transition-all duration-200',
          canActivate
            ? 'text-white hover:opacity-90'
            : 'text-white/20 cursor-not-allowed'
        )}
        style={
          canActivate
            ? {
                backgroundColor: '#FF007A',
                boxShadow: '0 0 20px rgba(255,0,122,0.2)',
              }
            : {
                backgroundColor: 'rgba(255,255,255,0.04)',
              }
        }
      >
        Activate Rule
      </button>
    </div>
  );
}
