// ─── Financial Engine ─────────────────────────────────────────────────────────
// All FBA profitability formulas in one place.
// Pure functions — no React, no side effects.

import { FIN } from './financialConstants';
import type { PipelineCostModel } from '../context/PipelineContext';

export interface FinancialValidationResult {
  valid: boolean;
  errors: string[];
}

export function validateFinancialInputs(
  sellingPrice: number,
  unitCost:     number,
  freight:      number,
  moq?:         number,
): FinancialValidationResult {
  const errors: string[] = [];
  if (!isFinite(sellingPrice) || sellingPrice <= 0) errors.push('Selling price must be greater than zero.');
  if (!isFinite(unitCost)     || unitCost <= 0)     errors.push('Unit cost must be greater than zero.');
  if (!isFinite(freight)      || freight < 0)       errors.push('Freight cost cannot be negative.');
  if (moq !== undefined && (!isFinite(moq) || moq <= 0)) errors.push('MOQ must be greater than zero.');
  return { valid: errors.length === 0, errors };
}

export function isDataStale(savedAt: string | undefined, maxDaysOld: number = 14): boolean {
  if (!savedAt) return false;
  const ageMs = Date.now() - new Date(savedAt).getTime();
  return ageMs > maxDaysOld * 24 * 60 * 60 * 1000;
}

// ── Rough estimates (before freight is confirmed) ─────────────────────────────
// Use these when showing preliminary signals in Validate or Sourcing.
// Always label results as "rough estimate" in the UI.

/** Unit cost × 1.35 — covers freight, duties, prep as a rough proxy. */
export function roughLandedCost(unitCost: number): number {
  return unitCost * FIN.ROUGH_LANDED_MULT;
}

/**
 * Quick margin signal before freight is known.
 * Assumes TOTAL_FEE_RATE of selling price goes to Amazon.
 */
export function roughMarginPct(sellingPrice: number, unitCost: number): number {
  if (sellingPrice <= 0) return 0;
  const netAfterFees = sellingPrice * FIN.NET_REVENUE_MULT;
  return ((netAfterFees - unitCost) / sellingPrice) * 100;
}

/**
 * Quick ROI signal before freight is known.
 * Net = selling price after fees minus unit cost (pre-freight).
 */
export function roughROIPct(sellingPrice: number, unitCost: number): number {
  if (unitCost <= 0) return 0;
  const net = sellingPrice * FIN.NET_REVENUE_MULT - unitCost;
  return (net / unitCost) * 100;
}

// ── Confirmed calculations (after freight is known) ───────────────────────────

/** Actual landed cost once freight per unit is confirmed. */
export function confirmedLandedCost(unitCost: number, freightPerUnit: number): number {
  return unitCost + freightPerUnit;
}

/**
 * Canonical FBA fulfillment fee (USD) from unit weight — the single source of
 * truth for fulfillment cost across the app (cost model + freight calculator).
 * US standard-size schedule; referral is charged separately by callers.
 * Real fees are weight+size based — this is directionally accurate for standard items.
 */
export function fbaFulfillmentFee(weightKg: number): number {
  const lb = Math.max(0, weightKg) * 2.205;
  if (lb <= 0.5) return 3.22;
  if (lb <= 1)   return 4.18;
  if (lb <= 2)   return 5.09;
  if (lb <= 3)   return 6.00;
  return parseFloat((6.00 + (lb - 3) * 0.50).toFixed(2));
}

/** Resolve the FBA fulfillment fee: weight-based when weight is known, else the
 *  price-percentage proxy (FBA_FEE_RATE) used before weight is available. */
function resolveFbaFee(sellingPrice: number, weightKg?: number): number {
  return weightKg != null ? fbaFulfillmentFee(weightKg) : sellingPrice * FIN.FBA_FEE_RATE;
}

/** Net profit per unit after Amazon fees (referral + FBA) and landed cost. */
export function netProfitPerUnit(
  sellingPrice: number,
  unitCost:     number,
  freightPerUnit: number,
  weightKg?:    number,
): number {
  const landed     = confirmedLandedCost(unitCost, freightPerUnit);
  const referral   = sellingPrice * FIN.REFERRAL_RATE;
  const fbaFee     = resolveFbaFee(sellingPrice, weightKg);
  return sellingPrice - landed - referral - fbaFee;
}

