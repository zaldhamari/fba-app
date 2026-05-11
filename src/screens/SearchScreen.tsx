import React, { useState, useCallback, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  TextInput, Modal, Platform, RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { colors, spacing, radius } from '../theme';
import ResearchScreen  from './ResearchScreen';
import SuppliersScreen from './SuppliersScreen';
import { useSubscription } from '../hooks/useSubscription';
import PaywallModal from '../components/PaywallModal';
import { AppHeader } from '../components/AppHeader';
import {
  calculateShipping, buildQuoteEmail,
  ShippingInputs, ShippingResult, ShipOrigin, ShipMarket, Incoterms,
} from '../utils/shippingCalcs';
import { InsightCard, HeroStatRow } from '../components/ui';
import * as Clipboard from 'expo-clipboard';

// ─── Types ────────────────────────────────────────────────────────────────────

type SearchView = 'hub' | 'product' | 'suppliers' | 'shipping';

// ─── NumInput (used by ShippingContent) ──────────────────────────────────────

function NumInput({ label, value, onChange, suffix, hint }: {
  label: string; value: string; onChange: (v: string) => void;
  suffix?: string; hint?: string;
}) {
  return (
    <View style={ni.wrap}>
      <Text style={ni.label}>{label}</Text>
      <View style={ni.row}>
        <TextInput
          style={[ni.input, suffix ? { flex: 1 } : {}]}
          value={value} onChangeText={onChange}
          keyboardType="decimal-pad" placeholderTextColor="#8196B0" placeholder="0"
        />
        {suffix ? <Text style={ni.suffix}>{suffix}</Text> : null}
      </View>
      {hint ? <Text style={ni.hint}>{hint}</Text> : null}
    </View>
  );
}
const ni = StyleSheet.create({
  wrap:  { flex: 1, gap: 4 },
  label: { fontSize: 8, fontWeight: '800' as const, color: '#8196B0', letterSpacing: 1.5 },
  hint:  { fontSize: 10, color: '#8196B0', lineHeight: 14, marginTop: 2 },
  row:   { flexDirection: 'row', alignItems: 'center', gap: 4 },
  input: {
    borderWidth: 1, borderColor: '#E0E8F5', borderRadius: 8,
    paddingHorizontal: 10, paddingVertical: 7,
    fontSize: 14, color: '#0D1B4B', backgroundColor: '#F4F6FC', minWidth: 50,
  },
  suffix: { fontSize: 12, color: '#8196B0', fontWeight: '600' as const },
});

// ─── ShippingContent ──────────────────────────────────────────────────────────

const ORIGINS:   { key: ShipOrigin; label: string }[] = [
  { key: 'CN', label: '🇨🇳 China' }, { key: 'VN', label: '🇻🇳 Vietnam' },
  { key: 'IN', label: '🇮🇳 India' }, { key: 'TR', label: '🇹🇷 Turkey' },
];
const MARKETS:   { key: ShipMarket; label: string }[] = [
  { key: 'US', label: '🇺🇸 US' }, { key: 'UK', label: '🇬🇧 UK' },
  { key: 'DE', label: '🇩🇪 DE' }, { key: 'CA', label: '🇨🇦 CA' },
];
const INCOTERMS: { key: Incoterms; label: string; desc: string }[] = [
  { key: 'FOB', label: 'FOB', desc: 'Seller loads at origin port' },
  { key: 'EXW', label: 'EXW', desc: 'You arrange all shipping (+$300)' },
  { key: 'DDP', label: 'DDP', desc: 'All-in, seller handles customs (+12%)' },
];
const SHIPPING_COUNT_KEY = 'fba_shipping_count_v1';

function ShippingContent() {
  const { tier } = useSubscription();
  const [showPaywall, setShowPaywall] = useState(false);
  const [result,      setResult]      = useState<ShippingResult | null>(null);
  const [refreshing,  setRefreshing]  = useState(false);
  const [showEmail,   setShowEmail]   = useState(false);
  const [emailText,   setEmailText]   = useState('');
  const [copied,      setCopied]      = useState(false);

  const [units, setUnits]       = useState('500');
  const [unitWt, setUnitWt]     = useState('0.3');
  const [unitL, setUnitL]       = useState('20');
  const [unitW, setUnitW]       = useState('15');
  const [unitH, setUnitH]       = useState('5');
  const [cartonUnits, setCartonUnits]   = useState('50');
  const [cartonWt, setCartonWt]         = useState('16');
  const [cartonL, setCartonL]           = useState('60');
  const [cartonW, setCartonW]           = useState('40');
  const [cartonH, setCartonH]           = useState('35');
  const [productCost, setProductCost]   = useState('4.50');
  const [sellingPrice, setSellingPrice] = useState('24.99');
  const [origin, setOrigin]     = useState<ShipOrigin>('CN');
  const [market, setMarket]     = useState<ShipMarket>('US');
  const [incoterms, setIncoterms] = useState<Incoterms>('FOB');
  const [duty, setDuty]   = useState('5');
  const [tariff, setTariff] = useState('0');
  const p = (s: string) => parseFloat(s) || 0;

  const onRefresh = useCallback(async () => {
    setRefreshing(true); setResult(null);
    setTimeout(() => setRefreshing(false), 600);
  }, []);

  async function onCalculate() {
    const raw = await AsyncStorage.getItem(SHIPPING_COUNT_KEY);
    const count = raw ? parseInt(raw, 10) : 0;
    if (tier === 'explorer' && count >= 1) { setShowPaywall(true); return; }
    const inputs: ShippingInputs = {
      units: p(units), unitWeightKg: p(unitWt),
      lengthCm: p(unitL), widthCm: p(unitW), heightCm: p(unitH),
      cartonUnits: p(cartonUnits), cartonWeightKg: p(cartonWt),
      cartonLengthCm: p(cartonL), cartonWidthCm: p(cartonW), cartonHeightCm: p(cartonH),
      productCostUsd: p(productCost), sellingPriceUsd: p(sellingPrice),
      marketplace: market, origin, incoterms, dutyPct: p(duty), tariffPct: p(tariff),
    };
    setResult(calculateShipping(inputs));
    await AsyncStorage.setItem(SHIPPING_COUNT_KEY, String(count + 1));
  }

  function openEmail() {
    if (!result) return;
    const inputs: ShippingInputs = {
      units: p(units), unitWeightKg: p(unitWt),
      lengthCm: p(unitL), widthCm: p(unitW), heightCm: p(unitH),
      cartonUnits: p(cartonUnits), cartonWeightKg: p(cartonWt),
      cartonLengthCm: p(cartonL), cartonWidthCm: p(cartonW), cartonHeightCm: p(cartonH),
      productCostUsd: p(productCost), sellingPriceUsd: p(sellingPrice),
      marketplace: market, origin, incoterms, dutyPct: p(duty), tariffPct: p(tariff),
    };
    setEmailText(buildQuoteEmail(inputs, result));
    setShowEmail(true); setCopied(false);
  }

  const mc = (pct: number) => pct >= 25 ? '#059669' : pct >= 10 ? '#D97706' : '#DC2626';

  return (
    <ScrollView
      contentContainerStyle={fr.scroll}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#0284C7" />}
    >
      <PaywallModal visible={showPaywall} onClose={() => setShowPaywall(false)} featureContext="research" />
      <Modal visible={showEmail} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setShowEmail(false)}>
        <View style={fr.emailSheet}>
          <View style={fr.emailHeader}>
            <Text style={fr.emailTitle}>Quote Email Template</Text>
            <TouchableOpacity onPress={() => setShowEmail(false)}><Text style={fr.emailClose}>✕</Text></TouchableOpacity>
          </View>
          <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 24 }}>
            <Text style={fr.emailBody}>{emailText}</Text>
          </ScrollView>
          <View style={fr.emailFooter}>
            <TouchableOpacity style={fr.copyBtn} onPress={() => { Clipboard.setStringAsync(emailText).catch(() => {}); setCopied(true); setTimeout(() => setCopied(false), 2000); }}>
              <Text style={fr.copyBtnText}>{copied ? '✓ Copied' : 'Copy Email'}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Text style={fr.sectionLabel}>CARGO</Text>
      <View style={fr.card}>
        <View style={fr.row2}><NumInput label="TOTAL UNITS" value={units} onChange={setUnits} /><NumInput label="UNIT WEIGHT" value={unitWt} onChange={setUnitWt} suffix="kg" /></View>
        <Text style={fr.subLabel}>UNIT DIMENSIONS (cm)</Text>
        <View style={fr.row3}><NumInput label="L" value={unitL} onChange={setUnitL} /><NumInput label="W" value={unitW} onChange={setUnitW} /><NumInput label="H" value={unitH} onChange={setUnitH} /></View>
        <Text style={fr.subLabel}>CARTON</Text>
        <View style={fr.row2}><NumInput label="UNITS/CARTON" value={cartonUnits} onChange={setCartonUnits} /><NumInput label="CARTON WEIGHT" value={cartonWt} onChange={setCartonWt} suffix="kg" /></View>
        <Text style={fr.subLabel}>CARTON DIMENSIONS (cm)</Text>
        <View style={fr.row3}><NumInput label="L" value={cartonL} onChange={setCartonL} /><NumInput label="W" value={cartonW} onChange={setCartonW} /><NumInput label="H" value={cartonH} onChange={setCartonH} /></View>
      </View>

      <Text style={fr.sectionLabel}>ECONOMICS</Text>
      <View style={fr.card}>
        <View style={fr.row2}>
          <NumInput label="COST/UNIT" value={productCost} onChange={setProductCost} suffix="$" hint="FOB price from supplier" />
          <NumInput label="SELL PRICE" value={sellingPrice} onChange={setSellingPrice} suffix="$" hint="Amazon listing price" />
        </View>
      </View>

      <Text style={fr.sectionLabel}>ROUTE</Text>
      <View style={fr.card}>
        <Text style={fr.chipLabel}>ORIGIN</Text>
        <View style={fr.chipRow}>{ORIGINS.map(o => (
          <TouchableOpacity key={o.key} style={[fr.chip, origin === o.key && fr.chipOn]} onPress={() => setOrigin(o.key)}>
            <Text style={[fr.chipText, origin === o.key && fr.chipTextOn]}>{o.label}</Text>
          </TouchableOpacity>
        ))}</View>
        <Text style={[fr.chipLabel, { marginTop: 10 }]}>MARKETPLACE</Text>
        <View style={fr.chipRow}>{MARKETS.map(m => (
          <TouchableOpacity key={m.key} style={[fr.chip, market === m.key && fr.chipOn]} onPress={() => setMarket(m.key)}>
            <Text style={[fr.chipText, market === m.key && fr.chipTextOn]}>{m.label}</Text>
          </TouchableOpacity>
        ))}</View>
      </View>

      <Text style={fr.sectionLabel}>TRADE TERMS</Text>
      <View style={fr.card}>
        <Text style={fr.chipLabel}>INCOTERMS</Text>
        <View style={fr.chipRow}>{INCOTERMS.map(t => (
          <TouchableOpacity key={t.key} style={[fr.chip, incoterms === t.key && fr.chipOn]} onPress={() => setIncoterms(t.key)}>
            <Text style={[fr.chipText, incoterms === t.key && fr.chipTextOn]}>{t.label}</Text>
          </TouchableOpacity>
        ))}</View>
        {incoterms && <Text style={ni.hint}>{INCOTERMS.find(t => t.key === incoterms)?.desc}</Text>}
        <View style={[fr.row2, { marginTop: 10 }]}>
          <NumInput label="IMPORT DUTY %" value={duty} onChange={setDuty} hint="Check trade.gov" />
          <NumInput label="TARIFF %" value={tariff} onChange={setTariff} hint="Additional tariff if any" />
        </View>
      </View>

      <TouchableOpacity style={fr.calcBtn} onPress={onCalculate} activeOpacity={0.85}>
        <Text style={fr.calcBtnText}>Calculate Shipping ⛵</Text>
      </TouchableOpacity>
      {tier === 'explorer' && <Text style={fr.freeHint}>Explorer: 1 free calculation. Upgrade for unlimited.</Text>}

      {result && (
        <>
          <HeroStatRow stats={[
            { icon: '◈', value: String(result.cartons), label: 'Cartons' },
            { icon: '⬡', value: result.cbm.toFixed(2),  label: 'Total CBM' },
            { icon: '⊖', value: `${result.totalWeightKg.toFixed(0)} kg`, label: 'Gross Wt' },
          ]} />
          {result.modes.map(mode => (
            <View key={mode.mode} style={fr.modeCard}>
              <View style={fr.modeTop}>
                <Text style={fr.modeIcon}>{mode.icon}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={fr.modeLabel}>{mode.label}</Text>
                  <Text style={fr.modeSub}>{mode.transitDays}</Text>
                </View>
                <View style={[fr.marginBadge, { backgroundColor: `${mc(mode.marginPct)}18` }]}>
                  <Text style={[fr.marginText, { color: mc(mode.marginPct) }]}>{mode.marginPct.toFixed(0)}% margin</Text>
                </View>
              </View>
              <View style={fr.modeStats}>
                {[
                  { val: `$${mode.totalShippingUsd.toFixed(0)}`, label: 'TOTAL FREIGHT' },
                  { val: `$${mode.shippingPerUnit.toFixed(2)}`, label: 'FREIGHT/UNIT' },
                  { val: `$${mode.landedCostPerUnit.toFixed(2)}`, label: 'LANDED/UNIT' },
                  { val: `$${mode.profitPerUnit.toFixed(2)}`, label: 'PROFIT/UNIT', color: mode.profitPerUnit > 0 ? '#059669' : '#DC2626' },
                ].map((s, i) => (
                  <React.Fragment key={i}>
                    {i > 0 && <View style={fr.statDiv} />}
                    <View style={fr.stat}>
                      <Text style={[fr.statVal, s.color ? { color: s.color } : {}]}>{s.val}</Text>
                      <Text style={fr.statLabel}>{s.label}</Text>
                    </View>
                  </React.Fragment>
                ))}
              </View>
              <View style={fr.breakdown}>
                {[
                  { l: 'Product cost', v: `$${parseFloat(productCost || '0').toFixed(2)}` },
                  { l: 'Freight/unit', v: `$${mode.shippingPerUnit.toFixed(2)}` },
                  { l: 'Duty/unit',    v: `$${mode.dutyPerUnit.toFixed(2)}` },
                  { l: 'Tariff/unit',  v: `$${mode.tariffPerUnit.toFixed(2)}` },
                  { l: 'FBA fees',     v: `$${mode.fbaFeePerUnit.toFixed(2)}` },
                ].map(r => (
                  <View key={r.l} style={fr.bdRow}>
                    <Text style={fr.bdLabel}>{r.l}</Text>
                    <Text style={fr.bdVal}>{r.v}</Text>
                  </View>
                ))}
              </View>
            </View>
          ))}
          <InsightCard variant="tip" icon="◎" label="AI RECOMMENDATION" text={result.recommendation} animated />
          <TouchableOpacity style={fr.emailBtn} onPress={openEmail} activeOpacity={0.85}>
            <Text style={fr.emailBtnText}>Generate Quote Email Template →</Text>
          </TouchableOpacity>
        </>
      )}
    </ScrollView>
  );
}

