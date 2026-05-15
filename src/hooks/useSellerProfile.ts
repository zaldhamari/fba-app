import { useState, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { STORAGE_KEYS } from '../constants/storage';
import type { SellerProfile, ResearchFilters } from '../types/sellerProfile';
import { profileToFilters } from '../types/sellerProfile';

export function useSellerProfile() {
  const [profile, setProfile] = useState<SellerProfile | null>(null);
  const [loaded,  setLoaded]  = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEYS.sellerProfile)
      .then(raw => { if (raw) setProfile(JSON.parse(raw)); })
      .catch(() => {})
      .finally(() => setLoaded(true));
  }, []);

  const saveProfile = useCallback(async (p: SellerProfile) => {
    await AsyncStorage.setItem(STORAGE_KEYS.sellerProfile, JSON.stringify(p));
    setProfile(p);
  }, []);

  const clearProfile = useCallback(async () => {
    await AsyncStorage.removeItem(STORAGE_KEYS.sellerProfile);
    setProfile(null);
  }, []);

  const defaultFilters: ResearchFilters | null = profile ? profileToFilters(profile) : null;

  return { profile, loaded, saveProfile, clearProfile, defaultFilters };
}
