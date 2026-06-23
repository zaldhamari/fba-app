/**
 * Comprehensive supplier management types
 * Covers: vetting, communication, comparison, samples, ratings, lead times, negotiations
 */

// ── Supplier Vetting ──────────────────────────────────────────────────────────

export interface SupplierVettingChecklist {
  supplierId: string;
  supplierName: string;
  product: string;
  checklist: {
    businessRegistered: boolean;
    businessRegisteredNote?: string;
    licenseProvided: boolean;
    licenseFile?: string;
    tradeAssuranceEnabled: boolean;
    yearsInBusiness: number | null;
    sampleRequested: boolean;
    sampleRequestedDate?: string;
    qualificationsCertifications: string[]; // ["ISO-9001", "FDA", "CE"]
    referenceCustomerContact: boolean;
    referenceCustomerNote?: string;
    factoryVisitCompleted: boolean;
    factoryVisitNote?: string;
    ndaSigned: boolean;
    ndaDate?: string;
  };
  overallRisk: 'low' | 'medium' | 'high' | 'unknown';
  vettingStatus: 'not_started' | 'in_progress' | 'passed' | 'failed';
  vettingDate?: string;
}

// ── Supplier Communication ────────────────────────────────────────────────────

export interface SupplierMessage {
  id: string;
  supplierId: string;
  timestamp: string;
  direction: 'outbound' | 'inbound';
  type: 'email' | 'note' | 'phone' | 'chat';
  subject?: string;
  body: string;
  attachments?: string[];
  tags?: string[]; // ["price_discussion", "sample_request", "negotiation"]
}

export interface SupplierCommunicationHistory {
  supplierId: string;
  productName: string;
  messages: SupplierMessage[];
  lastContact: string;
  totalMessages: number;
  status: 'initial_inquiry' | 'awaiting_quote' | 'quote_received' | 'negotiating' | 'terms_agreed' | 'order_placed' | 'stalled';
}

// ── Supplier Comparison ───────────────────────────────────────────────────────

export interface SupplierComparisonMetrics {
  pricePerUnit: number;
  moq: number;
  leadTimeDays: number;
  qualityGrade: 'A+' | 'A' | 'A-' | 'B' | 'C' | 'unknown';
  certifications: string[];
  trustScore: number; // 0-10
  yearsInBusiness: number;
  responseTimeHours?: number;
  samplePrice?: number;
  bulkPricingTiers?: Array<{ quantity: number; pricePerUnit: number }>;
}

export interface SupplierComparison {
  productName: string;
  suppliersComparing: string[]; // supplier IDs
  metrics: Record<string, SupplierComparisonMetrics>;
  winner?: string; // supplier ID
  winnerReason?: string;
  createdAt: string;
  updatedAt: string;
}

// ── Sample Tracking ───────────────────────────────────────────────────────────

export interface SupplierSample {
  id: string;
  supplierId: string;
  supplierName: string;
  productName: string;
  dateRequested: string;
  expectedArrivalDate?: string;
  actualArrivalDate?: string;
  status: 'requested' | 'in_transit' | 'received' | 'rejected' | 'lost';
  quantity: number;
  cost: number; // price paid for sample
  qualityRating?: number; // 1-5
  qualityNotes?: string;
  issues?: string[];
  decision: 'approved' | 'rejected' | 'needs_modification' | 'pending';
  decisionNote?: string;
  trackingNumber?: string;
}

// ── Supplier Ratings & Notes ──────────────────────────────────────────────────

export interface SupplierRating {
  supplierId: string;
  productName: string;
  overallRating: number; // 1-5
  communicationRating: number; // 1-5
  qualityRating: number; // 1-5
  reliabilityRating: number; // 1-5
  valueForMoneyRating: number; // 1-5
  personalNotes: string;
  pros: string[];
  cons: string[];
  wouldRecommend: boolean;
  dateRated: string;
}

