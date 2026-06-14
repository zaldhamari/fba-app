import { FreightSensitivity, SourcingDifficulty, MarginRisk } from '../sourcingStrategy';
import { CertLevel } from './certificationRisk';
import { ReturnRiskLevel } from './returnRisk';
import { StressLevel } from './cashflowStress';
import { DataConfidence } from './types';

export type SurvivabilityRating = 'Strong' | 'Viable' | 'Marginal' | 'Risky' | 'Unknown';

export interface SurvivabilityGate {
  label:      string;
  passed:     boolean | null;     // null = cannot assess (missing data)
  detail:     string;
  fixHint:    string;             // specific action to fix this gate
  fixTarget:  'suppliers' | 'freight' | 'profit' | 'certifications' | 'research' | null;
}

export interface LaunchSurvivabilityResult {
  rating:             SurvivabilityRating;
  score:              number;               // 0–100 (higher = stronger)
  confidence:         DataConfidence;
  gates:              SurvivabilityGate[];
  primaryRisk:        string;
  recommendation:     string;
  beginnerSafe:       boolean;
  operationalRisks:   string[];
  recommendedActions: string[];
}

export function computeLaunchSurvivability(
  sensitivity:          FreightSensitivity,
  difficulty:           SourcingDifficulty,
  marginRisk:           MarginRisk | null,    // null = unknown (no cost model)
  certLevel:            CertLevel,
  returnRisk:           ReturnRiskLevel,
  cashflowStress:       StressLevel,
  usingConfirmedFreight: boolean,
  supplierSelected:     boolean,
  hasAnyProduct:        boolean,
  competition:          'Low' | 'Medium' | 'High' | undefined,
  sellerExperience:     'beginner' | 'some' | 'selling' | undefined,
): LaunchSurvivabilityResult {
  const operationalRisks: string[] = [];
  const recommendedActions: string[] = [];

  // ── No product at all — cannot assess ────────────────────────────────────
  if (!hasAnyProduct) {
    return {
      rating: 'Unknown',
      score: 0,
      confidence: 'Unknown',
      gates: [],
      primaryRisk: 'No product selected — survivability cannot be assessed.',
      recommendation: 'Select and analyse a product in the Research tab to begin supply chain assessment.',
      beginnerSafe: false,
      operationalRisks: [],
      recommendedActions: ['Add a product in the Research tab.'],
    };
  }

  // Starting score 50 — not 70. Evidence required to earn confidence.
  let score = 50;

  // ── Freight risk ──────────────────────────────────────────────────────────
  if (sensitivity === 'Low') {
    score += 10;
  } else if (sensitivity === 'High') {
    score -= 12;
    operationalRisks.push('High freight sensitivity — small rate changes significantly impact margin.');
  } else if (sensitivity === 'Extreme') {
    score -= 25;
    operationalRisks.push('Extreme freight sensitivity — freight cost may make this product unviable at current unit cost.');
    recommendedActions.push('Get a confirmed freight quote before ordering — extreme sensitivity means estimates can be dangerously wrong.');
  }

  if (usingConfirmedFreight) {
    score += 8;
  } else if (sensitivity === 'High' || sensitivity === 'Extreme') {
    score -= 8;  // high sensitivity + unconfirmed = double penalty
    operationalRisks.push('High/Extreme freight sensitivity with unconfirmed freight — total landed cost is unknown.');
    recommendedActions.push('Run a confirmed freight estimate in the Freight tab before committing to a supplier.');
  }

  // ── Supplier ──────────────────────────────────────────────────────────────
  if (!supplierSelected) {
    score -= 18;
    operationalRisks.push('No supplier selected — sourcing execution risk is unquantified.');
    recommendedActions.push('Lock in a supplier candidate in the Sourcing tab.');
  } else {
    score += 5;
  }

  // ── Financial health ─────────────────────────────────────────────────────
  if (marginRisk === null) {
    // Unknown financials — penalty (not neutral)
    score -= 10;
    operationalRisks.push('No cost model built — financial viability of this product is unknown.');
    recommendedActions.push('Build a cost model in Profit Lab — unlocks margin, ROI, and freight clarity.');
  } else if (marginRisk === 'Low') {
    score += 12;
  } else if (marginRisk === 'High') {
    score -= 18;
    operationalRisks.push('Estimated margin is critically thin — PPC spend or fee changes could make this unprofitable.');
    recommendedActions.push('Renegotiate unit cost or increase selling price before committing to a bulk order.');
  }

  // ── Certification ─────────────────────────────────────────────────────────
  if (certLevel === 'Complex') {
    score -= 18;
    operationalRisks.push('Complex certification required — non-compliance means Amazon will block the listing.');
    recommendedActions.push('Start certification testing immediately — it takes 4–12 weeks and is on the critical path to launch.');
  } else if (certLevel === 'Standard' || certLevel === 'DocumentationOnly') {
    score -= 4;
    operationalRisks.push('Certification/documentation required — request supplier compliance docs before ordering.');
  }

  // ── Return risk ────────────────────────────────────────────────────────────
  if (returnRisk === 'High') {
    score -= 12;
    operationalRisks.push('High return risk — 20–30% return rate will significantly erode profitability if not managed.');
  } else if (returnRisk === 'Medium') {
    score -= 4;
  }

  // ── Cashflow stress ───────────────────────────────────────────────────────
  if (cashflowStress === 'Critical') {
    score -= 20;
    operationalRisks.push('Critical cashflow requirement — high risk of capital overextension.');
    recommendedActions.push('Reduce MOQ to lower initial capital requirement, or explore inventory financing.');
  } else if (cashflowStress === 'High') {
    score -= 8;
    operationalRisks.push('High capital requirement — validate demand before committing full MOQ.');
  } else if (cashflowStress === 'Unknown') {
    score -= 5;  // unknown cashflow = small penalty (not neutral)
  }

  // ── Sourcing difficulty ───────────────────────────────────────────────────
  if (difficulty === 'Beginner') {
    score += 8;
  } else if (difficulty === 'Advanced') {
    score -= 12;
    operationalRisks.push('Advanced sourcing difficulty — compliance, factory negotiation, and logistics require experience.');
  }

  // ── Competition ───────────────────────────────────────────────────────────
  if (competition === 'High') {
    score -= 6;
    operationalRisks.push('High competition — ranking and conversion require strong differentiation and PPC investment.');
  } else if (competition === 'Low') {
    score += 5;
  }

  // ── Beginner seller + risky setup ────────────────────────────────────────
  const isBeginner = !sellerExperience || sellerExperience === 'beginner';
  if (isBeginner && difficulty === 'Advanced') {
    score -= 8;
    operationalRisks.push('Advanced sourcing with a beginner seller — high execution risk without prior FBA experience.');
  }

  score = Math.max(0, Math.min(100, score));

  let rating: SurvivabilityRating = 'Strong';
  if (score < 25) rating = 'Risky';
  else if (score < 45) rating = 'Marginal';
  else if (score < 65) rating = 'Viable';

  // ── Gates ─────────────────────────────────────────────────────────────────
  const gates: SurvivabilityGate[] = [
    {
      label: 'Freight risk manageable',
      passed: sensitivity !== 'Extreme' || usingConfirmedFreight,
      detail: sensitivity === 'Extreme' && !usingConfirmedFreight
        ? 'Extreme freight sensitivity without confirmed freight quote — landed cost unknown'
        : sensitivity === 'High' && !usingConfirmedFreight
        ? 'High freight sensitivity — confirm freight before ordering'
        : 'Freight risk within manageable range.',
      fixHint: 'Get a confirmed freight quote from a forwarder.',
      fixTarget: 'freight',
    },
    {
      label: 'Financial model complete',
      passed: marginRisk !== null,
      detail: marginRisk === null
        ? 'No cost model built — profitability is unknown'
        : marginRisk === 'High'
        ? 'Margin is critically thin — renegotiate before ordering'
        : 'Financial model confirms viable margin.',
      fixHint: 'Build a full cost model in Profit Lab.',
      fixTarget: 'profit',
    },
    {
      label: 'Certification path clear',
      passed: certLevel !== 'Complex',
      detail: certLevel === 'Complex'
        ? 'Complex certification required (FCC/CPSC/CE) — 4–12 week testing on critical path'
        : certLevel !== 'None'
        ? 'Documentation or standard compliance needed — request from supplier'
        : 'No complex certification burden detected.',
      fixHint: 'Request compliance documents from supplier and start lab testing now.',
      fixTarget: 'certifications',
    },
    {
      label: 'Supplier confirmed',
      passed: supplierSelected,
      detail: supplierSelected
        ? 'Supplier selected and under evaluation.'
        : 'No supplier selected — sourcing execution is not started.',
      fixHint: 'Find and lock in a supplier in the Sourcing tab.',
      fixTarget: 'suppliers',
    },
    {
      label: 'Cashflow sustainable',
      passed: cashflowStress !== 'Critical' && cashflowStress !== 'Unknown',
      detail: cashflowStress === 'Critical'
        ? 'Capital requirement is critical — high overextension risk'
        : cashflowStress === 'Unknown'
        ? 'Capital requirement unknown — add supplier cost and MOQ to assess'
        : 'Capital requirement is within manageable range.',
      fixHint: 'Negotiate MOQ down or review capital requirements in Profit Lab.',
      fixTarget: 'profit',
    },
  ];

  const failedGates = gates.filter(g => g.passed === false);
  const primaryRisk = failedGates.length > 0
    ? failedGates[0].detail
    : operationalRisks[0] ?? 'No critical blockers detected.';

  const beginnerSafe =
    difficulty !== 'Advanced' &&
    certLevel !== 'Complex' &&
    sensitivity !== 'Extreme' &&
    cashflowStress !== 'Critical';

  const recommendations: Record<Exclude<SurvivabilityRating, 'Unknown'>, string> = {
    Strong:   'Strong launch fundamentals. Proceed to inventory planning and listing prep.',
    Viable:   'Viable launch — address the flagged risks before placing your production order.',
    Marginal: 'Marginal survivability — resolve at least 2 critical gate failures before committing capital.',
    Risky:    'High-risk launch — do not commit capital until critical blockers are resolved.',
  };

  const confidence: DataConfidence =
    supplierSelected && marginRisk !== null && usingConfirmedFreight ? 'Medium' :
    supplierSelected || marginRisk !== null ? 'Low' : 'Unknown';

  return {
    rating,
    score,
    confidence,
    gates,
    primaryRisk,
    recommendation: recommendations[rating as Exclude<SurvivabilityRating, 'Unknown'>] ?? 'Add product and supplier data to assess survivability.',
    beginnerSafe,
    operationalRisks: operationalRisks.slice(0, 4),
    recommendedActions: recommendedActions.slice(0, 3),
  };
}
