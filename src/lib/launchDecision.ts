// ─── Launch Decision Engine ───────────────────────────────────────────────────
// Pure types and formulas — no React, no AsyncStorage, no side effects.
// All values derived from real product/supplier/feasibility/risk data.

import { FeasibilityProduct, FeasibilitySupplier, FeasibilityInputs, FeasibilityResult } from './feasibility';
import { RiskAssessmentResult } from './riskAssessment';

// ─── Capital Inputs ───────────────────────────────────────────────────────────

export interface CapitalInputs {
  packagingPerUnit: number; // per-unit packaging/labelling cost (USD)
  samplesUSD:       number; // flat sample order cost (USD)
  ppcBudget:        number; // launch marketing / PPC budget (USD)
}

export function defaultCapitalInputs(
  product:  FeasibilityProduct | null,
  supplier: FeasibilitySupplier | null,
): CapitalInputs {
  const price = product?.price ?? 20;
  // PPC default: 15× selling price, clamped $300–$1,500, rounded to nearest $10.
  // Approximates the cost to acquire enough clicks to validate demand.
  const ppc = Math.round(Math.max(300, Math.min(1500, price * 15)) / 10) * 10;
  return {
    packagingPerUnit: 0.30,
    samplesUSD:       150,
    ppcBudget:        ppc,
  };
}

// ─── Capital Breakdown ────────────────────────────────────────────────────────

export interface CapitalBreakdown {
  inventoryCost:      number; // unitCost × moq
  shippingCost:       number; // shippingPerUnit × moq
  customsDuties:      number; // customsDuty × moq
  packagingCost:      number; // packagingPerUnit × moq
  samplesOrder:       number; // flat
  ppcMarketing:       number; // flat
  contingency:        number; // 10% of subtotal
  totalLaunchCapital: number;
}

export function computeCapitalEstimate(
  supplier: FeasibilitySupplier,
  inputs:   FeasibilityInputs,
  result:   FeasibilityResult,
  capital:  CapitalInputs,
): CapitalBreakdown {
  const moq = supplier.moqNum || 100;

  const inventoryCost = parseFloat(((supplier.priceUSD ?? 0) * moq).toFixed(2));
  const shippingCost  = parseFloat((inputs.shippingPerUnit * moq).toFixed(2));
  const customsDuties = parseFloat((result.customsDuty * moq).toFixed(2));
  const packagingCost = parseFloat((capital.packagingPerUnit * moq).toFixed(2));
  const samplesOrder  = parseFloat(capital.samplesUSD.toFixed(2));
  const ppcMarketing  = parseFloat(capital.ppcBudget.toFixed(2));

  const subtotal = inventoryCost + shippingCost + customsDuties + packagingCost + samplesOrder + ppcMarketing;
  const contingency        = parseFloat((subtotal * 0.10).toFixed(2));
  const totalLaunchCapital = parseFloat((subtotal + contingency).toFixed(2));

  return {
    inventoryCost,
    shippingCost,
    customsDuties,
    packagingCost,
    samplesOrder,
    ppcMarketing,
    contingency,
    totalLaunchCapital,
  };
}

// ─── Launch Readiness ─────────────────────────────────────────────────────────

export interface ReadinessItem {
  label:   string;
  done:    boolean;
  points:  number;
  action?: string;
}

export interface LaunchReadinessResult {
  score:        number; // 0–100
  items:        ReadinessItem[];
  missingSteps: string[];
  nextActions:  string[];
}

export function computeLaunchReadiness(
  product:              FeasibilityProduct | null,
  supplier:             FeasibilitySupplier | null,
  result:               FeasibilityResult | null,
  riskResult:           RiskAssessmentResult | null,
  capitalTouched:       boolean,
  checklistPct:         number | null, // 0–100, or null if checklist untouched
  feasibilityReviewed:  boolean = false, // user explicitly confirmed they reviewed the results
): LaunchReadinessResult {
  const items: ReadinessItem[] = [
    {
      label:  'Amazon product selected',
      done:   product != null,
      points: 15,
      action: 'Research → Market Search → Save for Feasibility Check',
    },
    {
      label:  'Supplier attached',
      done:   supplier != null,
      points: 15,
      action: 'Research → Suppliers → Attach to Feasibility Check',
    },
    {
      label:  'Feasibility check reviewed',
      done:   feasibilityReviewed && result != null && !result.hasMissingData,
      points: 20,
      action: result?.hasMissingData
        ? `Fill in missing data: ${result.missingFields.join(', ')}`
        : feasibilityReviewed
          ? undefined
          : 'Scroll down and tap "Mark Feasibility as Reviewed" to confirm',
    },
    {
      label:  'Risk assessment reviewed',
      done:   riskResult != null,
      points: 10,
      action: 'Complete feasibility check to unlock risk assessment',
    },
    {
      label:  'Capital estimate reviewed',
      done:   capitalTouched,
      points: 10,
      action: 'Adjust the capital estimates below to match your actual costs',
    },
    {
      label:  'Product is financially viable',
      done:   result != null && result.profitPerUnit > 0 && result.marginPct >= 15,
      points: 15,
      action: result != null && (result.profitPerUnit <= 0 || result.marginPct < 15)
        ? `Current margin is ${result.marginPct.toFixed(1)}% — negotiate a lower unit cost or raise the selling price`
        : 'Run feasibility check to verify viability',
    },
    {
      label:  'Launch plan in progress (≥ 50%)',
      done:   checklistPct != null && checklistPct >= 50,
      points: 15,
      action: checklistPct != null
        ? `Plan is ${checklistPct}% complete — continue in the Plan tab`
        : 'Open the Plan tab and work through the launch steps',
    },
  ];

  const score        = Math.min(100, items.filter(i => i.done).reduce((acc, i) => acc + i.points, 0));
  const missingSteps = items.filter(i => !i.done).map(i => i.label);
  const nextActions  = items.filter(i => !i.done && i.action != null).slice(0, 3).map(i => i.action!);

  return { score, items, missingSteps, nextActions };
}

