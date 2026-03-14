'use client';

import { useState, useCallback } from 'react';
import { TopBar } from '@/components/shell/TopBar';
import { Sidebar } from '@/components/shell/Sidebar';
import type { TabId } from '@/components/shell/AppTabs';
import { PolymarketIntelligenceTab } from '@/components/intelligence/PolymarketIntelligenceTab';
import { AutonomousBuilderTab } from '@/components/builder/AutonomousBuilderTab';
import { ExecutingTradesTab } from '@/components/executing/ExecutingTradesTab';
import { UsersTab } from '@/components/users/UsersTab';
import { DataSourcesTab } from '@/components/data-sources/DataSourcesTab';
import { OnboardingFlow } from '@/components/onboarding/OnboardingFlow';
import { useStrategies, useExecutingTrades } from '@/lib/store';
import { usePolymarketSession } from '@/hooks/usePolymarketSession';

const TAB_STORAGE_KEY = 'polymarket-active-tab';
const VALID_TABS: TabId[] = ['Intelligence', 'Builder', 'Sources', 'Executing', 'Users'];
const COLLAPSED_STORAGE_KEY = 'polymarket-sidebar-collapsed';

function getPersistedTab(): TabId {
  if (typeof window === 'undefined') return 'Intelligence';
  const stored = localStorage.getItem(TAB_STORAGE_KEY);
  if (stored && VALID_TABS.includes(stored as TabId)) return stored as TabId;
  return 'Intelligence';
}

function getPersistedCollapsed(): boolean {
  if (typeof window === 'undefined') return false;
  return localStorage.getItem(COLLAPSED_STORAGE_KEY) === 'true';
}

const PAGE_TITLES: Record<TabId, string> = {
  Intelligence: 'Markets',
  Builder: 'Strategy Builder',
  Sources: 'Data Sources',
  Executing: 'Trades',
  Users: 'Users',
};

export default function Home() {
  const [tab, setTab] = useState<TabId>(getPersistedTab);
  const [sidebarCollapsed, setSidebarCollapsed] = useState<boolean>(getPersistedCollapsed);
  const [showOnboarding, setShowOnboarding] = useState(false);

  const handleTabChange = useCallback((next: TabId) => {
    setTab(next);
    localStorage.setItem(TAB_STORAGE_KEY, next);
  }, []);

  const handleCollapseChange = useCallback((c: boolean) => {
    setSidebarCollapsed(c);
    localStorage.setItem(COLLAPSED_STORAGE_KEY, String(c));
  }, []);

  const { eoaAddress } = usePolymarketSession();
  const { strategies, addStrategy, updateStrategy, removeStrategy } = useStrategies(eoaAddress);
  const { trades, runtimes, usingRealData, updateTradeStatus, pauseStrategy, stopStrategy } = useExecutingTrades(eoaAddress, tab === 'Executing');

  return (
    <div className="min-h-screen" style={{ backgroundColor: 'var(--bg)' }}>
      <Sidebar
        active={tab}
        onChange={handleTabChange}
        collapsed={sidebarCollapsed}
        onCollapsedChange={handleCollapseChange}
      />

      {/* Main area — offset by sidebar */}
      <div
        className="flex flex-col transition-all duration-200"
        style={{
          marginLeft: sidebarCollapsed ? '3rem' : '200px',
          minHeight: '100vh',
        }}
      >
        <TopBar
          pageTitle={PAGE_TITLES[tab]}
          onSetupWallet={() => setShowOnboarding(true)}
        />

        <OnboardingFlow open={showOnboarding} onClose={() => setShowOnboarding(false)} />

        <main
          className="flex-1"
          style={
            tab === 'Intelligence'
              ? { overflow: 'hidden', display: 'flex', flexDirection: 'column' }
              : { padding: '12px 16px' }
          }
        >
          {tab === 'Intelligence' && <PolymarketIntelligenceTab />}
          {tab === 'Builder' && (
            <AutonomousBuilderTab
              strategies={strategies}
              onAddStrategy={addStrategy}
              onUpdateStrategy={updateStrategy}
              onRemoveStrategy={removeStrategy}
              onNavigateToSources={() => handleTabChange('Sources')}
            />
          )}
          {tab === 'Executing' && (
            <ExecutingTradesTab
              trades={trades}
              runtimes={runtimes}
              usingRealData={usingRealData}
              onUpdateTradeStatus={updateTradeStatus}
              onPauseStrategy={pauseStrategy}
              onStopStrategy={stopStrategy}
            />
          )}
          {tab === 'Sources' && <DataSourcesTab />}
          {tab === 'Users' && <UsersTab />}
        </main>
      </div>
    </div>
  );
}
