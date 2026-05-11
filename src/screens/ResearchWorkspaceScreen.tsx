import React, { useState, useCallback } from 'react';
import {
  ScrollView, StyleSheet, View, Text,
  TouchableOpacity, ActivityIndicator, Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  AppCard,
  SectionHeader,
  StatusBadge,
  InputField,
  PrimaryButton,
  SecondaryButton,
  GhostButton,
  DS,
} from '../components/ds';
import { api, Product, Supplier, TrendData } from '../services/api';
import { useSubscription } from '../hooks/useSubscription';
import { useVault } from '../hooks/useVault';
import PaywallModal from '../components/PaywallModal';

// ── Static mock fallbacks (shown before first search) ─────────────────────────

const MOCK_KEYWORD_METRICS = [
  { label: 'Search Volume', value: '18,400',  icon: '◎', color: '#0284C7', bg: '#EFF8FF' },
  { label: 'Competition',   value: 'Medium',   icon: '⊞', color: '#F59E0B', bg: '#FFFBEB' },
  { label: 'Trend',         value: 'Rising ↑', icon: '↗', color: DS.accent,  bg: DS.accentLight },
  { label: 'Opportunity',   value: '8.7/10',   icon: '✦', color: '#7C3AED', bg: '#F5F0FF' },
];

const MOCK_RELATED_KEYWORDS = ['garlic press', 'stainless garlic crusher', 'kitchen mincer', 'herb grinder', 'cooking tools'];

const MOCK_PRODUCTS = [
  { id: '1', name: 'Professional Stainless Garlic Press',  revenue: '$4,200/mo', reviews: '847 reviews', competition: 'Low'    as const, badge: 'Promising' as const },
  { id: '2', name: 'Silicone Garlic Peeler & Press Set',   revenue: '$2,800/mo', reviews: '312 reviews', competition: 'Medium' as const, badge: 'Promising' as const },
  { id: '3', name: 'Heavy Duty Cast Iron Garlic Crusher',  revenue: '$1,950/mo', reviews: '156 reviews', competition: 'Low'    as const, badge: 'Promising' as const },
];

const MOCK_SUPPLIERS = [
  { id: '1', name: 'Zhejiang Premium Kitchenware Co.', badge: 'Gold Supplier', years: '8 yrs',  moq: '500 units', price: '$1.20/unit', trust: 9.2, country: '🇨🇳' },
  { id: '2', name: 'Guangdong AllHome Manufacturing',  badge: 'Verified',      years: '5 yrs',  moq: '200 units', price: '$0.95/unit', trust: 8.7, country: '🇨🇳' },
  { id: '3', name: 'Yiwu Trade Export Ltd.',           badge: 'Gold Supplier', years: '12 yrs', moq: '1000 units',price: '$0.78/unit', trust: 9.5, country: '🇨🇳' },
];

// ── Display types ─────────────────────────────────────────────────────────────

interface ProductDisplay {
  id: string;
  name: string;
  revenue: string;
  reviews: string;
  competition: 'Low' | 'Medium' | 'High';
  badge: 'Promising' | 'Moderate' | 'Saturated';
  url?: string;
}

interface SupplierDisplay {
  id: string;
  name: string;
  badge: string;
  years: string;
  moq: string;
  price: string;
  trust: number;
  country: string;
  url?: string;
}

interface KeywordMetric {
  label: string;
  value: string;
  icon: string;
  color: string;
  bg: string;
}

// ── Converters ────────────────────────────────────────────────────────────────

function productToDisplay(p: Product): ProductDisplay {
  const comp: ProductDisplay['competition'] =
    p.competition === 'High' ? 'High' : p.competition === 'Low' ? 'Low' : 'Medium';
  const badge: ProductDisplay['badge'] =
    p.opportunity === 'Good' ? 'Promising' : p.opportunity === 'Saturated' ? 'Saturated' : 'Moderate';
  const revenueEst = p.price && p.review_count
    ? `$${Math.round(p.price * p.review_count * 0.05).toLocaleString()}/mo`
    : 'N/A';
  return {
    id:          p.asin,
    name:        p.title,
    revenue:     revenueEst,
    reviews:     p.review_count != null ? `${p.review_count.toLocaleString()} reviews` : 'N/A',
    competition: comp,
    badge,
    url:         p.url,
  };
}

