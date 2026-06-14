import { DS } from '../../components/ds';
import { Product, Supplier, TrendData } from '../../services/api';
import {
  monthlySalesEst,
  estimateMonthlySales,
  estimatePPCPressure,
} from '../../lib/financialEngine';
import {
  ProductDisplay,
  SupplierDisplay,
  KeywordMetric,
  EnrichedKeyword,
} from './types';

// ── Data converters ───────────────────────────────────────────────────────────

export function productToDisplay(p: Product): ProductDisplay {
  const comp: ProductDisplay['competition'] =
    p.competition === 'High' ? 'High' : p.competition === 'Low' ? 'Low' : 'Medium';
  const badge: ProductDisplay['badge'] =
    p.opportunity === 'Good' ? 'Promising' : p.opportunity === 'Saturated' ? 'Saturated' : 'Moderate';

  // Sales estimation — uses review-rate model; label as directional in UI
  const salesEst = (p.review_count && p.review_count > 0 && p.price && p.price > 0)
    ? estimateMonthlySales(p.review_count, comp, p.price)
    : null;

  const revenueUSD = salesEst && p.price
    ? Math.round(salesEst.mid * p.price)
    : null;

  const ppcPressure = (p.review_count != null)
    ? estimatePPCPressure(p.review_count, comp)
    : undefined;

  return {
    id:              p.asin,
    name:            p.title,
    price:           p.price,
    rating:          p.rating,
    image:           p.image ?? '',
    revenue:         revenueUSD != null ? `~$${revenueUSD.toLocaleString()}/mo` : 'N/A',
    revenueUSD,
    monthlySalesEst: monthlySalesEst(revenueUSD, p.price),
    reviews:         p.review_count != null ? `${p.review_count.toLocaleString()} reviews` : 'N/A',
    reviewCount:     p.review_count,
    competition:     comp,
    badge,
    url:             p.url || undefined,
    // Sales estimates
    salesEstLow:     salesEst?.low,
    salesEstHigh:    salesEst?.high,
    salesEstMonthly: salesEst?.monthlyLabel,
    salesEstDaily:   salesEst?.dailyLabel,
    salesConfidence: salesEst?.confidence,
    ppcPressure,
    revenueEstLow:   salesEst?.revenueEstLow,
    revenueEstHigh:  salesEst?.revenueEstHigh,
  };
}

export function supplierToDisplay(s: Supplier, idx: number): SupplierDisplay {
  const hasRange = s.price_range.min != null && s.price_range.max != null;
  const max  = hasRange ? s.price_range.max! : null;
  const min  = hasRange ? s.price_range.min! : null;
  const avg  = hasRange ? (min! + max!) / 2 : null;
  // Use the high end of the range as our working price — conservative default protects the user
  const conservativePrice = max ?? avg;
  const trust = conservativePrice != null ? Math.min(9.9, Math.max(6.0, 10 - conservativePrice * 0.3)) : 8.0;
  const moqNum = parseInt(String(s.moq).replace(/\D/g, ''), 10) || 0;
  const wideRange = hasRange && (max! - min!) > min! * 0.5; // range > 50% of min = wide
  return {
    id:            String(idx),
    name:          s.title,
    platform:      s.supplier || 'Alibaba',
    badge:         'Verified',
    moq:           `${s.moq} units`,
    moqNum,
    price:         wideRange ? `$${min!.toFixed(2)}–$${max!.toFixed(2)}` : s.price_display,
    priceUSD:      conservativePrice,
    priceMin:      min,
    priceMax:      max,
    wideRange,
    trust:         Math.round(trust * 10) / 10,
    country:       '🇨🇳',
    url:           s.url || undefined,
  };
}

export function displayToProduct(p: ProductDisplay): Product {
  return {
    title:        p.name,
    price:        p.price,
    rating:       p.rating,
    review_count: p.reviewCount,
    asin:         p.id,
    image:        p.image,
    competition:  p.competition as Product['competition'],
    opportunity:  p.badge === 'Promising' ? 'Good' : p.badge === 'Saturated' ? 'Saturated' : 'Moderate',
    url:          p.url ?? '',
  };
}

export function emptyProductDisplay(): Partial<ProductDisplay> {
  return { monthlySalesEst: null };
}

export function productToPipelinePayload(item: ProductDisplay) {
  return {
    title:           item.name,
    asin:            item.id,
    price:           item.price ?? 0,
    reviews:         item.reviewCount ?? 0,
    rating:          item.rating ?? 0,
    url:             item.url,
    competition:     item.competition,
    salesEstLow:     item.salesEstLow,
    salesEstHigh:    item.salesEstHigh,
    salesEstDaily:   item.salesEstDaily,
    salesConfidence: item.salesConfidence,
    ppcPressure:     item.ppcPressure,
    revenueEstLow:   item.revenueEstLow,
    revenueEstHigh:  item.revenueEstHigh,
  };
}

