import React from 'react';
import {
  ScrollView, StyleSheet, View, Text, TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { CompositeNavigationProp } from '@react-navigation/native';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import type { StackNavigationProp } from '@react-navigation/stack';
import type { RootStackParamList } from '../navigation/RootNavigator';
import {
  AppCard,
  SectionHeader,
  StatusBadge,
  MetricRow,
  DS,
} from '../components/ds';

// ── Tab param list (local — only needs the tabs we navigate to) ───────────────

type TabParamList = {
  Launch:    undefined;
  Search:    undefined;
  Calculate: undefined;
  Brand:     undefined;
  CoPilot:   undefined;
};

// ── Static mock data ──────────────────────────────────────────────────────────

const JOURNEY_METRICS = [
  { value: '4',   label: 'Completed', accent: DS.accent },
  { value: '2',   label: 'In Progress', accent: DS.indigo },
  { value: '3',   label: 'Remaining' },
  { value: '67%', label: 'Progress',  accent: DS.accent },
];

const USAGE_METRICS = [
  { value: '23', label: 'Researches' },
  { value: '12', label: 'Analyses',   accent: DS.indigo },
  { value: '8',  label: 'Calculations' },
  { value: '5',  label: 'Exports' },
];

const QUICK_ACTIONS = [
  { id: 'research',  icon: '◎', label: 'Research\nProduct',  color: '#0284C7', bg: '#EFF8FF', tab: 'Search'    as const },
  { id: 'analyze',   icon: '⊛', label: 'Analyze\nProduct',   color: DS.indigo,  bg: DS.indigoLight, tab: 'CoPilot' as const },
  { id: 'profit',    icon: '◈', label: 'Calculate\nProfit',   color: '#7C3AED', bg: '#F5F0FF', tab: 'Calculate' as const },
  { id: 'suppliers', icon: '⊞', label: 'Find\nSuppliers',    color: '#0284C7', bg: '#EFF8FF', tab: 'Search'    as const },
  { id: 'checklist', icon: '✓', label: 'Launch\nChecklist',  color: DS.accent,  bg: DS.accentLight, tab: null },
] as const;

// ── Circular progress ring (half-circle clipping, no SVG) ─────────────────────

function ProgressRing({ percent, size = 80 }: { percent: number; size?: number }) {
  const half   = size / 2;
  const stroke = Math.round(size / 10);
  const inner  = size - stroke * 2;

  const deg            = (percent / 100) * 360;
  const rightRotation  = Math.min(0, deg - 180);
  const leftRotation   = 180 - Math.max(0, deg - 180);

  return (
    <View style={{ width: size, height: size }}>
      {/* Track */}
      <View style={[StyleSheet.absoluteFillObject, {
        borderRadius: half,
        backgroundColor: DS.border,
      }]} />

      {/* Right-half fill */}
      <View style={{
        position: 'absolute', left: half, top: 0,
        width: half, height: size, overflow: 'hidden',
      }}>
        <View style={{
          position: 'absolute', left: -half, top: 0,
          width: size, height: size,
          borderRadius: half,
          backgroundColor: DS.accent,
          transform: [{ rotate: `${rightRotation}deg` }],
        }} />
      </View>

      {/* Left-half fill */}
      <View style={{
        position: 'absolute', left: 0, top: 0,
        width: half, height: size, overflow: 'hidden',
      }}>
        <View style={{
          position: 'absolute', left: 0, top: 0,
          width: size, height: size,
          borderRadius: half,
          backgroundColor: DS.accent,
          transform: [{ rotate: `${leftRotation}deg` }],
        }} />
      </View>

      {/* Inner mask → creates the donut ring */}
      <View style={{
        position: 'absolute',
        top: stroke, left: stroke,
        width: inner, height: inner,
        borderRadius: inner / 2,
        backgroundColor: DS.bgCard,
        alignItems: 'center', justifyContent: 'center',
      }}>
        <Text style={ring.pct}>{percent}%</Text>
        <Text style={ring.sub}>done</Text>
      </View>
    </View>
  );
}

const ring = StyleSheet.create({
  pct: { fontSize: 14, fontWeight: '900', color: DS.accent, letterSpacing: -0.5 },
  sub: { fontSize: 8,  fontWeight: '600', color: DS.textMuted, marginTop: -1 },
});

// ── Dashboard header (not in ScrollView — stays pinned) ───────────────────────

function DashboardHeader() {
  return (
    <View style={hd.bar}>
      <View>
        <Text style={hd.logo}>Siftly</Text>
        <Text style={hd.eyebrow}>LAUNCH CONTROL</Text>
      </View>
      <TouchableOpacity style={hd.bell} activeOpacity={0.7} accessibilityLabel="Notifications">
        <Text style={hd.bellIcon}>🔔</Text>
      </TouchableOpacity>
    </View>
  );
}

const hd = StyleSheet.create({
  bar: {
    flexDirection:     'row',
    justifyContent:    'space-between',
    alignItems:        'center',
    paddingHorizontal: DS.pagePadding,
    paddingTop:        10,
    paddingBottom:     12,
    backgroundColor:   DS.bgCard,
    borderBottomWidth: 1,
    borderBottomColor: DS.border,
  },
  logo:    { fontSize: 22, fontWeight: '900', color: DS.textPrimary, letterSpacing: -0.8 },
  eyebrow: { fontSize: 8,  fontWeight: '800', color: DS.accent, letterSpacing: 2.5 },
  bell: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: DS.bgSubtle,
    borderWidth: 1, borderColor: DS.border,
    alignItems: 'center', justifyContent: 'center',
  },
  bellIcon: { fontSize: 16 },
});

