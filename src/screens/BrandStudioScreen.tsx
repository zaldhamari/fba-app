import React, { useState, useCallback } from 'react';
import {
  ScrollView, StyleSheet, View, Text, TouchableOpacity, ActivityIndicator,
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
import { api, BrandResult } from '../services/api';
import { useSubscription } from '../hooks/useSubscription';
import PaywallModal from '../components/PaywallModal';

// ── SVG helpers ───────────────────────────────────────────────────────────────

function isValidSvg(s: string): boolean {
  return typeof s === 'string' && s.trimStart().startsWith('<svg');
}

async function exportSvg(svg: string, filename: string): Promise<void> {
  const uri = `${FileSystem.cacheDirectory ?? ''}${filename}.svg`;
  await FileSystem.writeAsStringAsync(uri, svg, { encoding: FileSystem.EncodingType.UTF8 });
  const canShare = await Sharing.isAvailableAsync();
  if (canShare) {
    await Sharing.shareAsync(uri, { mimeType: 'image/svg+xml', UTI: 'public.svg-image' });
  }
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
  { id: 'Premium', icon: '✦',  color: '#B45309',        bg: '#FFFBEB'     },
  { id: 'Eco',     icon: '🌿', color: DS.accentDark,    bg: DS.accentLight },
  { id: 'Bold',    icon: '◼',  color: '#0284C7',        bg: '#EFF8FF'     },
  { id: 'Luxury',  icon: '◆',  color: '#7C3AED',        bg: '#F5F0FF'     },
];

const ASSET_TABS: { id: AssetTab; label: string }[] = [
  { id: 'logo',   label: 'Logo Maker'      },
  { id: 'label',  label: 'Label Generator' },
  { id: 'insert', label: 'Packaging Insert' },
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

const SAVED_ASSETS = [
  { id: 'logo',   icon: '✦', label: 'Logo Draft',   date: 'Today',       color: '#7C3AED', bg: '#F5F0FF' },
  { id: 'label',  icon: '≡', label: 'Label Draft',  date: 'Yesterday',   color: '#DB2777', bg: '#FDF2F8' },
  { id: 'insert', icon: '◻', label: 'Insert Draft', date: '2 days ago',  color: DS.accent,  bg: DS.accentLight },
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
            style={[seg.tab, active && seg.tabActive]}
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
  wrap: {
    flexDirection:   'row',
    backgroundColor: DS.bgSubtle,
    borderRadius:    14,
    borderWidth:     1,
    borderColor:     DS.border,
    padding:         3,
    gap:             2,
  },
  tab: {
    flex:            1,
    paddingVertical: 9,
    borderRadius:    11,
    alignItems:      'center',
    paddingHorizontal: 4,
  },
  tabActive: {
    backgroundColor: DS.bgCard,
    shadowColor:     '#0D1B4B',
    shadowOffset:    { width: 0, height: 1 },
    shadowOpacity:   0.07,
    shadowRadius:    4,
    elevation:       2,
  },
  label:       { fontSize: 11, fontWeight: '600', color: DS.textMuted },
  labelActive: { fontSize: 11, fontWeight: '800', color: DS.textPrimary },
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
    backgroundColor: '#FDF2F8',
    alignItems: 'center', justifyContent: 'center',
    flexShrink: 0,
  },
  headerGlyph: { fontSize: 18, color: '#DB2777' },
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
  brandName, style, loading, result, onGenerate, exportLoading, exportError, onExport,
}: {
  brandName:     string;
  style:         StyleOption;
  loading:       boolean;
  result:        BrandResult | null;
  onGenerate:    () => void;
  exportLoading: boolean;
  exportError:   string;
  onExport:      () => void;
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
              <ActivityIndicator size="large" color={DS.indigo} />
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
        <View style={lm.footer}>
          <StatusBadge label={result ? 'Generated' : style + ' Style'} variant={result ? 'success' : 'info'} />
          <Text style={lm.footerHint}>{result ? (hasSvg ? 'AI-generated SVG' : 'AI-generated') : 'Preview'}</Text>
        </View>
      </AppCard>

      {exportError !== '' && (
        <View style={{ backgroundColor: DS.dangerBg, borderRadius: 10, padding: 10 }}>
          <Text style={{ fontSize: 12, color: DS.dangerText }}>{exportError}</Text>
        </View>
      )}

      <View style={at.actions}>
        <PrimaryButton label={loading ? 'Generating...' : 'Generate Logo'} onPress={onGenerate} icon="✦" loading={loading} />
        <SecondaryButton
          label={exportLoading ? 'Exporting...' : 'Export SVG'}
          onPress={onExport}
          icon="↓"
          disabled={!hasSvg}
          loading={exportLoading}
        />
      </View>
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
  footer: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    padding: 16,
  },
  footerHint: { fontSize: 11, color: DS.textMuted },
});

