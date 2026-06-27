import React, { useState } from 'react';
import {
  Modal, View, Text, TouchableOpacity,
  ScrollView, StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { DS } from '../theme/ds';
import { FEATURE_HELP, FeatureKey } from '../lib/featureHelp';

// ─── Modal ────────────────────────────────────────────────────────────────────

interface HelpModalProps {
  featureKey: FeatureKey;
  visible:    boolean;
  onClose:    () => void;
}

export function HelpModal({ featureKey, visible, onClose }: HelpModalProps) {
  const entry = FEATURE_HELP[featureKey];
  if (!entry) return null;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <SafeAreaView style={m.safe}>
        {/* Header */}
        <View style={m.header}>
          <View style={m.headerIcon}>
            <Text style={m.headerGlyph}>?</Text>
          </View>
          <View style={m.headerText}>
            <Text style={m.headerName}>{entry.name}</Text>
            <Text style={m.headerTagline} numberOfLines={2}>{entry.tagline}</Text>
          </View>
          <TouchableOpacity
            onPress={onClose}
            hitSlop={{ top: 16, bottom: 16, left: 16, right: 16 }}
            activeOpacity={0.7}
          >
            <Text style={m.closeBtn}>✕</Text>
          </TouchableOpacity>
        </View>

        {/* Sections */}
        <ScrollView
          contentContainerStyle={m.body}
          showsVerticalScrollIndicator={false}
        >
          {entry.quickTip && (
            <View style={m.quickTipCard}>
              <Text style={m.quickTipLabel}>QUICK TIP</Text>
              <Text style={m.quickTipText}>{entry.quickTip}</Text>
            </View>
          )}
          {entry.sections.map((section, i) => (
            <View key={i} style={m.section}>
              <Text style={m.sectionTitle}>{section.title.toUpperCase()}</Text>
              <Text style={m.sectionContent}>{section.content}</Text>
            </View>
          ))}
          {entry.recommendation && (
            <View style={m.recCard}>
              <Text style={m.recLabel}>HOW TO USE THIS PAGE</Text>
              <Text style={m.recText}>{entry.recommendation}</Text>
            </View>
          )}
          <View style={m.bottomPad} />
        </ScrollView>

        {/* Footer CTA */}
        <View style={m.footer}>
          <TouchableOpacity style={m.gotItBtn} onPress={onClose} activeOpacity={0.85}>
            <Text style={m.gotItTxt}>Got it</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </Modal>
  );
}

const m = StyleSheet.create({
  safe:         { flex: 1, backgroundColor: DS.bgCanvas },

  header:       { flexDirection: 'row', alignItems: 'flex-start', gap: 12, padding: 20, borderBottomWidth: 1, borderBottomColor: DS.border, backgroundColor: DS.bgCard },
  headerIcon:   { width: 36, height: 36, borderRadius: 10, backgroundColor: DS.accentLight, alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 1 },
  headerGlyph:  { fontSize: 16, fontWeight: '900', color: DS.accent },
  headerText:   { flex: 1, gap: 2 },
  headerName:   { fontSize: 17, fontWeight: '900', color: DS.textPrimary, letterSpacing: -0.4 },
  headerTagline:{ fontSize: 12, color: DS.textSecondary, lineHeight: 17 },
  closeBtn:     { fontSize: 20, color: DS.textMuted, fontWeight: '300', paddingTop: 4 },

  body:         { padding: 20, gap: 20, paddingBottom: 8 },
  quickTipCard: { backgroundColor: DS.accent + '0E', borderRadius: 12, borderWidth: 1, borderColor: DS.accent + '30', padding: 14, gap: 5 },
  quickTipLabel:{ fontSize: 9, fontWeight: '800' as const, color: DS.accent, letterSpacing: 2 },
  quickTipText: { fontSize: 13, color: DS.textSecondary, lineHeight: 20 },
  section:      { gap: 6 },
  sectionTitle: { fontSize: 9, fontWeight: '800', color: DS.accent, letterSpacing: 2, marginBottom: 2 },
  sectionContent:{ fontSize: 14, color: DS.textSecondary, lineHeight: 23 },

  recCard:      { backgroundColor: DS.accent + '0E', borderRadius: 12, borderWidth: 1, borderColor: DS.accent + '30', padding: 14, gap: 5 },
  recLabel:     { fontSize: 9, fontWeight: '800' as const, color: DS.accent, letterSpacing: 2 },
  recText:      { fontSize: 13, color: DS.textSecondary, lineHeight: 20 },

  bottomPad:    { height: 16 },

  footer:       { padding: 20, borderTopWidth: 1, borderTopColor: DS.border, backgroundColor: DS.bgCard },
  gotItBtn:     { backgroundColor: DS.accent, borderRadius: DS.radiusButton, paddingVertical: 15, alignItems: 'center' },
  gotItTxt:     { fontSize: 15, fontWeight: '800', color: DS.bgCard },
});

// ─── Self-contained Help Button ───────────────────────────────────────────────
// Drop anywhere — maintains its own modal state.

interface HelpButtonProps {
  featureKey: FeatureKey;
  size?:      'sm' | 'md';
}

export function HelpButton({ featureKey, size = 'md' }: HelpButtonProps) {
  const [visible, setVisible] = useState(false);
  const isSmall = size === 'sm';

  return (
    <>
      <TouchableOpacity
        style={[b.btn, isSmall && b.btnSm]}
        onPress={() => setVisible(true)}
        activeOpacity={0.7}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        accessibilityLabel={`Help: ${FEATURE_HELP[featureKey]?.name ?? featureKey}`}
        accessibilityRole="button"
      >
        <Text style={[b.glyph, isSmall && b.glyphSm]}>?</Text>
      </TouchableOpacity>
      <HelpModal
        featureKey={featureKey}
        visible={visible}
        onClose={() => setVisible(false)}
      />
    </>
  );
}

const b = StyleSheet.create({
  btn:    { width: 28, height: 28, borderRadius: 14, backgroundColor: DS.accent, alignItems: 'center', justifyContent: 'center' },
  btnSm:  { width: 22, height: 22, borderRadius: 11 },
  glyph:  { fontSize: 13, fontWeight: '900', color: DS.bgCard },
  glyphSm:{ fontSize: 11 },
});

// ─── Screen Help Row ──────────────────────────────────────────────────────────
// Renders the short tagline + HelpButton beneath a screen title.
// Drop in immediately below <AppHeader /> or any pinned title block.

interface ScreenHelpRowProps {
  featureKey: FeatureKey;
}

export function ScreenHelpRow({ featureKey }: ScreenHelpRowProps) {
  const entry = FEATURE_HELP[featureKey];
  if (!entry) return null;

  return (
    <View style={r.row}>
      <Text style={r.tagline} numberOfLines={1}>{entry.tagline}</Text>
      <HelpButton featureKey={featureKey} size="sm" />
    </View>
  );
}

const r = StyleSheet.create({
  row:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 7, backgroundColor: DS.bgSubtle, borderBottomWidth: 1, borderBottomColor: DS.border },
  tagline: { flex: 1, fontSize: 11, color: DS.textSecondary, letterSpacing: 0.1, marginRight: 8 },
});
