import React, { useState, useRef } from 'react';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity,
  Animated, KeyboardAvoidingView, Platform, ScrollView,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { StackNavigationProp } from '@react-navigation/stack';
import { RootStackParamList } from '../navigation/RootNavigator';
import { authActions } from '../hooks/useAuth';
import { colors, spacing, radius, shadow } from '../theme';

type Props = { navigation: StackNavigationProp<RootStackParamList, 'Auth'> };

type Mode = 'signin' | 'signup';

export default function AuthScreen({ navigation }: Props) {
  const [mode, setMode]       = useState<Mode>('signin');
  const [email, setEmail]     = useState('');
  const [password, setPass]   = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState('');
  const [success, setSuccess] = useState('');

  const fadeAnim = useRef(new Animated.Value(1)).current;
  const emailInputRef = useRef<TextInput>(null);

  async function afterAuth() {
    const done = await AsyncStorage.getItem('fba_onboarding_v3');
    navigation.replace(done === 'true' ? 'Main' : 'Onboarding');
  }

  async function handleSubmit() {
    if (!email.trim() || !password.trim()) {
      setError('Please enter your email and password.');
      return;
    }
    setLoading(true);
    setError('');
    setSuccess('');
    try {
      if (mode === 'signup') {
        const { data, error } = await authActions.signUp(email.trim(), password);
        if (error) throw error;
        if (!data.session) {
          // Email confirmation required — Supabase created the user but not the session yet
          setSuccess('Account created! Check your inbox and click the confirmation link to sign in.');
          return;
        }
      } else {
        const { error } = await authActions.signIn(email.trim(), password);
        if (error) throw error;
      }
      await afterAuth();
    } catch (e: any) {
      setError(e.message ?? 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  function switchMode(next: Mode) {
    Animated.sequence([
      Animated.timing(fadeAnim, { toValue: 0, duration: 120, useNativeDriver: true }),
      Animated.timing(fadeAnim, { toValue: 1, duration: 200, useNativeDriver: true }),
    ]).start();
    setTimeout(() => { setMode(next); setError(''); setSuccess(''); }, 120);
  }

  function handleForgotPassword() {
    if (!email.trim()) {
      emailInputRef.current?.focus();
      setError('Enter your email above, then tap "Forgot password?" again.');
      return;
    }
    authActions.resetPassword(email.trim());
    setError('');
    setSuccess('Reset link sent — check your inbox.');
  }

  const isSignUp = mode === 'signup';

  return (
    <SafeAreaView style={s.safe}>
      <KeyboardAvoidingView
        style={s.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          contentContainerStyle={s.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Atmospheric orbs */}
          <View style={s.orb1} pointerEvents="none" />
          <View style={s.orb2} pointerEvents="none" />

          {/* Brand */}
          <View style={s.brand}>
            <Text style={s.wordmark}>Siftly</Text>
            <Text style={s.tagline}>Built for modern independence.</Text>
          </View>

          {/* Card */}
          <Animated.View style={[s.card, { opacity: fadeAnim }]}>
            {/* Mode toggle */}
            <View style={s.toggle}>
              <TouchableOpacity
                style={[s.toggleBtn, !isSignUp && s.toggleActive]}
                onPress={() => switchMode('signin')}
                activeOpacity={0.8}
              >
                <Text style={[s.toggleText, !isSignUp && s.toggleTextActive]}>Sign In</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[s.toggleBtn, isSignUp && s.toggleActive]}
                onPress={() => switchMode('signup')}
                activeOpacity={0.8}
              >
                <Text style={[s.toggleText, isSignUp && s.toggleTextActive]}>Create Account</Text>
              </TouchableOpacity>
            </View>

            <Text style={s.cardTitle}>
              {isSignUp ? 'Start building.' : 'Welcome back.'}
            </Text>
            <Text style={s.cardSub}>
              {isSignUp
                ? 'Create an account to sync your data across devices.'
                : 'Sign in to access your saved opportunities and progress.'}
            </Text>

            {/* Inputs */}
            <View style={s.fields}>
              <View style={s.fieldWrap}>
                <Text style={s.fieldLabel}>EMAIL</Text>
                <TextInput
                  ref={emailInputRef}
                  style={s.input}
                  placeholder="you@example.com"
                  placeholderTextColor={colors.textMuted}
                  value={email}
                  onChangeText={setEmail}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                  returnKeyType="next"
                />
              </View>
              <View style={s.fieldWrap}>
                <Text style={s.fieldLabel}>PASSWORD</Text>
                <TextInput
                  style={s.input}
                  placeholder={isSignUp ? 'At least 8 characters' : '••••••••'}
                  placeholderTextColor={colors.textMuted}
                  value={password}
                  onChangeText={setPass}
                  secureTextEntry
                  returnKeyType="done"
                  onSubmitEditing={handleSubmit}
                />
              </View>
            </View>

            {/* Feedback */}
            {!!success && (
              <View style={s.successRow}>
                <Text style={s.successText}>{success}</Text>
              </View>
            )}
            {!!error && (
              <View style={s.errorRow}>
                <Text style={s.errorText}>{error}</Text>
              </View>
            )}

            {/* CTA */}
            <TouchableOpacity
              style={[s.cta, loading && { opacity: 0.6 }]}
              onPress={handleSubmit}
              disabled={loading}
              activeOpacity={0.85}
            >
              {loading
                ? <ActivityIndicator color={colors.white} />
                : <Text style={s.ctaText}>{isSignUp ? 'Create Account →' : 'Sign In →'}</Text>
              }
            </TouchableOpacity>

            {/* Forgot password */}
            {!isSignUp && (
              <TouchableOpacity
                style={s.forgotRow}
                onPress={handleForgotPassword}
                activeOpacity={0.7}
              >
                <Text style={s.forgotText}>Forgot password?</Text>
              </TouchableOpacity>
            )}
          </Animated.View>

          {/* Skip */}
          <TouchableOpacity style={s.skip} onPress={afterAuth} activeOpacity={0.7}>
            <Text style={s.skipText}>Continue without account</Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe:  { flex: 1, backgroundColor: colors.bgHero },
  flex:  { flex: 1 },
  scroll: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.xl,
  },

  orb1: {
    position: 'absolute', top: -80, right: -80,
    width: 320, height: 320, borderRadius: 160,
    backgroundColor: colors.cyanDim, opacity: 0.6,
  },
  orb2: {
    position: 'absolute', bottom: -40, left: -60,
    width: 220, height: 220, borderRadius: 110,
    backgroundColor: colors.purpleDim, opacity: 0.4,
  },

  brand: { alignItems: 'center', marginBottom: spacing.xl },
  wordmark: {
    fontSize: 38, fontWeight: '900', color: colors.textPrimary, letterSpacing: -1.8,
  },
  tagline: {
    fontSize: 12, color: colors.textMuted, letterSpacing: 0.4, marginTop: 4, opacity: 0.8,
  },

  card: {
    backgroundColor: colors.bgCard,
    borderRadius: radius.xxl,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.md,
    ...shadow.float,
  },

  toggle: {
    flexDirection: 'row',
    backgroundColor: colors.bgElevated,
    borderRadius: radius.full,
    padding: 3,
  },
  toggleBtn: {
    flex: 1, paddingVertical: 8, borderRadius: radius.full, alignItems: 'center',
  },
  toggleActive:     { backgroundColor: colors.bgCard, ...shadow.sm },
  toggleText:       { fontSize: 13, fontWeight: '600', color: colors.textMuted },
  toggleTextActive: { color: colors.textPrimary, fontWeight: '800' },

  cardTitle: {
    fontSize: 26, fontWeight: '900', color: colors.textPrimary,
    letterSpacing: -1, marginTop: spacing.xs,
  },
  cardSub: {
    fontSize: 13, color: colors.textSecondary, lineHeight: 20, marginTop: -spacing.xs,
  },

  fields: { gap: spacing.sm },
  fieldWrap: { gap: 5 },
  fieldLabel: {
    fontSize: 9, fontWeight: '800', color: colors.textMuted, letterSpacing: 2,
  },
  input: {
    backgroundColor: colors.bgElevated,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 4,
    fontSize: 15,
    color: colors.textPrimary,
  },

  successRow: {
    backgroundColor: colors.greenLight,
    borderRadius: radius.md,
    padding: spacing.sm + 2,
  },
  successText: { fontSize: 13, color: colors.green, fontWeight: '500' },
  errorRow: {
    backgroundColor: colors.redLight,
    borderRadius: radius.md,
    padding: spacing.sm + 2,
  },
  errorText: { fontSize: 13, color: colors.red, fontWeight: '500' },

  cta: {
    backgroundColor: colors.cyan,
    borderRadius: radius.full,
    paddingVertical: spacing.md + 4,
    alignItems: 'center',
    ...shadow.glowCyan,
  },
  ctaText: { color: colors.white, fontSize: 16, fontWeight: '800', letterSpacing: -0.2 },

  forgotRow: { alignItems: 'center', paddingVertical: 2 },
  forgotText: { fontSize: 12, color: colors.textMuted, fontWeight: '500' },

  skip: { alignItems: 'center', paddingTop: spacing.lg },
  skipText: { fontSize: 13, color: colors.textMuted, fontWeight: '500' },
});
