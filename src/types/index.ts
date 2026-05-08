export interface AnalyzeResult {
  verdict: 'LAUNCH' | 'TEST' | 'AVOID';
  confidence: number;
  summary: string;
  positives: string[];
  risks: string[];
  recommendation: string;
}

export interface SimulateScenario {
  price: number;
  margin_pct: number;
  viable: boolean;
  profit_per_unit: number;
  profit_after_ppc: number;
  monthly_profit: number;
}

export interface SimulateShipping {
  method: string;
  transit_days: number;
  cost_per_unit: number;
  impact_on_margin: string;
}

export interface SimulateResult {
  scenarios: SimulateScenario[];
  shipping_scenarios: SimulateShipping[];
  sweet_spot: {
    price: number;
    margin_pct: number;
    monthly_profit: number;
    verdict: string;
  };
}

export interface CopilotResult {
  verdict: 'Launch' | 'Test First' | 'Avoid';
  confidence: number;
  summary: string;
  top_risks: string[];
  differentiation: string[];
  launch_strategy: string;
  estimated_monthly_profit: number;
  opportunity_score: number;
  profit_summary: { profit: number; margin_pct: number; roi_pct: number };
}

export interface ReviewResult {
  top_complaints: string[];
  opportunities: string[];
  sentiment_score: number;
  most_praised: string[];
  recommended_improvements: string[];
  bundling_ideas: string[];
  source: string;
}

export interface KeywordItem {
  keyword: string;
  competition: string;
  type: string;
}

export interface KeywordResult {
  keywords: KeywordItem[];
  head_terms: string[];
  long_tail: string[];
  total_found: number;
  seo_score: number;
  top_ppc: string[];
}

export interface SupplierNegotiation {
  opening_offer: string;
  target_price: string;
  moq_ask: string;
  leverage_points: string[];
  email_opener?: string;
  red_lines?: string[];
}

export interface SupplierScoreResult {
  supplier_name: string;
  total_score: number;
  grade: string;
  confidence_label: string;
  score_breakdown: Record<string, number>;
  strengths: string[];
  risk_flags: string[];
  recommendation: string;
  negotiation_strategy: SupplierNegotiation;
}
