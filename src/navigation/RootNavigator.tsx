import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import OnboardingScreen from '../screens/OnboardingScreen';
import PaywallScreen from '../screens/PaywallScreen';
import SplashScreen from '../screens/SplashScreen';
import AuthScreen from '../screens/AuthScreen';
import LegalScreen from '../screens/LegalScreen';
import LaunchScreen from '../screens/LaunchScreen';
import CalculatorScreen from '../screens/CalculatorScreen';
import ProductBlueprintScreen from '../screens/ProductBlueprintScreen';
import SellerProfileScreen from '../screens/SellerProfileScreen';
import TabNavigator from './TabNavigator';
import { LegalDocumentType } from '../constants/legalContent';

export type RootStackParamList = {
  Splash: undefined;
  Auth: undefined;
  Onboarding: undefined;
  SellerProfile: undefined;
  Paywall: undefined;
  Main: undefined;
  Premium: undefined;
  Checklist: undefined;
  FeasibilityCheck: undefined;
  Legal: { type: LegalDocumentType };
  ProductBlueprint: undefined;
};

const Stack = createStackNavigator<RootStackParamList>();

export default function RootNavigator() {
  return (
    <Stack.Navigator
      screenOptions={{ headerShown: false, animationEnabled: false }}
      initialRouteName="Splash"
    >
      <Stack.Screen name="Splash"     component={SplashScreen} />
      <Stack.Screen name="Auth"       component={AuthScreen} options={{ animationEnabled: true }} />
      <Stack.Screen name="Onboarding"    component={OnboardingScreen} />
      <Stack.Screen name="SellerProfile" component={SellerProfileScreen} options={{ animationEnabled: true }} />
      <Stack.Screen name="Paywall"       component={PaywallScreen} />
      <Stack.Screen name="Premium"    component={PaywallScreen} options={{ animationEnabled: true }} />
      <Stack.Screen name="Checklist"       component={LaunchScreen}      options={{ animationEnabled: true }} />
      <Stack.Screen name="FeasibilityCheck"  component={CalculatorScreen}         options={{ animationEnabled: true }} />
      <Stack.Screen name="Main"              component={TabNavigator} />
      <Stack.Screen name="Legal"            component={LegalScreen}            options={{ animationEnabled: true }} />
      <Stack.Screen name="ProductBlueprint" component={ProductBlueprintScreen} options={{ animationEnabled: true }} />
    </Stack.Navigator>
  );
}
