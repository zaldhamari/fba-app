import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, TouchableOpacity, Modal, StyleSheet, ScrollView, Alert, Linking, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, CommonActions } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { spacing, radius } from '../theme';
import { DS } from './ds';
import { STORAGE_KEYS } from '../constants/storage';
import { useSubscription } from '../hooks/useSubscription';
import { useAuth, authActions } from '../hooks/useAuth';
import { anonymizeUser, identifyUser } from '../lib/revenuecat';
import { CurrencyRegionPicker } from './CurrencySelector';
import { AskPageAIModal } from './AskPageAIModal';
import type { FeatureKey } from '../lib/featureHelp';

// All keys cleared on sign-out — everything except the device-level onboarding flag.
const SIGN_OUT_KEYS = Object.values(STORAGE_KEYS).filter(
  k => k !== STORAGE_KEYS.onboardingDone,
);
// Delete account clears everything including onboarding.
const DELETE_ACCOUNT_KEYS = Object.values(STORAGE_KEYS);

const APP_VERSION = '1.0.0';

interface AppHeaderProps {
  helpKey?: FeatureKey;
}

export function AppHeader({ helpKey }: AppHeaderProps = {}) {
  const [showSettings,    setShowSettings]    = useState(false);
  const [signingOut,      setSigningOut]      = useState(false);
  const [deletingAccount, setDeletingAccount] = useState(false);
  const [refreshing,      setRefreshing]      = useState(false);
  const [refreshMsg,      setRefreshMsg]      = useState<string | null>(null);
  const { tier, subscriptionStale, refreshSubscription, syncUsage } = useSubscription();
  const { user, loading: authLoading } = useAuth();
  const navigation = useNavigation<any>();
  const hasHadSessionRef = useRef(false);

  // Track first successful session so we can detect unexpected sign-out later.
  // On the first session (covers cold-start restore and explicit login): identify the
  // RC customer with the Supabase user ID so entitlements are linked, then re-verify.
  // Without this, a reinstalled app runs RC as anonymous and misses paid entitlements.
  useEffect(() => {
    if (!authLoading && user) {
      if (!hasHadSessionRef.current) {
        identifyUser(user.id)
          .then(() => refreshSubscription())
          .catch(() => {/* RC unavailable — cached tier remains */});
        syncUsage();
      }
      hasHadSessionRef.current = true;
    }
  }, [authLoading, user]);

  // Redirect to Auth when session is lost externally (token expiry / server revocation)
  useEffect(() => {
    if (!authLoading && !user && hasHadSessionRef.current && !signingOut && !deletingAccount) {
      setShowSettings(false);
      navigation.dispatch(CommonActions.reset({ index: 0, routes: [{ name: 'Auth' }] }));
    }
  }, [authLoading, user, signingOut, deletingAccount]);

  const tierLabel = tier === 'operator' ? 'OPERATOR' : tier === 'builder' ? 'BUILDER' : 'EXPLORER';
  const tierColor = tier === 'operator' ? DS.accentDark : tier === 'builder' ? DS.accent : DS.textMuted;

  async function handleRefreshSubscription() {
    setRefreshing(true);
    setRefreshMsg(null);
    const ok = await refreshSubscription();
    setRefreshing(false);
    setRefreshMsg(ok
      ? 'Subscription verified.'
      : 'Could not reach RevenueCat — check your connection.');
    setTimeout(() => setRefreshMsg(null), 4000);
  }

  async function handleSignOut() {
    setSigningOut(true);
    try {
      // Return RevenueCat to anonymous mode before clearing Supabase session.
      try { await anonymizeUser(); } catch { /* RC unavailable — proceed */ }

      await authActions.signOut();
      // Clear all user data — SIGN_OUT_KEYS covers every key in STORAGE_KEYS
      // except fba_onboarding_v3 (device-level flag, persists across accounts).
      // Legacy keys that predate STORAGE_KEYS are also cleared here.
      await AsyncStorage.multiRemove([
        ...SIGN_OUT_KEYS,
        // Runtime dev unlock — cleared on every sign-out so it cannot persist across accounts
        'siftly_dev_unlock_v1',
        // Legacy keys removed in prior schema versions
        'fba_saved_ideas_v1', 'fba_journey_v5', 'fba_vault_v2',
      ]);
      // Tier keys live in SecureStore — must be deleted separately.
      await Promise.all(
        ['fba_tier_v3', 'fba_tier_verified_at_v1', 'siftly_dev_unlock_v1']
          .map(k => SecureStore.deleteItemAsync(k).catch(() => {})),
      );
      setShowSettings(false);
      navigation.dispatch(CommonActions.reset({ index: 0, routes: [{ name: 'Auth' }] }));
    } catch { setSigningOut(false); }
  }

  function handleDeleteAccount() {
    Alert.alert(
      'Delete Account',
      'This will permanently delete your account and all associated data. This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete Account',
          style: 'destructive',
          onPress: async () => {
            setDeletingAccount(true);
            try {
              try { await anonymizeUser(); } catch { /* RC unavailable — proceed */ }
              await authActions.deleteAccount();
              // Delete account clears everything including the device-level onboarding flag.
              await AsyncStorage.multiRemove([
                ...DELETE_ACCOUNT_KEYS,
                // Keys added after STORAGE_KEYS was defined — must be listed explicitly.
                'siftly_dev_unlock_v1',      // runtime dev unlock (Group A)
                'fba_tier_verified_at_v1',   // subscription verification timestamp (Group A)
                // Legacy keys removed in prior schema versions
                'fba_saved_ideas_v1', 'fba_journey_v5', 'fba_vault_v2',
              ]);
              // Tier keys live in SecureStore — must be deleted separately.
              await Promise.all(
                ['fba_tier_v3', 'fba_tier_verified_at_v1', 'siftly_dev_unlock_v1']
                  .map(k => SecureStore.deleteItemAsync(k).catch(() => {})),
              );
              setShowSettings(false);
              navigation.dispatch(CommonActions.reset({ index: 0, routes: [{ name: 'Auth' }] }));
            } catch (e: any) {
              Alert.alert('Error', e?.message ?? 'Could not delete account. Please try again.');
              setDeletingAccount(false);
            }
          },
        },
      ],
    );
  }

  async function handleResetOnboarding() {
    await AsyncStorage.removeItem(STORAGE_KEYS.onboardingDone);
    setShowSettings(false);
    navigation.dispatch(CommonActions.reset({ index: 0, routes: [{ name: 'Onboarding' }] }));
  }

  function navLegal(type: 'privacy' | 'terms') {
    setShowSettings(false);
    setTimeout(() => navigation.navigate('Legal', { type }), 300);
  }

  return (
    <>
      {/* ── Settings sheet ─────────────────────────────────── */}
      <Modal
        visible={showSettings}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowSettings(false)}
      >
        <SafeAreaView style={h.sheet}>
          <TouchableOpacity
            style={h.closeRow}
            onPress={() => setShowSettings(false)}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel="Close settings"
          >
            <Text style={h.closeText}>✕</Text>
          </TouchableOpacity>

          <View style={h.brandBlock}>
            <View style={h.brandOrb} />
            <Text style={h.brandName}>Siftly</Text>
            <Text style={h.brandTag}>Built for modern independence.</Text>
          </View>

          <ScrollView showsVerticalScrollIndicator={false}>
            {/* ── Plan ───────────────────────────────────────── */}
            <View style={h.section}>
              <Text style={h.sectionLabel}>YOUR PLAN</Text>
              <View style={[h.planBadge, { borderColor: tierColor + '40', backgroundColor: tierColor + '10' }]}>
                <View style={[h.dot, { backgroundColor: tierColor }]} />
                <Text style={[h.planText, { color: tierColor }]}>{tierLabel}</Text>
              </View>

              {tier === 'operator' && (
                <>
                  <Text style={h.planSub}>Full access — every feature, no limits.</Text>
                  {(['AI Advisor · unlimited', 'Research & suppliers · unlimited', 'Launch Decision', 'Brand Studio', 'Launch Plan'] as string[]).map(f => (
                    <View key={f} style={h.featureRow}>
                      <Text style={[h.featureDot, { color: tierColor }]}>✓</Text>
                      <Text style={h.featureText}>{f}</Text>
                    </View>
                  ))}
                </>
              )}

              {tier === 'builder' && (
                <>
                  <Text style={h.planSub}>Core tools unlocked. Upgrade for full access.</Text>
                  {(['AI Advisor', 'Research & suppliers', 'Launch Plan'] as string[]).map(f => (
                    <View key={f} style={h.featureRow}>
                      <Text style={[h.featureDot, { color: tierColor }]}>✓</Text>
                      <Text style={h.featureText}>{f}</Text>
                    </View>
                  ))}
                  {(['Launch Decision', 'Brand Studio · full access'] as string[]).map(f => (
                    <View key={f} style={h.featureRow}>
                      <Text style={h.featureDotLocked}>✕</Text>
                      <Text style={h.featureTextLocked}>{f}</Text>
                    </View>
                  ))}
                  <TouchableOpacity
                    style={[h.upgradeBtn, { backgroundColor: tierColor }]}
                    onPress={() => { setShowSettings(false); setTimeout(() => navigation.navigate('Paywall'), 300); }}
                    activeOpacity={0.85}
                  >
                    <Text style={h.upgradeTxt}>Upgrade to Operator →</Text>
                  </TouchableOpacity>
                </>
              )}

              {tier === 'explorer' && (
                <>
                  <Text style={h.planSub}>Free tier — limited usage across all tools.</Text>
                  {(['Basic Research', 'Basic AI Advisor', 'Launch Plan'] as string[]).map(f => (
                    <View key={f} style={h.featureRow}>
                      <Text style={[h.featureDot, { color: tierColor }]}>✓</Text>
                      <Text style={h.featureText}>{f}</Text>
                    </View>
                  ))}
                  {(['Launch Decision', 'Brand Studio', 'Unlimited suppliers'] as string[]).map(f => (
                    <View key={f} style={h.featureRow}>
                      <Text style={h.featureDotLocked}>✕</Text>
                      <Text style={h.featureTextLocked}>{f}</Text>
                    </View>
                  ))}
                  <TouchableOpacity
                    style={[h.upgradeBtn, { backgroundColor: DS.accent }]}
                    onPress={() => { setShowSettings(false); setTimeout(() => navigation.navigate('Paywall'), 300); }}
                    activeOpacity={0.85}
                  >
                    <Text style={h.upgradeTxt}>Unlock Full Access →</Text>
                  </TouchableOpacity>
                </>
              )}

              {/* ── Refresh Subscription ─────────────────────── */}
              <TouchableOpacity
                style={[h.refreshBtn, refreshing && { opacity: 0.5 }]}
                onPress={handleRefreshSubscription}
                disabled={refreshing}
                activeOpacity={0.8}
              >
                <Text style={h.refreshTxt}>{refreshing ? 'Checking…' : '↻  Refresh Subscription'}</Text>
              </TouchableOpacity>
              {refreshMsg ? <Text style={h.refreshMsg}>{refreshMsg}</Text> : null}
            </View>

            {/* ── Region & Currency ─────────────────────────── */}
            <View style={h.section}>
              <Text style={h.sectionLabel}>REGION & CURRENCY</Text>
              <CurrencyRegionPicker />
            </View>

            {/* ── Account ────────────────────────────────────── */}
            {user && (
              <View style={h.section}>
                <Text style={h.sectionLabel}>ACCOUNT</Text>
                <Text style={h.email} numberOfLines={1}>{user.email}</Text>

                {/* Apple guideline 3.1.2 — must link to subscription management */}
                {Platform.OS === 'ios' && (
                  <TouchableOpacity
                    style={h.manageSubRow}
                    onPress={() => Linking.openURL('itms-apps://apps.apple.com/account/subscriptions')}
                    activeOpacity={0.7}
                  >
                    <Text style={h.manageSubTxt}>Manage Subscription</Text>
                    <Text style={h.linkArrow}>→</Text>
                  </TouchableOpacity>
                )}

                {subscriptionStale && (
                  <View style={h.staleBanner}>
                    <Text style={h.staleBannerText}>
                      ⚠️ Subscription could not be verified — connect to the internet and reopen the app to restore access.
                    </Text>
                  </View>
                )}
                <TouchableOpacity
                  style={[h.signOutBtn, signingOut && { opacity: 0.5 }]}
                  onPress={handleSignOut}
                  disabled={signingOut}
                  activeOpacity={0.8}
                >
                  <Text style={h.signOutText}>{signingOut ? 'Signing out…' : 'Sign Out'}</Text>
                </TouchableOpacity>
                <Text style={h.deleteHint}>
                  Permanently removes your account and all associated data. This cannot be undone.
                </Text>
                <TouchableOpacity
                  style={[h.deleteBtn, deletingAccount && { opacity: 0.5 }]}
                  onPress={handleDeleteAccount}
                  disabled={deletingAccount}
                  activeOpacity={0.8}
                >
                  <Text style={h.deleteText}>{deletingAccount ? 'Deleting…' : 'Delete Account'}</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* ── Dev Tools (bypass only) ────────────────────── */}
            {process.env.EXPO_PUBLIC_DEV_BYPASS === 'true' && (
              <View style={h.section}>
                <Text style={[h.sectionLabel, { color: DS.warning }]}>DEV TOOLS</Text>
                <TouchableOpacity style={h.devBtn} onPress={handleResetOnboarding} activeOpacity={0.8}>
                  <Text style={h.devBtnText}>↺  Reset Onboarding</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* ── Explore ────────────────────────────────────── */}
            <View style={h.section}>
              <Text style={h.sectionLabel}>EXPLORE</Text>
              <TouchableOpacity
                style={h.linkRow}
                onPress={() => { setShowSettings(false); setTimeout(() => navigation.navigate('ProductBlueprint' as any), 300); }}
                activeOpacity={0.7}
              >
                <Text style={h.linkText}>Product Blueprint</Text>
                <Text style={h.linkArrow}>→</Text>
              </TouchableOpacity>
              <View style={h.divider} />
              <TouchableOpacity
                style={h.linkRow}
                onPress={() => { setShowSettings(false); setTimeout(() => navigation.navigate('BrandStudio' as any), 300); }}
                activeOpacity={0.7}
              >
                <Text style={h.linkText}>Brand Studio</Text>
                <Text style={h.linkArrow}>→</Text>
              </TouchableOpacity>
              <View style={h.divider} />
              <TouchableOpacity
                style={h.linkRow}
                onPress={() => { setShowSettings(false); setTimeout(() => navigation.navigate('LaunchDecision' as any), 300); }}
                activeOpacity={0.7}
              >
                <Text style={h.linkText}>Launch Decision</Text>
                <Text style={h.linkArrow}>→</Text>
              </TouchableOpacity>
              <View style={h.divider} />
              <TouchableOpacity
                style={h.linkRow}
                onPress={() => { setShowSettings(false); setTimeout(() => navigation.navigate('Checklist' as any), 300); }}
                activeOpacity={0.7}
              >
                <Text style={h.linkText}>Launch Plan</Text>
                <Text style={h.linkArrow}>→</Text>
              </TouchableOpacity>
            </View>

            {/* ── Legal ──────────────────────────────────────── */}
            <View style={h.section}>
              <Text style={h.sectionLabel}>LEGAL</Text>
              <TouchableOpacity style={h.linkRow} onPress={() => navLegal('privacy')} activeOpacity={0.7}>
                <Text style={h.linkText}>Privacy Policy</Text>
                <Text style={h.linkArrow}>→</Text>
              </TouchableOpacity>
              <View style={h.divider} />
              <TouchableOpacity style={h.linkRow} onPress={() => navLegal('terms')} activeOpacity={0.7}>
                <Text style={h.linkText}>Terms of Use</Text>
                <Text style={h.linkArrow}>→</Text>
              </TouchableOpacity>
            </View>

            <Text style={h.version}>Version {APP_VERSION}</Text>
          </ScrollView>
        </SafeAreaView>
      </Modal>

      {/* ── Header bar ─────────────────────────────────────── */}
      <View style={h.bar}>
        <View style={h.barCenter}>
          <Text style={h.appName}>Siftly</Text>
          <Text style={h.appEye}>SIFTLY</Text>
        </View>
        <View style={h.barRight}>
          <TouchableOpacity
            style={[h.tierPill, { borderColor: tierColor + '50' }]}
            onPress={() => setShowSettings(true)}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel={`Current plan: ${tierLabel}. Open settings`}
          >
            <View style={[h.dot, { backgroundColor: tierColor }]} />
            <Text style={[h.tierText, { color: tierColor }]}>{tierLabel}</Text>
          </TouchableOpacity>
          {helpKey && <AskPageAIModal featureKey={helpKey} />}
        </View>
      </View>
    </>
  );
}

