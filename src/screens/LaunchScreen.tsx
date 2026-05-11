import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNavigation } from '@react-navigation/native';
import type { CompositeNavigationProp } from '@react-navigation/native';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import type { StackNavigationProp } from '@react-navigation/stack';
import { AppCard, SectionHeader, StatusBadge, PrimaryButton, SecondaryButton, DS } from '../components/ds';
import type { RootStackParamList } from '../navigation/RootNavigator';

// ─── Navigation type ──────────────────────────────────────────────────────────

type TabParamList = {
  Launch:    undefined;
  Search:    undefined;
  Calculate: undefined;
  Brand:     undefined;
  CoPilot:   undefined;
};

type NavProp = CompositeNavigationProp<
  BottomTabNavigationProp<TabParamList>,
  StackNavigationProp<RootStackParamList>
>;

// ─── Types ────────────────────────────────────────────────────────────────────

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
    time: '~45 min', color: '#DB2777',
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
    time: '~30 min', color: '#D97706',
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
    time: '~45 min', color: '#059669',
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
    time: '~45 min', color: '#7C3AED',
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

const ALL_IDS     = PHASES.flatMap(p => p.items.map(i => i.id));
const STORAGE_KEY = 'fba_launch_checklist';

// ─── Stage chips config ───────────────────────────────────────────────────────

const STAGE_CHIPS = [
  { phaseId: 'discover',  label: 'Research',   icon: '◎' },
  { phaseId: 'keywords',  label: 'Validation', icon: '≋' },
  { phaseId: 'supplier',  label: 'Sourcing',   icon: '⬡' },
  { phaseId: 'brand',     label: 'Branding',   icon: '✦' },
  { phaseId: 'inventory', label: 'Logistics',  icon: '📦' },
  { phaseId: 'listing',   label: 'Listing',    icon: '≡' },
  { phaseId: 'go',        label: 'Launch',     icon: '🚀' },
] as const;

// ─── Milestones ───────────────────────────────────────────────────────────────

const MILESTONES = [
  { id: 'product_selected',   label: 'Product Selected',    icon: '◎', requiredIds: ['p1','p2','p3','p4','p5'] },
  { id: 'supplier_confirmed', label: 'Supplier Confirmed',  icon: '⬡', requiredIds: ['s1','s2','s3','s4','s5'] },
  { id: 'inventory_ordered',  label: 'Inventory Ordered',   icon: '📦', requiredIds: ['sh1','sh2','sh3','sh4']  },
  { id: 'listing_published',  label: 'Listing Published',   icon: '≡', requiredIds: ['l1','l2','l3','l4','l5','l6'] },
  { id: 'first_sale',         label: 'First Sale',          icon: '🏆', requiredIds: ['la1','la2','la3','la4','la5','la6'] },
];

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

// ─── AI Modal ─────────────────────────────────────────────────────────────────

function AIModal({ aiKey, onClose }: { aiKey: string | null; onClose: () => void }) {
  const g = aiKey ? AI_GUIDE[aiKey] : null;
  return (
    <Modal visible={!!aiKey} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={{ flex: 1, backgroundColor: DS.bgCard }}>
        <View style={aim.header}>
          <View style={aim.iconWrap}>
            <Text style={{ fontSize: 15 }}>✦</Text>
          </View>
          <Text style={aim.title} numberOfLines={2}>{g?.title ?? ''}</Text>
          <TouchableOpacity onPress={onClose} hitSlop={{ top: 16, bottom: 16, left: 16, right: 16 }}>
            <Text style={{ fontSize: 22, color: DS.textMuted, fontWeight: '300' }}>✕</Text>
          </TouchableOpacity>
        </View>
        <ScrollView contentContainerStyle={{ padding: 20, gap: 16, paddingBottom: 40 }}>
          <Text style={aim.body}>{g?.body ?? ''}</Text>
          <View style={aim.tip}>
            <Text style={aim.tipLabel}>✦ AI TIP</Text>
            <Text style={aim.tipBody}>Use the Search, Brand, and Calculate tabs to complete this step faster with Siftly's built-in tools.</Text>
          </View>
        </ScrollView>
        <View style={{ padding: 20, borderTopWidth: 1, borderTopColor: DS.border }}>
          <TouchableOpacity style={aim.btn} onPress={onClose} activeOpacity={0.85}>
            <Text style={aim.btnText}>Got it — back to checklist</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </Modal>
  );
}
const aim = StyleSheet.create({
  header:   { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 20, borderBottomWidth: 1, borderBottomColor: DS.border },
  iconWrap: { width: 36, height: 36, borderRadius: 10, backgroundColor: DS.indigoLight, alignItems: 'center', justifyContent: 'center' },
  title:    { flex: 1, fontSize: 16, fontWeight: '800', color: DS.textPrimary, letterSpacing: -0.3, lineHeight: 22 },
  body:     { fontSize: 14, color: DS.textSecondary, lineHeight: 24 },
  tip:      { backgroundColor: DS.indigoLight, borderRadius: 14, borderWidth: 1, borderColor: DS.border, padding: 14, gap: 6 },
  tipLabel: { fontSize: 9, fontWeight: '800', color: DS.indigo, letterSpacing: 2 },
  tipBody:  { fontSize: 13, color: DS.textSecondary, lineHeight: 20 },
  btn:      { backgroundColor: DS.indigo, borderRadius: 14, paddingVertical: 15, alignItems: 'center' },
  btnText:  { fontSize: 15, fontWeight: '800', color: '#fff' },
});

