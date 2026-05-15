// ─── Smart Search Intelligence ────────────────────────────────────────────────
// Pure utility — no React, no API calls inside here.
// ResearchWorkspaceScreen calls these helpers and owns the API orchestration.

import { Tier } from '../hooks/useSubscription';
import { Product, Supplier } from '../services/api';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface SmartSearchSummary {
  originalQuery:    string;
  expandedKeywords: string[];
  totalScanned:     number;
  duplicatesRemoved: number;
  finalCount:       number;
  topCategory:      string;
}

export interface ProductScores {
  relevanceScore:    number;
  opportunityScore:  number;
  completenessScore: number;
  finalScore:        number;
  badges:            string[];
  matchReason:       string;
}

export interface SupplierScores {
  relevanceScore:    number;
  opportunityScore:  number;
  completenessScore: number;
  finalScore:        number;
  badges:            string[];
  matchReason:       string;
}

// ─── Tier limits ──────────────────────────────────────────────────────────────

const KEYWORD_LIMITS: Record<Tier, number> = {
  explorer: 3,
  builder:  5,
  operator: 8,
};

// ─── Stop words ───────────────────────────────────────────────────────────────

const STOP_WORDS = new Set([
  'the', 'and', 'for', 'with', 'that', 'this', 'from', 'has', 'have', 'are',
  'was', 'were', 'you', 'your', 'our', 'their', 'will', 'can', 'all', 'also',
  'more', 'very', 'just', 'how', 'new', 'high', 'best', 'top', 'set', 'kit',
]);

// ─── Synonym / expansion maps ─────────────────────────────────────────────────

const SYNONYM_MAP: Record<string, string[]> = {
  'garlic press':      ['garlic crusher', 'garlic mincer', 'garlic chopper'],
  'water bottle':      ['hydration bottle', 'insulated water bottle', 'reusable bottle'],
  'phone case':        ['phone cover', 'mobile case', 'smartphone protector'],
  'laptop stand':      ['laptop riser', 'notebook stand', 'computer desk stand'],
  'yoga mat':          ['exercise mat', 'gym mat', 'fitness mat'],
  'coffee mug':        ['coffee cup', 'travel mug', 'insulated mug'],
  'cutting board':     ['chopping board', 'kitchen board', 'food prep board'],
  'knife sharpener':   ['blade sharpener', 'knife honer', 'kitchen sharpener'],
  'can opener':        ['tin opener', 'manual can opener', 'electric can opener'],
  'storage container': ['food storage', 'meal prep container', 'airtight container'],
  'door mat':          ['entrance mat', 'welcome mat', 'outdoor mat'],
  'shower curtain':    ['bath curtain', 'waterproof shower liner', 'bathroom curtain'],
  'desk organizer':    ['office organizer', 'pen holder', 'desk caddy'],
  'ring light':        ['selfie light', 'led ring light', 'video light'],
  'resistance band':   ['exercise band', 'workout band', 'stretch band'],
  'foam roller':       ['muscle roller', 'massage roller', 'recovery roller'],
  'air fryer':         ['hot air fryer', 'electric fryer', 'oil free fryer'],
};

const MATERIAL_PREFIXES = [
  'stainless steel', 'silicone', 'bamboo', 'aluminum', 'ceramic',
  'wood', 'plastic', 'rubber', 'glass', 'copper',
];

const QUALITY_PREFIXES = [
  'heavy duty', 'ergonomic', 'professional', 'premium', 'commercial grade',
];

const SUPPLIER_SUFFIXES = [
  'manufacturer', 'factory', 'OEM supplier', 'wholesale',
  'private label', 'custom packaging', 'bulk supplier',
];

// Words that appear in Amazon product titles but pollute supplier queries
const AMAZON_NOISE_WORDS = new Set([
  'professional', 'premium', 'ergonomic', 'commercial', 'grade',
  'seller', 'pack', 'piece', 'count', 'brand', 'genuine',
  'portable', 'durable', 'sturdy', 'lightweight', 'travel',
  'original', 'authentic', 'perfect', 'super', 'ultra',
]);

// ─── Keyword normalisation helpers ────────────────────────────────────────────

function normalise(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, ' ').trim();
}

function coreWords(query: string): string[] {
  return normalise(query).split(' ').filter(w => w.length > 3 && !STOP_WORDS.has(w));
}

