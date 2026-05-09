import 'react-native-gesture-handler';
import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import RootNavigator from './src/navigation/RootNavigator';
import { CurrencyProvider } from './src/context/CurrencyContext';
import { initRevenueCat } from './src/lib/revenuecat';
import { validateConfig } from './src/lib/validateConfig';

validateConfig();

// Initialize RC as early as possible — before any render
initRevenueCat();

export default function App() {
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