// ─── Hero progress card ────────────────────────────────────────────────────────

function HeroProgressCard({ checked }: { checked: Set<string> }) {
  const done  = checked.size;
  const total = ALL_IDS.length;
  const pct   = total > 0 ? Math.round((done / total) * 100) : 0;

  const currentPhase = PHASES.find(p => p.items.some(i => !checked.has(i.id)));
  const remaining    = total - done;

  let statusVariant: 'success' | 'warning' | 'info' | 'neutral' = 'neutral';
  let statusLabel = 'Planning';
  if (pct === 100) { statusVariant = 'success'; statusLabel = 'Complete'; }
  else if (pct >= 75) { statusVariant = 'success'; statusLabel = 'Launch Ready'; }
  else if (pct >= 50) { statusVariant = 'info';    statusLabel = 'Validating'; }
  else if (pct >= 25) { statusVariant = 'warning'; statusLabel = 'Building'; }

  return (
    <View style={hero.card}>
      {/* Gradient band */}
      <View style={hero.band} />

      <View style={hero.inner}>
        <View style={hero.topRow}>
          <View style={{ flex: 1 }}>
            <Text style={hero.eyebrow}>OVERALL PROGRESS</Text>
            <Text style={hero.pct}>{pct}%</Text>
            <Text style={hero.subtitle}>
              {done} of {total} tasks complete
            </Text>
          </View>
          <View style={hero.ringWrap}>
            <MiniRing percent={pct} />
          </View>
        </View>

        {/* Progress bar */}
        <View style={hero.barTrack}>
          <View style={[hero.barFill, { width: `${pct}%` as any }]} />
        </View>

        {/* Footer strip */}
        <View style={hero.footer}>
          <StatusBadge label={statusLabel} variant={statusVariant} dot />
          {currentPhase && (
            <Text style={hero.footerRight}>
              Up next: {currentPhase.icon} {currentPhase.title}
            </Text>
          )}
          {!currentPhase && pct === 100 && (
            <Text style={hero.footerRight}>Journey complete 🏆</Text>
          )}
        </View>

        {/* Stats row */}
        <View style={hero.statsRow}>
          <View style={hero.stat}>
            <Text style={[hero.statVal, { color: DS.accent }]}>{done}</Text>
            <Text style={hero.statLabel}>DONE</Text>
          </View>
          <View style={hero.statDiv} />
          <View style={hero.stat}>
            <Text style={[hero.statVal, { color: DS.indigo }]}>{remaining}</Text>
            <Text style={hero.statLabel}>LEFT</Text>
          </View>
          <View style={hero.statDiv} />
          <View style={hero.stat}>
            <Text style={[hero.statVal, { color: DS.textPrimary }]}>{PHASES.length}</Text>
            <Text style={hero.statLabel}>STAGES</Text>
          </View>
          <View style={hero.statDiv} />
          <View style={hero.stat}>
            <Text style={[hero.statVal, { color: '#D97706' }]}>
              {MILESTONES.filter(m => m.requiredIds.every(id => checked.has(id))).length}
            </Text>
            <Text style={hero.statLabel}>MILESTONES</Text>
          </View>
        </View>
      </View>
    </View>
  );
}

