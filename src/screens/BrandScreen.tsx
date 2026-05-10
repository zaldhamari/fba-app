import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity,
  ScrollView, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, spacing, radius, shadow } from '../theme';
import { api, BrandResult } from '../services/api';
import { useSubscription } from '../hooks/useSubscription';
import PaywallModal from '../components/PaywallModal';
import KeywordsScreen from './KeywordsScreen';
import { IdeasMode } from './LaunchScreen';

type Mode = 'brand' | 'ideas' | 'keywords' | 'listing';
const STYLES = ['minimal', 'modern', 'premium', 'playful'] as const;

// ─── Listing score ────────────────────────────────────────────────────────────
function listingScore(result: BrandResult): { score: number; checks: { label: string; pass: boolean }[] } {
  const title   = result.listing.title;
  const bullets = result.listing.bullet_points;
  const desc    = result.listing.description;
  const kws     = result.listing.backend_keywords;
  const checks  = [
    { label: 'Title 80+ chars',        pass: title.length >= 80 },
    { label: '5 bullet points',        pass: bullets.length >= 5 },
    { label: 'Description 300+ chars', pass: desc.length >= 300 },
    { label: '5+ backend keywords',    pass: kws.length >= 5 },
    { label: 'Title under 200 chars',  pass: title.length <= 200 },
  ];
  return { score: Math.round((checks.filter(c => c.pass).length / checks.length) * 100), checks };
}

function CharCount({ current, max, warn }: { current: number; max: number; warn?: number }) {
  const over = current > max;
  const near = warn ? current >= warn : false;
  const color = over ? colors.red : near ? colors.amber : colors.textMuted;
  return <Text style={[cc.text, { color }]}>{current}/{max}</Text>;
}
const cc = StyleSheet.create({
  text: { fontSize: 10, fontWeight: '600' },
});