// Extracts core product terms from an Amazon title, stripping marketing noise
function extractProductCore(title: string): string {
  return normalise(title)
    .split(' ')
    .filter(w => w.length > 3 && !STOP_WORDS.has(w) && !AMAZON_NOISE_WORDS.has(w))
    .slice(0, 5)
    .join(' ');
}

// ─── Keyword expansion ────────────────────────────────────────────────────────

export function expandProductKeywords(query: string, tier: Tier): string[] {
  const limit = KEYWORD_LIMITS[tier];
  const q     = normalise(query);
  const result: string[] = [q]; // original always first

  // 1. Exact synonyms from map
  for (const [key, syns] of Object.entries(SYNONYM_MAP)) {
    if (q.includes(key)) {
      result.push(...syns);
      break;
    }
  }

  // 2. Material prefix variations (pick the two most common)
  const hasMaterial = MATERIAL_PREFIXES.some(m => q.includes(m));
  if (!hasMaterial) {
    result.push(`stainless steel ${q}`, `silicone ${q}`);
  }

  // 3. Quality prefix variations
  const hasQuality = QUALITY_PREFIXES.some(p => q.includes(p));
  if (!hasQuality) {
    result.push(`ergonomic ${q}`, `heavy duty ${q}`);
  }

  // 4. Bundle/set
  if (!q.includes('set') && !q.includes('bundle')) {
    result.push(`${q} set`);
  }

  // Deduplicate, filter empties, enforce limit
  const seen = new Set<string>();
  return result
    .map(k => normalise(k))
    .filter(k => { if (k && !seen.has(k)) { seen.add(k); return true; } return false; })
    .slice(0, limit);
}

export function buildSupplierQueries(
  rawQuery: string,
  selectedProduct: { name: string } | null,
  tier: Tier,
): string[] {
  const limit     = KEYWORD_LIMITS[tier];
  const queryBase = normalise(rawQuery);

  // When a product is selected, extract its core terms (strips Amazon marketing noise).
  // Falls back to the raw query if the core is too short.
  const productCore = selectedProduct ? extractProductCore(selectedProduct.name) : null;
  const primaryBase = (productCore && productCore.length > 3) ? productCore : queryBase;

  const result: string[] = [];
  for (const suffix of SUPPLIER_SUFFIXES) {
    result.push(`${primaryBase} ${suffix}`);
  }
  result.push(primaryBase); // plain term as fallback

  // When product-derived base differs from the typed query, add a manufacturer
  // and factory variant of the raw query so we cover both search surfaces.
  if (productCore && productCore !== queryBase) {
    result.push(`${queryBase} manufacturer`);
    result.push(`${queryBase} factory`);
  }

  const seen = new Set<string>();
  return result
    .map(k => normalise(k))
    .filter(k => { if (k && !seen.has(k)) { seen.add(k); return true; } return false; })
    .slice(0, limit);
}

// ─── Deduplication ────────────────────────────────────────────────────────────

function jaccardWords(a: string, b: string): number {
  const wa = new Set(normalise(a).split(' ').filter(w => w.length > 3));
  const wb = new Set(normalise(b).split(' ').filter(w => w.length > 3));
  const inter = [...wa].filter(w => wb.has(w)).length;
  const union = new Set([...wa, ...wb]).size;
  return union > 0 ? inter / union : 0;
}

export function deduplicateProducts(products: Product[]): { results: Product[]; removed: number } {
  const seen    = new Map<string, boolean>(); // asin → true
  const kept: Product[] = [];

  for (const p of products) {
    // ASIN match
    if (p.asin && p.asin.length >= 8) {
      if (seen.has(p.asin)) continue;
      seen.set(p.asin, true);
    }
    // Title similarity against already-kept items
    const isDuplicate = kept.some(k => jaccardWords(k.title, p.title) > 0.65);
    if (isDuplicate) continue;
    kept.push(p);
  }

  return { results: kept, removed: products.length - kept.length };
}

export function deduplicateSuppliers(suppliers: Supplier[]): { results: Supplier[]; removed: number } {
  const seenUrls = new Set<string>();
  const kept: Supplier[] = [];

  for (const s of suppliers) {
    // 1. URL exact dedup
    if (s.url) {
      const urlKey = s.url.toLowerCase().replace(/https?:\/\/(www\.)?/, '').split('?')[0];
      if (seenUrls.has(urlKey)) continue;
      seenUrls.add(urlKey);
    }
    // 2. Same name on same platform (catches same listing from multiple keyword queries)
    const isDupSamePlatform = kept.some(
      k => jaccardWords(k.title, s.title) > 0.70 && k.supplier === s.supplier,
    );
    if (isDupSamePlatform) continue;
    // 3. Near-identical name across any platform (aggressive dedup for cross-platform clones)
    const isDupByName = kept.some(k => jaccardWords(k.title, s.title) > 0.85);
    if (isDupByName) continue;
    kept.push(s);
  }

  return { results: kept, removed: suppliers.length - kept.length };
}

