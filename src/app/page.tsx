'use client';

import { useState, useCallback } from 'react';
import { TopBar } from '@/components/shell/TopBar';
import type { TabId } from '@/components/shell/AppTabs';
import { DashboardTab } from '@/components/dashboard/DashboardTab';
import { PolymarketIntelligenceTab } from '@/components/intelligence/PolymarketIntelligenceTab';
import { AutonomousBuilderTab } from '@/components/builder/AutonomousBuilderTab';
import { ExecutingTradesTab } from '@/components/executing/ExecutingTradesTab';
import { UsersTab } from '@/components/users/UsersTab';
import { DataSourcesTab } from '@/components/data-sources/DataSourcesTab';
import { OnboardingFlow } from '@/components/onboarding/OnboardingFlow';
import { useStrategies, useExecutingTrades } from '@/lib/store';
import { usePolymarketSession } from '@/hooks/usePolymarketSession';

const TAB_STORAGE_KEY = 'polymarket-active-tab';
const VALID_TABS: TabId[] = ['Dashboard', 'Intelligence', 'Builder', 'Sources', 'Executing', 'Users'];

function getPersistedTab(): TabId {
  if (typeof window === 'undefined') return 'Dashboard';
  const stored = localStorage.getItem(TAB_STORAGE_KEY);
  if (stored && VALID_TABS.includes(stored as TabId)) return stored as TabId;
  return 'Dashboard';
}

export default function Home() {
  const [tab, setTab] = useState<TabId>(getPersistedTab);
  const [showOnboarding, setShowOnboarding] = useState(false);

  const handleTabChange = useCallback((next: TabId) => {
    setTab(next);
    localStorage.setItem(TAB_STORAGE_KEY, next);
  }, []);

  const { eoaAddress } = usePolymarketSession();
  const { strategies, addStrategy, updateStrategy, removeStrategy } = useStrategies(eoaAddress);
  const { trades, runtimes, usingRealData, updateTradeStatus, pauseStrategy, stopStrategy } = useExecutingTrades(eoaAddress, tab === 'Executing');

  return (
    <div className="flex h-screen flex-col overflow-hidden" style={{ backgroundColor: 'var(--bg)' }}>
      <TopBar
        activeTab={tab}
        onTabChange={handleTabChange}
        onSetupWallet={() => setShowOnboarding(true)}
      />

        <OnboardingFlow open={showOnboarding} onClose={() => setShowOnboarding(false)} />

      <main
        className="flex-1 min-h-0"
        style={
          tab === 'Intelligence' || tab === 'Dashboard'
            ? { overflow: 'hidden', display: 'flex', flexDirection: 'column', padding: tab === 'Dashboard' ? '12px 16px' : undefined }
            : { padding: '12px 16px', overflowY: 'auto' }
        }
      >
        {tab === 'Dashboard' && (
          <DashboardTab onNavigateToIntelligence={() => handleTabChange('Intelligence')} />
        )}
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
  );
}
