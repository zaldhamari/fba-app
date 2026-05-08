import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, spacing, radius, shadow, motion } from '../theme';
import { StackNavigationProp } from '@react-navigation/stack';
import { RootStackParamList } from '../navigation/RootNavigator';

type Slide = {
  icon: string;
  eyebrow: string;
  title: string;
  body: string;
  accentColor: string;
  accentBg: string;
  badge?: { label: string; sub: string; color: string; bg: string };
};

const SLIDES: Slide[] = [
  {
    icon: '◎',
    eyebrow: 'DISCOVER · 1 OF 3',
    title: "Find what's\nworth building.",
    body: 'Real Amazon signals. Trend data. Competition scored. One search reveals genuine demand.',
    accentColor: colors.cyan,
    accentBg: colors.cyanDim,
  },
  {
    icon: '⚡',
    eyebrow: 'DECIDE · 2 OF 3',
    title: 'AI tells you:\nbuild or move on.',
    body: 'Tap any opportunity. Margin, demand, and risk — clear signal in seconds.',
    accentColor: colors.green,
    accentBg: colors.greenDim,
    badge: { label: 'LAUNCH', sub: '87% confidence · 34% margin · Rising', color: colors.green, bg: colors.greenLight },
  },
  {
    icon: '✦',
    eyebrow: 'BUILD · 3 OF 3',
    title: 'From signal\nto business.',
    body: 'Brand, listing, keywords, supplier — your full commerce stack in one place.',
    accentColor: colors.purple,
    accentBg: colors.purpleDim,
  },
];

type Props = { navigation: StackNavigationProp<RootStackParamList, 'Onboarding'> };

