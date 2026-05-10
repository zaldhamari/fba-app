import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  LayoutAnimation, Platform, UIManager, Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { colors, spacing, radius, shadow } from '../theme';
import { useSubscription } from '../hooks/useSubscription';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

// ─── Types ────────────────────────────────────────────────────────────────────

type LaunchTab = 'checklist' | 'ideas';
interface CLItem { id: string; text: string; aiKey: string }
interface Phase  {
  id: string; num: string; icon: string; title: string; desc: string;
  time: string; color: string; items: CLItem[];
}

// ─── Phase data ───────────────────────────────────────────────────────────────

const PHASES: Phase[] = [
  {
    id: 'discover', num: '01', icon: '◎', title: 'Discover Your Opportunity',
    desc: 'Find products with real demand and strong profit potential using AI.',
    time: '~30 min', color: '#4361EE',
    items: [
      { id: 'p1', text: 'Research product with 3+ demand signals (search volume, trends, BSR)', aiKey: 'bsr' },
      { id: 'p2', text: 'Verify profit margin > 30% after all fees and shipping', aiKey: 'margin' },
      { id: 'p3', text: 'Confirm top 3 competitors have < 1,000 reviews', aiKey: 'competitors' },
      { id: 'p4', text: 'Check product is not restricted, hazmat, or seasonal only', aiKey: 'restrictions' },
      { id: 'p5', text: 'Order samples from 2–3 suppliers and test quality', aiKey: 'samples' },
    ],
  },
  {
    id: 'brand', num: '02', icon: '✦', title: 'Build Your Brand',
    desc: 'Create a memorable brand identity with AI-powered name and kit generation.',
    time: '~45 min', color: colors.pink,
    items: [
      { id: 'b1', text: 'Choose brand name and create logo', aiKey: 'brandname' },
      { id: 'b2', text: 'Register Amazon Seller Central (Professional — $39.99/mo)', aiKey: 'seller_central' },
      { id: 'b3', text: 'Complete tax interview and add bank account', aiKey: 'tax' },
      { id: 'b4', text: 'Purchase GS1 UPC barcode for your product', aiKey: 'barcode' },
      { id: 'b5', text: 'Apply for Amazon Brand Registry (requires trademark)', aiKey: 'brand_registry' },
    ],
  },
  {
    id: 'keywords', num: '03', icon: '≋', title: 'Research Keywords',
    desc: 'Uncover the exact search terms buyers use to find your product.',
    time: '~30 min', color: colors.amber,
    items: [
      { id: 'k1', text: 'Find top 10 keywords with high search volume, low competition', aiKey: 'keyword_research' },
      { id: 'k2', text: 'Research competitor keyword strategies and index terms', aiKey: 'competitor_kw' },
      { id: 'k3', text: 'Build backend keyword list (249 bytes max)', aiKey: 'backend_kw' },
      { id: 'k4', text: 'Validate main keyword drives real purchase intent', aiKey: 'intent' },
    ],
  },
  {
    id: 'supplier', num: '04', icon: '⬡', title: 'Source Your Supplier',
    desc: 'Find vetted global suppliers and negotiate the best terms.',
    time: '~45 min', color: colors.green,
    items: [
      { id: 's1', text: 'Approve final sample — check packaging and labelling', aiKey: 'sample_approval' },
      { id: 's2', text: 'Negotiate MOQ, price per unit, and lead time', aiKey: 'negotiate' },
      { id: 's3', text: 'Get sea and air freight quotes, choose shipping method', aiKey: 'freight' },
      { id: 's4', text: 'Place production order and pay deposit', aiKey: 'order' },
      { id: 's5', text: 'Confirm production timeline with supplier', aiKey: 'timeline' },
    ],
  },
  {
    id: 'listing', num: '05', icon: '≡', title: 'Listing & SEO',
    desc: 'Write a fully optimised listing that ranks and converts.',
    time: '~45 min', color: colors.purple,
    items: [
      { id: 'l1', text: 'Create product ASIN in Seller Central', aiKey: 'asin' },
      { id: 'l2', text: 'Write keyword-optimised title (150–200 chars)', aiKey: 'listing_title' },
      { id: 'l3', text: 'Write 5 benefit-focused bullet points', aiKey: 'bullets' },
      { id: 'l4', text: 'Write A+ product description', aiKey: 'description' },
      { id: 'l5', text: 'Upload 7+ professional images (white background for main)', aiKey: 'images' },
      { id: 'l6', text: 'Add backend search keywords (249 bytes max)', aiKey: 'backend_seo' },
    ],
  },
  {
    id: 'inventory', num: '06', icon: '📦', title: 'Inventory Planning',
    desc: 'Prepare and ship your inventory to Amazon fulfilment centres.',
    time: '~30 min', color: '#F59E0B',
    items: [
      { id: 'sh1', text: 'Create FBA inbound shipment plan in Seller Central', aiKey: 'shipment_plan' },
      { id: 'sh2', text: 'Print and apply FNSKU labels to each unit', aiKey: 'fnsku' },
      { id: 'sh3', text: 'Print box content labels and ship to Amazon warehouse', aiKey: 'box_labels' },
      { id: 'sh4', text: 'Track shipment and confirm inventory received', aiKey: 'tracking' },
    ],
  },
  {
    id: 'go', num: '07', icon: '🚀', title: 'Launch Product',
    desc: 'Execute your launch strategy and build sales velocity from day one.',
    time: '~30 min', color: '#7C3AED',
    items: [
      { id: 'la1', text: 'Set a competitive launch price (mid-range, not cheapest)', aiKey: 'pricing' },
      { id: 'la2', text: 'Launch Sponsored Products auto campaign ($20–30/day)', aiKey: 'ppc' },
      { id: 'la3', text: 'Send product to 5–10 people for honest verified reviews', aiKey: 'reviews_launch' },
      { id: 'la4', text: 'Use "Request a Review" button on every order', aiKey: 'request_review' },
      { id: 'la5', text: 'Monitor daily: sessions, conversion rate, ACoS, inventory', aiKey: 'monitoring' },
      { id: 'la6', text: 'After 2 weeks: mine search term report, add manual campaigns', aiKey: 'campaigns' },
    ],
  },
];

