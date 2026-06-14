// ── Phase 15: Simulation Delta Builder ───────────────────────────────────────
// Computes numeric and categorical deltas between base and simulated profiles.

import type { ProductIntelligenceProfile, IntelligenceConfidence } from '../productIntelligence/types';
import type { SimulationDelta } from './types';

const CONF_RANK: Record<IntelligenceConfidence, number> = {
  Unknown: 0, Low: 1, Medium: 2, High: 3,
};

const LABEL_ORDER = ['Unknown', 'Risky', 'Marginal', 'Viable', 'Strong'] as const;

function labelRank(label: string): number {
  return LABEL_ORDER.indexOf(label as any) ?? -1;
}

export function buildSimulationDelta(
  base: ProductIntelligenceProfile,
  sim:  ProductIntelligenceProfile,
): SimulationDelta {
  const overallScoreDelta       = sim.overallScore - base.overallScore;
  const survivabilityScoreDelta = sim.domains.survivability.score - base.domains.survivability.score;
  const sellerFitScoreDelta     = sim.domains.sellerFit.score     - base.domains.sellerFit.score;
  const cashflowScoreDelta      = sim.domains.cashflow.score      - base.domains.cashflow.score;
  const freightScoreDelta       = sim.domains.freight.score       - base.domains.freight.score;
  const certScoreDelta          = sim.domains.certification.score - base.domains.certification.score;
  const supplierScoreDelta      = sim.domains.supplier.score      - base.domains.supplier.score;

  const baseConfRank = CONF_RANK[base.overallConfidence];
  const simConfRank  = CONF_RANK[sim.overallConfidence];
  const confidenceChanged = baseConfRank !== simConfRank;
  const confidenceDelta   = confidenceChanged
    ? `${base.overallConfidence} → ${sim.overallConfidence}`
    : null;

  const overallLabelChanged = base.overallLabel !== sim.overallLabel;
  const overallLabelDelta   = overallLabelChanged
    ? `${base.overallLabel} → ${sim.overallLabel}`
    : null;

  const sellerFitLevelChanged = base.sellerFit.level !== sim.sellerFit.level;
  const sellerFitLevelDelta   = sellerFitLevelChanged
    ? `${base.sellerFit.label} → ${sim.sellerFit.label}`
    : null;

  return {
    overallScoreDelta,
    survivabilityScoreDelta,
    sellerFitScoreDelta,
    cashflowScoreDelta,
    freightScoreDelta,
    certScoreDelta,
    supplierScoreDelta,
    confidenceChanged,
    confidenceDelta,
    overallLabelChanged,
    overallLabelDelta,
    sellerFitLevelChanged,
    sellerFitLevelDelta,
  };
}
