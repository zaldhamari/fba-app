import React, { useMemo } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { DS } from '../theme/ds';
import { usePipeline } from '../context/PipelineContext';

// ── Scoring ───────────────────────────────────────────────────────────────────

type Verdict = 'LAUNCH' | 'TEST' | 'HOLD' | 'AVOID';

interface ReadinessResult {
  score:     number;
  verdict:   Verdict;
  strengths: string[];
  risks:     string[];
  missing:   string[];
  actions:   string[];
}

function calcReadiness(
  niche:    ReturnType<typeof usePipeline>['activeNiche'],
  product:  ReturnType<typeof usePipeline>['activeProduct'],
  supplier: ReturnType<typeof usePipeline>['selectedSupplier'],
  cost:     ReturnType<typeof usePipeline>['costModel'],
  brand:    ReturnType<typeof usePipeline>['brandData'],
): ReadinessResult {
  let score = 0;
  const strengths: string[] = [];
  const risks:     string[] = [];
  const missing:   string[] = [];
  const actions:   string[] = [];

  // ── Niche (15 pts) ────────────────────────────────────────────────────────
  if (niche) {
    score += 15;
    if (niche.score >= 4) {
      strengths.push(`Strong niche signal — ${niche.verdictLabel} (${niche.score}/5)`);
    } else if (niche.score >= 3) {
      strengths.push(`Viable niche: ${niche.keyword}`);
    } else {
      risks.push(`Weak niche score (${niche.score}/5) — consider a different angle`);
    }
  } else {
    missing.push('No niche selected');
    actions.push('Go to Niche tab and research a keyword');
  }

  // ── Product (20 pts) ──────────────────────────────────────────────────────
  if (product) {
    score += 20;
    if (product.reviews < 200) {
      strengths.push(`Low competition: ${product.reviews} reviews on target product`);
    } else if (product.reviews < 500) {
      strengths.push(`Moderate competition: ${product.reviews} reviews`);
    } else {
      risks.push(`High competition: ${product.reviews}+ reviews to compete with`);
    }
    if (product.rating >= 4.0) {
      strengths.push(`High rated market (${product.rating}★) — quality bar is achievable`);
    }
  } else {
    missing.push('No product validated');
    actions.push('Go to Validate tab, search your niche, and select a product');
  }

  // ── Supplier (20 pts) ─────────────────────────────────────────────────────
  if (supplier) {
    score += 20;
    if (supplier.grade === 'A' || supplier.grade === 'B') {
      score += 5;
      strengths.push(`Quality supplier: ${supplier.name} (Grade ${supplier.grade})`);
    } else if (supplier.grade) {
      risks.push(`Supplier grade ${supplier.grade} — verify quality before large order`);
    } else {
      strengths.push(`Supplier locked in: ${supplier.name} at $${supplier.unitCost}/unit`);
    }
    if (supplier.moq <= 300) {
      strengths.push(`Low MOQ (${supplier.moq} units) — manageable first order`);
    } else {
      risks.push(`High MOQ (${supplier.moq} units) — capital risk on first order`);
    }
  } else {
    missing.push('No supplier selected');
    actions.push('Go to Suppliers tab and lock in a manufacturer');
  }

  // ── Cost model (20 pts) ───────────────────────────────────────────────────
  if (cost) {
    score += 20;
    if (cost.marginPct >= 30) {
      score += 5;
      strengths.push(`Strong margin: ${cost.marginPct.toFixed(1)}% — well above 25% target`);
    } else if (cost.marginPct >= 20) {
      strengths.push(`Acceptable margin: ${cost.marginPct.toFixed(1)}%`);
    } else if (cost.marginPct >= 10) {
      risks.push(`Thin margin: ${cost.marginPct.toFixed(1)}% — leaves little room for error`);
    } else {
      risks.push(`Unprofitable: ${cost.marginPct.toFixed(1)}% margin — renegotiate supplier cost or raise price`);
      score = Math.max(0, score - 10);
    }

    if (cost.roiPct >= 50) {
      score += 5;
      strengths.push(`Strong ROI: ${cost.roiPct.toFixed(0)}% per cycle`);
    } else if (cost.roiPct >= 20) {
      strengths.push(`Adequate ROI: ${cost.roiPct.toFixed(0)}%`);
    } else {
      risks.push(`Low ROI: ${cost.roiPct.toFixed(0)}% — capital tied up inefficiently`);
    }

    if (cost.totalInvestment > 0) {
      strengths.push(`Total investment modelled: $${cost.totalInvestment.toLocaleString()}`);
    }
  } else {
    missing.push('No cost model saved');
    actions.push('Go to Costs tab, run FBA Profit calculator, and save cost model');
  }

  // ── Brand data (10 pts) ───────────────────────────────────────────────────
  if (brand) {
    score += 10;
    strengths.push(`Brand identity ready: ${brand.brandName}`);
  } else {
    missing.push('Brand data not saved');
    actions.push('Go to Label tab, generate your brand, and save brand data');
  }

  // ── Cap score ─────────────────────────────────────────────────────────────
  score = Math.min(100, Math.max(0, score));

  // ── Verdict ───────────────────────────────────────────────────────────────
  let verdict: Verdict;
  if (score >= 80)      verdict = 'LAUNCH';
  else if (score >= 60) verdict = 'TEST';
  else if (score >= 40) verdict = 'HOLD';
  else                  verdict = 'AVOID';

  // ── Default actions if none ───────────────────────────────────────────────
  if (actions.length === 0) {
    if (verdict === 'LAUNCH') {
      actions.push('Order a small test batch (MOQ or slightly above)');
      actions.push('Set up Amazon Seller Central and create your listing');
      actions.push('Prepare PPC budget: at least 2–3× your target daily revenue');
    } else if (verdict === 'TEST') {
      actions.push('Order a minimum test batch to validate quality');
      actions.push('Consider improving margin before scaling');
      actions.push('Run a small PPC test before full launch');
    } else if (verdict === 'HOLD') {
      actions.push('Re-evaluate supplier cost — aim for 30%+ margin');
      actions.push('Validate product demand more thoroughly');
    }
  }

  return { score, verdict, strengths, risks, missing, actions };
}

