"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useRouter } from "next/navigation";
import Image from "next/image";

type Scene = "titleDrop" | "theHook" | "pillarsReveal" | "launchCta";

const SCENES: Scene[] = ["titleDrop", "theHook", "pillarsReveal", "launchCta"];

const SCENE_DURATIONS: Record<Scene, number | null> = {
  titleDrop: 7000,
  theHook: 8000,
  pillarsReveal: 10000,
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

function ProgressBar({ sceneIndex, total }: { sceneIndex: number; total: number }) {
  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2">
      {Array.from({ length: total }).map((_, i) => {
        const isActive = sceneIndex === i;
        const isDone = sceneIndex > i;
        return (
          <motion.div
            key={i}
            className="rounded-full"
            style={{
              background: isActive ? "#2E5CFF" : isDone ? "rgba(255,255,255,0.3)" : "rgba(255,255,255,0.1)",
              boxShadow: isActive ? "0 0 10px rgba(46,92,255,0.5)" : "none",
            }}
            initial={false}
            animate={{ width: isActive ? 28 : 8, height: 8 }}
            transition={{ type: "spring", stiffness: 400, damping: 25 }}
          />
        );
      })}
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
            The science of prediction markets
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
            <h2 className="text-3xl sm:text-5xl font-bold text-center leading-tight" style={{ color: "#FFFFFF", letterSpacing: "-0.02em" }}>
              Most traders react.<br />
              <span style={{ color: "rgba(255,255,255,0.3)" }}>You could be ahead.</span>
            </h2>
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
  const router = useRouter();
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
      <motion.button
        onClick={() => router.push("/")}
        className="absolute top-5 right-6 z-50 text-[11px] uppercase tracking-[0.2em] transition-colors cursor-pointer"
        style={{ color: "rgba(255,255,255,0.35)" }}
        whileHover={{ color: "rgba(255,255,255,0.6)" }}
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1 }}
      >
        Skip →
      </motion.button>

      <div className="absolute top-5 left-6 z-50">
        <motion.div className="text-[10px] uppercase tracking-widest font-mono"
          style={{ color: "rgba(255,255,255,0.15)" }}
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1 }}>
          {sceneIndex + 1}/{SCENES.length}
        </motion.div>
      </div>

      <div className="flex-1 relative">
        <AnimatePresence mode="wait">
          {scene === "titleDrop" && <TitleDropScene key="titleDrop" />}
          {scene === "theHook" && <TheHookScene key="theHook" />}
          {scene === "pillarsReveal" && <PillarsRevealScene key="pillarsReveal" />}
          {scene === "launchCta" && <LaunchCtaScene key="launchCta" />}
        </AnimatePresence>
      </div>

      <ProgressBar sceneIndex={sceneIndex} total={SCENES.length} />
    </div>
  );
}
