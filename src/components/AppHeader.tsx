import React, { useState } from 'react';
import {
  View, Text, TouchableOpacity, Modal, StyleSheet, ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, CommonActions } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { spacing, radius } from '../theme';
import { useSubscription } from '../hooks/useSubscription';
import { useAuth, authActions } from '../hooks/useAuth';

const APP_VERSION = '1.0.0';

export function AppHeader() {
  const [showSettings, setShowSettings] = useState(false);
  const [signingOut,   setSigningOut]   = useState(false);
  const { tier }  = useSubscription();
  const { user }  = useAuth();
  const navigation = useNavigation<any>();

  const tierLabel = tier === 'operator' ? 'OPERATOR' : tier === 'builder' ? 'BUILDER' : 'EXPLORER';
  const tierColor = tier === 'operator' ? '#7C3AED' : tier === 'builder' ? '#4361EE' : '#8196B0';

  async function handleSignOut() {
    setSigningOut(true);
    try {
      await authActions.signOut();
      await AsyncStorage.multiRemove([
        'fba_launch_checklist', 'fba_saved_ideas_v1',
        'fba_vault_v2', 'fba_usage_v3', 'fba_tier_v3', 'fba_journey_v5',
      ]);
      setShowSettings(false);
      navigation.dispatch(CommonActions.reset({ index: 0, routes: [{ name: 'Auth' }] }));
    } catch { setSigningOut(false); }
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
            <View style={h.section}>
              <Text style={h.sectionLabel}>YOUR PLAN</Text>
              <View style={[h.planBadge, { borderColor: tierColor + '40' }]}>
                <View style={[h.dot, { backgroundColor: tierColor }]} />
                <Text style={[h.planText, { color: tierColor }]}>{tierLabel}</Text>
              </View>
              <Text style={h.planSub}>
                {tier === 'operator'
                  ? 'Unlimited access across all features.'
                  : tier === 'builder'
                  ? 'Core tools unlocked — upgrade to Operator.'
                  : 'Free tier — unlock more with a paid plan.'}
              </Text>
            </View>

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
              </View>
            )}

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
          <Text style={h.appEye}>LAUNCH CONTROL</Text>
        </View>
        <View style={h.barRight}>
          <TouchableOpacity
            style={[h.tierPill, { borderColor: tierColor + '50' }]}
            onPress={() => setShowSettings(true)}
            activeOpacity={0.8}
          >
            <View style={[h.dot, { backgroundColor: tierColor }]} />
            <Text style={[h.tierText, { color: tierColor }]}>{tierLabel}</Text>
            <Text style={h.upArrow}>↑</Text>
          </TouchableOpacity>
          <TouchableOpacity style={h.gear} onPress={() => setShowSettings(true)} activeOpacity={0.7}>
            <Text style={h.gearIcon}>⚙</Text>
          </TouchableOpacity>
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
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#ECF0FB',
  },
  barRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  appName:  { fontSize: 21, fontWeight: '900', color: '#0D1B4B', letterSpacing: -0.8 },
  appEye:   { fontSize: 8, fontWeight: '800', color: '#4361EE', letterSpacing: 2.5 },
  tierPill: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    borderWidth: 1, borderRadius: 20,
    paddingHorizontal: 10, paddingVertical: 5,
    backgroundColor: '#FAFBFF',
  },
  dot:      { width: 5, height: 5, borderRadius: 3 },
  tierText: { fontSize: 9, fontWeight: '800', letterSpacing: 1.2 },
  upArrow:  { fontSize: 9, color: '#8196B0' },
  gear: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: '#F4F6FC', borderWidth: 1, borderColor: '#E0E8F5',
    alignItems: 'center', justifyContent: 'center',
  },
  gearIcon: { fontSize: 13, color: '#5C6B8A' },

  // Settings modal
  sheet:     { flex: 1, backgroundColor: '#F5F7FF' },
  closeRow:  { alignSelf: 'flex-end', padding: 18, paddingBottom: 8 },
  closeText: { fontSize: 17, color: '#8196B0' },
  brandBlock:{ alignItems: 'center', paddingVertical: 28, overflow: 'hidden' },
  brandOrb:  { position: 'absolute', width: 200, height: 200, borderRadius: 100, backgroundColor: '#EEF4FF', top: -20 },
  brandName: { fontSize: 38, fontWeight: '900', color: '#0D1B4B', letterSpacing: -1.5 },
  brandTag:  { fontSize: 13, color: '#8196B0', marginTop: 4 },
  section: {
    marginHorizontal: 20, marginBottom: 14,
    backgroundColor: '#fff', borderRadius: 20, padding: 18,
    borderWidth: 1, borderColor: '#ECF0FB', gap: 10,
  },
  sectionLabel: { fontSize: 9, fontWeight: '800', color: '#8196B0', letterSpacing: 2.5 },
  planBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    borderWidth: 1, borderRadius: 99, paddingHorizontal: 12, paddingVertical: 5,
    alignSelf: 'flex-start',
  },
  planText:  { fontSize: 10, fontWeight: '800', letterSpacing: 1.2 },
  planSub:   { fontSize: 12, color: '#5C6B8A', lineHeight: 18 },
  email:     { fontSize: 14, color: '#5C6B8A', fontWeight: '500' },
  signOutBtn:{
    backgroundColor: '#FFF5F5', borderRadius: 10,
    paddingVertical: 10, alignItems: 'center',
    borderWidth: 1, borderColor: '#FEE2E2',
  },
  signOutText: { fontSize: 14, fontWeight: '700', color: '#DC2626' },
  linkRow:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 4 },
  linkText: { fontSize: 14, color: '#5C6B8A' },
  linkArrow:{ fontSize: 14, color: '#8196B0' },
  divider:  { height: 1, backgroundColor: '#ECF0FB' },
  version:  { textAlign: 'center', fontSize: 11, color: '#8196B0', marginTop: 8, marginBottom: 28 },
});
