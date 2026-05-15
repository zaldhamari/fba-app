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
// Simplified 2024 standard-size schedule. Oversize handled by linear overage.

export function estimateFBAFee(weightLbs: number): number {
  if (weightLbs <= 0.25) return 3.06;
  if (weightLbs <= 0.50) return 3.22;
  if (weightLbs <= 0.75) return 3.40;
  if (weightLbs <= 1.00) return 3.58;
  if (weightLbs <= 1.50) return 4.75;
  if (weightLbs <= 2.00) return 5.05;
  if (weightLbs <= 3.00) return 5.62;
  return parseFloat((5.62 + (weightLbs - 3) * 0.38).toFixed(2));
}

// ─── Core formula ─────────────────────────────────────────────────────────────

export function computeFeasibility(
  product:  FeasibilityProduct,
  supplier: FeasibilitySupplier,
  inputs:   FeasibilityInputs,
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
  const fbaFee           = estimateFBAFee(inputs.weightLbs);
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