const h = StyleSheet.create({
  bar: {
    flexDirection:     'row',
    justifyContent:    'space-between',
    alignItems:        'center',
    paddingHorizontal: 16,
    paddingTop:        10,
    paddingBottom:     10,
    backgroundColor:   DS.bgCard,
    borderBottomWidth: 1,
    borderBottomColor: DS.border,
  },
  barCenter: { alignItems: 'center' },
  barRight:  { flexDirection: 'row', alignItems: 'center', gap: 8 },
  appName:   { fontSize: 21, fontWeight: '900', color: DS.textPrimary, letterSpacing: -0.8 },
  appEye:    { fontSize: 8, fontWeight: '800', color: DS.indigo, letterSpacing: 2.5 },
  tierPill: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    borderWidth: 1, borderRadius: 20,
    paddingHorizontal: 10, paddingVertical: 5,
    backgroundColor: DS.bgSubtle,
  },
  dot:      { width: 5, height: 5, borderRadius: 3 },
  tierText: { fontSize: 9, fontWeight: '800', letterSpacing: 1.2 },

  // Settings modal
  sheet:     { flex: 1, backgroundColor: DS.bgCanvas },
  closeRow:  { alignSelf: 'flex-end', padding: 18, paddingBottom: 8 },
  closeText: { fontSize: 17, color: DS.textMuted },
  brandBlock:{ alignItems: 'center', paddingVertical: 28, overflow: 'hidden' },
  brandOrb:  { position: 'absolute', width: 200, height: 200, borderRadius: 100, backgroundColor: DS.indigoLight, top: -20 },
  brandName: { fontSize: 38, fontWeight: '900', color: DS.textPrimary, letterSpacing: -1.5 },
  brandTag:  { fontSize: 13, color: DS.textMuted, marginTop: 4 },
  section: {
    marginHorizontal: 20, marginBottom: 14,
    backgroundColor: DS.bgCard, borderRadius: 20, padding: 18,
    borderWidth: 1, borderColor: DS.border, gap: 10,
  },
  sectionLabel: { fontSize: 9, fontWeight: '800', color: DS.textMuted, letterSpacing: 2.5 },
  planBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    borderWidth: 1, borderRadius: 99, paddingHorizontal: 12, paddingVertical: 5,
    alignSelf: 'flex-start',
  },
  planText:       { fontSize: 10, fontWeight: '800', letterSpacing: 1.2 },
  planSub:        { fontSize: 12, color: DS.textSecondary, lineHeight: 18 },
  featureRow:     { flexDirection: 'row', alignItems: 'center', gap: 8 },
  featureDot:     { fontSize: 11, fontWeight: '800', width: 14 },
  featureText:    { fontSize: 13, color: DS.textPrimary, fontWeight: '500', flex: 1 },
  featureDotLocked:  { fontSize: 11, fontWeight: '800', color: DS.borderLight, width: 14 },
  featureTextLocked: { fontSize: 13, color: DS.textMuted, flex: 1 },
  upgradeBtn:     { borderRadius: 12, paddingVertical: 11, alignItems: 'center', marginTop: 4 },
  upgradeTxt:     { fontSize: 13, fontWeight: '800', color: DS.bgCard, letterSpacing: -0.2 },
  email:          { fontSize: 14, color: DS.textSecondary, fontWeight: '500' },
  manageSubRow:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 4 },
  manageSubTxt:   { fontSize: 14, color: DS.accent, fontWeight: '500' },
  staleBanner:    { backgroundColor: DS.warning + '18', borderRadius: 8, borderWidth: 1, borderColor: DS.warning + '44', padding: 10 },
  staleBannerText:{ fontSize: 12, color: DS.warning, lineHeight: 17 },
  refreshBtn: {
    borderRadius: 10, paddingVertical: 8, alignItems: 'center' as const,
    borderWidth: 1, borderColor: DS.border, backgroundColor: DS.bgSubtle,
  },
  refreshTxt: { fontSize: 12, fontWeight: '600' as const, color: DS.textSecondary },
  refreshMsg: { fontSize: 12, color: DS.textMuted, textAlign: 'center' as const },
  signOutBtn:{
    backgroundColor: '#FFF5F5', borderRadius: 10,
    paddingVertical: 10, alignItems: 'center',
    borderWidth: 1, borderColor: '#FEE2E2',
  },
  signOutText: { fontSize: 14, fontWeight: '700', color: DS.dangerText },
  deleteHint: { fontSize: 12, color: DS.textMuted, lineHeight: 17, marginBottom: 2 },
  deleteBtn: {
    borderRadius: 10, paddingVertical: 10, alignItems: 'center',
    borderWidth: 1, borderColor: '#FEE2E2',
  },
  deleteText: { fontSize: 13, fontWeight: '600', color: DS.dangerText },
  devBtn: {
    backgroundColor: '#FFF9EC', borderRadius: 10,
    paddingVertical: 10, alignItems: 'center' as const,
    borderWidth: 1, borderColor: '#FDE68A',
  },
  devBtnText: { fontSize: 13, fontWeight: '700' as const, color: '#92400E' },
  linkRow:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 4 },
  linkText: { fontSize: 14, color: DS.textSecondary },
  linkArrow:{ fontSize: 14, color: DS.textMuted },
  divider:  { height: 1, backgroundColor: DS.border },
  version:  { textAlign: 'center', fontSize: 11, color: DS.textMuted, marginTop: 8, marginBottom: 28 },
});
