/**
 * BrandGuidelinesExporter Component
 * Phase 2: Generate + export brand guidelines PDF
 */

import React, { useState } from 'react';
import { View, StyleSheet, ScrollView, Text, Alert } from 'react-native';
import * as Sharing from 'expo-sharing';
import { DS } from '../theme/ds';
import { AppCard } from './ds/AppCard';
import { SectionHeader } from './ds/SectionHeader';
import { PrimaryButton, SecondaryButton } from './ds/Buttons';
import { StatusBadge } from './ds/StatusBadge';
import { useBrandingSystem } from '../hooks/useBrandingSystem';
import type { CompleteBrandKit } from '../types/branding';

interface BrandGuidelinesExporterProps {
  kit: Partial<CompleteBrandKit>;
  onExported?: (pdfBuffer: string) => void;
}

export function BrandGuidelinesExporter({ kit, onExported }: BrandGuidelinesExporterProps) {
  const { generateBrandGuidelines, loading, error } = useBrandingSystem();
  const [pdfGenerated, setPdfGenerated] = useState(false);
  const [pdfUri, setPdfUri] = useState<string | null>(null);
  const [sharing, setSharing] = useState(false);

  const handleGenerateGuide = async () => {
    try {
      // generateBrandGuidelines now returns a local file URI (not base64).
      // No Buffer.from() is used anywhere — FileSystem writes the file directly.
      const uri = await generateBrandGuidelines(kit);
      setPdfUri(uri);
      setPdfGenerated(true);
      onExported?.(uri);
      Alert.alert('✓ Success', 'Brand guidelines PDF generated! Tap Download to share.');
    } catch (err) {
      Alert.alert('Error', error || 'Failed to generate guidelines');
    }
  };

  const handleDownload = async () => {
    if (!pdfUri) return;
    try {
      setSharing(true);
      const canShare = await Sharing.isAvailableAsync();
      if (!canShare) {
        Alert.alert('Sharing unavailable', 'File sharing is not supported on this device.');
        return;
      }
      await Sharing.shareAsync(pdfUri, {
        mimeType: 'application/pdf',
        dialogTitle: 'Share Brand Guidelines PDF',
      });
    } catch (err: any) {
      Alert.alert('Share failed', err?.message || 'Could not share the PDF. Please try again.');
    } finally {
      setSharing(false);
    }
  };

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      <AppCard>
        <SectionHeader
          title="Brand Guidelines"
          subtitle="Professional PDF guide for your brand"
        />

        {error && (
          <View style={styles.errorBanner}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        {/* What's Included */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>What's Included</Text>
          <View style={styles.checkList}>
            {[
              '✓ Logo usage rules & clear space guide',
              '✓ Complete color palette with usage guide',
              '✓ Typography system & font pairing',
              '✓ Brand tone & voice guidelines',
              '✓ Do\'s and don\'ts checklist',
              '✓ Imagery guidelines & photography style',
              '✓ Applications & real-world examples',
            ].map((item, idx) => (
              <Text key={idx} style={styles.checkItem}>
                {item}
              </Text>
            ))}
          </View>
        </View>

        {/* Preview */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Preview</Text>
          <View style={styles.previewGrid}>
            {[
              { page: '1-2', title: 'Logo & Usage' },
              { page: '3-4', title: 'Color System' },
              { page: '5-6', title: 'Typography' },
              { page: '7-8', title: 'Tone & Voice' },
              { page: '9', title: 'Do\'s & Don\'ts' },
              { page: '10', title: 'Applications' },
            ].map(section => (
              <View key={section.page} style={styles.previewCard}>
                <Text style={styles.previewPage}>{section.page}</Text>
                <Text style={styles.previewTitle}>{section.title}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* Brand Info Check */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Brand Information Status</Text>
          <View style={styles.statusList}>
            <View style={styles.statusItem}>
              <StatusBadge
                variant={kit.story ? 'success' : 'neutral'}
                label={kit.story ? '✓ Story' : 'Story'}
              />
            </View>
            <View style={styles.statusItem}>
              <StatusBadge
                variant={kit.colors ? 'success' : 'neutral'}
                label={kit.colors ? '✓ Colors' : 'Colors'}
              />
            </View>
            <View style={styles.statusItem}>
              <StatusBadge
                variant={kit.typography ? 'success' : 'neutral'}
                label={kit.typography ? '✓ Typography' : 'Typography'}
              />
            </View>
            <View style={styles.statusItem}>
              <StatusBadge
                variant={kit.guidelines ? 'success' : 'neutral'}
                label={kit.guidelines ? '✓ Guidelines' : 'Guidelines'}
              />
            </View>
          </View>
        </View>

        {/* Features */}
        <View style={styles.featuresSection}>
          <View style={styles.feature}>
            <Text style={styles.featureIcon}>📄</Text>
            <View>
              <Text style={styles.featureTitle}>10-Page PDF</Text>
              <Text style={styles.featureDesc}>Professional format, easy to share</Text>
            </View>
          </View>

          <View style={styles.feature}>
            <Text style={styles.featureIcon}>🎨</Text>
            <View>
              <Text style={styles.featureTitle}>Brand Examples</Text>
              <Text style={styles.featureDesc}>Real-world applications on packaging</Text>
            </View>
          </View>

          <View style={styles.feature}>
            <Text style={styles.featureIcon}>📱</Text>
            <View>
              <Text style={styles.featureTitle}>Digital + Print</Text>
              <Text style={styles.featureDesc}>Guidelines for all channels</Text>
            </View>
          </View>

          <View style={styles.feature}>
            <Text style={styles.featureIcon}>✏️</Text>
            <View>
              <Text style={styles.featureTitle}>Customizable</Text>
              <Text style={styles.featureDesc}>Edit before sharing with team</Text>
            </View>
          </View>
        </View>

        {/* Actions */}
        <View style={styles.actions}>
          <PrimaryButton
            label={loading ? 'Generating PDF...' : 'Generate Guidelines PDF'}
            onPress={handleGenerateGuide}
            disabled={loading}
          />
          {pdfGenerated && (
            <SecondaryButton
              label={sharing ? 'Opening share sheet...' : 'Download / Share PDF'}
              onPress={handleDownload}
              disabled={sharing || !pdfUri}
            />
          )}
        </View>

        {pdfGenerated && (
          <View style={styles.successBanner}>
            <Text style={styles.successText}>
              ✓ PDF generated successfully! You can now download and share it with your team.
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
    marginVertical: DS.sectionGap,
    paddingVertical: DS.cardGap,
    borderBottomWidth: 1,
    borderBottomColor: DS.border,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: DS.textPrimary,
    marginBottom: 12,
  },
  checkList: {
    gap: 8,
  },
  checkItem: {
    fontSize: 13,
    color: DS.textSecondary,
    lineHeight: 18,
  },
  previewGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  previewCard: {
    flex: 1,
    minWidth: '31%',
    backgroundColor: DS.bgElevated,
    borderRadius: DS.radiusCard,
    padding: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: DS.border,
  },
  previewPage: {
    fontSize: 10,
    fontWeight: '700',
    color: DS.textMuted,
    marginBottom: 6,
  },
  previewTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: DS.textPrimary,
    textAlign: 'center',
  },
  statusList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  statusItem: {
    flex: 1,
    minWidth: '45%',
  },
  featuresSection: {
    gap: 12,
    marginVertical: DS.sectionGap,
  },
  feature: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    padding: 12,
    backgroundColor: DS.bgElevated,
    borderRadius: DS.radiusCard,
  },
  featureIcon: {
    fontSize: 24,
  },
  featureTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: DS.textPrimary,
  },
  featureDesc: {
    fontSize: 11,
    color: DS.textSecondary,
    marginTop: 2,
  },
  actions: {
    gap: DS.cardGap,
    marginTop: DS.sectionGap,
  },
  successBanner: {
    backgroundColor: DS.success + '20',
    borderRadius: DS.radiusCard,
    padding: DS.cardPadding,
    marginTop: DS.cardGap,
  },
  successText: {
    fontSize: 12,
    color: DS.success,
    fontWeight: '500',
  },
});
