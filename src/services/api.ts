import {
  validateSearchAmazon,
  validateSearchNiche,
  validateCreateBrand,
  validateCreateLabel,
  validateAnalyzeCopilot,
  validateAnalyzeReviews,
  validateEstimateFreight,
  validateSearchSuppliers,
  validateAnalyzeProduct,
} from '../lib/apiValidation';

const BASE_URL = 'https://fba-backend-production-6c44.up.railway.app/api';
const API_KEY  = process.env.EXPO_PUBLIC_API_KEY ?? '';

const REQUEST_TIMEOUT_MS       = 15_000;
const SLOW_ENDPOINT_TIMEOUT_MS = 25_000;
const NICHE_TIMEOUT_MS         = 35_000;

// ── Keepa signal types ────────────────────────────────────────────────────────

export interface KeepaSignals {
  bsr?: {
    trend:      'improving' | 'stable' | 'declining' | 'insufficient_data';
    volatility: number | null;
    spike_flag: boolean;
  };
  price?: {
    direction:      'rising' | 'flat' | 'falling' | 'insufficient_data';
    pct_change_90d: number | null;
    floor_usd:      number | null;
  };
}

export interface FreeLimitResult {
  kind:      'free_limit';
  used:      number;
  limit:     number;
  message:   string;
  resets_on: string;
}

export interface ProductDataSuccess {
  kind:           'success';
  asin:           string;
  title:          string | null;
  category:       string | null;
  sales_estimate: {
    monthly_sales: number;
    low:           number;
    high:          number;
    confidence:    'High' | 'Medium' | 'Low';
    note:          string;
  } | null;
  opportunity: {
    score: number;
    grade: string;
    label: string;
  } | null;
  signals: KeepaSignals;
  source:  string;
}

export type ProductDataResult = ProductDataSuccess | FreeLimitResult;

// Classify a raw fetch/network error into a user-friendly message.
export function friendlyError(err: unknown): string {
  if (err instanceof Error) {
    if (err.name === 'AbortError') return 'Request timed out. Check your connection and try again.';
    if (
      err.message.includes('Network request failed') ||
      err.message.includes('Failed to fetch') ||
      err.message.includes('net::ERR') ||
      err.message.includes('network')
    ) return 'No internet connection. Please check your network and try again.';
    return err.message;
  }
  return 'Something went wrong. Please try again.';
}

