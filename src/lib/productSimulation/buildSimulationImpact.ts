// ── Phase 15: Simulation Impact Builder ──────────────────────────────────────
// Generates human-readable, directional impact summaries per domain.
// Language must be proportionate — never alarmist in research context.

import type { ProductIntelligenceProfile } from '../productIntelligence/types';
import type { SimulationOverrides, SimulationDelta, SimulationImpact } from './types';

const THRESHOLD = 5; // min score delta to register as improved/worsened

function direction(delta: number): 'improved' | 'worsened' | 'neutral' {
  if (delta >= THRESHOLD)  return 'improved';
  if (delta <= -THRESHOLD) return 'worsened';
  return 'neutral';
}

export function buildSimulationImpacts(
  overrides:   SimulationOverrides,
  delta:       SimulationDelta,
  base:        ProductIntelligenceProfile,
  sim:         ProductIntelligenceProfile,
): SimulationImpact[] {
  const impacts: SimulationImpact[] = [];

  // ── Survivability ─────────────────────────────────────────────────────────
  const survDir = direction(delta.survivabilityScoreDelta);
  if (survDir !== 'neutral' || delta.overallLabelChanged) {
    let summary: string;
    let detail:  string | undefined;

    if (overrides.supplierCountry) {
      summary = survDir === 'improved'
        ? `Survivability improved — ${overrides.supplierCountry} reduces tariff and lead-time exposure.`
        : `Survivability unchanged — ${overrides.supplierCountry} doesn't resolve the primary risk.`;
    } else if (overrides.localSourcing) {
      summary = 'Local sourcing simplifies logistics and removes import tariff risk.';
      detail  = 'Lead times shorten significantly but margin headroom may tighten.';
    } else if (overrides.freightMode === 'air') {
      summary = 'Air freight increases launch speed but raises cashflow stress at scale.';
      detail  = 'Good for first batch validation — plan to switch to sea for reorders.';
    } else if (delta.overallLabelChanged) {
      summary = `Overall launch profile shifted: ${delta.overallLabelDelta}.`;
    } else {
      summary = survDir === 'improved'
        ? `Survivability score improved (+${delta.survivabilityScoreDelta} pts).`
        : `Survivability score declined (${delta.survivabilityScoreDelta} pts).`;
    }

    impacts.push({ domain: 'Survivability', direction: survDir, summary, detail });
  }

  // ── Seller fit ────────────────────────────────────────────────────────────
  const fitDir = direction(delta.sellerFitScoreDelta);
  if (fitDir !== 'neutral' || delta.sellerFitLevelChanged) {
    let summary: string;
    let detail:  string | undefined;

    if (overrides.sellerExperience === 'selling') {
      summary = 'Seller fit improved — experienced seller profile reduces execution risk.';
    } else if (overrides.sellerExperience === 'beginner') {
      summary = 'Seller fit recalculated for beginner — additional blockers may appear.';
      detail  = 'Beginner path reveals compliance and capital risks more clearly.';
    } else if (overrides.moqOverride && overrides.moqOverride < 500) {
      summary = 'Lower MOQ reduces capital requirement — improves beginner safety.';
      detail  = 'Smaller initial order reduces risk but may weaken negotiation leverage.';
    } else if (delta.sellerFitLevelChanged) {
      summary = `Seller fit changed: ${delta.sellerFitLevelDelta}.`;
    } else {
      summary = fitDir === 'improved'
        ? `Seller fit score improved (+${delta.sellerFitScoreDelta} pts).`
        : `Seller fit score declined (${delta.sellerFitScoreDelta} pts).`;
    }

    impacts.push({ domain: 'Seller Fit', direction: fitDir, summary, detail });
  }

  // ── Cashflow ──────────────────────────────────────────────────────────────
  const cashDir = direction(delta.cashflowScoreDelta);
  if (cashDir !== 'neutral') {
    let summary: string;
    let detail:  string | undefined;

    const baseCapital = base.raw.sourcing.cashflowStress.estimatedCapital;
    const simCapital  = sim.raw.sourcing.cashflowStress.estimatedCapital;
    const capDiff     = simCapital - baseCapital;

    if (Math.abs(capDiff) >= 200) {
      const capLabel = capDiff > 0
        ? `+$${capDiff.toLocaleString()} more capital required`
        : `-$${Math.abs(capDiff).toLocaleString()} capital saved`;
      summary = cashDir === 'improved'
        ? `Cashflow stress reduced — ${capLabel}.`
        : `Cashflow stress increased — ${capLabel}.`;
    } else if (overrides.freightMode === 'air') {
      summary = 'Air freight raises launch capital requirement significantly.';
      detail  = 'Air freight typically costs 3–4× sea per unit.';
    } else if (overrides.localSourcing) {
      summary = 'Local sourcing can reduce landed cost and free up working capital.';
    } else {
      summary = cashDir === 'improved'
        ? 'Cashflow stress reduced under this scenario.'
        : 'Cashflow stress increases under this scenario.';
    }

    impacts.push({ domain: 'Cashflow', direction: cashDir, summary, detail });
  }

  // ── Freight ───────────────────────────────────────────────────────────────
  const freightDir = direction(delta.freightScoreDelta);
  if (freightDir !== 'neutral' || overrides.freightMode || overrides.freightCostOverride != null) {
    let summary: string;
    let detail:  string | undefined;

    if (overrides.freightCostOverride != null) {
      summary = freightDir === 'improved'
        ? 'Confirmed freight quote reduces cost uncertainty — confidence improves.'
        : 'Higher freight cost reduces margin headroom.';
      detail  = freightDir === 'improved'
        ? 'Confirmed quotes allow accurate cost modeling and better negotiation positioning.'
        : undefined;
    } else if (overrides.freightMode === 'air') {
      summary = 'Air freight: faster launch, lower volume efficiency, higher per-unit cost.';
      detail  = 'Use for first small batch or urgency restocks — not for large orders.';
    } else if (overrides.localSourcing) {
      summary = 'Local sourcing eliminates ocean freight risk and lead-time variability.';
    } else if (overrides.freightMode === 'sea') {
      summary = 'Sea freight: optimal cost efficiency for large orders. Higher lead time.';
    } else {
      summary = freightDir === 'improved'
        ? 'Freight stability improved under this scenario.'
        : 'Freight volatility increases under this scenario.';
    }

    impacts.push({ domain: 'Freight', direction: freightDir, summary, detail });
  }

  // ── Certification ─────────────────────────────────────────────────────────
  const certDir = direction(delta.certScoreDelta);
  if (certDir !== 'neutral' || overrides.certificationVerified) {
    let summary: string;

    if (overrides.certificationVerified) {
      summary = 'Certification verified — compliance risk resolved. Reduces seller execution risk.';
    } else if (overrides.marketplace && overrides.marketplace !== (base.raw.sourcing.certification.level)) {
      summary = `Marketplace switch may change certification requirements — verify compliance for ${overrides.marketplace}.`;
    } else {
      summary = certDir === 'improved'
        ? 'Certification complexity reduced under this scenario.'
        : 'Certification requirements increase under this scenario.';
    }

    impacts.push({
      domain: 'Certification',
      direction: overrides.certificationVerified ? 'improved' : certDir,
      summary,
    });
  }

  // ── Confidence ───────────────────────────────────────────────────────────
  if (delta.confidenceChanged) {
    const confDir = ((): 'improved' | 'worsened' | 'neutral' => {
      const ranks: Record<string, number> = { Unknown: 0, Low: 1, Medium: 2, High: 3 };
      const baseR = ranks[base.overallConfidence] ?? 0;
      const simR  = ranks[sim.overallConfidence]  ?? 0;
      return simR > baseR ? 'improved' : simR < baseR ? 'worsened' : 'neutral';
    })();

    impacts.push({
      domain:    'Confidence',
      direction: confDir,
      summary:   `Intelligence confidence changed: ${delta.confidenceDelta}.`,
      detail:    confDir === 'improved'
        ? 'More confirmed inputs reduce uncertainty in the assessment.'
        : 'This scenario introduces estimated inputs — add confirmed data to improve accuracy.',
    });
  }

  // ── Return mitigation ─────────────────────────────────────────────────────
  if (overrides.returnMitigationEnabled) {
    impacts.push({
      domain:    'Returns',
      direction: 'improved',
      summary:   'Return mitigation plan reduces post-launch return rate exposure.',
      detail:    sim.domains.returns.actionableRecommendations[0] ?? 'Include size guides, clear product photos, and quality control specs.',
    });
  }

  // ── Packaging upgrade ─────────────────────────────────────────────────────
  if (overrides.packagingUpgrade) {
    impacts.push({
      domain:    'Differentiation',
      direction: 'improved',
      summary:   'Premium packaging can lift perceived value and reduce return rate.',
      detail:    'Budget $0.50–2.00/unit for packaging uplift — validate ROI against margin impact.',
    });
  }

  // ── Inspection ────────────────────────────────────────────────────────────
  if (overrides.addInspection) {
    impacts.push({
      domain:    'Quality',
      direction: 'improved',
      summary:   'Third-party inspection reduces defect rate and listing suspension risk.',
      detail:    'Budget $200–400 per inspection. Essential for first production run.',
    });
  }

  return impacts;
}
