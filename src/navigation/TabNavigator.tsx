import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { colors, radius, spacing } from '../theme';
import CopilotScreen    from '../screens/CopilotScreen';
import ResearchScreen   from '../screens/ResearchScreen';
import BrandScreen      from '../screens/BrandScreen';
import KeywordsScreen   from '../screens/KeywordsScreen';
import SuppliersScreen  from '../screens/SuppliersScreen';
import CalculatorScreen from '../screens/CalculatorScreen';
import LaunchScreen     from '../screens/LaunchScreen';

const Tab = createBottomTabNavigator();

const TABS = [
  { name: 'Co-Pilot',  icon: '⚡', label: 'Pilot',     color: colors.purple, component: CopilotScreen    },
  { name: 'Research',  icon: '◎',  label: 'Research',  color: colors.cyan,   component: ResearchScreen   },
  { name: 'Brand',     icon: '✦',  label: 'Brand',     color: colors.pink,   component: BrandScreen      },
  { name: 'Keywords',  icon: '≋',  label: 'SEO',       color: colors.amber,  component: KeywordsScreen   },
  { name: 'Suppliers', icon: '⬡',  label: 'Suppliers', color: colors.green,  component: SuppliersScreen  },
  { name: 'Calculate', icon: '◈',  label: 'Calculate', color: colors.purple, component: CalculatorScreen },
  { name: 'Launch',    icon: '↑',  label: 'Launch',    color: colors.green,  component: LaunchScreen     },
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
              {active ? (
                <View style={[s.activeChip, { backgroundColor: `${tab.color}22` }]}>
                  <Text style={[s.tabIcon, { color: tab.color }]}>{tab.icon}</Text>
                  <Text style={[s.tabLabel, { color: tab.color }]}>{tab.label}</Text>
                </View>
              ) : (
                <View style={s.inactiveChip}>
                  <Text style={[s.tabIcon, { color: colors.textMuted }]}>{tab.icon}</Text>
                </View>
              )}
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
    backgroundColor: colors.bgCard,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingHorizontal: spacing.sm,
    paddingTop: 6,
    paddingBottom: Platform.OS === 'ios' ? 22 : 6,
  },
  bar: {
    flexDirection: 'row',
    backgroundColor: colors.bgElevated,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 3,
    alignItems: 'center',
  },
  tabBtn: { flex: 1, alignItems: 'center' },
  activeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: radius.full,
  },
  inactiveChip: {
    paddingHorizontal: 6,
    paddingVertical: 7,
    borderRadius: radius.full,
    alignItems: 'center',
  },
  tabIcon:  { fontSize: 13, fontWeight: '700' as const },
  tabLabel: { fontSize: 11, fontWeight: '700' as const, letterSpacing: -0.2 },
});
