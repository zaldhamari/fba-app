import React, { useMemo, useEffect, useState } from 'react';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, ActivityIndicator, TextInput, Modal, KeyboardAvoidingView, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { DS } from '../theme/ds';
import { usePipeline } from '../context/PipelineContext';
import {
  estimateMonthlySales,
  estimatePPCPressure,
  estimateStartupCapital,
  roughMarginPct,
  marginColor,
  roiColor,
  ppcColor,
} from '../lib/financialEngine';
import { FIN } from '../lib/financialConstants';
import { track } from '../lib/analytics';
import { EstimateLabel } from '../components/EstimateLabel';
import { useNetworkStatus } from '../hooks/useNetworkStatus';
import { OfflineBanner } from '../components/OfflineBanner';
import { useProductIntelligence } from '../hooks/useProductIntelligence';
import type { ProductIntelligenceProfile } from '../lib/productIntelligence/types';
import { DecisionSimulationPanel } from '../components/DecisionSimulationPanel';
import { useDecisionSimulation } from '../hooks/useDecisionSimulation';
import { HelpButton } from '../components/HelpModal';

// ── Scoring ───────────────────────────────────────────────────────────────────

type Verdict = 'LAUNCH' | 'TEST SMALL' | 'HOLD' | 'AVOID';

interface ReadinessResult {
  score:        number;
  verdict:      Verdict;
  verdictReason: string;    // specific one-line WHY for the verdict
  strengths:    string[];
  risks:        string[];
  missing:      string[];
  actions:      string[];
  improvements: string[];   // "What Would Improve This?" — specific, quantified
  confidence: {
    pct:    number;
    label:  'Low' | 'Medium' | 'High';
    detail: string;
  };
  // Factor scores for transparency
  factors: {
    label: string;
    pts:   number;
    max:   number;
    note?: string;
  }[];
  // which pipeline stages are complete
  stages: {
    niche:    boolean;
    product:  boolean;
    supplier: boolean;
    cost:     boolean;
    brand:    boolean;
    recon:    boolean;
  };
}

// ── 14-Factor Scoring System ───────────────────────────────────────────────────
//
// Factor weights (max earnable before 100-cap):
//   1.  Niche strength          10 pts
//   2.  Market demand signal    10 pts
//   3.  Review saturation        8 pts
//   4.  Competition intensity    7 pts
//   5.  Supplier locked in      12 pts
//   6.  Supplier quality         8 pts
//   7.  MOQ burden               5 pts
//   8.  Net margin              15 pts  (−15 if unprofitable)
//   9.  ROI quality              8 pts
//  10.  Freight clarity          5 pts
//  11.  Startup capital          5 pts  (bonus if investment < threshold)
//  12.  Brand readiness          8 pts
//  13.  Brand completeness       5 pts  (barcode + listing)
//  14.  Teardown differentiation    5 pts
//   Total possible: 111, capped at 100
//
// Verdict thresholds:
//   LAUNCH     ≥ 80 — fundamentals clear, proceed with confidence
//   TEST SMALL 60–79 — viable but one factor needs more validation
//   HOLD       40–59 — information gaps or thin margin
//   AVOID      < 40  — dealbreaker risk present