// ── Verdict config ────────────────────────────────────────────────────────────

const VERDICT_CFG: Record<Verdict, { color: string; bg: string; icon: string; sub: string }> = {
  LAUNCH: { color: DS.success,  bg: DS.success  + '12', icon: '🚀', sub: 'This opportunity is ready. Act now.' },
  TEST:   { color: DS.warning,  bg: DS.warning  + '12', icon: '⚗️', sub: 'Proceed with a small test batch first.' },
  HOLD:   { color: DS.info,     bg: DS.info     + '12', icon: '⏸',  sub: 'More information needed before committing.' },
  AVOID:  { color: DS.danger,   bg: DS.danger   + '12', icon: '✕',  sub: 'Too many risks. Find a better opportunity.' },
};

// ── Sub-components ────────────────────────────────────────────────────────────

function DataRow({ label, value, missing }: { label: string; value: string; missing?: boolean }) {
  return (
    <View style={d.row}>
      <Text style={d.label}>{label}</Text>
      <Text style={[d.value, missing && d.valueMissing]}>{value}</Text>
    </View>
  );
}
const d = StyleSheet.create({
  row:         { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 7, borderBottomWidth: 1, borderBottomColor: DS.border },
  label:       { fontSize: 12, color: DS.textSecondary, flex: 1 },
  value:       { fontSize: 12, fontWeight: '700', color: DS.textPrimary, textAlign: 'right', flex: 1 },
  valueMissing:{ color: DS.textMuted, fontStyle: 'italic' },
});

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={sc.card}>
      <Text style={sc.cardTitle}>{title}</Text>
      {children}
    </View>
  );
}
const sc = StyleSheet.create({
  card:      { backgroundColor: DS.bgCard, borderRadius: DS.radiusCard, borderWidth: 1, borderColor: DS.border, padding: DS.cardPadding, gap: 10 },
  cardTitle: { fontSize: 13, fontWeight: '800', color: DS.textPrimary, letterSpacing: -0.2 },
});

