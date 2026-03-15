'use client';

import { useEffect, useState } from 'react';
import { usePrivy } from '@privy-io/react-auth';
import { LogIn, LogOut, Settings, Copy, Check, LayoutDashboard, BarChart2, Blocks, Database, Activity, Users2 } from 'lucide-react';
import Image from 'next/image';
import { NotificationBell } from './NotificationBell';
import { usePolymarketSession } from '@/hooks/usePolymarketSession';
import type { TabId } from './AppTabs';

const NAV_ITEMS: { id: TabId; label: string; icon: React.ElementType }[] = [
  { id: 'Dashboard',    label: 'Dashboard',    icon: LayoutDashboard },
  { id: 'Intelligence', label: 'Intelligence', icon: BarChart2 },
  { id: 'Builder',      label: 'Builder',      icon: Blocks },
  { id: 'Sources',      label: 'Sources',      icon: Database },
  { id: 'Executing',    label: 'Executing',    icon: Activity },
  { id: 'Users',        label: 'Users',        icon: Users2 },
];

interface TopBarProps {
  activeTab: TabId;
  onTabChange: (tab: TabId) => void;
  onSetupWallet?: () => void;
}

function LiveClock() {
  const [time, setTime] = useState('');

  useEffect(() => {
    function tick() {
      const now = new Date();
      setTime(
        now.toLocaleTimeString('en-US', {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: false,
        })
      );
    }
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  return (
    <span className="font-mono text-[11px] tracking-wider" style={{ color: 'var(--text-tertiary)' }}>
      {time}
    </span>
  );
}

export function TopBar({ activeTab, onTabChange, onSetupWallet }: TopBarProps) {
  const { login, logout, authenticated, user } = usePrivy();
  const { status, safeAddress, eoaAddress } = usePolymarketSession();
  const [copied, setCopied] = useState(false);

  const embeddedWallet = user?.linkedAccounts?.find(
    (a) => a.type === 'wallet' && a.walletClientType === 'privy'
  ) as { address?: string } | undefined;

  const displayAddress = safeAddress
    ? `${safeAddress.slice(0, 6)}…${safeAddress.slice(-4)}`
    : embeddedWallet?.address
    ? `${embeddedWallet.address.slice(0, 6)}…${embeddedWallet.address.slice(-4)}`
    : null;

  const copyAddress = () => {
    const addr = safeAddress ?? eoaAddress;
    if (!addr) return;
    navigator.clipboard.writeText(addr).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const isSetupNeeded = authenticated && status !== 'ready' && status !== 'idle';

  return (
    <header
      className="sticky top-0 z-30 flex h-11 items-center gap-0 px-0 shrink-0"
      style={{
        backgroundColor: 'var(--bg-elevated)',
        borderBottom: '1px solid var(--border)',
      }}
    >
      {/* Logo + brand */}
      <div
        className="flex h-full items-center gap-2 px-4 shrink-0"
        style={{ borderRight: '1px solid var(--border)' }}
      >
        <Image src="/logos/icon-white.svg" alt="Polytology" width={13} height={13} priority />
        <span
          className="font-mono text-[11px] font-bold tracking-[0.06em] uppercase"
          style={{ color: 'var(--accent)' }}
        >
          POLYTOLOGY
        </span>
      </div>

      {/* Nav tabs */}
      <nav className="flex h-full items-stretch">
        {NAV_ITEMS.map(({ id, label, icon: Icon }) => {
          const isActive = activeTab === id;
          return (
            <button
              key={id}
              onClick={() => onTabChange(id)}
              className="relative flex h-full items-center gap-1.5 px-3.5 transition-colors"
              style={{
                backgroundColor: isActive ? 'rgba(245,158,11,0.06)' : 'transparent',
                color: isActive ? 'var(--accent)' : 'var(--text-tertiary)',
                borderRight: '1px solid var(--border)',
              }}
              onMouseEnter={e => {
                if (!isActive) {
                  e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.03)';
                  e.currentTarget.style.color = 'var(--text-secondary)';
                }
              }}
              onMouseLeave={e => {
                if (!isActive) {
                  e.currentTarget.style.backgroundColor = 'transparent';
                  e.currentTarget.style.color = 'var(--text-tertiary)';
                }
              }}
            >
              {/* Active bottom indicator */}
              {isActive && (
                <span
                  className="absolute bottom-0 left-0 right-0 h-0.5"
                  style={{ backgroundColor: 'var(--accent)' }}
                />
              )}
              <Icon className="h-3 w-3 shrink-0" />
              <span className="font-mono text-[10px] font-medium">{label}</span>
            </button>
          );
        })}
      </nav>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Right controls */}
      <div
        className="flex h-full items-center gap-1.5 px-3"
        style={{ borderLeft: '1px solid var(--border)' }}
      >
        {/* Live clock */}
        <LiveClock />

        <span className="h-3 w-px" style={{ backgroundColor: 'var(--border-strong)' }} />

        <NotificationBell />

        <span className="h-3 w-px" style={{ backgroundColor: 'var(--border)' }} />

        {/* Setup wallet nudge */}
        {isSetupNeeded && onSetupWallet && (
          <button
            onClick={onSetupWallet}
            className="flex h-6 items-center gap-1.5 px-2 font-mono text-[10px] font-medium transition-colors"
            style={{
              border: '1px solid rgba(245,158,11,0.3)',
              backgroundColor: 'rgba(245,158,11,0.06)',
              color: 'var(--accent)',
            }}
            onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'rgba(245,158,11,0.12)')}
            onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'rgba(245,158,11,0.06)')}
          >
            <Settings className="h-2.5 w-2.5" />
            Setup wallet
          </button>
        )}

        {/* Auth */}
        {!authenticated ? (
          <button
            onClick={login}
            className="flex h-6 items-center gap-1.5 px-2.5 font-mono text-[10px] font-medium transition-colors"
            style={{
              border: '1px solid var(--border-strong)',
              backgroundColor: 'var(--bg-elevated)',
              color: 'var(--text-secondary)',
            }}
            onMouseEnter={e => {
              e.currentTarget.style.borderColor = 'var(--accent)';
              e.currentTarget.style.color = 'var(--accent)';
            }}
            onMouseLeave={e => {
              e.currentTarget.style.borderColor = 'var(--border-strong)';
              e.currentTarget.style.color = 'var(--text-secondary)';
            }}
          >
            <LogIn className="h-2.5 w-2.5" />
            Sign in
          </button>
        ) : (
          <div className="flex items-center gap-1">
            <button
              onClick={copyAddress}
              title={safeAddress ? `Copy Safe address: ${safeAddress}` : 'Copy address'}
              className="flex h-6 items-center gap-1.5 px-2.5 font-mono text-[10px] transition-colors"
              style={{
                border: '1px solid var(--border)',
                backgroundColor: 'var(--bg-elevated)',
                color: 'var(--text-secondary)',
              }}
              onMouseEnter={e => {
                e.currentTarget.style.borderColor = 'var(--border-strong)';
                e.currentTarget.style.color = 'var(--text-primary)';
              }}
              onMouseLeave={e => {
                e.currentTarget.style.borderColor = 'var(--border)';
                e.currentTarget.style.color = 'var(--text-secondary)';
              }}
            >
              <div
                className="h-1.5 w-1.5 shrink-0"
                style={{ backgroundColor: status === 'ready' ? '#22c55e' : '#1652F0' }}
              />
              <span>{displayAddress ?? 'Connected'}</span>
              {copied ? (
                <Check className="h-2.5 w-2.5 text-green-400 shrink-0" />
              ) : (
                <Copy className="h-2.5 w-2.5 opacity-40 shrink-0" />
              )}
            </button>
            <button
              onClick={logout}
              title="Sign out"
              className="flex h-6 w-6 items-center justify-center transition-colors"
              style={{
                border: '1px solid var(--border)',
                backgroundColor: 'var(--bg-elevated)',
                color: 'var(--text-tertiary)',
              }}
              onMouseEnter={e => {
                e.currentTarget.style.borderColor = '#ef4444';
                e.currentTarget.style.color = '#ef4444';
              }}
              onMouseLeave={e => {
                e.currentTarget.style.borderColor = 'var(--border)';
                e.currentTarget.style.color = 'var(--text-tertiary)';
              }}
            >
              <LogOut className="h-2.5 w-2.5" />
            </button>
          </div>
        )}
      </div>
    </header>
  );
}
