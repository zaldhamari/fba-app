import React, { useRef, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Animated,
  ViewStyle, StyleProp,
} from 'react-native';
import { colors, spacing, radius, shadow } from '../../theme';

export interface SegmentOption<T extends string> {
  key: T;
  label: string;
  icon?: string;
}

export interface SegmentedControlProps<T extends string> {
  options: SegmentOption<T>[];
  value: T;
  onChange: (key: T) => void;
  /** Active indicator and label color */
  accentColor?: string;
  /** Height of each tab */
  tabHeight?: number;
  style?: StyleProp<ViewStyle>;
}

export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  accentColor,
  tabHeight = 36,
  style,
}: SegmentedControlProps<T>) {
  const activeIdx = options.findIndex(o => o.key === value);
  const translateX = useRef(new Animated.Value(0)).current;
  const widthRef = useRef(0);

  useEffect(() => {
    if (widthRef.current === 0) return;
    const tabW = widthRef.current / options.length;
    Animated.spring(translateX, {
      toValue: activeIdx * tabW,
      useNativeDriver: true,
      tension: 200,
      friction: 20,
    }).start();
  }, [activeIdx, options.length]);

  function onLayout(e: { nativeEvent: { layout: { width: number } } }) {
    widthRef.current = e.nativeEvent.layout.width;
    const tabW = widthRef.current / options.length;
    translateX.setValue(activeIdx * tabW);
  }

  const tabW = widthRef.current > 0 ? widthRef.current / options.length : undefined;

  return (
    <View style={[s.wrap, style]} onLayout={onLayout}>
      {/* Sliding pill indicator */}
      {tabW ? (
        <Animated.View
          style={[
            s.pill,
            {
              width: tabW - 6,
              height: tabHeight - 6,
              transform: [{ translateX: Animated.add(translateX, new Animated.Value(3)) }],
            },
          ]}
        />
      ) : null}

      {options.map(opt => {
        const isActive = opt.key === value;
        return (
          <TouchableOpacity
            key={opt.key}
            style={[s.tab, { height: tabHeight }]}
            onPress={() => onChange(opt.key)}
            activeOpacity={0.75}
          >
            {opt.icon ? (
              <Text style={[s.icon, isActive && s.iconActive]}>
                {opt.icon}
              </Text>
            ) : null}
            <Text
              style={[
                s.label,
                isActive && s.labelActive,
                isActive && accentColor ? { color: accentColor } : undefined,
              ]}
            >
              {opt.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const s = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    backgroundColor: '#E8EDF5',
    borderRadius: radius.lg,
    padding: 3,
    borderWidth: 1,
    borderColor: '#D0DAF0',
    position: 'relative',
  },
  pill: {
    position: 'absolute',
    top: 3,
    left: 0,
    backgroundColor: colors.bgCard,
    borderRadius: radius.md,
    ...shadow.sm,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    borderRadius: radius.md,
    zIndex: 1,
  },
  icon:       { fontSize: 12, color: colors.textMuted },
  iconActive: { color: colors.textPrimary },
  label:      { fontSize: 13, fontWeight: '700', color: colors.textMuted },
  labelActive:{ fontWeight: '800', color: '#0D1B4B' },
});
