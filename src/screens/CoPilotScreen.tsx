import React, { useState, useCallback } from 'react';
import {
  ScrollView, StyleSheet, View, Text, TouchableOpacity, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  AppCard,
  SectionHeader,
  StatusBadge,
  InputField,
  PrimaryButton,
  DS,
} from '../components/ds';
import { api } from '../services/api';
import { useVault } from '../hooks/useVault';
import { VaultEntry } from '../types/vault';

// ── Static mock data ──────────────────────────────────────────────────────────

const OPPORTUNITY_METRICS = [
  { label: 'Demand',           value: 'High',   color: DS.accent,  bg: DS.accentLight },
  { label: 'Competition',      value: 'Medium', color: DS.warning,  bg: DS.warningBg   },
  { label: 'Differentiation',  value: 'Good',   color: DS.indigo,  bg: DS.indigoLight },
  { label: 'Risk Level',       value: 'Medium', color: DS.warning,  bg: DS.warningBg   },
];

const SWOT = {
  strengths: [
    'High search volume with rising trend',
    'Proven supplier network in Yiwu',
  ],
  weaknesses: [
    'Low brand recognition at launch',
    'Thin margin if freight spikes',
  ],
  opportunities: [
    'Growing eco-conscious buyer segment',
    'Bundle potential with accessories',
  ],
  threats: [
    'Chinese competitors with lower prices',
    'Amazon algorithm changes in Q4',
  ],
};

interface ActionItem {
  id:          string;
  icon:        string;
  priority:    'High' | 'Medium' | 'Low';
  label:       string;
  description: string;
  done:        boolean;
}

const INITIAL_ACTIONS: ActionItem[] = [
  {
    id: 'moq',  icon: '🏭', priority: 'High',
    label:       'Validate supplier MOQ',
    description: 'Confirm minimum order quantity fits your budget.',
    done: false,
  },
  {
    id: 'freight', icon: '🚢', priority: 'High',
    label:       'Confirm freight estimate',
    description: 'Get a firm quote for sea freight from your supplier.',
    done: false,
  },
  {
    id: 'images', icon: '📸', priority: 'Medium',
    label:       'Improve product images',
    description: 'High-quality hero shots increase conversion by 30%.',
    done: false,
  },
  {
    id: 'checklist', icon: '✓', priority: 'Medium',
    label:       'Prepare launch checklist',
    description: 'Complete all pre-launch tasks before going live.',
    done: false,
  },
  {
    id: 'pricing', icon: '💰', priority: 'Low',
    label:       'Review pricing strategy',
    description: 'Test a penetration price point in week one.',
    done: false,
  },
];

const SUGGESTED_PROMPTS = [
  'Is this product worth launching?',
  'What are the biggest risks?',
  'How can I improve profit?',
  'What should I do next?',
];

const RECENT_INSIGHTS = [
  {
    id: 'pricing',
    icon:    '💰',
    color:   DS.accent,
    bg:      DS.accentLight,
    tag:     'Pricing',
    title:   'Price at $24.49 to stay competitive',
    body:    'Competitors cluster between $22–$27. $24.49 wins the buy box without margin sacrifice.',
    time:    '2 min ago',
  },
  {
    id: 'supplier',
    icon:    '🏭',
    color:   DS.indigo,
    bg:      DS.indigoLight,
    tag:     'Supplier',
    title:   'Zhejiang supplier has 98% on-time rate',
    body:    'Factory audit shows consistent quality. Request 3 samples before bulk order.',
    time:    '8 min ago',
  },
  {
    id: 'launch',
    icon:    '↑',
    color:   '#7C3AED',
    bg:      '#F5F0FF',
    tag:     'Launch',
    title:   'Q2 window closes in 6 weeks',
    body:    'Order inventory now to hit the pre-summer sales spike for kitchen products.',
    time:    '15 min ago',
  },
];

// ── Confidence ring (simple arc treatment without SVG) ────────────────────────

