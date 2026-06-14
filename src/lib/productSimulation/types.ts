// ── Phase 15: Decision Simulation Types ──────────────────────────────────────
// All types are sandboxed — simulation NEVER mutates pipeline state.

import type { ProductIntelligenceProfile, IntelligenceConfidence } from '../productIntelligence/types';
import type { FreightMode } from '../sourcingStrategy';

// ── Overrides applied on top of the live pipeline state ──────────────────────

export interface SimulationOverrides {
  // Supplier
  supplierCountry?:      string;         // e.g. 'Vietnam', 'India', 'Local'
  supplierPlatform?:     string;         // e.g. 'Alibaba', 'IndiaMART'
  unitCostOverride?:     number;         // $/unit
  moqOverride?:          number;         // units
  leadTimeDaysOverride?: number;         // days
  supplierGrade?:        'A' | 'B' | 'C' | 'D';
  addInspection?:        boolean;

  // Freight
  freightMode?:          FreightMode;
  freightCostOverride?:  number;         // $/unit — treated as confirmed when set
  localSourcing?:        boolean;        // true → mode='local', lower freight estimate

  // Financial
  sellingPriceOverride?: number;         // $

  // Seller profile
  sellerExperience?:     'beginner' | 'some' | 'selling';
  sellerBudget?:         number;         // $

  // Marketplace
  marketplace?:          string;         // 'US' | 'UK' | 'EU' | 'CA'

  // Compliance
  certificationVerified?: boolean;
  returnMitigationEnabled?: boolean;
  packagingUpgrade?:      boolean;
}

// ── Numeric delta between base and simulated profiles ─────────────────────────

export interface SimulationDelta {
  overallScoreDelta:       number;       // positive = better
  survivabilityScoreDelta: number;
  sellerFitScoreDelta:     number;
  cashflowScoreDelta:      number;
  freightScoreDelta:       number;
  certScoreDelta:          number;
  supplierScoreDelta:      number;

  overallLabelChanged:     boolean;
  overallLabelDelta:       string | null;       // e.g. "Risky → Viable"
  confidenceChanged:       boolean;
  confidenceDelta:         string | null;       // e.g. "Low → Medium"
  sellerFitLevelChanged:   boolean;
  sellerFitLevelDelta:     string | null;       // e.g. "AdvancedOnly → Intermediate"
}

// ── Human-readable domain impact ──────────────────────────────────────────────

export interface SimulationImpact {
  domain:     string;
  direction:  'improved' | 'worsened' | 'neutral';
  summary:    string;   // one-line explanation
  detail?:    string;   // optional WHY
}

// ── Full simulation result ────────────────────────────────────────────────────

export interface SimulationResult {
  overrides:      SimulationOverrides;
  profile:        ProductIntelligenceProfile;  // the simulated profile (sandboxed)
  delta:          SimulationDelta;
  impacts:        SimulationImpact[];
  isEstimated:    boolean;    // true when overrides introduce unconfirmed inputs
  estimatedNote?: string;     // shown in UI: "Based on estimated inputs"
}
