import { CategoryFlags } from '../sourcingStrategy';
import { DataConfidence } from './types';

export type CertLevel = 'None' | 'DocumentationOnly' | 'Standard' | 'Complex' | 'Unknown';

export interface CertRequirement {
  name:        string;
  type:        'Lab Test' | 'Self-Declaration' | 'Supplier Doc' | 'Registration';
  marketplaces: string[];  // which markets require it
  urgency:     'Before Ordering' | 'Before Shipping' | 'Before Launch';
  note:        string;
}

export interface CertificationRiskResult {
  level:           CertLevel;
  confidence:      DataConfidence;
  score:           number;           // 0–100 risk score
  requirements:    CertRequirement[];
  certs:           string[];         // flat list for UI / Copilot
  estimatedCost:   string;
  timeline:        string;
  headline:        string;
  detail:          string;
  supplierDocsToDemand: string[];    // specific docs to request from supplier
  missingInputs:   string[];
}

export function computeCertificationRisk(
  categories: CategoryFlags,
  marketplace: string,
): CertificationRiskResult {
  const euMarkets = ['UK', 'DE', 'EU', 'FR', 'IT', 'ES'];
  const isUS = marketplace === 'US';
  const isEU = euMarkets.includes(marketplace);

  const requirements: CertRequirement[] = [];
  const supplierDocsToDemand: string[] = [];
  let score = 0;

  // ── Radio electronics → Complex FCC lab testing ──────────────────────────
  if (categories.radioElectronics) {
    score += 65;
    if (isUS) {
      requirements.push({
        name: 'FCC Part 15A',
        type: 'Lab Test',
        marketplaces: ['US'],
        urgency: 'Before Shipping',
        note: 'Intentional radiator (BT/WiFi). Requires accredited lab test — cannot be self-declared.',
      });
    }
    if (isEU) {
      requirements.push({
        name: 'CE Mark (RED Directive)',
        type: 'Lab Test',
        marketplaces: euMarkets,
        urgency: 'Before Shipping',
        note: 'Radio Equipment Directive — requires technical file and DoC from manufacturer.',
      });
    }
    requirements.push({
      name: 'RoHS',
      type: 'Supplier Doc',
      marketplaces: euMarkets,
      urgency: 'Before Ordering',
      note: 'EU restriction of hazardous substances. Request RoHS compliance letter from supplier.',
    });
    supplierDocsToDemand.push('FCC ID certificate or test report from accredited lab');
    supplierDocsToDemand.push('DoC (Declaration of Conformity) + CE certificate if EU');
    supplierDocsToDemand.push('RoHS compliance letter');
  }

  // ── Non-radio electronics → Standard self-declaration only ───────────────
  // Score 32 ensures Standard threshold (≥30) without reaching Complex (≥55).
  // FCC Part 15B requires preparing a formal SDoC — it's more than a supplier letter.
  if (categories.nonRadioElectronics && !categories.radioElectronics) {
    score += 32;
    if (isUS) {
      requirements.push({
        name: 'FCC Part 15B',
        type: 'Self-Declaration',
        marketplaces: ['US'],
        urgency: 'Before Shipping',
        note: 'Unintentional radiator (USB/LED/wired). Self-declaration only — no lab test required.',
      });
    }
    if (isEU) {
      requirements.push({
        name: 'CE Mark (EMC Directive)',
        type: 'Self-Declaration',
        marketplaces: euMarkets,
        urgency: 'Before Shipping',
        note: 'EMC self-declaration for passive electronics. Request DoC + technical file from supplier.',
      });
    }
    supplierDocsToDemand.push('FCC SDoC (Supplier Declaration of Conformity)');
    supplierDocsToDemand.push('CE DoC + technical file (if EU)');
  }

  // ── Toys and baby toys ───────────────────────────────────────────────────
  if (categories.toy || categories.babyProduct) {
    score += 55;
    if (isUS) {
      requirements.push({
        name: 'CPSC / ASTM F963',
        type: 'Lab Test',
        marketplaces: ['US'],
        urgency: 'Before Ordering',
        note: 'Toy Safety Standard — mandatory lab test by CPSC-accepted laboratory.',
      });
      if (categories.babyProduct) {
        requirements.push({
          name: 'CPC (Children\'s Product Certificate)',
          type: 'Lab Test',
          marketplaces: ['US'],
          urgency: 'Before Launch',
          note: 'Amazon requires CPC for all products targeting children under 12. Must be issued per tested batch.',
        });
        requirements.push({
          name: 'CPSC 16 CFR Part 1501',
          type: 'Lab Test',
          marketplaces: ['US'],
          urgency: 'Before Launch',
          note: 'Small parts hazard for children under 3. Required if any components are small.',
        });
      }
    }
    if (isEU) {
      requirements.push({
        name: 'EN 71 (EU Toy Safety)',
        type: 'Lab Test',
        marketplaces: euMarkets,
        urgency: 'Before Ordering',
        note: 'EN 71-1 (mechanical), EN 71-2 (flammability), EN 71-3 (chemical migration).',
      });
    }
    if (categories.babyProduct) {
      requirements.push({
        name: 'BPA-Free / Phthalate-Free',
        type: 'Supplier Doc',
        marketplaces: ['US', ...euMarkets],
        urgency: 'Before Ordering',
        note: 'Required for any mouth-contact baby product. Request material safety data sheet.',
      });
      supplierDocsToDemand.push('CPC (Children\'s Product Certificate) — per batch');
      supplierDocsToDemand.push('CPSC test report from accredited lab');
      supplierDocsToDemand.push('Material Safety Data Sheet confirming BPA/phthalate-free');
      if (categories.foodContact || categories.smallGoods) {
        supplierDocsToDemand.push('Prop 65 compliance statement (if US)');
      }
    } else {
      supplierDocsToDemand.push('ASTM F963 / EN 71 test report from accredited lab');
      supplierDocsToDemand.push('DoC with batch details');
    }
    score = Math.min(100, score);
  }

  // ── Food-contact kitchen/tableware ───────────────────────────────────────
  if (categories.foodContact && !categories.supplement) {
    score += 15;
    requirements.push({
      name: 'FDA Food-Contact Compliance',
      type: 'Supplier Doc',
      marketplaces: ['US'],
      urgency: 'Before Launch',
      note: '21 CFR § 177.2600 for silicone / § 177.1520 for plastics. Not a cert — a supplier declaration.',
    });
    if (isEU) {
      requirements.push({
        name: 'LFGB (EU Food Contact)',
        type: 'Supplier Doc',
        marketplaces: euMarkets,
        urgency: 'Before Launch',
        note: 'German/EU food-contact standard. Suppliers in China can provide LFGB test reports.',
      });
    }
    supplierDocsToDemand.push('FDA food-contact compliance letter (21 CFR § 177.2600 for silicone)');
    supplierDocsToDemand.push('Prop 65 compliance statement (California)');
    if (isEU) supplierDocsToDemand.push('LFGB test certificate from supplier');
  }

  // ── Supplements ──────────────────────────────────────────────────────────
  if (categories.supplement) {
    score += 45;
    if (isUS) {
      requirements.push({
        name: 'FDA Facility Registration',
        type: 'Registration',
        marketplaces: ['US'],
        urgency: 'Before Launch',
        note: 'Free online registration. Required for US supplement manufacturers/importers.',
      });
      requirements.push({
        name: 'GMP Documentation + COA',
        type: 'Supplier Doc',
        marketplaces: ['US', ...euMarkets],
        urgency: 'Before Ordering',
        note: 'Certificate of Analysis (COA) per batch required. Amazon may request during listing review.',
      });
      requirements.push({
        name: 'Label Claims Review',
        type: 'Self-Declaration',
        marketplaces: ['US'],
        urgency: 'Before Launch',
        note: 'Structure/function claims are allowed but disease claims trigger FDA drug rules. Review every label claim.',
      });
    }
    supplierDocsToDemand.push('Certificate of Analysis (COA) — per batch, from accredited lab');
    supplierDocsToDemand.push('GMP certificate from supplier facility');
    supplierDocsToDemand.push('Full ingredient list + MSDS');
  }

  // ── Cosmetics ────────────────────────────────────────────────────────────
  if (categories.cosmetic) {
    score += 35;
    if (isUS) {
      requirements.push({
        name: 'FDA Cosmetic Registration (MoCRA)',
        type: 'Registration',
        marketplaces: ['US'],
        urgency: 'Before Launch',
        note: 'Mandatory under MoCRA 2022 for cosmetics sold in the US. Facility + product registration required.',
      });
      requirements.push({
        name: 'Safety Assessment + INCI List',
        type: 'Supplier Doc',
        marketplaces: ['US', ...euMarkets],
        urgency: 'Before Ordering',
        note: 'Full ingredient (INCI) list required. Avoid prohibited/restricted ingredients.',
      });
    }
    supplierDocsToDemand.push('Full INCI ingredient list');
    supplierDocsToDemand.push('Safety Data Sheet + cosmetic safety assessment');
    supplierDocsToDemand.push('MoCRA facility registration confirmation (US)');
  }

  score = Math.min(100, score);

  // ── Level thresholds ──────────────────────────────────────────────────────
  let level: CertLevel = 'None';
  if (score >= 55) level = 'Complex';
  else if (score >= 30) level = 'Standard';
  else if (score >= 10) level = 'DocumentationOnly';

  const certs = requirements.map(r => r.name);

  let estimatedCost = '$0';
  let timeline = 'N/A';
  let headline = 'No mandatory certification detected.';
  let detail = 'This product category typically has no mandatory certifications for Amazon FBA. Verify with your supplier and check Amazon\'s restricted products page.';

  if (level === 'DocumentationOnly') {
    estimatedCost = '$0–$300';
    timeline = '1–2 weeks';
    headline = 'Supplier documentation required (not full certification).';
    detail = `Request these docs from your supplier before launching: ${certs.join(', ')}. No lab testing required — supplier letters/declarations suffice.`;
  } else if (level === 'Standard') {
    estimatedCost = '$300–$1,500';
    timeline = '2–4 weeks';
    headline = 'Standard compliance required — self-declaration or supplier docs.';
    detail = `Required: ${certs.join(', ')}. Most can be handled via supplier declarations and self-certification. Budget time into your launch schedule.`;
  } else if (level === 'Complex') {
    estimatedCost = '$2,000–$8,000+';
    timeline = '4–12 weeks';
    headline = 'Complex certification required — accredited lab testing needed.';
    detail = `Required: ${certs.join(', ')}. Lab testing is on the critical path — start BEFORE production finishes to avoid delays. These cannot be self-declared.`;
  }

  const confidence: DataConfidence = score > 0 ? 'Medium' : 'Low';
  const missingInputs: string[] = [];
  if (!marketplace || marketplace === 'US' || marketplace === '') {
    // no warning — US is the default
  }

  return {
    level,
    confidence,
    score,
    requirements,
    certs,
    estimatedCost,
    timeline,
    headline,
    detail,
    supplierDocsToDemand,
    missingInputs,
  };
}