function ConfidenceRing({ score }: { score: number }) {
  return (
    <View style={cr.wrap}>
      <View style={cr.ring}>
        <View style={cr.inner}>
          <Text style={cr.score}>{score}%</Text>
          <Text style={cr.scoreLabel}>confidence</Text>
        </View>
      </View>
      {/* Arc fill approximated with a tinted border */}
      <View
        style={[
          cr.arcFill,
          { borderColor: DS.indigo, borderTopColor: DS.indigoLight },
        ]}
      />
    </View>
  );
}

const cr = StyleSheet.create({
  wrap: { width: 80, height: 80, alignItems: 'center', justifyContent: 'center' },
  ring: {
    position:        'absolute',
    width:           80,
    height:          80,
    borderRadius:    40,
    borderWidth:     7,
    borderColor:     DS.indigoLight,
    alignItems:      'center',
    justifyContent:  'center',
  },
  inner:      { alignItems: 'center', gap: 1 },
  score:      { fontSize: 17, fontWeight: '900', color: DS.indigo, letterSpacing: -0.5 },
  scoreLabel: { fontSize: 7,  fontWeight: '700', color: DS.textMuted, textTransform: 'uppercase', letterSpacing: 0.5 },
  // Overlay that tints the filled portion
  arcFill: {
    position:    'absolute',
    width:       80,
    height:      80,
    borderRadius: 40,
    borderWidth:  7,
    transform:   [{ rotate: '-30deg' }],
  },
});

// ── Advisor Summary card ──────────────────────────────────────────────────────

function AdvisorSummaryCard() {
  return (
    <AppCard style={as.card}>
      <View style={as.top}>
        <View style={as.left}>
          <StatusBadge label="Ready to Launch" variant="success" dot />
          <Text style={as.summaryText}>
            Your current product has strong margin potential, moderate competition,
            and a clear supplier path.
          </Text>
          <View style={as.scoreRow}>
            <Text style={as.scoreLabel}>AI Confidence</Text>
            <View style={as.scoreBar}>
              <View style={as.scoreBarFill} />
            </View>
            <Text style={as.scorePct}>91%</Text>
          </View>
        </View>
        <ConfidenceRing score={91} />
      </View>

      <View style={as.footer}>
        <View style={as.footerItem}>
          <Text style={as.footerIcon}>🧠</Text>
          <Text style={as.footerText}>Based on 14 data points</Text>
        </View>
        <View style={as.footerDot} />
        <View style={as.footerItem}>
          <Text style={as.footerIcon}>⏱</Text>
          <Text style={as.footerText}>Updated just now</Text>
        </View>
      </View>
    </AppCard>
  );
}

const as = StyleSheet.create({
  card:     { gap: 18 },
  top:      { flexDirection: 'row', gap: 14, alignItems: 'flex-start' },
  left:     { flex: 1, gap: 12 },
  summaryText: {
    fontSize: 13, color: DS.textSecondary, lineHeight: 20,
  },
  scoreRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  scoreLabel: { fontSize: 10, fontWeight: '700', color: DS.textMuted, width: 76 },
  scoreBar: {
    flex: 1, height: 5, borderRadius: 3,
    backgroundColor: DS.indigoLight, overflow: 'hidden',
  },
  scoreBarFill: {
    width: '91%', height: '100%', borderRadius: 3,
    backgroundColor: DS.indigo,
  },
  scorePct: { fontSize: 11, fontWeight: '800', color: DS.indigo, width: 28 },
  footer: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: DS.bgSubtle, borderRadius: 12, padding: 12, gap: 10,
  },
  footerItem:  { flexDirection: 'row', alignItems: 'center', gap: 5, flex: 1 },
  footerIcon:  { fontSize: 13 },
  footerText:  { fontSize: 11, color: DS.textSecondary, fontWeight: '500' },
  footerDot:   { width: 4, height: 4, borderRadius: 2, backgroundColor: DS.border },
});

// ── Opportunity Analysis card ─────────────────────────────────────────────────