function supplierToDisplay(s: Supplier, idx: number): SupplierDisplay {
  const avg = s.price_range.min != null && s.price_range.max != null
    ? (s.price_range.min + s.price_range.max) / 2
    : null;
  const trust = avg != null ? Math.min(9.9, Math.max(6.0, 10 - avg * 0.3)) : 8.0;
  return {
    id:      String(idx),
    name:    s.title,
    badge:   'Verified',
    years:   'N/A',
    moq:     `${s.moq} units`,
    price:   s.price_display,
    trust:   Math.round(trust * 10) / 10,
    country: '🇨🇳',
    url:     s.url,
  };
}

function displayToProduct(p: ProductDisplay): Product {
  const reviewCount = parseInt(p.reviews.replace(/\D/g, ''), 10) || null;
  return {
    title:        p.name,
    price:        null,
    rating:       null,
    review_count: reviewCount,
    asin:         p.id,
    image:        '',
    competition:  p.competition as Product['competition'],
    opportunity:  p.badge === 'Promising' ? 'Good' : p.badge === 'Saturated' ? 'Saturated' : 'Moderate',
    url:          p.url ?? '',
  };
}

function trendsToMetrics(kw: string, trends: TrendData, totalFound: number, seoScore: number): KeywordMetric[] {
  const trendLabel = trends.trend_direction === 'Rising' ? 'Rising ↑'
    : trends.trend_direction === 'Declining' ? 'Declining ↓' : 'Stable →';
  const trendColor = trends.trend_direction === 'Rising' ? DS.accent
    : trends.trend_direction === 'Declining' ? DS.danger : DS.textSecondary;
  const trendBg = trends.trend_direction === 'Rising' ? DS.accentLight
    : trends.trend_direction === 'Declining' ? DS.dangerBg : DS.bgSubtle;
  return [
    { label: 'Search Volume', value: totalFound > 0 ? `${totalFound.toLocaleString()}` : '—', icon: '◎', color: '#0284C7', bg: '#EFF8FF' },
    { label: 'Trend Score',   value: trends.interest_score != null ? `${trends.interest_score}/100` : '—', icon: '↗', color: trendColor, bg: trendBg },
    { label: 'Trend',         value: trendLabel, icon: '↗', color: trendColor, bg: trendBg },
    { label: 'SEO Score',     value: `${seoScore}/10`, icon: '✦', color: '#7C3AED', bg: '#F5F0FF' },
  ];
}

// ── Segmented control ─────────────────────────────────────────────────────────

type Segment = 'amazon' | 'suppliers';