// ── Label Generator tab ───────────────────────────────────────────────────────

function LabelGeneratorTab({
  brandName, loading, result, onGenerate, exportLoading, exportError, onExport,
}: {
  brandName:     string;
  loading:       boolean;
  result:        LabelResult | null;
  onGenerate:    () => void;
  exportLoading: boolean;
  exportError:   string;
  onExport:      () => void;
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
              <View style={lg.band}>
                <Text style={lg.bandText}>{displayName.toUpperCase()}</Text>
              </View>

              {/* Body */}
              <View style={lg.body}>
                <Text style={lg.productName}>{displayName}</Text>
                <Text style={lg.subName}>Professional Kitchen Collection</Text>

                <View style={lg.bullets}>
                  {['✓ Premium stainless steel', '✓ Dishwasher safe', '✓ Ergonomic grip'].map(b => (
                    <Text key={b} style={lg.bullet}>{b}</Text>
                  ))}
                </View>

                <View style={lg.materialRow}>
                  <Text style={lg.materialLabel}>Material:</Text>
                  <Text style={lg.materialValue}>304 Stainless Steel</Text>
                </View>
              </View>

              {/* Barcode placeholder */}
              <View style={lg.barcodeRow}>
                <View style={lg.barcode}>
                  {Array.from({ length: 28 }).map((_, i) => (
                    <View
                      key={i}
                      style={[lg.bar, { width: i % 3 === 0 ? 3 : i % 5 === 0 ? 1 : 2 }]}
                    />
                  ))}
                </View>
                <Text style={lg.barcodeNum}>8 53462 00615 8</Text>
              </View>
            </>
          )}
        </View>

        <View style={lg.footer}>
          <StatusBadge label={result ? 'Generated' : 'Label Draft'} variant={result ? 'success' : 'info'} />
          <Text style={lg.footerHint}>{result ? (hasSvg ? 'AI-generated SVG' : 'AI-generated') : 'Preview'}</Text>
        </View>
      </AppCard>

      {exportError !== '' && (
        <View style={{ backgroundColor: DS.dangerBg, borderRadius: 10, padding: 10 }}>
          <Text style={{ fontSize: 12, color: DS.dangerText }}>{exportError}</Text>
        </View>
      )}

      <View style={at.actions}>
        <PrimaryButton label={loading ? 'Generating...' : 'Generate Label'} onPress={onGenerate} icon="≡" loading={loading} />
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
    backgroundColor: '#DB2777',
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
    alignItems: 'center', gap: 4,
    paddingBottom: 14,
  },
  barcode: { flexDirection: 'row', alignItems: 'flex-end', height: 40, gap: 1 },
  bar:     { height: '100%', backgroundColor: DS.textPrimary },
  barcodeNum: { fontSize: 9, color: DS.textMuted, letterSpacing: 1.5, fontWeight: '500' },
  footer: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    padding: 16,
  },
  footerHint: { fontSize: 11, color: DS.textMuted },
});

// ── Packaging Insert tab ──────────────────────────────────────────────────────