const ALL_IDS    = PHASES.flatMap(p => p.items.map(i => i.id));
const STORAGE_KEY = 'fba_launch_checklist';

// ─── AI guidance ──────────────────────────────────────────────────────────────

const AI_GUIDE: Record<string, { title: string; body: string }> = {
  bsr: { title: 'Validating Demand with BSR',
    body: 'BSR (Best Seller Rank) shows how fast a product sells.\n\n• Under 5,000 = very high sales, highly competitive\n• 5,000–50,000 = strong demand — ideal target zone\n• 50,000–200,000 = moderate, great for beginners\n\nFind BSR in the "Product Information" section of any Amazon listing.\n\nValidate with 3 signals:\n1. BSR under 100,000 (demand proof)\n2. Google Trends stable or rising over 12 months\n3. Amazon autocomplete confirms buyers search this keyword\n\nTip: Target products where the top sellers have under 500 reviews — that\'s your entry window.' },
  margin: { title: 'Calculating Your Net Margin',
    body: 'Target 30%+ margin after ALL costs.\n\nFormula:\nProfit = Price − COGS − FBA Fee − Referral − PPC − Shipping\n\nExample on a $25 product:\n• Product cost: $5.00\n• FBA fulfillment: $4.00\n• Amazon referral (15%): $3.75\n• PPC estimate: $1.00\n• Inbound shipping: $1.00\n→ Net Profit: $10.25 (41% margin ✓)\n\nUse the Calculate tab to model your exact numbers.' },
  competitors: { title: 'Analysing Your Competition',
    body: 'The magic threshold: top 3 results with under 1,000 reviews.\n\n• Under 300 = easy entry\n• 300–1,000 = moderate — differentiation required\n• Over 1,000 = hard — avoid for first product\n\nAlso check: Are photos professional? Are titles keyword-optimised?\n\nPoor listings + under 500 reviews = your green light.' },
  restrictions: { title: 'Product Restriction Checks',
    body: 'Verify your product is clear to sell:\n\n1. Seller Central check — search your item in Add a Product\n2. Avoid: lithium batteries, liquids, flammables, pressurised cans\n3. Google Trends check for extreme seasonal spikes\n4. Search product name + "patent" on Google Patents\n5. Check Amazon Restricted Products page for certifications' },
  samples: { title: 'Ordering and Evaluating Samples',
    body: 'Always order samples before bulk orders.\n\n1. Contact 3–5 suppliers on Alibaba or Global Sources\n2. Request samples ($20–100 each)\n3. Evaluate: build quality, packaging options, accurate dimensions, branding capability\n\nRed flags: reluctance to send samples, mismatched photos, slow communication.\n\nCompare all samples side by side before choosing a supplier.' },
  brandname: { title: 'Choosing Your Brand Name',
    body: 'A great brand name is short, memorable, and ownable.\n\n• 1–2 syllables (Nike, Yeti, Anker)\n• No hyphens, numbers, or special characters\n• Check trademark: USPTO.gov (US) or EUIPO.eu (EU)\n• Check .com domain availability\n\nUse Brand tab → Brand Creator for AI-powered name options.\nRegister your trademark early — Brand Registry requires it.' },
  seller_central: { title: 'Setting Up Seller Central',
    body: 'Go to sell.amazon.com and choose Professional ($39.99/mo).\n\nYou will need:\n• Government ID or passport\n• Bank account details\n• Credit card\n• Tax information\n\nComplete the tax interview (10 min) and add your bank account (3–5 days to verify).\n\nTip: Open early — Amazon approval can take 24–72 hours.' },
  keyword_research: { title: 'Finding High-Value Keywords',
    body: 'Goal: high search volume, low/medium competition.\n\nFree method:\n1. Type keyword into Amazon search\n2. Note every autocomplete suggestion\n3. Check "Customers also bought" sections\n\nTarget: > 5,000 searches/month, difficulty < 50/100\n\nUse the Keywords tab to research and cluster your list.' },
  freight: { title: 'Sea vs Air vs Express',
    body: 'Sea: orders > 200 kg, 25–35 day transit, ~$150/CBM + $600 fixed\nAir: 50–300 kg, 5–8 days, ~$5–6/kg\nExpress: < 50 kg, 2–4 days, ~$9–11/kg\n\nUse the Freight Calculator in the Search tab to compare landed costs.' },
  listing_title: { title: 'Writing a High-Converting Title',
    body: 'Formula: Main Keyword + Secondary Keyword + Key Feature + Brand + Count/Size\n\n• 150–200 characters\n• Start with your #1 keyword\n• No promotional language ("Best", "Sale")\n• Include brand name\n\nUse Brand tab → Listing Builder to generate AI-optimised titles.' },
  ppc: { title: 'Launching Your First PPC Campaign',
    body: 'Start with Sponsored Products Auto Campaign:\n\n1. Advertising → Campaign Manager\n2. Automatic Targeting\n3. Daily budget: $20–30\n4. Default bid: $0.75–1.00\n5. Run 2 weeks without changes\n\nAfter 2 weeks: download Search Term Report, move winning keywords to Manual (exact match). Target ACoS 25–40% at launch.' },
  pricing: { title: 'Launch Pricing Strategy',
    body: 'Find median price of top 10 competitors.\nLaunch 10–15% below median (not the cheapest).\nAfter 20–30 reviews, raise to median.\nAfter 50+ reviews, consider 10% above median.\n\nLow prices attract returners and signal low quality — price for margin, not volume.' },
  monitoring: { title: 'Daily Post-Launch Metrics',
    body: 'Check every day for the first 30 days:\n• Sessions: listing views\n• Unit Session %: conversion (target 10–15%+)\n• ACoS: ad spend / revenue (target < 35%)\n• Inventory: never run out in first 90 days\n• Buy Box %: should be 95–100%\n\nIf conversion < 8%, your images or price need work.' },
};

// ─── Circular Progress Ring ───────────────────────────────────────────────────

