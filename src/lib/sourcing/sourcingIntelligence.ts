import { PipelineProduct, PipelineSupplier, PipelineReconInsights } from '../../context/PipelineContext';
import {
  inferCategories, computeFreightSensitivity,
  FreightSensitivity, SourcingDifficulty, MarginRisk, FreightMode, CategoryFlags,
} from '../sourcingStrategy';
import { computeCertificationRisk, CertificationRiskResult } from './certificationRisk';
import { computeReturnRisk, ReturnRiskResult } from './returnRisk';
import { computeFreightVolatility, FreightVolatilityResult } from './freightVolatility';
import { computeSupplierConfidence, SupplierConfidenceResult } from './supplierConfidence';
import { computeCashflowStress, CashflowStressResult } from './cashflowStress';
import { computeNegotiationStrategy, NegotiationEngineResult } from './negotiationEngine';
import { computeLaunchSurvivability, LaunchSurvivabilityResult } from './launchSurvivability';

// Re-export so consumers don't need to import from types.ts directly
export type { DataConfidence } from './types';

export interface SourcingIntelligenceInputs {
  product:                 PipelineProduct | null;
  selectedSupplier:        PipelineSupplier | null;
  supplierQuotes:          PipelineSupplier[];
  confirmedFreightPerUnit: number | null;
  weightKgEstimate?:       number;
  marketplace:             string;
  freightMode:             FreightMode;
  sourcingDifficulty:      SourcingDifficulty;
  estimatedMarginRisk:     MarginRisk | null;  // null = no cost model
  reconInsights?:          PipelineReconInsights | null;
  sellerExperience?:       'beginner' | 'some' | 'selling';
}

export interface SourcingIntelligenceResult {
  categories:          CategoryFlags;
  freightSensitivity:  FreightSensitivity;
  certification:       CertificationRiskResult;
  returnRisk:          ReturnRiskResult;
  freightVolatility:   FreightVolatilityResult;
  supplierConfidence:  SupplierConfidenceResult;
  cashflowStress:      CashflowStressResult;
  negotiation:         NegotiationEngineResult;
  survivability:       LaunchSurvivabilityResult;
  // Composite score: 0–100 (higher = healthier supply chain)
  overallHealthScore:  number;
  overallHealthLabel:  'Strong' | 'Viable' | 'Marginal' | 'Risky' | 'Unknown';
  // Aggregate signals for quick display
  allMissingInputs:    string[];
  topRisks:            string[];
  topActions:          string[];
}

export function computeSourcingIntelligence(inputs: SourcingIntelligenceInputs): SourcingIntelligenceResult {
  const {
    product, selectedSupplier, supplierQuotes, confirmedFreightPerUnit,
    weightKgEstimate, marketplace, freightMode, sourcingDifficulty, estimatedMarginRisk,
    reconInsights, sellerExperience,
  } = inputs;

  const categories = inferCategories(product?.title ?? '');
  const freightSensitivity = computeFreightSensitivity(weightKgEstimate, product?.price, categories);

  const certification    = computeCertificationRisk(categories, marketplace);
  const returnRisk       = computeReturnRisk(
    categories,
    product?.price,
    marketplace,
    reconInsights?.complaints ?? [],
    product?.reviews,
    product?.competition,
  );
  const freightVolatility = computeFreightVolatility(
    freightSensitivity,
    freightMode,
    marketplace,
    confirmedFreightPerUnit,
    selectedSupplier?.country,
  );
  const supplierConfidence = computeSupplierConfidence(
    selectedSupplier,
    supplierQuotes,
    sourcingDifficulty,
    sellerExperience,
  );
  const cashflowStress = computeCashflowStress(
    selectedSupplier,
    supplierQuotes,
    confirmedFreightPerUnit,
    product?.price,
    // derive monthly sales estimate from product if available
    product?.salesEstLow != null && product?.salesEstHigh != null
      ? Math.round((product.salesEstLow + product.salesEstHigh) / 2)
      : product?.salesEstLow,
  );
  const negotiation = computeNegotiationStrategy(
    selectedSupplier,
    supplierQuotes,
    freightSensitivity,
    sourcingDifficulty,
    product?.title ?? 'this product',
    sellerExperience,
  );
  const survivability = computeLaunchSurvivability(
    freightSensitivity,
    sourcingDifficulty,
    estimatedMarginRisk,
    certification.level,
    returnRisk.level,
    cashflowStress.level,
    confirmedFreightPerUnit !== null && confirmedFreightPerUnit > 0,
    selectedSupplier !== null,
    product !== null,
    product?.competition,
    sellerExperience,
  );

  // ── Composite health score ────────────────────────────────────────────────
  // Weights (documented):
  //   survivability:      35% — overall launch feasibility
  //   supplier confidence: 20% — execution reliability
  //   cashflow stress:    15% — capital sustainability (inverted: lower stress = higher health)
  //   certification risk: 15% — compliance obstacle (inverted)
  //   return risk:        10% — profitability erosion (inverted)
  //   freight volatility:  5% — cost predictability (inverted, capped contribution)
  //
  // Unknown/empty states: each engine returns score=0 for unknowns,
  // which pulls the composite down — correctly reflecting low confidence.

  const cashflowHealthScore = cashflowStress.level === 'Unknown' ? 20 :  // unknown = uncertain, slight penalty
    100 - cashflowStress.score;

  const overallHealthScore = Math.round(
    survivability.score          * 0.35 +
    supplierConfidence.score     * 0.20 +
    cashflowHealthScore          * 0.15 +
    (100 - certification.score)  * 0.15 +
    (100 - returnRisk.score)     * 0.10 +
    (100 - freightVolatility.score) * 0.05,
  );

  const overallHealthLabel: SourcingIntelligenceResult['overallHealthLabel'] =
    survivability.rating === 'Unknown' ? 'Unknown' :
    overallHealthScore >= 72 ? 'Strong' :
    overallHealthScore >= 52 ? 'Viable' :
    overallHealthScore >= 32 ? 'Marginal' : 'Risky';

  // ── Aggregate missing inputs ──────────────────────────────────────────────
  const allMissingInputs = [
    ...new Set([
      ...returnRisk.missingInputs,
      ...supplierConfidence.missingInputs,
      ...cashflowStress.missingInputs,
      ...negotiation.missingInputs,
      ...certification.missingInputs,
    ]),
  ].slice(0, 5);

  // ── Top risks ─────────────────────────────────────────────────────────────
  const topRisks = [
    ...survivability.operationalRisks,
    ...returnRisk.reasons.filter(r => returnRisk.level !== 'Low'),
    supplierConfidence.risks[0],
  ].filter(Boolean).filter((v, i, a) => a.indexOf(v) === i).slice(0, 3) as string[];

  // ── Top actions ───────────────────────────────────────────────────────────
  const topActions = [
    ...survivability.recommendedActions,
    ...supplierConfidence.nextActions,
    ...cashflowStress.recommendations,
  ].filter(Boolean).filter((v, i, a) => a.indexOf(v) === i).slice(0, 3) as string[];

  return {
    categories,
    freightSensitivity,
    certification,
    returnRisk,
    freightVolatility,
    supplierConfidence,
    cashflowStress,
    negotiation,
    survivability,
    overallHealthScore,
    overallHealthLabel,
    allMissingInputs,
    topRisks,
    topActions,
  };
}

