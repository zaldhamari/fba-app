import { Share } from 'react-native';

// ─── Types ────────────────────────────────────────────────────────────────────

export type KeywordType       = 'Head' | 'Long-tail' | 'Buyer Intent' | 'PPC';
export type CompetitionLevel  = 'Low' | 'Medium' | 'High';
export type ConversionIntent  = 'Low' | 'Medium' | 'High';
export type RankingDifficulty = 'Easy' | 'Medium' | 'Hard';
export type RecommendedUsage  = 'Title' | 'Bullet' | 'Backend' | 'PPC';
export type ClusterType       = 'high_intent' | 'long_tail' | 'ppc' | 'low_competition' | 'backend';

export interface EnrichedKeyword {
  keyword: string;
  type: KeywordType;
  competition: CompetitionLevel;
  opportunity_score: number;
  search_intent: 'Informational' | 'Commercial' | 'Transactional';
  ranking_difficulty: RankingDifficulty;
  conversion_intent: ConversionIntent;
  recommended_usage: RecommendedUsage[];
}

export interface KeywordCluster {
  type: ClusterType;
  name: string;
  description: string;
  keywords: EnrichedKeyword[];
}

export interface ListingRecommendations {
  title: string;
  ppc: string;
  backend: string;
  long_tail: string;
  buyer_intent: string;
}

export interface EnrichedKeywordResult {
  total_found: number;
  seo_score: number;
  seo_score_reason: string;
  top_ppc: string[];
  keywords: EnrichedKeyword[];
  clusters: KeywordCluster[];
  insights: string[];
  recommendations: ListingRecommendations;
}

// ─── Word lists for deterministic classification ──────────────────────────────

const BUYER_WORDS     = ['buy', 'purchase', 'order', 'best', 'top', 'review', 'cheap', 'discount', 'deal', 'sale', 'vs', 'compare', 'gift', 'premium', 'professional', 'quality'];
const HIGH_CONV_WORDS = ['buy', 'purchase', 'order', 'cheap', 'discount', 'deal', 'sale', 'price', 'coupon', 'promo'];
const MED_CONV_WORDS  = ['best', 'top', 'review', 'vs', 'compare', 'professional', 'premium', 'quality', 'rated', 'recommended'];

// Deterministic variation from keyword text — no Math.random()
function strHash(s: string): number {
  return s.split('').reduce((h, c) => (h * 31 + c.charCodeAt(0)) & 0xffff, 0);
}

// ─── Single keyword enrichment ────────────────────────────────────────────────

function enrichOne(
  raw: { keyword: string; competition: string; type: string },
  topPpc: string[],
): EnrichedKeyword {
  const kw      = raw.keyword.toLowerCase().trim();
  const words   = kw.split(/\s+/).length;
  const inPpc   = topPpc.map(p => p.toLowerCase()).includes(kw);
  const hasBuyer     = BUYER_WORDS.some(w => kw.includes(w));
  const hasHighConv  = HIGH_CONV_WORDS.some(w => kw.includes(w));
  const hasMedConv   = MED_CONV_WORDS.some(w => kw.includes(w));

  const comp: CompetitionLevel =
    raw.competition === 'Low' || raw.competition === 'Medium' || raw.competition === 'High'
      ? (raw.competition as CompetitionLevel) : 'Medium';

  // ── Keyword type
  let type: KeywordType = 'Head';
  if (inPpc)          type = 'PPC';
  else if (words >= 3) type = 'Long-tail';
  else if (hasBuyer)   type = 'Buyer Intent';

  // ── Conversion intent
  const conversion_intent: ConversionIntent = hasHighConv ? 'High'
    : (hasMedConv || words >= 3) ? 'Medium' : 'Low';

  // ── Search intent
  const search_intent: EnrichedKeyword['search_intent'] = hasHighConv ? 'Transactional'
    : (hasMedConv || hasBuyer) ? 'Commercial'
    : 'Informational';

  // ── Ranking difficulty
  const ranking_difficulty: RankingDifficulty =
    comp === 'High' ? 'Hard' : comp === 'Medium' ? 'Medium' : 'Easy';

  // ── Opportunity score — deterministic, believable, not random
  const compBase  = comp === 'Low' ? 72 : comp === 'Medium' ? 51 : 27;
  const wordBonus = Math.min(14, (words - 1) * 5);
  const intentBonus = hasBuyer ? 8 : 0;
  const ppcBonus  = inPpc ? 6 : 0;
  const variation = (strHash(kw) % 13) - 6; // ±6 consistent per keyword
  const opportunity_score = Math.min(96, Math.max(18, compBase + wordBonus + intentBonus + ppcBonus + variation));

  // ── Recommended usage
  const recommended_usage: RecommendedUsage[] = [];
  if (words <= 3 && comp !== 'High' && !inPpc) recommended_usage.push('Title');
  if (words >= 2 && hasBuyer)                  recommended_usage.push('Bullet');
  if (inPpc || comp === 'High' || hasBuyer)    recommended_usage.push('PPC');
  if (words >= 3)                              recommended_usage.push('Backend');
  if (recommended_usage.length === 0)          recommended_usage.push('Backend');

  return {
    keyword: raw.keyword,
    type, competition: comp, opportunity_score,
    search_intent, ranking_difficulty, conversion_intent,
    recommended_usage,
  };
}

