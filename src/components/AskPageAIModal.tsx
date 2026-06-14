import React, { useState, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, Modal, ScrollView, StyleSheet,
  TextInput, KeyboardAvoidingView, Platform, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { DS } from '../theme/ds';
import { FEATURE_HELP, FeatureKey } from '../lib/featureHelp';
import { api } from '../services/api';

function buildPageContext(featureKey: FeatureKey): string {
  const entry = FEATURE_HELP[featureKey];
  if (!entry) return '';
  const parts = [`Page: ${entry.name}. ${entry.tagline}`];
  if (entry.quickTip) parts.push(`Quick tip: ${entry.quickTip}`);
  entry.sections.forEach(s => parts.push(`${s.title}: ${s.content}`));
  if (entry.recommendation) parts.push(`Recommended workflow: ${entry.recommendation}`);
  return parts.join('\n\n');
}

function buildPresetQuestions(featureKey: FeatureKey): string[] {
  const entry = FEATURE_HELP[featureKey];
  if (!entry) return ['How do I use this page?'];
  const presets = ['How do I use this page?'];
  entry.sections.slice(0, 4).forEach(s => presets.push(`What is "${s.title}"?`));
  return presets;
}

interface AskPageAIModalProps {
  featureKey: FeatureKey;
  size?: 'sm' | 'md';
}

export function AskPageAIModal({ featureKey, size = 'md' }: AskPageAIModalProps) {
  const entry = FEATURE_HELP[featureKey];
  const [visible,  setVisible]  = useState(false);
  const [question, setQuestion] = useState('');
  const [loading,  setLoading]  = useState(false);
  const [answer,   setAnswer]   = useState('');
  const [error,    setError]    = useState('');
  const isSmall = size === 'sm';

  const ask = useCallback(async (q: string) => {
    if (!q.trim()) return;
    setQuestion(q); setLoading(true); setError(''); setAnswer('');
    try {
      const res = await api.askAI(q, buildPageContext(featureKey));
      setAnswer((res as any).answer ?? String(res));
    } catch (e: any) {
      setError(e?.message ?? 'Failed to get answer.');
    } finally {
      setLoading(false);
    }
  }, [featureKey]);

  function handleClose() {
    setVisible(false);
    setQuestion(''); setAnswer(''); setError('');
  }

  if (!entry) return null;
  const presets = buildPresetQuestions(featureKey);

  return (
    <>
      <TouchableOpacity
        style={[ap.btn, isSmall && ap.btnSm]}
        onPress={() => setVisible(true)}
        activeOpacity={0.7}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        accessibilityLabel={`Ask AI about ${entry.name}`}
        accessibilityRole="button"
      >
        <Text style={[ap.glyph, isSmall && ap.glyphSm]}>?</Text>
      </TouchableOpacity>

      <Modal
        visible={visible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={handleClose}
      >
        <SafeAreaView style={ap.safe}>
          <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
            <View style={ap.header}>
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={ap.title}>Ask about {entry.name}</Text>
                <Text style={ap.subtitle} numberOfLines={2}>{entry.tagline}</Text>
              </View>
              <TouchableOpacity onPress={handleClose} style={ap.closeBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Text style={ap.closeText}>✕</Text>
              </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={ap.body} keyboardShouldPersistTaps="handled">
              <Text style={ap.chipLabel}>Quick questions</Text>
              <View style={ap.chipWrap}>
                {presets.map(p => (
                  <TouchableOpacity key={p} style={ap.chip} onPress={() => ask(p)} disabled={loading} activeOpacity={0.7}>
                    <Text style={ap.chipText}>{p}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <View style={ap.inputRow}>
                <TextInput
                  style={ap.input}
                  placeholder="Ask anything about this page…"
                  placeholderTextColor={DS.textMuted}
                  value={question}
                  onChangeText={setQuestion}
                  onSubmitEditing={() => ask(question)}
                  returnKeyType="send"
                  multiline
                />
                <TouchableOpacity style={ap.sendBtn} onPress={() => ask(question)} disabled={loading || !question.trim()} activeOpacity={0.8}>
                  <Text style={ap.sendBtnText}>→</Text>
                </TouchableOpacity>
              </View>

              {loading && (
                <View style={ap.loadingWrap}>
                  <ActivityIndicator color={DS.accent} />
                </View>
              )}
              {!!error && <Text style={ap.errorText}>{error}</Text>}

              {!!answer && (
                <View style={ap.answerCard}>
                  <Text style={ap.answerLabel}>You asked</Text>
                  <Text style={ap.questionText}>{question}</Text>
                  <Text style={[ap.answerLabel, { marginTop: 12 }]}>Answer</Text>
                  <Text style={ap.answerText}>{answer}</Text>
                </View>
              )}
            </ScrollView>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </Modal>
    </>
  );
}

const ap = StyleSheet.create({
  btn:   { width: 28, height: 28, borderRadius: 14, backgroundColor: DS.indigo, alignItems: 'center', justifyContent: 'center' },
  btnSm: { width: 22, height: 22, borderRadius: 11 },
  glyph: { fontSize: 13, fontWeight: '900', color: '#fff' },
  glyphSm: { fontSize: 11 },

  safe: { flex: 1, backgroundColor: DS.bgCanvas },
  header: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 12,
    padding: DS.cardPadding, borderBottomWidth: 1, borderBottomColor: DS.border, backgroundColor: DS.bgCard,
  },
  title:    { fontSize: 17, fontWeight: '900', color: DS.textPrimary, letterSpacing: -0.4 },
  subtitle: { fontSize: 12, color: DS.textSecondary, lineHeight: 17 },
  closeBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: DS.bgSubtle, alignItems: 'center', justifyContent: 'center' },
  closeText:{ fontSize: 14, color: DS.textMuted, fontWeight: '600' },

  body: { padding: DS.cardPadding, gap: 8, paddingBottom: 40 },

  chipLabel: { fontSize: 11, fontWeight: '700', color: DS.textMuted, letterSpacing: 0.5, textTransform: 'uppercase' },
  chipWrap:  { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip:      { paddingHorizontal: 12, paddingVertical: 7, borderRadius: DS.radiusBadge, backgroundColor: DS.bgCard, borderWidth: 1, borderColor: DS.border },
  chipText:  { fontSize: 13, color: DS.textSecondary },

  inputRow: { flexDirection: 'row', gap: 8, marginTop: 8 },
  input:    { flex: 1, minHeight: 44, maxHeight: 88, borderRadius: DS.radiusInput, borderWidth: 1, borderColor: DS.border, paddingHorizontal: 14, paddingTop: 12, fontSize: 14, color: DS.textPrimary, backgroundColor: DS.bgCard },
  sendBtn:  { width: 44, height: 44, borderRadius: DS.radiusInput, backgroundColor: DS.accent, alignItems: 'center', justifyContent: 'center' },
  sendBtnText: { color: '#fff', fontSize: 20, fontWeight: '700', marginTop: -2 },

  loadingWrap: { alignItems: 'center', marginTop: 24 },
  errorText:   { color: DS.danger, fontSize: 14, textAlign: 'center', marginTop: 12 },

  answerCard:  { backgroundColor: DS.accentLight, borderRadius: DS.radiusCard, borderWidth: 1, borderColor: DS.accent + '30', padding: DS.cardPadding, marginTop: 16, gap: 4 },
  answerLabel: { fontSize: 9, fontWeight: '800', color: DS.accent, letterSpacing: 2, textTransform: 'uppercase' },
  questionText:{ fontSize: 13, color: DS.textSecondary, fontStyle: 'italic', lineHeight: 19 },
  answerText:  { fontSize: 14, color: DS.textPrimary, lineHeight: 22 },
});
