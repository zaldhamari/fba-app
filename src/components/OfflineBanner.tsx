import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { DS } from '../theme/ds';

export function OfflineBanner({ visible }: { visible: boolean }) {
  if (!visible) return null;
  return (
    <View style={s.banner}>
      <Text style={s.text}>No internet connection — some features unavailable</Text>
    </View>
  );
}

const s = StyleSheet.create({
  banner: {
    backgroundColor: DS.warning,
    paddingVertical: 6,
    paddingHorizontal: DS.pagePadding,
    alignItems: 'center',
  },
  text: { fontSize: 12, fontWeight: '600', color: DS.bgCard },
});