// ─── BackBar ──────────────────────────────────────────────────────────────────

function BackBar({ title, onBack }: { title: string; onBack: () => void }) {
  return (
    <View style={bb.bar}>
      <TouchableOpacity style={bb.backBtn} onPress={onBack} activeOpacity={0.7}>
        <Text style={bb.backArrow}>←</Text>
        <Text style={bb.backText}>Search</Text>
      </TouchableOpacity>
      <Text style={bb.title}>{title}</Text>
    </View>
  );
}
const bb = StyleSheet.create({
  bar: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 12,
    backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#ECF0FB',
    gap: 12,
  },
  backBtn:  { flexDirection: 'row', alignItems: 'center', gap: 4 },
  backArrow:{ fontSize: 16, color: '#0284C7' },
  backText: { fontSize: 14, fontWeight: '700', color: '#0284C7' },
  title:    { fontSize: 16, fontWeight: '800', color: '#0D1B4B', letterSpacing: -0.4 },
});

// ─── SearchHub ────────────────────────────────────────────────────────────────

const TOOLS = [
  { id: 'product' as SearchView,   icon: '◉', label: 'Product Search',    sub: 'Find products on Amazon and analyze their potential.', color: '#0284C7', bg: '#EFF8FF' },
  { id: 'suppliers' as SearchView, icon: '⬡', label: 'Supplier Search',   sub: 'Find and vet reliable suppliers worldwide.',           color: '#D97706', bg: '#FFFBEB' },
  { id: 'shipping' as SearchView,  icon: '⛵', label: 'Shipping & Freight', sub: 'Calculate sea, air and express shipping costs.',       color: '#7C3AED', bg: '#F5F0FF' },
];

