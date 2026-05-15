import { calculateShipping, ShipMode, ShipOrigin, ShipMarket } from '../utils/shippingCalcs';
import { FREIGHT_COMPANIES, FreightCompany } from '../data/freightCompanies';

// ─── Input / Output types ─────────────────────────────────────────────────────

export type FreightPriority = 'cost' | 'speed' | 'balanced';

export interface FreightSearchInputs {
  units:          number;
  unitWeightKg:   number;
  cartonLengthCm: number;
  cartonWidthCm:  number;
  cartonHeightCm: number;
  cartonWeightKg: number;
  cartonUnits:    number;
  origin:         ShipOrigin;
  marketplace:    ShipMarket;
  preferredMode:  ShipMode;
  priority:       FreightPriority;
}

export interface FreightCompanyResult {
  company:        FreightCompany;
  mode:           ShipMode;
  totalCostUsd:   number;
  costPerUnit:    number;
  transitDays:    string;   // e.g. "25–35 days"
  score:          number;   // 0–100 composite
  serviceScore:   number;   // company base score (1–5)
  rank:           number;
  recommended:    boolean;
}

export interface FreightSearchResult {
  results:     FreightCompanyResult[];
  bestCost:    FreightCompanyResult;
  bestSpeed:   FreightCompanyResult;
  bestBalance: FreightCompanyResult;
}

// ─── Transit string helpers ───────────────────────────────────────────────────

function scaleDays(transitStr: string, mult: number): string {
  // transitStr like "25–35 days" or "5–8 days"
  const match = transitStr.match(/(\d+)[–-](\d+)/);
  if (!match) return transitStr;
  const lo = Math.round(Number(match[1]) * mult);
  const hi = Math.round(Number(match[2]) * mult);
  return `${lo}–${hi} days`;
}

function transitToMidpoint(transitStr: string): number {
  const match = transitStr.match(/(\d+)[–-](\d+)/);
  if (!match) return 30;
  return (Number(match[1]) + Number(match[2])) / 2;
}

// ─── Composite score (0–100) ──────────────────────────────────────────────────

function computeScore(
  result:   FreightCompanyResult,
  allCosts: number[],
  allDays:  number[],
  priority: FreightPriority,
): number {
  const minCost = Math.min(...allCosts);
  const maxCost = Math.max(...allCosts);
  const minDays = Math.min(...allDays);
  const maxDays = Math.max(...allDays);

  const costRange = maxCost - minCost || 1;
  const dayRange  = maxDays - minDays || 1;
  const midDays   = transitToMidpoint(result.transitDays);

  const costScore    = 1 - (result.totalCostUsd - minCost) / costRange;  // 0–1, higher = cheaper
  const speedScore   = 1 - (midDays - minDays) / dayRange;                // 0–1, higher = faster
  const serviceScore = (result.serviceScore - 1) / 4;                     // 0–1

  let w = { cost: 0.4, speed: 0.3, service: 0.3 };
  if (priority === 'cost')    w = { cost: 0.65, speed: 0.15, service: 0.20 };
  if (priority === 'speed')   w = { cost: 0.15, speed: 0.65, service: 0.20 };

  return Math.round((costScore * w.cost + speedScore * w.speed + serviceScore * w.service) * 100);
}

// ─── Main search function ─────────────────────────────────────────────────────

export function searchFreightCompanies(inputs: FreightSearchInputs): FreightSearchResult {
  // Build a full ShippingInputs for the base rate engine (dummy sell price / product cost)
  const baseInputs = {
    units:           inputs.units,
    unitWeightKg:    inputs.unitWeightKg,
    lengthCm:        inputs.cartonLengthCm,
    widthCm:         inputs.cartonWidthCm,
    heightCm:        inputs.cartonHeightCm,
    cartonUnits:     inputs.cartonUnits,
    cartonWeightKg:  inputs.cartonWeightKg,
    cartonLengthCm:  inputs.cartonLengthCm,
    cartonWidthCm:   inputs.cartonWidthCm,
    cartonHeightCm:  inputs.cartonHeightCm,
    productCostUsd:  10,
    sellingPriceUsd: 25,
    marketplace:     inputs.marketplace,
    origin:          inputs.origin,
    incoterms:       'FOB' as const,
    dutyPct:         0,
    tariffPct:       0,
  };

  const baseResult = calculateShipping(baseInputs);
  const baseMode   = baseResult.modes.find(m => m.mode === inputs.preferredMode)
                  ?? baseResult.modes[0];

  // Build results for each company that supports the preferred mode
  const raw: Omit<FreightCompanyResult, 'score' | 'rank'>[] = FREIGHT_COMPANIES
    .filter(c => c.methods.includes(inputs.preferredMode))
    .map(company => {
      const totalCostUsd = baseMode.totalShippingUsd * company.rateMult;
      const costPerUnit  = inputs.units > 0 ? totalCostUsd / inputs.units : 0;
      const baseTransit  = baseMode.transitDays; // "25–35 days"
      const transitDays  = scaleDays(baseTransit, company.transitMult);

      return {
        company,
        mode:         inputs.preferredMode,
        totalCostUsd: Math.round(totalCostUsd * 100) / 100,
        costPerUnit:  Math.round(costPerUnit * 100) / 100,
        transitDays,
        serviceScore: company.scoreBase,
        recommended:  company.recommended ?? false,
      };
    });

  // Compute composite scores
  const allCosts = raw.map(r => r.totalCostUsd);
  const allDays  = raw.map(r => transitToMidpoint(r.transitDays));

  const results: FreightCompanyResult[] = raw
    .map(r => ({
      ...r,
      score: computeScore(r as FreightCompanyResult, allCosts, allDays, inputs.priority),
    }))
    .sort((a, b) => b.score - a.score)
    .map((r, i) => ({ ...r, rank: i + 1 }));

  const bestCost    = [...results].sort((a, b) => a.totalCostUsd - b.totalCostUsd)[0];
  const bestSpeed   = [...results].sort((a, b) =>
    transitToMidpoint(a.transitDays) - transitToMidpoint(b.transitDays)
  )[0];
  const bestBalance = results[0]; // already sorted by balanced score

  return { results, bestCost, bestSpeed, bestBalance };
}

// ─── Saved freight selection (persisted payload) ──────────────────────────────

export interface SavedFreightSelection {
  companyName:  string;
  mode:         ShipMode;
  totalCostUsd: number;
  costPerUnit:  number;
  transitDays:  string;
  savedAt:      string;
}