function SegmentedControl({ value, onChange }: { value: Segment; onChange: (v: Segment) => void }) {
  return (
    <View style={seg.wrap}>
      {(['amazon', 'suppliers'] as Segment[]).map(tab => (
        <TouchableOpacity
          key={tab}
          style={[seg.tab, value === tab && seg.tabActive]}
          onPress={() => onChange(tab)}
          activeOpacity={0.8}
          accessibilityRole="tab"
          accessibilityState={{ selected: value === tab }}
        >
          <Text style={[seg.label, value === tab && seg.labelActive]}>
            {tab === 'amazon' ? 'Search Amazon' : 'Find Suppliers'}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

const seg = StyleSheet.create({
  wrap: { flexDirection: 'row', backgroundColor: DS.bgSubtle, borderRadius: 14, borderWidth: 1, borderColor: DS.border, padding: 3, gap: 2 },
  tab:        { flex: 1, paddingVertical: 9, borderRadius: 11, alignItems: 'center' },
  tabActive:  { backgroundColor: DS.bgCard, shadowColor: '#0D1B4B', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.07, shadowRadius: 4, elevation: 2 },
  label:      { fontSize: 13, fontWeight: '600', color: DS.textMuted },
  labelActive:{ color: DS.textPrimary, fontWeight: '700' },
});

// ── InfoTip ───────────────────────────────────────────────────────────────────

function InfoTip({ text }: { text: string }) {
  return (
    <View style={tip.wrap}>
      <Text style={tip.icon}>ℹ</Text>
      <Text style={tip.text}>{text}</Text>
    </View>
  );
}
const tip = StyleSheet.create({
  wrap: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: DS.indigoLight, borderRadius: DS.radiusBadge, paddingHorizontal: 10, paddingVertical: 4, alignSelf: 'flex-start' },
  icon: { fontSize: 10, color: DS.indigo },
  text: { fontSize: 10, fontWeight: '600', color: DS.indigo },
});

// ── Keyword metrics card ──────────────────────────────────────────────────────

function KeywordMetricsCard({ keyword, metrics }: { keyword: string; metrics: KeywordMetric[] }) {
  return (
    <AppCard style={km.card}>
      <View style={km.header}>
        <Text style={km.title}>Keyword Analysis</Text>
        <InfoTip text={keyword || 'your search'} />
      </View>
      <View style={km.grid}>
        {metrics.map(m => (
          <View key={m.label} style={[km.tile, { backgroundColor: m.bg }]}>
            <Text style={[km.tileIcon, { color: m.color }]}>{m.icon}</Text>
            <Text style={[km.tileValue, { color: m.color }]}>{m.value}</Text>
            <Text style={km.tileLabel}>{m.label}</Text>
          </View>
        ))}
      </View>
    </AppCard>
  );
}

const km = StyleSheet.create({
  card:     { gap: 16 },
  header:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title:    { fontSize: 15, fontWeight: '800', color: DS.textPrimary, letterSpacing: -0.3 },
  grid:     { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  tile:     { width: '47%', borderRadius: 16, padding: 14, alignItems: 'center', gap: 4 },
  tileIcon: { fontSize: 20, fontWeight: '700' },
  tileValue:{ fontSize: 18, fontWeight: '900', letterSpacing: -0.5 },
  tileLabel:{ fontSize: 10, fontWeight: '600', color: DS.textSecondary, textAlign: 'center' },
});

// ── Related keywords card ─────────────────────────────────────────────────────

function RelatedKeywordsCard({ keywords }: { keywords: string[] }) {
  const [saved, setSaved] = useState<Set<string>>(new Set());
  return (
    <AppCard style={rk.card}>
      <View style={rk.header}>
        <Text style={rk.title}>Related Keywords</Text>
        <InfoTip text="Search Volume" />
      </View>
      <View style={rk.chips}>
        {keywords.map(kw => {
          const active = saved.has(kw);
          return (
            <TouchableOpacity
              key={kw}
              style={[rk.chip, active && rk.chipActive]}
              onPress={() => setSaved(prev => { const n = new Set(prev); active ? n.delete(kw) : n.add(kw); return n; })}
              activeOpacity={0.75}
            >
              <Text style={[rk.chipText, active && rk.chipTextActive]}>{kw}</Text>
              {active && <Text style={rk.chipCheck}>✓</Text>}
            </TouchableOpacity>
          );
        })}
      </View>
    </AppCard>
  );
}

const rk = StyleSheet.create({
  card:         { gap: 14 },
  header:       { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title:        { fontSize: 15, fontWeight: '800', color: DS.textPrimary, letterSpacing: -0.3 },
  chips:        { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip:         { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: DS.bgSubtle, borderWidth: 1, borderColor: DS.border, borderRadius: DS.radiusBadge, paddingHorizontal: 12, paddingVertical: 7 },
  chipActive:   { backgroundColor: DS.accentLight, borderColor: DS.accent },
  chipText:     { fontSize: 12, fontWeight: '600', color: DS.textSecondary },
  chipTextActive:{ color: DS.accent },
  chipCheck:    { fontSize: 10, color: DS.accent, fontWeight: '800' },
});

// ── Product opportunity card ──────────────────────────────────────────────────

function ProductOpportunityCard({ item }: { item: ProductDisplay }) {
  const compColor = item.competition === 'Low' ? DS.accent : item.competition === 'High' ? DS.danger : DS.warning;
  const compBg    = item.competition === 'Low' ? DS.accentLight : item.competition === 'High' ? DS.dangerBg : DS.warningBg;
  const badgeVariant: 'success' | 'warning' | 'neutral' = item.badge === 'Promising' ? 'success' : item.badge === 'Saturated' ? 'neutral' : 'warning';

  return (
    <AppCard padding={16} radius={18} style={po.card}>
      <View style={po.row}>
        <View style={po.icon}><Text style={po.iconGlyph}>🛒</Text></View>
        <View style={po.info}>
          <Text style={po.name} numberOfLines={2}>{item.name}</Text>
          <View style={po.badges}>
            <StatusBadge label={item.badge} variant={badgeVariant} dot />
            <View style={[po.compBadge, { backgroundColor: compBg }]}>
              <Text style={[po.compText, { color: compColor }]}>{item.competition} Competition</Text>
            </View>
          </View>
        </View>
      </View>
      <View style={po.stats}>
        <View style={po.stat}>
          <Text style={po.statValue}>{item.revenue}</Text>
          <Text style={po.statLabel}>Est. Revenue</Text>
        </View>
        <View style={po.statDivider} />
        <View style={po.stat}>
          <Text style={po.statValue}>{item.reviews}</Text>
          <Text style={po.statLabel}>Reviews</Text>
        </View>
        <View style={po.statDivider} />
        <GhostButton label="Analyze" onPress={() => {}} size="sm" icon="◎" style={po.analyzeBtn} />
      </View>
    </AppCard>
  );
}

const po = StyleSheet.create({
  card:        { gap: 14 },
  row:         { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  icon:        { width: 48, height: 48, borderRadius: 14, backgroundColor: DS.bgSubtle, borderWidth: 1, borderColor: DS.border, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  iconGlyph:   { fontSize: 22 },
  info:        { flex: 1, gap: 8 },
  name:        { fontSize: 13, fontWeight: '700', color: DS.textPrimary, letterSpacing: -0.2, lineHeight: 19 },
  badges:      { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
  compBadge:   { borderRadius: DS.radiusBadge, paddingHorizontal: 8, paddingVertical: 3 },
  compText:    { fontSize: 11, fontWeight: '700' },
  stats:       { flexDirection: 'row', alignItems: 'center', backgroundColor: DS.bgSubtle, borderRadius: 12, padding: 12, gap: 0 },
  stat:        { flex: 1, alignItems: 'center', gap: 2 },
  statValue:   { fontSize: 13, fontWeight: '800', color: DS.textPrimary, letterSpacing: -0.3 },
  statLabel:   { fontSize: 9, fontWeight: '600', color: DS.textMuted, textTransform: 'uppercase', letterSpacing: 0.4 },
  statDivider: { width: 1, height: 28, backgroundColor: DS.border },
  analyzeBtn:  { flex: 1 },
});

// ── Supplier card ─────────────────────────────────────────────────────────────

function SupplierCard({ item }: { item: SupplierDisplay }) {
  const isGold = item.badge === 'Gold Supplier';
  return (
    <AppCard padding={16} radius={18} style={sc.card}>
      <View style={sc.header}>
        <View style={sc.nameLine}>
          <Text style={sc.country}>{item.country}</Text>
          <Text style={sc.name} numberOfLines={1}>{item.name}</Text>
        </View>
        <View style={[sc.badge, isGold ? sc.badgeGold : sc.badgeVerified]}>
          <Text style={[sc.badgeText, isGold ? sc.badgeTextGold : sc.badgeTextVerified]}>
            {isGold ? '★ Gold' : '✓ Verified'}
          </Text>
        </View>
      </View>
      <View style={sc.stats}>
        <View style={sc.stat}><Text style={sc.statVal}>{item.years}</Text><Text style={sc.statLbl}>Experience</Text></View>
        <View style={sc.divider} />
        <View style={sc.stat}><Text style={sc.statVal}>{item.moq}</Text><Text style={sc.statLbl}>Min. Order</Text></View>
        <View style={sc.divider} />
        <View style={sc.stat}><Text style={[sc.statVal, { color: DS.accent }]}>{item.price}</Text><Text style={sc.statLbl}>Unit Price</Text></View>
        <View style={sc.divider} />
        <View style={sc.stat}><Text style={[sc.statVal, { color: '#0284C7' }]}>{item.trust}</Text><Text style={sc.statLbl}>Trust</Text></View>
      </View>
      <InfoTip text="MOQ: Minimum Order Quantity" />
    </AppCard>
  );
}

const sc = StyleSheet.create({
  card:   { gap: 12 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  nameLine: { flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1 },
  country: { fontSize: 16 },
  name:   { fontSize: 13, fontWeight: '700', color: DS.textPrimary, flex: 1, letterSpacing: -0.2 },
  badge:  { borderRadius: DS.radiusBadge, paddingHorizontal: 9, paddingVertical: 4 },
  badgeGold:          { backgroundColor: '#FFFBEB' },
  badgeVerified:      { backgroundColor: DS.accentLight },
  badgeText:          { fontSize: 11, fontWeight: '800' },
  badgeTextGold:      { color: '#B45309' },
  badgeTextVerified:  { color: DS.accentDark },
  stats:  { flexDirection: 'row', alignItems: 'center', backgroundColor: DS.bgSubtle, borderRadius: 12, padding: 12 },
  stat:   { flex: 1, alignItems: 'center', gap: 3 },
  statVal:{ fontSize: 12, fontWeight: '800', color: DS.textPrimary, letterSpacing: -0.2 },
  statLbl:{ fontSize: 8, fontWeight: '600', color: DS.textMuted, textTransform: 'uppercase', letterSpacing: 0.4, textAlign: 'center' },
  divider:{ width: 1, height: 26, backgroundColor: DS.border },
});

// ── Amazon tab ────────────────────────────────────────────────────────────────

interface AmazonTabProps {
  searched:     boolean;
  loading:      boolean;
  error:        string;
  keyword:      string;
  products:     ProductDisplay[];
  keywords:     string[];
  metrics:      KeywordMetric[];
  saveLoading:  boolean;
  saveSuccess:  boolean;
  saveError:    string;
  onSave:       () => void;
}

function AmazonTab({ searched, loading, error, keyword, products, keywords, metrics, saveLoading, saveSuccess, saveError, onSave }: AmazonTabProps) {
  if (loading) {
    return (
      <View style={tab.center}>
        <ActivityIndicator size="large" color={DS.accent} />
        <Text style={tab.loadingText}>Searching Amazon...</Text>
      </View>
    );
  }
  if (error) {
    return (
      <View style={[tab.center, { backgroundColor: DS.dangerBg, borderRadius: 16, padding: 20 }]}>
        <Text style={{ fontSize: 13, color: DS.dangerText, textAlign: 'center' }}>{error}</Text>
      </View>
    );
  }
  return (
    <View style={tab.wrap}>
      <KeywordMetricsCard keyword={keyword} metrics={metrics} />
      <SectionHeader title="Related Keywords" subtitle="Tap to save for your research" style={tab.sectionHead} />
      <RelatedKeywordsCard keywords={keywords} />
      <SectionHeader title="Product Opportunities" subtitle={searched ? `${products.length} results found` : 'Based on your search'} actionLabel="View All" onAction={() => {}} style={tab.sectionHead} />
      {products.map(p => <ProductOpportunityCard key={p.id} item={p} />)}

      {saveSuccess && (
        <View style={tab.saveBanner}>
          <Text style={tab.saveBannerIcon}>✓</Text>
          <Text style={tab.saveBannerText}>Product idea saved to your Vault</Text>
        </View>
      )}
      {saveError !== '' && (
        <View style={[tab.saveBanner, tab.saveBannerError]}>
          <Text style={tab.saveBannerText}>{saveError}</Text>
        </View>
      )}

      <PrimaryButton
        label={saveLoading ? 'Saving...' : saveSuccess ? 'Saved to Vault ✓' : 'Save Product Idea'}
        onPress={onSave}
        icon="✦"
        disabled={saveLoading || products.length === 0}
        loading={saveLoading}
        style={tab.saveBtn}
      />
    </View>
  );
}

// ── Suppliers tab ─────────────────────────────────────────────────────────────

interface OutreachEmail {
  subject: string;
  body:    string;
  tips:    string[];
}

interface SuppliersTabProps {
  loading:          boolean;
  error:            string;
  suppliers:        SupplierDisplay[];
  supplierQuery:    string;
  onQueryChange:    (q: string) => void;
  onSearch:         () => void;
  outreachLoading:  boolean;
  outreachError:    string;
  outreachEmail:    OutreachEmail | null;
  onGenerateEmail:  () => void;
}

function SuppliersTab({
  loading, error, suppliers, supplierQuery, onQueryChange, onSearch,
  outreachLoading, outreachError, outreachEmail, onGenerateEmail,
}: SuppliersTabProps) {
  return (
    <View style={tab.wrap}>
      <AppCard style={tab.supplierSearch}>
        <InputField
          value={supplierQuery}
          onChangeText={onQueryChange}
          placeholder="Search suppliers on Alibaba and 1688..."
          leadingIcon="🏭"
          returnKeyType="search"
        />
        {supplierQuery.trim().length > 0 && (
          <PrimaryButton label="Find Suppliers" onPress={onSearch} size="sm" icon="⬡" style={{ marginTop: 10 }} />
        )}
      </AppCard>

      {loading && (
        <View style={tab.center}>
          <ActivityIndicator size="large" color={DS.accent} />
          <Text style={tab.loadingText}>Searching suppliers...</Text>
        </View>
      )}
      {!loading && error !== '' && (
        <View style={[tab.center, { backgroundColor: DS.dangerBg, borderRadius: 16, padding: 20 }]}>
          <Text style={{ fontSize: 13, color: DS.dangerText, textAlign: 'center' }}>{error}</Text>
        </View>
      )}
      {!loading && error === '' && (
        <>
          <SectionHeader title="Top Suppliers" subtitle="Verified manufacturers for your product" style={tab.sectionHead} />
          {suppliers.map(s => <SupplierCard key={s.id} item={s} />)}

          <View style={tab.supplierActions}>
            <PrimaryButton
              label={outreachLoading ? 'Generating...' : outreachEmail ? 'Regenerate Email' : 'Generate Outreach Email'}
              onPress={onGenerateEmail}
              icon="✉"
              loading={outreachLoading}
              disabled={outreachLoading || (supplierQuery.trim().length === 0 && suppliers.length === 0)}
              style={tab.actionBtn}
            />
            <SecondaryButton label="Compare Suppliers" onPress={() => {}} icon="⊞" style={tab.actionBtn} />
          </View>

          {outreachError !== '' && (
            <View style={[tab.saveBanner, tab.saveBannerError]}>
              <Text style={tab.saveBannerText}>{outreachError}</Text>
            </View>
          )}

          {outreachEmail !== null && (
            <AppCard padding={16} radius={18} style={tab.emailCard}>
              <View style={tab.emailHeader}>
                <Text style={tab.emailHeaderText}>✉ Outreach Email Preview</Text>
              </View>
              <View style={tab.emailSubjectRow}>
                <Text style={tab.emailLabel}>Subject</Text>
                <Text style={tab.emailSubject}>{outreachEmail.subject}</Text>
              </View>
              <View style={tab.emailBodyBox}>
                <Text style={tab.emailBody}>{outreachEmail.body}</Text>
              </View>
              {outreachEmail.tips.length > 0 && (
                <View style={tab.emailTips}>
                  <Text style={tab.emailTipsTitle}>Sending Tips</Text>
                  {outreachEmail.tips.map((tip, i) => (
                    <Text key={i} style={tab.emailTip}>· {tip}</Text>
                  ))}
                </View>
              )}
              <PrimaryButton
                label="Open in Mail App"
                onPress={() => {
                  const encoded = encodeURIComponent(outreachEmail.body);
                  const subject = encodeURIComponent(outreachEmail.subject);
                  Linking.openURL(`mailto:?subject=${subject}&body=${encoded}`);
                }}
                icon="↗"
              />
            </AppCard>
          )}
        </>
      )}
    </View>
  );
}

const tab = StyleSheet.create({
  wrap:           { gap: 16 },
  sectionHead:    { marginBottom: -8 },
  center:         { alignItems: 'center', justifyContent: 'center', paddingVertical: 40, gap: 12 },
  loadingText:    { fontSize: 13, color: DS.textMuted, fontWeight: '600' },
  supplierSearch: { padding: 12 },
  saveBtn:        { marginTop: 4 },
  supplierActions:{ gap: 10, marginTop: 4 },
  actionBtn:      {},
  saveBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: DS.accentLight, borderRadius: 10, padding: 12,
  },
  saveBannerError: { backgroundColor: DS.dangerBg },
  saveBannerIcon:  { fontSize: 14, color: DS.accent, fontWeight: '800' },
  saveBannerText:  { fontSize: 13, color: DS.accentDark, fontWeight: '600', flex: 1 },

  emailCard:       { gap: 14 },
  emailHeader:     { backgroundColor: DS.indigoLight, borderRadius: 10, padding: 10 },
  emailHeaderText: { fontSize: 12, fontWeight: '800', color: DS.indigo, letterSpacing: 0.2 },
  emailSubjectRow: { gap: 4 },
  emailLabel:      { fontSize: 9, fontWeight: '800', color: DS.textMuted, textTransform: 'uppercase', letterSpacing: 0.8 },
  emailSubject:    { fontSize: 13, fontWeight: '700', color: DS.textPrimary, letterSpacing: -0.2 },
  emailBodyBox:    { backgroundColor: DS.bgSubtle, borderRadius: 12, padding: 12 },
  emailBody:       { fontSize: 12, color: DS.textSecondary, lineHeight: 19 },
  emailTips:       { gap: 5 },
  emailTipsTitle:  { fontSize: 10, fontWeight: '800', color: DS.textMuted, textTransform: 'uppercase', letterSpacing: 0.6 },
  emailTip:        { fontSize: 12, color: DS.textSecondary, lineHeight: 18 },
});

// ── Screen ────────────────────────────────────────────────────────────────────

export default function ResearchWorkspaceScreen() {
  const { can, increment } = useSubscription();
  const vault = useVault();

  const [segment,       setSegment]       = useState<Segment>('amazon');
  const [searchQuery,   setSearchQuery]   = useState('');
  const [supplierQuery, setSupplierQuery] = useState('');
  const [showPaywall,   setShowPaywall]   = useState(false);

  // Amazon search state
  const [amazonLoading,   setAmazonLoading]   = useState(false);
  const [amazonError,     setAmazonError]     = useState('');
  const [amazonSearched,  setAmazonSearched]  = useState(false);
  const [realProducts,    setRealProducts]    = useState<ProductDisplay[]>(MOCK_PRODUCTS);
  const [realKeywords,    setRealKeywords]    = useState<string[]>(MOCK_RELATED_KEYWORDS);
  const [realMetrics,     setRealMetrics]     = useState<KeywordMetric[]>(MOCK_KEYWORD_METRICS);
  const [currentKeyword,  setCurrentKeyword]  = useState('');

  // Save product state
  const [saveLoading, setSaveLoading] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saveError,   setSaveError]   = useState('');

  // Supplier search state
  const [suppliersLoading,  setSuppliersLoading]  = useState(false);
  const [suppliersError,    setSuppliersError]    = useState('');
  const [realSuppliers,     setRealSuppliers]     = useState<SupplierDisplay[]>(MOCK_SUPPLIERS);

  // Outreach email state
  const [outreachLoading, setOutreachLoading] = useState(false);
  const [outreachError,   setOutreachError]   = useState('');
  const [outreachEmail,   setOutreachEmail]   = useState<OutreachEmail | null>(null);

  const handleAmazonSearch = useCallback(async () => {
    const q = searchQuery.trim();
    if (!q) return;
    if (!can('research')) { setShowPaywall(true); return; }

    setAmazonLoading(true);
    setAmazonError('');
    try {
      const [amazonRes, kwRes] = await Promise.all([
        api.searchAmazon(q),
        api.researchKeywords(q),
      ]);
      await increment('research');
      setRealProducts(amazonRes.products.slice(0, 8).map(productToDisplay));
      setRealKeywords([...kwRes.head_terms, ...kwRes.long_tail].slice(0, 10));
      setRealMetrics(trendsToMetrics(q, amazonRes.trends, kwRes.total_found, kwRes.seo_score));
      setCurrentKeyword(amazonRes.keyword);
      setAmazonSearched(true);
    } catch (err: any) {
      setAmazonError(err?.message ?? 'Search failed. Please try again.');
    } finally {
      setAmazonLoading(false);
    }
  }, [searchQuery, can, increment]);

  const handleSupplierSearch = useCallback(async () => {
    const q = supplierQuery.trim();
    if (!q) return;
    if (!can('suppliers')) { setShowPaywall(true); return; }

    setSuppliersLoading(true);
    setSuppliersError('');
    try {
      const res = await api.searchSuppliers(q);
      await increment('suppliers');
      setRealSuppliers(res.suppliers.map(supplierToDisplay));
    } catch (err: any) {
      setSuppliersError(err?.message ?? 'Supplier search failed. Please try again.');
    } finally {
      setSuppliersLoading(false);
    }
  }, [supplierQuery, can, increment]);

  const handleSaveProduct = useCallback(async () => {
    const top = realProducts[0];
    if (!top) return;
    setSaveLoading(true);
    setSaveSuccess(false);
    setSaveError('');
    try {
      vault.addEntry(displayToProduct(top), null, 'US', 'USD');
      setSaveSuccess(true);
    } catch (err: any) {
      setSaveError(err?.message ?? 'Failed to save. Please try again.');
    } finally {
      setSaveLoading(false);
    }
  }, [realProducts, vault]);

  const handleGenerateOutreach = useCallback(async () => {
    const product = supplierQuery.trim() || realProducts[0]?.name || 'your product';
    setOutreachLoading(true);
    setOutreachError('');
    try {
      const result = await api.getSupplierEmail(product, 'Your Brand');
      setOutreachEmail(result);
    } catch (err: any) {
      setOutreachError(err?.message ?? 'Failed to generate email. Please try again.');
    } finally {
      setOutreachLoading(false);
    }
  }, [supplierQuery, realProducts]);

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <PaywallModal visible={showPaywall} onClose={() => setShowPaywall(false)} featureContext={segment === 'amazon' ? 'research' : 'suppliers'} />

      {/* ── Pinned header ─────────────────────────────────── */}
      <View style={s.header}>
        <Text style={s.eyebrow}>RESEARCH WORKSPACE</Text>
        <Text style={s.heroTitle}>Discover Winning Products</Text>
        <Text style={s.heroSub}>Research products, keywords, and suppliers in one place.</Text>
      </View>

      <ScrollView style={s.scroll} contentContainerStyle={s.content} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        {/* ── Search input card ─────────────────────────── */}
        <AppCard padding={14} style={s.searchCard}>
          <View style={s.searchRow}>
            <InputField
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder="Search keywords, products, or niches..."
              leadingIcon="◎"
              containerStyle={s.searchInput}
              returnKeyType="search"
              onSubmitEditing={segment === 'amazon' ? handleAmazonSearch : undefined}
            />
            <TouchableOpacity style={s.filterBtn} activeOpacity={0.75} accessibilityLabel="Filter options">
              <Text style={s.filterIcon}>⊞</Text>
            </TouchableOpacity>
          </View>
          {searchQuery.length > 0 && (
            <PrimaryButton
              label={segment === 'amazon' ? 'Search Amazon' : 'Search'}
              onPress={segment === 'amazon' ? handleAmazonSearch : handleSupplierSearch}
              size="sm"
              icon="◎"
              style={s.searchBtn}
              loading={amazonLoading}
            />
          )}
        </AppCard>

        {/* ── Segmented control ─────────────────────────── */}
        <SegmentedControl value={segment} onChange={setSegment} />

        {/* ── Tab content ───────────────────────────────── */}
        {segment === 'amazon' ? (
          <AmazonTab
            searched={amazonSearched}
            loading={amazonLoading}
            error={amazonError}
            keyword={currentKeyword}
            products={realProducts}
            keywords={realKeywords}
            metrics={realMetrics}
            saveLoading={saveLoading}
            saveSuccess={saveSuccess}
            saveError={saveError}
            onSave={handleSaveProduct}
          />
        ) : (
          <SuppliersTab
            loading={suppliersLoading}
            error={suppliersError}
            suppliers={realSuppliers}
            supplierQuery={supplierQuery}
            onQueryChange={setSupplierQuery}
            onSearch={handleSupplierSearch}
            outreachLoading={outreachLoading}
            outreachError={outreachError}
            outreachEmail={outreachEmail}
            onGenerateEmail={handleGenerateOutreach}
          />
        )}
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
  eyebrow:  { fontSize: 9, fontWeight: '800', color: '#0284C7', letterSpacing: 2.5 },
  heroTitle:{ fontSize: 22, fontWeight: '900', color: DS.textPrimary, letterSpacing: -0.7 },
  heroSub:  { fontSize: 13, color: DS.textSecondary, lineHeight: 18 },

  scroll:  { flex: 1 },
  content: { paddingHorizontal: DS.pagePadding, paddingTop: DS.sectionGap, paddingBottom: 80, gap: DS.sectionGap },

  searchCard: {},
  searchRow:  { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  searchInput:{ flex: 1 },
  filterBtn: {
    width: 48, height: 48, borderRadius: 14,
    backgroundColor: DS.bgSubtle, borderWidth: 1.5, borderColor: DS.border,
    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  filterIcon: { fontSize: 20, color: DS.textSecondary },
  searchBtn:  { marginTop: 10 },
});
