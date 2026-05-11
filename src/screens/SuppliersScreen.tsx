import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity,
  FlatList, ActivityIndicator, Linking, Image, ScrollView, Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, spacing, radius } from '../theme';
import { api, Supplier } from '../services/api';
import { SupplierScoreResult } from '../types';
import { useSubscription } from '../hooks/useSubscription';
import PaywallModal from '../components/PaywallModal';
import { SegmentedControl, EmptyState } from '../components/ui';

type STab = 'search' | 'email';

function SupplierCard({ item, product }: { item: Supplier; product: string }) {
  const [scoreData, setScoreData] = useState<SupplierScoreResult | null>(null);
  const [scoring, setScoring] = useState(false);
  const [showSheet, setShowSheet] = useState(false);

  async function score() {
    if (scoreData) { setShowSheet(true); return; }
    setScoring(true);
    try {
      const { min, max } = item.price_range ?? {};
      const price = min != null && max != null ? (min + max) / 2 : min ?? 5;
      const moqNum = parseInt(String(item.moq).replace(/\D/g, '')) || 500;
      const data = await api.scoreSupplier({
        supplier_name: item.supplier || item.title,
        price_per_unit: Math.round(price * 100) / 100,
        moq: moqNum,
        product_name: product,
      });
      setScoreData(data);
      setShowSheet(true);
    } catch { /* silent */ }
    finally { setScoring(false); }
  }

  const gradeColor = scoreData?.grade === 'A' ? colors.green
    : scoreData?.grade === 'B' ? '#059669'
    : scoreData?.grade === 'C' ? colors.amber : colors.red;

  return (
    <>
      <TouchableOpacity style={s.card} onPress={() => item.url && Linking.openURL(item.url)} activeOpacity={0.85}>
        <View style={s.cardInner}>
          {item.image
            ? <Image source={{ uri: item.image }} style={s.img} resizeMode="cover" />
            : <View style={[s.img, s.imgPlaceholder]}><Text style={{ fontSize: 24 }}>⊞</Text></View>
          }
          <View style={s.info}>
            <Text style={s.cardTitle} numberOfLines={2}>{item.title}</Text>
            <Text style={s.price}>{item.price_display}</Text>
            <Text style={s.moq}>MOQ: {item.moq}</Text>
            {item.supplier && item.supplier !== 'N/A' && (
              <Text style={s.supplier} numberOfLines={1}>{item.supplier}</Text>
            )}
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: 4 }}>
              {item.url && <Text style={s.link}>View →</Text>}
              <TouchableOpacity style={s.scoreBtn} onPress={score} disabled={scoring} activeOpacity={0.8}>
                {scoring
                  ? <ActivityIndicator size="small" color={'#059669'} style={{ width: 40 }} />
                  : <Text style={s.scoreBtnText}>
                      {scoreData ? `Grade ${scoreData.grade}` : 'Score ◎'}
                    </Text>
                }
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </TouchableOpacity>

      {/* Score Sheet */}
      <Modal visible={showSheet} transparent animationType="slide" onRequestClose={() => setShowSheet(false)}>
        <TouchableOpacity style={sc.backdrop} activeOpacity={1} onPress={() => setShowSheet(false)} />
        {scoreData && (
          <View style={sc.sheet}>
            <View style={sc.handle} />

            {/* Header row */}
            <View style={sc.header}>
              <View style={{ flex: 1, marginRight: spacing.md }}>
                <Text style={sc.eyebrow}>SUPPLIER CONFIDENCE INDEX</Text>
                <Text style={sc.name} numberOfLines={1}>{scoreData.supplier_name}</Text>
              </View>
              <View style={[sc.gradeBadge, { backgroundColor: gradeColor }]}>
                <Text style={sc.gradeText}>{scoreData.grade}</Text>
              </View>
            </View>

            {/* Score + label */}
            <View style={sc.scoreRow}>
              <Text style={sc.score}>{scoreData.total_score}</Text>
              <View style={sc.scoreMeta}>
                <Text style={sc.scoreOf}>/100</Text>
                <View style={[sc.confPill, { backgroundColor: gradeColor + '22', borderColor: gradeColor + '44' }]}>
                  <Text style={[sc.confPillText, { color: gradeColor }]}>{scoreData.confidence_label}</Text>
                </View>
              </View>
            </View>

            {/* Score progress bar */}
            <View style={sc.barTrack}>
              <View style={[sc.barFill, { width: `${scoreData.total_score}%` as any, backgroundColor: gradeColor }]} />
            </View>

            <Text style={sc.recommendation}>{scoreData.recommendation}</Text>

            {/* Signal dimension pills */}
            <View style={sc.pillsRow}>
              {[
                { label: 'Platform', key: 'platform_credibility' },
                { label: 'Price',    key: 'price_competitiveness' },
                { label: 'MOQ',      key: 'moq_accessibility' },
                { label: 'Response', key: 'response_quality' },
              ].map(({ label, key }) => {
                const val = Math.round(scoreData.score_breakdown[key] ?? 0);
                const pill_color = val >= 75 ? colors.green : val >= 50 ? colors.amber : colors.red;
                return (
                  <View key={key} style={[sc.pill, { borderColor: pill_color + '55', backgroundColor: pill_color + '12' }]}>
                    <Text style={[sc.pillLabel, { color: colors.textMuted }]}>{label}</Text>
                    <Text style={[sc.pillVal, { color: pill_color }]}>{val}</Text>
                  </View>
                );
              })}
            </View>

            <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 280 }}>
              {/* Strengths */}
              {scoreData.strengths.length > 0 && (
                <>
                  <Text style={sc.sectionLabel}>STRENGTHS</Text>
                  {scoreData.strengths.map((f: string, i: number) => (
                    <View key={i} style={sc.flagRow}>
                      <Text style={{ color: colors.green, fontWeight: '800', fontSize: 13 }}>✓</Text>
                      <Text style={sc.flagText}>{f}</Text>
                    </View>
                  ))}
                </>
              )}

              {/* Risk flags */}
              {scoreData.risk_flags.length > 0 && (
                <>
                  <Text style={[sc.sectionLabel, { marginTop: spacing.md }]}>RISK FLAGS</Text>
                  {scoreData.risk_flags.map((f: string, i: number) => (
                    <View key={i} style={sc.flagRow}>
                      <Text style={{ color: colors.red, fontWeight: '800' }}>⚠</Text>
                      <Text style={sc.flagText}>{f}</Text>
                    </View>
                  ))}
                </>
              )}

              {/* Negotiation */}
              <Text style={[sc.sectionLabel, { marginTop: spacing.md }]}>NEGOTIATION STRATEGY</Text>
              <Text style={sc.sectionHint}>Talking points to secure better pricing and lower MOQ before you reply.</Text>
              <View style={sc.negBox}>
                <View style={sc.negRow}>
                  <Text style={sc.negLabel}>Opening offer</Text>
                  <Text style={sc.negVal}>{scoreData.negotiation_strategy.opening_offer}</Text>
                </View>
                <View style={sc.negRow}>
                  <Text style={sc.negLabel}>Target price</Text>
                  <Text style={[sc.negVal, { color: colors.green }]}>{scoreData.negotiation_strategy.target_price}</Text>
                </View>
                <View style={sc.negRow}>
                  <Text style={sc.negLabel}>Ask for MOQ</Text>
                  <Text style={sc.negVal}>{scoreData.negotiation_strategy.moq_ask} units</Text>
                </View>
              </View>
              <Text style={[sc.sectionLabel, { marginTop: spacing.md }]}>LEVERAGE POINTS</Text>
              {scoreData.negotiation_strategy.leverage_points?.map((p: string, i: number) => (
                <View key={i} style={sc.flagRow}>
                  <Text style={{ color: '#059669', fontWeight: '800' }}>✦</Text>
                  <Text style={sc.flagText}>{p}</Text>
                </View>
              ))}
            </ScrollView>

            <TouchableOpacity style={sc.closeBtn} onPress={() => setShowSheet(false)} activeOpacity={0.8}>
              <Text style={sc.closeBtnText}>Done</Text>
            </TouchableOpacity>
          </View>
        )}
      </Modal>
    </>
  );
}

