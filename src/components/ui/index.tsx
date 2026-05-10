import React from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
} from 'react-native';
import { colors, spacing, radius, shadow } from '../../theme';

// ─── Design Tokens ───────────────────────────────────────────────────────────

export const SECTION_COLORS = {
  pilot:    '#4361EE',
  search:   '#0284C7',
  calc:     '#7C3AED',
  brand:    '#DB2777',
  keywords: '#D97706',
  launch:   '#059669',
} as const;

// ─── SegmentedControl ─────────────────────────────────────────────────────────

interface SegmentedControlProps<T extends string> {
  options: { key: T; label: string }[];
  value: T;
  onChange: (key: T) => void;
}

export function SegmentedControl<T extends string>({
  options, value, onChange,
}: SegmentedControlProps<T>) {
  return (
    <View style={sc.wrap}>
      {options.map(opt => (
        <TouchableOpacity
          key={opt.key}
          style={[sc.tab, value === opt.key && sc.tabActive]}
          onPress={() => onChange(opt.key)}
          activeOpacity={0.75}
        >
          <Text style={[sc.text, value === opt.key && sc.textActive]}>
            {opt.label}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

const sc = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    backgroundColor: '#E8EDF5',
    borderRadius: radius.lg,
    padding: 3,
    borderWidth: 1,
    borderColor: '#D0DAF0',
  },
  tab: {
    flex: 1,
    paddingVertical: spacing.sm + 2,
    alignItems: 'center',
    borderRadius: radius.md,
  },
  tabActive: {
    backgroundColor: '#fff',
    ...shadow.sm,
  },
  text:       { fontSize: 13, fontWeight: '700', color: colors.textMuted },
  textActive: { color: '#0D1B4B', fontWeight: '800' },
});

// ─── SectionCard ─────────────────────────────────────────────────────────────

interface SectionCardProps {
  eyebrow: string;
  title: string;
  color: string;
  children?: React.ReactNode;
}

export function SectionCard({ eyebrow, title, color, children }: SectionCardProps) {
  return (
    <View style={[card.wrap, { borderLeftColor: color }]}>
      <Text style={[card.eyebrow, { color }]}>{eyebrow}</Text>
      <Text style={card.title}>{title}</Text>
      {children}
    </View>
  );
}

const card = StyleSheet.create({
  wrap: {
    backgroundColor: '#fff',
    borderRadius: radius.xxl,
    borderWidth: 1,
    borderColor: '#E0E8F5',
    padding: spacing.lg,
    ...shadow.sm,
  },
  eyebrow: { fontSize: 9, fontWeight: '800', letterSpacing: 2.5, marginBottom: 4 },
  title:   { fontSize: 22, fontWeight: '900', color: '#0D1B4B', letterSpacing: -0.8 },
});

// ─── MetricTile ──────────────────────────────────────────────────────────────

interface MetricTileProps {
  label: string;
  value: string | number;
  color?: string;
  icon?: string;
}

export function MetricTile({ label, value, color = '#0D1B4B', icon }: MetricTileProps) {
  return (
    <View style={mt.wrap}>
      {icon ? <Text style={mt.icon}>{icon}</Text> : null}
      <Text style={[mt.value, { color }]}>{value}</Text>
      <Text style={mt.label}>{label}</Text>
    </View>
  );
}

const mt = StyleSheet.create({
  wrap:  { flex: 1, alignItems: 'center', gap: 2, padding: spacing.xs + 2 },
  icon:  { fontSize: 18, marginBottom: 2 },
  value: { fontSize: 22, fontWeight: '900', letterSpacing: -0.8 },
  label: { fontSize: 9, fontWeight: '700', color: colors.textMuted, letterSpacing: 1.2, textAlign: 'center' },
});

// ─── EmptyState ──────────────────────────────────────────────────────────────

interface EmptyStateProps {
  icon: string;
  title: string;
  body: string;
  action?: { label: string; onPress: () => void; color?: string };
}

export function EmptyState({ icon, title, body, action }: EmptyStateProps) {
  return (
    <View style={es.wrap}>
      <View style={es.iconWrap}>
        <Text style={es.icon}>{icon}</Text>
      </View>
      <Text style={es.title}>{title}</Text>
      <Text style={es.body}>{body}</Text>
      {action && (
        <TouchableOpacity
          style={[es.btn, { backgroundColor: action.color ?? '#4361EE' }]}
          onPress={action.onPress}
          activeOpacity={0.85}
        >
          <Text style={es.btnText}>{action.label}</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const es = StyleSheet.create({
  wrap:    { alignItems: 'center', padding: spacing.xl, gap: spacing.md },
  iconWrap:{ width: 64, height: 64, borderRadius: 20, backgroundColor: '#EEF2FA', alignItems: 'center', justifyContent: 'center' },
  icon:    { fontSize: 28 },
  title:   { fontSize: 18, fontWeight: '800', color: '#0D1B4B', letterSpacing: -0.5, textAlign: 'center' },
  body:    { fontSize: 14, color: colors.textSecondary, lineHeight: 21, textAlign: 'center', maxWidth: 260 },
  btn:     { borderRadius: radius.lg, paddingVertical: spacing.sm + 2, paddingHorizontal: spacing.lg },
  btnText: { fontSize: 14, fontWeight: '700', color: '#fff' },
});

// ─── HeroStat Row (4-grid metric bar) ────────────────────────────────────────

interface HeroStatRowProps {
  stats: { icon: string; value: string | number; label: string }[];
}

export function HeroStatRow({ stats }: HeroStatRowProps) {
  return (
    <View style={hsr.wrap}>
      {stats.map((s, i) => (
        <React.Fragment key={i}>
          {i > 0 && <View style={hsr.div} />}
          <MetricTile icon={s.icon} value={s.value} label={s.label} />
        </React.Fragment>
      ))}
    </View>
  );
}

const hsr = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: '#E0E8F5',
    paddingVertical: spacing.sm,
    ...shadow.sm,
  },
  div: { width: 1, backgroundColor: '#E0E8F5', marginVertical: spacing.xs },
});
