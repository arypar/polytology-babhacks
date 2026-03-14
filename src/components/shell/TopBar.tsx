'use client';

import { ConnectButton } from '@rainbow-me/rainbowkit';
import { Wallet } from 'lucide-react';
import { NotificationBell } from './NotificationBell';
import Image from 'next/image';

interface TopBarProps {
  children?: React.ReactNode;
}

export function TopBar({ children }: TopBarProps) {
  return (
    <header className="sticky top-0 z-50 border-b border-white/[0.08] bg-[#07070E]">
      <div className="mx-auto flex h-14 max-w-7xl items-stretch justify-between px-6">
        {/* Logo */}
        <div className="flex items-center gap-2.5 shrink-0">
          <Image
            src="/logos/icon-white.svg"
            alt="Polytology"
            width={24}
            height={24}
            priority
          />
          <span className="text-[15px] font-semibold tracking-[-0.02em] text-white leading-none">
            Polytology
          </span>
        </div>

        {/* Tabs — center, extends to bottom of header for underline alignment */}
        <div className="hidden sm:flex items-end">{children}</div>

        {/* Right actions */}
        <div className="flex items-center gap-2 shrink-0">
          <ConnectButton.Custom>
            {({ account, chain, openConnectModal, openAccountModal, mounted }) => {
              const connected = mounted && account && chain;
              return (
                <>
                  <NotificationBell />
                  <button
                    onClick={connected ? openAccountModal : openConnectModal}
                    className="flex h-8 items-center gap-2 rounded-md border border-white/[0.1] bg-white/[0.04] px-3 text-[13px] font-medium transition-colors hover:bg-white/[0.07] hover:border-white/[0.16]"
                  >
                    {connected ? (
                      <>
                        <div className="h-1.5 w-1.5 rounded-full bg-yes" />
                        <span className="text-white/75">{account.displayName}</span>
                      </>
                    ) : (
                      <>
                        <Wallet className="h-3.5 w-3.5 text-white/45" />
                        <span className="text-white/55">Connect</span>
                      </>
                    )}
                  </button>
                </>
              );
            }}
          </ConnectButton.Custom>
        </div>
      </div>

      {/* Mobile tabs */}
      <div className="flex justify-center sm:hidden border-t border-white/[0.04] py-2 overflow-x-auto">{children}</div>
    </header>
  );
}