export default function OnboardingScreen({ navigation }: Props) {
  const [index, setIndex] = useState(0);
  const slide  = SLIDES[index];

  // Guard against double-tap during transition
  const transitioning = useRef(false);

  // Slide transition
  const fadeAnim  = useRef(new Animated.Value(1)).current;
  const slideAnim = useRef(new Animated.Value(0)).current;

  // Icon orb
  const orbScale   = useRef(new Animated.Value(0.7)).current;
  const orbOpacity = useRef(new Animated.Value(0)).current;
  const ring1Pulse = useRef(new Animated.Value(1)).current;
  const ring2Pulse = useRef(new Animated.Value(1)).current;

  // Badge scale (slide 2)
  const badgeScale = useRef(new Animated.Value(0.88)).current;

  useEffect(() => {
    // Orb entrance
    Animated.parallel([
      Animated.spring(orbScale, { toValue: 1, ...motion.spring, useNativeDriver: true }),
      Animated.timing(orbOpacity, { toValue: 1, duration: motion.reveal, useNativeDriver: true }),
    ]).start();

    // Orb ring breathing loop — native driver: scale only, no layout
    const breathe = Animated.loop(
      Animated.sequence([
        Animated.timing(ring1Pulse, { toValue: 1.10, duration: 2000, useNativeDriver: true }),
        Animated.timing(ring1Pulse, { toValue: 1.00, duration: 2000, useNativeDriver: true }),
      ])
    );
    const breathe2 = Animated.loop(
      Animated.sequence([
        Animated.delay(700),
        Animated.timing(ring2Pulse, { toValue: 1.06, duration: 2400, useNativeDriver: true }),
        Animated.timing(ring2Pulse, { toValue: 1.00, duration: 2400, useNativeDriver: true }),
      ])
    );
    breathe.start();
    breathe2.start();

    if (index === 1) {
      Animated.spring(badgeScale, { toValue: 1, ...motion.spring, useNativeDriver: true }).start();
    }

    return () => { breathe.stop(); breathe2.stop(); };
  }, [index]);

  function transition(toIndex: number | 'paywall') {
    if (transitioning.current) return;
    transitioning.current = true;

    Animated.parallel([
      Animated.timing(fadeAnim,  { toValue: 0, duration: 160, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: -18, duration: 160, useNativeDriver: true }),
    ]).start(() => {
      if (toIndex === 'paywall') {
        navigation.replace('Paywall');
        return;
      }
      // Reset animated values before new content renders
      orbScale.setValue(0.78);
      orbOpacity.setValue(0);
      slideAnim.setValue(22);
      badgeScale.setValue(0.82);
      setIndex(toIndex);
      transitioning.current = false;
      Animated.parallel([
        Animated.timing(fadeAnim,  { toValue: 1, duration: motion.reveal, useNativeDriver: true }),
        Animated.spring(slideAnim, { toValue: 0, ...motion.spring, useNativeDriver: true }),
      ]).start();
    });
  }

  function next() {
    if (index < SLIDES.length - 1) transition(index + 1);
    else transition('paywall');
  }

  function skip() { transition('paywall'); }

  return (
    <SafeAreaView style={s.container}>
      {/* Atmospheric ambient orb */}
      <View style={[s.ambientOrb, { backgroundColor: slide.accentBg }]} />

      {/* Brand bar */}
      <View style={s.skipRow}>
        <Text style={s.brandWord}>Siftly</Text>
        {index < SLIDES.length - 1 ? (
          <TouchableOpacity onPress={skip} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
            <Text style={s.skipText}>Skip</Text>
          </TouchableOpacity>
        ) : <View />}
      </View>

      {/* Slide content */}
      <Animated.View style={[s.slide, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>

        {/* Icon orb */}
        <Animated.View style={[s.iconWrap, { opacity: orbOpacity, transform: [{ scale: orbScale }] }]}>
          {/* Outer breathing ring */}
          <Animated.View style={[s.ring2, { borderColor: slide.accentColor, transform: [{ scale: ring2Pulse }] }]} />
          {/* Inner breathing ring */}
          <Animated.View style={[s.ring1, { borderColor: slide.accentColor, transform: [{ scale: ring1Pulse }] }]} />
          {/* Icon surface */}
          <View style={[s.iconSurface, { backgroundColor: slide.accentBg }]}>
            <Text style={[s.icon, { color: slide.accentColor }]}>{slide.icon}</Text>
          </View>
        </Animated.View>

        <Text style={[s.eyebrow, { color: slide.accentColor }]}>{slide.eyebrow}</Text>
        <Text style={s.title}>{slide.title}</Text>

        {slide.badge && (
          <Animated.View style={[s.badge, { backgroundColor: slide.badge.bg, transform: [{ scale: badgeScale }], ...shadow.green }]}>
            <Text style={[s.badgeLabel, { color: slide.badge.color }]}>{slide.badge.label}</Text>
            <Text style={[s.badgeSub, { color: slide.badge.color }]}>{slide.badge.sub}</Text>
          </Animated.View>
        )}

        <Text style={s.body}>{slide.body}</Text>

        {index === SLIDES.length - 1 && (
          <Text style={s.brandSig}>Built for modern independence.</Text>
        )}
      </Animated.View>

      {/* Bottom controls */}
      <View style={s.bottom}>
        <View style={s.dots}>
          {SLIDES.map((sl, i) => (
            <View
              key={i}
              style={[
                s.dot,
                i === index && { width: 28, backgroundColor: slide.accentColor },
                i !== index && { backgroundColor: colors.border },
              ]}
            />
          ))}
        </View>

        <TouchableOpacity
          style={[s.btn, { backgroundColor: slide.accentColor }]}
          onPress={next}
          activeOpacity={0.82}
        >
          <Text style={s.btnText}>
            {index < SLIDES.length - 1 ? 'Continue' : 'Get Started →'}
          </Text>
        </TouchableOpacity>

        {index === SLIDES.length - 1 && (
          <TouchableOpacity onPress={skip} activeOpacity={0.7} style={s.freeLink}>
            <Text style={s.freeLinkText}>Start with free plan</Text>
          </TouchableOpacity>
        )}
      </View>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bgCard },

  // Atmospheric ambient background
  ambientOrb: {
    position: 'absolute', top: -80, right: -60,
    width: 280, height: 280, borderRadius: 140,
    opacity: 0.55,
  },

  skipRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: spacing.lg, paddingTop: spacing.sm,
    height: 44,
  },
  brandWord: {
    fontSize: 22, fontWeight: '900', color: colors.textPrimary, letterSpacing: -0.8,
  },
  skipText: { fontSize: 14, fontWeight: '500', color: colors.textMuted },

  slide: {
    flex: 1,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.lg,
    gap: spacing.sm + 2,
  },

  // Icon orb system
  iconWrap: {
    width: 100, height: 100,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: spacing.md,
    alignSelf: 'flex-start',
  },
  ring2: {
    position: 'absolute',
    width: 100, height: 100, borderRadius: 50,
    borderWidth: 1, opacity: 0.18,
  },
  ring1: {
    position: 'absolute',
    width: 78, height: 78, borderRadius: 39,
    borderWidth: 1.5, opacity: 0.30,
  },
  iconSurface: {
    width: 58, height: 58, borderRadius: 29,
    alignItems: 'center', justifyContent: 'center',
  },
  icon: { fontSize: 26, fontWeight: '900' },

  eyebrow: { fontSize: 10, fontWeight: '800', letterSpacing: 2.5 },
  title: {
    fontSize: 42, fontWeight: '900', color: colors.textPrimary,
    letterSpacing: -1.8, lineHeight: 48,
  },

  // LAUNCH verdict badge (slide 2)
  badge: {
    alignSelf: 'flex-start', borderRadius: radius.xl,
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm + 2,
    marginVertical: spacing.xs,
    gap: 2,
  },
  badgeLabel: { fontSize: 24, fontWeight: '900', letterSpacing: -0.5 },
  badgeSub:   { fontSize: 11, fontWeight: '600', opacity: 0.8 },

  body: { fontSize: 17, color: colors.textSecondary, lineHeight: 26, letterSpacing: -0.1 },
  brandSig: {
    fontSize: 12, fontWeight: '400', color: colors.textMuted,
    letterSpacing: 0.5, marginTop: spacing.lg, opacity: 0.7,
  },

  bottom: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xl,
    gap: spacing.md,
  },

  // Progress dots — inactive need explicit width, active overrides to 28
  dots:      { flexDirection: 'row', gap: 7, alignItems: 'center' },
  dot:       { width: 6, height: 5, borderRadius: radius.full },

  // CTA button — pill shape
  btn: {
    borderRadius: radius.full,
    paddingVertical: spacing.md + 4,
    alignItems: 'center',
  },
  btnText: { color: colors.white, fontSize: 17, fontWeight: '800', letterSpacing: -0.2 },

  freeLink:     { alignItems: 'center', paddingVertical: 4 },
  freeLinkText: { fontSize: 13, color: colors.textMuted, fontWeight: '500' },
  tagline:      { fontSize: 11, color: colors.textMuted, textAlign: 'center', letterSpacing: 0.2, marginTop: 4 },
});