// ─── Clustering ───────────────────────────────────────────────────────────────

function buildClusters(keywords: EnrichedKeyword[]): KeywordCluster[] {
  const highIntent   = keywords.filter(k => k.conversion_intent === 'High' || k.type === 'Buyer Intent');
  const longTail     = keywords.filter(k => k.type === 'Long-tail' && k.competition !== 'High');
  const ppcTargets   = keywords.filter(k => k.recommended_usage.includes('PPC'))
                                .sort((a, b) => b.opportunity_score - a.opportunity_score)
                                .slice(0, 8);
  const lowComp      = keywords.filter(k => k.competition === 'Low' && !highIntent.includes(k));
  const hiSet        = new Set([...highIntent, ...longTail]);
  const backendTerms = keywords.filter(k =>
    k.recommended_usage.includes('Backend') && !hiSet.has(k)
  ).slice(0, 7);

  const defs: Array<[ClusterType, string, string, EnrichedKeyword[]]> = [
    ['high_intent',    'High Intent Buyers',        'Shoppers ready to purchase — highest conversion potential', highIntent],
    ['long_tail',      'Long-tail Opportunities',   'Specific searches with lower competition — rank faster',    longTail],
    ['ppc',            'PPC Targets',               'Best candidates for sponsored ads — maximise ad efficiency', ppcTargets],
    ['low_competition','Low Competition',            'Open ranking windows — target these first for organic wins', lowComp],
    ['backend',        'Backend Search Terms',       'Hidden from buyers but indexed — free additional rankings',  backendTerms],
  ];

  return defs
    .filter(([, , , kws]) => kws.length > 0)
    .map(([type, name, description, kws]) => ({ type, name, description, keywords: kws }));
}

// ─── SEO score ────────────────────────────────────────────────────────────────

function computeSeoScore(
  keywords: EnrichedKeyword[],
  apiScore: number,
): { score: number; reason: string } {
  if (keywords.length === 0) return { score: apiScore, reason: 'No keywords to evaluate.' };

  const total       = keywords.length;
  const lowComp     = keywords.filter(k => k.competition === 'Low').length;
  const medComp     = keywords.filter(k => k.competition === 'Medium').length;
  const highIntent  = keywords.filter(k => k.conversion_intent !== 'Low').length;
  const longTail    = keywords.filter(k => k.type === 'Long-tail').length;
  const buyerIntent = keywords.filter(k => k.type === 'Buyer Intent').length;
  const typeCount   = new Set(keywords.map(k => k.type)).size;

  const diversityScore  = Math.min(100, (typeCount / 4) * 100 * 1.6);
  const compScore       = (((lowComp * 1.4) + (medComp * 0.7)) / total) * 100;
  const intentScore     = (highIntent / total) * 100;
  const longTailScore   = (longTail / total) * 100;
  const buyerScore      = Math.min(100, buyerIntent * 18);

  const local = Math.round(
    diversityScore * 0.15 +
    compScore      * 0.28 +
    intentScore    * 0.27 +
    longTailScore  * 0.20 +
    buyerScore     * 0.10,
  );

  // Blend with API score so we don't diverge wildly from server-side reasoning
  const score = Math.min(95, Math.max(22, Math.round(local * 0.65 + apiScore * 0.35)));

  const reason =
    score >= 78 ? 'Strong keyword diversity with low-competition buyer-intent coverage.'
    : score >= 62 ? 'Good keyword mix — solid balance of intent and competition levels.'
    : score >= 48 ? 'Moderate coverage — more long-tail terms would improve this score.'
    :               'Narrow keyword spread — competition elevated across most terms.';

  return { score, reason };
}

// ─── Insights ─────────────────────────────────────────────────────────────────

