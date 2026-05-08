import React, { useState } from 'react';
import {
  Modal, View, Text, StyleSheet, TouchableOpacity,
  ScrollView, Switch,
} from 'react-native';
import { colors, spacing, radius } from '../theme';
import { useSubscription, Tier, PLANS, PLAN_FEATURES } from '../hooks/useSubscription';

interface Props {
  visible: boolean;
  onClose?: () => void;
  // Which feature triggered the paywall — used for contextual headline
  featureContext?: string;
  // Pre-select a specific tier
  defaultTier?: Tier;
}

const CONTEXT_HEADLINES: Record<string, string> = {
  research:  'You\'ve used your free searches.',
  suppliers: 'Supplier sourcing is a Builder feature.',
  keywords:  'Keyword intelligence is a Builder feature.',
  brands:    'You\'ve used your free brand kits.',
  saves:     'Opportunity vault is a Builder feature.',
  default:   'Unlock the full platform.',
};

const TIER_SUBTITLES: Record<Tier, string> = {
  explorer: 'Start free, no commitment',
  builder:  'For sellers ready to launch their first product',
  operator: 'For commerce operators scaling at speed',
};

export default function PaywallModal({
  visible, onClose, featureContext = 'default', defaultTier = 'builder',
}: Props) {
  const { purchasePlan, restorePurchases } = useSubscription();
  const [selected, setSelected]   = useState<Tier>(defaultTier);
  const [annual, setAnnual]       = useState(true);
  const [purchasing, setPurchasing] = useState(false);
  const [restoring, setRestoring]  = useState(false);
  const [error, setError]          = useState('');

  const headline = CONTEXT_HEADLINES[featureContext] ?? CONTEXT_HEADLINES.default;
  const plan = PLANS[selected];
  const displayPrice = annual && selected !== 'explorer'
    ? plan.annualMonthly.toFixed(2)
    : plan.monthly.toFixed(0);
  const billingNote = annual && selected !== 'explorer'
    ? `Billed $${plan.annual}/year`
    : 'Billed monthly';

  async function handlePurchase() {
    if (selected === 'explorer') { onClose?.(); return; }
    setError('');
    setPurchasing(true);
    try {
      await purchasePlan(selected, annual);
      onClose?.();
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
      await restorePurchases();
      onClose?.();
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

          {/* Header */}
          <Text style={s.context}>{headline}</Text>
          <Text style={s.title}>Unlock more{'\n'}opportunity.</Text>

          {/* Annual toggle */}
          <View style={s.toggleRow}>
            <Text style={s.toggleLabel}>Annual billing</Text>
            <View style={s.toggleRight}>
              <View style={s.saveBadge}>
                <Text style={s.saveBadgeText}>SAVE 40%</Text>
              </View>
              <Switch
                value={annual}
                onValueChange={setAnnual}
                trackColor={{ false: colors.gray200, true: colors.cyan }}
                thumbColor={colors.white}
              />
            </View>
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
    borderColor: colors.cyanBorder,
    paddingHorizontal: spacing.lg,
    paddingBottom: 36,
    paddingTop: spacing.md,
    maxHeight: '90%',
  },
  handle: {
    width: 40, height: 4, borderRadius: 2,
    backgroundColor: colors.bgElevated, alignSelf: 'center', marginBottom: spacing.lg,
  },
  context: { fontSize: 9, fontWeight: '800', color: colors.cyan, letterSpacing: 2, marginBottom: spacing.xs },
  title: {
    fontSize: 28, fontWeight: '900', color: colors.textPrimary,
    letterSpacing: -1, lineHeight: 34, marginBottom: spacing.md,
  },

  toggleRow: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between', marginBottom: spacing.md,
  },
  toggleLabel: { fontSize: 15, fontWeight: '600', color: colors.textPrimary },
  toggleRight: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  saveBadge: {
    backgroundColor: 'rgba(52,211,153,0.15)', borderRadius: radius.full,
    paddingHorizontal: spacing.sm, paddingVertical: 3,
    borderWidth: 1, borderColor: 'rgba(52,211,153,0.3)',
  },
  saveBadgeText: { fontSize: 9, fontWeight: '800', color: colors.green, letterSpacing: 0.5 },

  tierRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md },
  tierCard: {
    flex: 1, borderWidth: 1, borderColor: colors.border,
    borderRadius: radius.md, padding: spacing.md, gap: 4,
    backgroundColor: colors.bgElevated,
  },
  tierCardActive: { borderColor: colors.cyan, backgroundColor: colors.cyanDim },
  popularBadge: {
    backgroundColor: colors.cyan, borderRadius: radius.full,
    paddingHorizontal: 6, paddingVertical: 2, alignSelf: 'flex-start',
    marginBottom: 4,
  },
  popularText: { fontSize: 8, fontWeight: '800', color: colors.white, letterSpacing: 0.5 },
  tierName: { fontSize: 13, fontWeight: '800', color: colors.textMuted },
  tierNameActive: { color: colors.cyan },
  tierPrice: { fontSize: 22, fontWeight: '900', color: colors.textPrimary, letterSpacing: -0.5 },
  tierPriceActive: { color: colors.cyan },
  tierPer: { fontSize: 13, fontWeight: '400' },
  tierSub: { fontSize: 11, color: colors.textMuted, lineHeight: 15 },
  tierSubActive: { color: colors.cyan },

  featureScroll: { maxHeight: 160, marginBottom: spacing.md },
  featureRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: 5 },
  featureDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.cyan },
  featureText: { fontSize: 13, color: colors.textSecondary, flex: 1, lineHeight: 18 },

  cta: {
    backgroundColor: colors.cyan, borderRadius: radius.md,
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
});
