import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  ScrollView, TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { colors, typography, spacing, radius } from '../theme';

type Mode = 'checklist' | 'ideas';

// ─── Checklist data ───────────────────────────────────────────────────────────
const CHECKLIST = [
  {
    category: 'PRODUCT VALIDATION',
    emoji: '🔍',
    items: [
      { id: 'p1', text: 'Research product with 3+ demand signals (search volume, trends, BSR)' },
      { id: 'p2', text: 'Verify profit margin > 30% after all fees and shipping' },
      { id: 'p3', text: 'Confirm top 3 competitors have < 1,000 reviews' },
      { id: 'p4', text: 'Check product is not restricted, hazmat, or seasonal only' },
      { id: 'p5', text: 'Order samples from 2–3 suppliers and test quality' },
    ],
  },
  {
    category: 'SUPPLIER & SOURCING',
    emoji: '🏭',
    items: [
      { id: 's1', text: 'Approve final sample — check packaging and labelling' },
      { id: 's2', text: 'Negotiate MOQ, price per unit, and lead time' },
      { id: 's3', text: 'Get sea and air freight quotes, choose shipping method' },
      { id: 's4', text: 'Place production order and pay deposit' },
      { id: 's5', text: 'Confirm production timeline with supplier' },
    ],
  },
  {
    category: 'BRAND & ACCOUNT',
    emoji: '🏷️',
    items: [
      { id: 'b1', text: 'Choose brand name and create logo' },
      { id: 'b2', text: 'Register Amazon Seller Central (Professional plan — $39.99/mo)' },
      { id: 'b3', text: 'Complete tax interview and add bank account' },
      { id: 'b4', text: 'Purchase GS1 UPC barcode for your product' },
      { id: 'b5', text: 'Apply for Amazon Brand Registry (needs trademark)' },
    ],
  },
  {
    category: 'LISTING CREATION',
    emoji: '📝',
    items: [
      { id: 'l1', text: 'Create product ASIN in Seller Central' },
      { id: 'l2', text: 'Write keyword-optimised title (150–200 chars)' },
      { id: 'l3', text: 'Write 5 benefit-focused bullet points' },
      { id: 'l4', text: 'Write A+ product description' },
      { id: 'l5', text: 'Upload 7+ professional images (white background required for main)' },
      { id: 'l6', text: 'Add backend search keywords (249 bytes max)' },
    ],
  },
  {
    category: 'SHIPPING TO AMAZON',
    emoji: '📦',
    items: [
      { id: 'sh1', text: 'Create FBA inbound shipment plan in Seller Central' },
      { id: 'sh2', text: 'Print and apply FNSKU labels to each unit' },
      { id: 'sh3', text: 'Print box content labels and ship to Amazon warehouse' },
      { id: 'sh4', text: 'Track shipment and confirm inventory received' },
    ],
  },
  {
    category: 'LAUNCH',
    emoji: '🚀',
    items: [
      { id: 'la1', text: 'Set a competitive launch price (not the cheapest — mid-range)' },
      { id: 'la2', text: 'Launch Sponsored Products auto campaign ($20–30/day)' },
      { id: 'la3', text: 'Send product to 5–10 people for honest verified reviews' },
      { id: 'la4', text: 'Use "Request a Review" button on every order' },
      { id: 'la5', text: 'Monitor daily: sessions, conversion rate, ACoS, inventory' },
      { id: 'la6', text: 'After 2 weeks: mine search term report and add manual campaigns' },
    ],
  },
];

const STORAGE_KEY = 'fba_launch_checklist';
const ALL_IDS = CHECKLIST.flatMap(c => c.items.map(i => i.id));

