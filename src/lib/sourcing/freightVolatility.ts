import { FreightSensitivity, FreightMode } from '../sourcingStrategy';
import { DataConfidence } from './types';

export type VolatilityLevel = 'Stable' | 'Moderate' | 'Volatile' | 'Extreme' | 'Unknown';

export interface FreightVolatilityResult {
  level:           VolatilityLevel;
  confidence:      DataConfidence;
  score:           number;           // 0–100
  headline:        string;
  riskFactors:     string[];         // what's driving volatility
  seasonalPeaks:   string[];         // region-specific peaks (NOT hardcoded template)
  hedges:          string[];         // specific recommended actions
  freightLabel:    'Confirmed' | 'Estimated' | 'Unknown';
  recommendedMode: FreightMode;
}

// Maps supplier country strings (as stored in PipelineSupplier.country) to region ids
function regionFromCountry(country: string | undefined): 'china' | 'vietnam' | 'india' | 'turkey' | 'local' | 'unknown' {
  if (!country) return 'unknown';
  const c = country.toLowerCase();
  if (c.includes('china') || c.includes('🇨🇳')) return 'china';
  if (c.includes('vietnam') || c.includes('🇻🇳')) return 'vietnam';
  if (c.includes('india') || c.includes('🇮🇳')) return 'india';
  if (c.includes('turkey') || c.includes('🇹🇷')) return 'turkey';
  if (c.includes('local') || c.includes('domestic') || c.includes('united states') || c.includes('us ') || c.includes('🇺🇸')) return 'local';
  return 'china';  // safe default — most FBA suppliers are Chinese
}

// Region-specific seasonal disruptions
const SEASONAL_PEAKS: Record<string, string[]> = {
  china: [
    'Chinese New Year (Jan/Feb): 3–6 week factory closure — order 8+ weeks before to avoid stockout',
    'Sep–Oct: Pre-Golden Week port congestion — book freight in August for Q4 stock',
    'Q4 peak season surcharges (Oct–Dec): expect +30–80% on base sea freight rates',
  ],
  vietnam: [
    'Tết (Vietnamese New Year, Jan/Feb): 2–4 week factory closure — similar timing to China',
    'May–June: Rainy season can delay road transport to ports',
    'Q4: Shared peak season surcharges with global container market',
  ],
  india: [
    'Diwali (Oct/Nov): factory slowdowns in some regions — confirm with supplier',
    'Monsoon season (Jun–Sep): road transport to ports can be delayed',
    'Q4 peak season: shared surcharges — book early if shipping Oct–Dec',
  ],
  turkey: [
    'Ramadan: variable timing — some factories reduce output, confirm with supplier',
    'EU market peak (Q4): demand spike for EU-bound freight, earlier booking advised',
    'Summer (July–Aug): reduced factory output in some Turkish regions',
  ],
  local: [],  // no overseas shipping disruptions
  unknown: [
    'Q4 peak season (Oct–Dec): global surcharges of +30–80% on base rates across most shipping lanes',
    'Chinese New Year (Jan/Feb): affects most Asian-origin supply chains — plan 8 weeks ahead',
  ],
};

