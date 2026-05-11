import React, { useState, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  KeyboardAvoidingView, Platform, ScrollView, Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { StackNavigationProp } from '@react-navigation/stack';
import { RootStackParamList } from '../navigation/RootNavigator';
import { authActions } from '../hooks/useAuth';
import {
  AppCard, InputField, PrimaryButton, SecondaryButton, DS,
} from '../components/ds';

// ── Types ─────────────────────────────────────────────────────────────────────

type AuthView = 'entry' | 'signin' | 'signup' | 'forgot' | 'verify';
type Props    = { navigation: StackNavigationProp<RootStackParamList, 'Auth'> };

// ── Shared mini-components ────────────────────────────────────────────────────

function SocialButton({
  icon, label, onPress, disabled,
}: { icon: string; label: string; onPress: () => void; disabled?: boolean }) {
  return (
    <TouchableOpacity
      style={[soc.btn, disabled && soc.btnDisabled]}
      onPress={onPress}
      activeOpacity={0.8}
      accessibilityRole="button"
      disabled={disabled}
    >
      <Text style={soc.icon}>{icon}</Text>
      <Text style={[soc.label, disabled && soc.labelDisabled]}>{label}</Text>
    </TouchableOpacity>
  );
}

const soc = StyleSheet.create({
  btn: {
    flexDirection:   'row',
    alignItems:      'center',
    justifyContent:  'center',
    gap:             10,
    backgroundColor: DS.bgCard,
    borderWidth:     1.5,
    borderColor:     DS.border,
    borderRadius:    DS.radiusButton,
    paddingVertical: 13,
    shadowColor:     '#0D1B4B',
    shadowOffset:    { width: 0, height: 1 },
    shadowOpacity:   0.05,
    shadowRadius:    4,
    elevation:       1,
  },
  icon:         { fontSize: 18 },
  label:        { fontSize: 14, fontWeight: '600', color: DS.textPrimary },
  btnDisabled:  { opacity: 0.45 },
  labelDisabled:{ color: DS.textMuted },
});

function OrDivider() {
  return (
    <View style={div.row}>
      <View style={div.line} />
      <Text style={div.text}>or</Text>
      <View style={div.line} />
    </View>
  );
}

const div = StyleSheet.create({
  row:  { flexDirection: 'row', alignItems: 'center', gap: 10 },
  line: { flex: 1, height: 1, backgroundColor: DS.border },
  text: { fontSize: 12, fontWeight: '600', color: DS.textMuted },
});

function BackButton({ onPress }: { onPress: () => void }) {
  return (
    <TouchableOpacity style={bk.btn} onPress={onPress} activeOpacity={0.7} accessibilityRole="button">
      <Text style={bk.arrow}>←</Text>
      <Text style={bk.text}>Back</Text>
    </TouchableOpacity>
  );
}

const bk = StyleSheet.create({
  btn:   { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', paddingVertical: 4 },
  arrow: { fontSize: 18, color: DS.textSecondary },
  text:  { fontSize: 14, fontWeight: '600', color: DS.textSecondary },
});

function SuccessBanner({ text }: { text: string }) {
  return (
    <View style={fb.success}>
      <Text style={fb.successText}>✓  {text}</Text>
    </View>
  );
}

function ErrorBanner({ text }: { text: string }) {
  return (
    <View style={fb.error}>
      <Text style={fb.errorText}>⚠  {text}</Text>
    </View>
  );
}

const fb = StyleSheet.create({
  success: {
    backgroundColor: DS.accentLight, borderRadius: 12, padding: 13,
    borderWidth: 1, borderColor: DS.accent + '40',
  },
  successText: { fontSize: 13, color: DS.accentDark, fontWeight: '600', lineHeight: 19 },
  error: {
    backgroundColor: DS.dangerBg, borderRadius: 12, padding: 13,
    borderWidth: 1, borderColor: DS.danger + '30',
  },
  errorText: { fontSize: 13, color: DS.dangerText, fontWeight: '600', lineHeight: 19 },
});

// ── Screen ────────────────────────────────────────────────────────────────────

export default function AuthScreen({ navigation }: Props) {
  const [view,     setView]     = useState<AuthView>('entry');
  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [loading,      setLoading]      = useState(false);
  const [error,        setError]        = useState('');
  const [success,      setSuccess]      = useState('');
  const [oauthLoading, setOauthLoading] = useState(false);
  const [oauthError,   setOauthError]   = useState('');

  const fadeAnim = useRef(new Animated.Value(1)).current;

  // ── Navigation between views ─────────────────────────────────────────────

  function goTo(next: AuthView) {
    Animated.timing(fadeAnim, { toValue: 0, duration: 110, useNativeDriver: true }).start(() => {
      setView(next);
      setError('');
      setSuccess('');
      Animated.timing(fadeAnim, { toValue: 1, duration: 200, useNativeDriver: true }).start();
    });
  }

  // ── Preserved auth handlers ──────────────────────────────────────────────

  async function afterAuth() {
    const done = await AsyncStorage.getItem('fba_onboarding_v3');
    navigation.replace(done === 'true' ? 'Main' : 'Onboarding');
  }

  async function handleSignIn() {
    if (!email.trim() || !password.trim()) {
      setError('Please enter your email and password.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const { error: authError } = await authActions.signIn(email.trim(), password);
      if (authError) throw authError;
      await afterAuth();
    } catch (e: any) {
      setError(e.message ?? 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  async function handleSignUp() {
    if (!email.trim() || !password.trim()) {
      setError('Please enter your email and password.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const { data, error: authError } = await authActions.signUp(email.trim(), password);
      if (authError) throw authError;
      if (!data.session) {
        goTo('verify');
        return;
      }
      await afterAuth();
    } catch (e: any) {
      setError(e.message ?? 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  async function handleForgotPassword() {
    if (!email.trim()) {
      setError('Please enter your email address.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      authActions.resetPassword(email.trim());
      setSuccess('Reset link sent — check your inbox!');
    } finally {
      setLoading(false);
    }
  }

  async function handleVerifyCheck() {
    if (!email.trim() || !password.trim()) {
      goTo('signin');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const { error: authError } = await authActions.signIn(email.trim(), password);
      if (authError) throw authError;
      await afterAuth();
    } catch {
      setError('Verification not complete yet. Check your email and try again.');
    } finally {
      setLoading(false);
    }
  }

  function handleResendEmail() {
    authActions.resetPassword(email.trim());
    setSuccess('Verification email resent — check your inbox.');
  }

  // ── OAuth handlers ────────────────────────────────────────────────────────
  // Supabase signInWithOAuth is wired. On device, the provider's browser flow
  // requires expo-auth-session + a deep-link redirect URI configured in both
  // app.json (scheme) and the Supabase project's Allowed Redirect URLs.

  async function handleGoogle() {
    setOauthLoading(true);
    setOauthError('');
    try {
      const { error: authError } = await authActions.signInWithGoogle();
      if (authError) throw authError;
      // Session is picked up by onAuthStateChange listener in useAuth
    } catch (e: any) {
      setOauthError(e.message ?? 'Google sign-in failed. Please try again.');
    } finally {
      setOauthLoading(false);
    }
  }

  async function handleApple() {
    setOauthLoading(true);
    setOauthError('');
    try {
      const { error: authError } = await authActions.signInWithApple();
      if (authError) throw authError;
    } catch (e: any) {
      setOauthError(e.message ?? 'Apple sign-in failed. Please try again.');
    } finally {
      setOauthLoading(false);
    }
  }

  // ── View renderers ────────────────────────────────────────────────────────

  function renderEntry() {
    return (
      <View style={v.entryWrap}>
        {/* Decorative orbs */}
        <View style={v.orb1} pointerEvents="none" />
        <View style={v.orb2} pointerEvents="none" />

        {/* Logo */}
        <View style={v.logoBlock}>
          <Text style={v.wordmark}>Siftly</Text>
          <Text style={v.tagline}>Built for modern independence.</Text>
        </View>

        {/* Hero copy */}
        <View style={v.heroBlock}>
          <Text style={v.heroTitle}>Build your Amazon{'\n'}FBA launch system</Text>
          <Text style={v.heroSub}>
            Research products, calculate profit, build your brand, and launch with AI guidance.
          </Text>
        </View>

        {/* Primary actions */}
        <View style={v.actions}>
          <PrimaryButton
            label="Create Account"
            onPress={() => goTo('signup')}
            size="lg"
            icon="✦"
          />
          <SecondaryButton
            label="Log In"
            onPress={() => goTo('signin')}
            size="lg"
          />
        </View>

        {/* Social */}
        <OrDivider />
        <View style={v.socials}>
          <SocialButton icon="G" label={oauthLoading ? 'Signing in...' : 'Continue with Google'} onPress={handleGoogle} disabled={oauthLoading} />
          <SocialButton icon="" label="Continue with Apple" onPress={handleApple} disabled={oauthLoading} />
        </View>
        {!!oauthError && <ErrorBanner text={oauthError} />}

        {/* Skip */}
        <TouchableOpacity style={v.skip} onPress={afterAuth} activeOpacity={0.7}>
          <Text style={v.skipText}>Continue without account</Text>
        </TouchableOpacity>
      </View>
    );
  }

  function renderSignIn() {
    return (
      <View style={v.formWrap}>
        <BackButton onPress={() => goTo('entry')} />

        <View style={v.formHero}>
          <Text style={v.formTitle}>Welcome back</Text>
          <Text style={v.formSub}>Log in to continue building your launch.</Text>
        </View>

        <AppCard style={v.formCard}>
          <InputField
            label="Email"
            value={email}
            onChangeText={setEmail}
            leadingIcon="✉"
            placeholder="you@example.com"
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="next"
          />
          <InputField
            label="Password"
            value={password}
            onChangeText={setPassword}
            leadingIcon="🔒"
            trailingIcon={showPass ? '👁' : '◉'}
            onTrailingPress={() => setShowPass(p => !p)}
            placeholder="••••••••"
            secureTextEntry={!showPass}
            returnKeyType="done"
            onSubmitEditing={handleSignIn}
          />

          {!!success && <SuccessBanner text={success} />}
          {!!error   && <ErrorBanner   text={error}   />}

          <PrimaryButton
            label="Log In"
            onPress={handleSignIn}
            loading={loading}
            disabled={loading}
            icon="→"
          />

          <TouchableOpacity
            style={v.forgotLink}
            onPress={() => goTo('forgot')}
            activeOpacity={0.7}
          >
            <Text style={v.forgotText}>Forgot password?</Text>
          </TouchableOpacity>
        </AppCard>

        <OrDivider />
        <View style={v.socials}>
          <SocialButton icon="G" label={oauthLoading ? 'Signing in...' : 'Continue with Google'} onPress={handleGoogle} disabled={oauthLoading} />
          <SocialButton icon="" label="Continue with Apple" onPress={handleApple} disabled={oauthLoading} />
        </View>
        {!!oauthError && <ErrorBanner text={oauthError} />}

        <TouchableOpacity style={v.switchLink} onPress={() => goTo('signup')} activeOpacity={0.7}>
          <Text style={v.switchText}>
            Don't have an account?{' '}
            <Text style={v.switchAccent}>Create one</Text>
          </Text>
        </TouchableOpacity>
      </View>
    );
  }

  function renderSignUp() {
    return (
      <View style={v.formWrap}>
        <BackButton onPress={() => goTo('entry')} />

        <View style={v.formHero}>
          <Text style={v.formTitle}>Create your{'\n'}Siftly account</Text>
          <Text style={v.formSub}>Start researching and validating your first product.</Text>
        </View>

        <AppCard style={v.formCard}>
          <InputField
            label="Email"
            value={email}
            onChangeText={setEmail}
            leadingIcon="✉"
            placeholder="you@example.com"
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="next"
          />
          <InputField
            label="Password"
            value={password}
            onChangeText={setPassword}
            leadingIcon="🔒"
            trailingIcon={showPass ? '👁' : '◉'}
            onTrailingPress={() => setShowPass(p => !p)}
            placeholder="At least 8 characters"
            secureTextEntry={!showPass}
            returnKeyType="done"
            onSubmitEditing={handleSignUp}
          />

          {!!success && <SuccessBanner text={success} />}
          {!!error   && <ErrorBanner   text={error}   />}

          <PrimaryButton
            label="Create Account"
            onPress={handleSignUp}
            loading={loading}
            disabled={loading}
            icon="✦"
          />
        </AppCard>

        <OrDivider />
        <View style={v.socials}>
          <SocialButton icon="G" label={oauthLoading ? 'Signing in...' : 'Continue with Google'} onPress={handleGoogle} disabled={oauthLoading} />
          <SocialButton icon="" label="Continue with Apple" onPress={handleApple} disabled={oauthLoading} />
        </View>
        {!!oauthError && <ErrorBanner text={oauthError} />}

        <Text style={v.termsText}>
          By creating an account you agree to our{' '}
          <Text
            style={v.termsLink}
            onPress={() => navigation.navigate('Legal', { type: 'terms' })}
          >
            Terms of Use
          </Text>
          {' '}and{' '}
          <Text
            style={v.termsLink}
            onPress={() => navigation.navigate('Legal', { type: 'privacy' })}
          >
            Privacy Policy
          </Text>.
        </Text>

        <TouchableOpacity style={v.switchLink} onPress={() => goTo('signin')} activeOpacity={0.7}>
          <Text style={v.switchText}>
            Already have an account?{' '}
            <Text style={v.switchAccent}>Log In</Text>
          </Text>
        </TouchableOpacity>
      </View>
    );
  }

  function renderForgot() {
    return (
      <View style={v.formWrap}>
        <BackButton onPress={() => goTo('signin')} />

        <View style={v.formHero}>
          <View style={v.forgotIcon}>
            <Text style={v.forgotIconGlyph}>🔑</Text>
          </View>
          <Text style={v.formTitle}>Reset your password</Text>
          <Text style={v.formSub}>
            Enter your email and we'll send a reset link right away.
          </Text>
        </View>

        <AppCard style={v.formCard}>
          <InputField
            label="Email"
            value={email}
            onChangeText={setEmail}
            leadingIcon="✉"
            placeholder="you@example.com"
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="send"
            onSubmitEditing={handleForgotPassword}
          />

          {!!success && <SuccessBanner text={success} />}
          {!!error   && <ErrorBanner   text={error}   />}

          <PrimaryButton
            label="Send Reset Link"
            onPress={handleForgotPassword}
            loading={loading}
            disabled={loading || !!success}
            icon="✉"
          />
        </AppCard>

        <TouchableOpacity style={v.switchLink} onPress={() => goTo('signin')} activeOpacity={0.7}>
          <Text style={v.switchText}>
            Remember it?{' '}
            <Text style={v.switchAccent}>Back to Log In</Text>
          </Text>
        </TouchableOpacity>
      </View>
    );
  }

  function renderVerify() {
    return (
      <View style={v.formWrap}>
        <View style={v.verifyCenter}>
          <View style={v.verifyIconWrap}>
            <Text style={v.verifyIcon}>✉</Text>
          </View>

          <Text style={v.formTitle}>Verify your email</Text>
          <Text style={v.formSub}>
            We sent a confirmation link to{'\n'}
            <Text style={v.verifyEmail}>{email || 'your email'}</Text>
            {'\n\n'}Click the link in the email, then come back here.
          </Text>

          {!!success && <SuccessBanner text={success} />}
          {!!error   && <ErrorBanner   text={error}   />}
        </View>

        <View style={v.verifyActions}>
          <PrimaryButton
            label="I Verified My Email"
            onPress={handleVerifyCheck}
            loading={loading}
            disabled={loading}
            icon="✓"
          />
          <SecondaryButton
            label="Resend Email"
            onPress={handleResendEmail}
            disabled={loading}
          />
        </View>

        <TouchableOpacity style={v.switchLink} onPress={() => goTo('signin')} activeOpacity={0.7}>
          <Text style={v.switchText}>
            <Text style={v.switchAccent}>← Back to Log In</Text>
          </Text>
        </TouchableOpacity>
      </View>
    );
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <SafeAreaView style={s.safe} edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        style={s.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          contentContainerStyle={s.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Animated.View style={{ opacity: fadeAnim, flex: 1 }}>
            {view === 'entry'  && renderEntry()}
            {view === 'signin' && renderSignIn()}
            {view === 'signup' && renderSignUp()}
            {view === 'forgot' && renderForgot()}
            {view === 'verify' && renderVerify()}
          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// ── View layout styles ────────────────────────────────────────────────────────

const v = StyleSheet.create({
  // ── Entry ──────────────────────────────────────────────────────────────
  entryWrap: {
    flex:              1,
    paddingHorizontal: DS.pagePadding,
    paddingTop:        24,
    gap:               DS.sectionGap,
  },
  orb1: {
    position: 'absolute', top: -60, right: -60,
    width: 260, height: 260, borderRadius: 130,
    backgroundColor: DS.indigoLight, opacity: 0.6,
  },
  orb2: {
    position: 'absolute', bottom: 40, left: -80,
    width: 200, height: 200, borderRadius: 100,
    backgroundColor: DS.accentLight, opacity: 0.5,
  },
  logoBlock: { alignItems: 'center', paddingTop: 24, gap: 4 },
  wordmark: {
    fontSize: 42, fontWeight: '900', color: DS.textPrimary, letterSpacing: -2,
  },
  tagline: { fontSize: 12, color: DS.textMuted, letterSpacing: 0.4 },
  heroBlock: { gap: 10 },
  heroTitle: {
    fontSize: 30, fontWeight: '900', color: DS.textPrimary,
    letterSpacing: -1, lineHeight: 36,
  },
  heroSub: { fontSize: 15, color: DS.textSecondary, lineHeight: 23 },
  actions: { gap: 10 },
  socials: { gap: 10 },
  skip: { alignItems: 'center', paddingVertical: 8 },
  skipText: { fontSize: 13, color: DS.textMuted, fontWeight: '500' },

  // ── Form views ─────────────────────────────────────────────────────────
  formWrap: {
    flex:              1,
    paddingHorizontal: DS.pagePadding,
    paddingTop:        16,
    gap:               DS.sectionGap,
  },
  formHero: { gap: 6 },
  formTitle: {
    fontSize: 26, fontWeight: '900', color: DS.textPrimary,
    letterSpacing: -0.8, lineHeight: 32,
  },
  formSub: { fontSize: 14, color: DS.textSecondary, lineHeight: 21 },
  formCard: { gap: DS.cardGap },
  forgotLink: { alignItems: 'center', paddingTop: 4 },
  forgotText: { fontSize: 13, color: DS.textMuted, fontWeight: '500' },
  switchLink: { alignItems: 'center', paddingVertical: 4 },
  switchText: { fontSize: 13, color: DS.textSecondary, fontWeight: '500', textAlign: 'center' },
  switchAccent: { color: DS.accent, fontWeight: '700' },
  termsText: {
    fontSize: 11, color: DS.textMuted, textAlign: 'center', lineHeight: 18,
  },
  termsLink: { color: DS.indigo, fontWeight: '600' },

  // ── Forgot ─────────────────────────────────────────────────────────────
  forgotIcon: {
    width: 56, height: 56, borderRadius: 18,
    backgroundColor: '#FFFBEB',
    alignItems: 'center', justifyContent: 'center',
    alignSelf: 'flex-start',
  },
  forgotIconGlyph: { fontSize: 28 },

  // ── Verify ─────────────────────────────────────────────────────────────
  verifyCenter: { alignItems: 'center', gap: 14, paddingTop: 24 },
  verifyIconWrap: {
    width: 80, height: 80, borderRadius: 24,
    backgroundColor: DS.accentLight,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 4,
  },
  verifyIcon:    { fontSize: 36, color: DS.accent },
  verifyEmail:   { fontWeight: '700', color: DS.textPrimary },
  verifyActions: { gap: 10 },
});

// ── Root styles ───────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  safe:   { flex: 1, backgroundColor: DS.bgCanvas },
  flex:   { flex: 1 },
  scroll: { flexGrow: 1, paddingBottom: 40 },
});