function RingProgress({ pct, size = 84, color = '#4361EE' }: { pct: number; size?: number; color?: string }) {
  const stroke = 9;
  const half   = size / 2;
  const deg    = Math.min(Math.max(pct, 0), 100) * 3.6;
  const rDeg   = Math.min(deg, 180);
  const lDeg   = Math.max(deg - 180, 0);
  const inner  = size - stroke * 2;
  const trackColor = '#E8EDF8';

  return (
    <View style={{ width: size, height: size }}>
      <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, borderRadius: half, borderWidth: stroke, borderColor: trackColor }} />
      <View style={{ position: 'absolute', top: 0, right: 0, width: half, height: size, overflow: 'hidden' }}>
        <View style={{ position: 'absolute', top: 0, right: 0, width: size, height: size, borderRadius: half, borderWidth: stroke, borderColor: deg > 0 ? color : trackColor, transform: [{ rotate: `${rDeg - 180}deg` }] }} />
      </View>
      {deg > 180 && (
        <View style={{ position: 'absolute', top: 0, left: 0, width: half, height: size, overflow: 'hidden' }}>
          <View style={{ position: 'absolute', top: 0, left: 0, width: size, height: size, borderRadius: half, borderWidth: stroke, borderColor: color, transform: [{ rotate: `${lDeg}deg` }] }} />
        </View>
      )}
      <View style={{ position: 'absolute', top: stroke, left: stroke, width: inner, height: inner, borderRadius: inner / 2, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ fontSize: Math.floor(size * 0.22), fontWeight: '900', color: '#0D1B4B', letterSpacing: -0.5, lineHeight: Math.floor(size * 0.25) }}>{Math.round(pct)}%</Text>
      </View>
    </View>
  );
}

// ─── AI Modal ─────────────────────────────────────────────────────────────────

function AIModal({ aiKey, onClose }: { aiKey: string | null; onClose: () => void }) {
  const g = aiKey ? AI_GUIDE[aiKey] : null;
  return (
    <Modal visible={!!aiKey} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={{ flex: 1, backgroundColor: '#fff' }}>
        <View style={aim.header}>
          <View style={aim.iconWrap}><Text style={{ fontSize: 16 }}>✦</Text></View>
          <Text style={aim.title} numberOfLines={2}>{g?.title ?? ''}</Text>
          <TouchableOpacity onPress={onClose} hitSlop={{ top: 16, bottom: 16, left: 16, right: 16 }}>
            <Text style={{ fontSize: 22, color: colors.textMuted, fontWeight: '300' }}>✕</Text>
          </TouchableOpacity>
        </View>
        <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.md, paddingBottom: 40 }}>
          <Text style={aim.body}>{g?.body ?? ''}</Text>
          <View style={aim.tip}>
            <Text style={aim.tipLabel}>✦ AI TIP</Text>
            <Text style={aim.tipBody}>Use the Search, Brand, and Calculate tabs to complete this step faster with Siftly's built-in tools.</Text>
          </View>
        </ScrollView>
        <View style={{ padding: spacing.lg, borderTopWidth: 1, borderTopColor: colors.border }}>
          <TouchableOpacity style={aim.btn} onPress={onClose} activeOpacity={0.85}>
            <Text style={aim.btnText}>Got it — back to checklist</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </Modal>
  );
}
const aim = StyleSheet.create({
  header:   { flexDirection: 'row', alignItems: 'center', gap: 12, padding: spacing.lg, borderBottomWidth: 1, borderBottomColor: colors.border },
  iconWrap: { width: 36, height: 36, borderRadius: 10, backgroundColor: '#EEF2FF', alignItems: 'center', justifyContent: 'center' },
  title:    { flex: 1, fontSize: 16, fontWeight: '800', color: '#0D1B4B', letterSpacing: -0.3, lineHeight: 22 },
  body:     { fontSize: 14, color: colors.textSecondary, lineHeight: 24 },
  tip:      { backgroundColor: '#EEF4FF', borderRadius: radius.lg, borderWidth: 1, borderColor: '#C7D9FF', padding: spacing.md, gap: 6 },
  tipLabel: { fontSize: 9, fontWeight: '800', color: '#4361EE', letterSpacing: 2 },
  tipBody:  { fontSize: 13, color: colors.textSecondary, lineHeight: 20 },
  btn:      { backgroundColor: '#4361EE', borderRadius: radius.md, paddingVertical: spacing.md, alignItems: 'center' },
  btnText:  { fontSize: 15, fontWeight: '800', color: '#fff' },
});

// ─── Phase Card ───────────────────────────────────────────────────────────────

