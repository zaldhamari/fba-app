import React, { useState } from 'react';
import { DS } from '../theme/ds';
import {
  Modal, View, Text, StyleSheet, TouchableOpacity,
  ScrollView, Alert,
} from 'react-native';
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
        <TouchableOpacity style={s.backdrop} activeOpacity={1} onPress={onClose} />

        <View style={s.sheet}>
          <View style={s.handle} />

          {succeeded ? (
            <View style={s.successBox}>
              <View style={s.successIconWrap}>
                <Text style={s.successIconTxt}>✓</Text>
              </View>
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

              {/* Billing period toggle */}
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
                  <View style={s.saveBadge}>
                    <Text style={s.saveBadgeText}>SAVE 40%</Text>
                  </View>
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
  overlay:  { flex: 1, justifyContent: 'flex-end' },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.7)',
  },
  sheet: {
    backgroundColor: DS.bgCard,
    borderTopLeftRadius: 28, borderTopRightRadius: 28,
    borderTopWidth: 1.5, borderLeftWidth: 1.5, borderRightWidth: 1.5,
    borderColor: DS.accent + '30',
    paddingHorizontal: DS.pagePadding,
    paddingBottom: 36,
    paddingTop: 16,
    maxHeight: '90%',
  },
  handle: {
    width: 40, height: 4, borderRadius: 2,
    backgroundColor: DS.bgElevated, alignSelf: 'center', marginBottom: 20,
  },

  context:   { fontSize: 9, fontWeight: '800', color: DS.accent, letterSpacing: 2, marginBottom: 4 },
  resetNote: { fontSize: 11, color: DS.textMuted, marginBottom: 4, fontStyle: 'italic' },
  title: {
    fontSize: 28, fontWeight: '900', color: DS.textPrimary,
    letterSpacing: -1, lineHeight: 34, marginBottom: 16,
  },

  billingRow: {
    flexDirection: 'row', gap: 8, marginBottom: 12,
  },
  billingBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, borderWidth: 1.5, borderColor: DS.border,
    borderRadius: DS.radiusButton, paddingVertical: 10,
    backgroundColor: DS.bgElevated,
  },
  billingBtnActive:      { borderColor: DS.accent, backgroundColor: DS.accent + '10' },
  billingBtnLabel:       { fontSize: 14, fontWeight: '700', color: DS.textMuted },
  billingBtnLabelActive: { color: DS.accent },
  saveBadge: {
    backgroundColor: DS.success + '20', borderRadius: DS.radiusBadge,
    paddingHorizontal: 7, paddingVertical: 2,
    borderWidth: 1, borderColor: DS.success + '40',
  },
  saveBadgeText: { fontSize: 8, fontWeight: '800', color: DS.success, letterSpacing: 0.5 },

  tierRow:      { flexDirection: 'row', gap: 8, marginBottom: 12 },
  tierCard: {
    flex: 1, borderWidth: 1.5, borderColor: DS.border,
    borderRadius: DS.radiusCard, padding: DS.cardPadding, gap: 4,
    backgroundColor: DS.bgElevated,
  },
  tierCardActive:  { borderColor: DS.accent, backgroundColor: DS.accent + '10' },
  popularBadge: {
    backgroundColor: DS.accent, borderRadius: DS.radiusBadge,
    paddingHorizontal: 6, paddingVertical: 2, alignSelf: 'flex-start',
    marginBottom: 4,
  },
  popularText:     { fontSize: 8, fontWeight: '800', color: '#fff', letterSpacing: 0.5 },
  tierName:        { fontSize: 13, fontWeight: '800', color: DS.textMuted },
  tierNameActive:  { color: DS.accent },
  tierPrice:       { fontSize: 22, fontWeight: '900', color: DS.textPrimary, letterSpacing: -0.5 },
  tierPriceActive: { color: DS.accent },
  tierPer:         { fontSize: 13, fontWeight: '400' },
  tierSub:         { fontSize: 11, color: DS.textMuted, lineHeight: 15 },
  tierSubActive:   { color: DS.accent },

  featureScroll: { maxHeight: 160, marginBottom: 14 },
  featureRow:    { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 5 },
  featureDot:    { width: 6, height: 6, borderRadius: 3, backgroundColor: DS.accent, flexShrink: 0 },
  featureText:   { fontSize: 13, color: DS.textSecondary, flex: 1, lineHeight: 18 },

  cta: {
    backgroundColor: DS.accent, borderRadius: DS.radiusButton,
    paddingVertical: 16, alignItems: 'center', marginBottom: 8,
  },
  ctaDisabled: { opacity: 0.5 },
  ctaText:     { fontSize: 15, fontWeight: '800', color: '#fff', letterSpacing: -0.2 },
  billing:     { fontSize: 11, color: DS.textMuted, textAlign: 'center', marginBottom: 8 },
  errorText:   { fontSize: 12, color: DS.danger, textAlign: 'center', marginBottom: 6 },

  restore:     { alignItems: 'center', paddingVertical: 4 },
  restoreText: { fontSize: 12, color: DS.textMuted, fontWeight: '500' },
  dismiss:     { alignItems: 'center', paddingVertical: 10 },
  dismissText: { fontSize: 14, color: DS.textMuted, fontWeight: '500' },

  successBox: { alignItems: 'center', paddingVertical: 48, gap: 12 },
  successIconWrap: {
    width: 64, height: 64, borderRadius: 32,
    backgroundColor: DS.success + '18', borderWidth: 1.5, borderColor: DS.success + '40',
    alignItems: 'center', justifyContent: 'center',
  },
  successIconTxt:  { fontSize: 28, color: DS.success },
  successTitle:    { fontSize: 22, fontWeight: '900', color: DS.textPrimary, letterSpacing: -0.5 },
  successBody:     { fontSize: 14, color: DS.textSecondary, textAlign: 'center', lineHeight: 20 },
});
