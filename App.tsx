import 'react-native-gesture-handler';
import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as Sentry from '@sentry/react-native';
import RootNavigator from './src/navigation/RootNavigator';
import { CurrencyProvider } from './src/context/CurrencyContext';
import { initRevenueCat } from './src/lib/revenuecat';

Sentry.init({
  dsn: process.env.EXPO_PUBLIC_SENTRY_DSN ?? '',
  enabled: !__DEV__,
});

// Initialize RC as early as possible — before any render
initRevenueCat();

function App() {
  return (
    <CurrencyProvider>
      <SafeAreaProvider>
        <NavigationContainer>
          <StatusBar style="dark" />
          <RootNavigator />
        </NavigationContainer>
      </SafeAreaProvider>
    </CurrencyProvider>
  );
}

export default Sentry.wrap(App);
