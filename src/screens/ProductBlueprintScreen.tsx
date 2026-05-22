import React from 'react';
import {
  ScrollView, View, Text, StyleSheet, TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { DS } from '../components/ds';

// ── Section data ──────────────────────────────────────────────────────────────

interface BlueprintSection {
  icon:     string;
  title:    string;
  subtitle: string;
  color:    string;
  features: string[];
  status:   'Live' | 'Beta' | 'Planned';
}

const SECTIONS: BlueprintSection[] = [
  {
    icon:     '◎',
    title:    'Niche Research & Market Discovery',
    subtitle: 'Find high-demand, low-competition niches before committing capital.',
    color:    DS.info,
    status:   'Live',
    features: [
      'Google Trends demand signals',
      'Search volume analysis',
      'Competition level scoring',
      'Trend direction indicators',
      'Seasonal pattern detection',
      'Saved niches & opportunity tracking',
    ],
  },
  {
    icon:     '✦',
    title:    'Product Validation & SEO Analysis',
    subtitle: 'Validate product-market fit with real Amazon data before sourcing.',
    color:    DS.accent,
    status:   'Live',
    features: [
      'Keyword search volume & difficulty',
      'Competitor listing analysis',
      'Review count & rating trends',
      'Pricing analysis & sweet spots',
      'Product opportunity gap finder',
      'SEO intelligence & ranking signals',
    ],
  },
  {
    icon:     '⬡',
    title:    'Supplier Matching & Sourcing',
    subtitle: 'Find and evaluate verified manufacturers with side-by-side comparison.',
    color:    DS.success,
    status:   'Live',
    features: [
      'AI-matched supplier recommendations',
      'MOQ & unit cost comparison',
      'Lead time estimates',
      'Factory ratings & reliability scores',
      'Structured sourcing workflow',
      'Supplier organisation & CRM',
    ],
  },
  {
    icon:     '▣',
    title:    'Label Generator & Branding',
    subtitle: 'Create professional product identity from brand name to packaging.',
    color:    DS.indigo,
    status:   'Live',
    features: [
      'AI-generated brand names',
      'Professional label templates',
      'Branding customisation',
      'Barcode & FNSKU support',
      'Packaging concept generation',
      'Listing branding workflow',
    ],
  },
  {
    icon:     '✈',
    title:    'Freight & Cost Integration',
    subtitle: 'Model total landed cost and confirm profitability before you order.',
    color:    DS.warning,
    status:   'Live',
    features: [
      'Air vs sea vs express comparison',
      'Landed cost per unit breakdown',
      'Total investment modelling',
      'FBA fee estimation by marketplace',
      'Profitability & ROI calculation',
      'Launch readiness scorecard',
    ],
  },
];

const STATUS_COLOR: Record<BlueprintSection['status'], string> = {
  Live:    DS.success,
  Beta:    DS.warning,
  Planned: DS.textMuted,
};

// ── Screen ────────────────────────────────────────────────────────────────────

export default function ProductBlueprintScreen() {
  const navigation = useNavigation();

  return (
    <SafeAreaView style={s.safe} edges={['top']}>

      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={s.backBtn} activeOpacity={0.7}>
          <Text style={s.backArrow}>←</Text>
        </TouchableOpacity>
        <View style={s.headerCenter}>
          <Text style={s.eyebrow}>SIFTLY</Text>
          <Text style={s.title}>Product Blueprint</Text>
        </View>
        <View style={s.backBtn} />
      </View>

      <ScrollView
        style={s.scroll}
        contentContainerStyle={s.content}
        showsVerticalScrollIndicator={false}
      >
        {/* Hero */}
        <View style={s.hero}>
          <Text style={s.heroIcon}>◈</Text>
          <Text style={s.heroTitle}>End-to-End FBA Operating System</Text>
          <Text style={s.heroSub}>
            Siftly is built as a complete launch pipeline — from niche discovery to freight and profit confirmation. Every stage connects to the next.
          </Text>
        </View>

        {/* Pipeline connector label */}
        <View style={s.pipelineLabel}>
          <View style={s.pipelineLine} />
          <Text style={s.pipelineTxt}>THE LAUNCH PIPELINE</Text>
          <View style={s.pipelineLine} />
        </View>

        {/* Sections */}
        {SECTIONS.map((section, idx) => (
          <View key={section.title} style={s.sectionWrap}>

            {/* Step connector */}
            {idx > 0 && <View style={[s.connector, { borderColor: section.color + '30' }]} />}

            {/* Card */}
            <View style={[s.card, { borderColor: section.color + '30' }]}>

              {/* Card header row */}
              <View style={s.cardHeader}>
                <View style={[s.iconBadge, { backgroundColor: section.color + '15' }]}>
                  <Text style={[s.iconText, { color: section.color }]}>{section.icon}</Text>
                </View>
                <View style={s.cardHeaderText}>
                  <View style={s.stepRow}>
                    <Text style={s.stepNum}>STEP {idx + 1}</Text>
                    <View style={[s.statusPill, { backgroundColor: STATUS_COLOR[section.status] + '18' }]}>
                      <View style={[s.statusDot, { backgroundColor: STATUS_COLOR[section.status] }]} />
                      <Text style={[s.statusTxt, { color: STATUS_COLOR[section.status] }]}>
                        {section.status}
                      </Text>
                    </View>
                  </View>
                  <Text style={s.cardTitle}>{section.title}</Text>
                </View>
              </View>

              <Text style={s.cardSub}>{section.subtitle}</Text>

              {/* Feature chips */}
              <View style={s.chips}>
                {section.features.map(f => (
                  <View key={f} style={[s.chip, { borderColor: section.color + '25', backgroundColor: section.color + '08' }]}>
                    <Text style={[s.chipTxt, { color: section.color }]}>✓</Text>
                    <Text style={s.chipLabel}>{f}</Text>
                  </View>
                ))}
              </View>
            </View>
          </View>
        ))}

        {/* Footer */}
        <View style={s.footer}>
          <Text style={s.footerIcon}>◉</Text>
          <Text style={s.footerTitle}>One Pipeline. Every Stage.</Text>
          <Text style={s.footerSub}>
            Each section feeds the next — research flows into validation, validation into sourcing, sourcing into branding, branding into freight, freight into launch. Nothing is siloed.
          </Text>
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  safe:   { flex: 1, backgroundColor: DS.bgCanvas },
  scroll: { flex: 1 },
  content:{ paddingHorizontal: DS.pagePadding, paddingBottom: 60, gap: 0 },

  header: {
    flexDirection:    'row',
    alignItems:       'center',
    justifyContent:   'space-between',
    paddingHorizontal: DS.pagePadding,
    paddingTop:       10,
    paddingBottom:    14,
    backgroundColor:  DS.bgCard,
    borderBottomWidth: 1,
    borderBottomColor: DS.border,
  },
  backBtn:      { width: 36, alignItems: 'flex-start' },
  backArrow:    { fontSize: 20, color: DS.accent, fontWeight: '700' },
  headerCenter: { alignItems: 'center', gap: 1 },
  eyebrow:      { fontSize: 9, fontWeight: '800', color: DS.accent, letterSpacing: 2.5 },
  title:        { fontSize: 16, fontWeight: '900', color: DS.textPrimary, letterSpacing: -0.4 },

  hero: {
    alignItems:    'center',
    paddingVertical: 32,
    paddingHorizontal: 8,
    gap:           10,
  },
  heroIcon:  { fontSize: 36 },
  heroTitle: { fontSize: 20, fontWeight: '900', color: DS.textPrimary, textAlign: 'center', letterSpacing: -0.5 },
  heroSub:   { fontSize: 14, color: DS.textSecondary, textAlign: 'center', lineHeight: 22 },

  pipelineLabel: {
    flexDirection:  'row',
    alignItems:     'center',
    gap:            10,
    marginBottom:   20,
  },
  pipelineLine: { flex: 1, height: 1, backgroundColor: DS.border },
  pipelineTxt:  { fontSize: 9, fontWeight: '800', color: DS.textMuted, letterSpacing: 2 },

  sectionWrap: { gap: 0 },

  connector: {
    width:       2,
    height:      20,
    borderLeftWidth: 2,
    borderStyle: 'dashed',
    alignSelf:   'center',
  },

  card: {
    backgroundColor: DS.bgCard,
    borderRadius:    DS.radiusCard,
    borderWidth:     1.5,
    padding:         DS.cardPadding,
    gap:             14,
    shadowColor:     '#0D1B4B',
    shadowOffset:    { width: 0, height: 2 },
    shadowOpacity:   0.05,
    shadowRadius:    8,
    elevation:       2,
  },

  cardHeader:     { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  iconBadge:      { width: 44, height: 44, borderRadius: DS.radiusButton, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  iconText:       { fontSize: 20, fontWeight: '700' },
  cardHeaderText: { flex: 1, gap: 4 },

  stepRow:    { flexDirection: 'row', alignItems: 'center', gap: 8 },
  stepNum:    { fontSize: 9, fontWeight: '800', color: DS.textMuted, letterSpacing: 2 },

  statusPill: { flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: DS.radiusBadge, paddingHorizontal: 8, paddingVertical: 3 },
  statusDot:  { width: 5, height: 5, borderRadius: 3 },
  statusTxt:  { fontSize: 9, fontWeight: '800', letterSpacing: 0.5 },

  cardTitle: { fontSize: 14, fontWeight: '800', color: DS.textPrimary, letterSpacing: -0.3, lineHeight: 20 },
  cardSub:   { fontSize: 13, color: DS.textSecondary, lineHeight: 19 },

  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip:  {
    flexDirection:  'row',
    alignItems:     'center',
    gap:            5,
    borderRadius:   DS.radiusChip,
    borderWidth:    1,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  chipTxt:   { fontSize: 10, fontWeight: '800' },
  chipLabel: { fontSize: 11, color: DS.textSecondary, fontWeight: '500' },

  footer: {
    alignItems:    'center',
    marginTop:     32,
    padding:       DS.cardPadding,
    backgroundColor: DS.bgCard,
    borderRadius:  DS.radiusCard,
    borderWidth:   1.5,
    borderColor:   DS.accent + '30',
    gap:           8,
  },
  footerIcon:  { fontSize: 28 },
  footerTitle: { fontSize: 16, fontWeight: '900', color: DS.textPrimary, textAlign: 'center', letterSpacing: -0.4 },
  footerSub:   { fontSize: 13, color: DS.textSecondary, textAlign: 'center', lineHeight: 20 },
});
