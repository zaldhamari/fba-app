// ── Phase 15: Decision Simulation Engine ─────────────────────────────────────
// Applies hypothetical overrides to ProductIntelligenceInputs WITHOUT mutating
// any pipeline state. Calls buildProductIntelligence once — no engine duplication.

import {
  buildProductIntelligence,
  type ProductIntelligenceInputs,
} from '../productIntelligence/buildProductIntelligence';
import type { ProductIntelligenceProfile } from '../productIntelligence/types';
import type { SimulationOverrides, SimulationResult } from './types';
import { buildSimulationDelta } from './buildSimulationDelta';
import { buildSimulationImpacts } from './buildSimulationImpact';

// ── Override application ──────────────────────────────────────────────────────

function applyOverrides(
  base: ProductIntelligenceInputs,
  overrides: SimulationOverrides,
): ProductIntelligenceInputs {
  const sim: ProductIntelligenceInputs = { ...base };

  // ── Supplier overrides ────────────────────────────────────────────────────
  const hasSupplierOverride =
    overrides.unitCostOverride != null ||
    overrides.moqOverride      != null ||
    overrides.supplierCountry  != null ||
    overrides.supplierGrade    != null ||
    overrides.supplierPlatform != null ||
    overrides.leadTimeDaysOverride != null;

  if (hasSupplierOverride) {
    const baseSup = base.selectedSupplier ?? {
      name:     'Simulated Supplier',
      platform: overrides.supplierPlatform ?? 'Alibaba',
      unitCost: 0,
      moq:      500,
    };
    sim.selectedSupplier = {
      ...baseSup,
      unitCost:      overrides.unitCostOverride     ?? baseSup.unitCost,
      moq:           overrides.moqOverride          ?? baseSup.moq,
      country:       overrides.supplierCountry      ?? baseSup.country,
      grade:         overrides.supplierGrade        ?? baseSup.grade,
      platform:      overrides.supplierPlatform     ?? baseSup.platform,
      leadTimeDays:  overrides.leadTimeDaysOverride ?? baseSup.leadTimeDays,
    };
    // Create synthetic quote array so negotiation engine has data
    sim.supplierQuotes = [sim.selectedSupplier];
  }

  // ── Freight overrides ─────────────────────────────────────────────────────
  if (overrides.localSourcing) {
    sim.freightMode = 'local';
    // Local sourcing: estimate freight at ~15% of unit cost or $0.80 minimum
    const unitCost = sim.selectedSupplier?.unitCost ?? base.selectedSupplier?.unitCost ?? 5;
    sim.confirmedFreightPerUnit = overrides.freightCostOverride ?? Math.max(0.80, unitCost * 0.15);
    // Local sourcing is simpler — reduce sourcing difficulty
    if (!overrides.supplierCountry && base.sourcingDifficulty === 'Advanced') {
      sim.sourcingDifficulty = 'Intermediate';
    } else if (base.sourcingDifficulty !== 'Advanced') {
      sim.sourcingDifficulty = 'Beginner';
    }
  } else {
    if (overrides.freightMode) sim.freightMode = overrides.freightMode;
    if (overrides.freightCostOverride != null) {
      sim.confirmedFreightPerUnit = overrides.freightCostOverride;
    }
  }

  // Air freight: higher cost, faster — estimate 3× sea if not overridden
  if (overrides.freightMode === 'air' && overrides.freightCostOverride == null && !overrides.localSourcing) {
    const baseSea = base.confirmedFreightPerUnit ?? (sim.selectedSupplier?.unitCost ?? 5) * 0.35;
    sim.confirmedFreightPerUnit = baseSea * 3;
  }

  // ── Margin risk recompute ─────────────────────────────────────────────────
  // Recalculate margin risk when cost or price changes
  const simUnitCost    = sim.selectedSupplier?.unitCost ?? 0;
  const simFreight     = sim.confirmedFreightPerUnit ?? 0;
  const simSellPrice   = overrides.sellingPriceOverride ?? base.product?.price ?? 0;

  if (simSellPrice > 0 && (simUnitCost > 0 || simFreight > 0)) {
    // Net margin = gross margin minus Amazon fees (referral 15% + FBA ~15% = 30%).
    // Thresholds are percentages (55 / 35) matching costModel.marginPct in
    // useProductIntelligence — using gross margin here made every scenario
    // ~30 points too optimistic compared to the base profile.
    const grossFraction = (simSellPrice - simUnitCost - simFreight) / simSellPrice;
    const netMarginPct  = (grossFraction - 0.30) * 100; // 0.30 = REFERRAL_RATE + FBA_FEE_RATE
    sim.estimatedMarginRisk =
      netMarginPct > 55 ? 'Low' :
      netMarginPct > 35 ? 'Medium' : 'High';
  }

  // ── Seller profile overrides ──────────────────────────────────────────────
  if (overrides.sellerExperience) sim.sellerExperience = overrides.sellerExperience;
  if (overrides.sellerBudget != null) sim.sellerBudget = overrides.sellerBudget;

  // ── Marketplace override ──────────────────────────────────────────────────
  if (overrides.marketplace) sim.marketplace = overrides.marketplace as any;

  // ── Compliance overrides ──────────────────────────────────────────────────
  // certificationVerified: lower effective sourcing difficulty as proxy
  if (overrides.certificationVerified && base.sourcingDifficulty === 'Advanced') {
    sim.sourcingDifficulty = 'Intermediate';
  }
  // addInspection: marginally increases sourcing difficulty (more process)
  if (overrides.addInspection && sim.sourcingDifficulty === 'Beginner') {
    sim.sourcingDifficulty = 'Intermediate';
  }

  return sim;
}

// ── Estimate if overrides introduce unconfirmed data ─────────────────────────

function detectEstimated(
  base: ProductIntelligenceInputs,
  overrides: SimulationOverrides,
): boolean {
  // Supplier country change without new unit cost → cost is estimated
  if (overrides.supplierCountry && overrides.unitCostOverride == null) return true;
  // Platform change without new cost → estimated
  if (overrides.supplierPlatform && overrides.unitCostOverride == null) return true;
  // Air freight estimated from sea base (no explicit override)
  if (overrides.freightMode === 'air' && overrides.freightCostOverride == null) return true;
  // Local sourcing freight estimate (unless override provided)
  if (overrides.localSourcing && overrides.freightCostOverride == null) return true;
  // Supplier grade change without new cost → estimated
  if (overrides.supplierGrade && overrides.unitCostOverride == null && !base.selectedSupplier?.grade) return true;
  return false;
}

// ── Main entry point ──────────────────────────────────────────────────────────

export function simulateDecision(
  base:      ProductIntelligenceInputs,
  baseProfile: ProductIntelligenceProfile,
  overrides: SimulationOverrides,
): SimulationResult {
  const simInputs  = applyOverrides(base, overrides);
  const simProfile = buildProductIntelligence(simInputs);

  const delta      = buildSimulationDelta(baseProfile, simProfile);
  const impacts    = buildSimulationImpacts(overrides, delta, baseProfile, simProfile);
  const isEstimated = detectEstimated(base, overrides);
  const estimatedNote = isEstimated
    ? 'Based on estimated inputs — add confirmed supplier quote and freight to improve accuracy.'
    : undefined;

  return { overrides, profile: simProfile, delta, impacts, isEstimated, estimatedNote };
}
