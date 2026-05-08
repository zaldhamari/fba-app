import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView, Switch, Platform, Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, spacing, radius, shadow } from '../theme';
import {
  useSubscription, Tier, PLANS, PLAN_FEATURES, LAUNCH_PACK_PRICE,
} from '../hooks/useSubscription';
import { StackNavigationProp } from '@react-navigation/stack';
import { RootStackParamList } from '../navigation/RootNavigator';

type Props = {
  navigation: StackNavigationProp<RootStackParamList, 'Paywall'>;
  route?: { params?: { forced?: boolean } };
};

const PLAN_ORDER: Tier[] = ['explorer', 'builder', 'operator'];

const PLAN_DESCRIPTIONS: Record<Tier, string> = {
  explorer: 'Explore the platform and experience the signal before committing a cent.',
  builder:  'Everything you need to find, validate, and launch with confidence.',
  operator: 'No limits. Built for commerce operators already moving at scale.',
};

// Feature comparison rows shown in the full table
const COMPARISON_ROWS: { label: string; explorer: string; builder: string; operator: string }[] = [
  { label: 'Product searches',  explorer: '3/mo',       builder: '50/mo',      operator: 'Unlimited' },
  { label: 'Supplier searches', explorer: '1/mo',       builder: '20/mo',      operator: 'Unlimited' },
  { label: 'Keyword research',  explorer: '—',          builder: '20/mo',      operator: 'Unlimited' },
  { label: 'AI brand kits',     explorer: '1/mo',       builder: '5/mo',       operator: 'Unlimited' },
  { label: 'Saved products',    explorer: '—',          builder: 'Up to 10',   operator: 'Unlimited' },
  { label: 'Profit calculator', explorer: '✓',          builder: '✓',          operator: '✓'         },
  { label: 'Co-Pilot journey',  explorer: '✓',          builder: '✓',          operator: '✓'         },
  { label: 'Supplier emails',   explorer: '—',          builder: '✓',          operator: '✓'         },
  { label: 'All 9 calc modes',  explorer: '—',          builder: '✓',          operator: '✓'         },
  { label: 'Priority AI',       explorer: '—',          builder: '—',          operator: '✓'         },
  { label: 'Export to CSV',     explorer: '—',          builder: '—',          operator: '✓'         },
];

