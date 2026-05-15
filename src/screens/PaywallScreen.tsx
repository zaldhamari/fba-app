import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  ScrollView, Platform, Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StackNavigationProp } from '@react-navigation/stack';
import { RootStackParamList } from '../navigation/RootNavigator';
import {
  useSubscription, Tier, PLANS, PLAN_FEATURES,
} from '../hooks/useSubscription';
import {
  AppCard, SectionHeader, StatusBadge, PrimaryButton, SecondaryButton, DS,
} from '../components/ds';

// ── Props ─────────────────────────────────────────────────────────────────────

type Props = {
  navigation: StackNavigationProp<RootStackParamList, 'Paywall'>;
  route?: { params?: { forced?: boolean } };
};

// ── Static data ───────────────────────────────────────────────────────────────

const PLAN_ORDER: Tier[] = ['explorer', 'builder', 'operator'];

const PLAN_DESCRIPTIONS: Record<Tier, string> = {
  explorer: 'Explore the platform and experience the signal before committing a cent.',
  builder:  'Everything you need to find, validate, and launch with confidence.',
  operator: 'No limits. Built for commerce operators already moving at scale.',
};

const PLAN_EYEBROW: Record<Tier, string> = {
  explorer: 'FREE',
  builder:  'MOST POPULAR',
  operator: 'FOR SCALING SELLERS',
};

const COMPARISON_ROWS: {
  label: string; icon: string;
  explorer: string; builder: string; operator: string;
}[] = [
  { label: 'Product searches',  icon: '◎', explorer: '3/mo',      builder: '50/mo',    operator: 'Unlimited' },
  { label: 'Product analyses',  icon: '⊛', explorer: '—',         builder: '20/mo',    operator: 'Unlimited' },
  { label: 'Profit calculator', icon: '◈', explorer: '✓',         builder: '✓',        operator: '✓'         },
  { label: 'Brand assets',      icon: '✦', explorer: '1/mo',      builder: '5/mo',     operator: 'Unlimited' },
  { label: 'Co-Pilot chats',    icon: '⊞', explorer: '—',         builder: '✓',        operator: '✓'         },
  { label: 'Export tools',      icon: '↓', explorer: '—',         builder: '—',        operator: '✓'         },
];

const TRUST_POINTS = [
  { icon: '🔒', label: 'Secure payments', body: 'Processed by Apple. No card stored by Siftly.' },
  { icon: '↺',  label: 'Cancel anytime',  body: 'Cancel from iOS Settings — no hoops, no penalties.' },
  { icon: '🚀', label: 'Built for FBA',   body: 'Designed for Amazon beginners and experienced sellers.' },
];

const FAQ_ITEMS = [
  {
    q: 'Can I cancel anytime?',
    a: 'Yes — cancel through iOS Settings → Subscriptions. You keep access until the billing period ends.',
  },
  {
    q: 'Are AI generations included?',
    a: 'Co-Pilot and AI brand tools are included in the Builder and Operator plans with generous monthly limits.',
  },
  {
    q: 'Is this for beginners?',
    a: 'Absolutely. Siftly is built for new FBA sellers who want clarity, not confusion.',
  },
];

// ── Pricing toggle ────────────────────────────────────────────────────────────

function PricingToggle({
  annual,
  onChange,
}: {
  annual: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <View style={tog.wrap}>
      <TouchableOpacity
        style={[tog.tab, !annual && tog.tabActive]}
        onPress={() => onChange(false)}
        activeOpacity={0.8}
        accessibilityRole="tab"
        accessibilityState={{ selected: !annual }}
      >
        <Text style={[tog.label, !annual && tog.labelActive]}>Monthly</Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={[tog.tab, annual && tog.tabActive]}
        onPress={() => onChange(true)}
        activeOpacity={0.8}
        accessibilityRole="tab"
        accessibilityState={{ selected: annual }}
      >
        <Text style={[tog.label, annual && tog.labelActive]}>Yearly</Text>
        <View style={tog.savePill}>
          <Text style={tog.saveText}>SAVE 40%</Text>
        </View>
      </TouchableOpacity>
    </View>
  );
}