function SearchHub({ onSelect }: { onSelect: (v: SearchView) => void }) {
  const [query, setQuery] = useState('');

  function handleSearch() {
    if (query.trim()) onSelect('product');
  }

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: '#F5F7FF' }}
      contentContainerStyle={hub.scroll}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
    >
      {/* Title */}
      <View style={hub.titleBlock}>
        <Text style={hub.pageTitle}>Search</Text>
        <Text style={hub.pageSub}>Find winning products, analyze demand, and discover opportunities.</Text>
      </View>

      {/* Search bar */}
      <View style={hub.searchCard}>
        <View style={hub.searchRow}>
          <TextInput
            style={hub.searchInput}
            placeholder="Search Amazon products…"
            placeholderTextColor="#8196B0"
            value={query}
            onChangeText={setQuery}
            onSubmitEditing={handleSearch}
            returnKeyType="search"
          />
          <TouchableOpacity style={hub.searchBtn} onPress={handleSearch} activeOpacity={0.85}>
            <Text style={hub.searchBtnIcon}>◎</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Tool cards */}
      <View style={hub.sectionHeader}>
        <Text style={hub.sectionTitle}>Search Tools</Text>
      </View>
      <View style={hub.toolList}>
        {TOOLS.map(tool => (
          <TouchableOpacity
            key={tool.id}
            style={hub.toolCard}
            onPress={() => onSelect(tool.id)}
            activeOpacity={0.78}
          >
            <View style={[hub.toolIcon, { backgroundColor: tool.bg }]}>
              <Text style={[hub.toolIconText, { color: tool.color }]}>{tool.icon}</Text>
            </View>
            <View style={hub.toolBody}>
              <Text style={hub.toolLabel}>{tool.label}</Text>
              <Text style={hub.toolSub}>{tool.sub}</Text>
            </View>
            <Text style={[hub.toolArrow, { color: tool.color }]}>›</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Recent Searches */}
      <View style={hub.sectionHeader}>
        <Text style={hub.sectionTitle}>Recent Searches</Text>
        <TouchableOpacity onPress={() => onSelect('product')} activeOpacity={0.7}>
          <Text style={hub.viewAll}>View All</Text>
        </TouchableOpacity>
      </View>
      <View style={hub.recentCard}>
        <Text style={hub.emptyText}>Search a product above to get started.</Text>
      </View>
    </ScrollView>
  );
}

