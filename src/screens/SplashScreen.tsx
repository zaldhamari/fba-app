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
  const contentTranslate = useRef(new Animated.Value(10)).current;

  const startTime = useRef(Date.now());
  const navigated = useRef(false);

  useEffect(() => {
    // Cinematic entrance: wordmark fades + rises, tagline fades after a beat
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
      {/* Atmospheric depth — two orbs, very restrained */}
      <View style={s.orb1} pointerEvents="none" />
      <View style={s.orb2} pointerEvents="none" />

      {/* Brand lockup — vertically centered */}
      <Animated.View
        style={[s.content, {
          opacity: wordmarkOpacity,
          transform: [{ translateY: contentTranslate }],
        }]}
      >
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
    backgroundColor: colors.bgHero,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Atmospheric orbs — very low opacity, positioned to frame without distracting
  orb1: {
    position: 'absolute', top: -80, right: -80,
    width: 320, height: 320, borderRadius: 160,
    backgroundColor: colors.cyanDim,
    opacity: 0.5,
  },
  orb2: {
    position: 'absolute', bottom: -60, left: -60,
    width: 220, height: 220, borderRadius: 110,
    backgroundColor: colors.purpleDim,
    opacity: 0.35,
  },

  // Brand lockup — centered, unhurried
  content: {
    alignItems: 'center',
    gap: spacing.sm,
  },
  wordmark: {
    fontSize: 42,
    fontWeight: '900',
    color: colors.textPrimary,
    letterSpacing: -2,
  },
  tagline: {
    fontSize: 13,
    fontWeight: '400',
    color: colors.textMuted,
    letterSpacing: 0.4,
    textAlign: 'center',
  },
});