function OpportunityAnalysisCard() {
  return (
    <AppCard style={oa.card}>
      <View style={oa.header}>
        <View style={oa.headerIcon}>
          <Text style={oa.headerGlyph}>◎</Text>
        </View>
        <View style={oa.headerText}>
          <Text style={oa.headerTitle}>Opportunity Analysis</Text>
          <Text style={oa.headerSub}>garlic press — Siftly AI</Text>
        </View>
        <View style={oa.scoreTile}>
          <Text style={oa.scoreNum}>8.7</Text>
          <Text style={oa.scoreDen}>/10</Text>
        </View>
      </View>

      <View style={oa.grid}>
        {OPPORTUNITY_METRICS.map(m => (
          <View key={m.label} style={[oa.tile, { backgroundColor: m.bg }]}>
            <Text style={[oa.tileValue, { color: m.color }]}>{m.value}</Text>
            <Text style={oa.tileLabel}>{m.label}</Text>
          </View>
        ))}
      </View>
    </AppCard>
  );
}

const oa = StyleSheet.create({
  card:       { gap: 16 },
  header:     { flexDirection: 'row', alignItems: 'center', gap: 10 },
  headerIcon: {
    width: 36, height: 36, borderRadius: 11,
    backgroundColor: DS.indigoLight,
    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  headerGlyph: { fontSize: 18, color: DS.indigo },
  headerText:  { flex: 1 },
  headerTitle: { fontSize: 15, fontWeight: '800', color: DS.textPrimary, letterSpacing: -0.3 },
  headerSub:   { fontSize: 11, color: DS.textMuted, marginTop: 1 },
  scoreTile: {
    flexDirection: 'row', alignItems: 'flex-end',
    backgroundColor: DS.indigoLight, borderRadius: 12,
    paddingHorizontal: 10, paddingVertical: 6,
  },
  scoreNum: { fontSize: 22, fontWeight: '900', color: DS.indigo, letterSpacing: -0.8 },
  scoreDen: { fontSize: 12, fontWeight: '700', color: DS.indigo, marginBottom: 2, opacity: 0.7 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  tile: {
    width: '47%', borderRadius: 14,
    paddingVertical: 12, paddingHorizontal: 14,
    gap: 4,
  },
  tileValue: { fontSize: 16, fontWeight: '900', letterSpacing: -0.3 },
  tileLabel: { fontSize: 10, fontWeight: '600', color: DS.textSecondary },
});

// ── SWOT Analysis card ────────────────────────────────────────────────────────

const SWOT_CONFIG = [
  { key: 'strengths',    label: 'Strengths',     icon: '↑', color: DS.accentDark, bg: DS.accentLight,  items: SWOT.strengths     },
  { key: 'weaknesses',   label: 'Weaknesses',    icon: '↓', color: DS.dangerText, bg: DS.dangerBg,     items: SWOT.weaknesses    },
  { key: 'opportunities',label: 'Opportunities', icon: '◎', color: DS.indigo,     bg: DS.indigoLight,  items: SWOT.opportunities },
  { key: 'threats',      label: 'Threats',       icon: '⚠', color: DS.warningText,bg: DS.warningBg,    items: SWOT.threats       },
];

function SwotCard() {
  return (
    <AppCard style={sw.card}>
      <View style={sw.header}>
        <View style={sw.headerIcon}>
          <Text style={sw.headerGlyph}>⊞</Text>
        </View>
        <Text style={sw.headerTitle}>SWOT Analysis</Text>
      </View>

      <View style={sw.grid}>
        {SWOT_CONFIG.map(q => (
          <View key={q.key} style={[sw.quadrant, { backgroundColor: q.bg }]}>
            <View style={sw.quadLabel}>
              <Text style={[sw.quadIcon, { color: q.color }]}>{q.icon}</Text>
              <Text style={[sw.quadTitle, { color: q.color }]}>{q.label}</Text>
            </View>
            {q.items.map((item, i) => (
              <View key={i} style={sw.bullet}>
                <View style={[sw.dot, { backgroundColor: q.color }]} />
                <Text style={sw.bulletText}>{item}</Text>
              </View>
            ))}
          </View>
        ))}
      </View>
    </AppCard>
  );
}

const sw = StyleSheet.create({
  card:       { gap: 16 },
  header:     { flexDirection: 'row', alignItems: 'center', gap: 10 },
  headerIcon: {
    width: 32, height: 32, borderRadius: 10,
    backgroundColor: DS.indigoLight,
    alignItems: 'center', justifyContent: 'center',
  },
  headerGlyph: { fontSize: 16, color: DS.indigo },
  headerTitle: { fontSize: 15, fontWeight: '800', color: DS.textPrimary, letterSpacing: -0.3 },
  grid:        { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  quadrant: {
    width: '47%', borderRadius: 16, padding: 14, gap: 8,
  },
  quadLabel:  { flexDirection: 'row', alignItems: 'center', gap: 5 },
  quadIcon:   { fontSize: 12, fontWeight: '800' },
  quadTitle:  { fontSize: 11, fontWeight: '800', letterSpacing: 0.3 },
  bullet:     { flexDirection: 'row', alignItems: 'flex-start', gap: 6 },
  dot: {
    width: 5, height: 5, borderRadius: 3, marginTop: 5, flexShrink: 0,
  },
  bulletText: { fontSize: 11, color: DS.textSecondary, lineHeight: 17, flex: 1 },
});

// ── Next Actions card ─────────────────────────────────────────────────────────

const PRIORITY_CONFIG: Record<ActionItem['priority'], { color: string; bg: string }> = {
  High:   { color: DS.dangerText, bg: DS.dangerBg   },
  Medium: { color: DS.warningText, bg: DS.warningBg },
  Low:    { color: DS.neutralText, bg: DS.neutralBg  },
};

function NextActionsCard() {
  const [actions, setActions] = useState<ActionItem[]>(INITIAL_ACTIONS);

  function toggle(id: string) {
    setActions(prev =>
      prev.map(a => (a.id === id ? { ...a, done: !a.done } : a)),
    );
  }

  const done  = actions.filter(a => a.done).length;
  const total = actions.length;

  return (
    <AppCard style={na.card}>
      <View style={na.header}>
        <View style={na.headerIcon}>
          <Text style={na.headerGlyph}>✓</Text>
        </View>
        <View style={na.headerRight}>
          <Text style={na.headerTitle}>Recommended Next Actions</Text>
          <Text style={na.progress}>{done}/{total} completed</Text>
        </View>
      </View>

      {/* Mini progress bar */}
      <View style={na.progressBar}>
        <View style={[na.progressFill, { width: `${(done / total) * 100}%` }]} />
      </View>

      <View style={na.rows}>
        {actions.map((action, i) => {
          const pri = PRIORITY_CONFIG[action.priority];
          return (
            <TouchableOpacity
              key={action.id}
              style={[na.row, i < actions.length - 1 && na.rowBorder, action.done && na.rowDone]}
              onPress={() => toggle(action.id)}
              activeOpacity={0.75}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: action.done }}
            >
              {/* Check circle */}
              <View style={[na.check, action.done && na.checkDone]}>
                {action.done && <Text style={na.checkMark}>✓</Text>}
              </View>

              {/* Icon */}
              <View style={na.actionIcon}>
                <Text style={na.actionEmoji}>{action.icon}</Text>
              </View>

              {/* Text */}
              <View style={na.actionText}>
                <Text style={[na.actionLabel, action.done && na.actionLabelDone]}>
                  {action.label}
                </Text>
                <Text style={na.actionDesc} numberOfLines={1}>
                  {action.description}
                </Text>
              </View>

              {/* Priority badge */}
              <View style={[na.priBadge, { backgroundColor: pri.bg }]}>
                <Text style={[na.priText, { color: pri.color }]}>
                  {action.priority}
                </Text>
              </View>
            </TouchableOpacity>
          );
        })}
      </View>
    </AppCard>
  );
}

const na = StyleSheet.create({
  card:        { gap: 14 },
  header:      { flexDirection: 'row', alignItems: 'center', gap: 10 },
  headerIcon: {
    width: 32, height: 32, borderRadius: 10,
    backgroundColor: DS.accentLight,
    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  headerGlyph: { fontSize: 16, color: DS.accent },
  headerRight: { flex: 1 },
  headerTitle: { fontSize: 15, fontWeight: '800', color: DS.textPrimary, letterSpacing: -0.3 },
  progress:    { fontSize: 11, color: DS.textMuted, marginTop: 1 },
  progressBar: {
    height: 4, borderRadius: 2, backgroundColor: DS.border, overflow: 'hidden',
  },
  progressFill: {
    height: '100%', borderRadius: 2, backgroundColor: DS.accent,
  },
  rows:         { gap: 0 },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingVertical: 12,
  },
  rowBorder:    { borderBottomWidth: 1, borderBottomColor: DS.borderLight },
  rowDone:      { opacity: 0.55 },
  check: {
    width: 20, height: 20, borderRadius: 10,
    borderWidth: 1.5, borderColor: DS.border,
    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  checkDone:    { backgroundColor: DS.accent, borderColor: DS.accent },
  checkMark:    { fontSize: 10, color: '#fff', fontWeight: '900' },
  actionIcon: {
    width: 32, height: 32, borderRadius: 9,
    backgroundColor: DS.bgSubtle,
    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  actionEmoji:  { fontSize: 14 },
  actionText:   { flex: 1 },
  actionLabel:  { fontSize: 13, fontWeight: '700', color: DS.textPrimary },
  actionLabelDone: { textDecorationLine: 'line-through', color: DS.textMuted },
  actionDesc:   { fontSize: 11, color: DS.textMuted, marginTop: 1 },
  priBadge: {
    borderRadius: DS.radiusBadge, paddingHorizontal: 8, paddingVertical: 3, flexShrink: 0,
  },
  priText: { fontSize: 9, fontWeight: '800', letterSpacing: 0.3 },
});

// ── AI response card ──────────────────────────────────────────────────────────

interface CopilotResponse {
  verdict:    string;
  confidence: number;
  summary:    string;
  top_risks:  string[];
  launch_strategy: string;
  estimated_monthly_profit: number;
}

function CopilotResponseCard({ response }: { response: CopilotResponse }) {
  const verdictColor = response.verdict === 'Launch' ? DS.accent
    : response.verdict === 'Avoid' ? DS.danger : DS.warning;
  const verdictVariant: 'success' | 'warning' | 'danger' =
    response.verdict === 'Launch' ? 'success' : response.verdict === 'Avoid' ? 'danger' : 'warning';

  return (
    <AppCard style={{ gap: 14 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: DS.indigoLight, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ fontSize: 18, color: DS.indigo }}>⊛</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 13, fontWeight: '800', color: DS.textPrimary }}>Co-Pilot Response</Text>
          <Text style={{ fontSize: 10, color: DS.textMuted }}>Powered by Siftly AI</Text>
        </View>
        <StatusBadge label={response.verdict} variant={verdictVariant} dot />
      </View>

      {/* Confidence */}
      <View style={{ gap: 6 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          <Text style={{ fontSize: 11, fontWeight: '700', color: DS.textMuted, textTransform: 'uppercase', letterSpacing: 0.8 }}>Confidence</Text>
          <Text style={{ fontSize: 12, fontWeight: '800', color: verdictColor }}>{response.confidence}%</Text>
        </View>
        <View style={{ height: 4, backgroundColor: DS.border, borderRadius: 2 }}>
          <View style={{ height: 4, width: `${response.confidence}%` as any, backgroundColor: verdictColor, borderRadius: 2 }} />
        </View>
      </View>

      {/* Summary */}
      <Text style={{ fontSize: 13, color: DS.textSecondary, lineHeight: 20 }}>{response.summary}</Text>

      {/* Risks */}
      {response.top_risks.length > 0 && (
        <View style={{ backgroundColor: DS.warningBg, borderRadius: 12, padding: 12, gap: 6 }}>
          <Text style={{ fontSize: 9, fontWeight: '800', color: DS.warning, letterSpacing: 2 }}>TOP RISKS</Text>
          {response.top_risks.slice(0, 3).map((r, i) => (
            <Text key={i} style={{ fontSize: 12, color: DS.textSecondary, lineHeight: 18 }}>• {r}</Text>
          ))}
        </View>
      )}

      {/* Launch strategy */}
      {response.launch_strategy && (
        <View style={{ backgroundColor: DS.accentLight, borderRadius: 12, padding: 12, gap: 4 }}>
          <Text style={{ fontSize: 9, fontWeight: '800', color: DS.accentDark, letterSpacing: 2 }}>LAUNCH STRATEGY</Text>
          <Text style={{ fontSize: 12, color: DS.textSecondary, lineHeight: 18 }}>{response.launch_strategy}</Text>
        </View>
      )}

      <Text style={{ fontSize: 11, color: DS.textMuted, textAlign: 'center' }}>
        Est. monthly profit: ${response.estimated_monthly_profit.toLocaleString()}
      </Text>
    </AppCard>
  );
}

// ── Ask Co-Pilot card ─────────────────────────────────────────────────────────

interface AskCoPilotCardProps {
  onResponse:      (r: CopilotResponse) => void;
  productContext?: VaultEntry | null;
}

function AskCoPilotCard({ onResponse, productContext }: AskCoPilotCardProps) {
  const [query,    setQuery]    = useState('');
  const [selected, setSelected] = useState<string | null>(null);
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState('');

  function selectPrompt(p: string) {
    setSelected(p);
    setQuery(p);
    setError('');
  }

  const handleAsk = useCallback(async () => {
    const q = query.trim();
    if (!q) return;
    setLoading(true);
    setError('');
    try {
      let product_name:    string;
      let amazon_price:    number;
      let supplier_price:  number;
      let review_count:    number;
      let competition:     string;
      let trend_direction: string;

      if (productContext) {
        // Use saved vault product for full context
        const p = productContext.product;
        const a = productContext.analysis;
        product_name   = p.title;
        amazon_price   = p.price ?? 25;
        supplier_price = a?.metrics.price ? a.metrics.price * 0.22 : amazon_price * 0.22;
        review_count   = p.review_count ?? 0;
        competition    = p.competition;
        trend_direction = a?.metrics.trend ?? 'Stable';
      } else {
        // Fallback: extract hints from the typed query
        const priceMatch = q.match(/\$(\d+(?:\.\d+)?)/);
        product_name   = q;
        amazon_price   = priceMatch ? parseFloat(priceMatch[1]) : 25;
        supplier_price = amazon_price * 0.22;
        review_count   = 0;
        competition    = 'Unknown';
        trend_direction = 'Stable';
      }

      const result = await api.analyzeCopilot({
        product_name,
        amazon_price,
        supplier_price,
        review_count,
        trend_direction,
        competition,
        category: 'general',
      });
      onResponse(result);
      setQuery('');
      setSelected(null);
    } catch (err: any) {
      setError(err?.message ?? 'Co-Pilot is unavailable. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [query, onResponse, productContext]);

  return (
    <AppCard style={ac.card}>
      {/* Header */}
      <View style={ac.header}>
        <View style={ac.avatar}>
          <Text style={ac.avatarGlyph}>⊛</Text>
        </View>
        <View>
          <Text style={ac.headerTitle}>Ask Co-Pilot</Text>
          <Text style={ac.headerSub}>Powered by Siftly AI</Text>
        </View>
        <StatusBadge label={loading ? 'Thinking...' : 'Online'} variant={loading ? 'warning' : 'success'} dot />
      </View>

      {/* Product context chip — shown when vault product is available */}
      {productContext && (
        <View style={ac.contextChip}>
          <Text style={ac.contextChipIcon}>✦</Text>
          <Text style={ac.contextChipText} numberOfLines={1}>
            Using context: {productContext.product.title}
          </Text>
        </View>
      )}

      {/* Suggested prompts */}
      <View style={ac.promptsWrap}>
        <Text style={ac.promptsLabel}>Suggested questions</Text>
        <View style={ac.prompts}>
          {SUGGESTED_PROMPTS.map(p => {
            const active = selected === p;
            return (
              <TouchableOpacity
                key={p}
                style={[ac.prompt, active && ac.promptActive]}
                onPress={() => selectPrompt(p)}
                activeOpacity={0.75}
                accessibilityRole="button"
              >
                <Text style={[ac.promptText, active && ac.promptTextActive]}>{p}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {/* Input */}
      <InputField
        value={query}
        onChangeText={v => { setQuery(v); setSelected(null); setError(''); }}
        placeholder="Ask about your product, supplier, pricing, or launch..."
        leadingIcon="⊛"
        multiline
        numberOfLines={3}
        returnKeyType="send"
      />

      {error !== '' && (
        <View style={{ backgroundColor: DS.dangerBg, borderRadius: 10, padding: 10 }}>
          <Text style={{ fontSize: 12, color: DS.dangerText }}>{error}</Text>
        </View>
      )}

      <PrimaryButton
        label={loading ? 'Asking Co-Pilot...' : 'Ask Co-Pilot'}
        onPress={handleAsk}
        icon="⊛"
        disabled={query.trim().length === 0}
        loading={loading}
      />
    </AppCard>
  );
}

const ac = StyleSheet.create({
  card:         { gap: 18 },
  header:       { flexDirection: 'row', alignItems: 'center', gap: 10 },
  avatar: {
    width: 40, height: 40, borderRadius: 12,
    backgroundColor: DS.indigoLight,
    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  avatarGlyph:  { fontSize: 20, color: DS.indigo },
  headerTitle:  { fontSize: 15, fontWeight: '800', color: DS.textPrimary, letterSpacing: -0.3 },
  headerSub:    { fontSize: 11, color: DS.textMuted, marginTop: 1 },
  promptsWrap:  { gap: 8 },
  promptsLabel: { fontSize: 11, fontWeight: '700', color: DS.textMuted, textTransform: 'uppercase', letterSpacing: 0.8 },
  prompts:      { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  prompt: {
    borderWidth:       1,
    borderColor:       DS.border,
    borderRadius:      DS.radiusBadge,
    paddingHorizontal: 12,
    paddingVertical:   7,
    backgroundColor:   DS.bgSubtle,
  },
  promptActive: {
    borderColor:     DS.indigo,
    backgroundColor: DS.indigoLight,
  },
  promptText:       { fontSize: 12, fontWeight: '500', color: DS.textSecondary },
  promptTextActive: { color: DS.indigo, fontWeight: '700' },

  contextChip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: DS.accentLight, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8,
  },
  contextChipIcon: { fontSize: 11, color: DS.accent },
  contextChipText: { fontSize: 12, fontWeight: '600', color: DS.accentDark, flex: 1 },
});

// ── Recent Insights section ───────────────────────────────────────────────────

const InsightCard = React.memo(function InsightCard({ item }: { item: typeof RECENT_INSIGHTS[number] }) {
  return (
    <AppCard padding={16} radius={18} style={ic.card}>
      <View style={ic.top}>
        <View style={[ic.iconWrap, { backgroundColor: item.bg }]}>
          <Text style={[ic.icon, { color: item.color }]}>{item.icon}</Text>
        </View>
        <View style={ic.meta}>
          <View style={[ic.tag, { backgroundColor: item.bg }]}>
            <Text style={[ic.tagText, { color: item.color }]}>{item.tag}</Text>
          </View>
          <Text style={ic.time}>{item.time}</Text>
        </View>
      </View>
      <Text style={ic.title}>{item.title}</Text>
      <Text style={ic.body} numberOfLines={3}>{item.body}</Text>
    </AppCard>
  );
});

const ic = StyleSheet.create({
  card:    { gap: 10 },
  top:     { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 },
  iconWrap: {
    width: 36, height: 36, borderRadius: 11,
    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  icon:     { fontSize: 16, fontWeight: '800' },
  meta:     { flex: 1, alignItems: 'flex-end', gap: 4 },
  tag: {
    borderRadius: DS.radiusBadge, paddingHorizontal: 8, paddingVertical: 3,
  },
  tagText:  { fontSize: 9, fontWeight: '800', letterSpacing: 0.4 },
  time:     { fontSize: 10, color: DS.textMuted },
  title:    { fontSize: 13, fontWeight: '800', color: DS.textPrimary, letterSpacing: -0.3, lineHeight: 19 },
  body:     { fontSize: 12, color: DS.textSecondary, lineHeight: 18 },
});

// ── Screen ────────────────────────────────────────────────────────────────────

export default function CoPilotScreen() {
  const vault = useVault();
  const productContext = vault.entries[0] ?? null;
  const [copilotResponse, setCopilotResponse] = useState<CopilotResponse | null>(null);

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      {/* ── Pinned header ─────────────────────────────────── */}
      <View style={s.header}>
        <Text style={s.eyebrow}>AI CO-PILOT</Text>
        <Text style={s.heroTitle}>Your FBA Launch Advisor</Text>
        <Text style={s.heroSub}>
          Get product insights, risk warnings, and next-step recommendations.
        </Text>
      </View>

      <ScrollView
        style={s.scroll}
        contentContainerStyle={s.content}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Advisor summary */}
        <AdvisorSummaryCard />

        {/* Opportunity analysis */}
        <SectionHeader title="Opportunity Analysis" style={s.sectionHead} />
        <OpportunityAnalysisCard />

        {/* SWOT */}
        <SectionHeader title="SWOT Analysis" style={s.sectionHead} />
        <SwotCard />

        {/* Next actions */}
        <SectionHeader
          title="Recommended Actions"
          subtitle="Tap to mark complete"
          style={s.sectionHead}
        />
        <NextActionsCard />

        {/* Ask Co-Pilot */}
        <SectionHeader title="Ask Co-Pilot" style={s.sectionHead} />
        <AskCoPilotCard onResponse={setCopilotResponse} productContext={productContext} />

        {/* Co-Pilot response — shown after a successful ask */}
        {copilotResponse !== null && (
          <CopilotResponseCard response={copilotResponse} />
        )}

        {/* Recent insights */}
        <SectionHeader
          title="Recent AI Insights"
          actionLabel="View All"
          onAction={() => {}}
          style={s.sectionHead}
        />
        {RECENT_INSIGHTS.map(item => (
          <InsightCard key={item.id} item={item} />
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: DS.bgCanvas },

  header: {
    paddingHorizontal: DS.pagePadding,
    paddingTop:        16,
    paddingBottom:     14,
    backgroundColor:   DS.bgCard,
    borderBottomWidth: 1,
    borderBottomColor: DS.border,
    gap:               3,
  },
  eyebrow: {
    fontSize: 9, fontWeight: '800', color: DS.indigo,
    letterSpacing: 2.5,
  },
  heroTitle: {
    fontSize: 22, fontWeight: '900', color: DS.textPrimary, letterSpacing: -0.7,
  },
  heroSub: {
    fontSize: 13, color: DS.textSecondary, lineHeight: 18,
  },

  scroll:  { flex: 1 },
  content: {
    paddingHorizontal: DS.pagePadding,
    paddingTop:        DS.sectionGap,
    paddingBottom:     80,
    gap:               DS.sectionGap,
  },
  sectionHead: { marginBottom: -8 },
});
