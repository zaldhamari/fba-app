import { DS } from '../../components/ds';
import { Product, Supplier, TrendData } from '../../services/api';
import {
  ProductDisplay,
  SupplierDisplay,
  KeywordMetric,
  EnrichedKeyword,
} from './types';

// ── Static mocks (pre-search) ─────────────────────────────────────────────────

export const MOCK_KEYWORD_METRICS: KeywordMetric[] = [
  { label: 'Search Volume', value: '—', icon: '◎', color: DS.textMuted, bg: DS.bgSubtle },
  { label: 'Trend Score',   value: '—', icon: '↗', color: DS.textMuted, bg: DS.bgSubtle },
  { label: 'Trend',         value: '—', icon: '↗', color: DS.textMuted, bg: DS.bgSubtle },
  { label: 'SEO Score',     value: '—', icon: '✦', color: DS.textMuted, bg: DS.bgSubtle },
];

export const MOCK_RELATED_KEYWORDS: EnrichedKeyword[] = [];

export const MOCK_PRODUCTS: ProductDisplay[] = [];

export const MOCK_SUPPLIERS: SupplierDisplay[] = [];

// ── Data converters ───────────────────────────────────────────────────────────

export function productToDisplay(p: Product): ProductDisplay {
  const comp: ProductDisplay['competition'] =
    p.competition === 'High' ? 'High' : p.competition === 'Low' ? 'Low' : 'Medium';
  const badge: ProductDisplay['badge'] =
    p.opportunity === 'Good' ? 'Promising' : p.opportunity === 'Saturated' ? 'Saturated' : 'Moderate';
  const revenueUSD = p.price && p.review_count
    ? Math.round(p.price * p.review_count * 0.05)
    : null;
  return {
    id:          p.asin,
    name:        p.title,
    price:       p.price,
    rating:      p.rating,
    image:       p.image ?? '',
    revenue:     revenueUSD != null ? `~$${revenueUSD.toLocaleString()}/mo` : 'N/A',
    revenueUSD,
    reviews:     p.review_count != null ? `${p.review_count.toLocaleString()} reviews` : 'N/A',
    reviewCount: p.review_count,
    competition: comp,
    badge,
    url:         p.url || undefined,
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
