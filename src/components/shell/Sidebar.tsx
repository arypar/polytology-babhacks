'use client';

import { usePrivy } from '@privy-io/react-auth';
import { usePolymarketSession } from '@/hooks/usePolymarketSession';
import {
  BarChart2,
  Blocks,
  Rss,
  Activity,
  ChevronLeft,
  ChevronRight,
  Wallet,
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
  { id: 'Builder',      label: 'Builder',      icon: Blocks },
  { id: 'Feed',         label: 'Feed',         icon: Rss },
  { id: 'Executing',    label: 'Executing',    icon: Activity },
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

  return (
    <aside
      className={cn(
        'fixed left-0 top-0 z-40 flex h-screen flex-col transition-all duration-200',
        collapsed ? 'w-16' : 'w-64'
      )}
      style={{
        backgroundColor: 'var(--sidebar-bg)',
        borderRight: '1px solid var(--sidebar-border)',
      }}
    >
      {/* Logo + collapse toggle */}
      <div
        className={cn(
          'flex h-14 items-center border-b px-3 shrink-0',
          collapsed ? 'justify-center' : 'justify-between'
        )}
        style={{ borderColor: 'var(--sidebar-border)' }}
      >
        {!collapsed && (
          <div className="flex items-center gap-2">
            <Image src="/logos/icon-white.svg" alt="Polytology" width={20} height={20} priority />
            <span
              className="text-sm font-semibold tracking-[-0.02em] leading-none"
              style={{ color: 'var(--sidebar-text-active)' }}
            >
              Polytology
            </span>
          </div>
        )}
        {collapsed && (
          <Image src="/logos/icon-white.svg" alt="Polytology" width={20} height={20} priority />
        )}
        <button
          onClick={() => onCollapsedChange(!collapsed)}
          className={cn(
            'flex h-6 w-6 items-center justify-center rounded transition-colors',
            collapsed && 'mt-0'
          )}
          style={{ color: 'var(--sidebar-text)' }}
          onMouseEnter={e => (e.currentTarget.style.color = 'var(--sidebar-text-active)')}
          onMouseLeave={e => (e.currentTarget.style.color = 'var(--sidebar-text)')}
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {collapsed
            ? <ChevronRight className="h-3.5 w-3.5" />
            : <ChevronLeft className="h-3.5 w-3.5" />
          }
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-3 px-2">
        {!collapsed && (
          <p
            className="mb-1.5 px-2 font-mono text-[10px] font-semibold tracking-widest uppercase"
            style={{ color: 'var(--sidebar-text)', opacity: 0.45 }}
          >
            Navigation
          </p>
        )}

        <div className="space-y-0.5">
          {NAV_ITEMS.map(({ id, label, icon: Icon }) => {
            const isActive = active === id;
            return (
              <button
                key={id}
                onClick={() => onChange(id)}
                title={collapsed ? label : undefined}
                className={cn(
                  'relative flex w-full items-center rounded transition-all duration-150',
                  collapsed ? 'justify-center px-0 py-2' : 'gap-2 px-2 py-1.5',
                  isActive ? 'rounded' : ''
                )}
                style={{
                  backgroundColor: isActive ? 'var(--sidebar-bg-elevated)' : 'transparent',
                  color: isActive ? 'var(--sidebar-text-active)' : 'var(--sidebar-text)',
                }}
                onMouseEnter={e => {
                  if (!isActive) {
                    e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.04)';
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
                {/* Active left accent bar */}
                {isActive && (
                  <span
                    className="absolute left-0 top-1 bottom-1 w-0.5 rounded-r"
                    style={{ backgroundColor: 'var(--sidebar-accent)' }}
                  />
                )}
                <Icon
                  className="h-3.5 w-3.5 shrink-0"
                  style={{ color: isActive ? 'var(--sidebar-accent)' : 'inherit' }}
                />
                {!collapsed && (
                  <span className="text-xs font-medium">{label}</span>
                )}
              </button>
            );
          })}
        </div>
      </nav>

      {/* Wallet status at bottom */}
      <div
        className="shrink-0 border-t p-2"
        style={{ borderColor: 'var(--sidebar-border)' }}
      >
        {authenticated ? (
          <div
            className={cn(
              'flex items-center rounded px-2 py-1.5',
              collapsed ? 'justify-center' : 'gap-2'
            )}
            style={{ backgroundColor: 'var(--sidebar-bg-elevated)' }}
          >
            <div
              className="h-1.5 w-1.5 rounded-full shrink-0"
              style={{ backgroundColor: status === 'ready' ? '#16a34a' : '#d97706' }}
            />
            {!collapsed && (
              <span className="text-[10px] font-mono truncate" style={{ color: 'var(--sidebar-text)' }}>
                {displayAddress ?? 'Connected'}
              </span>
            )}
          </div>
        ) : (
          <div
            className={cn(
              'flex items-center rounded px-2 py-1.5',
              collapsed ? 'justify-center' : 'gap-2'
            )}
            title={collapsed ? 'Not connected' : undefined}
          >
            <Wallet className="h-3.5 w-3.5 shrink-0" style={{ color: 'var(--sidebar-text)' }} />
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
