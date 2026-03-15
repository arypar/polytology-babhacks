"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { Wallet, Shield, Coins, CheckCircle2, Loader2, DollarSign, ExternalLink } from "lucide-react";
import { usePolymarketSession } from "@/hooks/usePolymarketSession";
import { useFunding } from "@/hooks/useFunding";

type Scene = "titleDrop" | "theHook" | "pillarsReveal" | "walletSetup" | "launchCta";

const SCENES: Scene[] = ["titleDrop", "theHook", "pillarsReveal", "walletSetup", "launchCta"];

const SCENE_DURATIONS: Record<Scene, number | null> = {
  titleDrop: 7000,
  theHook: 8000,
  pillarsReveal: 10000,
  walletSetup: null,
  launchCta: null,
};

const pageTransition = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  exit: { opacity: 0, transition: { duration: 0.2 } },
};

const PILLARS = [
  {
    id: "intelligence",
    title: "Intelligence",
    quote: "Real-time market data, probability charts, and top movers — all streaming live.",
    tags: ["Live Markets", "Charts", "Top Movers"],
    color: "#2E5CFF",
    colorRgb: "46,92,255",
  },
  {
    id: "builder",
    title: "Strategy Builder",
    quote: "Drag and drop blocks to build autonomous trading strategies. No code needed.",
    tags: ["Drag & Drop", "Triggers", "Automation"],
    color: "#00C853",
    colorRgb: "0,200,83",
  },
  {
    id: "feed",
    title: "Polymarket Feed",
    quote: "Scroll through top markets like a social feed. Swipe to trade instantly.",
    tags: ["Feed", "Quick Trade", "Trending"],
    color: "#FF3D57",
    colorRgb: "255,61,87",
  },
  {
    id: "executing",
    title: "Autonomous Trades",
    quote: "Watch your strategies execute in real time. Live P&L, win rates, and logs.",
    tags: ["Live Execution", "P&L", "Monitoring"],
    color: "#FFB300",
    colorRgb: "255,179,0",
  },
];

function seededRandom(seed: number) {
  const x = Math.sin(seed * 9301 + 49297) * 49297;
  return x - Math.floor(x);
}

function FloatingParticles({ count = 10, seed = 0 }: { count?: number; seed?: number }) {
  const particles = useMemo(
    () =>
      Array.from({ length: count }).map((_, i) => ({
        x: Math.round(seededRandom(seed + i * 7) * 100),
        y: Math.round(seededRandom(seed + i * 13) * 100),
        size: Math.round(seededRandom(seed + i * 19) * 3 + 2),
        delay: Math.round(seededRandom(seed + i * 23) * 60) / 10,
        duration: Math.round(seededRandom(seed + i * 29) * 80 + 100) / 10,
        drift: Math.round((seededRandom(seed + i * 37) - 0.5) * 60),
      })),
    [count, seed]
  );

  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden z-0">
      {particles.map((p, i) => (
        <motion.div
          key={i}
          className="absolute rounded-full"
          style={{
            left: `${p.x}%`,
            top: `${p.y}%`,
            width: p.size,
            height: p.size,
            backgroundColor: "#2E5CFF",
            boxShadow: `0 0 ${p.size * 2}px rgba(46,92,255,0.5)`,
          }}
          initial={{ opacity: 0 }}
          animate={{
            opacity: [0, 0.12, 0.06, 0.12, 0],
            y: [0, p.drift, -p.drift, 0],
          }}
          transition={{
            duration: p.duration,
            delay: p.delay,
            repeat: Infinity,
            ease: "linear",
          }}
        />
      ))}
    </div>
  );
}


