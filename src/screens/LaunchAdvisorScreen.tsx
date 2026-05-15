import React, { useState, useEffect } from 'react';
import {
  ScrollView, StyleSheet, View, Text, TouchableOpacity,
  TextInput, ActivityIndicator, Share,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { CompositeNavigationProp } from '@react-navigation/native';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import type { StackNavigationProp } from '@react-navigation/stack';
import type { RootStackParamList } from '../navigation/RootNavigator';
import { AppCard, DS } from '../components/ds';
import { AppHeader } from '../components/AppHeader';
import { useAuth } from '../hooks/useAuth';
import { api } from '../services/api';
import { useVault } from '../hooks/useVault';
import { useSubscription } from '../hooks/useSubscription';
import PaywallModal from '../components/PaywallModal';
import type { VaultEntry } from '../types/vault';
import { STORAGE_KEYS } from '../constants/storage';
import type { TabParamList } from '../navigation/tabTypes';
import type { LaunchAdvisorSnapshot } from '../lib/launchDecision';
import { scheduleStreakReminder } from '../lib/notifications';
import { useBuilderSession } from '../hooks/useBuilderSession';
import type { WinnerEntry } from '../types/builder';

// ── Navigation ────────────────────────────────────────────────────────────────

type NavProp = CompositeNavigationProp<
  BottomTabNavigationProp<TabParamList>,
  StackNavigationProp<RootStackParamList>
>;

// ── Data constants ─────────────────────────────────────────────────────────────

const STREAK_KEY = '@siftly_streak_v1';

const DAILY_INSIGHTS: { text: string; tag: string }[] = [
  { text: 'Products priced $18–35 hit the FBA sweet spot — high enough margin, low enough for impulse buying.', tag: 'Pricing' },
  { text: 'The #1 signal of an enterable niche: top 3 competitors with under 500 reviews and no dominant brand.', tag: 'Research' },
  { text: 'Sea freight saves ~40% over air on orders above 200 kg. Most first-timers overpay on their first shipment.', tag: 'Logistics' },
  { text: 'A+ Content increases listing conversion by 3–10% on average. It\'s free with Brand Registry.', tag: 'Listing' },
  { text: 'Never negotiate on price alone. Ask for better MOQ, faster sampling, or pre-applied FNSKU labels.', tag: 'Sourcing' },
  { text: 'Run Sponsored Products Auto for 2 weeks before touching keywords. Let Amazon\'s algorithm do discovery first.', tag: 'PPC' },
  { text: 'Products with 50–300 reviews in the top 10 are your green light — proven demand, beatable competition.', tag: 'Research' },
  { text: 'Your first product doesn\'t need to be perfect. It needs to be validatable. Keep unit cost under $8.', tag: 'Strategy' },
  { text: 'Pet Supplies, Home & Kitchen, and Sports are the top 3 FBA categories for first-time sellers by volume.', tag: 'Market' },
  { text: 'A 30%+ net margin after all fees is your minimum threshold. Below that, you\'re working for Amazon.', tag: 'Profit' },
  { text: 'Outdoor and fitness products spike Q1 every year. Source in November to ride the January demand wave.', tag: 'Seasonal' },
  { text: 'Google Trends + Amazon autocomplete + BSR under 100k = the three-signal validation method.', tag: 'Validation' },
  { text: 'Use Request a Review on every single order. It\'s compliant, free, and the safest review strategy available.', tag: 'Reviews' },
  { text: 'Bundle 2–3 complementary accessories to escape pure price competition. Bundles are harder to copy and command 20–40% premiums.', tag: 'Strategy' },
  { text: 'The referral fee is the single largest cost most sellers underestimate — always calculate it as a % of the actual selling price, not your target.', tag: 'Profit' },
  { text: 'Alibaba Trade Assurance orders give you dispute resolution if quality doesn\'t match the sample. Always use it.', tag: 'Sourcing' },
  { text: 'A 4.2-star rating with 80 reviews will outsell a 4.8-star with 10 reviews. Social proof volume beats perfection.', tag: 'Reviews' },
  { text: 'Your main image is the only thing that decides if someone clicks. Test it against a competitor thumbnail before ordering inventory.', tag: 'Listing' },
  { text: 'LTL (less than truckload) becomes cheaper than parcel shipping at around 200 lbs. Know your break-even weight before booking.', tag: 'Logistics' },
  { text: 'An 8–10 week lead time is standard in China. Order samples at week 0, confirm by week 3, start production by week 4.', tag: 'Sourcing' },
  { text: 'The 5-star keyword trick: mine competitor reviews for exact phrases customers use, then embed them in your bullet points.', tag: 'Listing' },
  { text: 'Broad match PPC campaigns discover keywords. Exact match campaigns profit from them. Run both simultaneously.', tag: 'PPC' },
  { text: 'Your ACoS target should be no higher than your net margin. If margin is 30%, ACoS above 30% means you\'re paying to break even.', tag: 'PPC' },
  { text: 'Duty rates vary dramatically by HS code. A 1-digit misclassification can cost you 15–25% extra on every shipment.', tag: 'Logistics' },
  { text: 'MOQ is a negotiation starting point, not a fixed number. Most Alibaba suppliers will drop to 50% of stated MOQ for a first order.', tag: 'Sourcing' },
  { text: 'Brand Registry is not just for IP protection — it unlocks Sponsored Brands, A+ Content, and the Brand Analytics dashboard.', tag: 'Brand' },
  { text: 'Seasonal BSR spikes are misleading. Validate demand across 12 months using Jungle Scout or Helium 10 before sourcing.', tag: 'Research' },
  { text: 'FBA storage fees spike in Q4 (Oct–Dec). Clear slow-moving inventory before October or the fees will eat your margins.', tag: 'Logistics' },
  { text: 'The best time to improve your listing is when you have no reviews yet. Optimise title, bullets, and A+ before the first sale.', tag: 'Listing' },
  { text: 'A product with 1,000 reviews and 4.1 stars is beatable. A product with 200 reviews and 4.7 stars is not — customers trust the rating more than the volume at that scale.', tag: 'Research' },
  { text: 'Cash flow kills more FBA businesses than bad products. Model your reorder point before you place your first order.', tag: 'Strategy' },
];


const MEDALS = ['🥇', '🥈', '🥉'];

// ── Helpers ───────────────────────────────────────────────────────────────────

async function loadOrUpdateStreak(): Promise<number> {
  try {
    const today = new Date().toISOString().split('T')[0];
    const raw = await AsyncStorage.getItem(STREAK_KEY);
    if (!raw) {
      await AsyncStorage.setItem(STREAK_KEY, JSON.stringify({ count: 1, lastDate: today }));
      return 1;
    }
    const { count, lastDate } = JSON.parse(raw) as { count: number; lastDate: string };
    if (lastDate === today) return count;
    const yesterday = new Date(Date.now() - 86_400_000).toISOString().split('T')[0];
    const newCount = lastDate === yesterday ? count + 1 : 1;
    await AsyncStorage.setItem(STREAK_KEY, JSON.stringify({ count: newCount, lastDate: today }));
    return newCount;
  } catch {
    return 1;
  }
}

function verdictColor(verdict: string): string {
  const v = verdict.toUpperCase();
  if (v === 'LAUNCH') return DS.success;
  if (v === 'TEST' || v === 'TEST FIRST') return DS.warning;
  return DS.danger;
}

function verdictBg(verdict: string): string {
  const v = verdict.toUpperCase();
  if (v === 'LAUNCH') return DS.successBg;
  if (v === 'TEST' || v === 'TEST FIRST') return DS.warningBg;
  return DS.dangerBg;
}

function deriveFirstName(email: string | null | undefined): string {
  if (!email) return 'Founder';
  const local = email.split('@')[0];
  const first = local.split(/[._]/)[0];
  return first.charAt(0).toUpperCase() + first.slice(1);
}

function getEntryScore(e: VaultEntry): number {
  if (e.analysis?.metrics?.margin != null) return e.analysis.metrics.margin;
  if (e.analysis?.confidence != null) return e.analysis.confidence;
  const v = e.analysis?.verdict?.toUpperCase();
  if (v === 'LAUNCH') return 70;
  if (v === 'TEST' || v === 'TEST FIRST') return 40;
  return 10;
}

// ── GreetingHeader ────────────────────────────────────────────────────────────

function GreetingHeader({ firstName, streak }: { firstName: string; streak: number }) {
  const hour   = new Date().getHours();
  const greet  = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  const dateStr = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });

  return (
    <View style={gh.row}>
      <View style={{ flex: 1 }}>
        <Text style={gh.name}>{greet}, {firstName}</Text>
        <Text style={gh.date}>{dateStr}</Text>
      </View>
      <View style={gh.pill}>
        <Text style={gh.fire}>🔥</Text>
        <Text style={gh.streakNum}>{streak}</Text>
        <Text style={gh.streakLabel}> day{streak !== 1 ? 's' : ''}</Text>
      </View>
    </View>
  );
}

