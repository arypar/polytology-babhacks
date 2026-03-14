'use client';

import { useState, useCallback } from 'react';
import { TopBar } from '@/components/shell/TopBar';
import { AppTabs, type TabId } from '@/components/shell/AppTabs';
import { PolymarketIntelligenceTab } from '@/components/intelligence/PolymarketIntelligenceTab';
import { AutonomousBuilderTab } from '@/components/builder/AutonomousBuilderTab';
import { PolymarketFeedTab } from '@/components/feed/PolymarketFeedTab';
import { ExecutingTradesTab } from '@/components/executing/ExecutingTradesTab';
import { useStrategies, useExecutingTrades } from '@/lib/store';

const TAB_STORAGE_KEY = 'polymarket-active-tab';
const VALID_TABS: TabId[] = ['Intelligence', 'Builder', 'Feed', 'Executing'];

function getPersistedTab(): TabId {
  if (typeof window === 'undefined') return 'Intelligence';
  const stored = localStorage.getItem(TAB_STORAGE_KEY);
  if (stored && VALID_TABS.includes(stored as TabId)) return stored as TabId;
  return 'Intelligence';
}

export default function Home() {
  const [tab, setTab] = useState<TabId>(getPersistedTab);

  const handleTabChange = useCallback((next: TabId) => {
    setTab(next);
    localStorage.setItem(TAB_STORAGE_KEY, next);
  }, []);

  const { strategies, addStrategy, updateStrategy, removeStrategy } = useStrategies();
  const { trades, runtimes, updateTradeStatus, pauseStrategy, stopStrategy } = useExecutingTrades();

  return (
    <div className="min-h-screen bg-background">
      <div className="flex flex-col min-h-screen">
        <TopBar>
          <AppTabs active={tab} onChange={handleTabChange} />
        </TopBar>

        <main className={tab === 'Feed' ? 'flex-1 overflow-hidden' : 'mx-auto w-full max-w-7xl px-6 py-8 flex-1'}>
          {tab === 'Intelligence' && <PolymarketIntelligenceTab />}
          {tab === 'Builder' && (
            <AutonomousBuilderTab
              strategies={strategies}
              onAddStrategy={addStrategy}
              onUpdateStrategy={updateStrategy}
              onRemoveStrategy={removeStrategy}
            />
          )}
          {tab === 'Feed' && <PolymarketFeedTab />}
          {tab === 'Executing' && (
            <ExecutingTradesTab
              trades={trades}
              runtimes={runtimes}
              onUpdateTradeStatus={updateTradeStatus}
              onPauseStrategy={pauseStrategy}
              onStopStrategy={stopStrategy}
            />
          )}
        </main>
      </div>
    </div>
  );
}
