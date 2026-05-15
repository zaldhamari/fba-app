// ─── Product Risk Assessment ──────────────────────────────────────────────────
// Pure types and formula — no React, no AsyncStorage, no side effects.
// All scores are derived from real product/supplier/feasibility fields.

import {
  FeasibilityProduct,
  FeasibilitySupplier,
  FeasibilityInputs,
  FeasibilityResult,
  FeasibilityVerdict,
  FEASIBILITY_DEFAULTS,
} from './feasibility';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface RiskCategoryScores {
  marketRisk:            number; // 0–100
  financialRisk:         number;
  supplierRisk:          number;
  dataConfidenceRisk:    number;
  productComplexityRisk: number;
}

export type RiskLevel = 'Low Risk' | 'Moderate Risk' | 'High Risk' | 'Extreme Risk';

export interface RiskFactor {
  description: string;
  mitigation:  string;
  severity:    'high' | 'medium' | 'low';
}

export interface RiskAssessmentResult {
  scores:           RiskCategoryScores;
  overallRiskScore: number;   // 0–100, rounded
  riskLevel:        RiskLevel;
  topRiskFactors:   RiskFactor[];  // 3–5 entries
  decisionNote:     string;
}

// ─── Category labels (for UI display) ────────────────────────────────────────

export const CATEGORY_LABELS: Record<keyof RiskCategoryScores, string> = {
  marketRisk:            'Market Competition',
  financialRisk:         'Financial',
  supplierRisk:          'Supplier',
  dataConfidenceRisk:    'Data Confidence',
  productComplexityRisk: 'Complexity',
};

// ─── 1. Market Competition Risk ───────────────────────────────────────────────
// Sources: product.competition, product.reviewCount, product.rating, product.price

function scoreMarketRisk(product: FeasibilityProduct): number {
  let score = 0;

  // Competition level is the primary market signal
  if      (product.competition === 'High')   score += 40;
  else if (product.competition === 'Medium') score += 20;
  else                                        score += 5;  // Low

  // Review count is the best proxy for barrier-to-entry
  const rc = product.reviewCount ?? 0;
  if      (rc > 5000) score += 35;
  else if (rc > 2000) score += 25;
  else if (rc > 1000) score += 15;
  else if (rc > 500)  score += 8;
  else if (rc > 100)  score += 3;

  // Low rating = dissatisfied market, harder to differentiate
  const rt = product.rating ?? 4.0;
  if      (rt < 3.5) score += 15;
  else if (rt < 4.0) score += 8;
  // rating >= 4.5: no penalty — well-rated market is an opportunity, not a risk

  // Very low price = commoditised; thin margin ceiling
  const price = product.price;
  if      (price != null && price < 10)  score += 10;
  else if (price != null && price < 15)  score += 5;

  return Math.min(100, score);
}

// ─── 2. Financial Risk ────────────────────────────────────────────────────────
// Sources: result.marginPct, result.roiPct, result.profitPerUnit, result.initialInvestment

function scoreFinancialRisk(result: FeasibilityResult): number {
  let score = 0;

  // Margin risk
  if      (result.marginPct < 0)  score += 45;
  else if (result.marginPct < 10) score += 35;
  else if (result.marginPct < 20) score += 20;
  else if (result.marginPct < 30) score += 10;

  // ROI risk
  if      (result.roiPct < 0)  score += 35;
  else if (result.roiPct < 20) score += 25;
  else if (result.roiPct < 40) score += 15;
  else if (result.roiPct < 60) score += 5;

  // Capital exposure risk from initial investment
  if      (result.initialInvestment > 10_000) score += 20;
  else if (result.initialInvestment > 5_000)  score += 12;
  else if (result.initialInvestment > 2_000)  score += 5;

  return Math.min(100, score);
}

// ─── 3. Supplier Risk ─────────────────────────────────────────────────────────
// Sources: supplier.moqNum, supplier.platform, supplier.priceUSD