async function post<T>(endpoint: string, body: object, timeoutMs = REQUEST_TIMEOUT_MS): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(`${BASE_URL}${endpoint}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': API_KEY,
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    if (res.status === 401) throw new Error('API authentication failed. Please update the app.');
    if (res.status === 429) throw new Error('Too many requests. Please wait a moment and try again.');
    if (res.status >= 500) throw new Error('Our servers are having issues. Please try again shortly.');
    if (!res.ok) throw new Error(`Unexpected error (${res.status}). Please try again.`);
    return res.json();
  } catch (err: any) {
    if (err?.name === 'AbortError') {
      throw new Error('Request timed out. Check your connection and try again.');
    }
    throw new Error(friendlyError(err));
  } finally {
    clearTimeout(timer);
  }
}

// Slow endpoints (brand generation, AI copilot) run with a 25s timeout.
function postSlow<T>(endpoint: string, body: object): Promise<T> {
  return post<T>(endpoint, body, SLOW_ENDPOINT_TIMEOUT_MS);
}

export interface Product {
  title: string;
  price: number | null;
  rating: number | null;
  review_count: number | null;
  asin: string;
  image: string;
  competition: 'Low' | 'Medium' | 'High' | 'Unknown';
  opportunity: 'Good' | 'Moderate' | 'Saturated';
  url: string;
  error?: string;
  /** 'dataforseo' = real listing data. 'stub' = fabricated placeholder (no DataForSEO
   *  credentials configured server-side). Undefined = legacy keyword-derived estimate. */
  source?: string;
  /** Real monthly Amazon search volume from DataForSEO Labs (present on keyword_estimate results). */
  search_volume?: number;
}

export interface TrendData {
  interest_score: number | null;
  trend_direction: 'Rising' | 'Stable' | 'Declining' | 'No data';
  related_queries: string[];
  monthly_interest: { month: string; value: number }[];
  error?: string;
}

export interface Supplier {
  title: string;
  price_display: string;
  price_range: { min: number | null; max: number | null };
  moq: string;
  supplier: string;
  image: string;
  url: string;
  error?: string;
  /** 'alibaba_api' = real supplier data. 'stub' = fabricated placeholder (no Alibaba
   *  Open Platform credentials configured server-side). */
  source?: string;
  verified?: boolean;
  trade_assurance?: boolean;
}

export interface FBAResult {
  selling_price: number;
  supplier_cost: number;
  fees: {
    referral_fee: number;
    fulfillment_fee: number;
    monthly_storage: number;
    total_fees: number;
  };
  profit: number;
  margin_pct: number;
  roi_pct: number;
  size_tier: string;
  billable_weight_lbs: number;
  viable: boolean;
  verdict: 'Excellent' | 'Good' | 'Marginal' | 'Not viable';
  shipment?: {
    quantity: number;
    total_weight_lbs: number;
    carton_count: number;
    carton_dims: { length: number; width: number; height: number };
    units_per_carton: number;
    carton_weight_lbs: number;
    total_inventory_cost: number;
    total_revenue: number;
    total_profit: number;
  };
}

export interface BrandResult {
  brand_name: string;
  name_options: string[];
  tagline: string;
  style: string;
  logo_svg: string;
  listing: {
    title: string;
    bullet_points: string[];
    description: string;
    backend_keywords: string[];
  };
  generated_keywords: string[];
}

export const api = {
  lookupProduct: (input: string) =>
    post<{ asin: string; title: string | null; category: string | null; url: string; source: string; error?: string }>('/research/product', { input }),

  searchAmazon: async (keyword: string, marketplace = 'US', category = 'all') => {
    const data = await post<{ products: Product[]; trends: TrendData; keyword: string }>('/research/amazon', { keyword, category, marketplace });
    validateSearchAmazon(data);
    return data;
  },

  searchSuppliers: async (product: string, marketplace = 'US', max_price?: number) => {
    const data = await post<{ suppliers: Supplier[]; product: string }>('/research/suppliers', { product, max_price, marketplace });
    validateSearchSuppliers(data);
    return data;
  },

  calculateFBA: (body: {
    product_name: string;
    selling_price: number;
    supplier_cost: number;
    weight_lbs: number;
    dimensions: { length: number; width: number; height: number };
    category: string;
    quantity?: number;
  }) => post<FBAResult>('/calculate/fba', body),

  /** Pre-fills weight/dimensions/category when no real measured data exists.
   *  `source` in the response is 'ai_estimate' or 'fallback_estimate' — never
   *  'confirmed'. Always shown with an EstimateLabel and left user-editable. */
  estimatePhysical: (body: { title: string; price?: number; category?: string }) =>
    post<{
      weight_lbs: number;
      length: number;
      width: number;
      height: number;
      category: string;
      confidence: 'high' | 'medium' | 'low';
      source: 'ai_estimate' | 'fallback_estimate';
    }>('/ai/estimate-physical', body),

  createBrand: async (body: {
    product_type:    string;
    style?:          string;
    brand_name?:     string;
    brand_direction?: string;
    color_palette?:  string;
    font_style?:     string;
    packaging_mood?: string;
    tagline?:        string;
    target_audience?: string;
    brand_tone?:     string;
  }) => {
    const data = await postSlow<BrandResult>('/brand/create', { keywords: [], ...body });
    validateCreateBrand(data);
    return data;
  },

  researchKeywords: (product: string) =>
    post<{
      keywords: { keyword: string; competition: string; type: string }[];
      head_terms: string[];
      long_tail: string[];
      total_found: number;
      seo_score: number;
      top_ppc: string[];
    }>('/research/keywords', { product }),

  createLabel: async (body: {
    brand_name:        string;
    product_name:      string;
    weight:            string;
    style?:            string;
    brand_direction?:  string;
    color_palette?:    string;
    font_style?:       string;
    packaging_type?:   string;
    tagline?:          string;
    ingredients?:      string;
    warnings?:         string;
    directions?:       string;
    support_url?:      string;
    qr_text?:          string;
    manufacturer?:     string;
  }) => {
    const data = await postSlow<{ label_svg: string; insert_svg: string }>('/brand/label', body);
    validateCreateLabel(data);
    return data;
  },

  getSupplierEmail: (product: string, brand_name: string) =>
    post<{ subject: string; body: string; tips: string[] }>('/supplier/email', { product, brand_name }),

  // ─── AI Copilot ────────────────────────────────────────────────────────────
  analyzeCopilot: async (body: {
    product_name: string;
    amazon_price: number;
    supplier_price: number;
    review_count?: number;
    trend_direction?: string;
    weight_lbs?: number;
    category?: string;
    competition?: string;
    monthly_sales_est?: number;
    marketplace?: string;
    currency?: string;
    financial_context?: Record<string, unknown>;
  }) => {
    const data = await postSlow<{
    verdict: 'Launch' | 'Test First' | 'Avoid';
    confidence: number;
    summary: string;
    top_risks: string[];
    differentiation: string[];
    launch_strategy: string;
    estimated_monthly_profit: number;
    opportunity_score: number;
    profit_summary: { profit: number; margin_pct: number; roi_pct: number };
  }>('/ai/copilot', body);
    validateAnalyzeCopilot(data);
    return data;
  },

  // ─── Review Analyzer ───────────────────────────────────────────────────────
  analyzeReviews: async (product_name: string, category: string, sample_reviews?: string[]) => {
    const data = await post<{
      top_complaints: string[];
      opportunities: string[];
      sentiment_score: number;
      most_praised: string[];
      recommended_improvements: string[];
      bundling_ideas: string[];
      source: string;
    }>('/ai/reviews', { product_name, category, sample_reviews: sample_reviews || [] });
    validateAnalyzeReviews(data);
    return data;
  },

  // ─── Differentiation ───────────────────────────────────────────────────────
  getDifferentiation: (product_name: string, category: string, top_complaints?: string[]) =>
    post<{
      product_improvements: string[];
      bundle_ideas: string[];
      niche_angles: string[];
      listing_angle: string;
      price_positioning: string;
      source: string;
    }>('/ai/differentiate', { product_name, category, top_complaints: top_complaints || [] }),

  // ─── Analyze Product (Killer Feature) ────────────────────────────────────────
  analyzeProduct: async (
    price: number,
    reviews: number,
    competition: string,
    trend: string,
    context?: { currency?: string; marketplace?: string },
  ) => {
    const data = await post<{
      verdict: 'LAUNCH' | 'TEST' | 'AVOID';
      confidence: number;
      summary: string;
      reasons: string[];
      risk: string;
      next_step: string;
      metrics: { price: number; margin: number; reviews: number; competition: string; trend: string };
    }>('/ai/analyze-product', { price, reviews, competition, trend, ...(context ?? {}) });
    validateAnalyzeProduct(data);
    return data;
  },

  scoreSupplier: (body: {
    supplier_name: string;
    price_per_unit: number;
    moq: number;
    years_experience?: number;
    response_time_hours?: number;
    has_certifications?: boolean;
    product_name?: string;
    target_order_qty?: number;
  }) => post<{
    supplier_name: string;
    total_score: number;
    grade: string;
    confidence_label: string;
    score_breakdown: Record<string, number>;
    strengths: string[];
    risk_flags: string[];
    recommendation: string;
    negotiation_strategy: {
      opening_offer: string;
      target_price: string;
      moq_ask: string;
      leverage_points: string[];
      email_opener?: string;
      red_lines?: string[];
    };
  }>('/suppliers/score', body),

  // ─── Keepa product data (with 402 typed as FreeLimitResult) ─────────────────
  getProductData: async (
    asin:   string,
    userId: string,
    tier:   string,
  ): Promise<ProductDataResult> => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    try {
      const res = await fetch(`${BASE_URL}/product/data`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-API-Key': API_KEY },
        body:    JSON.stringify({ asin, user_id: userId, tier }),
        signal:  controller.signal,
      });
      if (res.status === 402) {
        const body = await res.json().catch(() => ({}));
        return {
          kind:      'free_limit',
          used:      body.used      ?? 0,
          limit:     body.limit     ?? 5,
          message:   body.message   ?? 'You have used all your free product lookups this month.',
          resets_on: body.resets_on ?? '',
        };
      }
      if (res.status === 401) throw new Error('API authentication failed. Please update the app.');
      if (res.status === 429) throw new Error('Too many requests. Please wait a moment and try again.');
      if (res.status >= 500) throw new Error('Our servers are having issues. Please try again shortly.');
      if (!res.ok) throw new Error(`Unexpected error (${res.status}). Please try again.`);
      const data = await res.json();
      return { kind: 'success', ...data };
    } catch (err: any) {
      if (err?.name === 'AbortError') throw new Error('Request timed out. Check your connection and try again.');
      throw new Error(friendlyError(err));
    } finally {
      clearTimeout(timer);
    }
  },

  // ─── Free-tier allowance indicator ───────────────────────────────────────────
  getFreeAllowance: async (
    userId: string,
  ): Promise<{ used: number; limit: number; resets_on: string }> => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    const url = `${BASE_URL}/product/free-allowance?user_id=${encodeURIComponent(userId)}`;
    try {
      const res = await fetch(url, {
        method:  'GET',
        headers: { 'X-API-Key': API_KEY },
        signal:  controller.signal,
      });
      if (!res.ok) throw new Error(`Unexpected error (${res.status}).`);
      return res.json();
    } catch (err: any) {
      if (err?.name === 'AbortError') throw new Error('Request timed out.');
      throw new Error(friendlyError(err));
    } finally {
      clearTimeout(timer);
    }
  },

  // ─── General AI Ask ────────────────────────────────────────────────────────
  askAI: (question: string, context?: string | Record<string, unknown>) =>
    post<{ answer: string; available: boolean }>('/ai/ask', {
      question,
      context: typeof context === 'string' ? { note: context } : context,
    }),

  // ─── Niche Intelligence ────────────────────────────────────────────────────
  searchNiche: async (body: {
    keyword: string;
    marketplace?: string;
    price_min?: number;
    price_max?: number;
    max_top_seller_reviews?: number;
    budget?: number;
  }) => {
    const data = await post<{
      keyword: string;
      marketplace: string;
      verdict: {
        label: string;
        color: string;
        score: number;
        reasons: string[];
        warnings: string[];
      };
      market_snapshot: {
        avg_price: number;
        avg_reviews: number;
        avg_rating: number;
        top_reviews: number;
        total_products: number;
        in_price_range: number;
        low_competition: number;
      };
      the_gap: string[];
      products_to_model: {
        title: string;
        price: number;
        rating: number;
        review_count: number;
        asin: string;
        url: string;
        source?: string;
      }[];
      can_you_afford_it: {
        budget: number;
        target_unit_cost: number;
        min_order_cost: number;
        can_afford: boolean;
        verdict: string;
      };
      /** 'dataforseo' = the whole report is built from real Amazon listing data.
       *  'stub' = no DataForSEO credentials configured server-side — every number
       *  below (market snapshot, products to model) is fabricated placeholder data. */
      data_source?: string;
    }>('/research/niche', body, NICHE_TIMEOUT_MS);
    validateSearchNiche(data);
    return data;
  },

  // ─── Suppliers v2 (real Alibaba API) ──────────────────────────────────────
  searchSuppliersV2: async (body: {
    product: string;
    marketplace?: string;
    max_unit_price?: number;
    max_moq?: number;
  }) => {
    const data = await post<{ suppliers: Supplier[]; product: string }>('/research/suppliers-v2', body);
    validateSearchSuppliers(data);
    return data;
  },

  // ─── Freight Estimates ─────────────────────────────────────────────────────
  estimateFreight: async (body: {
    product_name: string;
    marketplace?: string;
    units?: number;
    weight_kg_per_unit?: number;
    length_cm?: number;
    width_cm?: number;
    height_cm?: number;
  }) => {
    const data = await post<{
      product: string;
      marketplace: string;
      units: number;
      total_weight_kg: number;
      total_cbm: number;
      modes: {
        air:     { mode: string; total_cost: number; cost_per_unit: number; transit_days: number; notes: string };
        sea_lcl: { mode: string; total_cost: number; cost_per_unit: number; transit_days: number; notes: string };
        sea_fcl: { mode: string; total_cost: number; cost_per_unit: number; transit_days: number; notes: string } | null;
        express: { mode: string; total_cost: number; cost_per_unit: number; transit_days: number; notes: string };
      };
      recommended: 'air' | 'sea_lcl' | 'sea_fcl' | 'express';
      fba_inbound_est: number;
      prep_cost: number;
    }>('/research/freight', body);
    validateEstimateFreight(data);
    return data;
  },

  generateBrandAsset: async (body: { prompt: string; type: string }) => {
    const data = await postSlow<{ svg: string; url?: string }>('/brand/asset', body);
    return data;
  },

};
