import React, { useState } from 'react';
import {
  View, Text, TouchableOpacity, Modal, StyleSheet, ScrollView, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, CommonActions } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { spacing, radius } from '../theme';
import { DS } from './ds';
import { STORAGE_KEYS } from '../constants/storage';
import { useSubscription } from '../hooks/useSubscription';
import { useAuth, authActions } from '../hooks/useAuth';
import { anonymizeUser } from '../lib/revenuecat';
import { CurrencySelector } from './CurrencySelector';
import { HelpButton } from './HelpModal';
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
  const { tier }  = useSubscription();
  const { user }  = useAuth();
  const navigation = useNavigation<any>();

  const tierLabel = tier === 'operator' ? 'OPERATOR' : tier === 'builder' ? 'BUILDER' : 'EXPLORER';
  const tierColor = tier === 'operator' ? '#1D4ED8' : tier === 'builder' ? '#2563EB' : '#8196B0';

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
        // Legacy keys removed in prior schema versions
        'fba_saved_ideas_v1', 'fba_journey_v5', 'fba_vault_v2',
      ]);
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
                'fba_saved_ideas_v1', 'fba_journey_v5', 'fba_vault_v2',
              ]);
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
          <TouchableOpacity style={h.closeRow} onPress={() => setShowSettings(false)} activeOpacity={0.7}>
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
                  {(['AI Advisor · unlimited', 'Research & suppliers · unlimited', 'Feasibility Check', 'Brand Studio', 'Launch Checklist'] as string[]).map(f => (
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
                  {(['AI Advisor', 'Research & suppliers', 'Launch Checklist'] as string[]).map(f => (
                    <View key={f} style={h.featureRow}>
                      <Text style={[h.featureDot, { color: tierColor }]}>✓</Text>
                      <Text style={h.featureText}>{f}</Text>
                    </View>
                  ))}
                  {(['Feasibility Check', 'Brand Studio · full access'] as string[]).map(f => (
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
                  {(['Basic Research', 'Basic AI Advisor', 'Launch Checklist'] as string[]).map(f => (
                    <View key={f} style={h.featureRow}>
                      <Text style={[h.featureDot, { color: tierColor }]}>✓</Text>
                      <Text style={h.featureText}>{f}</Text>
                    </View>
                  ))}
                  {(['Feasibility Check', 'Brand Studio', 'Unlimited suppliers'] as string[]).map(f => (
                    <View key={f} style={h.featureRow}>
                      <Text style={h.featureDotLocked}>✕</Text>
                      <Text style={h.featureTextLocked}>{f}</Text>
                    </View>
                  ))}
                  <TouchableOpacity
                    style={[h.upgradeBtn, { backgroundColor: '#2563EB' }]}
                    onPress={() => { setShowSettings(false); setTimeout(() => navigation.navigate('Paywall'), 300); }}
                    activeOpacity={0.85}
                  >
                    <Text style={h.upgradeTxt}>Unlock Full Access →</Text>
                  </TouchableOpacity>
                </>
              )}
            </View>

            {/* ── Account ────────────────────────────────────── */}
            {user && (
              <View style={h.section}>
                <Text style={h.sectionLabel}>ACCOUNT</Text>
                <Text style={h.email} numberOfLines={1}>{user.email}</Text>
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
        <View>
          <Text style={h.appName}>Siftly</Text>
          <Text style={h.appEye}>SIFTLY</Text>
        </View>
        <View style={h.barRight}>
          <TouchableOpacity
            style={[h.tierPill, { borderColor: tierColor + '50' }]}
            onPress={() => setShowSettings(true)}
            activeOpacity={0.8}
          >
            <View style={[h.dot, { backgroundColor: tierColor }]} />
            <Text style={[h.tierText, { color: tierColor }]}>{tierLabel}</Text>
          </TouchableOpacity>
          <CurrencySelector />
          {helpKey
            ? <HelpButton featureKey={helpKey} />
            : (
              <TouchableOpacity style={h.helpBtn} onPress={() => setShowSettings(true)} activeOpacity={0.7}>
                <Text style={h.helpIcon}>?</Text>
              </TouchableOpacity>
            )
          }
        </View>
      </View>
    </>
  );
}

const h = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 10,
    backgroundColor: DS.bgCard,
    borderBottomWidth: 1,
    borderBottomColor: DS.border,
  },
  barRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  appName:  { fontSize: 21, fontWeight: '900', color: DS.textPrimary, letterSpacing: -0.8 },
  appEye:   { fontSize: 8, fontWeight: '800', color: DS.indigo, letterSpacing: 2.5 },
  tierPill: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    borderWidth: 1, borderRadius: 20,
    paddingHorizontal: 10, paddingVertical: 5,
    backgroundColor: DS.bgSubtle,
  },
  dot:      { width: 5, height: 5, borderRadius: 3 },
  tierText: { fontSize: 9, fontWeight: '800', letterSpacing: 1.2 },
  helpBtn: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: DS.bgSubtle, borderWidth: 1, borderColor: DS.border,
    alignItems: 'center', justifyContent: 'center',
  },
  helpIcon: { fontSize: 14, fontWeight: '800', color: DS.textSecondary },

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
  signOutBtn:{
    backgroundColor: '#FFF5F5', borderRadius: 10,
    paddingVertical: 10, alignItems: 'center',
    borderWidth: 1, borderColor: '#FEE2E2',
  },
  signOutText: { fontSize: 14, fontWeight: '700', color: '#DC2626' },
  deleteBtn: {
    borderRadius: 10, paddingVertical: 10, alignItems: 'center',
    borderWidth: 1, borderColor: '#FEE2E2',
  },
  deleteText: { fontSize: 13, fontWeight: '600', color: '#DC2626' },
  linkRow:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 4 },
  linkText: { fontSize: 14, color: DS.textSecondary },
  linkArrow:{ fontSize: 14, color: DS.textMuted },
  divider:  { height: 1, backgroundColor: DS.border },
  version:  { textAlign: 'center', fontSize: 11, color: DS.textMuted, marginTop: 8, marginBottom: 28 },
});