function ChecklistMode() {
  const [checked, setChecked] = useState<Set<string>>(new Set());

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then(val => {
      if (val) { try { setChecked(new Set(JSON.parse(val))); } catch { /* corrupt data — start fresh */ } }
    });
  }, []);

  async function toggle(id: string) {
    const next = new Set(checked);
    next.has(id) ? next.delete(id) : next.add(id);
    setChecked(next);
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify([...next]));
  }

  async function reset() {
    setChecked(new Set());
    await AsyncStorage.removeItem(STORAGE_KEY);
  }

  const total = ALL_IDS.length;
  const done = checked.size;
  const pct = Math.round((done / total) * 100);
  const progressColor = pct === 100 ? colors.green : pct >= 50 ? colors.amber : colors.cyan;

  return (
    <ScrollView contentContainerStyle={cl.scroll} showsVerticalScrollIndicator={false}>
      {/* Guide hint */}
      <Text style={cl.guideHint}>Work through each phase in order — methodical execution is the most reliable path to a successful launch.</Text>

      {/* Progress */}
      <View style={cl.progressCard}>
        <View style={cl.progressTop}>
          <View>
            <Text style={cl.progressPct}>{pct}%</Text>
            <Text style={cl.progressSub}>{done}/{total} steps complete</Text>
          </View>
          <TouchableOpacity style={cl.resetBtn} onPress={reset}>
            <Text style={cl.resetText}>Reset</Text>
          </TouchableOpacity>
        </View>
        <View style={cl.progressBar}>
          <View style={[cl.progressFill, { width: `${pct}%` as any, backgroundColor: progressColor }]} />
        </View>
      </View>

      {CHECKLIST.map(section => {
        const sectionDone = section.items.filter(i => checked.has(i.id)).length;
        return (
          <View key={section.category} style={cl.section}>
            <View style={cl.sectionHeader}>
              <Text style={cl.sectionEmoji}>{section.emoji}</Text>
              <Text style={cl.sectionTitle}>{section.category}</Text>
              <Text style={cl.sectionCount}>{sectionDone}/{section.items.length}</Text>
            </View>
            {section.items.map(item => {
              const done = checked.has(item.id);
              return (
                <TouchableOpacity
                  key={item.id}
                  style={[cl.item, done && cl.itemDone]}
                  onPress={() => toggle(item.id)}
                  activeOpacity={0.7}
                >
                  <View style={[cl.checkbox, done && cl.checkboxDone]}>
                    {done && <Text style={cl.checkmark}>✓</Text>}
                  </View>
                  <Text style={[cl.itemText, done && cl.itemTextDone]}>{item.text}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        );
      })}
    </ScrollView>
  );
}

// ─── Product Ideas data ───────────────────────────────────────────────────────
const IDEAS = [
  { name: 'Resistance Bands Set', cat: 'Sports', price: '$20–$35', margin: '50%', comp: 'Medium', weight: 'Light', budget: 800, trend: true, why: 'Home fitness boom, high margin, lightweight to ship' },
  { name: 'Silicone Baby Feeding Set', cat: 'Baby', price: '$25–$40', margin: '42%', comp: 'Low', weight: 'Light', budget: 1200, trend: true, why: 'Parents spend freely, gift market, repeat buyers' },
  { name: 'Reusable Produce Bags', cat: 'Kitchen', price: '$12–$22', margin: '58%', comp: 'Low', weight: 'Light', budget: 500, trend: true, why: 'Eco trend, very cheap to source, repeat purchases' },
  { name: 'Dog Grooming Glove', cat: 'Pet', price: '$12–$25', margin: '55%', comp: 'Low', weight: 'Light', budget: 600, trend: true, why: 'Pet market growing fast, low returns, gift-worthy' },
  { name: 'Desk Cable Organizer', cat: 'Office', price: '$15–$28', margin: '50%', comp: 'Low', weight: 'Light', budget: 700, trend: true, why: 'WFH demand, cheap to source, simple differentiation' },
  { name: 'Electric Lint Remover', cat: 'Home', price: '$20–$38', margin: '48%', comp: 'Low', weight: 'Light', budget: 900, trend: true, why: 'TikTok viral product, high perceived value, impulse buy' },
  { name: 'Posture Corrector', cat: 'Health', price: '$25–$45', margin: '44%', comp: 'Medium', weight: 'Light', budget: 900, trend: true, why: 'WFH trend, high perceived value, easy to brand premium' },
  { name: 'Bamboo Cutting Board Set', cat: 'Kitchen', price: '$30–$55', margin: '38%', comp: 'Medium', weight: 'Medium', budget: 1500, trend: false, why: 'Evergreen demand, eco angle, great bundle potential' },
  { name: 'Silicone Ice Cube Molds', cat: 'Kitchen', price: '$12–$20', margin: '62%', comp: 'Low', weight: 'Light', budget: 500, trend: true, why: 'Craft cocktail trend, very cheap to source' },
  { name: 'Travel Packing Cubes', cat: 'Travel', price: '$22–$40', margin: '42%', comp: 'Medium', weight: 'Light', budget: 1000, trend: true, why: 'Travel rebound, bundle sets, loyal repeat customers' },
  { name: 'Knee Compression Sleeve', cat: 'Health', price: '$18–$35', margin: '46%', comp: 'Medium', weight: 'Light', budget: 800, trend: false, why: 'Aging population, sports recovery, year-round demand' },
  { name: 'Wooden Spice Rack', cat: 'Kitchen', price: '$30–$60', margin: '40%', comp: 'Low', weight: 'Medium', budget: 1500, trend: true, why: 'Home cooking trend, premium aesthetic, organics angle' },
  { name: 'Velvet Hangers 50-Pack', cat: 'Home', price: '$18–$30', margin: '52%', comp: 'Medium', weight: 'Medium', budget: 800, trend: false, why: 'Constant demand, high units per order, repeat buyer' },
  { name: 'Car Phone Holder', cat: 'Auto', price: '$15–$30', margin: '48%', comp: 'High', weight: 'Light', budget: 600, trend: false, why: 'Universal need — win with magnetic/wireless charging angle' },
  { name: 'Yoga Blocks (pair)', cat: 'Sports', price: '$20–$38', margin: '44%', comp: 'Low', weight: 'Medium', budget: 1000, trend: true, why: 'Yoga market growing, simple product, easy to brand' },
  { name: 'Silicone Stretch Lids Set', cat: 'Kitchen', price: '$15–$28', margin: '56%', comp: 'Low', weight: 'Light', budget: 600, trend: true, why: 'Eco/sustainability angle, cheap to source, high reviews' },
  { name: 'Foam Roller', cat: 'Sports', price: '$25–$45', margin: '40%', comp: 'Medium', weight: 'Medium', budget: 1200, trend: false, why: 'Recovery market booming, gym and home users' },
  { name: 'Phone Stand for Desk', cat: 'Office', price: '$15–$28', margin: '52%', comp: 'Medium', weight: 'Light', budget: 700, trend: true, why: 'WFH + content creation boom, cheap to source' },
];

const BUDGETS = [
  { label: '$500–$1k', min: 0, max: 1000 },
  { label: '$1k–$3k', min: 1000, max: 3000 },
  { label: '$3k+', min: 3000, max: 99999 },
];
const WEIGHTS = ['Any', 'Light', 'Medium'];
const COMPS = ['Any', 'Low', 'Medium'];

function IdeasMode() {
  const [budget, setBudget] = useState(0);
  const [weight, setWeight] = useState('Any');
  const [comp, setComp] = useState('Any');
  const [results, setResults] = useState<typeof IDEAS>([]);
  const [searched, setSearched] = useState(false);

  function generate() {
    const budgetFilter = BUDGETS[budget];
    const filtered = IDEAS.filter(idea => {
      const budgetOk = idea.budget >= budgetFilter.min && idea.budget <= budgetFilter.max;
      const weightOk = weight === 'Any' || idea.weight === weight;
      const compOk = comp === 'Any' || idea.comp === comp;
      return budgetOk && weightOk && compOk;
    });
    const sorted = [...filtered].sort((a, b) => (b.trend ? 1 : 0) - (a.trend ? 1 : 0));
    setResults(sorted.slice(0, 8));
    setSearched(true);
  }

  return (
    <ScrollView contentContainerStyle={id.scroll} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
      <View style={id.filters}>
        <Text style={id.filterLabel}>STARTUP BUDGET</Text>
        <View style={id.chipRow}>
          {BUDGETS.map((b, i) => (
            <TouchableOpacity key={i} style={[id.chip, budget === i && id.chipActive]} onPress={() => setBudget(i)}>
              <Text style={[id.chipText, budget === i && id.chipTextActive]}>{b.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={id.filterLabel}>UNIT WEIGHT</Text>
        <View style={id.chipRow}>
          {WEIGHTS.map(w => (
            <TouchableOpacity key={w} style={[id.chip, weight === w && id.chipActive]} onPress={() => setWeight(w)}>
              <Text style={[id.chipText, weight === w && id.chipTextActive]}>{w}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={id.filterLabel}>COMPETITION TOLERANCE</Text>
        <View style={id.chipRow}>
          {COMPS.map(c => (
            <TouchableOpacity key={c} style={[id.chip, comp === c && id.chipActive]} onPress={() => setComp(c)}>
              <Text style={[id.chipText, comp === c && id.chipTextActive]}>{c}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <TouchableOpacity style={id.btn} onPress={generate} activeOpacity={0.8}>
        <Text style={id.btnText}>Generate Ideas</Text>
      </TouchableOpacity>

      {searched && results.length === 0 && (
        <Text style={id.noResults}>No matches — try broadening your filters.</Text>
      )}

      {results.map((idea, i) => (
        <View key={i} style={id.card}>
          <View style={id.cardTop}>
            <View style={{ flex: 1 }}>
              <Text style={id.cardName}>{idea.name}</Text>
              <Text style={id.cardCat}>{idea.cat}</Text>
            </View>
            {idea.trend && (
              <View style={id.trendBadge}>
                <Text style={id.trendText}>↑ TRENDING</Text>
              </View>
            )}
          </View>
          <Text style={id.cardWhy}>{idea.why}</Text>
          <View style={id.cardStats}>
            <View style={id.stat}>
              <Text style={id.statVal}>{idea.price}</Text>
              <Text style={id.statLabel}>PRICE</Text>
            </View>
            <View style={id.statDiv} />
            <View style={id.stat}>
              <Text style={[id.statVal, { color: colors.green }]}>{idea.margin}</Text>
              <Text style={id.statLabel}>MARGIN</Text>
            </View>
            <View style={id.statDiv} />
            <View style={id.stat}>
              <Text style={[id.statVal, {
                color: idea.comp === 'Low' ? colors.green : idea.comp === 'High' ? colors.red : colors.orange,
              }]}>{idea.comp}</Text>
              <Text style={id.statLabel}>COMP.</Text>
            </View>
            <View style={id.statDiv} />
            <View style={id.stat}>
              <Text style={id.statVal}>${idea.budget.toLocaleString()}</Text>
              <Text style={id.statLabel}>MIN. BUDGET</Text>
            </View>
          </View>
        </View>
      ))}
    </ScrollView>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────
export default function LaunchScreen() {
  const [mode, setMode] = useState<Mode>('checklist');

  return (
    <SafeAreaView style={s.container}>
      <View style={s.header}>
        <Text style={s.brandWord}>Siftly</Text>
        <Text style={s.eyebrow}>LAUNCH CONTROL</Text>
        <Text style={s.title}>Idea to income.{'\n'}Step by step.</Text>
      </View>

      <View style={s.tabs}>
        {([{ key: 'checklist', label: 'Launch Checklist' }, { key: 'ideas', label: 'Product Ideas' }] as const).map(m => (
          <TouchableOpacity key={m.key} style={[s.tab, mode === m.key && s.tabActive]} onPress={() => setMode(m.key)} activeOpacity={0.7}>
            <Text style={[s.tabText, mode === m.key && s.tabTextActive]}>{m.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <View style={{ flex: 1 }}>
        {mode === 'checklist' ? <ChecklistMode /> : <IdeasMode />}
      </View>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  header: {
    paddingHorizontal: spacing.lg, paddingTop: spacing.md, paddingBottom: spacing.sm,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  brandWord: { fontSize: 20, fontWeight: '900' as const, color: colors.textPrimary, letterSpacing: -0.8, marginBottom: 2 },
  eyebrow: { fontSize: 9, fontWeight: '700' as const, color: colors.cyan, letterSpacing: 2.5, marginBottom: 6, textTransform: 'uppercase' as const },
  title: { fontSize: 24, fontWeight: '800' as const, color: colors.textPrimary, letterSpacing: -1, lineHeight: 30 },
  tabs: {
    flexDirection: 'row', marginHorizontal: spacing.lg, marginVertical: spacing.sm,
    borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, overflow: 'hidden',
    backgroundColor: colors.bgCard, padding: 3,
  },
  tab: { flex: 1, paddingVertical: spacing.sm + 2, alignItems: 'center', borderRadius: radius.sm - 2 },
  tabActive: { backgroundColor: colors.cyan },
  tabText: { fontSize: 9, fontWeight: '700' as const, color: colors.textMuted, letterSpacing: 1.5, textTransform: 'uppercase' as const },
  tabTextActive: { color: colors.bg },
});

const cl = StyleSheet.create({
  scroll: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xxl, gap: spacing.md },
  progressCard: {
    backgroundColor: colors.bgCard, borderRadius: radius.lg, padding: spacing.md,
    gap: spacing.sm, borderWidth: 1, borderColor: colors.cyanBorder,
  },
  progressTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  progressPct: { fontSize: 36, fontWeight: '800' as const, color: colors.textPrimary, letterSpacing: -1 },
  progressSub: { fontSize: 12, color: colors.textSecondary },
  resetBtn: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.full, paddingHorizontal: spacing.md, paddingVertical: 4 },
  resetText: { fontSize: 9, fontWeight: '700' as const, color: colors.textMuted, letterSpacing: 1.5 },
  progressBar: { height: 6, backgroundColor: colors.bgElevated, borderRadius: 3, overflow: 'hidden' },
  progressFill: { height: '100%' as const, borderRadius: 3 },

  section: {
    backgroundColor: colors.bgCard, borderRadius: radius.lg, overflow: 'hidden',
    borderWidth: 1, borderColor: colors.border,
  },
  sectionHeader: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm + 2,
    backgroundColor: colors.bgElevated,
  },
  sectionEmoji: { fontSize: 14 },
  sectionTitle: { fontSize: 9, fontWeight: '700' as const, color: colors.textSecondary, letterSpacing: 1.5, flex: 1 },
  sectionCount: { fontSize: 9, fontWeight: '700' as const, color: colors.textMuted },
  item: {
    flexDirection: 'row', gap: spacing.sm, alignItems: 'flex-start',
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm + 2,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  itemDone: { backgroundColor: 'rgba(16,185,129,0.05)' },
  checkbox: {
    width: 20, height: 20, borderRadius: 4, borderWidth: 1.5, borderColor: colors.border,
    alignItems: 'center', justifyContent: 'center', marginTop: 1,
  },
  checkboxDone: { backgroundColor: colors.green, borderColor: colors.green },
  checkmark: { fontSize: 11, color: colors.white, fontWeight: '800' as const },
  itemText: { fontSize: 13, color: colors.textSecondary, flex: 1, lineHeight: 20 },
  itemTextDone: { color: colors.textMuted, textDecorationLine: 'line-through' as const },
  guideHint: { fontSize: 12, color: colors.textMuted, lineHeight: 17, letterSpacing: 0.1, paddingBottom: spacing.xs },
});

const id = StyleSheet.create({
  scroll: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xxl, gap: spacing.md },
  filters: { backgroundColor: colors.bgCard, borderRadius: radius.lg, padding: spacing.md, gap: spacing.sm, borderWidth: 1, borderColor: colors.border },
  filterLabel: { fontSize: 9, fontWeight: '700' as const, color: colors.textMuted, letterSpacing: 1.5 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chip: {
    paddingHorizontal: spacing.md, paddingVertical: spacing.xs + 2,
    borderWidth: 1, borderColor: colors.border, borderRadius: radius.full,
    backgroundColor: colors.bgElevated,
  },
  chipActive: { backgroundColor: colors.cyan, borderColor: colors.cyan },
  chipText: { fontSize: 12, fontWeight: '600' as const, color: colors.textSecondary },
  chipTextActive: { color: colors.bg },
  btn: {
    backgroundColor: colors.cyan, borderRadius: radius.md,
    paddingVertical: spacing.md, alignItems: 'center',
  },
  btnText: { fontSize: 16, fontWeight: '800' as const, color: colors.bg },
  noResults: { fontSize: 14, color: colors.textMuted, textAlign: 'center', paddingVertical: spacing.lg },
  card: {
    backgroundColor: colors.bgCard, borderRadius: radius.lg, padding: spacing.md, gap: spacing.sm,
    borderWidth: 1, borderColor: colors.border,
  },
  cardTop: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  cardName: { fontSize: 15, fontWeight: '800' as const, color: colors.textPrimary, letterSpacing: -0.5 },
  cardCat: { fontSize: 12, color: colors.textMuted },
  trendBadge: { backgroundColor: colors.greenLight, borderRadius: radius.full, paddingHorizontal: 8, paddingVertical: 3 },
  trendText: { fontSize: 9, fontWeight: '800' as const, color: colors.green, letterSpacing: 0.5 },
  cardWhy: { fontSize: 13, color: colors.textSecondary, lineHeight: 19 },
  cardStats: {
    flexDirection: 'row', backgroundColor: colors.bgElevated, borderRadius: radius.sm,
    paddingVertical: spacing.sm, alignItems: 'center',
  },
  stat: { flex: 1, alignItems: 'center' },
  statVal: { fontSize: 13, fontWeight: '800' as const, color: colors.textPrimary },
  statLabel: { fontSize: 7, fontWeight: '700' as const, color: colors.textMuted, letterSpacing: 1.5, marginTop: 2 },
  statDiv: { width: 1, height: 24, backgroundColor: colors.border },
});
