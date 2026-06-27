import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { DS } from '../theme/ds';
import { usePipeline } from '../context/PipelineContext';

const STAGES = [
  { id: 'niche',    label: 'Niche',    icon: '◎' },
  { id: 'validate', label: 'Research', icon: '✦' },
  { id: 'sourcing', label: 'Source',   icon: '⬡' },
  { id: 'costs',    label: 'Profit',   icon: '✈' },
  { id: 'brand',    label: 'Brand',    icon: '▣' },
] as const;

export function PipelineProgressBar() {
  const { completedStages, activeNiche, trackPipelineEvent } = usePipeline();
  const navigation = useNavigation<any>();

  if (!activeNiche) return null;

  const allDone = completedStages.length >= 5;

  function openLaunchDecision(from: string) {
    trackPipelineEvent('launch_decision_viewed', { from });
    navigation.navigate('LaunchDecision');
  }

  return (
    <View style={s.wrap}>
      <View style={s.track}>
        {STAGES.map((stage, idx) => {
          const done   = completedStages.includes(stage.id);
          const isLast = idx === STAGES.length - 1;
          return (
            <View key={stage.id} style={s.stageCol}>
              <View style={s.dotRow}>
                {idx > 0 && <View style={[s.connector, done && s.connectorDone]} />}
                <View style={[s.dot, done && s.dotDone]}>
                  <Text style={[s.dotIcon, done && s.dotIconDone]}>{stage.icon}</Text>
                </View>
                {!isLast && (
                  <View style={[s.connector, completedStages.includes(STAGES[idx + 1]?.id) && s.connectorDone]} />
                )}
              </View>
              <Text style={[s.label, done && s.labelDone]}>{stage.label}</Text>
            </View>
          );
        })}

        {/* Launch Decision stage */}
        <View style={s.stageCol}>
          <View style={s.dotRow}>
            <View style={[s.connector, allDone && s.connectorDone]} />
            <TouchableOpacity
              style={[s.dot, s.launchDot, allDone && s.launchDotReady]}
              onPress={() => openLaunchDecision('progress_bar')}
              activeOpacity={0.75}
            >
              <Text style={[s.dotIcon, allDone ? s.dotIconDone : undefined]}>🚀</Text>
            </TouchableOpacity>
          </View>
          <Text style={[s.label, allDone && s.labelDone]}>Launch</Text>
        </View>
      </View>

      <View style={s.bottomRow}>
        <Text style={s.hintTxt} numberOfLines={1}>
          {activeNiche.keyword} · {completedStages.length}/5 stages
        </Text>
        <TouchableOpacity
          style={[s.decisionBtn, allDone && s.decisionBtnReady]}
          onPress={() => openLaunchDecision('hint_bar')}
          activeOpacity={0.8}
        >
          <Text style={[s.decisionBtnTxt, allDone && s.decisionBtnTxtReady]}>
            {allDone ? '🚀 Get Decision' : 'Launch Decision →'}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  wrap: {
    backgroundColor:   DS.accentLight,
    borderBottomWidth: 1,
    borderBottomColor: DS.border,
    paddingHorizontal: DS.pagePadding,
    paddingTop:        8,
    paddingBottom:     6,
    gap:               6,
  },
  track: {
    flexDirection:  'row',
    alignItems:     'center',
    justifyContent: 'space-between',
  },
  stageCol: {
    alignItems: 'center',
    gap:        3,
    flex:       1,
  },
  dotRow: {
    flexDirection:  'row',
    alignItems:     'center',
    width:          '100%',
    justifyContent: 'center',
  },
  connector:     { flex: 1, height: 2, backgroundColor: DS.border, maxWidth: 20 },
  connectorDone: { backgroundColor: DS.accent },
  dot: {
    width:           22,
    height:          22,
    borderRadius:    11,
    backgroundColor: DS.bgCard,
    borderWidth:     1.5,
    borderColor:     DS.border,
    alignItems:      'center',
    justifyContent:  'center',
  },
  dotDone:        { backgroundColor: DS.accent, borderColor: DS.accent },
  launchDot:      { borderColor: DS.textMuted },
  launchDotReady: { backgroundColor: DS.success, borderColor: DS.success },
  dotIcon:        { fontSize: 9, color: DS.textMuted, fontWeight: '700' },
  dotIconDone:    { color: DS.bgCard },
  label:          { fontSize: 8, fontWeight: '600', color: DS.textMuted, letterSpacing: 0.3, textAlign: 'center' },
  labelDone:      { color: DS.accent, fontWeight: '800' },
  bottomRow:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  hintTxt:        { fontSize: 10, color: DS.textSecondary, flex: 1 },
  decisionBtn: {
    flexDirection:    'row',
    alignItems:       'center',
    paddingHorizontal: 10,
    paddingVertical:   5,
    borderRadius:     DS.radiusBadge,
    backgroundColor:  DS.bgCard,
    borderWidth:      1,
    borderColor:      DS.border,
  },
  decisionBtnReady:    { backgroundColor: DS.success, borderColor: DS.success },
  decisionBtnTxt:      { fontSize: 10, fontWeight: '800', color: DS.accent },
  decisionBtnTxtReady: { color: DS.bgCard },
});