// ── Lead Time Tracking ────────────────────────────────────────────────────────

export interface LeadTimeRecord {
  id: string;
  supplierId: string;
  productName: string;
  requestedLeadTime: number; // days
  promisedLeadTime: number; // days
  actualLeadTime?: number; // days (filled after order arrives)
  orderDate?: string;
  deliveryDate?: string;
  delayReason?: string;
  seasonalFactor?: string; // "Chinese New Year", "Summer break", etc.
  reliable: boolean;
}

// ── Negotiated Terms ──────────────────────────────────────────────────────────

export interface NegotiatedTerms {
  supplierId: string;
  productName: string;
  negotiationStatus: 'pending' | 'agreed' | 'signed' | 'order_placed';

  // Pricing
  agreedPricePerUnit: number;
  originalAskedPrice?: number;
  discountPercentage?: number;

  // Quantities
  moq: number;
  bulkPricingTiers?: Array<{
    minQuantity: number;
    maxQuantity?: number;
    pricePerUnit: number;
  }>;

  // Timeline
  leadTimeDays: number;
  earliestShipDate?: string;
  productionStartDate?: string;

  // Quality & Compliance
  qualityStandards: string[];
  inspectionRequired: boolean;
  certifications: string[];

  // Payment Terms
  paymentTerms: 'TT_advance' | 'TT_50_50' | 'LC' | 'DA' | 'other';
  depositPercentage?: number;
  balanceDueDate?: string;

  // Additional Terms
  sampleFree: boolean;
  minimumOrderValue?: number;
  shippingTerms?: string; // 'FOB', 'CIF', 'DDP'
  warranty?: string;
  returnPolicy?: string;

  // Contract
  contractSigned: boolean;
  contractDate?: string;
  contractFile?: string;
  ndaSigned: boolean;

  // Notes
  specialConditions?: string[];
  nextSteps?: string;

  dateAgreed: string;
}

// ── Bulk Pricing Tiers ────────────────────────────────────────────────────────

export interface BulkPricingTier {
  supplierId: string;
  minQuantity: number;
  maxQuantity?: number;
  pricePerUnit: number;
  totalPrice: number; // minQuantity * pricePerUnit
  discount?: number; // percentage
  leadTimeAdjustment?: number; // days added/subtracted
  specialConditions?: string;
}

// ── Supplier Profile Extension ────────────────────────────────────────────────

export interface SupplierProfile {
  // Original Alibaba data
  id: string;
  name: string;
  platform: string;
  price: string;
  moq: string;
  numericRating?: number; // Raw numeric rating from platform (e.g. 4.5 stars)
  verified: boolean;
  yearsInBusiness?: number;
  country: string;
  url?: string;
  source: string;

  // Extended data
  vetting?: SupplierVettingChecklist;
  communication?: SupplierCommunicationHistory;
  samples?: SupplierSample[];
  rating?: SupplierRating;
  leadTimeRecords?: LeadTimeRecord[];
  negotiatedTerms?: NegotiatedTerms;
  bulkPricing?: BulkPricingTier[];

  // Metadata
  addedToVault: string; // ISO date
  status: 'prospect' | 'vetting' | 'qualified' | 'rejected' | 'ordered' | 'active' | 'archived';
  lastUpdated: string;
}

// ── Supplier Comparison Result ────────────────────────────────────────────────

export interface SupplierScorecard {
  supplierId: string;
  supplierName: string;
  metrics: {
    priceScore: number; // 0-100 (lower price = higher score)
    moqScore: number; // 0-100 (lower MOQ = higher score)
    leadTimeScore: number; // 0-100 (shorter = higher score)
    qualityScore: number; // 0-100
    trustScore: number; // 0-100
    reliabilityScore: number; // 0-100
  };
  weightedScore: number; // 0-100 (composite)
  recommendation: 'top_choice' | 'good_alternative' | 'backup_option' | 'not_recommended';
  reasoning: string;
}
