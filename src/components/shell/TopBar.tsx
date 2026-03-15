'use client';

import { useEffect, useRef, useState } from 'react';
import { usePrivy } from '@privy-io/react-auth';
import { LogIn, LogOut, Settings, Copy, Check, LayoutDashboard, BarChart2, Blocks, Database, Activity, ArrowDownToLine, Loader2, AlertCircle, CheckCircle2 } from 'lucide-react';
import Image from 'next/image';
import { NotificationBell } from './NotificationBell';
import { usePolymarketSession } from '@/hooks/usePolymarketSession';
import { useWalletBalance } from '@/hooks/useWalletBalance';
import type { TabId } from './AppTabs';

const NAV_ITEMS: { id: TabId; label: string; icon: React.ElementType }[] = [
  { id: 'Dashboard',    label: 'Dashboard',    icon: LayoutDashboard },
  { id: 'Intelligence', label: 'Intelligence', icon: BarChart2 },
  { id: 'Builder',      label: 'Builder',      icon: Blocks },
  { id: 'Sources',      label: 'Sources',      icon: Database },
  { id: 'Executing',    label: 'Executing',    icon: Activity },
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
  const { status, safeAddress, eoaAddress, fundSafe } = usePolymarketSession();
  const [copied, setCopied] = useState(false);

  // Track both balances separately
  const safeBalance = useWalletBalance(authenticated && safeAddress ? safeAddress : null);
  const eoaBalance  = useWalletBalance(authenticated && eoaAddress  ? eoaAddress  : null);

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

  // ── Fund Safe popover ──────────────────────────────────────────
  const [fundOpen, setFundOpen] = useState(false);
  const [fundAmount, setFundAmount] = useState('');
  const [fundState, setFundState] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [fundError, setFundError] = useState('');
  const fundRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!fundOpen) return;
    function handleClick(e: MouseEvent) {
      if (fundRef.current && !fundRef.current.contains(e.target as Node)) {
        setFundOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [fundOpen]);

  const handleFund = async () => {
    const amount = parseFloat(fundAmount);
    if (!amount || amount <= 0) { setFundError('Enter a valid amount'); return; }
    if (amount > eoaBalance.usdce) { setFundError(`Max available: $${eoaBalance.usdce.toFixed(2)}`); return; }
    setFundState('loading');
    setFundError('');
    try {
      await fundSafe(amount);
      setFundState('success');
      setFundAmount('');
      setTimeout(() => { setFundOpen(false); setFundState('idle'); }, 2500);
    } catch (e) {
      setFundState('error');
      const msg = e instanceof Error ? e.message : String(e);
      setFundError(
        msg.toLowerCase().includes('insufficient') || msg.toLowerCase().includes('gas')
          ? 'Needs a tiny bit of POL on your EOA for gas (~$0.01). Get POL from any exchange.'
          : msg.length > 120 ? msg.slice(0, 120) + '…' : msg
      );
    }
  };

  const fmtUsd = (n: number) =>
    `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

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
            {/* Wallet pill: address + safe balance */}
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
              <span className="h-3 w-px shrink-0" style={{ backgroundColor: 'var(--border-strong)' }} />
              {/* Safe balance */}
              <span className="font-mono tabular-nums" style={{ color: safeBalance.loading ? 'var(--text-tertiary)' : 'var(--accent)' }}>
                {safeBalance.loading ? '…' : fmtUsd(safeBalance.usdce)}
              </span>
              {safeAddress && (
                <span className="font-mono text-[9px]" style={{ color: 'var(--text-tertiary)' }}>safe</span>
              )}
              {copied ? (
                <Check className="h-2.5 w-2.5 text-green-400 shrink-0" />
              ) : (
                <Copy className="h-2.5 w-2.5 opacity-40 shrink-0" />
              )}
            </button>

            {/* Fund Safe button + popover — only shown when Safe exists */}
            {safeAddress && (
              <div className="relative" ref={fundRef}>
                <button
                  onClick={() => { setFundOpen(o => !o); setFundState('idle'); setFundError(''); }}
                  title="Fund Safe from your EOA wallet"
                  className="flex h-6 items-center gap-1 px-2 font-mono text-[10px] font-medium transition-colors"
                  style={{
                    border: '1px solid var(--border)',
                    backgroundColor: fundOpen ? 'rgba(34,197,94,0.08)' : 'var(--bg-elevated)',
                    color: fundOpen ? '#22c55e' : 'var(--text-tertiary)',
                  }}
                  onMouseEnter={e => {
                    e.currentTarget.style.borderColor = '#22c55e';
                    e.currentTarget.style.color = '#22c55e';
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.borderColor = 'var(--border)';
                    e.currentTarget.style.color = fundOpen ? '#22c55e' : 'var(--text-tertiary)';
                  }}
                >
                  <ArrowDownToLine className="h-2.5 w-2.5" />
                  Fund
                </button>

                {fundOpen && (
                  <div
                    className="absolute right-0 top-full mt-1 z-50 w-72 shadow-2xl"
                    style={{
                      backgroundColor: 'var(--bg-elevated)',
                      border: '1px solid var(--border-strong)',
                    }}
                  >
                    {/* Header */}
                    <div className="px-3 py-2.5" style={{ borderBottom: '1px solid var(--border)' }}>
                      <p className="font-mono text-[11px] font-bold" style={{ color: 'var(--text)' }}>
                        Fund Safe
                      </p>
                      <p className="font-mono text-[10px] mt-0.5" style={{ color: 'var(--text-tertiary)' }}>
                        Transfer USDC.e from your EOA to your trading wallet
                      </p>
                    </div>

                    {/* Balance rows */}
                    <div className="px-3 py-2 space-y-1.5" style={{ borderBottom: '1px solid var(--border)' }}>
                      <div className="flex items-center justify-between">
                        <span className="font-mono text-[10px]" style={{ color: 'var(--text-tertiary)' }}>
                          EOA wallet
                        </span>
                        <span className="font-mono text-[11px] tabular-nums" style={{ color: eoaBalance.usdce > 0 ? 'var(--text)' : 'var(--text-tertiary)' }}>
                          {eoaBalance.loading ? '…' : fmtUsd(eoaBalance.usdce)} USDC.e
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="font-mono text-[10px]" style={{ color: 'var(--text-tertiary)' }}>
                          Safe (trading)
                        </span>
                        <span className="font-mono text-[11px] tabular-nums" style={{ color: safeBalance.usdce > 0 ? '#22c55e' : 'var(--text-tertiary)' }}>
                          {safeBalance.loading ? '…' : fmtUsd(safeBalance.usdce)} USDC.e
                        </span>
                      </div>
                    </div>

                    {/* Transfer form */}
                    <div className="px-3 py-2.5 space-y-2">
                      {fundState === 'success' ? (
                        <div className="flex items-center gap-2 py-1">
                          <CheckCircle2 className="h-3.5 w-3.5 shrink-0" style={{ color: '#22c55e' }} />
                          <span className="font-mono text-[11px]" style={{ color: '#22c55e' }}>
                            Transfer confirmed!
                          </span>
                        </div>
                      ) : (
                        <>
                          <div className="flex gap-1.5">
                            <input
                              type="number"
                              placeholder="Amount"
                              value={fundAmount}
                              onChange={e => { setFundAmount(e.target.value); setFundError(''); }}
                              disabled={fundState === 'loading'}
                              className="flex-1 h-7 px-2 font-mono text-[11px] bg-transparent outline-none"
                              style={{
                                border: '1px solid var(--border-strong)',
                                color: 'var(--text)',
                              }}
                              onKeyDown={e => e.key === 'Enter' && handleFund()}
                            />
                            <button
                              onClick={() => setFundAmount(eoaBalance.usdce.toFixed(2))}
                              className="h-7 px-2 font-mono text-[10px] transition-opacity hover:opacity-70"
                              style={{
                                border: '1px solid var(--border)',
                                color: 'var(--text-tertiary)',
                              }}
                            >
                              Max
                            </button>
                          </div>
                          <button
                            onClick={handleFund}
                            disabled={fundState === 'loading' || !fundAmount}
                            className="w-full h-7 font-mono text-[11px] font-semibold flex items-center justify-center gap-1.5 transition-opacity"
                            style={{
                              backgroundColor: '#22c55e',
                              color: '#000',
                              opacity: fundState === 'loading' || !fundAmount ? 0.5 : 1,
                            }}
                          >
                            {fundState === 'loading' ? (
                              <>
                                <Loader2 className="h-3 w-3 animate-spin" />
                                Sending…
                              </>
                            ) : (
                              <>
                                <ArrowDownToLine className="h-3 w-3" />
                                Send to Safe
                              </>
                            )}
                          </button>
                          {fundError && (
                            <div className="flex items-start gap-1.5">
                              <AlertCircle className="h-3 w-3 shrink-0 mt-0.5" style={{ color: '#ef4444' }} />
                              <p className="font-mono text-[10px] leading-relaxed" style={{ color: '#ef4444' }}>
                                {fundError}
                              </p>
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}

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
