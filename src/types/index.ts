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