const tog = StyleSheet.create({
  wrap: {
    flexDirection:   'row',
    backgroundColor: DS.bgSubtle,
    borderRadius:    14,
    borderWidth:     1,
    borderColor:     DS.border,
    padding:         3,
    gap:             2,
  },
  tab: {
    flex:            1,
    flexDirection:   'row',
    alignItems:      'center',
    justifyContent:  'center',
    gap:             6,
    paddingVertical: 10,
    borderRadius:    11,
  },
  tabActive: {
    backgroundColor: DS.bgCard,
    shadowColor:     '#0D1B4B',
    shadowOffset:    { width: 0, height: 1 },
    shadowOpacity:   0.07,
    shadowRadius:    4,
    elevation:       2,
  },
  label:       { fontSize: 14, fontWeight: '600', color: DS.textMuted },
  labelActive: { fontWeight: '800', color: DS.textPrimary },
  savePill: {
    backgroundColor: DS.accentLight,
    borderRadius:    DS.radiusBadge,
    paddingHorizontal: 7,
    paddingVertical:   2,
  },
  saveText: { fontSize: 8, fontWeight: '900', color: DS.accentDark, letterSpacing: 0.5 },
});

// ── Plan card ─────────────────────────────────────────────────────────────────

function PlanCard({
  tier,
  isSelected,
  isRecommended,
  isCurrent,
  priceLabel,
  billingNote,
  onSelect,
  onPurchase,
  purchasing,
}: {
  tier:         Tier;
  isSelected:   boolean;
  isRecommended: boolean;
  isCurrent:    boolean;
  priceLabel:   string;
  billingNote:  string;
  onSelect:     () => void;
  onPurchase:   () => void;
  purchasing:   boolean;
}) {
  const plan = PLANS[tier];

  const cardBorderColor = isRecommended
    ? DS.indigo
    : tier === 'operator'
    ? DS.indigo
    : isSelected
    ? DS.accent
    : DS.border;

  const cardBg = isRecommended ? DS.indigoLight : DS.bgCard;

  const eyebrow = isCurrent
    ? 'CURRENT PLAN'
    : PLAN_EYEBROW[tier];

  const eyebrowColor = isCurrent
    ? DS.textMuted
    : isRecommended
    ? DS.indigo
    : tier === 'operator'
    ? DS.indigo
    : DS.textMuted;

  const ctaLabel = tier === 'explorer'
    ? 'Start Free'
    : purchasing
    ? 'Processing…'
    : `Get ${plan.name}`;

  return (
    <TouchableOpacity
      style={[
        pc.card,
        { borderColor: cardBorderColor, backgroundColor: cardBg },
        isRecommended && pc.cardShadow,
      ]}
      onPress={onSelect}
      activeOpacity={0.9}
      accessibilityRole="radio"
      accessibilityState={{ checked: isSelected }}
    >
      {/* Eyebrow */}
      <Text style={[pc.eyebrow, { color: eyebrowColor }]}>{eyebrow}</Text>

      {/* Name + price row */}
      <View style={pc.nameRow}>
        <View style={pc.nameLeft}>
          <Text style={pc.name}>{plan.name}</Text>
          <Text style={pc.desc} numberOfLines={2}>{PLAN_DESCRIPTIONS[tier]}</Text>
        </View>
        <View style={pc.priceCol}>
          <Text style={[pc.price, isRecommended && { color: DS.indigo }]}>
            {priceLabel}
          </Text>
          <Text style={pc.billing}>{billingNote}</Text>
        </View>
      </View>

      {/* Feature list */}
      <View style={pc.divider} />
      {PLAN_FEATURES[tier].map((f, i) => (
        <View key={i} style={pc.feature}>
          <Text style={[pc.featureCheck, isRecommended && { color: DS.indigo }]}>✓</Text>
          <Text style={pc.featureText}>{f}</Text>
        </View>
      ))}

      {/* CTA */}
      <View style={pc.ctaWrap}>
        {isRecommended ? (
          <PrimaryButton
            label={ctaLabel}
            onPress={onPurchase}
            disabled={purchasing}
            loading={purchasing && isSelected}
            style={pc.ctaBtn}
          />
        ) : (
          <SecondaryButton
            label={ctaLabel}
            onPress={onPurchase}
            disabled={purchasing}
            loading={purchasing && isSelected}
            style={pc.ctaBtn}
          />
        )}
      </View>

      {/* Recommended ribbon */}
      {isRecommended && (
        <View style={pc.ribbon}>
          <StatusBadge label="Recommended" variant="info" />
        </View>
      )}
    </TouchableOpacity>
  );
}

