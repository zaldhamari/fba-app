import 'react-native-gesture-handler';
import React, { useEffect } from 'react';
import { AppState } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as Sentry from '@sentry/react-native';
import RootNavigator from './src/navigation/RootNavigator';
import { CurrencyProvider } from './src/context/CurrencyContext';
import { ActiveProductProvider } from './src/context/ActiveProductContext';
import { PipelineProvider } from './src/context/PipelineContext';
import { ErrorBoundary } from './src/components/ErrorBoundary';
import { initRevenueCat } from './src/lib/revenuecat';
import { validateConfig } from './src/lib/validateConfig';
import { runStorageMigration } from './src/utils/storageMigration';
import { flushAnalyticsQueue } from './src/lib/analyticsTransmit';

// validateConfig() is a safe synchronous check — stays at module level.
validateConfig();

const SENTRY_DSN = process.env.EXPO_PUBLIC_SENTRY_DSN;
if (SENTRY_DSN) {
  Sentry.init({
    dsn: SENTRY_DSN,
    debug: __DEV__,
    environment: __DEV__ ? 'development' : 'production',
    tracesSampleRate: __DEV__ ? 0 : 0.2,
  });
}

function App() {
  useEffect(() => {
    // initRevenueCat and runStorageMigration call native APIs — must run after
    // the React component tree mounts so the native bridge is guaranteed ready.
    initRevenueCat();
    runStorageMigration();
    flushAnalyticsQueue();
    const sub = AppState.addEventListener('change', state => {
      if (state === 'active') flushAnalyticsQueue();
    });
    return () => sub.remove();
  }, []);

  return (
    <ErrorBoundary fallbackLabel="App">
      <CurrencyProvider>
        <ActiveProductProvider>
          <PipelineProvider>
            <SafeAreaProvider>
              <NavigationContainer>
                <StatusBar style="dark" />
                <RootNavigator />
              </NavigationContainer>
            </SafeAreaProvider>
          </PipelineProvider>
        </ActiveProductProvider>
      </CurrencyProvider>
    </ErrorBoundary>
  );
}

export default Sentry.wrap(App);
