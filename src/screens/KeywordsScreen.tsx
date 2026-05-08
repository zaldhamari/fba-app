import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity,
  ScrollView, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, spacing, radius, shadow } from '../theme';
import { api } from '../services/api';
import { useSubscription } from '../hooks/useSubscription';
import { useCurrency } from '../context/CurrencyContext';
import PaywallModal from '../components/PaywallModal';
import {
  enrichKeywords, exportKeywordsCSV,
  EnrichedKeywordResult, EnrichedKeyword, KeywordCluster,
  ListingRecommendations,
} from '../utils/seoEnrichment';

// ─── Score ring ───────────────────────────────────────────────────────────────

function ScoreRing({ score }: { score: number }) {
  const color = score >= 70 ? colors.green : score >= 45 ? colors.amber : colors.red;
  return (
    <View style={[ring.wrap, { borderColor: color }]}>
      <Text style={[ring.num, { color }]}>{score}</Text>
      <Text style={ring.label}>SEO</Text>
    </View>
  );
}
const ring = StyleSheet.create({
  wrap:  { width: 64, height: 64, borderRadius: 32, borderWidth: 3, alignItems: 'center', justifyContent: 'center' },
  num:   { fontSize: 20, fontWeight: '800', letterSpacing: -1 },
  label: { fontSize: 7, fontWeight: '700', color: colors.textMuted, letterSpacing: 1 },
});

// ─── Opportunity score pill ───────────────────────────────────────────────────

function ScorePill({ score }: { score: number }) {
  const color = score >= 70 ? colors.green : score >= 45 ? colors.amber : colors.red;
  return (
    <View style={[pill.wrap, { borderColor: color + '60' }]}>
      <Text style={[pill.num, { color }]}>{score}</Text>
    </View>
  );
}
const pill = StyleSheet.create({
  wrap: { borderWidth: 1.5, borderRadius: radius.sm, paddingHorizontal: 6, paddingVertical: 2, alignItems: 'center' },
  num:  { fontSize: 13, fontWeight: '800', letterSpacing: -0.5 },
});

// ─── Competition bar ──────────────────────────────────────────────────────────

function CompBar({ competition }: { competition: string }) {
  const pct   = competition === 'Low' ? 0.22 : competition === 'High' ? 0.90 : 0.55;
  const color = competition === 'Low' ? colors.green : competition === 'High' ? colors.red : colors.amber;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
      <View style={{ width: 36, height: 3, backgroundColor: colors.bgElevated, borderRadius: 2, overflow: 'hidden' }}>
        <View style={{ width: `${pct * 100}%`, height: '100%', backgroundColor: color, borderRadius: 2 }} />
      </View>
      <Text style={[s.compLabel, { color }]}>{competition}</Text>
    </View>
  );
}

// ─── Usage badge ──────────────────────────────────────────────────────────────

const USAGE_COLORS: Record<string, string> = {
  Title:   colors.cyan,
  Bullet:  colors.green,
  Backend: colors.textMuted,
  PPC:     colors.amber,
};
function UsageBadge({ label }: { label: string }) {
  const color = USAGE_COLORS[label] ?? colors.textMuted;
  return (
    <View style={[s.usageBadge, { borderColor: color + '50' }]}>
      <Text style={[s.usageBadgeText, { color }]}>{label}</Text>
    </View>
  );
}

// ─── Single keyword card ──────────────────────────────────────────────────────

function KeywordCard({ item }: { item: EnrichedKeyword }) {
  const typeColor = item.type === 'Buyer Intent' ? colors.green
    : item.type === 'PPC' ? colors.amber
    : item.type === 'Long-tail' ? colors.cyan
    : colors.textMuted;
  return (
    <View style={s.kwCard}>
      <View style={s.kwTop}>
        <View style={[s.typePill, { borderColor: typeColor + '50' }]}>
          <Text style={[s.typePillText, { color: typeColor }]}>{item.type}</Text>
        </View>
        <ScorePill score={item.opportunity_score} />
      </View>
      <Text style={s.kwText} numberOfLines={2}>{item.keyword}</Text>
      <View style={s.kwBottom}>
        <View style={s.usageRow}>
          {item.recommended_usage.map(u => <UsageBadge key={u} label={u} />)}
        </View>
        <CompBar competition={item.competition} />
      </View>
    </View>
  );
}

