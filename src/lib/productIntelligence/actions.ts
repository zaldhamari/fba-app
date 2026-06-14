import type { IntelligenceAction, IntelligenceDomain, MissingInput } from './types';
import type { SourcingIntelligenceResult } from '../sourcing/sourcingIntelligence';

// ── Canonical action IDs ──────────────────────────────────────────────────────
// Each ID represents a unique real-world action. Deduplication keeps only the
// highest-priority instance when multiple engines emit the same semantic action.

const ACTION_IDS = {
  FREIGHT_CONFIRM:    'freight-confirm',
  SUPPLIER_LOCK:      'supplier-lock',
  COST_MODEL:         'cost-model',
  SAMPLE_ORDER:       'sample-order',
  CERT_START:         'cert-start',
  CERT_DOCS:          'cert-docs',
  SUPPLIER_QUOTES:    'supplier-quotes',
  MOQ_NEGOTIATE:      'moq-negotiate',
  RECON_RUN:          'recon-run',
  UNIT_COST_REDUCE:   'unit-cost-reduce',
  SOURCING_AGENT:     'sourcing-agent',
} as const;

type ActionId = typeof ACTION_IDS[keyof typeof ACTION_IDS];

// ── Engine output → canonical action mapping ──────────────────────────────────

interface CandidateAction {
  id:       string;
  action:   string;
  domain:   IntelligenceDomain;
  priority: 1 | 2 | 3 | 4 | 5;
  why:      string;
  trigger:  string;
}

