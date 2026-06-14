import React, { useState } from 'react';
import { DS } from '../theme/ds';
import {
  View, Text, TouchableOpacity, StyleSheet, Modal, ScrollView,
} from 'react-native';
import { useCurrency, MARKETPLACES, CURRENCIES, CurrencyCode, MarketplaceId } from '../context/CurrencyContext';
import { colors, spacing, radius } from '../theme';

// ─── Compact trigger button ───────────────────────────────────────────────────

export function CurrencyButton({ onPress }: { onPress: () => void }) {
  const { flag, currency } = useCurrency();
  return (
    <TouchableOpacity
      style={s.btn}
      onPress={onPress}
      activeOpacity={0.75}
      accessibilityRole="button"
      accessibilityLabel={`Change region and currency, currently ${currency}`}
    >
      <Text style={s.btnFlag}>{flag}</Text>
      <Text style={s.btnCode}>{currency}</Text>
    </TouchableOpacity>
  );
}

// ─── Inline picker (for embedding in another sheet, e.g. settings) ────────────

export function CurrencyRegionPicker() {
  const { currency, marketplace, setCurrency, setMarketplace } = useCurrency();

  return (
    <View>
      <Text style={s.sectionLabel}>MARKETPLACE</Text>
      {MARKETPLACES.map(mp => {
        const isActive = marketplace === mp.id;
        return (
          <TouchableOpacity
            key={mp.id}
            style={[s.option, isActive && s.optionActive]}
            onPress={() => setMarketplace(mp.id as MarketplaceId)}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityState={{ selected: isActive }}
          >
            <Text style={s.optionFlag}>{mp.flag}</Text>
            <View style={s.optionText}>
              <Text style={[s.optionName, isActive && s.optionNameActive]}>{mp.name}</Text>
              <Text style={s.optionSub}>
                {CURRENCIES[mp.currency].name} · {mp.currency}
              </Text>
            </View>
            {isActive && <Text style={s.check}>✓</Text>}
          </TouchableOpacity>
        );
      })}

      <Text style={[s.sectionLabel, { marginTop: spacing.md }]}>CURRENCY ONLY</Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={s.currencyRow}
      >
        {(Object.keys(CURRENCIES) as CurrencyCode[]).map(code => {
          const c = CURRENCIES[code];
          const isActive = currency === code;
          return (
            <TouchableOpacity
              key={code}
              style={[s.chip, isActive && s.chipActive]}
              onPress={() => setCurrency(code)}
              activeOpacity={0.8}
              accessibilityRole="button"
              accessibilityState={{ selected: isActive }}
            >
              <Text style={s.chipFlag}>{c.flag}</Text>
              <Text style={[s.chipCode, isActive && s.chipCodeActive]}>{c.code}</Text>
              <Text style={[s.chipSym, isActive && s.chipSymActive]}>{c.selectorSymbol}</Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      <Text style={s.note}>Rates refresh daily · prices converted from USD</Text>
    </View>
  );
}

// ─── Full selector (button + bottom-sheet modal) ──────────────────────────────

export function CurrencySelector() {
  const [visible, setVisible] = useState(false);
  const { currency, marketplace, setCurrency, setMarketplace } = useCurrency();

  const close = () => setVisible(false);

  return (
    <>
      <CurrencyButton onPress={() => setVisible(true)} />

      <Modal visible={visible} transparent animationType="slide" onRequestClose={close}>
        <TouchableOpacity style={s.backdrop} activeOpacity={1} onPress={close} accessibilityRole="button" accessibilityLabel="Close" />

        <View style={s.sheet}>
          <View style={s.handle} />
          <Text style={s.sheetTitle}>Region & Currency</Text>

          {/* ── Marketplace section ── */}
          <Text style={s.sectionLabel}>MARKETPLACE</Text>
          {MARKETPLACES.map(mp => {
            const isActive = marketplace === mp.id;
            return (
              <TouchableOpacity
                key={mp.id}
                style={[s.option, isActive && s.optionActive]}
                onPress={() => { setMarketplace(mp.id as MarketplaceId); close(); }}
                activeOpacity={0.8}
                accessibilityRole="button"
                accessibilityState={{ selected: isActive }}
              >
                <Text style={s.optionFlag}>{mp.flag}</Text>
                <View style={s.optionText}>
                  <Text style={[s.optionName, isActive && s.optionNameActive]}>{mp.name}</Text>
                  <Text style={s.optionSub}>
                    {CURRENCIES[mp.currency].name} · {mp.currency}
                  </Text>
                </View>
                {isActive && <Text style={s.check}>✓</Text>}
              </TouchableOpacity>
            );
          })}

          {/* ── Currency-only section ── */}
          <Text style={[s.sectionLabel, { marginTop: spacing.md }]}>CURRENCY ONLY</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={s.currencyRow}
          >
            {(Object.keys(CURRENCIES) as CurrencyCode[]).map(code => {
              const c = CURRENCIES[code];
              const isActive = currency === code;
              return (
                <TouchableOpacity
                  key={code}
                  style={[s.chip, isActive && s.chipActive]}
                  onPress={() => { setCurrency(code); close(); }}
                  activeOpacity={0.8}
                  accessibilityRole="button"
                  accessibilityState={{ selected: isActive }}
                >
                  <Text style={s.chipFlag}>{c.flag}</Text>
                  <Text style={[s.chipCode, isActive && s.chipCodeActive]}>{c.code}</Text>
                  <Text style={[s.chipSym, isActive && s.chipSymActive]}>{c.selectorSymbol}</Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          <Text style={s.note}>Rates refresh daily · prices converted from USD</Text>
        </View>
      </Modal>
    </>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  btn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: colors.bgElevated, borderRadius: radius.full,
    paddingHorizontal: 10, paddingVertical: 5,
    borderWidth: 1, borderColor: colors.border,
  },
  btnFlag: { fontSize: 14 },
  btnCode: { fontSize: 11, fontWeight: '700', color: colors.textSecondary },

  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)' },
  sheet: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: colors.bgCard,
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    paddingHorizontal: spacing.lg, paddingBottom: 40, paddingTop: spacing.md,
    borderTopWidth: 1, borderLeftWidth: 1, borderRightWidth: 1,
    borderColor: colors.border,
  },
  handle: {
    width: 36, height: 4, backgroundColor: colors.bgElevated,
    borderRadius: 2, alignSelf: 'center', marginBottom: spacing.md,
  },
  sheetTitle: {
    fontSize: 17, fontWeight: '800', color: colors.textPrimary,
    letterSpacing: -0.3, marginBottom: spacing.md,
  },
  sectionLabel: {
    fontSize: 9, fontWeight: '800', color: colors.textMuted,
    letterSpacing: 1.5, marginBottom: spacing.sm,
  },

  option: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    paddingVertical: 10, paddingHorizontal: spacing.sm,
    borderRadius: radius.md, marginBottom: 2,
  },
  optionActive:     { backgroundColor: 'rgba(37,99,235,0.10)' },
  optionFlag:       { fontSize: 22 },
  optionText:       { flex: 1 },
  optionName:       { fontSize: 14, fontWeight: '600', color: colors.textPrimary },
  optionNameActive: { color: DS.accent },
  optionSub:        { fontSize: 11, color: colors.textMuted, marginTop: 1 },
  check:            { fontSize: 14, fontWeight: '800', color: DS.accent },

  currencyRow: { gap: 8, paddingVertical: spacing.xs },
  chip: {
    alignItems: 'center', gap: 2, minWidth: 60,
    paddingHorizontal: spacing.sm, paddingVertical: 8,
    backgroundColor: colors.bgElevated, borderRadius: radius.md,
    borderWidth: 1, borderColor: colors.border,
  },
  chipActive:    { backgroundColor: 'rgba(37,99,235,0.10)', borderColor: DS.accent },
  chipFlag:      { fontSize: 20 },
  chipCode:      { fontSize: 10, fontWeight: '800', color: colors.textSecondary },
  chipCodeActive:{ color: DS.accent },
  chipSym:       { fontSize: 11, color: colors.textMuted },
  chipSymActive: { color: DS.accent },

  note: {
    fontSize: 10, color: colors.textMuted, textAlign: 'center',
    marginTop: spacing.md,
  },
});