const pc = StyleSheet.create({
  card: {
    borderWidth:  1.5,
    borderRadius: DS.radiusCard,
    padding:      DS.cardPadding,
    gap:          DS.rowGap,
    position:     'relative',
    overflow:     'hidden',
  },
  cardShadow: {
    shadowColor:   DS.indigo,
    shadowOffset:  { width: 0, height: 4 },
    shadowOpacity: 0.16,
    shadowRadius:  16,
    elevation:     6,
  },
  eyebrow: {
    fontSize: 8, fontWeight: '900', letterSpacing: 1.8,
  },
  nameRow:    { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 },
  nameLeft:   { flex: 1, gap: 4 },
  name:       { fontSize: 22, fontWeight: '900', color: DS.textPrimary, letterSpacing: -0.6 },
  desc:       { fontSize: 12, color: DS.textSecondary, lineHeight: 17 },
  priceCol:   { alignItems: 'flex-end' },
  price:      { fontSize: 22, fontWeight: '900', color: DS.textPrimary, letterSpacing: -0.6 },
  billing:    { fontSize: 10, color: DS.textMuted, marginTop: 2 },
  divider:    { height: 1, backgroundColor: DS.borderLight, marginVertical: 4 },
  feature:    { flexDirection: 'row', gap: 8, alignItems: 'flex-start' },
  featureCheck: { fontSize: 12, fontWeight: '800', color: DS.accent, width: 14, marginTop: 1 },
  featureText:  { fontSize: 13, color: DS.textSecondary, flex: 1, lineHeight: 19 },
  ctaWrap:    { marginTop: 6 },
  ctaBtn:     {},
  ribbon: {
    position: 'absolute', top: DS.cardPadding, right: DS.cardPadding,
  },
});

// ── Feature comparison card ───────────────────────────────────────────────────

function ComparisonCard() {
  return (
    <AppCard padding={0} style={cmp.card}>
      {/* Header row */}
      <View style={[cmp.row, cmp.headerRow]}>
        <Text style={[cmp.cell, cmp.labelCell, cmp.headerText]}>Feature</Text>
        {PLAN_ORDER.map(t => (
          <Text key={t} style={[cmp.cell, cmp.headerText]} numberOfLines={1}>
            {PLANS[t].name}
          </Text>
        ))}
      </View>

      {COMPARISON_ROWS.map((row, i) => (
        <View key={i} style={[cmp.row, i % 2 === 0 && cmp.rowAlt]}>
          <View style={cmp.labelCell}>
            <Text style={cmp.labelIcon}>{row.icon}</Text>
            <Text style={cmp.labelText}>{row.label}</Text>
          </View>
          {PLAN_ORDER.map(t => {
            const val = row[t];
            const isCheck = val === '✓';
            const isEmpty = val === '—';
            return (
              <Text
                key={t}
                style={[
                  cmp.cell,
                  cmp.valCell,
                  isCheck && cmp.valCheck,
                  isEmpty && cmp.valEmpty,
                ]}
              >
                {val}
              </Text>
            );
          })}
        </View>
      ))}
    </AppCard>
  );
}

const cmp = StyleSheet.create({
  card:       { overflow: 'hidden' },
  row:        { flexDirection: 'row', alignItems: 'center' },
  headerRow:  { backgroundColor: DS.indigoLight, paddingVertical: 12 },
  rowAlt:     { backgroundColor: DS.bgSubtle },
  cell: {
    flex: 1, paddingVertical: 11, paddingHorizontal: 8,
    fontSize: 11, color: DS.textSecondary,
    textAlign: 'center', borderRightWidth: 1, borderRightColor: DS.borderLight,
  },
  labelCell: {
    flex: 1.5, flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingVertical: 11, paddingHorizontal: 14,
    borderRightWidth: 1, borderRightColor: DS.borderLight,
  },
  labelIcon:  { fontSize: 11, color: DS.indigo },
  labelText:  { fontSize: 11, fontWeight: '600', color: DS.textSecondary, flex: 1 },
  headerText: { fontSize: 10, fontWeight: '800', color: DS.indigo, textAlign: 'center' },
  valCell:    { fontWeight: '600', color: DS.textPrimary },
  valCheck:   { color: DS.accent, fontWeight: '800' },
  valEmpty:   { color: DS.textMuted, fontWeight: '400' },
});

