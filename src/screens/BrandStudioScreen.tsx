import React, { useState, useCallback, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { STORAGE_KEYS } from '../constants/storage';
import { useActiveProduct } from '../context/ActiveProductContext';
import { usePipeline } from '../context/PipelineContext';
import { PipelineProgressBar } from '../components/PipelineProgressBar';
import {
  ScrollView, StyleSheet, View, Text, TouchableOpacity,
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
import { HelpButton } from '../components/HelpModal';
import { AppHeader } from '../components/AppHeader';
import type { FeatureKey } from '../lib/featureHelp';
import FeasibilityHeart from '../components/FeasibilityHeart';

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
    const list: BrandHistoryEntry[] = raw ? JSON.parse(raw) : [];
    list.unshift(entry);
    await AsyncStorage.setItem(STORAGE_KEYS.brandHistory, JSON.stringify(list.slice(0, 6)));
  } catch { /* best-effort */ }
}

// ── Generation result types ───────────────────────────────────────────────────

interface LabelResult {
  label_svg:  string;
  insert_svg: string;
}

// ── Types & constants ─────────────────────────────────────────────────────────

type StyleOption = 'Minimal' | 'Premium' | 'Eco' | 'Bold' | 'Luxury';
type AssetTab    = 'logo' | 'label' | 'insert';

interface BrandInputs {
  brandName:      string;
  targetAudience: string;
  brandTone:      string;
  style:          StyleOption;
}

const STYLE_OPTIONS: { id: StyleOption; icon: string; color: string; bg: string }[] = [
  { id: 'Minimal', icon: '○',  color: DS.textSecondary, bg: DS.bgSubtle   },
  { id: 'Premium', icon: '✦',  color: DS.accent,         bg: DS.accentLight },
  { id: 'Eco',     icon: '🌿', color: DS.accentDark,    bg: DS.accentLight },
  { id: 'Bold',    icon: '◼',  color: DS.info,           bg: DS.infoBg      },
  { id: 'Luxury',  icon: '◆',  color: DS.indigo,         bg: DS.indigoLight },
];

const ASSET_TABS: { id: AssetTab; label: string; color: string; colorLight: string }[] = [
  { id: 'logo',   label: 'Logo Maker',      color: DS.pink,   colorLight: DS.pinkLight   },
  { id: 'label',  label: 'Label Generator', color: DS.indigo, colorLight: DS.indigoLight },
  { id: 'insert', label: 'Packaging Insert', color: DS.accent, colorLight: DS.accentLight },
];

const ASSET_HELP: Record<AssetTab, FeatureKey> = {
  logo:   'brand_logo',
  label:  'brand_label',
  insert: 'brand_insert',
};

const ASSET_DESC: Record<AssetTab, string> = {
  logo:   'AI-generates a brand logo from your name, tone, and style as an exportable SVG.',
  label:  'Creates a product label with your brand elements, ready to export and share with your supplier.',
  insert: 'Designs a post-purchase insert card included in every shipment to drive reviews and repeat buys.',
};

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


// ── 3-tab segmented control ───────────────────────────────────────────────────