export function confirmedMarginPct(
  sellingPrice: number,
  unitCost:     number,
  freightPerUnit: number,
  weightKg?:    number,
): number {
  if (sellingPrice <= 0) return 0;
  return (netProfitPerUnit(sellingPrice, unitCost, freightPerUnit, weightKg) / sellingPrice) * 100;
}

export function confirmedROIPct(
  sellingPrice: number,
  unitCost:     number,
  freightPerUnit: number,
  weightKg?:    number,
): number {
  const landed = confirmedLandedCost(unitCost, freightPerUnit);
  if (landed <= 0) return 0;
  return (netProfitPerUnit(sellingPrice, unitCost, freightPerUnit, weightKg) / landed) * 100;
}

// ── FBA Profit Lab — full P&L from manually entered costs ─────────────────────
// Canonical formula behind the FBA Profit calculator. Margin = net profit ÷
// selling price. ROI = net profit ÷ capital actually invested (product cost +
// freight + duties + packaging — excludes Amazon fees, which aren't "invested").

export interface UnitEconomicsInputs {
  sellingPrice: number;
  productCost:  number;
  freight:      number;
  fbaFees:      number;
  referralFee:  number;
  duties:       number;
  packaging:    number;
}

export interface UnitEconomicsResult {
  sellingPrice: number;
  netProfit:    number;
  margin:       number;
  roi:          number;
  totalCost:    number;
  isViable:     boolean;
  costAmounts: { label: string; amount: number }[];
}

export function computeUnitEconomics(i: UnitEconomicsInputs): UnitEconomicsResult {
  const sell = i.sellingPrice;
  const totalCost = i.productCost + i.freight + i.fbaFees + i.referralFee + i.duties + i.packaging;
  const netProfit = sell - totalCost;
  const margin = sell > 0 ? (netProfit / sell) * 100 : 0;
  const investBase = i.productCost + i.freight + i.duties + i.packaging;
  const roi = investBase > 0 ? (netProfit / investBase) * 100 : 0;
  const isViable = margin >= FIN.MARGIN_ACCEPTABLE;
  return {
    sellingPrice: sell, netProfit, margin, roi, totalCost, isViable,
    costAmounts: [
      { label: 'Supplier cost',   amount: i.productCost },
      { label: 'Freight / unit',  amount: i.freight },
      { label: 'FBA fulfillment', amount: i.fbaFees },
      { label: 'Referral fee',    amount: i.referralFee },
      { label: 'Import duties',   amount: i.duties },
      { label: 'Packaging',       amount: i.packaging },
      { label: 'Total costs',     amount: totalCost },
    ],
  };
}

// ── Full cost model builder ───────────────────────────────────────────────────
//
// CURRENCY INVARIANT: every monetary input here is USD. The app stores all
// prices/costs in USD internally (backend returns USD-normalized values) and only
// converts to the user's local currency at display time via CurrencyContext.fmt().
// Do NOT pass locally-converted amounts in, and do NOT add a toUSD() here — that
// would double-convert and corrupt margins.

export function buildCostModel(
  sellingPrice:   number,
  unitCost:       number,
  freightPerUnit: number,
  unitsOrdered:   number,
  dutiesAndPrep:  number = 0,
  weightKg?:      number,
): PipelineCostModel {
  const landed     = confirmedLandedCost(unitCost, freightPerUnit);
  const referral   = sellingPrice * FIN.REFERRAL_RATE;
  const fbaFee     = resolveFbaFee(sellingPrice, weightKg);
  const net        = sellingPrice - landed - referral - fbaFee;
  const margin     = sellingPrice > 0 ? (net / sellingPrice) * 100 : 0;
  const roi        = landed > 0 ? (net / landed) * 100 : 0;
  const totalCost  = landed + dutiesAndPrep;

  return {
    sellingPrice,
    unitCost,
    freight:         freightPerUnit,
    fbaFee,
    referralFee:     referral,
    duties:          dutiesAndPrep,
    packaging:       0,
    netProfit:       net,
    marginPct:       margin,
    roiPct:          roi,
    totalCost,
    unitsOrdered,
    totalInvestment: totalCost * unitsOrdered,
    savedAt:         new Date().toISOString(),
  };
}

