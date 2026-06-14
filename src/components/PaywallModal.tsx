import React, { useState } from 'react';
import { DS } from '../theme/ds';
import {
  Modal, View, Text, StyleSheet, TouchableOpacity,
  ScrollView, Alert,
} from 'react-native';
import { colors, spacing, radius } from '../theme';
import { useSubscription, Tier, PLANS, PLAN_FEATURES } from '../hooks/useSubscription';

interface Props {
  visible: boolean;
  onClose?: () => void;
  onSuccess?: () => void;
  featureContext?: string;
  defaultTier?: Tier;
  resetDate?: string;
}

const CONTEXT_HEADLINES: Record<string, string> = {
  research:   'You\'ve used your free searches.',
  suppliers:  'Supplier sourcing is a Builder feature.',
  keywords:   'Keyword intelligence is a Builder feature.',
  brands:     'You\'ve used your free brand kits.',
  saves:      'Opportunity vault is a Builder feature.',
  free_limit: 'You\'ve used all your free product lookups this month.',
  default:    'Unlock the full platform.',
};

const TIER_SUBTITLES: Record<Tier, string> = {
  explorer: 'Start free, no commitment',
  builder:  'For sellers ready to launch their first product',
  operator: 'For commerce operators scaling at speed',
};

export default function PaywallModal({
  visible, onClose, onSuccess, featureContext = 'default', defaultTier = 'builder', resetDate,
}: Props) {
  const { purchasePlan, restorePurchases } = useSubscription();
  const [selected, setSelected]   = useState<Tier>(defaultTier);
  const [annual, setAnnual]       = useState(true);
  const [purchasing, setPurchasing] = useState(false);
  const [restoring, setRestoring]  = useState(false);
  const [error, setError]          = useState('');
  const [succeeded, setSucceeded]  = useState(false);

  const headline = CONTEXT_HEADLINES[featureContext] ?? CONTEXT_HEADLINES.default;
  const formattedResetDate = resetDate
    ? (() => {
        try {
          return new Date(resetDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
        } catch {
          return resetDate;
        }
      })()
    : undefined;
  const plan = PLANS[selected];
  const displayPrice = annual && selected !== 'explorer'
    ? plan.annualMonthly.toFixed(2)
    : plan.monthly.toFixed(0);
  const annualSavings = selected !== 'explorer'
    ? Math.round(plan.monthly * 12 - plan.annual)
    : 0;
  const billingNote = annual && selected !== 'explorer'
    ? `Billed $${plan.annual}/year — save $${annualSavings}`
    : 'Billed monthly';

  async function handlePurchase() {
    if (selected === 'explorer') { onClose?.(); return; }
    setError('');
    setPurchasing(true);
    try {
      await purchasePlan(selected, annual);
      setSucceeded(true);
      onSuccess?.();
      setTimeout(() => onClose?.(), 1800);
    } catch (e: any) {
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
      const restoredTier = await restorePurchases();
      if (restoredTier === 'explorer') {
        Alert.alert(
          'No Subscription Found',
          'No active purchases were found for this Apple ID. If you believe this is an error, check that you are signed in with the correct Apple ID.',
        );
        return;
      }
      setSucceeded(true);
      onSuccess?.();
      setTimeout(() => onClose?.(), 1800);
    } catch (e: any) {
      setError(e?.message ?? 'Restore failed. Please try again.');
    } finally {
      setRestoring(false);
    }
  }

  const tiers: Tier[] = ['builder', 'operator'];

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={s.overlay}>
        {/* Tap-outside to dismiss */}
        <TouchableOpacity style={s.backdrop} activeOpacity={1} onPress={onClose} />

        <View style={s.sheet}>
          <View style={s.handle} />

          {succeeded ? (
            <View style={s.successBox}>
              <Text style={s.successIcon}>✓</Text>
              <Text style={s.successTitle}>You're all set!</Text>
              <Text style={s.successBody}>Your plan is now active. Continue where you left off.</Text>
            </View>
          ) : (
            <>
          {/* Header */}
          <Text style={s.context}>{headline}</Text>
          {formattedResetDate ? (
            <Text style={s.resetNote}>
              Your free lookups reset on {formattedResetDate}.
            </Text>
          ) : null}
          <Text style={s.title}>Unlock more{'\n'}opportunity.</Text>

          {/* Billing period selector */}
          <View style={s.billingRow}>
            <TouchableOpacity
              style={[s.billingBtn, !annual && s.billingBtnActive]}
              onPress={() => setAnnual(false)}
              activeOpacity={0.85}
            >
              <Text style={[s.billingBtnLabel, !annual && s.billingBtnLabelActive]}>Monthly</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[s.billingBtn, annual && s.billingBtnActive]}
              onPress={() => setAnnual(true)}
              activeOpacity={0.85}
            >
              <Text style={[s.billingBtnLabel, annual && s.billingBtnLabelActive]}>Annual</Text>
              <View style={s.saveBadge}><Text style={s.saveBadgeText}>SAVE 40%</Text></View>
            </TouchableOpacity>
          </View>

          {/* Tier selector */}
          <View style={s.tierRow}>
            {tiers.map(t => {
              const p = PLANS[t];
              const price = annual ? p.annualMonthly.toFixed(2) : p.monthly.toFixed(0);
              const active = selected === t;
              return (
                <TouchableOpacity
                  key={t}
                  style={[s.tierCard, active && s.tierCardActive]}
                  onPress={() => setSelected(t)}
                  activeOpacity={0.85}
                >
                  {t === 'builder' && (
                    <View style={s.popularBadge}>
                      <Text style={s.popularText}>POPULAR</Text>
                    </View>
                  )}
                  <Text style={[s.tierName, active && s.tierNameActive]}>{p.name}</Text>
                  <Text style={[s.tierPrice, active && s.tierPriceActive]}>
                    ${price}<Text style={s.tierPer}>/mo</Text>
                  </Text>
                  <Text style={[s.tierSub, active && s.tierSubActive]}>
                    {TIER_SUBTITLES[t]}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Features for selected tier */}
          <ScrollView style={s.featureScroll} showsVerticalScrollIndicator={false}>
            {PLAN_FEATURES[selected].map((f, i) => (
              <View key={i} style={s.featureRow}>
                <View style={s.featureDot} />
                <Text style={s.featureText}>{f}</Text>
              </View>
            ))}
          </ScrollView>

          {/* CTA */}
          <TouchableOpacity
            style={[s.cta, purchasing && s.ctaDisabled]}
            onPress={handlePurchase}
            disabled={purchasing}
            activeOpacity={0.85}
            accessibilityRole="button"
            accessibilityLabel={purchasing ? 'Processing purchase' : `Subscribe to ${PLANS[selected].name} plan`}
            accessibilityState={{ disabled: purchasing, busy: purchasing }}
          >
            <Text style={s.ctaText}>
              {purchasing
                ? 'Processing…'
                : `Start ${PLANS[selected].name} — $${displayPrice}/mo`}
            </Text>
          </TouchableOpacity>
          <Text style={s.billing}>{billingNote} · Cancel anytime</Text>

          {!!error && (
            <Text style={s.errorText}>{error}</Text>
          )}

          <TouchableOpacity
            style={s.restore}
            onPress={handleRestore}
            disabled={restoring}
            activeOpacity={0.7}
          >
            <Text style={s.restoreText}>{restoring ? 'Restoring…' : 'Restore purchases'}</Text>
          </TouchableOpacity>

          {onClose && (
            <TouchableOpacity style={s.dismiss} onPress={onClose}>
              <Text style={s.dismissText}>Maybe later</Text>
            </TouchableOpacity>
          )}
            </>
          )}
        </View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end' },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.7)',
  },
  sheet: {
    backgroundColor: colors.bgCard,
    borderTopLeftRadius: 28, borderTopRightRadius: 28,
    borderTopWidth: 1, borderLeftWidth: 1, borderRightWidth: 1,
    borderColor: 'rgba(37,99,235,0.22)',
    paddingHorizontal: spacing.lg,
    paddingBottom: 36,
    paddingTop: spacing.md,
    maxHeight: '90%',
  },
  handle: {
    width: 40, height: 4, borderRadius: 2,
    backgroundColor: colors.bgElevated, alignSelf: 'center', marginBottom: spacing.lg,
  },
  context:   { fontSize: 9, fontWeight: '800', color: DS.accent, letterSpacing: 2, marginBottom: spacing.xs },
  resetNote: { fontSize: 11, color: colors.textMuted, marginBottom: spacing.xs, fontStyle: 'italic' },
  title: {
    fontSize: 28, fontWeight: '900', color: colors.textPrimary,
    letterSpacing: -1, lineHeight: 34, marginBottom: spacing.md,
  },

  billingRow: {
    flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md,
  },
  billingBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: spacing.xs, borderWidth: 1, borderColor: colors.border,
    borderRadius: radius.md, paddingVertical: spacing.sm + 2,
    backgroundColor: colors.bgElevated,
  },
  billingBtnActive: { borderColor: DS.accent, backgroundColor: 'rgba(37,99,235,0.08)' },
  billingBtnLabel: { fontSize: 14, fontWeight: '700', color: colors.textMuted },
  billingBtnLabelActive: { color: DS.accent },
  saveBadge: {
    backgroundColor: 'rgba(52,211,153,0.15)', borderRadius: radius.full,
    paddingHorizontal: spacing.sm, paddingVertical: 2,
    borderWidth: 1, borderColor: 'rgba(52,211,153,0.3)',
  },
  saveBadgeText: { fontSize: 8, fontWeight: '800', color: colors.green, letterSpacing: 0.5 },

  tierRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md },
  tierCard: {
    flex: 1, borderWidth: 1, borderColor: colors.border,
    borderRadius: radius.md, padding: spacing.md, gap: 4,
    backgroundColor: colors.bgElevated,
  },
  tierCardActive: { borderColor: DS.accent, backgroundColor: 'rgba(37,99,235,0.10)' },
  popularBadge: {
    backgroundColor: DS.accent, borderRadius: radius.full,
    paddingHorizontal: 6, paddingVertical: 2, alignSelf: 'flex-start',
    marginBottom: 4,
  },
  popularText: { fontSize: 8, fontWeight: '800', color: colors.white, letterSpacing: 0.5 },
  tierName: { fontSize: 13, fontWeight: '800', color: colors.textMuted },
  tierNameActive: { color: DS.accent },
  tierPrice: { fontSize: 22, fontWeight: '900', color: colors.textPrimary, letterSpacing: -0.5 },
  tierPriceActive: { color: DS.accent },
  tierPer: { fontSize: 13, fontWeight: '400' },
  tierSub: { fontSize: 11, color: colors.textMuted, lineHeight: 15 },
  tierSubActive: { color: DS.accent },

  featureScroll: { maxHeight: 160, marginBottom: spacing.md },
  featureRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: 5 },
  featureDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: DS.accent },
  featureText: { fontSize: 13, color: colors.textSecondary, flex: 1, lineHeight: 18 },

  cta: {
    backgroundColor: DS.accent, borderRadius: radius.md,
    paddingVertical: spacing.md + 2, alignItems: 'center', marginBottom: spacing.sm,
  },
  ctaDisabled: { opacity: 0.5 },
  ctaText: { fontSize: 15, fontWeight: '700', color: colors.white, letterSpacing: -0.2 },
  billing: { fontSize: 11, color: colors.textMuted, textAlign: 'center', marginBottom: spacing.sm },
  errorText: { fontSize: 12, color: colors.red, textAlign: 'center', marginBottom: spacing.xs },
  restore: { alignItems: 'center', paddingVertical: 4 },
  restoreText: { fontSize: 12, color: colors.textMuted, fontWeight: '500' },
  dismiss: { alignItems: 'center', paddingVertical: spacing.sm },
  dismissText: { fontSize: 14, color: colors.textMuted, fontWeight: '500' },
  successBox: { alignItems: 'center', paddingVertical: 48, gap: 12 },
  successIcon: { fontSize: 48, color: colors.green },
  successTitle: { fontSize: 22, fontWeight: '900', color: colors.textPrimary, letterSpacing: -0.5 },
  successBody: { fontSize: 14, color: colors.textSecondary, textAlign: 'center', lineHeight: 20 },
});
