import React, { useState } from 'react';
import { ScrollView, View, Text, StyleSheet, SafeAreaView } from 'react-native';
import { colors, spacing, radius } from '../theme';
import {
  SectionCard,
  ProgressRing,
  MetricTile,
  MetricRow,
  SegmentedControl,
  HeroCard,
  InsightCard,
  EmptyState,
  ActivityFeed,
  QuickActionCard,
  QuickActionGrid,
  HeroStatRow,
  SECTION_COLORS,
} from '../components/ui';

type Tab = 'a' | 'b' | 'c';

const DEMO_ACTIVITIES = [
  { id: '1', icon: '◉', title: 'Product analyzed', subtitle: 'Silicone Kitchen Utensil Set — score 82', timestamp: '2 min ago', color: SECTION_COLORS.pilot, badge: 'HIGH' },
  { id: '2', icon: '≋', title: 'Keywords exported', subtitle: '47 keywords saved to vault', timestamp: '18 min ago', color: SECTION_COLORS.keywords },
  { id: '3', icon: '⬡', title: 'Supplier found', subtitle: 'Guangzhou factory — MOQ 200 units', timestamp: '1 hour ago', color: SECTION_COLORS.launch },
  { id: '4', icon: '✦', title: 'Brand created', subtitle: 'KitchCo — tagline generated', timestamp: 'Yesterday', color: SECTION_COLORS.brand },
];

const DEMO_ACTIONS = [
  { icon: '◉', label: 'Analyze Product', sublabel: 'ASIN lookup', color: SECTION_COLORS.pilot, onPress: () => {} },
  { icon: '≋', label: 'Keywords', sublabel: 'Find terms', color: SECTION_COLORS.keywords, badge: '12', onPress: () => {} },
  { icon: '⬡', label: 'Suppliers', sublabel: 'Source globally', color: SECTION_COLORS.launch, onPress: () => {} },
  { icon: '✦', label: 'Brand Kit', sublabel: 'Build identity', color: SECTION_COLORS.brand, onPress: () => {} },
];

