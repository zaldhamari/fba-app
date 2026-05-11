import React from 'react';
import {
  View, Text, StyleSheet, ViewStyle, StyleProp,
} from 'react-native';
import { colors, spacing, radius } from '../../theme';

export interface ActivityItem {
  id: string;
  icon: string;
  title: string;
  subtitle?: string;
  timestamp: string;
  color?: string;
  badge?: string;
}

export interface ActivityFeedProps {
  items: ActivityItem[];
  /** Max items to show before truncating */
  maxItems?: number;
  /** Compact mode reduces vertical padding */
  compact?: boolean;
  style?: StyleProp<ViewStyle>;
}

export function ActivityFeed({
  items,
  maxItems,
  compact = false,
  style,
}: ActivityFeedProps) {
  const visible = maxItems ? items.slice(0, maxItems) : items;

  if (visible.length === 0) {
    return (
      <View style={[s.empty, style]}>
        <Text style={s.emptyText}>No activity yet</Text>
      </View>
    );
  }

  return (
    <View style={[s.wrap, style]}>
      {visible.map((item, idx) => {
        const accent = item.color ?? colors.purple;
        const isLast = idx === visible.length - 1;
        return (
          <View key={item.id} style={[s.row, compact && s.rowCompact]}>
            {/* Timeline spine */}
            <View style={s.spineCol}>
              <View style={[s.dot, { backgroundColor: accent }]} />
              {!isLast && <View style={s.line} />}
            </View>

            {/* Icon circle */}
            <View style={[s.iconWrap, { backgroundColor: accent + '18', borderColor: accent + '28' }]}>
              <Text style={s.icon}>{item.icon}</Text>
            </View>

            {/* Content */}
            <View style={s.content}>
              <View style={s.titleRow}>
                <Text style={s.title} numberOfLines={1}>{item.title}</Text>
                {item.badge ? (
                  <View style={[s.badge, { backgroundColor: accent + '18' }]}>
                    <Text style={[s.badgeText, { color: accent }]}>{item.badge}</Text>
                  </View>
                ) : null}
              </View>
              {item.subtitle ? (
                <Text style={s.subtitle} numberOfLines={2}>{item.subtitle}</Text>
              ) : null}
              <Text style={s.ts}>{item.timestamp}</Text>
            </View>
          </View>
        );
      })}
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { gap: 0 },
  empty: {
    paddingVertical: spacing.lg,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 13,
    color: colors.textMuted,
    fontStyle: 'italic',
  },

  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: spacing.sm,
    gap: spacing.sm,
  },
  rowCompact: {
    paddingVertical: spacing.xs,
  },

  spineCol: {
    width: 12,
    alignItems: 'center',
    paddingTop: 10,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  line: {
    width: 1.5,
    flex: 1,
    backgroundColor: colors.border,
    marginTop: 4,
    minHeight: 24,
  },

  iconWrap: {
    width: 34,
    height: 34,
    borderRadius: radius.md,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    marginTop: 1,
  },
  icon: { fontSize: 15 },

  content: { flex: 1, gap: 2, paddingTop: 2 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  title: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textPrimary,
    flex: 1,
  },
  subtitle: {
    fontSize: 12,
    color: colors.textSecondary,
    lineHeight: 18,
  },
  ts: {
    fontSize: 10,
    color: colors.textMuted,
    fontWeight: '600',
    marginTop: 1,
  },

  badge: {
    borderRadius: radius.full,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  badgeText: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
});
