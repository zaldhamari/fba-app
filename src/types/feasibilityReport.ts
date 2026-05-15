export type FeasibilityTagType = 'calculation' | 'brand' | 'keywords' | 'freight';

export interface FeasibilityTag {
  id: string;
  productAsin: string;
  productTitle: string;
  type: FeasibilityTagType;
  label: string;
  savedAt: string;
  data: Record<string, unknown>;
}

export interface FeasibilityReportSection {
  title: string;
  body?: string;
  items?: string[];
}

export interface FeasibilityReport {
  verdict: 'GO' | 'CAUTION' | 'NO-GO';
  confidence: number;
  headline: string;
  sections: FeasibilityReportSection[];
  data_completeness: 'full' | 'partial' | 'limited';
}
