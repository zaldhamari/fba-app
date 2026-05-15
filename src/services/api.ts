const BASE_URL = 'https://fba-backend-production-6c44.up.railway.app/api';
const API_KEY  = process.env.EXPO_PUBLIC_API_KEY ?? '';

const REQUEST_TIMEOUT_MS = 15_000;

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

async function post<T>(endpoint: string, body: object): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
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
    // Re-wrap network errors with friendly messages
    throw new Error(friendlyError(err));
  } finally {
    clearTimeout(timer);
  }
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

  searchAmazon: (keyword: string, marketplace = 'US', category = 'all') =>
    post<{ products: Product[]; trends: TrendData; keyword: string }>('/research/amazon', { keyword, category, marketplace }),

  searchSuppliers: (product: string, marketplace = 'US', max_price?: number) =>
    post<{ suppliers: Supplier[]; product: string }>('/research/suppliers', { product, max_price, marketplace }),

  calculateFBA: (body: {
    product_name: string;
    selling_price: number;
    supplier_cost: number;
    weight_lbs: number;
    dimensions: { length: number; width: number; height: number };
    category: string;
    quantity?: number;
  }) => post<FBAResult>('/calculate/fba', body),

  createBrand: (product_type: string, style = 'minimal', brand_name = '') =>
    post<BrandResult>('/brand/create', { product_type, keywords: [], style, brand_name }),

  researchKeywords: (product: string) =>
    post<{
      keywords: { keyword: string; competition: string; type: string }[];
      head_terms: string[];
      long_tail: string[];
      total_found: number;
      seo_score: number;
      top_ppc: string[];
    }>('/research/keywords', { product }),

  scoreOpportunity: (body: {
    amazon_price: number;
    supplier_price: number;
    review_count?: number;
    trend_direction?: string;
    weight_lbs?: number;
    category?: string;
  }) => post<{
    score: number;
    grade: string;
    label: string;
    color: string;
    action: string;
    breakdown: Record<string, number>;
    profit_summary: { profit: number; margin_pct: number; roi_pct: number };
  }>('/calculate/opportunity', body),

  createLabel: (brand_name: string, product_name: string, weight: string, style: string) =>
    post<{ label_svg: string; insert_svg: string }>('/brand/label', { brand_name, product_name, weight, style }),

  getSupplierEmail: (product: string, brand_name: string) =>
    post<{ subject: string; body: string; tips: string[] }>('/supplier/email', { product, brand_name }),

  // ─── AI Copilot ────────────────────────────────────────────────────────────
  analyzeCopilot: (body: {
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
  }) => post<{
    verdict: 'Launch' | 'Test First' | 'Avoid';
    confidence: number;
    summary: string;
    top_risks: string[];
    differentiation: string[];
    launch_strategy: string;
    estimated_monthly_profit: number;
    opportunity_score: number;
    profit_summary: { profit: number; margin_pct: number; roi_pct: number };
  }>('/ai/copilot', body),

  // ─── Review Analyzer ───────────────────────────────────────────────────────
  analyzeReviews: (product_name: string, category: string, sample_reviews?: string[]) =>
    post<{
      top_complaints: string[];
      opportunities: string[];
      sentiment_score: number;
      most_praised: string[];
      recommended_improvements: string[];
      bundling_ideas: string[];
      source: string;
    }>('/ai/reviews', { product_name, category, sample_reviews: sample_reviews || [] }),

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

  // ─── Profit Simulator ──────────────────────────────────────────────────────
  simulateProfit: (body: {
    supplier_cost: number;
    weight_lbs?: number;
    category?: string;
    price_min?: number;
    price_max?: number;
    monthly_units_est?: number;
  }) => post<{
    scenarios: {
      price: number;
      margin_pct: number;
      profit_per_unit: number;
      profit_after_ppc: number;
      ppc_cost_per_unit: number;
      monthly_revenue: number;
      monthly_profit: number;
      break_even_units: number;
      verdict: string;
      viable: boolean;
    }[];
    sweet_spot: object | null;
    shipping_scenarios: {
      method: string;
      transit_days: string;
      cost_per_unit: number;
      monthly_cost: number;
      impact_on_margin: string;
    }[];
    assumptions: object;
  }>('/calculate/simulate', body),

  // ─── Supplier Scorer ───────────────────────────────────────────────────────
  // ─── Analyze Product (Killer Feature) ────────────────────────────────────────
  analyzeProduct: (
    price: number,
    reviews: number,
    competition: string,
    trend: string,
    context?: { currency?: string; marketplace?: string },
  ) =>
    post<{
      verdict: 'LAUNCH' | 'TEST' | 'AVOID';
      confidence: number;
      summary: string;
      reasons: string[];
      risk: string;
      next_step: string;
      metrics: { price: number; margin: number; reviews: number; competition: string; trend: string };
    }>('/ai/analyze-product', { price, reviews, competition, trend, ...(context ?? {}) }),

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

  // ─── General AI Ask ────────────────────────────────────────────────────────
  askAI: (question: string, context?: string | Record<string, unknown>) =>
    post<{ answer: string; available: boolean }>('/ai/ask', {
      question,
      context: typeof context === 'string' ? { note: context } : context,
    }),

  // ─── Niche Intelligence ────────────────────────────────────────────────────
  searchNiche: (body: {
    keyword: string;
    marketplace?: string;
    price_min?: number;
    price_max?: number;
    max_top_seller_reviews?: number;
    budget?: number;
  }) => post<{
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
    }[];
    can_you_afford_it: {
      budget: number;
      target_unit_cost: number;
      min_order_cost: number;
      can_afford: boolean;
      verdict: string;
    };
  }>('/research/niche', body),

  // ─── Suppliers v2 (real Alibaba API) ──────────────────────────────────────
  searchSuppliersV2: (body: {
    product: string;
    marketplace?: string;
    max_unit_price?: number;
    max_moq?: number;
  }) => post<{ suppliers: Supplier[]; product: string }>('/research/suppliers-v2', body),

  // ─── Freight Estimates ─────────────────────────────────────────────────────
  estimateFreight: (body: {
    product_name: string;
    marketplace?: string;
    units?: number;
    weight_kg_per_unit?: number;
    length_cm?: number;
    width_cm?: number;
    height_cm?: number;
  }) => post<{
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
  }>('/research/freight', body),

  // ─── Feasibility Report ────────────────────────────────────────────────────
  generateFeasibilityReport: (body: {
    product_name: string;
    amazon_price?: number | null;
    supplier_analysis?: Record<string, unknown> | null;
    calculation?: Record<string, unknown> | null;
    brand?: Record<string, unknown> | null;
    keywords?: Record<string, unknown> | null;
    freight?: Record<string, unknown> | null;
    marketplace?: string;
    currency?: string;
  }) => post<{
    verdict: 'GO' | 'CAUTION' | 'NO-GO';
    confidence: number;
    headline: string;
    sections: { title: string; body?: string; items?: string[] }[];
    data_completeness: 'full' | 'partial' | 'limited';
  }>('/ai/feasibility-report', body),
};