const gh = StyleSheet.create({
  row:       { flexDirection: 'row', alignItems: 'center', gap: 12 },
  name:      { fontSize: 22, fontWeight: '900', color: DS.textPrimary, letterSpacing: -0.6 },
  date:      { fontSize: 12, color: DS.textSecondary, marginTop: 2 },
  pill:      { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFF7ED', borderRadius: 20, borderWidth: 1, borderColor: '#FED7AA', paddingHorizontal: 10, paddingVertical: 6 },
  fire:      { fontSize: 14 },
  streakNum: { fontSize: 14, fontWeight: '900', color: '#EA580C', marginLeft: 4 },
  streakLabel:{ fontSize: 11, color: '#EA580C', fontWeight: '600' },
});

// ── TopProductHero ────────────────────────────────────────────────────────────

function TopProductHero({ entries, nav }: { entries: VaultEntry[]; nav: NavProp }) {
  const top = entries[0] ?? null;

  if (!top) {
    return (
      <TouchableOpacity style={ph.emptyCard} onPress={() => nav.navigate('Search')} activeOpacity={0.88}>
        <View style={ph.emptyBand} />
        <View style={ph.emptyBody}>
          <Text style={ph.emptyEyebrow}>YOUR NEXT PRODUCT</Text>
          <Text style={ph.emptyTitle}>What would you sell?</Text>
          <Text style={ph.emptySub}>
            Search any product idea, ASIN, or Amazon URL to get your first opportunity score.
          </Text>
          <View style={ph.fakeSearch}>
            <Text style={ph.fakePlaceholder}>e.g. "silicone spatula set"…</Text>
            <View style={ph.fakeBtn}>
              <Text style={ph.fakeBtnIcon}>◎</Text>
            </View>
          </View>
        </View>
      </TouchableOpacity>
    );
  }

  const { analysis, product } = top;
  const verdict    = analysis?.verdict ?? 'TEST';
  const vc         = verdictColor(verdict);
  const vbg        = verdictBg(verdict);
  const margin     = analysis?.metrics?.margin;
  const confidence = analysis?.confidence;

  return (
    <View style={ph.card}>
      <View style={[ph.band, { backgroundColor: vc }]} />
      <View style={ph.inner}>
        <Text style={ph.eyebrow}>TOP PRODUCT PICK</Text>
        <Text style={ph.title} numberOfLines={2}>{product.title}</Text>
        <View style={ph.statsRow}>
          <View style={[ph.verdictBadge, { backgroundColor: vbg }]}>
            <Text style={[ph.verdictText, { color: vc }]}>{verdict}</Text>
          </View>
          {product.price != null && (
            <View style={ph.stat}>
              <Text style={ph.statVal}>${typeof product.price === 'number' ? product.price.toFixed(2) : product.price}</Text>
              <Text style={ph.statLabel}>AMAZON</Text>
            </View>
          )}
          {margin != null && (
            <View style={ph.stat}>
              <Text style={ph.statVal}>{margin.toFixed(0)}%</Text>
              <Text style={ph.statLabel}>MARGIN</Text>
            </View>
          )}
          {confidence != null && (
            <View style={ph.stat}>
              <Text style={ph.statVal}>{confidence}%</Text>
              <Text style={ph.statLabel}>AI SCORE</Text>
            </View>
          )}
        </View>
        <TouchableOpacity
          style={[ph.ctaRow, { backgroundColor: vc + '18', borderColor: vc + '40' }]}
          onPress={() => nav.navigate('Search')}
          activeOpacity={0.8}
        >
          <Text style={[ph.ctaText, { color: vc }]}>Open in Research</Text>
          <Text style={[ph.ctaArrow, { color: vc }]}>›</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const ph = StyleSheet.create({
  card:          { backgroundColor: DS.bgCard, borderRadius: 18, borderWidth: 1, borderColor: DS.border, overflow: 'hidden' },
  band:          { height: 4 },
  inner:         { padding: 16, gap: 12 },
  eyebrow:       { fontSize: 8, fontWeight: '800', color: DS.textMuted, letterSpacing: 2 },
  title:         { fontSize: 16, fontWeight: '800', color: DS.textPrimary, letterSpacing: -0.4, lineHeight: 22 },
  statsRow:      { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  verdictBadge:  { borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 },
  verdictText:   { fontSize: 10, fontWeight: '900', letterSpacing: 0.5 },
  stat:          { backgroundColor: DS.bgSubtle, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6, alignItems: 'center' },
  statVal:       { fontSize: 13, fontWeight: '900', color: DS.textPrimary, letterSpacing: -0.3 },
  statLabel:     { fontSize: 7, fontWeight: '700', color: DS.textMuted, letterSpacing: 1.5, marginTop: 1 },
  ctaRow:        { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderRadius: 10, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 9 },
  ctaText:       { fontSize: 12, fontWeight: '800' },
  ctaArrow:      { fontSize: 18, fontWeight: '300', lineHeight: 22 },
  // empty
  emptyCard:     { backgroundColor: DS.bgCard, borderRadius: 18, borderWidth: 1, borderColor: DS.border, overflow: 'hidden' },
  emptyBand:     { height: 4, backgroundColor: DS.accent },
  emptyBody:     { padding: 16, gap: 10 },
  emptyEyebrow:  { fontSize: 8, fontWeight: '800', color: DS.accent, letterSpacing: 2 },
  emptyTitle:    { fontSize: 22, fontWeight: '900', color: DS.textPrimary, letterSpacing: -0.7 },
  emptySub:      { fontSize: 13, color: DS.textSecondary, lineHeight: 19 },
  fakeSearch:    { flexDirection: 'row', alignItems: 'center', backgroundColor: DS.bgSubtle, borderRadius: 12, borderWidth: 1, borderColor: DS.border, paddingLeft: 14, paddingRight: 6, paddingVertical: 6, marginTop: 4, gap: 8 },
  fakePlaceholder:{ flex: 1, fontSize: 13, color: DS.textMuted },
  fakeBtn:       { width: 34, height: 34, borderRadius: 10, backgroundColor: DS.accent, alignItems: 'center', justifyContent: 'center' },
  fakeBtnIcon:   { fontSize: 15, color: '#fff' },
});

// ── DailyInsightCard ──────────────────────────────────────────────────────────

// Tags to prioritise based on product competition level
const COMPETITION_TAG_PRIORITY: Record<string, string[]> = {
  Low:    ['Strategy', 'Pricing', 'Listing', 'Brand'],
  Medium: ['Research', 'Validation', 'PPC', 'Listing'],
  High:   ['PPC', 'Strategy', 'Reviews', 'Pricing'],
};

function pickInsight(competition?: string): { text: string; tag: string } {
  const dayIdx = Math.floor(Date.now() / 86_400_000);
  if (competition && COMPETITION_TAG_PRIORITY[competition]) {
    const preferredTags = COMPETITION_TAG_PRIORITY[competition];
    const filtered = DAILY_INSIGHTS.filter(i => preferredTags.includes(i.tag));
    if (filtered.length > 0) return filtered[dayIdx % filtered.length];
  }
  return DAILY_INSIGHTS[dayIdx % DAILY_INSIGHTS.length];
}

function DailyInsightCard({ productName, competition }: { productName?: string; competition?: string }) {
  const { text: defaultText, tag: defaultTag } = pickInsight(competition);

  const [aiText,    setAiText]    = useState('');
  const [aiLoading, setAiLoading] = useState(false);

  async function fetchPersonalized() {
    if (!productName || aiLoading) return;
    setAiLoading(true);
    try {
      const q = `Give me one specific, actionable FBA tip (2–3 sentences) for someone launching "${productName}" on Amazon. Be concrete, not generic.`;
      const res = await api.askAI(q);
      setAiText(res.answer);
    } catch { /* silently fall back to static insight */ }
    finally { setAiLoading(false); }
  }

  const text = aiText || defaultText;
  const tag  = aiText ? 'Personalized' : defaultTag;

  return (
    <View style={di.card}>
      <View style={di.band} />
      <View style={di.body}>
        <View style={di.topRow}>
          <Text style={di.eyebrow}>TODAY'S INSIGHT</Text>
          <View style={di.aiBadge}><Text style={di.aiBadgeText}>✦ AI</Text></View>
        </View>
        <Text style={di.text}>{text}</Text>
        <View style={di.footer}>
          <Text style={di.tag}># {tag}</Text>
          {productName && (
            <TouchableOpacity onPress={fetchPersonalized} disabled={aiLoading} activeOpacity={0.7}>
              {aiLoading
                ? <ActivityIndicator size="small" color={DS.accent} />
                : <Text style={di.personalizeBtn}>{aiText ? '↺ Refresh' : '✦ Personalize'}</Text>
              }
            </TouchableOpacity>
          )}
        </View>
      </View>
    </View>
  );
}

const di = StyleSheet.create({
  card:           { flexDirection: 'row', backgroundColor: DS.bgCard, borderRadius: 18, borderWidth: 1, borderColor: DS.border, overflow: 'hidden' },
  band:           { width: 4, backgroundColor: DS.accent },
  body:           { flex: 1, padding: 14, gap: 7 },
  topRow:         { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  eyebrow:        { fontSize: 8, fontWeight: '800', color: DS.accent, letterSpacing: 2.5 },
  aiBadge:        { backgroundColor: DS.indigoLight, borderRadius: 8, paddingHorizontal: 7, paddingVertical: 3 },
  aiBadgeText:    { fontSize: 8, fontWeight: '900', color: DS.indigo, letterSpacing: 1 },
  text:           { fontSize: 13, color: DS.textPrimary, lineHeight: 20, fontWeight: '500' },
  footer:         { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  tag:            { fontSize: 10, color: DS.textMuted, fontWeight: '600' },
  personalizeBtn: { fontSize: 11, fontWeight: '700', color: DS.accent },
});

// ── TrendingCard ──────────────────────────────────────────────────────────────

// ── VaultPipeline ─────────────────────────────────────────────────────────────

function VaultPipeline({ entries, nav }: { entries: VaultEntry[]; nav: NavProp }) {
  const launches = entries.filter(e => e.analysis?.verdict === 'LAUNCH').length;
  const tests    = entries.filter(e => {
    const v = e.analysis?.verdict?.toUpperCase();
    return v === 'TEST' || v === 'TEST FIRST';
  }).length;
  const avoids   = entries.filter(e => e.analysis?.verdict === 'AVOID').length;

  const stats = [
    { color: DS.success, count: launches, label: 'LAUNCH' },
    { color: DS.warning, count: tests,    label: 'TEST'   },
    { color: DS.danger,  count: avoids,   label: 'AVOID'  },
  ];

  return (
    <AppCard>
      <View style={vp.header}>
        <View>
          <Text style={vp.eyebrow}>YOUR PIPELINE</Text>
          <Text style={vp.count}>
            {entries.length === 0
              ? 'No products yet'
              : `${entries.length} product${entries.length !== 1 ? 's' : ''} saved`}
          </Text>
        </View>
        {entries.length > 0 && (
          <TouchableOpacity onPress={() => nav.navigate('Search')} activeOpacity={0.7}>
            <Text style={vp.viewAll}>View all ›</Text>
          </TouchableOpacity>
        )}
      </View>

      {entries.length === 0 ? (
        <>
          {([0.28, 0.16, 0.09] as number[]).map((opacity, i) => (
            <View key={i} style={[vp.ghostRow, { opacity }]}>
              <View style={vp.ghostDot} />
              <View style={[vp.ghostTitle, { width: `${78 - i * 14}%` as any }]} />
              <View style={vp.ghostBadge} />
            </View>
          ))}
          <TouchableOpacity onPress={() => nav.navigate('Search')} activeOpacity={0.8} style={{ marginTop: 10 }}>
            <Text style={vp.emptyHint}>Research products to fill your pipeline →</Text>
          </TouchableOpacity>
        </>
      ) : (
        <>
          <View style={vp.statsRow}>
            {stats.map((s, i) => (
              <React.Fragment key={s.label}>
                {i > 0 && <View style={vp.statDiv} />}
                <View style={vp.statItem}>
                  <View style={[vp.statDot, { backgroundColor: s.color }]} />
                  <Text style={[vp.statNum, { color: s.color }]}>{s.count}</Text>
                  <Text style={vp.statLabel}>{s.label}</Text>
                </View>
              </React.Fragment>
            ))}
          </View>
          {[...entries]
            .sort((a, b) => getEntryScore(b) - getEntryScore(a))
            .slice(0, 3)
            .map((e, i) => {
              const verdict  = e.analysis?.verdict;
              const vc       = verdict ? verdictColor(verdict) : DS.textMuted;
              const daysOld  = Math.floor((Date.now() - new Date(e.savedAt).getTime()) / 86_400_000);
              const isStale  = daysOld > 60;
              return (
                <TouchableOpacity
                  key={e.asin}
                  style={[vp.row, i > 0 && vp.rowBorder]}
                  onPress={() => nav.navigate('Search')}
                  activeOpacity={0.7}
                >
                  <Text style={vp.medal}>{MEDALS[i]}</Text>
                  <Text style={vp.rowTitle} numberOfLines={1}>{e.product.title}</Text>
                  {isStale && <Text style={vp.staleTag}>{daysOld}d</Text>}
                  {verdict && <Text style={[vp.rowVerdict, { color: vc }]}>{verdict}</Text>}
                </TouchableOpacity>
              );
            })}
        </>
      )}
    </AppCard>
  );
}

const vp = StyleSheet.create({
  header:    { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 12 },
  eyebrow:   { fontSize: 8, fontWeight: '800', color: DS.textMuted, letterSpacing: 2 },
  count:     { fontSize: 14, fontWeight: '800', color: DS.textPrimary, marginTop: 2 },
  viewAll:   { fontSize: 12, fontWeight: '700', color: DS.accent },
  ghostRow:  { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 10, borderTopWidth: 1, borderTopColor: DS.border },
  ghostDot:  { width: 8, height: 8, borderRadius: 4, backgroundColor: DS.border },
  ghostTitle:{ height: 12, borderRadius: 6, backgroundColor: DS.border },
  ghostBadge:{ width: 44, height: 18, borderRadius: 6, backgroundColor: DS.border },
  emptyHint: { fontSize: 12, color: DS.accent, fontWeight: '700', textAlign: 'center' },
  statsRow:  { flexDirection: 'row', backgroundColor: DS.bgSubtle, borderRadius: 12, borderWidth: 1, borderColor: DS.border, paddingVertical: 10, marginBottom: 12 },
  statItem:  { flex: 1, alignItems: 'center', gap: 3 },
  statDot:   { width: 8, height: 8, borderRadius: 4 },
  statNum:   { fontSize: 18, fontWeight: '900', letterSpacing: -0.5 },
  statLabel: { fontSize: 7, fontWeight: '700', color: DS.textMuted, letterSpacing: 1.5 },
  statDiv:   { width: 1, backgroundColor: DS.border },
  row:       { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 9 },
  rowBorder: { borderTopWidth: 1, borderTopColor: DS.border },
  medal:     { fontSize: 16, width: 24, textAlign: 'center' },
  rowTitle:  { flex: 1, fontSize: 13, color: DS.textPrimary, fontWeight: '600' },
  staleTag:  { fontSize: 8, fontWeight: '700', color: '#D97706', backgroundColor: '#FFFBEB', borderRadius: 5, paddingHorizontal: 5, paddingVertical: 2, overflow: 'hidden' },
  rowVerdict:{ fontSize: 9, fontWeight: '900', letterSpacing: 0.5 },
});

// ── ProfitCard ─────────────────────────────────────────────────────────────────

function ProfitCard({ nav, lastCalc }: { nav: NavProp; lastCalc: Record<string, unknown> | null }) {
  if (!lastCalc) {
    return (
      <AppCard>
        <Text style={pc.eyebrow}>LAST PROFIT CALCULATION</Text>
        <View style={pc.ghostRow}>
          {(['PROFIT/UNIT', 'MARGIN', 'ROI'] as const).map(label => (
            <View key={label} style={pc.ghostStat}>
              <View style={pc.ghostNum} />
              <Text style={pc.ghostLabel}>{label}</Text>
            </View>
          ))}
        </View>
        <TouchableOpacity style={pc.teaserBtn} onPress={() => nav.navigate('LaunchPad' as any)} activeOpacity={0.85}>
          <Text style={pc.teaserBtnText}>◈  Run your first calculation</Text>
        </TouchableOpacity>
      </AppCard>
    );
  }

  const profit  = typeof lastCalc.profit    === 'number' ? lastCalc.profit    : null;
  const margin  = typeof lastCalc.margin_pct === 'number' ? lastCalc.margin_pct : null;
  const roi     = typeof lastCalc.roi_pct    === 'number' ? lastCalc.roi_pct    : null;
  const verdict = typeof lastCalc.verdict    === 'string' ? lastCalc.verdict    : null;

  const stats = [
    { val: profit  != null ? `$${profit.toFixed(2)}`  : '—', label: 'PROFIT/UNIT', color: profit != null && profit >= 0 ? DS.accent : DS.danger },
    { val: margin  != null ? `${margin.toFixed(0)}%`  : '—', label: 'MARGIN',      color: margin != null ? (margin >= 30 ? DS.accent : margin >= 15 ? DS.warning : DS.danger) : DS.textMuted },
    { val: roi     != null ? `${roi.toFixed(0)}%`     : '—', label: 'ROI',         color: roi != null ? (roi >= 50 ? DS.accent : DS.warning) : DS.textMuted },
  ];

  return (
    <AppCard>
      <View style={pc.header}>
        <Text style={pc.eyebrow}>LAST PROFIT CALCULATION</Text>
        {verdict && (
          <View style={[pc.verdictBadge, { backgroundColor: verdictBg(verdict) }]}>
            <Text style={[pc.verdictText, { color: verdictColor(verdict) }]}>{verdict}</Text>
          </View>
        )}
      </View>
      <View style={pc.statsRow}>
        {stats.map(s => (
          <View key={s.label} style={pc.stat}>
            <Text style={[pc.statVal, { color: s.color }]}>{s.val}</Text>
            <Text style={pc.statLabel}>{s.label}</Text>
          </View>
        ))}
      </View>
      <TouchableOpacity style={pc.openBtn} onPress={() => nav.navigate('LaunchPad' as any)} activeOpacity={0.8}>
        <Text style={pc.openBtnText}>Open in Profit Lab</Text>
        <Text style={pc.openBtnArrow}>›</Text>
      </TouchableOpacity>
    </AppCard>
  );
}

const pc = StyleSheet.create({
  eyebrow:     { fontSize: 8, fontWeight: '800', color: DS.textMuted, letterSpacing: 2, marginBottom: 12 },
  header:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  verdictBadge:{ borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 },
  verdictText: { fontSize: 9, fontWeight: '900', letterSpacing: 0.5 },
  ghostRow:    { flexDirection: 'row', gap: 8, marginBottom: 12, opacity: 0.4 },
  ghostStat:   { flex: 1, backgroundColor: DS.bgSubtle, borderRadius: 12, borderWidth: 1, borderColor: DS.border, padding: 12, alignItems: 'center', gap: 8 },
  ghostNum:    { width: 48, height: 20, borderRadius: 8, backgroundColor: DS.border },
  ghostLabel:  { fontSize: 7, fontWeight: '700', color: DS.textMuted, letterSpacing: 1.5 },
  teaserBtn:   { backgroundColor: DS.indigo, borderRadius: 12, paddingVertical: 11, alignItems: 'center' },
  teaserBtnText:{ fontSize: 13, fontWeight: '800', color: '#fff' },
  statsRow:    { flexDirection: 'row', gap: 8, marginBottom: 12 },
  stat:        { flex: 1, backgroundColor: DS.bgSubtle, borderRadius: 12, borderWidth: 1, borderColor: DS.border, padding: 12, alignItems: 'center', gap: 3 },
  statVal:     { fontSize: 17, fontWeight: '900', letterSpacing: -0.5 },
  statLabel:   { fontSize: 7, fontWeight: '700', color: DS.textMuted, letterSpacing: 1.5 },
  openBtn:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: DS.bgSubtle, borderRadius: 10, borderWidth: 1, borderColor: DS.border, paddingHorizontal: 12, paddingVertical: 9 },
  openBtnText: { fontSize: 12, fontWeight: '700', color: DS.textSecondary },
  openBtnArrow:{ fontSize: 18, color: DS.textMuted, fontWeight: '300', lineHeight: 22 },
});


// ── AskCopilotCard ────────────────────────────────────────────────────────────

function AskCopilotCard({ locked }: { locked: boolean }) {
  const [question,    setQuestion]    = useState('');
  const [answer,      setAnswer]      = useState('');
  const [loading,     setLoading]     = useState(false);
  const [error,       setError]       = useState('');
  const [showPaywall, setShowPaywall] = useState(false);

  async function handleAsk() {
    const q = question.trim();
    if (!q) return;
    setLoading(true);
    setAnswer('');
    setError('');
    try {
      const res = await api.askAI(q);
      setAnswer(res.answer);
    } catch {
      setError('Could not get an answer. Try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <AppCard>
      <View style={cop.header}>
        <View style={cop.iconWrap}>
          <Text style={{ fontSize: 15 }}>✦</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={cop.heading}>Ask Co-Pilot</Text>
          <Text style={cop.sub}>Margins, sourcing, listings — ask anything.</Text>
        </View>
      </View>

      {locked ? (
        <TouchableOpacity style={cop.lockedBox} onPress={() => setShowPaywall(true)} activeOpacity={0.85}>
          <Text style={cop.lockedText}>✦ Unlock AI Co-Pilot — Builder & above</Text>
          <Text style={cop.lockedSub}>Ask unlimited FBA questions with context-aware answers.</Text>
          <View style={cop.lockedCta}><Text style={cop.lockedCtaTxt}>Upgrade to unlock →</Text></View>
        </TouchableOpacity>
      ) : (
        <>
          <View style={cop.inputRow}>
            <TextInput
              style={cop.input}
              value={question}
              onChangeText={setQuestion}
              placeholder="e.g. Is $4.50 supplier cost viable at $22 on Amazon?"
              placeholderTextColor={DS.textMuted}
              returnKeyType="send"
              onSubmitEditing={handleAsk}
              editable={!loading}
            />
            <TouchableOpacity
              style={[cop.sendBtn, (!question.trim() || loading) && cop.sendBtnOff]}
              onPress={handleAsk}
              disabled={!question.trim() || loading}
              activeOpacity={0.8}
            >
              {loading
                ? <ActivityIndicator size="small" color="#fff" />
                : <Text style={cop.sendIcon}>›</Text>
              }
            </TouchableOpacity>
          </View>
          {!!answer && (
            <View style={cop.answerBox}>
              <Text style={cop.answerLabel}>✦ CO-PILOT</Text>
              <Text style={cop.answerText}>{answer}</Text>
            </View>
          )}
          {!!error && <Text style={cop.error}>{error}</Text>}
        </>
      )}

      <PaywallModal
        visible={showPaywall}
        onClose={() => setShowPaywall(false)}
        featureContext="default"
        defaultTier="builder"
      />
    </AppCard>
  );
}

const cop = StyleSheet.create({
  header:     { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 },
  iconWrap:   { width: 36, height: 36, borderRadius: 10, backgroundColor: DS.indigoLight, alignItems: 'center', justifyContent: 'center' },
  heading:    { fontSize: 14, fontWeight: '800', color: DS.textPrimary, letterSpacing: -0.3 },
  sub:        { fontSize: 11, color: DS.textSecondary, marginTop: 1 },
  inputRow:   { flexDirection: 'row', gap: 8, alignItems: 'center' },
  input:      { flex: 1, backgroundColor: DS.bgSubtle, borderRadius: 12, borderWidth: 1, borderColor: DS.border, paddingHorizontal: 14, paddingVertical: 10, fontSize: 13, color: DS.textPrimary },
  sendBtn:    { width: 42, height: 42, borderRadius: 12, backgroundColor: DS.accent, alignItems: 'center', justifyContent: 'center' },
  sendBtnOff: { backgroundColor: DS.border },
  sendIcon:   { fontSize: 22, color: '#fff', fontWeight: '300', lineHeight: 26 },
  answerBox:  { marginTop: 12, backgroundColor: DS.infoBg, borderRadius: 12, borderWidth: 1, borderColor: DS.accent + '25', padding: 12, gap: 6 },
  answerLabel:{ fontSize: 8, fontWeight: '800', color: DS.accent, letterSpacing: 2 },
  answerText: { fontSize: 13, color: DS.textSecondary, lineHeight: 20 },
  error:      { marginTop: 8, fontSize: 12, color: DS.danger },
  lockedBox:  { backgroundColor: DS.bgSubtle, borderRadius: 12, borderWidth: 1, borderColor: DS.border, padding: 14, gap: 6 },
  lockedText: { fontSize: 13, fontWeight: '800', color: DS.textPrimary, letterSpacing: -0.2 },
  lockedSub:  { fontSize: 12, color: DS.textSecondary, lineHeight: 17 },
  lockedCta:  { backgroundColor: DS.accent, borderRadius: 10, paddingVertical: 9, alignItems: 'center', marginTop: 4 },
  lockedCtaTxt:{ fontSize: 13, fontWeight: '700', color: '#fff' },
});

// ── LaunchDecisionCard ────────────────────────────────────────────────────────

const DECISION_CFG: Record<string, { color: string; bg: string; label: string }> = {
  'GO':    { color: DS.success,  bg: DS.successBg,  label: 'GO'    },
  'TEST':  { color: DS.warning,  bg: DS.warningBg,  label: 'TEST'  },
  'WAIT':  { color: '#D97706',   bg: '#FFFBEB',     label: 'WAIT'  },
  'NO-GO': { color: DS.danger,   bg: DS.dangerBg,   label: 'NO-GO' },
};

async function shareSnapshot(snapshot: LaunchAdvisorSnapshot) {
  const d = snapshot.decision;
  const lines = [
    `Siftly Launch Advisor — ${d.decision}`,
    `Product: ${snapshot.productTitle}`,
    ``,
    d.summary,
    ``,
    `Readiness: ${snapshot.readiness.score}%   Risk: ${snapshot.riskScore}/100   Confidence: ${d.confidence}`,
    snapshot.checklistPct != null ? `Plan progress: ${snapshot.checklistPct}%` : '',
    ``,
    ...d.reasons.map(r => `• ${r}`),
  ].filter(Boolean).join('\n');
  try { await Share.share({ message: lines }); } catch { /* user dismissed */ }
}

function LaunchDecisionCard({ snapshot, nav }: { snapshot: LaunchAdvisorSnapshot | null; nav: NavProp }) {
  const cfg = snapshot ? (DECISION_CFG[snapshot.decision.decision] ?? DECISION_CFG['WAIT']) : null;

  const daysAgo = snapshot
    ? Math.floor((Date.now() - new Date(snapshot.computedAt).getTime()) / 86_400_000)
    : null;

  if (!snapshot) {
    return (
      <AppCard>
        <View style={ld.emptyRow}>
          <View style={ld.emptyIcon}><Text style={{ fontSize: 18 }}>⚖️</Text></View>
          <View style={{ flex: 1 }}>
            <Text style={ld.eyebrow}>LAUNCH ADVISOR</Text>
            <Text style={ld.emptyTitle}>No verdict yet</Text>
            <Text style={ld.emptySub}>
              Attach a product and supplier in the Feasibility Check to get your GO / NO-GO verdict.
            </Text>
          </View>
        </View>
        <TouchableOpacity style={ld.emptyBtn} onPress={() => nav.navigate('LaunchPad' as any)} activeOpacity={0.85}>
          <Text style={ld.emptyBtnTxt}>Open Feasibility Check →</Text>
        </TouchableOpacity>
      </AppCard>
    );
  }

  return (
    <AppCard style={{ gap: 0 }}>
      {/* header row */}
      <View style={ld.header}>
        <View style={{ flex: 1 }}>
          <Text style={ld.eyebrow}>LAUNCH ADVISOR</Text>
          <Text style={ld.productTitle} numberOfLines={1}>{snapshot.productTitle}</Text>
        </View>
        <View style={[ld.verdictBadge, { backgroundColor: cfg!.bg }]}>
          <Text style={[ld.verdictText, { color: cfg!.color }]}>{cfg!.label}</Text>
        </View>
      </View>

      {/* summary */}
      <Text style={ld.summary}>{snapshot.decision.summary}</Text>

      {/* top reason */}
      {snapshot.decision.reasons.length > 0 && (
        <View style={[ld.reasonBox, { borderLeftColor: cfg!.color }]}>
          <Text style={ld.reasonText}>{snapshot.decision.reasons[0]}</Text>
        </View>
      )}

      {/* stats row */}
      <View style={ld.statsRow}>
        <View style={ld.stat}>
          <Text style={[ld.statVal, { color: cfg!.color }]}>{snapshot.readiness.score}%</Text>
          <Text style={ld.statLabel}>READINESS</Text>
        </View>
        <View style={ld.statDiv} />
        <View style={ld.stat}>
          <Text style={[ld.statVal, { color: snapshot.riskScore >= 60 ? DS.danger : snapshot.riskScore >= 40 ? DS.warning : DS.success }]}>
            {snapshot.riskScore}
          </Text>
          <Text style={ld.statLabel}>RISK / 100</Text>
        </View>
        <View style={ld.statDiv} />
        {snapshot.checklistPct != null ? (
          <View style={ld.stat}>
            <Text style={ld.statVal}>{snapshot.checklistPct}%</Text>
            <Text style={ld.statLabel}>PLAN DONE</Text>
          </View>
        ) : (
          <View style={ld.stat}>
            <Text style={ld.statVal}>{snapshot.decision.confidence}</Text>
            <Text style={ld.statLabel}>CONFIDENCE</Text>
          </View>
        )}
      </View>

      {/* readiness bar */}
      <View style={ld.barTrack}>
        <View style={[ld.barFill, { width: `${snapshot.readiness.score}%` as any, backgroundColor: cfg!.color }]} />
      </View>

      {/* footer */}
      <View style={ld.footer}>
        {daysAgo != null && (
          <Text style={ld.age}>{daysAgo === 0 ? 'Updated today' : `Updated ${daysAgo}d ago`}</Text>
        )}
        <View style={ld.footerActions}>
          <TouchableOpacity onPress={() => shareSnapshot(snapshot)} activeOpacity={0.7} style={ld.shareBtn}>
            <Text style={ld.shareBtnTxt}>↑ Share</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => nav.navigate('LaunchPad' as any)} activeOpacity={0.7}>
            <Text style={ld.reviewLink}>Review ›</Text>
          </TouchableOpacity>
        </View>
      </View>
    </AppCard>
  );
}

const ld = StyleSheet.create({
  eyebrow:      { fontSize: 8, fontWeight: '800', color: DS.textMuted, letterSpacing: 2, marginBottom: 4 },
  header:       { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: 10 },
  productTitle: { fontSize: 13, fontWeight: '700', color: DS.textPrimary, letterSpacing: -0.2, flex: 1 },
  verdictBadge: { borderRadius: 10, paddingHorizontal: 12, paddingVertical: 6, alignSelf: 'flex-start' },
  verdictText:  { fontSize: 13, fontWeight: '900', letterSpacing: 0.5 },
  summary:      { fontSize: 13, color: DS.textSecondary, lineHeight: 19, marginBottom: 10 },
  reasonBox:    { borderLeftWidth: 3, paddingLeft: 10, marginBottom: 12 },
  reasonText:   { fontSize: 12, color: DS.textSecondary, lineHeight: 18, fontStyle: 'italic' },
  statsRow:     { flexDirection: 'row', backgroundColor: DS.bgSubtle, borderRadius: 12, borderWidth: 1, borderColor: DS.border, paddingVertical: 10, marginBottom: 10 },
  stat:         { flex: 1, alignItems: 'center', gap: 3 },
  statDiv:      { width: 1, backgroundColor: DS.border },
  statVal:      { fontSize: 17, fontWeight: '900', color: DS.textPrimary, letterSpacing: -0.5 },
  statLabel:    { fontSize: 7, fontWeight: '700', color: DS.textMuted, letterSpacing: 1.5 },
  barTrack:     { height: 5, backgroundColor: DS.bgSubtle, borderRadius: 3, overflow: 'hidden', marginBottom: 10 },
  barFill:      { height: 5, borderRadius: 3 },
  footer:       { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  age:          { fontSize: 10, color: DS.textMuted },
  footerActions:{ flexDirection: 'row', alignItems: 'center', gap: 12 },
  shareBtn:     { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8, borderWidth: 1, borderColor: DS.border, backgroundColor: DS.bgSubtle },
  shareBtnTxt:  { fontSize: 11, fontWeight: '700', color: DS.textSecondary },
  reviewLink:   { fontSize: 12, fontWeight: '700', color: DS.accent },
  // empty state
  emptyRow:     { flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginBottom: 14 },
  emptyIcon:    { width: 42, height: 42, borderRadius: 12, backgroundColor: DS.bgSubtle, borderWidth: 1, borderColor: DS.border, alignItems: 'center', justifyContent: 'center' },
  emptyTitle:   { fontSize: 15, fontWeight: '800', color: DS.textPrimary, letterSpacing: -0.3, marginTop: 2 },
  emptySub:     { fontSize: 12, color: DS.textSecondary, lineHeight: 17, marginTop: 3 },
  emptyBtn:     { backgroundColor: DS.bgSubtle, borderRadius: 11, borderWidth: 1, borderColor: DS.border, paddingVertical: 10, alignItems: 'center' },
  emptyBtnTxt:  { fontSize: 13, fontWeight: '700', color: DS.accent },
});

// ── OnboardingCard ────────────────────────────────────────────────────────────

const ONBOARD_STEPS = [
  { icon: '◎', label: 'Search',      desc: 'Find a product idea or ASIN',       tab: 'Search'    as const },
  { icon: '◈', label: 'Check',       desc: 'Run profit & feasibility numbers',   tab: 'LaunchPad' as const },
  { icon: '⚖️', label: 'Get verdict', desc: 'See your GO / NO-GO decision here',  tab: null },
];

function OnboardingCard({ nav }: { nav: NavProp }) {
  return (
    <View style={ob.card}>
      <View style={ob.band} />
      <View style={ob.body}>
        <Text style={ob.eyebrow}>GET STARTED</Text>
        <Text style={ob.title}>3 steps to your first verdict</Text>
        {ONBOARD_STEPS.map((step, i) => (
          <TouchableOpacity
            key={step.label}
            style={[ob.step, i < ONBOARD_STEPS.length - 1 && ob.stepBorder]}
            onPress={() => step.tab && nav.navigate(step.tab)}
            activeOpacity={step.tab ? 0.75 : 1}
          >
            <View style={ob.stepNum}><Text style={ob.stepNumTxt}>{i + 1}</Text></View>
            <View style={ob.stepIcon}><Text style={{ fontSize: 15 }}>{step.icon}</Text></View>
            <View style={{ flex: 1 }}>
              <Text style={ob.stepLabel}>{step.label}</Text>
              <Text style={ob.stepDesc}>{step.desc}</Text>
            </View>
            {step.tab && <Text style={ob.stepArrow}>›</Text>}
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

const ob = StyleSheet.create({
  card:        { flexDirection: 'row', backgroundColor: DS.bgCard, borderRadius: 18, borderWidth: 1, borderColor: DS.border, overflow: 'hidden' },
  band:        { width: 4, backgroundColor: DS.accent },
  body:        { flex: 1, padding: 16, gap: 2 },
  eyebrow:     { fontSize: 8, fontWeight: '800', color: DS.accent, letterSpacing: 2, marginBottom: 2 },
  title:       { fontSize: 16, fontWeight: '900', color: DS.textPrimary, letterSpacing: -0.4, marginBottom: 10 },
  step:        { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10 },
  stepBorder:  { borderBottomWidth: 1, borderBottomColor: DS.border },
  stepNum:     { width: 22, height: 22, borderRadius: 11, backgroundColor: DS.accent, alignItems: 'center', justifyContent: 'center' },
  stepNumTxt:  { fontSize: 10, fontWeight: '900', color: '#fff' },
  stepIcon:    { width: 32, height: 32, borderRadius: 9, backgroundColor: DS.bgSubtle, borderWidth: 1, borderColor: DS.border, alignItems: 'center', justifyContent: 'center' },
  stepLabel:   { fontSize: 13, fontWeight: '800', color: DS.textPrimary, letterSpacing: -0.2 },
  stepDesc:    { fontSize: 11, color: DS.textSecondary, marginTop: 1 },
  stepArrow:   { fontSize: 20, color: DS.textMuted, fontWeight: '300' },
});

// ── Winner Vault card ─────────────────────────────────────────────────────────

function WinnerVaultCard({ vault, nav }: { vault: WinnerEntry[]; nav: NavProp }) {
  if (vault.length === 0) return null;
  return (
    <AppCard padding={0} style={wv.card}>
      <View style={wv.header}>
        <Text style={wv.trophy}>🏆</Text>
        <View style={{ flex: 1 }}>
          <Text style={wv.eyebrow}>WINNER VAULT</Text>
          <Text style={wv.title}>{vault.length} product{vault.length !== 1 ? 's' : ''} ready to launch</Text>
        </View>
      </View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={wv.scroll}
      >
        {vault.map((entry, i) => (
          <View key={entry.sessionId + i} style={wv.winnerCard}>
            <Text style={wv.winnerBrand}>{entry.brandName}</Text>
            <Text style={wv.winnerProduct} numberOfLines={2}>{entry.productTitle}</Text>
            <View style={wv.winnerStats}>
              <View style={wv.statBlock}>
                <Text style={wv.statLabel}>MARGIN</Text>
                <Text style={wv.statValue}>{entry.marginPct}%</Text>
              </View>
              <View style={wv.statBlock}>
                <Text style={wv.statLabel}>EST. MONTHLY</Text>
                <Text style={wv.statValue}>${entry.monthlyProfitEst.toLocaleString()}</Text>
              </View>
            </View>
            <Text style={wv.winnerMeta}>{entry.freightMode} · {entry.supplierName}</Text>
          </View>
        ))}
      </ScrollView>
    </AppCard>
  );
}

const wv = StyleSheet.create({
  card:    { overflow: 'hidden', gap: 0 },
  header:  { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingTop: 16, paddingBottom: 12 },
  trophy:  { fontSize: 24 },
  eyebrow: { fontSize: 9, fontWeight: '800', color: '#92400E', letterSpacing: 2 },
  title:   { fontSize: 15, fontWeight: '800', color: DS.textPrimary, letterSpacing: -0.3 },
  scroll:  { paddingHorizontal: 16, paddingBottom: 16, gap: 10 },
  winnerCard: {
    width: 200, backgroundColor: '#FFFBEB', borderRadius: 14, borderWidth: 1.5,
    borderColor: '#D97706' + '40', padding: 14, gap: 6,
  },
  winnerBrand:  { fontSize: 9, fontWeight: '800', color: '#92400E', letterSpacing: 2 },
  winnerProduct:{ fontSize: 13, fontWeight: '700', color: DS.textPrimary, lineHeight: 18 },
  winnerStats:  { flexDirection: 'row', gap: 16, marginTop: 4 },
  statBlock:    { gap: 2 },
  statLabel:    { fontSize: 8, fontWeight: '700', color: '#78350F', letterSpacing: 1.5 },
  statValue:    { fontSize: 18, fontWeight: '900', color: '#059669', letterSpacing: -0.5 },
  winnerMeta:   { fontSize: 10, color: '#78350F', marginTop: 2 },
});

// ── Screen ────────────────────────────────────────────────────────────────────

export default function LaunchAdvisorScreen() {
  const nav         = useNavigation<NavProp>();
  const { entries, vaultLoaded } = useVault();
  const { user }    = useAuth();
  const { can }     = useSubscription();
  const { vault: winnerVault } = useBuilderSession();

  const firstName = user?.user_metadata?.full_name?.split(' ')[0]
    ?? user?.user_metadata?.name?.split(' ')[0]
    ?? deriveFirstName(user?.email);

  const [streak,   setStreak]   = useState(1);
  const [lastCalc, setLastCalc] = useState<Record<string, unknown> | null>(null);
  const [snapshot, setSnapshot] = useState<LaunchAdvisorSnapshot | null>(null);

  useEffect(() => {
    (async () => {
      const s = await loadOrUpdateStreak();
      setStreak(s);
      scheduleStreakReminder(s);

      try {
        const [calcRaw, snapRaw, clRaw] = await Promise.all([
          AsyncStorage.getItem(STORAGE_KEYS.savedCalculations),
          AsyncStorage.getItem(STORAGE_KEYS.launchAdvisorSnapshot),
          AsyncStorage.getItem(STORAGE_KEYS.launchChecklist),
        ]);
        if (calcRaw) {
          const calcs = JSON.parse(calcRaw) as unknown[];
          if (Array.isArray(calcs) && calcs.length > 0) {
            setLastCalc(calcs[calcs.length - 1] as Record<string, unknown>);
          }
        }
        if (snapRaw) {
          const snap = JSON.parse(snapRaw) as LaunchAdvisorSnapshot;
          // Hydrate checklistPct from live storage so the card is never stale
          if (clRaw) {
            try {
              const ids: string[] = JSON.parse(clRaw);
              const { ALL_IDS } = await import('../data/launchPhases');
              snap.checklistPct = ALL_IDS.length > 0
                ? Math.round((ids.length / ALL_IDS.length) * 100)
                : 0;
            } catch { /* keep stored value */ }
          }
          setSnapshot(snap);
        }
      } catch {}
    })();
  }, []);

  const isFirstRun = vaultLoaded && entries.length === 0 && !lastCalc && !snapshot;

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <AppHeader helpKey="advisor" />
      <ScrollView
        style={s.scroll}
        contentContainerStyle={s.content}
        showsVerticalScrollIndicator={false}
      >
        <GreetingHeader firstName={firstName} streak={streak} />
        <WinnerVaultCard vault={winnerVault} nav={nav} />
        {isFirstRun ? (
          <OnboardingCard nav={nav} />
        ) : (
          <TopProductHero entries={entries} nav={nav} />
        )}
        <LaunchDecisionCard snapshot={snapshot} nav={nav} />
        <DailyInsightCard
          productName={snapshot?.productTitle}
          competition={snapshot?.decision?.decision === 'GO' ? 'Low' : snapshot?.riskLevel === 'High' ? 'High' : 'Medium'}
        />
        {!isFirstRun && <VaultPipeline entries={entries} nav={nav} />}
        <ProfitCard nav={nav} lastCalc={lastCalc} />
        <AskCopilotCard locked={!can('copilot')} />
        <View style={{ height: 20 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe:    { flex: 1, backgroundColor: DS.bgCanvas },
  scroll:  { flex: 1 },
  content: { paddingHorizontal: DS.pagePadding, paddingTop: 16, paddingBottom: 80, gap: 12 },
});
