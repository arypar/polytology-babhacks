import { Router } from 'express';

const router = Router();

// ── Helpers ───────────────────────────────────────────────────

function clamp(val: number, min: number, max: number) {
  return Math.max(min, Math.min(max, val));
}

function randWalk(current: number, step: number, min: number, max: number, decimals = 2) {
  const delta = (Math.random() - 0.5) * 2 * step;
  return parseFloat(clamp(current + delta, min, max).toFixed(decimals));
}

// ── Feed 1: Market Signals ────────────────────────────────────
// Simulates an internal scoring API that tracks market momentum,
// volume anomalies, and trend strength for prediction markets.

const sig = {
  momentum: 0.62,
  volume_ratio: 1.8,
  trend_strength: 0.55,
  reversal_risk: 0.28,
};

setInterval(() => {
  sig.momentum      = randWalk(sig.momentum,      0.04, 0.0, 1.0);
  sig.volume_ratio  = randWalk(sig.volume_ratio,  0.15, 0.5, 5.0);
  sig.trend_strength= randWalk(sig.trend_strength,0.03, 0.0, 1.0);
  sig.reversal_risk = randWalk(sig.reversal_risk, 0.03, 0.0, 1.0);
}, 2500);

router.get('/demo/market-signals', (_req, res) => {
  res.json({
    feed: 'market-signals',
    timestamp: Date.now(),
    signals: {
      momentum:        parseFloat(sig.momentum.toFixed(3)),
      volume_ratio:    parseFloat(sig.volume_ratio.toFixed(2)),
      trend_strength:  parseFloat(sig.trend_strength.toFixed(3)),
      reversal_risk:   parseFloat(sig.reversal_risk.toFixed(3)),
    },
    meta: {
      description: 'Polytology internal market scoring signals',
      update_interval_ms: 2500,
    },
  });
});

// ── Feed 2: BTC Momentum ──────────────────────────────────────
// Simulates a crypto data provider returning BTC technicals.
// Useful for testing numeric threshold conditions.

const btc = {
  price: 84_200,
  change_24h: 1.4,
  rsi_14: 58.2,
  funding_rate: 0.0012,
  long_short_ratio: 1.32,
};

setInterval(() => {
  btc.price          = randWalk(btc.price,          800, 60_000, 120_000, 0);
  btc.change_24h     = randWalk(btc.change_24h,     0.3,  -8,    8,       2);
  btc.rsi_14         = randWalk(btc.rsi_14,         1.2, 20,    80,      1);
  btc.funding_rate   = randWalk(btc.funding_rate,   0.0002, -0.005, 0.005, 4);
  btc.long_short_ratio = randWalk(btc.long_short_ratio, 0.05, 0.5, 3.0, 2);
}, 3000);

router.get('/demo/btc-momentum', (_req, res) => {
  res.json({
    asset: 'BTC',
    price_usd: btc.price,
    change_24h_pct: btc.change_24h,
    technicals: {
      rsi_14: btc.rsi_14,
      funding_rate: btc.funding_rate,
      long_short_ratio: btc.long_short_ratio,
    },
    signal: btc.rsi_14 > 70 ? 'overbought' : btc.rsi_14 < 30 ? 'oversold' : 'neutral',
    timestamp: Date.now(),
  });
});

// ── Feed 3: Prediction Market Fear/Greed ─────────────────────
// Simulates a sentiment index (0–100) specific to prediction markets.
// Tracks crowd confidence, liquidity depth, and whale activity.

const fg = {
  index: 55,
  liquidity_score: 0.68,
  whale_activity: 0.34,
  crowd_confidence: 0.58,
};

setInterval(() => {
  fg.index            = randWalk(fg.index,            3,   0, 100, 0);
  fg.liquidity_score  = randWalk(fg.liquidity_score,  0.03, 0, 1.0);
  fg.whale_activity   = randWalk(fg.whale_activity,   0.04, 0, 1.0);
  fg.crowd_confidence = randWalk(fg.crowd_confidence, 0.03, 0, 1.0);
}, 2000);

function fearGreedLabel(i: number) {
  if (i <= 20) return 'Extreme Fear';
  if (i <= 40) return 'Fear';
  if (i <= 60) return 'Neutral';
  if (i <= 80) return 'Greed';
  return 'Extreme Greed';
}

router.get('/demo/fear-greed', (_req, res) => {
  const idx = Math.round(fg.index);
  res.json({
    feed: 'prediction-market-sentiment',
    index: idx,
    label: fearGreedLabel(idx),
    components: {
      liquidity_score:  parseFloat(fg.liquidity_score.toFixed(3)),
      whale_activity:   parseFloat(fg.whale_activity.toFixed(3)),
      crowd_confidence: parseFloat(fg.crowd_confidence.toFixed(3)),
    },
    timestamp: Date.now(),
  });
});

export default router;