export function buildIntelligenceCopilotContext(intel: SourcingIntelligenceResult): string {
  const { certification, returnRisk, freightVolatility, supplierConfidence, cashflowStress, negotiation, survivability } = intel;

  const lines: string[] = [
    '=== AI SUPPLY CHAIN INTELLIGENCE ===',
    `Overall health: ${intel.overallHealthLabel} (${intel.overallHealthScore}/100)`,
    `Launch survivability: ${survivability.rating} (confidence: ${survivability.confidence}) — ${survivability.recommendation}`,
    '',
    // Certification
    `Certification: ${certification.level} — ${certification.headline}`,
    certification.certs.length > 0 ? `  Required: ${certification.certs.join(', ')}` : '',
    certification.supplierDocsToDemand.length > 0 ? `  Demand from supplier: ${certification.supplierDocsToDemand[0]}` : '',
    '',
    // Return risk with mitigation
    `Return risk: ${returnRisk.level} (confidence: ${returnRisk.confidence}, ~${returnRisk.returnRate} rate) — ${returnRisk.headline}`,
    returnRisk.mitigations.length > 0 ? `  Top mitigation: ${returnRisk.mitigations[0]}` : '',
    returnRisk.reasons.length > 0 ? `  Reason: ${returnRisk.reasons[0]}` : '',
    '',
    // Freight volatility
    `Freight volatility: ${freightVolatility.level} (${freightVolatility.freightLabel} freight) — ${freightVolatility.headline}`,
    freightVolatility.hedges.length > 0 ? `  Action: ${freightVolatility.hedges[0]}` : '',
    freightVolatility.seasonalPeaks.length > 0 ? `  Seasonal peak: ${freightVolatility.seasonalPeaks[0]}` : '',
    '',
    // Supplier confidence
    `Supplier confidence: ${supplierConfidence.level} (score: ${supplierConfidence.score}/100) — ${supplierConfidence.headline}`,
    supplierConfidence.risks.length > 0 ? `  Risk: ${supplierConfidence.risks[0]}` : '',
    supplierConfidence.nextActions.length > 0 ? `  Next action: ${supplierConfidence.nextActions[0]}` : '',
    supplierConfidence.beginnerFriendly ? '  ✓ Beginner-friendly sourcing path' : '  ⚠ Not recommended for first-time sellers without a sourcing agent',
    '',
    // Cashflow
    `Cashflow stress: ${cashflowStress.level} (confidence: ${cashflowStress.confidence})`,
    cashflowStress.estimatedCapital > 0 ? `  Launch capital: ~$${cashflowStress.estimatedCapital.toLocaleString()} | Payback: ${cashflowStress.paybackLabel}` : '',
    cashflowStress.recommendations.length > 0 ? `  Action: ${cashflowStress.recommendations[0]}` : '',
    '',
    // Negotiation
    negotiation.currentUnitCost > 0
      ? `Negotiation: current $${negotiation.currentUnitCost}/unit → target ~$${negotiation.targetUnitCost} (${negotiation.savingsRangeLow}–${negotiation.savingsRangeHigh}% realistic range, ${negotiation.confidence} confidence)`
      : '',
    negotiation.levers.length > 0 ? `  Best lever: ${negotiation.levers[0].lever} — ${negotiation.levers[0].impact} impact` : '',
    negotiation.openingScript && negotiation.currentUnitCost > 0 ? `  Opening script: ${negotiation.openingScript}` : '',
    '',
    // Survivability gate failures
    ...survivability.gates.filter(g => g.passed === false).map(g => `⚠ GATE FAIL: ${g.label} — ${g.detail} → ${g.fixHint}`),
    '',
    // Top missing inputs
    intel.allMissingInputs.length > 0
      ? `Missing data (reduces confidence): ${intel.allMissingInputs.slice(0, 3).join('; ')}`
      : '',
  ];

  return lines.filter(l => l !== '').join('\n');
}