export function UIKitScreen() {
  const [tab, setTab] = useState<Tab>('a');
  const [seg, setSeg] = useState<'overview' | 'details' | 'history'>('overview');

  return (
    <SafeAreaView style={s.safe}>
      <ScrollView
        contentContainerStyle={s.scroll}
        showsVerticalScrollIndicator={false}
      >
        <Text style={s.screenTitle}>UI Kit</Text>
        <Text style={s.screenSub}>Component library · Siftly design system</Text>

        {/* ── HeroCard ── */}
        <Text style={s.sectionLabel}>HERO CARD</Text>
        <HeroCard
          eyebrow="YOUR PROGRESS"
          title="3 of 7 steps"
          subtitle="You're ahead of 80% of new sellers"
          accentColor={SECTION_COLORS.pilot}
          progress={43}
          showOrbs
          icon="◉"
        />

        {/* ── SegmentedControl ── */}
        <Text style={s.sectionLabel}>SEGMENTED CONTROL</Text>
        <SegmentedControl<'overview' | 'details' | 'history'>
          options={[
            { key: 'overview', label: 'Overview', icon: '◈' },
            { key: 'details',  label: 'Details',  icon: '≋' },
            { key: 'history',  label: 'History',  icon: '↻' },
          ]}
          value={seg}
          onChange={setSeg}
          accentColor={SECTION_COLORS.pilot}
        />

        {/* ── ProgressRing standalone ── */}
        <Text style={s.sectionLabel}>PROGRESS RING</Text>
        <View style={s.ringRow}>
          {([15, 42, 67, 100] as const).map(p => (
            <ProgressRing
              key={p}
              progress={p}
              size={72}
              strokeWidth={8}
              color={p >= 67 ? SECTION_COLORS.launch : p >= 42 ? SECTION_COLORS.pilot : SECTION_COLORS.brand}
              animated
            />
          ))}
        </View>

        {/* ── SectionCard ── */}
        <Text style={s.sectionLabel}>SECTION CARD</Text>
        <SectionCard
          eyebrow="RESEARCH"
          title="Market Analysis"
          accentColor={SECTION_COLORS.pilot}
          showAccentBorder
        >
          <Text style={s.demoBody}>
            SectionCard accepts any children and renders them below the eyebrow + title with consistent padding and shadow.
          </Text>
        </SectionCard>

        {/* ── MetricTile + MetricRow ── */}
        <Text style={s.sectionLabel}>METRIC ROW</Text>
        <MetricRow
          metrics={[
            { label: 'Revenue', value: '$4,820', icon: '$', color: SECTION_COLORS.launch, trend: 'up', trendValue: '+12%' },
            { label: 'Units',   value: 142,      icon: '◈', color: SECTION_COLORS.pilot,  trend: 'up', trendValue: '+8%'  },
            { label: 'Margin',  value: '34%',    icon: '%', color: SECTION_COLORS.brand,  trend: 'down', trendValue: '-2%' },
            { label: 'Reviews', value: '4.7★',   icon: '★', color: SECTION_COLORS.keywords },
          ]}
        />

        <Text style={s.sectionLabel}>METRIC TILE (tinted)</Text>
        <View style={s.tileRow}>
          <MetricTile label="Score" value={82} icon="◉" color={SECTION_COLORS.pilot} tinted style={{ flex: 1 }} />
          <MetricTile label="Rank"  value="#14" icon="↑" color={SECTION_COLORS.launch} tinted style={{ flex: 1 }} />
        </View>

        {/* ── InsightCard ── */}
        <Text style={s.sectionLabel}>INSIGHT CARDS</Text>
        <InsightCard
          variant="tip"
          icon="◎"
          label="TIP"
          text="Sellers with 4+ images convert 40% higher. Add lifestyle photos to your listing."
          actionLabel="Open checklist"
          onAction={() => {}}
          animated
        />
        <InsightCard
          variant="warning"
          icon="⚠"
          label="WARNING"
          text="Your keyword density is below average for this category."
        />
        <InsightCard
          variant="success"
          icon="✓"
          label="SUCCESS"
          text="Brand registered! Your listings are now protected."
        />

        {/* ── ActivityFeed ── */}
        <Text style={s.sectionLabel}>ACTIVITY FEED</Text>
        <SectionCard>
          <ActivityFeed items={DEMO_ACTIVITIES} />
        </SectionCard>

        {/* ── QuickActionGrid ── */}
        <Text style={s.sectionLabel}>QUICK ACTION GRID</Text>
        <QuickActionGrid actions={DEMO_ACTIONS} columns={2} />

        {/* ── QuickActionCard row layout ── */}
        <Text style={s.sectionLabel}>QUICK ACTION (ROW)</Text>
        <SectionCard gap={spacing.xs}>
          <QuickActionCard icon="◉" label="Run product analysis" sublabel="Paste an ASIN to start" color={SECTION_COLORS.pilot} layout="row" onPress={() => {}} />
          <QuickActionCard icon="≋" label="Find keywords" sublabel="47 saved this week" color={SECTION_COLORS.keywords} layout="row" badge="3" onPress={() => {}} />
          <QuickActionCard icon="⬡" label="Source supplier" sublabel="Premium · upgrade to unlock" color={SECTION_COLORS.launch} layout="row" disabled onPress={() => {}} />
        </SectionCard>

        {/* ── EmptyState ── */}
        <Text style={s.sectionLabel}>EMPTY STATE</Text>
        <EmptyState
          icon="◈"
          title="No products yet"
          subtitle="Search for an ASIN or scan a barcode to analyze your first product."
          action={{ label: 'Analyze a Product', onPress: () => {}, color: SECTION_COLORS.pilot }}
          secondaryAction={{ label: 'Browse examples', onPress: () => {} }}
        />

        {/* ── HeroStatRow ── */}
        <Text style={s.sectionLabel}>HERO STAT ROW</Text>
        <HeroStatRow stats={[
          { icon: '$', value: '$4.8K', label: 'Revenue' },
          { icon: '◈', value: 142,    label: 'Units' },
          { icon: '%', value: '34%',  label: 'Margin' },
          { icon: '★', value: '4.7',  label: 'Rating' },
        ]} />

        <View style={{ height: spacing.xxl }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe:   { flex: 1, backgroundColor: colors.bg },
  scroll: { padding: spacing.lg, gap: spacing.md },

  screenTitle: {
    fontSize: 32,
    fontWeight: '900',
    color: colors.textPrimary,
    letterSpacing: -1.2,
  },
  screenSub: {
    fontSize: 13,
    color: colors.textSecondary,
    marginTop: -spacing.xs,
    marginBottom: spacing.xs,
  },

  sectionLabel: {
    fontSize: 9,
    fontWeight: '800',
    color: colors.textMuted,
    letterSpacing: 2,
    marginTop: spacing.sm,
  },

  ringRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    backgroundColor: colors.bgCard,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
  },

  tileRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },

  demoBody: {
    fontSize: 13,
    color: colors.textSecondary,
    lineHeight: 20,
    marginTop: spacing.xs,
  },
});
