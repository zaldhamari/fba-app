import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { DS } from '../theme/ds';
import { track } from '../lib/analytics';

// ─── Verdict Feedback ─────────────────────────────────────────────────────────
// Captures the three Reality-Check signals from real users, straight into the
// existing analytics pipeline:
//   agreement  — "does this verdict seem right?"   (TRUST)
//   utility    — "showed you something new?"        (UTILITY)
//   influence  — "affected your decision?"          (INFLUENCE)
//
// Progressive disclosure keeps friction low: only the trust question shows first;
// the other two appear after the user answers it, so it never feels like a survey.

type QuestionKey = 'agreement' | 'utility' | 'influence';

const QUESTIONS: { key: QuestionKey; prompt: string }[] = [
  { key: 'agreement', prompt: 'Does this verdict seem right?' },
  { key: 'utility',   prompt: 'Show you something you hadn’t considered?' },
  { key: 'influence', prompt: 'Did this affect your decision?' },
];

interface Props {
  verdict:    string;        // LAUNCH / TEST / AVOID
  confidence: number;
  asin?:      string;        // optional, for tying feedback to a specific product
}

export default function VerdictFeedback({ verdict, confidence, asin }: Props) {
  const [answers, setAnswers] = useState<Partial<Record<QuestionKey, boolean>>>({});

  const answer = (key: QuestionKey, value: boolean) => {
    if (answers[key] !== undefined) return; // one answer per question
    setAnswers(prev => ({ ...prev, [key]: value }));
    void track('verdict_feedback', { question: key, value, verdict, confidence, asin });
  };

  // Only reveal the next question once the previous one is answered.
  const visibleCount =
    answers.agreement === undefined ? 1
    : answers.utility === undefined ? 2
    : 3;
  const visible = QUESTIONS.slice(0, visibleCount);
  const allAnswered = QUESTIONS.every(q => answers[q.key] !== undefined);

  return (
    <View style={s.wrap}>
      <Text style={s.heading}>QUICK FEEDBACK</Text>
      {visible.map(q => {
        const a = answers[q.key];
        return (
          <View key={q.key} style={s.row}>
            <Text style={s.prompt}>{q.prompt}</Text>
            <View style={s.btns}>
              <TouchableOpacity
                style={[s.btn, a === true && s.btnYes]}
                onPress={() => answer(q.key, true)}
                disabled={a !== undefined}
                activeOpacity={0.7}
                accessibilityRole="button"
                accessibilityLabel={`${q.prompt} — yes`}
                accessibilityState={{ selected: a === true, disabled: a !== undefined }}
              >
                <Text style={[s.btnTxt, a === true && s.btnTxtYes]}>👍</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[s.btn, a === false && s.btnNo]}
                onPress={() => answer(q.key, false)}
                disabled={a !== undefined}
                activeOpacity={0.7}
                accessibilityRole="button"
                accessibilityLabel={`${q.prompt} — no`}
                accessibilityState={{ selected: a === false, disabled: a !== undefined }}
              >
                <Text style={[s.btnTxt, a === false && s.btnTxtNo]}>👎</Text>
              </TouchableOpacity>
            </View>
          </View>
        );
      })}
      {allAnswered && <Text style={s.thanks}>Thanks — this helps Siftly get sharper.</Text>}
    </View>
  );
}

const s = StyleSheet.create({
  wrap: {
    backgroundColor: DS.bgSubtle,
    borderRadius: DS.radiusCard,
    borderWidth: 1,
    borderColor: DS.border,
    padding: 12,
    gap: 8,
  },
  heading: { fontSize: 8, fontWeight: '800', color: DS.textMuted, letterSpacing: 1.8 },
  row:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  prompt:  { flex: 1, fontSize: 12, fontWeight: '600', color: DS.textSecondary, lineHeight: 16 },
  btns:    { flexDirection: 'row', gap: 6 },
  btn: {
    width: 38, height: 32, borderRadius: DS.radiusButton,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: DS.border, backgroundColor: DS.bgCard,
  },
  btnYes:  { backgroundColor: DS.successBg, borderColor: DS.success },
  btnNo:   { backgroundColor: DS.dangerBg,  borderColor: DS.danger },
  btnTxt:    { fontSize: 15, opacity: 0.55 },
  btnTxtYes: { opacity: 1 },
  btnTxtNo:  { opacity: 1 },
  thanks:  { fontSize: 11, color: DS.textMuted, fontStyle: 'italic', marginTop: 2 },
});