function calcReadiness(
  niche:    ReturnType<typeof usePipeline>['activeNiche'],
  product:  ReturnType<typeof usePipeline>['activeProduct'],
  supplier: ReturnType<typeof usePipeline>['selectedSupplier'],
  cost:     ReturnType<typeof usePipeline>['costModel'],
  brand:    ReturnType<typeof usePipeline>['brandData'],
  recon:    ReturnType<typeof usePipeline>['reconInsights'],
  sourcingStrategy: ReturnType<typeof usePipeline>['sourcingStrategy'],
  supplierQuotes: ReturnType<typeof usePipeline>['supplierQuotes'],
  profile: ProductIntelligenceProfile | null,
): ReadinessResult {
  let score = 0;
  const strengths:    string[] = [];
  const risks:        string[] = [];
  const missing:      string[] = [];
  const actions:      string[] = [];
  const improvements: string[] = [];
  const factors:      ReadinessResult['factors'] = [];

  const stages = {
    niche:    !!niche,
    product:  !!product,
    supplier: !!supplier,
    cost:     !!cost,
    brand:    !!brand,
    recon:    !!recon,
  };

  // ── Factor 1: Niche strength (10 pts) ─────────────────────────────────────
  if (niche) {
    const pts = niche.score >= 4 ? 10 : niche.score >= 3 ? 7 : 4;
    score += pts;
    factors.push({ label: 'Niche Strength', pts, max: 10, note: `${niche.verdictLabel} (${niche.score}/5)` });
    if (niche.score >= 4) strengths.push(`Strong niche signal — ${niche.verdictLabel} (${niche.score}/5) in ${niche.marketplace}`);
    else if (niche.score >= 3) strengths.push(`Viable niche: "${niche.keyword}"`);
    else risks.push(`Weak niche score (${niche.score}/5) — consider a stronger keyword angle`);
  } else {
    factors.push({ label: 'Niche Strength', pts: 0, max: 10, note: 'Not completed' });
    missing.push('No niche researched');
    actions.push('Go to Niche tab — research and validate your keyword first');
  }

  // ── Factor 2: Market demand signal (10 pts) ───────────────────────────────
  if (product && product.price && product.reviews >= 0) {
    const comp   = product.competition ?? 'Medium';
    const est    = estimateMonthlySales(Math.max(product.reviews, 1), comp, product.price);
    const pts    = est.mid >= 300 ? 10 : est.mid >= 150 ? 8 : est.mid >= 60 ? 5 : 3;
    score += pts;
    factors.push({ label: 'Market Demand', pts, max: 10, note: est.monthlyLabel });
    if (est.mid >= 300) strengths.push(`Strong demand: estimated ${est.monthlyLabel} — healthy market velocity`);
    else if (est.mid >= 100) strengths.push(`Moderate demand: estimated ${est.monthlyLabel}`);
    else risks.push(`Low estimated sales: ${est.monthlyLabel} — validate niche size before ordering`);
  } else if (!product) {
    factors.push({ label: 'Market Demand', pts: 0, max: 10, note: 'No product selected' });
  }

  // ── Factor 3: Review saturation (8 pts) ───────────────────────────────────
  if (product) {
    let pts = 0;
    if (product.reviews < FIN.REVIEWS_LOW) {
      pts = 8;
      strengths.push(`Low review count (${product.reviews}) — easier to enter and rank`);
    } else if (product.reviews < FIN.REVIEWS_MEDIUM) {
      pts = 5;
      strengths.push(`Moderate review barrier (${product.reviews} reviews)`);
    } else {
      pts = 2;
      risks.push(`High review saturation: ${product.reviews.toLocaleString()} reviews — expect slow organic ranking`);
    }
    score += pts;
    factors.push({ label: 'Review Saturation', pts, max: 8, note: `${product.reviews} reviews` });
  } else {
    factors.push({ label: 'Review Saturation', pts: 0, max: 8, note: 'No product selected' });
  }

  // ── Factor 4: Competition intensity + PPC pressure (7 pts) ────────────────
  if (product) {
    const comp        = product.competition ?? 'Medium';
    const ppcPressure = product.ppcPressure
      ?? estimatePPCPressure(product.reviews, comp);
    const pts =
      comp === 'Low'    && ppcPressure === 'Low'    ? 7 :
      comp === 'Low'    && ppcPressure === 'Medium'  ? 5 :
      comp === 'Medium' && ppcPressure !== 'High'   ? 4 :
      comp === 'High'                               ? 2 : 4;
    score += pts;
    factors.push({ label: 'Competition + PPC', pts, max: 7, note: `${comp} comp · ${ppcPressure} PPC pressure` });
    if (ppcPressure === 'Low') strengths.push('Low PPC pressure — cost-efficient advertising environment');
    if (ppcPressure === 'High') risks.push('High PPC pressure — budget ≥15% of revenue for profitable ads');
    if (comp === 'High') risks.push(`High competition niche — strong differentiation required to win`);
  } else {
    factors.push({ label: 'Competition + PPC', pts: 0, max: 7, note: 'No product selected' });
  }

  // ── Factor 5: Supplier locked in (12 pts) ────────────────────────────────
  if (supplier) {
    score += 12;
    factors.push({ label: 'Supplier Selected', pts: 12, max: 12, note: supplier.name });
    strengths.push(`Supplier locked in: ${supplier.name} at $${supplier.unitCost.toFixed(2)}/unit`);
  } else {
    factors.push({ label: 'Supplier Selected', pts: 0, max: 12, note: 'Not completed' });
    missing.push('No supplier selected');
    actions.push('Go to Sourcing tab — find and lock in a manufacturer');
  }

  // ── Factor 6: Supplier quality (8 pts) ────────────────────────────────────
  if (supplier) {
    let pts = 0;
    if (supplier.grade === 'A') {
      pts = 8; strengths.push(`Top-grade supplier (Grade A) — verified quality`);
    } else if (supplier.grade === 'B') {
      pts = 6; strengths.push(`Good supplier grade (Grade B)`);
    } else if (supplier.grade === 'C') {
      pts = 3; risks.push(`Supplier grade C — validate product samples before bulk order`);
    } else if (supplier.score && supplier.score >= 8) {
      pts = 6; strengths.push(`High supplier trust score (${supplier.score}/10)`);
    } else {
      pts = 4; strengths.push(`Supplier identified — request samples before committing`);
    }
    score += pts;
    factors.push({ label: 'Supplier Quality', pts, max: 8, note: supplier.grade ? `Grade ${supplier.grade}` : 'Ungraded' });
  } else {
    factors.push({ label: 'Supplier Quality', pts: 0, max: 8, note: 'No supplier' });
  }

  // ── Factor 7: MOQ burden (5 pts) ─────────────────────────────────────────
  if (supplier) {
    const pts = supplier.moq <= 200 ? 5 : supplier.moq <= FIN.MOQ_LOW ? 4 : supplier.moq <= 500 ? 2 : 1;
    score += pts;
    factors.push({ label: 'MOQ Burden', pts, max: 5, note: `${supplier.moq.toLocaleString()} units` });
    if (supplier.moq <= FIN.MOQ_LOW) strengths.push(`Manageable MOQ (${supplier.moq} units) — low capital lock-up risk`);
    else risks.push(`High MOQ (${supplier.moq} units) — significant capital locked up on first order`);
  } else {
    factors.push({ label: 'MOQ Burden', pts: 0, max: 5, note: 'No supplier' });
  }

  // ── Factor 8: Net margin (15 pts, −15 if unprofitable) ───────────────────
  if (cost) {
    let pts = 0;
    if (cost.marginPct >= FIN.MARGIN_EXCELLENT) {
      pts = 15; strengths.push(`Excellent margin: ${cost.marginPct.toFixed(1)}% — strong buffer for ads and returns`);
    } else if (cost.marginPct >= FIN.MARGIN_ACCEPTABLE) {
      pts = 10; strengths.push(`Acceptable margin: ${cost.marginPct.toFixed(1)}%`);
    } else if (cost.marginPct >= FIN.MARGIN_FLOOR) {
      pts = 5; risks.push(`Thin margin: ${cost.marginPct.toFixed(1)}% — PPC costs may erode profitability`);
    } else if (cost.marginPct >= 0) {
      pts = 2; risks.push(`Very thin margin: ${cost.marginPct.toFixed(1)}% — renegotiate unit cost before ordering`);
    } else {
      pts = 0; score = Math.max(0, score - 15);
      risks.push(`Unprofitable at current costs: ${cost.marginPct.toFixed(1)}% margin — do not proceed`);
    }
    score += pts;
    factors.push({ label: 'Net Margin', pts, max: 15, note: `${cost.marginPct.toFixed(1)}%` });
  } else {
    factors.push({ label: 'Net Margin', pts: 0, max: 15, note: 'No cost model' });
    missing.push('No cost model — financial health is unknown');
    actions.push('Go to Profit tab — run FBA profit calculation and save model');
  }

  // ── Factor 9: ROI quality (8 pts) ────────────────────────────────────────
  if (cost) {
    const pts = cost.roiPct >= FIN.ROI_EXCELLENT ? 8 : cost.roiPct >= FIN.ROI_ACCEPTABLE ? 5 : cost.roiPct >= 0 ? 2 : 0;
    score += pts;
    factors.push({ label: 'ROI per Cycle', pts, max: 8, note: `${cost.roiPct.toFixed(0)}%` });
    if (cost.roiPct >= FIN.ROI_EXCELLENT) strengths.push(`Strong ROI: ${cost.roiPct.toFixed(0)}% — excellent capital efficiency`);
    else if (cost.roiPct >= FIN.ROI_ACCEPTABLE) strengths.push(`Adequate ROI: ${cost.roiPct.toFixed(0)}%`);
    else risks.push(`Low ROI: ${cost.roiPct.toFixed(0)}% — capital tied up with poor return`);
  } else {
    factors.push({ label: 'ROI per Cycle', pts: 0, max: 8, note: 'No cost model' });
  }

  // ── Factor 10: Freight clarity (5 pts) ───────────────────────────────────
  if (cost && cost.freight > 0) {
    score += 5;
    factors.push({ label: 'Freight Modelled', pts: 5, max: 5, note: `$${cost.freight.toFixed(2)}/unit` });
    strengths.push(`Freight cost modelled: $${cost.freight.toFixed(2)}/unit included in landed cost`);
  } else if (cost && cost.freight === 0) {
    score += 2;
    factors.push({ label: 'Freight Modelled', pts: 2, max: 5, note: 'No freight included' });
    risks.push('Freight not included in cost model — landed cost is underestimated');
    actions.push('Add freight cost in Sourcing tab to get accurate landed cost');
  } else {
    factors.push({ label: 'Freight Modelled', pts: 0, max: 5, note: 'Not calculated' });
  }

  // ── Factor 11: Startup capital visibility (5 pts) ─────────────────────────
  if (supplier && cost) {
    const capital = estimateStartupCapital(
      supplier.unitCost, supplier.moq, cost.freight, cost.sellingPrice,
    );
    const pts = capital.total < 5000 ? 5 : capital.total < 15000 ? 4 : capital.total < 30000 ? 3 : 2;
    score += pts;
    factors.push({ label: 'Startup Capital', pts, max: 5, note: `~$${capital.total.toLocaleString()} est.` });
    strengths.push(`Startup capital estimated: ~$${capital.total.toLocaleString()} total (inventory + freight + buffer)`);
  } else {
    factors.push({ label: 'Startup Capital', pts: 0, max: 5, note: 'Needs supplier + cost model' });
  }

  // ── Factor 12: Brand readiness (8 pts) ───────────────────────────────────
  if (brand) {
    score += 8;
    factors.push({ label: 'Brand Readiness', pts: 8, max: 8, note: brand.brandName });
    strengths.push(`Brand "${brand.brandName}" ready — identity and strategy defined`);
  } else {
    factors.push({ label: 'Brand Readiness', pts: 0, max: 8, note: 'Not completed' });
    missing.push('No brand identity created');
    actions.push('Open Brand Studio — generate your brand name, tagline, and listing');
  }

  // ── Factor 13: Brand completeness (5 pts) ─────────────────────────────────
  if (brand) {
    let pts = 0;
    if (brand.barcodeMode && brand.barcodeIdentifier) {
      pts += 2; strengths.push(`Barcode strategy set: ${brand.barcodeIdentifier.replace(/_/g, ' ')}`);
    } else {
      missing.push('Barcode strategy not configured — needed before first shipment');
    }
    if (brand.listingTitle) {
      pts += 2; strengths.push('Listing title drafted');
    } else {
      missing.push('Listing title not drafted — generate brand assets to get a suggestion');
    }
    if (brand.labelTemplate) {
      pts += 1; strengths.push(`Label concept saved: ${brand.labelTemplate}`);
    }
    score += pts;
    factors.push({ label: 'Brand Completeness', pts, max: 5, note: pts >= 4 ? 'Mostly complete' : 'Partial' });
  } else {
    factors.push({ label: 'Brand Completeness', pts: 0, max: 5, note: 'No brand' });
  }

  // ── Factor 14: Recon differentiation (5 pts) ─────────────────────────────
  if (recon) {
    const pts = recon.complaints.length >= 3 ? 5 : 3;
    score += pts;
    factors.push({ label: 'Teardown Intel', pts, max: 5, note: `${recon.complaints.length} complaints, ${recon.opportunities.length} angles` });
    strengths.push(`Teardown: ${recon.complaints.length} buyer complaints and ${recon.opportunities.length} differentiation angles mapped`);
    if (recon.improvementSpecs.length > 0) {
      strengths.push(`Product improvements identified: ${recon.improvementSpecs[0]}`);
    }
  } else {
    factors.push({ label: 'Teardown Intel', pts: 0, max: 5, note: 'Not completed' });
    if (product) {
      actions.push('Run Teardown in Research tab to map buyer complaints and differentiation angles');
    }
  }

  // ── Cap and verdict ───────────────────────────────────────────────────────
  // ── Factor 15: Sourcing complexity (5 pts bonus, −5 penalty) ─────────────
  if (sourcingStrategy) {
    const fs = sourcingStrategy.freightSensitivity;
    const sd = sourcingStrategy.sourcingDifficulty;
    if (fs === 'Low' && sd === 'Beginner') {
      score += 5;
      factors.push({ label: 'Sourcing Profile', pts: 5, max: 5, note: 'Low freight risk · Beginner-friendly' });
      strengths.push('Low freight sensitivity and beginner-friendly sourcing — supply chain risk is minimal');
    } else if (fs === 'Extreme' && !sourcingStrategy.freightStrategy.includes('confirmed')) {
      score = Math.max(0, score - 5);
      factors.push({ label: 'Sourcing Profile', pts: -5, max: 5, note: 'Extreme freight sensitivity' });
      risks.push('Extreme freight sensitivity — unconfirmed freight makes unit economics unreliable');
    } else if (sd === 'Advanced') {
      factors.push({ label: 'Sourcing Profile', pts: 0, max: 5, note: `${fs} freight · ${sd} complexity` });
      risks.push(`Advanced sourcing complexity (${fs} freight sensitivity) — factor compliance and logistics costs carefully`);
    } else {
      const pts = fs === 'Low' ? 3 : fs === 'Medium' ? 2 : 0;
      score += pts;
      factors.push({ label: 'Sourcing Profile', pts, max: 5, note: `${fs} freight · ${sd}` });
      if (pts >= 2) strengths.push(`Manageable sourcing profile — ${fs.toLowerCase()} freight sensitivity`);
    }
  }

  // ── Factor 16: Supply Chain Intelligence (±10 pts) ───────────────────────
  // Reads from profile.domains.survivability — never re-runs intelligence engines.
  // Points are halved when confidence is Low and zeroed when Unknown.
  if (profile) {
    const survDomain  = profile.domains.survivability;
    const survRating  = survDomain.level;
    const isLowConf   = profile.overallConfidence === 'Low';
    const isUnknConf  = profile.overallConfidence === 'Unknown';
    const topCause    = survDomain.topCauses[0] ?? profile.topRisks[0]?.trigger ?? '';

    if (survRating === 'Unknown' || isUnknConf) {
      factors.push({ label: 'Supply Chain Health', pts: 0, max: 10, note: 'Unknown — add supplier + cost model to assess' });
    } else if (survRating === 'Strong') {
      const pts = isLowConf ? 5 : 10;
      score += pts;
      factors.push({ label: 'Supply Chain Health', pts, max: 10, note: `${survRating} (${profile.overallScore}/100)${isLowConf ? ' · low confidence' : ''}` });
      if (!isLowConf) strengths.push('Supply chain health is strong — all key risk factors pass the survivability assessment');
    } else if (survRating === 'Viable') {
      const pts = isLowConf ? 2 : 5;
      score += pts;
      factors.push({ label: 'Supply Chain Health', pts, max: 10, note: `${survRating} (${profile.overallScore}/100)${isLowConf ? ' · low confidence' : ''}` });
    } else if (survRating === 'Marginal') {
      factors.push({ label: 'Supply Chain Health', pts: 0, max: 10, note: `${survRating} — ${topCause.slice(0, 55)}` });
      risks.push(`Marginal supply chain health — ${survDomain.explainability}`);
    } else {
      score = Math.max(0, score - 10);
      factors.push({ label: 'Supply Chain Health', pts: -10, max: 10, note: `${survRating} — ${topCause.slice(0, 55)}` });
      risks.push(`Risky supply chain — ${survDomain.explainability}`);
    }
  }

  score = Math.min(100, Math.max(0, score));

  let verdict: Verdict;
  let verdictReason: string;

  if (score >= 80) {
    verdict = 'LAUNCH';
    const topStrength = strengths[0] ?? 'All key pipeline stages complete';
    verdictReason = `${topStrength}. Financial fundamentals are clear — proceed with a first batch.`;
  } else if (score >= 60) {
    verdict = 'TEST SMALL';
    if (!cost) {
      verdictReason = 'Cost model is missing — financial health unconfirmed. Run Profit Lab before committing.';
    } else if (cost.marginPct < FIN.MARGIN_ACCEPTABLE) {
      verdictReason = `Thin margin (${cost.marginPct.toFixed(1)}%) after freight. Test a small batch but negotiate unit cost down.`;
    } else if (!supplier) {
      verdictReason = 'Supplier not locked in — cost model is theoretical. Confirm supplier before ordering.';
    } else if (product && product.reviews >= FIN.REVIEWS_MEDIUM) {
      verdictReason = `High review saturation (${product.reviews.toLocaleString()} reviews). Test small to validate ranking potential before scaling.`;
    } else {
      verdictReason = 'Good fundamentals but one or more stages need more information. Test small batch first.';
    }
  } else if (score >= 40) {
    verdict = 'HOLD';
    if (!product) {
      verdictReason = 'No product validated. Cannot assess demand, competition, or financials without a target product.';
    } else if (!cost) {
      verdictReason = 'No cost model built. Financial viability is completely unknown — build Profit Lab model first.';
    } else if (cost.marginPct < FIN.MARGIN_FLOOR) {
      verdictReason = `Margin (${cost.marginPct.toFixed(1)}%) is below minimum floor of ${FIN.MARGIN_FLOOR}%. Renegotiate supplier cost or increase selling price.`;
    } else {
      verdictReason = `${missing.length} key stages incomplete. Complete the pipeline before committing capital.`;
    }
  } else {
    verdict = 'AVOID';
    if (cost && cost.marginPct < 0) {
      verdictReason = `Product is unprofitable at current costs (${cost.marginPct.toFixed(1)}% margin). This product loses money before PPC.`;
    } else if (!niche && !product) {
      verdictReason = 'Pipeline is empty. Complete all 5 stages before making a launch decision.';
    } else {
      verdictReason = 'Too many unresolved risks. Address missing stages before considering this opportunity.';
    }
  }

  // ── Default next actions ──────────────────────────────────────────────────
  if (actions.length === 0) {
    if (verdict === 'LAUNCH') {
      actions.push('Order your first batch at or just above MOQ — start small');
      actions.push('Set up Amazon Seller Central listing using your drafted title');
      actions.push('Allocate PPC budget: at least 2–3× expected daily revenue for launch phase');
      actions.push('Open Launch Plan to track every pre-launch step');
    } else if (verdict === 'TEST SMALL') {
      actions.push('Order the minimum test batch (exactly MOQ) to validate quality and packaging');
      actions.push('Confirm margin can absorb PPC — run PPC calculator in Profit Lab');
      actions.push('Launch with limited stock first to test ranking velocity before re-ordering');
    } else if (verdict === 'HOLD') {
      actions.push('Complete missing pipeline stages above before committing any capital');
      actions.push('Re-run the cost model with accurate freight costs from Freight Estimator');
    }
  }

  // ── What Would Improve This? ──────────────────────────────────────────────
  if (verdict !== 'LAUNCH') {
    if (!cost) {
      improvements.push('Build a cost model in Profit Lab — unlocks 28 points of scoring (margin + ROI + freight)');
    } else {
      if (cost.marginPct < FIN.MARGIN_EXCELLENT) {
        const targetCost = supplier
          ? Math.max(0.5, supplier.unitCost - cost.sellingPrice * 0.05).toFixed(2)
          : null;
        improvements.push(
          `Reduce unit cost${targetCost ? ` to ~$${targetCost}` : ''} through negotiation — each $0.50 reduction improves margin by 2–4%`,
        );
      }
      if (cost.freight === 0) {
        improvements.push('Add confirmed freight cost — currently missing, which understates total landed cost');
      }
      if (cost.roiPct < FIN.ROI_EXCELLENT) {
        improvements.push('Increase selling price by $1–2 if market allows — directly boosts ROI without adding cost');
      }
    }
    if (!recon) {
      improvements.push('Run Teardown in Research tab — maps buyer complaints into product improvement specs');
    }
    if (supplier && supplier.moq > 500) {
      improvements.push(`Negotiate MOQ down from ${supplier.moq} to 300–400 units — reduces launch capital and inventory risk`);
    }
    if (product && product.reviews >= FIN.REVIEWS_MEDIUM) {
      improvements.push('Target a lower-review sub-niche — reviews above 500 signal high ranking difficulty');
    }
    if (!brand) {
      improvements.push('Create a brand identity in Brand Studio — adds 8 readiness points and unlocks your listing draft');
    }
  }

  // ── Confidence score (separate from readiness) ────────────────────────────
  let confPts = 0;
  if (niche)    confPts += 10;
  if (product)  confPts += 15;
  if (supplier) confPts += 15;
  if (supplier?.grade) confPts += 5;
  if (cost)     confPts += 20;
  if (cost && cost.freight > 0) confPts += 10;
  if (brand)    confPts += 10;
  if (recon)    confPts += 15;
  confPts = Math.min(100, confPts);

  const confLabel: 'Low' | 'Medium' | 'High' =
    confPts >= 70 ? 'High' : confPts >= 40 ? 'Medium' : 'Low';

  const confirmedParts: string[] = [];
  const estimatedParts: string[] = [];
  if (cost && cost.freight > 0) confirmedParts.push('freight');
  else if (supplier)            estimatedParts.push('freight (rough)');
  if (supplier?.grade)          confirmedParts.push('supplier grade');
  else if (supplier)            estimatedParts.push('supplier quality');
  if (cost)                     confirmedParts.push('financials');
  else                          estimatedParts.push('financials');
  if (recon)                    confirmedParts.push('differentiation intel');

  const confDetail = confirmedParts.length > 0
    ? `Confirmed: ${confirmedParts.join(', ')}.${estimatedParts.length > 0 ? ` Estimated: ${estimatedParts.join(', ')}.` : ''}`
    : 'Most data is estimated — confirm supplier, freight, and cost model for higher confidence.';

  const confidence = { pct: confPts, label: confLabel, detail: confDetail };

  return { score, verdict, verdictReason, strengths, risks, missing, actions, improvements, confidence, factors, stages };
}

