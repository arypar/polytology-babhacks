'use client';

import { cn } from '@/lib/utils';

const TABS = ['Intelligence', 'Builder', 'Sources', 'Executing', 'Users'] as const;
export type TabId = (typeof TABS)[number];

const TAB_LABELS: Record<TabId, string> = {
  Intelligence: 'Intelligence',
  Builder: 'Builder',
  Sources: 'Sources',
  Executing: 'Executing',
  Users: 'Users',
};

interface AppTabsProps {
  active: TabId;
  onChange: (tab: TabId) => void;
}

export function AppTabs({ active, onChange }: AppTabsProps) {
  return (
    <nav className="flex items-end gap-6">
      {TABS.map(tab => {
        const isActive = active === tab;
        return (
          <button
            key={tab}
            onClick={() => onChange(tab)}
            className={cn(
              'relative pb-3 text-[14px] font-medium tracking-[-0.01em] transition-colors duration-150',
              isActive
                ? 'text-white'
                : 'text-white/40 hover:text-white/70'
            )}
          >
            {TAB_LABELS[tab]}
            <span
              className={cn(
                'absolute bottom-0 inset-x-0 h-[2px] rounded-full transition-opacity duration-150',
                isActive ? 'opacity-100' : 'opacity-0'
              )}
              style={{ backgroundColor: '#2E5CFF' }}
            />
          </button>
        );
      })}
    </nav>
  );
}
