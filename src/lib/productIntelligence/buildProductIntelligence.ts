// ── Unified Product Intelligence Orchestrator ─────────────────────────────────
// This is the ONLY place that assembles a ProductIntelligenceProfile.
// All screens and Copilot read from this output — never re-compute independently.
//
// It does NOT duplicate engine logic. It calls computeSourcingIntelligence once,
// then enriches the result with: seller fit, unified confidence, explainability,
// deduplicated actions/risks, and centralized missing inputs.

import {
  computeSourcingIntelligence,
  buildIntelligenceCopilotContext,
  type SourcingIntelligenceInputs,
} from '../sourcing/sourcingIntelligence';
import { computeSellerFit } from './sellerFit';
import { aggregateConfidence, buildExplainability } from './confidence';
import { buildTopActions, buildTopRisks, buildMissingInputs } from './actions';
import type {
  ProductIntelligenceProfile,
  DomainIntelligence,
  IntelligenceConfidence,
} from './types';

export interface ProductIntelligenceInputs extends SourcingIntelligenceInputs {
  sellerBudget?: number;  // from SellerProfile.budget
}

// ── Domain intelligence builders ──────────────────────────────────────────────
// These map engine outputs → canonical DomainIntelligence shape with explainability.

function certDomain(intel: ReturnType<typeof computeSourcingIntelligence>): DomainIntelligence {
  const c = intel.certification;
  const topCauses: string[] = [];
  if (c.level === 'Complex')   topCauses.push(`complex certification (${c.certs.slice(0, 2).join(', ')})`);
  if (c.level === 'Standard')  topCauses.push(`standard compliance required (${c.certs[0] ?? 'self-declaration'})`);
  if (c.level === 'DocumentationOnly') topCauses.push('supplier documentation required (no lab testing)');

  return {
    domain: 'certification',
    level:  c.level,
    score:  c.score,
    confidence: c.confidence as IntelligenceConfidence,
    headline: c.headline,
    explainability: topCauses.length > 0
      ? `Certification is ${c.level.toLowerCase()} because ${topCauses.join(' and ')}.`
      : 'No mandatory certification detected for this product and marketplace.',
    topCauses,
    actionableRecommendations: c.supplierDocsToDemand.slice(0, 3),
    missingInputs: c.missingInputs,
    estimatedInputs: c.level === 'None' ? ['category inference — verify with your supplier'] : [],
  };
}

function returnsDomain(intel: ReturnType<typeof computeSourcingIntelligence>): DomainIntelligence {
  const r = intel.returnRisk;
  return {
    domain: 'returns',
    level:  r.level,
    score:  r.score,
    confidence: r.confidence as IntelligenceConfidence,
    headline: r.headline,
    explainability: r.reasons.length > 0
      ? `Return risk is ${r.level.toLowerCase()} because ${r.reasons[0].charAt(0).toLowerCase() + r.reasons[0].slice(1)}`
      : `Return risk is ${r.level.toLowerCase()} based on category analysis.`,
    topCauses: r.reasons.slice(0, 3),
    actionableRecommendations: r.mitigations.slice(0, 3),
    missingInputs: r.missingInputs,
    estimatedInputs: r.confidence === 'Low' ? ['return rate estimated from category — run Recon for product-specific data'] : [],
  };
}

function freightDomain(intel: ReturnType<typeof computeSourcingIntelligence>): DomainIntelligence {
  const f = intel.freightVolatility;
  return {
    domain: 'freight',
    level:  f.level,
    score:  f.score,
    confidence: f.confidence as IntelligenceConfidence,
    headline: f.headline,
    explainability: f.riskFactors.length > 0
      ? `Freight is ${f.level.toLowerCase()} because ${f.riskFactors[0].charAt(0).toLowerCase() + f.riskFactors[0].slice(1)}`
      : `Freight volatility is ${f.level.toLowerCase()} based on mode and sensitivity.`,
    topCauses: f.riskFactors.slice(0, 3),
    actionableRecommendations: f.hedges.slice(0, 3),
    missingInputs: f.freightLabel === 'Unknown' ? ['Confirmed freight per unit — get a forwarder quote in Sourcing tab'] : [],
    estimatedInputs: f.freightLabel === 'Estimated' ? ['Freight cost estimated at 35% of unit cost — confirm with forwarder'] : [],
  };
}

function supplierDomain(intel: ReturnType<typeof computeSourcingIntelligence>): DomainIntelligence {
  const s = intel.supplierConfidence;
  return {
    domain: 'supplier',
    level:  s.level,
    score:  s.score,
    confidence: s.confidence as IntelligenceConfidence,
    headline: s.headline,
    explainability: s.level === 'Unknown'
      ? 'Supplier confidence is unknown — no supplier has been selected.'
      : s.risks.length > 0
      ? `Supplier confidence is ${s.level.toLowerCase()} because ${s.risks[0].charAt(0).toLowerCase() + s.risks[0].slice(1)}`
      : `Supplier confidence is ${s.level.toLowerCase()} based on available data.`,
    topCauses: s.risks.slice(0, 3),
    actionableRecommendations: s.nextActions.slice(0, 3),
    missingInputs: s.missingInputs,
    estimatedInputs: s.confidence === 'Low' ? ['supplier quality estimated — request grade and lead time'] : [],
  };
}