// ─── Keyword cluster section ──────────────────────────────────────────────────

const CLUSTER_ACCENT: Record<string, string> = {
  high_intent:    colors.green,
  long_tail:      colors.cyan,
  ppc:            colors.amber,
  low_competition: colors.green,
  backend:        colors.textMuted,
};

function ClusterSection({ cluster }: { cluster: KeywordCluster }) {
  const accent = CLUSTER_ACCENT[cluster.type] ?? colors.cyan;
  return (
    <View style={s.clusterWrap}>
      <View style={[s.clusterHeader, { borderLeftColor: accent }]}>
        <View style={s.clusterHeaderLeft}>
          <Text style={[s.clusterName, { color: accent }]}>{cluster.name.toUpperCase()}</Text>
          <View style={[s.clusterCount, { backgroundColor: accent + '18' }]}>
            <Text style={[s.clusterCountText, { color: accent }]}>{cluster.keywords.length}</Text>
          </View>
        </View>
        <Text style={s.clusterDesc}>{cluster.description}</Text>
      </View>
      {cluster.keywords.map((kw, i) => (
        <React.Fragment key={i}>
          {i > 0 && <View style={s.kwDivider} />}
          <KeywordCard item={kw} />
        </React.Fragment>
      ))}
    </View>
  );
}

// ─── Listing recommendations ──────────────────────────────────────────────────

const REC_LABELS: Array<[keyof ListingRecommendations, string, string]> = [
  ['title',       'TITLE',      colors.cyan],
  ['ppc',         'PPC',        colors.amber],
  ['backend',     'BACKEND',    colors.textMuted],
  ['long_tail',   'LONG-TAIL',  colors.cyan],
  ['buyer_intent','BUYER INT.', colors.green],
];

function ListingRecsSection({ recs }: { recs: ListingRecommendations }) {
  const filled = REC_LABELS.filter(([key]) => !!recs[key]);
  if (filled.length === 0) return null;
  return (
    <View style={s.recsCard}>
      <Text style={s.recsTitle}>WHAT TO USE WHERE</Text>
      <Text style={s.recsHint}>Exact keywords mapped to each part of your listing.</Text>
      {filled.map(([key, label, color]) => (
        <View key={key} style={s.recRow}>
          <Text style={[s.recLabel, { color }]}>{label}</Text>
          <Text style={s.recKw} numberOfLines={1}>"{recs[key]}"</Text>
        </View>
      ))}
    </View>
  );
}

// ─── Insights section ─────────────────────────────────────────────────────────

function InsightsSection({ insights }: { insights: string[] }) {
  if (insights.length === 0) return null;
  return (
    <View style={s.insightsCard}>
      <Text style={s.insightsTitle}>SEO SIGNALS</Text>
      {insights.map((insight, i) => (
        <View key={i} style={s.insightRow}>
          <View style={s.insightDot} />
          <Text style={s.insightText}>{insight}</Text>
        </View>
      ))}
    </View>
  );
}

// ─── Main screen ──────────────────────────────────────────────────────────────