function PackagingInsertTab({
  brandName, loading, result, onGenerate, exportLoading, exportError, onExport,
}: {
  brandName:     string;
  loading:       boolean;
  result:        LabelResult | null;
  onGenerate:    () => void;
  exportLoading: boolean;
  exportError:   string;
  onExport:      () => void;
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
                <Text style={pi.thankYouHeadline}>Thank You!</Text>
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

              {/* QR placeholder */}
              <View style={pi.qrRow}>
                <View style={pi.qrBox}>
                  <View style={pi.qrInner}>
                    <View style={pi.qrCorner} />
                    <View style={[pi.qrCorner, { right: 0, left: undefined }]} />
                    <Text style={pi.qrText}>QR</Text>
                  </View>
                </View>
                <View style={pi.qrInfo}>
                  <Text style={pi.qrLabel}>Scan to leave a review</Text>
                  <Text style={pi.qrUrl}>amazon.com/review/your-product</Text>
                  <View style={pi.supportRow}>
                    <Text style={pi.supportLabel}>Support: </Text>
                    <Text style={pi.supportEmail}>hello@{displayName.toLowerCase().replace(/\s/g, '')}.com</Text>
                  </View>
                </View>
              </View>
            </>
          )}
        </View>

        <View style={pi.footer}>
          <StatusBadge label={result ? 'Generated' : 'Insert Draft'} variant={result ? 'success' : 'info'} />
          <Text style={pi.footerHint}>{result ? (hasSvg ? 'AI-generated SVG' : 'AI-generated') : 'Preview'}</Text>
        </View>
      </AppCard>

      {exportError !== '' && (
        <View style={{ backgroundColor: DS.dangerBg, borderRadius: 10, padding: 10 }}>
          <Text style={{ fontSize: 12, color: DS.dangerText }}>{exportError}</Text>
        </View>
      )}

      <View style={at.actions}>
        <PrimaryButton label={loading ? 'Generating...' : 'Generate Insert'} onPress={onGenerate} icon="◻" loading={loading} />
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
  thankYouHeadline: { fontSize: 22, fontWeight: '900', color: DS.accent, letterSpacing: -0.6 },
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
    backgroundColor: DS.bgCard,
    borderWidth: 1.5, borderColor: DS.border,
    alignItems: 'center', justifyContent: 'center',
    flexShrink: 0,
  },
  qrInner: {
    width: 44, height: 44, position: 'relative',
    alignItems: 'center', justifyContent: 'center',
  },
  qrCorner: {
    position: 'absolute', top: 0, left: 0,
    width: 12, height: 12,
    borderTopWidth: 3, borderLeftWidth: 3,
    borderColor: DS.textPrimary,
  },
  qrText:  { fontSize: 10, fontWeight: '900', color: DS.textMuted },
  qrInfo:  { flex: 1, gap: 5 },
  qrLabel: { fontSize: 12, fontWeight: '700', color: DS.textPrimary },
  qrUrl:   { fontSize: 10, color: DS.indigo, fontWeight: '500' },
  supportRow: { flexDirection: 'row', alignItems: 'center' },
  supportLabel: { fontSize: 10, color: DS.textMuted },
  supportEmail: { fontSize: 10, color: DS.accent, fontWeight: '600' },
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
    backgroundColor: '#FFFBEB',
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

// ── Saved Assets section ──────────────────────────────────────────────────────

function SavedAssetsSection() {
  return (
    <View style={sa.wrap}>
      {SAVED_ASSETS.map(asset => (
        <TouchableOpacity
          key={asset.id}
          style={sa.card}
          activeOpacity={0.8}
          accessibilityRole="button"
          accessibilityLabel={`Open ${asset.label}`}
        >
          <View style={[sa.iconBox, { backgroundColor: asset.bg }]}>
            <Text style={[sa.icon, { color: asset.color }]}>{asset.icon}</Text>
          </View>
          <Text style={sa.label} numberOfLines={1}>{asset.label}</Text>
          <Text style={sa.date}>{asset.date}</Text>
          <View style={sa.openBtn}>
            <Text style={sa.openBtnText}>Open →</Text>
          </View>
        </TouchableOpacity>
      ))}
    </View>
  );
}

const sa = StyleSheet.create({
  wrap: { flexDirection: 'row', gap: 10 },
  card: {
    flex:            1,
    backgroundColor: DS.bgCard,
    borderWidth:     1,
    borderColor:     DS.border,
    borderRadius:    18,
    padding:         14,
    alignItems:      'center',
    gap:             8,
    shadowColor:     '#0D1B4B',
    shadowOffset:    { width: 0, height: 2 },
    shadowOpacity:   0.05,
    shadowRadius:    8,
    elevation:       2,
  },
  iconBox: {
    width: 44, height: 44, borderRadius: 14,
    alignItems: 'center', justifyContent: 'center',
  },
  icon:     { fontSize: 20, fontWeight: '800' },
  label:    { fontSize: 11, fontWeight: '700', color: DS.textPrimary, textAlign: 'center' },
  date:     { fontSize: 9,  fontWeight: '500', color: DS.textMuted },
  openBtn: {
    backgroundColor: DS.bgSubtle, borderRadius: DS.radiusBadge,
    paddingHorizontal: 10, paddingVertical: 4,
  },
  openBtnText: { fontSize: 10, fontWeight: '700', color: DS.textSecondary },
});

