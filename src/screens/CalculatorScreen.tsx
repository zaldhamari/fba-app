import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity,
  ScrollView, ActivityIndicator, KeyboardTypeOptions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, typography, spacing, radius } from '../theme';
import { api, FBAResult } from '../services/api';
import { SimulateResult } from '../types';
import { useCurrency } from '../context/CurrencyContext';
import { CurrencySelector } from '../components/CurrencySelector';
import { InsightCard } from '../components/ui';

const CATEGORIES = ['all', 'electronics', 'home', 'kitchen', 'sports', 'beauty', 'clothing', 'tools'];
type Mode = 'fees' | 'landed' | 'freight' | 'cashflow' | 'ppc' | 'breakeven' | 'scenario' | 'ranking' | 'reorder' | 'simulate' | 'bsr';

function Field({
  label, value, onChange, placeholder, keyboard = 'decimal-pad', badge,
}: {
  label: string; value: string; onChange: (v: string) => void;
  placeholder: string; keyboard?: KeyboardTypeOptions; badge?: string;
}) {
  return (
    <View style={f.group}>
      <View style={f.labelRow}>
        <Text style={f.label}>{label}</Text>
        {badge && <View style={f.badge}><Text style={f.badgeText}>{badge}</Text></View>}
      </View>
      <TextInput
        style={f.input}
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor={colors.gray400}
        keyboardType={keyboard}
      />
    </View>
  );
}
const f = StyleSheet.create({
  group: { flex: 1, minWidth: 100 },
  labelRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: spacing.xs },
  label: { fontSize: 9, fontWeight: '700' as const, color: colors.textMuted, letterSpacing: 1.5 },
  badge: { backgroundColor: '#7C3AED', borderRadius: radius.full, paddingHorizontal: 5, paddingVertical: 1 },
  badgeText: { fontSize: 7, fontWeight: '800', color: colors.white, letterSpacing: 0.5 },
  input: {
    borderWidth: 1, borderColor: colors.border, borderRadius: radius.md,
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm + 2, fontSize: 15, color: colors.textPrimary,
    backgroundColor: colors.bgElevated,
  },
});

function calcBoxSize(unitL: number, unitW: number, unitH: number, qty: number) {
  const dims = [unitL, unitW, unitH].sort((a, b) => b - a);
  const cr = Math.cbrt(qty);
  const nx = Math.max(1, Math.round(cr));
  const ny = Math.max(1, Math.round(cr));
  const nz = Math.max(1, Math.ceil(qty / (nx * ny)));
  return {
    boxL: parseFloat(Math.min(25, dims[0] * nx + 2).toFixed(1)),
    boxW: parseFloat(Math.min(25, dims[1] * ny + 2).toFixed(1)),
    boxH: parseFloat(Math.min(25, dims[2] * nz + 2).toFixed(1)),
  };
}

