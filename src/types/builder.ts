export type BuilderStage =
  | 'discovery'
  | 'analysis'
  | 'supplier'
  | 'freight'
  | 'calculations'
  | 'brand'
  | 'complete';

export type StageStatus = 'locked' | 'active' | 'passed' | 'soft_fail';

// ── Per-stage data shapes ─────────────────────────────────────────────────────

export interface DiscoveryData {
  keyword:     string;
  marketplace: string;
  product: {
    id:          string;
    title:       string;
    price:       number;
    rating:      number | null;
    reviewCount: number | null;
    competition: 'Low' | 'Medium' | 'High';
    url?:        string;
  };
}

export interface AnalysisData {
  verdict:          'LAUNCH' | 'TEST' | 'AVOID';
  confidence:       number;
  opportunityScore: number;
  summary:          string;
  reasons:          string[];
  risk:             string;
  userOverride:     boolean;
}

export interface SupplierData {
  name:              string;
  platform:          string;
  unitCost:          number;
  moq:               number;
  url?:              string;
  fitsProfileBudget: boolean;
}

export interface FreightData {
  mode:           'air' | 'sea_lcl' | 'sea_fcl' | 'express';
  modeLabel:      string;
  units:          number;
  costPerUnit:    number;
  totalCost:      number;
  transitDays:    number;
  pctOfSellPrice: number;
}

export interface CalculationsData {
  sellingPrice:     number;
  unitCost:         number;
  freightPerUnit:   number;
  fbaFee:           number;
  ppcPerUnit:       number;
  netProfit:        number;
  marginPct:        number;
  roiPct:           number;
  monthlyUnitsEst:  number;
  monthlyProfitEst: number;
  breakEvenUnits:   number;
  verdict:          'profitable' | 'marginal' | 'unprofitable';
}

export interface BrandData {
  brandName:          string;
  tagline:            string;
  productTitle:       string;
  bulletPoints:       string[];
  productDescription: string;
  backendKeywords:    string[];
  logoSvg?:           string;
  insertSvg?:         string;
}

// ── Winner Vault entry (published on completion) ──────────────────────────────

export interface WinnerEntry {
  sessionId:        string;
  completedAt:      string;
  productTitle:     string;
  brandName:        string;
  marketplace:      string;
  sellingPrice:     number;
  unitCost:         number;
  marginPct:        number;
  roiPct:           number;
  monthlyProfitEst: number;
  supplierName:     string;
  freightMode:      string;
  freightPerUnit:   number;
}

// ── The session ───────────────────────────────────────────────────────────────

export interface BuilderSession {
  id:          string;
  createdAt:   string;
  updatedAt:   string;
  status:      'active' | 'complete' | 'abandoned';
  currentStage: BuilderStage;

  stages: Record<BuilderStage, StageStatus>;

  discovery:    DiscoveryData    | null;
  analysis:     AnalysisData     | null;
  supplier:     SupplierData     | null;
  freight:      FreightData      | null;
  calculations: CalculationsData | null;
  brand:        BrandData        | null;
  winnerEntry:  WinnerEntry      | null;
}

// ── Ordered stage list for iteration ─────────────────────────────────────────

export const STAGE_ORDER: BuilderStage[] = [
  'discovery', 'analysis', 'supplier', 'freight', 'calculations', 'brand', 'complete',
];

export const STAGE_LABELS: Record<BuilderStage, string> = {
  discovery:    'Find a Product',
  analysis:     'AI Analysis',
  supplier:     'Lock In Supplier',
  freight:      'Choose Freight',
  calculations: 'Check the Numbers',
  brand:        'Build Your Brand',
  complete:     'Mission Complete',
};

export const STAGE_ICONS: Record<BuilderStage, string> = {
  discovery:    '◎',
  analysis:     '◈',
  supplier:     '🏭',
  freight:      '✈',
  calculations: '📊',
  brand:        '✦',
  complete:     '🏆',
};

export function createSession(id: string): BuilderSession {
  return {
    id,
    createdAt:    new Date().toISOString(),
    updatedAt:    new Date().toISOString(),
    status:       'active',
    currentStage: 'discovery',
    stages: {
      discovery:    'active',
      analysis:     'locked',
      supplier:     'locked',
      freight:      'locked',
      calculations: 'locked',
      brand:        'locked',
      complete:     'locked',
    },
    discovery:    null,
    analysis:     null,
    supplier:     null,
    freight:      null,
    calculations: null,
    brand:        null,
    winnerEntry:  null,
  };
}

export function nextStage(stage: BuilderStage): BuilderStage | null {
  const idx = STAGE_ORDER.indexOf(stage);
  return idx < STAGE_ORDER.length - 1 ? STAGE_ORDER[idx + 1] : null;
}