export function buildTopActions(intel: SourcingIntelligenceResult): IntelligenceAction[] {
  const candidates: CandidateAction[] = [];

  // ── Freight ───────────────────────────────────────────────────────────────
  if (intel.freightVolatility.freightLabel !== 'Confirmed') {
    candidates.push({
      id:       ACTION_IDS.FREIGHT_CONFIRM,
      action:   'Get a confirmed freight quote before placing your production order',
      domain:   'freight',
      priority: intel.freightSensitivity === 'Extreme' || intel.freightSensitivity === 'High' ? 1 : 2,
      why:      'Unconfirmed freight means your landed cost could be ±40% off, making your profit model unreliable.',
      trigger:  `Freight sensitivity: ${intel.freightSensitivity}, freight label: ${intel.freightVolatility.freightLabel}`,
    });
  }

  // ── Supplier ──────────────────────────────────────────────────────────────
  if (intel.supplierConfidence.level === 'Unknown') {
    candidates.push({
      id:       ACTION_IDS.SUPPLIER_LOCK,
      action:   'Find and lock in a supplier candidate in the Sourcing tab',
      domain:   'supplier',
      priority: 1,
      why:      'Without a supplier, sourcing execution is unquantified and most intelligence is estimated.',
      trigger:  'No supplier selected',
    });
  }

  if (intel.supplierConfidence.missingInputs.includes('Supplier selection') === false
    && intel.supplierConfidence.level !== 'Unknown'
    && intel.negotiation.currentUnitCost > 0
    && intel.supplierConfidence.level === 'Low') {
    candidates.push({
      id:       ACTION_IDS.SAMPLE_ORDER,
      action:   'Order product samples before committing to a bulk order',
      domain:   'supplier',
      priority: 2,
      why:      'Supplier confidence is low — sample validation reduces quality and returns risk before locking in capital.',
      trigger:  `Supplier confidence: ${intel.supplierConfidence.level}`,
    });
  }

  if (intel.negotiation.redFlags.some(f => f.toLowerCase().includes('one quote') || f.toLowerCase().includes('1 quote'))) {
    candidates.push({
      id:       ACTION_IDS.SUPPLIER_QUOTES,
      action:   'Get at least 2 more supplier quotes to establish a competitive pricing benchmark',
      domain:   'supplier',
      priority: 2,
      why:      'Single-quote sourcing gives you no negotiation leverage — you may be paying 15–25% above market.',
      trigger:  'Only 1 supplier quote in pipeline',
    });
  }

  if (intel.supplierConfidence.risks.some(r => r.toLowerCase().includes('moq'))) {
    candidates.push({
      id:       ACTION_IDS.MOQ_NEGOTIATE,
      action:   'Negotiate MOQ down to 200–300 units for your first order — frame it as a "trial run with committed reorder"',
      domain:   'supplier',
      priority: 3,
      why:      'High MOQ locks up capital before demand is proven.',
      trigger:  'MOQ exceeds 500 units',
    });
  }

  if (intel.supplierConfidence.risks.some(r => r.toLowerCase().includes('sourcing agent') || r.toLowerCase().includes('1688'))) {
    candidates.push({
      id:       ACTION_IDS.SOURCING_AGENT,
      action:   'Engage a verified sourcing agent (Sourcify, Supplyia, Yiwugo) for this product',
      domain:   'supplier',
      priority: 3,
      why:      'This sourcing path requires factory-direct communication or compliance support beyond DIY capability.',
      trigger:  intel.supplierConfidence.risks.find(r => r.toLowerCase().includes('sourcing agent') || r.toLowerCase().includes('1688')) ?? '',
    });
  }

  // ── Cost model ────────────────────────────────────────────────────────────
  if (intel.cashflowStress.missingInputs.some(m => m.toLowerCase().includes('supplier cost'))) {
    candidates.push({
      id:       ACTION_IDS.COST_MODEL,
      action:   'Build a cost model in Profit Lab to unlock margin, ROI, and cashflow projections',
      domain:   'cashflow',
      priority: 1,
      why:      'Without a cost model, financial viability of this product is unknown — you cannot make an informed launch decision.',
      trigger:  'No cost model built',
    });
  }

  // ── Certification ─────────────────────────────────────────────────────────
  if (intel.certification.level === 'Complex') {
    candidates.push({
      id:       ACTION_IDS.CERT_START,
      action:   'Start certification testing immediately — it takes 4–12 weeks and is on the critical path to launch',
      domain:   'certification',
      priority: 1,
      why:      'Complex certification cannot be self-declared. Lab testing must begin before production finishes to avoid delaying your launch.',
      trigger:  `Certification level: ${intel.certification.level} — ${intel.certification.certs.slice(0, 2).join(', ')}`,
    });
  } else if (intel.certification.level === 'Standard' || intel.certification.level === 'DocumentationOnly') {
    candidates.push({
      id:       ACTION_IDS.CERT_DOCS,
      action:   `Request compliance documentation from your supplier: ${intel.certification.supplierDocsToDemand[0] ?? 'compliance letter'}`,
      domain:   'certification',
      priority: 3,
      why:      'Required documentation must be obtained before Amazon listing launch.',
      trigger:  `Certification level: ${intel.certification.level}`,
    });
  }

  // ── Recon ─────────────────────────────────────────────────────────────────
  if (intel.returnRisk.missingInputs.some(m => m.toLowerCase().includes('recon'))) {
    candidates.push({
      id:       ACTION_IDS.RECON_RUN,
      action:   'Run Review Recon in the Research tab to map buyer complaints into product improvement specs',
      domain:   'returns',
      priority: 4,
      why:      'Recon data is the most accurate predictor of return risk — without it, return estimates are generic.',
      trigger:  'No recon insights present',
    });
  }

  // ── Unit cost / negotiation ───────────────────────────────────────────────
  if (intel.negotiation.currentUnitCost > 0 && intel.negotiation.targetUnitCost > 0) {
    candidates.push({
      id:       ACTION_IDS.UNIT_COST_REDUCE,
      action:   `Negotiate unit cost from $${intel.negotiation.currentUnitCost.toFixed(2)} toward $${intel.negotiation.targetUnitCost.toFixed(2)} using the ${intel.negotiation.levers[0]?.lever ?? 'reorder commitment'} lever`,
      domain:   'negotiation',
      priority: 4,
      why:      `A ${intel.negotiation.savingsRangeLow}–${intel.negotiation.savingsRangeHigh}% reduction is realistic with ${intel.negotiation.confidence} confidence.`,
      trigger:  `Current unit cost: $${intel.negotiation.currentUnitCost.toFixed(2)}, target: $${intel.negotiation.targetUnitCost.toFixed(2)}`,
    });
  }

  // ── Deduplicate by ID, keep highest priority ──────────────────────────────
  const seen = new Map<string, CandidateAction>();
  for (const c of candidates) {
    const existing = seen.get(c.id);
    if (!existing || c.priority < existing.priority) {
      seen.set(c.id, c);
    }
  }

  // ── Sort by priority, cap at 5 ───────────────────────────────────────────
  return Array.from(seen.values())
    .sort((a, b) => a.priority - b.priority)
    .slice(0, 5);
}

// ── Top risks (canonical, deduplicated) ──────────────────────────────────────

