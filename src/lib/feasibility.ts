// ─── Product Feasibility Check ────────────────────────────────────────────────
// Pure types and formula — no React, no AsyncStorage, no side effects.

// ─── Snapshot types (serialized to AsyncStorage) ─────────────────────────────

export interface FeasibilityProduct {
  id:           string;
  name:         string;
  price:        number | null;
  rating:       number | null;
  reviewCount:  number | null;
  competition:  'Low' | 'Medium' | 'High';
  url?:         string;
  savedAt:      string; // ISO timestamp
}

export interface FeasibilitySupplier {
  name:       string;
  platform:   string;
  priceUSD:   number | null; // average of price_range min/max
  moqNum:     number;
  moqDisplay: string;
  url?:       string;
  savedAt:    string; // ISO timestamp
}

// ─── User-adjustable inputs ───────────────────────────────────────────────────

export interface FeasibilityInputs {
  weightLbs:       number; // unit weight — drives FBA fee estimate
  shippingPerUnit: number; // freight cost per unit (USD)
  customsPct:      number; // import duty as % of unit cost
}

export const FEASIBILITY_DEFAULTS: FeasibilityInputs = {
  weightLbs:       0.5,
  shippingPerUnit: 1.50,
  customsPct:      0,
};

// ─── Result ───────────────────────────────────────────────────────────────────

export type FeasibilityVerdict =
  | 'Excellent Opportunity'
  | 'Worth Testing'
  | 'High Risk'
  | 'Avoid';

export interface FeasibilityResult {
  sellingPrice:      number;
  unitCost:          number;
  referralFee:       number;
  fbaFee:            number;
  shippingPerUnit:   number;
  customsDuty:       number;
  landedCost:        number;
  totalCostPerUnit:  number;
  profitPerUnit:     number;
  marginPct:         number;
  roiPct:            number;
  moq:               number;
  initialInvestment: number;
  breakEvenUnits:    number;
  verdict:           FeasibilityVerdict;
  verdictReason:     string;
  hasMissingData:    boolean;
  missingFields:     string[];
}

// ─── FBA fee estimate from unit weight ───────────────────────────────────────
// Per-marketplace 2024/2025 standard-size schedules.
// All fees are in local currency for each marketplace.
// US source: Amazon.com FBA fee schedule Jan 2025.
// UK source: Amazon.co.uk FBA fee schedule 2025 (GBP).
// DE source: Amazon.de FBA fee schedule 2025 (EUR).
// CA source: Amazon.ca FBA fee schedule 2025 (CAD).
// AE/SA: approximated from USD schedule scaled to local currency at typical rates.

type FBAMarket = 'US' | 'UK' | 'DE' | 'CA' | 'AE' | 'SA';

function _usaFee(w: number): number {
  if (w <= 0.25) return 3.06;
  if (w <= 0.50) return 3.22;
  if (w <= 0.75) return 3.40;
  if (w <= 1.00) return 3.58;
  if (w <= 1.50) return 4.75;
  if (w <= 2.00) return 5.05;
  if (w <= 3.00) return 5.62;
  return parseFloat((5.62 + (w - 3) * 0.38).toFixed(2));
}

function _ukFee(w: number): number {
  // Amazon.co.uk 2025 standard size schedule (GBP)
  if (w <= 0.25) return 2.70;
  if (w <= 0.50) return 3.00;
  if (w <= 0.75) return 3.35;
  if (w <= 1.00) return 3.75;
  if (w <= 1.50) return 4.30;
  if (w <= 2.00) return 4.70;
  if (w <= 3.00) return 5.50;
  return parseFloat((5.50 + (w - 3) * 0.50).toFixed(2));
}

function _deFee(w: number): number {
  // Amazon.de 2025 standard size schedule (EUR)
  if (w <= 0.25) return 3.00;
  if (w <= 0.50) return 3.35;
  if (w <= 0.75) return 3.70;
  if (w <= 1.00) return 4.10;
  if (w <= 1.50) return 4.80;
  if (w <= 2.00) return 5.30;
  if (w <= 3.00) return 6.20;
  return parseFloat((6.20 + (w - 3) * 0.55).toFixed(2));
}

function _caFee(w: number): number {
  // Amazon.ca 2025 standard size schedule (CAD)
  if (w <= 0.25) return 4.20;
  if (w <= 0.50) return 4.45;
  if (w <= 0.75) return 4.70;
  if (w <= 1.00) return 5.00;
  if (w <= 1.50) return 6.60;
  if (w <= 2.00) return 7.10;
  if (w <= 3.00) return 7.90;
  return parseFloat((7.90 + (w - 3) * 0.55).toFixed(2));
}

function _aeFee(w: number): number {
  // Amazon.ae (AED) — approximated from US schedule × 3.85 AED/USD
  return parseFloat((_usaFee(w) * 3.85).toFixed(2));
}

function _saFee(w: number): number {
  // Amazon.sa (SAR) — approximated from US schedule × 3.85 SAR/USD
  return parseFloat((_usaFee(w) * 3.85).toFixed(2));
}

export function estimateFBAFee(weightLbs: number, marketplace?: string): number {
  switch (marketplace as FBAMarket) {
    case 'UK': return _ukFee(weightLbs);
    case 'DE': return _deFee(weightLbs);
    case 'CA': return _caFee(weightLbs);
    case 'AE': return _aeFee(weightLbs);
    case 'SA': return _saFee(weightLbs);
    default:   return _usaFee(weightLbs);
  }
}

