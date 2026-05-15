import 'react-native-gesture-handler';
import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as Sentry from '@sentry/react-native';
import RootNavigator from './src/navigation/RootNavigator';
import { CurrencyProvider } from './src/context/CurrencyContext';
import { ActiveProductProvider } from './src/context/ActiveProductContext';
import { ErrorBoundary } from './src/components/ErrorBoundary';
import { initRevenueCat } from './src/lib/revenuecat';
import { validateConfig } from './src/lib/validateConfig';

validateConfig();
initRevenueCat();

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
  return (
    <ErrorBoundary fallbackLabel="App">
      <CurrencyProvider>
        <ActiveProductProvider>
          <SafeAreaProvider>
            <NavigationContainer>
              <StatusBar style="dark" />
              <RootNavigator />
            </NavigationContainer>
          </SafeAreaProvider>
        </ActiveProductProvider>
      </CurrencyProvider>
    </ErrorBoundary>
  );
}

export default Sentry.wrap(App);
