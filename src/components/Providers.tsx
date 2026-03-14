'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { WagmiProvider } from 'wagmi';
import { PrivyProvider } from '@privy-io/react-auth';
import { Toaster } from 'sonner';
import { config } from '@/lib/wagmi';
import { NotificationProvider } from '@/lib/notifications';
import { LivePricesProvider } from '@/lib/LivePricesContext';
import { useState, type ReactNode } from 'react';

export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(() => new QueryClient());

  return (
    <PrivyProvider
      appId={process.env.NEXT_PUBLIC_PRIVY_APP_ID!}
      config={{
        appearance: {
          theme: 'dark',
          accentColor: '#2E5CFF',
          logo: '/logos/icon-white.svg',
        },
        embeddedWallets: {
          ethereum: {
            createOnLogin: 'users-without-wallets',
          },
        },
        defaultChain: {
          id: 137,
          name: 'Polygon',
          nativeCurrency: { name: 'POL', symbol: 'POL', decimals: 18 },
          rpcUrls: {
            default: {
              http: [process.env.NEXT_PUBLIC_POLYGON_RPC_URL || 'https://polygon-rpc.com'],
            },
          },
        },
        supportedChains: [
          {
            id: 137,
            name: 'Polygon',
            nativeCurrency: { name: 'POL', symbol: 'POL', decimals: 18 },
            rpcUrls: {
              default: {
                http: [process.env.NEXT_PUBLIC_POLYGON_RPC_URL || 'https://polygon-rpc.com'],
              },
            },
          },
        ],
      }}
    >
      <WagmiProvider config={config}>
        <QueryClientProvider client={queryClient}>
          <NotificationProvider>
            <LivePricesProvider>
            {children}
            </LivePricesProvider>
            <Toaster
              position="bottom-right"
              toastOptions={{
                style: {
                  background: 'rgba(12, 12, 20, 0.95)',
                  border: '1px solid rgba(255,255,255,0.08)',
                  color: '#E2E2EA',
                  backdropFilter: 'blur(24px)',
                  boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
                },
                descriptionClassName: 'text-white/50',
                className: 'font-sans',
              }}
            />
          </NotificationProvider>
        </QueryClientProvider>
      </WagmiProvider>
    </PrivyProvider>
  );
}