function BulletRow({ text, color, icon }: { text: string; color: string; icon: string }) {
  return (
    <View style={bl.row}>
      <Text style={[bl.icon, { color }]}>{icon}</Text>
      <Text style={bl.txt}>{text}</Text>
    </View>
  );
}
const bl = StyleSheet.create({
  row:  { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  icon: { fontSize: 11, fontWeight: '800', marginTop: 2, width: 14, textAlign: 'center' },
  txt:  { flex: 1, fontSize: 13, color: DS.textSecondary, lineHeight: 19 },
});

// ── Main screen ───────────────────────────────────────────────────────────────

export default function LaunchDecisionScreen() {
  const navigation = useNavigation();
  const pipeline   = usePipeline();

  const { activeNiche, activeProduct, selectedSupplier, costModel, brandData } = pipeline;

  const result = useMemo(
    () => calcReadiness(activeNiche, activeProduct, selectedSupplier, costModel, brandData),
    [activeNiche, activeProduct, selectedSupplier, costModel, brandData],
  );

  const vcfg = VERDICT_CFG[result.verdict];

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} activeOpacity={0.7} style={s.backBtn}>
          <Text style={s.backTxt}>← Back</Text>
        </TouchableOpacity>
        <Text style={s.headerTitle}>Launch Decision</Text>
        <View style={s.backBtn} />
      </View>

      <ScrollView style={s.scroll} contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>

        {/* Verdict card */}
        <View style={[s.verdictCard, { backgroundColor: vcfg.bg, borderColor: vcfg.color + '40' }]}>
          <View style={s.verdictTop}>
            <Text style={s.verdictIcon}>{vcfg.icon}</Text>
            <View style={{ flex: 1, gap: 4 }}>
              <Text style={[s.verdictLabel, { color: vcfg.color }]}>{result.verdict}</Text>
              <Text style={s.verdictSub}>{vcfg.sub}</Text>
            </View>
            <View style={s.scoreCircle}>
              <Text style={[s.scoreNum, { color: vcfg.color }]}>{result.score}</Text>
              <Text style={s.scoreOf}>/100</Text>
            </View>
          </View>

          {/* Score bar */}
          <View style={s.scoreBarTrack}>
            <View style={[s.scoreBarFill, { width: `${result.score}%` as any, backgroundColor: vcfg.color }]} />
          </View>
          <Text style={[s.readinessLabel, { color: vcfg.color }]}>
            {result.score >= 80 ? 'Launch Ready' : result.score >= 60 ? 'Nearly Ready' : result.score >= 40 ? 'In Progress' : 'Not Ready'}
          </Text>
        </View>

        {/* Pipeline snapshot */}
        <Section title="Pipeline Snapshot">
          <DataRow label="Niche"        value={activeNiche    ? `${activeNiche.keyword} (${activeNiche.verdictLabel})` : '—'} missing={!activeNiche} />
          <DataRow label="Product"      value={activeProduct  ? activeProduct.title                                         : '—'} missing={!activeProduct} />
          <DataRow label="Supplier"     value={selectedSupplier ? `${selectedSupplier.name} — $${selectedSupplier.unitCost}/unit` : '—'} missing={!selectedSupplier} />
          <DataRow label="Margin"       value={costModel      ? `${costModel.marginPct.toFixed(1)}%`                        : '—'} missing={!costModel} />
          <DataRow label="ROI"          value={costModel      ? `${costModel.roiPct.toFixed(0)}%`                           : '—'} missing={!costModel} />
          <DataRow label="Net Profit"   value={costModel      ? `$${costModel.netProfit.toFixed(2)}/unit`                   : '—'} missing={!costModel} />
          <DataRow label="Investment"   value={costModel?.totalInvestment ? `$${costModel.totalInvestment.toLocaleString()}` : '—'} missing={!costModel} />
          <DataRow label="Brand"        value={brandData      ? brandData.brandName                                         : '—'} missing={!brandData} />
        </Section>

        {/* Strengths */}
        {result.strengths.length > 0 && (
          <Section title="Strengths">
            {result.strengths.map((s, i) => (
              <BulletRow key={i} text={s} color={DS.success} icon="✓" />
            ))}
          </Section>
        )}

        {/* Risks */}
        {result.risks.length > 0 && (
          <Section title="Risks">
            {result.risks.map((r, i) => (
              <BulletRow key={i} text={r} color={DS.warning} icon="⚠" />
            ))}
          </Section>
        )}

        {/* Missing */}
        {result.missing.length > 0 && (
          <Section title="Missing Information">
            {result.missing.map((m, i) => (
              <BulletRow key={i} text={m} color={DS.danger} icon="✕" />
            ))}
          </Section>
        )}

        {/* Next actions */}
        {result.actions.length > 0 && (
          <Section title="Suggested Next Actions">
            {result.actions.map((a, i) => (
              <BulletRow key={i} text={a} color={DS.accent} icon={`${i + 1}`} />
            ))}
          </Section>
        )}

        {/* Reset pipeline */}
        <TouchableOpacity
          style={s.resetBtn}
          onPress={() => {
            pipeline.clearPipeline();
            navigation.goBack();
          }}
          activeOpacity={0.7}
        >
          <Text style={s.resetTxt}>Clear Pipeline & Start Over</Text>
        </TouchableOpacity>

      </ScrollView>
    </SafeAreaView>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  safe:    { flex: 1, backgroundColor: DS.bgCanvas },
  header: {
    flexDirection:   'row',
    alignItems:      'center',
    justifyContent:  'space-between',
    paddingHorizontal: DS.pagePadding,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: DS.border,
    backgroundColor: DS.bgCard,
  },
  backBtn:     { width: 60 },
  backTxt:     { fontSize: 14, fontWeight: '700', color: DS.accent },
  headerTitle: { fontSize: 16, fontWeight: '900', color: DS.textPrimary, letterSpacing: -0.4 },

  scroll:  { flex: 1 },
  content: { paddingHorizontal: DS.pagePadding, paddingBottom: 60, gap: DS.sectionGap, paddingTop: DS.sectionGap },

  verdictCard: {
    borderRadius: DS.radiusCard,
    borderWidth:  1.5,
    padding:      DS.cardPadding,
    gap:          14,
  },
  verdictTop:  { flexDirection: 'row', alignItems: 'center', gap: 14 },
  verdictIcon: { fontSize: 36 },
  verdictLabel:{ fontSize: 28, fontWeight: '900', letterSpacing: -0.8 },
  verdictSub:  { fontSize: 13, color: DS.textSecondary, lineHeight: 18 },

  scoreCircle: { alignItems: 'center', justifyContent: 'center', width: 60 },
  scoreNum:    { fontSize: 28, fontWeight: '900', lineHeight: 32 },
  scoreOf:     { fontSize: 10, color: DS.textMuted, fontWeight: '600' },

  scoreBarTrack: { height: 6, backgroundColor: DS.bgElevated, borderRadius: 3, overflow: 'hidden' },
  scoreBarFill:  { height: 6, borderRadius: 3 },
  readinessLabel:{ fontSize: 11, fontWeight: '800', letterSpacing: 1, textTransform: 'uppercase', textAlign: 'center' },

  resetBtn: {
    alignItems:      'center',
    paddingVertical: 14,
    borderWidth:     1,
    borderColor:     DS.danger + '30',
    borderRadius:    DS.radiusButton,
    backgroundColor: DS.danger + '08',
  },
  resetTxt: { fontSize: 13, fontWeight: '700', color: DS.danger },
});
