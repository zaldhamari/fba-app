// The live API response shape from /ai/analyze-product
export type AnalyzeResult = {
  verdict: 'LAUNCH' | 'TEST' | 'AVOID';
  confidence: number;
  summary: string;
  reasons: string[];
  risk: string;
  next_step: string;
  metrics: {
    price: number;
    margin: number;
    reviews: number;
    competition: string;
    trend: string;
  };
};
