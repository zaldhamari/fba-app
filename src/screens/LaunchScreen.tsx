import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  Modal, ActivityIndicator, Animated,
} from 'react-native';
import { api } from '../services/api';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNavigation } from '@react-navigation/native';
import type { CompositeNavigationProp } from '@react-navigation/native';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import type { StackNavigationProp } from '@react-navigation/stack';
import { AppCard, SectionHeader, StatusBadge, SecondaryButton, DS } from '../components/ds';
import { HelpButton } from '../components/HelpModal';
import type { FeatureKey } from '../lib/featureHelp';
import type { RootStackParamList } from '../navigation/RootNavigator';

// ─── Navigation type ──────────────────────────────────────────────────────────

import type { TabParamList } from '../navigation/tabTypes';

type NavProp = CompositeNavigationProp<
  BottomTabNavigationProp<TabParamList>,
  StackNavigationProp<RootStackParamList>
>;

import { CLPhase, PHASES, ALL_IDS, LAUNCH_CHECKLIST_KEY, MILESTONES } from '../data/launchPhases';
import { STORAGE_KEYS } from '../constants/storage';
import type { LaunchAdvisorSnapshot } from '../lib/launchDecision';
import { useActiveProduct } from '../context/ActiveProductContext';

// ─── Types ────────────────────────────────────────────────────────────────────

type Phase = CLPhase;

const STORAGE_KEY = LAUNCH_CHECKLIST_KEY;

// ─── Stage → help key mapping ─────────────────────────────────────────────────

const STAGE_HELP: Record<string, FeatureKey> = {
  discover:  'checklist_discover',
  brand:     'checklist_brand',
  keywords:  'checklist_keywords',
  supplier:  'checklist_supplier',
  listing:   'checklist_listing',
  inventory: 'checklist_inventory',
  go:        'checklist_go',
};

// ─── Stage chips config ───────────────────────────────────────────────────────

const STAGE_CHIPS = [
  { phaseId: 'discover',  label: 'Research',   icon: '◎' },
  { phaseId: 'brand',     label: 'Branding',   icon: '✦' },
  { phaseId: 'keywords',  label: 'Validation', icon: '≋' },
  { phaseId: 'supplier',  label: 'Sourcing',   icon: '⬡' },
  { phaseId: 'listing',   label: 'Listing',    icon: '≡' },
  { phaseId: 'inventory', label: 'Logistics',  icon: '📦' },
  { phaseId: 'go',        label: 'Launch',     icon: '🚀' },
] as const;

