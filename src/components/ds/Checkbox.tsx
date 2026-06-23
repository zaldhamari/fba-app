import React from 'react';
import { TouchableOpacity, View, StyleSheet } from 'react-native';
import { DS } from '../../theme/ds';

interface CheckboxProps {
  checked: boolean;
  onToggle: (checked: boolean) => void;
  disabled?: boolean;
}

export function Checkbox({ checked, onToggle, disabled }: CheckboxProps) {
  return (
    <TouchableOpacity
      onPress={() => !disabled && onToggle(!checked)}
      activeOpacity={0.7}
      accessibilityRole="checkbox"
      accessibilityState={{ checked }}
      style={styles.hit}
    >
      <View style={[styles.box, checked && styles.boxChecked, disabled && styles.boxDisabled]}>
        {checked && <View style={styles.tick} />}
      </View>
    </TouchableOpacity>
  );
}

const BOX = 22;

const styles = StyleSheet.create({
  hit: {
    padding: 2,
  },
  box: {
    width: BOX,
    height: BOX,
    borderRadius: DS.radiusChip,
    borderWidth: 2,
    borderColor: DS.border,
    backgroundColor: DS.bgCard,
    justifyContent: 'center',
    alignItems: 'center',
  },
  boxChecked: {
    borderColor: DS.accent,
    backgroundColor: DS.accent,
  },
  boxDisabled: {
    opacity: 0.4,
  },
  tick: {
    width: 10,
    height: 6,
    borderLeftWidth: 2,
    borderBottomWidth: 2,
    borderColor: '#FFFFFF',
    transform: [{ rotate: '-45deg' }, { translateY: -1 }],
  },
});
