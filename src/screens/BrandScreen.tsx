import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity,
  ScrollView, ActivityIndicator, Share,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, spacing, radius, shadow } from '../theme';
import { api, BrandResult } from '../services/api';
import { useSubscription } from '../hooks/useSubscription';
import PaywallModal from '../components/PaywallModal';
import KeywordsScreen from './KeywordsScreen';
import {
  SegmentedControl, InsightCard, MetricRow, SectionCard,
  QuickActionCard, EmptyState, SECTION_COLORS,
} from '../components/ui';
import type { InsightVariant } from '../components/ui';
import * as Clipboard from 'expo-clipboard';

// ─── Constants ────────────────────────────────────────────────────────────────
const BRAND_COLOR = '#DB2777';
type Mode = 'brand' | 'keywords' | 'listing';
const STYLES = ['minimal', 'modern', 'premium', 'playful'] as const;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function extractSvgColors(svg: string): string[] {
  const hexes = svg.match(/#[0-9A-Fa-f]{6}/g) ?? [];
  const unique = [...new Set(hexes)].filter(c => {
    const l = c.toLowerCase();
    return l !== '#000000' && l !== '#ffffff';
  });
  return unique.slice(0, 4);
}

interface BrandAnalysis {
  memorability: number;
  distinctiveness: number;
  premium: number;
  taglineStrength: number;
}

function analyzeBrand(result: BrandResult): BrandAnalysis {
  const name    = result.brand_name;
  const tagline = result.tagline;
  const premiumWords = ['pro', 'premium', 'ultra', 'elite', 'luxe', 'peak', 'apex', 'prime', 'pure', 'craft'];
  const hasPremium = premiumWords.some(
    w => name.toLowerCase().includes(w) || tagline.toLowerCase().includes(w),
  );
  const styleBoost  = result.style === 'premium' ? 15 : result.style === 'modern' ? 8 : 0;
  const commonWords = ['the', 'best', 'good', 'great', 'nice', 'simple', 'basic'];
  const isCommon    = commonWords.some(w => name.toLowerCase() === w);
  return {
    memorability:    Math.min(100, Math.max(30, 110 - name.length * 7)),
    distinctiveness: isCommon ? 35 : Math.min(100, name.length <= 6 ? 90 : name.length <= 9 ? 75 : 58),
    premium:         Math.min(100, (hasPremium ? 82 : 60) + styleBoost),
    taglineStrength: Math.min(100, Math.max(30, Math.round(tagline.length * 2.2))),
  };
}

function listingScore(result: BrandResult): { score: number; checks: { label: string; pass: boolean }[] } {
  const { title, bullet_points, description, backend_keywords } = result.listing;
  const checks = [
    { label: 'Title 80+ chars',        pass: title.length >= 80 },
    { label: '5 bullet points',        pass: bullet_points.length >= 5 },
    { label: 'Description 300+ chars', pass: description.length >= 300 },
    { label: '5+ backend keywords',    pass: backend_keywords.length >= 5 },
    { label: 'Title under 200 chars',  pass: title.length <= 200 },
  ];
  return { score: Math.round((checks.filter(c => c.pass).length / checks.length) * 100), checks };
}

function CharCount({ current, max, warn }: { current: number; max: number; warn?: number }) {
  const over  = current > max;
  const near  = warn ? current >= warn : false;
  const color = over ? colors.red : near ? colors.amber : colors.textMuted;
  return <Text style={[cc.text, { color }]}>{current}/{max}</Text>;
}
const cc = StyleSheet.create({ text: { fontSize: 10, fontWeight: '600' as const } });

// ─── Logo Card ────────────────────────────────────────────────────────────────

function LogoCard({ result, copiedKey, onCopy, onShare }: {
  result: BrandResult;
  copiedKey: string;
  onCopy: (text: string, key: string) => void;
  onShare: () => void;
}) {
  const [darkBg, setDarkBg] = useState(false);
  const svgColors = extractSvgColors(result.logo_svg);
  const accent    = svgColors[0] || BRAND_COLOR;
  const initial   = result.brand_name.slice(0, 2).toUpperCase();

  return (
    <View style={lc.card}>
      <View style={lc.header}>
        <Text style={lc.eyebrow}>LOGO PREVIEW</Text>
        <TouchableOpacity onPress={() => setDarkBg(v => !v)} style={lc.toggleBtn}>
          <Text style={lc.toggleText}>{darkBg ? '☀ Light' : '◐ Dark'}</Text>
        </TouchableOpacity>
      </View>

      {/* Preview canvas */}
      <View style={[lc.canvas, { backgroundColor: darkBg ? '#0D1B4B' : '#FAFAFA' }]}>
        <View style={lc.logoWrap}>
          <View style={[lc.circle, { backgroundColor: accent }]}>
            <Text style={lc.initial}>{initial}</Text>
          </View>
          <Text style={[lc.brandName, { color: darkBg ? '#FFFFFF' : accent }]}>
            {result.brand_name}
          </Text>
          {!!result.tagline && (
            <Text style={[lc.taglinePrev, { color: darkBg ? 'rgba(255,255,255,0.6)' : colors.textMuted }]}>
              {result.tagline}
            </Text>
          )}
          {svgColors.length > 0 && (
            <View style={lc.palette}>
              {svgColors.map((c, i) => (
                <View key={i} style={[lc.paletteDot, { backgroundColor: c }]} />
              ))}
            </View>
          )}
        </View>
      </View>

      {/* SVG hint */}
      <Text style={lc.svgHint} numberOfLines={1}>
        {result.logo_svg.length > 0 ? result.logo_svg.slice(0, 70) + '…' : 'No SVG data'}
      </Text>

      {/* Actions */}
      <View style={lc.actions}>
        <TouchableOpacity style={lc.actionBtn} onPress={() => onCopy(result.brand_name, 'logo_name')}>
          <Text style={lc.actionText}>{copiedKey === 'logo_name' ? '✓ Copied' : 'Copy Name'}</Text>
        </TouchableOpacity>
        <View style={lc.actionDiv} />
        <TouchableOpacity style={lc.actionBtn} onPress={onShare}>
          <Text style={lc.actionText}>Share SVG →</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const lc = StyleSheet.create({
  card: {
    backgroundColor: colors.bgCard,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: 'rgba(219,39,119,0.22)',
    overflow: 'hidden',
    ...shadow.sm,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  eyebrow: { fontSize: 8, fontWeight: '800' as const, color: BRAND_COLOR, letterSpacing: 2 },
  toggleBtn: {
    backgroundColor: colors.bgElevated,
    borderRadius: radius.full,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: colors.border,
  },
  toggleText: { fontSize: 10, fontWeight: '700' as const, color: colors.textSecondary },
  canvas: {
    minHeight: 190,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  logoWrap:  { alignItems: 'center', gap: spacing.sm },
  circle: {
    width: 72, height: 72, borderRadius: 36,
    alignItems: 'center', justifyContent: 'center',
    ...shadow.sm,
  },
  initial:   { fontSize: 26, fontWeight: '900' as const, color: '#FFFFFF', letterSpacing: -1 },
  brandName: { fontSize: 24, fontWeight: '900' as const, letterSpacing: -0.8, textAlign: 'center' as const },
  taglinePrev: { fontSize: 12, textAlign: 'center' as const, fontStyle: 'italic' as const, maxWidth: 240 },
  palette:   { flexDirection: 'row', gap: 6, marginTop: 4 },
  paletteDot:{ width: 12, height: 12, borderRadius: 6 },
  svgHint: {
    fontSize: 9,
    color: colors.textMuted,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    fontFamily: 'monospace',
    backgroundColor: colors.bgElevated,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  actions:   { flexDirection: 'row' },
  actionBtn: { flex: 1, alignItems: 'center', paddingVertical: spacing.sm + 2 },
  actionDiv: { width: 1, backgroundColor: colors.border },
  actionText:{ fontSize: 12, fontWeight: '700' as const, color: BRAND_COLOR },
});

// ─── Label Card ───────────────────────────────────────────────────────────────

function LabelCard({ labelSvg, insertSvg, brandName, onShareLabel, onShareInsert }: {
  labelSvg: string;
  insertSvg: string;
  brandName: string;
  onShareLabel: () => void;
  onShareInsert: () => void;
}) {
  const labelColors = extractSvgColors(labelSvg);
  const labelAccent = labelColors[0] || BRAND_COLOR;

  return (
    <View style={{ gap: spacing.sm }}>
      {/* Label */}
      <View style={ll.card}>
        <Text style={ll.eyebrow}>PRODUCT LABEL</Text>
        <View style={[ll.canvas, { backgroundColor: labelAccent + '10' }]}>
          <View style={[ll.mock, { borderColor: labelAccent }]}>
            <Text style={[ll.mockTitle, { color: labelAccent }]}>{brandName}</Text>
            <Text style={ll.mockSub}>Product Label · SVG Asset</Text>
          </View>
        </View>
        <TouchableOpacity style={ll.shareBtn} onPress={onShareLabel}>
          <Text style={ll.shareBtnText}>Share Label SVG →</Text>
        </TouchableOpacity>
      </View>

      {/* Insert */}
      {!!insertSvg && (
        <View style={ll.card}>
          <Text style={ll.eyebrow}>PACKAGE INSERT</Text>
          <View style={[ll.canvas, { backgroundColor: labelAccent + '08' }]}>
            <View style={[ll.mock, { borderColor: labelAccent, borderStyle: 'dashed' }]}>
              <Text style={[ll.mockTitle, { color: labelAccent, fontSize: 16 }]}>{brandName}</Text>
              <Text style={ll.mockSub}>Package Insert · SVG Asset</Text>
            </View>
          </View>
          <TouchableOpacity style={ll.shareBtn} onPress={onShareInsert}>
            <Text style={ll.shareBtnText}>Share Insert SVG →</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const ll = StyleSheet.create({
  card: {
    backgroundColor: colors.bgCard,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
    ...shadow.sm,
  },
  eyebrow: {
    fontSize: 8, fontWeight: '800' as const, color: BRAND_COLOR, letterSpacing: 2,
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  canvas: {
    minHeight: 120,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  mock: {
    borderWidth: 1.5, borderRadius: radius.md,
    padding: spacing.md,
    alignItems: 'center',
    gap: spacing.xs,
    minWidth: 160,
  },
  mockTitle: { fontSize: 20, fontWeight: '900' as const, letterSpacing: -0.8 },
  mockSub:   { fontSize: 9, color: colors.textMuted, letterSpacing: 1, fontWeight: '600' as const },
  shareBtn:  { paddingVertical: spacing.sm + 2, alignItems: 'center' },
  shareBtnText: { fontSize: 12, fontWeight: '700' as const, color: BRAND_COLOR },
});

// ─── Brand Tab ────────────────────────────────────────────────────────────────

function BrandTab() {
  const [product,      setProduct]      = useState('');
  const [brandName,    setBrandName]    = useState('');
  const [style,        setStyle]        = useState<typeof STYLES[number]>('minimal');
  const [result,       setResult]       = useState<BrandResult | null>(null);
  const [selectedName, setSelectedName] = useState('');
  const [loading,      setLoading]      = useState(false);
  const [error,        setError]        = useState('');
  const [showPaywall,  setShowPaywall]  = useState(false);
  const [copiedKey,    setCopiedKey]    = useState('');
  const { can, increment } = useSubscription();

  // Label state
  const [labelProduct, setLabelProduct] = useState('');
  const [labelWeight,  setLabelWeight]  = useState('500g');
  const [labelResult,  setLabelResult]  = useState<{ label_svg: string; insert_svg: string } | null>(null);
  const [labelLoading, setLabelLoading] = useState(false);

  async function generate() {
    if (!product.trim()) return;
    if (!can('brands')) { setShowPaywall(true); return; }
    setLoading(true); setError(''); setResult(null); setLabelResult(null);
    try {
      const data = await api.createBrand(product.trim(), style, brandName.trim());
      setResult(data);
      setSelectedName(data.brand_name);
      setLabelProduct(product.trim());
      await increment('brands');
    } catch (e: any) { setError(e.message || 'Generation failed.'); }
    finally { setLoading(false); }
  }

  async function generateLabel() {
    if (!result || !labelProduct.trim()) return;
    setLabelLoading(true);
    try {
      const data = await api.createLabel(
        selectedName || result.brand_name,
        labelProduct.trim(),
        labelWeight,
        result.style,
      );
      setLabelResult(data);
    } catch { /* silent — show nothing */ }
    finally { setLabelLoading(false); }
  }

  function copy(text: string, key: string) {
    Clipboard.setStringAsync(text).catch(() => {});
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(''), 2000);
  }

  async function handleShareLogo() {
    if (!result?.logo_svg) return;
    try { await Share.share({ message: result.logo_svg, title: `${result.brand_name} Logo SVG` }); }
    catch { /* user cancelled */ }
  }

  async function handleShareLabel() {
    if (!labelResult?.label_svg) return;
    try { await Share.share({ message: labelResult.label_svg, title: `${result?.brand_name ?? 'Brand'} Label SVG` }); }
    catch { /* user cancelled */ }
  }

  async function handleShareInsert() {
    if (!labelResult?.insert_svg) return;
    try { await Share.share({ message: labelResult.insert_svg, title: `${result?.brand_name ?? 'Brand'} Insert SVG` }); }
    catch { /* user cancelled */ }
  }

  async function handleCopyListingKit() {
    if (!result) return;
    const kit = [
      `TITLE:\n${result.listing.title}`,
      `\nBULLET POINTS:\n${result.listing.bullet_points.map((b, i) => `${i + 1}. ${b}`).join('\n')}`,
      `\nDESCRIPTION:\n${result.listing.description}`,
      `\nBACKEND KEYWORDS:\n${result.listing.backend_keywords.join(', ')}`,
    ].join('');
    try { await Share.share({ message: kit, title: 'Siftly Listing Kit' }); }
    catch { /* user cancelled */ }
  }

  const analysis = result ? analyzeBrand(result) : null;
  const overallScore = analysis
    ? Math.round((analysis.memorability + analysis.distinctiveness + analysis.premium) / 3)
    : 0;
  const analysisVariant: InsightVariant =
    overallScore >= 75 ? 'success' : overallScore >= 55 ? 'tip' : 'warning';
  const analysisText = !analysis ? '' :
    overallScore >= 75
      ? `"${result!.brand_name}" is highly memorable, distinctive, and positions well for premium markets. Strong kit ready to launch.`
      : overallScore >= 55
      ? `Good foundation. Consider a sharper tagline and emphasizing your unique angle in listing copy.`
      : `Room to grow — a shorter, punchier name and stronger tagline will improve buyer recognition.`;

  return (
    <ScrollView contentContainerStyle={b.scroll} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
      <PaywallModal visible={showPaywall} onClose={() => setShowPaywall(false)} featureContext="brands" />

      {/* ── Inputs ── */}
      <View style={b.inputGroup}>
        <Text style={b.fieldLabel}>PRODUCT TYPE</Text>
        <TextInput
          style={b.input} value={product} onChangeText={setProduct}
          placeholder="Enter your product type…"
          placeholderTextColor={colors.textMuted} returnKeyType="next" autoCorrect={false}
        />
        <Text style={b.fieldHint}>Be specific — "non-slip yoga mat" beats "yoga"</Text>
      </View>

      <View style={b.inputGroup}>
        <Text style={b.fieldLabel}>YOUR BRAND NAME</Text>
        <TextInput
          style={b.input} value={brandName} onChangeText={setBrandName}
          placeholder="Leave blank to generate 5 options…"
          placeholderTextColor={colors.textMuted} returnKeyType="done" autoCorrect={false}
        />
      </View>

      <View style={b.styleSection}>
        <Text style={b.fieldLabel}>BRAND STYLE</Text>
        <View style={b.styleRow}>
          {STYLES.map(st => (
            <TouchableOpacity
              key={st}
              style={[b.styleChip, style === st && b.styleChipActive]}
              onPress={() => setStyle(st)}
            >
              <Text style={[b.styleChipText, style === st && b.styleChipTextActive]}>
                {st.charAt(0).toUpperCase() + st.slice(1)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <TouchableOpacity style={[b.btn, loading && { opacity: 0.5 }]} onPress={generate} disabled={loading} activeOpacity={0.8}>
        {loading
          ? <ActivityIndicator color={colors.bg} size="small" />
          : <Text style={b.btnText}>Generate Brand Kit ✦</Text>
        }
      </TouchableOpacity>

      {!!error && <Text style={b.errorText}>{error}</Text>}

      {/* ── Results ── */}
      {result && (
        <View style={b.results}>

          {/* Logo Visualizer */}
          <LogoCard
            result={result}
            copiedKey={copiedKey}
            onCopy={copy}
            onShare={handleShareLogo}
          />

          {/* Brand Analysis metrics */}
          <MetricRow metrics={[
            { label: 'Memorability',    value: analysis!.memorability,    icon: '◈', color: BRAND_COLOR },
            { label: 'Distinctiveness', value: analysis!.distinctiveness, icon: '✦', color: '#8B5CF6' },
            { label: 'Premium Tone',    value: analysis!.premium,         icon: '◎', color: '#D97706' },
          ]} />

          <InsightCard
            variant={analysisVariant}
            icon="✦"
            label="BRAND ASSESSMENT"
            text={analysisText}
            animated
          />

          {/* Brand Identity */}
          <SectionCard eyebrow="BRAND IDENTITY" accentColor={BRAND_COLOR} showAccentBorder>
            {brandName.trim() ? (
              <Text style={b.bigName}>{result.brand_name}</Text>
            ) : (
              <View style={b.namesGrid}>
                {result.name_options.map((name, i) => (
                  <TouchableOpacity
                    key={i}
                    style={[b.nameChip, selectedName === name && b.nameChipActive]}
                    onPress={() => setSelectedName(name)}
                  >
                    <Text style={[b.nameChipText, selectedName === name && b.nameChipTextActive]}>{name}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}
            <Text style={b.tagline}>"{result.tagline}"</Text>
          </SectionCard>

          {/* Quick Assets */}
          <SectionCard eyebrow="BRAND ASSETS" accentColor={BRAND_COLOR} showAccentBorder gap={spacing.xs}>
            <QuickActionCard
              icon="✦"
              label="Share Logo SVG"
              sublabel="Send the raw SVG to any app"
              color={BRAND_COLOR}
              layout="row"
              onPress={handleShareLogo}
            />
            <QuickActionCard
              icon="◈"
              label="Copy Brand Name"
              sublabel={copiedKey === 'qa_name' ? '✓ Copied!' : (selectedName || result.brand_name)}
              color={BRAND_COLOR}
              layout="row"
              onPress={() => copy(selectedName || result.brand_name, 'qa_name')}
            />
            <QuickActionCard
              icon="≋"
              label="Copy Tagline"
              sublabel={copiedKey === 'qa_tag' ? '✓ Copied!' : result.tagline}
              color="#8B5CF6"
              layout="row"
              onPress={() => copy(result.tagline, 'qa_tag')}
            />
            <QuickActionCard
              icon="≡"
              label="Export Listing Kit"
              sublabel="Title, bullets, keywords as text"
              color={SECTION_COLORS.pilot}
              layout="row"
              onPress={handleCopyListingKit}
            />
          </SectionCard>

          {/* Label Generator */}
          <SectionCard eyebrow="LABEL STUDIO" accentColor={BRAND_COLOR} showAccentBorder>
            <Text style={b.sectionHint}>Generate a product label and package insert for printing.</Text>
            <View style={b.labelRow}>
              <View style={{ flex: 2 }}>
                <Text style={b.fieldLabel}>PRODUCT NAME</Text>
                <TextInput
                  style={b.input}
                  value={labelProduct}
                  onChangeText={setLabelProduct}
                  placeholder={product || 'Product name…'}
                  placeholderTextColor={colors.textMuted}
                  autoCorrect={false}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={b.fieldLabel}>WEIGHT</Text>
                <TextInput
                  style={b.input}
                  value={labelWeight}
                  onChangeText={setLabelWeight}
                  placeholder="500g"
                  placeholderTextColor={colors.textMuted}
                />
              </View>
            </View>
            <TouchableOpacity
              style={[b.labelBtn, labelLoading && { opacity: 0.5 }]}
              onPress={generateLabel}
              disabled={labelLoading}
              activeOpacity={0.8}
            >
              {labelLoading
                ? <ActivityIndicator color={BRAND_COLOR} size="small" />
                : <Text style={b.labelBtnText}>Generate Label & Insert ⬡</Text>
              }
            </TouchableOpacity>
          </SectionCard>

          {/* Label Preview */}
          {labelResult && (
            <LabelCard
              labelSvg={labelResult.label_svg}
              insertSvg={labelResult.insert_svg}
              brandName={selectedName || result.brand_name}
              onShareLabel={handleShareLabel}
              onShareInsert={handleShareInsert}
            />
          )}

          {/* Generated Keywords */}
          {result.generated_keywords.length > 0 && (
            <SectionCard eyebrow={`BRAND KEYWORDS (${result.generated_keywords.length})`} accentColor="#D97706" showAccentBorder>
              <View style={b.tagCloud}>
                {result.generated_keywords.map((kw, i) => (
                  <View key={i} style={b.tag}>
                    <Text style={b.tagText}>{kw}</Text>
                  </View>
                ))}
              </View>
            </SectionCard>
          )}

          {/* Listing blocks */}
          {[
            { key: 'title', label: 'PRODUCT TITLE',   hint: 'Starts ranking immediately on save.',      text: result.listing.title },
            { key: 'desc',  label: 'DESCRIPTION',      hint: 'Tell the story — buyers read this.',       text: result.listing.description },
            { key: 'kw',    label: 'BACKEND KEYWORDS', hint: 'Hidden from buyers but indexed by Amazon.', text: result.listing.backend_keywords.join(', ') },
          ].map(({ key, label, hint, text }) => (
            <View key={key} style={b.block}>
              <View style={b.blockHeader}>
                <Text style={b.blockLabel}>{label}</Text>
                <TouchableOpacity onPress={() => copy(text, key)}>
                  <Text style={b.copyBtn}>{copiedKey === key ? '✓ Copied' : 'Copy'}</Text>
                </TouchableOpacity>
              </View>
              <Text style={b.blockHint}>{hint}</Text>
              <Text style={b.copyText}>{text}</Text>
            </View>
          ))}

          {/* Bullet Points */}
          <View style={b.block}>
            <Text style={b.blockLabel}>BULLET POINTS</Text>
            {result.listing.bullet_points.map((bullet, i) => (
              <View key={i} style={b.bullet}>
                <Text style={b.bulletDash}>—</Text>
                <Text style={b.bulletText}>{bullet}</Text>
              </View>
            ))}
          </View>

        </View>
      )}

      {!result && !loading && (
        <EmptyState
          icon="✦"
          title="Build your brand identity"
          subtitle="Enter a product type to generate a complete brand kit — name, logo, colors, and listing copy."
          iconBg="rgba(219,39,119,0.09)"
          iconSize={72}
          style={b.emptyState}
        />
      )}
    </ScrollView>
  );
}

// ─── Listing Tab ──────────────────────────────────────────────────────────────

function ListingTab() {
  const [product,     setProduct]     = useState('');
  const [brandName,   setBrandName]   = useState('');
  const [result,      setResult]      = useState<BrandResult | null>(null);
  const [loading,     setLoading]     = useState(false);
  const [error,       setError]       = useState('');
  const [showPaywall, setShowPaywall] = useState(false);
  const [copiedKey,   setCopiedKey]   = useState('');
  const { can } = useSubscription();

  async function generate() {
    if (!product.trim()) return;
    if (!can('brand')) { setShowPaywall(true); return; }
    setLoading(true); setError(''); setResult(null);
    try {
      const data = await api.createBrand(product.trim(), 'modern', brandName.trim());
      setResult(data);
    } catch (e: any) { setError(e.message || 'Generation failed.'); }
    finally { setLoading(false); }
  }

  function copy(text: string, key: string) {
    Clipboard.setStringAsync(text).catch(() => {});
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(''), 2000);
  }

  const scored     = result ? listingScore(result) : null;
  const scoreColor = scored
    ? (scored.score >= 80 ? colors.green : scored.score >= 60 ? colors.amber : colors.red)
    : colors.textMuted;
  const scoreVariant: InsightVariant = !scored ? 'default'
    : scored.score >= 80 ? 'success'
    : scored.score >= 60 ? 'tip'
    : 'warning';
  const scoreText = !scored ? ''
    : scored.score >= 80
      ? 'Excellent listing structure — all major Amazon ranking signals are covered.'
      : scored.score >= 60
      ? 'Good foundation. Expand the description and add more backend keywords to rank higher.'
      : 'Listing needs work. Ensure title is 80+ chars, add 5 bullet points, and expand the description.';

  return (
    <ScrollView contentContainerStyle={b.scroll} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
      <PaywallModal visible={showPaywall} onClose={() => setShowPaywall(false)} featureContext="brands" />

      <View style={b.inputGroup}>
        <Text style={b.fieldLabel}>PRODUCT</Text>
        <TextInput
          style={b.input} value={product} onChangeText={setProduct}
          placeholder="Enter your product type…"
          placeholderTextColor={colors.textMuted} returnKeyType="next" autoCorrect={false}
        />
      </View>

      <View style={b.inputGroup}>
        <Text style={b.fieldLabel}>BRAND NAME (optional)</Text>
        <TextInput
          style={b.input} value={brandName} onChangeText={setBrandName}
          placeholder="Your brand name…"
          placeholderTextColor={colors.textMuted} returnKeyType="done" autoCorrect={false}
        />
      </View>

      <TouchableOpacity
        style={[b.btn, { backgroundColor: SECTION_COLORS.pilot }, loading && { opacity: 0.5 }]}
        onPress={generate}
        disabled={loading}
        activeOpacity={0.8}
      >
        {loading
          ? <ActivityIndicator color={colors.bg} size="small" />
          : <Text style={b.btnText}>Build Listing ≡</Text>
        }
      </TouchableOpacity>

      {!!error && <Text style={b.errorText}>{error}</Text>}

      {result && scored && (
        <View style={b.results}>

          {/* Metric summary */}
          <MetricRow metrics={[
            { label: 'Listing Score', value: `${scored.score}/100`,                      icon: '◈', color: scoreColor, tinted: true },
            { label: 'Bullets',       value: `${result.listing.bullet_points.length}/5`, icon: '≡', color: SECTION_COLORS.pilot },
            { label: 'Keywords',      value: result.listing.backend_keywords.length,      icon: '≋', color: '#D97706' },
          ]} />

          <InsightCard
            variant={scoreVariant}
            icon="◈"
            label="LISTING QUALITY"
            text={scoreText}
            animated
          />

          {/* Quality checks */}
          <SectionCard eyebrow="QUALITY CHECKS" accentColor={SECTION_COLORS.pilot} showAccentBorder>
            {scored.checks.map((c, i) => (
              <View key={i} style={b.scoreCheck}>
                <Text style={{ color: c.pass ? colors.green : colors.textMuted, fontWeight: '800', fontSize: 12 }}>
                  {c.pass ? '✓' : '✗'}
                </Text>
                <Text style={[b.scoreCheckText, { color: c.pass ? colors.textPrimary : colors.textMuted }]}>
                  {c.label}
                </Text>
              </View>
            ))}
          </SectionCard>

          {/* Title */}
          <View style={b.block}>
            <View style={b.blockHeader}>
              <Text style={b.blockLabel}>TITLE</Text>
              <View style={{ flexDirection: 'row', gap: spacing.sm, alignItems: 'center' }}>
                <CharCount current={result.listing.title.length} max={200} warn={150} />
                <TouchableOpacity onPress={() => copy(result.listing.title, 'title')}>
                  <Text style={b.copyBtn}>{copiedKey === 'title' ? '✓ Copied' : 'Copy'}</Text>
                </TouchableOpacity>
              </View>
            </View>
            <Text style={b.copyText}>{result.listing.title}</Text>
          </View>

          {/* Bullets */}
          <View style={b.block}>
            <Text style={b.blockLabel}>BULLET POINTS ({result.listing.bullet_points.length}/5)</Text>
            {result.listing.bullet_points.map((bullet, i) => (
              <View key={i} style={b.listingBullet}>
                <View style={b.listingBulletHeader}>
                  <Text style={b.bulletNum}>#{i + 1}</Text>
                  <CharCount current={bullet.length} max={500} warn={400} />
                  <TouchableOpacity onPress={() => copy(bullet, `b${i}`)}>
                    <Text style={b.copyBtn}>{copiedKey === `b${i}` ? '✓' : 'Copy'}</Text>
                  </TouchableOpacity>
                </View>
                <Text style={b.bulletText}>{bullet}</Text>
              </View>
            ))}
          </View>

          {/* Description */}
          <View style={b.block}>
            <View style={b.blockHeader}>
              <Text style={b.blockLabel}>DESCRIPTION</Text>
              <View style={{ flexDirection: 'row', gap: spacing.sm, alignItems: 'center' }}>
                <CharCount current={result.listing.description.length} max={2000} warn={1500} />
                <TouchableOpacity onPress={() => copy(result.listing.description, 'desc')}>
                  <Text style={b.copyBtn}>{copiedKey === 'desc' ? '✓ Copied' : 'Copy'}</Text>
                </TouchableOpacity>
              </View>
            </View>
            <Text style={b.copyText}>{result.listing.description}</Text>
          </View>

          {/* Backend keywords */}
          <View style={b.block}>
            <View style={b.blockHeader}>
              <Text style={b.blockLabel}>BACKEND KEYWORDS</Text>
              <View style={{ flexDirection: 'row', gap: spacing.sm, alignItems: 'center' }}>
                <CharCount current={result.listing.backend_keywords.join(' ').length} max={249} warn={220} />
                <TouchableOpacity onPress={() => copy(result.listing.backend_keywords.join(' '), 'kw')}>
                  <Text style={b.copyBtn}>{copiedKey === 'kw' ? '✓ Copied' : 'Copy'}</Text>
                </TouchableOpacity>
              </View>
            </View>
            <View style={b.tagCloud}>
              {result.listing.backend_keywords.map((kw, i) => (
                <View key={i} style={b.kwTag}>
                  <Text style={b.kwTagText}>{kw}</Text>
                </View>
              ))}
            </View>
          </View>

        </View>
      )}

      {!result && !loading && (
        <EmptyState
          icon="≡"
          title="Build a listing that converts"
          subtitle="Enter your product to generate a keyword-optimized Amazon listing with quality scoring."
          iconBg="rgba(67,97,238,0.09)"
          iconSize={72}
          style={b.emptyState}
        />
      )}
    </ScrollView>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

import { AppHeader } from '../components/AppHeader';

type BrandView = 'hub' | Mode;

const BRAND_TOOLS: { id: Mode; icon: string; label: string; sub: string; color: string; bg: string }[] = [
  { id: 'brand',    icon: '✦', label: 'Brand Kit',  sub: 'Logo, labels & brand identity',   color: '#DB2777', bg: '#FDF2F8' },
  { id: 'keywords', icon: '≋', label: 'Keywords',   sub: 'Find high-converting search terms', color: '#0284C7', bg: '#EFF8FF' },
  { id: 'listing',  icon: '≡', label: 'Listing',    sub: 'AI-optimized product copy',        color: '#7C3AED', bg: '#F5F0FF' },
];

function BrandBackBar({ title, onBack }: { title: string; onBack: () => void }) {
  return (
    <View style={bb.bar}>
      <TouchableOpacity style={bb.backBtn} onPress={onBack} activeOpacity={0.7}>
        <Text style={bb.backArrow}>←</Text>
        <Text style={bb.backLabel}>Brand</Text>
      </TouchableOpacity>
      <Text style={bb.title} numberOfLines={1}>{title}</Text>
      <View style={{ width: 60 }} />
    </View>
  );
}
const bb = StyleSheet.create({
  bar: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 10,
    backgroundColor: '#FFFFFF', borderBottomWidth: 1, borderBottomColor: '#ECF0FB',
    gap: 8,
  },
  backBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, minWidth: 60 },
  backArrow: { fontSize: 16, color: '#DB2777', fontWeight: '700' as const },
  backLabel: { fontSize: 13, color: '#DB2777', fontWeight: '600' as const },
  title: { flex: 1, fontSize: 14, fontWeight: '700' as const, color: '#0D1B4B', textAlign: 'center' as const },
});

function BrandHub({ onSelect }: { onSelect: (id: Mode) => void }) {
  return (
    <ScrollView style={{ flex: 1, backgroundColor: '#F5F7FF' }} contentContainerStyle={bh.content} showsVerticalScrollIndicator={false}>
      <View style={bh.titleBlock}>
        <Text style={bh.eyebrow}>BRAND STUDIO</Text>
        <Text style={bh.title}>Build Your{'\n'}Brand.</Text>
        <Text style={bh.sub}>Logo · Labels · Keywords · Listing — all in one place.</Text>
      </View>

      <Text style={bh.sectionLabel}>TOOLS</Text>
      {BRAND_TOOLS.map(tool => (
        <TouchableOpacity key={tool.id} style={bh.card} onPress={() => onSelect(tool.id)} activeOpacity={0.85}>
          <View style={[bh.iconWrap, { backgroundColor: tool.bg }]}>
            <Text style={[bh.icon, { color: tool.color }]}>{tool.icon}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={bh.cardLabel}>{tool.label}</Text>
            <Text style={bh.cardSub}>{tool.sub}</Text>
          </View>
          <Text style={[bh.arrow, { color: tool.color }]}>→</Text>
        </TouchableOpacity>
      ))}
    </ScrollView>
  );
}
const bh = StyleSheet.create({
  content: { paddingBottom: 40 },
  titleBlock: { paddingHorizontal: 20, paddingTop: 28, paddingBottom: 20 },
  eyebrow: { fontSize: 9, fontWeight: '800' as const, color: '#DB2777', letterSpacing: 2.5, marginBottom: 6 },
  title: { fontSize: 32, fontWeight: '900' as const, color: '#0D1B4B', letterSpacing: -1.2, lineHeight: 38, marginBottom: 8 },
  sub: { fontSize: 14, color: '#5C6B8A', lineHeight: 20 },
  sectionLabel: {
    fontSize: 9, fontWeight: '800' as const, color: '#8196B0', letterSpacing: 2,
    marginHorizontal: 20, marginBottom: 10,
  },
  card: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    marginHorizontal: 16, marginBottom: 8,
    backgroundColor: '#FFFFFF', borderRadius: 16,
    borderWidth: 1, borderColor: '#ECF0FB',
    padding: 14,
  },
  iconWrap: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  icon: { fontSize: 20 },
  cardLabel: { fontSize: 14, fontWeight: '700' as const, color: '#0D1B4B', marginBottom: 2 },
  cardSub: { fontSize: 12, color: '#8196B0' },
  arrow: { fontSize: 16, fontWeight: '700' as const },
});

export default function BrandScreen() {
  const [view, setView] = useState<BrandView>('hub');

  const currentTool = BRAND_TOOLS.find(t => t.id === view);

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <AppHeader />
      {view === 'hub' ? (
        <BrandHub onSelect={m => setView(m)} />
      ) : (
        <>
          <BrandBackBar title={currentTool?.label ?? ''} onBack={() => setView('hub')} />
          <View style={{ flex: 1, backgroundColor: '#F5F7FF' }}>
            <View style={[{ flex: 1 }, view !== 'brand'    && { display: 'none' }]}><BrandTab /></View>
            <View style={[{ flex: 1 }, view !== 'keywords' && { display: 'none' }]}><KeywordsScreen edges={[]} /></View>
            <View style={[{ flex: 1 }, view !== 'listing'  && { display: 'none' }]}><ListingTab /></View>
          </View>
        </>
      )}
    </SafeAreaView>
  );
}

// ─── Screen styles ─────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#FFFFFF' },
});

// ─── Tab-internal styles ───────────────────────────────────────────────────────

const b = StyleSheet.create({
  scroll: { paddingBottom: spacing.xxl },

  inputGroup:  { paddingHorizontal: spacing.lg, marginBottom: spacing.md },
  fieldLabel:  { fontSize: 9, fontWeight: '800' as const, color: colors.textMuted, letterSpacing: 1.5, marginBottom: spacing.xs },
  fieldHint:   { fontSize: 11.5, color: colors.textMuted, lineHeight: 17, letterSpacing: 0.1, marginTop: 5 },
  sectionHint: { fontSize: 12, color: colors.textMuted, lineHeight: 18, marginBottom: spacing.sm },
  input: {
    borderWidth: 1, borderColor: colors.border, borderRadius: radius.md,
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm + 3,
    fontSize: 15, color: colors.textPrimary, backgroundColor: colors.bgCard,
  },

  styleSection: { paddingHorizontal: spacing.lg, marginBottom: spacing.md },
  styleRow:     { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.xs, flexWrap: 'wrap' },
  styleChip: {
    paddingHorizontal: spacing.md, paddingVertical: spacing.xs + 2,
    borderWidth: 1, borderColor: colors.border, borderRadius: radius.full,
    backgroundColor: colors.bgCard,
  },
  styleChipActive:    { backgroundColor: BRAND_COLOR, borderColor: BRAND_COLOR },
  styleChipText:      { fontSize: 12, fontWeight: '700' as const, color: colors.textSecondary },
  styleChipTextActive:{ color: colors.bg },

  btn: {
    marginHorizontal: spacing.lg, marginBottom: spacing.md,
    backgroundColor: BRAND_COLOR, borderRadius: radius.md,
    paddingVertical: spacing.md, alignItems: 'center',
  },
  btnText:   { fontSize: 16, fontWeight: '800' as const, color: colors.bg },
  errorText: { fontSize: 12, color: colors.red, paddingHorizontal: spacing.lg },

  results:    { paddingHorizontal: spacing.md, gap: spacing.md },
  emptyState: { paddingTop: spacing.xxl },

  labelRow: { flexDirection: 'row', gap: spacing.sm },
  labelBtn: {
    backgroundColor: 'rgba(219,39,119,0.10)',
    borderRadius: radius.md,
    paddingVertical: spacing.sm + 2,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(219,39,119,0.22)',
  },
  labelBtnText: { fontSize: 14, fontWeight: '700' as const, color: BRAND_COLOR },

  block: {
    backgroundColor: colors.bgCard,
    borderWidth: 1, borderColor: colors.border,
    borderRadius: radius.md, padding: spacing.md, gap: spacing.sm,
  },
  blockHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  blockLabel:  { fontSize: 9, fontWeight: '800' as const, color: colors.textMuted, letterSpacing: 1.5 },
  blockHint:   { fontSize: 11, color: colors.textMuted, lineHeight: 16, letterSpacing: 0.1, marginTop: -4 },
  copyBtn:     { fontSize: 12, fontWeight: '700' as const, color: BRAND_COLOR },

  bigName:  { fontSize: 28, fontWeight: '900' as const, color: colors.textPrimary, letterSpacing: -1 },
  namesGrid:{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  nameChip: {
    paddingHorizontal: spacing.md, paddingVertical: spacing.xs + 3,
    borderWidth: 1, borderColor: colors.border, borderRadius: radius.full,
    backgroundColor: colors.bgElevated,
  },
  nameChipActive:    { backgroundColor: 'rgba(219,39,119,0.09)', borderColor: 'rgba(219,39,119,0.22)' },
  nameChipText:      { fontSize: 14, fontWeight: '700' as const, color: colors.textSecondary },
  nameChipTextActive:{ color: BRAND_COLOR },
  tagline: { fontSize: 13, color: colors.textMuted, fontStyle: 'italic' as const },

  tagCloud: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs + 2 },
  tag: {
    paddingHorizontal: spacing.sm, paddingVertical: 3,
    borderWidth: 1, borderColor: colors.border, borderRadius: radius.sm,
    backgroundColor: colors.bgElevated,
  },
  tagText:    { fontSize: 12, color: colors.textSecondary },
  copyText:   { fontSize: 14, color: colors.textSecondary, lineHeight: 22 },
  bullet:     { flexDirection: 'row', gap: spacing.sm },
  bulletDash: { fontSize: 14, fontWeight: '700' as const, color: BRAND_COLOR },
  bulletText: { fontSize: 14, flex: 1, lineHeight: 22, color: colors.textSecondary },

  scoreCheck:     { flexDirection: 'row', alignItems: 'center', gap: 5 },
  scoreCheckText: { fontSize: 12, fontWeight: '500' as const },

  listingBullet: {
    borderWidth: 1, borderColor: colors.border, borderRadius: radius.sm,
    padding: spacing.sm, gap: 4, backgroundColor: colors.bgElevated,
  },
  listingBulletHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  bulletNum: { fontSize: 9, fontWeight: '800' as const, color: colors.textMuted, letterSpacing: 1 },

  kwTag: {
    backgroundColor: colors.bgElevated, borderRadius: radius.full,
    paddingHorizontal: 8, paddingVertical: 3,
    borderWidth: 1, borderColor: colors.border,
  },
  kwTagText: { fontSize: 11, fontWeight: '600' as const, color: colors.textSecondary },
});
