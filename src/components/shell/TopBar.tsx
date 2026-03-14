'use client';

import { useEffect, useState } from 'react';
import { usePrivy } from '@privy-io/react-auth';
import { LogIn, LogOut, Settings } from 'lucide-react';
import { NotificationBell } from './NotificationBell';
import { usePolymarketSession } from '@/hooks/usePolymarketSession';

interface TopBarProps {
  pageTitle: string;
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

export function TopBar({ pageTitle, onSetupWallet }: TopBarProps) {
  const { login, logout, authenticated, user } = usePrivy();
  const { status } = usePolymarketSession();

  const embeddedWallet = user?.linkedAccounts?.find(
    (a) => a.type === 'wallet' && a.walletClientType === 'privy'
  ) as { address?: string } | undefined;

  const displayAddress = embeddedWallet?.address
    ? `${embeddedWallet.address.slice(0, 6)}…${embeddedWallet.address.slice(-4)}`
    : null;

  const isSetupNeeded = authenticated && status !== 'ready';

  return (
    <header
      className="sticky top-0 z-30 flex h-10 items-center gap-3 px-3"
      style={{
        backgroundColor: 'var(--bg-elevated)',
        borderBottom: '1px solid var(--border)',
      }}
    >
      {/* Page title */}
      <span
        className="font-mono text-[11px] font-semibold tracking-wide"
        style={{ color: 'var(--accent)' }}
      >
        {pageTitle}
      </span>

      {/* Divider */}
      <span className="h-3 w-px" style={{ backgroundColor: 'var(--border-strong)' }} />

      {/* Live clock */}
      <LiveClock />

      {/* Spacer */}
      <div className="flex-1" />

      {/* Right controls */}
      <div className="flex items-center gap-1.5">
        <NotificationBell />

        {/* Divider */}
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
            <div
              className="flex h-6 items-center gap-1.5 px-2.5 font-mono text-[10px]"
              style={{
                border: '1px solid var(--border)',
                backgroundColor: 'var(--bg-elevated)',
                color: 'var(--text-secondary)',
              }}
            >
              <div
                className="h-1.5 w-1.5"
                style={{ backgroundColor: status === 'ready' ? '#22c55e' : '#1652F0' }}
              />
              <span>{displayAddress ?? 'Connected'}</span>
            </div>
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
