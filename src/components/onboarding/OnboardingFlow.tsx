'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle2, Loader2, Shield, Coins, Wallet, X } from 'lucide-react';
import { usePolymarketSession } from '@/hooks/usePolymarketSession';
import { cn } from '@/lib/utils';

interface OnboardingFlowProps {
  open: boolean;
  onClose: () => void;
}

type Step = 0 | 1 | 2 | 3;

const STEPS = [
  {
    id: 0,
    icon: Wallet,
    title: 'Connect wallet',
    description: 'Sign in to create your embedded wallet. No seed phrase needed — Privy handles it securely.',
    action: 'Sign in',
    color: '#2E5CFF',
  },
  {
    id: 1,
    icon: Shield,
    title: 'Deploy Safe',
    description: 'A Gnosis Safe is deployed as your trading account. Completely gasless — Polymarket covers it.',
    action: 'Deploy Safe',
    color: '#00C853',
  },
  {
    id: 2,
    icon: Coins,
    title: 'Approve tokens',
    description: 'One-time approval for USDC.e and outcome tokens. This lets Polymarket execute orders from your Safe.',
    action: 'Approve tokens',
    color: '#FFB300',
  },
  {
    id: 3,
    icon: CheckCircle2,
    title: 'Ready to trade',
    description: 'Your wallet is set up. You can now buy YES/NO shares on any market.',
    action: 'Start trading',
    color: '#2E5CFF',
  },
] as const;

function StepIcon({
  step,
  currentStep,
  isLoading,
}: {
  step: (typeof STEPS)[number];
  currentStep: Step;
  isLoading: boolean;
}) {
  const Icon = step.icon;
  const isDone = currentStep > step.id;
  const isActive = currentStep === step.id;

  return (
    <motion.div
      className={cn(
        'relative flex h-10 w-10 shrink-0 items-center justify-center rounded-full border transition-colors duration-300',
        isDone
          ? 'border-yes/40 bg-yes/10'
          : isActive
          ? 'border-white/20 bg-white/[0.06]'
          : 'border-white/[0.06] bg-transparent'
      )}
      animate={isActive && !isLoading ? { scale: [1, 1.04, 1] } : { scale: 1 }}
      transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
    >
      {isDone ? (
        <CheckCircle2 className="h-4.5 w-4.5 text-yes" style={{ width: 18, height: 18 }} />
      ) : isActive && isLoading ? (
        <Loader2 className="h-4 w-4 animate-spin" style={{ color: step.color }} />
      ) : (
        <Icon
          style={{ width: 16, height: 16, color: isActive ? step.color : 'rgba(255,255,255,0.2)' }}
        />
      )}
    </motion.div>
  );
}