function PhaseCard({ phase, checked, onToggle, onAI }: {
  phase: Phase; checked: Set<string>; onToggle: (id: string) => void; onAI: (k: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const done  = phase.items.filter(i => checked.has(i.id)).length;
  const total = phase.items.length;
  const pct   = Math.round((done / total) * 100);
  const allDone = done === total;

  function toggle() {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpanded(e => !e);
  }

  const dimColor = phase.color + '18';

  return (
    <View style={[pc.card, allDone && { borderColor: `${colors.green}40` }]}>
      <TouchableOpacity onPress={toggle} activeOpacity={0.72} style={pc.headerBtn}>
        {/* Num badge */}
        <View style={[pc.numBadge, { backgroundColor: dimColor }]}>
          <Text style={[pc.numText, { color: phase.color }]}>{phase.num}</Text>
        </View>
        {/* Icon circle */}
        <View style={[pc.iconCircle, { backgroundColor: dimColor }]}>
          <Text style={[pc.iconText, { color: phase.color }]}>{phase.icon}</Text>
        </View>
        {/* Title + desc */}
        <View style={{ flex: 1 }}>
          <Text style={[pc.title, allDone && { color: colors.textMuted }]}>{phase.title}</Text>
          {expanded && <Text style={pc.desc}>{phase.desc}</Text>}
        </View>
        {/* Right meta */}
        <View style={pc.meta}>
          <Text style={[pc.metaPct, { color: phase.color }]}>{pct}%</Text>
          <Text style={pc.metaLabel}>Complete</Text>
          <Text style={pc.metaTime}>⏱ {phase.time}</Text>
        </View>
        <Text style={pc.chevron}>{expanded ? '∧' : '∨'}</Text>
      </TouchableOpacity>

      {/* Expanded checklist */}
      {expanded && (
        <View style={pc.itemsWrap}>
          {phase.items.map((item, idx) => {
            const isDone = checked.has(item.id);
            const isLast = idx === phase.items.length - 1;
            return (
              <View key={item.id} style={pc.itemRow}>
                {/* Dot + connector line */}
                <View style={pc.dotCol}>
                  <TouchableOpacity
                    style={[pc.dot, isDone && { backgroundColor: phase.color, borderColor: phase.color }]}
                    onPress={() => onToggle(item.id)}
                    activeOpacity={0.7}
                  >
                    {isDone && <Text style={pc.dotCheck}>✓</Text>}
                  </TouchableOpacity>
                  {!isLast && <View style={[pc.connector, { backgroundColor: isDone ? phase.color : '#D8E4F5' }]} />}
                </View>
                {/* Text */}
                <TouchableOpacity style={{ flex: 1 }} onPress={() => onToggle(item.id)} activeOpacity={0.7}>
                  <Text style={[pc.itemText, isDone && pc.itemDone]}>{item.text}</Text>
                </TouchableOpacity>
                {/* AI button */}
                <TouchableOpacity
                  style={[pc.aiBtn, { borderColor: phase.color + '50', backgroundColor: dimColor }]}
                  onPress={() => onAI(item.aiKey)}
                  activeOpacity={0.75}
                >
                  <Text style={[pc.aiBtnText, { color: phase.color }]}>✦ AI</Text>
                </TouchableOpacity>
              </View>
            );
          })}
        </View>
      )}
    </View>
  );
}

const pc = StyleSheet.create({
  card:      { backgroundColor: '#fff', borderRadius: radius.xl, borderWidth: 1, borderColor: '#E8EDF5', overflow: 'hidden', ...shadow.sm },
  headerBtn: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: spacing.md },
  numBadge:  { width: 32, height: 32, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  numText:   { fontSize: 10, fontWeight: '900', letterSpacing: 0.3 },
  iconCircle:{ width: 36, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  iconText:  { fontSize: 16 },
  title:     { fontSize: 14, fontWeight: '800', color: '#0D1B4B', letterSpacing: -0.3 },
  desc:      { fontSize: 11, color: colors.textMuted, lineHeight: 16, marginTop: 3 },
  meta:      { alignItems: 'flex-end', gap: 1 },
  metaPct:   { fontSize: 12, fontWeight: '800' },
  metaLabel: { fontSize: 8, color: colors.textMuted, fontWeight: '600' },
  metaTime:  { fontSize: 9, color: colors.textMuted },
  chevron:   { fontSize: 10, color: colors.textMuted, marginLeft: 4 },

  itemsWrap: { borderTopWidth: 1, borderTopColor: '#EEF2FB', paddingVertical: spacing.xs },
  itemRow:   { flexDirection: 'row', alignItems: 'flex-start', paddingRight: spacing.md, paddingLeft: spacing.md, minHeight: 44 },
  dotCol:    { width: 28, alignItems: 'center', paddingTop: 12 },
  dot: {
    width: 20, height: 20, borderRadius: 10,
    borderWidth: 1.5, borderColor: '#C8D5EA',
    backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center',
    marginBottom: 2,
  },
  dotCheck:  { fontSize: 10, color: '#fff', fontWeight: '900' },
  connector: { flex: 1, width: 1.5, minHeight: 12 },
  itemText:  { flex: 1, fontSize: 13, color: colors.textSecondary, lineHeight: 20, paddingTop: 10, paddingRight: 6 },
  itemDone:  { color: colors.textMuted, textDecorationLine: 'line-through' },
  aiBtn:     { marginTop: 8, paddingHorizontal: 8, paddingVertical: 4, borderRadius: radius.full, borderWidth: 1 },
  aiBtnText: { fontSize: 9, fontWeight: '900', letterSpacing: 0.3 },
});

// ─── ChecklistMode ────────────────────────────────────────────────────────────

function ChecklistMode() {
  const [checked,  setChecked]  = useState<Set<string>>(new Set());
  const [aiKey,    setAiKey]    = useState<string | null>(null);
  const { usage, tier } = useSubscription();

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then(v => {
      if (v) { try { setChecked(new Set(JSON.parse(v))); } catch { /* ignore */ } }
    });
  }, []);

  async function toggle(id: string) {
    setChecked(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      AsyncStorage.setItem(STORAGE_KEY, JSON.stringify([...next]));
      return next;
    });
  }

  const totalItems = ALL_IDS.length;
  const doneCount  = checked.size;
  const pct        = totalItems > 0 ? (doneCount / totalItems) * 100 : 0;

  const tierLabel  = tier === 'operator' ? 'OPERATOR' : tier === 'builder' ? 'BUILDER' : 'EXPLORER';
  const tierColor  = tier === 'operator' ? colors.purple : tier === 'builder' ? '#4361EE' : colors.textMuted;

  return (
    <>
      <AIModal aiKey={aiKey} onClose={() => setAiKey(null)} />
      <ScrollView contentContainerStyle={cl.scroll} showsVerticalScrollIndicator={false}>

        {/* ══ HERO CARD ═══════════════════════════════════════════════════════ */}
        <View style={cl.hero}>
          {/* Header row */}
          <View style={cl.heroHeader}>
            <View>
              <Text style={cl.heroWordmark}>Siftly</Text>
              <Text style={cl.heroEyebrow}>LAUNCH CONTROL</Text>
            </View>
            <View style={[cl.tierPill, { borderColor: tierColor + '50' }]}>
              <View style={[cl.tierDot, { backgroundColor: tierColor }]} />
              <Text style={[cl.tierLabel, { color: tierColor }]}>{tierLabel}</Text>
              <Text style={[cl.tierChevron, { color: tierColor }]}>∨</Text>
            </View>
          </View>

          {/* Title row + rocket */}
          <View style={cl.heroBody}>
            <View style={{ flex: 1, paddingRight: spacing.sm }}>
              <Text style={cl.heroTitle}>
                {'Launch Your First\nProfitable '}
                <Text style={cl.heroTitleAccent}>Amazon</Text>
                {' Product'}
              </Text>
              <Text style={cl.heroSub}>Your AI-powered roadmap from idea to first sale.</Text>
                <Text style={cl.heroClock}>⏱  Estimated time to launch: 3–5 hours</Text>
            </View>
            {/* Rocket illustration placeholder */}
            <View style={cl.rocketWrap}>
              <View style={cl.rocketGlow} />
              <Text style={cl.rocketEmoji}>🚀</Text>
              <View style={cl.rocketChart}>
                {[40, 60, 75, 90].map((h, i) => (
                  <View key={i} style={[cl.bar, { height: h * 0.5, backgroundColor: i === 3 ? '#4361EE' : `rgba(67,97,238,${0.3 + i * 0.15})` }]} />
                ))}
              </View>
            </View>
          </View>

        </View>

        {/* ══ PROGRESS CARD ══════════════════════════════════════════════════ */}
        <View style={cl.card}>
          {/* Left: ring + text */}
          <View style={cl.progressLeft}>
            <View style={cl.progressTopRow}>
              <Text style={cl.progressTitle}>Launch Progress</Text>
              <View style={[cl.levelBadge, { backgroundColor: '#EEF4FF' }]}>
                <Text style={{ fontSize: 9, fontWeight: '800', color: '#4361EE' }}>Level: {tierLabel[0] + tierLabel.slice(1).toLowerCase()}</Text>
              </View>
            </View>
            <View style={cl.ringRow}>
              <RingProgress pct={pct} size={80} color={pct === 100 ? colors.green : '#4361EE'} />
              <View style={{ flex: 1, justifyContent: 'center', gap: 2 }}>
                <Text style={cl.ringCount}><Text style={cl.ringBig}>{doneCount}</Text> of {totalItems}</Text>
                <Text style={cl.ringLabel}>steps complete</Text>
              </View>
            </View>
            <View style={cl.progressBar}>
              <View style={[cl.progressFill, { width: `${pct}%` as any, backgroundColor: pct === 100 ? colors.green : '#4361EE' }]} />
            </View>
            <Text style={cl.progressHint}>
              {pct === 100
                ? "🎉 All steps done — time to launch!"
                : `You're ${totalItems - doneCount} steps away from your first sale!`}
            </Text>
          </View>

          {/* Divider */}
          <View style={cl.cardDivider} />

          {/* Right: stats 2×2 */}
          <View style={cl.statsGrid}>
            {[
              { icon: '🔍', label: 'Opportunities\nFound',    val: usage.research  ?? 0, sub: 'High potential'    },
              { icon: '👑', label: 'Brands\nCreated',         val: usage.brands    ?? 0, sub: 'AI-generated'      },
              { icon: '🔑', label: 'Keywords\nResearched',    val: usage.keywords  ?? 0, sub: 'Top opportunities' },
              { icon: '🚚', label: 'Suppliers\nShortlisted',  val: usage.suppliers ?? 0, sub: 'Vetted suppliers'  },
            ].map((s, i) => (
              <View key={i} style={cl.statCell}>
                <Text style={cl.statIcon}>{s.icon}</Text>
                <Text style={cl.statLabel}>{s.label}</Text>
                <Text style={cl.statVal}>{s.val}</Text>
                <Text style={cl.statSub}>{s.sub}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* ══ LAUNCH BLUEPRINT ═══════════════════════════════════════════════ */}
        <View style={cl.blueprintHeader}>
          <Text style={cl.blueprintTitle}>Your Launch Blueprint</Text>
          {/* Dotted path decoration */}
          <View style={cl.pathRow}>
            {PHASES.map((p, i) => (
              <React.Fragment key={p.id}>
                <View style={[cl.pathDot, { backgroundColor: p.color }]} />
                {i < PHASES.length - 1 && <View style={cl.pathLine} />}
              </React.Fragment>
            ))}
            <Text style={cl.pathPin}>📍</Text>
          </View>
        </View>

        <View style={cl.phases}>
          {PHASES.map(p => (
            <PhaseCard key={p.id} phase={p} checked={checked} onToggle={toggle} onAI={setAiKey} />
          ))}
        </View>

        {/* ══ MOTIVATION CARD ════════════════════════════════════════════════ */}
        <View style={cl.motivCard}>
          <View style={cl.motivLeft}>
            <Text style={cl.motivGraphic}>📈</Text>
            <Text style={cl.motivCoins}>💰</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={cl.motivTitle}>Stay consistent, follow the process, and your success is inevitable.</Text>
            <Text style={cl.motivSub}>You've got the plan. We'll guide the way.</Text>
          </View>
          <TouchableOpacity style={cl.motivBtn} activeOpacity={0.8}>
            <Text style={cl.motivBtnText}>View Success Stories →</Text>
          </TouchableOpacity>
        </View>

      </ScrollView>
    </>
  );
}

// ─── Product Ideas ────────────────────────────────────────────────────────────

const IDEAS = [
  { name: 'Resistance Bands Set',      cat: 'Sports',  price: '$20–$35', margin: '50%', comp: 'Medium', weight: 'Light',  budget: 800,  trend: true,  why: 'Home fitness boom, high margin, lightweight to ship' },
  { name: 'Silicone Baby Feeding Set', cat: 'Baby',    price: '$25–$40', margin: '42%', comp: 'Low',    weight: 'Light',  budget: 1200, trend: true,  why: 'Parents spend freely, gift market, repeat buyers' },
  { name: 'Reusable Produce Bags',     cat: 'Kitchen', price: '$12–$22', margin: '58%', comp: 'Low',    weight: 'Light',  budget: 500,  trend: true,  why: 'Eco trend, very cheap to source, repeat purchases' },
  { name: 'Dog Grooming Glove',        cat: 'Pet',     price: '$12–$25', margin: '55%', comp: 'Low',    weight: 'Light',  budget: 600,  trend: true,  why: 'Pet market growing fast, low returns, gift-worthy' },
  { name: 'Desk Cable Organizer',      cat: 'Office',  price: '$15–$28', margin: '50%', comp: 'Low',    weight: 'Light',  budget: 700,  trend: true,  why: 'WFH demand, cheap to source, simple differentiation' },
  { name: 'Electric Lint Remover',     cat: 'Home',    price: '$20–$38', margin: '48%', comp: 'Low',    weight: 'Light',  budget: 900,  trend: true,  why: 'TikTok viral, high perceived value, impulse buy' },
  { name: 'Posture Corrector',         cat: 'Health',  price: '$25–$45', margin: '44%', comp: 'Medium', weight: 'Light',  budget: 900,  trend: true,  why: 'WFH trend, high perceived value, easy to brand premium' },
  { name: 'Bamboo Cutting Board Set',  cat: 'Kitchen', price: '$30–$55', margin: '38%', comp: 'Medium', weight: 'Medium', budget: 1500, trend: false, why: 'Evergreen demand, eco angle, great bundle potential' },
  { name: 'Silicone Ice Cube Molds',   cat: 'Kitchen', price: '$12–$20', margin: '62%', comp: 'Low',    weight: 'Light',  budget: 500,  trend: true,  why: 'Craft cocktail trend, very cheap to source' },
  { name: 'Travel Packing Cubes',      cat: 'Travel',  price: '$22–$40', margin: '42%', comp: 'Medium', weight: 'Light',  budget: 1000, trend: true,  why: 'Travel rebound, bundle sets, loyal repeat customers' },
  { name: 'Knee Compression Sleeve',   cat: 'Health',  price: '$18–$35', margin: '46%', comp: 'Medium', weight: 'Light',  budget: 800,  trend: false, why: 'Aging population, sports recovery, year-round demand' },
  { name: 'Wooden Spice Rack',         cat: 'Kitchen', price: '$30–$60', margin: '40%', comp: 'Low',    weight: 'Medium', budget: 1500, trend: true,  why: 'Home cooking trend, premium aesthetic, organics angle' },
  { name: 'Velvet Hangers 50-Pack',    cat: 'Home',    price: '$18–$30', margin: '52%', comp: 'Medium', weight: 'Medium', budget: 800,  trend: false, why: 'Constant demand, high units per order, repeat buyer' },
  { name: 'Car Phone Holder',          cat: 'Auto',    price: '$15–$30', margin: '48%', comp: 'High',   weight: 'Light',  budget: 600,  trend: false, why: 'Universal need — win with magnetic/wireless angle' },
  { name: 'Yoga Blocks (pair)',        cat: 'Sports',  price: '$20–$38', margin: '44%', comp: 'Low',    weight: 'Medium', budget: 1000, trend: true,  why: 'Yoga market growing, simple product, easy to brand' },
  { name: 'Silicone Stretch Lids Set', cat: 'Kitchen', price: '$15–$28', margin: '56%', comp: 'Low',    weight: 'Light',  budget: 600,  trend: true,  why: 'Eco/sustainability angle, cheap to source, high reviews' },
  { name: 'Foam Roller',              cat: 'Sports',  price: '$25–$45', margin: '40%', comp: 'Medium', weight: 'Medium', budget: 1200, trend: false, why: 'Recovery market booming, gym and home users' },
  { name: 'Phone Stand for Desk',     cat: 'Office',  price: '$15–$28', margin: '52%', comp: 'Medium', weight: 'Light',  budget: 700,  trend: true,  why: 'WFH + content creation boom, cheap to source' },
];

const BUDGETS = [{ label: '$500–$1k', min: 0, max: 1000 }, { label: '$1k–$3k', min: 1000, max: 3000 }, { label: '$3k+', min: 3000, max: 99999 }];
const WEIGHTS = ['Any', 'Light', 'Medium'];
const COMPS   = ['Any', 'Low', 'Medium'];

export function IdeasMode() {
  const [budget, setBudget]   = useState(0);
  const [weight, setWeight]   = useState('Any');
  const [comp,   setComp]     = useState('Any');
  const [results, setResults] = useState<typeof IDEAS>([]);
  const [searched, setSearched] = useState(false);

  function generate() {
    const bf = BUDGETS[budget];
    const filtered = IDEAS.filter(i =>
      i.budget >= bf.min && i.budget <= bf.max &&
      (weight === 'Any' || i.weight === weight) &&
      (comp   === 'Any' || i.comp   === comp)
    );
    setResults([...filtered].sort((a, b) => (b.trend ? 1 : 0) - (a.trend ? 1 : 0)).slice(0, 8));
    setSearched(true);
  }

  return (
    <ScrollView contentContainerStyle={id.scroll} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
      <View style={id.filters}>
        {[
          { label: 'STARTUP BUDGET', opts: BUDGETS.map((b, i) => ({ key: String(i), label: b.label })), val: String(budget), set: (v: string) => setBudget(Number(v)) },
          { label: 'UNIT WEIGHT',    opts: WEIGHTS.map(w => ({ key: w, label: w })), val: weight, set: setWeight },
          { label: 'COMPETITION',    opts: COMPS.map(c => ({ key: c, label: c })),   val: comp,   set: setComp   },
        ].map(row => (
          <View key={row.label}>
            <Text style={id.filterLabel}>{row.label}</Text>
            <View style={id.chipRow}>
              {row.opts.map(o => (
                <TouchableOpacity key={o.key} style={[id.chip, row.val === o.key && id.chipActive]} onPress={() => row.set(o.key)}>
                  <Text style={[id.chipText, row.val === o.key && id.chipTextActive]}>{o.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        ))}
      </View>
      <TouchableOpacity style={id.btn} onPress={generate} activeOpacity={0.85}>
        <Text style={id.btnText}>Generate Ideas</Text>
      </TouchableOpacity>
      {searched && results.length === 0 && <Text style={id.noResults}>No matches — try broadening your filters.</Text>}
      {results.map((idea, i) => (
        <View key={i} style={id.card}>
          <View style={id.cardTop}>
            <View style={{ flex: 1 }}>
              <Text style={id.cardName}>{idea.name}</Text>
              <Text style={id.cardCat}>{idea.cat}</Text>
            </View>
            {idea.trend && <View style={id.trendBadge}><Text style={id.trendText}>↑ TRENDING</Text></View>}
          </View>
          <Text style={id.cardWhy}>{idea.why}</Text>
          <View style={id.cardStats}>
            {[
              { val: idea.price,  label: 'PRICE',      color: undefined },
              { val: idea.margin, label: 'MARGIN',     color: colors.green },
              { val: idea.comp,   label: 'COMP.',      color: idea.comp === 'Low' ? colors.green : idea.comp === 'High' ? colors.red : colors.amber },
              { val: `$${idea.budget.toLocaleString()}`, label: 'MIN. BUDGET', color: undefined },
            ].map((s, idx, arr) => (
              <React.Fragment key={idx}>
                {idx > 0 && <View style={id.statDiv} />}
                <View style={id.stat}>
                  <Text style={[id.statVal, s.color ? { color: s.color } : {}]}>{s.val}</Text>
                  <Text style={id.statLabel}>{s.label}</Text>
                </View>
              </React.Fragment>
            ))}
          </View>
        </View>
      ))}
    </ScrollView>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function LaunchScreen() {
  const [tab, setTab] = useState<LaunchTab>('checklist');
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#F5F7FF' }}>
      <View style={s.seg}>
        {([
          { key: 'checklist', label: '↑  Launch Checklist' },
          { key: 'ideas',     label: '◉  Product Ideas'    },
        ] as const).map(t => (
          <TouchableOpacity key={t.key} style={[s.segTab, tab === t.key && s.segActive]} onPress={() => setTab(t.key)} activeOpacity={0.75}>
            <Text style={[s.segText, tab === t.key && s.segTextActive]}>{t.label}</Text>
          </TouchableOpacity>
        ))}
      </View>
      <View style={{ flex: 1 }}>
        {tab === 'checklist' ? <ChecklistMode /> : <IdeasMode />}
      </View>
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  seg:         { flexDirection: 'row', marginHorizontal: spacing.md, marginTop: spacing.xs, marginBottom: spacing.xs, backgroundColor: '#E8EDF5', borderRadius: radius.lg, padding: 3, borderWidth: 1, borderColor: '#D0DAF0' },
  segTab:      { flex: 1, paddingVertical: spacing.sm + 1, alignItems: 'center', borderRadius: radius.md - 2 },
  segActive:   { backgroundColor: '#fff', ...shadow.sm },
  segText:     { fontSize: 12, fontWeight: '700', color: colors.textMuted },
  segTextActive:{ color: '#0D1B4B', fontWeight: '800' },
});

const cl = StyleSheet.create({
  scroll: { paddingBottom: 120, paddingHorizontal: spacing.md, gap: spacing.sm, paddingTop: spacing.xs },

  // ── Hero card
  hero: { backgroundColor: '#fff', borderRadius: radius.xxl, borderWidth: 1, borderColor: '#E0E8F5', padding: spacing.lg, gap: spacing.sm, ...shadow.md },
  heroHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  heroWordmark: { fontSize: 22, fontWeight: '900', color: '#0D1B4B', letterSpacing: -0.8 },
  heroEyebrow:  { fontSize: 8, fontWeight: '800', color: '#4361EE', letterSpacing: 2.5, marginTop: 1 },
  tierPill:     { flexDirection: 'row', alignItems: 'center', gap: 5, borderWidth: 1, borderRadius: radius.full, paddingHorizontal: 10, paddingVertical: 5, backgroundColor: '#fff' },
  tierDot:      { width: 6, height: 6, borderRadius: 3 },
  tierLabel:    { fontSize: 9, fontWeight: '800', letterSpacing: 1.2 },
  tierChevron:  { fontSize: 8, fontWeight: '700' },

  heroBody:     { flexDirection: 'row', gap: spacing.sm },
  heroTitle:    { fontSize: 24, fontWeight: '900', color: '#0D1B4B', letterSpacing: -1, lineHeight: 30 },
  heroTitleAccent: { color: '#4361EE' },
  heroSub:      { fontSize: 13, color: colors.textSecondary, lineHeight: 19, marginTop: 6 },
  ctaBtn:       { backgroundColor: '#4361EE', borderRadius: radius.md, paddingVertical: spacing.md - 2, alignItems: 'center', marginTop: spacing.sm },
  ctaBtnText:   { fontSize: 14, fontWeight: '800', color: '#fff', letterSpacing: -0.2 },
  heroClock:    { fontSize: 11, color: colors.textMuted, marginTop: 5 },

  rocketWrap:  { width: 100, alignItems: 'center', justifyContent: 'flex-end', paddingBottom: 4 },
  rocketGlow:  { position: 'absolute', width: 80, height: 80, borderRadius: 40, backgroundColor: 'rgba(67,97,238,0.08)', top: 0 },
  rocketEmoji: { fontSize: 44, marginBottom: 4 },
  rocketChart: { flexDirection: 'row', alignItems: 'flex-end', gap: 3 },
  bar:         { width: 12, borderRadius: 3 },

  goalCard: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    backgroundColor: '#FFF8EE', borderRadius: radius.lg,
    borderWidth: 1, borderColor: '#FFE4B0', padding: spacing.sm + 4,
  },
  goalIcon:    { fontSize: 22 },
  goalEyebrow: { fontSize: 8, fontWeight: '800', color: '#D97706', letterSpacing: 1.5 },
  goalValue:   { fontSize: 16, fontWeight: '900', color: '#0D1B4B', letterSpacing: -0.5, marginTop: 1 },
  goalSub:     { fontSize: 11, color: colors.textSecondary, marginTop: 1 },

  // ── Progress card (horizontal split)
  card: {
    backgroundColor: '#fff', borderRadius: radius.xl,
    borderWidth: 1, borderColor: '#E0E8F5',
    flexDirection: 'row', ...shadow.sm,
  },
  progressLeft:   { flex: 1, padding: spacing.md, gap: spacing.sm },
  progressTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  progressTitle:  { fontSize: 13, fontWeight: '800', color: '#0D1B4B', letterSpacing: -0.3 },
  levelBadge:     { borderRadius: radius.full, paddingHorizontal: 8, paddingVertical: 3 },
  ringRow:        { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  ringBig:        { fontSize: 26, fontWeight: '900', color: '#0D1B4B', letterSpacing: -1 },
  ringCount:      { fontSize: 13, color: colors.textSecondary, fontWeight: '600' },
  ringLabel:      { fontSize: 11, color: colors.textMuted },
  progressBar:    { height: 6, backgroundColor: '#E8EDF5', borderRadius: 3, overflow: 'hidden' },
  progressFill:   { height: '100%', borderRadius: 3 },
  progressHint:   { fontSize: 11, color: colors.textSecondary, lineHeight: 16 },
  cardDivider:    { width: 1, backgroundColor: '#E8EDF5', marginVertical: spacing.md },

  statsGrid: { flex: 1, flexDirection: 'row', flexWrap: 'wrap', padding: spacing.sm },
  statCell:  { width: '50%', padding: spacing.xs + 2, gap: 1 },
  statIcon:  { fontSize: 16 },
  statLabel: { fontSize: 9, fontWeight: '700', color: colors.textMuted, lineHeight: 13 },
  statVal:   { fontSize: 20, fontWeight: '900', color: '#0D1B4B', letterSpacing: -0.8 },
  statSub:   { fontSize: 9, color: colors.textMuted },

  // ── Achievements
  achieveHeader: { paddingHorizontal: spacing.md, paddingTop: spacing.md, paddingBottom: spacing.sm, borderBottomWidth: 1, borderBottomColor: '#F0F4FC', gap: 2 },
  achieveTitle:  { fontSize: 15, fontWeight: '800', color: '#0D1B4B', letterSpacing: -0.3 },
  achieveSub:    { fontSize: 11, color: colors.textMuted },
  badgeRow:      { flexDirection: 'row', justifyContent: 'space-around', paddingHorizontal: spacing.sm, paddingVertical: spacing.md, flexWrap: 'wrap' },
  badgeWrap:     { alignItems: 'center', width: 54, gap: 5 },
  badgeCircle:   { width: 46, height: 46, borderRadius: 23, alignItems: 'center', justifyContent: 'center', borderWidth: 1.5 },
  badgeUnlocked: { backgroundColor: '#EEF4FF', borderColor: '#4361EE' },
  badgeLocked:   { backgroundColor: '#F5F7FB', borderColor: '#DDE4F0' },
  badgeIcon:     { fontSize: 20 },
  badgeLabel:    { fontSize: 9, fontWeight: '700', color: colors.textSecondary, textAlign: 'center', lineHeight: 13 },

  // ── Blueprint header
  blueprintHeader: { gap: 6 },
  blueprintTitle:  { fontSize: 18, fontWeight: '900', color: '#0D1B4B', letterSpacing: -0.7 },
  pathRow:         { flexDirection: 'row', alignItems: 'center' },
  pathDot:         { width: 8, height: 8, borderRadius: 4 },
  pathLine:        { flex: 1, height: 1.5, borderStyle: 'dashed', borderWidth: 1, borderColor: '#C5D3EC', marginHorizontal: 1 },
  pathPin:         { fontSize: 14, marginLeft: 2 },

  // ── Phases
  phases: { gap: spacing.sm },

  // ── Motivation card
  motivCard: {
    backgroundColor: '#fff', borderRadius: radius.xl,
    borderWidth: 1, borderColor: '#E0E8F5',
    padding: spacing.md, flexDirection: 'row',
    alignItems: 'center', gap: spacing.sm, ...shadow.sm,
  },
  motivLeft:   { gap: -6, alignItems: 'center' },
  motivGraphic:{ fontSize: 26 },
  motivCoins:  { fontSize: 22, marginTop: -8 },
  motivTitle:  { fontSize: 13, fontWeight: '800', color: '#0D1B4B', lineHeight: 19, letterSpacing: -0.3, flex: 1 },
  motivSub:    { fontSize: 11, color: colors.textMuted, marginTop: 3 },
  motivBtn:    { borderWidth: 1, borderColor: '#4361EE', borderRadius: radius.full, paddingHorizontal: 10, paddingVertical: 6, marginTop: 6 },
  motivBtnText:{ fontSize: 10, fontWeight: '700', color: '#4361EE' },
});

const id = StyleSheet.create({
  scroll:    { paddingHorizontal: spacing.md, paddingBottom: 120, gap: spacing.sm, paddingTop: spacing.xs },
  filters:   { backgroundColor: '#fff', borderRadius: radius.lg, padding: spacing.md, gap: spacing.sm, borderWidth: 1, borderColor: '#E0E8F5' },
  filterLabel: { fontSize: 9, fontWeight: '800', color: colors.textMuted, letterSpacing: 1.5 },
  chipRow:   { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs + 2 },
  chip:      { paddingHorizontal: spacing.md, paddingVertical: spacing.xs + 2, borderWidth: 1, borderColor: '#D0DAF0', borderRadius: radius.full, backgroundColor: '#F5F7FF' },
  chipActive:{ backgroundColor: '#4361EE', borderColor: '#4361EE' },
  chipText:  { fontSize: 12, fontWeight: '600', color: colors.textSecondary },
  chipTextActive: { color: '#fff' },
  btn:       { backgroundColor: '#4361EE', borderRadius: radius.md, paddingVertical: spacing.md, alignItems: 'center' },
  btnText:   { fontSize: 16, fontWeight: '800', color: '#fff' },
  noResults: { fontSize: 14, color: colors.textMuted, textAlign: 'center', paddingVertical: spacing.lg },
  card:      { backgroundColor: '#fff', borderRadius: radius.lg, padding: spacing.md, gap: spacing.sm, borderWidth: 1, borderColor: '#E0E8F5' },
  cardTop:   { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  cardName:  { fontSize: 15, fontWeight: '800', color: '#0D1B4B', letterSpacing: -0.5 },
  cardCat:   { fontSize: 12, color: colors.textMuted },
  trendBadge:{ backgroundColor: colors.greenLight, borderRadius: radius.full, paddingHorizontal: 8, paddingVertical: 3 },
  trendText: { fontSize: 9, fontWeight: '800', color: colors.green, letterSpacing: 0.5 },
  cardWhy:   { fontSize: 13, color: colors.textSecondary, lineHeight: 19 },
  cardStats: { flexDirection: 'row', backgroundColor: '#F5F7FF', borderRadius: radius.sm, paddingVertical: spacing.sm, alignItems: 'center' },
  stat:      { flex: 1, alignItems: 'center' },
  statVal:   { fontSize: 13, fontWeight: '800', color: '#0D1B4B' },
  statLabel: { fontSize: 7, fontWeight: '700', color: colors.textMuted, letterSpacing: 1.5, marginTop: 2 },
  statDiv:   { width: 1, height: 24, backgroundColor: '#E0E8F5' },
});
