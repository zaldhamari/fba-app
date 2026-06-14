import React, { useState } from 'react';
import { DS } from '../theme/ds';
import {
  Modal, View, Text, StyleSheet, TouchableOpacity, ScrollView,
} from 'react-native';
import { colors, typography, spacing, radius, shadow } from '../theme';
import { useSubscription, LAUNCH_PACK_PRICE } from '../hooks/useSubscription';

interface Props {
  visible: boolean;
  onClose: () => void;
  productName?: string;
}

const PACK_ITEMS = [
  { emoji: '🏷️', title: 'Complete Brand Kit', desc: 'Name, tagline, logo concept, packaging brief, and brand style guide.' },
  { emoji: '📝', title: 'Optimized Amazon Listing', desc: 'Conversion-focused title, 5 bullet points, A+ description, and backend keywords.' },
  { emoji: '📧', title: 'Supplier Email Sequence', desc: '3 emails: intro, follow-up, and negotiation — ready to copy and send.' },
  { emoji: '📊', title: 'PPC Launch Template', desc: 'Suggested bid structure, daily budget split, and campaign naming convention.' },
  { emoji: '✅', title: '48-Hour Activation Plan', desc: 'Day-by-day checklist from going live to your first review request.' },
];

export default function LaunchPackModal({ visible, onClose, productName }: Props) {
  const { purchaseLaunchPack, launchPackPurchased } = useSubscription();
  const [purchasing, setPurchasing] = useState(false);
  const [purchased, setPurchased] = useState(false);

  async function handlePurchase() {
    setPurchasing(true);
    try {
      await purchaseLaunchPack();
      setPurchased(true);
    } catch {
      // purchaseLaunchPack throws until wired to a real RevenueCat product.
      // The CTA button is disabled so this path is unreachable in production —
      // this catch exists as a safety net against future code regressions.
    } finally {
      setPurchasing(false);
    }
  }

  if (launchPackPurchased || purchased) {
    return (
      <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
        <View style={s.overlay}>
          <TouchableOpacity style={s.backdrop} activeOpacity={1} onPress={onClose} />
          <View style={s.sheet}>
            <View style={s.handle} />
            <View style={s.successView}>
              <Text style={s.successIcon}>🎉</Text>
              <Text style={s.successTitle}>Launch Pack unlocked!</Text>
              <Text style={s.successSub}>
                Your brand kit, listing, emails, and PPC template are ready. Check the Brand and Suppliers tabs.
              </Text>
              <TouchableOpacity style={s.doneBtn} onPress={onClose} activeOpacity={0.85}>
                <Text style={s.doneBtnText}>Let's launch →</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    );
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={s.overlay}>
        <TouchableOpacity style={s.backdrop} activeOpacity={1} onPress={onClose} />
        <View style={s.sheet}>
          <View style={s.handle} />

          {/* Header */}
          <View style={s.header}>
            <View style={s.headerLeft}>
              <Text style={s.eyebrow}>ONE-TIME · NO SUBSCRIPTION</Text>
              <Text style={s.title}>⚡ Launch Pack</Text>
              {productName && (
                <Text style={s.productName}>for {productName}</Text>
              )}
            </View>
            <View style={s.priceWrap}>
              <Text style={s.price}>${LAUNCH_PACK_PRICE}</Text>
              <Text style={s.priceNote}>one time</Text>
            </View>
          </View>

          <Text style={s.pitch}>
            You've done the research. Your brand is built. This pack gives you everything your launch week needs — done for you in 60 seconds.
          </Text>

          {/* What's included */}
          <ScrollView style={s.itemsScroll} showsVerticalScrollIndicator={false}>
            {PACK_ITEMS.map((item, i) => (
              <View key={i} style={s.packItem}>
                <Text style={s.packItemEmoji}>{item.emoji}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={s.packItemTitle}>{item.title}</Text>
                  <Text style={s.packItemDesc}>{item.desc}</Text>
                </View>
              </View>
            ))}
          </ScrollView>

          {/* Value callout */}
          <View style={s.valueRow}>
            <View style={s.valueItem}>
              <Text style={s.valueNum}>5</Text>
              <Text style={s.valueLabel}>DELIVERABLES</Text>
            </View>
            <View style={s.valueDivider} />
            <View style={s.valueItem}>
              <Text style={s.valueNum}>60s</Text>
              <Text style={s.valueLabel}>GENERATED</Text>
            </View>
            <View style={s.valueDivider} />
            <View style={s.valueItem}>
              <Text style={s.valueNum}>∞</Text>
              <Text style={s.valueLabel}>YOURS FOREVER</Text>
            </View>
          </View>

          {/* CTA — disabled until wired to RevenueCat IAP */}
          <TouchableOpacity
            style={[s.cta, s.ctaDisabled]}
            disabled
            activeOpacity={1}
          >
            <Text style={s.ctaText}>Coming Soon</Text>
          </TouchableOpacity>
          <Text style={s.ctaNote}>Launch Pack will be available in an upcoming update.</Text>

          <TouchableOpacity style={s.dismiss} onPress={onClose}>
            <Text style={s.dismissText}>I'll launch without it</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end' },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  sheet: {
    backgroundColor: colors.white,
    borderTopLeftRadius: 28, borderTopRightRadius: 28,
    paddingHorizontal: spacing.lg,
    paddingBottom: 36,
    paddingTop: spacing.md,
    maxHeight: '92%',
  },
  handle: {
    width: 40, height: 4, borderRadius: 2,
    backgroundColor: colors.gray200, alignSelf: 'center', marginBottom: spacing.lg,
  },

  header: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'flex-start', marginBottom: spacing.sm,
  },
  headerLeft: { flex: 1 },
  eyebrow: { fontSize: 9, fontWeight: '800', color: DS.accent, letterSpacing: 1.5, textTransform: 'uppercase' },
  title: { fontSize: 26, fontWeight: '900', color: colors.textPrimary, letterSpacing: -1, marginTop: 4 },
  productName: { fontSize: 13, color: colors.gray600, marginTop: 4 },
  priceWrap: { alignItems: 'flex-end' },
  price: { fontSize: 36, fontWeight: '900', color: colors.textPrimary, letterSpacing: -1.5 },
  priceNote: { fontSize: 12, color: colors.gray400, textAlign: 'right' },

  pitch: {
    fontSize: 14, color: colors.gray600, lineHeight: 20,
    marginBottom: spacing.md,
  },

  itemsScroll: { maxHeight: 240, marginBottom: spacing.md },
  packItem: {
    flexDirection: 'row', gap: spacing.md, alignItems: 'flex-start',
    paddingVertical: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.gray100,
  },
  packItemEmoji: { fontSize: 22, width: 28 },
  packItemTitle: { fontSize: 14, fontWeight: '700', color: colors.textPrimary, marginBottom: 2 },
  packItemDesc: { fontSize: 12, color: colors.gray600, lineHeight: 17 },

  valueRow: {
    flexDirection: 'row', backgroundColor: 'rgba(37,99,235,0.10)',
    borderRadius: radius.md, marginBottom: spacing.md, overflow: 'hidden',
    borderWidth: 1, borderColor: 'rgba(37,99,235,0.22)',
  },
  valueItem: { flex: 1, alignItems: 'center', paddingVertical: spacing.md },
  valueDivider: { width: 1, backgroundColor: 'rgba(37,99,235,0.22)' },
  valueNum: { fontSize: 22, fontWeight: '900', color: DS.accent, letterSpacing: -1 },
  valueLabel: { fontSize: 8, fontWeight: '700', color: colors.textMuted, letterSpacing: 1.5, textTransform: 'uppercase', marginTop: 2 },

  cta: {
    backgroundColor: DS.accent, borderRadius: radius.md,
    paddingVertical: spacing.md + 2, alignItems: 'center', marginBottom: spacing.sm,
  },
  ctaDisabled: { opacity: 0.5 },
  ctaText: { fontSize: 15, fontWeight: '700', color: colors.white },
  ctaNote: { ...typography.caption, textAlign: 'center', marginBottom: spacing.sm },
  dismiss: { alignItems: 'center', paddingVertical: spacing.sm },
  dismissText: { fontSize: 14, color: colors.gray400, fontWeight: '500' },

  successView: { alignItems: 'center', paddingVertical: spacing.xl, gap: spacing.md },
  successIcon: { fontSize: 52 },
  successTitle: { fontSize: 24, fontWeight: '900', color: colors.textPrimary, letterSpacing: -0.5 },
  successSub: { fontSize: 14, color: colors.gray600, textAlign: 'center', lineHeight: 20 },
  doneBtn: {
    backgroundColor: DS.accent, borderRadius: radius.md,
    paddingVertical: spacing.md, paddingHorizontal: spacing.xl,
    marginTop: spacing.sm,
  },
  doneBtnText: { fontSize: 15, fontWeight: '700', color: colors.white },
});