export default function PaywallScreen({ navigation, route }: Props) {
  const { purchasePlan, restorePurchases, completeOnboarding, tier: currentTier } = useSubscription();
  const [annual, setAnnual]       = useState(true);
  const [selected, setSelected]   = useState<Tier>('builder');
  const [purchasing, setPurchasing] = useState(false);
  const [restoring, setRestoring]  = useState(false);
  const [error, setError]          = useState('');
  const forced = route?.params?.forced;

  async function handlePurchase(t: Tier) {
    setError('');
    if (t === 'explorer') {
      await completeOnboarding();
      navigation.replace('Main');
      return;
    }
    setPurchasing(true);
    try {
      await purchasePlan(t, annual);
      await completeOnboarding();
      navigation.replace('Main');
    } catch (e: any) {
      // User cancelled — no error message needed
      if (!e?.userCancelled) {
        setError(e?.message ?? 'Purchase failed. Please try again.');
      }
    } finally {
      setPurchasing(false);
    }
  }

  async function handleRestore() {
    setError('');
    setRestoring(true);
    try {
      await restorePurchases();
      await completeOnboarding();
      navigation.replace('Main');
    } catch (e: any) {
      setError(e?.message ?? 'Restore failed. Please try again.');
    } finally {
      setRestoring(false);
    }
  }

  function priceLabel(t: Tier): string {
    const p = PLANS[t];
    if (p.monthly === 0) return 'Free';
    return annual ? `$${p.annualMonthly.toFixed(2)}/mo` : `$${p.monthly}/mo`;
  }

  function billingNote(t: Tier): string {
    const p = PLANS[t];
    if (p.monthly === 0) return 'Free forever';
    return annual ? `Billed $${p.annual}/year` : 'Billed monthly';
  }

  const screenHeight = Dimensions.get('window').height;

  return (
    <SafeAreaView style={s.container}>
      <ScrollView
        style={Platform.OS === 'web' ? { height: screenHeight } : { flex: 1 }}
        contentContainerStyle={s.scroll}
        showsVerticalScrollIndicator={false}
      >

        {/* Header */}
        <View style={s.header}>
          <View style={s.logoBadge}>
            <Text style={s.logoText}>◎  SIFTLY</Text>
          </View>
          <Text style={s.headline}>One platform.{'\n'}Full independence.</Text>
          <Text style={s.sub}>
            From first opportunity to a self-sustaining commerce operation — powered by AI.
          </Text>
        </View>

        {/* Annual toggle */}
        <View style={s.toggleCard}>
          <View>
            <Text style={s.toggleTitle}>Annual billing</Text>
            <Text style={s.toggleSub}>Save 40% vs monthly</Text>
          </View>
          <View style={s.toggleRight}>
            <View style={[s.savePill, annual && s.savePillActive]}>
              <Text style={[s.savePillText, annual && s.savePillTextActive]}>SAVE 40%</Text>
            </View>
            <Switch
              value={annual}
              onValueChange={setAnnual}
              trackColor={{ false: colors.gray200, true: colors.cyan }}
              thumbColor={colors.white}
            />
          </View>
        </View>

        {/* Plan cards */}
        {PLAN_ORDER.map(t => {
          const p = PLANS[t];
          const isSelected = selected === t;
          const isRecommended = t === 'builder';
          const isOperator = t === 'operator';
          const isCurrent = t === currentTier;

          return (
            <TouchableOpacity
              key={t}
              style={[
                s.planCard,
                isRecommended && s.planCardRecommended,
                isOperator && s.planCardOperator,
                isSelected && s.planCardSelected,
              ]}
              onPress={() => setSelected(t)}
              activeOpacity={0.9}
            >
              {isRecommended && (
                <View style={s.recommendedBadge}>
                  <Text style={s.recommendedText}>⭐  MOST POPULAR</Text>
                </View>
              )}
              {isOperator && (
                <View style={s.operatorBadge}>
                  <Text style={s.operatorBadgeText}>💎  FOR SCALING SELLERS</Text>
                </View>
              )}
              {isCurrent && (
                <View style={s.currentBadge}>
                  <Text style={s.currentText}>CURRENT PLAN</Text>
                </View>
              )}

              {/* Plan name & price */}
              <View style={s.planHeader}>
                <View>
                  <Text style={s.planName}>{p.name}</Text>
                  <Text style={s.planDesc}>{PLAN_DESCRIPTIONS[t]}</Text>
                </View>
                <View style={s.planPriceWrap}>
                  <Text style={s.planPrice}>{priceLabel(t)}</Text>
                  <Text style={s.planBilling}>{billingNote(t)}</Text>
                </View>
              </View>

              {/* Feature list */}
              <View style={s.featureDivider} />
              {PLAN_FEATURES[t].map((f, i) => (
                <View key={i} style={s.featureRow}>
                  <Text style={s.featureCheck}>✓</Text>
                  <Text style={s.featureText}>{f}</Text>
                </View>
              ))}

              {/* CTA */}
              <TouchableOpacity
                style={[s.planCta, s.planCtaAccent, purchasing && { opacity: 0.5 }]}
                onPress={() => handlePurchase(t)}
                disabled={purchasing}
                activeOpacity={0.85}
              >
                <Text style={[s.planCtaText, s.planCtaTextWhite]}>
                  {t === 'explorer'
                    ? 'Start free'
                    : purchasing && selected === t
                      ? 'Processing…'
                      : `Get ${p.name}`
                  }
                </Text>
              </TouchableOpacity>
            </TouchableOpacity>
          );
        })}

        {/* Comparison table */}
        <View style={s.tableSection}>
          <Text style={s.tableTitle}>Full comparison</Text>
          <View style={s.table}>
            {/* Header row */}
            <View style={[s.tableRow, s.tableHeaderRow]}>
              <Text style={[s.tableCell, s.tableCellFeature, s.tableHeaderText]}>Feature</Text>
              {PLAN_ORDER.map(t => (
                <Text key={t} style={[s.tableCell, s.tableHeaderText]}>
                  {PLANS[t].name}
                </Text>
              ))}
            </View>
            {COMPARISON_ROWS.map((row, i) => (
              <View key={i} style={[s.tableRow, i % 2 === 0 && s.tableRowAlt]}>
                <Text style={[s.tableCell, s.tableCellFeature]}>{row.label}</Text>
                {(['explorer', 'builder', 'operator'] as Tier[]).map(t => (
                  <Text
                    key={t}
                    style={[
                      s.tableCell,
                      s.tableCellVal,
                      row[t] === '—' && { color: colors.textMuted },
                      row[t] === '✓' && { color: colors.green, fontWeight: '700' },
                    ]}
                  >
                    {row[t]}
                  </Text>
                ))}
              </View>
            ))}
          </View>
        </View>

        {/* Launch Pack upsell */}
        <View style={s.launchPack}>
          <View style={s.launchPackHeader}>
            <View>
              <Text style={s.launchPackEyebrow}>ONE-TIME PURCHASE</Text>
              <Text style={s.launchPackTitle}>⚡ Launch Pack</Text>
            </View>
            <Text style={s.launchPackPrice}>${LAUNCH_PACK_PRICE}</Text>
          </View>
          <Text style={s.launchPackDesc}>
            Everything for launch week — brand kit, optimised listing, supplier email sequence, PPC template, and 48-hour activation plan. One-time purchase, yours forever.
          </Text>
          <TouchableOpacity style={s.launchPackCta} activeOpacity={0.85}>
            <Text style={s.launchPackCtaText}>Get the Launch Pack →</Text>
          </TouchableOpacity>
        </View>

        {/* Error */}
        {!!error && (
          <View style={s.errorBox}>
            <Text style={s.errorText}>{error}</Text>
          </View>
        )}

        {/* Footer */}
        <Text style={s.footer}>
          Payments processed securely by Apple. Subscriptions auto-renew monthly or annually. Cancel anytime in iOS Settings.
        </Text>

        <TouchableOpacity
          style={s.restore}
          onPress={handleRestore}
          disabled={restoring}
          activeOpacity={0.7}
        >
          <Text style={s.restoreText}>{restoring ? 'Restoring…' : 'Restore purchases'}</Text>
        </TouchableOpacity>

        {!forced && (
          <TouchableOpacity style={s.skip} onPress={() => handlePurchase('explorer')}>
            <Text style={s.skipText}>Continue with free plan</Text>
          </TouchableOpacity>
        )}

        {/* Legal links */}
        <View style={s.legalRow}>
          <TouchableOpacity onPress={() => navigation.navigate('Legal', { type: 'privacy' })} activeOpacity={0.7}>
            <Text style={s.legalLink}>Privacy Policy</Text>
          </TouchableOpacity>
          <Text style={s.legalDot}>·</Text>
          <TouchableOpacity onPress={() => navigation.navigate('Legal', { type: 'terms' })} activeOpacity={0.7}>
            <Text style={s.legalLink}>Terms of Use</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface },
  scroll: { flexGrow: 1, paddingBottom: 48 },

  header: {
    paddingHorizontal: spacing.lg, paddingTop: spacing.xl, paddingBottom: spacing.lg,
    backgroundColor: colors.bgCard,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  logoBadge: {
    alignSelf: 'flex-start', backgroundColor: colors.cyanDim,
    borderRadius: radius.full, paddingHorizontal: spacing.md, paddingVertical: spacing.xs,
    marginBottom: spacing.md, borderWidth: 1, borderColor: colors.cyanBorder,
  },
  logoText: { fontSize: 11, fontWeight: '700', color: colors.cyan, letterSpacing: 0.5 },
  headline: {
    fontSize: 38, fontWeight: '900', color: colors.cyan,
    letterSpacing: -1.5, lineHeight: 44, marginBottom: spacing.sm,
  },
  sub: { fontSize: 15, color: colors.textSecondary, lineHeight: 22 },

  toggleCard: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: colors.white, padding: spacing.md,
    marginHorizontal: spacing.lg, marginTop: spacing.md,
    borderRadius: radius.md, ...shadow.sm,
  },
  toggleTitle: { fontSize: 15, fontWeight: '700', color: colors.textPrimary },
  toggleSub: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
  toggleRight: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  savePill: {
    borderRadius: radius.full, paddingHorizontal: spacing.sm, paddingVertical: 3,
    borderWidth: 1, borderColor: colors.gray200,
  },
  savePillActive: { backgroundColor: colors.greenLight, borderColor: colors.green },
  savePillText: { fontSize: 9, fontWeight: '800', color: colors.gray400, letterSpacing: 0.5 },
  savePillTextActive: { color: colors.green },

  planCard: {
    backgroundColor: colors.white, borderRadius: radius.lg,
    marginHorizontal: spacing.lg, marginTop: spacing.md,
    padding: spacing.md, borderWidth: 1.5, borderColor: colors.gray200,
    ...shadow.sm,
  },
  planCardRecommended: { borderColor: colors.cyan, ...shadow.md },
  planCardOperator: { borderColor: colors.cyan },
  planCardSelected: { borderColor: colors.cyan },

  recommendedBadge: {
    alignSelf: 'flex-start', backgroundColor: colors.cyanLight,
    borderRadius: radius.full, paddingHorizontal: spacing.sm, paddingVertical: 4,
    marginBottom: spacing.sm,
  },
  recommendedText: { fontSize: 9, fontWeight: '800', color: colors.cyan, letterSpacing: 0.5 },
  operatorBadge: {
    alignSelf: 'flex-start', backgroundColor: colors.cyanLight,
    borderRadius: radius.full, paddingHorizontal: spacing.sm, paddingVertical: 4,
    marginBottom: spacing.sm,
  },
  operatorBadgeText: { fontSize: 9, fontWeight: '800', color: colors.cyan, letterSpacing: 0.5 },
  currentBadge: {
    alignSelf: 'flex-start', backgroundColor: colors.gray100,
    borderRadius: radius.full, paddingHorizontal: spacing.sm, paddingVertical: 4,
    marginBottom: spacing.sm,
  },
  currentText: { fontSize: 9, fontWeight: '800', color: colors.gray600, letterSpacing: 0.5 },

  planHeader: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'flex-start', marginBottom: spacing.md,
  },
  planName: { fontSize: 20, fontWeight: '900', color: colors.textPrimary, letterSpacing: -0.5 },
  planDesc: { fontSize: 12, color: colors.gray600, lineHeight: 16, marginTop: 4, maxWidth: 160 },
  planPriceWrap: { alignItems: 'flex-end' },
  planPrice: { fontSize: 22, fontWeight: '900', color: colors.textPrimary, letterSpacing: -0.5 },
  planBilling: { fontSize: 11, color: colors.gray400, marginTop: 2 },

  featureDivider: { height: 1, backgroundColor: colors.gray100, marginBottom: spacing.md },

  featureRow: { flexDirection: 'row', gap: spacing.sm, alignItems: 'flex-start', marginBottom: 6 },
  featureCheck: { fontSize: 13, fontWeight: '700', color: colors.green, width: 16 },
  featureText: { fontSize: 13, color: colors.gray800, flex: 1, lineHeight: 18 },

  planCta: {
    borderWidth: 1.5, borderRadius: radius.md,
    paddingVertical: spacing.md, alignItems: 'center', marginTop: spacing.md,
  },
  planCtaAccent: { backgroundColor: colors.cyan, borderColor: colors.cyan },
  planCtaText: { fontSize: 15, fontWeight: '700' },
  planCtaTextWhite: { color: colors.white },

  tableSection: { paddingHorizontal: spacing.lg, marginTop: spacing.lg },
  tableTitle: { fontSize: 18, fontWeight: '800', color: colors.cyan, letterSpacing: -0.5, marginBottom: spacing.sm },
  table: {
    backgroundColor: colors.white, borderRadius: radius.lg,
    overflow: 'hidden', borderWidth: 1, borderColor: colors.gray200,
  },
  tableRow: { flexDirection: 'row' },
  tableHeaderRow: { backgroundColor: colors.gray100 },
  tableRowAlt: { backgroundColor: colors.bgSubtle },
  tableCell: {
    flex: 1, paddingVertical: spacing.sm, paddingHorizontal: spacing.sm,
    fontSize: 11, color: colors.gray800, textAlign: 'center',
    borderRightWidth: 1, borderRightColor: colors.gray200,
  },
  tableCellFeature: { flex: 1.4, textAlign: 'left', fontWeight: '600', color: colors.gray600 },
  tableCellVal: { fontWeight: '600' },
  tableHeaderText: { color: colors.cyan, fontWeight: '800', fontSize: 10 },

  launchPack: {
    marginHorizontal: spacing.lg, marginTop: spacing.lg,
    backgroundColor: colors.white, borderRadius: radius.lg, padding: spacing.md,
    borderWidth: 1.5, borderColor: colors.cyanBorder,
  },
  launchPackHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: spacing.sm },
  launchPackEyebrow: { fontSize: 8, fontWeight: '800', color: colors.cyan, letterSpacing: 1.5, marginBottom: 4 },
  launchPackTitle: { fontSize: 20, fontWeight: '900', color: colors.textPrimary, letterSpacing: -0.5 },
  launchPackPrice: { fontSize: 28, fontWeight: '900', color: colors.cyan, letterSpacing: -1 },
  launchPackDesc: { fontSize: 13, color: colors.textSecondary, lineHeight: 19, marginBottom: spacing.md },
  launchPackCta: {
    backgroundColor: colors.cyan, borderRadius: radius.md,
    paddingVertical: spacing.sm + 4, alignItems: 'center',
  },
  launchPackCtaText: { fontSize: 14, fontWeight: '700', color: colors.white },

  footer: {
    fontSize: 12, color: colors.textMuted, textAlign: 'center',
    paddingHorizontal: spacing.xl, marginTop: spacing.lg, lineHeight: 18,
  },
  skip: { alignItems: 'center', paddingVertical: spacing.md },
  skipText: { fontSize: 14, color: colors.gray400, fontWeight: '500' },

  errorBox: {
    marginHorizontal: spacing.lg, marginTop: spacing.md,
    backgroundColor: colors.redLight, borderRadius: radius.md, padding: spacing.sm + 2,
  },
  errorText: { fontSize: 13, color: colors.red, textAlign: 'center', fontWeight: '500' },

  restore: { alignItems: 'center', paddingVertical: spacing.sm },
  restoreText: { fontSize: 13, color: colors.textMuted, fontWeight: '500' },

  legalRow: {
    flexDirection: 'row', justifyContent: 'center', alignItems: 'center',
    gap: spacing.sm, paddingBottom: spacing.lg, paddingTop: spacing.xs,
  },
  legalLink: { fontSize: 12, color: colors.textMuted, fontWeight: '500' },
  legalDot:  { fontSize: 12, color: colors.border },
});
