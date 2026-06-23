/**
 * TypographySystemBuilder Component
 * Phase 2: Complete typography system builder
 * Font pairing, size scale, weight hierarchy, line height
 */

import React, { useState } from 'react';
import { View, StyleSheet, ScrollView, Text, TouchableOpacity, Alert } from 'react-native';
import { DS } from '../theme/ds';
import { AppCard } from './ds/AppCard';
import { SectionHeader } from './ds/SectionHeader';
import { PrimaryButton, SecondaryButton } from './ds/Buttons';
import { StatusBadge } from './ds/StatusBadge';
import { useBrandingSystem } from '../hooks/useBrandingSystem';
import type { TypographyScale, FontDefinition } from '../types/branding';

interface TypographySystemBuilderProps {
  style: string;
  onSystemGenerated?: (typography: TypographyScale) => void;
}

const FONT_OPTIONS: { name: string; category: string; url?: string }[] = [
  { name: 'Inter', category: 'sans-serif' },
  { name: 'Poppins', category: 'sans-serif' },
  { name: 'Playfair Display', category: 'serif' },
  { name: 'Montserrat', category: 'sans-serif' },
  { name: 'Open Sans', category: 'sans-serif' },
  { name: 'Lato', category: 'sans-serif' },
  { name: 'Roboto', category: 'sans-serif' },
  { name: 'Georgia', category: 'serif' },
];

