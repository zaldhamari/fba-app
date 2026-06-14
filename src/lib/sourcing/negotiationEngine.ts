import { PipelineSupplier } from '../../context/PipelineContext';
import { FreightSensitivity, SourcingDifficulty } from '../sourcingStrategy';
import { DataConfidence } from './types';

export interface NegotiationLever {
  lever:   string;
  impact:  'High' | 'Medium' | 'Low';
  script:  string;
}

export interface NegotiationEngineResult {
  targetUnitCost:     number;
  currentUnitCost:    number;
  // Dynamic range based on leverage position
  savingsRangeLow:    number;  // % lower bound (e.g. 8)
  savingsRangeHigh:   number;  // % upper bound (e.g. 18)
  confidence:         DataConfidence;
  levers:             NegotiationLever[];
  openingScript:      string;
  redFlags:           string[];
  missingInputs:      string[];
}

export function computeNegotiationStrategy(
  selectedSupplier: PipelineSupplier | null,
  supplierQuotes: PipelineSupplier[],
  sensitivity: FreightSensitivity,
  difficulty: SourcingDifficulty,
  productTitle: string,
  sellerExperience: 'beginner' | 'some' | 'selling' | undefined = undefined,
): NegotiationEngineResult {
  const allQuotes = [selectedSupplier, ...supplierQuotes].filter(Boolean) as PipelineSupplier[];
  const unitCosts = allQuotes.map(s => s.unitCost).filter(c => c > 0);
  const currentUnitCost = unitCosts.length ? Math.min(...unitCosts) : 0;
  const missingInputs: string[] = [];

  if (currentUnitCost === 0) {
    missingInputs.push('Supplier unit cost — enter a quote to unlock negotiation intelligence');
    return {
      targetUnitCost: 0,
      currentUnitCost: 0,
      savingsRangeLow: 0,
      savingsRangeHigh: 0,
      confidence: 'Unknown',
      levers: [],
      openingScript: 'Add a supplier quote to unlock negotiation recommendations.',
      redFlags: [],
      missingInputs,
    };
  }

  const totalQuotes = allQuotes.length;
  const primarySupplier = selectedSupplier ?? allQuotes[0];
  const moq = primarySupplier?.moq ?? 200;
  const platform = primarySupplier?.platform?.toLowerCase() ?? '';
  const isBeginner = !sellerExperience || sellerExperience === 'beginner';

  // ── Dynamic savings range based on leverage ───────────────────────────────
  // Base range: 5–12% (1 quote, no leverage)
  // Each additional quote adds ~3–4% to the upper bound
  // High MOQ commitment adds ~3%
  // Beginner seller = conservative (lower range shown to avoid overcommitting)
  let savingsLow = isBeginner ? 5 : 8;
  let savingsHigh = 12;

  if (totalQuotes >= 3) {
    savingsLow  = isBeginner ? 8  : 12;
    savingsHigh = isBeginner ? 18 : 22;
  } else if (totalQuotes === 2) {
    savingsLow  = isBeginner ? 6  : 10;
    savingsHigh = isBeginner ? 14 : 18;
  }

  if (moq >= 500)  savingsHigh = Math.min(25, savingsHigh + 4);
  if (moq >= 1000) savingsHigh = Math.min(28, savingsHigh + 4);

  // Platform modifiers
  if (platform === 'alibaba') {
    savingsHigh = Math.min(25, savingsHigh + 2);  // Alibaba has room for negotiation
  } else if (platform === 'dhgate' || platform === 'aliexpress') {
    savingsHigh = Math.min(savingsHigh, 10);  // retail platform, less room
    savingsLow  = Math.min(savingsLow, 5);
  }

  const midpointSavings = Math.round((savingsLow + savingsHigh) / 2);
  const targetUnitCost = Math.round(currentUnitCost * (1 - midpointSavings / 100) * 100) / 100;

  // ── Levers ────────────────────────────────────────────────────────────────
  const levers: NegotiationLever[] = [];
  const reorderQty = (primarySupplier?.moq ?? 200) * 3;

  levers.push({
    lever: 'Reorder commitment',
    impact: 'High',
    script: `"If the quality meets our standards, we'll place a reorder of ${reorderQty.toLocaleString()} units within 90 days. Can you reflect this long-term relationship in the first-order price?"`,
  });

  if (totalQuotes >= 2) {
    levers.push({
      lever: 'Competitive quote',
      impact: 'High',
      script: `"We've received a quote of $${targetUnitCost.toFixed(2)}/unit from another supplier. We prefer working with you based on your quality — can you match this price?"`,
    });
  }

  levers.push({
    lever: 'MOQ reduction',
    impact: 'Medium',
    script: `"Could you offer an initial trial MOQ of ${Math.max(50, Math.floor(moq * 0.5))} units at a slightly higher unit cost, with a full reorder at ${moq} units within 60 days? This reduces our risk for a first partnership."`,
  });

  levers.push({
    lever: 'Packaging simplification',
    impact: 'Medium',
    script: '"We can use standard poly-bag packaging instead of the retail box for our first batch. Would this reduce the unit cost?"',
  });

  if (sensitivity === 'High' || sensitivity === 'Extreme') {
    levers.push({
      lever: 'DDP freight terms',
      impact: 'High',
      script: '"Can you provide a DDP (Delivered Duty Paid) quote to our Amazon warehouse? We want to fix our total landed cost before committing to the order."',
    });
  }

  // ── Red flags ─────────────────────────────────────────────────────────────
  const redFlags: string[] = [];
  if (allQuotes.some(s => s.moq > 1000)) {
    redFlags.push(`MOQ above 1,000 units detected — target 200–500 for a first order to reduce capital risk.`);
  }
  if (totalQuotes === 1) {
    redFlags.push('Only one quote — you have no leverage. Get 1–2 more quotes before negotiating.');
  }
  if (platform === 'dhgate' || platform === 'aliexpress') {
    redFlags.push(`${primarySupplier?.platform} is a sample/retail platform. The unit cost is not a wholesale price — source directly from the factory for bulk pricing.`);
  }

  // ── Opening script ────────────────────────────────────────────────────────
  const shortTitle = productTitle.length > 32 ? productTitle.slice(0, 32) + '…' : productTitle;
  const openingScript = `"Hi, we're evaluating suppliers for ${shortTitle}. We're planning an initial order of ${moq} units and, if quality is good, a follow-up order of ${reorderQty.toLocaleString()} units within 90 days. What's your best unit price for ${moq} units, and do you offer a lower price at ${(moq * 2).toLocaleString()} units?"`;

  const confidence: DataConfidence = totalQuotes >= 2 ? 'Medium' : totalQuotes === 1 ? 'Low' : 'Unknown';

  return {
    targetUnitCost,
    currentUnitCost,
    savingsRangeLow: savingsLow,
    savingsRangeHigh: savingsHigh,
    confidence,
    levers: levers.slice(0, 4),
    openingScript,
    redFlags,
    missingInputs,
  };
}
