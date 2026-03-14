'use client';

import { RulesTab } from '@/components/rules/RulesTab';
import type { AutonomousStrategy } from '@/lib/types';

interface AutonomousBuilderTabProps {
  strategies: AutonomousStrategy[];
  onAddStrategy: (s: AutonomousStrategy) => void;
  onUpdateStrategy: (id: string, updates: Partial<AutonomousStrategy>) => void;
  onRemoveStrategy: (id: string) => void;
  onNavigateToSources?: () => void;
}

export function AutonomousBuilderTab({ onNavigateToSources }: AutonomousBuilderTabProps) {
  return <RulesTab onNavigateToSources={onNavigateToSources} />;
}
