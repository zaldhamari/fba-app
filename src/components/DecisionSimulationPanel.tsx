// ── Phase 15: Decision Simulation Panel ──────────────────────────────────────
// Collapsible panel with grouped simulation controls.
// Each section maps to a distinct operational decision category.
// NO giant forms. NO dead toggles. Everything drives real engine recomputation.

import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  TextInput, ScrollView,
} from 'react-native';
import { DS } from '../theme/ds';
import type { DecisionSimulationState } from '../hooks/useDecisionSimulation';
import type { SimulationOverrides } from '../lib/productSimulation/types';
import { SimulationImpactCard } from './SimulationImpactCard';
import { ScenarioComparisonCard } from './ScenarioComparisonCard';
import type { ProductIntelligenceProfile } from '../lib/productIntelligence/types';
import type { FreightMode } from '../lib/sourcingStrategy';

// ── Chip selector ─────────────────────────────────────────────────────────────

function ChipGroup<T extends string>({
  options, selected, onSelect, nullLabel,
}: {
  options:    { value: T; label: string }[];
  selected:   T | undefined;
  onSelect:   (v: T | undefined) => void;
  nullLabel?: string;
}) {
  return (
    <View style={p.chipRow}>
      {nullLabel && (
        <TouchableOpacity
          style={[p.chip, selected === undefined && p.chipActive]}
          onPress={() => onSelect(undefined)}
          activeOpacity={0.75}
        >
          <Text style={[p.chipTxt, selected === undefined && p.chipTxtActive]}>{nullLabel}</Text>
        </TouchableOpacity>
      )}
      {options.map(opt => (
        <TouchableOpacity
          key={opt.value}
          style={[p.chip, selected === opt.value && p.chipActive]}
          onPress={() => onSelect(selected === opt.value ? undefined : opt.value)}
          activeOpacity={0.75}
        >
          <Text style={[p.chipTxt, selected === opt.value && p.chipTxtActive]}>{opt.label}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

// ── Toggle chip ───────────────────────────────────────────────────────────────

function Toggle({
  label, active, onToggle, detail,
}: {
  label:    string;
  active:   boolean;
  onToggle: (v: boolean) => void;
  detail?:  string;
}) {
  return (
    <TouchableOpacity style={p.toggleRow} onPress={() => onToggle(!active)} activeOpacity={0.75}>
      <View style={[p.toggleBox, active && p.toggleBoxOn]}>
        {active && <View style={p.toggleDot} />}
      </View>
      <View style={{ flex: 1 }}>
        <Text style={p.toggleLabel}>{label}</Text>
        {detail && <Text style={p.toggleDetail}>{detail}</Text>}
      </View>
    </TouchableOpacity>
  );
}

// ── Numeric stepper ───────────────────────────────────────────────────────────

function Stepper({
  label, value, step, min, max, unit, onchange, placeholder,
}: {
  label:       string;
  value:       number | undefined;
  step:        number;
  min:         number;
  max:         number;
  unit?:       string;
  onchange:    (v: number | undefined) => void;
  placeholder: string;
}) {
  const display = value !== undefined ? String(value) : '';
  return (
    <View style={p.stepRow}>
      <Text style={p.stepLabel}>{label}</Text>
      <View style={p.stepControls}>
        <TouchableOpacity
          style={p.stepBtn}
          onPress={() => {
            const cur = value ?? parseFloat(placeholder) ?? min;
            const next = Math.max(min, cur - step);
            onchange(next);
          }}
        >
          <Text style={p.stepBtnTxt}>−</Text>
        </TouchableOpacity>
        <TextInput
          style={p.stepInput}
          value={display}
          onChangeText={txt => {
            const n = parseFloat(txt);
            onchange(isNaN(n) ? undefined : Math.min(max, Math.max(min, n)));
          }}
          keyboardType="decimal-pad"
          placeholder={placeholder}
          placeholderTextColor={DS.textMuted}
        />
        <TouchableOpacity
          style={p.stepBtn}
          onPress={() => {
            const cur = value ?? parseFloat(placeholder) ?? min;
            const next = Math.min(max, cur + step);
            onchange(next);
          }}
        >
          <Text style={p.stepBtnTxt}>+</Text>
        </TouchableOpacity>
        {unit && <Text style={p.stepUnit}>{unit}</Text>}
      </View>
    </View>
  );
}

// ── Section header ────────────────────────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={p.section}>
      <Text style={p.sectionTitle}>{title}</Text>
      {children}
    </View>
  );
}

// ── Main panel ────────────────────────────────────────────────────────────────

interface Props {
  sim:         DecisionSimulationState;
  baseProfile: ProductIntelligenceProfile;
}

const COUNTRIES = [
  { value: 'China',   label: 'China'   },
  { value: 'Vietnam', label: 'Vietnam' },
  { value: 'India',   label: 'India'   },
  { value: 'Local',   label: 'Local'   },
] as const;

const FREIGHT_MODES = [
  { value: 'sea' as FreightMode,   label: 'Sea'    },
  { value: 'air' as FreightMode,   label: 'Air'    },
  { value: 'local' as FreightMode, label: 'Local'  },
] as const;

const SELLER_EXP = [
  { value: 'beginner' as const, label: 'Beginner'     },
  { value: 'some'     as const, label: 'Intermediate' },
  { value: 'selling'  as const, label: 'Advanced'     },
] as const;

const MARKETPLACES = [
  { value: 'US', label: 'US' },
  { value: 'UK', label: 'UK' },
  { value: 'CA', label: 'CA' },
  { value: 'EU', label: 'EU' },
] as const;

export function DecisionSimulationPanel({ sim, baseProfile }: Props) {
  const [expanded, setExpanded] = useState(false);

  const { overrides, updateOverride, removeOverride, resetOverrides, hasActiveOverrides, simulationResult } = sim;

  function set<K extends keyof SimulationOverrides>(key: K, val: SimulationOverrides[K]) {
    if (val === undefined) removeOverride(key);
    else updateOverride(key, val);
  }

  return (
    <View style={p.wrapper}>
      {/* ── Header ── */}
      <TouchableOpacity
        style={[p.header, expanded && p.headerExpanded]}
        onPress={() => setExpanded(e => !e)}
        activeOpacity={0.85}
      >
        <View style={{ flex: 1 }}>
          <Text style={p.headerTitle}>DECISION SIMULATOR</Text>
          <Text style={p.headerSub}>
            {hasActiveOverrides
              ? `${Object.keys(overrides).filter(k => (overrides as any)[k] !== undefined).length} override(s) active`
              : 'Simulate operational decisions — see intelligence recalculate instantly'}
          </Text>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          {hasActiveOverrides && (
            <TouchableOpacity
              style={p.resetBtn}
              onPress={() => { resetOverrides(); }}
              activeOpacity={0.75}
            >
              <Text style={p.resetTxt}>Reset</Text>
            </TouchableOpacity>
          )}
          <Text style={p.chevron}>{expanded ? '▲' : '▼'}</Text>
        </View>
      </TouchableOpacity>

      {expanded && (
        <View style={p.body}>
          <View style={p.simBanner}>
            <Text style={p.simBannerTxt}>SIMULATION — changes are temporary and do not update your pipeline</Text>
          </View>
          {/* ── SECTION A: Sourcing ── */}
          <Section title="A · SOURCING">
            <View style={p.row}>
              <Text style={p.fieldLabel}>Supplier Country</Text>
            </View>
            <ChipGroup
              options={COUNTRIES as any}
              selected={overrides.supplierCountry as any}
              onSelect={v => set('supplierCountry', v)}
              nullLabel="Current"
            />
            <Stepper
              label="Unit Cost ($/unit)"
              value={overrides.unitCostOverride}
              step={0.50}
              min={0.5}
              max={999}
              unit="$"
              placeholder={String(baseProfile.raw.sourcing.supplierConfidence.level !== 'Unknown' ? 'current' : '—')}
              onchange={v => set('unitCostOverride', v)}
            />
            <Stepper
              label="MOQ"
              value={overrides.moqOverride}
              step={100}
              min={1}
              max={10000}
              unit="units"
              placeholder="500"
              onchange={v => set('moqOverride', v)}
            />
            <Toggle
              label="Add Third-Party Inspection"
              active={overrides.addInspection ?? false}
              onToggle={v => set('addInspection', v || undefined)}
              detail="~$300 per run — reduces defect and suspension risk"
            />
          </Section>

          {/* ── SECTION B: Freight ── */}
          <Section title="B · FREIGHT">
            <View style={p.row}>
              <Text style={p.fieldLabel}>Freight Mode</Text>
            </View>
            <ChipGroup
              options={FREIGHT_MODES as any}
              selected={overrides.localSourcing ? 'local' as any : overrides.freightMode as any}
              onSelect={(v: any) => {
                if (v === 'local') {
                  set('localSourcing', true);
                  removeOverride('freightMode');
                } else {
                  removeOverride('localSourcing');
                  set('freightMode', v);
                }
              }}
              nullLabel="Current"
            />
            <Stepper
              label="Freight Cost ($/unit)"
              value={overrides.freightCostOverride}
              step={0.25}
              min={0}
              max={50}
              unit="$"
              placeholder="Estimated"
              onchange={v => set('freightCostOverride', v)}
            />
          </Section>

          {/* ── SECTION C: Financials ── */}
          <Section title="C · FINANCIALS">
            <Stepper
              label="Selling Price ($)"
              value={overrides.sellingPriceOverride}
              step={1}
              min={1}
              max={9999}
              unit="$"
              placeholder="current"
              onchange={v => set('sellingPriceOverride', v)}
            />
          </Section>

          {/* ── SECTION D: Seller ── */}
          <Section title="D · SELLER PROFILE">
            <View style={p.row}>
              <Text style={p.fieldLabel}>Experience Level</Text>
            </View>
            <ChipGroup
              options={SELLER_EXP as any}
              selected={overrides.sellerExperience as any}
              onSelect={v => set('sellerExperience', v)}
              nullLabel="Current"
            />
            <View style={p.row}>
              <Text style={p.fieldLabel}>Marketplace</Text>
            </View>
            <ChipGroup
              options={MARKETPLACES as any}
              selected={overrides.marketplace as any}
              onSelect={v => set('marketplace', v)}
              nullLabel="Current"
            />
          </Section>

          {/* ── SECTION E: Compliance ── */}
          <Section title="E · COMPLIANCE">
            <Toggle
              label="Certification Verified"
              active={overrides.certificationVerified ?? false}
              onToggle={v => set('certificationVerified', v || undefined)}
              detail="Mark cert as resolved — removes compliance blocker from seller fit"
            />
            <Toggle
              label="Return Mitigation Plan"
              active={overrides.returnMitigationEnabled ?? false}
              onToggle={v => set('returnMitigationEnabled', v || undefined)}
              detail="Size guides, quality photos, pre-shipment specs — reduces post-launch returns"
            />
            <Toggle
              label="Premium Packaging"
              active={overrides.packagingUpgrade ?? false}
              onToggle={v => set('packagingUpgrade', v || undefined)}
              detail="Lifts perceived value — budget $0.50–2.00/unit additional"
            />
          </Section>

          {/* ── Results ── */}
          {simulationResult && (
            <View style={p.results}>
              <SimulationImpactCard
                impacts={simulationResult.impacts}
                delta={simulationResult.delta}
                isEstimated={simulationResult.isEstimated}
                estimatedNote={simulationResult.estimatedNote}
              />
              <ScenarioComparisonCard
                baseProfile={baseProfile}
                simProfile={simulationResult.profile}
              />
            </View>
          )}

          {!hasActiveOverrides && (
            <Text style={p.hint}>
              Adjust any setting above to see how your intelligence profile changes.
            </Text>
          )}
        </View>
      )}
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const p = StyleSheet.create({
  wrapper:         { },

  // Header
  header:          { flexDirection: 'row', alignItems: 'center', backgroundColor: DS.bgCard, borderRadius: DS.radiusCard, borderWidth: 1, borderColor: DS.border, padding: 14, gap: 10 },
  headerExpanded:  { borderBottomLeftRadius: 0, borderBottomRightRadius: 0, borderBottomWidth: 0 },
  headerTitle:     { fontSize: 10, fontWeight: '800', color: DS.textMuted, letterSpacing: 1.5, textTransform: 'uppercase' },
  headerSub:       { fontSize: 12, color: DS.textSecondary, marginTop: 2 },
  chevron:         { fontSize: 10, color: DS.textMuted },
  resetBtn:        { paddingHorizontal: 10, paddingVertical: 4, borderRadius: DS.radiusChip, borderWidth: 1, borderColor: DS.border },
  resetTxt:        { fontSize: 11, color: DS.textSecondary, fontWeight: '700' },

  // Body
  body:            { backgroundColor: DS.bgCard, borderWidth: 1, borderTopWidth: 0, borderColor: DS.border, borderBottomLeftRadius: DS.radiusCard, borderBottomRightRadius: DS.radiusCard, padding: 14, gap: 16 },
  simBanner:       { backgroundColor: DS.warning + '18', borderRadius: DS.radiusChip, borderWidth: 1, borderColor: DS.warning + '40', paddingHorizontal: 12, paddingVertical: 7 },
  simBannerTxt:    { fontSize: 10, fontWeight: '700', color: DS.warning, textAlign: 'center', letterSpacing: 0.3 },

  // Section
  section:         { gap: 10 },
  sectionTitle:    { fontSize: 10, fontWeight: '800', color: DS.accent, letterSpacing: 1.5, textTransform: 'uppercase' },

  // Chips
  chipRow:         { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip:            { paddingHorizontal: 10, paddingVertical: 5, borderRadius: DS.radiusBadge, borderWidth: 1, borderColor: DS.border, backgroundColor: DS.bgElevated },
  chipActive:      { borderColor: DS.accent, backgroundColor: DS.accent + '12' },
  chipTxt:         { fontSize: 11, fontWeight: '700', color: DS.textSecondary },
  chipTxtActive:   { color: DS.accent },

  // Toggle
  toggleRow:       { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  toggleBox:       { width: 22, height: 22, borderRadius: 4, borderWidth: 2, borderColor: DS.border, alignItems: 'center', justifyContent: 'center', marginTop: 1 },
  toggleBoxOn:     { borderColor: DS.accent, backgroundColor: DS.accent },
  toggleDot:       { width: 10, height: 10, borderRadius: 2, backgroundColor: DS.bgCard },
  toggleLabel:     { fontSize: 12, fontWeight: '700', color: DS.textPrimary },
  toggleDetail:    { fontSize: 11, color: DS.textSecondary, lineHeight: 15, marginTop: 1 },

  // Stepper
  stepRow:         { gap: 6 },
  stepLabel:       { fontSize: 11, fontWeight: '700', color: DS.textSecondary },
  stepControls:    { flexDirection: 'row', alignItems: 'center', gap: 8 },
  stepBtn:         { width: 32, height: 32, borderRadius: DS.radiusChip, borderWidth: 1, borderColor: DS.border, alignItems: 'center', justifyContent: 'center', backgroundColor: DS.bgElevated },
  stepBtnTxt:      { fontSize: 16, color: DS.accent, fontWeight: '800', lineHeight: 20 },
  stepInput:       { flex: 1, borderWidth: 1, borderColor: DS.border, borderRadius: DS.radiusInput, paddingHorizontal: 10, paddingVertical: 6, fontSize: 13, fontWeight: '700', color: DS.textPrimary, backgroundColor: DS.bgElevated, textAlign: 'center' },
  stepUnit:        { fontSize: 11, color: DS.textMuted, fontWeight: '600', width: 36 },

  row:             { },
  fieldLabel:      { fontSize: 11, fontWeight: '700', color: DS.textSecondary, marginBottom: 4 },

  // Results
  results:         { gap: 12, paddingTop: 4, borderTopWidth: 1, borderTopColor: DS.border },

  hint:            { fontSize: 12, color: DS.textMuted, fontStyle: 'italic', textAlign: 'center', paddingVertical: 8 },
});
