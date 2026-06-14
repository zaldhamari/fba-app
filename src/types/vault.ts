import { Product } from '../services/api';
import { DS } from '../theme/ds';

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
  researching:        { label: 'Researching',     color: DS.accent },
  supplier_contacted: { label: 'Supplier Sent',   color: DS.warningText },
  testing:            { label: 'Testing',          color: DS.accent },
  ready_to_launch:    { label: 'Ready to Launch', color: DS.successText },
  rejected:           { label: 'Rejected',         color: DS.dangerText },
};
