import type { KeepaSignals } from '../../services/api';
export type { KeepaSignals };

// ── Display types ─────────────────────────────────────────────────────────────

export type Mode = 'market' | 'lookup' | 'suppliers' | 'freight';

export interface ProductDisplay {
  id: string;
  name: string;
  price: number | null;
  rating: number | null;
  image: string;
  revenue: string;
  revenueUSD: number | null;
  monthlySalesEst: number | null;
  reviews: string;
  reviewCount: number | null;
  competition: 'Low' | 'Medium' | 'High';
  badge: 'Promising' | 'Moderate' | 'Saturated';
  url?: string;
  // Sales estimates (directional, review-model based)
  salesEstLow?:      number;
  salesEstHigh?:     number;
  salesEstMonthly?:  string;   // "~120–280/mo"
  salesEstDaily?:    string;   // "~4–9/day"
  salesConfidence?:  'Low' | 'Medium';
  ppcPressure?:      'Low' | 'Medium' | 'High';
  revenueEstLow?:    number;
  revenueEstHigh?:   number;
  // Smart search scores
  relevanceScore?:    number;
  opportunityScore?:  number;
  finalScore?:        number;
  badges?:            string[];
  matchReason?:       string;
}

export interface SupplierDisplay {
  id: string;
  name: string;
  platform: string;
  badge: string;
  moq: string;
  moqNum: number;
  price: string;
  priceUSD: number | null;
  priceMin?: number | null;
  priceMax?: number | null;
  wideRange?: boolean;
  // Smart search scores
  relevanceScore?:    number;
  opportunityScore?:  number;
  finalScore?:        number;
  badges?:            string[];
  matchReason?:       string;
  trust: number;
  country: string;
  url?: string;
}

export interface KeywordMetric { label: string; value: string; icon: string; color: string; bg: string; }

export interface EnrichedKeyword {
  phrase:       string;
  seoScore:     number;
  searchVolume: string;
  trend:        'Rising' | 'Stable' | 'Declining';
  keywordType:  'Head Term' | 'Long-tail' | 'Backend' | 'PPC Candidate';
  usageHint:    'Title candidate' | 'Bullet candidate' | 'Backend keyword' | 'PPC test candidate';
  sourceQuery:  string;
  savedAt?:     string;
}

export interface AnalyzeProductResult {
  verdict:    'LAUNCH' | 'TEST' | 'AVOID';
  confidence: number;
  summary:    string;
  reasons:    string[];
  risk:       string;
  next_step:  string;
  signals?:   KeepaSignals;
}

export interface AnalyzeSupplierResult {
  total_score: number;
  grade: string;
  confidence_label: string;
  strengths: string[];
  risk_flags: string[];
  recommendation: string;
  negotiation_strategy: { opening_offer: string; target_price: string; moq_ask: string; leverage_points: string[] };
}

export interface OutreachEmail { subject: string; body: string; tips: string[]; supplierUrl?: string; supplierName?: string; }
