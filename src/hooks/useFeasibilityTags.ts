import { useState, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { STORAGE_KEYS } from '../constants/storage';
import type { FeasibilityTag, FeasibilityTagType } from '../types/feasibilityReport';

function uid(): string {
  return `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

export function useFeasibilityTags() {
  const [tags, setTags] = useState<FeasibilityTag[]>([]);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEYS.feasibilityTags)
      .then(raw => { if (raw) setTags(JSON.parse(raw)); })
      .catch(() => {});
  }, []);

  const persist = useCallback((next: FeasibilityTag[]) => {
    setTags(next);
    AsyncStorage.setItem(STORAGE_KEYS.feasibilityTags, JSON.stringify(next)).catch(() => {});
  }, []);

  const addTag = useCallback((
    productAsin: string,
    productTitle: string,
    type: FeasibilityTagType,
    label: string,
    data: Record<string, unknown>,
  ) => {
    setTags(prev => {
      // Replace existing tag of same type for same product
      const filtered = prev.filter(t => !(t.productAsin === productAsin && t.type === type));
      const next: FeasibilityTag[] = [
        ...filtered,
        { id: uid(), productAsin, productTitle, type, label, savedAt: new Date().toISOString(), data },
      ];
      AsyncStorage.setItem(STORAGE_KEYS.feasibilityTags, JSON.stringify(next)).catch(() => {});
      return next;
    });
  }, []);

  const removeTag = useCallback((id: string) => {
    setTags(prev => {
      const next = prev.filter(t => t.id !== id);
      AsyncStorage.setItem(STORAGE_KEYS.feasibilityTags, JSON.stringify(next)).catch(() => {});
      return next;
    });
  }, []);

  const tagsForProduct = useCallback((asin: string) =>
    tags.filter(t => t.productAsin === asin), [tags]);

  const hasTag = useCallback((productAsin: string, type: FeasibilityTagType) =>
    tags.some(t => t.productAsin === productAsin && t.type === type), [tags]);

  // Products that have at least one tag — for the report screen
  const taggedProducts = (() => {
    const seen = new Map<string, { asin: string; title: string; count: number }>();
    for (const t of tags) {
      const existing = seen.get(t.productAsin);
      if (existing) existing.count++;
      else seen.set(t.productAsin, { asin: t.productAsin, title: t.productTitle, count: 1 });
    }
    return Array.from(seen.values());
  })();

  return { tags, addTag, removeTag, tagsForProduct, hasTag, taggedProducts };
}