const sc = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)' },
  sheet: {
    backgroundColor: colors.bgCard,
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: spacing.lg, paddingBottom: 36,
    position: 'absolute', bottom: 0, left: 0, right: 0, maxHeight: '88%',
  },
  handle: { width: 36, height: 4, backgroundColor: colors.bgElevated, borderRadius: 2, alignSelf: 'center', marginBottom: spacing.md },

  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: spacing.sm },
  eyebrow: { fontSize: 9, fontWeight: '800', color: '#059669', letterSpacing: 2 },
  name: { fontSize: 15, fontWeight: '800', color: colors.textPrimary, marginTop: 2 },
  gradeBadge: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  gradeText: { fontSize: 18, fontWeight: '900', color: colors.white },

  scoreRow: { flexDirection: 'row', alignItems: 'flex-end', gap: spacing.sm, marginBottom: 8 },
  score: { fontSize: 52, fontWeight: '900', color: colors.textPrimary, letterSpacing: -2.5, lineHeight: 56 },
  scoreMeta: { paddingBottom: 8, gap: 4 },
  scoreOf: { fontSize: 16, fontWeight: '500', color: colors.textMuted },
  confPill: {
    borderRadius: radius.full, borderWidth: 1,
    paddingHorizontal: 8, paddingVertical: 2,
    alignSelf: 'flex-start',
  },
  confPillText: { fontSize: 10, fontWeight: '800', letterSpacing: 0.5 },

  barTrack: { height: 5, backgroundColor: colors.bgElevated, borderRadius: radius.full, marginBottom: spacing.md, overflow: 'hidden' },
  barFill:  { height: 5, borderRadius: radius.full },

  recommendation: { fontSize: 13, color: colors.textSecondary, lineHeight: 19, marginBottom: spacing.md },
  sectionHint: { fontSize: 11, color: colors.textMuted, lineHeight: 16, letterSpacing: 0.1, marginBottom: spacing.sm, marginTop: -2 },

  pillsRow: { flexDirection: 'row', gap: 6, marginBottom: spacing.md, flexWrap: 'wrap' },
  pill: {
    borderRadius: radius.full, borderWidth: 1,
    paddingHorizontal: 10, paddingVertical: 4,
    alignItems: 'center', gap: 1,
  },
  pillLabel: { fontSize: 8, fontWeight: '700', letterSpacing: 0.8 },
  pillVal:   { fontSize: 13, fontWeight: '900', letterSpacing: -0.5 },

  sectionLabel: { fontSize: 9, fontWeight: '800', color: colors.textMuted, letterSpacing: 1.5, marginBottom: spacing.sm },
  flagRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: 8, alignItems: 'flex-start' },
  flagText: { fontSize: 13, color: colors.textSecondary, flex: 1, lineHeight: 18 },

  negBox: { backgroundColor: colors.bgElevated, borderRadius: radius.md, padding: spacing.md, gap: 8 },
  negRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  negLabel: { fontSize: 12, color: colors.textSecondary },
  negVal: { fontSize: 13, fontWeight: '800', color: colors.textPrimary },

  closeBtn: { backgroundColor: '#059669', borderRadius: radius.md, paddingVertical: spacing.md, alignItems: 'center', marginTop: spacing.md },
  closeBtnText: { fontSize: 15, fontWeight: '700', color: colors.white },
});