// ─── Core formula ─────────────────────────────────────────────────────────────

export function computeFeasibility(
  product:     FeasibilityProduct,
  supplier:    FeasibilitySupplier,
  inputs:      FeasibilityInputs,
  marketplace?: string,
): FeasibilityResult {
  const missingFields: string[] = [];
  if (product.price    == null) missingFields.push('Amazon selling price');
  if (supplier.priceUSD == null) missingFields.push('Supplier unit cost');
  if (supplier.moqNum   === 0)  missingFields.push('MOQ');

  const hasMissingData = missingFields.length > 0;

  const sp  = product.price     ?? 0;
  const uc  = supplier.priceUSD ?? 0;
  const moq = supplier.moqNum   || 100;

  const referralFee      = parseFloat((sp * 0.15).toFixed(2));
  const fbaFee           = estimateFBAFee(inputs.weightLbs, marketplace);
  const customsDuty      = parseFloat((uc * inputs.customsPct / 100).toFixed(2));
  const landedCost       = parseFloat((uc + inputs.shippingPerUnit + customsDuty).toFixed(2));
  const totalCostPerUnit = parseFloat((landedCost + referralFee + fbaFee).toFixed(2));
  const profitPerUnit    = parseFloat((sp - totalCostPerUnit).toFixed(2));
  const marginPct        = sp > 0
    ? Math.round((profitPerUnit / sp) * 1000) / 10
    : 0;
  const roiPct           = landedCost > 0
    ? Math.round((profitPerUnit / landedCost) * 1000) / 10
    : 0;
  const initialInvestment = parseFloat((moq * landedCost).toFixed(2));
  const breakEvenUnits    = profitPerUnit > 0
    ? Math.ceil(initialInvestment / profitPerUnit)
    : moq;

  const verdict = deriveVerdict(
    marginPct, roiPct,
    product.competition, product.reviewCount,
    initialInvestment, hasMissingData,
  );

  return {
    sellingPrice: sp,
    unitCost: uc,
    referralFee,
    fbaFee,
    shippingPerUnit: inputs.shippingPerUnit,
    customsDuty,
    landedCost,
    totalCostPerUnit,
    profitPerUnit,
    marginPct,
    roiPct,
    moq,
    initialInvestment,
    breakEvenUnits,
    verdict,
    verdictReason: buildVerdictReason(
      verdict, marginPct, roiPct, product.competition, product.reviewCount,
    ),
    hasMissingData,
    missingFields,
  };
}

// ─── Verdict logic ────────────────────────────────────────────────────────────
// Every threshold is intentional — see delivery report for documentation.

function deriveVerdict(
  margin:            number,
  roi:               number,
  competition:       'Low' | 'Medium' | 'High',
  reviewCount:       number | null,
  initialInvestment: number,
  hasMissingData:    boolean,
): FeasibilityVerdict {
  // Missing core data means the numbers cannot be trusted
  if (hasMissingData) return 'High Risk';

  // Hard avoids — below floor thresholds
  if (margin < 10)  return 'Avoid';
  if (roi    < 15)  return 'Avoid';
  if (competition === 'High' && (reviewCount ?? 0) > 2000) return 'Avoid';

  // Excellent: high margin, high ROI, low competition
  if (margin >= 35 && roi >= 80 && competition === 'Low') return 'Excellent Opportunity';

  // Worth testing: comfortable economics
  if (margin >= 25 && roi >= 50) return 'Worth Testing';
  if (margin >= 30 && roi >= 40) return 'Worth Testing';

  // High risk: economics are marginal or capital exposure is high
  if (margin < 20)              return 'High Risk';
  if (roi    < 30)              return 'High Risk';
  if (competition === 'High')   return 'High Risk';
  if (initialInvestment > 5000 && roi < 60) return 'High Risk';

  return 'Worth Testing';
}

function buildVerdictReason(
  verdict:     FeasibilityVerdict,
  margin:      number,
  roi:         number,
  competition: 'Low' | 'Medium' | 'High',
  reviewCount: number | null,
): string {
  switch (verdict) {
    case 'Excellent Opportunity':
      return `${margin.toFixed(1)}% margin and ${roi.toFixed(1)}% ROI in a low-competition market — strong fundamentals to launch.`;
    case 'Worth Testing':
      return `${margin.toFixed(1)}% margin and ${roi.toFixed(1)}% ROI — viable, but test a small batch before scaling.`;
    case 'High Risk':
      if (competition === 'High')
        return `High competition makes it difficult to rank or price profitably.`;
      if (margin < 20)
        return `${margin.toFixed(1)}% margin is below the 20% minimum FBA typically needs to be viable.`;
      return `${roi.toFixed(1)}% ROI is too low to justify the capital risk at this MOQ.`;
    case 'Avoid':
      if (margin < 10)
        return `${margin.toFixed(1)}% margin — after Amazon fees, this product loses money per unit.`;
      if (competition === 'High' && (reviewCount ?? 0) > 2000)
        return `High competition with ${(reviewCount ?? 0).toLocaleString()} reviews — the barrier to entry is too high.`;
      return `Returns are too low to justify FBA costs and the capital commitment.`;
  }
}
