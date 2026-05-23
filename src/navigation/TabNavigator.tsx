import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { DS } from '../theme/ds';
import { ErrorBoundary } from '../components/ErrorBoundary';
import NicheResearchScreen    from '../screens/NicheResearchScreen';
import ResearchWorkspaceScreen from '../screens/ResearchWorkspaceScreen';
import SupplierSourcingScreen  from '../screens/SupplierSourcingScreen';
import BrandStudioScreen       from '../screens/BrandStudioScreen';
import ProfitLabScreen         from '../screens/ProfitLabScreen';

function withBoundary<P extends object>(
  Component: React.ComponentType<P>,
  label: string,
): React.ComponentType<P> {
  return function BoundaryWrapped(props: P) {
    return (
      <ErrorBoundary fallbackLabel={label}>
        <Component {...props} />
      </ErrorBoundary>
    );
  };
}

const Tab = createBottomTabNavigator();

const TABS = [
  { name: 'Niche',     icon: '◎', label: 'Niche',     component: withBoundary(NicheResearchScreen,    'Niche tab')     },
  { name: 'Validate',  icon: '✦', label: 'Validate',  component: withBoundary(ResearchWorkspaceScreen,'Validate tab')  },
  { name: 'Suppliers', icon: '⬡', label: 'Suppliers', component: withBoundary(SupplierSourcingScreen, 'Suppliers tab') },
  { name: 'Label',     icon: '▣', label: 'Label',     component: withBoundary(BrandStudioScreen,      'Label tab')     },
  { name: 'Costs',     icon: '✈', label: 'Costs',     component: withBoundary(ProfitLabScreen,        'Costs tab')     },
] as const;

function CustomTabBar({ state, navigation }: BottomTabBarProps) {
  return (
    <View style={s.wrapper}>
      <View style={s.bar}>
        {state.routes.map((route, index) => {
          const tab    = TABS.find(t => t.name === route.name) ?? TABS[0];
          const active = state.index === index;
          return (
            <TouchableOpacity
              key={route.key}
              style={s.tabBtn}
              onPress={() => navigation.navigate(route.name)}
              activeOpacity={0.7}
              accessibilityRole="tab"
              accessibilityLabel={tab.label}
              accessibilityState={{ selected: active }}
            >
              <View style={[s.iconWrap, active && s.iconWrapActive]}>
                <Text style={[s.tabIcon, active && s.tabIconActive]}>
                  {tab.icon}
                </Text>
              </View>
              <Text style={[s.tabLabel, active && s.tabLabelActive]}>
                {tab.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

export default function TabNavigator() {
  return (
    <Tab.Navigator
      tabBar={props => <CustomTabBar {...props} />}
      screenOptions={{ headerShown: false }}
    >
      {TABS.map(tab => (
        <Tab.Screen key={tab.name} name={tab.name} component={tab.component} />
      ))}
    </Tab.Navigator>
  );
}

const s = StyleSheet.create({
  wrapper: {
    backgroundColor:  DS.bgCard,
    borderTopWidth:   1,
    borderTopColor:   DS.border,
    paddingHorizontal: 4,
    paddingTop:       6,
    paddingBottom:    Platform.OS === 'ios' ? 24 : 8,
    shadowColor:      '#0D1B4B',
    shadowOffset:     { width: 0, height: -2 },
    shadowOpacity:    0.06,
    shadowRadius:     12,
    elevation:        12,
  },
  bar: { flexDirection: 'row' },
  tabBtn: {
    flex:            1,
    alignItems:      'center',
    gap:             2,
    paddingVertical: 2,
  },
  iconWrap: {
    width:          40,
    height:         26,
    borderRadius:   13,
    alignItems:     'center',
    justifyContent: 'center',
  },
  iconWrapActive:  { backgroundColor: DS.accentLight },
  tabIcon:         { fontSize: 15, fontWeight: '700', color: DS.textMuted },
  tabIconActive:   { color: DS.accent },
  tabLabel:        { fontSize: 9, fontWeight: '500', color: DS.textMuted, letterSpacing: 0.2 },
  tabLabelActive:  { fontWeight: '700', color: DS.accent },
});