function scoreSupplierRisk(supplier: FeasibilitySupplier): number {
  let score = 0;

  // High MOQ = high capital lock-in with an unproven product
  if      (supplier.moqNum > 2000) score += 35;
  else if (supplier.moqNum > 1000) score += 25;
  else if (supplier.moqNum > 500)  score += 15;
  else if (supplier.moqNum > 200)  score += 8;

  // Platform trust proxy (Alibaba has Trade Assurance; 1688 is domestic Chinese)
  if      (supplier.platform === 'Alibaba') score += 5;
  else if (supplier.platform === 'DHgate')  score += 15;
  else if (supplier.platform === '1688')    score += 22;
  else                                       score += 28;

  // Missing price data makes financial projections unreliable
  if (supplier.priceUSD == null) score += 25;

  // Very low unit cost can signal quality/authenticity issues
  if (supplier.priceUSD != null && supplier.priceUSD < 0.50) score += 15;
  else if (supplier.priceUSD != null && supplier.priceUSD < 1.00) score += 8;

  return Math.min(100, score);
}

// ─── 4. Data Confidence Risk ──────────────────────────────────────────────────
// Sources: result.missingFields, inputs vs defaults

function scoreDataConfidenceRisk(
  inputs:  FeasibilityInputs,
  result:  FeasibilityResult,
): number {
  let score = 0;

  // Each missing field is a significant knowledge gap (capped at 60)
  score += Math.min(60, result.missingFields.length * 20);

  // Using default shipping means the cost is an estimate, not a quote
  if (inputs.shippingPerUnit === FEASIBILITY_DEFAULTS.shippingPerUnit) score += 15;

  // Using default weight means FBA fee is estimated, not measured
  if (inputs.weightLbs === FEASIBILITY_DEFAULTS.weightLbs) score += 10;

  // Zero customs could be accurate or could mean duties were overlooked
  if (inputs.customsPct === 0) score += 5;

  return Math.min(100, score);
}

// ─── 5. Product Complexity Risk ───────────────────────────────────────────────
// Sources: inputs.weightLbs, inputs.customsPct, product.price, result.fbaFee

function scoreProductComplexityRisk(
  product: FeasibilityProduct,
  inputs:  FeasibilityInputs,
  result:  FeasibilityResult,
): number {
  let score = 0;

  // Heavier products have higher FBA and freight costs
  if      (inputs.weightLbs > 5)   score += 35;
  else if (inputs.weightLbs > 2)   score += 20;
  else if (inputs.weightLbs > 1)   score += 10;
  else if (inputs.weightLbs > 0.5) score += 5;

  // High import duties increase landed cost and sourcing complexity
  if      (inputs.customsPct > 20) score += 30;
  else if (inputs.customsPct > 10) score += 20;
  else if (inputs.customsPct > 5)  score += 10;
  else if (inputs.customsPct > 0)  score += 5;

  // FBA fee as a proportion of selling price — high ratio erodes margin headroom
  const price = product.price;
  if (price != null && price > 0) {
    const fbaRatio = result.fbaFee / price;
    if      (fbaRatio > 0.30) score += 25;
    else if (fbaRatio > 0.20) score += 15;
    else if (fbaRatio > 0.15) score += 8;
  }

  return Math.min(100, score);
}

// ─── Risk factor generation ───────────────────────────────────────────────────
// All triggers are derived from real field values. No static/hardcoded factors.