export function trendsToMetrics(kw: string, trends: TrendData, totalFound: number, seoScore: number): KeywordMetric[] {
  const trendLabel = trends.trend_direction === 'Rising'   ? 'Rising ↑'
    : trends.trend_direction === 'Declining' ? 'Declining ↓' : 'Stable →';
  const trendColor = trends.trend_direction === 'Rising'   ? DS.accent
    : trends.trend_direction === 'Declining' ? DS.danger    : DS.textSecondary;
  const trendBg    = trends.trend_direction === 'Rising'   ? DS.accentLight
    : trends.trend_direction === 'Declining' ? DS.dangerBg  : DS.bgSubtle;
  return [
    { label: 'Search Volume', value: totalFound > 0 ? totalFound.toLocaleString() : '—',                    icon: '◎', color: DS.info,   bg: DS.infoBg },
    { label: 'Trend Score',   value: trends.interest_score != null ? `${trends.interest_score}/100` : '—',  icon: '↗', color: trendColor, bg: trendBg  },
    { label: 'Trend',         value: trendLabel,                                                             icon: '↗', color: trendColor, bg: trendBg  },
    { label: 'SEO Score',     value: `${seoScore}/10`,                                                       icon: '✦', color: DS.indigo,  bg: DS.indigoLight },
  ];
}

// ── Keyword enrichment ────────────────────────────────────────────────────────

export function enrichKeywords(
  kwRes: {
    keywords:   { keyword: string; competition: string; type: string }[];
    head_terms: string[];
    long_tail:  string[];
    total_found: number;
    seo_score:  number;
    top_ppc:    string[];
  },
  trend:       TrendData,
  sourceQuery: string,
): EnrichedKeyword[] {
  const ppcSet  = new Set(kwRes.top_ppc.map(k => k.toLowerCase()));
  const headSet = new Set(kwRes.head_terms.map(k => k.toLowerCase()));
  const trendDir: 'Rising' | 'Stable' | 'Declining' =
    trend.trend_direction === 'Rising'   ? 'Rising'
    : trend.trend_direction === 'Declining' ? 'Declining'
    : 'Stable';

  const raw: { keyword: string; competition: string; type: string }[] =
    kwRes.keywords.length > 0
      ? kwRes.keywords
      : [
          ...kwRes.head_terms.map(k => ({ keyword: k, competition: 'Medium', type: 'head_term' })),
          ...kwRes.long_tail.map(k =>  ({ keyword: k, competition: 'Low',    type: 'long_tail' })),
        ];

  return raw.slice(0, 10).map((k, idx) => {
    const lower    = k.keyword.toLowerCase();
    const isPPC    = ppcSet.has(lower);
    const isHead   = headSet.has(lower) || k.type === 'head_term';
    const wordCount = lower.split(/\s+/).length;

    let keywordType: EnrichedKeyword['keywordType'];
    if (isPPC)           keywordType = 'PPC Candidate';
    else if (isHead || wordCount <= 2) keywordType = 'Head Term';
    else if (wordCount >= 4)           keywordType = 'Long-tail';
    else                               keywordType = 'Long-tail';

    const positionPenalty = idx * 0.4;
    const typeBonus       = isHead ? 0.5 : isPPC ? 0.3 : 0;
    const seoScore        = Math.round(
      Math.min(10, Math.max(3, kwRes.seo_score - positionPenalty + typeBonus)) * 10,
    ) / 10;

    let usageHint: EnrichedKeyword['usageHint'];
    if (keywordType === 'PPC Candidate') usageHint = 'PPC test candidate';
    else if (idx === 0 || (isHead && idx < 3)) usageHint = 'Title candidate';
    else if (idx < 6) usageHint = 'Bullet candidate';
    else              usageHint = 'Backend keyword';

    const volEstimate = kwRes.total_found > 0
      ? Math.round(kwRes.total_found * Math.pow(0.7, idx))
      : 0;
    const searchVolume = volEstimate > 0 ? `est. ${volEstimate.toLocaleString()}` : '—';

    return { phrase: k.keyword, seoScore, searchVolume, trend: trendDir, keywordType, usageHint, sourceQuery };
  });
}