// ─── Main SearchScreen ────────────────────────────────────────────────────────

export default function SearchScreen() {
  const [view, setView] = useState<SearchView>('hub');

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <AppHeader />

      {view === 'hub' ? (
        <SearchHub onSelect={setView} />
      ) : (
        <>
          <BackBar
            title={TOOLS.find(t => t.id === view)?.label ?? ''}
            onBack={() => setView('hub')}
          />
          <View style={{ flex: 1, backgroundColor: '#F5F7FF' }}>
            {view === 'product'   && <ResearchScreen edges={[]} />}
            {view === 'suppliers' && <SuppliersScreen edges={[]} />}
            {view === 'shipping'  && <ShippingContent />}
          </View>
        </>
      )}
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#FFFFFF' },
});

const hub = StyleSheet.create({
  scroll: { paddingBottom: 100 },

  titleBlock: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 16 },
  pageTitle:  { fontSize: 32, fontWeight: '900', color: '#0D1B4B', letterSpacing: -1.2 },
  pageSub:    { fontSize: 14, color: '#5C6B8A', lineHeight: 21, marginTop: 4 },

  searchCard: { marginHorizontal: 20, marginBottom: 8 },
  searchRow:  { flexDirection: 'row', gap: 8 },
  searchInput:{
    flex: 1,
    backgroundColor: '#fff',
    borderWidth: 1, borderColor: '#E0E8F5', borderRadius: 14,
    paddingHorizontal: 16, paddingVertical: 13,
    fontSize: 15, color: '#0D1B4B',
    shadowColor: '#0D1B4B', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05, shadowRadius: 4, elevation: 1,
  },
  searchBtn: {
    width: 50, height: 50, borderRadius: 14,
    backgroundColor: '#0284C7',
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#0284C7', shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25, shadowRadius: 8, elevation: 3,
  },
  searchBtnIcon: { fontSize: 18, color: '#fff' },

  sectionHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 20, paddingTop: 20, paddingBottom: 12,
  },
  sectionTitle: { fontSize: 17, fontWeight: '800', color: '#0D1B4B', letterSpacing: -0.4 },
  viewAll:      { fontSize: 13, fontWeight: '700', color: '#0284C7' },

  toolList: { paddingHorizontal: 20, gap: 10 },
  toolCard: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    backgroundColor: '#fff',
    borderRadius: 18, borderWidth: 1, borderColor: '#ECF0FB',
    padding: 16,
    shadowColor: '#0D1B4B', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05, shadowRadius: 8, elevation: 2,
  },
  toolIcon:     { width: 48, height: 48, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  toolIconText: { fontSize: 20, fontWeight: '700' },
  toolBody:     { flex: 1, gap: 3 },
  toolLabel:    { fontSize: 15, fontWeight: '800', color: '#0D1B4B', letterSpacing: -0.3 },
  toolSub:      { fontSize: 12, color: '#5C6B8A', lineHeight: 17 },
  toolArrow:    { fontSize: 22, fontWeight: '300' },

  recentCard: {
    marginHorizontal: 20, backgroundColor: '#fff',
    borderRadius: 18, borderWidth: 1, borderColor: '#ECF0FB',
    padding: 20, alignItems: 'center',
    shadowColor: '#0D1B4B', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04, shadowRadius: 6, elevation: 1,
  },
  emptyText: { fontSize: 13, color: '#8196B0', textAlign: 'center' },
});