// ─── Brand Tab ────────────────────────────────────────────────────────────────
function BrandTab() {
  const [product, setProduct]       = useState('');
  const [brandName, setBrandName]   = useState('');
  const [style, setStyle]           = useState<typeof STYLES[number]>('minimal');
  const [result, setResult]         = useState<BrandResult | null>(null);
  const [selectedName, setSelectedName] = useState('');
  const [loading, setLoading]       = useState(false);
  const [error, setError]           = useState('');
  const [showPaywall, setShowPaywall] = useState(false);
  const [copiedKey, setCopiedKey]   = useState('');
  const { can, increment }          = useSubscription();

  async function generate() {
    if (!product.trim()) return;
    if (!can('brands')) { setShowPaywall(true); return; }
    setLoading(true); setError(''); setResult(null);
    try {
      const data = await api.createBrand(product.trim(), style, brandName.trim());
      setResult(data); setSelectedName(data.brand_name);
      await increment('brands');
    } catch (e: any) { setError(e.message || 'Generation failed.'); }
    finally { setLoading(false); }
  }

  function copy(_text: string, key: string) {
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(''), 2000);
  }

  return (
    <ScrollView contentContainerStyle={b.scroll} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
      <PaywallModal visible={showPaywall} onClose={() => setShowPaywall(false)} featureContext="brands" />

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
          placeholder="Enter a name or leave blank to generate…"
          placeholderTextColor={colors.textMuted} returnKeyType="done" autoCorrect={false}
        />
        <Text style={b.fieldHint}>Leave blank to get 5 AI-generated name options</Text>
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
          : <Text style={b.btnText}>Generate Brand ✦</Text>
        }
      </TouchableOpacity>

      {!!error && <Text style={b.errorText}>{error}</Text>}

      {result && (
        <View style={b.results}>
          {/* Brand names */}
          <View style={b.block}>
            <Text style={b.blockLabel}>{brandName.trim() ? 'YOUR BRAND' : 'BRAND NAMES'}</Text>
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
          </View>

          {/* Keywords */}
          {result.generated_keywords.length > 0 && (
            <View style={b.block}>
              <Text style={b.blockLabel}>KEYWORDS ({result.generated_keywords.length})</Text>
              <View style={b.tagCloud}>
                {result.generated_keywords.map((kw, i) => (
                  <View key={i} style={b.tag}>
                    <Text style={b.tagText}>{kw}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}

          {/* Text blocks */}
          {[
            { key: 'title', label: 'PRODUCT TITLE',    hint: 'Paste into Amazon — starts ranking immediately on save.',      text: result.listing.title },
            { key: 'desc',  label: 'DESCRIPTION',       hint: 'Tell the story behind the product — buyers read this.',        text: result.listing.description },
            { key: 'kw',    label: 'BACKEND KEYWORDS',  hint: 'Hidden from buyers but indexed by Amazon — boosts rank.',      text: result.listing.backend_keywords.join(', ') },
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

          {/* Bullets */}
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
    </ScrollView>
  );
}

// ─── Listing Builder Tab ──────────────────────────────────────────────────────
function ListingTab() {
  const [product, setProduct]   = useState('');
  const [brandName, setBrandName] = useState('');
  const [result, setResult]     = useState<BrandResult | null>(null);
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState('');
  const [showPaywall, setShowPaywall] = useState(false);
  const [copiedKey, setCopiedKey] = useState('');
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

  function copy(_text: string, key: string) {
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(''), 2000);
  }

  const scored     = result ? listingScore(result) : null;
  const scoreColor = scored
    ? (scored.score >= 80 ? colors.green : scored.score >= 60 ? colors.amber : colors.red)
    : colors.textMuted;
  const scoreBg    = scored
    ? (scored.score >= 80 ? colors.greenLight : scored.score >= 60 ? colors.orangeLight : colors.redLight)
    : colors.bgElevated;

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

      <TouchableOpacity style={[b.btn, loading && { opacity: 0.5 }]} onPress={generate} disabled={loading} activeOpacity={0.8}>
        {loading
          ? <ActivityIndicator color={colors.bg} size="small" />
          : <Text style={b.btnText}>Build Listing ≡</Text>
        }
      </TouchableOpacity>

      {!!error && <Text style={b.errorText}>{error}</Text>}

      {result && scored && (
        <View style={b.results}>
          {/* Score card */}
          <View style={b.scoreCard}>
            <View style={[b.scoreCircle, { backgroundColor: scoreBg }]}>
              <Text style={[b.scoreNum, { color: scoreColor }]}>{scored.score}</Text>
              <Text style={b.scoreOf}>/ 100</Text>
            </View>
            <View style={b.scoreChecks}>
              {scored.checks.map((c, i) => (
                <View key={i} style={b.scoreCheck}>
                  <Text style={{ color: c.pass ? colors.green : colors.textMuted, fontWeight: '800', fontSize: 11 }}>
                    {c.pass ? '✓' : '✗'}
                  </Text>
                  <Text style={[b.scoreCheckText, { color: c.pass ? colors.textPrimary : colors.textMuted }]}>
                    {c.label}
                  </Text>
                </View>
              ))}
            </View>
          </View>

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
    </ScrollView>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────
export default function BrandScreen() {
  const [mode, setMode] = useState<Mode>('brand');

  const BRAND_TABS: { key: Mode; label: string; icon: string }[] = [
    { key: 'brand',    label: 'Brand',    icon: '✦' },
    { key: 'ideas',    label: 'Ideas',    icon: '◉' },
    { key: 'keywords', label: 'Keywords', icon: '≋' },
    { key: 'listing',  label: 'Listing',  icon: '≡' },
  ];

  return (
    <SafeAreaView style={s.container}>
      {/* Header */}
      <View style={s.header}>
        <Text style={s.brandWord}>Siftly</Text>
        <Text style={s.eyebrow}>BRAND BUILDER</Text>
        <Text style={s.title}>Build your{'\n'}brand identity.</Text>
      </View>

      {/* Tab switcher */}
      <View style={s.tabs}>
        {BRAND_TABS.map(m => (
          <TouchableOpacity
            key={m.key}
            style={[s.tab, mode === m.key && s.tabActive]}
            onPress={() => setMode(m.key)}
            activeOpacity={0.75}
          >
            <Text style={[s.tabText, mode === m.key && s.tabTextActive]}>
              {m.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Keep all tabs mounted to preserve state */}
      <View style={{ flex: 1 }}>
        <View style={[{ flex: 1 }, mode !== 'brand'    && { display: 'none' }]}><BrandTab /></View>
        <View style={[{ flex: 1 }, mode !== 'ideas'    && { display: 'none' }]}><IdeasMode /></View>
        <View style={[{ flex: 1 }, mode !== 'keywords' && { display: 'none' }]}><KeywordsScreen edges={[]} /></View>
        <View style={[{ flex: 1 }, mode !== 'listing'  && { display: 'none' }]}><ListingTab /></View>
      </View>
    </SafeAreaView>
  );
}

const BRAND_COLOR = '#DB2777';

// ─── Screen styles ─────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F7FF' },
  header: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E8F5',
    backgroundColor: '#fff',
  },
  brandWord: { fontSize: 20, fontWeight: '900', color: '#0D1B4B', letterSpacing: -0.8, marginBottom: 2 },
  eyebrow: { fontSize: 9, fontWeight: '800', color: BRAND_COLOR, letterSpacing: 2.5, marginBottom: 6 },
  title:   { fontSize: 26, fontWeight: '900', color: '#0D1B4B', letterSpacing: -1, lineHeight: 32 },
  tabs:         { flexDirection: 'row', marginHorizontal: spacing.lg, marginTop: spacing.sm, marginBottom: spacing.sm, backgroundColor: '#E8EDF5', borderRadius: radius.lg, padding: 3, borderWidth: 1, borderColor: '#D0DAF0' },
  tab:          { flex: 1, paddingVertical: spacing.sm + 2, alignItems: 'center', borderRadius: radius.md - 2 },
  tabActive:    { backgroundColor: '#fff', ...shadow.sm },
  tabText:      { fontSize: 13, fontWeight: '700', color: colors.textMuted },
  tabTextActive:{ color: '#0D1B4B', fontWeight: '800' },
});

// ─── Tab-internal styles ───────────────────────────────────────────────────────
const b = StyleSheet.create({
  scroll: { paddingBottom: spacing.xxl },

  inputGroup: { paddingHorizontal: spacing.lg, marginBottom: spacing.md },
  fieldLabel: { fontSize: 9, fontWeight: '800', color: colors.textMuted, letterSpacing: 1.5, marginBottom: spacing.xs },
  fieldHint: { fontSize: 11.5, color: colors.textMuted, lineHeight: 17, letterSpacing: 0.1, marginTop: 5 },
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
  styleChipActive:    { backgroundColor: '#DB2777', borderColor: '#DB2777' },
  styleChipText:      { fontSize: 12, fontWeight: '700', color: colors.textSecondary },
  styleChipTextActive:{ color: colors.bg },

  btn: {
    marginHorizontal: spacing.lg, marginBottom: spacing.md,
    backgroundColor: '#DB2777', borderRadius: radius.md,
    paddingVertical: spacing.md, alignItems: 'center',
  },
  btnText:   { fontSize: 16, fontWeight: '800', color: colors.bg },
  errorText: { fontSize: 12, color: colors.red, paddingHorizontal: spacing.lg },

  results: { paddingHorizontal: spacing.lg, gap: spacing.md },

  block: {
    backgroundColor: colors.bgCard,
    borderWidth: 1, borderColor: colors.border,
    borderRadius: radius.md, padding: spacing.md, gap: spacing.sm,
  },
  blockHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  blockLabel:  { fontSize: 9, fontWeight: '800', color: colors.textMuted, letterSpacing: 1.5 },
  blockHint:   { fontSize: 11, color: colors.textMuted, lineHeight: 16, letterSpacing: 0.1, marginTop: -4 },
  copyBtn:     { fontSize: 12, fontWeight: '700', color: '#DB2777' },

  bigName:  { fontSize: 28, fontWeight: '900', color: colors.textPrimary, letterSpacing: -1 },
  namesGrid:{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  nameChip: {
    paddingHorizontal: spacing.md, paddingVertical: spacing.xs + 3,
    borderWidth: 1, borderColor: colors.border, borderRadius: radius.full,
    backgroundColor: colors.bgElevated,
  },
  nameChipActive:    { backgroundColor: 'rgba(219,39,119,0.09)', borderColor: 'rgba(219,39,119,0.22)' },
  nameChipText:      { fontSize: 14, fontWeight: '700', color: colors.textSecondary },
  nameChipTextActive:{ color: '#DB2777' },
  tagline: { fontSize: 13, color: colors.textMuted, fontStyle: 'italic' },

  tagCloud: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs + 2 },
  tag: {
    paddingHorizontal: spacing.sm, paddingVertical: 3,
    borderWidth: 1, borderColor: colors.border, borderRadius: radius.sm,
    backgroundColor: colors.bgElevated,
  },
  tagText:  { fontSize: 12, color: colors.textSecondary },
  copyText: { fontSize: 14, color: colors.textSecondary, lineHeight: 22 },
  bullet:   { flexDirection: 'row', gap: spacing.sm },
  bulletDash:{ fontSize: 14, fontWeight: '700', color: '#DB2777' },
  bulletText:{ fontSize: 14, flex: 1, lineHeight: 22, color: colors.textSecondary },

  // Listing score
  scoreCard: {
    backgroundColor: colors.bgCard,
    borderWidth: 1, borderColor: colors.border,
    borderRadius: radius.md, padding: spacing.md,
    flexDirection: 'row', gap: spacing.md, alignItems: 'center',
  },
  scoreCircle: {
    width: 80, height: 80, borderRadius: 40,
    alignItems: 'center', justifyContent: 'center',
  },
  scoreNum:    { fontSize: 32, fontWeight: '900', letterSpacing: -1.5 },
  scoreOf:     { fontSize: 10, fontWeight: '700', color: colors.textMuted },
  scoreChecks: { flex: 1, gap: 6 },
  scoreCheck:  { flexDirection: 'row', alignItems: 'center', gap: 5 },
  scoreCheckText: { fontSize: 12, fontWeight: '500' },

  // Listing builder bullets
  listingBullet: {
    borderWidth: 1, borderColor: colors.border, borderRadius: radius.sm,
    padding: spacing.sm, gap: 4, backgroundColor: colors.bgElevated,
  },
  listingBulletHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  bulletNum: { fontSize: 9, fontWeight: '800', color: colors.textMuted, letterSpacing: 1 },

  kwTag: {
    backgroundColor: colors.bgElevated, borderRadius: radius.full,
    paddingHorizontal: 8, paddingVertical: 3,
    borderWidth: 1, borderColor: colors.border,
  },
  kwTagText: { fontSize: 11, fontWeight: '600', color: colors.textSecondary },
});
