import { useState, useCallback } from 'react';

export function useToast() {
  const [toastMsg,     setToastMsg]     = useState('');
  const [toastVisible, setToastVisible] = useState(false);
  const [toastType,    setToastType]    = useState<'success' | 'info' | 'error'>('success');

  const showToast = useCallback((message: string, type: 'success' | 'info' | 'error' = 'success') => {
    setToastMsg(message);
    setToastType(type);
    setToastVisible(true);
  }, []);

  const hideToast = useCallback(() => setToastVisible(false), []);

  return { toastMsg, toastVisible, toastType, showToast, hideToast };
}
