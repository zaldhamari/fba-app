import React from 'react';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView,
} from 'react-native';
import { colors, spacing, radius } from '../theme';
import { VaultStatus, VAULT_STATUSES, STATUS_CONFIG } from '../types/vault';

interface Props {
  search: string;
  onSearchChange: (q: string) => void;
  statusFilter: VaultStatus | 'all';
  onStatusChange: (s: VaultStatus | 'all') => void;
  count: number;
}

export default function VaultFilterBar({
  search, onSearchChange, statusFilter, onStatusChange, count,
}: Props) {
  return (
    <View style={s.container}>
      {/* ── Search row */}
      <View style={s.searchRow}>
        <TextInput
          style={s.input}
          value={search}
          onChangeText={onSearchChange}
          placeholder="Search products & notes…"
          placeholderTextColor={colors.textMuted}
          returnKeyType="search"
          autoCorrect={false}
        />
      </View>

      {/* ── Status chips */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={s.chips}
      >
        <TouchableOpacity
          style={[s.chip, statusFilter === 'all' && s.chipActive]}
          onPress={() => onStatusChange('all')}
          activeOpacity={0.8}
        >
          <Text style={[s.chipText, statusFilter === 'all' && s.chipTextActive]}>
            All {count > 0 ? `(${count})` : ''}
          </Text>
        </TouchableOpacity>

        {VAULT_STATUSES.map(vs => {
          const cfg = STATUS_CONFIG[vs];
          const active = statusFilter === vs;
          return (
            <TouchableOpacity
              key={vs}
              style={[
                s.chip,
                active && { borderColor: cfg.color, backgroundColor: cfg.color + '18' },
              ]}
              onPress={() => onStatusChange(active ? 'all' : vs)}
              activeOpacity={0.8}
            >
              <View style={[s.chipDot, { backgroundColor: cfg.color }]} />
              <Text style={[s.chipText, active && { color: cfg.color, fontWeight: '700' }]}>
                {cfg.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  container: {
    backgroundColor: colors.bgCard,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingBottom: spacing.sm,
  },

  searchRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xs,
  },
  input: {
    flex: 1,
    backgroundColor: colors.bgElevated,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.full,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
    fontSize: 13,
    color: colors.textPrimary,
  },
  chips: {
    paddingHorizontal: spacing.lg,
    gap: spacing.xs,
    paddingVertical: 2,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.full,
    paddingHorizontal: 10,
    paddingVertical: 4,
    backgroundColor: colors.bgElevated,
  },
  chipActive: {
    borderColor: '#2563EB',
    backgroundColor: 'rgba(37,99,235,0.10)',
  },
  chipDot: { width: 6, height: 6, borderRadius: 3 },
  chipText: { fontSize: 10, fontWeight: '600', color: colors.textMuted },
  chipTextActive: { color: '#2563EB', fontWeight: '700' },
});
