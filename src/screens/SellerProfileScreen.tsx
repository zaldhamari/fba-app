import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  SafeAreaView, Animated,
} from 'react-native';
import { StackNavigationProp } from '@react-navigation/stack';
import { RootStackParamList } from '../navigation/RootNavigator';
import { DS } from '../components/ds';
import { useSellerProfile } from '../hooks/useSellerProfile';
import type { Marketplace, ExperienceLevel, CompetitionThreshold } from '../types/sellerProfile';
import { MARKETPLACE_LABELS } from '../types/sellerProfile';

type Props = { navigation: StackNavigationProp<RootStackParamList, 'SellerProfile'> };

// ── Question data ─────────────────────────────────────────────────────────────

const MARKETPLACES: Marketplace[] = ['US', 'UK', 'DE', 'CA', 'AU'];

const EXPERIENCE_OPTIONS: { value: ExperienceLevel; label: string; sub: string }[] = [
  { value: 'beginner', label: 'Complete beginner',  sub: 'Haven\'t sold on Amazon yet' },
  { value: 'some',     label: 'Some experience',    sub: 'Tried it, learning the ropes' },
  { value: 'selling',  label: 'Already selling',    sub: 'Active FBA seller' },
];

const BUDGET_OPTIONS: { value: number; label: string; sub: string }[] = [
  { value: 250,   label: 'Under $500',    sub: 'Starting small' },
  { value: 1000,  label: '$500 – $1,500', sub: 'Comfortable start' },
  { value: 2500,  label: '$1,500 – $5k',  sub: 'Serious launch' },
  { value: 7500,  label: '$5k+',          sub: 'Scaling fast' },
];

const PRICE_OPTIONS: { priceMin: number; priceMax: number; label: string; sub: string }[] = [
  { priceMin: 5,  priceMax: 15,  label: 'Under $15',   sub: 'High volume, lower margin' },
  { priceMin: 15, priceMax: 30,  label: '$15 – $30',   sub: 'Sweet spot for beginners' },
  { priceMin: 30, priceMax: 60,  label: '$30 – $60',   sub: 'Better margins, less volume' },
  { priceMin: 60, priceMax: 200, label: '$60+',         sub: 'Premium, lower competition' },
];

const COMPETITION_OPTIONS: { value: CompetitionThreshold; label: string; sub: string; color: string }[] = [
  { value: 100,  label: 'Easy wins',       sub: 'Top seller has under 100 reviews',  color: DS.accent       },
  { value: 300,  label: 'I can compete',   sub: 'Top seller has under 300 reviews',  color: DS.indigo       },
  { value: 500,  label: 'Bring it on',     sub: 'Top seller has under 500 reviews',  color: DS.warning      },
  { value: 1000, label: 'No limit',        sub: 'Show me everything',                color: DS.danger       },
];

const QUESTIONS = [
  { num: 1, title: 'Which marketplace?',        sub: 'Your primary Amazon storefront' },
  { num: 2, title: 'Your experience level?',    sub: 'Be honest — it shapes your results' },
  { num: 3, title: 'Your inventory budget?',    sub: 'How much can you invest in a first order' },
  { num: 4, title: 'Target selling price?',     sub: 'What price range you want to sell at' },
  { num: 5, title: 'How competitive?',          sub: 'What\'s the most competition you\'ll take on' },
];

// ── Screen ────────────────────────────────────────────────────────────────────

