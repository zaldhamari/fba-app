import { PipelineSupplier } from '../../context/PipelineContext';
import { DataConfidence } from './types';

export type StressLevel = 'Low' | 'Medium' | 'High' | 'Critical' | 'Unknown';

export interface CashflowStressResult {
  level:              StressLevel;
  confidence:         DataConfidence;
  score:              number;            // 0–100 stress score
  estimatedCapital:   number;            // total launch cash required ($)
  // Payback expressed in months (integer) — labeled correctly
  paybackMonths:      number | null;     // null = unknown (no sales estimate)
  paybackLabel:       string;            // human-readable, e.g. "~3 months" or "Unknown"
  headline:           string;
  breakdown: {
    label:         string;
    amount:        number;
    isEstimated:   boolean;
  }[];
  recommendations:    string[];
  missingInputs:      string[];
}

// Shared freight estimate rate — matches financialEngine's ROUGH_LANDED_MULT (×1.35 → 35% overhead)
const ROUGH_FREIGHT_RATE = 0.35;

export function computeCashflowStress(
  selectedSupplier: PipelineSupplier | null,
  supplierQuotes: PipelineSupplier[],
  confirmedFreightPerUnit: number | null,
  productPrice: number | undefined,
  estimatedMonthlySales: number | undefined = undefined,
): CashflowStressResult {
  const sup = selectedSupplier ?? supplierQuotes[0] ?? null;
  const missingInputs: string[] = [];

  // ── No data guard — return Unknown, not Low ──────────────────────────────
  if (!sup || !productPrice || productPrice <= 0) {
    if (!sup) missingInputs.push('Supplier cost and MOQ (select a supplier in Sourcing tab)');
    if (!productPrice) missingInputs.push('Product price (select a product in Research tab)');
    return {
      level: 'Unknown',
      confidence: 'Unknown',
      score: 0,
      estimatedCapital: 0,
      paybackMonths: null,
      paybackLabel: 'Unknown',
      headline: 'Add a supplier and product to unlock cashflow analysis.',
      breakdown: [],
      recommendations: ['Complete supplier and product selection to unlock capital requirements.'],
      missingInputs,
    };
  }

  const unitCost = sup.unitCost ?? 0;
  const moq = Math.max(1, sup.moq ?? 100);

  // ── Freight — consistent with financialEngine rough estimate ─────────────
  const freightIsConfirmed = confirmedFreightPerUnit != null && confirmedFreightPerUnit > 0;
  const freightPerUnit = freightIsConfirmed
    ? confirmedFreightPerUnit!
    : unitCost * ROUGH_FREIGHT_RATE;

  if (!freightIsConfirmed) {
    missingInputs.push('Confirmed freight (get a forwarder quote in Freight tab) — current estimate may be ±40% off');
  }

  // ── Capital breakdown ─────────────────────────────────────────────────────
  const inventoryCost = unitCost * moq;
  const freightTotal  = freightPerUnit * moq;
  // FBA fees: use 15% referral + ~$3 pick/pack as rough per-unit estimate for first batch
  // Treated as capital exposure during first sell-through, not upfront cash — shown separately
  const fbaFeePerUnit = productPrice * 0.15 + 3.0;
  const fbaFeeTotal   = fbaFeePerUnit * moq;
  // PPC budget: scaled by price tier (higher price = higher CPC market)
  const ppcDailyEst = productPrice > 50 ? 35 : productPrice > 25 ? 22 : 15;
  const ppcBudget = ppcDailyEst * 30;  // first 30 days of launch

  const totalCapital = inventoryCost + freightTotal + ppcBudget;
  // FBA fees are not upfront cash — Amazon deducts from each sale — but shown as exposure
  const totalExposure = totalCapital + fbaFeeTotal;

  // ── Payback calculation — in MONTHS using estimated sales ────────────────
  let paybackMonths: number | null = null;
  let paybackLabel = 'Unknown — add monthly sales estimate';

  const monthlySales = estimatedMonthlySales ?? 0;
  if (monthlySales > 0 && unitCost > 0) {
    const netPerUnit = productPrice * 0.85 - freightPerUnit - unitCost - fbaFeePerUnit;
    const monthlyNetProfit = netPerUnit * monthlySales;
    if (monthlyNetProfit > 0) {
      paybackMonths = Math.ceil(totalCapital / monthlyNetProfit);
      paybackLabel = paybackMonths <= 1 ? '~1 month' :
                     paybackMonths <= 6 ? `~${paybackMonths} months` : `~${paybackMonths}+ months (long)`;
    }
  } else {
    missingInputs.push('Monthly sales estimate — analyse a product to get demand estimates');
  }

  // ── Stress score ──────────────────────────────────────────────────────────
  let score = 0;

  if (totalCapital > 25000) score = 85;
  else if (totalCapital > 15000) score = 70;
  else if (totalCapital > 8000)  score = 50;
  else if (totalCapital > 3000)  score = 30;
  else if (totalCapital > 1500)  score = 15;
  else                           score = 8;

  if (paybackMonths !== null && paybackMonths > 16) score = Math.min(100, score + 20);
  if (paybackMonths !== null && paybackMonths > 24) score = Math.min(100, score + 15);
  if (moq > 1000)   score = Math.min(100, score + 15);
  if (!freightIsConfirmed) score = Math.min(100, score + 8);  // unconfirmed freight = higher uncertainty risk

  score = Math.max(0, Math.min(100, score));

  let level: StressLevel = 'Low';
  if (score >= 70) level = 'Critical';
  else if (score >= 50) level = 'High';
  else if (score >= 30) level = 'Medium';

  const confidence: DataConfidence =
    freightIsConfirmed && monthlySales > 0 ? 'Medium' :
    unitCost > 0 ? 'Low' : 'Unknown';

  const headlines: Record<Exclude<StressLevel, 'Unknown'>, string> = {
    Low:      `~$${totalCapital.toLocaleString()} launch capital required — manageable for most sellers.`,
    Medium:   `~$${totalCapital.toLocaleString()} required — moderate commitment. Payback ${paybackLabel}.`,
    High:     `~$${totalCapital.toLocaleString()} required — significant capital. Validate demand before committing. Payback ${paybackLabel}.`,
    Critical: `~$${totalCapital.toLocaleString()} required — critical capital risk. Reduce MOQ or secure funding before proceeding.`,
  };

  const recommendations: string[] = [];
  if (moq > 300) recommendations.push(`Negotiate MOQ from ${moq} down to 100–200 units for first order — frame it as a "trial run" with committed reorder.`);
  if (paybackMonths !== null && paybackMonths > 12) recommendations.push('Consider a slightly lower launch price to accelerate sales velocity and shorten payback period.');
  recommendations.push(`Keep 3 months of PPC reserve (~$${(ppcBudget * 3).toLocaleString()}) available before inventory arrives at Amazon.`);
  if (level === 'Critical') recommendations.push('Explore inventory financing (e.g. Clearco, Payability, Kickfurther) to avoid overextending personal capital.');
  if (!freightIsConfirmed) recommendations.push('Get a confirmed sea freight quote — current freight estimate (35% of unit cost) may be significantly wrong for your product weight.');

  return {
    level,
    confidence,
    score,
    estimatedCapital: Math.round(totalCapital),
    paybackMonths,
    paybackLabel,
    headline: headlines[level as Exclude<StressLevel, 'Unknown'>],
    breakdown: [
      { label: 'Inventory (unit cost × MOQ)',    amount: Math.round(inventoryCost), isEstimated: false },
      { label: `Freight${freightIsConfirmed ? ' (confirmed)' : ' (estimated ~35%)'}`, amount: Math.round(freightTotal), isEstimated: !freightIsConfirmed },
      { label: `PPC launch budget (~${ppcDailyEst}/day × 30d)`, amount: ppcBudget, isEstimated: true },
      { label: 'Amazon fees exposure (sold through)', amount: Math.round(fbaFeeTotal), isEstimated: true },
    ],
    recommendations: recommendations.slice(0, 3),
    missingInputs,
  };
}