function MiniRing({ percent }: { percent: number }) {
  const size   = 64;
  const half   = size / 2;
  const stroke = 6;
  const inner  = size - stroke * 2;
  const deg    = (percent / 100) * 360;
  const right  = Math.min(0, deg - 180);
  const left   = 180 - Math.max(0, deg - 180);

  return (
    <View style={{ width: size, height: size }}>
      <View style={[StyleSheet.absoluteFillObject, { borderRadius: half, backgroundColor: DS.border }]} />
      <View style={{ position: 'absolute', left: half, top: 0, width: half, height: size, overflow: 'hidden' }}>
        <View style={{
          position: 'absolute', left: -half, top: 0, width: size, height: size,
          borderRadius: half, backgroundColor: DS.accent,
          transform: [{ rotate: `${right}deg` }],
        }} />
      </View>
      <View style={{ position: 'absolute', left: 0, top: 0, width: half, height: size, overflow: 'hidden' }}>
        <View style={{
          position: 'absolute', left: 0, top: 0, width: size, height: size,
          borderRadius: half, backgroundColor: DS.accent,
          transform: [{ rotate: `${left}deg` }],
        }} />
      </View>
      <View style={{
        position: 'absolute', top: stroke, left: stroke,
        width: inner, height: inner, borderRadius: inner / 2,
        backgroundColor: DS.bgCard, alignItems: 'center', justifyContent: 'center',
      }}>
        <Text style={{ fontSize: 13, fontWeight: '900', color: DS.accent, letterSpacing: -0.5 }}>{percent}%</Text>
      </View>
    </View>
  );
}

