import React, { useState, useCallback, useEffect } from 'react';
import { useNavigation } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { safeParseJSON } from '../utils/safeJSON';
import { STORAGE_KEYS } from '../constants/storage';
import { useActiveProduct } from '../context/ActiveProductContext';
import { usePipeline } from '../context/PipelineContext';
import {
  ScrollView, StyleSheet, View, Text, TouchableOpacity, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { SvgXml } from 'react-native-svg';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import {
  AppCard,
  SectionHeader,
  StatusBadge,
  InputField,
  PrimaryButton,
  SecondaryButton,
  DS,
} from '../components/ds';
import PulseDots from '../components/PulseDots';
import { api, BrandResult } from '../services/api';
import { useSubscription } from '../hooks/useSubscription';
import PaywallModal from '../components/PaywallModal';
import { AppHeader } from '../components/AppHeader';
import type { FeatureKey } from '../lib/featureHelp';
import FeasibilityHeart from '../components/FeasibilityHeart';
import { track } from '../lib/analytics';
import { useNetworkStatus } from '../hooks/useNetworkStatus';
import { OfflineBanner } from '../components/OfflineBanner';
import { CompleteBrandKitBuilder } from '../components/CompleteBrandKitBuilder';

// ── Brand result cache (AsyncStorage, 7-day TTL) ─────────────────────────────
const BRAND_CACHE_PREFIX = 'brand_cache_v1:';
const BRAND_CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1_000;

function brandCacheKey(brandName: string, style: string, colorPalette: string): string {
  return BRAND_CACHE_PREFIX + [brandName, style, colorPalette].map(s => s.trim().toLowerCase()).join('|');
}

async function getBrandCache<T>(key: string): Promise<T | null> {
  try {
    const raw = await AsyncStorage.getItem(key);
    if (!raw) return null;
    const { data, expiresAt } = JSON.parse(raw);
    if (Date.now() > expiresAt) { AsyncStorage.removeItem(key).catch(() => {}); return null; }
    return data as T;
  } catch { return null; }
}

async function setBrandCache(key: string, data: unknown): Promise<void> {
  try {
    await AsyncStorage.setItem(key, JSON.stringify({ data, expiresAt: Date.now() + BRAND_CACHE_TTL_MS }));
  } catch { /* best-effort */ }
}

// ── SVG helpers ───────────────────────────────────────────────────────────────

function isValidSvg(s: string): boolean {
  return typeof s === 'string' && s.trimStart().startsWith('<svg');
}

async function exportSvg(svg: string, filename: string): Promise<void> {
  const uri = `${FileSystem.cacheDirectory ?? ''}${filename}.svg`;
  await FileSystem.writeAsStringAsync(uri, svg, { encoding: FileSystem.EncodingType.UTF8 });
  const canShare = await Sharing.isAvailableAsync();
  if (!canShare) {
    throw new Error('Sharing is unavailable on this device. Try again on a real device.');
  }
  await Sharing.shareAsync(uri, { mimeType: 'image/svg+xml', UTI: 'public.svg-image' });
}

// ── Asset history ─────────────────────────────────────────────────────────────

interface BrandHistoryEntry {
  brandName: string;
  style:     string;
  assetType: 'logo' | 'label' | 'insert';
  svg:       string;
  createdAt: string;
}

async function saveToHistory(entry: BrandHistoryEntry) {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEYS.brandHistory);
    const list: BrandHistoryEntry[] = (raw ? safeParseJSON<BrandHistoryEntry[]>(raw) : null) ?? [];
    list.unshift(entry);
    await AsyncStorage.setItem(STORAGE_KEYS.brandHistory, JSON.stringify(list.slice(0, 20)));
  } catch { /* best-effort */ }
}

// ── Generation result types ───────────────────────────────────────────────────

interface LabelResult {
  label_svg:  string;
  insert_svg: string;
}

// ── Types & constants ─────────────────────────────────────────────────────────

type StyleOption    = 'Minimal' | 'Premium' | 'Eco' | 'Bold' | 'Luxury';
type ColorPalette   = 'blue' | 'green' | 'purple' | 'warm' | 'dark' | 'earth';
type FontStyle      = 'modern' | 'classic' | 'bold';

interface BrandInputs {
  brandName:      string;
  tagline:        string;
  personality:    string;
  targetAudience: string;
  brandTone:      string;
  style:          StyleOption;
  colorPalette:   ColorPalette;
  fontStyle:      FontStyle;
}

const COLOR_OPTIONS: { id: ColorPalette; label: string; swatch: string }[] = [
  { id: 'blue',   label: 'Ocean',  swatch: DS.accent },
  { id: 'green',  label: 'Nature', swatch: DS.success },
  { id: 'purple', label: 'Royal',  swatch: DS.accent },
  { id: 'warm',   label: 'Warm',   swatch: DS.warning },
  { id: 'dark',   label: 'Dark',   swatch: DS.textPrimary },
  { id: 'earth',  label: 'Earth',  swatch: DS.gold },
];

const FONT_OPTIONS: { id: FontStyle; label: string; sample: string }[] = [
  { id: 'modern',  label: 'Modern',  sample: 'Aa' },
  { id: 'classic', label: 'Classic', sample: 'Aa' },
  { id: 'bold',    label: 'Bold',    sample: 'Aa' },
];

const STYLE_OPTIONS: { id: StyleOption; icon: string; color: string; bg: string }[] = [
  { id: 'Minimal', icon: '○',  color: DS.textSecondary, bg: DS.bgSubtle   },
  { id: 'Premium', icon: '✦',  color: DS.accent,         bg: DS.accentLight },
  { id: 'Eco',     icon: '🌿', color: DS.accentDark,    bg: DS.accentLight },
  { id: 'Bold',    icon: '◼',  color: DS.info,           bg: DS.infoBg      },
  { id: 'Luxury',  icon: '◆',  color: DS.accent,         bg: DS.accentLight },
];

const STEP_HELP: Record<number, FeatureKey> = {
  1: 'brand_studio',
  2: 'brand_logo',
  3: 'brand_studio',
  4: 'brand_label',
  5: 'brand_insert',
  6: 'brand_studio',
};

interface BrandDirection {
  id:          string;
  label:       string;
  icon:        string;
  mood:        string;
  style:       StyleOption;
  colorPalette: ColorPalette;
  fontStyle:   FontStyle;
}

const BRAND_DIRECTIONS: BrandDirection[] = [
  { id: 'minimal-modern',    label: 'Minimal Modern',   icon: '○',  mood: 'Clean, understated, functional',    style: 'Minimal', colorPalette: 'blue',   fontStyle: 'modern'  },
  { id: 'luxury-premium',    label: 'Luxury Premium',   icon: '◆',  mood: 'Sophisticated, high-end, exclusive', style: 'Luxury',  colorPalette: 'dark',   fontStyle: 'classic' },
  { id: 'organic-natural',   label: 'Organic Natural',  icon: '🌿', mood: 'Earthy, authentic, sustainable',     style: 'Eco',     colorPalette: 'earth',  fontStyle: 'classic' },
  { id: 'clinical-scientific', label: 'Clinical',       icon: '⬡',  mood: 'Precise, trustworthy, scientific',  style: 'Minimal', colorPalette: 'blue',   fontStyle: 'modern'  },
  { id: 'playful-friendly',  label: 'Playful Friendly', icon: '✺',  mood: 'Fun, approachable, vibrant',         style: 'Bold',    colorPalette: 'warm',   fontStyle: 'bold'    },
  { id: 'bold-energetic',    label: 'Bold Energetic',   icon: '◼',  mood: 'Powerful, dynamic, high-impact',    style: 'Bold',    colorPalette: 'purple', fontStyle: 'bold'    },
  { id: 'tech-forward',      label: 'Tech Forward',     icon: '✦',  mood: 'Innovative, sharp, forward-looking', style: 'Premium', colorPalette: 'dark',   fontStyle: 'modern'  },
  { id: 'elegant-feminine',  label: 'Elegant Feminine', icon: '❋',  mood: 'Graceful, refined, warm luxury',     style: 'Luxury',  colorPalette: 'warm',   fontStyle: 'classic' },
];

const BRAND_RECOMMENDATIONS = [
  {
    icon: '🎨',
    title: 'Use consistent colors',
    body: 'Apply the same palette to your logo, label, and packaging inserts.',
  },
  {
    icon: '🔤',
    title: 'Keep label text readable',
    body: 'Test your label at thumbnail size — buyers skim product images fast.',
  },
  {
    icon: '🎯',
    title: 'Match tone to category',
    body: 'Eco products use earthy tones. Premium uses dark backgrounds and gold.',
  },
];


// ── Brand Direction Picker ────────────────────────────────────────────────────

function BrandDirectionPicker({
  selectedId,
  onSelect,
}: {
  selectedId: string | null;
  onSelect: (dir: BrandDirection) => void;
}) {
  return (
    <AppCard style={bdp.card}>
      <View style={bdp.header}>
        <Text style={bdp.title}>Choose a Brand Direction</Text>
        <Text style={bdp.sub}>Instantly sets your style, color, and font — you can still adjust below</Text>
      </View>
      <View style={bdp.grid}>
        {BRAND_DIRECTIONS.map(dir => {
          const active = selectedId === dir.id;
          return (
            <TouchableOpacity
              key={dir.id}
              style={[bdp.chip, active && bdp.chipActive]}
              onPress={() => onSelect(dir)}
              activeOpacity={0.75}
              accessibilityRole="radio"
              accessibilityState={{ checked: active }}
            >
              <Text style={[bdp.chipIcon, active && bdp.chipIconActive]}>{dir.icon}</Text>
              <View style={{ flex: 1 }}>
                <Text style={[bdp.chipLabel, active && bdp.chipLabelActive]} numberOfLines={1}>{dir.label}</Text>
                <Text style={bdp.chipMood} numberOfLines={1}>{dir.mood}</Text>
              </View>
              {active && <Text style={bdp.checkMark}>✓</Text>}
            </TouchableOpacity>
          );
        })}
      </View>
    </AppCard>
  );
}

const bdp = StyleSheet.create({
  card:           { gap: 14 },
  header:         { gap: 4 },
  title:          { fontSize: 15, fontWeight: '800', color: DS.textPrimary, letterSpacing: -0.3 },
  sub:            { fontSize: 12, color: DS.textMuted, lineHeight: 16 },
  grid:           { gap: 8 },
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    borderWidth: 1.5, borderColor: DS.border, borderRadius: DS.radiusCard,
    backgroundColor: DS.bgCard, paddingHorizontal: 14, paddingVertical: 10,
  },
  chipActive:     { borderColor: DS.accent, backgroundColor: DS.accentLight },
  chipIcon:       { fontSize: 18, width: 24, textAlign: 'center', color: DS.textMuted },
  chipIconActive: { color: DS.accent },
  chipLabel:      { fontSize: 13, fontWeight: '700', color: DS.textPrimary },
  chipLabelActive:{ color: DS.accent },
  chipMood:       { fontSize: 11, color: DS.textMuted, lineHeight: 14, marginTop: 1 },
  checkMark:      { fontSize: 13, fontWeight: '900', color: DS.accent },
});

// ── Brand Identity card ───────────────────────────────────────────────────────