// ─── Product scoring ──────────────────────────────────────────────────────────

export function scoreProduct(
  p: Product,
  originalQuery: string,
  expandedKeywords: string[],
): ProductScores {
  const title = normalise(p.title);
  const qWords = coreWords(originalQuery);

  // ── Relevance ─────────────────────────────────────────────────────────────
  let relevance = 0;
  const allQWords = qWords.every(w => title.includes(w));
  const anyQWord  = qWords.some(w => title.includes(w));
  if (allQWords)   relevance += 30;
  else if (anyQWord) relevance += 15;

  const matchesExpanded = expandedKeywords.some(kw =>
    coreWords(kw).some(w => title.includes(w))
  );
  if (matchesExpanded) relevance += 12;

  if (p.competition === 'Low')    relevance += 18;
  else if (p.competition === 'Medium') relevance += 10;
  if (p.opportunity === 'Good')   relevance += 20;
  else if (p.opportunity === 'Moderate') relevance += 10;
  relevance = Math.min(100, relevance);

  // ── Opportunity ───────────────────────────────────────────────────────────
  let opportunity = 0;
  const revEst = p.price && p.review_count
    ? Math.round(p.price * p.review_count * 0.05) : 0;
  if      (revEst > 10000) opportunity += 30;
  else if (revEst > 5000)  opportunity += 22;
  else if (revEst > 2000)  opportunity += 12;
  else if (revEst > 500)   opportunity += 5;

  if      (p.competition === 'Low')    opportunity += 25;
  else if (p.competition === 'Medium') opportunity += 12;

  const rc = p.review_count ?? 0;
  if      (rc >= 10  && rc < 500)  opportunity += 20;
  else if (rc >= 500 && rc < 2000) opportunity += 10;
  else if (rc >= 2000)             opportunity += 3;

  if      ((p.rating ?? 0) >= 4.5) opportunity += 10;
  else if ((p.rating ?? 0) >= 4.0) opportunity += 7;
  else if ((p.rating ?? 0) >= 3.5) opportunity += 3;

  if (p.opportunity === 'Good') opportunity += 15;
  opportunity = Math.min(100, opportunity);

  // ── Completeness ─────────────────────────────────────────────────────────
  let completeness = 0;
  if (p.price    != null) completeness += 25;
  if (p.rating   != null) completeness += 20;
  if (p.review_count != null) completeness += 20;
  if (p.image)            completeness += 20;
  if (p.url)              completeness += 15;
  completeness = Math.min(100, completeness);

  const finalScore = Math.round(
    relevance * 0.45 + opportunity * 0.45 + completeness * 0.10,
  );

  // ── Badges ────────────────────────────────────────────────────────────────
  const badges: string[] = [];
  if (finalScore >= 75)                          badges.push('Smart Pick');
  if (p.competition === 'Low')                   badges.push('Low Competition');
  if (revEst > 5000)                             badges.push('High Demand');
  if (p.competition === 'Low' && rc < 500 && rc >= 10) badges.push('Quick Win');
  if ((p.rating ?? 0) >= 4.5)                    badges.push('Well Rated');

  const matchReason = allQWords
    ? `Exact match for "${originalQuery}"`
    : anyQWord
      ? `Partial match for "${originalQuery}"`
      : `Related to "${originalQuery}"`;

  return { relevanceScore: relevance, opportunityScore: opportunity, completenessScore: completeness, finalScore, badges, matchReason };
}

// ─── Supplier scoring ─────────────────────────────────────────────────────────

