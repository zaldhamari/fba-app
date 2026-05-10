import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { colors, spacing } from '../theme';
import { useSubscription } from '../hooks/useSubscription';
import { useAuth } from '../hooks/useAuth';
import { StackNavigationProp } from '@react-navigation/stack';
import { RootStackParamList } from '../navigation/RootNavigator';

type Props = { navigation: StackNavigationProp<RootStackParamList, 'Splash'> };

const MIN_DISPLAY_MS = 1800;

export default function SplashScreen({ navigation }: Props) {
  const { loaded, onboardingDone } = useSubscription();
  const { session, loading: authLoading } = useAuth();

  const wordmarkOpacity  = useRef(new Animated.Value(0)).current;
  const taglineOpacity   = useRef(new Animated.Value(0)).current;
  const contentTranslate = useRef(new Animated.Value(12)).current;

  const startTime = useRef(Date.now());
  const navigated = useRef(false);

  useEffect(() => {
    Animated.sequence([
      Animated.parallel([
        Animated.timing(wordmarkOpacity,  { toValue: 1, duration: 500, useNativeDriver: true }),
        Animated.timing(contentTranslate, { toValue: 0, duration: 500, useNativeDriver: true }),
      ]),
      Animated.timing(taglineOpacity, { toValue: 1, duration: 500, delay: 100, useNativeDriver: true }),
    ]).start();
  }, []);

  useEffect(() => {
    if (!loaded || authLoading || navigated.current) return;

    const elapsed   = Date.now() - startTime.current;
    const remaining = Math.max(0, MIN_DISPLAY_MS - elapsed);

    setTimeout(() => {
      if (navigated.current) return;
      navigated.current = true;

      Animated.parallel([
        Animated.timing(wordmarkOpacity, { toValue: 0, duration: 280, useNativeDriver: true }),
        Animated.timing(taglineOpacity,  { toValue: 0, duration: 280, useNativeDriver: true }),
      ]).start(() => {
        if (!session) {
          navigation.replace('Auth');
        } else {
          navigation.replace(onboardingDone ? 'Main' : 'Onboarding');
        }
      });
    }, remaining);
  }, [loaded, authLoading, session, onboardingDone]);

  return (
    <View style={s.container}>
      {/* Atmospheric depth orbs */}
      <View style={s.orb1} pointerEvents="none" />
      <View style={s.orb2} pointerEvents="none" />
      <View style={s.orb3} pointerEvents="none" />

      {/* Brand lockup */}
      <Animated.View
        style={[s.content, {
          opacity: wordmarkOpacity,
          transform: [{ translateY: contentTranslate }],
        }]}
      >
        {/* Icon mark */}
        <View style={s.iconMark}>
          <Text style={s.iconSymbol}>◎</Text>
        </View>
        <Text style={s.wordmark}>Siftly</Text>
        <Animated.Text style={[s.tagline, { opacity: taglineOpacity }]}>
          Built for modern independence.
        </Animated.Text>
      </Animated.View>
    </View>
  );
}

const s = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F7FF',
    alignItems: 'center',
    justifyContent: 'center',
  },

  orb1: {
    position: 'absolute', top: -100, right: -60,
    width: 300, height: 300, borderRadius: 150,
    backgroundColor: 'rgba(67,97,238,0.07)',
  },
  orb2: {
    position: 'absolute', bottom: -80, left: -80,
    width: 260, height: 260, borderRadius: 130,
    backgroundColor: 'rgba(67,97,238,0.05)',
  },
  orb3: {
    position: 'absolute', top: '40%', left: -40,
    width: 160, height: 160, borderRadius: 80,
    backgroundColor: 'rgba(13,27,75,0.03)',
  },

  content: {
    alignItems: 'center',
    gap: spacing.sm,
  },
  iconMark: {
    width: 52, height: 52,
    borderRadius: 16,
    backgroundColor: '#EEF4FF',
    borderWidth: 1,
    borderColor: 'rgba(67,97,238,0.20)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xs,
  },
  iconSymbol: {
    fontSize: 22, color: '#4361EE', fontWeight: '700',
  },
  wordmark: {
    fontSize: 42,
    fontWeight: '900',
    color: '#0D1B4B',
    letterSpacing: -2,
  },
  tagline: {
    fontSize: 13,
    fontWeight: '400',
    color: '#8196B0',
    letterSpacing: 0.4,
    textAlign: 'center',
    marginTop: 4,
  },
});