// ── Current product card ──────────────────────────────────────────────────────

function CurrentProductCard() {
  return (
    <AppCard>
      <View style={pc.row}>
        {/* Image placeholder */}
        <View style={pc.imgBox}>
          <Text style={pc.imgIcon}>📦</Text>
        </View>

        {/* Details */}
        <View style={pc.info}>
          <StatusBadge label="Strong Opportunity" variant="success" dot />
          <Text style={pc.title} numberOfLines={2}>
            Bamboo Cutting Board Set — Premium Kitchen Collection
          </Text>
          <Text style={pc.cat}>Kitchen & Dining</Text>
        </View>
      </View>

      {/* Progress row */}
      <View style={pc.progressRow}>
        <ProgressRing percent={67} size={80} />
        <View style={pc.progressInfo}>
          <Text style={pc.progressLabel}>Journey Progress</Text>
          <Text style={pc.progressSub}>
            You're 67% through your launch journey.{'\n'}
            Keep going — you're almost there!
          </Text>
          <View style={pc.progressBar}>
            <View style={[pc.progressFill, { width: '67%' }]} />
          </View>
        </View>
      </View>
    </AppCard>
  );
}

const pc = StyleSheet.create({
  row: { flexDirection: 'row', gap: 14, marginBottom: 16 },
  imgBox: {
    width: 72, height: 72, borderRadius: 16,
    backgroundColor: DS.bgSubtle,
    borderWidth: 1, borderColor: DS.border,
    alignItems: 'center', justifyContent: 'center',
    flexShrink: 0,
  },
  imgIcon: { fontSize: 28 },
  info:  { flex: 1, gap: 6, justifyContent: 'center' },
  title: {
    fontSize: 14, fontWeight: '800', color: DS.textPrimary,
    letterSpacing: -0.3, lineHeight: 20,
  },
  cat: { fontSize: 11, color: DS.textMuted, fontWeight: '500' },

  progressRow: { flexDirection: 'row', alignItems: 'center', gap: 16, paddingTop: 4 },
  progressInfo: { flex: 1, gap: 6 },
  progressLabel: { fontSize: 12, fontWeight: '700', color: DS.textPrimary },
  progressSub:   { fontSize: 11, color: DS.textSecondary, lineHeight: 16 },
  progressBar: {
    height: 4, borderRadius: 2, backgroundColor: DS.border, overflow: 'hidden',
  },
  progressFill: {
    height: '100%', borderRadius: 2, backgroundColor: DS.accent,
  },
});