// ── Verdict config ────────────────────────────────────────────────────────────

const VERDICT_CFG: Record<Verdict, { color: string; bg: string; icon: string; sub: string }> = {
  LAUNCH:      { color: DS.success,  bg: DS.success  + '12', icon: '🚀', sub: 'This opportunity is ready. Act now.' },
  'TEST SMALL':{ color: DS.warning,  bg: DS.warning  + '12', icon: '⚗️', sub: 'Viable — but test a small batch first.' },
  HOLD:        { color: DS.info,     bg: DS.info     + '12', icon: '⏸',  sub: 'More information needed before committing.' },
  AVOID:       { color: DS.danger,   bg: DS.danger   + '12', icon: '✕',  sub: 'Too many risks. Find a better opportunity.' },
};

// ── Stage → tab navigation map ────────────────────────────────────────────────

const STAGE_NAV: Array<{
  stageKey: keyof ReadinessResult['stages'];
  label:    string;
  tab?:     string;
  route?:   string;
  icon:     string;
}> = [
  { stageKey: 'niche',    label: 'Research a Niche',   tab:   'Niche',       icon: '◎' },
  { stageKey: 'product',  label: 'Research a Product', tab:   'Research',    icon: '◈' },
  { stageKey: 'supplier', label: 'Find a Supplier',    tab:   'Sourcing',    icon: '⬡' },
  { stageKey: 'cost',     label: 'Build Profit Model', tab:   'Profit',      icon: '◻' },
  { stageKey: 'brand',    label: 'Set Up Your Brand',  route: 'BrandStudio', icon: '▣' },
];

// ── Sub-components ────────────────────────────────────────────────────────────

function DataRow({ label, value, missing, onPress, navLabel }: {
  label:     string;
  value:     string;
  missing?:  boolean;
  onPress?:  () => void;
  navLabel?: string;
}) {
  if (missing && onPress) {
    return (
      <TouchableOpacity style={d.row} onPress={onPress} activeOpacity={0.75}>
        <Text style={d.label}>{label}</Text>
        <View style={d.missingNav}>
          <Text style={d.valueMissing}>Not done</Text>
          <Text style={d.navArrow}>→ {navLabel}</Text>
        </View>
      </TouchableOpacity>
    );
  }
  return (
    <View style={d.row}>
      <Text style={d.label}>{label}</Text>
      <Text style={[d.value, missing && d.valueMissing]}>{value}</Text>
    </View>
  );
}
const d = StyleSheet.create({
  row:         { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: DS.border },
  label:       { fontSize: 12, color: DS.textSecondary, flex: 1 },
  value:       { fontSize: 12, fontWeight: '700', color: DS.textPrimary, textAlign: 'right', flex: 1 },
  valueMissing:{ color: DS.textMuted, fontStyle: 'italic', fontWeight: '400' as const },
  missingNav:  { flexDirection: 'row', alignItems: 'center', gap: 6 },
  navArrow:    { fontSize: 11, fontWeight: '800', color: DS.accent, backgroundColor: DS.accentLight, paddingHorizontal: 7, paddingVertical: 2, borderRadius: 6 },
});

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={sc.card}>
      <Text style={sc.cardTitle}>{title}</Text>
      {children}
    </View>
  );
}
const sc = StyleSheet.create({
  card:      { backgroundColor: DS.bgCard, borderRadius: DS.radiusCard, borderWidth: 1, borderColor: DS.border, padding: DS.cardPadding, gap: 10 },
  cardTitle: { fontSize: 13, fontWeight: '800', color: DS.textPrimary, letterSpacing: -0.2 },
});

