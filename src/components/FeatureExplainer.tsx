import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { DS } from '../theme/ds';

// ─── FeatureExplainer ─────────────────────────────────────────────────────────
// One consistent "what does this do?" affordance for non-obvious features.
// Collapsed by default (a small ⓘ link) so it never clutters for experienced
// users; tap to reveal a tinted explanation box. Use only where a real beginner
// would genuinely hesitate — not on self-explanatory controls.

interface Props {
  text:        string;   // the plain-English explanation
  label?:      string;   // collapsed prompt (default "What's this?")
  defaultOpen?: boolean;  // expand on first render (e.g. for first-time screens)
}

export function FeatureExplainer({ text, label = "What's this?", defaultOpen = false }: Props) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <View style={fe.wrap}>
      <TouchableOpacity
        onPress={() => setOpen(o => !o)}
        activeOpacity={0.7}
        hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
        accessibilityRole="button"
        accessibilityLabel={open ? 'Hide explanation' : label}
        accessibilityState={{ expanded: open }}
      >
        <Text style={fe.toggle}>ⓘ  {open ? 'Hide' : label}</Text>
      </TouchableOpacity>
      {open && (
        <View style={fe.box}>
          <Text style={fe.text}>{text}</Text>
        </View>
      )}
    </View>
  );
}

const fe = StyleSheet.create({
  wrap:   { gap: 6 },
  toggle: { fontSize: 12, fontWeight: '700', color: DS.accent },
  box: {
    backgroundColor: DS.accentLight,
    borderRadius:    DS.radiusChip,
    borderLeftWidth: 3,
    borderLeftColor: DS.accent,
    paddingHorizontal: 12,
    paddingVertical:   10,
  },
  text: { fontSize: 12.5, color: DS.textSecondary, lineHeight: 18 },
});