function generateInsights(keywords: EnrichedKeyword[], score: number): string[] {
  const total      = keywords.length;
  if (total === 0) return [];

  const lowComp    = keywords.filter(k => k.competition === 'Low').length;
  const highComp   = keywords.filter(k => k.competition === 'High').length;
  const highIntent = keywords.filter(k => k.conversion_intent === 'High').length;
  const longTail   = keywords.filter(k => k.type === 'Long-tail').length;
  const buyerInt   = keywords.filter(k => k.type === 'Buyer Intent').length;

  const all: string[] = [];

  if (longTail / total > 0.4)          all.push('Strong long-tail opportunity — ideal for early organic ranking wins');
  if (highComp / total > 0.5)          all.push('Highly competitive niche — expect elevated PPC costs across this market');
  if (lowComp / total > 0.3)           all.push(`${lowComp} low-competition keywords found — prioritise these for organic rank`);
  if (highIntent >= 3)                 all.push(`${highIntent} high buyer-intent terms found — add to PPC and bullets immediately`);
  if (longTail > 5)                    all.push('Good backend keyword potential — long-tails provide free hidden indexing');
  if (buyerInt >= 2)                   all.push('Buyer-intent keywords detected — these convert above average on Amazon');
  if (score >= 72)                     all.push('Strong keyword diversity — solid foundation for a full listing strategy');
  if (score < 48)                      all.push('Narrow coverage — try a broader product term to surface more opportunities');
  if (highComp / total < 0.25 && longTail > 3)
                                       all.push('Low-competition buyer terms found — good launch timing for this niche');

  return all.slice(0, 4);
}

// ─── Listing recommendations ──────────────────────────────────────────────────

function getRecommendations(keywords: EnrichedKeyword[]): ListingRecommendations {
  const byScore = [...keywords].sort((a, b) => b.opportunity_score - a.opportunity_score);

  const title = byScore.find(k => k.recommended_usage.includes('Title') && k.competition !== 'High')?.keyword
    ?? byScore[0]?.keyword ?? '';

  const ppc = keywords.filter(k => k.recommended_usage.includes('PPC'))
    .sort((a, b) => (b.conversion_intent === 'High' ? 1 : 0) - (a.conversion_intent === 'High' ? 1 : 0))[0]?.keyword ?? '';

  const backend = keywords.filter(k => k.recommended_usage.includes('Backend'))
    .sort((a, b) => b.opportunity_score - a.opportunity_score)[0]?.keyword ?? '';

  const long_tail = keywords.filter(k => k.type === 'Long-tail')
    .sort((a, b) => b.opportunity_score - a.opportunity_score)[0]?.keyword ?? '';

  const buyer_intent = keywords.filter(k => k.type === 'Buyer Intent' || k.conversion_intent === 'High')
    .sort((a, b) => b.opportunity_score - a.opportunity_score)[0]?.keyword ?? '';

  return { title, ppc, backend, long_tail, buyer_intent };
}

// ─── Public enrichment entry point ───────────────────────────────────────────

export function enrichKeywords(raw: {
  keywords: { keyword: string; competition: string; type: string }[];
  head_terms: string[];
  long_tail: string[];
  total_found: number;
  seo_score: number;
  top_ppc: string[];
}): EnrichedKeywordResult {
  const enriched       = raw.keywords.map(k => enrichOne(k, raw.top_ppc));
  const clusters       = buildClusters(enriched);
  const { score, reason } = computeSeoScore(enriched, raw.seo_score);
  const insights       = generateInsights(enriched, score);
  const recommendations = getRecommendations(enriched);

  return {
    total_found: raw.total_found,
    seo_score: score,
    seo_score_reason: reason,
    top_ppc: raw.top_ppc,
    keywords: enriched,
    clusters,
    insights,
    recommendations,
  };
}

// ─── CSV export ───────────────────────────────────────────────────────────────

export async function exportKeywordsCSV(
  keywords: EnrichedKeyword[],
  query: string,
  marketplace: string,
): Promise<void> {
  if (keywords.length === 0) return;

  const date = new Date().toISOString().slice(0, 10);
  const header = [
    'Keyword', 'Type', 'Competition', 'Opportunity Score',
    'Ranking Difficulty', 'Buyer Intent', 'Recommended Usage',
    'Marketplace', 'Product Query', 'Date',
  ].join(',');

  const rows = keywords.map(k => [
    `"${k.keyword.replace(/"/g, '""')}"`,
    k.type,
    k.competition,
    k.opportunity_score,
    k.ranking_difficulty,
    k.conversion_intent,
    `"${k.recommended_usage.join(' / ')}"`,
    marketplace,
    `"${query.replace(/"/g, '""')}"`,
    date,
  ].join(','));

  const csv = [header, ...rows].join('\n');
  await Share.share({ message: csv, title: `Siftly SEO — ${query}` });
}