export function csvEscape(val: string | number | undefined): string {
  const s = String(val ?? '');
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export function buildKeywordCSV(keywords: EnrichedKeyword[]): string {
  const header = ['keyword', 'seoScore', 'searchVolume', 'trend', 'keywordType', 'usageHint', 'sourceQuery', 'savedAt'];
  const rows = keywords.map(k => [
    csvEscape(k.phrase),
    csvEscape(k.seoScore),
    csvEscape(k.searchVolume),
    csvEscape(k.trend),
    csvEscape(k.keywordType),
    csvEscape(k.usageHint),
    csvEscape(k.sourceQuery),
    csvEscape(k.savedAt ?? ''),
  ].join(','));
  return [header.join(','), ...rows].join('\n');
}

// ── Input type detection ──────────────────────────────────────────────────────

export const REAL_ASIN_RE = /^B[A-Z0-9]{9}$/;

export function isASIN(input: string): boolean {
  return /^[A-Z0-9]{10}$/.test(input.trim().toUpperCase());
}

export function isAmazonProductURL(input: string): boolean {
  return /amazon\.(com|co\.uk|de|ca|co\.jp|com\.au|in|fr|es|it)/i.test(input) &&
    (/\/dp\/[A-Z0-9]{10}/i.test(input) || /\/gp\/product\/[A-Z0-9]{10}/i.test(input));
}

export function isLikelyBroadKeyword(input: string): boolean {
  const t = input.trim();
  return !isASIN(t) && !isAmazonProductURL(t);
}

export function hasEnoughDataForCompare(p: ProductDisplay): boolean {
  const isMock = p.id === '1' || p.id === '2' || p.id === '3';
  if (isMock) return false;
  return !!p.name && (p.price != null || p.reviewCount != null);
}

// ── Opportunity signals ────────────────────────────────────────────────────────

export type SignalType = 'positive' | 'warning' | 'neutral';

export interface OpportunitySignal {
  label:  string;
  detail: string;
  type:   SignalType;
}

export function buildOpportunitySignals(item: ProductDisplay): OpportunitySignal[] {
  const signals: OpportunitySignal[] = [];
  const rc   = item.reviewCount ?? 0;
  const comp = item.competition;
  const ppc  = item.ppcPressure;
  const price = item.price ?? 0;

  // Review moat signals
  if (rc > 500 && comp === 'High') {
    signals.push({
      label:  'High review moat',
      detail: 'Incumbents have 500+ reviews — ranking requires sustained PPC spend to break through',
      type:   'warning',
    });
  } else if (rc < 100 && comp === 'Low') {
    signals.push({
      label:  'Underserved niche',
      detail: 'Low review counts with low competition — early mover advantage possible',
      type:   'positive',
    });
  } else if (rc > 300 && comp !== 'Low') {
    signals.push({
      label:  'Moderate review barrier',
      detail: 'Established sellers present — differentiate on design or target a sub-niche',
      type:   'warning',
    });
  }

  // PPC pressure signal
  if (ppc === 'High') {
    signals.push({
      label:  'High PPC risk',
      detail: 'Competitive keywords likely require aggressive ad spend — budget for $500–$1,500+ launch PPC',
      type:   'warning',
    });
  } else if (ppc === 'Low') {
    signals.push({
      label:  'Low PPC pressure',
      detail: 'Organic ranking is more achievable — lower launch capital required for initial traction',
      type:   'positive',
    });
  }

  // Review velocity — assumed 24-month average market age for directional estimate
  if (rc > 0) {
    const vel = Math.round(rc / 24);
    if (vel > 20) {
      signals.push({
        label:  `~${vel}/mo review velocity`,
        detail: 'Fast-growing niche — accumulate reviews quickly or competitors will outpace you',
        type:   'warning',
      });
    } else if (vel >= 5) {
      signals.push({
        label:  `~${vel}/mo review velocity`,
        detail: 'Moderate review growth — achievable with a focused launch strategy',
        type:   'neutral',
      });
    } else {
      signals.push({
        label:  `~${vel}/mo review velocity`,
        detail: 'Slow review accumulation — easier to catch up to incumbents',
        type:   'positive',
      });
    }
  }

  // Price band viability
  if (price > 0 && price < 12) {
    signals.push({
      label:  'Low price point risk',
      detail: 'Under $12 — FBA fees and any PPC spend may eliminate all margin',
      type:   'warning',
    });
  } else if (price >= 25 && price <= 60 && comp !== 'High') {
    signals.push({
      label:  'Strong price band',
      detail: '$25–$60 is the FBA sweet spot — solid margin buffer after fees and PPC',
      type:   'positive',
    });
  }

  // Saturation signal
  if (item.badge === 'Saturated' && rc > 200) {
    signals.push({
      label:  'Saturated market',
      detail: 'Meaningful product improvement or unique positioning required to compete profitably',
      type:   'warning',
    });
  }

  return signals.slice(0, 4);
}