export default function SuppliersScreen({ edges }: { edges?: readonly ('top'|'right'|'bottom'|'left')[] } = {}) {
  const [tab, setTab] = useState<STab>('search');
  const [query, setQuery] = useState('');
  const [maxPrice, setMaxPrice] = useState('');
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showPaywall, setShowPaywall] = useState(false);
  // Email generator state
  const [emailProduct, setEmailProduct] = useState('');
  const [emailBrand, setEmailBrand] = useState('');
  const [emailQty, setEmailQty] = useState('500');
  const [emailResult, setEmailResult] = useState<{ subject: string; body: string; tips: string[] } | null>(null);
  const [emailLoading, setEmailLoading] = useState(false);
  const [copiedKey, setCopiedKey] = useState('');
  const { can, increment, remaining, isFree, limits } = useSubscription();
  const suppliersLeft = remaining('suppliers');

  async function generateEmail() {
    if (!emailProduct.trim()) return;
    setEmailLoading(true);
    try {
      const data = await api.getSupplierEmail(emailProduct.trim(), emailBrand.trim());
      setEmailResult(data);
    } catch (e: any) {
      setError(e.message || 'Email generation failed.');
    } finally {
      setEmailLoading(false);
    }
  }

  function copy(text: string, key: string) {
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(''), 2000);
  }

  async function search() {
    if (!query.trim()) return;
    if (!can('suppliers')) { setShowPaywall(true); return; }
    setLoading(true);
    setError('');
    setSuppliers([]);
    try {
      const max = maxPrice ? parseFloat(maxPrice) : undefined;
      const data = await api.searchSuppliers(query.trim(), max);
      const good = data.suppliers.filter(s => !s.error);
      const errs = data.suppliers.filter(s => s.error);
      setSuppliers(good);
      if (errs.length) setError(errs[0].error || 'Partial results.');
      await increment('suppliers');
    } catch (e: any) {
      setError(e.message || 'Search failed. Make sure the server is running.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <SafeAreaView style={s.container} edges={edges as any}>
      <PaywallModal visible={showPaywall} onClose={() => setShowPaywall(false)} featureContext="suppliers" />

      <View style={s.header}>
        <View style={s.heroOrb} pointerEvents="none" />
        <View style={s.heroTop}>
          <View style={{ flex: 1 }}>
            <Text style={s.brandWord}>Siftly</Text>
            <Text style={s.eyebrow}>SUPPLIER SOURCING</Text>
            <Text style={s.title}>Find the right{'\n'}supplier.</Text>
            <Text style={s.subtitle}>Vetted global suppliers ranked by quality · send outreach in one tap</Text>
          </View>
          <View style={s.heroIconWrap}>
            <Text style={s.heroIcon}>⬡</Text>
          </View>
        </View>
        {isFree && (
          <TouchableOpacity
            style={s.usagePill}
            onPress={() => setShowPaywall(true)}
            activeOpacity={0.8}
          >
            <Text style={s.usagePillText}>{suppliersLeft} of {limits.suppliers} free search{limits.suppliers !== 1 ? 'es' : ''}</Text>
          </TouchableOpacity>
        )}
      </View>

      <View style={s.tabsWrap}>
        <SegmentedControl<STab>
          options={[
            { key: 'search', label: 'Find Suppliers', icon: '⬡' },
            { key: 'email',  label: 'Draft Email',    icon: '✉' },
          ]}
          value={tab}
          onChange={setTab}
          accentColor="#059669"
        />
      </View>

      {tab === 'email' && (
        <ScrollView contentContainerStyle={s.emailScroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            <Text style={s.emailHint}>Personalised outreach gets 3× more responses than generic emails.</Text>
          <View style={s.emailField}>
            <Text style={s.emailLabel}>PRODUCT YOU WANT TO SOURCE</Text>
            <TextInput style={s.input} value={emailProduct} onChangeText={setEmailProduct} placeholder="e.g. stainless steel water bottle" placeholderTextColor={colors.gray400} returnKeyType="next" autoCorrect={false} />
          </View>
          <View style={s.emailField}>
            <Text style={s.emailLabel}>YOUR BRAND NAME (optional)</Text>
            <TextInput style={s.input} value={emailBrand} onChangeText={setEmailBrand} placeholder="e.g. NovaCo" placeholderTextColor={colors.gray400} returnKeyType="next" autoCorrect={false} />
          </View>
          <View style={s.emailField}>
            <Text style={s.emailLabel}>ORDER QUANTITY</Text>
            <TextInput style={s.input} value={emailQty} onChangeText={setEmailQty} placeholder="500" placeholderTextColor={colors.gray400} keyboardType="number-pad" />
          </View>
          <TouchableOpacity style={[s.searchBtn, { flex: 0, paddingVertical: spacing.md, marginBottom: spacing.md }, emailLoading && s.searchBtnDisabled]} onPress={generateEmail} disabled={emailLoading} activeOpacity={0.8}>
            {emailLoading ? <ActivityIndicator color={colors.white} size="small" /> : <Text style={s.searchBtnText}>Generate Email</Text>}
          </TouchableOpacity>
          {!!error && <Text style={s.errorText}>{error}</Text>}
          {emailResult && (
            <View style={{ gap: spacing.md }}>
              <View style={s.emailBlock}>
                <View style={s.emailBlockHeader}>
                  <Text style={s.emailBlockLabel}>SUBJECT LINE</Text>
                  <TouchableOpacity onPress={() => copy(emailResult.subject, 'subject')}>
                    <Text style={s.copyBtn}>{copiedKey === 'subject' ? '✓ Copied' : 'Copy'}</Text>
                  </TouchableOpacity>
                </View>
                <Text style={s.emailText}>{emailResult.subject}</Text>
              </View>
              <View style={s.emailBlock}>
                <View style={s.emailBlockHeader}>
                  <Text style={s.emailBlockLabel}>EMAIL BODY</Text>
                  <TouchableOpacity onPress={() => copy(emailResult.body, 'body')}>
                    <Text style={s.copyBtn}>{copiedKey === 'body' ? '✓ Copied' : 'Copy'}</Text>
                  </TouchableOpacity>
                </View>
                <Text style={s.emailText}>{emailResult.body}</Text>
              </View>
              {emailResult.tips && emailResult.tips.length > 0 && (
                <View style={s.emailBlock}>
                  <Text style={s.emailBlockLabel}>NEGOTIATION TIPS</Text>
                  {emailResult.tips.map((tip, i) => (
                    <View key={i} style={{ flexDirection: 'row', gap: spacing.sm, marginTop: 6 }}>
                      <Text style={{ color: colors.green, fontWeight: '700' }}>·</Text>
                      <Text style={[s.emailText, { flex: 1 }]}>{tip}</Text>
                    </View>
                  ))}
                </View>
              )}

              {/* Open in mail app with pre-filled subject + body */}
              <TouchableOpacity
                style={s.sendMailBtn}
                onPress={() => {
                  const subject = encodeURIComponent(emailResult.subject);
                  const body    = encodeURIComponent(emailResult.body);
                  Linking.openURL(`mailto:?subject=${subject}&body=${body}`);
                }}
                activeOpacity={0.85}
              >
                <Text style={s.sendMailBtnText}>✉  Open in Mail App</Text>
              </TouchableOpacity>
            </View>
          )}
        </ScrollView>
      )}

      {tab === 'search' && <View style={s.searchRow}><TextInput
          style={[s.input, { flex: 2 }]}
          value={query}
          onChangeText={setQuery}
          placeholder="Enter a product to source…"
          placeholderTextColor={colors.gray400}
          returnKeyType="search"
          onSubmitEditing={search}
          autoCorrect={false}
        />
        <TextInput
          style={[s.input, { flex: 1 }]}
          value={maxPrice}
          onChangeText={setMaxPrice}
          placeholder="Max $"
          placeholderTextColor={colors.gray400}
          keyboardType="decimal-pad"
        />
        <TouchableOpacity
          style={[s.searchBtn, loading && s.searchBtnDisabled]}
          onPress={search}
          disabled={loading}
          activeOpacity={0.8}
        >
          {loading
            ? <ActivityIndicator color={colors.white} size="small" />
            : <Text style={s.searchBtnText}>→</Text>
          }
        </TouchableOpacity>
      </View>}

      {tab === 'search' && !!error && <Text style={s.errorText}>{error}</Text>}

      {tab === 'search' && <FlatList
        data={suppliers}
        keyExtractor={(_, i) => String(i)}
        contentContainerStyle={s.list}
        showsVerticalScrollIndicator={false}
        ItemSeparatorComponent={() => <View style={{ height: spacing.sm }} />}
        ListEmptyComponent={
          !loading && !error ? (
            <EmptyState
              icon="⬡"
              title="Find global suppliers"
              subtitle="Enter a product — we surface suppliers ranked by quality signals, globally."
              iconBg="rgba(5,150,105,0.09)"
              iconSize={72}
            />
          ) : null
        }
        renderItem={({ item }) => (
          <SupplierCard item={item} product={query} />
        )}
      />}
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  header: {
    backgroundColor: '#EDFAF4',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.lg,
    marginBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(5,150,105,0.22)',
    overflow: 'hidden',
  },
  heroOrb: {
    position: 'absolute', top: -60, right: -50,
    width: 200, height: 200, borderRadius: 100,
    backgroundColor: 'rgba(5,150,105,0.09)',
  },
  heroTop: { flexDirection: 'row', alignItems: 'flex-start' },
  heroIconWrap: {
    width: 52, height: 52, borderRadius: 16,
    backgroundColor: 'rgba(5,150,105,0.12)',
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: 'rgba(5,150,105,0.22)',
    marginTop: 4,
  },
  heroIcon: { fontSize: 24, color: '#059669' },
  brandWord: { fontSize: 20, fontWeight: '900', color: colors.textPrimary, letterSpacing: -0.8, marginBottom: 2 },
  eyebrow: { fontSize: 9, fontWeight: '800', color: '#059669', letterSpacing: 2.5, marginBottom: 6 },
  subtitle: { fontSize: 13, color: colors.textSecondary, marginTop: 4, lineHeight: 20 },
  title: {
    fontSize: 26, fontWeight: '900', color: colors.textPrimary,
    letterSpacing: -1, lineHeight: 32,
  },
  limit: { fontSize: 11, color: colors.textMuted },
  tabsWrap: { marginHorizontal: spacing.lg, marginBottom: spacing.md },
  emailScroll: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xxl, gap: spacing.md },
  emailField: { gap: spacing.xs },
  emailLabel: { fontSize: 9, fontWeight: '800', color: colors.textMuted, letterSpacing: 1.5 },
  emailBlock: {
    borderWidth: 1, borderColor: colors.border,
    borderRadius: radius.lg, padding: spacing.md, gap: spacing.sm,
    backgroundColor: colors.bgCard,
  },
  emailBlockHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  emailBlockLabel: { fontSize: 9, fontWeight: '800', color: colors.textMuted, letterSpacing: 1.5 },
  emailText: { fontSize: 14, color: colors.textSecondary, lineHeight: 22 },
  copyBtn: { fontSize: 11, fontWeight: '700', color: '#059669' },
  searchRow: {
    flexDirection: 'row', gap: spacing.sm,
    paddingHorizontal: spacing.lg, paddingBottom: spacing.md,
  },
  input: {
    borderWidth: 1, borderColor: colors.border,
    backgroundColor: colors.bgElevated,
    borderRadius: radius.md, paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2, fontSize: 15, color: colors.textPrimary,
  },
  searchBtn: {
    backgroundColor: '#059669', borderRadius: radius.md,
    paddingHorizontal: spacing.md, justifyContent: 'center', alignItems: 'center',
  },
  searchBtnDisabled: { opacity: 0.5 },
  searchBtnText: { color: colors.bg, fontSize: 20, fontWeight: '700' },
  usagePill: {
    alignSelf: 'flex-start', marginTop: spacing.sm,
    backgroundColor: 'rgba(5,150,105,0.10)', borderRadius: radius.full,
    paddingHorizontal: spacing.sm, paddingVertical: 4,
    borderWidth: 1, borderColor: 'rgba(5,150,105,0.22)',
  },
  usagePillText: { fontSize: 10, fontWeight: '700', color: '#059669' },
  emailHint:      { fontSize: 12, color: colors.textMuted, lineHeight: 17, letterSpacing: 0.1, marginBottom: spacing.sm },
  sendMailBtn:    { backgroundColor: '#059669', borderRadius: radius.md, paddingVertical: spacing.md, alignItems: 'center' },
  sendMailBtnText:{ fontSize: 15, fontWeight: '800', color: colors.white, letterSpacing: 0.2 },
  errorText: { fontSize: 12, color: colors.red, paddingHorizontal: spacing.lg, marginBottom: spacing.sm },
  list: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xxl },
  card: {
    borderWidth: 1, borderColor: colors.border,
    backgroundColor: colors.bgCard,
    borderRadius: radius.lg, padding: spacing.md,
  },
  cardInner: { flexDirection: 'row', gap: spacing.md },
  img: { width: 72, height: 72, borderRadius: radius.sm, backgroundColor: colors.bgElevated },
  imgPlaceholder: { justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: colors.border },
  info: { flex: 1, gap: 3 },
  cardTitle: { fontSize: 14, fontWeight: '600', color: colors.textPrimary, lineHeight: 20 },
  price: { fontSize: 16, fontWeight: '800', color: colors.green },
  moq: { fontSize: 11, color: colors.textMuted },
  supplier: { fontSize: 11, color: colors.textMuted },
  link: { fontSize: 11, color: '#059669', fontWeight: '700' },
  scoreBtn: { borderWidth: 1, borderColor: 'rgba(5,150,105,0.22)', borderRadius: radius.full, paddingHorizontal: spacing.sm, paddingVertical: 3, backgroundColor: 'rgba(5,150,105,0.10)' },
  scoreBtnText: { fontSize: 10, fontWeight: '800', color: '#059669' },
});