function cashflowDomain(intel: ReturnType<typeof computeSourcingIntelligence>): DomainIntelligence {
  const c = intel.cashflowStress;
  const estimatedInputs: string[] = [];
  if (c.breakdown.some(b => b.isEstimated)) {
    estimatedInputs.push('Freight estimated — confirmed quote will improve accuracy');
  }
  return {
    domain: 'cashflow',
    level:  c.level,
    score:  c.score,
    confidence: c.confidence as IntelligenceConfidence,
    headline: c.headline,
    explainability: c.level === 'Unknown'
      ? 'Cashflow stress is unknown — add a supplier and product to unlock capital requirements.'
      : c.level === 'Critical'
      ? `Cashflow is critical — $${c.estimatedCapital.toLocaleString()} launch capital required. Payback: ${c.paybackLabel}.`
      : `Cashflow stress is ${c.level.toLowerCase()} — approximately $${c.estimatedCapital.toLocaleString()} required. Payback: ${c.paybackLabel}.`,
    topCauses: c.recommendations.slice(0, 2),
    actionableRecommendations: c.recommendations.slice(0, 3),
    missingInputs: c.missingInputs,
    estimatedInputs,
  };
}

function negotiationDomain(intel: ReturnType<typeof computeSourcingIntelligence>): DomainIntelligence {
  const n = intel.negotiation;
  if (n.currentUnitCost === 0) {
    return {
      domain: 'negotiation',
      level: 'Unknown',
      score: 0,
      confidence: 'Unknown',
      headline: 'Add a supplier quote to unlock negotiation intelligence.',
      explainability: 'Negotiation strategy requires a unit cost to calculate target price.',
      topCauses: [],
      actionableRecommendations: ['Add a supplier quote in the Sourcing tab.'],
      missingInputs: n.missingInputs,
      estimatedInputs: [],
    };
  }
  return {
    domain: 'negotiation',
    level: n.confidence,
    score: n.confidence === 'Medium' ? 70 : n.confidence === 'Low' ? 40 : 20,
    confidence: n.confidence as IntelligenceConfidence,
    headline: `Target $${n.targetUnitCost.toFixed(2)}/unit (${n.savingsRangeLow}–${n.savingsRangeHigh}% realistic range, ${n.confidence} confidence).`,
    explainability: `Negotiation opportunity: $${(n.currentUnitCost - n.targetUnitCost).toFixed(2)}/unit savings with ${n.levers.length} leverage levers. Best lever: ${n.levers[0]?.lever ?? 'reorder commitment'}.`,
    topCauses: n.redFlags.slice(0, 2),
    actionableRecommendations: n.levers.slice(0, 2).map(l => `${l.lever} (${l.impact} impact): ${l.script.slice(0, 80)}…`),
    missingInputs: n.missingInputs,
    estimatedInputs: n.confidence === 'Low' ? ['Only 1 quote — target price estimate has low accuracy. Get 2+ quotes.'] : [],
  };
}

function survivabilityDomain(intel: ReturnType<typeof computeSourcingIntelligence>): DomainIntelligence {
  const s = intel.survivability;
  const failedGates = s.gates.filter(g => g.passed === false);
  const topCauses = failedGates.map(g => g.detail.slice(0, 80)).slice(0, 3);
  if (topCauses.length === 0 && s.operationalRisks[0]) topCauses.push(s.operationalRisks[0]);
  return {
    domain: 'survivability',
    level:  s.rating,
    score:  s.score,
    confidence: s.confidence as IntelligenceConfidence,
    headline: s.recommendation,
    explainability: s.rating === 'Unknown'
      ? 'Launch survivability is unknown — no product has been selected.'
      : failedGates.length > 0
      ? `Survivability is ${s.rating.toLowerCase()} because ${failedGates.length} gate(s) failed: ${failedGates.map(g => g.label).join(', ')}.`
      : `Survivability is ${s.rating.toLowerCase()} — ${s.recommendation}`,
    topCauses,
    actionableRecommendations: s.recommendedActions.slice(0, 3),
    missingInputs: s.gates.filter(g => g.passed === null).map(g => `${g.label} — cannot assess`),
    estimatedInputs: [],
  };
}

function sellerFitDomain(fit: ReturnType<typeof computeSellerFit>): DomainIntelligence {
  return {
    domain: 'sellerFit',
    level:  fit.level,
    score:  fit.score,
    confidence: fit.score > 0 ? 'Low' : 'Unknown',
    headline: fit.label,
    explainability: fit.blockers.length > 0
      ? `Not recommended for this seller because: ${fit.blockers[0]}`
      : fit.reasons.length > 0
      ? `Seller fit is ${fit.label.toLowerCase()} because ${fit.reasons[0].charAt(0).toLowerCase() + fit.reasons[0].slice(1)}.`
      : `Seller fit assessment: ${fit.label}.`,
    topCauses: [...fit.blockers, ...fit.reasons].slice(0, 3),
    actionableRecommendations: fit.suggestions.slice(0, 3),
    missingInputs: [],
    estimatedInputs: [],
  };
}