function generateRiskFactors(
  product:  FeasibilityProduct,
  supplier: FeasibilitySupplier,
  inputs:   FeasibilityInputs,
  result:   FeasibilityResult,
): RiskFactor[] {
  const rc = product.reviewCount ?? 0;

  interface Candidate {
    check:       boolean;
    severity:    'high' | 'medium' | 'low';
    description: string;
    mitigation:  string;
  }

  const candidates: Candidate[] = [
    // ── Financial ────────────────────────────────────────────────
    {
      check:       result.profitPerUnit < 0,
      severity:    'high',
      description: `This product loses $${Math.abs(result.profitPerUnit).toFixed(2)}/unit at current prices — every sale is a loss.`,
      mitigation:  'Reduce landed cost or increase the selling price before considering this product.',
    },
    {
      check:       result.marginPct >= 0 && result.marginPct < 15,
      severity:    'high',
      description: `Profit margin is ${result.marginPct.toFixed(1)}% — below the 15% floor where FBA typically becomes unviable after returns and PPC.`,
      mitigation:  'Target 25–35% margin by negotiating a lower unit cost or finding a higher-priced niche variant.',
    },
    {
      check:       result.marginPct >= 15 && result.marginPct < 25,
      severity:    'medium',
      description: `${result.marginPct.toFixed(1)}% margin leaves little buffer — PPC spend or a price war could eliminate profit entirely.`,
      mitigation:  'Model a 20–30% ACoS and confirm the product remains profitable under ad spend.',
    },
    {
      check:       result.initialInvestment > 5_000,
      severity:    'high',
      description: `Initial investment at MOQ is $${result.initialInvestment.toLocaleString('en-US', { maximumFractionDigits: 0 })} — significant capital exposure on an untested product.`,
      mitigation:  'Negotiate a lower first-order MOQ to reduce capital at risk. Validate demand before committing.',
    },
    {
      check:       result.roiPct >= 0 && result.roiPct < 30,
      severity:    'medium',
      description: `ROI is ${result.roiPct.toFixed(1)}% — low relative to the capital and time required for FBA.`,
      mitigation:  'Test a higher selling price to improve ROI, or find a supplier with a lower unit cost.',
    },
    // ── Market ───────────────────────────────────────────────────
    {
      check:       product.competition === 'High' && rc > 2000,
      severity:    'high',
      description: `High competition with ${rc.toLocaleString()} reviews on top listings — extremely difficult to rank organically.`,
      mitigation:  'Target a specific sub-niche or add a clear differentiating feature to avoid direct comparison.',
    },
    {
      check:       product.competition === 'High' && rc <= 2000,
      severity:    'medium',
      description: `High competition level — ranking will require sustained PPC investment at launch.`,
      mitigation:  'Budget at least 3–6 months of PPC spend and plan a differentiated product or bundle.',
    },
    {
      check:       rc > 3000 && product.competition !== 'High',
      severity:    'medium',
      description: `Top listings have ${rc.toLocaleString()} reviews — building social proof will take time and launch budget.`,
      mitigation:  'Build a review-acquisition strategy and plan for a 60–90 day ramp-up before profitability.',
    },
    {
      check:       (product.price ?? 0) < 12 && (product.price ?? 0) > 0,
      severity:    'medium',
      description: `Selling price of $${(product.price ?? 0).toFixed(2)} is very low — leaves minimal room for fees, PPC, and margin.`,
      mitigation:  'Look for a premium variant or bundle option that justifies a $20+ price point.',
    },
    // ── Supplier ─────────────────────────────────────────────────
    {
      check:       supplier.moqNum > 1000,
      severity:    'high',
      description: `MOQ of ${supplier.moqNum.toLocaleString()} units is high for a first order — full commitment before demand is proven.`,
      mitigation:  'Negotiate a lower trial MOQ (100–300 units) or find a supplier with lower minimums.',
    },
    {
      check:       supplier.moqNum > 300 && supplier.moqNum <= 1000,
      severity:    'medium',
      description: `MOQ of ${supplier.moqNum.toLocaleString()} units requires significant upfront commitment.`,
      mitigation:  'Order samples before committing and negotiate payment terms (30% upfront, 70% on shipment).',
    },
    {
      check:       supplier.priceUSD == null,
      severity:    'high',
      description: 'Supplier unit cost is not confirmed — all financial projections are unreliable estimates.',
      mitigation:  'Request a formal price sheet before making any sourcing decisions.',
    },
    {
      check:       supplier.platform === '1688',
      severity:    'medium',
      description: '1688 suppliers serve the Chinese domestic market — communication barriers and quality control are higher risks.',
      mitigation:  'Use a sourcing agent or freight forwarder with 1688 experience, or source via Alibaba for Trade Assurance protection.',
    },
    // ── Data confidence ──────────────────────────────────────────
    {
      check:       result.missingFields.length >= 2,
      severity:    'high',
      description: `${result.missingFields.length} critical data points are missing (${result.missingFields.join(', ')}) — projections are estimates only.`,
      mitigation:  'Fill in the missing fields before making any investment decisions based on this analysis.',
    },
    {
      check:       result.missingFields.length === 1,
      severity:    'medium',
      description: `Missing: ${result.missingFields[0]} — one key projection relies on a default assumption.`,
      mitigation:  'Source the actual value before finalising the feasibility assessment.',
    },
    {
      check:       inputs.shippingPerUnit === FEASIBILITY_DEFAULTS.shippingPerUnit,
      severity:    'low',
      description: `Shipping uses the default estimate of $${FEASIBILITY_DEFAULTS.shippingPerUnit.toFixed(2)}/unit — actual costs may differ materially.`,
      mitigation:  'Get freight quotes from 2–3 forwarders before committing to inventory.',
    },
    // ── Complexity ───────────────────────────────────────────────
    {
      check:       inputs.weightLbs > 2,
      severity:    'medium',
      description: `At ${inputs.weightLbs} lbs, the estimated FBA fee is $${result.fbaFee.toFixed(2)}/unit — heavier products are more exposed to fee changes.`,
      mitigation:  'Explore lighter packaging materials or a smaller product variant to reduce FBA fees.',
    },
    {
      check:       inputs.customsPct > 10,
      severity:    'medium',
      description: `${inputs.customsPct}% import duty significantly increases landed cost and reduces margin headroom.`,
      mitigation:  'Consult an import specialist to confirm the correct HS code — duty rates can vary substantially.',
    },
  ];

  const sevOrder: Record<'high' | 'medium' | 'low', number> = { high: 0, medium: 1, low: 2 };
  return candidates
    .filter(c => c.check)
    .sort((a, b) => sevOrder[a.severity] - sevOrder[b.severity])
    .slice(0, 5)
    .map(({ check: _check, ...rest }) => rest);
}

