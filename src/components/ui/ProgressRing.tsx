import React, { useEffect, useRef } from 'react';
import { View, Text, Animated, StyleSheet, StyleProp, ViewStyle } from 'react-native';
import { colors } from '../../theme';

export interface ProgressRingProps {
  /** 0 – 100 */
  progress: number;
  size?: number;
  strokeWidth?: number;
  color?: string;
  trackColor?: string;
  /** Render a percentage label in the center automatically */
  showLabel?: boolean;
  /** Replace auto-label with arbitrary center content */
  children?: React.ReactNode;
  /** Animate the ring on mount and on progress changes */
  animated?: boolean;
  style?: StyleProp<ViewStyle>;
}

// ─── Implementation note ───────────────────────────────────────────────────────
// Uses the CSS half-circle trick (two clipped rotating arcs) since react-native-svg
// is not in this project. Each half is an Animated.View so the fill transitions
// smoothly without requiring the native driver (we animate rotation, not opacity,
// but the left-half gate requires JS-thread evaluation).

export function ProgressRing({
  progress,
  size = 80,
  strokeWidth = 9,
  color = colors.purple,
  trackColor = '#E8EDF8',
  showLabel = true,
  children,
  animated: shouldAnimate = true,
  style,
}: ProgressRingProps) {
  const clampedTarget = Math.min(Math.max(progress, 0), 100);
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!shouldAnimate) {
      anim.setValue(clampedTarget);
      return;
    }
    Animated.timing(anim, {
      toValue: clampedTarget,
      duration: 900,
      useNativeDriver: false,
    }).start();
  }, [clampedTarget, shouldAnimate]);

  const half = size / 2;
  const inner = size - strokeWidth * 2;

  // Right arc rotates from -180° (0%) → 0° (50%+)
  const rightRotate = anim.interpolate({
    inputRange: [0, 50],
    outputRange: ['-180deg', '0deg'],
    extrapolate: 'clamp',
  });

  // Left arc is hidden below 50%, visible above
  const leftOpacity = anim.interpolate({
    inputRange: [48, 52],
    outputRange: [0, 1],
    extrapolate: 'clamp',
  });

  // Left arc rotates from -180° (50%) → 0° (100%)
  const leftRotate = anim.interpolate({
    inputRange: [50, 100],
    outputRange: ['-180deg', '0deg'],
    extrapolate: 'clamp',
  });

  // Percentage label (driven by Animated value → JS listener pattern)
  const labelRef = useRef<Text>(null);
  useEffect(() => {
    const id = anim.addListener(({ value }) => {
      labelRef.current?.setNativeProps({ text: `${Math.round(value)}%` });
    });
    return () => anim.removeListener(id);
  }, [anim]);

  const ringStyle: ViewStyle = { width: size, height: size };

  return (
    <View style={[ringStyle, style]}>
      {/* Track circle */}
      <View
        style={[
          StyleSheet.absoluteFill,
          {
            borderRadius: half,
            borderWidth: strokeWidth,
            borderColor: trackColor,
          },
        ]}
      />

      {/* Right half-arc */}
      <View
        style={{
          position: 'absolute',
          top: 0,
          right: 0,
          width: half,
          height: size,
          overflow: 'hidden',
        }}
      >
        <Animated.View
          style={{
            position: 'absolute',
            top: 0,
            right: 0,
            width: size,
            height: size,
            borderRadius: half,
            borderWidth: strokeWidth,
            borderColor: color,
            transform: [{ rotate: rightRotate }],
          }}
        />
      </View>

      {/* Left half-arc — revealed after 50% */}
      <Animated.View
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: half,
          height: size,
          overflow: 'hidden',
          opacity: leftOpacity,
        }}
      >
        <Animated.View
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: size,
            height: size,
            borderRadius: half,
            borderWidth: strokeWidth,
            borderColor: color,
            transform: [{ rotate: leftRotate }],
          }}
        />
      </Animated.View>

      {/* Center content */}
      <View
        style={{
          position: 'absolute',
          top: strokeWidth,
          left: strokeWidth,
          width: inner,
          height: inner,
          borderRadius: inner / 2,
          backgroundColor: colors.bgCard,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {children ?? (
          showLabel ? (
            <Text
              ref={labelRef}
              style={[
                s.label,
                {
                  fontSize: Math.floor(inner * 0.24),
                  lineHeight: Math.floor(inner * 0.28),
                  color,
                },
              ]}
            >
              {`${Math.round(clampedTarget)}%`}
            </Text>
          ) : null
        )}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  label: {
    fontWeight: '900',
    letterSpacing: -0.5,
  },
});
