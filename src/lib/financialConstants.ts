// ─── FBA Financial Constants ───────────────────────────────────────────────────
//
// All numeric assumptions used in financial calculations.
// Change here — everything updates everywhere.
//
// Why these numbers:
//   REFERRAL_RATE 0.15  — Amazon charges 15% of selling price across most
//                         general merchandise categories (8%–45% range exists,
//                         15% is the correct central estimate for FBA analysis).
//   FBA_FEE_RATE  0.15  — Rough approximation of FBA fulfillment fees as a % of
//                         selling price. Real fees are weight+size-based; this is
//                         directionally accurate for standard-size items $10–$40.
//                         Use api.calculateFBA() for precise per-product fees.
//   FREIGHT_RATE  0.35  — Covers sea freight, customs duty, prep, and inland
//                         delivery. Real cost = use the Freight Estimator.
//   NET_REVENUE_MULT    — Fraction of selling price available after Amazon fees.
//   ROUGH_LANDED_MULT   — Multiply unit cost by this for a pre-freight landed
//                         cost estimate (unit cost + ~35% freight overhead).

export const FIN = {
  REFERRAL_RATE:      0.15,
  FBA_FEE_RATE:       0.15,
  FREIGHT_RATE:       0.35,

  // Derived — do not edit directly
  TOTAL_FEE_RATE:     0.30,           // REFERRAL + FBA
  NET_REVENUE_MULT:   0.70,           // 1 - TOTAL_FEE_RATE
  ROUGH_LANDED_MULT:  1.35,           // 1 + FREIGHT_RATE

  // Decision thresholds
  MARGIN_EXCELLENT:   30,
  MARGIN_ACCEPTABLE:  20,
  MARGIN_FLOOR:       10,
  ROI_EXCELLENT:      50,
  ROI_ACCEPTABLE:     20,
  MOQ_LOW:            300,
  REVIEWS_LOW:        200,
  REVIEWS_MEDIUM:     500,

  // Sales estimation
  // Assumptions: ~3% review rate (buyers who leave reviews), adjusted by competition
  // meaning high-competition products are older, so same reviews = fewer monthly sales
  REVIEW_RATE:              0.03,
  MONTHS_ON_MARKET_LOW:     18,   // Low competition: newer/niche product
  MONTHS_ON_MARKET_MEDIUM:  28,   // Medium: established market
  MONTHS_ON_MARKET_HIGH:    42,   // High: mature saturated market

  // Confidence band widths around the central estimate.
  // Applied as: low = mid×band×0.7, high = mid×(2 − band×0.7).
  // LOW  → roughly −61% / +61% spread (wider, lower confidence)
  // HIGH → roughly −51% / +51% spread (narrower, higher confidence)
  SALES_BAND_LOW:     0.55,
  SALES_BAND_HIGH:    0.70,

  // PPC pressure thresholds (based on review count)
  PPC_LOW_REVIEWS:    150,
  PPC_HIGH_REVIEWS:   500,

  // FBA fee tiers (price-based proxy for size/weight)
  FBA_FEE_TIER_1_MAX:  12,   // very small/light → ~$3.50 flat
  FBA_FEE_TIER_2_MAX:  20,   // small standard   → ~$4.50
  FBA_FEE_TIER_3_MAX:  35,   // standard         → ~$5.50
  FBA_FEE_TIER_4_MAX:  60,   // large standard   → ~$7.00
  // >$60 → heavy/oversized → ~$10+

  // Startup capital buffer recommendation (% on top of inventory + freight)
  CAPITAL_BUFFER_PCT:  0.25,  // 25% buffer for PPC, returns, misc
} as const;

export const CATEGORY_REFERRAL_RATES: Record<string, number> = {
  'Books':           0.45,
  'Music':           0.25,
  'Video':           0.25,
  'Software':        0.15,
  'Video Games':     0.15,
  'Electronics':     0.08,
  'Cameras':         0.08,
  'Shoes':           0.15,
  'Clothing':        0.17,
  'Jewelry':         0.20,
  'Watches':         0.16,
  'Beauty':          0.15,
  'Health':          0.15,
  'Pet Supplies':    0.15,
  'Home & Kitchen':  0.15,
  'Sports':          0.15,
  'Toys':            0.15,
  'Tools':           0.15,
  'Automotive':      0.12,
  'Supplements':     0.15,
  'Baby':            0.15,
  'Grocery':         0.08,
};

export function getCategoryReferralRate(category: string | undefined): number {
  if (!category) return FIN.REFERRAL_RATE;
  const key = Object.keys(CATEGORY_REFERRAL_RATES).find(k =>
    category.toLowerCase().includes(k.toLowerCase())
  );
  return key ? CATEGORY_REFERRAL_RATES[key] : FIN.REFERRAL_RATE;
}

export type CapitalBufferPreset = 'conservative' | 'standard' | 'aggressive';

export const CAPITAL_BUFFER_PRESETS: Record<CapitalBufferPreset, { pct: number; label: string; description: string }> = {
  conservative: { pct: 0.45, label: 'Conservative',  description: '45% buffer — recommended for first-time sellers' },
  standard:     { pct: 0.25, label: 'Standard',       description: '25% buffer — experienced sellers with known demand' },
  aggressive:   { pct: 0.15, label: 'Aggressive',     description: '15% buffer — only with strong demand data' },
};