// ─── Milestones ───────────────────────────────────────────────────────────────


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
  tax: { title: 'Tax Interview & Bank Account',
    body: 'Amazon requires you to complete a tax interview before you can sell.\n\nSteps:\n1. Seller Central → Settings → Account Info → Tax Information\n2. Choose Individual or Business entity\n3. Enter SSN (individual) or EIN (business)\n4. Add your bank account under "Deposit Methods"\n5. Bank verification takes 3–5 business days\n\nTip: Use a dedicated business bank account — keeps personal and seller income separate for tax purposes.' },
  barcode: { title: 'Getting a GS1 UPC Barcode',
    body: 'Amazon requires a GS1-issued barcode for most products.\n\nSteps:\n1. Go to gs1us.org and register a GS1 Company Prefix\n2. Generate a UPC barcode for your product\n3. Add the GTIN to your Seller Central listing\n\nCost: ~$250/year for up to 10 barcodes.\n\nImportant: Do NOT buy cheap barcodes from third-party resellers — Amazon has cracked down and will suppress listings using non-GS1 barcodes.\n\nBrand Registry members can use Amazon\'s own FNSKU barcode instead.' },
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
            <Text style={aim.btnText}>Got it — back to plan</Text>
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
  if (pct === 100) { statusVariant = 'info'; statusLabel = 'Complete'; }
  else if (pct >= 75) { statusVariant = 'info'; statusLabel = 'Launch Ready'; }
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
            <Text style={[hero.statVal, { color: '#2563EB' }]}>
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

  const done       = phase.items.filter(i => checked.has(i.id)).length;
  const total      = phase.items.length;
  const pct        = Math.round((done / total) * 100);
  const nextTask   = phase.items.find(i => !checked.has(i.id));
  const isComplete = done === total;

  return (
    <AppCard>
      {/* Header */}
      <View style={tl.header}>
        <View style={[tl.iconBadge, { backgroundColor: phase.color + '18' }]}>
          <Text style={{ fontSize: 16 }}>{phase.icon}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={tl.phaseNum}>PHASE {phase.num} · {phase.time}</Text>
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
          return (
            <View
              key={item.id}
              style={[
                tl.row,
                idx < phase.items.length - 1 && tl.rowBorder,
                isDone && { backgroundColor: phase.color + '0D', borderRadius: 10, marginHorizontal: -4, paddingHorizontal: 4 },
              ]}
            >
              <TouchableOpacity
                style={[tl.checkbox, isDone && { backgroundColor: phase.color, borderColor: phase.color }]}
                onPress={() => onToggle(item.id)}
                activeOpacity={0.7}
              >
                {isDone && <Text style={tl.checkmark}>✓</Text>}
              </TouchableOpacity>

              <TouchableOpacity style={{ flex: 1 }} onPress={() => onToggle(item.id)} activeOpacity={0.7}>
                <Text style={[tl.taskText, isDone && { color: phase.color, fontWeight: '600' }]}>{item.text}</Text>
              </TouchableOpacity>

              {isDone ? (
                <View style={[tl.doneTag, { backgroundColor: phase.color + '20', borderColor: phase.color + '40' }]}>
                  <Text style={[tl.doneTagText, { color: phase.color }]}>Done</Text>
                </View>
              ) : (
                <TouchableOpacity
                  style={[tl.aiBtn, { backgroundColor: phase.color + '14', borderColor: phase.color + '40' }]}
                  onPress={() => onAI(item.aiKey)}
                  activeOpacity={0.75}
                >
                  <Text style={[tl.aiBtnText, { color: phase.color }]}>✦ AI</Text>
                </TouchableOpacity>
              )}
            </View>
          );
        })}
      </View>

      {/* Next task / stage complete band */}
      {!isComplete && nextTask && (
        <View style={tl.nextBand}>
          <Text style={tl.nextLabel}>NEXT TASK</Text>
          <Text style={tl.nextText}>{nextTask.text}</Text>
        </View>
      )}
      {isComplete && (
        <View style={[tl.nextBand, { backgroundColor: DS.accentLight, borderColor: DS.accent + '40' }]}>
          <Text style={[tl.nextLabel, { color: DS.accent }]}>STAGE COMPLETE</Text>
          <Text style={[tl.nextText, { color: DS.accentDark }]}>All tasks done — move to the next stage!</Text>
        </View>
      )}

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

  aiBtn:     { borderRadius: 10, borderWidth: 1, paddingHorizontal: 8, paddingVertical: 4, flexShrink: 0 },
  aiBtnText: { fontSize: 9, fontWeight: '900', letterSpacing: 0.3 },
  doneTag:   { borderRadius: 8, borderWidth: 1, paddingHorizontal: 8, paddingVertical: 4, flexShrink: 0 },
  doneTagText:{ fontSize: 9, fontWeight: '800', letterSpacing: 0.3 },

  nextBand:  { marginTop: 12, backgroundColor: DS.indigoLight, borderRadius: 10, borderWidth: 1, borderColor: DS.border, padding: 12, gap: 4 },
  nextLabel: { fontSize: 8, fontWeight: '800', color: DS.indigo, letterSpacing: 2 },
  nextText:  { fontSize: 13, color: DS.textSecondary, lineHeight: 19 },

  descBand: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginTop: 14, borderRadius: 10, borderWidth: 1, padding: 10 },
  descIcon: { fontSize: 13, marginTop: 1 },
  descText: { flex: 1, fontSize: 12, color: DS.textSecondary, lineHeight: 18 },
});

