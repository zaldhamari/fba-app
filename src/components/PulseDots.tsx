import React, { useEffect, useRef } from 'react';
import { View, Animated } from 'react-native';
import { colors } from '../theme';

export default function PulseDots({ color = colors.cyan }: { color?: string }) {
  const a = useRef(new Animated.Value(0.3)).current;
  const b = useRef(new Animated.Value(0.3)).current;
  const c = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    function pulse(val: Animated.Value, delay: number) {
      return Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(val, { toValue: 1,   duration: 280, useNativeDriver: true }),
          Animated.timing(val, { toValue: 0.3, duration: 280, useNativeDriver: true }),
          Animated.delay(Math.max(0, 840 - delay - 560)),
        ])
      );
    }
    const animations = [pulse(a, 0), pulse(b, 160), pulse(c, 320)];
    animations.forEach(an => an.start());
    return () => animations.forEach(an => an.stop());
  }, []);

  return (
    <View style={{ flexDirection: 'row', gap: 5, alignItems: 'center' }}>
      {([a, b, c] as Animated.Value[]).map((dot, i) => (
        <Animated.View
          key={i}
          style={{ width: 7, height: 7, borderRadius: 3.5, backgroundColor: color, opacity: dot }}
        />
      ))}
    </View>
  );
}