export function OnboardingFlow({ open, onClose }: OnboardingFlowProps) {
  const { status, error, login, deploySafe, approveTokens, eoaAddress, safeAddress } =
    usePolymarketSession();
  const [loading, setLoading] = useState(false);
  const [stepError, setStepError] = useState<string | null>(null);

  // Map session status → wizard step
  const currentStep: Step =
    status === 'idle'
      ? 0
      : status === 'wallet-ready'
      ? 1
      : status === 'safe-deploying'
      ? 1
      : status === 'approving'
      ? 2
      : status === 'ready'
      ? 3
      : 0;

  const isStepLoading =
    loading || status === 'safe-deploying' || status === 'approving';

  useEffect(() => {
    setStepError(error);
  }, [error]);

  const handleAction = async () => {
    setStepError(null);
    try {
      if (currentStep === 0) {
        login();
        return;
      }
      if (currentStep === 1) {
        setLoading(true);
        await deploySafe();
        return;
      }
      if (currentStep === 2) {
        setLoading(true);
        await approveTokens();
        return;
      }
      if (currentStep === 3) {
        onClose();
        return;
      }
    } catch (e) {
      setStepError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            className="fixed inset-0 z-[90] bg-black/60 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={currentStep === 3 ? onClose : undefined}
          />

          {/* Modal */}
          <motion.div
            className="fixed inset-0 z-[91] flex items-center justify-center p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              className="relative w-full max-w-md rounded-xl border border-white/[0.08] bg-[#0D0D14] p-6 shadow-2xl"
              initial={{ scale: 0.95, y: 16 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.96, y: 8 }}
              transition={{ type: 'spring', stiffness: 300, damping: 24 }}
            >
              {/* Close */}
              <button
                onClick={onClose}
                className="absolute right-4 top-4 flex h-7 w-7 items-center justify-center rounded-md text-white/30 transition-colors hover:bg-white/[0.06] hover:text-white/70"
              >
                <X className="h-4 w-4" />
              </button>

              {/* Header */}
              <div className="mb-6">
                <p className="text-[10px] font-medium uppercase tracking-[0.12em] text-white/30 mb-1">
                  Wallet setup
                </p>
                <h2 className="text-[18px] font-semibold tracking-[-0.02em] text-white">
                  Set up your trading account
                </h2>
                <p className="mt-1 text-[13px] text-white/45">
                  One-time setup to trade on Polymarket. All transactions are gasless.
                </p>
              </div>

              {/* Steps */}
              <div className="space-y-1 mb-6">
                {STEPS.map((step, i) => {
                  const isDone = currentStep > step.id;
                  const isActive = currentStep === step.id;
                  const isFuture = currentStep < step.id;

                  return (
                    <div key={step.id}>
                      <div
                        className={cn(
                          'flex items-start gap-3 rounded-lg p-3 transition-colors duration-200',
                          isActive && 'bg-white/[0.04]',
                          isFuture && 'opacity-35'
                        )}
                      >
                        <StepIcon
                          step={step}
                          currentStep={currentStep}
                          isLoading={isActive && isStepLoading}
                        />
                        <div className="min-w-0 flex-1 pt-0.5">
                          <p
                            className="text-[13px] font-medium"
                            style={{
                              color: isDone
                                ? 'rgba(255,255,255,0.5)'
                                : isActive
                                ? '#fff'
                                : 'rgba(255,255,255,0.3)',
                            }}
                          >
                            {step.title}
                          </p>
                          {isActive && (
                            <motion.p
                              className="mt-0.5 text-[12px] text-white/40 leading-relaxed"
                              initial={{ opacity: 0, height: 0 }}
                              animate={{ opacity: 1, height: 'auto' }}
                              exit={{ opacity: 0, height: 0 }}
                            >
                              {step.description}
                              {isActive && eoaAddress && step.id === 0 && (
                                <span className="mt-1 block font-mono text-[11px] text-white/30">
                                  {eoaAddress.slice(0, 8)}…{eoaAddress.slice(-6)}
                                </span>
                              )}
                              {isActive && safeAddress && step.id >= 1 && (
                                <span className="mt-1 block font-mono text-[11px] text-white/30">
                                  Safe: {safeAddress.slice(0, 8)}…{safeAddress.slice(-6)}
                                </span>
                              )}
                            </motion.p>
                          )}
                        </div>
                        {isDone && (
                          <span className="text-[10px] font-medium text-yes/70 mt-1">Done</span>
                        )}
                      </div>
                      {i < STEPS.length - 1 && (
                        <div className="ml-8 h-4 w-px bg-white/[0.06]" />
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Error */}
              {stepError && (
                <div className="mb-4 rounded-md border border-no/20 bg-no/10 px-3 py-2 text-[12px] text-no/80">
                  {stepError.length > 120 ? stepError.slice(0, 120) + '…' : stepError}
                </div>
              )}

              {/* CTA */}
              <button
                onClick={handleAction}
                disabled={isStepLoading}
                className={cn(
                  'w-full rounded-lg py-3 text-[14px] font-semibold transition-all duration-150',
                  currentStep === 3
                    ? 'bg-yes text-white hover:bg-yes/90'
                    : 'bg-[#2E5CFF] text-white hover:bg-[#2E5CFF]/90',
                  isStepLoading && 'opacity-60 cursor-not-allowed'
                )}
              >
                {isStepLoading ? (
                  <span className="flex items-center justify-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    {currentStep === 1 ? 'Deploying Safe…' : 'Approving tokens…'}
                  </span>
                ) : (
                  STEPS[currentStep].action
                )}
              </button>

              {/* Progress dots */}
              <div className="mt-4 flex justify-center gap-1.5">
                {STEPS.map((s) => (
                  <motion.div
                    key={s.id}
                    className="rounded-full"
                    animate={{
                      width: currentStep === s.id ? 20 : 6,
                      height: 6,
                      backgroundColor:
                        currentStep > s.id
                          ? 'rgba(0,200,83,0.5)'
                          : currentStep === s.id
                          ? '#2E5CFF'
                          : 'rgba(255,255,255,0.1)',
                    }}
                    transition={{ type: 'spring', stiffness: 400, damping: 25 }}
                  />
                ))}
              </div>
            </motion.div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
