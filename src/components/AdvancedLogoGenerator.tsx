/**
 * AdvancedLogoGenerator Component
 * Professional logo generation with 5 variations:
 * 1. Icon Mark (favicon size)
 * 2. Wordmark (text-based)
 * 3. Badge (circular)
 * 4. Combined Lockup (horizontal)
 * 5. Monochrome (print version)
 */

import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, Text, TouchableOpacity, Alert } from 'react-native';
import { SvgXml } from 'react-native-svg';
import { DS } from '../theme/ds';
import { AppCard } from './ds/AppCard';
import { SectionHeader } from './ds/SectionHeader';
import { PrimaryButton, SecondaryButton } from './ds/Buttons';
import { StatusBadge } from './ds/StatusBadge';
import { generateAdvancedLogos } from '../services/advancedBrandGeneration';
import type { BrandStory, ColorPalette, TypographyScale, LogoVariation } from '../types/branding';

interface AdvancedLogoGeneratorProps {
  story: BrandStory;
  colors: ColorPalette;
  typography?: TypographyScale;
  onLogosGenerated?: (logos: LogoVariation[]) => void;
}

export function AdvancedLogoGenerator({
  story,
  colors,
  typography,
  onLogosGenerated,
}: AdvancedLogoGeneratorProps) {
  const [logos, setLogos] = useState<LogoVariation[] | null>(null);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleGenerateLogos = async () => {
    setLoading(true);
    setError(null);
    try {
      const generated = await generateAdvancedLogos(story, colors, typography);
      setLogos(generated);
      onLogosGenerated?.(generated);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to generate logos';
      setError(message);
      Alert.alert('Error', message);
    } finally {
      setLoading(false);
    }
  };

  const selectedLogo = logos?.[selectedIndex];

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      <AppCard>
        <SectionHeader
          title="Advanced Logo Generator"
          subtitle="5 professional variations for all use cases"
        />

        {error && (
          <View style={styles.errorBanner}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        {/* Logo Preview */}
        <AppCard padding={0} style={styles.previewCard}>
          <View style={styles.header}>
            <Text style={styles.headerLabel}>Logo Preview</Text>
            {selectedLogo && (
              <StatusBadge
                status="success"
                label={`${selectedIndex + 1} of ${logos?.length || 0}`}
              />
            )}
          </View>

          <View style={styles.canvas}>
            {loading ? (
              <Text style={styles.loadingText}>Generating professional logos...</Text>
            ) : selectedLogo && selectedLogo.svg ? (
              <>
                <SvgXml
                  xml={selectedLogo.svg}
                  width="100%"
                  height={300}
                />
              </>
            ) : (
              <Text style={styles.placeholderText}>
                Generate to see 5 professional logo variations
              </Text>
            )}
          </View>

          {/* Logo Details */}
          {selectedLogo && (
            <View style={styles.details}>
              <Text style={styles.detailsTitle}>{selectedLogo.name}</Text>
              <Text style={styles.detailsDesc}>{selectedLogo.usage}</Text>

              <View style={styles.specRow}>
                <Text style={styles.specLabel}>Minimum Size:</Text>
                <Text style={styles.specValue}>{selectedLogo.minSize}</Text>
              </View>

              <View style={styles.specRow}>
                <Text style={styles.specLabel}>Best For:</Text>
                <Text style={styles.specValue}>{selectedLogo.bestFor}</Text>
              </View>
            </View>
          )}

          {/* Tab Navigation */}
          {logos && logos.length > 0 && (
            <View style={styles.tabs}>
              {logos.map((logo, idx) => (
                <TouchableOpacity
                  key={idx}
                  style={[
                    styles.tab,
                    selectedIndex === idx && styles.tabActive,
                  ]}
                  onPress={() => setSelectedIndex(idx)}
                >
                  <Text style={[
                    styles.tabLabel,
                    selectedIndex === idx && styles.tabLabelActive,
                  ]}>
                    {logo.type === 'combined' ? 'Lockup' : logo.type === 'badge' ? 'Badge' : logo.type}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </AppCard>

        {/* Logo Variations Overview */}
        {logos && (
          <View style={styles.section}>
            <SectionHeader title="All 5 Variations" size="sm" />
            <View style={styles.variationsGrid}>
              {logos.map((logo, idx) => (
                <TouchableOpacity
                  key={idx}
                  style={[
                    styles.variationCard,
                    selectedIndex === idx && styles.variationCardActive,
                  ]}
                  onPress={() => setSelectedIndex(idx)}
                >
                  <View style={styles.variationPreview}>
                    <SvgXml
                      xml={logo.svg}
                      width="100%"
                      height="100%"
                    />
                  </View>
                  <Text style={styles.variationName}>{logo.name}</Text>
                  <Text style={styles.variationType}>{logo.type}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}

        {/* Logo Information */}
        <View style={styles.infoSection}>
          <SectionHeader title="Why 5 Variations?" size="sm" />

          {[
            {
              icon: '○',
              name: 'Icon Mark',
              desc: 'Standalone symbol for small spaces, favicon, app icon, social profiles',
            },
            {
              icon: '🔤',
              name: 'Wordmark',
              desc: 'Text-only branding for websites, headers, marketing materials',
            },
            {
              icon: '◆',
              name: 'Badge',
              desc: 'Icon + text combined for packaging, labels, email signatures',
            },
            {
              icon: '→',
              name: 'Combined Lockup',
              desc: 'Full horizontal layout for websites, advertisements, print',
            },
            {
              icon: '■',
              name: 'Monochrome',
              desc: 'Black & white version for printing, embossing, single-color apps',
            },
          ].map((variation, idx) => (
            <View key={idx} style={styles.infoItem}>
              <Text style={styles.infoIcon}>{variation.icon}</Text>
              <View style={styles.infoContent}>
                <Text style={styles.infoTitle}>{variation.name}</Text>
                <Text style={styles.infoDesc}>{variation.desc}</Text>
              </View>
            </View>
          ))}
        </View>

        {/* Actions */}
        <View style={styles.actions}>
          <PrimaryButton
            label={loading ? 'Generating...' : 'Generate 5 Logo Variations'}
            onPress={handleGenerateLogos}
            disabled={loading}
          />
          {selectedLogo && (
            <SecondaryButton
              label="Export All SVGs"
              onPress={() => {
                // TODO: Implement multi-export
                Alert.alert('Coming Soon', 'Export all logos as ZIP');
              }}
            />
          )}
        </View>

        {/* Quality Note */}
        <View style={styles.qualityNote}>
          <Text style={styles.qualityLabel}>✨ Premium Quality</Text>
          <Text style={styles.qualityText}>
            All logos are generated as scalable SVG files ready for:
            websites, print, embroidery, social media, packaging, and more.
          </Text>
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
  previewCard: {
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: DS.border,
  },
  headerLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: DS.textPrimary,
    textTransform: 'uppercase',
  },
  canvas: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
    paddingHorizontal: 24,
    backgroundColor: DS.bgSubtle,
    minHeight: 320,
  },
  loadingText: {
    fontSize: 14,
    color: DS.textMuted,
  },
  placeholderText: {
    fontSize: 13,
    color: DS.textMuted,
    textAlign: 'center',
  },
  details: {
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: DS.border,
    gap: 8,
  },
  detailsTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: DS.textPrimary,
  },
  detailsDesc: {
    fontSize: 12,
    color: DS.textSecondary,
    lineHeight: 16,
  },
  specRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  specLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: DS.textSecondary,
  },
  specValue: {
    fontSize: 11,
    fontWeight: '700',
    color: DS.textPrimary,
  },
  tabs: {
    flexDirection: 'row',
    gap: 6,
    padding: 12,
    borderTopWidth: 1,
    borderTopColor: DS.border,
  },
  tab: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: DS.radiusButton,
    borderWidth: 1.5,
    borderColor: DS.border,
    alignItems: 'center',
  },
  tabActive: {
    borderColor: DS.accent,
    backgroundColor: DS.accent + '12',
  },
  tabLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: DS.textSecondary,
    textTransform: 'capitalize',
  },
  tabLabelActive: {
    color: DS.accent,
    fontWeight: '700',
  },
  section: {
    marginVertical: DS.sectionGap,
  },
  variationsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  variationCard: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: DS.bgElevated,
    borderRadius: DS.radiusCard,
    borderWidth: 2,
    borderColor: DS.border,
    padding: 12,
    overflow: 'hidden',
  },
  variationCardActive: {
    borderColor: DS.accent,
    backgroundColor: DS.accent + '08',
  },
  variationPreview: {
    height: 100,
    marginBottom: 8,
    backgroundColor: 'white',
    borderRadius: DS.radiusButton,
  },
  variationName: {
    fontSize: 12,
    fontWeight: '700',
    color: DS.textPrimary,
  },
  variationType: {
    fontSize: 10,
    color: DS.textMuted,
    marginTop: 2,
  },
  infoSection: {
    marginVertical: DS.sectionGap,
    gap: 12,
  },
  infoItem: {
    flexDirection: 'row',
    gap: 12,
    padding: 12,
    backgroundColor: DS.bgElevated,
    borderRadius: DS.radiusCard,
  },
  infoIcon: {
    fontSize: 20,
    width: 24,
  },
  infoContent: {
    flex: 1,
  },
  infoTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: DS.textPrimary,
  },
  infoDesc: {
    fontSize: 11,
    color: DS.textSecondary,
    marginTop: 2,
    lineHeight: 15,
  },
  actions: {
    gap: DS.cardGap,
    marginVertical: DS.sectionGap,
  },
  qualityNote: {
    backgroundColor: DS.success + '15',
    borderRadius: DS.radiusCard,
    padding: DS.cardPadding,
    borderWidth: 1,
    borderColor: DS.success + '30',
  },
  qualityLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: DS.success,
    marginBottom: 6,
  },
  qualityText: {
    fontSize: 11,
    color: DS.textSecondary,
    lineHeight: 15,
  },
});
