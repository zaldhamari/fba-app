import { CategoryFlags } from '../sourcingStrategy';
import { DataConfidence } from './types';

export type ReturnRiskLevel = 'Low' | 'Medium' | 'High' | 'Unknown';

export interface ReturnRiskResult {
  level:          ReturnRiskLevel;
  confidence:     DataConfidence;
  score:          number;           // 0–100
  returnRate:     string;           // estimated % range, or 'Unknown'
  headline:       string;
  mitigations:    string[];
  reasons:        string[];         // what drove the score up/down
  missingInputs:  string[];
}

export function computeReturnRisk(
  categories: CategoryFlags,
  pricePoint: number | undefined,
  marketplace: string,
  reconComplaints: string[] = [],
  productReviews: number | undefined = undefined,
  competition: 'Low' | 'Medium' | 'High' | undefined = undefined,
): ReturnRiskResult {
  const reasons: string[] = [];
  const mitigations: string[] = [];
  const missingInputs: string[] = [];

  let score = 10;  // baseline — lower than before (10 not 15)

  // ── Category-based risk signals ──────────────────────────────────────────
  if (categories.radioElectronics) {
    score += 35;
    reasons.push('Electronic products with wireless connectivity have high return rates due to setup complexity and performance expectations.');
    mitigations.push('Include a clear quick-start guide and a QR code linking to a setup video.');
    mitigations.push('Source from a supplier offering a warranty replacement programme.');
  } else if (categories.nonRadioElectronics) {
    score += 20;
    reasons.push('Electronic products have above-average return rates due to defect/compatibility expectations.');
    mitigations.push('Test at least 20 sample units before bulk order — check for DOA rate.');
  }

  if (categories.textile) {
    score += 25;
    reasons.push('Textile/apparel products have high return rates due to sizing and colour matching issues.');
    mitigations.push('Include a detailed size chart with exact measurements in inches and cm.');
    mitigations.push('Use calibrated product photography — colour mismatch is the #1 textile return reason.');
  }

  if (categories.fragile) {
    score += 28;
    reasons.push('Fragile products have elevated transit damage returns — packaging is the primary lever.');
    mitigations.push('Require double-wall corrugated packaging with 5 cm foam buffer on all sides from supplier.');
    mitigations.push('Add "Fragile" stickers on all 6 box faces — reduces handler damage in transit.');
  }

  if (categories.fitness) {
    score += 22;
    reasons.push('Resistance bands and fitness equipment have notable return issues: snapping, wrong resistance level, material smell (latex off-gassing).');
    mitigations.push('Label every band with resistance level (lbs/kg) clearly on the product — resistance level mismatch is the #1 return reason.');
    mitigations.push('Request latex/TPE material safety sheet — strong rubber smell causes returns within 24 hours.');
    mitigations.push('Consider a "set" listing (multiple resistance levels) to reduce return incentive from wrong-level purchase.');
  }

  if (categories.babyProduct) {
    score += 15;
    reasons.push('Baby products are returned when parents notice any quality concern — safety perception threshold is very low.');
    mitigations.push('Ensure all certifications are visible on packaging (CPC number, CPSC compliance). Builds parental trust.');
    mitigations.push('Use BPA-free / phthalate-free claims if testing confirms it — reduces safety-related returns significantly.');
  } else if (categories.toy) {
    score += 18;
    reasons.push('Toy products have above-average returns due to quality expectations and gifting patterns.');
  }

  if (categories.foodContact) {
    score += 10;
    reasons.push('Food-contact products returned when buyers question material safety or notice discolouration/smell.');
    mitigations.push('Prominently display "Food Grade" and material type (e.g. BPA-free silicone, 304 stainless) on listing images.');
  }

  if (categories.supplement) {
    score += 5;
    reasons.push('Supplements returned when buyers don\'t feel results — manage expectations via listing copy.');
  }

  // ── Price signal ──────────────────────────────────────────────────────────
  if (pricePoint !== undefined) {
    if (pricePoint > 80) {
      score += 15;
      reasons.push(`High price point ($${pricePoint}) raises buyer expectations — returns increase when product doesn't justify price.`);
      mitigations.push('Add product bundling or accessories to increase perceived value.');
    } else if (pricePoint < 15) {
      score -= 8;
    }
  } else {
    missingInputs.push('Product price — affects return expectation calibration');
  }

  // ── Marketplace signal ────────────────────────────────────────────────────
  if (marketplace === 'US') {
    score += 5;
    reasons.push('US Amazon marketplace has industry-leading return convenience — return rates run ~2–5 pts higher than EU equivalents.');
  }

  // ── Recon complaint signals ───────────────────────────────────────────────
  const returnTriggerKeywords = ['quality','broken','wrong','smell','weak','defective','leaked','missing','poor','cheap','flimsy','snap','broke','tore'];
  const matchedComplaints = reconComplaints.filter(c =>
    returnTriggerKeywords.some(k => c.toLowerCase().includes(k))
  );
  if (matchedComplaints.length > 0) {
    const bump = Math.min(25, matchedComplaints.length * 8);
    score += bump;
    reasons.push(`Competitor Review Recon found ${matchedComplaints.length} quality-related complaint(s): "${matchedComplaints[0]}"${matchedComplaints.length > 1 ? ` +${matchedComplaints.length - 1} more` : ''}. These drive returns.`);
    mitigations.push(`Address these complaint patterns in your product specs: ${matchedComplaints.slice(0, 2).join('; ')}.`);
  } else if (reconComplaints.length === 0) {
    missingInputs.push('Review Recon complaints — run Recon in Research tab for product-specific return signals');
  }

  // ── Competition signal ────────────────────────────────────────────────────
  if (competition === 'High' && productReviews !== undefined && productReviews > 1000) {
    score += 5;
    reasons.push('High-competition category with many reviews — established return behavior patterns are known; match or exceed category quality norms.');
  }

  score = Math.max(0, Math.min(100, score));

  let level: ReturnRiskLevel = 'Low';
  if (score >= 55) level = 'High';
  else if (score >= 28) level = 'Medium';

  const confidence: DataConfidence =
    reconComplaints.length > 0 && pricePoint !== undefined ? 'Medium' :
    pricePoint !== undefined ? 'Low' : 'Low';

  const rateMap: Record<Exclude<ReturnRiskLevel, 'Unknown'>, string> = {
    Low:    '3–8%',
    Medium: '10–18%',
    High:   '20–35%',
  };

  const headline =
    level === 'Low'    ? 'Low return risk — minimal margin impact expected.' :
    level === 'Medium' ? 'Moderate return risk — build a 10–15% return buffer into your unit economics.' :
                         'High return risk — model 20–30% return rate before finalising launch budget.';

  // Keep Vine advice optional and conditional
  if (level !== 'Low') {
    mitigations.push('After obtaining Brand Registry: use Vine or review request tools to build a 4.5+ rating before scaling PPC — rating is the strongest return deterrent.');
  }

  return {
    level,
    confidence,
    score,
    returnRate: rateMap[level],
    headline,
    mitigations: mitigations.slice(0, 4),
    reasons: reasons.slice(0, 3),
    missingInputs,
  };
}
