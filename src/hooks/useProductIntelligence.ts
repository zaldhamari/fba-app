// Single-call hook: assembles pipeline + profile inputs and builds
// ProductIntelligenceProfile once per dependency change.
// All screens import this hook — never call computeSourcingIntelligence directly.

import { useMemo } from 'react';
import { usePipeline }        from '../context/PipelineContext';
import { useCurrency }        from '../context/CurrencyContext';
import { useSellerProfile }   from './useSellerProfile';
import type { FreightMode }   from '../lib/sourcingStrategy';
import { inferCategories }    from '../lib/sourcingStrategy';
import {
  buildProductIntelligence,
  type ProductIntelligenceInputs,
} from '../lib/productIntelligence/buildProductIntelligence';
import type { ProductIntelligenceProfile } from '../lib/productIntelligence/types';

// confirmedFreightOverride: pass when a screen has a more accurate freight quote
// than costModel.freight (e.g. SourcingLogisticsScreen's freight estimator result).
export function useProductIntelligence(
  confirmedFreightOverride?: number | null,
): ProductIntelligenceProfile | null {
  const pipeline         = usePipeline();
  const { marketplace }  = useCurrency();
  const { profile }      = useSellerProfile();

  const {
    activeProduct, selectedSupplier, supplierQuotes,
    costModel, sourcingStrategy, reconInsights, freightEstimate,
  } = pipeline;

  // Use stable primitive deps to avoid recomputing when unrelated pipeline fields change
  // (e.g. barcodeMode, labelTemplate). Full objects get new references on every persist().
  const productAsin  = activeProduct?.asin;
  const productPrice = activeProduct?.price;
  const productTitle = activeProduct?.title;
  const supplierName = selectedSupplier?.name;
  const supplierCost = selectedSupplier?.unitCost;
  const marginPct    = costModel?.marginPct;
  const freightCost  = costModel?.freight;
  const freightPerUnit = freightEstimate?.perUnitCost;
  const freightMode_   = freightEstimate?.selectedMode;
  const sourcingDiff   = sourcingStrategy?.sourcingDifficulty;
  const freightSens    = sourcingStrategy?.freightSensitivity;

  return useMemo(() => {
    // Need at least a product or a supplier to produce any output
    if (!activeProduct && !selectedSupplier) return null;

    // Derive confirmed freight: override > cost model > persisted freightEstimate > null
    const confirmedFreightPerUnit: number | null =
      confirmedFreightOverride != null && confirmedFreightOverride > 0
        ? confirmedFreightOverride
        : costModel?.freight && costModel.freight > 0
        ? costModel.freight
        : freightEstimate?.perUnitCost && freightEstimate.perUnitCost > 0
        ? freightEstimate.perUnitCost
        : null;

    // Derive freight mode: persisted estimate > sensitivity heuristic
    const freightMode: FreightMode =
      freightEstimate?.selectedMode === 'air' ? 'air' :
      freightEstimate?.selectedMode === 'local' ? 'local' :
      sourcingStrategy?.freightSensitivity === 'Extreme' ? 'air' :
      'sea';

    // Derive conservative category-based weight when none is confirmed.
    // This improves freight sensitivity accuracy before supplier data arrives.
    const weightKgEstimate: number | undefined = (() => {
      if (!activeProduct?.title) return undefined;
      const cats = inferCategories(activeProduct.title);
      if (cats.large)      return 5.0;   // oversized/furniture
      if (cats.fragile)    return 1.0;   // glass/ceramic — conservative
      if (cats.electronics) return 0.5;
      if (cats.smallGoods) return 0.2;   // silicone/clips/organizers
      return 0.4;                        // general default
    })();

    // Margin risk: null when no cost model (never default to 'Medium').
    // costModel.marginPct is a PERCENTAGE (e.g. 30 = 30%), so thresholds are 55/35,
    // not 0.55/0.35 — the fraction form made every profitable product read 'Low'.
    const estimatedMarginRisk =
      costModel?.marginPct != null
        ? costModel.marginPct > 55 ? 'Low' as const
        : costModel.marginPct > 35 ? 'Medium' as const
        : 'High' as const
        : null;

    const inputs: ProductIntelligenceInputs = {
      product:                 activeProduct,
      selectedSupplier:        selectedSupplier,
      supplierQuotes:          supplierQuotes ?? [],
      confirmedFreightPerUnit,
      weightKgEstimate,
      marketplace,
      freightMode,
      sourcingDifficulty:      sourcingStrategy?.sourcingDifficulty ?? 'Beginner',
      estimatedMarginRisk,
      reconInsights:           reconInsights,
      sellerExperience:        profile?.experience,
      sellerBudget:            profile?.budget,
    };

    return buildProductIntelligence(inputs);
  }, [
    // Stable primitives instead of full pipeline objects to prevent unnecessary
    // recomputation when unrelated pipeline fields update (e.g. barcodeMode changes).
    activeProduct, selectedSupplier, // still need full objects for inputs
    productAsin, productPrice, productTitle,
    supplierName, supplierCost,
    marginPct, freightCost, freightPerUnit, freightMode_, sourcingDiff, freightSens,
    supplierQuotes,
    reconInsights,
    marketplace,
    profile?.experience,
    profile?.budget,
    confirmedFreightOverride,
  ]);
}