function BrandIdentityCard({
  inputs,
  onChange,
}: {
  inputs: BrandInputs;
  onChange: (k: keyof BrandInputs, v: string) => void;
}) {
  return (
    <AppCard style={bi.card}>
      <View style={bi.header}>
        <View style={bi.headerIcon}>
          <Text style={bi.headerGlyph}>✦</Text>
        </View>
        <View>
          <Text style={bi.headerTitle}>Brand Identity</Text>
          <Text style={bi.headerSub}>Define your brand style and voice</Text>
        </View>
      </View>

      <InputField
        label="Brand / Product Name"
        value={inputs.brandName}
        onChangeText={v => onChange('brandName', v)}
        leadingIcon="✦"
        placeholder="e.g. Zenovex Kitchen"
        returnKeyType="next"
      />

      <InputField
        label="Tagline"
        value={inputs.tagline}
        onChangeText={v => onChange('tagline', v)}
        leadingIcon="💬"
        placeholder="e.g. Built for the moments that matter"
        returnKeyType="next"
      />

      <InputField
        label="Brand Personality"
        value={inputs.personality}
        onChangeText={v => onChange('personality', v)}
        leadingIcon="🧠"
        placeholder="e.g. Innovative, trustworthy, approachable"
        returnKeyType="next"
      />

      {/* Style selector */}
      <View style={bi.styleSection}>
        <Text style={bi.styleLabel}>Brand Style</Text>
        <View style={bi.styleChips}>
          {STYLE_OPTIONS.map(opt => {
            const active = inputs.style === opt.id;
            return (
              <TouchableOpacity
                key={opt.id}
                style={[
                  bi.chip,
                  { borderColor: active ? opt.color : DS.border },
                  active && { backgroundColor: opt.bg },
                ]}
                onPress={() => onChange('style', opt.id)}
                activeOpacity={0.75}
                accessibilityRole="radio"
                accessibilityState={{ checked: active }}
              >
                <Text style={[bi.chipIcon, { color: active ? opt.color : DS.textMuted }]}>
                  {opt.icon}
                </Text>
                <Text style={[bi.chipText, active && { color: opt.color, fontWeight: '700' }]}>
                  {opt.id}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {/* Color palette selector */}
      <View style={bi.styleSection}>
        <Text style={bi.styleLabel}>Color Direction</Text>
        <View style={bi.styleChips}>
          {COLOR_OPTIONS.map(opt => {
            const active = inputs.colorPalette === opt.id;
            return (
              <TouchableOpacity
                key={opt.id}
                style={[bi.colorChip, active && { borderColor: opt.swatch, backgroundColor: opt.swatch + '18' }]}
                onPress={() => onChange('colorPalette', opt.id)}
                activeOpacity={0.75}
              >
                <View style={[bi.colorSwatch, { backgroundColor: opt.swatch }]} />
                <Text style={[bi.chipText, active && { color: opt.swatch, fontWeight: '700' }]}>{opt.label}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {/* Font style selector */}
      <View style={bi.styleSection}>
        <Text style={bi.styleLabel}>Font Direction</Text>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          {FONT_OPTIONS.map(opt => {
            const active = inputs.fontStyle === opt.id;
            return (
              <TouchableOpacity
                key={opt.id}
                style={[bi.chip, active && { borderColor: DS.accent, backgroundColor: DS.accentLight }]}
                onPress={() => onChange('fontStyle', opt.id)}
                activeOpacity={0.75}
              >
                <Text style={[bi.chipIcon, { color: active ? DS.accent : DS.textMuted, fontWeight: '900' }]}>{opt.sample}</Text>
                <Text style={[bi.chipText, active && { color: DS.accent, fontWeight: '700' }]}>{opt.label}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      <InputField
        label="Target Audience"
        value={inputs.targetAudience}
        onChangeText={v => onChange('targetAudience', v)}
        leadingIcon="👥"
        placeholder="e.g. Home cooks aged 25–45"
        returnKeyType="next"
      />

      <InputField
        label="Brand Tone"
        value={inputs.brandTone}
        onChangeText={v => onChange('brandTone', v)}
        leadingIcon="🎯"
        placeholder="e.g. Friendly, trustworthy, premium"
        returnKeyType="done"
      />
    </AppCard>
  );
}

const bi = StyleSheet.create({
  card:        { gap: 18 },
  header:      { flexDirection: 'row', alignItems: 'center', gap: 12 },
  headerIcon: {
    width: 40, height: 40, borderRadius: 12,
    backgroundColor: DS.pinkLight,
    alignItems: 'center', justifyContent: 'center',
    flexShrink: 0,
  },
  headerGlyph: { fontSize: 18, color: DS.pink },
  headerTitle: { fontSize: 16, fontWeight: '800', color: DS.textPrimary, letterSpacing: -0.4 },
  headerSub:   { fontSize: 12, color: DS.textMuted, marginTop: 1 },
  styleSection: { gap: 10 },
  styleLabel: {
    fontSize: 13, fontWeight: '600', color: DS.textPrimary, letterSpacing: -0.1,
  },
  styleChips:  { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    flexDirection:     'row',
    alignItems:        'center',
    gap:               5,
    borderWidth:       1.5,
    borderRadius:      DS.radiusBadge,
    paddingHorizontal: 12,
    paddingVertical:   7,
    backgroundColor:   DS.bgCard,
  },
  colorChip: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    borderWidth: 1.5, borderRadius: DS.radiusBadge, borderColor: DS.border,
    paddingHorizontal: 10, paddingVertical: 6, backgroundColor: DS.bgCard,
  },
  colorSwatch: { width: 10, height: 10, borderRadius: 5 },
  chipIcon:    { fontSize: 13 },
  chipText:    { fontSize: 12, fontWeight: '600', color: DS.textSecondary },
});

// ── Packaging type picker ─────────────────────────────────────────────────────

const PACKAGING_TYPES = [
  { id: 'standard',   label: 'Standard',   icon: '□' },
  { id: 'bottle',     label: 'Bottle',     icon: '⌇' },
  { id: 'pouch',      label: 'Pouch',      icon: '◫' },
  { id: 'box',        label: 'Box',        icon: '▪' },
  { id: 'supplement', label: 'Supplement', icon: '⬡' },
  { id: 'cosmetic',   label: 'Cosmetic',   icon: '◈' },
  { id: 'eco',        label: 'Eco Wrap',   icon: '🌿' },
] as const;

function PackagingTypePicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <View style={ptp.wrap}>
      <Text style={ptp.label}>Packaging Format</Text>
      <View style={ptp.row}>
        {PACKAGING_TYPES.map(p => {
          const active = value === p.id;
          return (
            <TouchableOpacity
              key={p.id}
              style={[ptp.chip, active && ptp.chipActive]}
              onPress={() => onChange(p.id)}
              activeOpacity={0.75}
            >
              <Text style={[ptp.icon, active && ptp.iconActive]}>{p.icon}</Text>
              <Text style={[ptp.text, active && ptp.textActive]}>{p.label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

const ptp = StyleSheet.create({
  wrap:      { gap: 8 },
  label:     { fontSize: 12, fontWeight: '600', color: DS.textPrimary },
  row:       { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    borderWidth: 1.5, borderColor: DS.border, borderRadius: DS.radiusBadge,
    paddingHorizontal: 10, paddingVertical: 5, backgroundColor: DS.bgCard,
  },
  chipActive: { borderColor: DS.accent, backgroundColor: DS.accentLight },
  icon:       { fontSize: 11, color: DS.textMuted },
  iconActive: { color: DS.accent },
  text:       { fontSize: 11, fontWeight: '600', color: DS.textSecondary },
  textActive: { color: DS.accent, fontWeight: '700' },
});

// ── Brand concept preview card (fallback when no SVG) ─────────────────────────

interface ConceptVariant {
  id:      'icon' | 'wordmark' | 'badge';
  label:   string;
}

const CONCEPT_VARIANTS: ConceptVariant[] = [
  { id: 'icon',     label: 'Icon Mark'  },
  { id: 'wordmark', label: 'Wordmark'   },
  { id: 'badge',    label: 'Badge'      },
];

function BrandConceptPreview({
  brandName,
  tagline,
  style,
  colorPalette,
  activeIdx,
  onSelectIdx,
  directionId,
}: {
  brandName:   string;
  tagline:     string;
  style:       StyleOption;
  colorPalette: ColorPalette;
  activeIdx:   number;
  onSelectIdx: (i: number) => void;
  directionId: string | null;
}) {
  const name       = brandName.trim() || 'Your Brand';
  const sub        = tagline.trim() || 'Premium Quality';
  const styleOpt   = STYLE_OPTIONS.find(o => o.id === style) ?? STYLE_OPTIONS[0];
  const colorOpt   = COLOR_OPTIONS.find(o => o.id === colorPalette) ?? COLOR_OPTIONS[0];
  const accent     = colorOpt.swatch;
  const dir        = BRAND_DIRECTIONS.find(d => d.id === directionId);

  const variant = CONCEPT_VARIANTS[activeIdx]?.id ?? 'icon';

  function renderConcept() {
    if (variant === 'icon') {
      return (
        <View style={{ alignItems: 'center', gap: 14 }}>
          <View style={[bcp.mark, { backgroundColor: accent + '18', borderColor: accent + '50' }]}>
            <Text style={[bcp.markGlyph, { color: accent }]}>{styleOpt.icon}</Text>
          </View>
          <View style={{ alignItems: 'center', gap: 4 }}>
            <Text style={[bcp.brandName, { color: DS.textPrimary }]}>{name}</Text>
            <Text style={[bcp.tagline, { color: accent }]}>{sub.toUpperCase()}</Text>
          </View>
        </View>
      );
    }
    if (variant === 'wordmark') {
      return (
        <View style={{ alignItems: 'center', gap: 8 }}>
          <Text style={[bcp.wordmark, { color: DS.textPrimary, letterSpacing: style === 'Luxury' ? 4 : style === 'Bold' ? -1 : 1 }]}>
            {name.toUpperCase()}
          </Text>
          <View style={[bcp.wordmarkBar, { backgroundColor: accent }]} />
          <Text style={[bcp.taglineSm, { color: DS.textMuted }]}>{sub}</Text>
        </View>
      );
    }
    return (
      <View style={[bcp.badgeOuter, { borderColor: accent }]}>
        <View style={[bcp.badgeInner, { backgroundColor: accent + '10' }]}>
          <Text style={[bcp.badgeIcon, { color: accent }]}>{styleOpt.icon}</Text>
          <Text style={[bcp.badgeName, { color: DS.textPrimary }]}>{name}</Text>
          <Text style={[bcp.badgeSub, { color: accent }]}>{sub.toUpperCase()}</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={bcp.wrap}>
      <View style={bcp.header}>
        <Text style={bcp.headerLabel}>Concept Preview</Text>
        <Text style={bcp.headerSub}>{dir?.label ?? style} direction · draft only</Text>
      </View>
      <View style={bcp.canvas}>{renderConcept()}</View>
      <View style={bcp.tabs}>
        {CONCEPT_VARIANTS.map((v, i) => (
          <TouchableOpacity
            key={v.id}
            style={[bcp.tab, activeIdx === i && { borderColor: accent, backgroundColor: accent + '12' }]}
            onPress={() => onSelectIdx(i)}
            activeOpacity={0.75}
          >
            <Text style={[bcp.tabTxt, activeIdx === i && { color: accent, fontWeight: '700' }]}>{v.label}</Text>
          </TouchableOpacity>
        ))}
      </View>
      <Text style={bcp.disclaimer}>Concept mockup — not production-ready. Generate to receive AI-designed SVG.</Text>
    </View>
  );
}

const bcp = StyleSheet.create({
  wrap:        { gap: 0, borderRadius: DS.radiusCard, overflow: 'hidden', borderWidth: 1.5, borderColor: DS.border, backgroundColor: DS.bgCard },
  header:      { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: DS.border },
  headerLabel: { fontSize: 12, fontWeight: '800', color: DS.textPrimary, letterSpacing: 0.5 },
  headerSub:   { fontSize: 11, color: DS.textMuted },
  canvas:      { alignItems: 'center', justifyContent: 'center', paddingVertical: 40, paddingHorizontal: 24, backgroundColor: DS.bgSubtle, minHeight: 180 },
  mark: {
    width: 72, height: 72, borderRadius: 20,
    alignItems: 'center', justifyContent: 'center', borderWidth: 1.5,
  },
  markGlyph:   { fontSize: 32 },
  brandName:   { fontSize: 20, fontWeight: '900', letterSpacing: -0.6, textAlign: 'center' },
  tagline:     { fontSize: 9, fontWeight: '700', letterSpacing: 2.5, textAlign: 'center' },
  wordmark:    { fontSize: 24, fontWeight: '900', textAlign: 'center' },
  wordmarkBar: { width: 48, height: 2, borderRadius: 1 },
  taglineSm:   { fontSize: 11, letterSpacing: 0.8, textAlign: 'center' },
  badgeOuter:  { borderWidth: 2, borderRadius: 60, padding: 4 },
  badgeInner:  { borderRadius: 56, paddingHorizontal: 28, paddingVertical: 18, alignItems: 'center', gap: 4 },
  badgeIcon:   { fontSize: 20 },
  badgeName:   { fontSize: 16, fontWeight: '900', letterSpacing: -0.4 },
  badgeSub:    { fontSize: 9, fontWeight: '700', letterSpacing: 2 },
  tabs:        { flexDirection: 'row', gap: 6, padding: 12, borderTopWidth: 1, borderTopColor: DS.border },
  tab:         { flex: 1, alignItems: 'center', paddingVertical: 7, borderRadius: DS.radiusButton, borderWidth: 1.5, borderColor: DS.border },
  tabTxt:      { fontSize: 11, fontWeight: '600', color: DS.textSecondary },
  disclaimer:  { fontSize: 10, color: DS.textMuted, textAlign: 'center', paddingHorizontal: 16, paddingBottom: 12, lineHeight: 14 },
});

// ── Logo Maker tab ────────────────────────────────────────────────────────────

function LogoMakerTab({
  brandName, tagline, style, colorPalette, loading, warmingUp, result, onGenerate, genError, onRetry, exportLoading, exportError, onExport, accentColor,
  selectedName, onSelectName, activeConceptIdx, onConceptIdx, directionId,
}: {
  brandName:      string;
  tagline:        string;
  style:          StyleOption;
  colorPalette:   ColorPalette;
  loading:        boolean;
  warmingUp?:     boolean;
  result:         BrandResult | null;
  onGenerate:     () => void;
  genError:       string;
  onRetry:        () => void;
  exportLoading:  boolean;
  exportError:    string;
  onExport:       () => void;
  accentColor:    string;
  selectedName?:  string;
  onSelectName?:  (name: string) => void;
  activeConceptIdx: number;
  onConceptIdx:   (i: number) => void;
  directionId:    string | null;
}) {
  const displayName = selectedName || result?.brand_name || brandName.trim() || 'Your Brand';
  const displayTag  = result?.tagline || tagline || 'Premium Quality Product';
  const styleOpt    = STYLE_OPTIONS.find(o => o.id === style) ?? STYLE_OPTIONS[0];
  const hasSvg      = !!result?.logo_svg && isValidSvg(result.logo_svg);
  const hasResult   = !!result;

  return (
    <View style={at.wrap}>
      {loading ? (
        <AppCard padding={0} style={lm.previewCard}>
          <View style={[lm.canvas, { minHeight: 180 }]}>
            <PulseDots color={accentColor} />
            <Text style={{ fontSize: 13, color: DS.textMuted, marginTop: 12 }}>
              {warmingUp ? 'Waking up server... this may take 20–30s' : 'Generating brand kit...'}
            </Text>
          </View>
        </AppCard>
      ) : hasSvg ? (
        <AppCard padding={0} style={lm.previewCard}>
          <View style={{ paddingHorizontal: 10, paddingTop: 8 }}>
            <View style={aiDraftBadgeStyle}><Text style={aiDraftBadgeTxtStyle}>AI DRAFT</Text></View>
          </View>
          <View style={lm.canvas}>
            <SvgXml xml={result!.logo_svg} width="100%" height={200} />
          </View>
          {result?.name_options && result.name_options.length > 0 && (
            <View style={{ padding: 14, gap: 8, borderTopWidth: 1, borderTopColor: DS.border }}>
              <Text style={{ fontSize: 10, color: DS.textMuted, fontWeight: '700', letterSpacing: 1.2, textTransform: 'uppercase' }}>Name Concepts</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                {result.name_options.map((n, i) => {
                  const isActive = (selectedName || result.brand_name) === n;
                  return (
                    <TouchableOpacity
                      key={i}
                      style={{ backgroundColor: isActive ? styleOpt.color : styleOpt.bg, borderRadius: DS.radiusBadge, paddingHorizontal: 12, paddingVertical: 5, borderWidth: 1.5, borderColor: styleOpt.color + (isActive ? 'ff' : '60') }}
                      onPress={() => onSelectName?.(n)}
                      activeOpacity={0.75}
                    >
                      <Text style={{ fontSize: 12, fontWeight: '700', color: isActive ? DS.bgCard : styleOpt.color }}>{n}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          )}
          <View style={lm.footer}>
            <StatusBadge label="AI-Generated" variant="success" />
            <Text style={lm.footerHint}>SVG · exportable</Text>
          </View>
        </AppCard>
      ) : (
        <BrandConceptPreview
          brandName={displayName}
          tagline={displayTag}
          style={style}
          colorPalette={colorPalette}
          activeIdx={activeConceptIdx}
          onSelectIdx={onConceptIdx}
          directionId={directionId}
        />
      )}

      {genError !== '' && (
        <View style={{ backgroundColor: DS.dangerBg, borderRadius: DS.radiusChip, padding: 12, gap: 8 }}>
          <Text style={{ fontSize: 12, color: DS.dangerText, lineHeight: 18 }}>{genError}</Text>
          <TouchableOpacity
            style={{ alignSelf: 'flex-start', paddingHorizontal: 12, paddingVertical: 6, borderRadius: DS.radiusButton, backgroundColor: DS.danger + '18', borderWidth: 1, borderColor: DS.danger + '40' }}
            onPress={onRetry}
            activeOpacity={0.8}
          >
            <Text style={{ fontSize: 12, fontWeight: '700', color: DS.danger }}>↺ Retry</Text>
          </TouchableOpacity>
        </View>
      )}
      {exportError !== '' && (
        <View style={{ backgroundColor: DS.dangerBg, borderRadius: 10, padding: 10 }}>
          <Text style={{ fontSize: 12, color: DS.dangerText }}>{exportError}</Text>
        </View>
      )}

      <View style={at.actions}>
        <PrimaryButton label={loading ? 'Generating...' : hasResult ? 'Regenerate Logo' : 'Generate Logo'} onPress={onGenerate} icon="✦" loading={loading} style={{ backgroundColor: accentColor, shadowColor: accentColor }} />
        <SecondaryButton
          label={exportLoading ? 'Exporting...' : 'Export SVG'}
          onPress={onExport}
          icon="↓"
          disabled={!hasSvg}
          loading={exportLoading}
        />
      </View>
      {result && (
        <>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: DS.warning + '14', borderRadius: DS.radiusChip, paddingHorizontal: 10, paddingVertical: 6, borderWidth: 1, borderColor: DS.warning + '30' }}>
            <Text style={{ fontSize: 10, fontWeight: '800', color: DS.warning }}>AI CONCEPT DRAFT</Text>
            <Text style={{ fontSize: 10, color: DS.textMuted, flex: 1 }}>Logo is a starting point — review before use in production or marketing.</Text>
          </View>
          <FeasibilityHeart
            type="brand"
            label={`${result.brand_name} — ${result.tagline}`}
            data={{ brand_name: result.brand_name, tagline: result.tagline, name_options: result.name_options, listing_title: result.listing?.title, generated_keywords: result.generated_keywords }}
          />
        </>
      )}
    </View>
  );
}

const lm = StyleSheet.create({
  previewCard: { overflow: 'hidden' },
  canvas: {
    alignItems:        'center',
    justifyContent:    'center',
    paddingVertical:   40,
    paddingHorizontal: 24,
    gap:               12,
    backgroundColor:   DS.bgSubtle,
    borderBottomWidth: 1,
    borderBottomColor: DS.border,
    minHeight:         200,
  },
  mark: {
    width: 80, height: 80, borderRadius: 24,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1.5,
  },
  markIcon:    { fontSize: 36, fontWeight: '800' },
  brandName: {
    fontSize: 22, fontWeight: '900', color: DS.textPrimary,
    letterSpacing: -0.8, textAlign: 'center',
  },
  tagline:    { fontSize: 11, color: DS.textMuted, letterSpacing: 1.5, textTransform: 'uppercase' },
  helperRow: {
    paddingHorizontal: 16, paddingTop: 10,
    borderTopWidth: 1, borderTopColor: DS.border,
  },
  helperText: { fontSize: 11, color: DS.textMuted, textAlign: 'center', lineHeight: 16 },
  footer: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    padding: 16,
  },
  footerHint: { fontSize: 11, color: DS.textMuted },
});

// ── Label Generator tab ───────────────────────────────────────────────────────

function LabelGeneratorTab({
  brandName, tagline, loading, warmingUp, result, onGenerate, genError, onRetry, exportLoading, exportError, onExport, accentColor, packagingType, onPackagingType,
}: {
  brandName:       string;
  tagline:         string;
  loading:         boolean;
  warmingUp?:      boolean;
  result:          LabelResult | null;
  onGenerate:      () => void;
  genError:        string;
  onRetry:         () => void;
  exportLoading:   boolean;
  exportError:     string;
  onExport:        () => void;
  accentColor:     string;
  packagingType:   string;
  onPackagingType: (v: string) => void;
}) {
  const displayName = brandName.trim() || 'Your Brand';
  const hasSvg      = !!result?.label_svg && isValidSvg(result.label_svg);
  const pkgLabel    = PACKAGING_TYPES.find(p => p.id === packagingType)?.label ?? 'Standard';

  return (
    <View style={at.wrap}>
      <PackagingTypePicker value={packagingType} onChange={onPackagingType} />

      {/* Label preview */}
      <AppCard padding={0} style={lg.previewCard}>
        <View style={lg.canvas}>
          {loading ? (
            <View style={{ alignItems: 'center', gap: 12, paddingVertical: 40 }}>
              <PulseDots color={accentColor} />
              <Text style={{ fontSize: 13, color: DS.textMuted }}>
                {warmingUp ? 'Connecting to server… first request may take a moment.' : `Generating ${pkgLabel.toLowerCase()} label...`}
              </Text>
            </View>
          ) : hasSvg ? (
            <>
              <View style={{ paddingHorizontal: 10, paddingTop: 8 }}>
                <View style={aiDraftBadgeStyle}><Text style={aiDraftBadgeTxtStyle}>AI DRAFT</Text></View>
              </View>
              <SvgXml xml={result!.label_svg} width="100%" height={240} />
            </>
          ) : (
            <>
              {/* Header band — adapts to packaging type */}
              <View style={[lg.band, { backgroundColor: accentColor }]}>
                <Text style={lg.bandText}>{displayName.toUpperCase()} · {pkgLabel.toUpperCase()}</Text>
              </View>

              {/* Body */}
              <View style={lg.body}>
                <Text style={lg.productName}>{displayName}</Text>
                <Text style={lg.subName}>{tagline.trim() || 'Product Category / Collection'}</Text>

                <View style={lg.bullets}>
                  {['✓ Key Benefit 1', '✓ Key Benefit 2', '✓ Key Benefit 3'].map(b => (
                    <Text key={b} style={lg.bullet}>{b}</Text>
                  ))}
                </View>

                <View style={lg.materialRow}>
                  <Text style={lg.materialLabel}>Format:</Text>
                  <Text style={lg.materialValue}>{pkgLabel} · Material / Size</Text>
                </View>
              </View>

              {/* Barcode placeholder */}
              <View style={lg.barcodeRow}>
                <View style={lg.barcodePlaceholder}>
                  <Text style={lg.barcodePlaceholderText}>Barcode / UPC · configure in barcode step</Text>
                </View>
              </View>
            </>
          )}
        </View>

        {!result && !loading && (
          <View style={lg.helperRow}>
            <Text style={lg.helperText}>Concept mockup — generate to receive AI label SVG.</Text>
          </View>
        )}
        <View style={lg.footer}>
          <StatusBadge label={result ? (hasSvg ? 'AI-Generated' : 'Concept Preview') : 'Concept Preview'} variant={result && hasSvg ? 'success' : 'info'} />
          <Text style={lg.footerHint}>{pkgLabel} format</Text>
        </View>
      </AppCard>

      {/* AI-Generated disclosure + Compliance disclaimer */}
      <View style={lg.disclaimer}>
        <Text style={lg.disclaimerText}>
          🤖 AI-Generated Concept
        </Text>
        <Text style={[lg.disclaimerText, { fontSize: 11, marginTop: 6 }]}>
          This brand is generated by AI as a brainstorm starting point. Verify trademark availability, update for compliance requirements (nutrition labels, warnings, materials, country of origin), and test with your target audience before going live.
        </Text>
      </View>

      {genError !== '' && (
        <View style={{ backgroundColor: DS.dangerBg, borderRadius: DS.radiusChip, padding: 12, gap: 8 }}>
          <Text style={{ fontSize: 12, color: DS.dangerText, lineHeight: 18 }}>{genError}</Text>
          <TouchableOpacity
            style={{ alignSelf: 'flex-start', paddingHorizontal: 12, paddingVertical: 6, borderRadius: DS.radiusButton, backgroundColor: DS.danger + '18', borderWidth: 1, borderColor: DS.danger + '40' }}
            onPress={onRetry}
            activeOpacity={0.8}
          >
            <Text style={{ fontSize: 12, fontWeight: '700', color: DS.danger }}>↺ Retry</Text>
          </TouchableOpacity>
        </View>
      )}
      {exportError !== '' && (
        <View style={{ backgroundColor: DS.dangerBg, borderRadius: 10, padding: 10 }}>
          <Text style={{ fontSize: 12, color: DS.dangerText }}>{exportError}</Text>
        </View>
      )}

      <View style={at.actions}>
        <PrimaryButton label={loading ? 'Generating...' : result ? 'Regenerate Label' : 'Generate Label'} onPress={onGenerate} icon="≡" loading={loading} style={{ backgroundColor: accentColor, shadowColor: accentColor }} />
        <SecondaryButton
          label={exportLoading ? 'Exporting...' : 'Export Label'}
          onPress={onExport}
          icon="↓"
          disabled={!hasSvg}
          loading={exportLoading}
        />
      </View>
    </View>
  );
}

const lg = StyleSheet.create({
  previewCard: { overflow: 'hidden' },
  canvas: {
    backgroundColor: DS.bgSubtle,
    borderBottomWidth: 1, borderBottomColor: DS.border,
  },
  band: {
    paddingVertical: 8, paddingHorizontal: 16,
    alignItems: 'center',
  },
  bandText: {
    color: DS.bgCard, fontSize: 10, fontWeight: '900', letterSpacing: 3,
  },
  body: {
    padding: 16, gap: 10,
  },
  productName: {
    fontSize: 20, fontWeight: '900', color: DS.textPrimary, letterSpacing: -0.5,
  },
  subName: { fontSize: 12, color: DS.textMuted },
  bullets: { gap: 4 },
  bullet:  { fontSize: 12, color: DS.textSecondary, fontWeight: '500' },
  materialRow: { flexDirection: 'row', gap: 6, alignItems: 'center' },
  materialLabel: { fontSize: 11, color: DS.textMuted, fontWeight: '600' },
  materialValue: { fontSize: 11, color: DS.textPrimary, fontWeight: '700' },
  barcodeRow: {
    alignItems: 'center', paddingBottom: 14, paddingHorizontal: 16,
  },
  barcodePlaceholder: {
    borderWidth: 1, borderColor: DS.border, borderRadius: 6, borderStyle: 'dashed',
    paddingHorizontal: 14, paddingVertical: 8,
  },
  barcodePlaceholderText: { fontSize: 10, color: DS.textMuted, fontWeight: '500' },
  helperRow: {
    paddingHorizontal: 16, paddingTop: 10,
    borderTopWidth: 1, borderTopColor: DS.border,
  },
  helperText: { fontSize: 11, color: DS.textMuted, textAlign: 'center', lineHeight: 16 },
  disclaimer: {
    backgroundColor: DS.warningBg, borderRadius: 10,
    paddingHorizontal: 12, paddingVertical: 8,
  },
  disclaimerText: { fontSize: 11, color: DS.textSecondary, lineHeight: 16 },
  footer: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    padding: 16,
  },
  footerHint: { fontSize: 11, color: DS.textMuted },
});

// ── Packaging Insert tab ──────────────────────────────────────────────────────

function PackagingInsertTab({
  brandName, loading, result, onGenerate, genError, exportLoading, exportError, onExport, accentColor, labelFields,
}: {
  brandName:     string;
  loading:       boolean;
  result:        LabelResult | null;
  onGenerate:    () => void;
  genError:      string;
  exportLoading: boolean;
  exportError:   string;
  onExport:      () => void;
  accentColor:   string;
  labelFields?:  Record<string, string>;
}) {
  const displayName = brandName.trim() || 'Your Brand';
  const hasSvg      = !!result?.insert_svg && isValidSvg(result.insert_svg);

  return (
    <View style={at.wrap}>
      {/* Insert preview */}
      <AppCard padding={0} style={pi.previewCard}>
        <View style={pi.canvas}>
          {hasSvg ? (
            <SvgXml xml={result!.insert_svg} width="100%" height={240} />
          ) : (
            <>
              {/* Thank-you headline */}
              <View style={pi.thankYouBand}>
                <Text style={pi.thankYouEmoji}>💚</Text>
                <Text style={[pi.thankYouHeadline, { color: accentColor }]}>Thank You!</Text>
                <Text style={pi.thankYouSub}>
                  You're amazing for choosing {displayName}.
                </Text>
              </View>

              {/* Review request */}
              <View style={pi.section}>
                <Text style={pi.sectionTitle}>Love it? Tell the world ⭐</Text>
                <Text style={pi.sectionBody}>
                  Honest reviews help other shoppers and support our small business.
                  Tap below to leave a quick review on Amazon — it takes under 60 seconds!
                </Text>
              </View>

              {/* QR placeholder — not a real QR code */}
              <View style={pi.qrRow}>
                <View style={pi.qrBox}>
                  <Text style={pi.qrPlaceholderText}>QR{'\n'}code{'\n'}here</Text>
                </View>
                <View style={pi.qrInfo}>
                  <Text style={pi.qrLabel}>Scan to leave a review</Text>
                  <Text style={pi.qrUrl}>{labelFields?.['qrText'] || 'amazon.com/review/[ASIN]'}</Text>
                  <View style={pi.supportRow}>
                    <Text style={pi.supportLabel}>Support: </Text>
                    <Text style={pi.supportEmail}>{labelFields?.['supportUrl'] || 'support@yourbrand.com'}</Text>
                  </View>
                </View>
              </View>
            </>
          )}
        </View>

        {!result && (
          <View style={pi.helperRow}>
            <Text style={pi.helperText}>Your generated insert will appear here after generation.</Text>
          </View>
        )}
        <View style={pi.footer}>
          <StatusBadge label={result ? 'Generated' : 'Template Preview'} variant={result ? 'success' : 'info'} />
          <Text style={pi.footerHint}>{result ? (hasSvg ? 'AI-generated SVG' : 'AI-generated') : 'Template Preview'}</Text>
        </View>
      </AppCard>

      {/* Task 6 — insert disclaimer */}
      <View style={pi.disclaimer}>
        <Text style={pi.disclaimerText}>
          Template concept only. Add your real review link, support email, and QR code before printing.
        </Text>
      </View>

      {genError !== '' && (
        <View style={{ backgroundColor: DS.dangerBg, borderRadius: 10, padding: 10 }}>
          <Text style={{ fontSize: 12, color: DS.dangerText }}>{genError}</Text>
        </View>
      )}
      {exportError !== '' && (
        <View style={{ backgroundColor: DS.dangerBg, borderRadius: 10, padding: 10 }}>
          <Text style={{ fontSize: 12, color: DS.dangerText }}>{exportError}</Text>
        </View>
      )}

      <View style={at.actions}>
        <PrimaryButton label={loading ? 'Generating...' : 'Generate Insert'} onPress={onGenerate} icon="◻" loading={loading} style={{ backgroundColor: accentColor, shadowColor: accentColor }} />
        <SecondaryButton
          label={exportLoading ? 'Exporting...' : 'Export Insert'}
          onPress={onExport}
          icon="↓"
          disabled={!hasSvg}
          loading={exportLoading}
        />
      </View>
    </View>
  );
}

const pi = StyleSheet.create({
  previewCard: { overflow: 'hidden' },
  canvas: {
    backgroundColor: DS.bgSubtle,
    borderBottomWidth: 1, borderBottomColor: DS.border,
    gap: 0,
  },
  thankYouBand: {
    backgroundColor: DS.accentLight,
    alignItems:      'center',
    paddingVertical: 20,
    paddingHorizontal: 24,
    gap: 6,
    borderBottomWidth: 1, borderBottomColor: DS.border,
  },
  thankYouEmoji:    { fontSize: 32 },
  thankYouHeadline: { fontSize: 22, fontWeight: '900', letterSpacing: -0.6 },
  thankYouSub:      { fontSize: 12, color: DS.textSecondary, textAlign: 'center', lineHeight: 18 },
  section: {
    padding: 16, gap: 8,
    borderBottomWidth: 1, borderBottomColor: DS.border,
  },
  sectionTitle: { fontSize: 14, fontWeight: '800', color: DS.textPrimary, letterSpacing: -0.3 },
  sectionBody:  { fontSize: 12, color: DS.textSecondary, lineHeight: 19 },
  qrRow: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    padding: 16,
  },
  qrBox: {
    width: 64, height: 64, borderRadius: 10,
    backgroundColor: DS.bgSubtle,
    borderWidth: 1.5, borderColor: DS.border, borderStyle: 'dashed',
    alignItems: 'center', justifyContent: 'center',
    flexShrink: 0,
  },
  qrPlaceholderText: { fontSize: 9, color: DS.textMuted, textAlign: 'center', fontWeight: '600', lineHeight: 13 },
  qrInfo:  { flex: 1, gap: 5 },
  qrLabel: { fontSize: 12, fontWeight: '700', color: DS.textPrimary },
  qrUrl:   { fontSize: 10, color: DS.textMuted, fontWeight: '500', fontStyle: 'italic' },
  supportRow: { flexDirection: 'row', alignItems: 'center' },
  supportLabel: { fontSize: 10, color: DS.textMuted },
  supportEmail: { fontSize: 10, color: DS.textMuted, fontStyle: 'italic' },
  helperRow: {
    paddingHorizontal: 16, paddingTop: 10,
    borderTopWidth: 1, borderTopColor: DS.border,
  },
  helperText: { fontSize: 11, color: DS.textMuted, textAlign: 'center', lineHeight: 16 },
  disclaimer: {
    backgroundColor: DS.warningBg, borderRadius: 10,
    paddingHorizontal: 12, paddingVertical: 8,
  },
  disclaimerText: { fontSize: 11, color: DS.textSecondary, lineHeight: 16 },
  footer: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    padding: 16,
  },
  footerHint: { fontSize: 11, color: DS.textMuted },
});

// Shared asset-tab wrapper styles
const at = StyleSheet.create({
  wrap:    { gap: 14 },
  actions: { gap: 10 },
});

// ── Brand Recommendations card ────────────────────────────────────────────────

const BrandRecommendationsCard = React.memo(function BrandRecommendationsCard() {
  return (
    <AppCard style={br.card}>
      <View style={br.cardHeader}>
        <View style={br.cardHeaderIcon}>
          <Text style={br.cardHeaderGlyph}>💡</Text>
        </View>
        <Text style={br.cardHeaderTitle}>Brand Recommendations</Text>
      </View>
      <View style={br.rows}>
        {BRAND_RECOMMENDATIONS.map((rec, i) => (
          <View key={i} style={[br.row, i < BRAND_RECOMMENDATIONS.length - 1 && br.rowBorder]}>
            <View style={br.recIcon}>
              <Text style={br.recEmoji}>{rec.icon}</Text>
            </View>
            <View style={br.recText}>
              <Text style={br.recTitle}>{rec.title}</Text>
              <Text style={br.recBody}>{rec.body}</Text>
            </View>
          </View>
        ))}
      </View>
    </AppCard>
  );
});

const br = StyleSheet.create({
  card:           { gap: 16 },
  cardHeader:     { flexDirection: 'row', alignItems: 'center', gap: 10 },
  cardHeaderIcon: {
    width: 32, height: 32, borderRadius: 10,
    backgroundColor: DS.warningBg,
    alignItems: 'center', justifyContent: 'center',
  },
  cardHeaderGlyph: { fontSize: 16 },
  cardHeaderTitle: { fontSize: 15, fontWeight: '800', color: DS.textPrimary, letterSpacing: -0.3 },
  rows:            { gap: 0 },
  row: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 12,
    paddingVertical: 12,
  },
  rowBorder: { borderBottomWidth: 1, borderBottomColor: DS.borderLight },
  recIcon: {
    width: 36, height: 36, borderRadius: 10,
    backgroundColor: DS.bgSubtle,
    alignItems: 'center', justifyContent: 'center',
    flexShrink: 0,
  },
  recEmoji:  { fontSize: 18 },
  recText:   { flex: 1, gap: 3 },
  recTitle:  { fontSize: 13, fontWeight: '700', color: DS.textPrimary },
  recBody:   { fontSize: 12, color: DS.textSecondary, lineHeight: 18 },
});

// ── Amazon Compliance Card ────────────────────────────────────────────────────

const BASE_COMPLIANCE = [
  { label: 'Brand name clearly visible',          required: true  },
  { label: 'Product name / description',          required: true  },
  { label: 'Net weight / quantity stated',        required: true  },
  { label: 'Country of origin',                   required: true  },
  { label: 'FNSKU barcode (on unit & packaging)', required: true  },
  { label: 'UPC / EAN barcode',                   required: false },
];

const CATEGORY_COMPLIANCE: Record<string, { label: string; required: boolean }[]> = {
  food: [
    { label: 'Ingredient list (all ingredients)',      required: true  },
    { label: 'Nutrition facts panel',                  required: true  },
    { label: 'Allergen declaration',                   required: true  },
    { label: 'Best-before / expiry date',              required: true  },
    { label: 'FDA facility registration number',       required: false },
  ],
  supplement: [
    { label: 'Supplement facts panel',                 required: true  },
    { label: 'Serving size and servings per container',required: true  },
    { label: 'FDA disclaimer statement',               required: true  },
    { label: 'Allergen declaration',                   required: true  },
  ],
  toy: [
    { label: 'Age grading / safety warning',           required: true  },
    { label: 'Choking hazard warning (if applicable)', required: true  },
    { label: 'ASTM F963 / EN71 compliance mark',      required: false },
  ],
  baby: [
    { label: 'Age grading clearly stated',             required: true  },
    { label: 'Choking hazard warning',                 required: true  },
    { label: 'CPSC safety certification',              required: true  },
  ],
  electronics: [
    { label: 'CE / FCC / RoHS mark',                  required: true  },
    { label: 'Electrical ratings (V, A, Hz)',          required: true  },
    { label: 'Warning against water / shock exposure', required: false },
  ],
  cosmetic: [
    { label: 'Full ingredient list (INCI names)',      required: true  },
    { label: 'Net quantity of contents',               required: true  },
    { label: 'Directions for use',                     required: true  },
    { label: 'Warnings (e.g. "For external use only")',required: false },
  ],
  bag: [
    { label: 'Suffocation warning (≥38pt font)',       required: true  },
  ],
};

function detectCategoryKey(category?: string): string | null {
  if (!category) return null;
  const c = category.toLowerCase();
  if (c.includes('food') || c.includes('grocery') || c.includes('drink') || c.includes('beverage')) return 'food';
  if (c.includes('supplement') || c.includes('vitamin') || c.includes('protein') || c.includes('health')) return 'supplement';
  if (c.includes('toy') || c.includes('game') || c.includes('puzzle')) return 'toy';
  if (c.includes('baby') || c.includes('infant') || c.includes('toddler')) return 'baby';
  if (c.includes('electronic') || c.includes('gadget') || c.includes('device') || c.includes('cable')) return 'electronics';
  if (c.includes('cosmetic') || c.includes('beauty') || c.includes('skin') || c.includes('makeup')) return 'cosmetic';
  if (c.includes('bag') || c.includes('pouch') || c.includes('packaging') || c.includes('poly')) return 'bag';
  return null;
}

function AmazonComplianceCard({ category }: { category?: string }) {
  const catKey = detectCategoryKey(category);
  const categoryItems = catKey ? (CATEGORY_COMPLIANCE[catKey] ?? []) : [];
  const allItems = [...BASE_COMPLIANCE, ...categoryItems];

  return (
    <AppCard style={{ gap: 12 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <Text style={{ fontSize: 16 }}>✅</Text>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 13, fontWeight: '800', color: DS.textPrimary }}>Amazon Compliance Checklist</Text>
          <Text style={{ fontSize: 11, color: DS.textMuted }}>
            {catKey ? `${catKey.charAt(0).toUpperCase() + catKey.slice(1)}-specific requirements` : 'Required elements before sending to supplier'}
          </Text>
        </View>
      </View>
      {allItems.map((item, i) => (
        <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <View style={{
            width: 20, height: 20, borderRadius: 10,
            backgroundColor: item.required ? DS.success + '18' : DS.bgElevated,
            alignItems: 'center', justifyContent: 'center',
          }}>
            <Text style={{ fontSize: 10, color: item.required ? DS.success : DS.textMuted, fontWeight: '800' }}>
              {item.required ? '✓' : '○'}
            </Text>
          </View>
          <Text style={{ fontSize: 13, color: DS.textSecondary, flex: 1 }}>{item.label}</Text>
          {item.required && (
            <View style={{ backgroundColor: DS.danger + '12', borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 }}>
              <Text style={{ fontSize: 9, fontWeight: '800', color: DS.danger }}>REQ</Text>
            </View>
          )}
        </View>
      ))}
    </AppCard>
  );
}

// ── Pipeline context banner ───────────────────────────────────────────────────

function PipelineContextBanner({
  product, niche, supplier,
}: {
  product?:  string | null;
  niche?:    string | null;
  supplier?: string | null;
}) {
  const items = [
    product  && { icon: '📦', label: 'Product', value: product },
    niche    && { icon: '🔍', label: 'Niche',   value: niche   },
    supplier && { icon: '🏭', label: 'Supplier', value: supplier },
  ].filter(Boolean) as { icon: string; label: string; value: string }[];

  if (items.length === 0) return null;

  return (
    <AppCard style={pb.card}>
      <View style={pb.header}>
        <Text style={pb.title}>Pipeline Context</Text>
        <Text style={pb.sub}>Auto-filled from your pipeline</Text>
      </View>
      <View style={pb.rows}>
        {items.map((item, i) => (
          <View key={i} style={pb.row}>
            <Text style={pb.icon}>{item.icon}</Text>
            <Text style={pb.label}>{item.label}</Text>
            <Text style={pb.value} numberOfLines={1}>{item.value}</Text>
          </View>
        ))}
      </View>
    </AppCard>
  );
}

const pb = StyleSheet.create({
  card:   { gap: 10, backgroundColor: DS.accentLight, borderWidth: 1, borderColor: DS.accent + '30' },
  header: { gap: 2 },
  title:  { fontSize: 12, fontWeight: '800', color: DS.accent, letterSpacing: 0.3, textTransform: 'uppercase' },
  sub:    { fontSize: 11, color: DS.textMuted },
  rows:   { gap: 6 },
  row:    { flexDirection: 'row', alignItems: 'center', gap: 8 },
  icon:   { fontSize: 13 },
  label:  { fontSize: 12, fontWeight: '600', color: DS.textSecondary, width: 56 },
  value:  { fontSize: 12, color: DS.textPrimary, fontWeight: '700', flex: 1 },
});

// ── Copilot Tip Card ─────────────────────────────────────────────────────────

function CopilotTipCard({ tip, icon = '💡', accent }: { tip: string; icon?: string; accent?: string }) {
  const [hidden, setHidden] = React.useState(false);
  if (hidden) return null;
  const col = accent ?? DS.accent;
  return (
    <View style={[ctp.wrap, { borderLeftColor: col, backgroundColor: col + '10' }]}>
      <View style={ctp.inner}>
        <Text style={ctp.icon}>{icon}</Text>
        <Text style={ctp.txt}>{tip}</Text>
        <TouchableOpacity onPress={() => setHidden(true)} hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }} activeOpacity={0.6}>
          <Text style={ctp.dismiss}>✕</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const ctp = StyleSheet.create({
  wrap:    { borderRadius: DS.radiusChip, borderLeftWidth: 3, paddingHorizontal: 12, paddingVertical: 10 },
  inner:   { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  icon:    { fontSize: 14, marginTop: 1 },
  txt:     { flex: 1, fontSize: 12, color: DS.textSecondary, lineHeight: 18, fontWeight: '500' },
  dismiss: { fontSize: 11, color: DS.textMuted, fontWeight: '700', marginTop: 2 },
});

// ── Barcode Workflow Card ─────────────────────────────────────────────────────

type BarcodeMode    = 'private_label' | 'resale' | 'own_brand';
type BarcodeIdType  = 'gs1_upc' | 'fnsku_only' | 'existing' | 'retail_plus_fnsku';
type BarcodePlace   = 'back_bottom' | 'back_top' | 'bottom' | 'supplied';
type BarcodePackage = 'poly_bag' | 'box' | 'bottle' | 'pouch';

const BRC_MODES: { id: BarcodeMode; label: string; desc: string; icon: string }[] = [
  { id: 'private_label', label: 'Private Label', desc: 'My own brand on a manufacturer product', icon: '✦' },
  { id: 'resale',        label: 'Resale',        desc: 'Selling an existing product as-is',     icon: '→' },
  { id: 'own_brand',     label: 'Own Brand',     desc: 'I have a registered trademark',         icon: '◆' },
];

const BRC_ID: Record<BarcodeMode, { id: BarcodeIdType; label: string; desc: string; recommended?: boolean }[]> = {
  private_label: [
    { id: 'gs1_upc',    label: 'GS1 UPC + FNSKU',  desc: 'Get UPC from GS1, apply FNSKU label over it for FBA',   recommended: true },
    { id: 'fnsku_only', label: 'FNSKU Only',        desc: 'Amazon assigns FNSKU — no retail UPC needed' },
  ],
  resale: [
    { id: 'existing',          label: 'Use Manufacturer UPC', desc: 'Product already has a UPC from the brand',      recommended: true },
    { id: 'retail_plus_fnsku', label: 'UPC + FNSKU Override', desc: 'Apply FNSKU label over existing UPC for FBA' },
  ],
  own_brand: [
    { id: 'gs1_upc',           label: 'GS1 UPC (Brand Registry)', desc: 'Required for Brand Registry and retail', recommended: true },
    { id: 'retail_plus_fnsku', label: 'GS1 UPC + FNSKU',          desc: 'Full setup for both retail and Amazon FBA' },
  ],
};

const BRC_PLACES: { id: BarcodePlace; label: string }[] = [
  { id: 'back_bottom', label: 'Back Bottom' },
  { id: 'back_top',    label: 'Back Top' },
  { id: 'bottom',      label: 'Bottom Panel' },
  { id: 'supplied',    label: 'Supplier Applies' },
];

const BRC_PACKS: { id: BarcodePackage; label: string; icon: string }[] = [
  { id: 'poly_bag', label: 'Poly Bag', icon: '◻' },
  { id: 'box',      label: 'Box',      icon: '▣' },
  { id: 'bottle',   label: 'Bottle',   icon: '⬭' },
  { id: 'pouch',    label: 'Pouch',    icon: '◈' },
];

function BarcodeWorkflowCard({
  brandName, onSave, savedMode, savedIdentifier, savedPlacement, savedPackaging,
}: {
  brandName:       string;
  onSave:          (mode: string, identifier: string, placement: string, packaging: string, gs1: boolean, fnsku: boolean) => void;
  savedMode?:      string;
  savedIdentifier?:string;
  savedPlacement?: string;
  savedPackaging?: string;
}) {
  const hasSaved = !!(savedMode && savedIdentifier);
  const [step,        setStep]        = React.useState<1|2|3>(hasSaved ? 3 : 1);
  const [mode,        setMode]        = React.useState<BarcodeMode | null>((savedMode as BarcodeMode) ?? null);
  const [idType,      setIdType]      = React.useState<BarcodeIdType | null>((savedIdentifier as BarcodeIdType) ?? null);
  const [placement,   setPlacement]   = React.useState<BarcodePlace>((savedPlacement as BarcodePlace) ?? 'back_bottom');
  const [packaging,   setPackaging]   = React.useState<BarcodePackage>((savedPackaging as BarcodePackage) ?? 'box');
  const [saved,       setSaved]       = React.useState(hasSaved);

  const idOpts     = mode ? BRC_ID[mode] : [];
  const gs1Needed  = idType === 'gs1_upc' || idType === 'retail_plus_fnsku';
  const fnskuNeeded= idType === 'fnsku_only' || idType === 'retail_plus_fnsku' || mode === 'private_label';
  const displayNum = idType === 'fnsku_only' ? 'X0012345678' : idType === 'existing' ? '[Existing UPC]' : '012345678901';

  function save() {
    if (!mode || !idType) return;
    onSave(mode, idType, placement, packaging, gs1Needed, fnskuNeeded);
    setSaved(true); setTimeout(() => setSaved(false), 2500);
  }

  return (
    <AppCard style={bw.card}>
      <View style={bw.header}>
        <View style={bw.headerIcon}><Text style={{ fontSize: 18 }}>🔲</Text></View>
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={bw.headerTitle}>Barcode Workflow</Text>
          <Text style={bw.headerSub}>
            {step === 1 ? 'Step 1 of 3 — Seller type' : step === 2 ? 'Step 2 of 3 — Barcode strategy' : 'Step 3 of 3 — Placement & save'}
          </Text>
        </View>
        <View style={bw.stepDots}>
          {([1,2,3] as const).map(n => (
            <View key={n} style={[bw.dot, step >= n && bw.dotDone, step === n && bw.dotCurrent]}>
              <Text style={[bw.dotNum, step >= n && bw.dotNumDone]}>{n}</Text>
            </View>
          ))}
        </View>
      </View>

      {step === 1 && (
        <View style={bw.section}>
          <Text style={bw.sectionLbl}>How are you selling this product?</Text>
          {BRC_MODES.map(opt => {
            const active = mode === opt.id;
            return (
              <TouchableOpacity key={opt.id} style={[bw.optRow, active && bw.optRowActive]} onPress={() => setMode(opt.id)} activeOpacity={0.75}>
                <View style={[bw.optIcon, active && bw.optIconActive]}>
                  <Text style={{ fontSize: 14, color: active ? DS.accent : DS.textMuted }}>{opt.icon}</Text>
                </View>
                <View style={{ flex: 1, gap: 2 }}>
                  <Text style={[bw.optLabel, active && bw.optLabelActive]}>{opt.label}</Text>
                  <Text style={bw.optDesc}>{opt.desc}</Text>
                </View>
                {active && <Text style={{ fontSize: 14, color: DS.accent }}>✓</Text>}
              </TouchableOpacity>
            );
          })}
          <TouchableOpacity style={[bw.nextBtn, !mode && bw.nextBtnOff]} onPress={() => mode && setStep(2)} disabled={!mode} activeOpacity={0.85}>
            <Text style={bw.nextBtnTxt}>Next: Choose Barcode Strategy →</Text>
          </TouchableOpacity>
        </View>
      )}

      {step === 2 && mode && (
        <View style={bw.section}>
          <Text style={bw.sectionLbl}>Which barcode path suits you?</Text>
          {idOpts.map(opt => {
            const active = idType === opt.id;
            return (
              <TouchableOpacity key={opt.id} style={[bw.optRow, active && bw.optRowActive]} onPress={() => setIdType(opt.id)} activeOpacity={0.75}>
                <View style={{ flex: 1, gap: 3 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <Text style={[bw.optLabel, active && bw.optLabelActive]}>{opt.label}</Text>
                    {opt.recommended && <View style={bw.recBadge}><Text style={bw.recBadgeTxt}>Recommended</Text></View>}
                  </View>
                  <Text style={bw.optDesc}>{opt.desc}</Text>
                </View>
                {active && <Text style={{ fontSize: 14, color: DS.accent, flexShrink: 0 }}>✓</Text>}
              </TouchableOpacity>
            );
          })}
          <View style={bw.btnRow}>
            <TouchableOpacity style={bw.backBtn} onPress={() => setStep(1)} activeOpacity={0.7}><Text style={bw.backBtnTxt}>← Back</Text></TouchableOpacity>
            <TouchableOpacity style={[bw.nextBtn, { flex: 1 }, !idType && bw.nextBtnOff]} onPress={() => idType && setStep(3)} disabled={!idType} activeOpacity={0.85}>
              <Text style={bw.nextBtnTxt}>Next: Placement →</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {step === 3 && mode && idType && (
        <View style={bw.section}>
          {/* Visual barcode preview */}
          <View style={bw.preview}>
            <View style={[bw.pvBand, { backgroundColor: DS.accent }]}>
              <Text style={bw.pvBrandName}>{brandName.trim() || 'YOUR BRAND'}</Text>
            </View>
            <View style={bw.pvBarcodeArea}>
              <View style={bw.pvLines}>
                {Array.from({ length: 28 }).map((_, i) => (
                  <View key={i} style={[bw.pvBar, { width: i % 3 === 0 ? 3 : i % 5 === 0 ? 1 : 2, marginRight: i % 4 === 0 ? 2 : 1 }]} />
                ))}
              </View>
              <Text style={bw.pvNum}>{displayNum}</Text>
            </View>
            <View style={bw.pvMeta}>
              <Text style={bw.pvMetaTxt}>
                {idType === 'fnsku_only' ? '● Amazon FNSKU' : idType === 'existing' ? '● Manufacturer UPC' : idType === 'gs1_upc' ? '● GS1 UPC' : '● Retail UPC + FNSKU Override'}
              </Text>
            </View>
          </View>

          {/* Action chips */}
          <View style={bw.reqRow}>
            {gs1Needed  && <View style={[bw.reqChip, { backgroundColor: DS.accent + '12', borderColor: DS.accent + '30' }]}><Text style={[bw.reqChipTxt, { color: DS.accent }]}>→ Register at gs1.org for UPC</Text></View>}
            {fnskuNeeded && <View style={[bw.reqChip, { backgroundColor: DS.success + '12', borderColor: DS.success + '30' }]}><Text style={[bw.reqChipTxt, { color: DS.success }]}>→ Generate FNSKU in Seller Central</Text></View>}
          </View>

          {/* Placement */}
          <View style={bw.subSec}>
            <Text style={bw.subSecLbl}>Barcode Placement on Packaging</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {BRC_PLACES.map(opt => {
                const active = placement === opt.id;
                return (
                  <TouchableOpacity key={opt.id} style={[bw.chip, active && bw.chipActive]} onPress={() => setPlacement(opt.id)} activeOpacity={0.75}>
                    <Text style={[bw.chipTxt, active && bw.chipTxtActive]}>{opt.label}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          {/* Packaging type */}
          <View style={bw.subSec}>
            <Text style={bw.subSecLbl}>Packaging Type</Text>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              {BRC_PACKS.map(opt => {
                const active = packaging === opt.id;
                return (
                  <TouchableOpacity key={opt.id} style={[bw.packBtn, active && bw.packBtnActive]} onPress={() => setPackaging(opt.id)} activeOpacity={0.75}>
                    <Text style={{ fontSize: 14, color: active ? DS.accent : DS.textMuted }}>{opt.icon}</Text>
                    <Text style={[bw.chipTxt, active && bw.chipTxtActive]}>{opt.label}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          <View style={bw.btnRow}>
            <TouchableOpacity style={bw.backBtn} onPress={() => setStep(2)} activeOpacity={0.7}><Text style={bw.backBtnTxt}>← Back</Text></TouchableOpacity>
            <TouchableOpacity style={[bw.nextBtn, { flex: 1 }, saved && { backgroundColor: DS.success }]} onPress={save} activeOpacity={0.85}>
              <Text style={bw.nextBtnTxt}>{saved ? '✓ Config Saved' : '▣ Save Barcode Config'}</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </AppCard>
  );
}

const bw = StyleSheet.create({
  card:         { gap: 16 },
  header:       { flexDirection: 'row', alignItems: 'center', gap: 12 },
  headerIcon:   { width: 40, height: 40, borderRadius: 12, backgroundColor: DS.bgElevated, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  headerTitle:  { fontSize: 14, fontWeight: '800', color: DS.textPrimary },
  headerSub:    { fontSize: 11, color: DS.textMuted },
  stepDots:     { flexDirection: 'row', gap: 4 },
  dot:          { width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center', backgroundColor: DS.bgElevated, borderWidth: 1, borderColor: DS.border },
  dotDone:      { backgroundColor: DS.accentLight, borderColor: DS.accent + '50' },
  dotCurrent:   { borderColor: DS.accent },
  dotNum:       { fontSize: 10, fontWeight: '800', color: DS.textMuted },
  dotNumDone:   { color: DS.accent },
  section:      { gap: 12 },
  sectionLbl:   { fontSize: 13, fontWeight: '700', color: DS.textPrimary },
  optRow:       { flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 1.5, borderColor: DS.border, borderRadius: DS.radiusInput, padding: 12, backgroundColor: DS.bgCard },
  optRowActive: { borderColor: DS.accent, backgroundColor: DS.accentLight },
  optIcon:      { width: 36, height: 36, borderRadius: 10, backgroundColor: DS.bgElevated, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  optIconActive:{ backgroundColor: DS.accentLight },
  optLabel:     { fontSize: 13, fontWeight: '700', color: DS.textPrimary },
  optLabelActive:{ color: DS.accent },
  optDesc:      { fontSize: 11, color: DS.textMuted, lineHeight: 16 },
  recBadge:     { backgroundColor: DS.success + '15', borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 },
  recBadgeTxt:  { fontSize: 9, fontWeight: '800', color: DS.success },
  nextBtn:      { backgroundColor: DS.accent, borderRadius: DS.radiusButton, paddingVertical: 12, alignItems: 'center' },
  nextBtnOff:   { backgroundColor: DS.bgElevated },
  nextBtnTxt:   { fontSize: 13, fontWeight: '800', color: DS.bgCard },
  btnRow:       { flexDirection: 'row', gap: 8, alignItems: 'center' },
  backBtn:      { borderWidth: 1, borderColor: DS.border, borderRadius: DS.radiusButton, paddingVertical: 12, paddingHorizontal: 16, alignItems: 'center' },
  backBtnTxt:   { fontSize: 13, fontWeight: '700', color: DS.textSecondary },
  // Preview
  preview:      { borderRadius: 12, overflow: 'hidden', borderWidth: 1, borderColor: DS.border, backgroundColor: DS.bgCard },
  pvBand:       { paddingVertical: 10, paddingHorizontal: 16, alignItems: 'center' },
  pvBrandName:  { fontSize: 11, fontWeight: '900', color: DS.bgCard, letterSpacing: 2 },
  pvBarcodeArea:{ alignItems: 'center', paddingVertical: 14, paddingHorizontal: 20, gap: 6 },
  pvLines:      { flexDirection: 'row', alignItems: 'flex-end', height: 46 },
  pvBar:        { height: '100%', backgroundColor: DS.textPrimary },
  pvNum:        { fontSize: 10, color: DS.textSecondary, fontWeight: '500', letterSpacing: 1 },
  pvMeta:       { borderTopWidth: 1, borderTopColor: DS.border, paddingHorizontal: 14, paddingVertical: 8, alignItems: 'center' },
  pvMetaTxt:    { fontSize: 10, color: DS.textMuted, fontWeight: '600' },
  reqRow:       { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  reqChip:      { borderWidth: 1, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6 },
  reqChipTxt:   { fontSize: 11, fontWeight: '700' },
  subSec:       { gap: 8 },
  subSecLbl:    { fontSize: 12, fontWeight: '700', color: DS.textSecondary },
  chip:         { borderWidth: 1, borderColor: DS.border, borderRadius: DS.radiusBadge, paddingHorizontal: 12, paddingVertical: 6, backgroundColor: DS.bgCard },
  chipActive:   { borderColor: DS.accent, backgroundColor: DS.accentLight },
  chipTxt:      { fontSize: 12, fontWeight: '600', color: DS.textSecondary },
  chipTxtActive:{ color: DS.accent, fontWeight: '700' },
  packBtn:      { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, borderWidth: 1, borderColor: DS.border, borderRadius: DS.radiusChip, paddingVertical: 9, backgroundColor: DS.bgCard },
  packBtnActive:{ borderColor: DS.accent, backgroundColor: DS.accentLight },
});

// ── Label Workspace ───────────────────────────────────────────────────────────

interface LabelFields {
  productName: string; tagline: string; ingredients: string;
  warnings: string; directions: string; qrText: string;
  supportUrl: string; manufacturerText: string; netWeight: string;
}

function LabelContentFields({
  brandName, tagline, onSave, savedFields, barcodePlacement,
}: {
  brandName:         string;
  tagline:           string;
  onSave:            (fields: Record<string, string>) => void;
  savedFields?:      Record<string, string>;
  barcodePlacement?: string;
}) {
  const [expanded, setExpanded] = React.useState(false);
  const [saved,    setSaved]    = React.useState(!!savedFields);
  const [fields, setFields] = React.useState<LabelFields>({
    productName:      savedFields?.productName      ?? brandName.trim(),
    tagline:          savedFields?.tagline          ?? tagline.trim(),
    ingredients:      savedFields?.ingredients      ?? '',
    warnings:         savedFields?.warnings         ?? '',
    directions:       savedFields?.directions       ?? '',
    qrText:           savedFields?.qrText           ?? '',
    supportUrl:       savedFields?.supportUrl       ?? '',
    manufacturerText: savedFields?.manufacturerText ?? '',
    netWeight:        savedFields?.netWeight        ?? '',
  });

  useEffect(() => {
    setFields(prev => ({
      ...prev,
      productName: prev.productName || brandName.trim(),
      tagline:     prev.tagline     || tagline.trim(),
    }));
  }, [brandName, tagline]);

  function setF(k: keyof LabelFields, v: string) { setFields(prev => ({ ...prev, [k]: v })); }

  function handleSave() {
    onSave(fields as unknown as Record<string, string>);
    setSaved(true); setTimeout(() => setSaved(false), 2500);
  }

  const placeLabel = BRC_PLACES.find(p => p.id === barcodePlacement)?.label;

  return (
    <AppCard style={lw.card}>
      <View style={lw.header}>
        <View style={[lw.headerIcon, { backgroundColor: DS.accent + '15' }]}>
          <Text style={{ fontSize: 18, color: DS.accent }}>📋</Text>
        </View>
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={lw.headerTitle}>Label Content</Text>
          <Text style={lw.headerSub}>Compliance fields for ingredients, warnings, and directions</Text>
        </View>
        {savedFields && <StatusBadge label="Saved" variant="success" />}
      </View>

      <TouchableOpacity style={lw.expandBtn} onPress={() => setExpanded(v => !v)} activeOpacity={0.75}>
        <Text style={lw.expandBtnTxt}>{expanded ? '▲ Hide label fields' : '▼ Edit label fields'}</Text>
      </TouchableOpacity>

      {expanded && (
        <View style={lw.fields}>
          <InputField label="Product Name"       value={fields.productName}      onChangeText={v => setF('productName', v)}      placeholder="e.g. Omega 3 Fish Oil" />
          <InputField label="Tagline / Slogan"   value={fields.tagline}          onChangeText={v => setF('tagline', v)}          placeholder="e.g. Pure, potent, daily wellness" />
          <InputField label="Net Weight / Qty"   value={fields.netWeight}        onChangeText={v => setF('netWeight', v)}        placeholder="e.g. 60 capsules / 250ml" />
          <InputField label="Ingredients"        value={fields.ingredients}      onChangeText={v => setF('ingredients', v)}      placeholder="e.g. Fish oil, gelatin, glycerin" multiline />
          <InputField label="Warnings"           value={fields.warnings}         onChangeText={v => setF('warnings', v)}         placeholder="e.g. Keep out of reach of children." multiline />
          <InputField label="Directions / Usage" value={fields.directions}       onChangeText={v => setF('directions', v)}       placeholder="e.g. Take 1 capsule daily with food" multiline />
          <InputField label="Manufacturer Info"  value={fields.manufacturerText} onChangeText={v => setF('manufacturerText', v)} placeholder="e.g. Manufactured in China for YourBrand Inc." />
          <InputField label="Support URL"        value={fields.supportUrl}       onChangeText={v => setF('supportUrl', v)}       placeholder="e.g. yourbrand.com/support" />
          {!!placeLabel && (
            <View style={bw.subSec}>
              <Text style={bw.subSecLbl}>Barcode Placement (set in Barcode Setup)</Text>
              <View style={[bw.chip, bw.chipActive, { alignSelf: 'flex-start' }]}>
                <Text style={[bw.chipTxt, bw.chipTxtActive]}>{placeLabel}</Text>
              </View>
            </View>
          )}
        </View>
      )}

      <TouchableOpacity style={[lw.saveBtn, saved && { backgroundColor: DS.success }]} onPress={handleSave} activeOpacity={0.85}>
        <Text style={lw.saveBtnTxt}>{saved ? '✓ Label Content Saved' : '▣ Save Label Content'}</Text>
      </TouchableOpacity>
    </AppCard>
  );
}

const lw = StyleSheet.create({
  card:       { gap: 16 },
  header:     { flexDirection: 'row', alignItems: 'center', gap: 12 },
  headerIcon: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  headerTitle:{ fontSize: 14, fontWeight: '800', color: DS.textPrimary },
  headerSub:  { fontSize: 11, color: DS.textMuted },
  expandBtn:  { alignItems: 'center', paddingVertical: 10, borderWidth: 1, borderColor: DS.border, borderRadius: DS.radiusButton, backgroundColor: DS.bgSubtle },
  expandBtnTxt:{ fontSize: 12, fontWeight: '700', color: DS.accent },
  fields:     { gap: 12 },
  saveBtn:    { backgroundColor: DS.accent, borderRadius: DS.radiusButton, paddingVertical: 13, alignItems: 'center' },
  saveBtnTxt: { fontSize: 13, fontWeight: '800', color: DS.bgCard },
});

// ── Packaging Mockup ──────────────────────────────────────────────────────────

type MockupType = 'bottle' | 'pouch' | 'box';

function BottleMockup({ brandName, color, tagline }: { brandName: string; color: string; tagline: string }) {
  const name = brandName.trim() || 'Brand';
  return (
    <View style={{ alignItems: 'center', gap: 0 }}>
      <View style={pmc.bottleNeck} />
      <View style={[pmc.bottleBody, { borderColor: color + '50' }]}>
        <View style={[pmc.bottleLabel, { borderColor: color + '60' }]}>
          <View style={[pmc.bottleBand, { backgroundColor: color }]}>
            <Text style={pmc.bottleBandTxt}>{name.toUpperCase()}</Text>
          </View>
          <View style={pmc.bottleLabelBody}>
            <Text style={pmc.bottleProd} numberOfLines={1}>Product Name</Text>
            <Text style={pmc.bottleTag} numberOfLines={1}>{tagline || 'Premium Formula'}</Text>
            <View style={{ flexDirection: 'row', gap: 1, marginTop: 5, height: 16 }}>
              {[2,1,3,1,2,1,2,3,1,2,1,3].map((w, i) => <View key={i} style={{ width: w, height: '100%', backgroundColor: DS.textPrimary + 'aa' }} />)}
            </View>
          </View>
        </View>
      </View>
      <View style={pmc.bottleBase} />
    </View>
  );
}

function PouchMockup({ brandName, color, tagline }: { brandName: string; color: string; tagline: string }) {
  const name = brandName.trim() || 'Brand';
  return (
    <View style={[pmc.pouchBody, { borderColor: color + '50' }]}>
      <View style={[pmc.pouchSeal, { backgroundColor: color + '20', borderBottomColor: color + '30' }]}>
        <View style={pmc.pouchHole} />
        <Text style={[pmc.pouchBrand, { color }]}>{name}</Text>
      </View>
      <View style={pmc.pouchMid}>
        <Text style={{ fontSize: 28, color: color + 'bb' }}>◻</Text>
        <Text style={pmc.pouchProd}>Product</Text>
        <Text style={pmc.pouchTag} numberOfLines={1}>{tagline || 'Premium Quality'}</Text>
      </View>
      <View style={[pmc.pouchFoot, { borderTopColor: color + '30', backgroundColor: color + '10' }]}>
        <Text style={pmc.pouchNet}>Net Wt: 250g</Text>
        <View style={{ flexDirection: 'row', gap: 1, height: 16, alignItems: 'flex-end' }}>
          {[2,1,2,3,1,2,1,3].map((w, i) => <View key={i} style={{ width: w, height: '100%', backgroundColor: DS.textSecondary }} />)}
        </View>
      </View>
    </View>
  );
}

function BoxMockup({ brandName, color, tagline }: { brandName: string; color: string; tagline: string }) {
  const name = brandName.trim() || 'Your Brand';
  return (
    <View style={{ flexDirection: 'row' }}>
      <View style={[pmc.boxFront, { borderColor: color + '50' }]}>
        <View style={[pmc.boxTop, { backgroundColor: color }]}>
          <Text style={pmc.boxBrand}>{name.toUpperCase()}</Text>
        </View>
        <View style={pmc.boxBody}>
          <View style={[pmc.boxIconWrap, { backgroundColor: color + '15', borderColor: color + '30' }]}>
            <Text style={{ fontSize: 26, color }}>▣</Text>
          </View>
          <Text style={pmc.boxProd}>Product Name</Text>
          <Text style={pmc.boxTag} numberOfLines={1}>{tagline || 'Premium · Quality'}</Text>
        </View>
        <View style={pmc.boxFoot}>
          <View style={{ flexDirection: 'row', gap: 1, alignItems: 'flex-end', height: 22 }}>
            {[2,1,3,1,2,3,1,2,1,3,2,1].map((w, i) => <View key={i} style={{ width: w, height: '100%', backgroundColor: DS.textPrimary }} />)}
          </View>
          <Text style={pmc.boxBarcodeNum}>012345 678901</Text>
        </View>
      </View>
      <View style={[pmc.boxSide, { backgroundColor: color + '25', borderColor: color + '40' }]}>
        <Text style={[pmc.boxSideTxt, { color }]} numberOfLines={3}>{name}</Text>
      </View>
    </View>
  );
}

const pmc = StyleSheet.create({
  bottleNeck: { width: 28, height: 16, borderRadius: 4, backgroundColor: DS.bgElevated, borderWidth: 1, borderColor: DS.border },
  bottleBody: { width: 96, minHeight: 154, borderRadius: 16, backgroundColor: DS.bgCard, borderWidth: 2, alignItems: 'center', overflow: 'hidden', shadowColor: DS.textPrimary, shadowOpacity: 0.1, shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, elevation: 4 },
  bottleLabel:{ width: '85%', marginTop: 10, borderRadius: 8, overflow: 'hidden', borderWidth: 1 },
  bottleBand: { paddingVertical: 4, alignItems: 'center' },
  bottleBandTxt: { fontSize: 7, fontWeight: '900', color: DS.bgCard, letterSpacing: 1.5 },
  bottleLabelBody: { padding: 6, gap: 2 },
  bottleProd: { fontSize: 9, fontWeight: '800', color: DS.textPrimary },
  bottleTag:  { fontSize: 7, color: DS.textMuted },
  bottleBase: { width: 76, height: 8, borderRadius: 4, backgroundColor: DS.bgElevated, borderWidth: 1, borderColor: DS.border },
  pouchBody:  { width: 110, borderRadius: 12, backgroundColor: DS.bgCard, borderWidth: 2, overflow: 'hidden', shadowColor: DS.textPrimary, shadowOpacity: 0.1, shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, elevation: 4 },
  pouchSeal:  { paddingVertical: 8, paddingHorizontal: 10, alignItems: 'center', borderBottomWidth: 1, gap: 4 },
  pouchHole:  { width: 10, height: 10, borderRadius: 5, backgroundColor: DS.bgElevated, borderWidth: 1, borderColor: DS.border },
  pouchBrand: { fontSize: 9, fontWeight: '900', letterSpacing: 1 },
  pouchMid:   { alignItems: 'center', paddingVertical: 14, paddingHorizontal: 10, gap: 5 },
  pouchProd:  { fontSize: 11, fontWeight: '800', color: DS.textPrimary },
  pouchTag:   { fontSize: 9, color: DS.textMuted, textAlign: 'center' },
  pouchFoot:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 10, paddingVertical: 6, borderTopWidth: 1 },
  pouchNet:   { fontSize: 7, color: DS.textMuted },
  boxFront:   { width: 110, borderRadius: 8, overflow: 'hidden', backgroundColor: DS.bgCard, borderWidth: 2, shadowColor: DS.textPrimary, shadowOpacity: 0.1, shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, elevation: 4 },
  boxTop:     { paddingVertical: 6, paddingHorizontal: 10, alignItems: 'center' },
  boxBrand:   { fontSize: 7, fontWeight: '900', color: DS.bgCard, letterSpacing: 1.5 },
  boxBody:    { alignItems: 'center', paddingVertical: 10, gap: 7 },
  boxIconWrap:{ width: 42, height: 42, borderRadius: 10, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  boxProd:    { fontSize: 10, fontWeight: '800', color: DS.textPrimary },
  boxTag:     { fontSize: 8, color: DS.textMuted },
  boxFoot:    { alignItems: 'center', paddingVertical: 8, paddingHorizontal: 10, gap: 3, borderTopWidth: 1, borderTopColor: DS.border },
  boxBarcodeNum: { fontSize: 7, color: DS.textMuted, letterSpacing: 0.5 },
  boxSide:    { width: 22, borderTopRightRadius: 8, borderBottomRightRadius: 8, borderWidth: 2, borderLeftWidth: 0, justifyContent: 'center', alignItems: 'center', paddingVertical: 8 },
  boxSideTxt: { fontSize: 6, fontWeight: '700', textAlign: 'center', transform: [{ rotate: '90deg' }], width: 80 },
});

function PackagingMockupCard({ brandName, colorPalette, tagline }: { brandName: string; colorPalette: ColorPalette; tagline: string }) {
  const [selected, setSelected] = React.useState<MockupType>('box');
  const color = COLOR_OPTIONS.find(c => c.id === colorPalette)?.swatch ?? DS.accent;

  return (
    <AppCard style={{ gap: 14 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: color + '15', alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ fontSize: 18, color }}>◈</Text>
        </View>
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={{ fontSize: 14, fontWeight: '800', color: DS.textPrimary }}>Packaging Mockup</Text>
          <Text style={{ fontSize: 11, color: DS.textMuted }}>Visualize your product before production</Text>
        </View>
      </View>

      <View style={{ flexDirection: 'row', gap: 8 }}>
        {(['bottle', 'pouch', 'box'] as MockupType[]).map(t => {
          const active = selected === t;
          const icons: Record<MockupType, string> = { bottle: '⬡', pouch: '◻', box: '▣' };
          return (
            <TouchableOpacity key={t} style={[bw.packBtn, active && { borderColor: color, backgroundColor: color + '10' }]} onPress={() => setSelected(t)} activeOpacity={0.75}>
              <Text style={{ fontSize: 14, color: active ? color : DS.textMuted }}>{icons[t]}</Text>
              <Text style={[bw.chipTxt, active && { color, fontWeight: '700' }]}>{t.charAt(0).toUpperCase() + t.slice(1)}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <View style={{ backgroundColor: DS.bgSubtle, borderRadius: 16, paddingVertical: 28, alignItems: 'center', justifyContent: 'center', minHeight: 210 }}>
        {selected === 'bottle' && <BottleMockup brandName={brandName} color={color} tagline={tagline} />}
        {selected === 'pouch'  && <PouchMockup  brandName={brandName} color={color} tagline={tagline} />}
        {selected === 'box'    && <BoxMockup    brandName={brandName} color={color} tagline={tagline} />}
      </View>

      <View style={{ flexDirection: 'row', gap: 8, backgroundColor: DS.info + '12', borderRadius: DS.radiusChip, padding: 10, borderLeftWidth: 3, borderLeftColor: DS.info }}>
        <Text style={{ fontSize: 13, color: DS.info, fontWeight: '800', marginTop: 1 }}>ℹ</Text>
        <Text style={{ flex: 1, fontSize: 11, color: DS.textSecondary, lineHeight: 16 }}>
          Concept preview only — not to scale. Use this to brief a designer or explore your packaging direction.
        </Text>
      </View>
    </AppCard>
  );
}

// ── Barcode / Amazon identifier card ─────────────────────────────────────────

const BARCODE_ITEMS = [
  {
    code: 'UPC',
    full: 'Universal Product Code',
    desc: 'Required for most US retail. Buy from GS1 US or an authorized reseller. One UPC per product variant.',
    action: 'Get UPC via GS1.org',
    color: DS.accent,
  },
  {
    code: 'EAN',
    full: 'European Article Number',
    desc: 'Required for EU/UK marketplaces. Also obtained via GS1. Some sellers use the same GS1 prefix for both.',
    action: 'Get EAN via GS1 local org',
    color: DS.accent,
  },
  {
    code: 'FNSKU',
    full: 'Fulfillment Network SKU',
    desc: 'Amazon-assigned when you create an FBA listing. Print this on units going to Amazon warehouses.',
    action: 'Generated in Seller Central',
    color: DS.success,
  },
  {
    code: 'ASIN',
    full: 'Amazon Standard Identification Number',
    desc: 'Amazon assigns this automatically when your listing goes live. One ASIN per listing.',
    action: 'Auto-assigned on listing creation',
    color: DS.warning,
  },
];

function BarcodeIdentifierCard() {
  return (
    <AppCard style={{ gap: 14 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <Text style={{ fontSize: 16 }}>🔲</Text>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 13, fontWeight: '800', color: DS.textPrimary }}>Barcode & Amazon Identifiers</Text>
          <Text style={{ fontSize: 11, color: DS.textMuted }}>What you need and how to get them</Text>
        </View>
      </View>
      {BARCODE_ITEMS.map((item, i) => (
        <View key={i} style={{ flexDirection: 'row', gap: 12, paddingTop: i > 0 ? 10 : 0, borderTopWidth: i > 0 ? 1 : 0, borderTopColor: DS.border }}>
          <View style={{ width: 46, height: 46, borderRadius: 12, backgroundColor: item.color + '18', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <Text style={{ fontSize: 11, fontWeight: '900', color: item.color }}>{item.code}</Text>
          </View>
          <View style={{ flex: 1, gap: 3 }}>
            <Text style={{ fontSize: 12, fontWeight: '800', color: DS.textPrimary }}>{item.code} — {item.full}</Text>
            <Text style={{ fontSize: 12, color: DS.textSecondary, lineHeight: 17 }}>{item.desc}</Text>
            <View style={{ backgroundColor: item.color + '12', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4, alignSelf: 'flex-start', marginTop: 2 }}>
              <Text style={{ fontSize: 10, fontWeight: '700', color: item.color }}>→ {item.action}</Text>
            </View>
          </View>
        </View>
      ))}
    </AppCard>
  );
}

// ── Listing preparation card ──────────────────────────────────────────────────

function ListingPreparationCard({
  result, niche, reconInsights,
}: {
  result:         BrandResult;
  niche?:         string | null;
  reconInsights?: import('../context/PipelineContext').PipelineReconInsights | null;
}) {
  return (
    <AppCard style={{ gap: 14 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <Text style={{ fontSize: 16 }}>📝</Text>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 13, fontWeight: '800', color: DS.textPrimary }}>Listing Preparation</Text>
          <Text style={{ fontSize: 11, color: DS.textMuted }}>
            {niche ? `Generated for "${niche}"` : 'AI-generated listing ideas'}
          </Text>
        </View>
      </View>

      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: DS.warning + '14', borderRadius: DS.radiusChip, paddingHorizontal: 10, paddingVertical: 6, borderWidth: 1, borderColor: DS.warning + '30' }}>
        <Text style={{ fontSize: 10, fontWeight: '800', color: DS.warning }}>AI CONCEPT DRAFT</Text>
        <Text style={{ fontSize: 10, color: DS.textMuted, flex: 1 }}>Review before publishing — verify compliance and keyword accuracy.</Text>
      </View>

      {result.listing?.title && (
        <View style={{ gap: 6 }}>
          <Text style={{ fontSize: 11, fontWeight: '700', color: DS.textMuted, textTransform: 'uppercase', letterSpacing: 0.8 }}>Title Idea</Text>
          <View style={{ backgroundColor: DS.bgSubtle, borderRadius: 10, padding: 12, borderLeftWidth: 3, borderLeftColor: DS.accent }}>
            <Text style={{ fontSize: 13, color: DS.textPrimary, lineHeight: 19, fontWeight: '600' }}>{result.listing.title}</Text>
          </View>
        </View>
      )}

      {result.listing?.bullet_points && result.listing.bullet_points.length > 0 && (
        <View style={{ gap: 6 }}>
          <Text style={{ fontSize: 11, fontWeight: '700', color: DS.textMuted, textTransform: 'uppercase', letterSpacing: 0.8 }}>Bullet Points</Text>
          <View style={{ gap: 6 }}>
            {result.listing.bullet_points.map((b, i) => (
              <View key={i} style={{ flexDirection: 'row', gap: 8, alignItems: 'flex-start' }}>
                <View style={{ width: 18, height: 18, borderRadius: 9, backgroundColor: DS.success + '18', alignItems: 'center', justifyContent: 'center', marginTop: 1 }}>
                  <Text style={{ fontSize: 9, fontWeight: '900', color: DS.success }}>{i + 1}</Text>
                </View>
                <Text style={{ fontSize: 13, color: DS.textSecondary, lineHeight: 19, flex: 1 }}>{b}</Text>
              </View>
            ))}
          </View>
        </View>
      )}

      {result.generated_keywords && result.generated_keywords.length > 0 && (
        <View style={{ gap: 6 }}>
          <Text style={{ fontSize: 11, fontWeight: '700', color: DS.textMuted, textTransform: 'uppercase', letterSpacing: 0.8 }}>Backend Keywords</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
            {result.generated_keywords.slice(0, 12).map((kw, i) => (
              <View key={i} style={{ backgroundColor: DS.accentLight, borderRadius: DS.radiusBadge, paddingHorizontal: 10, paddingVertical: 4 }}>
                <Text style={{ fontSize: 11, fontWeight: '600', color: DS.accent }}>{kw}</Text>
              </View>
            ))}
          </View>
        </View>
      )}

      {reconInsights && reconInsights.complaints.length > 0 && (
        <View style={{ gap: 8, paddingTop: 10, borderTopWidth: 1, borderTopColor: DS.border }}>
          <Text style={{ fontSize: 11, fontWeight: '700', color: DS.danger, textTransform: 'uppercase', letterSpacing: 0.8 }}>Customer Pain Points (from Recon)</Text>
          <Text style={{ fontSize: 11, color: DS.textMuted, lineHeight: 16 }}>Address these in your bullets — they are why buyers leave bad reviews.</Text>
          {reconInsights.complaints.slice(0, 3).map((c, i) => (
            <View key={i} style={{ flexDirection: 'row', gap: 8, alignItems: 'flex-start' }}>
              <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: DS.danger, marginTop: 7, flexShrink: 0 }} />
              <Text style={{ fontSize: 12, color: DS.textSecondary, lineHeight: 18, flex: 1 }}>{c}</Text>
            </View>
          ))}
        </View>
      )}

      {reconInsights && reconInsights.positioningAngles.length > 0 && (
        <View style={{ gap: 8, paddingTop: 10, borderTopWidth: 1, borderTopColor: DS.border }}>
          <Text style={{ fontSize: 11, fontWeight: '700', color: DS.accent, textTransform: 'uppercase', letterSpacing: 0.8 }}>Positioning Angles (from Recon)</Text>
          {reconInsights.positioningAngles.slice(0, 2).map((a, i) => (
            <View key={i} style={{ flexDirection: 'row', gap: 8, alignItems: 'flex-start' }}>
              <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: DS.accent, marginTop: 7, flexShrink: 0 }} />
              <Text style={{ fontSize: 12, color: DS.textSecondary, lineHeight: 18, flex: 1 }}>{a}</Text>
            </View>
          ))}
        </View>
      )}
    </AppCard>
  );
}

// ── Brand Step Section ────────────────────────────────────────────────────────

function BrandStepSection({
  step, title, subtitle, doneLabel, current, done, locked, onExpand, children,
}: {
  step: number; title: string; subtitle: string; doneLabel: string;
  current: boolean; done: boolean; locked: boolean;
  onExpand: () => void; children?: React.ReactNode;
}) {
  return (
    <View style={[
      bss.card,
      current && bss.cardActive,
      locked && bss.cardLocked,
    ]}>
      <TouchableOpacity
        style={bss.header}
        onPress={locked ? undefined : onExpand}
        activeOpacity={locked ? 1 : 0.75}
        disabled={locked}
      >
        <View style={[bss.num, current && bss.numActive, done && !current && bss.numDone, locked && bss.numLocked]}>
          <Text style={[bss.numTxt, (current || done) && bss.numTxtActive]}>
            {done && !current ? '✓' : step.toString()}
          </Text>
        </View>
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={[bss.title, locked && bss.titleLocked]}>
            {step}. {title}
          </Text>
          <Text style={bss.sub} numberOfLines={1}>
            {done && !current ? doneLabel : subtitle}
          </Text>
        </View>
        {locked && <Text style={bss.lockIcon}>🔒</Text>}
      </TouchableOpacity>

      {current && children && (
        <View style={bss.content}>
          {children}
        </View>
      )}
    </View>
  );
}

const bss = StyleSheet.create({
  card:         { backgroundColor: DS.bgCard, borderRadius: DS.radiusCard, borderWidth: 1.5, borderColor: DS.border, overflow: 'hidden' as const },
  cardActive:   { borderColor: DS.accent, shadowColor: DS.accent, shadowOpacity: 0.12, shadowRadius: 12, shadowOffset: { width: 0, height: 3 }, elevation: 4 },
  cardLocked:   { backgroundColor: DS.bgSubtle, borderColor: DS.border },
  header:       { flexDirection: 'row', alignItems: 'center', gap: 12, padding: DS.cardPadding },
  num:          { width: 34, height: 34, borderRadius: 17, backgroundColor: DS.bgElevated, borderWidth: 1.5, borderColor: DS.border, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  numActive:    { backgroundColor: DS.accent, borderColor: DS.accent },
  numDone:      { backgroundColor: DS.accent, borderColor: DS.accent },
  numLocked:    { backgroundColor: DS.bgSubtle, borderColor: DS.border },
  numTxt:       { fontSize: 13, fontWeight: '800', color: DS.textMuted },
  numTxtActive: { color: DS.bgCard },
  title:        { fontSize: 15, fontWeight: '800', color: DS.textPrimary, letterSpacing: -0.3 },
  titleLocked:  { color: DS.textMuted },
  sub:          { fontSize: 12, color: DS.textMuted, lineHeight: 17 },
  lockIcon:     { fontSize: 14 },
  content:      { paddingHorizontal: DS.cardPadding, paddingBottom: DS.cardPadding, gap: DS.sectionGap },
});

function StepContinueBtn({ label, onPress, variant = 'primary' }: { label: string; onPress: () => void; variant?: 'primary' | 'success' }) {
  const bg = variant === 'success' ? DS.success : DS.accent;
  return (
    <TouchableOpacity
      style={{ backgroundColor: bg, borderRadius: DS.radiusButton, paddingVertical: 14, alignItems: 'center', shadowColor: bg, shadowOpacity: 0.22, shadowRadius: 8, shadowOffset: { width: 0, height: 3 }, elevation: 4 }}
      onPress={onPress}
      activeOpacity={0.85}
    >
      <Text style={{ fontSize: 14, fontWeight: '900', color: DS.bgCard, letterSpacing: -0.2 }}>{label}</Text>
    </TouchableOpacity>
  );
}

// ── Pipeline actions ──────────────────────────────────────────────────────────

import type { PipelineContextValue } from '../context/PipelineContext';

function BrandPipelineActions({
  brandName, productTitle, tagline, keywords, style, pipeline,
  personality, colorPalette, fontStyle, brandDirection, listingTitle, listingBullets, backendKeywords,
  barcodeMode, barcodeIdentifier, barcodePlacement, barcodePackagingType, barcodeGs1Required, barcodeFnskuRequired,
  labelTemplate, labelFields, labelBarcodePlacement,
}: {
  brandName: string; productTitle: string; tagline: string;
  keywords: string[]; style: string;
  pipeline: PipelineContextValue;
  personality?:          string;
  colorPalette?:         string;
  fontStyle?:            string;
  brandDirection?:       string;
  listingTitle?:         string;
  listingBullets?:       string[];
  backendKeywords?:      string[];
  barcodeMode?:          string;
  barcodeIdentifier?:    string;
  barcodePlacement?:     string;
  barcodePackagingType?: string;
  barcodeGs1Required?:   boolean;
  barcodeFnskuRequired?: boolean;
  labelTemplate?:        string;
  labelFields?:          Record<string, string>;
  labelBarcodePlacement?:string;
}) {
  const navigation = useNavigation<any>();
  const [saved, setSaved] = React.useState(false);

  function handleSave() {
    pipeline.setBrandData({
      brandName, productTitle, tagline, keywords, style,
      savedAt: new Date().toISOString(),
      personality, colorPalette, fontStyle, brandDirection, listingTitle, listingBullets, backendKeywords,
      barcodeMode, barcodeIdentifier, barcodePlacement, barcodePackagingType,
      barcodeGs1Required, barcodeFnskuRequired,
      labelTemplate, labelFields, labelBarcodePlacement,
    });
    pipeline.trackPipelineEvent('brand_saved', { brandName, style });
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  }

  return (
    <View style={bp.wrap}>
      <TouchableOpacity
        style={[bp.btn, bp.btnSave, !!pipeline.brandData && bp.btnSaved]}
        onPress={handleSave}
        activeOpacity={0.85}
      >
        <Text style={[bp.btnTxt, !!pipeline.brandData && bp.btnSavedTxt]}>
          {saved ? '✓ Brand Saved' : pipeline.brandData ? '✓ Update Brand in Pipeline' : '▣ Save Brand Data to Pipeline'}
        </Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={[bp.btn, bp.btnLaunch]}
        onPress={() => {
          pipeline.trackPipelineEvent('launch_decision_viewed', { from: 'label' });
          navigation.navigate('LaunchDecision');
        }}
        activeOpacity={0.85}
      >
        <Text style={bp.btnLaunchTxt}>Open Launch Decision →</Text>
      </TouchableOpacity>
    </View>
  );
}

const bp = StyleSheet.create({
  wrap:         { gap: 8 },
  btn:          { borderRadius: DS.radiusButton, paddingVertical: 13, alignItems: 'center', borderWidth: 1 },
  btnSave:      { borderColor: DS.accent + '50', backgroundColor: DS.accentLight },
  btnSaved:     { borderColor: DS.success + '50', backgroundColor: DS.success + '10' },
  btnTxt:       { fontSize: 13, fontWeight: '800', color: DS.accent },
  btnSavedTxt:  { color: DS.success },
  btnLaunch:    { backgroundColor: DS.accent, borderColor: DS.accent },
  btnLaunchTxt: { fontSize: 14, fontWeight: '900', color: DS.bgCard, letterSpacing: -0.2 },
});

// ── Shared AI draft badge (applied to all generated SVG asset previews) ───────
const aiDraftBadgeStyle = {
  alignSelf: 'flex-start' as const,
  backgroundColor: DS.warning + '18',
  borderRadius: DS.radiusBadge,
  borderWidth: 1,
  borderColor: DS.warning + '44',
  paddingHorizontal: 8,
  paddingVertical: 3,
};
const aiDraftBadgeTxtStyle = {
  fontSize: 9,
  fontWeight: '800' as const,
  color: DS.warning,
  letterSpacing: 1,
};

// ── Compact brand name bar (Quick Tools mode only) ───────────────────────────

function BrandNameBar({
  inputs, onChange,
}: {
  inputs:   BrandInputs;
  onChange: (k: keyof BrandInputs, v: string) => void;
}) {
  return (
    <AppCard style={{ gap: 10 }}>
      <InputField
        label="Brand Name"
        value={inputs.brandName}
        onChangeText={v => onChange('brandName', v)}
        placeholder="e.g. HydroGlow"
      />
      <InputField
        label="Tagline (optional)"
        value={inputs.tagline}
        onChangeText={v => onChange('tagline', v)}
        placeholder="e.g. Pure hydration, pure you"
      />
      <Text style={{ fontSize: 11, color: DS.textMuted, lineHeight: 16 }}>
        Brand style, colours, and direction — set these in the <Text style={{ fontWeight: '700', color: DS.accent }}>Make Assets</Text> flow.
      </Text>
    </AppCard>
  );
}

// ── Tool hub types ────────────────────────────────────────────────────────────

type ToolId = 'logo' | 'label' | 'insert' | 'barcode' | 'listing';

const TOOLS: {
  id: ToolId; icon: string; color: string; name: string; desc: string;
}[] = [
  { id: 'logo',    icon: '✦', color: DS.accent, name: 'Logo',     desc: 'AI-generated SVG logo'    },
  { id: 'label',   icon: '≡', color: '#0891B2', name: 'Label',    desc: 'Product packaging label'  },
  { id: 'insert',  icon: '◻', color: DS.successText, name: 'Insert',   desc: 'Thank-you card for box'   },
  { id: 'barcode', icon: '▣', color: DS.gold, name: 'Barcode',  desc: 'GS1 UPC & FNSKU setup'    },
  { id: 'listing', icon: '📝', color: '#7C3AED', name: 'Listing',  desc: 'Amazon title & bullets'   },
];

const TOOL_HELP: Record<ToolId, FeatureKey> = {
  logo:    'brand_logo',
  label:   'brand_label',
  insert:  'brand_insert',
  barcode: 'brand_studio',
  listing: 'brand_studio',
};

// ── Tool selector (2-col card grid — matches ProfitLab CalcSelector) ──────────

function ToolSelector({
  active, onSelect,
  hasBrandResult, hasLabelSvg, hasInsertSvg, hasBarcodeConfig,
}: {
  active:           ToolId;
  onSelect:         (t: ToolId) => void;
  hasBrandResult:   boolean;
  hasLabelSvg:      boolean;
  hasInsertSvg:     boolean;
  hasBarcodeConfig: boolean;
}) {
  function isDone(id: ToolId): boolean {
    if (id === 'logo')    return hasBrandResult;
    if (id === 'label')   return hasLabelSvg;
    if (id === 'insert')  return hasInsertSvg;
    if (id === 'barcode') return hasBarcodeConfig;
    if (id === 'listing') return hasBrandResult;
    return false;
  }

  const activeTool = TOOLS.find(t => t.id === active) ?? TOOLS[0];

  return (
    <View style={tsl.wrap}>
      <View style={tsl.grid}>
        {TOOLS.map(tool => {
          const isActive = tool.id === active;
          const done     = isDone(tool.id);
          return (
            <TouchableOpacity
              key={tool.id}
              style={[tsl.card, isActive && { backgroundColor: tool.color, borderColor: tool.color }]}
              onPress={() => onSelect(tool.id)}
              activeOpacity={0.75}
            >
              <View style={[tsl.iconBlock, { backgroundColor: isActive ? 'rgba(255,255,255,0.2)' : tool.color + '18' }]}>
                <Text style={[tsl.icon, { color: isActive ? DS.bgCard : tool.color }]}>{tool.icon}</Text>
              </View>
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={[tsl.name, isActive && tsl.nameActive]} numberOfLines={1}>{tool.name}</Text>
                <Text style={[tsl.desc, isActive && tsl.descActive]} numberOfLines={1}>{tool.desc}</Text>
              </View>
              {done && (
                <View style={[tsl.doneBadge, isActive && tsl.doneBadgeActive]}>
                  <Text style={[tsl.doneTxt, isActive && tsl.doneTxtActive]}>✓</Text>
                </View>
              )}
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Active tool description */}
      <View style={[tsl.descCard, { borderColor: activeTool.color + '40', backgroundColor: activeTool.color + '08' }]}>
        <View style={[tsl.descDot, { backgroundColor: activeTool.color }]} />
        <Text style={[tsl.descText, { color: activeTool.color }]}>
          {activeTool.name}: {activeTool.desc}
          {isDone(activeTool.id) ? ' — done ✓' : ' — tap to generate'}
        </Text>
      </View>
    </View>
  );
}

const tsl = StyleSheet.create({
  wrap:  { gap: 12 },
  grid:  { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },

  card: {
    flexDirection:   'row',
    alignItems:      'center',
    gap:             10,
    width:           '47.5%' as any,
    backgroundColor: DS.bgCard,
    borderRadius:    DS.radiusCard,
    borderWidth:     1.5,
    borderColor:     DS.border,
    padding:         12,
  },

  iconBlock: {
    width: 40, height: 40, borderRadius: 10,
    alignItems: 'center', justifyContent: 'center',
    flexShrink: 0,
  },
  icon: { fontSize: 20 },

  name:       { fontSize: 13, fontWeight: '800', color: DS.textPrimary, letterSpacing: -0.1 },
  nameActive: { color: DS.bgCard },
  desc:       { fontSize: 11, color: DS.textMuted, fontWeight: '500' },
  descActive: { color: 'rgba(255,255,255,0.75)' },

  doneBadge:      { borderRadius: DS.radiusBadge, paddingHorizontal: 6, paddingVertical: 2, backgroundColor: DS.success + '20' },
  doneBadgeActive:{ backgroundColor: 'rgba(255,255,255,0.25)' },
  doneTxt:        { fontSize: 9, fontWeight: '900', color: DS.success },
  doneTxtActive:  { color: DS.bgCard },

  descCard:  { flexDirection: 'row', alignItems: 'flex-start', gap: 8, borderRadius: 12, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 10 },
  descDot:   { width: 6, height: 6, borderRadius: 3, marginTop: 5, flexShrink: 0 },
  descText:  { flex: 1, fontSize: 12, lineHeight: 18, fontWeight: '500' },
});

// ── Collapsible brand setup ───────────────────────────────────────────────────

function BrandSetupCard({
  inputs, onChange, selectedDirection, onSelectDirection, onTryNextDirection,
}: {
  inputs:             BrandInputs;
  onChange:           (k: keyof BrandInputs, v: string) => void;
  selectedDirection:  string | null;
  onSelectDirection:  (dir: BrandDirection) => void;
  onTryNextDirection: () => void;
}) {
  const hasName = inputs.brandName.trim().length > 0;
  const [open, setOpen] = React.useState(!hasName);

  return (
    <AppCard style={{ gap: 0 }}>
      <TouchableOpacity style={bsu.header} onPress={() => setOpen(v => !v)} activeOpacity={0.75}>
        <View style={bsu.headerIcon}>
          <Text style={{ fontSize: 16, color: DS.accent }}>✦</Text>
        </View>
        <View style={{ flex: 1, gap: 2 }}>
          {hasName ? (
            <>
              <Text style={bsu.headerName}>{inputs.brandName}</Text>
              <Text style={bsu.headerMeta}>{inputs.style} · {inputs.colorPalette} · {inputs.fontStyle}</Text>
            </>
          ) : (
            <>
              <Text style={bsu.headerTitle}>Brand Setup</Text>
              <Text style={bsu.headerSub}>Tap to set name, style, and direction</Text>
            </>
          )}
        </View>
        <Text style={bsu.chevron}>{open ? '▲' : '▼'}</Text>
      </TouchableOpacity>

      {open && (
        <View style={bsu.body}>
          <BrandDirectionPicker selectedId={selectedDirection} onSelect={onSelectDirection} />
          {selectedDirection && (
            <TouchableOpacity
              style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 10, borderRadius: DS.radiusButton, borderWidth: 1.5, borderColor: DS.accent + '40', backgroundColor: DS.accentLight }}
              onPress={onTryNextDirection}
              activeOpacity={0.8}
            >
              <Text style={{ fontSize: 13, fontWeight: '700', color: DS.accent }}>↻ Try Another Direction</Text>
            </TouchableOpacity>
          )}
          <BrandIdentityCard inputs={inputs} onChange={onChange} />
          <CopilotTipCard
            icon="✦"
            tip="Keep your brand name short and memorable. The direction picker above sets your style, colors, and font — you can still fine-tune below."
            accent={DS.pink}
          />
          <TouchableOpacity
            style={bsu.doneBtn}
            onPress={() => setOpen(false)}
            activeOpacity={0.8}
          >
            <Text style={bsu.doneBtnTxt}>{hasName ? '✓  Done — pick a tool above' : 'Enter a brand name to get started'}</Text>
          </TouchableOpacity>
        </View>
      )}
    </AppCard>
  );
}

const bsu = StyleSheet.create({
  header:     { flexDirection: 'row', alignItems: 'center', gap: 12, padding: DS.cardPadding },
  headerIcon: { width: 36, height: 36, borderRadius: 10, backgroundColor: DS.accentLight, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  headerName: { fontSize: 15, fontWeight: '900', color: DS.textPrimary, letterSpacing: -0.3 },
  headerMeta: { fontSize: 11, color: DS.textMuted },
  headerTitle:{ fontSize: 14, fontWeight: '800', color: DS.textPrimary },
  headerSub:  { fontSize: 11, color: DS.textMuted },
  chevron:    { fontSize: 10, color: DS.textMuted, fontWeight: '700' },
  body:       { gap: DS.sectionGap, paddingHorizontal: DS.cardPadding, paddingBottom: DS.cardPadding, borderTopWidth: 1, borderTopColor: DS.border },
  doneBtn:    { backgroundColor: DS.accent, borderRadius: DS.radiusButton, paddingVertical: 11, alignItems: 'center' },
  doneBtnTxt: { fontSize: 13, fontWeight: '800', color: DS.bgCard },
});

// ── Step Progress Bar (steps mode) ───────────────────────────────────────────

const STEP_LABELS = ['Brand', 'Logo', 'Barcode', 'Label', 'Insert', 'Listing'];

function StepProgressBar({
  currentStep, completedSteps, onStepPress,
}: {
  currentStep:    number;
  completedSteps: Set<number>;
  onStepPress:    (n: number) => void;
}) {
  return (
    <View style={spb.wrap}>
      {STEP_LABELS.map((label, i) => {
        const n          = i + 1;
        const done       = completedSteps.has(n);
        const active     = currentStep === n;
        const accessible = done || currentStep >= n;
        return (
          <React.Fragment key={n}>
            {i > 0 && <View style={[spb.line, done && spb.lineDone]} />}
            <TouchableOpacity
              style={spb.step}
              onPress={() => { if (accessible) onStepPress(n); }}
              disabled={!accessible}
              activeOpacity={0.7}
            >
              <View style={[spb.dot, active && spb.dotActive, done && spb.dotDone]}>
                <Text style={[spb.dotTxt, (active || done) && spb.dotTxtActive]}>
                  {done ? '✓' : n}
                </Text>
              </View>
              <Text style={[spb.lbl, active && spb.lblActive, done && spb.lblDone]} numberOfLines={1}>
                {label}
              </Text>
            </TouchableOpacity>
          </React.Fragment>
        );
      })}
    </View>
  );
}

const spb = StyleSheet.create({
  wrap:        { flexDirection: 'row', alignItems: 'flex-start', paddingHorizontal: DS.pagePadding, paddingVertical: 10, backgroundColor: DS.bgCard, borderBottomWidth: 1, borderBottomColor: DS.border },
  line:        { flex: 1, height: 1.5, backgroundColor: DS.border, marginTop: 11, marginHorizontal: 2 },
  lineDone:    { backgroundColor: DS.accent },
  step:        { alignItems: 'center', gap: 3, minWidth: 36 },
  dot:         { width: 22, height: 22, borderRadius: 11, backgroundColor: DS.bgElevated, borderWidth: 1.5, borderColor: DS.border, alignItems: 'center', justifyContent: 'center' },
  dotActive:   { backgroundColor: DS.accent, borderColor: DS.accent },
  dotDone:     { backgroundColor: DS.accent, borderColor: DS.accent },
  dotTxt:      { fontSize: 9, fontWeight: '900', color: DS.textMuted },
  dotTxtActive:{ color: DS.bgCard },
  lbl:         { fontSize: 8, fontWeight: '500', color: DS.textMuted, textAlign: 'center' },
  lblActive:   { color: DS.accent, fontWeight: '800' },
  lblDone:     { color: DS.textSecondary, fontWeight: '700' },
});

// ── Brand Report (final step in steps mode) ───────────────────────────────────

function BrandReportCard({
  brandName, tagline, colorPalette,
  brandResult, labelResult,
  barcodeMode, barcodeIdent, barcodePlace,
  exportLoading, onExportLogo, onExportLabel, onExportInsert,
  onLaunch,
}: {
  brandName:     string;
  tagline:       string;
  colorPalette:  ColorPalette;
  brandResult:   BrandResult | null;
  labelResult:   LabelResult | null;
  barcodeMode?:  string;
  barcodeIdent?: string;
  barcodePlace?: string;
  exportLoading: boolean;
  onExportLogo:  () => void;
  onExportLabel: () => void;
  onExportInsert:() => void;
  onLaunch:      () => void;
}) {
  const accent       = COLOR_OPTIONS.find(c => c.id === colorPalette)?.swatch ?? DS.accent;
  const hasSvgLogo   = !!brandResult?.logo_svg   && isValidSvg(brandResult.logo_svg);
  const hasSvgLabel  = !!labelResult?.label_svg  && isValidSvg(labelResult.label_svg);
  const hasSvgInsert = !!labelResult?.insert_svg && isValidSvg(labelResult.insert_svg);
  const assetsReady  = hasSvgLogo || hasSvgLabel || hasSvgInsert;

  return (
    <AppCard style={{ gap: 20, borderWidth: 2, borderColor: DS.success + '50' }}>
      {/* Header */}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <View style={{ width: 44, height: 44, borderRadius: 14, backgroundColor: DS.success + '18', alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ fontSize: 22, color: DS.success }}>◆</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 17, fontWeight: '900', color: DS.textPrimary, letterSpacing: -0.4 }}>Brand Report</Text>
          <Text style={{ fontSize: 12, color: DS.textMuted }}>Your complete brand kit</Text>
        </View>
        <StatusBadge label={assetsReady ? 'Ready' : 'In Progress'} variant={assetsReady ? 'success' : 'info'} />
      </View>

      {/* Brand summary */}
      <View style={{ padding: 14, backgroundColor: DS.bgSubtle, borderRadius: DS.radiusCard, borderWidth: 1, borderColor: DS.border, gap: 6 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <Text style={{ fontSize: 20, fontWeight: '900', color: DS.textPrimary, letterSpacing: -0.4, flex: 1 }}>{brandName || '—'}</Text>
          <View style={{ backgroundColor: accent + '18', borderRadius: DS.radiusBadge, paddingHorizontal: 10, paddingVertical: 4, marginLeft: 8 }}>
            <Text style={{ fontSize: 10, fontWeight: '800', color: accent }}>{colorPalette.toUpperCase()}</Text>
          </View>
        </View>
        {tagline ? <Text style={{ fontSize: 12, color: DS.textMuted, fontStyle: 'italic' }}>"{tagline}"</Text> : null}
      </View>

      {/* Asset preview row */}
      <View style={{ gap: 10 }}>
        <Text style={{ fontSize: 11, fontWeight: '700', color: DS.textMuted, textTransform: 'uppercase', letterSpacing: 0.8 }}>Generated Assets</Text>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          {[
            { label: 'Logo',   hasSvg: hasSvgLogo,   xml: brandResult?.logo_svg,   icon: '✦', onExport: onExportLogo   },
            { label: 'Label',  hasSvg: hasSvgLabel,  xml: labelResult?.label_svg,  icon: '≡', onExport: onExportLabel  },
            { label: 'Insert', hasSvg: hasSvgInsert, xml: labelResult?.insert_svg, icon: '◻', onExport: onExportInsert },
          ].map(asset => (
            <View
              key={asset.label}
              style={{ flex: 1, borderRadius: DS.radiusCard, overflow: 'hidden', borderWidth: 1.5, borderColor: asset.hasSvg ? accent + '50' : DS.border, backgroundColor: DS.bgSubtle, minHeight: 100 }}
            >
              <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 8 }}>
                {asset.hasSvg && asset.xml ? (
                  <SvgXml xml={asset.xml} width="100%" height={64} />
                ) : (
                  <Text style={{ fontSize: 24, color: DS.textMuted }}>{asset.icon}</Text>
                )}
              </View>
              <TouchableOpacity
                style={{ paddingVertical: 7, alignItems: 'center', borderTopWidth: 1, borderTopColor: DS.border, backgroundColor: asset.hasSvg ? accent + '10' : DS.bgSubtle }}
                onPress={asset.onExport}
                disabled={!asset.hasSvg || exportLoading}
                activeOpacity={0.75}
              >
                <Text style={{ fontSize: 10, fontWeight: '800', color: asset.hasSvg ? accent : DS.textMuted }}>
                  {asset.hasSvg ? `↓ ${asset.label}` : asset.label}
                </Text>
              </TouchableOpacity>
            </View>
          ))}
        </View>
        {!assetsReady && (
          <Text style={{ fontSize: 11, color: DS.textMuted, textAlign: 'center' }}>Generate assets in the steps above — they'll appear here.</Text>
        )}
      </View>

      {/* Barcode summary */}
      {barcodeMode && (
        <View style={{ gap: 8 }}>
          <Text style={{ fontSize: 11, fontWeight: '700', color: DS.textMuted, textTransform: 'uppercase', letterSpacing: 0.8 }}>Barcode Config</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
            {[barcodeMode, barcodeIdent, barcodePlace].filter(Boolean).map((v, i) => (
              <View key={i} style={{ backgroundColor: i === 0 ? DS.accentLight : DS.bgElevated, borderRadius: DS.radiusBadge, paddingHorizontal: 10, paddingVertical: 4 }}>
                <Text style={{ fontSize: 11, fontWeight: '700', color: i === 0 ? DS.accent : DS.textSecondary }}>{v!.replace(/_/g, ' ')}</Text>
              </View>
            ))}
          </View>
        </View>
      )}

      {/* Listing summary */}
      {brandResult?.listing?.title && (
        <View style={{ gap: 8 }}>
          <Text style={{ fontSize: 11, fontWeight: '700', color: DS.textMuted, textTransform: 'uppercase', letterSpacing: 0.8 }}>AI Listing Title</Text>
          <View style={{ backgroundColor: DS.bgSubtle, borderRadius: DS.radiusInput, padding: 12, borderLeftWidth: 3, borderLeftColor: accent }}>
            <Text style={{ fontSize: 12, color: DS.textPrimary, lineHeight: 18, fontWeight: '600' }}>{brandResult.listing.title}</Text>
          </View>
        </View>
      )}

      {/* Launch CTA */}
      <TouchableOpacity
        style={{ backgroundColor: DS.success, borderRadius: DS.radiusButton, paddingVertical: 15, alignItems: 'center', shadowColor: DS.success, shadowOpacity: 0.28, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 5 }}
        onPress={onLaunch}
        activeOpacity={0.85}
      >
        <Text style={{ fontSize: 15, fontWeight: '900', color: DS.bgCard, letterSpacing: -0.3 }}>Save Brand & Open Launch Decision →</Text>
      </TouchableOpacity>
    </AppCard>
  );
}

// ── Screen ────────────────────────────────────────────────────────────────────

export default function BrandStudioScreen() {
  const { isOnline } = useNetworkStatus();
  const { can, increment, tier } = useSubscription();
  const { activeProduct } = useActiveProduct();
  const pipeline = usePipeline();

  const [studioMode, setStudioMode] = useState<'steps' | 'tools' | 'kit'>('steps');

  // Step-flow state (used in 'steps' mode)
  const [brandStep, setBrandStep] = useState<number>(() => {
    if (pipeline.brandData?.labelTemplate) return 6;
    if (pipeline.brandData?.barcodeMode)   return 4;
    return 1;
  });
  const [completedBrandSteps, setCompletedBrandSteps] = useState<Set<number>>(() => {
    const done = new Set<number>();
    if (pipeline.brandData?.barcodeMode)  { done.add(1); done.add(2); done.add(3); }
    if (pipeline.brandData?.labelTemplate){ done.add(1); done.add(2); done.add(3); done.add(4); }
    return done;
  });
  function advanceBrandStep(from: number) {
    setCompletedBrandSteps(prev => new Set([...prev, from]));
    setBrandStep(Math.min(from + 1, 6));
  }

  const [inputs, setInputs] = useState<BrandInputs>({
    brandName:      '',
    tagline:        '',
    personality:    '',
    targetAudience: '',
    brandTone:      '',
    style:          'Premium',
    colorPalette:   'blue',
    fontStyle:      'modern',
  });
  const [selectedDirection, setSelectedDirection] = useState<string | null>(pipeline.brandData?.brandDirection ?? null);
  const [selectedLogoName, setSelectedLogoName] = useState<string | undefined>(undefined);
  const [brandResult,   setBrandResult]   = useState<BrandResult | null>(null);
  const [directionChanged, setDirectionChanged] = useState(false);
  const [labelResult,   setLabelResult]   = useState<LabelResult | null>(null);
  const [brandLoading,  setBrandLoading]  = useState(false);
  const [warmingUp,     setWarmingUp]     = useState(false);
  const [labelLoading,  setLabelLoading]  = useState(false);
  const [labelWarmingUp, setLabelWarmingUp] = useState(false);
  const [insertLoading, setInsertLoading] = useState(false);
  const [brandError,    setBrandError]    = useState('');
  const [labelError,    setLabelError]    = useState('');
  const [exportLoading, setExportLoading] = useState(false);
  const [exportError,   setExportError]   = useState('');
  const [showPaywall,   setShowPaywall]   = useState(false);
  const [history,       setHistory]       = useState<BrandHistoryEntry[]>([]);

  const navigation = useNavigation<any>();

  function handleLaunchDecision() {
    pipeline.trackPipelineEvent('launch_decision_viewed', { from: 'brand_report' });
    navigation.navigate('LaunchDecision');
  }

  const [activeTool, setActiveTool] = useState<ToolId>('logo');

  // Barcode workflow state
  const [barcodeMode,     setBarcodeMode]     = useState<string | undefined>(pipeline.brandData?.barcodeMode);
  const [barcodeIdent,    setBarcodeIdent]    = useState<string | undefined>(pipeline.brandData?.barcodeIdentifier);
  const [barcodePlace,    setBarcodePlace]    = useState<string | undefined>(pipeline.brandData?.barcodePlacement);
  const [barcodePackage,  setBarcodePackage]  = useState<string | undefined>(pipeline.brandData?.barcodePackagingType);
  const [barcodeGs1,      setBarcodeGs1]      = useState<boolean | undefined>(pipeline.brandData?.barcodeGs1Required);
  const [barcodeFnsku,    setBarcodeFnsku]    = useState<boolean | undefined>(pipeline.brandData?.barcodeFnskuRequired);

  // Label workspace state
  const [labelTemplate,  setLabelTemplate]  = useState<string | undefined>(pipeline.brandData?.labelTemplate);
  const [labelFields,    setLabelFields]    = useState<Record<string,string> | undefined>(pipeline.brandData?.labelFields);
  const [labelBarcodeP,  setLabelBarcodeP]  = useState<string | undefined>(pipeline.brandData?.labelBarcodePlacement);

  // Load asset history on mount.
  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEYS.brandHistory).then(raw => {
      if (raw) { const p = safeParseJSON<BrandHistoryEntry[]>(raw); if (p) setHistory(p); }
    }).catch(() => {});
  }, []);

  useEffect(() => {
    const pipelineTitle = pipeline.activeProduct?.title;
    const fallbackName  = activeProduct?.name;
    const name          = pipelineTitle ?? fallbackName;
    const niche         = pipeline.activeNiche?.keyword;
    const supplier      = pipeline.selectedSupplier?.name;

    setInputs(prev => ({
      ...prev,
      brandName:      prev.brandName.trim()      ? prev.brandName      : (name      ?? prev.brandName),
      targetAudience: prev.targetAudience.trim()  ? prev.targetAudience : (niche ? `Buyers searching for ${niche}` : prev.targetAudience),
      personality:    prev.personality.trim()     ? prev.personality    : (supplier  ? `Quality-focused, reliable` : prev.personality),
    }));
  }, [activeProduct, pipeline.activeProduct, pipeline.activeNiche, pipeline.selectedSupplier]);

  // Show "Waking up server..." after 10s of brand loading (Railway cold start)
  useEffect(() => {
    if (!brandLoading) { setWarmingUp(false); return; }
    const t = setTimeout(() => setWarmingUp(true), 10_000);
    return () => clearTimeout(t);
  }, [brandLoading]);

  useEffect(() => {
    if (!labelLoading) { setLabelWarmingUp(false); return; }
    const t = setTimeout(() => setLabelWarmingUp(true), 8_000);
    return () => clearTimeout(t);
  }, [labelLoading]);

  function handleInputChange(key: keyof BrandInputs, value: string) {
    setInputs(prev => ({ ...prev, [key]: value }));
  }

  function handleSelectDirection(dir: BrandDirection) {
    if (brandResult) setDirectionChanged(true);
    setSelectedDirection(dir.id);
    setInputs(prev => ({
      ...prev,
      style:        dir.style,
      colorPalette: dir.colorPalette,
      fontStyle:    dir.fontStyle,
    }));
  }

  function handleTryNextDirection() {
    const idx = BRAND_DIRECTIONS.findIndex(d => d.id === selectedDirection);
    const next = BRAND_DIRECTIONS[(idx + 1) % BRAND_DIRECTIONS.length];
    handleSelectDirection(next);
  }


  const [packagingType, setPackagingType] = useState<string>('standard');
  const [activeConceptIdx, setActiveConceptIdx] = useState(0);

  const handleGenerateBrand = useCallback(async () => {
    if (!isOnline) {
      setBrandError('No internet connection. Connect and try again.');
      return;
    }
    // Explorer (brands limit = 0) → paywall immediately
    if (!can('brands')) {
      track('paywall_shown', { feature: 'brands', source: 'brand_studio' });
      setShowPaywall(true);
      return;
    }
    // Sonnet quota: Builder gets 5, Operator gets 10. After that → Haiku.
    const usePremium = can('brands_sonnet');
    setBrandLoading(true);
    setBrandError('');
    setActiveConceptIdx(0);
    const dir = BRAND_DIRECTIONS.find(d => d.id === selectedDirection);
    try {
      // Check cache first — skip expensive AI call if we generated this brand recently
      const cKey = brandCacheKey(inputs.brandName, inputs.style, inputs.colorPalette);
      const cached = await getBrandCache<BrandResult>(cKey);
      if (cached) {
        setBrandResult(cached);
        setDirectionChanged(false);
        setSelectedLogoName(undefined);
        setBrandLoading(false);
        return;
      }
      const result = await api.createBrand({
        product_type:    (pipeline.activeProduct?.title ?? pipeline.activeNiche?.keyword ?? inputs.brandName) || 'product',
        style:           inputs.style.toLowerCase(),
        brand_name:      inputs.brandName,
        brand_direction: selectedDirection ?? undefined,
        color_palette:   inputs.colorPalette,
        font_style:      inputs.fontStyle,
        packaging_mood:  dir?.mood,
        tagline:         inputs.tagline || undefined,
        target_audience: inputs.targetAudience || undefined,
        brand_tone:      inputs.brandTone || undefined,
        use_premium:     usePremium,
      });
      // Increment Sonnet counter only when Sonnet was used
      if (usePremium) await increment('brands_sonnet');
      setBrandResult(result);
      setDirectionChanged(false);
      setSelectedLogoName(undefined);
      setBrandCache(cKey, result).catch(() => {});
      if (result.logo_svg) {
        const entry: BrandHistoryEntry = { brandName: inputs.brandName, style: inputs.style, assetType: 'logo', svg: result.logo_svg, createdAt: new Date().toISOString() };
        saveToHistory(entry).then(() => AsyncStorage.getItem(STORAGE_KEYS.brandHistory).then(r => r && setHistory(JSON.parse(r))));
      }
    } catch (err: any) {
      const msg = err?.message ?? "Couldn't generate asset. Please try again.";
      setBrandError(msg);
      track('brand_generation_failed', { type: 'logo', error: msg, direction: selectedDirection ?? undefined });
    } finally { setBrandLoading(false); }
  }, [inputs, selectedDirection, can, increment]);

  const handleGenerateLabel = useCallback(async () => {
    if (!isOnline) {
      setLabelError('No internet connection. Connect and try again.');
      return;
    }
    if (!can('brands')) {
      track('paywall_shown', { feature: 'brands', source: 'label_generator' });
      setShowPaywall(true);
      return;
    }
    // Validate netWeight field when it looks like a numeric measurement
    const nw = labelFields?.['netWeight'];
    if (nw && /\d/.test(nw)) {
      const validWeightPattern = /^\d+(\.\d+)?\s*(g|kg|oz|lb|lbs|ml|l|cl)\b/i;
      const validCountPattern  = /^\d+\s*\w+/; // "60 capsules", "12 packets" etc.
      if (!validWeightPattern.test(nw.trim()) && !validCountPattern.test(nw.trim())) {
        setLabelError('Net weight format not recognized. Use formats like: 100g, 0.5kg, 12oz, 1 lb, 250ml, or "60 capsules".');
        return;
      }
    }

    setLabelLoading(true);
    setLabelError('');
    const dir = BRAND_DIRECTIONS.find(d => d.id === selectedDirection);
    try {
      const result = await api.createLabel({
        brand_name:      inputs.brandName || 'Brand',
        product_name:    labelFields?.['productName'] || inputs.brandName || 'Product',
        weight:          labelFields?.['netWeight'] || '0.5kg',
        style:           inputs.style.toLowerCase(),
        brand_direction: selectedDirection ?? undefined,
        color_palette:   inputs.colorPalette,
        font_style:      inputs.fontStyle,
        packaging_type:  packagingType,
        tagline:         inputs.tagline || undefined,
        ingredients:     labelFields?.['ingredients'] || undefined,
        warnings:        labelFields?.['warnings'] || undefined,
        directions:      labelFields?.['directions'] || undefined,
        support_url:     labelFields?.['supportUrl'] || undefined,
        qr_text:         labelFields?.['qrText'] || undefined,
        manufacturer:    labelFields?.['manufacturerText'] || undefined,
      });
      await increment('brands');
      setLabelResult(result);
      const entries: BrandHistoryEntry[] = [];
      if (result.label_svg)  entries.push({ brandName: inputs.brandName, style: inputs.style, assetType: 'label',  svg: result.label_svg,  createdAt: new Date().toISOString() });
      if (result.insert_svg) entries.push({ brandName: inputs.brandName, style: inputs.style, assetType: 'insert', svg: result.insert_svg, createdAt: new Date().toISOString() });
      for (const e of entries) await saveToHistory(e);
      if (entries.length) AsyncStorage.getItem(STORAGE_KEYS.brandHistory).then(r => r && setHistory(JSON.parse(r)));
    } catch (err: any) {
      const msg = err?.message ?? "Couldn't generate asset. Please try again.";
      setLabelError(msg);
      track('brand_generation_failed', { type: 'label', error: msg, packaging: packagingType });
    } finally { setLabelLoading(false); }
  }, [inputs, selectedDirection, packagingType, can, increment]);

  const handleGenerateInsert = useCallback(async () => {
    if (!isOnline) { setLabelError('No internet connection. Connect and try again.'); return; }
    if (!can('brands')) { track('paywall_shown', { feature: 'brands', source: 'insert_generator' }); setShowPaywall(true); return; }
    setInsertLoading(true);
    setLabelError('');
    const dir = BRAND_DIRECTIONS.find(d => d.id === selectedDirection);
    try {
      // Use the dedicated /brand/insert endpoint so we only generate the insert.
      // Previously called api.createLabel() which regenerated both label AND insert,
      // potentially overwriting a finished label and wasting a generation credit.
      const result = await api.createInsert({
        brand_name:      inputs.brandName || 'Brand',
        product_name:    labelFields?.['productName'] || inputs.brandName || 'Product',
        weight:          labelFields?.['netWeight'] || '0.5kg',
        style:           inputs.style.toLowerCase(),
        brand_direction: selectedDirection ?? undefined,
        color_palette:   inputs.colorPalette,
        font_style:      inputs.fontStyle,
        packaging_type:  packagingType,
        tagline:         inputs.tagline || undefined,
        support_url:     labelFields?.['supportUrl'] || undefined,
        qr_text:         labelFields?.['qrText'] || undefined,
      });
      await increment('brands');
      // Always preserve the existing label_svg — only the insert changes
      setLabelResult(prev => ({
        label_svg:  prev?.label_svg ?? '',
        insert_svg: result.insert_svg,
      }));
      if (result.insert_svg) {
        const entry: BrandHistoryEntry = { brandName: inputs.brandName, style: inputs.style, assetType: 'insert', svg: result.insert_svg, createdAt: new Date().toISOString() };
        await saveToHistory(entry);
        AsyncStorage.getItem(STORAGE_KEYS.brandHistory).then(r => r && setHistory(JSON.parse(r)));
      }
    } catch (err: any) {
      const msg = err?.message ?? "Couldn't generate insert. Please try again.";
      setLabelError(msg);
      track('brand_generation_failed', { type: 'insert', error: msg });
    } finally { setInsertLoading(false); }
  }, [inputs, selectedDirection, packagingType, can, increment]);

  function makeExportHandler(svg: string, filename: string) {
    return async () => {
      if (tier === 'explorer') {
        track('paywall_shown', { feature: 'export', source: 'brand_studio' });
        setShowPaywall(true);
        return;
      }
      setExportLoading(true);
      setExportError('');
      try {
        await exportSvg(svg, filename);
      } catch (err: any) {
        setExportError(err?.message ?? 'Export failed. Please try again.');
      } finally {
        setExportLoading(false);
      }
    };
  }

  const handleExportLogo   = brandResult?.logo_svg   ? makeExportHandler(brandResult.logo_svg,   'siftly-logo')   : () => {};
  const handleExportLabel  = labelResult?.label_svg  ? makeExportHandler(labelResult.label_svg,  'siftly-label')  : () => {};
  const handleExportInsert = labelResult?.insert_svg ? makeExportHandler(labelResult.insert_svg, 'siftly-insert') : () => {};

  const productCategory    = pipeline.activeNiche?.keyword ?? pipeline.activeProduct?.title ?? activeProduct?.name;
  const effectiveBrandName = selectedLogoName || inputs.brandName;

  function handleRestoreHistory(entry: BrandHistoryEntry) {
    if (entry.assetType === 'logo') {
      setBrandResult({
        logo_svg: entry.svg, brand_name: entry.brandName, name_options: [],
        tagline: '', style: entry.style,
        listing: { title: '', bullet_points: [], description: '', backend_keywords: [] },
        generated_keywords: [],
      });
      setDirectionChanged(false);
      setActiveTool('logo');
    } else if (entry.assetType === 'label') {
      setLabelResult(prev => ({ insert_svg: prev?.insert_svg ?? '', label_svg: entry.svg }));
      setActiveTool('label');
    } else {
      setLabelResult(prev => ({ label_svg: prev?.label_svg ?? '', insert_svg: entry.svg }));
      setActiveTool('insert');
    }
  }

  function handleClearHistory() {
    Alert.alert('Clear History', 'Remove all saved brand assets?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Clear', style: 'destructive', onPress: () => {
        AsyncStorage.removeItem(STORAGE_KEYS.brandHistory).catch(() => {});
        setHistory([]);
      }},
    ]);
  }

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <PaywallModal visible={showPaywall} onClose={() => setShowPaywall(false)} featureContext="brand" />

      <AppHeader helpKey={studioMode === 'tools' ? (TOOL_HELP[activeTool] ?? 'brand_studio') : studioMode === 'kit' ? 'brand_studio' : 'brand_studio'} />
      {navigation.canGoBack() && (
        <TouchableOpacity style={bs.backBar} onPress={() => navigation.goBack()} activeOpacity={0.7}>
          <Text style={bs.backTxt}>← Back</Text>
        </TouchableOpacity>
      )}
      <OfflineBanner visible={!isOnline} />

      {/* Mode toggle — 3 segments */}
      <View style={bs.modeToggleRow}>
        {([
          { id: 'steps', label: '✦ Make Assets',   sub: 'Logo, label & listing' },
          { id: 'tools', label: '⊞ Quick Tools',  sub: 'Jump to any asset'     },
          { id: 'kit',   label: '🎨 Brand Identity', sub: 'Story & guidelines' },
        ] as const).map(m => (
          <TouchableOpacity
            key={m.id}
            style={[bs.modeBtn, studioMode === m.id && bs.modeBtnActive]}
            onPress={() => setStudioMode(m.id)}
            activeOpacity={0.8}
          >
            <Text style={[bs.modeBtnTxt, studioMode === m.id && bs.modeBtnTxtActive]}>{m.label}</Text>
            <Text style={[bs.modeBtnSub, studioMode === m.id && bs.modeBtnSubActive]}>{m.sub}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {studioMode === 'kit' ? (
        <CompleteBrandKitBuilder />
      ) : studioMode === 'tools' ? (
        <>
          <ScrollView
            style={s.scroll}
            contentContainerStyle={s.content}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {/* Pipeline context */}
            <PipelineContextBanner
              product={pipeline.activeProduct?.title ?? activeProduct?.name}
              niche={pipeline.activeNiche?.keyword}
              supplier={pipeline.selectedSupplier?.name}
            />

            {/* Compact brand name — direction/style set in Make Assets flow */}
            <BrandNameBar inputs={inputs} onChange={handleInputChange} />

            {/* Tool selector — 2-col card grid matching ProfitLab */}
            <ToolSelector
              active={activeTool}
              onSelect={setActiveTool}
              hasBrandResult={!!brandResult}
              hasLabelSvg={!!labelResult?.label_svg}
              hasInsertSvg={!!labelResult?.insert_svg}
              hasBarcodeConfig={!!barcodeMode}
            />

            {/* Active tool workspace header */}
            <SectionHeader
              title={TOOLS.find(t => t.id === activeTool)?.name ?? ''}
              subtitle={TOOLS.find(t => t.id === activeTool)?.desc}
            />

            {/* ── LOGO TOOL ── */}
            {activeTool === 'logo' && (
              <View style={{ gap: DS.sectionGap }}>
                <LogoMakerTab
                  brandName={inputs.brandName}
                  tagline={inputs.tagline}
                  style={inputs.style}
                  colorPalette={inputs.colorPalette}
                  loading={brandLoading}
                  warmingUp={warmingUp}
                  result={brandResult}
                  onGenerate={handleGenerateBrand}
                  genError={brandError}
                  onRetry={handleGenerateBrand}
                  exportLoading={exportLoading}
                  exportError={exportError}
                  onExport={handleExportLogo}
                  accentColor={DS.pink}
                  selectedName={selectedLogoName}
                  onSelectName={setSelectedLogoName}
                  activeConceptIdx={activeConceptIdx}
                  onConceptIdx={setActiveConceptIdx}
                  directionId={selectedDirection}
                />
                {brandResult && (
                  <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 10, padding: 12, borderRadius: DS.radiusChip, backgroundColor: DS.success + '10', borderWidth: 1, borderColor: DS.success + '30' }}>
                    <Text style={{ fontSize: 13, fontWeight: '900', color: DS.success }}>✓</Text>
                    <View style={{ flex: 1, gap: 2 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <Text style={{ fontSize: 12, fontWeight: '700', color: DS.success }}>Logo generated</Text>
                        <View style={{ paddingHorizontal: 6, paddingVertical: 2, borderRadius: DS.radiusBadge, backgroundColor: brandResult.quality_tier === 'standard' ? DS.warning + '20' : DS.accent + '15' }}>
                          <Text style={{ fontSize: 9, fontWeight: '800', color: brandResult.quality_tier === 'standard' ? DS.warning : DS.accent, letterSpacing: 0.5 }}>
                            {brandResult.quality_tier === 'standard' ? 'STANDARD' : 'PREMIUM'}
                          </Text>
                        </View>
                      </View>
                      <Text style={{ fontSize: 11, color: DS.textMuted, lineHeight: 16 }}>
                        {brandResult.quality_tier === 'standard'
                          ? "You've used your premium generations this month — upgrade for higher quality."
                          : 'Listing content ready in the Listing tool.'}
                      </Text>
                    </View>
                  </View>
                )}
              </View>
            )}

            {/* ── LABEL TOOL ── */}
            {activeTool === 'label' && (
              <View style={{ gap: DS.sectionGap }}>
                <LabelGeneratorTab
                  brandName={inputs.brandName}
                  tagline={inputs.tagline}
                  loading={labelLoading}
                  warmingUp={labelWarmingUp}
                  result={labelResult}
                  onGenerate={handleGenerateLabel}
                  genError={labelError}
                  onRetry={handleGenerateLabel}
                  exportLoading={exportLoading}
                  exportError={exportError}
                  onExport={handleExportLabel}
                  accentColor={DS.accent}
                  packagingType={packagingType}
                  onPackagingType={setPackagingType}
                />
                <LabelContentFields
                  brandName={effectiveBrandName}
                  tagline={inputs.tagline || brandResult?.tagline || ''}
                  onSave={(flds) => {
                    setLabelFields(flds);
                    setLabelTemplate(packagingType);
                    setLabelBarcodeP(barcodePlace);
                  }}
                  savedFields={labelFields}
                  barcodePlacement={barcodePlace}
                />
                <PackagingMockupCard
                  brandName={effectiveBrandName}
                  colorPalette={inputs.colorPalette}
                  tagline={inputs.tagline || brandResult?.tagline || ''}
                />
              </View>
            )}

            {/* ── INSERT TOOL ── */}
            {activeTool === 'insert' && (
              <View style={{ gap: DS.sectionGap }}>
                <PackagingInsertTab
                  brandName={inputs.brandName}
                  loading={insertLoading}
                  result={labelResult}
                  onGenerate={handleGenerateInsert}
                  genError={labelError}
                  exportLoading={exportLoading}
                  exportError={exportError}
                  onExport={handleExportInsert}
                  accentColor={DS.accent}
                  labelFields={labelFields}
                />
              </View>
            )}

            {/* ── BARCODE TOOL ── */}
            {activeTool === 'barcode' && (
              <View style={{ gap: DS.sectionGap }}>
                <BarcodeWorkflowCard
                  brandName={effectiveBrandName}
                  onSave={(mode, ident, place, pack, gs1, fnsku) => {
                    setBarcodeMode(mode);
                    setBarcodeIdent(ident);
                    setBarcodePlace(place);
                    setBarcodePackage(pack);
                    setBarcodeGs1(gs1);
                    setBarcodeFnsku(fnsku);
                  }}
                  savedMode={barcodeMode}
                  savedIdentifier={barcodeIdent}
                  savedPlacement={barcodePlace}
                  savedPackaging={barcodePackage}
                />
                <BarcodeIdentifierCard />
              </View>
            )}

            {/* ── LISTING TOOL ── */}
            {activeTool === 'listing' && (
              <View style={{ gap: DS.sectionGap }}>
                {brandResult ? (
                  <ListingPreparationCard
                    result={brandResult}
                    niche={pipeline.activeNiche?.keyword}
                    reconInsights={pipeline.reconInsights}
                  />
                ) : (
                  <AppCard style={{ alignItems: 'center', gap: 12, paddingVertical: 24 }}>
                    <Text style={{ fontSize: 26 }}>✦</Text>
                    <View style={{ gap: 6, alignItems: 'center' }}>
                      <Text style={{ fontSize: 14, fontWeight: '800', color: DS.textPrimary, textAlign: 'center' }}>Generate a logo first</Text>
                      <Text style={{ fontSize: 12, color: DS.textMuted, textAlign: 'center', lineHeight: 18, paddingHorizontal: 12 }}>
                        Your AI listing title, bullets, and keywords are generated alongside your logo.
                      </Text>
                    </View>
                    <TouchableOpacity
                      style={{ backgroundColor: DS.accent, borderRadius: DS.radiusButton, paddingVertical: 11, paddingHorizontal: 24 }}
                      onPress={() => setActiveTool('logo')}
                      activeOpacity={0.85}
                    >
                      <Text style={{ fontSize: 13, fontWeight: '800', color: DS.bgCard }}>Go to Logo →</Text>
                    </TouchableOpacity>
                  </AppCard>
                )}
                <AmazonComplianceCard category={productCategory} />
                <CopilotTipCard
                  icon="✅"
                  tip="Some categories require legal disclaimers before launch. Missing required labels can result in Amazon suppressing your listing."
                  accent={DS.success}
                />
              </View>
            )}

            {/* Pipeline save + launch */}
            {inputs.brandName.trim().length > 0 && (
              <BrandPipelineActions
                brandName={effectiveBrandName}
                productTitle={pipeline.activeProduct?.title ?? inputs.brandName}
                tagline={inputs.tagline || brandResult?.tagline || ''}
                keywords={brandResult?.generated_keywords ?? []}
                style={inputs.style}
                pipeline={pipeline}
                personality={inputs.personality}
                colorPalette={inputs.colorPalette}
                fontStyle={inputs.fontStyle}
                brandDirection={selectedDirection ?? undefined}
                listingTitle={brandResult?.listing?.title}
                listingBullets={brandResult?.listing?.bullet_points}
                backendKeywords={brandResult?.listing?.backend_keywords}
                barcodeMode={barcodeMode}
                barcodeIdentifier={barcodeIdent}
                barcodePlacement={barcodePlace}
                barcodePackagingType={barcodePackage}
                barcodeGs1Required={barcodeGs1}
                barcodeFnskuRequired={barcodeFnsku}
                labelTemplate={labelTemplate}
                labelFields={labelFields}
                labelBarcodePlacement={labelBarcodeP}
              />
            )}

            {/* Brand tips */}
            <SectionHeader title="Brand Tips" style={s.sectionHead} />
            <BrandRecommendationsCard />

            {/* Recent Assets */}
            {history.length > 0 && (
              <>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: -4 }}>
                  <SectionHeader title="Recent Assets" style={s.sectionHead} />
                  <TouchableOpacity onPress={handleClearHistory} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                    <Text style={{ fontSize: 12, fontWeight: '600', color: DS.danger }}>Clear</Text>
                  </TouchableOpacity>
                </View>
                <AppCard style={{ gap: 0 }}>
                  {history.map((entry, i) => {
                    const daysAgo = Math.floor((Date.now() - new Date(entry.createdAt).getTime()) / 86_400_000);
                    return (
                      <View key={i} style={[bh.row, i > 0 && bh.rowBorder]}>
                        <View style={bh.iconWrap}>
                          <SvgXml xml={entry.svg} width={32} height={32} />
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={bh.name}>{entry.brandName || 'Untitled'}</Text>
                          <Text style={bh.meta}>{entry.assetType} · {entry.style} · {daysAgo === 0 ? 'today' : `${daysAgo}d ago`}</Text>
                        </View>
                        <TouchableOpacity style={bh.reExport} onPress={() => handleRestoreHistory(entry)} activeOpacity={0.75}>
                          <Text style={bh.reExportTxt}>Restore</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={[bh.reExport, { marginLeft: 6 }]} onPress={makeExportHandler(entry.svg, `siftly-${entry.assetType}`)} activeOpacity={0.75}>
                          <Text style={bh.reExportTxt}>Export</Text>
                        </TouchableOpacity>
                      </View>
                    );
                  })}
                </AppCard>
              </>
            )}
          </ScrollView>
        </>
      ) : (

        /* ── STEPS MODE ──────────────────────────────────────────────────── */
        <>
          <ScrollView
            style={s.scroll}
            contentContainerStyle={s.content}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            <PipelineContextBanner
              product={pipeline.activeProduct?.title ?? activeProduct?.name}
              niche={pipeline.activeNiche?.keyword}
              supplier={pipeline.selectedSupplier?.name}
            />

            {/* Step 1 — Brand Identity */}
            <BrandStepSection
              step={1}
              title="Brand Identity"
              subtitle="Name, style, palette & direction"
              doneLabel={effectiveBrandName ? `"${effectiveBrandName}" · ${inputs.style}` : 'Set up your brand'}
              current={brandStep === 1}
              done={completedBrandSteps.has(1)}
              locked={false}
              onExpand={() => setBrandStep(1)}
            >
              <BrandIdentityCard inputs={inputs} onChange={handleInputChange} />
              <BrandDirectionPicker
                selectedId={selectedDirection}
                onSelect={handleSelectDirection}
              />
              <CopilotTipCard
                icon="✦"
                tip="Your brand direction shapes every asset — logo, label, and insert — so choosing one that fits your product niche is worth a moment of thought."
                accent={DS.accent}
              />
              <StepContinueBtn
                label="Set brand & continue →"
                onPress={() => advanceBrandStep(1)}
              />
            </BrandStepSection>

            {/* Step 2 — Logo */}
            <BrandStepSection
              step={2}
              title="Logo"
              subtitle="AI-generated SVG logo"
              doneLabel="Logo generated ✓"
              current={brandStep === 2}
              done={completedBrandSteps.has(2)}
              locked={brandStep < 2 && !completedBrandSteps.has(1)}
              onExpand={() => setBrandStep(2)}
            >
              {directionChanged && brandResult && (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, padding: 12, borderRadius: DS.radiusChip, backgroundColor: DS.warning + '18', borderWidth: 1, borderColor: DS.warning + '40' }}>
                  <Text style={{ fontSize: 12, color: DS.warning, fontWeight: '600' }}>⚠ Direction changed — tap Regenerate to update your logo.</Text>
                </View>
              )}
              <LogoMakerTab
                brandName={inputs.brandName}
                tagline={inputs.tagline}
                style={inputs.style}
                colorPalette={inputs.colorPalette}
                loading={brandLoading}
                warmingUp={warmingUp}
                result={brandResult}
                onGenerate={handleGenerateBrand}
                genError={brandError}
                onRetry={handleGenerateBrand}
                exportLoading={exportLoading}
                exportError={exportError}
                onExport={handleExportLogo}
                accentColor={DS.pink}
                selectedName={selectedLogoName}
                onSelectName={setSelectedLogoName}
                activeConceptIdx={activeConceptIdx}
                onConceptIdx={setActiveConceptIdx}
                directionId={selectedDirection}
              />
              {brandResult && (
                <StepContinueBtn
                  label="Logo done — continue →"
                  onPress={() => advanceBrandStep(2)}
                />
              )}
            </BrandStepSection>

            {/* Step 3 — Barcode */}
            <BrandStepSection
              step={3}
              title="Barcode"
              subtitle="GS1 UPC & FNSKU setup"
              doneLabel={barcodeMode ? `${barcodeMode.replace(/_/g, ' ')} configured ✓` : 'Barcode configured ✓'}
              current={brandStep === 3}
              done={completedBrandSteps.has(3)}
              locked={brandStep < 3 && !completedBrandSteps.has(2)}
              onExpand={() => setBrandStep(3)}
            >
              <CopilotTipCard
                icon="🔲"
                tip="Private labellers typically need GS1 UPCs for retail + FNSKU for FBA. FNSKU-only works if you're selling exclusively on Amazon without Brand Registry."
                accent={DS.accent}
              />
              <BarcodeWorkflowCard
                brandName={effectiveBrandName}
                onSave={(mode, ident, place, pack, gs1, fnsku) => {
                  setBarcodeMode(mode);
                  setBarcodeIdent(ident);
                  setBarcodePlace(place);
                  setBarcodePackage(pack);
                  setBarcodeGs1(gs1);
                  setBarcodeFnsku(fnsku);
                  advanceBrandStep(3);
                }}
                savedMode={barcodeMode}
                savedIdentifier={barcodeIdent}
                savedPlacement={barcodePlace}
                savedPackaging={barcodePackage}
              />
              <BarcodeIdentifierCard />
              <TouchableOpacity onPress={() => advanceBrandStep(3)} activeOpacity={0.7}>
                <Text style={{ textAlign: 'center', fontSize: 12, color: DS.textMuted, fontWeight: '600', paddingVertical: 4 }}>
                  Skip barcode setup for now →
                </Text>
              </TouchableOpacity>
            </BrandStepSection>

            {/* Step 4 — Label */}
            <BrandStepSection
              step={4}
              title="Label & Packaging"
              subtitle="Generate your product label SVG"
              doneLabel="Label generated ✓"
              current={brandStep === 4}
              done={completedBrandSteps.has(4)}
              locked={brandStep < 4 && !completedBrandSteps.has(3)}
              onExpand={() => setBrandStep(4)}
            >
              <CopilotTipCard
                icon="⚠"
                tip="Warnings and directions are legally required for supplements, cosmetics, and children's products. Verify your category requirements before printing."
                accent={DS.warning}
              />
              <LabelGeneratorTab
                brandName={inputs.brandName}
                tagline={inputs.tagline}
                loading={labelLoading}
                warmingUp={labelWarmingUp}
                result={labelResult}
                onGenerate={handleGenerateLabel}
                genError={labelError}
                onRetry={handleGenerateLabel}
                exportLoading={exportLoading}
                exportError={exportError}
                onExport={handleExportLabel}
                accentColor={DS.accent}
                packagingType={packagingType}
                onPackagingType={setPackagingType}
              />
              <LabelContentFields
                brandName={effectiveBrandName}
                tagline={inputs.tagline || brandResult?.tagline || ''}
                onSave={(flds) => {
                  setLabelFields(flds);
                  setLabelTemplate(packagingType);
                  setLabelBarcodeP(barcodePlace);
                }}
                savedFields={labelFields}
                barcodePlacement={barcodePlace}
              />
              <PackagingMockupCard
                brandName={effectiveBrandName}
                colorPalette={inputs.colorPalette}
                tagline={inputs.tagline || brandResult?.tagline || ''}
              />
              {(labelResult?.label_svg || labelTemplate) && (
                <StepContinueBtn
                  label="Label done — continue →"
                  onPress={() => advanceBrandStep(4)}
                />
              )}
            </BrandStepSection>

            {/* Step 5 — Insert */}
            <BrandStepSection
              step={5}
              title="Packaging Insert"
              subtitle="Thank-you card & review request"
              doneLabel="Insert generated ✓"
              current={brandStep === 5}
              done={completedBrandSteps.has(5)}
              locked={brandStep < 5 && !completedBrandSteps.has(4)}
              onExpand={() => setBrandStep(5)}
            >
              <CopilotTipCard
                icon="📦"
                tip="A packaging insert asking for a review can significantly boost your review rate. Keep it warm, concise, and include a QR code direct to your Amazon review page."
                accent={DS.accent}
              />
              <PackagingInsertTab
                brandName={inputs.brandName}
                loading={insertLoading}
                result={labelResult}
                onGenerate={handleGenerateInsert}
                genError={labelError}
                exportLoading={exportLoading}
                exportError={exportError}
                onExport={handleExportInsert}
                accentColor={DS.accent}
                labelFields={labelFields}
              />
              {labelResult?.insert_svg && (
                <StepContinueBtn
                  label="Insert done — continue →"
                  onPress={() => advanceBrandStep(5)}
                />
              )}
            </BrandStepSection>

            {/* Step 6 — Listing */}
            <BrandStepSection
              step={6}
              title="Listing Prep"
              subtitle="AI title, bullets & compliance"
              doneLabel="Listing ready ✓"
              current={brandStep === 6}
              done={completedBrandSteps.has(6)}
              locked={brandStep < 6 && !completedBrandSteps.has(5)}
              onExpand={() => setBrandStep(6)}
            >
              <CopilotTipCard
                icon="📝"
                tip="Your bullets should directly address customer complaints from Recon. Complaints = your strongest selling points when solved correctly."
                accent={DS.accent}
              />
              {brandResult ? (
                <ListingPreparationCard
                  result={brandResult}
                  niche={pipeline.activeNiche?.keyword}
                  reconInsights={pipeline.reconInsights}
                />
              ) : (
                <AppCard style={{ alignItems: 'center', gap: 10, paddingVertical: 20 }}>
                  <Text style={{ fontSize: 13, color: DS.textMuted, textAlign: 'center' }}>
                    Generate a logo in Step 2 — listing content is created alongside it.
                  </Text>
                  <TouchableOpacity
                    style={{ backgroundColor: DS.accent, borderRadius: DS.radiusButton, paddingVertical: 9, paddingHorizontal: 20 }}
                    onPress={() => setBrandStep(2)}
                    activeOpacity={0.85}
                  >
                    <Text style={{ fontSize: 12, fontWeight: '800', color: DS.bgCard }}>Go to Logo →</Text>
                  </TouchableOpacity>
                </AppCard>
              )}
              <AmazonComplianceCard category={productCategory} />
              {brandResult && (
                <StepContinueBtn
                  label="Complete — view brand report ↓"
                  variant="success"
                  onPress={() => advanceBrandStep(6)}
                />
              )}
            </BrandStepSection>

            {/* Brand Report — unlocks when step 6 completed */}
            {completedBrandSteps.has(6) && (
              <BrandReportCard
                brandName={effectiveBrandName}
                tagline={inputs.tagline || brandResult?.tagline || ''}
                colorPalette={inputs.colorPalette}
                brandResult={brandResult}
                labelResult={labelResult}
                barcodeMode={barcodeMode}
                barcodeIdent={barcodeIdent}
                barcodePlace={barcodePlace}
                exportLoading={exportLoading}
                onExportLogo={handleExportLogo}
                onExportLabel={handleExportLabel}
                onExportInsert={handleExportInsert}
                onLaunch={handleLaunchDecision}
              />
            )}

            {/* Pipeline save always visible */}
            {inputs.brandName.trim().length > 0 && (
              <BrandPipelineActions
                brandName={effectiveBrandName}
                productTitle={pipeline.activeProduct?.title ?? inputs.brandName}
                tagline={inputs.tagline || brandResult?.tagline || ''}
                keywords={brandResult?.generated_keywords ?? []}
                style={inputs.style}
                pipeline={pipeline}
                personality={inputs.personality}
                colorPalette={inputs.colorPalette}
                fontStyle={inputs.fontStyle}
                brandDirection={selectedDirection ?? undefined}
                listingTitle={brandResult?.listing?.title}
                listingBullets={brandResult?.listing?.bullet_points}
                backendKeywords={brandResult?.listing?.backend_keywords}
                barcodeMode={barcodeMode}
                barcodeIdentifier={barcodeIdent}
                barcodePlacement={barcodePlace}
                barcodePackagingType={barcodePackage}
                barcodeGs1Required={barcodeGs1}
                barcodeFnskuRequired={barcodeFnsku}
                labelTemplate={labelTemplate}
                labelFields={labelFields}
                labelBarcodePlacement={labelBarcodeP}
              />
            )}

            <SectionHeader title="Brand Tips" style={s.sectionHead} />
            <BrandRecommendationsCard />

            {history.length > 0 && (
              <>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: -4 }}>
                  <SectionHeader title="Recent Assets" style={s.sectionHead} />
                  <TouchableOpacity onPress={handleClearHistory} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                    <Text style={{ fontSize: 12, fontWeight: '600', color: DS.danger }}>Clear</Text>
                  </TouchableOpacity>
                </View>
                <AppCard style={{ gap: 0 }}>
                  {history.map((entry, i) => {
                    const daysAgo = Math.floor((Date.now() - new Date(entry.createdAt).getTime()) / 86_400_000);
                    return (
                      <View key={i} style={[bh.row, i > 0 && bh.rowBorder]}>
                        <View style={bh.iconWrap}>
                          <SvgXml xml={entry.svg} width={32} height={32} />
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={bh.name}>{entry.brandName || 'Untitled'}</Text>
                          <Text style={bh.meta}>{entry.assetType} · {entry.style} · {daysAgo === 0 ? 'today' : `${daysAgo}d ago`}</Text>
                        </View>
                        <TouchableOpacity style={bh.reExport} onPress={() => handleRestoreHistory(entry)} activeOpacity={0.75}>
                          <Text style={bh.reExportTxt}>Restore</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={[bh.reExport, { marginLeft: 6 }]} onPress={makeExportHandler(entry.svg, `siftly-${entry.assetType}`)} activeOpacity={0.75}>
                          <Text style={bh.reExportTxt}>Export</Text>
                        </TouchableOpacity>
                      </View>
                    );
                  })}
                </AppCard>
              </>
            )}
          </ScrollView>
        </>
      )}
    </SafeAreaView>
  );
}

const bh = StyleSheet.create({
  row:        { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12 },
  rowBorder:  { borderTopWidth: 1, borderTopColor: DS.border },
  iconWrap:   { width: 40, height: 40, borderRadius: 10, overflow: 'hidden', backgroundColor: DS.bgSubtle, borderWidth: 1, borderColor: DS.border },
  name:       { fontSize: 13, fontWeight: '700', color: DS.textPrimary },
  meta:       { fontSize: 11, color: DS.textMuted, marginTop: 2 },
  reExport:   { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8, borderWidth: 1, borderColor: DS.border, backgroundColor: DS.bgSubtle },
  reExportTxt:{ fontSize: 11, fontWeight: '700', color: DS.accent },
});

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: DS.bgCanvas },

  header: {
    paddingHorizontal: DS.pagePadding,
    paddingTop:        10,
    paddingBottom:     12,
    backgroundColor:   DS.bgCard,
    borderBottomWidth: 1,
    borderBottomColor: DS.border,
    gap:               3,
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

const bs = StyleSheet.create({
  backBar: {
    paddingHorizontal: DS.pagePadding,
    paddingVertical:   8,
    backgroundColor:   DS.bgCard,
    borderBottomWidth: 1,
    borderBottomColor: DS.border,
  },
  backTxt: { fontSize: 13, fontWeight: '700', color: DS.accent },
  modeToggleRow: {
    flexDirection:    'row',
    marginHorizontal: DS.pagePadding,
    marginVertical:   DS.cardGap,
    gap:              DS.cardGap,
  },
  modeBtn: {
    flex:            1,
    paddingVertical: 8,
    borderRadius:    DS.radiusButton,
    backgroundColor: DS.bgElevated,
    alignItems:      'center',
    borderWidth:     1.5,
    borderColor:     DS.border,
    paddingHorizontal: 4,
  },
  modeBtnActive: {
    backgroundColor: DS.accent,
    borderColor:     DS.accent,
  },
  modeBtnTxt: {
    fontSize:   11,
    fontWeight: '800',
    color:      DS.textSecondary,
    textAlign:  'center',
  },
  modeBtnTxtActive: {
    color: DS.bgCard,
  },
  modeBtnSub: {
    fontSize:   9,
    fontWeight: '500',
    color:      DS.textMuted,
    marginTop:  1,
    textAlign:  'center',
  },
  modeBtnSubActive: {
    color: 'rgba(255,255,255,0.75)',
  },
});
