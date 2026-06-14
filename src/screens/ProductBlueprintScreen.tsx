import React from 'react';
import {
  ScrollView, View, Text, StyleSheet, TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { DS } from '../components/ds';
import { useBuilderSession } from '../hooks/useBuilderSession';
import type {
  BuilderSession, BuilderStage,
  DiscoveryData, AnalysisData, SupplierData,
  FreightData, CalculationsData, BrandData,
} from '../types/builder';

// ── Phase → stage mapping ─────────────────────────────────────────────────────

type PhaseStage = 'discovery' | 'analysis' | 'supplier' | 'brand' | 'freight';

interface Phase {
  icon:     string;
  title:    string;
  subtitle: string;
  color:    string;
  stage:    PhaseStage;
  features: string[];
}

const PHASES: Phase[] = [
  {
    icon:     '◎',
    title:    'Niche Research & Market Discovery',
    subtitle: 'Find high-demand, low-competition niches before committing capital.',
    color:    DS.info,
    stage:    'discovery',
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
    stage:    'analysis',
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
    stage:    'supplier',
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
    stage:    'brand',
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
    stage:    'freight',
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

// ── Helpers ───────────────────────────────────────────────────────────────────

function getStageStatus(session: BuilderSession | null, stage: BuilderStage): 'passed' | 'active' | 'locked' {
  if (!session) return 'locked';
  const s = session.stages[stage];
  if (s === 'passed') return 'passed';
  if (s === 'active') return 'active';
  return 'locked';
}

function fmt(n: number, prefix = '') {
  return `${prefix}${n.toLocaleString()}`;
}

function fmtPct(n: number) {
  return `${n.toFixed(1)}%`;
}

// ── Live data panels ──────────────────────────────────────────────────────────

function DiscoveryPanel({ d }: { d: DiscoveryData }) {
  const compColor = d.product.competition === 'Low' ? DS.success : d.product.competition === 'Medium' ? DS.warning : DS.danger;
  return (
    <View style={lv.wrap}>
      <Text style={lv.productTitle} numberOfLines={2}>{d.product.title}</Text>
      <View style={lv.row}>
        <Stat label="Keyword" value={d.keyword} />
        <Stat label="Marketplace" value={d.marketplace} />
      </View>
      <View style={lv.row}>
        <Stat label="Price" value={`$${d.product.price}`} />
        {d.product.rating != null && <Stat label="Rating" value={`${d.product.rating} ★`} />}
        <Stat label="Competition" value={d.product.competition} color={compColor} />
      </View>
    </View>
  );
}

function AnalysisPanel({ d }: { d: AnalysisData }) {
  const verdictColor = d.verdict === 'LAUNCH' ? DS.success : d.verdict === 'TEST' ? DS.warning : DS.danger;
  return (
    <View style={lv.wrap}>
      <View style={lv.verdictRow}>
        <View style={[lv.verdictPill, { backgroundColor: verdictColor + '18', borderColor: verdictColor + '40', borderWidth: 1 }]}>
          <Text style={[lv.verdictTxt, { color: verdictColor }]}>{d.verdict}</Text>
        </View>
        <Text style={lv.confidenceTxt}>{d.confidence}% confidence</Text>
        <Text style={lv.confidenceTxt}>Score: {d.opportunityScore}/100</Text>
      </View>
      <Text style={lv.summaryTxt} numberOfLines={3}>{d.summary}</Text>
      {!!d.risk && (
        <View style={lv.riskRow}>
          <Text style={lv.riskIcon}>⚠</Text>
          <Text style={lv.riskTxt} numberOfLines={2}>{d.risk}</Text>
        </View>
      )}
    </View>
  );
}

function SupplierPanel({ d }: { d: SupplierData }) {
  return (
    <View style={lv.wrap}>
      <Text style={lv.supplierName}>{d.name}</Text>
      <Text style={lv.supplierPlatform}>{d.platform}</Text>
      <View style={lv.row}>
        <Stat label="Unit Cost" value={`$${d.unitCost}`} />
        <Stat label="MOQ" value={`${d.moq} units`} />
        <Stat label="Budget Fit" value={d.fitsProfileBudget ? 'Yes ✓' : 'Over budget'} color={d.fitsProfileBudget ? DS.success : DS.warning} />
      </View>
    </View>
  );
}

function BrandPanel({ d }: { d: BrandData }) {
  return (
    <View style={lv.wrap}>
      <Text style={lv.brandName}>{d.brandName}</Text>
      {!!d.tagline && <Text style={lv.tagline}>"{d.tagline}"</Text>}
      {!!d.productTitle && <Text style={lv.productTitle} numberOfLines={2}>{d.productTitle}</Text>}
    </View>
  );
}

function FreightCalcPanel({ freight, calc }: { freight: FreightData; calc: CalculationsData | null }) {
  const verdictColor = !calc ? DS.textMuted : calc.verdict === 'profitable' ? DS.success : calc.verdict === 'marginal' ? DS.warning : DS.danger;
  return (
    <View style={lv.wrap}>
      <View style={lv.row}>
        <Stat label="Freight Mode" value={freight.modeLabel} />
        <Stat label="Cost / Unit" value={`$${freight.costPerUnit.toFixed(2)}`} />
        <Stat label="Transit" value={`${freight.transitDays}d`} />
      </View>
      {calc && (
        <>
          <View style={lv.divider} />
          <View style={lv.row}>
            <Stat label="Net Profit" value={`$${calc.netProfit.toFixed(2)}`} color={verdictColor} />
            <Stat label="Margin" value={fmtPct(calc.marginPct)} color={verdictColor} />
            <Stat label="ROI" value={fmtPct(calc.roiPct)} color={verdictColor} />
          </View>
          <View style={lv.row}>
            <Stat label="Mo. Profit Est." value={`$${fmt(calc.monthlyProfitEst)}`} />
            <Stat label="Break-even" value={`${calc.breakEvenUnits} units`} />
          </View>
        </>
      )}
    </View>
  );
}

function Stat({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <View style={lv.stat}>
      <Text style={lv.statLabel}>{label}</Text>
      <Text style={[lv.statValue, color ? { color } : {}]}>{value}</Text>
    </View>
  );
}

const lv = StyleSheet.create({
  wrap:           { gap: 10 },
  row:            { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  stat:           { gap: 2, minWidth: 70 },
  statLabel:      { fontSize: 9, fontWeight: '700', color: DS.textMuted, letterSpacing: 1, textTransform: 'uppercase' },
  statValue:      { fontSize: 13, fontWeight: '700', color: DS.textPrimary },
  productTitle:   { fontSize: 13, fontWeight: '700', color: DS.textPrimary, lineHeight: 19 },
  verdictRow:     { flexDirection: 'row', alignItems: 'center', gap: 10, flexWrap: 'wrap' },
  verdictPill:    { borderRadius: DS.radiusBadge, paddingHorizontal: 10, paddingVertical: 4 },
  verdictTxt:     { fontSize: 12, fontWeight: '900', letterSpacing: 0.5 },
  confidenceTxt:  { fontSize: 11, color: DS.textSecondary, fontWeight: '600' },
  summaryTxt:     { fontSize: 12, color: DS.textSecondary, lineHeight: 18 },
  riskRow:        { flexDirection: 'row', gap: 6, alignItems: 'flex-start' },
  riskIcon:       { fontSize: 11, color: DS.warning, marginTop: 1 },
  riskTxt:        { fontSize: 11, color: DS.warning, flex: 1, lineHeight: 16 },
  supplierName:   { fontSize: 14, fontWeight: '800', color: DS.textPrimary },
  supplierPlatform: { fontSize: 11, color: DS.textSecondary, marginTop: -4, marginBottom: 2 },
  brandName:      { fontSize: 18, fontWeight: '900', color: DS.textPrimary, letterSpacing: -0.5 },
  tagline:        { fontSize: 12, color: DS.textSecondary, fontStyle: 'italic' },
  divider:        { height: 1, backgroundColor: DS.border },
});

// ── Phase card ────────────────────────────────────────────────────────────────

function PhaseCard({
  phase, idx, session, onGoToLaunchPad,
}: {
  phase: Phase;
  idx: number;
  session: BuilderSession | null;
  onGoToLaunchPad: () => void;
}) {
  const status = getStageStatus(session, phase.stage);
  const isLocked = status === 'locked';
  const isActive = status === 'active';
  const isPassed = status === 'passed';

  const borderColor = isPassed
    ? phase.color + '40'
    : isActive
    ? phase.color + '60'
    : DS.border;

  const bgColor = isPassed
    ? phase.color + '06'
    : isActive
    ? phase.color + '0A'
    : DS.bgCard;

  return (
    <View style={[s.card, { borderColor, backgroundColor: bgColor }]}>

      {/* Card header */}
      <View style={s.cardHeader}>
        <View style={[s.iconBadge, { backgroundColor: isLocked ? DS.bgElevated : phase.color + '18' }]}>
          <Text style={[s.iconText, { color: isLocked ? DS.textMuted : phase.color }]}>{phase.icon}</Text>
        </View>
        <View style={{ flex: 1, gap: 4 }}>
          <View style={s.stepRow}>
            <Text style={s.stepNum}>STEP {idx + 1}</Text>
            <StatusPill status={status} color={phase.color} />
          </View>
          <Text style={[s.cardTitle, isLocked && { color: DS.textSecondary }]}>{phase.title}</Text>
        </View>
      </View>

      <Text style={s.cardSub}>{phase.subtitle}</Text>

      {/* Live data */}
      {isPassed && session && phase.stage === 'discovery' && session.discovery && (
        <DiscoveryPanel d={session.discovery} />
      )}
      {isPassed && session && phase.stage === 'analysis' && session.analysis && (
        <AnalysisPanel d={session.analysis} />
      )}
      {isPassed && session && phase.stage === 'supplier' && session.supplier && (
        <SupplierPanel d={session.supplier} />
      )}
      {isPassed && session && phase.stage === 'brand' && session.brand && (
        <BrandPanel d={session.brand} />
      )}
      {isPassed && session && phase.stage === 'freight' && session.freight && (
        <FreightCalcPanel freight={session.freight} calc={session.calculations} />
      )}

      {/* Active — in progress */}
      {isActive && (
        <TouchableOpacity style={[s.activeBtn, { borderColor: phase.color + '60', backgroundColor: phase.color + '10' }]} onPress={onGoToLaunchPad} activeOpacity={0.8}>
          <Text style={[s.activeBtnTxt, { color: phase.color }]}>In progress — go to LaunchPad →</Text>
        </TouchableOpacity>
      )}

      {/* Locked — show feature list */}
      {isLocked && (
        <View style={s.chips}>
          {phase.features.map(f => (
            <View key={f} style={s.chip}>
              <Text style={s.chipDot}>·</Text>
              <Text style={s.chipLabel}>{f}</Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

function StatusPill({ status, color }: { status: 'passed' | 'active' | 'locked'; color: string }) {
  if (status === 'passed') {
    return (
      <View style={[s.pill, { backgroundColor: color + '18' }]}>
        <View style={[s.dot, { backgroundColor: color }]} />
        <Text style={[s.pillTxt, { color }]}>Complete</Text>
      </View>
    );
  }
  if (status === 'active') {
    return (
      <View style={[s.pill, { backgroundColor: color + '18' }]}>
        <View style={[s.dot, { backgroundColor: color }]} />
        <Text style={[s.pillTxt, { color }]}>In Progress</Text>
      </View>
    );
  }
  return (
    <View style={[s.pill, { backgroundColor: DS.bgElevated }]}>
      <View style={[s.dot, { backgroundColor: DS.textMuted }]} />
      <Text style={[s.pillTxt, { color: DS.textMuted }]}>Upcoming</Text>
    </View>
  );
}

// ── Screen ────────────────────────────────────────────────────────────────────

export default function ProductBlueprintScreen() {
  const navigation    = useNavigation<any>();
  const { activeSession } = useBuilderSession();
  const session = activeSession;

  const completedCount = session
    ? PHASES.filter(p => getStageStatus(session, p.stage) === 'passed').length
    : 0;
  const progressPct = (completedCount / PHASES.length) * 100;

  function goToLaunchPad() {
    navigation.goBack();
  }

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

      <ScrollView style={s.scroll} contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>

        {/* Hero */}
        <View style={s.hero}>
          <Text style={s.heroIcon}>◈</Text>
          <Text style={s.heroTitle}>End-to-End FBA Operating System</Text>
          <Text style={s.heroSub}>
            {session
              ? `Active launch in progress · ${completedCount} of ${PHASES.length} phases complete`
              : 'From niche discovery to freight and profit confirmation — every stage connects.'}
          </Text>
        </View>

        {/* Progress bar — only when session active */}
        {session && (
          <View style={s.progressWrap}>
            <View style={s.progressTrack}>
              <View style={[s.progressFill, { width: `${progressPct}%` }]} />
            </View>
            <Text style={s.progressTxt}>{completedCount}/{PHASES.length} phases complete</Text>
          </View>
        )}

        {/* Go to LaunchPad banner — only when session active */}
        {session && (
          <TouchableOpacity style={s.launchpadBanner} onPress={goToLaunchPad} activeOpacity={0.85}>
            <Text style={s.launchpadBannerTxt}>Continue in LaunchPad →</Text>
          </TouchableOpacity>
        )}

        {/* Pipeline label */}
        <View style={s.pipelineLabel}>
          <View style={s.pipelineLine} />
          <Text style={s.pipelineTxt}>THE LAUNCH PIPELINE</Text>
          <View style={s.pipelineLine} />
        </View>

        {/* Phase cards */}
        {PHASES.map((phase, idx) => (
          <View key={phase.stage} style={s.sectionWrap}>
            {idx > 0 && (
              <View style={[s.connector, {
                borderColor: getStageStatus(session, phase.stage) !== 'locked'
                  ? phase.color + '40'
                  : DS.border,
              }]} />
            )}
            <PhaseCard
              phase={phase}
              idx={idx}
              session={session}
              onGoToLaunchPad={goToLaunchPad}
            />
          </View>
        ))}

        {/* Footer */}
        {session?.status === 'complete' ? (
          <View style={[s.footer, { borderColor: DS.success + '40' }]}>
            <Text style={s.footerIcon}>🏆</Text>
            <Text style={s.footerTitle}>Launch Complete!</Text>
            <Text style={s.footerSub}>
              All 5 phases finished. Your product blueprint is ready.
            </Text>
          </View>
        ) : (
          <View style={s.footer}>
            <Text style={s.footerIcon}>◉</Text>
            <Text style={s.footerTitle}>One Pipeline. Every Stage.</Text>
            <Text style={s.footerSub}>
              Research flows into validation, validation into sourcing, sourcing into branding, branding into freight. Nothing is siloed.
            </Text>
          </View>
        )}

      </ScrollView>
    </SafeAreaView>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  safe:    { flex: 1, backgroundColor: DS.bgCanvas },
  scroll:  { flex: 1 },
  content: { paddingHorizontal: DS.pagePadding, paddingBottom: 60, gap: 0 },

  header: {
    flexDirection:     'row',
    alignItems:        'center',
    justifyContent:    'space-between',
    paddingHorizontal: DS.pagePadding,
    paddingTop:        10,
    paddingBottom:     14,
    backgroundColor:   DS.bgCard,
    borderBottomWidth: 1,
    borderBottomColor: DS.border,
  },
  backBtn:      { width: 36, alignItems: 'flex-start' },
  backArrow:    { fontSize: 20, color: DS.accent, fontWeight: '700' },
  headerCenter: { alignItems: 'center', gap: 1 },
  eyebrow:      { fontSize: 9, fontWeight: '800', color: DS.accent, letterSpacing: 2.5 },
  title:        { fontSize: 16, fontWeight: '900', color: DS.textPrimary, letterSpacing: -0.4 },

  hero: {
    alignItems:        'center',
    paddingVertical:   28,
    paddingHorizontal: 8,
    gap:               10,
  },
  heroIcon:  { fontSize: 36 },
  heroTitle: { fontSize: 20, fontWeight: '900', color: DS.textPrimary, textAlign: 'center', letterSpacing: -0.5 },
  heroSub:   { fontSize: 14, color: DS.textSecondary, textAlign: 'center', lineHeight: 22 },

  progressWrap:  { gap: 6, marginBottom: 4 },
  progressTrack: { height: 6, backgroundColor: DS.bgElevated, borderRadius: 999 },
  progressFill:  { height: 6, backgroundColor: DS.accent, borderRadius: 999 },
  progressTxt:   { fontSize: 10, color: DS.textMuted, fontWeight: '600', textAlign: 'right' },

  launchpadBanner: {
    backgroundColor: DS.accent,
    borderRadius:    DS.radiusButton,
    paddingVertical: 14,
    alignItems:      'center',
    marginBottom:    8,
  },
  launchpadBannerTxt: { fontSize: 14, fontWeight: '900', color: '#fff', letterSpacing: -0.2 },

  pipelineLabel: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           10,
    marginTop:     16,
    marginBottom:  20,
  },
  pipelineLine: { flex: 1, height: 1, backgroundColor: DS.border },
  pipelineTxt:  { fontSize: 9, fontWeight: '800', color: DS.textMuted, letterSpacing: 2 },

  sectionWrap: { gap: 0 },

  connector: {
    width:           2,
    height:          20,
    borderLeftWidth: 2,
    borderStyle:     'dashed',
    alignSelf:       'center',
  },

  card: {
    borderRadius:  DS.radiusCard,
    borderWidth:   1.5,
    padding:       DS.cardPadding,
    gap:           14,
    shadowColor:   DS.textPrimary,
    shadowOffset:  { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius:  8,
    elevation:     2,
  },

  cardHeader:     { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  iconBadge:      { width: 44, height: 44, borderRadius: DS.radiusButton, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  iconText:       { fontSize: 20 },
  stepRow:        { flexDirection: 'row', alignItems: 'center', gap: 8 },
  stepNum:        { fontSize: 9, fontWeight: '800', color: DS.textMuted, letterSpacing: 2 },
  cardTitle:      { fontSize: 14, fontWeight: '800', color: DS.textPrimary, letterSpacing: -0.3, lineHeight: 20 },
  cardSub:        { fontSize: 13, color: DS.textSecondary, lineHeight: 19, marginTop: -6 },

  pill:    { flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: DS.radiusBadge, paddingHorizontal: 8, paddingVertical: 3 },
  dot:     { width: 5, height: 5, borderRadius: 3 },
  pillTxt: { fontSize: 9, fontWeight: '800', letterSpacing: 0.5 },

  activeBtn:    { borderRadius: DS.radiusButton, borderWidth: 1, paddingVertical: 12, alignItems: 'center' },
  activeBtnTxt: { fontSize: 13, fontWeight: '800' },

  chips:     { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip:      { flexDirection: 'row', alignItems: 'center', gap: 4 },
  chipDot:   { fontSize: 12, color: DS.textMuted },
  chipLabel: { fontSize: 12, color: DS.textMuted, fontWeight: '500' },

  footer: {
    alignItems:      'center',
    marginTop:       32,
    padding:         DS.cardPadding,
    backgroundColor: DS.bgCard,
    borderRadius:    DS.radiusCard,
    borderWidth:     1.5,
    borderColor:     DS.accent + '30',
    gap:             8,
  },
  footerIcon:  { fontSize: 28 },
  footerTitle: { fontSize: 16, fontWeight: '900', color: DS.textPrimary, textAlign: 'center', letterSpacing: -0.4 },
  footerSub:   { fontSize: 13, color: DS.textSecondary, textAlign: 'center', lineHeight: 20 },
});
