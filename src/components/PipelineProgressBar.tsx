import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { DS } from '../theme/ds';
import { usePipeline } from '../context/PipelineContext';

const STAGES = [
  { id: 'niche',     label: 'Niche',    icon: '◎' },
  { id: 'validate',  label: 'Validate', icon: '✦' },
  { id: 'suppliers', label: 'Source',   icon: '⬡' },
  { id: 'costs',     label: 'Costs',    icon: '✈' },
  { id: 'label',     label: 'Label',    icon: '▣' },
] as const;

export function PipelineProgressBar() {
  const { completedStages, activeNiche } = usePipeline();

  if (!activeNiche) return null;

  return (
    <View style={s.wrap}>
      <View style={s.track}>
        {STAGES.map((stage, idx) => {
          const done = completedStages.includes(stage.id);
          const isLast = idx === STAGES.length - 1;
          return (
            <View key={stage.id} style={s.stageCol}>
              <View style={s.dotRow}>
                {idx > 0 && <View style={[s.connector, done && s.connectorDone]} />}
                <View style={[s.dot, done && s.dotDone]}>
                  <Text style={[s.dotIcon, done && s.dotIconDone]}>{stage.icon}</Text>
                </View>
                {!isLast && <View style={[s.connector, completedStages.includes(STAGES[idx + 1]?.id) && s.connectorDone]} />}
              </View>
              <Text style={[s.label, done && s.labelDone]}>{stage.label}</Text>
            </View>
          );
        })}
      </View>
      <Text style={s.hint} numberOfLines={1}>
        Active: {activeNiche.keyword} · {completedStages.length}/5 stages
      </Text>
    </View>
  );
}

const s = StyleSheet.create({
  wrap: {
    backgroundColor: DS.accentLight,
    borderBottomWidth: 1,
    borderBottomColor: DS.border,
    paddingHorizontal: DS.pagePadding,
    paddingTop: 8,
    paddingBottom: 6,
    gap: 6,
  },
  track: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  stageCol: {
    alignItems: 'center',
    gap: 3,
    flex: 1,
  },
  dotRow: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    justifyContent: 'center',
  },
  connector: {
    flex: 1,
    height: 2,
    backgroundColor: DS.border,
    maxWidth: 20,
  },
  connectorDone: {
    backgroundColor: DS.accent,
  },
  dot: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: DS.bgCard,
    borderWidth: 1.5,
    borderColor: DS.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dotDone: {
    backgroundColor: DS.accent,
    borderColor: DS.accent,
  },
  dotIcon: {
    fontSize: 9,
    color: DS.textMuted,
    fontWeight: '700',
  },
  dotIconDone: {
    color: '#fff',
  },
  label: {
    fontSize: 8,
    fontWeight: '600',
    color: DS.textMuted,
    letterSpacing: 0.3,
    textAlign: 'center',
  },
  labelDone: {
    color: DS.accent,
    fontWeight: '800',
  },
  hint: {
    fontSize: 10,
    color: DS.textSecondary,
    textAlign: 'center',
  },
});