function BulletRow({ text, color, icon }: { text: string; color: string; icon: string }) {
  return (
    <View style={bl.row}>
      <Text style={[bl.icon, { color }]}>{icon}</Text>
      <Text style={bl.txt}>{text}</Text>
    </View>
  );
}
const bl = StyleSheet.create({
  row:  { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  icon: { fontSize: 11, fontWeight: '800', marginTop: 2, width: 14, textAlign: 'center' },
  txt:  { flex: 1, fontSize: 13, color: DS.textSecondary, lineHeight: 19 },
});

// ── Main screen ───────────────────────────────────────────────────────────────

export default function LaunchDecisionScreen() {
  const { isOnline }  = useNetworkStatus();
  const navigation    = useNavigation<any>();
  const pipeline      = usePipeline();
  const intelProfile  = useProductIntelligence();
  const decisionSim   = useDecisionSimulation(intelProfile);
  const [exporting, setExporting]   = useState(false);
  const [qSell, setQSell]           = useState('');
  const [qCost, setQCost]           = useState('');
  const [qMoq, setQMoq]             = useState('');
  const [qFreight, setQFreight]     = useState('');

  type QEField = { key: string; label: string; placeholder: string; keyboard: 'decimal-pad' | 'number-pad' };
  type QEConfig = { title: string; subtitle: string; fields: QEField[]; onSave: (v: Record<string, string>) => void };
  const [qeConfig, setQeConfig] = useState<QEConfig | null>(null);
  const [qeValues, setQeValues] = useState<Record<string, string>>({});

  function openQE(cfg: QEConfig, defaults: Record<string, string> = {}) {
    const init: Record<string, string> = {};
    cfg.fields.forEach(f => { init[f.key] = defaults[f.key] ?? ''; });
    setQeValues(init);
    setQeConfig(cfg);
  }
  function closeQE() { setQeConfig(null); }

  async function handleExport() {
    if (exporting) return;
    setExporting(true);
    try {
      const raw    = await pipeline.exportPipeline();
      const parsed = JSON.parse(raw);
      const lines: string[] = [
        `SIFTLY — LAUNCH SUMMARY`,
        `Exported: ${new Date().toLocaleString()}`,
        ``,
        `PRODUCT`,
        `  Title:       ${parsed.activeProduct?.title ?? '—'}`,
        `  ASIN:        ${parsed.activeProduct?.asin  ?? '—'}`,
        `  Price:       $${parsed.activeProduct?.price ?? '—'}`,
        `  Reviews:     ${parsed.activeProduct?.reviews ?? '—'}`,
        `  Competition: ${parsed.activeProduct?.competition ?? '—'}`,
        ``,
        `SUPPLIER`,
        `  Name:     ${parsed.selectedSupplier?.name     ?? '—'}`,
        `  Platform: ${parsed.selectedSupplier?.platform ?? '—'}`,
        `  Unit Cost: $${parsed.selectedSupplier?.unitCost ?? '—'}`,
        `  MOQ:      ${parsed.selectedSupplier?.moq ?? '—'} units`,
        ``,
        `COST MODEL`,
        `  Selling Price:  $${parsed.costModel?.sellingPrice  ?? '—'}`,
        `  Net Profit:     $${parsed.costModel?.netProfit      ?? '—'}`,
        `  Margin:         ${parsed.costModel?.marginPct != null ? parsed.costModel.marginPct.toFixed(1) + '%' : '—'}`,
        `  ROI:            ${parsed.costModel?.roiPct     != null ? parsed.costModel.roiPct.toFixed(1)     + '%' : '—'}`,
        `  Units Ordered:  ${parsed.costModel?.unitsOrdered   ?? '—'}`,
        `  Total Investment: $${parsed.costModel?.totalInvestment ?? '—'}`,
        ``,
        `NICHE`,
        `  Keyword:   ${parsed.activeNiche?.keyword     ?? '—'}`,
        `  Verdict:   ${parsed.activeNiche?.verdictLabel ?? '—'}`,
        `  Score:     ${parsed.activeNiche?.score        ?? '—'}`,
        ``,
        `BRAND`,
        `  Brand Name:    ${parsed.brandData?.brandName    ?? '—'}`,
        `  Tagline:       ${parsed.brandData?.tagline       ?? '—'}`,
        `  Product Title: ${parsed.brandData?.productTitle  ?? '—'}`,
      ];
      const text = lines.join('\n');
      const uri  = FileSystem.cacheDirectory + 'siftly-launch-summary.txt';
      await FileSystem.writeAsStringAsync(uri, text, { encoding: FileSystem.EncodingType.UTF8 });
      const canShare = await Sharing.isAvailableAsync();
      if (canShare) {
        await Sharing.shareAsync(uri, { mimeType: 'text/plain', dialogTitle: 'Export Launch Summary' });
      }
    } catch (e: any) {
      Alert.alert('Export Failed', e?.message ?? 'Could not export the summary. Please try again.');
    } finally { setExporting(false); }
  }

  const { activeNiche, activeProduct, selectedSupplier, costModel, brandData, reconInsights, sourcingStrategy, supplierQuotes } = pipeline;

  const result = useMemo(
    () => calcReadiness(activeNiche, activeProduct, selectedSupplier, costModel, brandData, reconInsights, sourcingStrategy, supplierQuotes, intelProfile),
    [activeNiche, activeProduct, selectedSupplier, costModel, brandData, reconInsights, sourcingStrategy, supplierQuotes, intelProfile],
  );

  const vcfg = VERDICT_CFG[result.verdict];

  function navigateToStage(stage: typeof STAGE_NAV[number]) {
    if (stage.route) {
      navigation.navigate(stage.route as any);
    } else if (stage.tab) {
      navigation.navigate('Main', { screen: stage.tab });
    }
  }

  function navigateToTab(tab: string, params?: Record<string, unknown>) {
    navigation.navigate('Main', { screen: tab, params } as any);
  }

  function navigateToLaunchPlan() {
    navigation.navigate('Checklist');
  }

  function confirmReset() {
    Alert.alert(
      'Clear Pipeline?',
      'This will remove your niche, product, supplier, cost model, and brand data. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear Everything',
          style: 'destructive',
          onPress: () => {
            pipeline.clearPipeline();
            navigation.goBack();
          },
        },
      ],
    );
  }

  useEffect(() => {
    if (pipeline.loaded) {
      track('launch_decision_viewed', { verdict: result.verdict, score: result.score });
    }
  }, [pipeline.loaded]);

  const incompleteStages = STAGE_NAV.filter(s => !result.stages[s.stageKey]);
  const completeStages   = STAGE_NAV.filter(s => result.stages[s.stageKey]);

  if (!pipeline.loaded) {
    return (
      <SafeAreaView style={s.safe} edges={['top']}>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 }}>
          <ActivityIndicator size="large" color={DS.accent} />
          <Text style={{ color: DS.textMuted, fontSize: 14 }}>Loading your pipeline...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <OfflineBanner visible={!isOnline} />
      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} activeOpacity={0.7} style={s.backBtn}>
          <Text style={s.backTxt}>← Back</Text>
        </TouchableOpacity>
        <Text style={s.headerTitle}>Launch Decision</Text>
        <HelpButton featureKey="launch_decision" size="sm" />
      </View>

      <ScrollView style={s.scroll} contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>

        {/* Verdict card */}
        <View style={[s.verdictCard, { backgroundColor: vcfg.bg, borderColor: vcfg.color + '40' }]}>
          <View style={s.verdictTop}>
            <Text style={s.verdictIcon}>{vcfg.icon}</Text>
            <View style={{ flex: 1, gap: 4 }}>
              <Text style={[s.verdictLabel, { color: vcfg.color }]}>{result.verdict}</Text>
              <Text style={s.verdictSub}>{vcfg.sub}</Text>
            </View>
            <View style={s.scoreCircle}>
              <Text style={[s.scoreNum, { color: vcfg.color }]}>{result.score}</Text>
              <Text style={s.scoreOf}>/100</Text>
            </View>
          </View>

          {/* Score bar */}
          <View style={s.scoreBarTrack}>
            <View style={[s.scoreBarFill, { width: `${result.score}%` as any, backgroundColor: vcfg.color }]} />
          </View>

          {/* Threshold legend */}
          <View style={s.thresholdRow}>
            <Text style={[s.thresholdLbl, result.verdict === 'AVOID'      && { color: DS.danger  }]}>AVOID &lt;40</Text>
            <Text style={[s.thresholdLbl, result.verdict === 'HOLD'       && { color: DS.info    }]}>HOLD 40+</Text>
            <Text style={[s.thresholdLbl, result.verdict === 'TEST SMALL' && { color: DS.warning }]}>TEST 60+</Text>
            <Text style={[s.thresholdLbl, result.verdict === 'LAUNCH'     && { color: DS.success }]}>LAUNCH 80+</Text>
          </View>

          {/* Verdict reason */}
          <View style={s.verdictReasonBox}>
            <Text style={[s.verdictReasonTxt, { color: vcfg.color }]}>{result.verdictReason}</Text>
          </View>
        </View>

        {/* Intelligence summary strip — seller fit + intelligence confidence */}
        {intelProfile && (
          <View style={is.intelStrip}>
            {(() => {
              const fit = intelProfile.sellerFit;
              const fitColors: Record<string, string> = {
                BeginnerSafe: DS.success, Intermediate: DS.accent,
                AdvancedOnly: DS.warning, UnsafeForSeller: DS.danger,
              };
              const fitLabels: Record<string, string> = {
                BeginnerSafe: 'Beginner Safe', Intermediate: 'Intermediate',
                AdvancedOnly: 'Advanced Only', UnsafeForSeller: 'Not Recommended',
              };
              const fc = fitColors[fit.level] ?? DS.textMuted;
              return (
                <View style={is.intelStripItem}>
                  <Text style={is.intelStripLbl}>Seller Fit</Text>
                  <View style={[is.intelChip, { backgroundColor: fc + '18' }]}>
                    <Text style={[is.intelChipTxt, { color: fc }]}>{fitLabels[fit.level] ?? fit.label}</Text>
                  </View>
                  {fit.blockers.length > 0 && (
                    <Text style={[is.intelNote, { color: fc }]} numberOfLines={1}>{fit.blockers[0]}</Text>
                  )}
                </View>
              );
            })()}
            <View style={is.intelStripDivider} />
            {(() => {
              const cc: Record<string, string> = { High: DS.success, Medium: DS.warning, Low: DS.danger, Unknown: DS.textMuted };
              const c = intelProfile.overallConfidence;
              return (
                <View style={is.intelStripItem}>
                  <Text style={is.intelStripLbl}>Intel Confidence</Text>
                  <View style={[is.intelChip, { backgroundColor: (cc[c] ?? DS.textMuted) + '18' }]}>
                    <Text style={[is.intelChipTxt, { color: cc[c] ?? DS.textMuted }]}>{c}</Text>
                  </View>
                  {(c === 'Low' || c === 'Unknown') && (
                    <Text style={is.intelNote} numberOfLines={1}>Add supplier + cost model</Text>
                  )}
                </View>
              );
            })()}
          </View>
        )}

        {/* Cost model missing warning — shown prominently so user understands the score is partial */}
        {!costModel && (
          <TouchableOpacity
            style={s.costMissingBanner}
            onPress={() => navigation.navigate('Main', { screen: 'Profit' } as any)}
            activeOpacity={0.85}
          >
            <Text style={s.costMissingIcon}>⚠</Text>
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={s.costMissingTitle}>Financial model incomplete</Text>
              <Text style={s.costMissingBody}>
                Margin, ROI, and 15 points of scoring are unknown. Tap to open Profit Lab and run a full calculation.
              </Text>
            </View>
            <Text style={s.costMissingChevron}>→</Text>
          </TouchableOpacity>
        )}

        {/* Quick Estimate — shown when no cost model so user can preview margins inline */}
        {!costModel && (
          <View style={s.quickCard}>
            <Text style={s.quickCardTitle}>Quick Estimate</Text>
            <Text style={s.quickCardSub}>Preview your margin here — no need to leave. Open Profit Lab to confirm and save.</Text>
            <View style={s.quickRow}>
              <View style={s.quickField}>
                <Text style={s.quickFieldLbl}>Selling Price ($)</Text>
                <TextInput
                  style={s.quickInput}
                  value={qSell}
                  onChangeText={setQSell}
                  keyboardType="decimal-pad"
                  placeholder="e.g. 29.99"
                  placeholderTextColor={DS.textMuted}
                />
              </View>
              <View style={s.quickField}>
                <Text style={s.quickFieldLbl}>Unit Cost ($)</Text>
                <TextInput
                  style={s.quickInput}
                  value={qCost}
                  onChangeText={setQCost}
                  keyboardType="decimal-pad"
                  placeholder="e.g. 8.50"
                  placeholderTextColor={DS.textMuted}
                />
              </View>
            </View>
            <View style={s.quickRow}>
              <View style={s.quickField}>
                <Text style={s.quickFieldLbl}>MOQ (units)</Text>
                <TextInput
                  style={s.quickInput}
                  value={qMoq}
                  onChangeText={setQMoq}
                  keyboardType="number-pad"
                  placeholder="e.g. 300"
                  placeholderTextColor={DS.textMuted}
                />
              </View>
              <View style={s.quickField}>
                <Text style={s.quickFieldLbl}>Freight / unit ($)</Text>
                <TextInput
                  style={s.quickInput}
                  value={qFreight}
                  onChangeText={setQFreight}
                  keyboardType="decimal-pad"
                  placeholder="e.g. 1.50"
                  placeholderTextColor={DS.textMuted}
                />
              </View>
            </View>
            {(() => {
              const sp  = parseFloat(qSell)    || 0;
              const uc  = parseFloat(qCost)    || 0;
              const moq = parseInt(qMoq)       || 0;
              const fr  = parseFloat(qFreight) || 0;
              if (!sp || !uc) return null;
              const net    = sp * 0.83 - uc - fr;
              const margin = (net / sp) * 100;
              const roi    = (uc + fr) > 0 ? (net / (uc + fr)) * 100 : 0;
              const invest = moq > 0 ? (uc + fr) * moq * 1.15 : null;
              const mc = margin >= 30 ? DS.success : margin >= 15 ? DS.warning : DS.danger;
              const rc = roi    >= 80 ? DS.success : roi    >= 30 ? DS.warning : DS.danger;
              return (
                <View style={s.quickResults}>
                  <View style={s.quickResultItem}>
                    <Text style={s.quickResultLbl}>Est. Margin</Text>
                    <Text style={[s.quickResultVal, { color: mc }]}>{margin.toFixed(1)}%</Text>
                  </View>
                  <View style={s.quickResultItem}>
                    <Text style={s.quickResultLbl}>Est. ROI</Text>
                    <Text style={[s.quickResultVal, { color: rc }]}>{roi.toFixed(0)}%</Text>
                  </View>
                  {invest != null && (
                    <View style={s.quickResultItem}>
                      <Text style={s.quickResultLbl}>Est. Capital</Text>
                      <Text style={s.quickResultVal}>${invest.toLocaleString(undefined, { maximumFractionDigits: 0 })}</Text>
                    </View>
                  )}
                </View>
              );
            })()}
            <TouchableOpacity style={s.quickCTA} onPress={() => navigateToTab('Profit')} activeOpacity={0.8}>
              <Text style={s.quickCTATxt}>Open Profit Lab to confirm →</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Scoring note */}
        <View style={s.scoringNote}>
          <Text style={s.scoringNoteTxt}>
            14-factor scoring across niche, demand, competition, supplier, margin, ROI, capital, and brand. Max earnable: 111, capped at 100. LAUNCH ≥ 80 · TEST SMALL 60–79 · HOLD 40–59 · AVOID &lt; 40.
          </Text>
        </View>

        {/* Confidence meter — separate from readiness score */}
        <View style={s.confidenceCard}>
          <View style={s.confidenceHeader}>
            <Text style={s.confidenceTitle}>Data Confidence</Text>
            <Text style={[s.confidencePill, {
              color: result.confidence.label === 'High' ? DS.success : result.confidence.label === 'Medium' ? DS.warning : DS.danger,
              backgroundColor: result.confidence.label === 'High' ? DS.success + '14' : result.confidence.label === 'Medium' ? DS.warning + '14' : DS.danger + '14',
            }]}>
              {result.confidence.label}
            </Text>
          </View>
          <View style={s.confBarTrack}>
            <View style={[s.confBarFill, {
              width: `${result.confidence.pct}%` as any,
              backgroundColor: result.confidence.label === 'High' ? DS.success : result.confidence.label === 'Medium' ? DS.warning : DS.danger,
            }]} />
          </View>
          <Text style={s.confidenceDetail}>{result.confidence.detail}</Text>
        </View>

        {/* Pipeline snapshot */}
        <Section title="Pipeline Snapshot">
          <DataRow
            label="Niche"
            value={activeNiche ? `${activeNiche.keyword} (${activeNiche.verdictLabel})` : '—'}
            missing={!activeNiche}
            onPress={!activeNiche ? () => navigateToTab('Niche') : undefined}
            navLabel="Research a Niche"
          />
          <DataRow
            label="Product"
            value={activeProduct ? activeProduct.title : '—'}
            missing={!activeProduct}
            onPress={!activeProduct ? () => navigateToTab('Research') : undefined}
            navLabel="Find a Product"
          />
          {activeProduct && activeProduct.salesEstLow != null && (
            <DataRow label="Est. Monthly Sales" value={`~${activeProduct.salesEstLow}–${activeProduct.salesEstHigh} units/mo`} />
          )}
          {activeProduct && activeProduct.salesEstLow == null && (
            <DataRow
              label="Est. Monthly Sales"
              value="—"
              missing
              onPress={() => navigateToTab('Research', { autoSearch: activeProduct.asin ?? activeProduct.title })}
              navLabel="Analyse in Research"
            />
          )}
          <DataRow
            label="Supplier"
            value={selectedSupplier ? `${selectedSupplier.name} — $${selectedSupplier.unitCost}/unit` : '—'}
            missing={!selectedSupplier}
            onPress={!selectedSupplier ? () => navigateToTab('Sourcing') : undefined}
            navLabel="Find Supplier"
          />
          <DataRow
            label="MOQ"
            value={selectedSupplier ? `${selectedSupplier.moq.toLocaleString()} units` : '—'}
            missing={!selectedSupplier}
            onPress={!selectedSupplier ? () => navigateToTab('Sourcing') : undefined}
            navLabel="Find Supplier"
          />
          <DataRow
            label="Lead Time"
            value={selectedSupplier?.leadTimeDays != null ? `~${selectedSupplier.leadTimeDays} days` : '—'}
            missing={!selectedSupplier?.leadTimeDays}
            onPress={selectedSupplier ? () => openQE({
              title: 'Supplier Lead Time',
              subtitle: 'Days from placing the order to goods arriving at your freight forwarder.',
              fields: [{ key: 'days', label: 'Lead time (days)', placeholder: 'e.g. 30', keyboard: 'number-pad' }],
              onSave: v => {
                const d = parseInt(v.days);
                if (!isNaN(d) && d > 0) pipeline.setSelectedSupplier({ ...selectedSupplier, leadTimeDays: d });
                closeQE();
              },
            }, { days: selectedSupplier.leadTimeDays != null ? String(selectedSupplier.leadTimeDays) : '' }) : () => navigateToTab('Sourcing')}
            navLabel={!selectedSupplier ? 'Find Supplier' : 'Enter here'}
          />
          <DataRow
            label="Margin"
            value={costModel ? `${costModel.marginPct.toFixed(1)}%` : '—'}
            missing={!costModel}
            onPress={!costModel ? () => openQE({
              title: 'Quick Cost Model',
              subtitle: 'Enter your numbers to calculate margin, ROI, and investment. Refine in Profit Lab anytime.',
              fields: [
                { key: 'sell',    label: 'Selling price ($)',   placeholder: 'e.g. 29.99', keyboard: 'decimal-pad' },
                { key: 'cost',    label: 'Unit cost ($)',       placeholder: 'e.g. 7.50',  keyboard: 'decimal-pad' },
                { key: 'freight', label: 'Freight / unit ($)',  placeholder: 'e.g. 1.50',  keyboard: 'decimal-pad' },
                { key: 'units',   label: 'Units to order',      placeholder: 'e.g. 300',   keyboard: 'number-pad'  },
              ],
              onSave: v => {
                const sp  = parseFloat(v.sell)    || 0;
                const uc  = parseFloat(v.cost)    || 0;
                const fr  = parseFloat(v.freight) || 0;
                const qty = parseInt(v.units)     || (selectedSupplier?.moq ?? 300);
                if (sp > 0 && uc > 0) {
                  const referralFee = sp * 0.15;
                  const fbaFee      = sp * 0.15;
                  const totalCost   = uc + fr + referralFee + fbaFee;
                  const netProfit   = sp - totalCost;
                  const marginPct   = (netProfit / sp) * 100;
                  const roiPct      = (uc + fr) > 0 ? (netProfit / (uc + fr)) * 100 : 0;
                  pipeline.setCostModel({ sellingPrice: sp, unitCost: uc, freight: fr, fbaFee, referralFee, duties: 0, packaging: 0, netProfit, marginPct, roiPct, totalCost, unitsOrdered: qty, totalInvestment: (uc + fr) * qty, savedAt: new Date().toISOString() });
                }
                closeQE();
              },
            }, { sell: selectedSupplier ? String(selectedSupplier.unitCost * 3.5) : '', cost: selectedSupplier ? String(selectedSupplier.unitCost) : '', units: selectedSupplier ? String(selectedSupplier.moq) : '' }) : undefined}
            navLabel="Enter here"
          />
          <DataRow
            label="ROI"
            value={costModel ? `${costModel.roiPct.toFixed(0)}%` : '—'}
            missing={!costModel}
            onPress={!costModel ? () => openQE({
              title: 'Quick Cost Model',
              subtitle: 'Enter your numbers to calculate margin, ROI, and investment. Refine in Profit Lab anytime.',
              fields: [
                { key: 'sell',    label: 'Selling price ($)',   placeholder: 'e.g. 29.99', keyboard: 'decimal-pad' },
                { key: 'cost',    label: 'Unit cost ($)',       placeholder: 'e.g. 7.50',  keyboard: 'decimal-pad' },
                { key: 'freight', label: 'Freight / unit ($)',  placeholder: 'e.g. 1.50',  keyboard: 'decimal-pad' },
                { key: 'units',   label: 'Units to order',      placeholder: 'e.g. 300',   keyboard: 'number-pad'  },
              ],
              onSave: v => {
                const sp = parseFloat(v.sell) || 0; const uc = parseFloat(v.cost) || 0; const fr = parseFloat(v.freight) || 0; const qty = parseInt(v.units) || 300;
                if (sp > 0 && uc > 0) { const ref = sp * 0.15; const fba = sp * 0.15; const tc = uc + fr + ref + fba; const np = sp - tc; pipeline.setCostModel({ sellingPrice: sp, unitCost: uc, freight: fr, fbaFee: fba, referralFee: ref, duties: 0, packaging: 0, netProfit: np, marginPct: (np / sp) * 100, roiPct: (uc + fr) > 0 ? (np / (uc + fr)) * 100 : 0, totalCost: tc, unitsOrdered: qty, totalInvestment: (uc + fr) * qty, savedAt: new Date().toISOString() }); }
                closeQE();
              },
            }, { sell: '', cost: selectedSupplier ? String(selectedSupplier.unitCost) : '', units: selectedSupplier ? String(selectedSupplier.moq) : '' }) : undefined}
            navLabel="Enter here"
          />
          <DataRow
            label="Net Profit"
            value={costModel ? `$${costModel.netProfit.toFixed(2)}/unit` : '—'}
            missing={!costModel}
            onPress={!costModel ? () => openQE({
              title: 'Quick Cost Model',
              subtitle: 'Enter your numbers to calculate margin, ROI, and investment. Refine in Profit Lab anytime.',
              fields: [
                { key: 'sell',    label: 'Selling price ($)',   placeholder: 'e.g. 29.99', keyboard: 'decimal-pad' },
                { key: 'cost',    label: 'Unit cost ($)',       placeholder: 'e.g. 7.50',  keyboard: 'decimal-pad' },
                { key: 'freight', label: 'Freight / unit ($)',  placeholder: 'e.g. 1.50',  keyboard: 'decimal-pad' },
                { key: 'units',   label: 'Units to order',      placeholder: 'e.g. 300',   keyboard: 'number-pad'  },
              ],
              onSave: v => {
                const sp = parseFloat(v.sell) || 0; const uc = parseFloat(v.cost) || 0; const fr = parseFloat(v.freight) || 0; const qty = parseInt(v.units) || 300;
                if (sp > 0 && uc > 0) { const ref = sp * 0.15; const fba = sp * 0.15; const tc = uc + fr + ref + fba; const np = sp - tc; pipeline.setCostModel({ sellingPrice: sp, unitCost: uc, freight: fr, fbaFee: fba, referralFee: ref, duties: 0, packaging: 0, netProfit: np, marginPct: (np / sp) * 100, roiPct: (uc + fr) > 0 ? (np / (uc + fr)) * 100 : 0, totalCost: tc, unitsOrdered: qty, totalInvestment: (uc + fr) * qty, savedAt: new Date().toISOString() }); }
                closeQE();
              },
            }, { sell: '', cost: selectedSupplier ? String(selectedSupplier.unitCost) : '', units: selectedSupplier ? String(selectedSupplier.moq) : '' }) : undefined}
            navLabel="Enter here"
          />
          <DataRow
            label="Investment"
            value={costModel != null ? (costModel.totalInvestment > 0 ? `$${costModel.totalInvestment.toLocaleString()}` : 'Not calculated') : '—'}
            missing={!costModel}
            onPress={!costModel ? () => openQE({
              title: 'Quick Cost Model',
              subtitle: 'Enter your numbers to calculate margin, ROI, and investment. Refine in Profit Lab anytime.',
              fields: [
                { key: 'sell',    label: 'Selling price ($)',   placeholder: 'e.g. 29.99', keyboard: 'decimal-pad' },
                { key: 'cost',    label: 'Unit cost ($)',       placeholder: 'e.g. 7.50',  keyboard: 'decimal-pad' },
                { key: 'freight', label: 'Freight / unit ($)',  placeholder: 'e.g. 1.50',  keyboard: 'decimal-pad' },
                { key: 'units',   label: 'Units to order',      placeholder: 'e.g. 300',   keyboard: 'number-pad'  },
              ],
              onSave: v => {
                const sp = parseFloat(v.sell) || 0; const uc = parseFloat(v.cost) || 0; const fr = parseFloat(v.freight) || 0; const qty = parseInt(v.units) || 300;
                if (sp > 0 && uc > 0) { const ref = sp * 0.15; const fba = sp * 0.15; const tc = uc + fr + ref + fba; const np = sp - tc; pipeline.setCostModel({ sellingPrice: sp, unitCost: uc, freight: fr, fbaFee: fba, referralFee: ref, duties: 0, packaging: 0, netProfit: np, marginPct: (np / sp) * 100, roiPct: (uc + fr) > 0 ? (np / (uc + fr)) * 100 : 0, totalCost: tc, unitsOrdered: qty, totalInvestment: (uc + fr) * qty, savedAt: new Date().toISOString() }); }
                closeQE();
              },
            }, { sell: '', cost: selectedSupplier ? String(selectedSupplier.unitCost) : '', units: selectedSupplier ? String(selectedSupplier.moq) : '' }) : undefined}
            navLabel="Enter here"
          />
          <DataRow
            label="Freight / unit"
            value={costModel && costModel.freight > 0 ? `$${costModel.freight.toFixed(2)}` : costModel ? 'Not modelled' : '—'}
            missing={!costModel || costModel.freight === 0}
            onPress={costModel && costModel.freight === 0 ? () => openQE({
              title: 'Freight per Unit',
              subtitle: 'Estimated shipping cost per unit (sea freight ÷ units ordered). Updates your margin and ROI.',
              fields: [{ key: 'freight', label: 'Freight per unit ($)', placeholder: 'e.g. 1.50', keyboard: 'decimal-pad' }],
              onSave: v => {
                const f = parseFloat(v.freight);
                if (!isNaN(f) && f >= 0 && costModel) {
                  const totalCost   = costModel.unitCost + f + costModel.fbaFee + costModel.referralFee + costModel.duties + costModel.packaging;
                  const netProfit   = costModel.sellingPrice - totalCost;
                  const marginPct   = (netProfit / costModel.sellingPrice) * 100;
                  const roiPct      = (costModel.unitCost + f) > 0 ? (netProfit / (costModel.unitCost + f)) * 100 : 0;
                  const totalInv    = (costModel.unitCost + f) * costModel.unitsOrdered;
                  pipeline.setCostModel({ ...costModel, freight: f, totalCost, netProfit, marginPct, roiPct, totalInvestment: totalInv, savedAt: new Date().toISOString() });
                }
                closeQE();
              },
            }, { freight: '' }) : !costModel ? () => navigateToTab('Profit') : undefined}
            navLabel={!costModel ? 'Build Cost Model' : 'Enter here'}
          />
          {costModel && (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingTop: 4 }}>
              <EstimateLabel type="confirmed" />
              <Text style={{ fontSize: 10, color: DS.textMuted }}>Financials from your confirmed cost model</Text>
            </View>
          )}
          <DataRow
            label="Brand"
            value={brandData ? brandData.brandName : '—'}
            missing={!brandData}
            onPress={!brandData ? () => navigation.navigate('BrandStudio' as any) : undefined}
            navLabel="Brand Studio"
          />
          <DataRow
            label="Barcode"
            value={brandData?.barcodeIdentifier ? brandData.barcodeIdentifier.replace(/_/g, ' ') : '—'}
            missing={!brandData?.barcodeIdentifier}
            onPress={!brandData?.barcodeIdentifier ? () => navigation.navigate('BrandStudio' as any) : undefined}
            navLabel="Brand Studio"
          />
          <DataRow
            label="Teardown"
            value={reconInsights ? `${reconInsights.complaints.length} complaints mapped` : '—'}
            missing={!reconInsights}
            onPress={!reconInsights ? () => navigateToTab('Research', { autoRecon: activeProduct?.title ?? activeNiche?.keyword }) : undefined}
            navLabel="Run Teardown"
          />
        </Section>

        {/* Strengths */}
        {result.strengths.length > 0 && (
          <Section title="Strengths">
            {result.strengths.map((str, i) => (
              <BulletRow key={i} text={str} color={DS.success} icon="✓" />
            ))}
          </Section>
        )}

        {/* Business risks (financial / competition) */}
        {result.risks.length > 0 && (
          <Section title="Business Risks">
            {result.risks.map((r, i) => (
              <BulletRow key={i} text={r} color={DS.warning} icon="⚠" />
            ))}
          </Section>
        )}

        {/* Supply chain risks from profile */}
        {intelProfile && intelProfile.topRisks.length > 0 && (
          <Section title="Supply Chain Risks">
            {intelProfile.topRisks.slice(0, 4).map((r, i) => (
              <View key={i} style={il.riskRow}>
                <Text style={il.riskIcon}>⚠</Text>
                <View style={{ flex: 1, gap: 2 }}>
                  <Text style={il.riskTxt}>{r.action}</Text>
                  <Text style={il.riskWhy}>{r.why}</Text>
                </View>
              </View>
            ))}
            {/* CTA: fix supply chain risks */}
            <TouchableOpacity
              style={il.fixCTA}
              onPress={() => navigateToTab('Sourcing')}
              activeOpacity={0.8}
            >
              <Text style={il.fixCTATxt}>Review Supply Chain in Sourcing tab →</Text>
            </TouchableOpacity>
          </Section>
        )}

        {/* Missing inputs — profile-driven, navigable (supply chain + financial) */}
        {intelProfile && intelProfile.missingInputs.length > 0 && (
          <Section title="Missing Data">
            {intelProfile.missingInputs.slice(0, 5).map((m, i) => (
              <TouchableOpacity
                key={i}
                style={[il.missingRow, !m.tab && il.missingRowStatic]}
                onPress={m.tab ? () => navigateToTab(m.tab!) : undefined}
                activeOpacity={m.tab ? 0.75 : 1}
                disabled={!m.tab}
              >
                <View style={{ flex: 1, gap: 2 }}>
                  <Text style={il.missingField}>{m.field}</Text>
                  <Text style={il.missingImpact}>{m.impact}</Text>
                </View>
                {m.tab && <Text style={il.missingNav}>→ {m.tab}</Text>}
              </TouchableOpacity>
            ))}
            {/* Non-supply-chain missing items (niche/brand) */}
            {result.missing
              .filter(m => !m.toLowerCase().includes('supplier') && !m.toLowerCase().includes('cost model') && !m.toLowerCase().includes('freight'))
              .map((m, i) => (
                <BulletRow key={`other-${i}`} text={m} color={DS.danger} icon="✕" />
              ))}
          </Section>
        )}
        {/* Fallback: show result.missing if no profile yet */}
        {!intelProfile && result.missing.length > 0 && (
          <Section title="Missing Information">
            {result.missing.map((m, i) => (
              <BulletRow key={i} text={m} color={DS.danger} icon="✕" />
            ))}
          </Section>
        )}

        {/* What Would Improve This */}
        {result.improvements.length > 0 && (
          <Section title="What Would Improve This?">
            {result.improvements.map((imp, i) => (
              <BulletRow key={i} text={imp} color={DS.info} icon="↑" />
            ))}
          </Section>
        )}

        {/* Intelligence actions from profile */}
        {intelProfile && intelProfile.topActions.length > 0 && (
          <Section title="Intelligence Actions">
            {intelProfile.topActions.slice(0, 4).map((a, i) => (
              <View key={i} style={il.actionRow}>
                <View style={il.actionNum}>
                  <Text style={il.actionNumTxt}>{i + 1}</Text>
                </View>
                <View style={{ flex: 1, gap: 2 }}>
                  <Text style={il.actionTxt}>{a.action}</Text>
                  <Text style={il.actionWhy}>{a.why}</Text>
                </View>
              </View>
            ))}
          </Section>
        )}

        {/* Pipeline-completion actions */}
        {result.actions.length > 0 && (
          <Section title="Pipeline Actions">
            {result.actions.map((a, i) => (
              <BulletRow key={i} text={a} color={DS.accent} icon={`${i + 1}`} />
            ))}
          </Section>
        )}

        {/* Scoring factors breakdown */}
        <Section title="Score Breakdown (14 Factors)">
          {result.factors.map((f, i) => (
            <View key={i} style={fb.row}>
              <View style={fb.labelWrap}>
                <Text style={fb.label}>{f.label}</Text>
                {f.note ? <Text style={fb.note}>{f.note}</Text> : null}
              </View>
              <View style={fb.barWrap}>
                <View style={fb.barTrack}>
                  <View
                    style={[
                      fb.barFill,
                      {
                        width: `${Math.round((f.pts / f.max) * 100)}%` as any,
                        backgroundColor: f.pts === f.max ? DS.success : f.pts > 0 ? DS.accent : DS.bgElevated,
                      },
                    ]}
                  />
                </View>
              </View>
              <Text style={[fb.score, { color: f.pts === 0 ? DS.textMuted : DS.textPrimary }]}>
                {f.pts}/{f.max}
              </Text>
            </View>
          ))}
        </Section>

        {/* ── Action Centre ───────────────────────────────────────────────── */}
        <View style={s.actionCard}>
          <Text style={s.actionCardTitle}>What to do next</Text>

          {/* Incomplete stages — navigate to fix */}
          {incompleteStages.length > 0 && (
            <View style={s.actionGroup}>
              <Text style={s.actionGroupLbl}>Complete these stages to improve your score:</Text>
              {incompleteStages.map(stage => (
                <TouchableOpacity
                  key={stage.stageKey}
                  style={s.actionBtn}
                  onPress={() => navigateToStage(stage)}
                  activeOpacity={0.75}
                >
                  <Text style={s.actionBtnIcon}>{stage.icon}</Text>
                  <Text style={s.actionBtnTxt}>{stage.label}</Text>
                  <Text style={s.actionBtnArrow}>→</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}

          {/* Ready — open checklist */}
          {result.verdict === 'LAUNCH' || result.verdict === 'TEST SMALL' ? (
            <View style={s.actionGroup}>
              <Text style={s.actionGroupLbl}>
                {result.verdict === 'LAUNCH'
                  ? 'Your pipeline is launch-ready. Work through your launch plan:'
                  : 'Order a test batch and track progress with your launch plan:'}
              </Text>
              <TouchableOpacity style={s.checklistBtn} onPress={navigateToLaunchPlan} activeOpacity={0.8}>
                <Text style={s.checklistBtnIcon}>✓</Text>
                <Text style={s.checklistBtnTxt}>Open Launch Plan</Text>
                <Text style={s.checklistBtnArrow}>→</Text>
              </TouchableOpacity>
            </View>
          ) : null}

          {/* Completed stages — quick links back */}
          {completeStages.length > 0 && (
            <View style={s.actionGroup}>
              <Text style={s.actionGroupLbl}>Review or update completed stages:</Text>
              <View style={s.quickLinks}>
                {completeStages.map(stage => (
                  <TouchableOpacity
                    key={stage.stageKey}
                    style={s.quickLink}
                    onPress={() => navigateToStage(stage)}
                    activeOpacity={0.75}
                  >
                    <Text style={s.quickLinkIcon}>{stage.icon}</Text>
                    <Text style={s.quickLinkTxt}>{stage.tab ?? stage.route ?? ''}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}

          {/* Export launch summary */}
          <TouchableOpacity style={s.exportBtn} activeOpacity={0.75} onPress={handleExport} disabled={exporting}>
            <Text style={s.exportBtnTxt}>{exporting ? 'Exporting…' : 'Export Launch Summary'}</Text>
          </TouchableOpacity>
        </View>

        {/* Decision simulator — what-if analysis before committing */}
        {intelProfile && (
          <DecisionSimulationPanel sim={decisionSim} baseProfile={intelProfile} />
        )}

        {/* Reset pipeline */}
        <TouchableOpacity style={s.resetBtn} onPress={confirmReset} activeOpacity={0.7}>
          <Text style={s.resetTxt}>Clear Pipeline & Start Over</Text>
        </TouchableOpacity>

      </ScrollView>

      {/* ── Quick Entry Bottom Sheet ─────────────────────────────────────── */}
      <Modal visible={!!qeConfig} transparent animationType="slide" onRequestClose={closeQE}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
          <TouchableOpacity style={qes.overlay} activeOpacity={1} onPress={closeQE} />
          {qeConfig && (
            <View style={qes.sheet}>
              <View style={qes.handle} />
              <Text style={qes.title}>{qeConfig.title}</Text>
              <Text style={qes.sub}>{qeConfig.subtitle}</Text>
              <View style={qes.fields}>
                {qeConfig.fields.map((f, i) => (
                  <View key={f.key} style={qes.fieldWrap}>
                    <Text style={qes.fieldLbl}>{f.label}</Text>
                    <TextInput
                      style={qes.input}
                      value={qeValues[f.key] ?? ''}
                      onChangeText={v => setQeValues(prev => ({ ...prev, [f.key]: v }))}
                      keyboardType={f.keyboard}
                      placeholder={f.placeholder}
                      placeholderTextColor={DS.textMuted}
                      autoFocus={i === 0}
                      returnKeyType={i < qeConfig.fields.length - 1 ? 'next' : 'done'}
                    />
                  </View>
                ))}
              </View>
              <View style={qes.btnRow}>
                <TouchableOpacity style={qes.cancelBtn} onPress={closeQE} activeOpacity={0.7}>
                  <Text style={qes.cancelTxt}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity style={qes.saveBtn} onPress={() => qeConfig.onSave(qeValues)} activeOpacity={0.8}>
                  <Text style={qes.saveTxt}>Save</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        </KeyboardAvoidingView>
      </Modal>

    </SafeAreaView>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  safe:    { flex: 1, backgroundColor: DS.bgCanvas },
  header: {
    flexDirection:     'row',
    alignItems:        'center',
    justifyContent:    'space-between',
    paddingHorizontal: DS.pagePadding,
    paddingVertical:   14,
    borderBottomWidth: 1,
    borderBottomColor: DS.border,
    backgroundColor:   DS.bgCard,
  },
  backBtn:     { width: 60 },
  backTxt:     { fontSize: 14, fontWeight: '700', color: DS.accent },
  headerTitle: { fontSize: 16, fontWeight: '900', color: DS.textPrimary, letterSpacing: -0.4 },

  scroll:  { flex: 1 },
  content: { paddingHorizontal: DS.pagePadding, paddingBottom: 60, gap: DS.sectionGap, paddingTop: DS.sectionGap },

  verdictCard: {
    borderRadius: DS.radiusCard,
    borderWidth:  1.5,
    padding:      DS.cardPadding,
    gap:          14,
  },
  verdictTop:  { flexDirection: 'row', alignItems: 'center', gap: 14 },
  verdictIcon: { fontSize: 36 },
  verdictLabel:{ fontSize: 28, fontWeight: '900', letterSpacing: -0.8 },
  verdictSub:  { fontSize: 13, color: DS.textSecondary, lineHeight: 18 },

  scoreCircle: { alignItems: 'center', justifyContent: 'center', width: 60 },
  scoreNum:    { fontSize: 28, fontWeight: '900', lineHeight: 32 },
  scoreOf:     { fontSize: 10, color: DS.textMuted, fontWeight: '600' },

  scoreBarTrack:  { height: 6, backgroundColor: DS.bgElevated, borderRadius: 3, overflow: 'hidden' },
  scoreBarFill:   { height: 6, borderRadius: 3 },

  thresholdRow:   { flexDirection: 'row', justifyContent: 'space-between' },
  thresholdLbl:   { fontSize: 9, fontWeight: '700', color: DS.textMuted, letterSpacing: 0.3, textTransform: 'uppercase' },

  scoringNote:    { backgroundColor: DS.bgElevated, borderRadius: DS.radiusChip, padding: 12 },
  scoringNoteTxt: { fontSize: 11, color: DS.textMuted, lineHeight: 16, textAlign: 'center' },

  verdictReasonBox: { paddingTop: 4 },
  verdictReasonTxt: { fontSize: 13, fontWeight: '600', lineHeight: 18 },

  confidenceCard: {
    backgroundColor: DS.bgCard,
    borderRadius:    DS.radiusCard,
    borderWidth:     1,
    borderColor:     DS.border,
    padding:         DS.cardPadding,
    gap:             10,
  },
  confidenceHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  confidenceTitle:  { fontSize: 13, fontWeight: '800', color: DS.textPrimary, letterSpacing: -0.2 },
  confidencePill:   { fontSize: 10, fontWeight: '800', paddingHorizontal: 10, paddingVertical: 3, borderRadius: 999, overflow: 'hidden' as const },
  confBarTrack:     { height: 5, backgroundColor: DS.bgElevated, borderRadius: 3, overflow: 'hidden' },
  confBarFill:      { height: 5, borderRadius: 3 },
  confidenceDetail: { fontSize: 11, color: DS.textMuted, lineHeight: 15 },

  costMissingBanner: {
    flexDirection:    'row',
    alignItems:       'center',
    gap:              12,
    backgroundColor:  '#F59E0B12',
    borderRadius:     DS.radiusCard,
    padding:          14,
    borderWidth:      1,
    borderColor:      '#F59E0B40',
  },
  costMissingIcon:   { fontSize: 18, color: DS.warning },
  costMissingTitle:  { fontSize: 13, fontWeight: '800', color: DS.textPrimary },
  costMissingBody:   { fontSize: 11, color: DS.textSecondary, lineHeight: 16 },
  costMissingChevron:{ fontSize: 16, color: DS.warning, fontWeight: '700' },

  // ── Quick Estimate ────────────────────────────────────────────────────────
  quickCard: {
    backgroundColor: DS.bgCard,
    borderRadius:    DS.radiusCard,
    borderWidth:     1,
    borderColor:     DS.accent + '30',
    padding:         DS.cardPadding,
    gap:             12,
  },
  quickCardTitle: { fontSize: 13, fontWeight: '800', color: DS.textPrimary },
  quickCardSub:   { fontSize: 11, color: DS.textSecondary, lineHeight: 16 },
  quickRow:       { flexDirection: 'row', gap: 10 },
  quickField:     { flex: 1, gap: 4 },
  quickFieldLbl:  { fontSize: 10, fontWeight: '600', color: DS.textSecondary },
  quickInput: {
    backgroundColor:   DS.bgElevated,
    borderRadius:      DS.radiusInput,
    borderWidth:       1,
    borderColor:       DS.border,
    paddingHorizontal: 10,
    paddingVertical:   8,
    fontSize:          13,
    color:             DS.textPrimary,
  },
  quickResults:     { flexDirection: 'row', gap: 8 },
  quickResultItem:  { flex: 1, alignItems: 'center', backgroundColor: DS.bgElevated, borderRadius: DS.radiusChip, paddingVertical: 10, gap: 3 },
  quickResultLbl:   { fontSize: 10, color: DS.textMuted, fontWeight: '600' },
  quickResultVal:   { fontSize: 16, fontWeight: '900', color: DS.textPrimary },
  quickCTA: {
    backgroundColor: DS.accent,
    borderRadius:    DS.radiusButton,
    paddingVertical: 12,
    alignItems:      'center',
  },
  quickCTATxt: { fontSize: 13, fontWeight: '800', color: '#FFFFFF' },

  // ── Action Centre ─────────────────────────────────────────────────────────
  actionCard: {
    backgroundColor: DS.bgCard,
    borderRadius:    DS.radiusCard,
    borderWidth:     1,
    borderColor:     DS.border,
    padding:         DS.cardPadding,
    gap:             16,
  },
  actionCardTitle: { fontSize: 14, fontWeight: '800', color: DS.textPrimary, letterSpacing: -0.2 },

  actionGroup:    { gap: 8 },
  actionGroupLbl: { fontSize: 11, fontWeight: '600', color: DS.textMuted, lineHeight: 15 },

  actionBtn: {
    flexDirection:   'row',
    alignItems:      'center',
    gap:             10,
    paddingVertical: 12,
    paddingHorizontal: 14,
    backgroundColor: DS.bgElevated,
    borderRadius:    DS.radiusButton,
    borderWidth:     1,
    borderColor:     DS.border,
  },
  actionBtnIcon:  { fontSize: 14, color: DS.accent, width: 20, textAlign: 'center' },
  actionBtnTxt:   { flex: 1, fontSize: 13, fontWeight: '700', color: DS.textPrimary },
  actionBtnArrow: { fontSize: 14, color: DS.textMuted },

  checklistBtn: {
    flexDirection:   'row',
    alignItems:      'center',
    gap:             10,
    paddingVertical: 14,
    paddingHorizontal: 16,
    backgroundColor: DS.success + '12',
    borderRadius:    DS.radiusButton,
    borderWidth:     1.5,
    borderColor:     DS.success + '40',
  },
  checklistBtnIcon:  { fontSize: 14, color: DS.success, width: 20, textAlign: 'center', fontWeight: '800' },
  checklistBtnTxt:   { flex: 1, fontSize: 13, fontWeight: '800', color: DS.success },
  checklistBtnArrow: { fontSize: 14, color: DS.success },

  quickLinks: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  quickLink: {
    flexDirection:    'row',
    alignItems:       'center',
    gap:              6,
    paddingVertical:  8,
    paddingHorizontal: 12,
    backgroundColor:  DS.bgElevated,
    borderRadius:     DS.radiusButton,
    borderWidth:      1,
    borderColor:      DS.border,
  },
  quickLinkIcon: { fontSize: 12, color: DS.textMuted },
  quickLinkTxt:  { fontSize: 12, fontWeight: '700', color: DS.textSecondary },

  exportBtn: {
    alignItems:      'center',
    paddingVertical: 12,
    borderWidth:     1,
    borderColor:     DS.border,
    borderRadius:    DS.radiusButton,
    backgroundColor: DS.bgElevated,
  },
  exportBtnTxt: { fontSize: 12, fontWeight: '700', color: DS.textSecondary },

  resetBtn: {
    alignItems:      'center',
    paddingVertical: 14,
    borderWidth:     1,
    borderColor:     DS.danger + '30',
    borderRadius:    DS.radiusButton,
    backgroundColor: DS.danger + '08',
  },
  resetTxt: { fontSize: 13, fontWeight: '700', color: DS.danger },
});

const fb = StyleSheet.create({
  row:      { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 5 },
  labelWrap:{ flex: 1, gap: 1 },
  label:    { fontSize: 12, fontWeight: '700', color: DS.textPrimary },
  note:     { fontSize: 10, color: DS.textMuted },
  barWrap:  { flex: 1 },
  barTrack: { height: 5, backgroundColor: DS.bgElevated, borderRadius: 3, overflow: 'hidden' },
  barFill:  { height: 5, borderRadius: 3 },
  score:    { fontSize: 11, fontWeight: '800', width: 32, textAlign: 'right' },
});

// ── Intelligence-section styles ───────────────────────────────────────────────
const il = StyleSheet.create({
  riskRow:         { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  riskIcon:        { fontSize: 12, color: DS.warning, marginTop: 2, width: 14 },
  riskTxt:         { fontSize: 12, fontWeight: '700', color: DS.textPrimary, lineHeight: 16 },
  riskWhy:         { fontSize: 11, color: DS.textSecondary, lineHeight: 15 },

  fixCTA:          { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', paddingTop: 4 },
  fixCTATxt:       { fontSize: 12, fontWeight: '700', color: DS.accent },

  missingRow:      { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8, paddingHorizontal: 10, borderRadius: DS.radiusChip, backgroundColor: DS.bgElevated, borderWidth: 1, borderColor: DS.border },
  missingRowStatic:{ backgroundColor: 'transparent', borderColor: 'transparent', paddingHorizontal: 0 },
  missingField:    { fontSize: 12, fontWeight: '700', color: DS.textPrimary },
  missingImpact:   { fontSize: 11, color: DS.textMuted, lineHeight: 14 },
  missingNav:      { fontSize: 11, fontWeight: '700', color: DS.accent },

  actionRow:       { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  actionNum:       { width: 20, height: 20, borderRadius: 10, backgroundColor: DS.accent + '20', alignItems: 'center', justifyContent: 'center', marginTop: 1 },
  actionNumTxt:    { fontSize: 9, fontWeight: '900', color: DS.accent },
  actionTxt:       { fontSize: 12, fontWeight: '700', color: DS.textPrimary, lineHeight: 16, flex: 1 },
  actionWhy:       { fontSize: 11, color: DS.textSecondary, lineHeight: 15, flex: 1 },
});

const is = StyleSheet.create({
  intelStrip:        { flexDirection: 'row', backgroundColor: DS.bgCard, borderRadius: DS.radiusCard, borderWidth: 1, borderColor: DS.border, padding: 14 },
  intelStripItem:    { flex: 1, gap: 4 },
  intelStripDivider: { width: 1, backgroundColor: DS.border, marginHorizontal: 12 },
  intelStripLbl:     { fontSize: 9, fontWeight: '800', color: DS.textMuted, letterSpacing: 1.2, textTransform: 'uppercase' },
  intelChip:         { alignSelf: 'flex-start' as const, paddingHorizontal: 8, paddingVertical: 3, borderRadius: DS.radiusBadge },
  intelChipTxt:      { fontSize: 10, fontWeight: '800' },
  intelNote:         { fontSize: 10, color: DS.textMuted, lineHeight: 13 },
});

const qes = StyleSheet.create({
  overlay:   { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)' },
  sheet: {
    backgroundColor: DS.bgCard,
    borderTopLeftRadius:  24,
    borderTopRightRadius: 24,
    padding: DS.cardPadding,
    paddingBottom: 36,
    gap: 14,
  },
  handle:    { width: 36, height: 4, borderRadius: 2, backgroundColor: DS.border, alignSelf: 'center' as const, marginBottom: 4 },
  title:     { fontSize: 16, fontWeight: '900', color: DS.textPrimary, letterSpacing: -0.3 },
  sub:       { fontSize: 12, color: DS.textSecondary, lineHeight: 17, marginTop: -6 },
  fields:    { gap: 12 },
  fieldWrap: { gap: 4 },
  fieldLbl:  { fontSize: 11, fontWeight: '700', color: DS.textSecondary },
  input: {
    backgroundColor:   DS.bgElevated,
    borderRadius:      DS.radiusInput,
    borderWidth:       1,
    borderColor:       DS.border,
    paddingHorizontal: 12,
    paddingVertical:   10,
    fontSize:          15,
    color:             DS.textPrimary,
  },
  btnRow:    { flexDirection: 'row', gap: 10, marginTop: 4 },
  cancelBtn: { flex: 1, paddingVertical: 13, borderRadius: DS.radiusButton, backgroundColor: DS.bgElevated, alignItems: 'center' as const },
  cancelTxt: { fontSize: 14, fontWeight: '700', color: DS.textSecondary },
  saveBtn:   { flex: 2, paddingVertical: 13, borderRadius: DS.radiusButton, backgroundColor: DS.accent, alignItems: 'center' as const },
  saveTxt:   { fontSize: 14, fontWeight: '800', color: '#FFFFFF' },
});