export function scoreSupplier(
  s: Supplier,
  originalQuery: string,
): SupplierScores {
  const name   = normalise(s.title);
  const qWords = coreWords(originalQuery);

  // ── Relevance ─────────────────────────────────────────────────────────────
  let relevance = 0;
  if (qWords.every(w => name.includes(w)))  relevance += 30;
  else if (qWords.some(w => name.includes(w))) relevance += 15;
  relevance = Math.min(100, relevance + 40); // suppliers are always contextually relevant

  // ── Opportunity ───────────────────────────────────────────────────────────
  let opportunity = 0;
  const avg = s.price_range.min != null && s.price_range.max != null
    ? (s.price_range.min + s.price_range.max) / 2 : null;
  const moqNum = parseInt(String(s.moq).replace(/\D/g, ''), 10) || 0;

  if      (moqNum <= 50)  opportunity += 30;
  else if (moqNum <= 200) opportunity += 22;
  else if (moqNum <= 500) opportunity += 12;
  else if (moqNum <= 1000) opportunity += 5;

  if (avg != null) {
    if      (avg < 2)  opportunity += 25;
    else if (avg < 5)  opportunity += 18;
    else if (avg < 10) opportunity += 10;
    else if (avg < 20) opportunity += 5;
  }

  // Platform trust bonus
  if (s.supplier === 'Alibaba')       opportunity += 15;
  else if (s.supplier === 'DHgate')   opportunity += 10;
  else if (s.supplier === '1688')     opportunity += 8;
  else                                opportunity += 5;

  opportunity = Math.min(100, opportunity);

  // ── Completeness ─────────────────────────────────────────────────────────
  let completeness = 0;
  if (s.price_display && s.price_display !== '—') completeness += 30;
  if (s.moq)  completeness += 25;
  if (s.url)  completeness += 25;
  if (s.image) completeness += 20;
  completeness = Math.min(100, completeness);

  const finalScore = Math.round(
    relevance * 0.45 + opportunity * 0.45 + completeness * 0.10,
  );

  // ── Badges ────────────────────────────────────────────────────────────────
  const badges: string[] = [];
  if (finalScore >= 75)         badges.push('Smart Pick');
  if (moqNum <= 100)            badges.push('Low MOQ');
  if (avg != null && avg < 3)   badges.push('Great Price');
  if (s.supplier === 'Alibaba') badges.push('Verified');

  // Private Label Friendly: inferred from supplier title or query containing OEM/ODM signals
  const combined = name + ' ' + normalise(originalQuery);
  if (/oem|odm|private.?label|white.?label|custom.?brand/.test(combined)) {
    badges.push('Private Label Friendly');
  }

  const matchReason = qWords.some(w => name.includes(w))
    ? `Matches "${originalQuery}"`
    : `Best sourcing match for "${originalQuery}"`;

  return { relevanceScore: relevance, opportunityScore: opportunity, completenessScore: completeness, finalScore, badges, matchReason };
}

// ─── Top category detector ────────────────────────────────────────────────────

const CATEGORY_PATTERNS: [RegExp, string][] = [
  [/press|crusher|chopper|mincer|slicer|peeler|grater|grinder/i, 'Kitchen Tools'],
  [/bottle|mug|cup|flask|tumbler/i,                              'Drinkware'],
  [/phone|mobile|tablet|laptop|computer|keyboard|mouse/i,        'Electronics'],
  [/yoga|gym|fitness|exercise|workout|dumbbell|resistance/i,     'Sports & Fitness'],
  [/desk|office|organizer|storage|shelf|drawer/i,                'Office & Storage'],
  [/shower|bath|towel|curtain|toilet|sink/i,                     'Bathroom'],
  [/sofa|chair|table|lamp|pillow|curtain|rug|mat/i,              'Home & Decor'],
  [/baby|kids|child|toy|game|puzzle/i,                           'Baby & Kids'],
  [/dog|cat|pet|animal|leash|collar|bowl/i,                      'Pet Supplies'],
  [/skin|hair|beauty|makeup|nail|lotion|serum/i,                 'Beauty & Personal Care'],
];

export function detectCategory(query: string): string {
  for (const [pattern, category] of CATEGORY_PATTERNS) {
    if (pattern.test(query)) return category;
  }
  return 'General Products';
}

// ─── Empty state suggestion ───────────────────────────────────────────────────

// Detects the product type from actual supplier titles (more accurate than query-only detection)
export function detectSupplierType(suppliers: Supplier[]): string {
  if (suppliers.length === 0) return 'General Products';
  const combined = suppliers.map(s => s.title).join(' ');
  for (const [pattern, category] of CATEGORY_PATTERNS) {
    if (pattern.test(combined)) return category;
  }
  return 'General Products';
}

export function buildEmptySuggestion(query: string): string {
  const q = query.trim();
  const words = q.split(' ');
  if (words.length <= 1) {
    return `No strong matches for "${q}". Try a more specific phrase — for example, "stainless steel ${q}" or "${q} for kitchen".`;
  }
  return `No strong matches found. Try narrowing down — for example, add a material like "stainless steel" or a use case like "for home use".`;
}