// ── Monthly sales estimate (legacy — review-velocity proxy) ──────────────────
export function monthlySalesEst(revenueUSD: number | null, price: number | null): number | null {
  if (!revenueUSD || !price || price <= 0) return null;
  return Math.round(revenueUSD / price);
}

// ── Sales estimation from review count ───────────────────────────────────────
//
// Method: review-rate model
//   Total lifetime purchases ≈ reviewCount / REVIEW_RATE (3%)
//   Product age assumption varies by competition level (newer niche = Low)
//   Monthly sales = totalPurchases / monthsOnMarket × priceFactor
//
// All outputs are directional estimates — label them as such in the UI.

export type SalesConfidence = 'Low' | 'Medium';
export type PPCPressure     = 'Low' | 'Medium' | 'High';

export interface SalesEstimate {
  low:         number;         // conservative monthly units
  mid:         number;         // central monthly units
  high:        number;         // optimistic monthly units
  dailyLow:    number;
  dailyHigh:   number;
  monthlyLabel: string;        // "~120–280/mo"
  dailyLabel:   string;        // "~4–9/day"
  confidence:  SalesConfidence;
  revenueEstLow:  number;      // USD
  revenueEstHigh: number;      // USD
}

export function estimateMonthlySales(
  reviewCount: number,
  competition: 'Low' | 'Medium' | 'High',
  price:       number,
): SalesEstimate {
  const months = competition === 'Low'
    ? FIN.MONTHS_ON_MARKET_LOW
    : competition === 'Medium'
    ? FIN.MONTHS_ON_MARKET_MEDIUM
    : FIN.MONTHS_ON_MARKET_HIGH;

  const totalPurchases = reviewCount / FIN.REVIEW_RATE;
  const rawMonthly     = totalPurchases / months;

  // Price factor: higher priced items sell fewer units per month
  const priceFactor =
    price > 60 ? 0.55 :
    price > 40 ? 0.70 :
    price > 25 ? 0.90 :
    price > 15 ? 1.00 : 1.15;

  const mid   = Math.max(1, Math.round(rawMonthly * priceFactor));
  const conf  = reviewCount >= 80 ? 'Medium' : 'Low';
  const band  = conf === 'Medium' ? FIN.SALES_BAND_HIGH : FIN.SALES_BAND_LOW;

  const low   = Math.max(1, Math.round(mid * band * 0.7));
  const high  = Math.round(mid * (2 - band * 0.7));
  const dailyLow  = Math.max(1, Math.round(low  / 30));
  const dailyHigh = Math.max(1, Math.round(high / 30));

  return {
    low, mid, high,
    dailyLow, dailyHigh,
    monthlyLabel: `~${low.toLocaleString()}–${high.toLocaleString()}/mo`,
    dailyLabel:   `~${dailyLow}–${dailyHigh}/day`,
    confidence:   conf,
    revenueEstLow:  Math.round(low  * (price ?? 0)),
    revenueEstHigh: Math.round(high * (price ?? 0)),
  };
}

// ── PPC pressure estimation ───────────────────────────────────────────────────
// Higher review count + high competition = crowded PPC market = expensive clicks.

export function estimatePPCPressure(
  reviewCount: number,
  competition: 'Low' | 'Medium' | 'High',
): PPCPressure {
  if (reviewCount >= FIN.PPC_HIGH_REVIEWS || competition === 'High') return 'High';
  if (reviewCount >= FIN.PPC_LOW_REVIEWS  || competition === 'Medium') return 'Medium';
  return 'Low';
}

// ── Price-based FBA fee estimate ──────────────────────────────────────────────
// Real fees are weight/size based. This is a directional estimate for standard items.
// Always label as "estimated FBA fee" in UI. Operator should verify in Seller Central.

export function estimateFBAFee(sellingPrice: number): number {
  if (sellingPrice <= FIN.FBA_FEE_TIER_1_MAX) return 3.50;
  if (sellingPrice <= FIN.FBA_FEE_TIER_2_MAX) return 4.50;
  if (sellingPrice <= FIN.FBA_FEE_TIER_3_MAX) return 5.50;
  if (sellingPrice <= FIN.FBA_FEE_TIER_4_MAX) return 7.00;
  return 10.00;
}

