'use client';

import { usePrivy } from '@privy-io/react-auth';
import { usePolymarketSession } from '@/hooks/usePolymarketSession';
import {
  BarChart2,
  Blocks,
  Activity,
  Users2,
  Database,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import Image from 'next/image';
import { cn } from '@/lib/utils';
import type { TabId } from './AppTabs';

interface SidebarProps {
  active: TabId;
  onChange: (tab: TabId) => void;
  collapsed: boolean;
  onCollapsedChange: (c: boolean) => void;
}

const NAV_ITEMS: { id: TabId; label: string; icon: React.ElementType }[] = [
  { id: 'Intelligence', label: 'Intelligence', icon: BarChart2 },
  { id: 'Builder',      label: 'Builder',      icon: Blocks    },
  { id: 'Sources',      label: 'Sources',      icon: Database  },
  { id: 'Executing',    label: 'Executing',    icon: Activity  },
  { id: 'Users',        label: 'Users',        icon: Users2    },
];

export function Sidebar({ active, onChange, collapsed, onCollapsedChange }: SidebarProps) {
  const { authenticated, user } = usePrivy();
  const { status } = usePolymarketSession();

  const embeddedWallet = user?.linkedAccounts?.find(
    (a) => a.type === 'wallet' && a.walletClientType === 'privy'
  ) as { address?: string } | undefined;

  const displayAddress = embeddedWallet?.address
    ? `${embeddedWallet.address.slice(0, 6)}…${embeddedWallet.address.slice(-4)}`
    : null;

  const sessionColor = status === 'ready' ? '#22c55e' : status === 'idle' ? '#4a4a5a' : '#1652F0';

  return (
    <aside
      className={cn(
        'fixed left-0 top-0 z-40 flex h-screen flex-col transition-all duration-200',
        collapsed ? 'w-12' : 'w-[200px]'
      )}
      style={{
        backgroundColor: 'var(--sidebar-bg)',
        borderRight: '1px solid var(--sidebar-border)',
      }}
    >
      {/* Logo + collapse toggle */}
      <div
        className={cn(
          'flex h-10 items-center shrink-0',
          collapsed ? 'justify-center px-0' : 'justify-between px-3'
        )}
        style={{ borderBottom: '1px solid var(--sidebar-border)' }}
      >
        {!collapsed && (
          <div className="flex items-center gap-2">
            <Image src="/logos/icon-white.svg" alt="Polytology" width={14} height={14} priority />
            <span
              className="font-mono text-[11px] font-bold tracking-[0.05em] uppercase"
              style={{ color: 'var(--accent)' }}
            >
              POLYTOLOGY
            </span>
          </div>
        )}
        {collapsed && (
          <Image src="/logos/icon-white.svg" alt="Polytology" width={14} height={14} priority />
        )}

        {!collapsed && (
          <button
            onClick={() => onCollapsedChange(!collapsed)}
            className="flex h-5 w-5 items-center justify-center transition-colors"
            style={{ color: 'var(--sidebar-text)' }}
            onMouseEnter={e => (e.currentTarget.style.color = 'var(--sidebar-text-active)')}
            onMouseLeave={e => (e.currentTarget.style.color = 'var(--sidebar-text)')}
            title="Collapse sidebar"
          >
            <ChevronLeft className="h-3 w-3" />
          </button>
        )}

        {collapsed && (
          <button
            onClick={() => onCollapsedChange(!collapsed)}
            className="absolute -right-3 top-3 flex h-5 w-5 items-center justify-center transition-colors"
            style={{
              backgroundColor: 'var(--sidebar-bg)',
              border: '1px solid var(--sidebar-border)',
              color: 'var(--sidebar-text)',
            }}
            onMouseEnter={e => (e.currentTarget.style.color = 'var(--sidebar-text-active)')}
            onMouseLeave={e => (e.currentTarget.style.color = 'var(--sidebar-text)')}
            title="Expand sidebar"
          >
            <ChevronRight className="h-3 w-3" />
          </button>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-2">
        {NAV_ITEMS.map(({ id, label, icon: Icon }) => {
          const isActive = active === id;
          return (
            <button
              key={id}
              onClick={() => onChange(id)}
              title={collapsed ? label : undefined}
              className={cn(
                'relative flex w-full items-center transition-all duration-100',
                collapsed ? 'justify-center h-9 px-0' : 'gap-2.5 px-3 py-2'
              )}
              style={{
                backgroundColor: isActive ? 'rgba(245,158,11,0.06)' : 'transparent',
                color: isActive ? 'var(--sidebar-text-active)' : 'var(--sidebar-text)',
              }}
              onMouseEnter={e => {
                if (!isActive) {
                  e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.03)';
                  e.currentTarget.style.color = 'var(--sidebar-text-active)';
                }
              }}
              onMouseLeave={e => {
                if (!isActive) {
                  e.currentTarget.style.backgroundColor = 'transparent';
                  e.currentTarget.style.color = 'var(--sidebar-text)';
                }
              }}
            >
              {/* Amber left border when active */}
              {isActive && (
                <span
                  className="absolute left-0 top-0 bottom-0 w-0.5"
                  style={{ backgroundColor: 'var(--accent)' }}
                />
              )}

              <Icon
                className="h-3.5 w-3.5 shrink-0"
                style={{ color: isActive ? 'var(--accent)' : 'inherit' }}
              />

              {!collapsed && (
                <span className="font-mono text-[11px] font-medium truncate">{label}</span>
              )}
            </button>
          );
        })}
      </nav>

      {/* Session status at bottom */}
      <div
        className="shrink-0 p-2"
        style={{ borderTop: '1px solid var(--sidebar-border)' }}
      >
        {authenticated ? (
          <div
            className={cn(
              'flex items-center',
              collapsed ? 'justify-center' : 'gap-2 px-2 py-1.5'
            )}
          >
            <div
              className="h-1.5 w-1.5 rounded-full shrink-0"
              style={{ backgroundColor: sessionColor }}
            />
            {!collapsed && displayAddress && (
              <span className="text-[10px] font-mono truncate" style={{ color: 'var(--sidebar-text)' }}>
                {displayAddress}
              </span>
            )}
          </div>
        ) : (
          <div
            className={cn(
              'flex items-center',
              collapsed ? 'justify-center' : 'gap-2 px-2 py-1.5'
            )}
          >
            <div className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: '#4a4a5a' }} />
            {!collapsed && (
              <span className="text-[10px] font-mono" style={{ color: 'var(--sidebar-text)' }}>
                Not connected
              </span>
            )}
          </div>
        )}
      </div>
    </aside>
  );
}