// ── Screen ────────────────────────────────────────────────────────────────────

export default function BrandStudioScreen() {
  const { can, increment } = useSubscription();

  const [inputs, setInputs] = useState<BrandInputs>({
    brandName:      'Zenovex Kitchen',
    targetAudience: 'Home cooks aged 25–45',
    brandTone:      'Friendly, trustworthy, premium',
    style:          'Premium',
  });
  const [assetTab,      setAssetTab]      = useState<AssetTab>('logo');
  const [brandResult,   setBrandResult]   = useState<BrandResult | null>(null);
  const [labelResult,   setLabelResult]   = useState<LabelResult | null>(null);
  const [brandLoading,  setBrandLoading]  = useState(false);
  const [labelLoading,  setLabelLoading]  = useState(false);
  const [exportLoading, setExportLoading] = useState(false);
  const [exportError,   setExportError]   = useState('');
  const [showPaywall,   setShowPaywall]   = useState(false);

  function handleInputChange(key: keyof BrandInputs, value: string) {
    setInputs(prev => ({ ...prev, [key]: value }));
  }

  const handleGenerateBrand = useCallback(async () => {
    if (!can('brands')) { setShowPaywall(true); return; }
    setBrandLoading(true);
    try {
      const result = await api.createBrand(
        inputs.brandName || 'product',
        inputs.style.toLowerCase(),
        inputs.brandName,
      );
      await increment('brands');
      setBrandResult(result);
    } catch { /* silent — preview remains visible */ }
    finally { setBrandLoading(false); }
  }, [inputs, can, increment]);

  const handleGenerateLabel = useCallback(async () => {
    if (!can('brands')) { setShowPaywall(true); return; }
    setLabelLoading(true);
    try {
      const result = await api.createLabel(
        inputs.brandName || 'Brand',
        inputs.targetAudience || 'Product',
        '0.5kg',
        inputs.style.toLowerCase(),
      );
      await increment('brands');
      setLabelResult(result);
    } catch { /* silent */ }
    finally { setLabelLoading(false); }
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

      {/* ── Pinned header ─────────────────────────────────── */}
      <View style={s.header}>
        <Text style={s.eyebrow}>BRAND STUDIO</Text>
        <Text style={s.heroTitle}>Build Your Product Brand</Text>
        <Text style={s.heroSub}>
          Generate logos, labels, inserts, and packaging concepts before launch.
        </Text>
      </View>

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
        <AssetSegmentedControl value={assetTab} onChange={setAssetTab} />

        {assetTab === 'logo' && (
          <LogoMakerTab
            brandName={inputs.brandName}
            style={inputs.style}
            loading={brandLoading}
            result={brandResult}
            onGenerate={handleGenerateBrand}
            exportLoading={exportLoading}
            exportError={exportError}
            onExport={handleExportLogo}
          />
        )}
        {assetTab === 'label' && (
          <LabelGeneratorTab
            brandName={inputs.brandName}
            loading={labelLoading}
            result={labelResult}
            onGenerate={handleGenerateLabel}
            exportLoading={exportLoading}
            exportError={exportError}
            onExport={handleExportLabel}
          />
        )}
        {assetTab === 'insert' && (
          <PackagingInsertTab
            brandName={inputs.brandName}
            loading={labelLoading}
            result={labelResult}
            onGenerate={handleGenerateLabel}
            exportLoading={exportLoading}
            exportError={exportError}
            onExport={handleExportInsert}
          />
        )}

        {/* Recommendations */}
        <SectionHeader title="Brand Tips" style={s.sectionHead} />
        <BrandRecommendationsCard />

        {/* Saved assets */}
        <SectionHeader
          title="Saved Assets"
          actionLabel="View All"
          onAction={() => {}}
          style={s.sectionHead}
        />
        <SavedAssetsSection />
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
    fontSize: 9, fontWeight: '800', color: '#DB2777',
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