const hero = StyleSheet.create({
  card:       { borderRadius: 24, overflow: 'hidden', borderWidth: 1, borderColor: DS.border, backgroundColor: DS.bgCard },
  band:       { height: 4, backgroundColor: DS.accent },
  inner:      { padding: 18, gap: 14 },
  topRow:     { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  eyebrow:    { fontSize: 9, fontWeight: '800', color: DS.accent, letterSpacing: 2.5, marginBottom: 4 },
  pct:        { fontSize: 38, fontWeight: '900', color: DS.textPrimary, letterSpacing: -1.5, lineHeight: 42 },
  subtitle:   { fontSize: 13, color: DS.textSecondary, marginTop: 4 },
  ringWrap:   { paddingTop: 4 },
  barTrack:   { height: 6, backgroundColor: DS.border, borderRadius: 3 },
  barFill:    { height: 6, backgroundColor: DS.accent, borderRadius: 3 },
  footer:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  footerRight:{ fontSize: 11, color: DS.textMuted, flex: 1, textAlign: 'right' },
  statsRow:   { flexDirection: 'row', backgroundColor: DS.bgSubtle, borderRadius: 12, paddingVertical: 12, borderWidth: 1, borderColor: DS.border },
  stat:       { flex: 1, alignItems: 'center', gap: 2 },
  statVal:    { fontSize: 16, fontWeight: '900', letterSpacing: -0.5 },
  statLabel:  { fontSize: 7, fontWeight: '700', color: DS.textMuted, letterSpacing: 1.5 },
  statDiv:    { width: 1, backgroundColor: DS.border },
});

// ─── Stage chips ──────────────────────────────────────────────────────────────

function StageChips({
  selected,
  checked,
  onSelect,
}: {
  selected: string;
  checked: Set<string>;
  onSelect: (id: string) => void;
}) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={sc.row}
    >
      {STAGE_CHIPS.map(stage => {
        const phase     = PHASES.find(p => p.id === stage.phaseId)!;
        const done      = phase.items.filter(i => checked.has(i.id)).length;
        const total     = phase.items.length;
        const phaseDone = done === total;
        const isActive  = selected === stage.phaseId;

        return (
          <TouchableOpacity
            key={stage.phaseId}
            style={[
              sc.chip,
              isActive && { backgroundColor: phase.color, borderColor: phase.color },
              phaseDone && !isActive && { borderColor: DS.accent + '60' },
            ]}
            onPress={() => onSelect(stage.phaseId)}
            activeOpacity={0.75}
          >
            <Text style={sc.chipIcon}>{stage.icon}</Text>
            <Text style={[sc.chipLabel, isActive && { color: '#fff' }]}>{stage.label}</Text>
            <View style={[sc.chipPct, isActive && { backgroundColor: 'rgba(255,255,255,0.25)' }]}>
              <Text style={[sc.chipPctText, isActive && { color: '#fff' }]}>
                {done}/{total}
              </Text>
            </View>
            {phaseDone && (
              <View style={sc.doneCheck}>
                <Text style={{ fontSize: 7, color: DS.accent, fontWeight: '900' }}>✓</Text>
              </View>
            )}
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );
}

const sc = StyleSheet.create({
  row:          { paddingHorizontal: DS.pagePadding, gap: 8 },
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: DS.bgCard, borderRadius: 20, borderWidth: 1, borderColor: DS.border,
    paddingHorizontal: 12, paddingVertical: 8,
  },
  chipIcon:     { fontSize: 13 },
  chipLabel:    { fontSize: 12, fontWeight: '700', color: DS.textSecondary },
  chipPct: {
    backgroundColor: DS.bgSubtle, borderRadius: 8,
    paddingHorizontal: 6, paddingVertical: 2,
  },
  chipPctText:  { fontSize: 9, fontWeight: '700', color: DS.textMuted },
  doneCheck: {
    width: 14, height: 14, borderRadius: 7, backgroundColor: DS.accentLight,
    alignItems: 'center', justifyContent: 'center',
  },
});

// ─── Task list card ───────────────────────────────────────────────────────────

const PRIORITY: Record<number, { label: string; color: string; bg: string }> = {
  0: { label: 'HIGH',   color: '#DC2626', bg: '#FEF2F2' },
  1: { label: 'HIGH',   color: '#DC2626', bg: '#FEF2F2' },
  2: { label: 'MED',    color: '#D97706', bg: '#FFFBEB' },
  3: { label: 'MED',    color: '#D97706', bg: '#FFFBEB' },
  4: { label: 'STD',    color: DS.textMuted, bg: DS.bgSubtle },
  5: { label: 'STD',    color: DS.textMuted, bg: DS.bgSubtle },
};

function TaskListCard({
  phaseId, checked, onToggle, onAI,
}: {
  phaseId: string;
  checked: Set<string>;
  onToggle: (id: string) => void;
  onAI: (k: string) => void;
}) {
  const phase = PHASES.find(p => p.id === phaseId);
  if (!phase) return null;

  const done  = phase.items.filter(i => checked.has(i.id)).length;
  const total = phase.items.length;
  const pct   = Math.round((done / total) * 100);

  return (
    <AppCard>
      {/* Header */}
      <View style={tl.header}>
        <View style={[tl.iconBadge, { backgroundColor: phase.color + '18' }]}>
          <Text style={{ fontSize: 16 }}>{phase.icon}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={tl.phaseNum}>PHASE {phase.num}</Text>
          <Text style={tl.phaseTitle}>{phase.title}</Text>
        </View>
        <View style={tl.progress}>
          <Text style={[tl.progressPct, { color: done === total ? DS.accent : phase.color }]}>
            {pct}%
          </Text>
          <Text style={tl.progressSub}>{done}/{total}</Text>
        </View>
      </View>

      {/* Progress bar */}
      <View style={tl.barTrack}>
        <View style={[tl.barFill, { width: `${pct}%` as any, backgroundColor: done === total ? DS.accent : phase.color }]} />
      </View>

      {/* Task rows */}
      <View style={tl.tasks}>
        {phase.items.map((item, idx) => {
          const isDone = checked.has(item.id);
          const pri    = PRIORITY[idx] ?? PRIORITY[4];
          return (
            <View key={item.id} style={[tl.row, idx < phase.items.length - 1 && tl.rowBorder]}>
              {/* Checkbox */}
              <TouchableOpacity
                style={[tl.checkbox, isDone && { backgroundColor: phase.color, borderColor: phase.color }]}
                onPress={() => onToggle(item.id)}
                activeOpacity={0.7}
              >
                {isDone && <Text style={tl.checkmark}>✓</Text>}
              </TouchableOpacity>

              {/* Text */}
              <TouchableOpacity style={{ flex: 1 }} onPress={() => onToggle(item.id)} activeOpacity={0.7}>
                <Text style={[tl.taskText, isDone && tl.taskDone]}>{item.text}</Text>
              </TouchableOpacity>

              {/* Right: priority + AI btn */}
              <View style={tl.rightCol}>
                <View style={[tl.priBadge, { backgroundColor: pri.bg }]}>
                  <Text style={[tl.priText, { color: pri.color }]}>{pri.label}</Text>
                </View>
                <TouchableOpacity
                  style={[tl.aiBtn, { backgroundColor: phase.color + '14', borderColor: phase.color + '40' }]}
                  onPress={() => onAI(item.aiKey)}
                  activeOpacity={0.75}
                >
                  <Text style={[tl.aiBtnText, { color: phase.color }]}>✦ AI</Text>
                </TouchableOpacity>
              </View>
            </View>
          );
        })}
      </View>

      {/* Phase desc */}
      <View style={[tl.descBand, { backgroundColor: phase.color + '0C', borderColor: phase.color + '25' }]}>
        <Text style={tl.descIcon}>💡</Text>
        <Text style={tl.descText}>{phase.desc}</Text>
      </View>
    </AppCard>
  );
}

const tl = StyleSheet.create({
  header:      { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12 },
  iconBadge:   { width: 42, height: 42, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  phaseNum:    { fontSize: 8, fontWeight: '800', color: DS.textMuted, letterSpacing: 2 },
  phaseTitle:  { fontSize: 15, fontWeight: '800', color: DS.textPrimary, letterSpacing: -0.3 },
  progress:    { alignItems: 'flex-end' },
  progressPct: { fontSize: 18, fontWeight: '900', letterSpacing: -0.5 },
  progressSub: { fontSize: 9, color: DS.textMuted, fontWeight: '600' },

  barTrack:   { height: 4, backgroundColor: DS.border, borderRadius: 2, marginBottom: 16 },
  barFill:    { height: 4, borderRadius: 2 },

  tasks:    { gap: 0 },
  row:      { flexDirection: 'row', alignItems: 'flex-start', paddingVertical: 12, gap: 10 },
  rowBorder:{ borderBottomWidth: 1, borderBottomColor: DS.border },

  checkbox: {
    width: 22, height: 22, borderRadius: 6, borderWidth: 1.5, borderColor: DS.border,
    backgroundColor: DS.bgCard, alignItems: 'center', justifyContent: 'center',
    marginTop: 1, flexShrink: 0,
  },
  checkmark: { fontSize: 11, color: '#fff', fontWeight: '900' },
  taskText:  { fontSize: 13, color: DS.textSecondary, lineHeight: 20 },
  taskDone:  { color: DS.textMuted, textDecorationLine: 'line-through' },

  rightCol:  { alignItems: 'flex-end', gap: 4, flexShrink: 0 },
  priBadge:  { borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 },
  priText:   { fontSize: 8, fontWeight: '800', letterSpacing: 1 },
  aiBtn:     { borderRadius: 10, borderWidth: 1, paddingHorizontal: 8, paddingVertical: 4 },
  aiBtnText: { fontSize: 9, fontWeight: '900', letterSpacing: 0.3 },

  descBand: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginTop: 14, borderRadius: 10, borderWidth: 1, padding: 10 },
  descIcon: { fontSize: 13, marginTop: 1 },
  descText: { flex: 1, fontSize: 12, color: DS.textSecondary, lineHeight: 18 },
});

// ─── Stage summary card ───────────────────────────────────────────────────────

function StageSummaryCard({ phaseId, checked }: { phaseId: string; checked: Set<string> }) {
  const phase = PHASES.find(p => p.id === phaseId);
  if (!phase) return null;

  const done        = phase.items.filter(i => checked.has(i.id)).length;
  const remaining   = phase.items.length - done;
  const nextTask    = phase.items.find(i => !checked.has(i.id));
  const isComplete  = remaining === 0;

  return (
    <AppCard>
      <Text style={ss.heading}>Stage Summary</Text>
      <View style={ss.row}>
        <View style={ss.stat}>
          <Text style={[ss.val, { color: DS.accent }]}>{done}</Text>
          <Text style={ss.lbl}>Completed</Text>
        </View>
        <View style={ss.div} />
        <View style={ss.stat}>
          <Text style={[ss.val, { color: DS.indigo }]}>{remaining}</Text>
          <Text style={ss.lbl}>Remaining</Text>
        </View>
        <View style={ss.div} />
        <View style={ss.stat}>
          <Text style={[ss.val, { color: DS.textPrimary }]}>{phase.items.length}</Text>
          <Text style={ss.lbl}>Total</Text>
        </View>
        <View style={ss.div} />
        <View style={ss.stat}>
          <Text style={ss.time}>{phase.time}</Text>
          <Text style={ss.lbl}>Est. Time</Text>
        </View>
      </View>
      {!isComplete && nextTask && (
        <View style={ss.nextBand}>
          <Text style={ss.nextLabel}>NEXT TASK</Text>
          <Text style={ss.nextText}>{nextTask.text}</Text>
        </View>
      )}
      {isComplete && (
        <View style={[ss.nextBand, { backgroundColor: DS.accentLight, borderColor: DS.accent + '40' }]}>
          <Text style={[ss.nextLabel, { color: DS.accent }]}>STAGE COMPLETE</Text>
          <Text style={[ss.nextText, { color: DS.accentDark }]}>All tasks done — move to the next stage!</Text>
        </View>
      )}
    </AppCard>
  );
}

const ss = StyleSheet.create({
  heading:  { fontSize: 14, fontWeight: '800', color: DS.textPrimary, marginBottom: 12 },
  row:      { flexDirection: 'row', backgroundColor: DS.bgSubtle, borderRadius: 12, paddingVertical: 14, borderWidth: 1, borderColor: DS.border, marginBottom: 12 },
  stat:     { flex: 1, alignItems: 'center', gap: 2 },
  val:      { fontSize: 20, fontWeight: '900', letterSpacing: -0.5 },
  time:     { fontSize: 13, fontWeight: '800', color: DS.textPrimary },
  lbl:      { fontSize: 8, fontWeight: '700', color: DS.textMuted, letterSpacing: 1.2 },
  div:      { width: 1, backgroundColor: DS.border },
  nextBand: { backgroundColor: DS.indigoLight, borderRadius: 10, borderWidth: 1, borderColor: DS.border, padding: 12, gap: 4 },
  nextLabel:{ fontSize: 8, fontWeight: '800', color: DS.indigo, letterSpacing: 2 },
  nextText: { fontSize: 13, color: DS.textSecondary, lineHeight: 19 },
});

// ─── Milestones card ──────────────────────────────────────────────────────────

function MilestonesCard({ checked }: { checked: Set<string> }) {
  const completedCount = MILESTONES.filter(m => m.requiredIds.every(id => checked.has(id))).length;

  return (
    <AppCard>
      <View style={ms.header}>
        <Text style={ms.heading}>Milestones</Text>
        <StatusBadge label={`${completedCount}/${MILESTONES.length} reached`} variant={completedCount > 0 ? 'success' : 'neutral'} />
      </View>
      <View style={ms.list}>
        {MILESTONES.map((m, idx) => {
          const done = m.requiredIds.every(id => checked.has(id));
          const isLast = idx === MILESTONES.length - 1;
          return (
            <View key={m.id} style={ms.item}>
              {/* Connector line */}
              <View style={ms.connectorCol}>
                <View style={[ms.dot, done && { backgroundColor: DS.accent, borderColor: DS.accent }]}>
                  {done && <Text style={{ fontSize: 9, color: '#fff', fontWeight: '900' }}>✓</Text>}
                </View>
                {!isLast && <View style={[ms.line, done && { backgroundColor: DS.accent }]} />}
              </View>
              {/* Content */}
              <View style={[ms.content, !isLast && { paddingBottom: 20 }]}>
                <Text style={ms.icon}>{m.icon}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={[ms.label, done && { color: DS.accent }]}>{m.label}</Text>
                  <Text style={ms.sub}>{m.requiredIds.length} tasks required</Text>
                </View>
                {done && (
                  <View style={ms.doneBadge}>
                    <Text style={ms.doneText}>Reached</Text>
                  </View>
                )}
              </View>
            </View>
          );
        })}
      </View>
    </AppCard>
  );
}

const ms = StyleSheet.create({
  header:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 },
  heading: { fontSize: 14, fontWeight: '800', color: DS.textPrimary },
  list:    { gap: 0 },
  item:    { flexDirection: 'row', gap: 12 },
  connectorCol: { width: 20, alignItems: 'center' },
  dot: {
    width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: DS.border,
    backgroundColor: DS.bgCard, alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  line:    { flex: 1, width: 2, backgroundColor: DS.border, marginTop: 2 },
  content: { flex: 1, flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  icon:    { fontSize: 16, marginTop: 1 },
  label:   { fontSize: 13, fontWeight: '700', color: DS.textPrimary },
  sub:     { fontSize: 11, color: DS.textMuted, marginTop: 2 },
  doneBadge: { backgroundColor: DS.accentLight, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3, borderWidth: 1, borderColor: DS.accent + '40' },
  doneText:  { fontSize: 9, fontWeight: '800', color: DS.accentDark, letterSpacing: 0.5 },
});

// ─── Smart recommendations ────────────────────────────────────────────────────

function SmartRecommendationsCard({ checked }: { checked: Set<string> }) {
  const pct = ALL_IDS.length > 0 ? (checked.size / ALL_IDS.length) * 100 : 0;

  const tips: Array<{ icon: string; title: string; body: string; color: string }> = pct < 25
    ? [
        { icon: '◎', title: 'Validate demand first', body: 'Always confirm 3+ demand signals before sourcing suppliers. BSR, Google Trends, and autocomplete are your trinity.', color: '#4361EE' },
        { icon: '≋', title: 'Keywords drive ranking', body: 'Build your keyword list in parallel with product research — it shapes your listing before you write a single word.', color: '#D97706' },
        { icon: '◈', title: 'Start with your profit target', body: 'Work backwards from a 30%+ margin. Use the Calculate tab to stress-test your unit economics early.', color: '#7C3AED' },
      ]
    : pct < 60
    ? [
        { icon: '⬡', title: 'Shortlist 3 suppliers', body: 'Get quotes from at least 3 factories. Compare MOQ, lead time, and sample quality side-by-side before committing.', color: '#059669' },
        { icon: '✦', title: 'Register your brand early', body: 'Amazon Brand Registry takes 2–4 weeks. Start your trademark application now to unlock A+ Content at launch.', color: '#DB2777' },
        { icon: '≡', title: 'Draft your listing copy', body: 'Write your title and 5 bullets before product arrives. Use your keyword list as the foundation.', color: '#7C3AED' },
      ]
    : [
        { icon: '📦', title: 'Inventory timing is critical', body: 'Never run out of stock in the first 90 days. It kills your BSR and is very hard to recover from.', color: '#F59E0B' },
        { icon: '🚀', title: 'Launch price strategy', body: 'Price 10–15% below median competitors. Raise to median after 20 reviews, then above after 50+.', color: '#7C3AED' },
        { icon: '◉', title: 'PPC: auto first, then manual', body: 'Run auto campaigns for 2 weeks. Mine the Search Term Report and move winners to manual exact-match campaigns.', color: '#4361EE' },
      ];

  return (
    <AppCard>
      <View style={sr.header}>
        <Text style={sr.heading}>Smart Recommendations</Text>
        <StatusBadge label="AI" variant="info" />
      </View>
      <View style={sr.list}>
        {tips.map((tip, idx) => (
          <View key={idx} style={[sr.item, idx < tips.length - 1 && sr.itemBorder]}>
            <View style={[sr.iconBadge, { backgroundColor: tip.color + '14' }]}>
              <Text style={{ fontSize: 14 }}>{tip.icon}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={sr.title}>{tip.title}</Text>
              <Text style={sr.body}>{tip.body}</Text>
            </View>
          </View>
        ))}
      </View>
    </AppCard>
  );
}

const sr = StyleSheet.create({
  header:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 },
  heading:   { fontSize: 14, fontWeight: '800', color: DS.textPrimary },
  list:      { gap: 0 },
  item:      { flexDirection: 'row', alignItems: 'flex-start', gap: 12, paddingVertical: 12 },
  itemBorder:{ borderBottomWidth: 1, borderBottomColor: DS.border },
  iconBadge: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  title:     { fontSize: 13, fontWeight: '700', color: DS.textPrimary, marginBottom: 4 },
  body:      { fontSize: 12, color: DS.textSecondary, lineHeight: 18 },
});

// ─── Primary actions card ─────────────────────────────────────────────────────

function PrimaryActionsCard({
  checked, onToggle, onOpenAI,
}: {
  checked: Set<string>;
  onToggle: (id: string) => void;
  onOpenAI: (k: string) => void;
}) {
  const navigation = useNavigation<NavProp>();
  const nextTask = PHASES.flatMap(p => p.items).find(i => !checked.has(i.id));

  function handleMarkNext() {
    if (nextTask) onToggle(nextTask.id);
  }

  return (
    <AppCard>
      <Text style={pa.heading}>Primary Actions</Text>
      <View style={pa.btns}>
        <PrimaryButton
          label={nextTask ? 'Mark Next Task Complete' : 'All Tasks Complete!'}
          onPress={handleMarkNext}
          disabled={!nextTask}
          style={{ alignSelf: 'stretch' }}
        />
        <SecondaryButton
          label="Ask Co-Pilot for Guidance"
          onPress={() => navigation.navigate('CoPilot')}
          style={{ alignSelf: 'stretch' }}
        />
      </View>
      {nextTask && (
        <View style={pa.nextBand}>
          <Text style={pa.nextLabel}>NEXT TASK</Text>
          <Text style={pa.nextTask}>{nextTask.text}</Text>
        </View>
      )}
    </AppCard>
  );
}

const pa = StyleSheet.create({
  heading:   { fontSize: 14, fontWeight: '800', color: DS.textPrimary, marginBottom: 14 },
  btns:      { gap: 10 },
  nextBand:  { marginTop: 12, backgroundColor: DS.indigoLight, borderRadius: 10, borderWidth: 1, borderColor: DS.border, padding: 12, gap: 4 },
  nextLabel: { fontSize: 8, fontWeight: '800', color: DS.indigo, letterSpacing: 2 },
  nextTask:  { fontSize: 13, color: DS.textSecondary, lineHeight: 19 },
});

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function LaunchScreen() {
  const [checked,     setChecked]     = useState<Set<string>>(new Set());
  const [selectedId,  setSelectedId]  = useState<string>(PHASES[0].id);
  const [aiKey,       setAiKey]       = useState<string | null>(null);
  const scrollRef = useRef<ScrollView>(null);

  useEffect(() => { loadChecklist(); }, []);

  async function loadChecklist() {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (raw) {
      try { setChecked(new Set(JSON.parse(raw))); } catch { /* ignore */ }
    }
  }

  async function toggle(id: string) {
    setChecked(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      AsyncStorage.setItem(STORAGE_KEY, JSON.stringify([...next]));
      return next;
    });
  }

  const onSelectStage = useCallback((id: string) => {
    setSelectedId(id);
    scrollRef.current?.scrollTo({ y: 0, animated: false });
  }, []);

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <AIModal aiKey={aiKey} onClose={() => setAiKey(null)} />

      {/* Pinned header */}
      <View style={s.header}>
        <View>
          <Text style={s.eyebrow}>LAUNCH SYSTEM</Text>
          <Text style={s.title}>Your Product Launch Roadmap</Text>
        </View>
      </View>

      {/* Stage chips (pinned below header) */}
      <View style={s.chipsWrap}>
        <StageChips selected={selectedId} checked={checked} onSelect={onSelectStage} />
      </View>

      <ScrollView
        ref={scrollRef}
        contentContainerStyle={s.scroll}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <HeroProgressCard checked={checked} />

        <SectionHeader title="Stage Tasks" />
        <TaskListCard phaseId={selectedId} checked={checked} onToggle={toggle} onAI={setAiKey} />

        <SectionHeader title="Stage Overview" />
        <StageSummaryCard phaseId={selectedId} checked={checked} />

        <SectionHeader title="Milestones" />
        <MilestonesCard checked={checked} />

        <SectionHeader title="Smart Recommendations" />
        <SmartRecommendationsCard checked={checked} />

        <SectionHeader title="Actions" />
        <PrimaryActionsCard checked={checked} onToggle={toggle} onOpenAI={setAiKey} />

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  safe:  { flex: 1, backgroundColor: DS.bgCanvas },

  header: {
    paddingHorizontal: DS.pagePadding,
    paddingTop: 10,
    paddingBottom: 12,
    backgroundColor: DS.bgCard,
    borderBottomWidth: 1,
    borderBottomColor: DS.border,
  },
  eyebrow: { fontSize: 9, fontWeight: '800', color: DS.accent, letterSpacing: 2.5, marginBottom: 2 },
  title:   { fontSize: 20, fontWeight: '900', color: DS.textPrimary, letterSpacing: -0.7 },

  chipsWrap: {
    paddingVertical: 12,
    backgroundColor: DS.bgCard,
    borderBottomWidth: 1,
    borderBottomColor: DS.border,
  },

  scroll: {
    paddingHorizontal: DS.pagePadding,
    paddingTop: 16,
    paddingBottom: 120,
    gap: 12,
  },
});
