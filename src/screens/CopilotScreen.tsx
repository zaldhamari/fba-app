import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView, Animated, Modal, RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNavigation, NavigationProp, CommonActions } from '@react-navigation/native';
import { colors, spacing, radius } from '../theme';
import { useSubscription } from '../hooks/useSubscription';
import { useAuth, authActions } from '../hooks/useAuth';
import { pushJourney, pullJourney } from '../services/sync';
import { supabase } from '../lib/supabase';
import LaunchPackModal from '../components/LaunchPackModal';
import PaywallModal from '../components/PaywallModal';

const APP_VERSION = '1.0.0';

const JOURNEY_KEY = 'fba_journey_v5';

// ─── Journey steps ─────────────────────────────────────────────────────────────
const STEPS = [
  { id: 'research',  num: '01', title: 'Discover Your Opportunity', desc: 'Surface real demand signals and AI-scored opportunities',        tab: 'Search',    color: '#4361EE',     icon: '◎' },
  { id: 'brand',     num: '02', title: 'Build Your Brand',           desc: 'Generate a brand name, tagline, and brand kit with AI',          tab: 'Brand',     color: colors.pink,   icon: '✦' },
  { id: 'keywords',  num: '03', title: 'Research Keywords',          desc: 'Find the exact terms buyers search — rank from day one',         tab: 'Brand',     color: colors.amber,  icon: '≋' },
  { id: 'suppliers', num: '04', title: 'Source Your Supplier',       desc: 'Find vetted global suppliers and send professional outreach',    tab: 'Search',    color: colors.green,  icon: '⬡' },
  { id: 'calculate', num: '05', title: 'Model Your Economics',       desc: 'Model landed cost, FBA fees, PPC, and break-even',              tab: 'Calculate', color: colors.purple, icon: '◈' },
  { id: 'listing',   num: '06', title: 'Create Your Listing',        desc: 'Write a fully optimised title, bullets, and description',       tab: 'Brand',     color: colors.pink,   icon: '≡' },
  { id: 'launch',    num: '07', title: 'Launch with Confidence',     desc: 'Execute your launch plan step by step — go live with clarity',  tab: 'Launch',    color: colors.green,  icon: '↑' },
];

// ─── Tip of the day ────────────────────────────────────────────────────────────
const TIPS = [
  'Research 20+ products before picking one. Volume matters.',
  'A strong brand name converts 3× better than a generic one.',
  'Backend keywords can boost your organic rank by 30%.',
  'Suppliers respond best to personalised outreach emails.',
  'Your listing title is the single most important ranking factor.',
  'Launch with a mid-range price — not the cheapest, not the most expensive.',
  'Use the "Request a Review" button on every single order.',
];