export default function SellerProfileScreen({ navigation }: Props) {
  const { saveProfile } = useSellerProfile();

  const [step,        setStep]        = useState(0); // 0-4
  const [marketplace, setMarketplace] = useState<Marketplace | null>(null);
  const [experience,  setExperience]  = useState<ExperienceLevel | null>(null);
  const [budget,      setBudget]      = useState<number | null>(null);
  const [priceMin,    setPriceMin]    = useState<number | null>(null);
  const [priceMax,    setPriceMax]    = useState<number | null>(null);
  const [competition, setCompetition] = useState<CompetitionThreshold | null>(null);
  const [saving,      setSaving]      = useState(false);

  const q = QUESTIONS[step];
  const progress = (step + 1) / 5;

  function canAdvance(): boolean {
    if (step === 0) return marketplace !== null;
    if (step === 1) return experience  !== null;
    if (step === 2) return budget      !== null;
    if (step === 3) return priceMin    !== null;
    if (step === 4) return competition !== null;
    return false;
  }

  async function handleNext() {
    if (step < 4) { setStep(s => s + 1); return; }
    if (!marketplace || !experience || !budget || !priceMin || !priceMax || !competition) return;
    setSaving(true);
    try {
      await saveProfile({
        marketplace,
        experience,
        budget,
        priceMin,
        priceMax,
        maxTopSellerReviews: competition,
        completedAt: new Date().toISOString(),
      });
      navigation.replace('Main');
    } finally {
      setSaving(false);
    }
  }

  function handleBack() {
    if (step === 0) navigation.replace('Main'); // skip
    else setStep(s => s - 1);
  }

  return (
    <SafeAreaView style={s.safe}>
      {/* ── Header ──────────────────────────────────────────────── */}
      <View style={s.header}>
        <TouchableOpacity onPress={handleBack} activeOpacity={0.7} style={s.backBtn}>
          <Text style={s.backTxt}>{step === 0 ? 'Skip' : '←'}</Text>
        </TouchableOpacity>
        <View style={s.progressWrap}>
          <View style={s.progressBg}>
            <View style={[s.progressFill, { width: `${progress * 100}%` as any }]} />
          </View>
          <Text style={s.progressTxt}>{step + 1} of 5</Text>
        </View>
      </View>

      <ScrollView style={s.scroll} contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
        {/* ── Question heading ─────────────────────────────────── */}
        <View style={s.qHead}>
          <Text style={s.qNum}>QUESTION {q.num}</Text>
          <Text style={s.qTitle}>{q.title}</Text>
          <Text style={s.qSub}>{q.sub}</Text>
        </View>

        {/* ── Q1: Marketplace ──────────────────────────────────── */}
        {step === 0 && (
          <View style={s.optionGrid}>
            {MARKETPLACES.map(m => {
              const info = MARKETPLACE_LABELS[m];
              const sel  = marketplace === m;
              return (
                <TouchableOpacity
                  key={m}
                  style={[s.marketCard, sel && s.marketCardSel]}
                  onPress={() => setMarketplace(m)}
                  activeOpacity={0.8}
                >
                  <Text style={s.marketFlag}>{info.flag}</Text>
                  <Text style={[s.marketCode, sel && s.optSel]}>{m}</Text>
                  <Text style={s.marketCur}>{info.currency}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        )}

        {/* ── Q2: Experience ───────────────────────────────────── */}
        {step === 1 && (
          <View style={s.optionList}>
            {EXPERIENCE_OPTIONS.map(o => {
              const sel = experience === o.value;
              return (
                <TouchableOpacity
                  key={o.value}
                  style={[s.optCard, sel && s.optCardSel]}
                  onPress={() => setExperience(o.value)}
                  activeOpacity={0.8}
                >
                  <View style={[s.optCheck, sel && s.optCheckSel]}>
                    {sel && <Text style={s.optCheckTick}>✓</Text>}
                  </View>
                  <View style={s.optInfo}>
                    <Text style={[s.optLabel, sel && s.optSel]}>{o.label}</Text>
                    <Text style={s.optSubLabel}>{o.sub}</Text>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        )}

        {/* ── Q3: Budget ───────────────────────────────────────── */}
        {step === 2 && (
          <View style={s.optionList}>
            {BUDGET_OPTIONS.map(o => {
              const sel = budget === o.value;
              return (
                <TouchableOpacity
                  key={o.value}
                  style={[s.optCard, sel && s.optCardSel]}
                  onPress={() => setBudget(o.value)}
                  activeOpacity={0.8}
                >
                  <View style={[s.optCheck, sel && s.optCheckSel]}>
                    {sel && <Text style={s.optCheckTick}>✓</Text>}
                  </View>
                  <View style={s.optInfo}>
                    <Text style={[s.optLabel, sel && s.optSel]}>{o.label}</Text>
                    <Text style={s.optSubLabel}>{o.sub}</Text>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        )}

        {/* ── Q4: Price range ──────────────────────────────────── */}
        {step === 3 && (
          <View style={s.optionList}>
            {PRICE_OPTIONS.map(o => {
              const sel = priceMin === o.priceMin;
              return (
                <TouchableOpacity
                  key={o.label}
                  style={[s.optCard, sel && s.optCardSel]}
                  onPress={() => { setPriceMin(o.priceMin); setPriceMax(o.priceMax); }}
                  activeOpacity={0.8}
                >
                  <View style={[s.optCheck, sel && s.optCheckSel]}>
                    {sel && <Text style={s.optCheckTick}>✓</Text>}
                  </View>
                  <View style={s.optInfo}>
                    <Text style={[s.optLabel, sel && s.optSel]}>{o.label}</Text>
                    <Text style={s.optSubLabel}>{o.sub}</Text>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        )}

        {/* ── Q5: Competition threshold ────────────────────────── */}
        {step === 4 && (
          <View style={s.optionList}>
            {COMPETITION_OPTIONS.map(o => {
              const sel = competition === o.value;
              return (
                <TouchableOpacity
                  key={o.value}
                  style={[s.optCard, sel && s.optCardSel]}
                  onPress={() => setCompetition(o.value)}
                  activeOpacity={0.8}
                >
                  <View style={[s.optCheck, sel && s.optCheckSel]}>
                    {sel && <Text style={s.optCheckTick}>✓</Text>}
                  </View>
                  <View style={s.optInfo}>
                    <Text style={[s.optLabel, sel && s.optSel]}>{o.label}</Text>
                    <Text style={s.optSubLabel}>{o.sub}</Text>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        )}

        {/* ── Hint for last step ───────────────────────────────── */}
        {step === 4 && (
          <View style={s.hint}>
            <Text style={s.hintTxt}>
              💡 You can change this anytime from the Research page before each search.
            </Text>
          </View>
        )}
      </ScrollView>

      {/* ── CTA ─────────────────────────────────────────────────── */}
      <View style={s.footer}>
        <TouchableOpacity
          style={[s.nextBtn, !canAdvance() && s.nextBtnDisabled]}
          onPress={handleNext}
          disabled={!canAdvance() || saving}
          activeOpacity={0.85}
        >
          <Text style={s.nextTxt}>
            {saving ? 'Saving…' : step < 4 ? 'Next →' : 'Start Researching →'}
          </Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  safe:    { flex: 1, backgroundColor: DS.bgCanvas },
  scroll:  { flex: 1 },
  content: { paddingHorizontal: 24, paddingBottom: 40, gap: 24 },

  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 20, paddingTop: 12, paddingBottom: 16, gap: 12,
  },
  backBtn:  { paddingHorizontal: 4, paddingVertical: 4, minWidth: 44 },
  backTxt:  { fontSize: 15, fontWeight: '700', color: DS.indigo },

  progressWrap: { flex: 1, gap: 6 },
  progressBg:   { height: 4, backgroundColor: DS.bgElevated, borderRadius: 2, overflow: 'hidden' },
  progressFill: { height: 4, backgroundColor: DS.indigo, borderRadius: 2 },
  progressTxt:  { fontSize: 10, fontWeight: '700', color: DS.textMuted, textAlign: 'right' },

  qHead:  { gap: 6, paddingTop: 8 },
  qNum:   { fontSize: 9, fontWeight: '800', color: DS.indigo, letterSpacing: 2.5 },
  qTitle: { fontSize: 26, fontWeight: '900', color: DS.textPrimary, letterSpacing: -0.8, lineHeight: 32 },
  qSub:   { fontSize: 13, color: DS.textSecondary, lineHeight: 19 },

  optionGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  optionList: { gap: 10 },

  marketCard: {
    width: '30%', aspectRatio: 1, alignItems: 'center', justifyContent: 'center',
    backgroundColor: DS.bgCard, borderRadius: 18, borderWidth: 1.5,
    borderColor: DS.border, gap: 4,
  },
  marketCardSel: { borderColor: DS.indigo, backgroundColor: DS.indigoLight },
  marketFlag:    { fontSize: 28 },
  marketCode:    { fontSize: 13, fontWeight: '800', color: DS.textPrimary },
  marketCur:     { fontSize: 10, color: DS.textMuted, fontWeight: '500' },

  optCard: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    backgroundColor: DS.bgCard, borderRadius: 16, borderWidth: 1.5,
    borderColor: DS.border, padding: 16,
  },
  optCardSel: { borderColor: DS.indigo, backgroundColor: DS.indigoLight },

  optCheck: {
    width: 24, height: 24, borderRadius: 12, borderWidth: 2,
    borderColor: DS.border, alignItems: 'center', justifyContent: 'center',
    flexShrink: 0,
  },
  optCheckSel:  { backgroundColor: DS.indigo, borderColor: DS.indigo },
  optCheckTick: { fontSize: 12, fontWeight: '900', color: '#fff' },

  optInfo:     { flex: 1, gap: 2 },
  optLabel:    { fontSize: 15, fontWeight: '700', color: DS.textPrimary },
  optSel:      { color: DS.indigo },
  optSubLabel: { fontSize: 12, color: DS.textSecondary, lineHeight: 17 },

  hint:    { backgroundColor: DS.indigoLight, borderRadius: 12, padding: 14, borderWidth: 1, borderColor: DS.indigo + '30' },
  hintTxt: { fontSize: 12, color: DS.indigo, lineHeight: 18 },

  footer:        { paddingHorizontal: 24, paddingBottom: 32, paddingTop: 12 },
  nextBtn:       { backgroundColor: DS.indigo, borderRadius: 16, paddingVertical: 16, alignItems: 'center' },
  nextBtnDisabled:{ opacity: 0.35 },
  nextTxt:       { fontSize: 16, fontWeight: '800', color: '#fff', letterSpacing: -0.3 },
});