// ── Trust card ────────────────────────────────────────────────────────────────

function TrustCard() {
  return (
    <AppCard style={tr.card}>
      <Text style={tr.title}>Our Guarantee</Text>
      {TRUST_POINTS.map((p, i) => (
        <View key={i} style={[tr.row, i < TRUST_POINTS.length - 1 && tr.rowBorder]}>
          <View style={tr.iconWrap}>
            <Text style={tr.icon}>{p.icon}</Text>
          </View>
          <View style={tr.text}>
            <Text style={tr.label}>{p.label}</Text>
            <Text style={tr.body}>{p.body}</Text>
          </View>
        </View>
      ))}
    </AppCard>
  );
}

const tr = StyleSheet.create({
  card:      { gap: 4 },
  title:     { fontSize: 15, fontWeight: '800', color: DS.textPrimary, letterSpacing: -0.3, marginBottom: 8 },
  row:       { flexDirection: 'row', alignItems: 'flex-start', gap: 12, paddingVertical: 12 },
  rowBorder: { borderBottomWidth: 1, borderBottomColor: DS.borderLight },
  iconWrap: {
    width: 36, height: 36, borderRadius: 11,
    backgroundColor: DS.accentLight,
    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  icon:      { fontSize: 18 },
  text:      { flex: 1, gap: 2 },
  label:     { fontSize: 13, fontWeight: '700', color: DS.textPrimary },
  body:      { fontSize: 12, color: DS.textSecondary, lineHeight: 18 },
});

// ── Launch Pack upsell ────────────────────────────────────────────────────────


// ── FAQ accordion ─────────────────────────────────────────────────────────────

function FaqCard() {
  const [open, setOpen] = useState<number | null>(null);

  return (
    <AppCard style={faq.card}>
      <Text style={faq.title}>Frequently Asked Questions</Text>
      {FAQ_ITEMS.map((item, i) => {
        const isOpen = open === i;
        return (
          <View key={i}>
            {i > 0 && <View style={faq.divider} />}
            <TouchableOpacity
              style={faq.row}
              onPress={() => setOpen(isOpen ? null : i)}
              activeOpacity={0.75}
              accessibilityRole="button"
              accessibilityState={{ expanded: isOpen }}
            >
              <Text style={faq.q}>{item.q}</Text>
              <Text style={[faq.chevron, isOpen && faq.chevronOpen]}>›</Text>
            </TouchableOpacity>
            {isOpen && <Text style={faq.a}>{item.a}</Text>}
          </View>
        );
      })}
    </AppCard>
  );
}

const faq = StyleSheet.create({
  card:        { gap: 0 },
  title:       { fontSize: 15, fontWeight: '800', color: DS.textPrimary, letterSpacing: -0.3, marginBottom: 8 },
  divider:     { height: 1, backgroundColor: DS.borderLight },
  row:         { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 14 },
  q:           { fontSize: 13, fontWeight: '700', color: DS.textPrimary, flex: 1, paddingRight: 8 },
  chevron:     { fontSize: 20, color: DS.textMuted, transform: [{ rotate: '0deg' }] },
  chevronOpen: { transform: [{ rotate: '90deg' }] },
  a: {
    fontSize: 13, color: DS.textSecondary, lineHeight: 20,
    paddingBottom: 12, paddingRight: 8,
  },
});

// ── Screen ────────────────────────────────────────────────────────────────────

export default function PaywallScreen({ navigation, route }: Props) {
  const {
    purchasePlan, restorePurchases, completeOnboarding, tier: currentTier,
  } = useSubscription();

  const [annual,       setAnnual]       = useState(false);
  const [selected,     setSelected]     = useState<Tier>('builder');
  const [purchasing,   setPurchasing]   = useState(false);
  const [restoring,    setRestoring]    = useState(false);
  const [error,        setError]        = useState('');

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
  const selectedPlan = PLANS[selected];
  const primaryCtaLabel = selected === 'explorer'
    ? 'Start Free'
    : `Get ${selectedPlan.name}`;

  return (
    <SafeAreaView style={s.safe} edges={['top']}>

      <ScrollView
        style={Platform.OS === 'web' ? { height: screenHeight } : { flex: 1 }}
        contentContainerStyle={s.content}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Close button ──────────────────────────────────── */}
        <TouchableOpacity
          style={s.closeBtn}
          onPress={() => navigation.goBack()}
          activeOpacity={0.7}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <Text style={s.closeBtnText}>✕</Text>
        </TouchableOpacity>

        {/* ── Header ────────────────────────────────────────── */}
        <View style={s.header}>
          <View style={s.logoPill}>
            <Text style={s.logoPillIcon}>◎</Text>
            <Text style={s.logoPillText}>SIFTLY PREMIUM</Text>
          </View>
          <Text style={s.heroTitle}>Unlock Your FBA{'\n'}Launch System</Text>
          <Text style={s.heroSub}>
            Get more research, analysis, branding tools, and launch guidance.
          </Text>
        </View>

        {/* ── Premium hero card ─────────────────────────────── */}
        <AppCard style={s.heroCard}>
          <View style={s.heroCardTop}>
            <StatusBadge label="Premium" variant="info" dot />
            <Text style={s.heroCardTitle}>
              Launch smarter with unlimited AI-powered FBA tools.
            </Text>
          </View>
          <View style={s.heroBullets}>
            {[
              { icon: '◎', text: 'More product research & supplier discovery' },
              { icon: '◈', text: 'Advanced profit analysis and freight tools' },
              { icon: '⊛', text: 'AI launch recommendations and SWOT insights' },
            ].map((b, i) => (
              <View key={i} style={s.heroBullet}>
                <View style={s.heroBulletIcon}>
                  <Text style={s.heroBulletGlyph}>{b.icon}</Text>
                </View>
                <Text style={s.heroBulletText}>{b.text}</Text>
              </View>
            ))}
          </View>
        </AppCard>

        {/* ── Pricing toggle ────────────────────────────────── */}
        <PricingToggle annual={annual} onChange={setAnnual} />

        {/* ── Plan cards ────────────────────────────────────── */}
        <SectionHeader title="Choose Your Plan" style={s.sectionHead} />
        {PLAN_ORDER.map(t => (
          <PlanCard
            key={t}
            tier={t}
            isSelected={selected === t}
            isRecommended={t === 'builder'}
            isCurrent={t === currentTier}
            priceLabel={priceLabel(t)}
            billingNote={billingNote(t)}
            onSelect={() => setSelected(t)}
            onPurchase={() => handlePurchase(t)}
            purchasing={purchasing}
          />
        ))}

        {/* ── Feature comparison ────────────────────────────── */}
        <SectionHeader title="Full Comparison" style={s.sectionHead} />
        <ComparisonCard />


        {/* ── Trust ─────────────────────────────────────────── */}
        <TrustCard />

        {/* ── FAQ ───────────────────────────────────────────── */}
        <FaqCard />

        {/* ── Error ─────────────────────────────────────────── */}
        {!!error && (
          <View style={s.errorBox}>
            <Text style={s.errorText}>{error}</Text>
          </View>
        )}

        {/* ── Bottom CTA ────────────────────────────────────── */}
        <View style={s.bottomCta}>
          <PrimaryButton
            label={purchasing ? 'Processing…' : primaryCtaLabel}
            onPress={() => handlePurchase(selected)}
            disabled={purchasing}
            loading={purchasing}
            size="lg"
          />

          <TouchableOpacity
            style={s.restoreBtn}
            onPress={handleRestore}
            disabled={restoring}
            activeOpacity={0.7}
          >
            <Text style={s.restoreText}>
              {restoring ? 'Restoring…' : 'Restore Purchases'}
            </Text>
          </TouchableOpacity>

          {!forced && (
            <TouchableOpacity
              style={s.skipBtn}
              onPress={() => handlePurchase('explorer')}
              activeOpacity={0.7}
            >
              <Text style={s.skipText}>Continue with free plan</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* ── Legal footer ──────────────────────────────────── */}
        <Text style={s.legalText}>
          Payments processed securely by Apple. Subscriptions auto-renew monthly or annually.
          Cancel anytime in iOS Settings.
        </Text>
        <View style={s.legalRow}>
          <TouchableOpacity
            onPress={() => navigation.navigate('Legal', { type: 'privacy' })}
            activeOpacity={0.7}
          >
            <Text style={s.legalLink}>Privacy Policy</Text>
          </TouchableOpacity>
          <Text style={s.legalDot}>·</Text>
          <TouchableOpacity
            onPress={() => navigation.navigate('Legal', { type: 'terms' })}
            activeOpacity={0.7}
          >
            <Text style={s.legalLink}>Terms of Use</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  safe:    { flex: 1, backgroundColor: DS.bgCanvas },
  content: {
    paddingHorizontal: DS.pagePadding,
    paddingTop:        0,
    paddingBottom:     48,
    gap:               DS.sectionGap,
  },

  // Close button
  closeBtn: {
    alignSelf:   'flex-end',
    marginTop:   12,
    marginRight: 4,
    width:       36,
    height:      36,
    borderRadius: 18,
    backgroundColor: DS.bgSubtle,
    borderWidth: 1,
    borderColor: DS.border,
    alignItems:  'center',
    justifyContent: 'center',
  },
  closeBtnText: { fontSize: 15, color: DS.textMuted, fontWeight: '400' },

  // Header
  header: {
    paddingTop:    16,
    paddingBottom: DS.sectionGap,
    gap:           10,
  },
  logoPill: {
    flexDirection:     'row',
    alignItems:        'center',
    gap:               6,
    alignSelf:         'flex-start',
    backgroundColor:   DS.indigoLight,
    borderRadius:      DS.radiusBadge,
    paddingHorizontal: 12,
    paddingVertical:   6,
    borderWidth:       1,
    borderColor:       DS.indigoLight,
  },
  logoPillIcon: { fontSize: 11, color: DS.indigo },
  logoPillText: { fontSize: 10, fontWeight: '900', color: DS.indigo, letterSpacing: 1 },
  heroTitle: {
    fontSize: 32, fontWeight: '900', color: DS.textPrimary,
    letterSpacing: -1, lineHeight: 38,
  },
  heroSub: { fontSize: 14, color: DS.textSecondary, lineHeight: 21 },

  // Premium hero card
  heroCard: { gap: 18 },
  heroCardTop: { gap: 10 },
  heroCardTitle: {
    fontSize: 17, fontWeight: '800', color: DS.textPrimary, letterSpacing: -0.4, lineHeight: 24,
  },
  heroBullets: { gap: 10 },
  heroBullet:  { flexDirection: 'row', alignItems: 'center', gap: 10 },
  heroBulletIcon: {
    width: 32, height: 32, borderRadius: 10,
    backgroundColor: DS.indigoLight,
    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  heroBulletGlyph: { fontSize: 14, color: DS.indigo, fontWeight: '700' },
  heroBulletText:  { fontSize: 13, color: DS.textSecondary, flex: 1, lineHeight: 19 },

  sectionHead: { marginBottom: -8 },

  // Error
  errorBox: {
    backgroundColor: DS.dangerBg, borderRadius: 14,
    padding: 14, borderWidth: 1, borderColor: DS.dangerBg,
  },
  errorText: { fontSize: 13, color: DS.dangerText, textAlign: 'center', fontWeight: '600' },

  // Bottom CTA
  bottomCta: { gap: 12, paddingTop: 4 },
  restoreBtn: { alignItems: 'center', paddingVertical: 8 },
  restoreText: { fontSize: 14, color: DS.textMuted, fontWeight: '600' },
  skipBtn:     { alignItems: 'center', paddingVertical: 6 },
  skipText:    { fontSize: 13, color: DS.textMuted, fontWeight: '500' },

  // Legal
  legalText: {
    fontSize: 11, color: DS.textMuted, textAlign: 'center', lineHeight: 17,
  },
  legalRow: {
    flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8,
  },
  legalLink: { fontSize: 12, color: DS.textMuted, fontWeight: '500' },
  legalDot:  { fontSize: 12, color: DS.border },
});
