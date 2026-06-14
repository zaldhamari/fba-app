// ── Phase 15: Decision Simulation Hook ───────────────────────────────────────
// Manages simulation override state and memoizes SimulationResult.
// Mirrors useProductIntelligence's input assembly — applies overrides on top.
// NEVER mutates pipeline state.

import { useState, useMemo, useCallback } from 'react';
import { usePipeline }      from '../context/PipelineContext';
import { useCurrency }      from '../context/CurrencyContext';
import { useSellerProfile } from './useSellerProfile';
import type { FreightMode } from '../lib/sourcingStrategy';
import type { ProductIntelligenceInputs } from '../lib/productIntelligence/buildProductIntelligence';
import type { ProductIntelligenceProfile } from '../lib/productIntelligence/types';
import type { SimulationOverrides, SimulationResult } from '../lib/productSimulation/types';
import { simulateDecision } from '../lib/productSimulation/simulateDecision';

const EMPTY_OVERRIDES: SimulationOverrides = {};

function hasAnyOverride(o: SimulationOverrides): boolean {
  return Object.keys(o).some(k => (o as any)[k] !== undefined);
}

// ── Hook return shape ─────────────────────────────────────────────────────────

export interface DecisionSimulationState {
  overrides:          SimulationOverrides;
  simulationResult:   SimulationResult | null;  // null when no overrides active
  hasActiveOverrides: boolean;
  updateOverride:     <K extends keyof SimulationOverrides>(key: K, value: SimulationOverrides[K]) => void;
  removeOverride:     <K extends keyof SimulationOverrides>(key: K) => void;
  resetOverrides:     () => void;
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useDecisionSimulation(
  baseProfile: ProductIntelligenceProfile | null,
  confirmedFreightOverride?: number | null,
): DecisionSimulationState {
  const pipeline         = usePipeline();
  const { marketplace }  = useCurrency();
  const { profile }      = useSellerProfile();

  const [overrides, setOverrides] = useState<SimulationOverrides>(EMPTY_OVERRIDES);

  const updateOverride = useCallback(<K extends keyof SimulationOverrides>(
    key: K,
    value: SimulationOverrides[K],
  ) => {
    setOverrides(prev => ({ ...prev, [key]: value }));
  }, []);

  const removeOverride = useCallback(<K extends keyof SimulationOverrides>(key: K) => {
    setOverrides(prev => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
  }, []);

  const resetOverrides = useCallback(() => {
    setOverrides(EMPTY_OVERRIDES);
  }, []);

  const hasActiveOverrides = hasAnyOverride(overrides);

  // Reconstruct base inputs (mirrors useProductIntelligence — no duplication of computation)
  const baseInputs = useMemo((): ProductIntelligenceInputs | null => {
    if (!baseProfile) return null;

    const {
      activeProduct, selectedSupplier, supplierQuotes,
      costModel, sourcingStrategy, reconInsights,
    } = pipeline;

    const confirmedFreightPerUnit: number | null =
      confirmedFreightOverride != null && confirmedFreightOverride > 0
        ? confirmedFreightOverride
        : costModel?.freight && costModel.freight > 0
        ? costModel.freight
        : null;

    const freightMode: FreightMode =
      sourcingStrategy?.freightSensitivity === 'Extreme' ? 'air' :
      sourcingStrategy?.freightSensitivity === 'High'    ? 'sea' : 'sea';

    // costModel.marginPct is a PERCENTAGE (e.g. 30 = 30%), so thresholds are 55/35,
    // not 0.55/0.35. (simulateDecision recomputes its own fraction-based marginPct.)
    const estimatedMarginRisk =
      costModel?.marginPct != null
        ? costModel.marginPct > 55 ? 'Low' as const
        : costModel.marginPct > 35 ? 'Medium' as const
        : 'High' as const
        : null;

    return {
      product:                 activeProduct,
      selectedSupplier:        selectedSupplier,
      supplierQuotes:          supplierQuotes ?? [],
      confirmedFreightPerUnit,
      marketplace,
      freightMode,
      sourcingDifficulty:      sourcingStrategy?.sourcingDifficulty ?? 'Beginner',
      estimatedMarginRisk,
      reconInsights,
      sellerExperience:        profile?.experience,
      sellerBudget:            profile?.budget,
    };
  }, [
    baseProfile,
    pipeline.activeProduct,
    pipeline.selectedSupplier,
    pipeline.supplierQuotes,
    pipeline.costModel,
    pipeline.sourcingStrategy,
    pipeline.reconInsights,
    marketplace,
    profile?.experience,
    profile?.budget,
    confirmedFreightOverride,
  ]);

  // Memoized simulation — only recomputes when overrides or base inputs change
  const simulationResult = useMemo((): SimulationResult | null => {
    if (!hasActiveOverrides) return null;
    if (!baseInputs || !baseProfile) return null;
    return simulateDecision(baseInputs, baseProfile, overrides);
  }, [overrides, baseInputs, baseProfile, hasActiveOverrides]);

  return {
    overrides,
    simulationResult,
    hasActiveOverrides,
    updateOverride,
    removeOverride,
    resetOverrides,
  };
}
