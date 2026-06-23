/**
 * useSupplierManagement Hook
 * Comprehensive supplier management interface for frontend components
 * Abstracts: vetting, communication, sampling, ratings, lead times, negotiations, comparisons
 */

import { useState, useCallback } from 'react';
import {
  createVettingChecklist,
  getVettingChecklist,
  updateVettingChecklist,
  getCommunicationHistory,
  addMessage,
  getSamples,
  requestSample,
  updateSample,
  getSupplierRating,
  rateSupplier,
  getLeadTimeRecords,
  recordLeadTime,
  getNegotiatedTerms,
  saveNegotiatedTerms,
  getSupplierProfile,
  updateSupplierProfile,
  getAllSupplierProfiles,
  deleteSupplier,
} from '../services/supplierService';
import type {
  SupplierVettingChecklist,
  SupplierCommunicationHistory,
  SupplierSample,
  SupplierRating,
  LeadTimeRecord,
  NegotiatedTerms,
  SupplierProfile,
} from '../types/supplier';

interface UseSupplierManagementState {
  loading: boolean;
  error: string | null;
}

export function useSupplierManagement() {
  const [state, setState] = useState<UseSupplierManagementState>({
    loading: false,
    error: null,
  });

  // ── VETTING ───────────────────────────────────────────────────────────────

  const startVetting = useCallback(
    async (supplierId: string, supplierName: string, product: string) => {
      setState({ loading: true, error: null });
      try {
        const result = await createVettingChecklist(supplierId, supplierName, product);
        return result;
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to start vetting';
        setState({ loading: false, error: message });
        throw error;
      } finally {
        setState(prev => ({ ...prev, loading: false }));
      }
    },
    [],
  );

  const getVetting = useCallback(async (supplierId: string) => {
    setState({ loading: true, error: null });
    try {
      return await getVettingChecklist(supplierId);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to get vetting';
      setState({ loading: false, error: message });
      return null;
    } finally {
      setState(prev => ({ ...prev, loading: false }));
    }
  }, []);

  const updateVetting = useCallback(
    async (supplierId: string, updates: Partial<SupplierVettingChecklist>) => {
      setState({ loading: true, error: null });
      try {
        return await updateVettingChecklist(supplierId, updates);
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to update vetting';
        setState({ loading: false, error: message });
        throw error;
      } finally {
        setState(prev => ({ ...prev, loading: false }));
      }
    },
    [],
  );

  // ── COMMUNICATION ─────────────────────────────────────────────────────────

  const getCommunication = useCallback(async (supplierId: string) => {
    setState({ loading: true, error: null });
    try {
      return await getCommunicationHistory(supplierId);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to get communication history';
      setState({ loading: false, error: message });
      return null;
    } finally {
      setState(prev => ({ ...prev, loading: false }));
    }
  }, []);

  const logMessage = useCallback(
    async (
      supplierId: string,
      message: Omit<any, 'id' | 'timestamp'>,
    ) => {
      setState({ loading: true, error: null });
      try {
        return await addMessage(supplierId, message);
      } catch (error) {
        const message_err = error instanceof Error ? error.message : 'Failed to add message';
        setState({ loading: false, error: message_err });
        throw error;
      } finally {
        setState(prev => ({ ...prev, loading: false }));
      }
    },
    [],
  );

  // ── SAMPLES ───────────────────────────────────────────────────────────────

  const requestNewSample = useCallback(
    async (sample: Omit<SupplierSample, 'id'>) => {
      setState({ loading: true, error: null });
      try {
        return await requestSample(sample);
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to request sample';
        setState({ loading: false, error: message });
        throw error;
      } finally {
        setState(prev => ({ ...prev, loading: false }));
      }
    },
    [],
  );

  const getAllSamples = useCallback(async (supplierId: string) => {
    setState({ loading: true, error: null });
    try {
      return await getSamples(supplierId);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to get samples';
      setState({ loading: false, error: message });
      return [];
    } finally {
      setState(prev => ({ ...prev, loading: false }));
    }
  }, []);

  const updateSampleStatus = useCallback(
    async (
      supplierId: string,
      sampleId: string,
      updates: Partial<SupplierSample>,
    ) => {
      setState({ loading: true, error: null });
      try {
        return await updateSample(supplierId, sampleId, updates);
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to update sample';
        setState({ loading: false, error: message });
        throw error;
      } finally {
        setState(prev => ({ ...prev, loading: false }));
      }
    },
    [],
  );

  // ── RATINGS ───────────────────────────────────────────────────────────────

  const submitRating = useCallback(
    async (
      supplierId: string,
      rating: Omit<SupplierRating, 'dateRated'>,
    ) => {
      setState({ loading: true, error: null });
      try {
        return await rateSupplier(supplierId, rating);
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to submit rating';
        setState({ loading: false, error: message });
        throw error;
      } finally {
        setState(prev => ({ ...prev, loading: false }));
      }
    },
    [],
  );

  const getRating = useCallback(async (supplierId: string) => {
    setState({ loading: true, error: null });
    try {
      return await getSupplierRating(supplierId);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to get rating';
      setState({ loading: false, error: message });
      return null;
    } finally {
      setState(prev => ({ ...prev, loading: false }));
    }
  }, []);

  // ── LEAD TIMES ────────────────────────────────────────────────────────────

  const recordNewLeadTime = useCallback(
    async (record: Omit<LeadTimeRecord, 'id'>) => {
      setState({ loading: true, error: null });
      try {
        return await recordLeadTime(record);
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to record lead time';
        setState({ loading: false, error: message });
        throw error;
      } finally {
        setState(prev => ({ ...prev, loading: false }));
      }
    },
    [],
  );

  const getLeadTimes = useCallback(async (supplierId: string) => {
    setState({ loading: true, error: null });
    try {
      return await getLeadTimeRecords(supplierId);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to get lead times';
      setState({ loading: false, error: message });
      return [];
    } finally {
      setState(prev => ({ ...prev, loading: false }));
    }
  }, []);

  // ── NEGOTIATIONS ──────────────────────────────────────────────────────────

  const saveTerms = useCallback(
    async (
      supplierId: string,
      terms: Omit<NegotiatedTerms, 'supplierId' | 'dateAgreed'>,
    ) => {
      setState({ loading: true, error: null });
      try {
        return await saveNegotiatedTerms(supplierId, terms);
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to save terms';
        setState({ loading: false, error: message });
        throw error;
      } finally {
        setState(prev => ({ ...prev, loading: false }));
      }
    },
    [],
  );

  const getTerms = useCallback(async (supplierId: string) => {
    setState({ loading: true, error: null });
    try {
      return await getNegotiatedTerms(supplierId);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to get terms';
      setState({ loading: false, error: message });
      return null;
    } finally {
      setState(prev => ({ ...prev, loading: false }));
    }
  }, []);

  // ── PROFILES ──────────────────────────────────────────────────────────────

  const getProfile = useCallback(async (supplierId: string) => {
    setState({ loading: true, error: null });
    try {
      return await getSupplierProfile(supplierId);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to get profile';
      setState({ loading: false, error: message });
      return null;
    } finally {
      setState(prev => ({ ...prev, loading: false }));
    }
  }, []);

  const updateProfile = useCallback(
    async (supplierId: string, updates: Partial<SupplierProfile>) => {
      setState({ loading: true, error: null });
      try {
        return await updateSupplierProfile(supplierId, updates);
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to update profile';
        setState({ loading: false, error: message });
        throw error;
      } finally {
        setState(prev => ({ ...prev, loading: false }));
      }
    },
    [],
  );

  const getAllProfiles = useCallback(async () => {
    setState({ loading: true, error: null });
    try {
      return await getAllSupplierProfiles();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to get all profiles';
      setState({ loading: false, error: message });
      return [];
    } finally {
      setState(prev => ({ ...prev, loading: false }));
    }
  }, []);

  const removeSupplier = useCallback(async (supplierId: string) => {
    setState({ loading: true, error: null });
    try {
      await deleteSupplier(supplierId);
      return { success: true };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to delete supplier';
      setState({ loading: false, error: message });
      throw error;
    } finally {
      setState(prev => ({ ...prev, loading: false }));
    }
  }, []);

  return {
    // State
    loading: state.loading,
    error: state.error,

    // Vetting
    startVetting,
    getVetting,
    updateVetting,

    // Communication
    getCommunication,
    logMessage,

    // Samples
    requestNewSample,
    getAllSamples,
    updateSampleStatus,

    // Ratings
    submitRating,
    getRating,

    // Lead Times
    recordNewLeadTime,
    getLeadTimes,

    // Negotiations
    saveTerms,
    getTerms,

    // Profiles
    getProfile,
    updateProfile,
    getAllProfiles,
    removeSupplier,
  };
}
