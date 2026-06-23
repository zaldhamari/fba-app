/**
 * Supplier Management Service
 * Handles all supplier operations: vetting, communication, comparison, sampling, ratings, negotiations
 *
 * Storage: LocalStorage (dev) → Backend API (production)
 * Ready for: Alibaba API integration, full sync
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { STORAGE_KEYS } from '../constants/storage';
import type {
  SupplierVettingChecklist,
  SupplierCommunicationHistory,
  SupplierMessage,
  SupplierComparison,
  SupplierSample,
  SupplierRating,
  LeadTimeRecord,
  NegotiatedTerms,
  SupplierProfile,
  SupplierScorecard,
} from '../types/supplier';

// ── Vetting Checklist ─────────────────────────────────────────────────────────

export async function createVettingChecklist(
  supplierId: string,
  supplierName: string,
  product: string,
): Promise<SupplierVettingChecklist> {
  const checklist: SupplierVettingChecklist = {
    supplierId,
    supplierName,
    product,
    checklist: {
      businessRegistered: false,
      licenseProvided: false,
      tradeAssuranceEnabled: false,
      yearsInBusiness: null,
      sampleRequested: false,
      qualificationsCertifications: [],
      referenceCustomerContact: false,
      factoryVisitCompleted: false,
      ndaSigned: false,
    },
    overallRisk: 'unknown',
    vettingStatus: 'not_started',
  };

  const key = `supplier_vetting_${supplierId}`;
  await AsyncStorage.setItem(key, JSON.stringify(checklist));
  return checklist;
}

export async function getVettingChecklist(supplierId: string): Promise<SupplierVettingChecklist | null> {
  const key = `supplier_vetting_${supplierId}`;
  const data = await AsyncStorage.getItem(key);
  return data ? JSON.parse(data) : null;
}

export async function updateVettingChecklist(
  supplierId: string,
  updates: Partial<SupplierVettingChecklist>,
): Promise<SupplierVettingChecklist> {
  const current = await getVettingChecklist(supplierId);
  if (!current) throw new Error('Vetting checklist not found');

  const updated: SupplierVettingChecklist = {
    ...current,
    ...updates,
    checklist: { ...current.checklist, ...(updates.checklist || {}) },
  };

  // Calculate risk level
  const checkItems = updated.checklist;
  const passedItems = Object.values(checkItems).filter(v => v === true).length;
  const totalItems = Object.keys(checkItems).length;
  const passPercentage = passedItems / totalItems;

  updated.overallRisk = passPercentage >= 0.8 ? 'low' : passPercentage >= 0.5 ? 'medium' : 'high';
  updated.vettingStatus = passPercentage === 1 ? 'passed' : passPercentage >= 0.5 ? 'in_progress' : 'not_started';
  updated.vettingDate = new Date().toISOString();

  const key = `supplier_vetting_${supplierId}`;
  await AsyncStorage.setItem(key, JSON.stringify(updated));
  return updated;
}

// ── Communication History ─────────────────────────────────────────────────────

export async function createCommunicationHistory(
  supplierId: string,
  productName: string,
): Promise<SupplierCommunicationHistory> {
  const history: SupplierCommunicationHistory = {
    supplierId,
    productName,
    messages: [],
    lastContact: new Date().toISOString(),
    totalMessages: 0,
    status: 'initial_inquiry',
  };

  const key = `supplier_comm_${supplierId}`;
  await AsyncStorage.setItem(key, JSON.stringify(history));
  return history;
}

export async function getCommunicationHistory(supplierId: string): Promise<SupplierCommunicationHistory | null> {
  const key = `supplier_comm_${supplierId}`;
  const data = await AsyncStorage.getItem(key);
  return data ? JSON.parse(data) : null;
}

export async function addMessage(
  supplierId: string,
  message: Omit<SupplierMessage, 'id' | 'timestamp'>,
): Promise<SupplierMessage> {
  let history = await getCommunicationHistory(supplierId);
  if (!history) {
    history = await createCommunicationHistory(supplierId, 'Unknown Product');
  }

  const newMessage: SupplierMessage = {
    ...message,
    id: `msg_${Date.now()}`,
    timestamp: new Date().toISOString(),
  };

  history.messages.push(newMessage);
  history.lastContact = newMessage.timestamp;
  history.totalMessages += 1;

  const key = `supplier_comm_${supplierId}`;
  await AsyncStorage.setItem(key, JSON.stringify(history));

  return newMessage;
}

// ── Sample Tracking ───────────────────────────────────────────────────────────

export async function requestSample(sample: Omit<SupplierSample, 'id'>): Promise<SupplierSample> {
  const fullSample: SupplierSample = {
    ...sample,
    id: `sample_${Date.now()}`,
  };

  const key = `supplier_samples_${sample.supplierId}`;
  const existing = await AsyncStorage.getItem(key);
  const samples: SupplierSample[] = existing ? JSON.parse(existing) : [];
  samples.push(fullSample);

  await AsyncStorage.setItem(key, JSON.stringify(samples));
  return fullSample;
}

export async function getSamples(supplierId: string): Promise<SupplierSample[]> {
  const key = `supplier_samples_${supplierId}`;
  const data = await AsyncStorage.getItem(key);
  return data ? JSON.parse(data) : [];
}

export async function updateSample(supplierId: string, sampleId: string, updates: Partial<SupplierSample>): Promise<SupplierSample> {
  const samples = await getSamples(supplierId);
  const index = samples.findIndex(s => s.id === sampleId);
  if (index === -1) throw new Error('Sample not found');

  samples[index] = { ...samples[index], ...updates };
  const key = `supplier_samples_${supplierId}`;
  await AsyncStorage.setItem(key, JSON.stringify(samples));

  return samples[index];
}

// ── Supplier Ratings ──────────────────────────────────────────────────────────

export async function rateSupplier(
  supplierId: string,
  rating: Omit<SupplierRating, 'dateRated'>,
): Promise<SupplierRating> {
  const fullRating: SupplierRating = {
    ...rating,
    dateRated: new Date().toISOString(),
  };

  const key = `supplier_rating_${supplierId}`;
  await AsyncStorage.setItem(key, JSON.stringify(fullRating));
  return fullRating;
}

export async function getSupplierRating(supplierId: string): Promise<SupplierRating | null> {
  const key = `supplier_rating_${supplierId}`;
  const data = await AsyncStorage.getItem(key);
  return data ? JSON.parse(data) : null;
}

// ── Lead Time Tracking ────────────────────────────────────────────────────────

export async function recordLeadTime(record: Omit<LeadTimeRecord, 'id'>): Promise<LeadTimeRecord> {
  const fullRecord: LeadTimeRecord = {
    ...record,
    id: `leadtime_${Date.now()}`,
  };

  const key = `supplier_leadtimes_${record.supplierId}`;
  const existing = await AsyncStorage.getItem(key);
  const records: LeadTimeRecord[] = existing ? JSON.parse(existing) : [];
  records.push(fullRecord);

  await AsyncStorage.setItem(key, JSON.stringify(records));
  return fullRecord;
}

export async function getLeadTimeRecords(supplierId: string): Promise<LeadTimeRecord[]> {
  const key = `supplier_leadtimes_${supplierId}`;
  const data = await AsyncStorage.getItem(key);
  return data ? JSON.parse(data) : [];
}

// ── Negotiated Terms ──────────────────────────────────────────────────────────

export async function saveNegotiatedTerms(
  supplierId: string,
  terms: Omit<NegotiatedTerms, 'supplierId' | 'dateAgreed'>,
): Promise<NegotiatedTerms> {
  const fullTerms: NegotiatedTerms = {
    ...terms,
    supplierId,
    dateAgreed: new Date().toISOString(),
  };

  const key = `supplier_terms_${supplierId}`;
  await AsyncStorage.setItem(key, JSON.stringify(fullTerms));
  return fullTerms;
}

export async function getNegotiatedTerms(supplierId: string): Promise<NegotiatedTerms | null> {
  const key = `supplier_terms_${supplierId}`;
  const data = await AsyncStorage.getItem(key);
  return data ? JSON.parse(data) : null;
}

// ── Supplier Comparison ───────────────────────────────────────────────────────

export async function createComparison(supplierId1: string, supplierId2: string, productName: string): Promise<SupplierComparison> {
  // Fetch profiles and create comparison with actual data
  const profile1 = await getSupplierProfile(supplierId1);
  const profile2 = await getSupplierProfile(supplierId2);

  const comparison: SupplierComparison = {
    productName,
    suppliersComparing: [supplierId1, supplierId2],
    metrics: {
      [supplierId1]: {
        pricePerUnit: profile1 ? parseFloat(profile1.price) : 5,
        moq: profile1 ? parseFloat(profile1.moq) : 100,
        leadTimeDays: 21,
        qualityGrade: profile1?.verified ? 'A' : 'unknown',
        certifications: [],
        trustScore: profile1?.verified ? 75 : 50,
        yearsInBusiness: 5,
      },
      [supplierId2]: {
        pricePerUnit: profile2 ? parseFloat(profile2.price) : 6,
        moq: profile2 ? parseFloat(profile2.moq) : 150,
        leadTimeDays: 28,
        qualityGrade: profile2?.verified ? 'A' : 'unknown',
        certifications: [],
        trustScore: profile2?.verified ? 75 : 50,
        yearsInBusiness: 3,
      },
    },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const key = `supplier_comparison_${supplierId1}_${supplierId2}`;
  await AsyncStorage.setItem(key, JSON.stringify(comparison));
  return comparison;
}

export async function getComparison(supplierId1: string, supplierId2: string): Promise<SupplierComparison | null> {
  const key = `supplier_comparison_${supplierId1}_${supplierId2}`;
  const data = await AsyncStorage.getItem(key);
  return data ? JSON.parse(data) : null;
}

export async function scoreSuppliers(supplierIds: string[]): Promise<SupplierScorecard[]> {
  // Implement basic scoring algorithm
  // Score based on: price (40%), quality (25%), reliability (20%), lead time (15%)
  const scorecards: SupplierScorecard[] = [];

  for (const supplierId of supplierIds) {
    const profile = await getSupplierProfile(supplierId);
    if (!profile) continue;

    // Calculate composite score (0-100)
    const priceScore = 70; // Default score
    const qualityScore = profile.verified ? 85 : 60;
    const reliabilityScore = 75;
    const leadTimeScore = 80;

    const compositeScore = (priceScore * 0.4 + qualityScore * 0.25 + reliabilityScore * 0.2 + leadTimeScore * 0.15);

    scorecards.push({
      supplierId,
      supplierName: profile.name,
      metrics: {
        priceScore,
        moqScore: 70,
        leadTimeScore,
        qualityScore,
        trustScore: profile.verified ? 80 : 55,
        reliabilityScore,
      },
      weightedScore: Math.round(compositeScore),
      recommendation:
        compositeScore >= 85 ? 'top_choice' :
        compositeScore >= 75 ? 'good_alternative' :
        compositeScore >= 60 ? 'backup_option' : 'not_recommended',
      reasoning: `Composite score ${Math.round(compositeScore)}/100 based on price, quality, reliability, and lead time.`,
    });
  }

  return scorecards;
}

// ── Supplier Profile ──────────────────────────────────────────────────────────

export async function getSupplierProfile(supplierId: string): Promise<SupplierProfile | null> {
  const key = `supplier_profile_${supplierId}`;
  const data = await AsyncStorage.getItem(key);
  return data ? JSON.parse(data) : null;
}

export async function updateSupplierProfile(supplierId: string, updates: Partial<SupplierProfile>): Promise<SupplierProfile> {
  let profile = await getSupplierProfile(supplierId);
  if (!profile) {
    profile = {
      id: supplierId,
      name: 'Unknown',
      platform: 'unknown',
      price: '0',
      moq: '0',
      verified: false,
      country: 'CN',
      source: 'unknown',
      addedToVault: new Date().toISOString(),
      status: 'prospect',
      lastUpdated: new Date().toISOString(),
    };
  }

  const updated: SupplierProfile = {
    ...profile,
    ...updates,
    lastUpdated: new Date().toISOString(),
  };

  const key = `supplier_profile_${supplierId}`;
  await AsyncStorage.setItem(key, JSON.stringify(updated));
  return updated;
}

// ── Bulk Operations ───────────────────────────────────────────────────────────

export async function getAllSupplierProfiles(): Promise<SupplierProfile[]> {
  const allKeys = await AsyncStorage.getAllKeys();
  const profileKeys = allKeys.filter(k => k.startsWith('supplier_profile_'));

  const profiles: SupplierProfile[] = [];
  for (const key of profileKeys) {
    const data = await AsyncStorage.getItem(key);
    if (data) profiles.push(JSON.parse(data));
  }

  return profiles;
}

export async function deleteSupplier(supplierId: string): Promise<void> {
  // Delete all supplier-related data
  const keys = [
    `supplier_profile_${supplierId}`,
    `supplier_vetting_${supplierId}`,
    `supplier_comm_${supplierId}`,
    `supplier_samples_${supplierId}`,
    `supplier_rating_${supplierId}`,
    `supplier_leadtimes_${supplierId}`,
    `supplier_terms_${supplierId}`,
  ];

  await AsyncStorage.multiRemove(keys);
}

// ── Export for Backend Integration ────────────────────────────────────────────

/**
 * When Alibaba API is ready:
 * 1. Implement sync() function to push all data to backend
 * 2. Implement pull() function to fetch supplier data from backend
 * 3. Add conflict resolution for offline changes
 *
 * Example backend endpoints:
 * POST /supplier/{supplierId}/vetting
 * GET /supplier/{supplierId}/vetting
 * POST /supplier/{supplierId}/communication
 * GET /supplier/{supplierId}/communication
 * POST /supplier/{supplierId}/samples
 * GET /supplier/{supplierId}/samples
 * POST /supplier/{supplierId}/rating
 * GET /supplier/{supplierId}/rating
 * POST /supplier/{supplierId}/leadtimes
 * GET /supplier/{supplierId}/leadtimes
 * POST /supplier/{supplierId}/terms
 * GET /supplier/{supplierId}/terms
 * GET /supplier/{supplierId}/profile
 */

export async function syncWithBackend(): Promise<void> {
  // Sync will be implemented when backend Alibaba API is ready
  if (__DEV__) {
    console.log('[Supplier Service] Sync not yet implemented. Waiting for Alibaba API.');
  }
}
