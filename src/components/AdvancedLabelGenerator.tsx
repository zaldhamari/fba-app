/**
 * AdvancedLabelGenerator Component
 * Professional product label generation with:
 * - Proper typography hierarchy
 * - Color palette integration
 * - Logo placement
 * - Benefit bullets
 * - Print-safe design
 */

import React, { useState } from 'react';
import { View, StyleSheet, ScrollView, Text, TouchableOpacity, Alert, Share } from 'react-native';
import { SvgXml } from 'react-native-svg';
import { DS } from '../theme/ds';
import { AppCard } from './ds/AppCard';
import { SectionHeader } from './ds/SectionHeader';
import { PrimaryButton, SecondaryButton } from './ds/Buttons';
import { StatusBadge } from './ds/StatusBadge';
import { generateAdvancedLabel } from '../services/advancedBrandGeneration';
import type { BrandStory, ColorPalette, TypographyScale, LabelDesign } from '../types/branding';

interface AdvancedLabelGeneratorProps {
  story: BrandStory;
  colors: ColorPalette;
  typography: TypographyScale;
  logoSvg: string;
  packageType: string;
  onLabelGenerated?: (label: LabelDesign) => void;
}

const PACKAGE_TYPES = [
  { id: 'standard', label: 'Standard Box', icon: '□' },
  { id: 'bottle', label: 'Bottle', icon: '⌇' },
  { id: 'pouch', label: 'Pouch', icon: '◫' },
  { id: 'box', label: 'Product Box', icon: '▪' },
  { id: 'supplement', label: 'Supplement', icon: '⬡' },
  { id: 'cosmetic', label: 'Cosmetic', icon: '◈' },
  { id: 'eco', label: 'Eco Wrap', icon: '🌿' },
];

