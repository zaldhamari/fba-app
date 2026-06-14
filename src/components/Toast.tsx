import React, { useEffect, useRef } from 'react';
import { Animated, Text, StyleSheet } from 'react-native';
import { DS } from '../theme/ds';

interface ToastProps {
  message: string;
  visible: boolean;
  onHide: () => void;
  type?: 'success' | 'info' | 'error';
}

export function Toast({ message, visible, onHide, type = 'success' }: ToastProps) {
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      Animated.sequence([
        Animated.timing(opacity, { toValue: 1, duration: 200, useNativeDriver: true }),
        Animated.delay(1800),
        Animated.timing(opacity, { toValue: 0, duration: 300, useNativeDriver: true }),
      ]).start(() => onHide());
    }
  }, [visible]);

  if (!visible) return null;

  const bg = type === 'success' ? DS.success : type === 'error' ? DS.danger : DS.accent;

  return (
    <Animated.View style={[s.container, { opacity, backgroundColor: bg }]}>
      <Text style={s.text}>{message}</Text>
    </Animated.View>
  );
}

const s = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 90,
    alignSelf: 'center',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: DS.radiusButton,
    zIndex: 9999,
    elevation: 10,
  },
  text: { color: '#fff', fontSize: 13, fontWeight: '600' },
});