// ─── FBA Fees Tab ────────────────────────────────────────────────────────────
function FeesTab() {
  const [price, setPrice] = useState('');
  const [cost, setCost] = useState('');
  const [weight, setWeight] = useState('');
  const [quantity, setQuantity] = useState('');
  const [length, setLength] = useState('');
  const [width, setWidth] = useState('');
  const [height, setHeight] = useState('');
  const [boxL, setBoxL] = useState('');
  const [boxW, setBoxW] = useState('');
  const [boxH, setBoxH] = useState('');
  const [boxAutoFilled, setBoxAutoFilled] = useState(false);
  const [category, setCategory] = useState('all');
  const [result, setResult] = useState<FBAResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const { fmt, symbol, toUSD } = useCurrency();

  useEffect(() => {
    const l = parseFloat(length), w = parseFloat(width), h = parseFloat(height);
    const qty = parseInt(quantity);
    if (l > 0 && w > 0 && h > 0 && qty > 0) {
      const box = calcBoxSize(l, w, h, qty);
      setBoxL(String(box.boxL)); setBoxW(String(box.boxW)); setBoxH(String(box.boxH));
      setBoxAutoFilled(true);
    } else setBoxAutoFilled(false);
  }, [length, width, height, quantity]);

  async function calculate() {
    if (!price || !cost || !weight) return;
    setLoading(true); setError('');
    try {
      const data = await api.calculateFBA({
        product_name: 'My Product',
        selling_price: toUSD(parseFloat(price)),
        supplier_cost: toUSD(parseFloat(cost)),
        weight_lbs: parseFloat(weight),
        dimensions: { length: parseFloat(length) || 8, width: parseFloat(width) || 6, height: parseFloat(height) || 2 },
        category,
      });
      setResult(data);
    } catch (e: any) { setError(e.message || 'Calculation failed.'); }
    finally { setLoading(false); }
  }

  const verdictColor = (v: string) =>
    v === 'Excellent' || v === 'Good' ? colors.green : v === 'Marginal' ? colors.orange : colors.red;

  const qty = parseInt(quantity) || 0;
  const totalWeight = qty > 0 && weight ? parseFloat(weight) * qty : null;
  const boxesNeeded = totalWeight ? Math.ceil(totalWeight / 50) : null;

  return (
    <ScrollView contentContainerStyle={t.scroll} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
      <View style={t.tabGuide}>
        <Text style={t.tabGuideText}>Aim for 30%+ margin and 50%+ ROI — below these, FBA rarely makes sense.</Text>
      </View>
      <View style={t.section}>
        <View style={t.row}>
          <Field label={`SELLING PRICE (${symbol})`} value={price} onChange={setPrice} placeholder="29.99" />
          <Field label={`SUPPLIER COST (${symbol})`} value={cost} onChange={setCost} placeholder="5.00" />
        </View>
        <View style={t.row}>
          <Field label="WEIGHT (LBS)" value={weight} onChange={setWeight} placeholder="0.5" />
          <Field label="QUANTITY" value={quantity} onChange={setQuantity} placeholder="100" keyboard="number-pad" />
        </View>
        <View style={t.row}>
          <Field label='UNIT L (")' value={length} onChange={setLength} placeholder="10" />
          <Field label='UNIT W (")' value={width} onChange={setWidth} placeholder="6" />
          <Field label='UNIT H (")' value={height} onChange={setHeight} placeholder="2" />
        </View>
      </View>

      <View style={t.boxSection}>
        <View style={t.boxHeader}>
          <Text style={t.boxLabel}>SHIPPING BOX</Text>
          {boxAutoFilled && <View style={t.autoBadge}><Text style={t.autoText}>AUTO</Text></View>}
        </View>
        <View style={t.row}>
          <Field label='BOX L (")' value={boxL} onChange={setBoxL} placeholder="—" badge={boxAutoFilled ? 'AUTO' : undefined} />
          <Field label='BOX W (")' value={boxW} onChange={setBoxW} placeholder="—" badge={boxAutoFilled ? 'AUTO' : undefined} />
          <Field label='BOX H (")' value={boxH} onChange={setBoxH} placeholder="—" badge={boxAutoFilled ? 'AUTO' : undefined} />
        </View>
        {totalWeight !== null && (
          <View style={t.shipRow}>
            <View style={t.shipStat}><Text style={t.shipNum}>{qty}</Text><Text style={t.shipLabel}>UNITS</Text></View>
            <View style={t.shipDiv} />
            <View style={t.shipStat}><Text style={t.shipNum}>{totalWeight.toFixed(1)} lbs</Text><Text style={t.shipLabel}>TOTAL WT</Text></View>
            <View style={t.shipDiv} />
            <View style={t.shipStat}><Text style={t.shipNum}>{boxesNeeded}</Text><Text style={t.shipLabel}>{boxesNeeded === 1 ? 'BOX' : 'BOXES'}</Text></View>
          </View>
        )}
      </View>

      <View style={t.catSection}>
        <Text style={t.catLabel}>CATEGORY</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={t.catRow}>
          {CATEGORIES.map(c => (
            <TouchableOpacity key={c} style={[t.catChip, category === c && t.catChipActive]} onPress={() => setCategory(c)}>
              <Text style={[t.catChipText, category === c && t.catChipTextActive]}>{c.charAt(0).toUpperCase() + c.slice(1)}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      <TouchableOpacity style={[t.btn, loading && { opacity: 0.5 }]} onPress={calculate} disabled={loading} activeOpacity={0.8}>
        {loading ? <ActivityIndicator color={colors.white} size="small" /> : <Text style={t.btnText}>Calculate Fees</Text>}
      </TouchableOpacity>

      {!!error && <Text style={t.error}>{error}</Text>}

      {result && (
        <View style={t.results}>
          <View style={[t.profitCard, { borderColor: verdictColor(result.verdict) }]}>
            <Text style={t.profitLabel}>NET PROFIT / UNIT</Text>
            <Text style={[t.profitNum, { color: result.profit > 0 ? colors.green : colors.red }]}>{fmt(result.profit)}</Text>
            <View style={t.profitMeta}>
              <Text style={[t.verdict, { color: verdictColor(result.verdict) }]}>{result.verdict.toUpperCase()}</Text>
              <Text style={t.profitStat}>Margin: {result.margin_pct}%</Text>
              <Text style={t.profitStat}>ROI: {result.roi_pct}%</Text>
            </View>
            {qty > 0 && (
              <View style={t.batchRow}>
                <Text style={t.batchText}>Batch profit ({qty} units): </Text>
                <Text style={[t.batchNum, { color: result.profit * qty > 0 ? colors.green : colors.red }]}>
                  {fmt(result.profit * qty)}
                </Text>
              </View>
            )}
          </View>

          <View style={t.breakdown}>
            {[
              ['Selling Price', fmt(result.selling_price), false],
              ['Supplier Cost', `-${fmt(result.supplier_cost)}`, true],
              ['Referral Fee', `-${fmt(result.fees.referral_fee)}`, true],
              ['FBA Fulfillment', `-${fmt(result.fees.fulfillment_fee)}`, true],
              ['Storage / mo', `-${fmt(result.fees.monthly_storage)}`, true],
            ].map(([label, val, isDeduct]) => (
              <View key={label as string} style={t.feeRow}>
                <Text style={t.feeLabel}>{label as string}</Text>
                <Text style={[t.feeVal, (isDeduct as boolean) && { color: colors.gray600 }]}>{val as string}</Text>
              </View>
            ))}
            <View style={[t.feeRow, { borderBottomWidth: 0 }]}>
              <Text style={[t.feeLabel, { fontWeight: '700', color: colors.textPrimary }]}>Total Fees</Text>
              <Text style={[t.feeVal, { color: colors.red }]}>-{fmt(result.fees.total_fees)}</Text>
            </View>
          </View>

          {boxL && boxW && boxH && (
            <View style={t.shipCard}>
              <Text style={t.shipCardTitle}>SHIPMENT SUMMARY</Text>
              {[
                ['Box size', `${boxL}" × ${boxW}" × ${boxH}"`],
                totalWeight ? ['Total weight', `${totalWeight.toFixed(1)} lbs`] : null,
                boxesNeeded ? ['Boxes needed', `${boxesNeeded} × 50 lb max`] : null,
                ['Size tier', result.size_tier.replace('_', ' ')],
                ['Billable weight', `${result.billable_weight_lbs} lbs`],
              ].filter((x): x is [string, string] => x !== null).map(([label, val]) => (
                <View key={label as string} style={t.shipCardRow}>
                  <Text style={t.shipCardLabel}>{label as string}</Text>
                  <Text style={t.shipCardVal}>{val as string}</Text>
                </View>
              ))}
            </View>
          )}
        </View>
      )}
    </ScrollView>
  );
}

// ─── Freight Tab ─────────────────────────────────────────────────────────────
function FreightTab() {
  const { fmt } = useCurrency();
  const [weight, setWeight] = useState('');
  const [quantity, setQuantity] = useState('');
  const [calculated, setCalculated] = useState(false);

  const wt = parseFloat(weight) || 0;
  const qty = parseInt(quantity) || 0;
  const totalKg = wt * qty * 0.453592;

  const methods = [
    { name: 'Sea Freight (LCL)', days: '25–35 days', rateKg: 9,  icon: '🚢', color: '#7C3AED' },
    { name: 'Air Freight',        days: '5–7 days',   rateKg: 8,  icon: '✈️', color: colors.orange },
    { name: 'Express (DHL/FedEx)',days: '3–5 days',   rateKg: 16, icon: '⚡', color: colors.red },
  ];

  function calculate() {
    if (!weight || !quantity) return;
    setCalculated(true);
  }

  return (
    <ScrollView contentContainerStyle={t.scroll} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
      <View style={t.section}>
        <View style={t.row}>
          <Field label="UNIT WEIGHT (LBS)" value={weight} onChange={setWeight} placeholder="0.5" />
          <Field label="QUANTITY (UNITS)" value={quantity} onChange={setQuantity} placeholder="500" keyboard="number-pad" />
        </View>
        {wt > 0 && qty > 0 && (
          <View style={t.infoRow}>
            <Text style={t.infoText}>Total shipment: {totalKg.toFixed(1)} kg ({(wt * qty).toFixed(1)} lbs)</Text>
          </View>
        )}
      </View>

      <TouchableOpacity style={t.btn} onPress={calculate} activeOpacity={0.8}>
        <Text style={t.btnText}>Estimate Freight</Text>
      </TouchableOpacity>

      {calculated && totalKg > 0 && (
        <View style={t.results}>
          <Text style={t.sectionHeader}>SHIPPING OPTIONS — {qty} units from China</Text>
          {methods.map(m => {
            const total = totalKg * m.rateKg;
            const perUnit = qty > 0 ? total / qty : 0;
            return (
              <View key={m.name} style={[t.freightCard, { borderLeftColor: m.color, borderLeftWidth: 4 }]}>
                <View style={t.freightTop}>
                  <Text style={t.freightIcon}>{m.icon}</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={t.freightName}>{m.name}</Text>
                    <Text style={t.freightDays}>{m.days}</Text>
                  </View>
                </View>
                <View style={t.freightNums}>
                  <View style={t.freightStat}>
                    <Text style={t.freightNum}>{fmt(total, 0)}</Text>
                    <Text style={t.freightStatLabel}>TOTAL COST</Text>
                  </View>
                  <View style={t.freightDivider} />
                  <View style={t.freightStat}>
                    <Text style={t.freightNum}>{fmt(perUnit)}</Text>
                    <Text style={t.freightStatLabel}>PER UNIT</Text>
                  </View>
                  <View style={t.freightDivider} />
                  <View style={t.freightStat}>
                    <Text style={t.freightNum}>{fmt(m.rateKg)}/kg</Text>
                    <Text style={t.freightStatLabel}>RATE</Text>
                  </View>
                </View>
              </View>
            );
          })}
          <View style={t.freightNote}>
            <Text style={t.freightNoteText}>Estimates only. Actual rates vary by carrier, incoterms, and destination warehouse.</Text>
          </View>
        </View>
      )}
    </ScrollView>
  );
}

// ─── PPC Tab ──────────────────────────────────────────────────────────────────
function PPCTab() {
  const { symbol } = useCurrency();
  const [price, setPrice] = useState('');
  const [dailyUnits, setDailyUnits] = useState('');
  const [acos, setAcos] = useState('30');
  const [cpc, setCpc] = useState('0.75');
  const [calculated, setCalculated] = useState(false);

  const sellingPrice = parseFloat(price) || 0;
  const units = parseFloat(dailyUnits) || 0;
  const acosNum = parseFloat(acos) || 30;
  const cpcNum = parseFloat(cpc) || 0.75;

  const dailyRevenue = sellingPrice * units;
  const dailyBudget = dailyRevenue * (acosNum / 100);
  const dailyClicks = cpcNum > 0 ? dailyBudget / cpcNum : 0;
  const monthlySpend = dailyBudget * 30;
  const ctr = 0.03;
  const dailyImpressions = dailyClicks / ctr;

  function calculate() {
    if (!price || !dailyUnits) return;
    setCalculated(true);
  }

  const acosColor = acosNum <= 25 ? colors.green : acosNum <= 40 ? colors.orange : colors.red;

  return (
    <ScrollView contentContainerStyle={t.scroll} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
      <View style={t.section}>
        <View style={t.row}>
          <Field label={`SELLING PRICE (${symbol})`} value={price} onChange={setPrice} placeholder="29.99" />
          <Field label="TARGET DAILY SALES" value={dailyUnits} onChange={setDailyUnits} placeholder="10" keyboard="number-pad" />
        </View>
        <View style={t.row}>
          <Field label="TARGET ACoS (%)" value={acos} onChange={setAcos} placeholder="30" />
          <Field label={`AVG CPC (${symbol})`} value={cpc} onChange={setCpc} placeholder="0.75" />
        </View>
        <View style={t.acosHint}>
          <Text style={[t.acosHintText, { color: acosColor }]}>
            ACoS {acosNum}% — {acosNum <= 25 ? 'Excellent' : acosNum <= 40 ? 'Moderate' : 'High spend'}
          </Text>
        </View>
      </View>

      <TouchableOpacity style={t.btn} onPress={calculate} activeOpacity={0.8}>
        <Text style={t.btnText}>Calculate PPC Budget</Text>
      </TouchableOpacity>

      {calculated && sellingPrice > 0 && units > 0 && (
        <View style={t.results}>
          <View style={t.ppcHero}>
            <Text style={t.ppcHeroLabel}>DAILY AD BUDGET</Text>
            <Text style={t.ppcHeroNum}>{symbol}{dailyBudget.toFixed(2)}</Text>
            <Text style={t.ppcHeroSub}>to sell {units} units/day at {acosNum}% ACoS</Text>
          </View>

          <View style={t.breakdown}>
            {[
              ['Daily revenue target', `${symbol}${dailyRevenue.toFixed(2)}`],
              ['Daily ad spend', `${symbol}${dailyBudget.toFixed(2)}`],
              ['Monthly ad spend', `${symbol}${monthlySpend.toFixed(0)}`],
              ['Est. clicks/day', `${dailyClicks.toFixed(0)}`],
              ['Est. impressions/day', `${dailyImpressions.toFixed(0)}`],
              ['Suggested max bid', `${symbol}${cpcNum.toFixed(2)}`],
            ].map(([label, val]) => (
              <View key={label} style={t.feeRow}>
                <Text style={t.feeLabel}>{label}</Text>
                <Text style={t.feeVal}>{val}</Text>
              </View>
            ))}
          </View>

          <View style={t.ppcTips}>
            <Text style={t.ppcTipsTitle}>LAUNCH TIPS</Text>
            {[
              'Start bids 20% above suggested — lower after data comes in',
              'Run Sponsored Products (auto campaign) first week',
              'Add negative keywords weekly to cut wasted spend',
              'Target ACoS < 30% for profitable scaling',
            ].map((tip, i) => (
              <View key={i} style={t.ppcTip}>
                <Text style={t.ppcTipDot}>·</Text>
                <Text style={t.ppcTipText}>{tip}</Text>
              </View>
            ))}
          </View>
        </View>
      )}
    </ScrollView>
  );
}

// ─── Break-even Tab ───────────────────────────────────────────────────────────
function BreakevenTab() {
  const { symbol } = useCurrency();
  const [price, setPrice] = useState('');
  const [costPerUnit, setCostPerUnit] = useState('');
  const [fbaFees, setFbaFees] = useState('');
  const [startupCost, setStartupCost] = useState('');
  const [monthlyFixed, setMonthlyFixed] = useState('');
  const [monthlySales, setMonthlySales] = useState('');
  const [calculated, setCalculated] = useState(false);

  const p = parseFloat(price) || 0;
  const cpu = parseFloat(costPerUnit) || 0;
  const fees = parseFloat(fbaFees) || 0;
  const startup = parseFloat(startupCost) || 0;
  const fixed = parseFloat(monthlyFixed) || 0;
  const sales = parseFloat(monthlySales) || 0;

  const profitPerUnit = p - cpu - fees;
  const breakevenUnits = profitPerUnit > 0 ? Math.ceil(startup / profitPerUnit) : 0;
  const monthlyBreakevenUnits = profitPerUnit > 0 ? Math.ceil(fixed / profitPerUnit) : 0;
  const monthsToBreakeven = sales > 0 && profitPerUnit > 0
    ? (startup / (sales * profitPerUnit - fixed)).toFixed(1)
    : null;
  const roiPct = cpu > 0 ? ((profitPerUnit / cpu) * 100).toFixed(0) : '—';

  function calculate() {
    if (!price || !costPerUnit) return;
    setCalculated(true);
  }

  return (
    <ScrollView contentContainerStyle={t.scroll} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
      <View style={t.tabGuide}>
        <Text style={t.tabGuideText}>Most successful FBA products break even within 90 days — use this to confirm yours will too.</Text>
      </View>
      <View style={t.section}>
        <View style={t.row}>
          <Field label={`SELLING PRICE (${symbol})`} value={price} onChange={setPrice} placeholder="29.99" />
          <Field label={`COST PER UNIT (${symbol})`} value={costPerUnit} onChange={setCostPerUnit} placeholder="5.00" />
        </View>
        <View style={t.row}>
          <Field label={`FBA FEES (${symbol})`} value={fbaFees} onChange={setFbaFees} placeholder="6.50" />
          <Field label={`STARTUP COSTS (${symbol})`} value={startupCost} onChange={setStartupCost} placeholder="3000" />
        </View>
        <View style={t.row}>
          <Field label={`MONTHLY FIXED (${symbol})`} value={monthlyFixed} onChange={setMonthlyFixed} placeholder="500" />
          <Field label="EST. MONTHLY SALES" value={monthlySales} onChange={setMonthlySales} placeholder="200" keyboard="number-pad" />
        </View>
      </View>

      <TouchableOpacity style={t.btn} onPress={calculate} activeOpacity={0.8}>
        <Text style={t.btnText}>Calculate Break-even</Text>
      </TouchableOpacity>

      {calculated && p > 0 && cpu > 0 && (
        <View style={t.results}>
          <View style={[t.profitCard, { borderColor: profitPerUnit > 0 ? colors.green : colors.red }]}>
            <Text style={t.profitLabel}>PROFIT PER UNIT</Text>
            <Text style={[t.profitNum, { color: profitPerUnit > 0 ? colors.green : colors.red }]}>
              {symbol}{profitPerUnit.toFixed(2)}
            </Text>
            <View style={t.profitMeta}>
              <Text style={t.profitStat}>ROI: {roiPct}%</Text>
              <Text style={t.profitStat}>Margin: {p > 0 ? ((profitPerUnit / p) * 100).toFixed(0) : 0}%</Text>
            </View>
          </View>

          <View style={t.breakdown}>
            {[
              ['Units to recover startup', breakevenUnits > 0 ? `${breakevenUnits} units` : 'N/A'],
              ['Units/mo to cover fixed costs', monthlyBreakevenUnits > 0 ? `${monthlyBreakevenUnits} units` : 'N/A'],
              ['Months to break even', monthsToBreakeven ? `${monthsToBreakeven} months` : 'Enter monthly sales'],
              ['Revenue at break-even', breakevenUnits > 0 ? `${symbol}${(breakevenUnits * p).toFixed(0)}` : 'N/A'],
            ].map(([label, val]) => (
              <View key={label} style={t.feeRow}>
                <Text style={t.feeLabel}>{label}</Text>
                <Text style={t.feeVal}>{val}</Text>
              </View>
            ))}
          </View>

          <View style={t.ppcTips}>
            <Text style={t.ppcTipsTitle}>COST BREAKDOWN</Text>
            {[
              ['Selling price', `${symbol}${p.toFixed(2)}`],
              ['Supplier cost', `-${symbol}${cpu.toFixed(2)}`],
              ['FBA fees', `-${symbol}${fees.toFixed(2)}`],
              ['Net profit/unit', `${symbol}${profitPerUnit.toFixed(2)}`],
            ].map(([label, val]) => (
              <View key={label} style={[t.feeRow, { borderBottomWidth: 0, paddingHorizontal: 0 }]}>
                <Text style={t.feeLabel}>{label}</Text>
                <Text style={[t.feeVal, label === 'Net profit/unit' && { color: profitPerUnit > 0 ? colors.green : colors.red }]}>{val}</Text>
              </View>
            ))}
          </View>
        </View>
      )}
    </ScrollView>
  );
}

// ─── Reorder Tab ──────────────────────────────────────────────────────────────
function ReorderTab() {
  const [inventory, setInventory] = useState('');
  const [dailySales, setDailySales] = useState('');
  const [leadTime, setLeadTime] = useState('30');
  const [safetyDays, setSafetyDays] = useState('15');
  const [reorderQty, setReorderQty] = useState('');
  const [calculated, setCalculated] = useState(false);

  const inv = parseFloat(inventory) || 0;
  const daily = parseFloat(dailySales) || 0;
  const lead = parseFloat(leadTime) || 30;
  const safety = parseFloat(safetyDays) || 15;
  const targetQty = parseFloat(reorderQty) || 0;

  const daysLeft = daily > 0 ? Math.floor(inv / daily) : 0;
  const reorderPoint = lead + safety;
  const shouldReorderNow = daysLeft <= reorderPoint;
  const daysUntilReorder = Math.max(0, daysLeft - reorderPoint);
  const suggestedQty = targetQty > 0 ? targetQty : daily * 90;

  const status = daysLeft === 0 ? 'OUT' : daysLeft <= lead ? 'CRITICAL' : daysLeft <= reorderPoint ? 'ORDER NOW' : daysUntilReorder <= 14 ? 'ORDER SOON' : 'OK';
  const statusColor = status === 'OK' ? colors.green : status === 'ORDER SOON' ? colors.orange : colors.red;

  function calculate() {
    if (!inventory || !dailySales) return;
    setCalculated(true);
  }

  return (
    <ScrollView contentContainerStyle={t.scroll} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
      <View style={t.tabGuide}>
        <Text style={t.tabGuideText}>Running out of stock wipes your Amazon ranking — it can take weeks to recover.</Text>
      </View>
      <View style={t.section}>
        <View style={t.row}>
          <Field label="CURRENT INVENTORY" value={inventory} onChange={setInventory} placeholder="500" keyboard="number-pad" />
          <Field label="DAILY SALES (UNITS)" value={dailySales} onChange={setDailySales} placeholder="10" keyboard="number-pad" />
        </View>
        <View style={t.row}>
          <Field label="LEAD TIME (DAYS)" value={leadTime} onChange={setLeadTime} placeholder="30" keyboard="number-pad" />
          <Field label="SAFETY STOCK (DAYS)" value={safetyDays} onChange={setSafetyDays} placeholder="15" keyboard="number-pad" />
        </View>
        <View style={t.row}>
          <Field label="REORDER QTY (optional)" value={reorderQty} onChange={setReorderQty} placeholder="auto (90-day)" keyboard="number-pad" />
        </View>
      </View>

      <TouchableOpacity style={t.btn} onPress={calculate} activeOpacity={0.8}>
        <Text style={t.btnText}>Calculate Reorder</Text>
      </TouchableOpacity>

      {calculated && inv > 0 && daily > 0 && (
        <View style={t.results}>
          <View style={[t.profitCard, { borderColor: statusColor }]}>
            <Text style={t.profitLabel}>INVENTORY STATUS</Text>
            <Text style={[t.profitNum, { color: statusColor, fontSize: 36 }]}>{status}</Text>
            <Text style={t.profitStat}>{daysLeft} days of stock remaining</Text>
          </View>

          <View style={t.breakdown}>
            {[
              ['Current inventory', `${inv.toFixed(0)} units`],
              ['Daily sales velocity', `${daily.toFixed(0)} units/day`],
              ['Days of stock left', `${daysLeft} days`],
              ['Reorder point', `${reorderPoint} days before stockout`],
              ['Days until reorder needed', daysUntilReorder > 0 ? `${daysUntilReorder} days` : 'Reorder now'],
              ['Suggested reorder qty', `${suggestedQty.toFixed(0)} units (90-day supply)`],
            ].map(([label, val]) => (
              <View key={label} style={t.feeRow}>
                <Text style={t.feeLabel}>{label}</Text>
                <Text style={[t.feeVal, label === 'Days until reorder needed' && daysUntilReorder === 0 && { color: colors.red }]}>{val}</Text>
              </View>
            ))}
          </View>

          <View style={t.ppcTips}>
            <Text style={t.ppcTipsTitle}>REORDER FORMULA</Text>
            {[
              'Reorder Point = Lead Time + Safety Stock days',
              `Your reorder point: ${lead} + ${safety} = ${reorderPoint} days`,
              `At ${daily} units/day, order when you have ${(reorderPoint * daily).toFixed(0)} units left`,
              'Safety stock protects against supplier delays and sales spikes',
            ].map((tip, i) => (
              <View key={i} style={t.ppcTip}>
                <Text style={t.ppcTipDot}>·</Text>
                <Text style={t.ppcTipText}>{tip}</Text>
              </View>
            ))}
          </View>
        </View>
      )}
    </ScrollView>
  );
}

// ─── Landed Cost Tab ──────────────────────────────────────────────────────────
const DUTY_RATES = [
  { label: 'General / Mixed',    rate: 0.075 },
  { label: 'Kitchen & Home',     rate: 0.075 },
  { label: 'Electronics',        rate: 0.15  },
  { label: 'Clothing & Textiles',rate: 0.27  },
  { label: 'Sporting Goods',     rate: 0.10  },
  { label: 'Tools & Hardware',   rate: 0.09  },
  { label: 'Beauty & Health',    rate: 0.10  },
  { label: 'Pet Supplies',       rate: 0.075 },
  { label: 'Toys & Games',       rate: 0.00  },
  { label: 'Baby Products',      rate: 0.00  },
];
const FREIGHT_OPTS = [
  { label: 'Sea (25–35d)',   rateKg: 9,  icon: '🚢' },
  { label: 'Air (5–7d)',     rateKg: 8,  icon: '✈️' },
  { label: 'Express (3–5d)', rateKg: 16, icon: '⚡' },
];

function LandedTab() {
  const { symbol, fromUSD } = useCurrency();
  const [unitCost, setUnitCost] = useState('');
  const [quantity, setQuantity] = useState('');
  const [weight, setWeight] = useState('');
  const [freightIdx, setFreightIdx] = useState(0);
  const [dutyIdx, setDutyIdx] = useState(0);
  const [prepCost, setPrepCost] = useState('0.50');
  const [photoBudget, setPhotoBudget] = useState('400');
  const [calculated, setCalculated] = useState(false);

  const cpu = parseFloat(unitCost) || 0;
  const qty = parseInt(quantity) || 0;
  const wt = parseFloat(weight) || 0;
  const totalKg = wt * qty * 0.453592;
  const freightTotal = totalKg * FREIGHT_OPTS[freightIdx].rateKg;
  const freightPerUnit = fromUSD(qty > 0 ? freightTotal / qty : 0);
  const dutyRate = DUTY_RATES[dutyIdx].rate;
  const dutyPerUnit = cpu * dutyRate;
  const prep = parseFloat(prepCost) || 0;
  const photoPerUnit = qty > 0 ? (parseFloat(photoBudget) || 0) / qty : 0;
  const trueCost = cpu + freightPerUnit + dutyPerUnit + prep + photoPerUnit;
  const totalInvestment = trueCost * qty;

  const rows = [
    { label: 'Supplier cost (FOB)',                         val: cpu },
    { label: `Freight — ${FREIGHT_OPTS[freightIdx].label}`, val: freightPerUnit },
    { label: `Import duty (${(dutyRate*100).toFixed(0)}%)`, val: dutyPerUnit },
    { label: 'FBA prep',                                    val: prep },
    { label: 'Photography (amortized)',                     val: photoPerUnit },
  ];

  return (
    <ScrollView contentContainerStyle={t.scroll} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
      <View style={t.tabGuide}>
        <Text style={t.tabGuideText}>FOB is the factory price. Add freight, duty, prep & photography to get your real cost.</Text>
      </View>
      <View style={t.section}>
        <View style={t.row}>
          <Field label={`UNIT COST / FOB (${symbol})`} value={unitCost} onChange={setUnitCost} placeholder="5.00" />
          <Field label="ORDER QUANTITY"       value={quantity} onChange={setQuantity} placeholder="500" keyboard="number-pad" />
        </View>
        <View style={t.row}>
          <Field label="UNIT WEIGHT (LBS)" value={weight} onChange={setWeight} placeholder="0.5" />
        </View>
      </View>

      <View style={t.catSection}>
        <Text style={t.catLabel}>FREIGHT METHOD</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={t.catRow}>
          {FREIGHT_OPTS.map((m, i) => (
            <TouchableOpacity key={i} style={[t.catChip, freightIdx === i && t.catChipActive]} onPress={() => setFreightIdx(i)}>
              <Text style={[t.catChipText, freightIdx === i && t.catChipTextActive]}>{m.icon} {m.label}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      <View style={t.catSection}>
        <Text style={t.catLabel}>PRODUCT TYPE (CHINA IMPORT DUTY)</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={t.catRow}>
          {DUTY_RATES.map((d, i) => (
            <TouchableOpacity key={i} style={[t.catChip, dutyIdx === i && t.catChipActive]} onPress={() => setDutyIdx(i)}>
              <Text style={[t.catChipText, dutyIdx === i && t.catChipTextActive]}>{d.label} {(d.rate*100).toFixed(0)}%</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      <View style={t.section}>
        <View style={t.row}>
          <Field label={`FBA PREP (${symbol}/UNIT)`} value={prepCost}    onChange={setPrepCost}    placeholder="0.50" />
          <Field label={`PHOTOGRAPHY (${symbol})`}   value={photoBudget} onChange={setPhotoBudget} placeholder="400"  />
        </View>
      </View>

      <TouchableOpacity style={[t.btn, (!unitCost || !quantity) && { opacity: 0.4 }]} onPress={() => { if (cpu && qty) setCalculated(true); }} activeOpacity={0.8}>
        <Text style={t.btnText}>Calculate Landed Cost</Text>
      </TouchableOpacity>

      {calculated && cpu > 0 && qty > 0 && (
        <View style={t.results}>
          <View style={[t.profitCard, { borderColor: colors.border }]}>
            <Text style={t.profitLabel}>TRUE COST PER UNIT</Text>
            <Text style={[t.profitNum, { color: colors.textPrimary }]}>{symbol}{trueCost.toFixed(2)}</Text>
            <Text style={t.profitStat}>vs supplier quote {symbol}{cpu.toFixed(2)} — {cpu > 0 ? ((trueCost/cpu-1)*100).toFixed(0) : 0}% higher</Text>
            <View style={t.batchRow}>
              <Text style={t.batchText}>Total capital needed ({qty} units): </Text>
              <Text style={t.batchNum}>{symbol}{totalInvestment.toFixed(0)}</Text>
            </View>
          </View>

          <View style={t.breakdown}>
            {rows.map(({ label, val }) => (
              <View key={label} style={t.feeRow}>
                <View style={{ flex: 1 }}>
                  <Text style={t.feeLabel}>{label}</Text>
                  <View style={{ height: 3, backgroundColor: colors.bgElevated, borderRadius: 2, marginTop: 4 }}>
                    <View style={{ width: Math.min(200, trueCost > 0 ? (val/trueCost)*200 : 0), height: 3, backgroundColor: '#7C3AED', borderRadius: 2 }} />
                  </View>
                </View>
                <Text style={[t.feeVal, { marginLeft: spacing.md }]}>{symbol}{val.toFixed(2)}</Text>
              </View>
            ))}
            <View style={[t.feeRow, { borderBottomWidth: 0, backgroundColor: colors.bgElevated }]}>
              <Text style={[t.feeLabel, { fontWeight: '800', color: colors.textPrimary }]}>True cost / unit</Text>
              <Text style={[t.feeVal, { color: '#7C3AED' }]}>{symbol}{trueCost.toFixed(2)}</Text>
            </View>
          </View>

          <View style={t.ppcTips}>
            <Text style={t.ppcTipsTitle}>DUTY NOTES</Text>
            {[
              `${DUTY_RATES[dutyIdx].label}: ${(dutyRate*100).toFixed(0)}% Section 301 tariff applies to China imports`,
              'Duty is calculated on FOB value — the factory price, not landed price',
              'Use DDP incoterms so your supplier handles customs and you pay one price',
              'Photography cost amortizes over first order only — drops to zero on reorders',
            ].map((tip, i) => (
              <View key={i} style={t.ppcTip}>
                <Text style={t.ppcTipDot}>·</Text>
                <Text style={t.ppcTipText}>{tip}</Text>
              </View>
            ))}
          </View>
        </View>
      )}
    </ScrollView>
  );
}

// ─── Cash Flow Tab ─────────────────────────────────────────────────────────────
function CashFlowTab() {
  const { symbol } = useCurrency();
  const [capital, setCapital]       = useState('');
  const [unitCost, setUnitCost]     = useState('');
  const [moq, setMoq]               = useState('');
  const [price, setPrice]           = useState('');
  const [monthlySales, setMonthlySales] = useState('');
  const [dailyPPC, setDailyPPC]     = useState('20');
  const [calculated, setCalculated] = useState(false);

  const cap     = parseFloat(capital)      || 0;
  const cpu     = parseFloat(unitCost)     || 0;
  const qty     = parseInt(moq)            || 0;
  const p       = parseFloat(price)        || 0;
  const monthly = parseInt(monthlySales)   || 0;
  const ppc     = parseFloat(dailyPPC)     || 0;

  const initialOrder      = cpu * qty;
  const netPerUnit        = p - p * 0.15 - 3.50;
  const monthlyRevenue    = monthly * p;
  const monthlyAmazonNet  = monthly * netPerUnit - ppc * 30;
  const dailySales        = monthly / 30;
  const stockDays         = dailySales > 0 ? Math.floor(qty / dailySales) : 999;
  const reorderMonth      = Math.max(2, Math.floor((stockDays - 45) / 30));
  const ready             = cap > 0 && cpu > 0 && qty > 0 && p > 0 && monthly > 0;

  type Row = { month: number; revenue: number; payout: number; reorderCost: number; cash: number };
  function buildFlow(): Row[] {
    const rows: Row[] = [];
    let cash = cap - initialOrder;
    for (let m = 1; m <= 6; m++) {
      const payout      = m === 1 ? monthlyAmazonNet * 0.5 : monthlyAmazonNet;
      const reorderCost = m === reorderMonth ? initialOrder : 0;
      cash = cash + payout - reorderCost;
      rows.push({ month: m, revenue: monthlyRevenue, payout, reorderCost, cash });
    }
    return rows;
  }

  const flow      = calculated && ready ? buildFlow() : null;
  const minCash   = flow ? Math.min(...flow.map(r => r.cash)) : 0;
  const needsMore = minCash < 0;

  return (
    <ScrollView contentContainerStyle={t.scroll} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
      <View style={t.tabGuide}>
        <Text style={t.tabGuideText}>Most FBA sellers hit a cash crunch in month 3 when reorder meets PPC spend — see it coming.</Text>
      </View>
      <View style={t.section}>
        <View style={t.row}>
          <Field label={`STARTING CAPITAL (${symbol})`} value={capital}  onChange={setCapital}  placeholder="5000" />
          <Field label={`UNIT COST (${symbol})`}         value={unitCost} onChange={setUnitCost} placeholder="5.00" />
        </View>
        <View style={t.row}>
          <Field label="ORDER QTY (MOQ)"    value={moq}   onChange={setMoq}   placeholder="500" keyboard="number-pad" />
          <Field label={`SELLING PRICE (${symbol})`}  value={price} onChange={setPrice} placeholder="29.99" />
        </View>
        <View style={t.row}>
          <Field label="MONTHLY SALES (UNITS)" value={monthlySales} onChange={setMonthlySales} placeholder="100" keyboard="number-pad" />
          <Field label={`DAILY PPC (${symbol})`}          value={dailyPPC}    onChange={setDailyPPC}    placeholder="20" />
        </View>
      </View>

      <TouchableOpacity style={[t.btn, !ready && { opacity: 0.4 }]} onPress={() => { if (ready) setCalculated(true); }} activeOpacity={0.8}>
        <Text style={t.btnText}>Project Cash Flow</Text>
      </TouchableOpacity>

      {flow && (
        <View style={t.results}>
          <View style={[t.profitCard, { borderColor: needsMore ? colors.red : colors.green }]}>
            <Text style={t.profitLabel}>{needsMore ? 'CASH SHORTFALL' : '6-MONTH OUTLOOK'}</Text>
            <Text style={[t.profitNum, { color: needsMore ? colors.red : colors.green }]}>
              {needsMore ? `-${symbol}${Math.abs(minCash).toFixed(0)}` : `${symbol}${flow[5].cash.toFixed(0)}`}
            </Text>
            <Text style={t.profitStat}>
              {needsMore ? 'Extra capital needed to avoid running out' : 'Projected balance at end of month 6'}
            </Text>
          </View>

          <View style={t.breakdown}>
            <View style={[t.feeRow, { backgroundColor: colors.bgElevated }]}>
              <Text style={[t.feeLabel, { color: colors.textPrimary, fontWeight: '700', flex: 1.5 }]}>Month</Text>
              <Text style={[t.feeVal, { color: colors.textPrimary }]}>Revenue</Text>
              <Text style={[t.feeVal, { color: colors.textPrimary, marginLeft: 8 }]}>Balance</Text>
            </View>
            {flow.map(row => (
              <View key={row.month} style={[t.feeRow, row.cash < 0 && { backgroundColor: colors.redLight }]}>
                <Text style={[t.feeLabel, { flex: 1.5 }]}>Month {row.month}{row.reorderCost > 0 ? '  🔄' : ''}</Text>
                <Text style={t.feeVal}>{symbol}{row.revenue.toFixed(0)}</Text>
                <Text style={[t.feeVal, { marginLeft: 8, color: row.cash < 0 ? colors.red : colors.green }]}>
                  {row.cash < 0 ? '-' : ''}{symbol}{Math.abs(row.cash).toFixed(0)}
                </Text>
              </View>
            ))}
          </View>

          <View style={t.ppcTips}>
            <Text style={t.ppcTipsTitle}>HOW TO READ THIS</Text>
            {[
              '🔄 = reorder month — your cash drops sharply, plan ahead',
              'Amazon pays every 14 days, shown as ~50% in month 1 then full',
              `Reorder scheduled for month ${reorderMonth} based on your sales velocity`,
              needsMore
                ? `You need ${symbol}${Math.abs(minCash).toFixed(0)} more starting capital to avoid a shortfall`
                : 'Your capital covers 6 months at this sales rate — you are viable',
            ].map((tip, i) => (
              <View key={i} style={t.ppcTip}>
                <Text style={t.ppcTipDot}>·</Text>
                <Text style={t.ppcTipText}>{tip}</Text>
              </View>
            ))}
          </View>
        </View>
      )}
    </ScrollView>
  );
}

// ─── Ranking Tab ───────────────────────────────────────────────────────────────
const RANK_CATS = [
  { label: 'Home & Kitchen',  multiplier: 3200, page1BSR: 2000 },
  { label: 'Sports & Outdoors', multiplier: 2800, page1BSR: 1500 },
  { label: 'Beauty',          multiplier: 2500, page1BSR: 1000 },
  { label: 'Electronics',     multiplier: 4000, page1BSR: 3000 },
  { label: 'Clothing',        multiplier: 2000, page1BSR: 500  },
  { label: 'Toys & Games',    multiplier: 2200, page1BSR: 1000 },
  { label: 'Tools',           multiplier: 1800, page1BSR: 800  },
  { label: 'Pet Supplies',    multiplier: 2600, page1BSR: 1200 },
];

function RankingTab() {
  const { symbol } = useCurrency();
  const [price, setPrice]             = useState('');
  const [organicDaily, setOrganicDaily] = useState('0');
  const [catIdx, setCatIdx]           = useState(0);
  const [targetRank, setTargetRank]   = useState<'page1' | 'top20' | 'top10'>('page1');
  const [calculated, setCalculated]   = useState(false);

  const p       = parseFloat(price) || 0;
  const organic = parseFloat(organicDaily) || 0;
  const cat     = RANK_CATS[catIdx];
  const bsrMap  = { top10: cat.page1BSR * 0.4, top20: cat.page1BSR * 0.7, page1: cat.page1BSR };
  const targetBSR     = bsrMap[targetRank];
  const targetMonthly = Math.round(cat.multiplier * Math.pow(targetBSR, -0.7));
  const targetDaily   = Math.ceil(targetMonthly / 30);
  const ppcUnits      = Math.max(0, targetDaily - organic);
  const ppcPerDay     = (ppcUnits / 0.10) * 0.80;
  const ppc30Day      = ppcPerDay * 30;
  const monthlyRevenue = targetMonthly * p;

  return (
    <ScrollView contentContainerStyle={t.scroll} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
      <View style={t.section}>
        <View style={t.row}>
          <Field label={`SELLING PRICE (${symbol})`}   value={price}        onChange={setPrice}        placeholder="29.99" />
          <Field label="ORGANIC DAILY SALES"    value={organicDaily} onChange={setOrganicDaily} placeholder="0" keyboard="number-pad" />
        </View>
      </View>

      <View style={t.catSection}>
        <Text style={t.catLabel}>CATEGORY</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={t.catRow}>
          {RANK_CATS.map((c, i) => (
            <TouchableOpacity key={i} style={[t.catChip, catIdx === i && t.catChipActive]} onPress={() => setCatIdx(i)}>
              <Text style={[t.catChipText, catIdx === i && t.catChipTextActive]}>{c.label}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      <View style={t.section}>
        <Text style={[t.catLabel, { paddingHorizontal: 0, marginBottom: spacing.sm }]}>TARGET POSITION</Text>
        <View style={t.row}>
          {([['page1','Page 1'],['top10','Top 10'],['top20','Top 20']] as const).map(([key, label]) => (
            <TouchableOpacity key={key} style={[t.catChip, targetRank === key && t.catChipActive, { flex: 1, alignItems: 'center' }]} onPress={() => setTargetRank(key)}>
              <Text style={[t.catChipText, targetRank === key && t.catChipTextActive]}>{label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <TouchableOpacity style={t.btn} onPress={() => { if (price) setCalculated(true); }} activeOpacity={0.8}>
        <Text style={t.btnText}>Calculate Ranking Cost</Text>
      </TouchableOpacity>

      {calculated && p > 0 && (
        <View style={t.results}>
          <View style={[t.profitCard, { borderColor: 'rgba(124,58,237,0.22)' }]}>
            <Text style={t.profitLabel}>30-DAY PPC TO RANK</Text>
            <Text style={[t.profitNum, { color: '#7C3AED' }]}>{symbol}{ppc30Day.toFixed(0)}</Text>
            <Text style={t.profitStat}>{symbol}{ppcPerDay.toFixed(2)}/day for 30 days</Text>
          </View>

          <View style={t.breakdown}>
            {[
              ['Target position',          targetRank === 'page1' ? 'Page 1' : targetRank.replace('top','Top ')],
              ['Target BSR',               Math.round(targetBSR).toLocaleString()],
              ['Daily velocity needed',    `${targetDaily} units/day`],
              ['Your organic sales',       `${organic} units/day`],
              ['PPC units needed/day',     `${ppcUnits} units`],
              ['Est. daily PPC spend',     `${symbol}${ppcPerDay.toFixed(2)}`],
              ['30-day ranking investment',`${symbol}${ppc30Day.toFixed(0)}`],
              ['Monthly revenue once ranked', p > 0 ? `${symbol}${monthlyRevenue.toFixed(0)}` : '—'],
            ].map(([label, val]) => (
              <View key={label} style={t.feeRow}>
                <Text style={t.feeLabel}>{label}</Text>
                <Text style={t.feeVal}>{val}</Text>
              </View>
            ))}
          </View>

          <View style={t.ppcTips}>
            <Text style={t.ppcTipsTitle}>RANKING STRATEGY</Text>
            {[
              'Sustain this velocity for 30+ days — Amazon ranks on consistency, not spikes',
              'Start with auto campaigns week 1, then move to exact-match for top 5 keywords',
              'First 30 days is your "honeymoon" — Amazon boosts new listings, maximise it',
              'Add a 20% launch coupon to spike conversion rate and accelerate BSR climb',
              `At ${targetMonthly} units/month, your ${symbol}${ppc30Day.toFixed(0)} investment pays back in ~${p > 0 && targetMonthly > 0 ? (ppc30Day / (targetMonthly * p * 0.2)).toFixed(1) : '?'} months`,
            ].map((tip, i) => (
              <View key={i} style={t.ppcTip}>
                <Text style={t.ppcTipDot}>·</Text>
                <Text style={t.ppcTipText}>{tip}</Text>
              </View>
            ))}
          </View>
        </View>
      )}
    </ScrollView>
  );
}

// ─── What-if / Scenario Tab ────────────────────────────────────────────────────
function ScenarioTab() {
  const { symbol } = useCurrency();
  const [basePrice, setBasePrice]   = useState('');
  const [baseCost, setBaseCost]     = useState('');
  const [baseFees, setBaseFees]     = useState('');
  const [baseUnits, setBaseUnits]   = useState('');
  const [priceChg, setPriceChg]     = useState('-10');
  const [costChg, setCostChg]       = useState('20');
  const [calculated, setCalculated] = useState(false);

  const bp = parseFloat(basePrice) || 0;
  const bc = parseFloat(baseCost)  || 0;
  const bf = parseFloat(baseFees)  || 0;
  const bu = parseInt(baseUnits)   || 0;
  const pc = parseFloat(priceChg)  || 0;
  const cc = parseFloat(costChg)   || 0;

  const baseProfit  = bp - bc - bf;
  const baseMargin  = bp > 0 ? (baseProfit / bp) * 100 : 0;
  const baseMonthly = baseProfit * bu;

  const sPrice   = bp * (1 + pc / 100);
  const sCost    = bc * (1 + cc / 100);
  const sProfit  = sPrice - sCost - bf;
  const sMargin  = sPrice > 0 ? (sProfit / sPrice) * 100 : 0;
  const sMonthly = sProfit * bu;

  const sensitivity = [-10, -5, 0, 5, 10].map(pct => {
    const sp = bp * (1 + pct / 100);
    const profit = sp - bc - bf;
    return { pct, price: sp, profit, margin: sp > 0 ? (profit / sp) * 100 : 0 };
  });

  return (
    <ScrollView contentContainerStyle={t.scroll} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
      <View style={t.section}>
        <Text style={[t.catLabel, { paddingHorizontal: 0, marginBottom: spacing.xs }]}>BASE CASE</Text>
        <View style={t.row}>
          <Field label={`SELLING PRICE (${symbol})`} value={basePrice} onChange={setBasePrice} placeholder="29.99" />
          <Field label={`UNIT COST (${symbol})`}     value={baseCost}  onChange={setBaseCost}  placeholder="5.00" />
        </View>
        <View style={t.row}>
          <Field label={`TOTAL FEES (${symbol})`}  value={baseFees}  onChange={setBaseFees}  placeholder="6.50" />
          <Field label="MONTHLY UNITS"   value={baseUnits} onChange={setBaseUnits} placeholder="100" keyboard="number-pad" />
        </View>
      </View>

      <View style={t.section}>
        <Text style={[t.catLabel, { paddingHorizontal: 0, marginBottom: spacing.xs }]}>SCENARIO — % CHANGE</Text>
        <View style={t.row}>
          <Field label="PRICE CHANGE (%)" value={priceChg} onChange={setPriceChg} placeholder="-10" />
          <Field label="COST CHANGE (%)"  value={costChg}  onChange={setCostChg}  placeholder="+20" />
        </View>
        <View style={t.infoRow}>
          <Text style={t.infoText}>e.g. price -10 = competitor undercuts you · cost +20 = supplier raises price</Text>
        </View>
      </View>

      <TouchableOpacity style={[t.btn, (!basePrice || !baseCost) && { opacity: 0.4 }]} onPress={() => { if (bp && bc) setCalculated(true); }} activeOpacity={0.8}>
        <Text style={t.btnText}>Run Scenario</Text>
      </TouchableOpacity>

      {calculated && bp > 0 && bc > 0 && (
        <View style={t.results}>
          <View style={{ flexDirection: 'row', gap: spacing.sm }}>
            {[
              { label: 'BASE CASE', profit: baseProfit, margin: baseMargin, monthly: baseMonthly },
              { label: 'SCENARIO',  profit: sProfit,    margin: sMargin,    monthly: sMonthly    },
            ].map(({ label, profit, margin, monthly }) => (
              <View key={label} style={[t.profitCard, { flex: 1, gap: 4, borderColor: profit > 0 ? colors.green : colors.red }]}>
                <Text style={[t.profitLabel, { fontSize: 8 }]}>{label}</Text>
                <Text style={[t.profitNum, { fontSize: 30, color: profit > 0 ? colors.green : colors.red }]}>{symbol}{profit.toFixed(2)}</Text>
                <Text style={t.profitStat}>{margin.toFixed(0)}% margin</Text>
                <Text style={[t.profitStat, { color: monthly < 0 ? colors.red : colors.gray600 }]}>{symbol}{monthly.toFixed(0)}/mo</Text>
              </View>
            ))}
          </View>

          <View style={t.breakdown}>
            {[
              ['Profit change / unit',   `${sProfit-baseProfit >= 0 ? '+' : ''}${symbol}${(sProfit-baseProfit).toFixed(2)}`],
              ['Monthly profit change',  `${sMonthly-baseMonthly >= 0 ? '+' : ''}${symbol}${(sMonthly-baseMonthly).toFixed(0)}`],
              ['Scenario price',         `${symbol}${sPrice.toFixed(2)}`],
              ['Scenario unit cost',     `${symbol}${sCost.toFixed(2)}`],
              ['New margin',             `${sMargin.toFixed(1)}%`],
              ['Still viable?',          sProfit > 0 ? 'Yes' : 'No — below break-even'],
            ].map(([label, val]) => (
              <View key={label} style={t.feeRow}>
                <Text style={t.feeLabel}>{label}</Text>
                <Text style={[t.feeVal, label === 'Still viable?' && { color: sProfit > 0 ? colors.green : colors.red }]}>{val}</Text>
              </View>
            ))}
          </View>

          <View style={t.breakdown}>
            <View style={[t.feeRow, { backgroundColor: colors.bgElevated }]}>
              <Text style={[t.feeLabel, { color: colors.textPrimary, fontWeight: '700', flex: 1.5 }]}>Price</Text>
              <Text style={[t.feeVal, { color: colors.textPrimary }]}>Profit</Text>
              <Text style={[t.feeVal, { color: colors.textPrimary, marginLeft: 8 }]}>Margin</Text>
            </View>
            {sensitivity.map(row => (
              <View key={row.pct} style={[t.feeRow, row.pct === 0 && { backgroundColor: colors.bgElevated }]}>
                <Text style={[t.feeLabel, { flex: 1.5 }, row.pct === 0 && { fontWeight: '700' }]}>
                  {symbol}{row.price.toFixed(2)}{row.pct === 0 ? ' base' : ` (${row.pct > 0 ? '+' : ''}${row.pct}%)`}
                </Text>
                <Text style={[t.feeVal, { color: row.profit > 0 ? colors.green : colors.red }]}>{symbol}{row.profit.toFixed(2)}</Text>
                <Text style={[t.feeVal, { marginLeft: 8 }]}>{row.margin.toFixed(0)}%</Text>
              </View>
            ))}
          </View>
        </View>
      )}
    </ScrollView>
  );
}

// ─── Simulate Tab ─────────────────────────────────────────────────────────────
function SimulateTab() {
  const { fmt, symbol, toUSD } = useCurrency();
  const [cost, setCost]   = useState('');
  const [weight, setWeight] = useState('');
  const [units, setUnits] = useState('150');
  const [cat, setCat]     = useState('all');
  const [result, setResult] = useState<SimulateResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function run() {
    if (!cost) return;
    setLoading(true); setError(''); setResult(null);
    try {
      const data = await api.simulateProfit({
        supplier_cost: toUSD(parseFloat(cost)),
        weight_lbs: weight ? parseFloat(weight) : 1.0,
        category: cat,
        monthly_units_est: parseInt(units) || 150,
      });
      setResult(data as any);
    } catch (e: any) { setError(e.message || 'Simulation failed.'); }
    finally { setLoading(false); }
  }

  const sweetSpot = result?.sweet_spot;

  return (
    <ScrollView contentContainerStyle={sim.scroll} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
      <View style={sim.form}>
        <View style={{ flexDirection: 'row', gap: spacing.sm }}>
          <Field label={`SUPPLIER COST (${symbol})`} value={cost} onChange={setCost} placeholder="e.g. 6.00" />
          <Field label="WEIGHT (lbs)" value={weight} onChange={setWeight} placeholder="e.g. 0.8" />
        </View>
        <Field label="MONTHLY UNITS" value={units} onChange={setUnits} placeholder="150" />
        <View>
          <Text style={sim.label}>CATEGORY</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {['All', 'Kitchen', 'Electronics', 'Beauty', 'Sports', 'Home', 'Tools'].map(c => (
              <TouchableOpacity key={c} style={[sim.catChip, cat === c.toLowerCase() && sim.catChipActive]} onPress={() => setCat(c.toLowerCase())}>
                <Text style={[sim.catText, cat === c.toLowerCase() && sim.catTextActive]}>{c}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
        <TouchableOpacity style={[t.btn, loading && { opacity: 0.5 }]} onPress={run} disabled={loading} activeOpacity={0.8}>
          {loading ? <ActivityIndicator color={colors.white} size="small" /> : <Text style={t.btnText}>Run Simulation ⚡</Text>}
        </TouchableOpacity>
        {!!error && <Text style={{ color: colors.red, fontSize: 12, marginTop: 4 }}>{error}</Text>}
      </View>

      {result && (
        <>
          {sweetSpot && (
            <View style={sim.sweetCard}>
              <Text style={sim.sweetLabel}>SWEET SPOT</Text>
              <Text style={sim.sweetPrice}>{fmt(sweetSpot.price)}</Text>
              <Text style={sim.sweetSub}>{sweetSpot.margin_pct}% margin · {fmt(sweetSpot.monthly_profit)}/mo profit · {sweetSpot.verdict}</Text>
            </View>
          )}

          <Text style={sim.sectionTitle}>ALL PRICE SCENARIOS</Text>
          {result.scenarios.map((sc, i) => (
            <View key={i} style={[sim.row, !sc.viable && { opacity: 0.45 }]}>
              <View style={sim.rowLeft}>
                <Text style={sim.rowPrice}>{fmt(sc.price)}</Text>
                <Text style={sim.rowMargin}>{sc.margin_pct}% margin</Text>
              </View>
              <View style={sim.rowMid}>
                <Text style={sim.rowStat}>+{fmt(sc.profit_per_unit)}/unit</Text>
                <Text style={sim.rowStatSub}>after PPC: {fmt(sc.profit_after_ppc)}</Text>
              </View>
              <View style={sim.rowRight}>
                <Text style={[sim.rowMonth, { color: sc.viable ? colors.green : colors.textMuted }]}>
                  {fmt(sc.monthly_profit)}/mo
                </Text>
              </View>
            </View>
          ))}

          <Text style={[sim.sectionTitle, { marginTop: spacing.md }]}>SHIPPING OPTIONS</Text>
          {result.shipping_scenarios.map((sh, i) => (
            <View key={i} style={sim.shipRow}>
              <Text style={sim.shipMethod}>{sh.method}</Text>
              <Text style={sim.shipDays}>{sh.transit_days} days</Text>
              <Text style={sim.shipCost}>{fmt(sh.cost_per_unit)}/unit</Text>
              <Text style={[sim.shipImpact, { color: colors.red }]}>{sh.impact_on_margin}</Text>
            </View>
          ))}
        </>
      )}
    </ScrollView>
  );
}

const sim = StyleSheet.create({
  scroll: { padding: spacing.md, paddingBottom: 80, gap: spacing.sm },
  form: { backgroundColor: colors.bgCard, borderRadius: radius.lg, padding: spacing.md, gap: spacing.sm, borderWidth: 1, borderColor: colors.border },
  label: { fontSize: 9, fontWeight: '700' as const, color: colors.textMuted, letterSpacing: 1.5, marginBottom: spacing.xs },
  catChip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: radius.full, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.bgCard },
  catChipActive: { backgroundColor: '#7C3AED', borderColor: '#7C3AED' },
  catText: { fontSize: 12, fontWeight: '500' as const, color: colors.textSecondary },
  catTextActive: { color: '#fff', fontWeight: '600' as const },
  sweetCard: { backgroundColor: 'rgba(124,58,237,0.08)', borderRadius: radius.lg, padding: spacing.md, borderWidth: 1.5, borderColor: 'rgba(124,58,237,0.22)', alignItems: 'center', gap: 4 },
  sweetLabel: { fontSize: 9, fontWeight: '800' as const, color: '#7C3AED', letterSpacing: 2 },
  sweetPrice: { fontSize: 36, fontWeight: '900' as const, color: '#7C3AED', letterSpacing: -1 },
  sweetSub: { fontSize: 12, color: colors.textSecondary, textAlign: 'center' },
  sectionTitle: { fontSize: 9, fontWeight: '800' as const, color: colors.textMuted, letterSpacing: 1.5 },
  row: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.bgCard, borderRadius: radius.md, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderWidth: 1, borderColor: colors.border },
  rowLeft: { width: 64 },
  rowPrice: { fontSize: 14, fontWeight: '800' as const, color: colors.textPrimary },
  rowMargin: { fontSize: 10, color: colors.textMuted, marginTop: 1 },
  rowMid: { flex: 1, paddingHorizontal: spacing.sm },
  rowStat: { fontSize: 12, fontWeight: '700' as const, color: colors.textPrimary },
  rowStatSub: { fontSize: 10, color: colors.textMuted },
  rowRight: { alignItems: 'flex-end' },
  rowMonth: { fontSize: 13, fontWeight: '800' as const },
  shipRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.bgCard, borderRadius: radius.md, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderWidth: 1, borderColor: colors.border },
  shipMethod: { flex: 1, fontSize: 12, fontWeight: '700' as const, color: colors.textPrimary },
  shipDays: { fontSize: 11, color: colors.textMuted, marginRight: spacing.sm },
  shipCost: { fontSize: 12, fontWeight: '700' as const, color: colors.textSecondary, marginRight: spacing.sm },
  shipImpact: { fontSize: 11, fontWeight: '700' as const },
});

// ─── BSR Estimator Tab ───────────────────────────────────────────────────────
const BSR_CATEGORIES = [
  { label: 'Home & Kitchen', multiplier: 3200 },
  { label: 'Sports & Outdoors', multiplier: 2800 },
  { label: 'Beauty', multiplier: 2500 },
  { label: 'Electronics', multiplier: 4000 },
  { label: 'Clothing', multiplier: 2000 },
  { label: 'Toys & Games', multiplier: 2200 },
  { label: 'Tools', multiplier: 1800 },
  { label: 'Pet Supplies', multiplier: 2600 },
];

function BSRTab() {
  const { symbol } = useCurrency();
  const [bsr, setBsr] = useState('');
  const [price, setPrice] = useState('');
  const [catIdx, setCatIdx] = useState(0);
  const [result, setResult] = useState<{ monthly: number; daily: number; revenue: number } | null>(null);
  const scrollRef = useRef<ScrollView>(null);

  function estimate() {
    const b = parseInt(bsr);
    if (!b || b <= 0) return;
    const { multiplier } = BSR_CATEGORIES[catIdx];
    const monthly = Math.max(1, Math.round(multiplier * Math.pow(b, -0.7)));
    const daily = Math.max(1, Math.round(monthly / 30));
    const p = parseFloat(price) || 0;
    setResult({ monthly, daily, revenue: p * monthly });
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 150);
  }

  const compLevel = result
    ? result.monthly >= 500 ? 'High demand' : result.monthly >= 100 ? 'Moderate demand' : 'Low demand'
    : '';
  const compColor = result
    ? result.monthly >= 500 ? colors.green : result.monthly >= 100 ? colors.amber : colors.red
    : colors.textPrimary;

  return (
    <ScrollView ref={scrollRef} contentContainerStyle={bsrS.scroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
      <View style={bsrS.inputs}>
        <View style={bsrS.row}>
          <View style={bsrS.field}>
            <Text style={bsrS.label}>BEST SELLER RANK</Text>
            <TextInput
              style={bsrS.input} value={bsr} onChangeText={setBsr}
              placeholder="e.g. 5000" placeholderTextColor={colors.gray400}
              keyboardType="number-pad"
            />
          </View>
          <View style={bsrS.field}>
            <Text style={bsrS.label}>{`SELLING PRICE (${symbol})`}</Text>
            <TextInput
              style={bsrS.input} value={price} onChangeText={setPrice}
              placeholder="29.99" placeholderTextColor={colors.gray400}
              keyboardType="decimal-pad"
            />
          </View>
        </View>
        <Text style={bsrS.label}>CATEGORY</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View style={{ flexDirection: 'row', gap: spacing.sm }}>
            {BSR_CATEGORIES.map((c, i) => (
              <TouchableOpacity key={i} style={[bsrS.chip, catIdx === i && bsrS.chipActive]} onPress={() => setCatIdx(i)}>
                <Text style={[bsrS.chipText, catIdx === i && bsrS.chipTextActive]}>{c.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </ScrollView>
        <TouchableOpacity style={bsrS.btn} onPress={estimate} activeOpacity={0.8}>
          <Text style={bsrS.btnText}>Estimate Sales</Text>
        </TouchableOpacity>
      </View>

      {result && (
        <View style={bsrS.results}>
          <View style={bsrS.heroCard}>
            <Text style={bsrS.heroLabel}>EST. MONTHLY SALES</Text>
            <Text style={bsrS.heroNum}>{result.monthly.toLocaleString()}</Text>
            <Text style={[bsrS.demandLabel, { color: compColor }]}>{compLevel}</Text>
          </View>
          <View style={bsrS.statsRow}>
            {[
              ['Daily Sales',     `~${result.daily} units`],
              ['Monthly Revenue', result.revenue > 0 ? `${symbol}${result.revenue.toLocaleString(undefined, { maximumFractionDigits: 0 })}` : '—'],
              ['Category',        BSR_CATEGORIES[catIdx].label],
            ].map(([label, val]) => (
              <View key={label} style={bsrS.stat}>
                <Text style={bsrS.statVal}>{val}</Text>
                <Text style={bsrS.statLabel}>{label}</Text>
              </View>
            ))}
          </View>
          <View style={bsrS.note}>
            <Text style={bsrS.noteText}>Estimates based on category averages. Actual sales vary by season, listing quality, and PPC.</Text>
          </View>
        </View>
      )}
    </ScrollView>
  );
}

const bsrS = StyleSheet.create({
  scroll:  { padding: spacing.lg, gap: spacing.md, paddingBottom: 120 },
  inputs:  { gap: spacing.sm },
  row:     { flexDirection: 'row', gap: spacing.sm },
  field:   { flex: 1 },
  label:   { fontSize: 9, fontWeight: '800' as const, color: colors.textMuted, letterSpacing: 1.5, marginBottom: spacing.xs },
  input: {
    borderWidth: 1, borderColor: colors.border, borderRadius: radius.md,
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm + 2,
    fontSize: 15, color: colors.textPrimary, backgroundColor: colors.bgElevated,
  },
  chip: {
    paddingHorizontal: spacing.md, paddingVertical: spacing.xs + 2,
    borderWidth: 1, borderColor: colors.border, borderRadius: radius.full,
    backgroundColor: colors.bgCard,
  },
  chipActive:     { backgroundColor: '#7C3AED', borderColor: '#7C3AED' },
  chipText:       { fontSize: 12, fontWeight: '700' as const, color: colors.textSecondary },
  chipTextActive: { color: colors.white },
  btn: {
    backgroundColor: '#7C3AED', borderRadius: radius.md,
    paddingVertical: spacing.md, alignItems: 'center' as const,
  },
  btnText:    { fontSize: 16, fontWeight: '800' as const, color: colors.bg },
  results:    { gap: spacing.md },
  heroCard: {
    backgroundColor: colors.bgCard, borderRadius: radius.lg,
    padding: spacing.lg, alignItems: 'center' as const, gap: spacing.xs,
    borderWidth: 1, borderColor: 'rgba(124,58,237,0.22)',
  },
  heroLabel:   { fontSize: 9, fontWeight: '800' as const, color: colors.textMuted, letterSpacing: 1.5 },
  heroNum:     { fontSize: 56, fontWeight: '800' as const, color: colors.textPrimary, letterSpacing: -2 },
  demandLabel: { fontSize: 13, fontWeight: '700' as const, letterSpacing: 0.5 },
  statsRow: {
    flexDirection: 'row' as const, backgroundColor: colors.bgCard,
    borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, overflow: 'hidden' as const,
  },
  stat:      { flex: 1, alignItems: 'center' as const, padding: spacing.md },
  statVal:   { fontSize: 13, fontWeight: '800' as const, color: colors.textPrimary },
  statLabel: { fontSize: 8, fontWeight: '700' as const, color: colors.textMuted, letterSpacing: 1, marginTop: 3 },
  note:      { padding: spacing.md, backgroundColor: colors.bgElevated, borderRadius: radius.md },
  noteText:  { fontSize: 12, color: colors.textMuted, textAlign: 'center' as const, lineHeight: 18 },
});

// ─── Main Screen ──────────────────────────────────────────────────────────────

import { AppHeader } from '../components/AppHeader';

type CalcView = 'hub' | Mode;

const CALC_TOOLS: { id: Mode; icon: string; label: string; sub: string; color: string; bg: string }[] = [
  { id: 'fees',      icon: '◈', label: 'FBA Fees',     sub: 'Profit, margin & ROI',          color: '#7C3AED', bg: '#F5F0FF' },
  { id: 'simulate',  icon: '⊛', label: 'Simulate',     sub: 'Price sweet-spot scenarios',     color: '#0284C7', bg: '#EFF8FF' },
  { id: 'landed',    icon: '⊞', label: 'Landed Cost',  sub: 'True cost per unit',             color: '#D97706', bg: '#FFFBEB' },
  { id: 'cashflow',  icon: '⊟', label: 'Cash Flow',    sub: 'Capital timing insights',        color: '#059669', bg: '#F0FDF4' },
  { id: 'ppc',       icon: '◎', label: 'PPC Budget',   sub: 'Daily ad spend estimate',        color: '#DB2777', bg: '#FDF2F8' },
  { id: 'breakeven', icon: '⊕', label: 'Break-even',   sub: 'Sales to pay off investment',    color: '#0284C7', bg: '#EFF8FF' },
  { id: 'freight',   icon: '⛵', label: 'Freight',      sub: 'Sea, air & express compare',     color: '#7C3AED', bg: '#F5F0FF' },
  { id: 'ranking',   icon: '◉', label: 'Ranking',      sub: 'Sales needed for page 1',        color: '#D97706', bg: '#FFFBEB' },
  { id: 'scenario',  icon: '◈', label: 'What-if',      sub: 'Model price & cost changes',     color: '#059669', bg: '#F0FDF4' },
  { id: 'reorder',   icon: '⊞', label: 'Reorder',      sub: 'Never stock out again',          color: '#DB2777', bg: '#FDF2F8' },
  { id: 'bsr',       icon: '⊛', label: 'BSR',          sub: 'Estimate sales from rank',       color: '#0284C7', bg: '#EFF8FF' },
];

function CalcBackBar({ title, onBack }: { title: string; onBack: () => void }) {
  return (
    <View style={cb.bar}>
      <TouchableOpacity style={cb.backBtn} onPress={onBack} activeOpacity={0.7}>
        <Text style={cb.backArrow}>←</Text>
        <Text style={cb.backLabel}>Calculate</Text>
      </TouchableOpacity>
      <Text style={cb.title} numberOfLines={1}>{title}</Text>
      <CurrencySelector />
    </View>
  );
}
const cb = StyleSheet.create({
  bar: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 10,
    backgroundColor: '#FFFFFF', borderBottomWidth: 1, borderBottomColor: '#ECF0FB',
    gap: 8,
  },
  backBtn: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  backArrow: { fontSize: 16, color: '#4361EE', fontWeight: '700' as const },
  backLabel: { fontSize: 13, color: '#4361EE', fontWeight: '600' as const },
  title: { flex: 1, fontSize: 14, fontWeight: '700' as const, color: '#0D1B4B', textAlign: 'center' as const },
});

function CalcHub({ onSelect }: { onSelect: (id: Mode) => void }) {
  return (
    <ScrollView style={{ flex: 1, backgroundColor: '#F5F7FF' }} contentContainerStyle={ch.content} showsVerticalScrollIndicator={false}>
      <View style={ch.titleBlock}>
        <Text style={ch.eyebrow}>PROFIT CALCULATOR</Text>
        <Text style={ch.title}>Calculate &{'\n'}Analyze.</Text>
        <Text style={ch.sub}>Run the numbers before you commit a single dollar.</Text>
      </View>

      <Text style={ch.sectionLabel}>CALCULATORS</Text>
      {CALC_TOOLS.map(tool => (
        <TouchableOpacity key={tool.id} style={ch.card} onPress={() => onSelect(tool.id)} activeOpacity={0.85}>
          <View style={[ch.iconWrap, { backgroundColor: tool.bg }]}>
            <Text style={[ch.icon, { color: tool.color }]}>{tool.icon}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={ch.cardLabel}>{tool.label}</Text>
            <Text style={ch.cardSub}>{tool.sub}</Text>
          </View>
          <Text style={[ch.arrow, { color: tool.color }]}>→</Text>
        </TouchableOpacity>
      ))}
    </ScrollView>
  );
}
const ch = StyleSheet.create({
  content: { paddingBottom: 40 },
  titleBlock: {
    paddingHorizontal: 20, paddingTop: 28, paddingBottom: 20,
  },
  eyebrow: { fontSize: 9, fontWeight: '800' as const, color: '#7C3AED', letterSpacing: 2.5, marginBottom: 6 },
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

export default function CalculatorScreen() {
  const [view, setView] = useState<CalcView>('hub');

  const currentTool = CALC_TOOLS.find(t => t.id === view);

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <AppHeader />
      {view === 'hub' ? (
        <CalcHub onSelect={m => setView(m)} />
      ) : (
        <>
          <CalcBackBar title={currentTool?.label ?? ''} onBack={() => setView('hub')} />
          <View style={{ flex: 1, backgroundColor: '#F5F7FF' }}>
            {view === 'fees'      && <FeesTab />}
            {view === 'simulate'  && <SimulateTab />}
            {view === 'landed'    && <LandedTab />}
            {view === 'cashflow'  && <CashFlowTab />}
            {view === 'freight'   && <FreightTab />}
            {view === 'ppc'       && <PPCTab />}
            {view === 'ranking'   && <RankingTab />}
            {view === 'breakeven' && <BreakevenTab />}
            {view === 'scenario'  && <ScenarioTab />}
            {view === 'reorder'   && <ReorderTab />}
            {view === 'bsr'       && <BSRTab />}
          </View>
        </>
      )}
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#FFFFFF' },
});

const t = StyleSheet.create({
  scroll: { paddingBottom: spacing.xxl },
  section: { paddingHorizontal: spacing.lg, gap: spacing.sm, marginBottom: spacing.sm },
  row: { flexDirection: 'row', gap: spacing.sm },
  infoRow: { backgroundColor: colors.bgElevated, borderRadius: radius.sm, padding: spacing.sm },
  infoText: { fontSize: 12, color: colors.textSecondary, textAlign: 'center' },

  boxSection: {
    marginHorizontal: spacing.lg, marginBottom: spacing.md,
    borderWidth: 1, borderColor: colors.border, borderRadius: radius.md,
    padding: spacing.md, gap: spacing.sm, backgroundColor: colors.bgCard,
  },
  boxHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  boxLabel: { fontSize: 9, fontWeight: '700' as const, color: colors.textMuted, letterSpacing: 1.5 },
  autoBadge: { backgroundColor: '#7C3AED', borderRadius: radius.full, paddingHorizontal: 8, paddingVertical: 2 },
  autoText: { fontSize: 7, fontWeight: '800' as const, color: colors.white, letterSpacing: 1 },
  shipRow: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: colors.bgElevated, borderRadius: radius.sm,
    paddingVertical: spacing.sm, paddingHorizontal: spacing.md, marginTop: spacing.xs,
  },
  shipStat: { flex: 1, alignItems: 'center' },
  shipNum: { fontSize: 15, fontWeight: '800' as const, color: colors.textPrimary },
  shipLabel: { fontSize: 8, fontWeight: '700' as const, color: colors.textMuted, letterSpacing: 1.5, marginTop: 2 },
  shipDiv: { width: 1, height: 24, backgroundColor: colors.border },

  catSection: { marginBottom: spacing.md },
  catLabel: { fontSize: 10, fontWeight: '700' as const, color: colors.textMuted, letterSpacing: 1.5, paddingHorizontal: spacing.lg, marginBottom: spacing.sm },
  catRow: { paddingHorizontal: spacing.lg, gap: spacing.sm },
  catChip: {
    paddingHorizontal: spacing.md, paddingVertical: spacing.xs + 2,
    borderWidth: 1, borderColor: colors.border, borderRadius: radius.full,
    backgroundColor: colors.bgCard,
  },
  catChipActive: { backgroundColor: '#7C3AED', borderColor: '#7C3AED' },
  catChipText: { fontSize: 12, fontWeight: '600' as const, color: colors.textSecondary },
  catChipTextActive: { color: '#fff' },

  btn: {
    marginHorizontal: spacing.lg, marginBottom: spacing.sm,
    backgroundColor: '#7C3AED', borderRadius: radius.lg,
    paddingVertical: spacing.md, alignItems: 'center',
  },
  btnText: { fontSize: 16, fontWeight: '800' as const, color: '#fff' },
  error: { fontSize: 12, color: colors.red, paddingHorizontal: spacing.lg },

  results: { paddingHorizontal: spacing.lg, gap: spacing.md },
  sectionHeader: { fontSize: 9, fontWeight: '700' as const, color: colors.textMuted, letterSpacing: 1.5, marginBottom: spacing.xs },

  profitCard: {
    borderWidth: 1, borderRadius: radius.lg, padding: spacing.lg, alignItems: 'center', gap: spacing.sm,
    backgroundColor: colors.bgCard,
  },
  profitLabel: { fontSize: 10, fontWeight: '700' as const, color: colors.textMuted, letterSpacing: 1.5 },
  profitNum: { fontSize: 44, fontWeight: '800' as const, letterSpacing: -2 },
  profitMeta: { flexDirection: 'row', gap: spacing.lg, alignItems: 'center' },
  verdict: { fontSize: 11, fontWeight: '700' as const, color: colors.textSecondary, letterSpacing: 0.5 },
  profitStat: { fontSize: 12, color: colors.textSecondary },
  batchRow: { flexDirection: 'row', borderTopWidth: 1, borderTopColor: colors.border, paddingTop: spacing.sm, width: '100%', justifyContent: 'center' },
  batchText: { fontSize: 12, color: colors.textSecondary },
  batchNum: { fontSize: 12, fontWeight: '800' as const, color: colors.textPrimary },

  breakdown: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, overflow: 'hidden', backgroundColor: colors.bgCard },
  feeRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm + 2,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  feeLabel: { fontSize: 13, color: colors.textSecondary, flex: 1 },
  feeVal: { fontSize: 13, fontWeight: '700' as const, color: colors.textPrimary },

  shipCard: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, overflow: 'hidden', backgroundColor: colors.bgCard },
  shipCardTitle: {
    fontSize: 10, fontWeight: '700' as const, letterSpacing: 1.5, color: colors.textMuted,
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
    borderBottomWidth: 1, borderBottomColor: colors.border,
    backgroundColor: colors.bgElevated,
  },
  shipCardRow: {
    flexDirection: 'row', justifyContent: 'space-between',
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm + 2,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  shipCardLabel: { fontSize: 13, color: colors.textSecondary },
  shipCardVal: { fontSize: 13, fontWeight: '700' as const, color: colors.textPrimary },

  // Freight
  freightCard: {
    backgroundColor: colors.bgCard, borderRadius: radius.md,
    borderWidth: 1, borderColor: colors.border, padding: spacing.md, gap: spacing.sm,
  },
  freightTop: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  freightIcon: { fontSize: 22 },
  freightName: { fontSize: 14, fontWeight: '700' as const, color: colors.textPrimary },
  freightDays: { fontSize: 12, color: colors.textSecondary },
  freightNums: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.bgElevated, borderRadius: radius.sm, padding: spacing.sm },
  freightStat: { flex: 1, alignItems: 'center' },
  freightNum: { fontSize: 16, fontWeight: '800' as const, color: colors.textPrimary },
  freightStatLabel: { fontSize: 8, fontWeight: '700' as const, color: colors.textMuted, letterSpacing: 1.5, marginTop: 2 },
  freightDivider: { width: 1, height: 28, backgroundColor: colors.border },
  freightNote: { padding: spacing.md },
  freightNoteText: { fontSize: 12, color: colors.textMuted, textAlign: 'center', lineHeight: 18 },

  // PPC
  acosHint: { alignItems: 'center' },
  acosHintText: { fontSize: 9, fontWeight: '700' as const, color: colors.textMuted, letterSpacing: 1.5 },
  ppcHero: {
    borderWidth: 1, borderColor: 'rgba(124,58,237,0.22)', borderRadius: radius.lg,
    padding: spacing.lg, alignItems: 'center', gap: 4, backgroundColor: colors.bgCard,
  },
  ppcHeroLabel: { fontSize: 10, fontWeight: '700' as const, color: colors.textMuted, letterSpacing: 1.5 },
  ppcHeroNum: { fontSize: 44, fontWeight: '800' as const, color: '#7C3AED', letterSpacing: -2 },
  ppcHeroSub: { fontSize: 12, color: colors.textSecondary, textAlign: 'center' },
  ppcTips: {
    borderWidth: 1, borderColor: colors.border, borderRadius: radius.md,
    padding: spacing.md, gap: spacing.sm, backgroundColor: colors.bgCard,
  },
  ppcTipsTitle: { fontSize: 9, fontWeight: '700' as const, color: colors.textMuted, letterSpacing: 1.5, marginBottom: spacing.xs },
  ppcTip: { flexDirection: 'row', gap: spacing.sm },
  ppcTipDot: { fontSize: 16, color: colors.textMuted, lineHeight: 20 },
  ppcTipText: { fontSize: 13, flex: 1, lineHeight: 20, color: colors.textSecondary },
  tabGuide: {
    marginHorizontal: spacing.lg, marginBottom: spacing.md,
    borderLeftWidth: 3, borderLeftColor: '#7C3AED',
    backgroundColor: colors.bgElevated,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
  },
  tabGuideText: { fontSize: 12, color: colors.textSecondary, lineHeight: 18, letterSpacing: 0.05 },
});
