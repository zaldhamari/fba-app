import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, TouchableOpacity, Modal, StyleSheet, ScrollView, Alert, Linking, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, CommonActions } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { DS } from '../theme/ds';
import { STORAGE_KEYS } from '../constants/storage';
import { useSubscription } from '../hooks/useSubscription';
import { useAuth, authActions } from '../hooks/useAuth';
import { anonymizeUser, identifyUser } from '../lib/revenuecat';
import { CurrencyRegionPicker } from './CurrencySelector';
import { AskPageAIModal } from './AskPageAIModal';
import type { FeatureKey } from '../lib/featureHelp';
import { usePipeline } from '../context/PipelineContext';
import { useToast } from '../hooks/useToast';
import { Toast } from './Toast';

// All keys cleared on sign-out — everything except the device-level onboarding flag.
const SIGN_OUT_KEYS = Object.values(STORAGE_KEYS).filter(
  k => k !== STORAGE_KEYS.onboardingDone,
);
// Delete account clears everything including onboarding.
const DELETE_ACCOUNT_KEYS = Object.values(STORAGE_KEYS);

const APP_VERSION = '1.0.0';

interface AppHeaderProps {
  helpKey?: FeatureKey;
  hideJourneyStrip?: boolean;
}

export function AppHeader({ helpKey, hideJourneyStrip }: AppHeaderProps = {}) {
  const [showSettings,    setShowSettings]    = useState(false);
  const [signingOut,      setSigningOut]      = useState(false);
  const [deletingAccount, setDeletingAccount] = useState(false);
  const [refreshing,      setRefreshing]      = useState(false);
  const [refreshMsg,      setRefreshMsg]      = useState<string | null>(null);
  const { tier, subscriptionStale, refreshSubscription, syncUsage } = useSubscription();
  const { user, loading: authLoading } = useAuth();
  const navigation = useNavigation<any>();
  const hasHadSessionRef = useRef(false);
  const { toastMsg, toastVisible, toastType, showToast, hideToast } = useToast();

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

  const pipeline  = usePipeline();
  const hasProgress = !!(
    pipeline.activeNiche    || pipeline.activeProduct   ||
    pipeline.reconInsights  || pipeline.selectedSupplier ||
    pipeline.freightEstimate|| pipeline.costModel        || pipeline.brandData
  );

  const journeyStepsDone = [
    pipeline.activeNiche, pipeline.activeProduct, pipeline.reconInsights,
    pipeline.selectedSupplier, pipeline.freightEstimate, pipeline.costModel, pipeline.brandData,
  ].filter(Boolean).length;

  const journeyPhaseLabel = !pipeline.activeNiche ? 'Research'
    : !pipeline.activeProduct || !pipeline.reconInsights ? 'Research'
    : !pipeline.selectedSupplier || !pipeline.freightEstimate ? 'Source'
    : !pipeline.costModel ? 'Profit'
    : !pipeline.brandData ? 'Brand'
    : 'Scale';

  const NEXT_STEP = !pipeline.activeNiche
    ? { label: 'Pick a Niche',         tab: 'Home',          route: 'Home' }
    : !pipeline.activeProduct
    ? { label: 'Research a Product',   tab: 'Research',      route: 'Research' }
    : !pipeline.reconInsights
    ? { label: 'Teardown Competitors', tab: 'Research',      route: 'Research' }
    : !pipeline.selectedSupplier
    ? { label: 'Find a Supplier',      tab: 'Sourcing',      route: 'Sourcing' }
    : !pipeline.freightEstimate
    ? { label: 'Estimate Freight',     tab: 'Sourcing',      route: 'Sourcing' }
    : !pipeline.costModel
    ? { label: 'Calculate Profit',     tab: 'Profit',        route: 'Profit' }
    : !pipeline.brandData
    ? { label: 'Create your Brand',    tab: 'Brand',         route: 'Brand' }
    : { label: 'Save Launch Decision', tab: 'Decision',      route: 'LaunchDecision' };

  const nextStepRoute = NEXT_STEP.route;

  const STEP_HINTS: Record<string, string> = {
    'Pick a Niche':         'Search for a market category to start your journey.',
    'Research a Product':   'Find and select a product to research on this tab.',
    'Teardown Competitors': 'Run a competitor teardown on your selected product.',
    'Find a Supplier':      'Search for suppliers in the Suppliers tab.',
    'Estimate Freight':     'Switch to Freight and get a shipping estimate.',
    'Calculate Profit':     'Run the FBA Profit calculator and save your result.',
    'Create your Brand':    'Generate a brand concept in the Brand Studio.',
    'Save Launch Decision': 'Review your numbers and save your launch decision.',
  };

  function handleJourneyPress() {
    const hint = STEP_HINTS[NEXT_STEP.label];
    if (hint) showToast(hint, 'info');
    navigation.navigate(nextStepRoute as any);
  }

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
          {/* Hero */}
          <View style={h.hero}>
            <View style={h.heroOrb} />
            <View style={{ flex: 1 }}>
              <Text style={h.heroName}>Siftly</Text>
              <Text style={h.heroTag}>Built for modern independence.</Text>
            </View>
            <TouchableOpacity
              style={h.closeBtn}
              onPress={() => setShowSettings(false)}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel="Close settings"
            >
              <Text style={h.closeTxt}>✕</Text>
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={h.scroll}>
            {/* ── Plan card ─────────────────────────────────── */}
            <View style={h.card}>
              <Text style={h.cardLabel}>YOUR PLAN</Text>
              <View style={[h.planBadge, { borderColor: tierColor + '40', backgroundColor: tierColor + '12' }]}>
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
                      <Text style={h.featureDotLocked}>—</Text>
                      <Text style={h.featureTextLocked}>{f}</Text>
                    </View>
                  ))}
                  <TouchableOpacity
                    style={h.upgradeBtn}
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
                      <Text style={[h.featureDot, { color: DS.accent }]}>✓</Text>
                      <Text style={h.featureText}>{f}</Text>
                    </View>
                  ))}
                  {(['Launch Decision', 'Brand Studio', 'Unlimited suppliers'] as string[]).map(f => (
                    <View key={f} style={h.featureRow}>
                      <Text style={h.featureDotLocked}>—</Text>
                      <Text style={h.featureTextLocked}>{f}</Text>
                    </View>
                  ))}
                  <TouchableOpacity
                    style={h.upgradeBtn}
                    onPress={() => { setShowSettings(false); setTimeout(() => navigation.navigate('Paywall'), 300); }}
                    activeOpacity={0.85}
                  >
                    <Text style={h.upgradeTxt}>Unlock Full Access →</Text>
                  </TouchableOpacity>
                </>
              )}

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
            <View style={h.card}>
              <Text style={h.cardLabel}>REGION & CURRENCY</Text>
              <CurrencyRegionPicker />
            </View>

            {/* ── Account ────────────────────────────────────── */}
            {user && (
              <View style={h.card}>
                <Text style={h.cardLabel}>ACCOUNT</Text>
                <View style={h.emailRow}>
                  <Text style={h.emailDot}>●</Text>
                  <Text style={h.email} numberOfLines={1}>{user.email}</Text>
                </View>

                {Platform.OS === 'ios' && (
                  <TouchableOpacity
                    style={h.linkRow}
                    onPress={() => Linking.openURL('itms-apps://apps.apple.com/account/subscriptions')}
                    activeOpacity={0.7}
                  >
                    <Text style={h.linkText}>Manage Subscription</Text>
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

                <View style={h.divider} />

                <TouchableOpacity
                  style={[h.signOutBtn, signingOut && { opacity: 0.5 }]}
                  onPress={handleSignOut}
                  disabled={signingOut}
                  activeOpacity={0.8}
                >
                  <Text style={h.signOutText}>{signingOut ? 'Signing out…' : 'Sign Out'}</Text>
                </TouchableOpacity>

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
              <View style={h.card}>
                <Text style={[h.cardLabel, { color: DS.warning }]}>DEV TOOLS</Text>
                <TouchableOpacity style={h.devBtn} onPress={handleResetOnboarding} activeOpacity={0.8}>
                  <Text style={h.devBtnText}>↺  Reset Onboarding</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* ── Explore ────────────────────────────────────── */}
            <View style={h.card}>
              <Text style={h.cardLabel}>EXPLORE</Text>
              {([
                { label: 'Product Blueprint', route: 'ProductBlueprint' },
              ] as { label: string; route: string }[]).map((item, i, arr) => (
                <React.Fragment key={item.route}>
                  <TouchableOpacity
                    style={h.linkRow}
                    onPress={() => { setShowSettings(false); setTimeout(() => navigation.navigate(item.route as any), 300); }}
                    activeOpacity={0.7}
                  >
                    <Text style={h.linkText}>{item.label}</Text>
                    <Text style={h.linkArrow}>→</Text>
                  </TouchableOpacity>
                  {i < arr.length - 1 && <View style={h.divider} />}
                </React.Fragment>
              ))}
            </View>

            {/* ── Legal ──────────────────────────────────────── */}
            <View style={h.card}>
              <Text style={h.cardLabel}>LEGAL</Text>
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

      {/* ── Journey card — visible on every tab except Home when in progress ── */}
      <Toast message={toastMsg} visible={toastVisible} onHide={hideToast} type={toastType} />
      {hasProgress && !hideJourneyStrip && (
        <TouchableOpacity
          style={h.journeyWrap}
          onPress={handleJourneyPress}
          activeOpacity={0.75}
          accessibilityRole="button"
          accessibilityLabel="Continue your Journey"
        >
          <View style={h.journeyCard}>
            {/* Row 1 — title + count */}
            <View style={h.journeyRow}>
              <Text style={h.journeyTitle}>Continue your Journey</Text>
              <View style={h.journeyPill}>
                <Text style={h.journeyPillText}>{journeyStepsDone} / 7</Text>
              </View>
            </View>
            {/* Row 2 — progress bar */}
            <View style={h.journeyTrack}>
              <View style={[h.journeyFill, { width: `${Math.round((journeyStepsDone / 7) * 100)}%` as any }]} />
            </View>
            {/* Row 3 — next step */}
            <View style={h.journeyRow}>
              <Text style={h.journeyNext}>Next  <Text style={h.journeyNextStep}>{NEXT_STEP.label}</Text></Text>
              <Text style={h.journeyTab}>{NEXT_STEP.tab}  ›</Text>
            </View>
          </View>
        </TouchableOpacity>
      )}
    </>
  );
}

const h = StyleSheet.create({
  // ── Header bar ──────────────────────────────────────────────────────────────
  bar: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 16, paddingTop: 10, paddingBottom: 10,
    backgroundColor: DS.bgCard, borderBottomWidth: 1, borderBottomColor: DS.border,
  },
  journeyWrap: {
    backgroundColor: DS.bgCanvas,
    paddingHorizontal: 12, paddingTop: 10, paddingBottom: 2,
    borderBottomWidth: 1, borderBottomColor: DS.border,
  },
  journeyCard: {
    backgroundColor: DS.bgCard, borderRadius: DS.radiusCard,
    borderWidth: 1, borderColor: DS.border,
    paddingHorizontal: 14, paddingVertical: 12, gap: 8,
  },
  journeyRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
  },
  journeyTitle: {
    fontSize: 13, fontWeight: '700', color: DS.textPrimary, letterSpacing: -0.2,
  },
  journeyPill: {
    backgroundColor: DS.accentLight, borderRadius: DS.radiusBadge,
    paddingHorizontal: 8, paddingVertical: 2,
  },
  journeyPillText: {
    fontSize: 11, fontWeight: '700', color: DS.accent,
  },
  journeyTrack: {
    height: 4, borderRadius: 999, backgroundColor: DS.border,
  },
  journeyFill: {
    height: 4, borderRadius: 999, backgroundColor: DS.accent,
  },
  journeyNext: {
    fontSize: 11, color: DS.textMuted, fontWeight: '500',
  },
  journeyNextStep: {
    fontSize: 11, color: DS.accent, fontWeight: '700',
  },
  journeyTab: {
    fontSize: 11, color: DS.textMuted, fontWeight: '500',
  },
  barCenter: { alignItems: 'center' },
  barRight:  { flexDirection: 'row', alignItems: 'center', gap: 8 },
  appName:   { fontSize: 21, fontWeight: '900', color: DS.textPrimary, letterSpacing: -0.8 },
  appEye:    { fontSize: 8, fontWeight: '800', color: DS.accent, letterSpacing: 2.5 },
  tierPill: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    borderWidth: 1, borderRadius: DS.radiusBadge,
    paddingHorizontal: 10, paddingVertical: 5,
    backgroundColor: DS.bgSubtle,
  },
  dot:      { width: 5, height: 5, borderRadius: 3 },
  tierText: { fontSize: 9, fontWeight: '800', letterSpacing: 1.2 },

  // ── Settings modal ──────────────────────────────────────────────────────────
  sheet:  { flex: 1, backgroundColor: DS.bgCanvas },
  scroll: { paddingHorizontal: DS.pagePadding, paddingBottom: 40, gap: 12 },

  hero: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    paddingHorizontal: DS.pagePadding, paddingTop: 20, paddingBottom: 20,
    overflow: 'hidden',
  },
  heroOrb: {
    position: 'absolute', width: 160, height: 160, borderRadius: 80,
    backgroundColor: DS.accent + '14', top: -40, left: -20,
  },
  heroName: { fontSize: 28, fontWeight: '900', color: DS.textPrimary, letterSpacing: -1 },
  heroTag:  { fontSize: 12, color: DS.textMuted, marginTop: 2 },
  closeBtn: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: DS.bgElevated, borderWidth: 1, borderColor: DS.border,
    alignItems: 'center', justifyContent: 'center',
  },
  closeTxt: { fontSize: 13, color: DS.textSecondary, fontWeight: '500' },

  card: {
    backgroundColor: DS.bgCard, borderRadius: DS.radiusCard,
    padding: DS.cardPadding, borderWidth: 1, borderColor: DS.border, gap: 10,
  },
  cardLabel: { fontSize: 9, fontWeight: '800', color: DS.textMuted, letterSpacing: 2.5 },

  planBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    borderWidth: 1, borderRadius: DS.radiusBadge, paddingHorizontal: 12, paddingVertical: 5,
    alignSelf: 'flex-start',
  },
  planText:         { fontSize: 10, fontWeight: '800', letterSpacing: 1.2 },
  planSub:          { fontSize: 13, color: DS.textSecondary, lineHeight: 18 },
  featureRow:       { flexDirection: 'row', alignItems: 'center', gap: 8 },
  featureDot:       { fontSize: 12, fontWeight: '800', width: 16 },
  featureText:      { fontSize: 13, color: DS.textPrimary, fontWeight: '500', flex: 1 },
  featureDotLocked: { fontSize: 12, fontWeight: '800', color: DS.textMuted, width: 16 },
  featureTextLocked:{ fontSize: 13, color: DS.textMuted, flex: 1 },
  upgradeBtn: {
    backgroundColor: DS.accent, borderRadius: DS.radiusButton,
    paddingVertical: 12, alignItems: 'center' as const, marginTop: 4,
  },
  upgradeTxt:    { fontSize: 14, fontWeight: '800', color: '#fff', letterSpacing: -0.2 },
  refreshBtn: {
    borderRadius: DS.radiusButton, paddingVertical: 9, alignItems: 'center' as const,
    borderWidth: 1, borderColor: DS.border, backgroundColor: DS.bgSubtle,
  },
  refreshTxt: { fontSize: 12, fontWeight: '600' as const, color: DS.textSecondary },
  refreshMsg: { fontSize: 12, color: DS.textMuted, textAlign: 'center' as const },

  emailRow:   { flexDirection: 'row', alignItems: 'center', gap: 8 },
  emailDot:   { fontSize: 8, color: DS.success },
  email:      { fontSize: 14, color: DS.textSecondary, fontWeight: '500', flex: 1 },
  staleBanner:    { backgroundColor: DS.warning + '18', borderRadius: DS.radiusChip, borderWidth: 1, borderColor: DS.warning + '44', padding: 10 },
  staleBannerText:{ fontSize: 12, color: DS.warning, lineHeight: 17 },
  signOutBtn: {
    backgroundColor: DS.danger + '0C', borderRadius: DS.radiusButton,
    paddingVertical: 10, alignItems: 'center' as const,
    borderWidth: 1, borderColor: DS.danger + '30',
  },
  signOutText: { fontSize: 14, fontWeight: '700', color: DS.dangerText },
  deleteBtn: {
    borderRadius: DS.radiusButton, paddingVertical: 10, alignItems: 'center' as const,
    borderWidth: 1, borderColor: DS.border, backgroundColor: DS.bgSubtle,
  },
  deleteText: { fontSize: 13, fontWeight: '600', color: DS.textMuted },
  devBtn: {
    backgroundColor: DS.warning + '12', borderRadius: DS.radiusButton,
    paddingVertical: 10, alignItems: 'center' as const,
    borderWidth: 1, borderColor: DS.warning + '40',
  },
  devBtnText: { fontSize: 13, fontWeight: '700' as const, color: DS.warning },

  linkRow:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 6 },
  linkText: { fontSize: 14, color: DS.textSecondary, fontWeight: '500' },
  linkArrow:{ fontSize: 14, color: DS.textMuted },
  divider:  { height: 1, backgroundColor: DS.border },
  version:  { textAlign: 'center', fontSize: 11, color: DS.textMuted, marginTop: 4, marginBottom: 16 },
});
