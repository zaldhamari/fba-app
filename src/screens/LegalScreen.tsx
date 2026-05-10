import React, { useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  Share, Linking, StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StackNavigationProp } from '@react-navigation/stack';
import { RouteProp } from '@react-navigation/native';
import { RootStackParamList } from '../navigation/RootNavigator';
import { colors, spacing, radius } from '../theme';
import { LEGAL_DOCUMENTS, LegalDocumentType, PolicySection } from '../constants/legalContent';

type Props = {
  navigation: StackNavigationProp<RootStackParamList, 'Legal'>;
  route: RouteProp<RootStackParamList, 'Legal'>;
};

export default function LegalScreen({ navigation, route }: Props) {
  const doc  = LEGAL_DOCUMENTS[route.params.type];
  const scrollRef = useRef<ScrollView>(null);

  async function handleShare() {
    try {
      await Share.share({
        title: `Siftly ${doc.title}`,
        message: `Siftly ${doc.title}\n\nEffective ${doc.effectiveDate}\n\nRead online: ${doc.websiteUrl}`,
        url: doc.websiteUrl,
      });
    } catch {}
  }

  function handleEmail() {
    Linking.openURL(`mailto:${doc.supportEmail}?subject=${encodeURIComponent(doc.title + ' Inquiry')}`);
  }

  function handleBrowser() {
    Linking.openURL(doc.websiteUrl);
  }

  return (
    <SafeAreaView style={s.safe} edges={['top', 'bottom']}>
      <StatusBar barStyle="dark-content" />

      {/* ── Top bar ─────────────────────────────────────────── */}
      <View style={s.topBar}>
        <TouchableOpacity style={s.backBtn} onPress={() => navigation.goBack()} activeOpacity={0.7}>
          <Text style={s.backArrow}>←</Text>
        </TouchableOpacity>
        <TouchableOpacity style={s.shareBtn} onPress={handleShare} activeOpacity={0.7}>
          <Text style={s.shareBtnText}>Share</Text>
        </TouchableOpacity>
      </View>

      {/* ── Content ─────────────────────────────────────────── */}
      <ScrollView
        ref={scrollRef}
        style={s.scroll}
        contentContainerStyle={s.scrollContent}
        showsVerticalScrollIndicator={false}
        removeClippedSubviews
        scrollEventThrottle={16}
      >
        {/* Hero */}
        <View style={s.hero}>
          <View style={s.orbBg} />
          <Text style={s.eyebrow}>{doc.eyebrow}</Text>
          <Text style={s.title}>{doc.title}</Text>
          <Text style={s.effectiveDate}>Effective {doc.effectiveDate}</Text>
          <Text style={s.intro}>{doc.intro}</Text>
        </View>

        {/* Sections */}
        <View style={s.sections}>
          {doc.sections.map((section: PolicySection, index: number) => (
            <View key={section.id} style={s.sectionCard}>
              <Text style={s.sectionNumber}>{String(index + 1).padStart(2, '0')}</Text>
              <Text style={s.sectionTitle}>{section.title}</Text>
              <Text style={s.sectionBody}>{section.body}</Text>
            </View>
          ))}
        </View>

        {/* Support email chip */}
        <TouchableOpacity style={s.emailChip} onPress={handleEmail} activeOpacity={0.8}>
          <Text style={s.emailChipLabel}>SUPPORT</Text>
          <Text style={s.emailChipValue}>{doc.supportEmail}</Text>
          <Text style={s.emailChipArrow}>→</Text>
        </TouchableOpacity>

        {/* Bottom actions */}
        <View style={s.actions}>
          <TouchableOpacity style={s.actionBtn} onPress={handleEmail} activeOpacity={0.8}>
            <Text style={s.actionIcon}>✉</Text>
            <Text style={s.actionText}>Email Us</Text>
          </TouchableOpacity>
          <View style={s.actionDivider} />
          <TouchableOpacity style={s.actionBtn} onPress={handleShare} activeOpacity={0.8}>
            <Text style={s.actionIcon}>↑</Text>
            <Text style={s.actionText}>Share</Text>
          </TouchableOpacity>
          <View style={s.actionDivider} />
          <TouchableOpacity style={s.actionBtn} onPress={handleBrowser} activeOpacity={0.8}>
            <Text style={s.actionIcon}>⊙</Text>
            <Text style={s.actionText}>Browser</Text>
          </TouchableOpacity>
        </View>

        {/* Brand footer */}
        <View style={s.brandFooter}>
          <Text style={s.brandFooterWord}>Siftly</Text>
          <Text style={s.brandFooterTagline}>Built for modern independence.</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },

  // ── Top bar
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.bg,
  },
  backBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: colors.bgElevated,
    borderWidth: 1, borderColor: colors.border,
    alignItems: 'center', justifyContent: 'center',
  },
  backArrow: { fontSize: 18, color: colors.textPrimary, fontWeight: '300' },
  shareBtn: {
    paddingHorizontal: spacing.md, paddingVertical: 7,
    borderRadius: radius.full,
    backgroundColor: colors.bgElevated,
    borderWidth: 1, borderColor: colors.border,
  },
  shareBtnText: { fontSize: 13, fontWeight: '600', color: colors.textSecondary },

  // ── Scroll
  scroll: { flex: 1 },
  scrollContent: { paddingBottom: spacing.xl * 2 },

  // ── Hero
  hero: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.xl,
    paddingBottom: spacing.lg,
    overflow: 'hidden',
    position: 'relative',
  },
  orbBg: {
    position: 'absolute',
    top: -40, right: -60,
    width: 240, height: 240, borderRadius: 120,
    backgroundColor: 'rgba(67,97,238,0.10)',
    opacity: 0.5,
  },
  eyebrow: {
    fontSize: 10, fontWeight: '800', color: '#4361EE',
    letterSpacing: 2.8, marginBottom: spacing.sm,
  },
  title: {
    fontSize: 42, fontWeight: '900', color: colors.textPrimary,
    letterSpacing: -1.8, lineHeight: 46, marginBottom: spacing.xs,
  },
  effectiveDate: {
    fontSize: 12, color: colors.textMuted,
    letterSpacing: 0.2, marginBottom: spacing.lg,
  },
  intro: {
    fontSize: 16, color: colors.textSecondary,
    lineHeight: 26, letterSpacing: -0.1,
  },

  // ── Sections
  sections: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    gap: spacing.sm,
  },
  sectionCard: {
    backgroundColor: colors.bgCard,
    borderRadius: radius.xxl,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.sm,
    shadowColor: '#0D1E3A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06, shadowRadius: 8, elevation: 2,
  },
  sectionNumber: {
    fontSize: 9, fontWeight: '900', color: '#4361EE',
    letterSpacing: 1.5, opacity: 0.7,
  },
  sectionTitle: {
    fontSize: 16, fontWeight: '800', color: colors.textPrimary,
    letterSpacing: -0.4,
  },
  sectionBody: {
    fontSize: 14, color: colors.textSecondary,
    lineHeight: 22, letterSpacing: -0.05,
  },

  // ── Support email chip
  emailChip: {
    marginHorizontal: spacing.lg,
    marginTop: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.bgHero,
    borderRadius: radius.xxl,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md + 2,
    borderWidth: 1,
    borderColor: 'rgba(67,97,238,0.22)',
    gap: spacing.sm,
    shadowColor: '#0284C7',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.10, shadowRadius: 10, elevation: 3,
  },
  emailChipLabel: {
    fontSize: 9, fontWeight: '800', color: '#4361EE', letterSpacing: 2,
  },
  emailChipValue: {
    flex: 1, fontSize: 14, fontWeight: '600', color: colors.textPrimary,
  },
  emailChipArrow: { fontSize: 16, color: '#4361EE', fontWeight: '700' },

  // ── Bottom actions
  actions: {
    flexDirection: 'row',
    marginHorizontal: spacing.lg,
    marginTop: spacing.md,
    backgroundColor: colors.bgCard,
    borderRadius: radius.xxl,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
    shadowColor: '#0D1E3A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06, shadowRadius: 8, elevation: 2,
  },
  actionBtn: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    paddingVertical: spacing.md + 2,
    gap: 4,
  },
  actionIcon: { fontSize: 16, color: '#4361EE' },
  actionText: { fontSize: 11, fontWeight: '700', color: colors.textSecondary },
  actionDivider: { width: 1, backgroundColor: colors.border, marginVertical: spacing.sm },

  // ── Brand footer
  brandFooter: {
    alignItems: 'center',
    paddingTop: spacing.xl,
    paddingBottom: spacing.lg,
    gap: 4,
  },
  brandFooterWord: {
    fontSize: 22, fontWeight: '900', color: colors.textPrimary, letterSpacing: -0.8,
  },
  brandFooterTagline: {
    fontSize: 11, color: colors.textMuted, letterSpacing: 0.4, opacity: 0.7,
  },
});