// ── Startup capital estimator ─────────────────────────────────────────────────
// Breaks down total cash required for a first order including recommended buffer.

export interface StartupCapitalBreakdown {
  inventoryCost:   number;   // unitCost × MOQ
  freightCost:     number;   // freightPerUnit × MOQ
  amazonFeeBuffer: number;   // referral + FBA on first batch (approximate)
  ppcBuffer:       number;   // recommended PPC launch budget
  contingency:     number;   // buffer
  total:           number;
  note?:           string;
}

export function estimateStartupCapital(
  unitCost:       number,
  moq:            number,
  freightPerUnit: number,
  sellingPrice:   number,
  bufferPct:      number = FIN.CAPITAL_BUFFER_PCT,
): StartupCapitalBreakdown {
  if (unitCost <= 0 || moq <= 0) {
    return { inventoryCost: 0, freightCost: 0, amazonFeeBuffer: 0, ppcBuffer: 0, contingency: 0, total: 0, note: 'Unit cost and MOQ must be greater than zero.' };
  }
  const inventoryCost   = unitCost * moq;
  const freightCost     = freightPerUnit * moq;
  const amazonFeeBuffer = sellingPrice * FIN.TOTAL_FEE_RATE * moq * 0.5; // first 50% of batch
  const ppcBuffer       = sellingPrice * moq * 0.05; // ~5% of first batch revenue for PPC launch
  const subtotal        = inventoryCost + freightCost + amazonFeeBuffer + ppcBuffer;
  const contingency     = Math.round(subtotal * bufferPct);
  return {
    inventoryCost:   Math.round(inventoryCost),
    freightCost:     Math.round(freightCost),
    amazonFeeBuffer: Math.round(amazonFeeBuffer),
    ppcBuffer:       Math.round(ppcBuffer),
    contingency,
    total:           Math.round(subtotal + contingency),
  };
}

// ── Supplier recommendation label ─────────────────────────────────────────────
// Assign a single recommendation label per supplier in a comparison set.

export type SupplierLabel = 'Best Margin' | 'Lowest Risk' | 'Fastest Launch' | 'Budget Friendly';

export function assignSupplierLabels(
  suppliers: Array<{
    unitCost:      number;
    moq:           number;
    leadTimeDays?: number;
    score?:        number;
    grade?:        string;
  }>,
  sellingPrice: number,
): SupplierLabel[] {
  const n = suppliers.length;
  if (n === 0) return [];

  // Per-supplier derived metrics
  const margins = suppliers.map(s => roughMarginPct(sellingPrice, s.unitCost));
  const moqs    = suppliers.map(s => s.moq);
  const leads   = suppliers.map(s => s.leadTimeDays ?? 999);

  const maxMargin = Math.max(...margins);
  const minMoq    = Math.min(...moqs);
  const minLead   = Math.min(...leads);

  // Priority order so each label stays distinct and reachable. Best Margin is the
  // cheapest supplier (margin is monotonic in unit cost), so a separate "lowest
  // cost" check would be dead — Budget Friendly is the neutral fallback instead.
  return suppliers.map((s, i) => {
    if (margins[i] === maxMargin)              return 'Best Margin';
    if (leads[i] === minLead && leads[i] < 999) return 'Fastest Launch';
    if (moqs[i] === minMoq)                    return 'Lowest Risk';
    return 'Budget Friendly';
  });
}

// ── Financial signal colours ──────────────────────────────────────────────────

import { DS } from '../theme/ds';

export function marginColor(marginPct: number): string {
  if (marginPct >= 30) return DS.success;
  if (marginPct >= 20) return DS.warning;
  return DS.danger;
}

export function roiColor(roiPct: number): string {
  if (roiPct >= 50) return DS.success;
  if (roiPct >= 20) return DS.warning;
  return DS.danger;
}

export function ppcColor(pressure: PPCPressure): string {
  if (pressure === 'Low')    return DS.success;
  if (pressure === 'Medium') return DS.warning;
  return DS.danger;
}

export function confidenceColor(conf: SalesConfidence): string {
  return conf === 'Medium' ? DS.success : DS.warning;
}