export default function CopilotScreen() {
  const navigation = useNavigation<NavigationProp<Record<string, undefined>>>();
  const { tier }   = useSubscription();
  const { user }   = useAuth();
  const [done, setDone]                 = useState<string[]>([]);
  const [showLaunch, setShowLaunch]     = useState(false);
  const [showPlans, setShowPlans]       = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [signingOut, setSigningOut]     = useState(false);
  const [refreshing, setRefreshing]     = useState(false);
  const [tipIdx]                        = useState(() => Math.floor(Math.random() * TIPS.length));
  const pulseAnim                       = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    loadJourney();
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 0.2, duration: 900, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1,   duration: 900, useNativeDriver: true }),
      ])
    ).start();
  }, []);

  async function loadJourney() {
    // Local first
    const raw = await AsyncStorage.getItem(JOURNEY_KEY);
    const local: string[] = raw ? (() => { try { return JSON.parse(raw); } catch { return []; } })() : [];
    if (local.length > 0) setDone(local);

    // Merge from cloud (union — a completed step anywhere stays completed)
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) return;
    const cloud = await pullJourney(session.user.id);
    if (cloud.length === 0) return;
    const merged = Array.from(new Set([...local, ...cloud]));
    if (merged.length !== local.length) {
      setDone(merged);
      await AsyncStorage.setItem(JOURNEY_KEY, JSON.stringify(merged));
    }
  }

  async function toggle(id: string) {
    const next = done.includes(id) ? done.filter(s => s !== id) : [...done, id];
    setDone(next);
    await AsyncStorage.setItem(JOURNEY_KEY, JSON.stringify(next));
    // Cloud sync
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.user) pushJourney(session.user.id, next);
  }

  async function handleSignOut() {
    setSigningOut(true);
    try {
      await authActions.signOut();
      await AsyncStorage.multiRemove([
        JOURNEY_KEY,
        'fba_vault_v2',
        'fba_usage_v3',
        'fba_tier_v3',
      ]);
      setDone([]);
      setShowSettings(false);
      navigation.dispatch(
        CommonActions.reset({ index: 0, routes: [{ name: 'Auth' }] }),
      );
    } catch {
      setSigningOut(false);
    }
  }

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadJourney();
    setRefreshing(false);
  }, []);

  const completedCount = done.length;
  const pct            = completedCount / STEPS.length;

  const tierLabel = tier === 'operator' ? 'OPERATOR' : tier === 'builder' ? 'BUILDER' : 'EXPLORER';
  const tierColor = '#4361EE';

  return (
    <SafeAreaView style={s.safe}>
      <LaunchPackModal visible={showLaunch} onClose={() => setShowLaunch(false)} />
      <PaywallModal visible={showPlans} onClose={() => setShowPlans(false)} featureContext="default" />

      {/* ─── Settings / About Modal ──────────────────────────────────── */}
      <Modal
        visible={showSettings}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowSettings(false)}
      >
        <SafeAreaView style={s.settingsSheet}>
          {/* Close handle */}
          <TouchableOpacity style={s.settingsClose} onPress={() => setShowSettings(false)} activeOpacity={0.7}>
            <Text style={s.settingsCloseText}>✕</Text>
          </TouchableOpacity>

          {/* Brand lockup — the intentional emotional placement */}
          <View style={s.settingsBrand}>
            <View style={s.settingsOrbBg} />
            <Text style={s.settingsWordmark}>Siftly</Text>
            <Text style={s.settingsTagline}>Built for modern independence.</Text>
          </View>

          {/* Plan row */}
          <View style={s.settingsSection}>
            <Text style={s.settingsSectionLabel}>YOUR PLAN</Text>
            <View style={s.settingsPlanRow}>
              <View style={[s.settingsPlanBadge, { borderColor: `${tierColor}40` }]}>
                <View style={[s.dot, { backgroundColor: tierColor }]} />
                <Text style={[s.settingsPlanText, { color: tierColor }]}>{tierLabel}</Text>
              </View>
              {tier !== 'operator' && (
                <TouchableOpacity onPress={() => { setShowSettings(false); setTimeout(() => setShowPlans(true), 300); }} activeOpacity={0.8}>
                  <Text style={s.settingsUpgradeLink}>Upgrade plan →</Text>
                </TouchableOpacity>
              )}
            </View>
            <Text style={s.settingsPlanSub}>
              {tier === 'operator'
                ? 'Unlimited access across all features.'
                : tier === 'builder'
                ? 'Core tools unlocked — upgrade to Operator for full access.'
                : 'Free tier — unlock more with a Builder or Operator plan.'}
            </Text>
          </View>

          {/* Account */}
          {user && (
            <View style={s.settingsSection}>
              <Text style={s.settingsSectionLabel}>ACCOUNT</Text>
              <Text style={s.settingsEmail} numberOfLines={1}>{user.email}</Text>
              <TouchableOpacity
                style={[s.signOutBtn, signingOut && { opacity: 0.5 }]}
                onPress={handleSignOut}
                disabled={signingOut}
                activeOpacity={0.8}
              >
                <Text style={s.signOutText}>{signingOut ? 'Signing out…' : 'Sign Out'}</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Links */}
          <View style={s.settingsSection}>
            <Text style={s.settingsSectionLabel}>LEGAL</Text>
            <TouchableOpacity
              style={s.settingsLinkRow}
              onPress={() => {
                setShowSettings(false);
                setTimeout(() => (navigation as any).navigate('Legal', { type: 'privacy' }), 320);
              }}
              activeOpacity={0.7}
            >
              <Text style={s.settingsLinkText}>Privacy Policy</Text>
              <Text style={s.settingsLinkArrow}>→</Text>
            </TouchableOpacity>
            <View style={s.settingsDivider} />
            <TouchableOpacity
              style={s.settingsLinkRow}
              onPress={() => {
                setShowSettings(false);
                setTimeout(() => (navigation as any).navigate('Legal', { type: 'terms' }), 320);
              }}
              activeOpacity={0.7}
            >
              <Text style={s.settingsLinkText}>Terms of Use</Text>
              <Text style={s.settingsLinkArrow}>→</Text>
            </TouchableOpacity>
          </View>

          {/* Version */}
          <Text style={s.settingsVersion}>Version {APP_VERSION}</Text>
        </SafeAreaView>
      </Modal>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.scroll}>

        {/* ─── Header ─────────────────────────────────────────────── */}
        <View style={s.header}>
          <View style={s.headerLeft}>
            <Text style={s.headerBrand}>Siftly</Text>
            <Text style={s.headerEye}>YOUR PATH</Text>
          </View>
          <View style={s.headerRight}>
            <TouchableOpacity
              style={[s.tierPill, { borderColor: `${tierColor}50` }]}
              onPress={() => setShowPlans(true)}
              activeOpacity={0.8}
            >
              <Animated.View style={[s.dot, { backgroundColor: tierColor, opacity: pulseAnim }]} />
              <Text style={[s.tierText, { color: tierColor }]}>{tierLabel}</Text>
              <Text style={s.tierUpgrade}>↑</Text>
            </TouchableOpacity>
            <TouchableOpacity style={s.gearBtn} onPress={() => setShowSettings(true)} activeOpacity={0.7}>
              <Text style={s.gearIcon}>⚙</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* ─── Progress Summary ────────────────────────────────────── */}
        <View style={s.progressCard}>
          <View style={s.progressTop}>
            <View>
              <Text style={s.progressNum}>{completedCount}<Text style={s.progressOf}>/{STEPS.length}</Text></Text>
              <Text style={s.progressLabel}>steps complete</Text>
            </View>
            <View style={s.progressRight}>
              <Text style={[s.progressPct, { color: pct === 1 ? colors.green : '#4361EE' }]}>
                {Math.round(pct * 100)}%
              </Text>
            </View>
          </View>
          <View style={s.track}>
            <View style={[s.fill, {
              width: `${pct * 100}%` as any,
              backgroundColor: pct === 1 ? colors.green : '#4361EE',
            }]} />
          </View>
          <Text style={s.progressHint}>
            {completedCount === 0
              ? 'Tap a step to begin your FBA journey →'
              : pct === 1
              ? '🎉 All steps done. Time to launch!'
              : `${STEPS.length - completedCount} steps remaining`}
          </Text>
        </View>

        {/* ─── Journey Steps ───────────────────────────────────────── */}
        <Text style={s.sectionHeader}>STEP-BY-STEP GUIDE</Text>
        <Text style={s.sectionHint}>Complete each step in order — each one builds on the last.</Text>

        <View style={s.stepsContainer}>
          {STEPS.map((step, index) => {
            const isDone = done.includes(step.id);
            const isLast = index === STEPS.length - 1;
            return (
              <View key={step.id}>
                <View style={[s.stepCard, isDone && s.stepCardDone]}>
                  {/* Left: check + connector */}
                  <View style={s.stepLeft}>
                    <TouchableOpacity
                      style={[s.stepCheck, isDone && { backgroundColor: step.color, borderColor: step.color }]}
                      onPress={() => toggle(step.id)}
                      activeOpacity={0.7}
                    >
                      {isDone
                        ? <Text style={s.checkMark}>✓</Text>
                        : <Text style={[s.stepNum, { color: step.color }]}>{step.num}</Text>
                      }
                    </TouchableOpacity>
                    {!isLast && <View style={[s.connector, isDone && { backgroundColor: step.color }]} />}
                  </View>

                  {/* Right: content + button */}
                  <View style={s.stepContent}>
                    <View style={s.stepTopRow}>
                      <Text style={[s.stepIcon, { color: step.color }]}>{step.icon}</Text>
                      <Text style={[s.stepTitle, isDone && s.stepTitleDone]}>{step.title}</Text>
                    </View>
                    <Text style={s.stepDesc}>{step.desc}</Text>
                    <TouchableOpacity
                      style={[s.stepBtn, { borderColor: `${step.color}50` }]}
                      onPress={() => navigation.navigate(step.tab)}
                      activeOpacity={0.8}
                    >
                      <Text style={[s.stepBtnText, { color: step.color }]}>Open {step.tab} →</Text>
                    </TouchableOpacity>
                  </View>
                </View>
                {/* Spacing between steps */}
                {!isLast && <View style={{ height: 2 }} />}
              </View>
            );
          })}
        </View>

        {/* ─── Daily Tip ───────────────────────────────────────────── */}
        <View style={s.tipCard}>
          <View style={s.tipTop}>
            <Animated.View style={[s.dot, { backgroundColor: '#4361EE', opacity: pulseAnim }]} />
            <Text style={s.tipLabel}>AI TIP</Text>
          </View>
          <Text style={s.tipText}>{TIPS[tipIdx]}</Text>
        </View>

        {/* ─── Launch Pack ─────────────────────────────────────────── */}
        <TouchableOpacity style={s.launchPackCard} onPress={() => setShowLaunch(true)} activeOpacity={0.85}>
          <View style={s.launchPackLeft}>
            <Text style={s.launchPackEye}>ONE-TIME · $79</Text>
            <Text style={s.launchPackTitle}>Launch Pack</Text>
            <Text style={s.launchPackSub}>Brand kit · Listing · Supplier emails · PPC template</Text>
          </View>
          <Text style={s.launchPackArrow}>→</Text>
        </TouchableOpacity>

      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe:   { flex: 1, backgroundColor: '#F5F7FF' },
  scroll: { paddingBottom: 110 },

  // ── Header
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E8F5',
    backgroundColor: '#fff',
  },
  headerLeft: { gap: 2 },
  headerBrand: {
    fontSize: 22, fontWeight: '900', color: '#0D1B4B', letterSpacing: -0.8,
  },
  headerEye: {
    fontSize: 9,
    fontWeight: '800',
    color: '#4361EE',
    letterSpacing: 2.8,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '900',
    color: '#0D1B4B',
    letterSpacing: -1.2,
  },
  tierPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#fff',
    borderRadius: radius.full,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderWidth: 1,
    marginTop: 4,
    shadowColor: '#0D1B4B',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08, shadowRadius: 6, elevation: 2,
  },
  dot:      { width: 6, height: 6, borderRadius: 3 },
  tierText: { fontSize: 10, fontWeight: '800', letterSpacing: 1.5 },
  tierUpgrade: { fontSize: 10, fontWeight: '800', color: colors.textMuted, marginLeft: 2 },

  // ── Progress
  progressCard: {
    margin: spacing.lg,
    marginBottom: spacing.md,
    backgroundColor: '#fff',
    borderRadius: radius.xxl,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: '#E0E8F5',
    gap: spacing.sm,
    shadowColor: '#0D1B4B',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08, shadowRadius: 14, elevation: 4,
  },
  progressTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
  },
  progressNum: {
    fontSize: 48,
    fontWeight: '900',
    color: '#0D1B4B',
    letterSpacing: -2.5,
    lineHeight: 50,
  },
  progressOf:    { fontSize: 22, fontWeight: '600', color: colors.textMuted },
  progressLabel: { fontSize: 12, color: colors.textSecondary, marginTop: 2 },
  progressRight: {},
  progressPct:   { fontSize: 30, fontWeight: '900', letterSpacing: -1.2 },
  track: {
    height: 6,
    backgroundColor: '#E8EDF5',
    borderRadius: radius.full,
    overflow: 'hidden',
  },
  fill: { height: '100%', borderRadius: radius.full },
  progressHint: { fontSize: 12, color: colors.textSecondary },

  // ── Section header
  sectionHeader: {
    fontSize: 10,
    fontWeight: '800',
    color: colors.textMuted,
    letterSpacing: 2.5,
    paddingHorizontal: spacing.lg,
    paddingBottom: 4,
  },
  sectionHint: {
    fontSize: 12,
    color: colors.textMuted,
    letterSpacing: 0.1,
    lineHeight: 17,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
  },

  // ── Steps
  stepsContainer: {
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.lg,
  },
  stepCard: {
    flexDirection: 'row',
    gap: spacing.md,
    paddingVertical: spacing.md,
    paddingRight: spacing.md,
    backgroundColor: '#fff',
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: '#E0E8F5',
    paddingLeft: spacing.sm,
    shadowColor: '#0D1B4B',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06, shadowRadius: 8, elevation: 2,
  },
  stepCardDone: {
    borderColor: '#EEF2FB',
    opacity: 0.65,
    shadowOpacity: 0,
  },

  // Step left column
  stepLeft: {
    alignItems: 'center',
    width: 42,
    paddingTop: 2,
  },
  stepCheck: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 1.5,
    borderColor: '#C8D5EA',
    backgroundColor: '#F5F7FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkMark: { fontSize: 15, color: colors.white, fontWeight: '900' },
  stepNum:   { fontSize: 9, fontWeight: '900', letterSpacing: 0.5 },
  connector: {
    width: 1.5,
    flex: 1,
    backgroundColor: '#D8E4F5',
    marginTop: 4,
    marginBottom: -spacing.md,
  },

  // Step right content
  stepContent: { flex: 1, gap: 6 },
  stepTopRow:  { flexDirection: 'row', alignItems: 'center', gap: 7 },
  stepIcon:    { fontSize: 15 },
  stepTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0D1B4B',
    letterSpacing: -0.4,
    flex: 1,
  },
  stepTitleDone: { color: colors.textMuted, textDecorationLine: 'line-through' },
  stepDesc: {
    fontSize: 12,
    color: colors.textSecondary,
    lineHeight: 18,
  },
  stepBtn: {
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderRadius: radius.full,
    paddingHorizontal: spacing.md,
    paddingVertical: 5,
    marginTop: 2,
  },
  stepBtnText: { fontSize: 11, fontWeight: '700' },

  // ── Tip
  tipCard: {
    marginHorizontal: spacing.lg,
    marginBottom: spacing.md,
    backgroundColor: '#EEF4FF',
    borderRadius: radius.xxl,
    padding: spacing.md + 2,
    borderWidth: 1,
    borderColor: '#C7D9FF',
    gap: 8,
    shadowColor: '#4361EE',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.08, shadowRadius: 10, elevation: 3,
  },
  tipTop:  { flexDirection: 'row', alignItems: 'center', gap: 8 },
  tipLabel:{ fontSize: 9, fontWeight: '800', color: '#4361EE', letterSpacing: 2 },
  tipText: { fontSize: 14, color: colors.textSecondary, lineHeight: 23, fontStyle: 'italic', letterSpacing: -0.1 },

  // ── Launch Pack
  launchPackCard: {
    marginHorizontal: spacing.lg,
    backgroundColor: '#EEF4FF',
    borderRadius: radius.xxl,
    padding: spacing.lg,
    borderWidth: 1.5,
    borderColor: '#C7D9FF',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    shadowColor: '#4361EE',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12, shadowRadius: 14, elevation: 4,
  },
  launchPackLeft:  { flex: 1, gap: 4 },
  launchPackEye:   { fontSize: 9, fontWeight: '800', color: '#4361EE', letterSpacing: 2.5 },
  launchPackTitle: { fontSize: 24, fontWeight: '900', color: '#0D1B4B', letterSpacing: -1 },
  launchPackSub:   { fontSize: 12, color: colors.textSecondary, lineHeight: 18 },
  launchPackArrow: { fontSize: 28, fontWeight: '900', color: '#4361EE', marginLeft: spacing.md },

  // ── Header right cluster
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: 4 },
  gearBtn: {
    width: 34, height: 34, borderRadius: 17,
    backgroundColor: colors.bgElevated,
    borderWidth: 1, borderColor: colors.border,
    alignItems: 'center', justifyContent: 'center',
  },
  gearIcon: { fontSize: 15, color: colors.textMuted },

  // ── Settings sheet
  settingsSheet: {
    flex: 1,
    backgroundColor: '#F5F7FF',
  },
  settingsClose: {
    alignSelf: 'flex-end',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    marginTop: spacing.xs,
  },
  settingsCloseText: { fontSize: 18, color: colors.textMuted, fontWeight: '300' },

  // Brand lockup — intentional, emotional placement
  settingsBrand: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xl * 1.5,
    overflow: 'hidden',
  },
  settingsOrbBg: {
    position: 'absolute',
    width: 260, height: 260, borderRadius: 130,
    backgroundColor: '#EEF4FF',
    opacity: 0.8,
    top: -20,
  },
  settingsWordmark: {
    fontSize: 48,
    fontWeight: '900',
    color: '#0D1B4B',
    letterSpacing: -2.2,
    marginBottom: spacing.xs,
  },
  settingsTagline: {
    fontSize: 13,
    fontWeight: '400',
    color: colors.textMuted,
    letterSpacing: 0.4,
    opacity: 0.8,
  },

  settingsSection: {
    marginHorizontal: spacing.lg,
    marginBottom: spacing.lg,
    backgroundColor: '#fff',
    borderRadius: radius.xxl,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: '#E0E8F5',
    gap: spacing.sm,
  },
  settingsSectionLabel: {
    fontSize: 9, fontWeight: '800', color: colors.textMuted, letterSpacing: 2.5,
    marginBottom: 2,
  },
  settingsPlanRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
  },
  settingsPlanBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 7,
    borderWidth: 1, borderRadius: radius.full,
    paddingHorizontal: 14, paddingVertical: 6,
  },
  settingsPlanText: { fontSize: 11, fontWeight: '800', letterSpacing: 1.5 },
  settingsUpgradeLink: { fontSize: 13, fontWeight: '700', color: '#4361EE' },
  settingsPlanSub: { fontSize: 12, color: colors.textSecondary, lineHeight: 18 },

  settingsLinkRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: 6,
  },
  settingsLinkText: { fontSize: 15, color: colors.textSecondary, fontWeight: '500' },
  settingsLinkArrow: { fontSize: 14, color: colors.textMuted },
  settingsDivider: { height: 1, backgroundColor: '#E0E8F5' },

  settingsEmail: {
    fontSize: 14,
    color: colors.textSecondary,
    fontWeight: '500',
    marginBottom: spacing.sm,
  },
  signOutBtn: {
    backgroundColor: '#F5F7FF',
    borderRadius: radius.md,
    paddingVertical: spacing.sm + 2,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E0E8F5',
  },
  signOutText: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.red,
  },

  settingsVersion: {
    textAlign: 'center',
    fontSize: 11,
    color: colors.textMuted,
    letterSpacing: 0.3,
    marginTop: spacing.md,
  },
});
