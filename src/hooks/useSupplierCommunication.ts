/**
 * useSupplierCommunication Hook
 * Simplified communication management with auto-logging
 * Wraps useSupplierManagement for message-specific operations
 */

import { useState, useCallback } from 'react';
import { useSupplierManagement } from './useSupplierManagement';
import { autoLogOutboundEmail } from '../components/SupplierMessageForm';

interface UseSupplierCommunicationState {
  messageModalVisible: boolean;
  selectedSupplierId: string | null;
  selectedSupplierName: string | null;
  loading: boolean;
  error: string | null;
}

export function useSupplierCommunication() {
  const { logMessage, getCommunication, loading, error } = useSupplierManagement();

  const [state, setState] = useState<UseSupplierCommunicationState>({
    messageModalVisible: false,
    selectedSupplierId: null,
    selectedSupplierName: null,
    loading: false,
    error: null,
  });

  // ── MODAL CONTROL ────────────────────────────────────────────────────────

  const openMessageForm = useCallback(
    (supplierId: string, supplierName: string) => {
      setState(prev => ({
        ...prev,
        messageModalVisible: true,
        selectedSupplierId: supplierId,
        selectedSupplierName: supplierName,
      }));
    },
    [],
  );

  const closeMessageForm = useCallback(() => {
    setState(prev => ({
      ...prev,
      messageModalVisible: false,
      selectedSupplierId: null,
      selectedSupplierName: null,
    }));
  }, []);

  // ── AUTO-LOG OUTBOUND EMAIL ──────────────────────────────────────────────

  /**
   * When user clicks "Generate Email", auto-log it as outbound
   * Then show toast and copy to clipboard
   */
  const logGeneratedEmail = useCallback(
    async (
      supplierId: string,
      email: { subject: string; body: string }
    ): Promise<{ success: boolean; error?: string }> => {
      setState(prev => ({ ...prev, loading: true, error: null }));

      try {
        await autoLogOutboundEmail(logMessage, supplierId, email);
        setState(prev => ({ ...prev, loading: false }));
        return { success: true };
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to log email';
        setState(prev => ({ ...prev, loading: false, error: errorMessage }));
        return { success: false, error: errorMessage };
      }
    },
    [logMessage],
  );

  // ── GET COMMUNICATION HISTORY ────────────────────────────────────────────

  const getHistory = useCallback(
    async (supplierId: string) => {
      setState(prev => ({ ...prev, loading: true, error: null }));

      try {
        const history = await getCommunication(supplierId);
        setState(prev => ({ ...prev, loading: false }));
        return history;
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to get history';
        setState(prev => ({ ...prev, loading: false, error: errorMessage }));
        return null;
      }
    },
    [getCommunication],
  );

  // ── LOG MESSAGE DIRECTLY ─────────────────────────────────────────────────

  const logReply = useCallback(
    async (
      supplierId: string,
      message: {
        type: 'email' | 'call' | 'note';
        direction: 'inbound' | 'outbound';
        subject?: string;
        body: string;
        tags?: string[];
      }
    ): Promise<{ success: boolean; error?: string }> => {
      setState(prev => ({ ...prev, loading: true, error: null }));

      try {
        await logMessage(supplierId, message);
        setState(prev => ({ ...prev, loading: false }));
        return { success: true };
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to log message';
        setState(prev => ({ ...prev, loading: false, error: errorMessage }));
        return { success: false, error: errorMessage };
      }
    },
    [logMessage],
  );

  return {
    // State
    messageModalVisible: state.messageModalVisible,
    selectedSupplierId: state.selectedSupplierId,
    selectedSupplierName: state.selectedSupplierName,
    loading: state.loading,
    error: state.error,

    // Methods
    openMessageForm,
    closeMessageForm,
    logGeneratedEmail,
    getHistory,
    logReply,
  };
}

/**
 * Helper hook for a single supplier's conversation
 * Use this in supplier detail screens
 */
export function useSupplierConversation(supplierId: string) {
  const { getCommunication, logMessage } = useSupplierManagement();
  const [messages, setMessages] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadMessages = async () => {
    setLoading(true);
    setError(null);
    try {
      const history = await getCommunication(supplierId);
      setMessages(history?.messages || []);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load messages';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const addMessage = async (message: {
    type: 'email' | 'call' | 'note';
    direction: 'inbound' | 'outbound';
    subject?: string;
    body: string;
    tags?: string[];
  }) => {
    setError(null);
    try {
      await logMessage(supplierId, message);
      await loadMessages(); // Refresh
      return { success: true };
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to add message';
      setError(errorMessage);
      return { success: false, error: errorMessage };
    }
  };

  return {
    messages,
    loading,
    error,
    loadMessages,
    addMessage,
  };
}
