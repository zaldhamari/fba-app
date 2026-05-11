import React, { useEffect, useRef } from 'react';
import { View, Animated, StyleSheet, ViewStyle, StyleProp } from 'react-native';
import { DS } from '../../theme/ds';

// ── Shared pulse hook ─────────────────────────────────────────────────────────

function usePulse(duration = 750): Animated.Value {
  const opacity = useRef(new Animated.Value(0.45)).current;

  useEffect(() => {
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, {
          toValue:         1,
          duration,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue:         0.45,
          duration,
          useNativeDriver: true,
        }),
      ]),
    );
    anim.start();
    return () => anim.stop();
  }, []);

  return opacity;
}

// ── SkeletonLine — single animated placeholder bar ────────────────────────────

export interface SkeletonLineProps {
  /** Accepts number (px) or ViewStyle width values like '100%', '60%' */
  width?:  ViewStyle['width'];
  height?: number;
  radius?: number;
  style?:  StyleProp<ViewStyle>;
}

export function SkeletonLine({
  width  = '100%',
  height = 16,
  radius = 8,
  style,
}: SkeletonLineProps) {
  const opacity = usePulse();

  return (
    <Animated.View
      style={[
        sk.base,
        { width, height, borderRadius: radius, opacity },
        style,
      ]}
    />
  );
}

// ── SkeletonCard — full card placeholder matching AppCard layout ───────────────

export function SkeletonCard({ style }: { style?: StyleProp<ViewStyle> }) {
  return (
    <View style={[sk.card, style]}>
      {/* Eyebrow */}
      <SkeletonLine width="38%" height={11} />
      {/* Title */}
      <SkeletonLine width="68%" height={22} radius={6} />
      {/* Body line 1 */}
      <SkeletonLine width="82%" height={14} />
      {/* Body line 2 */}
      <SkeletonLine width="55%" height={14} />
      {/* Button row */}
      <View style={sk.btnRow}>
        <SkeletonLine width="45%" height={44} radius={14} />
        <SkeletonLine width="45%" height={44} radius={14} />
      </View>
    </View>
  );
}

// ── SkeletonMetricRow — row of 4 KPI tiles ────────────────────────────────────

export function SkeletonMetricRow({ style }: { style?: StyleProp<ViewStyle> }) {
  return (
    <View style={[sk.card, sk.metricRow, style]}>
      {[0, 1, 2, 3].map(i => (
        <View key={i} style={sk.metricItem}>
          <SkeletonLine width={44} height={24} radius={6} />
          <SkeletonLine width={52} height={10} radius={4} />
        </View>
      ))}
    </View>
  );
}

// ── SkeletonListItem — single list row (icon + text + badge) ──────────────────

export function SkeletonListItem({ style }: { style?: StyleProp<ViewStyle> }) {
  return (
    <View style={[sk.listItem, style]}>
      {/* Leading icon */}
      <SkeletonLine width={44} height={44} radius={12} />
      {/* Text block */}
      <View style={sk.listText}>
        <SkeletonLine width="60%" height={14} />
        <SkeletonLine width="40%" height={11} />
      </View>
      {/* Trailing badge */}
      <SkeletonLine width={56} height={24} radius={DS.radiusBadge} />
    </View>
  );
}

// ── SkeletonProductCard — product search result placeholder ───────────────────

export function SkeletonProductCard({ style }: { style?: StyleProp<ViewStyle> }) {
  return (
    <View style={[sk.card, style]}>
      <View style={sk.productRow}>
        {/* Product image */}
        <SkeletonLine width={72} height={72} radius={14} />
        <View style={sk.productText}>
          <SkeletonLine width="85%" height={14} />
          <SkeletonLine width="55%" height={12} />
          <SkeletonLine width="40%" height={22} radius={6} />
        </View>
      </View>
      {/* Stats row */}
      <View style={sk.statsRow}>
        {[0, 1, 2].map(i => (
          <View key={i} style={sk.statItem}>
            <SkeletonLine width={36} height={18} radius={4} />
            <SkeletonLine width={48} height={10} radius={4} />
          </View>
        ))}
      </View>
    </View>
  );
}

// ── SkeletonDashboard — full dashboard placeholder ────────────────────────────

export function SkeletonDashboard({ style }: { style?: StyleProp<ViewStyle> }) {
  return (
    <View style={[sk.page, style]}>
      {/* Hero card */}
      <View style={[sk.card, { minHeight: 140 }]}>
        <SkeletonLine width="50%" height={14} />
        <SkeletonLine width="72%" height={26} radius={6} />
        <SkeletonLine width="88%" height={14} />
      </View>
      {/* Metric row */}
      <SkeletonMetricRow />
      {/* List items */}
      {[0, 1, 2].map(i => (
        <SkeletonListItem key={i} style={i > 0 ? { marginTop: 1 } : undefined} />
      ))}
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const sk = StyleSheet.create({
  base: {
    backgroundColor: DS.skeletonBase,
  },
  card: {
    backgroundColor: DS.bgCard,
    borderRadius:    DS.radiusCard,
    borderWidth:     1,
    borderColor:     DS.border,
    padding:         DS.cardPadding,
    gap:             DS.rowGap + 4,
  },
  page: {
    gap: DS.sectionGap,
  },
  btnRow: {
    flexDirection: 'row',
    gap:           8,
    marginTop:     4,
  },
  metricRow: {
    flexDirection:  'row',
    justifyContent: 'space-between',
    alignItems:     'center',
    paddingVertical: 16,
  },
  metricItem: {
    flex:       1,
    alignItems: 'center',
    gap:        6,
  },
  listItem: {
    flexDirection:   'row',
    alignItems:      'center',
    gap:             12,
    paddingVertical: 12,
    paddingHorizontal: DS.pagePadding,
  },
  listText: {
    flex: 1,
    gap:  6,
  },
  productRow: {
    flexDirection: 'row',
    gap:           12,
    alignItems:    'flex-start',
  },
  productText: {
    flex: 1,
    gap:  6,
  },
  statsRow: {
    flexDirection:  'row',
    justifyContent: 'space-around',
    marginTop:      4,
  },
  statItem: {
    alignItems: 'center',
    gap:        4,
  },
});