// ─── Risk level from score ────────────────────────────────────────────────────

export function riskLevelFromScore(score: number): RiskLevel {
  if (score < 25) return 'Low Risk';
  if (score < 50) return 'Moderate Risk';
  if (score < 75) return 'High Risk';
  return 'Extreme Risk';
}

// ─── Decision note ────────────────────────────────────────────────────────────

function buildDecisionNote(verdict: FeasibilityVerdict, riskLevel: RiskLevel): string {
  if (verdict === 'Excellent Opportunity' && riskLevel === 'Low Risk')
    return 'Strong fundamentals with manageable risk — this product is a solid candidate to move forward with.';
  if (verdict === 'Excellent Opportunity' && riskLevel === 'Moderate Risk')
    return 'Good financial metrics with some operational risks. Address the flagged issues before committing.';
  if (verdict === 'Excellent Opportunity')
    return 'The numbers look good, but risk is elevated. Resolve the top risk factors before placing an order.';
  if (verdict === 'Worth Testing' && riskLevel === 'Low Risk')
    return 'Moderate returns with low risk — a good candidate for a small test batch.';
  if (verdict === 'Worth Testing' && riskLevel === 'Moderate Risk')
    return 'Feasible but not a slam dunk. Mitigate the key risks before scaling beyond a test order.';
  if (verdict === 'Worth Testing')
    return 'Risk is significant on top of thin economics. Only proceed if you can resolve the critical risk factors.';
  if (verdict === 'High Risk' && riskLevel === 'Low Risk')
    return 'Financial metrics are marginal, though operational risks are contained. Focus on improving margin first.';
  if (verdict === 'High Risk')
    return 'Both the financial case and the risk profile are concerning. Significant improvements are needed before proceeding.';
  // Avoid
  return 'The financial case and the risk profile both point away from this product. Consider a different opportunity.';
}

// ─── Main entry point ─────────────────────────────────────────────────────────

export function computeRiskAssessment(
  product:  FeasibilityProduct,
  supplier: FeasibilitySupplier,
  inputs:   FeasibilityInputs,
  result:   FeasibilityResult,
): RiskAssessmentResult {
  const scores: RiskCategoryScores = {
    marketRisk:            scoreMarketRisk(product),
    financialRisk:         scoreFinancialRisk(result),
    supplierRisk:          scoreSupplierRisk(supplier),
    dataConfidenceRisk:    scoreDataConfidenceRisk(inputs, result),
    productComplexityRisk: scoreProductComplexityRisk(product, inputs, result),
  };

  const overallRiskScore = Math.round(
    scores.marketRisk            * 0.30 +
    scores.financialRisk         * 0.30 +
    scores.supplierRisk          * 0.20 +
    scores.dataConfidenceRisk    * 0.10 +
    scores.productComplexityRisk * 0.10,
  );

  const riskLevel = riskLevelFromScore(overallRiskScore);

  return {
    scores,
    overallRiskScore,
    riskLevel,
    topRiskFactors: generateRiskFactors(product, supplier, inputs, result),
    decisionNote:   buildDecisionNote(result.verdict, riskLevel),
  };
}