// ─── Freight tab styles ───────────────────────────────────────────────────────

const fr = StyleSheet.create({
  scroll: { paddingHorizontal: 20, paddingBottom: 120, paddingTop: 16, gap: 8 },
  sectionLabel: { fontSize: 9, fontWeight: '800', color: '#8196B0', letterSpacing: 2, marginBottom: 4, marginTop: 8 },
  subLabel:     { fontSize: 8, fontWeight: '700', color: '#8196B0', letterSpacing: 1.5, marginTop: 8, marginBottom: 4 },
  card: { backgroundColor: '#fff', borderRadius: 16, borderWidth: 1, borderColor: '#E0E8F5', padding: 14, gap: 4 },
  row2: { flexDirection: 'row', gap: 10 },
  row3: { flexDirection: 'row', gap: 10 },
  chipLabel:   { fontSize: 8, fontWeight: '800', color: '#8196B0', letterSpacing: 1.5, marginBottom: 6 },
  chipRow:     { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip:        { paddingHorizontal: 10, paddingVertical: 5, borderWidth: 1, borderColor: '#E0E8F5', borderRadius: 999, backgroundColor: '#F4F6FC' },
  chipOn:      { backgroundColor: '#0284C7', borderColor: '#0284C7' },
  chipText:    { fontSize: 12, fontWeight: '600', color: '#5C6B8A' },
  chipTextOn:  { color: '#fff' },
  calcBtn:     { backgroundColor: '#0284C7', borderRadius: 12, paddingVertical: 14, alignItems: 'center', marginTop: 4 },
  calcBtnText: { fontSize: 16, fontWeight: '800', color: '#fff' },
  freeHint:    { fontSize: 11, color: '#8196B0', textAlign: 'center', marginTop: 4 },
  modeCard:    { backgroundColor: '#fff', borderRadius: 16, borderWidth: 1, borderColor: '#E0E8F5', overflow: 'hidden', marginTop: 8 },
  modeTop:     { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 14, borderBottomWidth: 1, borderBottomColor: '#E0E8F5' },
  modeIcon:    { fontSize: 22 },
  modeLabel:   { fontSize: 15, fontWeight: '800', color: '#0D1B4B' },
  modeSub:     { fontSize: 11, color: '#8196B0', marginTop: 2 },
  marginBadge: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  marginText:  { fontSize: 11, fontWeight: '800' },
  modeStats:   { flexDirection: 'row', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#E0E8F5' },
  stat:        { flex: 1, alignItems: 'center', gap: 3 },
  statDiv:     { width: 1, backgroundColor: '#E0E8F5' },
  statVal:     { fontSize: 14, fontWeight: '800', color: '#0D1B4B' },
  statLabel:   { fontSize: 7, fontWeight: '700', color: '#8196B0', letterSpacing: 1.2 },
  breakdown:   { padding: 14, gap: 5 },
  bdRow:       { flexDirection: 'row', justifyContent: 'space-between' },
  bdLabel:     { fontSize: 12, color: '#5C6B8A' },
  bdVal:       { fontSize: 12, fontWeight: '700', color: '#0D1B4B' },
  emailBtn:    { borderWidth: 1, borderColor: '#E0E8F5', borderRadius: 12, paddingVertical: 12, alignItems: 'center', backgroundColor: '#fff', marginTop: 8 },
  emailBtnText:{ fontSize: 13, fontWeight: '700', color: '#0284C7' },
  emailSheet:  { flex: 1, backgroundColor: '#F5F7FF' },
  emailHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, borderBottomWidth: 1, borderBottomColor: '#E0E8F5' },
  emailTitle:  { fontSize: 17, fontWeight: '800', color: '#0D1B4B' },
  emailClose:  { fontSize: 20, color: '#8196B0' },
  emailBody:   { fontSize: 12, color: '#5C6B8A', lineHeight: 19, fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace' },
  emailFooter: { padding: 20, borderTopWidth: 1, borderTopColor: '#E0E8F5' },
  copyBtn:     { backgroundColor: '#0284C7', borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  copyBtnText: { fontSize: 15, fontWeight: '800', color: '#fff' },
});
