import React from 'react';
import { View, Text, StyleSheet, ViewStyle, StyleProp } from 'react-native';
import { DS } from '../../theme/ds';
import { AppCard } from './AppCard';

// ── MetricCard — standalone card showing a single KPI ────────────────────────

export interface MetricCardProps {
  value:     string | number;
  label:     string;
  sublabel?: string;
  /** Emoji/glyph icon above the value */
  icon?:     string;
  /** Color applied to value and icon — defaults to textPrimary */
  accent?:   string;
  /** Optional trend indicator */
  trend?:    { value: string; positive: boolean };
  /** Render without the AppCard wrapper (for embedding in rows) */
  inline?:   boolean;
  style?:    StyleProp<ViewStyle>;
}

export function MetricCard({
  value,
  label,
  sublabel,
  icon,
  accent,
  trend,
  inline = false,
  style,
}: MetricCardProps) {
  const valueColor = accent ?? DS.textPrimary;

  const content = (
    <View style={s.content}>
      {icon ? (
        <Text style={[s.icon, { color: valueColor }]}>{icon}</Text>
      ) : null}

      <Text style={[s.value, { color: valueColor }]}>
        {value}
      </Text>

      <Text style={s.label}>{label}</Text>

      {sublabel ? (
        <Text style={s.sublabel}>{sublabel}</Text>
      ) : null}

      {trend ? (
        <View
          style={[
            s.trendPill,
            { backgroundColor: trend.positive ? DS.successBg : DS.dangerBg },
          ]}
        >
          <Text
            style={[
              s.trendText,
              { color: trend.positive ? DS.successText : DS.dangerText },
            ]}
          >
            {trend.positive ? '↑' : '↓'} {trend.value}
          </Text>
        </View>
      ) : null}
    </View>
  );

  if (inline) {
    return <View style={style}>{content}</View>;
  }

  return (
    <AppCard padding={DS.cardPadding} style={style}>
      {content}
    </AppCard>
  );
}

// ── MetricRow — horizontal row of compact KPI tiles ──────────────────────────

export interface MetricRowItem {
  value:   string | number;
  label:   string;
  accent?: string;
}

export interface MetricRowProps {
  items: MetricRowItem[];
  style?: StyleProp<ViewStyle>;
}

export function MetricRow({ items, style }: MetricRowProps) {
  return (
    <AppCard padding={DS.cardPadding} style={[s.rowCard, style]}>
      {items.map((item, i) => (
        <React.Fragment key={i}>
          {i > 0 ? <View style={s.divider} /> : null}
          <View style={s.rowItem}>
            <Text
              style={[
                s.rowValue,
                item.accent ? { color: item.accent } : undefined,
              ]}
            >
              {item.value}
            </Text>
            <Text style={s.rowLabel}>{item.label}</Text>
          </View>
        </React.Fragment>
      ))}
    </AppCard>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  // MetricCard
  content: {
    alignItems: 'center',
    gap: 4,
  },
  icon: {
    fontSize:     24,
    marginBottom: 2,
  },
  value: {
    fontSize:      28,
    fontWeight:    '900',
    letterSpacing: -1,
  },
  label: {
    fontSize:   13,
    fontWeight: '500',
    color:      DS.textSecondary,
    textAlign:  'center',
  },
  sublabel: {
    fontSize:  11,
    color:     DS.textMuted,
    textAlign: 'center',
  },
  trendPill: {
    flexDirection:   'row',
    alignItems:      'center',
    alignSelf:       'center',
    paddingHorizontal: 8,
    paddingVertical:   3,
    borderRadius:    DS.radiusBadge,
    marginTop:       2,
  },
  trendText: {
    fontSize:   11,
    fontWeight: '700',
  },

  // MetricRow
  rowCard: {
    flexDirection: 'row',
    alignItems:    'center',
    paddingVertical: 16,
  },
  rowItem: {
    flex:       1,
    alignItems: 'center',
    gap:        3,
  },
  divider: {
    width:           1,
    height:          32,
    backgroundColor: DS.border,
  },
  rowValue: {
    fontSize:      22,
    fontWeight:    '900',
    color:         DS.textPrimary,
    letterSpacing: -0.8,
    lineHeight:    26,
  },
  rowLabel: {
    fontSize:      10,
    fontWeight:    '600',
    color:         DS.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    textAlign:     'center',
  },
});