export function computeFreightVolatility(
  sensitivity: FreightSensitivity,
  freightMode: FreightMode,
  marketplace: string,
  confirmedFreightPerUnit: number | null,
  supplierCountry: string | undefined,
): FreightVolatilityResult {
  const region = regionFromCountry(supplierCountry);
  const riskFactors: string[] = [];
  const hedges: string[] = [];
  let score = 15;

  // null = no freight info at all → Unknown; 0 = explicitly zero → Unknown; >0 = Confirmed
  const freightLabel: 'Confirmed' | 'Estimated' | 'Unknown' =
    confirmedFreightPerUnit != null && confirmedFreightPerUnit > 0 ? 'Confirmed' :
    confirmedFreightPerUnit == null ? 'Unknown' : 'Estimated';

  // ── Sensitivity contribution ─────────────────────────────────────────────
  if (sensitivity === 'High') {
    score += 22;
    riskFactors.push('High freight sensitivity — small rate changes have significant margin impact.');
  } else if (sensitivity === 'Extreme') {
    score += 42;
    riskFactors.push('Extreme freight sensitivity — freight rate changes directly threaten product viability.');
    hedges.push('Negotiate DDP (Delivered Duty Paid) terms to fix total landed cost before ordering.');
  } else if (sensitivity === 'Medium') {
    score += 8;
  }

  // ── Freight mode ──────────────────────────────────────────────────────────
  if (freightMode === 'air') {
    score += 28;
    riskFactors.push('Air freight is 4–6× more volatile than sea freight — fuel surcharges and capacity constraints can double cost overnight.');
    hedges.push('Reserve air freight for urgent restocks only. Build sea freight into your standard replenishment cycle.');
  } else if (freightMode === 'sea') {
    score += 5;
    hedges.push('Book sea freight 4–6 weeks before cargo ready date to lock in current spot rate.');
  } else if (freightMode === 'local') {
    score -= 15;
    // local sourcing is inherently stable
  } else if (freightMode === 'hybrid') {
    score += 12;
    riskFactors.push('Hybrid sea/air strategy — air leg adds rate volatility risk during peak seasons.');
  }

  // ── Unconfirmed freight increases uncertainty ─────────────────────────────
  if (freightLabel !== 'Confirmed') {
    score += 8;
    riskFactors.push('No confirmed freight quote — actual rates may differ from estimates by ±40%.');
    hedges.push('Get a confirmed freight quote from a forwarder before finalising your cost model.');
  }

  // ── Region-specific risk ───────────────────────────────────────────────────
  if (region === 'china') {
    score += 8;
    riskFactors.push('China-origin shipments face the highest peak-season congestion and CNY factory closure risk.');
  } else if (region === 'turkey') {
    score -= 5;  // proximity to EU reduces volatility for EU sellers
  } else if (region === 'local') {
    score -= 20;
    riskFactors.push('Local sourcing eliminates overseas freight volatility entirely.');
  }

  // ── Marketplace ────────────────────────────────────────────────────────────
  const euMarkets = ['UK', 'DE', 'EU', 'FR', 'IT', 'ES'];
  if (marketplace === 'US' || euMarkets.includes(marketplace)) {
    score += 6;
  }

  score = Math.max(0, Math.min(100, score));

  let level: VolatilityLevel = 'Stable';
  if (score >= 65) level = 'Extreme';
  else if (score >= 45) level = 'Volatile';
  else if (score >= 25) level = 'Moderate';

  const seasonalPeaks = SEASONAL_PEAKS[region] ?? SEASONAL_PEAKS.unknown;

  // Add peak-specific hedges
  if (region !== 'local' && score > 25) {
    hedges.push('Avoid shipping in Q4 (Oct–Dec) if possible — peak surcharges can add 30–80% to base rates.');
  }
  if ((region === 'china' || region === 'vietnam') && score > 30) {
    hedges.push('Place production orders before November to ensure stock arrives before Chinese New Year factory closure.');
  }

  const recommendedMode: FreightMode =
    sensitivity === 'Extreme' && region === 'local' ? 'local' :
    sensitivity === 'Extreme' ? 'sea' :
    sensitivity === 'High' ? 'sea' :
    freightMode;

  const hasConfirmedFreight = confirmedFreightPerUnit != null && confirmedFreightPerUnit > 0;
  const confidence: DataConfidence =
    supplierCountry && hasConfirmedFreight ? 'Medium' :
    supplierCountry || hasConfirmedFreight ? 'Low' : 'Unknown';

  const headlines: Record<VolatilityLevel, string> = {
    Stable:   'Freight costs are stable — low rate volatility risk for this product.',
    Moderate: 'Moderate freight volatility — buffer $0.50/unit above current quote and book early.',
    Volatile: 'Significant freight volatility — lock in rates early and model a worst-case landed cost.',
    Extreme:  'Extreme freight volatility — fix total landed cost via DDP or local sourcing before committing capital.',
    Unknown:  'Freight volatility unknown — confirm supplier location and freight quote to assess.',
  };

  return {
    level,
    confidence,
    score,
    headline: headlines[level],
    riskFactors: riskFactors.slice(0, 3),
    seasonalPeaks: seasonalPeaks.slice(0, 3),
    hedges: hedges.slice(0, 3),
    freightLabel,
    recommendedMode,
  };
}