export default function KeywordsScreen() {
  const [query, setQuery]         = useState('');
  const [result, setResult]       = useState<EnrichedKeywordResult | null>(null);
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState('');
  const [exporting, setExporting] = useState(false);
  const [showPaywall, setShowPaywall] = useState(false);
  const { can, increment, isFree } = useSubscription();
  const { marketplace } = useCurrency();

  async function search() {
    if (!query.trim()) return;
    if (!can('keywords')) { setShowPaywall(true); return; }
    setLoading(true); setError(''); setResult(null);
    try {
      const raw = await api.researchKeywords(query.trim());
      setResult(enrichKeywords(raw));
      await increment('keywords');
    } catch (e: any) {
      setError(e.message || 'Search failed.');
    } finally {
      setLoading(false);
    }
  }

  async function handleExport() {
    if (!result || exporting) return;
    setExporting(true);
    try {
      await exportKeywordsCSV(result.keywords, query, marketplace);
    } finally {
      setExporting(false);
    }
  }

  return (
    <SafeAreaView style={s.container}>
      <PaywallModal
        visible={showPaywall}
        onClose={() => setShowPaywall(false)}
        featureContext="keywords"
        defaultTier="builder"
      />

      {/* ─── Hero ─── */}
      <View style={s.hero}>
        <View style={s.heroOrb1} pointerEvents="none" />
        <View style={s.heroOrb2} pointerEvents="none" />
        <View style={s.heroTop}>
          <View>
            <Text style={s.brandWord}>Siftly</Text>
            <Text style={s.eyebrow}>KEYWORD INTELLIGENCE</Text>
            <Text style={s.title}>Find what{'\n'}buyers search.</Text>
          </View>
          <View style={s.heroBadges}>
            <TouchableOpacity
              style={s.proBadge}
              onPress={() => isFree && setShowPaywall(true)}
              activeOpacity={0.8}
            >
              <Text style={s.proBadgeText}>{isFree ? 'BUILDER ONLY' : 'UNLOCKED'}</Text>
            </TouchableOpacity>
            {result && (
              <TouchableOpacity
                style={[s.exportBtn, exporting && { opacity: 0.5 }]}
                onPress={handleExport}
                disabled={exporting}
                activeOpacity={0.8}
              >
                {exporting
                  ? <ActivityIndicator size="small" color={colors.cyan} />
                  : <Text style={s.exportBtnText}>↓ Export CSV</Text>}
              </TouchableOpacity>
            )}
          </View>
        </View>

        <View style={s.searchRow}>
          <TextInput
            style={s.input}
            value={query}
            onChangeText={setQuery}
            placeholder="Enter a product to research keywords…"
            placeholderTextColor={colors.textMuted}
            returnKeyType="search"
            onSubmitEditing={search}
            autoCorrect={false}
          />
          <TouchableOpacity
            style={[s.btn, loading && { opacity: 0.5 }]}
            onPress={search}
            disabled={loading}
            activeOpacity={0.8}
          >
            {loading
              ? <ActivityIndicator color={colors.bg} size="small" />
              : <Text style={s.btnText}>→</Text>}
          </TouchableOpacity>
        </View>
      </View>

      {!!error && <Text style={s.error}>{error}</Text>}

      {/* ─── Results ─── */}
      {result && (
        <ScrollView
          contentContainerStyle={s.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Stats row */}
          <View style={s.statsRow}>
            <View style={s.stat}>
              <Text style={s.statNum}>{result.total_found}</Text>
              <Text style={s.statLabel}>KEYWORDS</Text>
            </View>
            <View style={s.stat}>
              <ScoreRing score={result.seo_score} />
            </View>
            <View style={s.stat}>
              <Text style={s.statNum}>{result.keywords.filter(k => k.type === 'Long-tail').length}</Text>
              <Text style={s.statLabel}>LONG-TAIL</Text>
            </View>
          </View>

          {/* Score reason */}
          <Text style={s.scoreReason}>{result.seo_score_reason}</Text>

          {/* SEO Signals / Insights */}
          <InsightsSection insights={result.insights} />

          {/* Listing recommendations */}
          <ListingRecsSection recs={result.recommendations} />

          {/* Keyword clusters */}
          {result.clusters.map(cluster => (
            <ClusterSection key={cluster.type} cluster={cluster} />
          ))}

          <View style={{ height: spacing.xxl }} />
        </ScrollView>
      )}

      {/* ─── Empty state ─── */}
      {!result && !loading && (
        <View style={s.empty}>
          <Text style={s.emptyIcon}>≋</Text>
          <Text style={s.emptyTitle}>Discover buyer keywords</Text>
          <Text style={s.emptyText}>
            See what people search on Amazon,{'\n'}
            with competition, intent & opportunity scores.
          </Text>
        </View>
      )}
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },

  // ── Hero
  hero: {
    backgroundColor: colors.bgHero,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xl,
    marginBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.cyanBorder,
    overflow: 'hidden',
  },
  heroOrb1: {
    position: 'absolute', top: -60, right: -50,
    width: 220, height: 220, borderRadius: 110,
    backgroundColor: colors.amberDim,
    opacity: 0.55,
  },
  heroOrb2: {
    position: 'absolute', bottom: -40, left: -30,
    width: 130, height: 130, borderRadius: 65,
    backgroundColor: colors.cyanDim,
    opacity: 0.35,
  },
  heroTop: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'flex-start', marginBottom: spacing.md,
  },
  heroBadges: { alignItems: 'flex-end', gap: 6 },
  brandWord: { fontSize: 20, fontWeight: '900', color: colors.textPrimary, letterSpacing: -0.8, marginBottom: 2 },
  eyebrow:  { fontSize: 9, fontWeight: '800', color: colors.cyan, letterSpacing: 2.5, marginBottom: 6 },
  title:    { fontSize: 26, fontWeight: '900', color: colors.textPrimary, letterSpacing: -1, lineHeight: 32 },
  proBadge: {
    backgroundColor: colors.bgElevated, borderRadius: radius.sm,
    paddingHorizontal: spacing.sm, paddingVertical: 4,
    borderWidth: 1, borderColor: colors.border,
  },
  proBadgeText: { fontSize: 9, fontWeight: '800', color: colors.textSecondary, letterSpacing: 1 },
  exportBtn: {
    backgroundColor: colors.cyanDim,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.sm, paddingVertical: 4,
    borderWidth: 1, borderColor: colors.cyanBorder,
    minWidth: 80, alignItems: 'center',
  },
  exportBtnText: { fontSize: 9, fontWeight: '800', color: colors.cyan, letterSpacing: 0.5 },
  searchRow: { flexDirection: 'row', gap: spacing.sm },
  input: {
    flex: 1, backgroundColor: colors.bgElevated,
    borderWidth: 1, borderColor: colors.border,
    borderRadius: radius.md, paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 4, fontSize: 15, color: colors.textPrimary,
  },
  btn: {
    backgroundColor: colors.cyan, borderRadius: radius.md,
    paddingHorizontal: spacing.lg, justifyContent: 'center', alignItems: 'center',
    ...shadow.glowCyan,
  },
  btnText: { color: colors.bg, fontSize: 20, fontWeight: '900' },
  error:   { fontSize: 12, color: colors.red, paddingHorizontal: spacing.lg, marginBottom: spacing.xs },

  // ── Scroll content
  scrollContent: { paddingBottom: spacing.xxl },

  // ── Stats row
  statsRow: {
    flexDirection: 'row', gap: spacing.sm,
    paddingHorizontal: spacing.lg, paddingVertical: spacing.md,
    alignItems: 'center',
  },
  stat: {
    flex: 1, backgroundColor: colors.bgCard,
    borderRadius: radius.lg, padding: spacing.md,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: colors.border,
    minHeight: 80,
  },
  statNum:   { fontSize: 28, fontWeight: '900', color: colors.textPrimary, letterSpacing: -1 },
  statLabel: { fontSize: 8, fontWeight: '800', color: colors.textMuted, letterSpacing: 1.5, marginTop: 2 },

  // ── Score reason
  scoreReason: {
    fontSize: 11.5, color: colors.textMuted,
    textAlign: 'center', lineHeight: 17,
    letterSpacing: 0.1,
    paddingHorizontal: spacing.lg,
    marginTop: -spacing.xs,
    marginBottom: spacing.md,
  },

  // ── Insights card
  insightsCard: {
    marginHorizontal: spacing.lg,
    marginBottom: spacing.md,
    backgroundColor: colors.bgCard,
    borderRadius: radius.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  insightsTitle: {
    fontSize: 8, fontWeight: '800', color: colors.textMuted,
    letterSpacing: 2, marginBottom: spacing.sm,
  },
  insightRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm, marginBottom: 6 },
  insightDot: {
    width: 6, height: 6, borderRadius: 3,
    backgroundColor: colors.cyan,
    marginTop: 5, flexShrink: 0,
  },
  insightText: { flex: 1, fontSize: 12, color: colors.textSecondary, lineHeight: 18, letterSpacing: 0.1 },

  // ── Listing recs card
  recsCard: {
    marginHorizontal: spacing.lg,
    marginBottom: spacing.md,
    backgroundColor: colors.bgElevated,
    borderRadius: radius.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.cyanBorder,
  },
  recsTitle: {
    fontSize: 8, fontWeight: '800', color: colors.textMuted,
    letterSpacing: 2, marginBottom: 4,
  },
  recsHint: {
    fontSize: 11, color: colors.textMuted, lineHeight: 16,
    letterSpacing: 0.1, marginBottom: spacing.sm,
  },
  recRow: {
    flexDirection: 'row', alignItems: 'center',
    gap: spacing.sm, paddingVertical: 5,
    borderTopWidth: 1, borderTopColor: colors.border,
  },
  recLabel: {
    fontSize: 8, fontWeight: '800', letterSpacing: 1.2,
    width: 60, flexShrink: 0,
  },
  recKw: {
    flex: 1, fontSize: 12.5, color: colors.textPrimary,
    fontWeight: '600', letterSpacing: 0.1,
  },

  // ── Cluster section
  clusterWrap: {
    marginHorizontal: spacing.lg,
    marginBottom: spacing.md,
    backgroundColor: colors.bgCard,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  clusterHeader: {
    borderLeftWidth: 3,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    backgroundColor: colors.bgElevated,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  clusterHeaderLeft: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginBottom: 3 },
  clusterName: { fontSize: 9, fontWeight: '800', letterSpacing: 1.8 },
  clusterCount: {
    borderRadius: radius.full, paddingHorizontal: 6, paddingVertical: 1,
  },
  clusterCountText: { fontSize: 9, fontWeight: '800' },
  clusterDesc: { fontSize: 11, color: colors.textMuted, lineHeight: 15, letterSpacing: 0.1 },

  // ── Keyword card (inside cluster)
  kwCard: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
  },
  kwDivider: { height: 1, backgroundColor: colors.border, marginHorizontal: spacing.md },
  kwTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  kwText: { fontSize: 13.5, fontWeight: '600', color: colors.textPrimary, lineHeight: 18, marginBottom: 6 },
  kwBottom: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  typePill: {
    borderWidth: 1, borderRadius: radius.full,
    paddingHorizontal: 7, paddingVertical: 2,
  },
  typePillText: { fontSize: 9, fontWeight: '700', letterSpacing: 0.5 },
  usageRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 4 },
  usageBadge: {
    borderWidth: 1, borderRadius: 3,
    paddingHorizontal: 5, paddingVertical: 1,
  },
  usageBadgeText: { fontSize: 8, fontWeight: '700', letterSpacing: 0.3 },
  compLabel: { fontSize: 9, fontWeight: '700' },

  // ── Empty state
  empty: { alignItems: 'center', paddingTop: 80, gap: spacing.xs, paddingHorizontal: spacing.lg },
  emptyIcon:  { fontSize: 48, color: colors.textMuted, marginBottom: spacing.sm },
  emptyTitle: { fontSize: 20, fontWeight: '800', color: colors.textPrimary, letterSpacing: -0.5 },
  emptyText:  { fontSize: 14, color: colors.textSecondary, textAlign: 'center', lineHeight: 22, marginTop: 4 },
});