// ── Quick Actions grid ────────────────────────────────────────────────────────

function QuickActions({
  onPress,
}: {
  onPress: (tab: 'Search' | 'Calculate' | 'CoPilot' | null) => void;
}) {
  return (
    <View style={qa.grid}>
      {QUICK_ACTIONS.map((action, i) => {
        const isLast   = i === QUICK_ACTIONS.length - 1;
        const isLone   = isLast && QUICK_ACTIONS.length % 2 !== 0;
        return (
          <TouchableOpacity
            key={action.id}
            style={[qa.card, isLone && qa.cardFull]}
            onPress={() => onPress(action.tab)}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel={action.label.replace('\n', ' ')}
          >
            <View style={[qa.iconTile, { backgroundColor: action.bg }]}>
              <Text style={[qa.icon, { color: action.color }]}>{action.icon}</Text>
            </View>
            <Text style={qa.label}>{action.label}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const qa = StyleSheet.create({
  grid: {
    flexDirection: 'row',
    flexWrap:      'wrap',
    gap:           12,
  },
  card: {
    // (width - gap) / 2  — parent has pagePadding on sides via content container
    width:           '47.5%',
    backgroundColor: DS.bgCard,
    borderRadius:    DS.radiusCard - 4,
    borderWidth:     1,
    borderColor:     DS.border,
    padding:         16,
    gap:             10,
    shadowColor:     '#0D1B4B',
    shadowOffset:    { width: 0, height: 2 },
    shadowOpacity:   0.05,
    shadowRadius:    8,
    elevation:       2,
  },
  cardFull: { width: '100%' },
  iconTile: {
    width: 40, height: 40, borderRadius: 12,
    alignItems: 'center', justifyContent: 'center',
  },
  icon:  { fontSize: 20, fontWeight: '700' },
  label: {
    fontSize: 13, fontWeight: '700', color: DS.textPrimary,
    lineHeight: 18, letterSpacing: -0.2,
  },
});

// ── Screen ────────────────────────────────────────────────────────────────────

type LaunchNavProp = CompositeNavigationProp<
  BottomTabNavigationProp<TabParamList>,
  StackNavigationProp<RootStackParamList>
>;

export default function LaunchControlScreen() {
  const navigation = useNavigation<LaunchNavProp>();

  function handleQuickAction(tab: 'Search' | 'Calculate' | 'CoPilot' | null) {
    if (tab) navigation.navigate(tab);
    else navigation.navigate('Checklist');
  }

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <DashboardHeader />

      <ScrollView
        style={s.scroll}
        contentContainerStyle={s.content}
        showsVerticalScrollIndicator={false}
      >
        {/* Greeting */}
        <View style={s.greeting}>
          <Text style={s.greetTitle}>Welcome back, Founder 🚀</Text>
          <Text style={s.greetSub}>Here's your launch progress</Text>
        </View>

        {/* Current product */}
        <CurrentProductCard />

        {/* Launch journey stats */}
        <SectionHeader title="Your Launch Journey" style={s.sectionHeader} />
        <MetricRow items={JOURNEY_METRICS} />

        {/* Monthly usage */}
        <SectionHeader title="Monthly Usage" style={s.sectionHeader} />
        <MetricRow items={USAGE_METRICS} />

        {/* Quick actions */}
        <SectionHeader title="Quick Actions" style={s.sectionHeader} />
        <QuickActions onPress={handleQuickAction} />
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe:    { flex: 1, backgroundColor: DS.bgCanvas },
  scroll:  { flex: 1 },
  content: {
    paddingHorizontal: DS.pagePadding,
    paddingTop:        DS.sectionGap,
    paddingBottom:     60,
    gap:               DS.sectionGap,
  },
  greeting: { gap: 2, paddingBottom: 4 },
  greetTitle: {
    fontSize:      24,
    fontWeight:    '900',
    color:         DS.textPrimary,
    letterSpacing: -0.6,
  },
  greetSub: {
    fontSize: 14, color: DS.textSecondary, lineHeight: 20,
  },
  sectionHeader: { marginBottom: -8 },
});