function TitleDropScene() {
  const [phase, setPhase] = useState<"pre" | "slam" | "shake" | "settled">("pre");

  useEffect(() => {
    const t0 = requestAnimationFrame(() => setPhase("slam"));
    const t1 = setTimeout(() => setPhase("shake"), 600);
    const t2 = setTimeout(() => setPhase("settled"), 1100);
    return () => { cancelAnimationFrame(t0); clearTimeout(t1); clearTimeout(t2); };
  }, []);

  return (
    <motion.div
      initial={{ opacity: 1 }}
      animate={phase === "shake" ? { x: [0, -10, 12, -8, 6, -3, 1, 0], y: [0, 6, -5, 8, -6, 3, -1, 0] } : { x: 0, y: 0 }}
      transition={phase === "shake" ? { duration: 0.5, ease: "easeOut" } : {}}
      className="flex flex-col items-center justify-center h-full relative"
    >
      <FloatingParticles count={15} seed={42} />

      <AnimatePresence>
        {phase === "shake" && (
          <motion.div
            className="absolute inset-0 z-30 pointer-events-none"
            style={{ background: "white" }}
            initial={{ opacity: 0.4 }}
            animate={{ opacity: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.35 }}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {(phase === "shake" || phase === "settled") && (
          <motion.div
            className="absolute rounded-full z-10 pointer-events-none"
            style={{ border: "2px solid rgba(46,92,255,0.3)" }}
            initial={{ width: 0, height: 0, opacity: 0.7 }}
            animate={{ width: 1200, height: 1200, opacity: 0 }}
            transition={{ duration: 1.2, ease: "easeOut" }}
          />
        )}
      </AnimatePresence>

      <motion.div
        className="relative z-20 mb-6"
        initial={{ y: -600, scale: 4, opacity: 0 }}
        animate={phase === "pre" ? { y: -600, scale: 4, opacity: 0 } : { y: 0, scale: 1, opacity: 1 }}
        transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
      >
        <Image src="/logos/icon-white.svg" alt="Polymarket" width={72} height={72} />
      </motion.div>

      <AnimatePresence>
        {phase === "settled" && (
          <motion.h1
            className="text-5xl sm:text-7xl font-bold tracking-tight z-20 text-center"
            style={{ color: "#FFFFFF", letterSpacing: "-0.03em" }}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7 }}
          >
            Poly<span style={{ color: "#2E5CFF" }}>tology</span>
          </motion.h1>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {phase === "settled" && (
          <motion.p
            className="text-base sm:text-lg mt-4 z-20 text-center"
            style={{ color: "rgba(255,255,255,0.4)" }}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.3 }}
          >
            Predict. Automate. Win.
          </motion.p>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

function TheHookScene() {
  const [beat, setBeat] = useState(0);
  const [volume, setVolume] = useState(0);

  useEffect(() => {
    const t1 = setTimeout(() => setBeat(1), 1500);
    const t2 = setTimeout(() => setBeat(2), 4500);
    const t3 = setTimeout(() => setBeat(3), 6500);
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
  }, []);

  useEffect(() => {
    if (beat !== 1) return;
    const id = setInterval(() => {
      setVolume(v => {
        if (v >= 3800000000) { clearInterval(id); return 3800000000; }
        return Math.min(v + Math.floor(Math.random() * 120000000 + 40000000), 3800000000);
      });
    }, 50);
    return () => clearInterval(id);
  }, [beat]);

  return (
    <motion.div {...pageTransition} className="flex flex-col items-center justify-center h-full relative px-6">
      <FloatingParticles count={8} seed={99} />

      <AnimatePresence mode="wait">
        {beat === 0 && (
          <motion.div key="b0" className="flex flex-col items-center z-10"
            initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -30 }}
            transition={{ duration: 0.5 }}>
            <h2 className="text-3xl sm:text-5xl font-bold text-center leading-tight" style={{ color: "#FFFFFF", letterSpacing: "-0.02em" }}>
              Every day, billions flow<br />through prediction markets.
            </h2>
            <p className="text-base sm:text-lg mt-4 text-center" style={{ color: "rgba(255,255,255,0.3)" }}>
              Politics. Crypto. Sports. All priced in real-time.
            </p>
          </motion.div>
        )}

        {beat === 1 && (
          <motion.div key="b1" className="flex flex-col items-center z-10"
            initial={{ opacity: 0, scale: 0.6 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.8 }}
            transition={{ type: "spring", stiffness: 200, damping: 15 }}>
            <p className="text-xs uppercase tracking-[0.3em] mb-4" style={{ color: "rgba(255,255,255,0.25)" }}>
              daily trading volume
            </p>
            <span className="text-6xl sm:text-8xl font-bold tabular-nums" style={{ letterSpacing: "-3px", color: "#FFFFFF" }}>
              ${(volume / 1e9).toFixed(2)}B
            </span>
          </motion.div>
        )}

        {beat === 2 && (
          <motion.div key="b2" className="flex flex-col items-center z-10 px-4"
            initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -30 }}
            transition={{ duration: 0.5 }}>
            <h2 className="text-3xl sm:text-5xl font-bold text-center" style={{ color: "#FFFFFF", letterSpacing: "-0.02em", lineHeight: 1.15 }}>
              Most traders react.
            </h2>
            <motion.p
              className="text-5xl sm:text-7xl font-black text-center mt-3"
              style={{
                letterSpacing: "-0.04em",
                background: "linear-gradient(135deg, #2E5CFF 0%, #7B9FFF 50%, #2E5CFF 100%)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                backgroundClip: "text",
                backgroundSize: "200% 200%",
              }}
              initial={{ opacity: 0, y: 16, scale: 0.92 }}
              animate={{
                opacity: 1,
                y: 0,
                scale: 1,
                backgroundPosition: ["0% 50%", "100% 50%", "0% 50%"],
              }}
              transition={{
                opacity: { duration: 0.5, delay: 0.35 },
                y: { duration: 0.5, delay: 0.35 },
                scale: { duration: 0.5, delay: 0.35 },
                backgroundPosition: { duration: 4, repeat: Infinity, ease: "linear" },
              }}
            >
              You could be ahead.
            </motion.p>
          </motion.div>
        )}

        {beat === 3 && (
          <motion.div key="b3" className="flex flex-col items-center z-10 px-4"
            initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}
            transition={{ type: "spring", stiffness: 300, damping: 20 }}>
            <h2 className="text-3xl sm:text-5xl font-bold text-center leading-tight" style={{ color: "#FFFFFF", letterSpacing: "-0.02em" }}>
              See the signals.<br />
              <span style={{ color: "#2E5CFF" }}>Build strategies.</span><br />
              <span style={{ color: "#00C853" }}>Execute automatically.</span>
            </h2>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

function PillarsRevealScene() {
  const [visible, setVisible] = useState(false);
  const [activeIdx, setActiveIdx] = useState(-1);

  useEffect(() => {
    const t1 = setTimeout(() => { setVisible(true); setActiveIdx(0); }, 800);
    return () => clearTimeout(t1);
  }, []);

  useEffect(() => {
    if (activeIdx < 0 || activeIdx >= PILLARS.length - 1) return;
    const t = setTimeout(() => setActiveIdx(prev => prev + 1), 2000);
    return () => clearTimeout(t);
  }, [activeIdx]);

  return (
    <motion.div {...pageTransition} className="flex flex-col items-center justify-center h-full relative px-4 overflow-hidden">
      <FloatingParticles count={6} seed={200} />

      <motion.h2
        className="text-3xl sm:text-4xl font-bold z-10 mb-1 text-center"
        style={{ color: "#FFFFFF", letterSpacing: "-0.02em" }}
        initial={{ opacity: 0, y: -16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}>
        Four pillars of Polytology
      </motion.h2>
      <motion.p className="text-sm z-10 mb-8" style={{ color: "rgba(255,255,255,0.35)" }}
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.25 }}>
        Intelligence → Strategy → Feed → Execution
      </motion.p>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 z-10 w-full max-w-4xl px-2">
        {PILLARS.map((pillar, i) => {
          const isActive = activeIdx === i;
          const isDone = activeIdx > i;

          return (
            <motion.div
              key={pillar.id}
              className="relative rounded-lg overflow-hidden"
              style={{
                background: "rgba(255,255,255,0.03)",
                border: `1px solid ${isActive ? `rgba(${pillar.colorRgb},0.35)` : "rgba(255,255,255,0.07)"}`,
              }}
              initial={{ opacity: 0, y: 40, scale: 0.9 }}
              animate={{
                opacity: visible ? (isActive ? 1 : isDone ? 0.65 : 0.35) : 0,
                y: visible ? 0 : 40,
                scale: isActive ? 1.03 : 1,
              }}
              transition={{ delay: visible ? 0.1 + i * 0.15 : 0, type: "spring", stiffness: 250, damping: 20 }}
            >
              <div className="absolute top-0 inset-x-0 h-[2px]"
                style={{ background: `linear-gradient(90deg, transparent, ${pillar.color}, transparent)`, opacity: isActive ? 1 : 0.2, transition: "opacity 0.4s" }} />

              <div className="p-4">
                <div className="w-8 h-8 rounded-md flex items-center justify-center mb-3"
                  style={{ background: `rgba(${pillar.colorRgb}, 0.12)` }}>
                  <div className="w-3 h-3 rounded-sm" style={{ background: pillar.color }} />
                </div>
                <h3 className="text-sm font-bold mb-1.5"
                  style={{ color: isActive ? pillar.color : "rgba(255,255,255,0.6)", transition: "color 0.4s" }}>
                  {pillar.title}
                </h3>
                <p className="text-[11px] leading-relaxed mb-3"
                  style={{ color: isActive ? "rgba(255,255,255,0.55)" : "rgba(255,255,255,0.25)", transition: "color 0.4s" }}>
                  {pillar.quote}
                </p>
                <div className="flex gap-1 flex-wrap">
                  {pillar.tags.map(tag => (
                    <span key={tag} className="text-[9px] px-1.5 py-[2px] rounded font-medium"
                      style={{
                        background: isActive ? `rgba(${pillar.colorRgb}, 0.1)` : "rgba(255,255,255,0.04)",
                        color: isActive ? pillar.color : "rgba(255,255,255,0.25)",
                        transition: "all 0.4s",
                      }}>
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>
    </motion.div>
  );
}

// ─── Wallet Setup Scene ────────────────────────────────────────────────────────

const SETUP_STEPS = [
  {
    id: 0,
    icon: Wallet,
    title: "Connect wallet",
    description: "Sign in with email or social. Privy creates an embedded wallet — no seed phrase needed.",
    action: "Sign in",
    color: "#2E5CFF",
    colorRgb: "46,92,255",
  },
  {
    id: 1,
    icon: Shield,
    title: "Deploy Safe",
    description: "A Gnosis Safe is deployed as your trading account on Polygon. Completely gasless.",
    action: "Deploy Safe",
    color: "#00C853",
    colorRgb: "0,200,83",
  },
  {
    id: 2,
    icon: Coins,
    title: "Approve tokens",
    description: "One-time approval for USDC.e and outcome tokens so your Safe can execute orders.",
    action: "Approve tokens",
    color: "#FFB300",
    colorRgb: "255,179,0",
  },
  {
    id: 3,
    icon: CheckCircle2,
    title: "Ready to trade",
    description: "You're fully set up. We'll send $5 USDC to your Safe to get you started.",
    action: "Enter Polytology",
    color: "#00C853",
    colorRgb: "0,200,83",
  },
] as const;

function WalletSetupScene({ onComplete }: { onComplete: () => void }) {
  const { status, error, login, deploySafe, approveTokens, eoaAddress, safeAddress } = usePolymarketSession();
  const { fundingStatus, txHash } = useFunding(eoaAddress, safeAddress, status === "ready");
  const [loading, setLoading] = useState(false);
  const [stepError, setStepError] = useState<string | null>(null);
  const [readyDone, setReadyDone] = useState(false);

  useEffect(() => { setStepError(error); }, [error]);

  // Auto-advance once wallet is ready (after a brief "ready" moment)
  useEffect(() => {
    if (status === "ready" && !readyDone) {
      setReadyDone(true);
      const t = setTimeout(onComplete, 2200);
      return () => clearTimeout(t);
    }
  }, [status, readyDone, onComplete]);

  const currentStep =
    status === "idle" ? 0
    : status === "wallet-ready" ? 1
    : status === "safe-deploying" ? 1
    : status === "approving" ? 2
    : status === "ready" ? 3
    : 0;

  const isLoading = loading || status === "safe-deploying" || status === "approving";
  const step = SETUP_STEPS[currentStep];

  const handleAction = async () => {
    setStepError(null);
    try {
      if (currentStep === 0) { login(); return; }
      if (currentStep === 1) { setLoading(true); await deploySafe(); return; }
      if (currentStep === 2) { setLoading(true); await approveTokens(); return; }
      if (currentStep === 3) { onComplete(); return; }
    } catch (e) {
      setStepError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  };

  const getFundingLabel = () => {
    if (fundingStatus === "idle" || fundingStatus === "queuing") return "Queueing $5.00 USDC…";
    if (fundingStatus === "pending") return "$5.00 USDC queued · sending soon";
    if (fundingStatus === "processing") return "Sending $5.00 USDC to your Safe…";
    if (fundingStatus === "completed") return "$5.00 USDC sent to your Safe ✓";
    if (fundingStatus === "failed") return "Funding failed — contact support";
    return "$5.00 USDC will be sent to your Safe";
  };

  const fundingColor = fundingStatus === "completed" ? "#00C853" : fundingStatus === "failed" ? "#FF3D57" : "#2E5CFF";

  return (
    <motion.div
      {...pageTransition}
      className="flex flex-col items-center justify-center h-full relative px-6 overflow-hidden"
    >
      <FloatingParticles count={14} seed={555} />

      {/* Radial glow that shifts with step */}
      <motion.div
        className="absolute inset-0 pointer-events-none z-0"
        animate={{
          background: `radial-gradient(ellipse 55% 50% at 50% 50%, rgba(${step.colorRgb},0.08) 0%, transparent 70%)`,
        }}
        transition={{ duration: 0.6 }}
      />

      <div className="relative z-10 w-full max-w-lg">
        {/* Label + heading */}
        <motion.div
          className="text-center mb-10"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] mb-3" style={{ color: "rgba(255,255,255,0.25)" }}>
            One last thing
          </p>
          <h2 className="text-4xl sm:text-5xl font-bold tracking-[-0.03em] text-white mb-3">
            Set up your wallet.
          </h2>
          <p className="text-sm" style={{ color: "rgba(255,255,255,0.35)" }}>
            One-time setup · all transactions are gasless on Polygon
          </p>
        </motion.div>

        {/* Horizontal step indicators */}
        <motion.div
          className="flex items-center mb-8"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
        >
          {SETUP_STEPS.map((s, i) => {
            const isDone = currentStep > s.id;
            const isActive = currentStep === s.id;
            const Icon = s.icon;
            return (
              <div key={s.id} className="flex items-center flex-1">
                <div className="flex flex-col items-center flex-1 gap-1.5">
                  <motion.div
                    className="w-9 h-9 rounded-full border-2 flex items-center justify-center"
                    animate={{
                      borderColor: isDone ? "rgba(0,200,83,0.5)" : isActive ? `rgba(${s.colorRgb},0.4)` : "rgba(255,255,255,0.08)",
                      backgroundColor: isDone ? "rgba(0,200,83,0.1)" : isActive ? `rgba(${s.colorRgb},0.1)` : "transparent",
                      scale: isActive && !isLoading ? [1, 1.06, 1] : 1,
                    }}
                    transition={{ duration: isActive ? 2 : 0.4, repeat: isActive && !isLoading ? Infinity : 0 }}
                  >
                    {isDone ? (
                      <CheckCircle2 style={{ width: 16, height: 16, color: "#00C853" }} />
                    ) : isActive && isLoading ? (
                      <Loader2 style={{ width: 14, height: 14, color: s.color }} className="animate-spin" />
                    ) : (
                      <Icon style={{ width: 14, height: 14, color: isActive ? s.color : "rgba(255,255,255,0.2)" }} />
                    )}
                  </motion.div>
                  <span
                    className="text-[10px] font-medium text-center leading-tight"
                    style={{ color: isDone ? "rgba(255,255,255,0.4)" : isActive ? "#fff" : "rgba(255,255,255,0.18)" }}
                  >
                    {s.title}
                  </span>
                </div>
                {i < SETUP_STEPS.length - 1 && (
                  <motion.div
                    className="h-px w-6 shrink-0 mb-5"
                    animate={{ backgroundColor: isDone ? "rgba(0,200,83,0.4)" : "rgba(255,255,255,0.06)" }}
                    transition={{ duration: 0.5 }}
                  />
                )}
              </div>
            );
          })}
        </motion.div>

        {/* Active step card */}
        <AnimatePresence mode="wait">
          <motion.div
            key={currentStep}
            className="rounded-2xl border p-5 mb-5"
            style={{
              borderColor: `rgba(${step.colorRgb},0.25)`,
              background: `rgba(${step.colorRgb},0.05)`,
            }}
            initial={{ opacity: 0, y: 14, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -14, scale: 0.98 }}
            transition={{ duration: 0.25 }}
          >
            <div className="flex items-start gap-4">
              <div
                className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0"
                style={{ background: `rgba(${step.colorRgb},0.15)` }}
              >
                <step.icon style={{ width: 20, height: 20, color: step.color }} />
              </div>
              <div className="flex-1">
                <p className="text-[15px] font-bold text-white mb-1">{step.title}</p>
                <p className="text-[13px] leading-relaxed" style={{ color: "rgba(255,255,255,0.45)" }}>
                  {step.description}
                </p>
                {eoaAddress && currentStep === 0 && (
                  <p className="mt-2 font-mono text-[11px]" style={{ color: "rgba(255,255,255,0.22)" }}>
                    {eoaAddress.slice(0, 10)}…{eoaAddress.slice(-8)}
                  </p>
                )}
                {safeAddress && currentStep >= 1 && (
                  <p className="mt-2 font-mono text-[11px]" style={{ color: "rgba(255,255,255,0.22)" }}>
                    Safe: {safeAddress.slice(0, 10)}…{safeAddress.slice(-8)}
                  </p>
                )}
                {/* Funding badge on final step */}
                {currentStep === 3 && (
                  <motion.div
                    className="mt-3 inline-flex items-center gap-2 rounded-lg px-3 py-1.5"
                    style={{ background: `${fundingColor}14`, border: `1px solid ${fundingColor}28` }}
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 0.35 }}
                  >
                    <DollarSign style={{ width: 12, height: 12, color: fundingColor }} />
                    <span className="text-[12px] font-semibold" style={{ color: fundingColor }}>
                      {getFundingLabel()}
                    </span>
                    {(fundingStatus === "pending" || fundingStatus === "processing" || fundingStatus === "queuing") && (
                      <Loader2 style={{ width: 10, height: 10, color: fundingColor }} className="animate-spin" />
                    )}
                    {fundingStatus === "completed" && txHash && (
                      <a href={`https://polygonscan.com/tx/${txHash}`} target="_blank" rel="noreferrer">
                        <ExternalLink style={{ width: 10, height: 10, color: fundingColor }} />
                      </a>
                    )}
                  </motion.div>
                )}
              </div>
            </div>
          </motion.div>
        </AnimatePresence>

        {/* Error */}
        {stepError && (
          <div className="rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-2.5 text-[12px] text-red-400/80 mb-4">
            {stepError.length > 140 ? stepError.slice(0, 140) + "…" : stepError}
          </div>
        )}

        {/* CTA button */}
        <motion.button
          onClick={handleAction}
          disabled={isLoading}
          className="w-full rounded-xl text-[15px] font-bold text-white flex items-center justify-center gap-2"
          style={{
            padding: "14px",
            background: step.color,
            boxShadow: `0 4px 28px rgba(${step.colorRgb},0.3)`,
            opacity: isLoading ? 0.65 : 1,
            cursor: isLoading ? "not-allowed" : "pointer",
          }}
          whileHover={!isLoading ? { filter: "brightness(1.1)", y: -1 } : {}}
          whileTap={!isLoading ? { scale: 0.97 } : {}}
        >
          {isLoading ? (
            <>
              <Loader2 style={{ width: 16, height: 16 }} className="animate-spin" />
              {currentStep === 1 ? "Deploying Safe…" : "Approving tokens…"}
            </>
          ) : (
            step.action
          )}
        </motion.button>

        {/* Skip link */}
        <motion.button
          onClick={onComplete}
          className="w-full mt-4 text-[11px] uppercase tracking-[0.15em] transition-colors"
          style={{ color: "rgba(255,255,255,0.2)" }}
          whileHover={{ color: "rgba(255,255,255,0.5)" }}
        >
          Skip for now →
        </motion.button>
      </div>
    </motion.div>
  );
}

function LaunchCtaScene() {
  const router = useRouter();
  const enter = useCallback(() => { router.push("/"); }, [router]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Enter") enter(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [enter]);

  return (
    <motion.div {...pageTransition} className="flex flex-col items-center justify-center h-full relative overflow-hidden">
      <FloatingParticles count={18} seed={999} />

      <div className="absolute inset-0 pointer-events-none z-0"
        style={{ background: "radial-gradient(ellipse 70% 55% at 50% 45%, rgba(46,92,255,0.1) 0%, transparent 65%)" }} />

      <motion.div className="z-10 mb-6"
        initial={{ opacity: 0, scale: 0.5 }} animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.1, type: "spring", stiffness: 160, damping: 14 }}>
        <Image src="/logos/icon-white.svg" alt="Polytology" width={80} height={80} />
      </motion.div>

      <motion.h1
        className="text-4xl sm:text-5xl font-bold z-10 mb-2 text-center"
        style={{ color: "#FFFFFF", letterSpacing: "-0.03em" }}
        initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}
      >
        Poly<span style={{ color: "#2E5CFF" }}>tology</span>
      </motion.h1>

      <motion.p className="text-sm z-10 mb-10" style={{ color: "rgba(255,255,255,0.35)" }}
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.4 }}>
        Intelligence. Automation. Execution.
      </motion.p>

      <motion.button
        onClick={enter}
        initial={{ opacity: 0, scale: 0.85, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ delay: 0.5, type: "spring", stiffness: 200, damping: 15 }}
        whileHover={{ scale: 1.04, y: -2 }}
        whileTap={{ scale: 0.97 }}
        className="relative z-10 rounded-lg text-base font-semibold tracking-wide cursor-pointer"
        style={{
          padding: "14px 44px",
          background: "#2E5CFF",
          color: "white",
          border: "none",
          boxShadow: "0 4px 20px rgba(46,92,255,0.3)",
        }}
      >
        Enter Polytology
      </motion.button>

      <motion.p
        className="text-[10px] tracking-[0.3em] uppercase mt-5 z-10"
        style={{ color: "rgba(255,255,255,0.15)" }}
        initial={{ opacity: 0 }}
        animate={{ opacity: [0.1, 0.3, 0.1] }}
        transition={{ delay: 1, duration: 2.5, repeat: Infinity, ease: "easeInOut" }}
      >
        or press Enter
      </motion.p>
    </motion.div>
  );
}

export default function StartPage() {
  const [sceneIndex, setSceneIndex] = useState(0);
  const scene = SCENES[sceneIndex];

  const advance = useCallback(() => {
    setSceneIndex(prev => Math.min(prev + 1, SCENES.length - 1));
  }, []);

  const goBack = useCallback(() => {
    setSceneIndex(prev => Math.max(prev - 1, 0));
  }, []);

  useEffect(() => {
    const duration = SCENE_DURATIONS[scene];
    if (duration === null) return;
    const timer = setTimeout(advance, duration);
    return () => clearTimeout(timer);
  }, [scene, advance]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight" && sceneIndex < SCENES.length - 1) { e.preventDefault(); advance(); }
      if (e.key === "ArrowLeft" && sceneIndex > 0) { e.preventDefault(); goBack(); }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [sceneIndex, advance, goBack]);

  return (
    <div className="fixed inset-0 z-[100] flex flex-col overflow-hidden" style={{ background: "#07070E" }}>
      <div className="flex-1 relative">
        <AnimatePresence mode="wait">
          {scene === "titleDrop" && <TitleDropScene key="titleDrop" />}
          {scene === "theHook" && <TheHookScene key="theHook" />}
          {scene === "pillarsReveal" && <PillarsRevealScene key="pillarsReveal" />}
          {scene === "walletSetup" && <WalletSetupScene key="walletSetup" onComplete={advance} />}
          {scene === "launchCta" && <LaunchCtaScene key="launchCta" />}
        </AnimatePresence>
      </div>

    </div>
  );
}