// ── Main builder ──────────────────────────────────────────────────────────────

export function buildProductIntelligence(inputs: ProductIntelligenceInputs): ProductIntelligenceProfile {
  const {
    product, selectedSupplier, supplierQuotes, confirmedFreightPerUnit,
    weightKgEstimate, marketplace, freightMode, sourcingDifficulty,
    estimatedMarginRisk, reconInsights, sellerExperience, sellerBudget,
  } = inputs;

  // ── Single call to the existing orchestration layer ───────────────────────
  const intel = computeSourcingIntelligence(inputs);

  // ── Seller fit ────────────────────────────────────────────────────────────
  const sellerFit = computeSellerFit({
    experience:         sellerExperience,
    budget:             sellerBudget,
    certLevel:          intel.certification.level,
    freightSensitivity: intel.freightSensitivity,
    sourcingDifficulty,
    cashflowLevel:      intel.cashflowStress.level,
    estimatedCapital:   intel.cashflowStress.estimatedCapital,
  });

  // ── Domain intelligence ───────────────────────────────────────────────────
  const domains = {
    certification: certDomain(intel),
    returns:       returnsDomain(intel),
    freight:       freightDomain(intel),
    supplier:      supplierDomain(intel),
    cashflow:      cashflowDomain(intel),
    negotiation:   negotiationDomain(intel),
    survivability: survivabilityDomain(intel),
    sellerFit:     sellerFitDomain(sellerFit),
  };

  // ── Centralized actions, risks, missing inputs ────────────────────────────
  const topActions   = buildTopActions(intel);
  const topRisks     = buildTopRisks(intel);
  const missingInputs = buildMissingInputs(intel);

  // ── Unified confidence ────────────────────────────────────────────────────
  const overallConfidence = aggregateConfidence(
    intel,
    product !== null,
    selectedSupplier !== null,
    estimatedMarginRisk !== null,
    confirmedFreightPerUnit != null && confirmedFreightPerUnit > 0,
    reconInsights != null && reconInsights.complaints.length > 0,
  );

  // ── Overall label and explainability ──────────────────────────────────────
  const overallLabel = intel.overallHealthLabel;
  const topCausesForExplain = [
    ...topRisks.slice(0, 2).map(r => r.trigger),
    ...Object.values(domains)
      .filter(d => d.confidence === 'Unknown' || d.level === 'Unknown')
      .map(d => `${d.domain} data missing`)
      .slice(0, 2),
  ].filter(Boolean).slice(0, 3);

  const overallExplainability = buildExplainability(overallLabel, topCausesForExplain, overallConfidence);

  // ── Copilot context ───────────────────────────────────────────────────────
  // Base: full engine-level detail (cert, freight, supplier, cashflow, negotiation, gates)
  // Appended: unified profile-level seller fit, top risks, top actions, missing inputs
  const baseContext = buildIntelligenceCopilotContext(intel);

  const profileContextLines: string[] = [
    '',
    '=== SELLER FIT ===',
    `Level: ${sellerFit.level} — ${sellerFit.label}`,
    sellerFit.blockers.length > 0 ? `Blockers: ${sellerFit.blockers.join('; ')}` : '',
    sellerFit.reasons.length > 0  ? `Reasons: ${sellerFit.reasons.slice(0, 2).join('; ')}` : '',
    sellerFit.suggestions.length > 0 ? `Suggestions: ${sellerFit.suggestions[0]}` : '',
    '',
    '=== TOP RISKS ===',
    ...topRisks.slice(0, 4).map((r, i) => `${i + 1}. [${r.domain}] ${r.action}`),
    '',
    '=== PRIORITY ACTIONS ===',
    ...topActions.slice(0, 4).map((a, i) => `${i + 1}. [${a.domain}] ${a.action}\n   Why: ${a.why}`),
    '',
    '=== MISSING DATA ===',
    missingInputs.length > 0
      ? missingInputs.slice(0, 5).map(m => `- ${m.field}: ${m.impact}`).join('\n')
      : 'No critical missing inputs.',
    '',
    `=== OVERALL CONFIDENCE: ${overallConfidence} ===`,
    overallExplainability,
  ];

  const copilotContext = `${baseContext}\n${profileContextLines.filter(l => l !== '').join('\n')}`;

  return {
    productTitle:          product?.title ?? 'Unknown Product',
    computedAt:            new Date().toISOString(),
    overallScore:          intel.overallHealthScore,
    overallLabel,
    overallConfidence,
    overallExplainability,
    domains,
    sellerFit,
    topRisks,
    topActions,
    missingInputs,
    copilotContext,
    raw: { sourcing: intel },
  };
}
