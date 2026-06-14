import type { CertLevel } from '../sourcing/certificationRisk';
import type { FreightSensitivity, SourcingDifficulty } from '../sourcingStrategy';
import type { StressLevel } from '../sourcing/cashflowStress';
import type { SellerFit, SellerFitLevel } from './types';

interface SellerFitInputs {
  experience:        'beginner' | 'some' | 'selling' | undefined;
  budget:            number | undefined;        // seller's stated total budget in USD
  certLevel:         CertLevel;
  freightSensitivity: FreightSensitivity;
  sourcingDifficulty: SourcingDifficulty;
  cashflowLevel:     StressLevel;
  estimatedCapital:  number;                   // launch capital required ($)
}

const LEVEL_LABELS: Record<SellerFitLevel, string> = {
  BeginnerSafe:    'Beginner Safe',
  Intermediate:    'Intermediate',
  AdvancedOnly:    'Advanced Sellers Only',
  UnsafeForSeller: 'Not Recommended for This Seller',
};

export function computeSellerFit(inputs: SellerFitInputs): SellerFit {
  const {
    experience, budget, certLevel, freightSensitivity,
    sourcingDifficulty, cashflowLevel, estimatedCapital,
  } = inputs;

  // Not enough data to assess fit — return low-confidence Intermediate rather
  // than a false BeginnerSafe from bonus-only scoring.
  if (estimatedCapital === 0 && certLevel === 'None' && sourcingDifficulty === 'Beginner') {
    return {
      level:       'Intermediate',
      label:       'Add supplier & cost data for full assessment',
      score:       50,
      reasons:     ['Seller fit assessment requires supplier, cost, and product data — add these to your pipeline first.'],
      blockers:    [],
      suggestions: ['Lock in a supplier in the Sourcing tab, then save a cost model in Profit Lab to unlock full seller fit scoring.'],
    };
  }

  const isBeginner = !experience || experience === 'beginner';
  const isExperienced = experience === 'selling';
  const blockers:    string[] = [];
  const reasons:     string[] = [];
  const suggestions: string[] = [];
  let score = 100;

  // ── Hard blockers (UnsafeForSeller) ──────────────────────────────────────
  // Beginner + Complex cert: they won't navigate lab testing or listing suspension
  if (isBeginner && certLevel === 'Complex') {
    score -= 50;
    blockers.push('Complex certification (FCC/CPSC/CPC) requires 4–12 weeks of lab testing — high execution risk for first-time sellers.');
    suggestions.push('Partner with a compliance consultant or use a branded product that already has certification.');
  }

  // Budget overextension: estimated capital exceeds stated budget ceiling
  if (budget && budget > 0 && estimatedCapital > 0 && estimatedCapital > budget) {
    score -= 45;
    blockers.push(`Estimated launch capital ($${estimatedCapital.toLocaleString()}) exceeds your stated budget of $${budget.toLocaleString()} — leaves no reserve for PPC or reorders.`);
    suggestions.push('Reduce MOQ to lower initial capital requirement, or target a product with sub-$5,000 launch cost.');
  }

  // Beginner + Advanced sourcing: likely to fail on factory negotiation or compliance
  if (isBeginner && sourcingDifficulty === 'Advanced') {
    score -= 35;
    blockers.push('Advanced sourcing complexity requires factory negotiation, compliance management, and logistics experience you don\'t yet have.');
    suggestions.push('Start with a Beginner-rated product. Return to this one after your first successful FBA launch.');
  }

  // Critical cashflow + beginner: high overextension risk
  if (isBeginner && cashflowLevel === 'Critical') {
    score -= 20;
    blockers.push('Critical capital requirement is high-risk for a first-time seller with no proven sales velocity.');
    suggestions.push('Reduce MOQ to the minimum the supplier will accept. Validate demand with a small batch first.');
  }

  // ── Deductions (non-blocking) ─────────────────────────────────────────────
  if (freightSensitivity === 'Extreme') {
    score -= 15;
    reasons.push('Extreme freight sensitivity makes landed cost unpredictable — any rate change threatens unit economics.');
    if (!isExperienced) {
      suggestions.push('Get a confirmed freight quote (DDP terms) before ordering.');
    }
  } else if (freightSensitivity === 'High') {
    score -= 8;
    reasons.push('High freight sensitivity — confirm freight cost before committing to your order.');
  }

  if (certLevel === 'Standard') {
    score -= 5;
    reasons.push('Standard compliance documentation required — manageable but adds 2–4 weeks to launch timeline.');
  }

  if (cashflowLevel === 'High') {
    score -= 8;
    reasons.push('High capital requirement — validate demand before committing full MOQ.');
  }

  if (sourcingDifficulty === 'Intermediate') {
    score -= 8;
    reasons.push('Intermediate sourcing complexity — review compliance requirements carefully before ordering.');
  }

  // ── Bonuses ───────────────────────────────────────────────────────────────
  if (sourcingDifficulty === 'Beginner') {
    score += 5;
    reasons.push('Beginner-friendly sourcing — straightforward factory communication and low compliance burden.');
  }
  if (certLevel === 'None') {
    score += 5;
    reasons.push('No certification required — zero compliance risk on this product.');
  }
  if (isExperienced) {
    score += 8;
    reasons.push('Experienced FBA seller — better equipped to manage sourcing complexity and unexpected issues.');
  }

  score = Math.max(0, Math.min(100, score));

  // ── Level assignment ──────────────────────────────────────────────────────
  let level: SellerFitLevel;
  if (score <= 30 || blockers.length >= 2) {
    level = 'UnsafeForSeller';
  } else if (score <= 55 || (isBeginner && (certLevel === 'Complex' || sourcingDifficulty === 'Advanced'))) {
    level = 'AdvancedOnly';
  } else if (score <= 75 || sourcingDifficulty === 'Advanced' || certLevel === 'Standard') {
    level = 'Intermediate';
  } else {
    level = 'BeginnerSafe';
  }

  return {
    level,
    label: LEVEL_LABELS[level],
    score,
    reasons: reasons.slice(0, 3),
    blockers: blockers.slice(0, 2),
    suggestions: suggestions.slice(0, 3),
  };
}
