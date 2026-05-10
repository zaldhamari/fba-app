import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { colors, radius, spacing } from '../theme';
import CopilotScreen    from '../screens/CopilotScreen';
import SearchScreen     from '../screens/SearchScreen';
import BrandScreen      from '../screens/BrandScreen';
import CalculatorScreen from '../screens/CalculatorScreen';
import LaunchScreen     from '../screens/LaunchScreen';

const Tab = createBottomTabNavigator();

const TABS = [
  { name: 'Co-Pilot',  icon: '⚡', label: 'Pilot',     color: '#4361EE', component: CopilotScreen    },
  { name: 'Search',    icon: '◎',  label: 'Search',    color: '#0284C7', component: SearchScreen     },
  { name: 'Calculate', icon: '◈',  label: 'Calculate', color: '#7C3AED', component: CalculatorScreen },
  { name: 'Brand',     icon: '✦',  label: 'Brand',     color: '#DB2777', component: BrandScreen      },
  { name: 'Launch',    icon: '↑',  label: 'Launch',    color: '#059669', component: LaunchScreen     },
];

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
            >
              <View style={[s.iconWrap, active && { backgroundColor: `${tab.color}18` }]}>
                <Text style={[s.tabIcon, { color: active ? tab.color : colors.textMuted }]}>
                  {tab.icon}
                </Text>
              </View>
              <Text style={[s.tabLabel, { color: active ? tab.color : colors.textMuted, fontWeight: active ? '700' : '500' }]}>
                {tab.label}
              </Text>
              {active && <View style={[s.activeDot, { backgroundColor: tab.color }]} />}
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
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E0E8F5',
    paddingHorizontal: spacing.xs,
    paddingTop: 6,
    paddingBottom: Platform.OS === 'ios' ? 24 : 6,
  },
  bar: {
    flexDirection: 'row',
  },
  tabBtn: {
    flex: 1,
    alignItems: 'center',
    gap: 3,
    paddingVertical: 2,
  },
  iconWrap: {
    width: 44,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabIcon: {
    fontSize: 15,
    fontWeight: '700' as const,
  },
  tabLabel: {
    fontSize: 10,
    letterSpacing: 0.1,
  },
  activeDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    marginTop: 1,
  },
});
