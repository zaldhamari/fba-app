import React, { useState, useRef, forwardRef } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, ViewStyle, TextStyle, StyleProp,
  TextInputProps,
} from 'react-native';
import { DS } from '../../theme/ds';

export interface InputFieldProps extends Omit<TextInputProps, 'style'> {
  /** Floating label above the input */
  label?:           string;
  /** Hint text shown below the input when there is no error */
  hint?:            string;
  /** Error text — replaces hint and changes border to danger red */
  error?:           string;
  /** Emoji/glyph icon on the left side of the input */
  leadingIcon?:     string;
  /** Emoji/glyph icon on the right side of the input */
  trailingIcon?:    string;
  /** Called when the trailing icon is pressed */
  onTrailingPress?: () => void;
  containerStyle?:  StyleProp<ViewStyle>;
  inputStyle?:      StyleProp<TextStyle>;
}

export const InputField = forwardRef<TextInput, InputFieldProps>(
  function InputField(
    {
      label,
      hint,
      error,
      leadingIcon,
      trailingIcon,
      onTrailingPress,
      containerStyle,
      inputStyle,
      onFocus,
      onBlur,
      ...rest
    }: InputFieldProps,
    ref,
  ) {
    const [focused, setFocused] = useState(false);
    const internalRef = useRef<TextInput>(null);
    const inputRef = (ref as React.RefObject<TextInput>) ?? internalRef;

    const borderColor = error
      ? DS.danger
      : focused
      ? DS.accent
      : DS.border;

    const handleFocus: NonNullable<TextInputProps['onFocus']> = (e) => {
      setFocused(true);
      onFocus?.(e);
    };

    const handleBlur: NonNullable<TextInputProps['onBlur']> = (e) => {
      setFocused(false);
      onBlur?.(e);
    };

    return (
      <View style={[s.wrap, containerStyle]}>
        {label ? (
          <Text style={s.label}>{label}</Text>
        ) : null}

        <TouchableOpacity
          style={[s.row, { borderColor }]}
          activeOpacity={1}
          onPress={() => (inputRef as React.RefObject<TextInput>).current?.focus()}
        >
          {leadingIcon ? (
            <Text style={s.leadIcon}>{leadingIcon}</Text>
          ) : null}

          <TextInput
            ref={inputRef}
            style={[s.input, inputStyle]}
            placeholderTextColor={DS.textMuted}
            onFocus={handleFocus}
            onBlur={handleBlur}
            {...rest}
          />

          {trailingIcon ? (
            <TouchableOpacity
              onPress={onTrailingPress}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              accessibilityRole="button"
            >
              <Text style={[s.trailIcon, focused && s.trailIconActive]}>
                {trailingIcon}
              </Text>
            </TouchableOpacity>
          ) : null}
        </TouchableOpacity>

        {error ? (
          <Text style={s.error}>{error}</Text>
        ) : hint ? (
          <Text style={s.hint}>{hint}</Text>
        ) : null}
      </View>
    );
  },
);

const s = StyleSheet.create({
  wrap: {
    gap: 6,
  },
  label: {
    fontSize:      13,
    fontWeight:    '600',
    color:         DS.textPrimary,
    letterSpacing: -0.1,
  },
  row: {
    flexDirection:   'row',
    alignItems:      'center',
    backgroundColor: DS.bgCard,
    borderRadius:    DS.radiusInput,
    borderWidth:     1.5,
    paddingHorizontal: 14,
    paddingVertical:   12,
    gap:             8,
  },
  input: {
    flex:      1,
    fontSize:  15,
    color:     DS.textPrimary,
    padding:   0,   // Remove default Android vertical padding
    margin:    0,
  },
  leadIcon: {
    fontSize:   18,
    color:      DS.textMuted,
    flexShrink: 0,
  },
  trailIcon: {
    fontSize:   18,
    color:      DS.textMuted,
    flexShrink: 0,
  },
  trailIconActive: {
    color: DS.accent,
  },
  hint: {
    fontSize:   12,
    color:      DS.textMuted,
    lineHeight: 17,
  },
  error: {
    fontSize:   12,
    color:      DS.danger,
    lineHeight: 17,
    fontWeight: '500',
  },
});
