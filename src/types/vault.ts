import { Product } from '../services/api';

export type VaultStatus =
  | 'researching'
  | 'supplier_contacted'
  | 'testing'
  | 'ready_to_launch'
  | 'rejected';

export interface AnalysisSnapshot {
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
}

export interface VaultEntry {
  asin: string;
  product: Product;
  analysis: AnalysisSnapshot | null;
  status: VaultStatus;
  note: string;
  marketplace: string;
  currency: string;
  savedAt: string;
  updatedAt: string;
}

export const VAULT_STATUSES: VaultStatus[] = [
  'researching',
  'supplier_contacted',
  'testing',
  'ready_to_launch',
  'rejected',
];

export const STATUS_CONFIG: Record<VaultStatus, { label: string; color: string }> = {
  researching:        { label: 'Researching',     color: '#2563EB' },
  supplier_contacted: { label: 'Supplier Sent',   color: '#D97706' },
  testing:            { label: 'Testing',          color: '#2563EB' },
  ready_to_launch:    { label: 'Ready to Launch', color: '#059669' },
  rejected:           { label: 'Rejected',         color: '#DC2626' },
};