// ─── Milestones card ──────────────────────────────────────────────────────────

function MilestonesCard({ checked }: { checked: Set<string> }) {
  const completedCount = MILESTONES.filter(m => m.requiredIds.every(id => checked.has(id))).length;

  return (
    <AppCard>
      <View style={ms.header}>
        <Text style={ms.heading}>Milestones</Text>
        <StatusBadge label={`${completedCount}/${MILESTONES.length} reached`} variant={completedCount > 0 ? 'info' : 'neutral'} />
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

type Tip = { icon: string; title: string; body: string; color: string };

const STAGE_TIPS: Record<string, Tip[]> = {
  discover: [
    { icon: '◎', title: 'Validate demand first',       body: 'Confirm 3+ demand signals before anything else: BSR under 100k, Google Trends stable or rising, and Amazon autocomplete confirming buyer searches.', color: '#2563EB' },
    { icon: '≋', title: 'Check competitor review counts', body: 'Top 3 results with under 1,000 reviews is your green light. Under 300 is easy entry — over 1,000, move on.', color: '#2563EB' },
    { icon: '◈', title: 'Model profit before falling in love', body: 'Work backwards from a 30%+ margin. Use the Calculate tab to stress-test unit economics before committing.', color: '#2563EB' },
  ],
  brand: [
    { icon: '✦', title: 'Pick a short, ownable name',   body: '1–2 syllables, no numbers or hyphens. Check trademark at USPTO.gov and .com availability before committing.', color: '#2563EB' },
    { icon: '⊡', title: 'Start Brand Registry early',   body: 'Amazon Brand Registry requires a trademark — apply now. Approval takes 2–4 weeks and unlocks A+ Content at launch.', color: '#2563EB' },
    { icon: '◈', title: 'Professional account only',    body: 'Always choose Professional ($39.99/mo). You cannot run Sponsored Products or win the Buy Box on an Individual account.', color: '#2563EB' },
  ],
  keywords: [
    { icon: '≋', title: 'Mine Amazon autocomplete',     body: 'Type your main keyword into Amazon search and note every suggestion — these are real buyer searches, not estimates.', color: '#2563EB' },
    { icon: '◎', title: 'Purchase intent over volume',  body: 'A keyword with 3,000 high-intent searches beats 30,000 browse searches. Validate that people are buying, not just looking.', color: '#2563EB' },
    { icon: '⊡', title: 'Backend: 249 bytes, no repeats', body: "Don't repeat words from your title or bullets. Use synonyms, misspellings, and Spanish variants for US products.", color: '#2563EB' },
  ],
  supplier: [
    { icon: '⬡', title: 'Always sample 3+ factories',   body: 'Never commit to bulk without comparing samples side-by-side. Evaluate build quality, packaging options, and communication speed.', color: '#2563EB' },
    { icon: '◈', title: 'Negotiate standard payment terms', body: 'Standard is 30% deposit, 70% before shipment. For large orders, push for escrow or letter of credit on the balance.', color: '#2563EB' },
    { icon: '⊡', title: 'Sea vs air vs express',        body: 'Sea: over 200 kg, 25–35 days. Air: 50–300 kg, 5–8 days. Express: under 50 kg, 2–4 days. Use the Calculate tab to compare landed cost.', color: '#2563EB' },
  ],
  listing: [
    { icon: '≡', title: 'Title formula',                body: 'Main keyword + secondary keyword + key feature + brand + count/size. Keep it 150–200 characters. Lead with your #1 keyword.', color: '#2563EB' },
    { icon: '◎', title: 'Images convert more than copy', body: '7+ images minimum. White background for the main. Add lifestyle, scale reference, and infographic shots to the set.', color: '#2563EB' },
    { icon: '⊡', title: 'A+ Content is worth the effort', body: 'A+ Content (requires Brand Registry) increases conversion 3–10%. Prioritise it over any other listing enhancement after launch.', color: '#2563EB' },
  ],
  inventory: [
    { icon: '📦', title: 'Never stock out in 90 days',  body: 'Running out of stock collapses your BSR rank and is very hard to recover from. Over-order for your first launch window.', color: '#2563EB' },
    { icon: '⊡', title: 'FNSKU on every unit',          body: "Amazon's barcode goes on the product itself, not just the box. Agree with your supplier to apply it before shipment — it's far cheaper than doing it at the warehouse.", color: '#2563EB' },
    { icon: '◎', title: 'Third-party inspection',       body: 'Book a pre-shipment inspection (~$200) before goods leave the factory. Catching a bad batch overseas is far cheaper than a return from Amazon.', color: '#2563EB' },
  ],
  go: [
    { icon: '🚀', title: 'Launch price strategy',       body: 'Price 10–15% below median competitors. Raise to median after 20 reviews, then consider above-median after 50+.', color: '#2563EB' },
    { icon: '◉', title: 'Auto PPC first, manual second', body: 'Run Sponsored Products Auto campaigns for 2 weeks at $20–30/day. Mine the Search Term Report and move winning keywords to manual exact-match.', color: '#2563EB' },
    { icon: '⊡', title: "Use 'Request a Review' on every order", body: "The Amazon Request a Review button sends a compliant, templated request. Use it on every single order — it's the safest review strategy available.", color: '#2563EB' },
  ],
};

function SmartRecommendationsCard({ phaseId }: { phaseId: string }) {
  const tips = STAGE_TIPS[phaseId] ?? STAGE_TIPS.discover;

  return (
    <AppCard>
      <View style={sr.header}>
        <Text style={sr.heading}>Stage Tips</Text>
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

function PrimaryActionsCard({ phaseId }: { phaseId: string }) {
  const navigation = useNavigation<NavProp>();
  const phase = PHASES.find(p => p.id === phaseId);

  return (
    <AppCard>
      <SecondaryButton
        label={`Ask Co-Pilot about ${phase?.title ?? 'this stage'}`}
        onPress={() => navigation.navigate('Copilot' as any)}
        style={{ alignSelf: 'stretch' }}
      />
    </AppCard>
  );
}

// ─── ProductTipCard ───────────────────────────────────────────────────────────
// Shows an AI-generated product-specific tip for the current phase.
// Cached in AsyncStorage so it doesn't re-fetch on every render.

const TIP_CACHE_KEY = (product: string, phase: string) =>
  `siftly_plan_tip_${product.slice(0, 20)}_${phase}`;

function ProductTipCard({ productName, phaseId }: { productName: string; phaseId: string }) {
  const [tip,     setTip]     = useState('');
  const [loading, setLoading] = useState(false);

  const phaseName = useMemo(() => {
    const labels: Record<string, string> = {
      discover:  'product research',
      brand:     'brand building',
      keywords:  'keyword validation',
      supplier:  'supplier sourcing',
      listing:   'listing creation',
      inventory: 'inventory & logistics',
      go:        'launch preparation',
    };
    return labels[phaseId] ?? phaseId;
  }, [phaseId]);

  useEffect(() => {
    let cancelled = false;
    const cacheKey = TIP_CACHE_KEY(productName, phaseId);

    AsyncStorage.getItem(cacheKey).then(cached => {
      if (cancelled) return;
      if (cached) { setTip(cached); return; }

      setLoading(true);
      const q = `I'm launching "${productName}" on Amazon FBA. I'm in the ${phaseName} phase. Give me ONE specific, concrete tip for this exact product — 2 sentences max, no generic advice.`;
      api.askAI(q)
        .then(res => {
          if (cancelled) return;
          setTip(res.answer);
          AsyncStorage.setItem(cacheKey, res.answer).catch(() => {});
        })
        .catch(() => {})
        .finally(() => { if (!cancelled) setLoading(false); });
    }).catch(() => {});

    return () => { cancelled = true; };
  }, [productName, phaseId, phaseName]);

  if (!tip && !loading) return null;

  return (
    <AppCard style={{ gap: 8 }}>
      <View style={pt.header}>
        <Text style={pt.eyebrow}>AI TIP FOR THIS STAGE</Text>
        <View style={pt.badge}><Text style={pt.badgeTxt}>✦ {productName.slice(0, 18)}{productName.length > 18 ? '…' : ''}</Text></View>
      </View>
      {loading
        ? <View style={pt.loadRow}><ActivityIndicator size="small" color={DS.accent} /><Text style={pt.loadTxt}>Generating tip…</Text></View>
        : <Text style={pt.tip}>{tip}</Text>
      }
    </AppCard>
  );
}

const pt = StyleSheet.create({
  header:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  eyebrow:  { fontSize: 8, fontWeight: '800', color: DS.accent, letterSpacing: 2 },
  badge:    { backgroundColor: DS.indigoLight, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 },
  badgeTxt: { fontSize: 9, fontWeight: '800', color: DS.indigo },
  loadRow:  { flexDirection: 'row', alignItems: 'center', gap: 8 },
  loadTxt:  { fontSize: 12, color: DS.textMuted },
  tip:      { fontSize: 13, color: DS.textSecondary, lineHeight: 20 },
});

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function LaunchScreen() {
  const navigation                    = useNavigation<NavProp>();
  const [checked,        setChecked]        = useState<Set<string>>(new Set());
  const [selectedId,     setSelectedId]     = useState<string>(PHASES[0].id);
  const [aiKey,          setAiKey]          = useState<string | null>(null);
  const [celebPhase,     setCelebPhase]     = useState<string | null>(null);
  const celebAnim = useRef(new Animated.Value(0)).current;
  const { activeProduct: feasProduct, refreshActiveProduct } = useActiveProduct();
  const scrollRef = useRef<ScrollView>(null);

  useEffect(() => {
    loadChecklist();
    refreshActiveProduct(); // ensure context is up-to-date when tab is focused
  }, []);

  async function loadChecklist() {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (raw) {
      try { setChecked(new Set(JSON.parse(raw))); } catch { /* ignore */ }
    }
  }

  function showCelebration(phaseId: string) {
    setCelebPhase(phaseId);
    celebAnim.setValue(0);
    Animated.sequence([
      Animated.spring(celebAnim, { toValue: 1, useNativeDriver: true, tension: 80, friction: 8 }),
      Animated.delay(1800),
      Animated.timing(celebAnim, { toValue: 0, duration: 300, useNativeDriver: true }),
    ]).start(() => setCelebPhase(null));
  }

  async function toggle(id: string) {
    setChecked(prev => {
      const next = new Set(prev);
      const wasChecked = next.has(id);
      wasChecked ? next.delete(id) : next.add(id);
      const doneIds = [...next];
      AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(doneIds));

      // Detect phase completion on the tick (not on un-tick)
      if (!wasChecked) {
        const phase = PHASES.find(p => p.items.some(i => i.id === id));
        if (phase) {
          const allDone = phase.items.every(i => next.has(i.id));
          if (allDone) setTimeout(() => showCelebration(phase.id), 100);
        }
      }
      // Keep the home screen advisory card's readiness score in sync
      const pct = ALL_IDS.length > 0 ? Math.round((doneIds.length / ALL_IDS.length) * 100) : 0;
      AsyncStorage.getItem(STORAGE_KEYS.launchAdvisorSnapshot).then(snapRaw => {
        if (!snapRaw) return;
        try {
          const snap: LaunchAdvisorSnapshot = JSON.parse(snapRaw);
          snap.checklistPct = pct;
          AsyncStorage.setItem(STORAGE_KEYS.launchAdvisorSnapshot, JSON.stringify(snap)).catch(() => {});
        } catch { /* ignore */ }
      });
      return next;
    });
  }

  function handleAI(key: string) {
    if (AI_GUIDE[key]) {
      setAiKey(key);
    }
  }

  const onSelectStage = useCallback((id: string) => {
    setSelectedId(id);
    scrollRef.current?.scrollTo({ y: 0, animated: false });
  }, []);

  const celebPhaseObj = PHASES.find(p => p.id === celebPhase);

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <AIModal aiKey={aiKey} onClose={() => setAiKey(null)} />

      {/* Phase completion celebration banner */}
      {celebPhase && celebPhaseObj && (
        <Animated.View
          style={[
            s.celebBanner,
            { backgroundColor: celebPhaseObj.color },
            {
              opacity: celebAnim,
              transform: [{ scale: celebAnim.interpolate({ inputRange: [0, 1], outputRange: [0.92, 1] }) }],
            },
          ]}
          pointerEvents="none"
        >
          <Text style={s.celebIcon}>{celebPhaseObj.icon}</Text>
          <View style={{ flex: 1 }}>
            <Text style={s.celebTitle}>Phase complete!</Text>
            <Text style={s.celebSub}>{celebPhaseObj.title} — all tasks done</Text>
          </View>
          <Text style={s.celebCheck}>✓</Text>
        </Animated.View>
      )}

      {/* Pinned header */}
      <View style={s.header}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
          <Text style={s.eyebrow}>LAUNCH PLAN</Text>
          <HelpButton featureKey={STAGE_HELP[selectedId] ?? 'launch_checklist'} size="sm" />
        </View>
        <Text style={s.title}>
          {feasProduct ? feasProduct.name : 'Your Product Launch Roadmap'}
        </Text>
        {!feasProduct && (
          <TouchableOpacity onPress={() => navigation.navigate('LaunchPad' as any)} activeOpacity={0.75}>
            <Text style={s.productHint}>No product selected — add one in Feasibility Check →</Text>
          </TouchableOpacity>
        )}
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
        <TaskListCard phaseId={selectedId} checked={checked} onToggle={toggle} onAI={handleAI} />
        {feasProduct && (
          <ProductTipCard productName={feasProduct.name} phaseId={selectedId} />
        )}

        <SectionHeader title="Milestones" />
        <MilestonesCard checked={checked} />

        <SectionHeader title="Stage Tips" />
        <SmartRecommendationsCard phaseId={selectedId} />

        <SectionHeader title="Actions" />
        <PrimaryActionsCard phaseId={selectedId} />

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  safe:  { flex: 1, backgroundColor: DS.bgCanvas },

  celebBanner: {
    position: 'absolute', top: 90, left: 16, right: 16, zIndex: 99,
    flexDirection: 'row', alignItems: 'center', gap: 12,
    borderRadius: 16, paddingHorizontal: 16, paddingVertical: 14,
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.18, shadowRadius: 12, elevation: 8,
  },
  celebIcon:  { fontSize: 22 },
  celebTitle: { fontSize: 14, fontWeight: '900', color: '#fff', letterSpacing: -0.3 },
  celebSub:   { fontSize: 11, color: 'rgba(255,255,255,0.85)', marginTop: 1 },
  celebCheck: { fontSize: 22, color: '#fff', fontWeight: '900' },

  header: {
    paddingHorizontal: DS.pagePadding,
    paddingTop: 10,
    paddingBottom: 12,
    backgroundColor: DS.bgCard,
    borderBottomWidth: 1,
    borderBottomColor: DS.border,
  },
  eyebrow:     { fontSize: 9, fontWeight: '800', color: DS.accent, letterSpacing: 2.5, marginBottom: 2 },
  title:       { fontSize: 20, fontWeight: '900', color: DS.textPrimary, letterSpacing: -0.7 },
  productHint: { fontSize: 11, color: DS.accent, fontWeight: '600', marginTop: 4 },

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
