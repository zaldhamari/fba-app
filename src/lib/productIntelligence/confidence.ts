import type { IntelligenceConfidence } from './types';
import type { SourcingIntelligenceResult } from '../sourcing/sourcingIntelligence';

// Derives the overall confidence level from the domain-level signals.
// The rule: UNKNOWN > FALSE CERTAINTY.
// A product with missing supplier + missing freight + no costs MUST return 'Unknown'.
export function aggregateConfidence(
  intel:             SourcingIntelligenceResult,
  hasProduct:        boolean,
  hasSupplier:       boolean,
  hasCostModel:      boolean,
  hasConfirmedFreight: boolean,
  hasRecon:          boolean,
): IntelligenceConfidence {
  // No product at all → cannot assess anything
  if (!hasProduct) return 'Unknown';

  // No supplier + no cost model = foundationally unknown
  if (!hasSupplier && !hasCostModel) return 'Unknown';

  // Survivability is Unknown (no product data) → system is Unknown
  if (intel.survivability.rating === 'Unknown') return 'Unknown';

  // Count confidence signals
  let signals = 0;
  const total  = 5;

  if (hasSupplier)         signals++;
  if (hasCostModel)        signals++;
  if (hasConfirmedFreight) signals++;
  if (hasRecon)            signals++;
  if (intel.supplierConfidence.level !== 'Unknown') signals++;

  // Map to confidence level
  if (signals >= 4 && intel.supplierConfidence.level !== 'Low')  return 'Medium';
  if (signals >= 2)                                               return 'Low';
  if (signals >= 1)                                               return 'Low';
  return 'Unknown';
}

// Builds the overall explainability sentence from the top domain causes.
// Example: "Risky because freight is unconfirmed, supplier grade is D, and certification is complex."
export function buildExplainability(
  overallLabel: string,
  topCauses: string[],
  overallConfidence: IntelligenceConfidence,
): string {
  if (overallLabel === 'Unknown') {
    return 'Assessment is incomplete — add a product, supplier, and cost model to generate full intelligence.';
  }
  if (topCauses.length === 0) {
    return overallLabel === 'Strong'
      ? 'All key supply chain factors are within acceptable range.'
      : 'Score derived from category and pipeline data.';
  }

  const causeSummary = topCauses.length === 1
    ? topCauses[0]
    : topCauses.slice(0, -1).join(', ') + ', and ' + topCauses[topCauses.length - 1];

  const confidenceNote = overallConfidence === 'Unknown' || overallConfidence === 'Low'
    ? ' (low confidence — add more data to improve accuracy)'
    : '';

  return `${overallLabel} because ${causeSummary.charAt(0).toLowerCase() + causeSummary.slice(1)}${confidenceNote}.`;
}
