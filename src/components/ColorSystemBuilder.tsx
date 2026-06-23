/**
 * ColorSystemBuilder Component
 * Phase 1: Color palette generation + contrast checking
 */

import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, Text, TouchableOpacity } from 'react-native';
import { DS } from '../theme/ds';
import { AppCard } from './ds/AppCard';
import { SectionHeader } from './ds/SectionHeader';
import { InputField } from './ds/InputField';
import { PrimaryButton } from './ds/Buttons';
import { StatusBadge } from './ds/StatusBadge';
import { useBrandingSystem } from '../hooks/useBrandingSystem';
import type { ColorPalette } from '../types/branding';

interface ColorSystemBuilderProps {
  onPaletteGenerated?: (palette: ColorPalette) => void;
}

export function ColorSystemBuilder({ onPaletteGenerated }: ColorSystemBuilderProps) {
  const { generateColorPalette, loading, error } = useBrandingSystem();

  const [primaryColor, setPrimaryColor] = useState('#2563EB');
  const [palette, setPalette] = useState<ColorPalette | null>(null);

  const handleGeneratePalette = async () => {
    try {
      const newPalette = await generateColorPalette(primaryColor);
      setPalette(newPalette);
      onPaletteGenerated?.(newPalette);
    } catch (err) {
      console.error('Failed to generate palette:', err);
    }
  };

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      <AppCard>
        <SectionHeader title="Color System" subtitle="Build a complete color palette" />

        {error && (
          <View style={styles.errorBanner}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        {/* Primary Color Picker */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Primary Color</Text>
          <View style={styles.colorPickerRow}>
            <View
              style={[
                styles.colorPreview,
                { backgroundColor: primaryColor },
              ]}
            />
            <InputField
              label="Hex Code"
              value={primaryColor}
              onChangeText={setPrimaryColor}
              placeholder="#2563EB"
              style={{ flex: 1 }}
            />
          </View>
        </View>

        {/* Popular Colors */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Quick Select</Text>
          <View style={styles.quickColors}>
            {[
              { name: 'Blue', hex: '#2563EB' },
              { name: 'Green', hex: '#10B981' },
              { name: 'Purple', hex: '#7C3AED' },
              { name: 'Orange', hex: '#F59E0B' },
              { name: 'Pink', hex: '#EC4899' },
              { name: 'Teal', hex: '#14B8A6' },
            ].map(color => (
              <TouchableOpacity
                key={color.hex}
                style={[
                  styles.quickColorButton,
                  { backgroundColor: color.hex },
                  primaryColor === color.hex && styles.quickColorButtonActive,
                ]}
                onPress={() => setPrimaryColor(color.hex)}
              >
                <Text style={styles.quickColorLabel}>{color.name}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Generated Palette */}
        {palette && (
          <>
            <View style={styles.section}>
              <SectionHeader title="Generated Palette" size="sm" />

              {/* Primary Shades */}
              <View style={styles.shadeGroup}>
                <Text style={styles.groupLabel}>Primary Shades</Text>
                {[
                  { name: 'Lightest', color: palette.primary.lighter },
                  { name: 'Light', color: palette.primary.light },
                  { name: 'Main', color: palette.primary.main },
                  { name: 'Dark', color: palette.primary.dark },
                  { name: 'Darkest', color: palette.primary.darker },
                ].map(shade => (
                  <View key={shade.name} style={styles.shadeRow}>
                    <View
                      style={[
                        styles.shadeColor,
                        { backgroundColor: shade.color },
                      ]}
                    />
                    <Text style={styles.shadeName}>{shade.name}</Text>
                    <Text style={styles.shadeHex}>{shade.color}</Text>
                  </View>
                ))}
              </View>

              {/* Neutrals */}
              <View style={styles.shadeGroup}>
                <Text style={styles.groupLabel}>Neutral Colors</Text>
                {[
                  { name: 'White', color: palette.neutrals.white },
                  { name: 'Light Gray', color: palette.neutrals.light },
                  { name: 'Gray', color: palette.neutrals.gray },
                  { name: 'Dark Gray', color: palette.neutrals.darkGray },
                  { name: 'Black', color: palette.neutrals.black },
                ].map(shade => (
                  <View key={shade.name} style={styles.shadeRow}>
                    <View
                      style={[
                        styles.shadeColor,
                        { backgroundColor: shade.color },
                      ]}
                    />
                    <Text style={styles.shadeName}>{shade.name}</Text>
                    <Text style={styles.shadeHex}>{shade.color}</Text>
                  </View>
                ))}
              </View>

              {/* Usage Guide */}
              <View style={styles.usageGuide}>
                <Text style={styles.usageLabel}>Color Usage</Text>
                <View style={styles.usageItem}>
                  <Text style={styles.usageBold}>Backgrounds:</Text>
                  <Text style={styles.usageText}>{palette.usage.backgrounds.join(', ')}</Text>
                </View>
                <View style={styles.usageItem}>
                  <Text style={styles.usageBold}>Text:</Text>
                  <Text style={styles.usageText}>{palette.usage.text.join(', ')}</Text>
                </View>
                <View style={styles.usageItem}>
                  <Text style={styles.usageBold}>Accents:</Text>
                  <Text style={styles.usageText}>{palette.usage.accents.join(', ')}</Text>
                </View>
              </View>

              {/* Contrast Info */}
              <View style={styles.contrastSection}>
                <Text style={styles.contrastLabel}>Contrast Ratios (WCAG)</Text>
                {palette.contrast.map((check, idx) => (
                  <View key={idx} style={styles.contrastRow}>
                    <View style={styles.contrastPreview}>
                      <View
                        style={[
                          styles.contrastSquare,
                          { backgroundColor: check.color1 },
                        ]}
                      />
                      <View
                        style={[
                          styles.contrastSquare,
                          { backgroundColor: check.color2 },
                        ]}
                      />
                    </View>
                    <View style={styles.contrastInfo}>
                      <Text style={styles.contrastRatio}>
                        Ratio: {check.ratio.toFixed(2)}:1
                      </Text>
                      <StatusBadge
                        status={
                          check.wcagLevel === 'AAA'
                            ? 'success'
                            : check.wcagLevel === 'AA'
                              ? 'info'
                              : 'danger'
                        }
                        label={`WCAG ${check.wcagLevel}`}
                      />
                    </View>
                  </View>
                ))}
              </View>
            </View>
          </>
        )}

        {/* Action */}
        <View style={styles.actions}>
          <PrimaryButton
            label={loading ? 'Generating...' : 'Generate Palette'}
            onPress={handleGeneratePalette}
            disabled={loading}
          />
        </View>
      </AppCard>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: DS.bgCanvas,
    padding: DS.pagePadding,
  },
  errorBanner: {
    backgroundColor: DS.danger + '20',
    borderRadius: DS.radiusCard,
    padding: DS.cardPadding,
    marginBottom: DS.sectionGap,
  },
  errorText: {
    fontSize: 13,
    color: DS.danger,
    fontWeight: '500',
  },
  section: {
    marginVertical: DS.cardGap,
    paddingVertical: DS.cardGap,
    borderBottomWidth: 1,
    borderBottomColor: DS.border,
  },
  sectionLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: DS.textPrimary,
    marginBottom: 12,
  },
  colorPickerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  colorPreview: {
    width: 48,
    height: 48,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: DS.border,
  },
  quickColors: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  quickColorButton: {
    flex: 1,
    minWidth: '30%',
    paddingVertical: 12,
    borderRadius: DS.radiusCard,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  quickColorButtonActive: {
    borderColor: '#FFFFFF',
  },
  quickColorLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  shadeGroup: {
    marginVertical: DS.cardGap,
    gap: 8,
  },
  groupLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: DS.textPrimary,
    marginBottom: 8,
  },
  shadeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: DS.border,
  },
  shadeColor: {
    width: 40,
    height: 40,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: DS.border,
  },
  shadeName: {
    fontSize: 12,
    fontWeight: '600',
    color: DS.textPrimary,
    flex: 1,
  },
  shadeHex: {
    fontSize: 11,
    color: DS.textMuted,
    fontFamily: 'monospace',
  },
  usageGuide: {
    backgroundColor: DS.bgElevated,
    borderRadius: DS.radiusCard,
    padding: DS.cardPadding,
    marginVertical: DS.cardGap,
    gap: 10,
  },
  usageLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: DS.textPrimary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  usageItem: {
    gap: 4,
  },
  usageBold: {
    fontSize: 12,
    fontWeight: '600',
    color: DS.textPrimary,
  },
  usageText: {
    fontSize: 11,
    color: DS.textSecondary,
  },
  contrastSection: {
    backgroundColor: DS.bgElevated,
    borderRadius: DS.radiusCard,
    padding: DS.cardPadding,
    marginVertical: DS.cardGap,
  },
  contrastLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: DS.textPrimary,
    marginBottom: 12,
  },
  contrastRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 8,
  },
  contrastPreview: {
    flexDirection: 'row',
    gap: 4,
  },
  contrastSquare: {
    width: 30,
    height: 30,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: DS.border,
  },
  contrastInfo: {
    flex: 1,
    gap: 4,
  },
  contrastRatio: {
    fontSize: 12,
    fontWeight: '600',
    color: DS.textPrimary,
  },
  actions: {
    marginTop: DS.sectionGap,
    gap: DS.cardGap,
  },
});