export function buildTopRisks(intel: SourcingIntelligenceResult): IntelligenceAction[] {
  const candidates: CandidateAction[] = [];

  // Survivability gate failures — highest priority risks
  for (const gate of intel.survivability.gates.filter(g => g.passed === false)) {
    candidates.push({
      id:       `gate-${gate.label.toLowerCase().replace(/\s+/g, '-')}`,
      action:   gate.detail,
      domain:   (gate.fixTarget ?? 'survivability') as IntelligenceDomain,
      priority: 1,
      why:      gate.detail,
      trigger:  gate.label,
    });
  }

  // Engine-level risks
  if (intel.certification.level === 'Complex') {
    candidates.push({
      id: 'risk-cert-complex', action: intel.certification.headline,
      domain: 'certification', priority: 1,
      why: `Required: ${intel.certification.certs.slice(0, 2).join(', ')}`,
      trigger: 'certLevel=Complex',
    });
  }

  if (intel.returnRisk.level === 'High') {
    candidates.push({
      id: 'risk-return-high', action: intel.returnRisk.headline,
      domain: 'returns', priority: 2,
      why: intel.returnRisk.reasons[0] ?? 'High return rate detected',
      trigger: `returnRisk.score=${intel.returnRisk.score}`,
    });
  }

  if (intel.cashflowStress.level === 'Critical') {
    candidates.push({
      id: 'risk-cashflow-critical', action: intel.cashflowStress.headline,
      domain: 'cashflow', priority: 1,
      why: `Launch capital $${intel.cashflowStress.estimatedCapital.toLocaleString()} is at critical level`,
      trigger: 'cashflowStress=Critical',
    });
  }

  if (intel.supplierConfidence.risks[0]) {
    candidates.push({
      id: 'risk-supplier', action: intel.supplierConfidence.risks[0],
      domain: 'supplier', priority: 2,
      why: intel.supplierConfidence.risks[0],
      trigger: `supplierConfidence.level=${intel.supplierConfidence.level}`,
    });
  }

  if (intel.freightVolatility.level === 'Extreme' || intel.freightVolatility.level === 'Volatile') {
    candidates.push({
      id: 'risk-freight-volatile', action: intel.freightVolatility.headline,
      domain: 'freight', priority: 2,
      why: intel.freightVolatility.riskFactors[0] ?? 'High freight volatility',
      trigger: `freightVolatility.level=${intel.freightVolatility.level}`,
    });
  }

  // Deduplicate and rank
  const seen = new Map<string, CandidateAction>();
  for (const c of candidates) {
    const existing = seen.get(c.id);
    if (!existing || c.priority < existing.priority) seen.set(c.id, c);
  }

  return Array.from(seen.values())
    .sort((a, b) => a.priority - b.priority)
    .slice(0, 5);
}

// ── Centralized missing input collection ──────────────────────────────────────

export function buildMissingInputs(intel: SourcingIntelligenceResult): MissingInput[] {
  const out: MissingInput[] = [];
  const seen = new Set<string>();

  function add(field: string, domain: IntelligenceAction['domain'], impact: string, tab?: MissingInput['tab']) {
    if (seen.has(field)) return;
    seen.add(field);
    out.push({ field, domain, impact, tab });
  }

  // Freight
  if (intel.freightVolatility.freightLabel !== 'Confirmed') {
    add('Confirmed freight per unit', 'freight', 'Landed cost estimate may be ±40% off', 'Sourcing');
  }

  // Supplier
  if (intel.supplierConfidence.level === 'Unknown') {
    add('Supplier selection', 'supplier', 'Sourcing execution risk is unquantified', 'Sourcing');
  }
  for (const m of intel.supplierConfidence.missingInputs) {
    if (m.toLowerCase().includes('grade')) add('Supplier quality grade', 'supplier', 'Quality risk and return rate are estimated, not measured', 'Sourcing');
    if (m.toLowerCase().includes('lead time')) add('Supplier lead time (days)', 'supplier', 'Cannot plan reorder cycles or avoid stockout', 'Sourcing');
    if (m.toLowerCase().includes('platform')) add('Supplier platform', 'supplier', 'Payment protection and escrow options are unknown', 'Sourcing');
  }

  // Cost model
  for (const m of intel.cashflowStress.missingInputs) {
    if (m.toLowerCase().includes('supplier cost') || m.toLowerCase().includes('moq')) {
      add('Supplier unit cost and MOQ', 'cashflow', 'Launch capital requirement is unknown', 'Sourcing');
    }
    if (m.toLowerCase().includes('product price')) {
      add('Product selling price', 'cashflow', 'Margin and ROI cannot be assessed', 'Research');
    }
    if (m.toLowerCase().includes('monthly sales')) {
      add('Monthly sales estimate', 'cashflow', 'Payback period cannot be calculated', 'Research');
    }
  }

  // Recon
  for (const m of intel.returnRisk.missingInputs) {
    if (m.toLowerCase().includes('recon')) {
      add('Review Recon complaints', 'returns', 'Return risk estimate is generic — Recon reveals product-specific issues', 'Research');
    }
  }

  // Certification
  for (const m of intel.certification.missingInputs) {
    add(m, 'certification', 'Compliance requirements may be incomplete', 'Sourcing');
  }

  return out;
}