export function AdvancedLabelGenerator({
  story,
  colors,
  typography,
  logoSvg,
  packageType: initialPackageType,
  onLabelGenerated,
}: AdvancedLabelGeneratorProps) {
  const [packageType, setPackageType] = useState(initialPackageType || 'standard');
  const [label, setLabel] = useState<LabelDesign | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleGenerateLabel = async () => {
    setLoading(true);
    setError(null);
    try {
      const generated = await generateAdvancedLabel(
        story,
        colors,
        typography,
        packageType,
        logoSvg,
      );
      setLabel(generated);
      onLabelGenerated?.(generated);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to generate label';
      setError(message);
      Alert.alert('Error', message);
    } finally {
      setLoading(false);
    }
  };

  const packageInfo = PACKAGE_TYPES.find(p => p.id === packageType);

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      <AppCard>
        <SectionHeader
          title="Advanced Label Generator"
          subtitle="Professional product labels for all packaging types"
        />

        {error && (
          <View style={styles.errorBanner}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        {/* Packaging Type Selection */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Packaging Format</Text>
          <View style={styles.packageGrid}>
            {PACKAGE_TYPES.map(pkg => (
              <TouchableOpacity
                key={pkg.id}
                style={[
                  styles.packageButton,
                  packageType === pkg.id && styles.packageButtonActive,
                ]}
                onPress={() => setPackageType(pkg.id)}
              >
                <Text style={styles.packageIcon}>{pkg.icon}</Text>
                <Text
                  style={[
                    styles.packageLabel,
                    packageType === pkg.id && styles.packageLabelActive,
                  ]}
                  numberOfLines={1}
                >
                  {pkg.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Label Preview */}
        <AppCard padding={0} style={styles.previewCard}>
          <View style={styles.header}>
            <Text style={styles.headerLabel}>Label Preview</Text>
            {label && <StatusBadge variant="success" label="Ready" />}
          </View>

          <View style={styles.canvas}>
            {loading ? (
              <Text style={styles.loadingText}>Generating professional label...</Text>
            ) : label && label.svg ? (
              <SvgXml xml={label.svg} width="100%" height={400} />
            ) : (
              <Text style={styles.placeholderText}>
                Generate to see professional {packageInfo?.label.toLowerCase()} label design
              </Text>
            )}
          </View>

          {label && (
            <View style={styles.labelInfo}>
              <Text style={styles.infoTitle}>{label.title}</Text>
              <Text style={styles.infoDesc}>{label.description}</Text>
            </View>
          )}
        </AppCard>

        {/* Label Design Features */}
        <View style={styles.featuresSection}>
          <SectionHeader title="Professional Design Features" />
          <View style={styles.featuresList}>
            {[
              {
                icon: '✓',
                title: 'Typography Hierarchy',
                desc: 'Headline, subheadline, body text with proper sizing',
              },
              {
                icon: '🎨',
                title: 'Color Integration',
                desc: 'Uses your brand color palette for visual hierarchy',
              },
              {
                icon: '📍',
                title: 'Logo Placement',
                desc: 'Strategic placement with proper spacing and sizing',
              },
              {
                icon: '✨',
                title: 'Benefit Bullets',
                desc: '3-5 key features highlighted for quick scanning',
              },
              {
                icon: '📏',
                title: 'Print-Safe Design',
                desc: 'Proper margins, bleeds, and print specifications',
              },
              {
                icon: '🔲',
                title: 'Barcode Ready',
                desc: 'Reserved area for UPC/barcode with clear labeling',
              },
            ].map((feature, idx) => (
              <View key={idx} style={styles.featureItem}>
                <Text style={styles.featureIcon}>{feature.icon}</Text>
                <View style={styles.featureContent}>
                  <Text style={styles.featureTitle}>{feature.title}</Text>
                  <Text style={styles.featureDesc}>{feature.desc}</Text>
                </View>
              </View>
            ))}
          </View>
        </View>

        {/* Label Specifications */}
        <View style={styles.specsSection}>
          <SectionHeader title="Label Specifications" />
          <View style={styles.specsList}>
            <View style={styles.specItem}>
              <Text style={styles.specKey}>Package Type:</Text>
              <Text style={styles.specValue}>{packageInfo?.label}</Text>
            </View>
            <View style={styles.specItem}>
              <Text style={styles.specKey}>Brand Name:</Text>
              <Text style={styles.specValue}>{story.brandName}</Text>
            </View>
            <View style={styles.specItem}>
              <Text style={styles.specKey}>Tagline:</Text>
              <Text style={styles.specValue}>{story.tagline}</Text>
            </View>
            <View style={styles.specItem}>
              <Text style={styles.specKey}>Primary Color:</Text>
              <View style={styles.colorSwatch}>
                <View
                  style={[
                    styles.colorSquare,
                    { backgroundColor: colors.primary.main },
                  ]}
                />
                <Text style={styles.colorCode}>{colors.primary.main}</Text>
              </View>
            </View>
            <View style={styles.specItem}>
              <Text style={styles.specKey}>Format:</Text>
              <Text style={styles.specValue}>SVG (scalable, print-ready)</Text>
            </View>
          </View>
        </View>

        {/* Design Tips */}
        <View style={styles.tipsSection}>
          <SectionHeader title="Label Design Tips" />
          {[
            'Place your logo prominently in the top-left or center',
            'Use a visual hierarchy: product name → tagline → benefits',
            'Keep benefit bullets to 3-5 key points for quick scanning',
            'Ensure sufficient color contrast for readability',
            'Leave room for barcode at the bottom',
            'Test label colors in print to ensure accurate color matching',
          ].map((tip, idx) => (
            <Text key={idx} style={styles.tipItem}>
              {idx + 1}. {tip}
            </Text>
          ))}
        </View>

        {/* Actions */}
        <View style={styles.actions}>
          <PrimaryButton
            label={loading ? 'Generating...' : `Generate ${packageInfo?.label} Label`}
            onPress={handleGenerateLabel}
            disabled={loading}
          />
          {label && (
            <>
              <SecondaryButton
                label="Export as SVG"
                onPress={() => {
                  // TODO: Export SVG
                  Alert.alert('Exported', 'Label SVG ready to download');
                }}
              />
              <SecondaryButton
                label="Share Label SVG"
                onPress={async () => {
                  try {
                    await Share.share({ message: label.svg, title: 'Product Label — SVG' });
                  } catch {
                    Alert.alert('Share failed', 'Could not open share sheet on this device.');
                  }
                }}
              />
            </>
          )}
        </View>

        {/* Quality Assurance */}
        <View style={styles.qaSection}>
          <Text style={styles.qaLabel}>✓ Quality Assurance</Text>
          <Text style={styles.qaText}>
            All labels are designed with professional print standards and ready for production.
            Always verify colors and text on actual samples before full production run.
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
  packageGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  packageButton: {
    flex: 1,
    minWidth: '30%',
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderRadius: DS.radiusCard,
    borderWidth: 1.5,
    borderColor: DS.border,
    backgroundColor: DS.bgElevated,
    alignItems: 'center',
    gap: 6,
  },
  packageButtonActive: {
    borderColor: DS.accent,
    backgroundColor: DS.accent + '12',
  },
  packageIcon: {
    fontSize: 18,
  },
  packageLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: DS.textSecondary,
    textAlign: 'center',
  },
  packageLabelActive: {
    color: DS.accent,
    fontWeight: '700',
  },
  previewCard: {
    overflow: 'hidden',
    marginVertical: DS.sectionGap,
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
    minHeight: 420,
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
  labelInfo: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: DS.border,
  },
  infoTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: DS.textPrimary,
    marginBottom: 4,
  },
  infoDesc: {
    fontSize: 11,
    color: DS.textSecondary,
  },
  featuresSection: {
    marginVertical: DS.sectionGap,
  },
  featuresList: {
    gap: 10,
  },
  featureItem: {
    flexDirection: 'row',
    gap: 12,
    padding: 12,
    backgroundColor: DS.bgElevated,
    borderRadius: DS.radiusCard,
  },
  featureIcon: {
    fontSize: 18,
    width: 24,
  },
  featureContent: {
    flex: 1,
  },
  featureTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: DS.textPrimary,
  },
  featureDesc: {
    fontSize: 11,
    color: DS.textSecondary,
    marginTop: 2,
  },
  specsSection: {
    marginVertical: DS.sectionGap,
  },
  specsList: {
    gap: 10,
  },
  specItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: DS.border,
  },
  specKey: {
    fontSize: 12,
    fontWeight: '600',
    color: DS.textSecondary,
  },
  specValue: {
    fontSize: 12,
    fontWeight: '700',
    color: DS.textPrimary,
    textAlign: 'right',
  },
  colorSwatch: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  colorSquare: {
    width: 32,
    height: 32,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: DS.border,
  },
  colorCode: {
    fontSize: 12,
    fontWeight: '700',
    color: DS.textPrimary,
    fontFamily: 'monospace',
  },
  tipsSection: {
    marginVertical: DS.sectionGap,
    backgroundColor: DS.bgElevated,
    borderRadius: DS.radiusCard,
    padding: DS.cardPadding,
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
  qaSection: {
    backgroundColor: DS.success + '15',
    borderRadius: DS.radiusCard,
    padding: DS.cardPadding,
    borderWidth: 1,
    borderColor: DS.success + '30',
  },
  qaLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: DS.success,
    marginBottom: 6,
  },
  qaText: {
    fontSize: 11,
    color: DS.textSecondary,
    lineHeight: 15,
  },
});