export function TypographySystemBuilder({
  style,
  onSystemGenerated,
}: TypographySystemBuilderProps) {
  const { generateTypographySystem, loading, error } = useBrandingSystem();

  const [typography, setTypography] = useState<TypographyScale | null>(null);
  const [headlineFont, setHeadlineFont] = useState('Poppins');
  const [bodyFont, setBodyFont] = useState('Inter');

  const handleGenerateSystem = async () => {
    try {
      const system = await generateTypographySystem(style);
      setTypography(system);
      onSystemGenerated?.(system);
    } catch (err) {
      Alert.alert('Error', error || 'Failed to generate typography');
    }
  };

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      <AppCard>
        <SectionHeader
          title="Typography System"
          subtitle="Font pairing, scale, and hierarchy"
        />

        {error && (
          <View style={styles.errorBanner}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        {/* Font Selection */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Font Pairing</Text>

          <View style={styles.fontPairSection}>
            <View style={styles.fontSelect}>
              <Text style={styles.fontLabel}>Headline Font</Text>
              <View style={styles.fontOptions}>
                {FONT_OPTIONS.slice(0, 4).map(font => (
                  <TouchableOpacity
                    key={font.name}
                    style={[
                      styles.fontButton,
                      headlineFont === font.name && styles.fontButtonActive,
                    ]}
                    onPress={() => setHeadlineFont(font.name)}
                  >
                    <Text style={styles.fontName}>{font.name}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <View style={styles.fontSelect}>
              <Text style={styles.fontLabel}>Body Font</Text>
              <View style={styles.fontOptions}>
                {FONT_OPTIONS.slice(4).map(font => (
                  <TouchableOpacity
                    key={font.name}
                    style={[
                      styles.fontButton,
                      bodyFont === font.name && styles.fontButtonActive,
                    ]}
                    onPress={() => setBodyFont(font.name)}
                  >
                    <Text style={styles.fontName}>{font.name}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          </View>
        </View>

        {/* Preview */}
        {typography && (
          <View style={styles.previewSection}>
            <SectionHeader title="Typography Scale Preview" />

            <View style={styles.previewCard}>
              <Text style={[styles.previewH1, { fontFamily: headlineFont }]}>
                {headlineFont}
              </Text>
              <Text style={styles.previewDesc}>Headline · 48-72px · Weight 700-900</Text>
            </View>

            <View style={styles.previewCard}>
              <Text style={[styles.previewH2, { fontFamily: headlineFont }]}>
                Subheading
              </Text>
              <Text style={styles.previewDesc}>Subheading · 28-36px · Weight 600-700</Text>
            </View>

            <View style={styles.previewCard}>
              <Text style={[styles.previewBody, { fontFamily: bodyFont }]}>
                Body text looks like this. It's designed for readability at 14-16px, with proper
                line height (1.5-1.6) for comfortable reading on all devices.
              </Text>
              <Text style={styles.previewDesc}>Body · 14-16px · Weight 400-500</Text>
            </View>

            <View style={styles.previewCard}>
              <Text style={[styles.previewSmall, { fontFamily: bodyFont }]}>
                Small text and captions • 10-12px • Weight 400
              </Text>
            </View>
          </View>
        )}

        {/* Type Scale Details */}
        {typography && (
          <View style={styles.scaleSection}>
            <SectionHeader title="Complete Type Scale" />

            {[
              { key: 'h1', name: 'H1 - Headline', desc: '48-72px · Bold (700-900)' },
              { key: 'h2', name: 'H2 - Subheading', desc: '28-36px · Semi-bold (600-700)' },
              { key: 'h3', name: 'H3 - Tertiary', desc: '18-24px · Semi-bold (600)' },
              { key: 'body', name: 'Body - Paragraph', desc: '14-16px · Regular (400)' },
              { key: 'small', name: 'Small - Secondary', desc: '12-14px · Regular (400)' },
              { key: 'caption', name: 'Caption - Tiny', desc: '10-11px · Regular (400)' },
              { key: 'label', name: 'Label - UI Text', desc: '12px · Semi-bold (600)' },
            ].map(level => (
              <View key={level.key} style={styles.scaleItem}>
                <Text style={styles.scaleName}>{level.name}</Text>
                <Text style={styles.scaleDesc}>{level.desc}</Text>
              </View>
            ))}
          </View>
        )}

        {/* Best Practices */}
        <View style={styles.tipsSection}>
          <SectionHeader title="Typography Best Practices" />
          {[
            '✓ Use headline font (serif/display) for impact; body font for readability',
            '✓ Maintain 1.5-1.6 line height for comfortable reading',
            '✓ Limit font weight changes: use 2-3 weights per font',
            '✓ Ensure minimum 16px for body text on mobile devices',
            '✓ Use consistent letter-spacing: add spacing to headlines (1-4px)',
            '✓ Test contrast: body text must be readable on brand colors',
          ].map((tip, idx) => (
            <Text key={idx} style={styles.tipItem}>
              {tip}
            </Text>
          ))}
        </View>

        {/* Actions */}
        <View style={styles.actions}>
          <PrimaryButton
            label={loading ? 'Generating...' : 'Generate Typography System'}
            onPress={handleGenerateSystem}
            disabled={loading}
          />
          {typography && (
            <SecondaryButton
              label="Export as Guide"
              onPress={() => Alert.alert('Coming Soon', 'Typography guide PDF')}
            />
          )}
        </View>

        {typography && (
          <View style={styles.successBanner}>
            <StatusBadge variant="success" label="✓ Typography System Ready" />
            <Text style={styles.successText}>
              Your complete type scale is ready for design and development.
            </Text>
          </View>
        )}
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
  fontPairSection: {
    gap: DS.sectionGap,
  },
  fontSelect: {
    gap: 8,
  },
  fontLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: DS.textSecondary,
  },
  fontOptions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  fontButton: {
    flex: 1,
    minWidth: '45%',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: DS.radiusButton,
    borderWidth: 1.5,
    borderColor: DS.border,
    backgroundColor: DS.bgElevated,
    alignItems: 'center',
  },
  fontButtonActive: {
    borderColor: DS.accent,
    backgroundColor: DS.accent + '12',
  },
  fontName: {
    fontSize: 12,
    fontWeight: '600',
    color: DS.textSecondary,
  },
  previewSection: {
    marginVertical: DS.sectionGap,
  },
  previewCard: {
    backgroundColor: DS.bgElevated,
    borderRadius: DS.radiusCard,
    padding: 12,
    marginBottom: 12,
  },
  previewH1: {
    fontSize: 48,
    fontWeight: '900',
    color: DS.textPrimary,
    marginBottom: 4,
  },
  previewH2: {
    fontSize: 28,
    fontWeight: '700',
    color: DS.textPrimary,
    marginBottom: 4,
  },
  previewBody: {
    fontSize: 14,
    fontWeight: '400',
    color: DS.textSecondary,
    lineHeight: 20,
    marginBottom: 4,
  },
  previewSmall: {
    fontSize: 11,
    fontWeight: '400',
    color: DS.textMuted,
  },
  previewDesc: {
    fontSize: 10,
    color: DS.textMuted,
    fontStyle: 'italic',
  },
  scaleSection: {
    marginVertical: DS.sectionGap,
  },
  scaleItem: {
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: DS.border,
  },
  scaleName: {
    fontSize: 12,
    fontWeight: '700',
    color: DS.textPrimary,
    marginBottom: 4,
  },
  scaleDesc: {
    fontSize: 11,
    color: DS.textSecondary,
  },
  tipsSection: {
    marginVertical: DS.sectionGap,
    gap: 8,
  },
  tipItem: {
    fontSize: 12,
    color: DS.textSecondary,
    lineHeight: 16,
  },
  actions: {
    gap: DS.cardGap,
    marginVertical: DS.sectionGap,
  },
  successBanner: {
    backgroundColor: DS.success + '15',
    borderRadius: DS.radiusCard,
    padding: DS.cardPadding,
    borderWidth: 1,
    borderColor: DS.success + '30',
    gap: 8,
  },
  successText: {
    fontSize: 12,
    color: DS.textSecondary,
  },
});