// ─── Go / No-Go Decision Engine ───────────────────────────────────────────────

export type LaunchDecision = 'GO' | 'TEST' | 'WAIT' | 'NO-GO';

export interface LaunchDecisionResult {
  decision:   LaunchDecision;
  summary:    string;
  reasons:    string[];
  confidence: 'High' | 'Medium' | 'Low';
}

export function computeLaunchDecision(
  result:     FeasibilityResult,
  riskResult: RiskAssessmentResult,
  readiness:  LaunchReadinessResult,
): LaunchDecisionResult {
  // ── Priority 0: WAIT — user-controllable critical data is missing ────────
  // Only gate on selling price or supplier unit cost being unknown.
  // These are the only two inputs that make financial arithmetic meaningless.
  // System fields (MOQ defaulting to 100, missing ratings) do not block the decision.
  const criticalMissing = result.missingFields.filter(
    f => f === 'Amazon selling price' || f === 'Supplier unit cost',
  );
  if (criticalMissing.length > 0) {
    return {
      decision:   'WAIT',
      summary:    'Critical pricing data is missing — financial projections are unreliable until these are filled in.',
      reasons:    [
        `Missing: ${criticalMissing.join(' and ')} — save a product with a price and a supplier with a unit cost to get an accurate decision`,
      ],
      confidence: 'Low',
    };
  }

  // ── Priority 1: NO-GO — hard stops ───────────────────────────────────────
  const noGoReasons: string[] = [];
  if (result.profitPerUnit < 0)
    noGoReasons.push(`Negative profit (${result.profitPerUnit.toFixed(2)}/unit) — every sale is a loss at current prices`);
  if (result.marginPct < 10 && result.profitPerUnit >= 0)
    noGoReasons.push(`${result.marginPct.toFixed(1)}% margin — below the 10% floor where FBA fees routinely destroy returns`);
  if (result.roiPct < 15)
    noGoReasons.push(`${result.roiPct.toFixed(1)}% ROI — too low to justify the capital and time commitment`);
  if (riskResult.overallRiskScore >= 75)
    noGoReasons.push(`Extreme risk score (${riskResult.overallRiskScore}/100) — too many unresolved risk factors to proceed`);

  if (noGoReasons.length > 0) {
    return {
      decision:   'NO-GO',
      summary:    'The fundamental economics do not support launching at current terms. Fix the hard stops before reconsidering.',
      reasons:    noGoReasons,
      confidence: result.hasMissingData ? 'Low' : 'High',
    };
  }

  // ── Priority 2: WAIT — not enough information or too risky ───────────────
  const waitReasons: string[] = [];
  if (riskResult.overallRiskScore >= 60)
    waitReasons.push(`High risk score (${riskResult.overallRiskScore}/100) — resolve the top risk factors before committing capital`);
  if (readiness.score < 35)
    waitReasons.push(`Launch readiness is only ${readiness.score}% — too many key steps are incomplete`);

  if (waitReasons.length > 0) {
    return {
      decision:   'WAIT',
      summary:    'Conditions are not ready. Close the gaps below before moving forward.',
      reasons:    waitReasons,
      confidence: result.missingFields.length >= 2 ? 'Low' : 'Medium',
    };
  }

  // ── Priority 3: TEST — viable but not exceptional ─────────────────────────
  const testReasons: string[] = [];
  if (result.marginPct < 28)
    testReasons.push(`${result.marginPct.toFixed(1)}% margin — workable but validate demand with a small batch before scaling`);
  if (result.roiPct < 55)
    testReasons.push(`${result.roiPct.toFixed(1)}% ROI — acceptable, but test before committing full MOQ`);
  if (riskResult.overallRiskScore >= 40)
    testReasons.push(`Moderate risk (${riskResult.overallRiskScore}/100) — manageable with careful execution, but run a small test first`);
  if (readiness.score < 65)
    testReasons.push(`${readiness.score}% launch readiness — complete the remaining preparation steps before full launch`);

  if (testReasons.length > 0) {
    return {
      decision:   'TEST',
      summary:    'Economics are viable but not exceptional. Order a small test batch, validate demand, then scale.',
      reasons:    testReasons,
      confidence: result.missingFields.length > 0 ? 'Low' : 'Medium',
    };
  }

  // ── Priority 4: GO — all thresholds cleared ───────────────────────────────
  return {
    decision:   'GO',
    summary:    'Strong economics, manageable risk, and solid readiness. The fundamentals support moving forward.',
    reasons:    [
      `${result.marginPct.toFixed(1)}% margin and ${result.roiPct.toFixed(1)}% ROI — both above target thresholds`,
      `Risk score ${riskResult.overallRiskScore}/100 — ${riskResult.riskLevel}`,
      `${readiness.score}% launch readiness`,
    ],
    confidence: 'High',
  };
}

// ─── Persisted Snapshot ───────────────────────────────────────────────────────
// Saved to AsyncStorage by CalculatorScreen so the home screen can display the
// verdict without re-running the full computation chain.

export interface LaunchAdvisorSnapshot {
  decision:     LaunchDecisionResult;
  readiness:    LaunchReadinessResult;
  riskScore:    number;
  riskLevel:    string;
  productTitle: string;
  computedAt:   string;   // ISO date string
  checklistPct?: number;  // kept in sync by LaunchScreen on every toggle
}