function AssetSegmentedControl({
  value,
  onChange,
}: {
  value: AssetTab;
  onChange: (v: AssetTab) => void;
}) {
  return (
    <View style={seg.wrap}>
      {ASSET_TABS.map(t => {
        const active = value === t.id;
        return (
          <TouchableOpacity
            key={t.id}
            style={[seg.tab, active && { backgroundColor: t.color, borderColor: t.color }]}
            onPress={() => onChange(t.id)}
            activeOpacity={0.8}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
          >
            <Text style={[seg.label, active && seg.labelActive]} numberOfLines={1}>
              {t.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const seg = StyleSheet.create({
  wrap: { flexDirection: 'row', gap: 8 },
  tab: {
    flex: 1, alignItems: 'center',
    backgroundColor: DS.bgCard, borderRadius: 20, borderWidth: 1, borderColor: DS.border,
    paddingHorizontal: 8, paddingVertical: 9,
  },
  label:       { fontSize: 11, fontWeight: '700', color: DS.textSecondary },
  labelActive: { color: '#fff' },
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
  chipIcon:    { fontSize: 13 },
  chipText:    { fontSize: 12, fontWeight: '600', color: DS.textSecondary },
});

// ── Logo Maker tab ────────────────────────────────────────────────────────────

function LogoMakerTab({
  brandName, style, loading, result, onGenerate, genError, exportLoading, exportError, onExport, accentColor,
}: {
  brandName:     string;
  style:         StyleOption;
  loading:       boolean;
  result:        BrandResult | null;
  onGenerate:    () => void;
  genError:      string;
  exportLoading: boolean;
  exportError:   string;
  onExport:      () => void;
  accentColor:   string;
}) {
  const displayName = result?.brand_name || brandName.trim() || 'Your Brand';
  const tagline     = result?.tagline || 'Premium Quality Product';
  const styleOpt    = STYLE_OPTIONS.find(o => o.id === style) ?? STYLE_OPTIONS[0];
  const hasSvg      = !!result?.logo_svg && isValidSvg(result.logo_svg);

  return (
    <View style={at.wrap}>
      {/* Preview card */}
      <AppCard padding={0} style={lm.previewCard}>
        <View style={lm.canvas}>
          {loading ? (
            <View style={{ gap: 12, alignItems: 'center' }}>
              <PulseDots color={accentColor} />
              <Text style={{ fontSize: 13, color: DS.textMuted }}>Generating brand kit...</Text>
            </View>
          ) : hasSvg ? (
            <SvgXml xml={result!.logo_svg} width="100%" height={200} />
          ) : (
            <>
              <View style={[lm.mark, { backgroundColor: styleOpt.bg, borderColor: styleOpt.color + '40' }]}>
                <Text style={[lm.markIcon, { color: styleOpt.color }]}>{styleOpt.icon}</Text>
              </View>
              <Text style={lm.brandName} numberOfLines={1}>{displayName}</Text>
              <Text style={lm.tagline}>{tagline}</Text>
              {result?.name_options && result.name_options.length > 0 && (
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, justifyContent: 'center' }}>
                  {result.name_options.slice(0, 3).map((n, i) => (
                    <View key={i} style={{ backgroundColor: styleOpt.bg, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 }}>
                      <Text style={{ fontSize: 11, fontWeight: '600', color: styleOpt.color }}>{n}</Text>
                    </View>
                  ))}
                </View>
              )}
            </>
          )}
        </View>
        {!result && (
          <View style={lm.helperRow}>
            <Text style={lm.helperText}>Your generated logo will appear here after generation.</Text>
          </View>
        )}
        <View style={lm.footer}>
          <StatusBadge label={result ? 'Generated' : style + ' Style'} variant={result ? 'success' : 'info'} />
          <Text style={lm.footerHint}>{result ? (hasSvg ? 'AI-generated SVG' : 'AI-generated') : 'Template Preview'}</Text>
        </View>
      </AppCard>

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
        <PrimaryButton label={loading ? 'Generating...' : 'Generate Logo'} onPress={onGenerate} icon="✦" loading={loading} style={{ backgroundColor: accentColor, shadowColor: accentColor }} />
        <SecondaryButton
          label={exportLoading ? 'Exporting...' : 'Export SVG'}
          onPress={onExport}
          icon="↓"
          disabled={!hasSvg}
          loading={exportLoading}
        />
      </View>
      {result && (
        <FeasibilityHeart
          type="brand"
          label={`${result.brand_name} — ${result.tagline}`}
          data={{ brand_name: result.brand_name, tagline: result.tagline, name_options: result.name_options, listing_title: result.listing?.title, generated_keywords: result.generated_keywords }}
        />
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
  brandName, loading, result, onGenerate, genError, exportLoading, exportError, onExport, accentColor,
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
}) {
  const displayName = brandName.trim() || 'Your Brand';
  const hasSvg      = !!result?.label_svg && isValidSvg(result.label_svg);

  return (
    <View style={at.wrap}>
      {/* Label preview */}
      <AppCard padding={0} style={lg.previewCard}>
        <View style={lg.canvas}>
          {hasSvg ? (
            <SvgXml xml={result!.label_svg} width="100%" height={240} />
          ) : (
            <>
              {/* Header band */}
              <View style={[lg.band, { backgroundColor: accentColor }]}>
                <Text style={lg.bandText}>{displayName.toUpperCase()}</Text>
              </View>

              {/* Body */}
              <View style={lg.body}>
                <Text style={lg.productName}>{displayName}</Text>
                <Text style={lg.subName}>Product Category / Collection</Text>

                <View style={lg.bullets}>
                  {['✓ Key Benefit 1', '✓ Key Benefit 2', '✓ Key Benefit 3'].map(b => (
                    <Text key={b} style={lg.bullet}>{b}</Text>
                  ))}
                </View>

                <View style={lg.materialRow}>
                  <Text style={lg.materialLabel}>Details:</Text>
                  <Text style={lg.materialValue}>Material / Size / Compliance</Text>
                </View>
              </View>

              {/* Barcode placeholder — not a real barcode */}
              <View style={lg.barcodeRow}>
                <View style={lg.barcodePlaceholder}>
                  <Text style={lg.barcodePlaceholderText}>Barcode / UPC placeholder</Text>
                </View>
              </View>
            </>
          )}
        </View>

        {!result && (
          <View style={lg.helperRow}>
            <Text style={lg.helperText}>Your generated label will appear here after generation.</Text>
          </View>
        )}
        <View style={lg.footer}>
          <StatusBadge label={result ? 'Generated' : 'Template Preview'} variant={result ? 'success' : 'info'} />
          <Text style={lg.footerHint}>{result ? (hasSvg ? 'AI-generated SVG' : 'AI-generated') : 'Template Preview'}</Text>
        </View>
      </AppCard>

      {/* Task 6 — compliance disclaimer */}
      <View style={lg.disclaimer}>
        <Text style={lg.disclaimerText}>
          Visual concept only. Product labels, claims, barcodes, and compliance details must be verified before production.
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
        <PrimaryButton label={loading ? 'Generating...' : 'Generate Label'} onPress={onGenerate} icon="≡" loading={loading} style={{ backgroundColor: accentColor, shadowColor: accentColor }} />
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
    color: '#fff', fontSize: 10, fontWeight: '900', letterSpacing: 3,
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
  brandName, loading, result, onGenerate, genError, exportLoading, exportError, onExport, accentColor,
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
                  <Text style={pi.qrUrl}>[Your review link]</Text>
                  <View style={pi.supportRow}>
                    <Text style={pi.supportLabel}>Support: </Text>
                    <Text style={pi.supportEmail}>[Your support email]</Text>
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

const COMPLIANCE_ITEMS = [
  { label: 'Brand name clearly visible',         required: true  },
  { label: 'Product name / description',         required: true  },
  { label: 'Net weight / quantity stated',       required: true  },
  { label: 'Country of origin',                  required: true  },
  { label: 'FNSKU barcode (on unit & packaging)',required: true  },
  { label: 'Suffocation warning (bags/poly)',    required: false },
  { label: 'Choking hazard (if applicable)',     required: false },
  { label: 'Ingredient list (food/supplements)', required: false },
  { label: 'UPC / EAN barcode',                  required: false },
];

function AmazonComplianceCard() {
  return (
    <AppCard style={{ marginTop: 16, gap: 12 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <Text style={{ fontSize: 16 }}>✅</Text>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 13, fontWeight: '800', color: DS.textPrimary }}>Amazon Compliance Checklist</Text>
          <Text style={{ fontSize: 11, color: DS.textMuted }}>Required elements before sending to supplier</Text>
        </View>
      </View>
      {COMPLIANCE_ITEMS.map((item, i) => (
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

// ── Screen ────────────────────────────────────────────────────────────────────

export default function BrandStudioScreen() {
  const { can, increment } = useSubscription();
  const { activeProduct } = useActiveProduct();
  const pipeline = usePipeline();

  const [inputs, setInputs] = useState<BrandInputs>({
    brandName:      '',
    targetAudience: '',
    brandTone:      '',
    style:          'Premium',
  });
  const [assetTab,      setAssetTab]      = useState<AssetTab>('logo');
  const [brandResult,   setBrandResult]   = useState<BrandResult | null>(null);
  const [labelResult,   setLabelResult]   = useState<LabelResult | null>(null);
  const [brandLoading,  setBrandLoading]  = useState(false);
  const [labelLoading,  setLabelLoading]  = useState(false);
  const [brandError,    setBrandError]    = useState('');
  const [labelError,    setLabelError]    = useState('');
  const [exportLoading, setExportLoading] = useState(false);
  const [exportError,   setExportError]   = useState('');
  const [showPaywall,   setShowPaywall]   = useState(false);
  const [history,       setHistory]       = useState<BrandHistoryEntry[]>([]);

  // Load asset history on mount.
  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEYS.brandHistory).then(raw => {
      if (raw) setHistory(JSON.parse(raw));
    }).catch(() => {});
  }, []);

  // Pre-fill brand name from pipeline product or active product.
  useEffect(() => {
    const pipelineTitle = pipeline.activeProduct?.title;
    const fallbackName  = activeProduct?.name;
    const name = pipelineTitle ?? fallbackName;
    if (name) {
      setInputs(prev => prev.brandName.trim() ? prev : { ...prev, brandName: name });
    }
  }, [activeProduct, pipeline.activeProduct]);

  function handleInputChange(key: keyof BrandInputs, value: string) {
    setInputs(prev => ({ ...prev, [key]: value }));
  }

  // Clear stale errors when the user switches asset tabs.
  function handleTabChange(tab: AssetTab) {
    setBrandError('');
    setLabelError('');
    setExportError('');
    setAssetTab(tab);
  }

  const handleGenerateBrand = useCallback(async () => {
    if (!can('brands')) { setShowPaywall(true); return; }
    setBrandLoading(true);
    setBrandError('');
    try {
      const result = await api.createBrand(
        inputs.brandName || 'product',
        inputs.style.toLowerCase(),
        inputs.brandName,
      );
      await increment('brands');
      setBrandResult(result);
      if (result.logo_svg) {
        const entry: BrandHistoryEntry = { brandName: inputs.brandName, style: inputs.style, assetType: 'logo', svg: result.logo_svg, createdAt: new Date().toISOString() };
        saveToHistory(entry).then(() => AsyncStorage.getItem(STORAGE_KEYS.brandHistory).then(r => r && setHistory(JSON.parse(r))));
      }
    } catch (err: any) {
      setBrandError(err?.message ?? "Couldn't generate asset. Please try again.");
    } finally { setBrandLoading(false); }
  }, [inputs, can, increment]);

  const handleGenerateLabel = useCallback(async () => {
    if (!can('brands')) { setShowPaywall(true); return; }
    setLabelLoading(true);
    setLabelError('');
    try {
      const result = await api.createLabel(
        inputs.brandName || 'Brand',
        inputs.targetAudience || 'Product',
        '0.5kg',
        inputs.style.toLowerCase(),
      );
      await increment('brands');
      setLabelResult(result);
      const entries: BrandHistoryEntry[] = [];
      if (result.label_svg)  entries.push({ brandName: inputs.brandName, style: inputs.style, assetType: 'label',  svg: result.label_svg,  createdAt: new Date().toISOString() });
      if (result.insert_svg) entries.push({ brandName: inputs.brandName, style: inputs.style, assetType: 'insert', svg: result.insert_svg, createdAt: new Date().toISOString() });
      for (const e of entries) await saveToHistory(e);
      if (entries.length) AsyncStorage.getItem(STORAGE_KEYS.brandHistory).then(r => r && setHistory(JSON.parse(r)));
    } catch (err: any) {
      setLabelError(err?.message ?? "Couldn't generate asset. Please try again.");
    } finally { setLabelLoading(false); }
  }, [inputs, can, increment]);

  function makeExportHandler(svg: string, filename: string) {
    return async () => {
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

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <PaywallModal visible={showPaywall} onClose={() => setShowPaywall(false)} featureContext="brand" />

      <AppHeader helpKey={ASSET_HELP[assetTab]} />
      <PipelineProgressBar />

      <ScrollView
        style={s.scroll}
        contentContainerStyle={s.content}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Brand identity inputs */}
        <BrandIdentityCard inputs={inputs} onChange={handleInputChange} />

        {/* Asset generator */}
        <SectionHeader
          title="Asset Generator"
          subtitle="Preview and export your brand assets"
          style={s.sectionHead}
        />
        <AssetSegmentedControl value={assetTab} onChange={handleTabChange} />

        {/* Tab description — color follows active tab */}
        {(() => {
          const t = ASSET_TABS.find(t => t.id === assetTab)!;
          return (
            <View style={[s.tabDesc, { backgroundColor: t.colorLight, borderColor: t.color + '40' }]}>
              <Text style={[s.tabDescText, { color: t.color }]}>{ASSET_DESC[assetTab]}</Text>
            </View>
          );
        })()}

        {assetTab === 'logo' && (
          <LogoMakerTab
            brandName={inputs.brandName}
            style={inputs.style}
            loading={brandLoading}
            result={brandResult}
            onGenerate={handleGenerateBrand}
            genError={brandError}
            exportLoading={exportLoading}
            exportError={exportError}
            onExport={handleExportLogo}
            accentColor={ASSET_TABS.find(t => t.id === assetTab)!.color}
          />
        )}
        {assetTab === 'label' && (
          <>
            <LabelGeneratorTab
              brandName={inputs.brandName}
              loading={labelLoading}
              result={labelResult}
              onGenerate={handleGenerateLabel}
              genError={labelError}
              exportLoading={exportLoading}
              exportError={exportError}
              onExport={handleExportLabel}
              accentColor={ASSET_TABS.find(t => t.id === assetTab)!.color}
            />
            <AmazonComplianceCard />
          </>
        )}
        {assetTab === 'insert' && (
          <PackagingInsertTab
            brandName={inputs.brandName}
            loading={labelLoading}
            result={labelResult}
            onGenerate={handleGenerateLabel}
            genError={labelError}
            exportLoading={exportLoading}
            exportError={exportError}
            onExport={handleExportInsert}
            accentColor={ASSET_TABS.find(t => t.id === assetTab)!.color}
          />
        )}

        {/* Recommendations */}
        <SectionHeader title="Brand Tips" style={s.sectionHead} />
        <BrandRecommendationsCard />

        {/* Recent Assets */}
        {history.length > 0 && (
          <>
            <SectionHeader title="Recent Assets" style={s.sectionHead} />
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
                    <TouchableOpacity
                      style={bh.reExport}
                      onPress={makeExportHandler(entry.svg, `siftly-${entry.assetType}`)}
                      activeOpacity={0.75}
                    >
                      <Text style={bh.reExportTxt}>Export</Text>
                    </TouchableOpacity>
                  </View>
                );
              })}
            </AppCard>
          </>
        )}
      </ScrollView>
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
  eyebrow: {
    fontSize: 9, fontWeight: '800', color: DS.pink,
    letterSpacing: 2.5,
  },
  heroTitle: {
    fontSize: 20, fontWeight: '900', color: DS.textPrimary, letterSpacing: -0.7,
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
  tabDesc:     { borderRadius: 12, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 10 },
  tabDescText: { fontSize: 13, lineHeight: 20, fontWeight: '500' },
});
