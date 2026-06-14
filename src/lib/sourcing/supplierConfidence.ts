import { PipelineSupplier } from '../../context/PipelineContext';
import { SourcingDifficulty } from '../sourcingStrategy';
import { DataConfidence } from './types';

export type ConfidenceLevel = 'High' | 'Medium' | 'Low' | 'Unknown';

export interface SupplierConfidenceResult {
  level:            ConfidenceLevel;
  confidence:       DataConfidence;
  score:            number;          // 0–100
  positiveSignals:  string[];
  risks:            string[];
  headline:         string;
  nextActions:      string[];
  beginnerFriendly: boolean;
  missingInputs:    string[];
}

// Research-only platforms that require more due diligence
const RESEARCH_ONLY_PLATFORMS = ['1688', 'taobao', 'yiwugo', 'indiamart', 'global-sources', 'made-in-china', 'dhgate', 'aliexpress'];

function gradeScore(grade: string | undefined): number {
  if (!grade) return 0;
  const g = grade.toUpperCase().trim();
  if (g === 'A' || g === 'A+') return 20;
  if (g === 'B' || g === 'B+') return 12;
  if (g === 'C')                return 4;
  if (g === 'D')                return -15;
  if (g === 'F')                return -25;
  return 0;
}

export function computeSupplierConfidence(
  selectedSupplier: PipelineSupplier | null,
  supplierQuotes: PipelineSupplier[],
  difficulty: SourcingDifficulty,
  sellerExperience: 'beginner' | 'some' | 'selling' | undefined = undefined,
): SupplierConfidenceResult {
  const positiveSignals: string[] = [];
  const risks: string[] = [];
  const nextActions: string[] = [];
  const missingInputs: string[] = [];

  // ── No supplier ──────────────────────────────────────────────────────────
  if (selectedSupplier === null) {
    return {
      level: 'Unknown',
      confidence: 'Unknown',
      score: 0,
      positiveSignals: [],
      risks: ['No supplier selected — confidence cannot be assessed.'],
      headline: 'No supplier selected. Add a supplier to unlock confidence scoring.',
      nextActions: [
        'Search suppliers in the Sourcing tab and lock in at least one candidate.',
        'Get quotes from 2–3 suppliers before committing — competitive pricing validates unit cost.',
        'Order samples from your top pick before placing a bulk order.',
      ],
      beginnerFriendly: false,
      missingInputs: ['Supplier selection'],
    };
  }

  // Starting score is 20 — require real evidence to earn confidence
  let score = 20;

  // ── Unit cost ─────────────────────────────────────────────────────────────
  if (selectedSupplier.unitCost > 0) {
    score += 10;
    positiveSignals.push(`Unit cost confirmed: $${selectedSupplier.unitCost.toFixed(2)}/unit`);
  } else {
    missingInputs.push('Unit cost — required for financial modelling');
  }

  // ── MOQ ───────────────────────────────────────────────────────────────────
  if (selectedSupplier.moq > 0) {
    if (selectedSupplier.moq <= 100) {
      score += 12;
      positiveSignals.push(`Very low MOQ (${selectedSupplier.moq} units) — minimal capital commitment for first order`);
    } else if (selectedSupplier.moq <= 300) {
      score += 8;
      positiveSignals.push(`Manageable MOQ (${selectedSupplier.moq} units)`);
    } else if (selectedSupplier.moq <= 1000) {
      score += 2;
    } else {
      score -= 18;
      risks.push(`High MOQ (${selectedSupplier.moq.toLocaleString()} units) — significant capital commitment before demand is proven. Negotiate to 300–500 max.`);
      nextActions.push(`Negotiate MOQ down to 200–300 units for your first order — frame it as a "trial run" with a committed reorder.`);
    }
  } else {
    missingInputs.push('MOQ — needed to assess capital requirements');
  }

  // ── Supplier grade ────────────────────────────────────────────────────────
  const gScore = gradeScore(selectedSupplier.grade);
  if (gScore > 0) {
    score += gScore;
    positiveSignals.push(`Supplier grade: ${selectedSupplier.grade} — quality signal confirmed`);
  } else if (gScore < 0) {
    score += gScore;  // adds negative
    risks.push(`Supplier grade: ${selectedSupplier.grade} — significant quality risk. Run a full sample test before ordering.`);
    nextActions.push('Order a full quality inspection (QC) before releasing production payment.');
  } else {
    missingInputs.push('Supplier grade — analyse the supplier in the Sourcing tab to generate a quality grade');
  }

  // ── Lead time ─────────────────────────────────────────────────────────────
  if (selectedSupplier.leadTimeDays != null) {
    if (selectedSupplier.leadTimeDays <= 30) {
      score += 8;
      positiveSignals.push(`Short lead time (${selectedSupplier.leadTimeDays} days) — fast reorder cycle`);
    } else if (selectedSupplier.leadTimeDays <= 45) {
      score += 3;
    } else if (selectedSupplier.leadTimeDays <= 60) {
      score -= 5;
      risks.push(`Extended lead time (${selectedSupplier.leadTimeDays} days) — plan reorders 8+ weeks in advance to avoid stockout.`);
    } else {
      score -= 12;
      risks.push(`Very long lead time (${selectedSupplier.leadTimeDays} days) — high stockout risk. Requires 12-week forward planning.`);
      nextActions.push('Set up a reorder alert when stock falls below 10 weeks of supply.');
    }
  } else {
    missingInputs.push('Lead time — ask supplier for production lead time in days');
  }

  // ── Platform ─────────────────────────────────────────────────────────────
  const platform = selectedSupplier.platform?.toLowerCase() ?? '';
  if (platform === 'alibaba') {
    score += 8;
    positiveSignals.push('Alibaba Trade Assurance — escrow protection available for payment security');
  } else if (platform === '1688') {
    score -= 8;
    risks.push('1688 is factory-direct but Chinese-only — requires a sourcing agent for communication, payments, and export logistics.');
    nextActions.push('Engage a verified sourcing agent before placing any 1688 order (Yiwugo, Supplyia, etc.).');
  } else if (platform === 'dhgate' || platform === 'aliexpress') {
    score -= 5;
    risks.push(`${selectedSupplier.platform} is a retail/sample platform — MOQ and wholesale pricing may not reflect true factory costs.`);
    nextActions.push('Use this supplier for sample evaluation only — negotiate direct factory pricing before bulk order.');
  } else if (RESEARCH_ONLY_PLATFORMS.includes(platform)) {
    score -= 3;
  } else if (platform) {
    score += 2;  // other specified platform is better than none
  } else {
    missingInputs.push('Supplier platform — needed to assess escrow/protection options');
  }

  // ── Country / sourcing-origin signal ─────────────────────────────────────
  const country = (selectedSupplier.country ?? '').toLowerCase();
  if (!platform) {
    if (country.includes('china') || country.includes('vietnam') || country.includes('india')) {
      missingInputs.push('Supplier platform — overseas supplier without a platform makes escrow/payment protection unverifiable');
    } else if (country.includes('united states') || country.includes('us ') || country === 'us') {
      score += 5;
      positiveSignals.push('Domestic US supplier — simpler logistics, no customs/import duties');
    }
  }

  // ── Multiple quotes ───────────────────────────────────────────────────────
  const totalQuotes = supplierQuotes.length + 1;  // include selected supplier
  if (totalQuotes >= 3) {
    score += 15;
    positiveSignals.push(`${totalQuotes} supplier quotes compared — competitive pricing validated`);
  } else if (totalQuotes === 2) {
    score += 8;
    positiveSignals.push('2 supplier quotes compared — basic competitive benchmark established');
  } else {
    score -= 8;
    risks.push('Only one supplier quote — no competitive pricing benchmark. You may be paying above market.');
    nextActions.push('Get at least one more quote to validate your unit cost is market-competitive.');
  }

  // ── Sourcing difficulty modifier ─────────────────────────────────────────
  if (difficulty === 'Advanced') {
    score -= 10;
    risks.push('Advanced sourcing difficulty — higher compliance, negotiation, and logistics burden.');
  } else if (difficulty === 'Beginner') {
    score += 5;
  }

  // ── Seller experience modifier ────────────────────────────────────────────
  const isBeginner = !sellerExperience || sellerExperience === 'beginner';
  if (isBeginner && difficulty === 'Advanced') {
    risks.push('Advanced sourcing with a beginner seller — consider a sourcing agent to reduce execution risk.');
    nextActions.push('Consider hiring a sourcing agent (Sourcify, Yiwugo, Supplyia) to manage factory communication and QC for your first order.');
  }

  score = Math.max(0, Math.min(100, score));

  let level: ConfidenceLevel = 'Low';
  if (score >= 65) level = 'High';
  else if (score >= 40) level = 'Medium';

  const confidence: DataConfidence =
    selectedSupplier.grade && selectedSupplier.leadTimeDays != null && totalQuotes >= 2 ? 'Medium' :
    selectedSupplier.unitCost > 0 ? 'Low' : 'Unknown';

  const headlines: Record<ConfidenceLevel, string> = {
    Unknown: 'No supplier data — confidence cannot be assessed.',
    Low:     'Low supplier confidence — complete due diligence before committing any capital.',
    Medium:  'Moderate supplier confidence — a few gaps remain before placing a production order.',
    High:    'High supplier confidence — proceed to sample validation and production terms.',
  };

  // Beginner-friendly assessment
  const beginnerFriendly =
    difficulty !== 'Advanced' &&
    (selectedSupplier.moq ?? 500) <= 300 &&
    platform !== '1688' &&
    platform !== 'taobao';

  return {
    level,
    confidence,
    score,
    positiveSignals: positiveSignals.slice(0, 4),
    risks: risks.slice(0, 3),
    headline: headlines[level],
    nextActions: nextActions.slice(0, 3),
    beginnerFriendly,
    missingInputs,
  };
}
