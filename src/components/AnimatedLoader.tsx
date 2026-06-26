import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { DS } from '../theme/ds';

interface AnimatedLoaderProps {
  messages:        string[];
  color?:          string;
  msPerStep?:      number;
  totalDurationMs?: number;
}

export function AnimatedLoader({
  messages,
  color          = DS.accent,
  msPerStep      = 1350,
  totalDurationMs,
}: AnimatedLoaderProps) {
  const [idx, setIdx]   = useState(0);
  const progress        = useRef(new Animated.Value(0)).current;
  const totalDuration   = totalDurationMs ?? msPerStep * messages.length;

  useEffect(() => {
    setIdx(0);
    progress.setValue(0);

    // Cycle through message labels
    const timer = setInterval(() => {
      setIdx(prev => Math.min(prev + 1, messages.length - 1));
    }, msPerStep);

    // Bar fills to 90% over the total duration — never reaches 100% until unmounted
    Animated.timing(progress, {
      toValue:         0.90,
      duration:        totalDuration,
      useNativeDriver: false,
    }).start();

    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const widthInterpolate = progress.interpolate({
    inputRange:  [0, 1],
    outputRange: ['0%', '100%'],
  });

  return (
    <View style={s.wrap}>
      <View style={s.dotRow}>
        {[0, 1, 2].map(i => <Dot key={i} color={color} delay={i * 200} />)}
      </View>
      <Text style={s.msg}>{messages[idx]}</Text>
      <View style={[s.track, { backgroundColor: color + '20' }]}>
        <Animated.View style={[s.fill, { backgroundColor: color, width: widthInterpolate }]} />
      </View>
      <Text style={s.hint}>{idx + 1} / {messages.length}</Text>
    </View>
  );
}

function Dot({ color, delay }: { color: string; delay: number }) {
  const opacity = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    const anim = Animated.loop(
      Animated.sequence([
        Animated.delay(delay),
        Animated.timing(opacity, { toValue: 1,   duration: 380, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.3, duration: 380, useNativeDriver: true }),
      ]),
    );
    anim.start();
    return () => anim.stop();
  }, [delay, opacity]);

  return (
    <Animated.View style={[s.dot, { backgroundColor: color, opacity }]} />
  );
}

const s = StyleSheet.create({
  wrap:   { alignItems: 'center', paddingVertical: 40, gap: 14, paddingHorizontal: 24 },
  dotRow: { flexDirection: 'row', gap: 8 },
  dot:    { width: 8, height: 8, borderRadius: 4 },
  msg:    {
    fontSize: 15, fontWeight: '700', color: DS.textPrimary,
    textAlign: 'center', lineHeight: 22, minHeight: 44,
  },
  track:  { width: '100%', height: 5, borderRadius: 3, overflow: 'hidden' },
  fill:   { height: 5, borderRadius: 3 },
  hint:   { fontSize: 10, color: DS.textMuted, fontWeight: '600' },
});
