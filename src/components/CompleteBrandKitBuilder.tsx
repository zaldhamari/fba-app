/**
 * CompleteBrandKitBuilder Component
 * Master orchestrator for all 4 phases of branding
 * Phase 1: Story + Colors
 * Phase 2: Typography + Guidelines PDF
 * Phase 3: Design Exports + Packaging Mockups
 * Phase 4: Compliance + Amazon Preview + Rollout
 */

import React, { useState } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  Text,
  TouchableOpacity,
  SafeAreaView,
} from 'react-native';
import { DS } from '../theme/ds';
import { AppCard } from './ds/AppCard';
import { SectionHeader } from './ds/SectionHeader';
import { PrimaryButton, SecondaryButton } from './ds/Buttons';
import { StatusBadge } from './ds/StatusBadge';
import { BrandStoryCard } from './BrandStoryCard';
import { ColorSystemBuilder } from './ColorSystemBuilder';
import { BrandGuidelinesExporter } from './BrandGuidelinesExporter';
import { AdvancedLogoGenerator } from './AdvancedLogoGenerator';
import { AdvancedLabelGenerator } from './AdvancedLabelGenerator';
import { TypographySystemBuilder } from './TypographySystemBuilder';
import {
  DesignExportManager,
  ComplianceDashboard,
  AmazonListingPreview,
  BrandRolloutPlan,
} from './Phase3Phase4Bundle';
import { useBrandingSystem } from '../hooks/useBrandingSystem';
import type { CompleteBrandKit, BrandStory, ColorPalette, TypographyScale, LogoVariation, LabelDesign } from '../types/branding';

interface Phase {
  id: number;
  name: string;
  description: string;
  icon: string;
  components: string[];
  completed: boolean;
}

export function CompleteBrandKitBuilder() {
  const { kit, saveCompleteBrandKit, loadCompleteBrandKit, loading, error } =
    useBrandingSystem();

  const [currentPhase, setCurrentPhase] = useState(1);
  const [brandKit, setBrandKit] = useState<Partial<CompleteBrandKit>>({
    status: 'draft',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });
  const [generatedLogos, setGeneratedLogos] = useState<LogoVariation[] | null>(null);
  const [generatedLabel, setGeneratedLabel] = useState<LabelDesign | null>(null);
  const [typography, setTypography] = useState<TypographyScale | null>(null);
  const [packageType, setPackageType] = useState('standard');
  const [phase4Tab, setPhase4Tab] = useState<'exports' | 'compliance' | 'amazon' | 'rollout'>('exports');

  const phases: Phase[] = [
    {
      id: 1,
      name: 'Brand Story & Colors',
      description: 'Define your brand narrative and color system',
      icon: '📖',
      components: ['Story Input', 'Elevator Pitch', 'Color Palette', 'Contrast Check'],
      completed: !!brandKit.story && !!brandKit.colors,
    },
    {
      id: 2,
      name: 'Typography & Guidelines',
      description: 'Build typography system and generate brand guide PDF',
      icon: '🔤',
      components: ['Font Pairing', 'Type Scale', 'Guidelines PDF', 'Usage Rules'],
      completed: !!typography,
    },
    {
      id: 3,
      name: 'Logo, Label & Exports',
      description: 'Generate logos, product labels, and export all assets',
      icon: '🎨',
      components: ['5 Logo Variations', 'Product Label', 'PNG/PDF Export', 'Social Assets'],
      completed: !!generatedLogos && !!generatedLabel,
    },
    {
      id: 4,
      name: 'Launch & Compliance',
      description: 'Compliance checks, Amazon preview, and launch plan',
      icon: '🚀',
      components: ['Trademark Check', 'Domain/Social', 'Amazon Preview', 'Launch Plan'],
      completed: !!brandKit.compliance && !!brandKit.amazonPreview,
    },
  ];

  const handleStoryCreated = (story: BrandStory) => {
    setBrandKit(prev => ({ ...prev, story }));
  };

  const handlePaletteGenerated = (palette: ColorPalette) => {
    setBrandKit(prev => ({ ...prev, colors: palette }));
  };

  const handleTypographyGenerated = (scale: TypographyScale) => {
    setTypography(scale);
    setBrandKit(prev => ({ ...prev, typography: scale }));
  };

  const handleLogosGenerated = (logos: LogoVariation[]) => {
    setGeneratedLogos(logos);
  };

  const handleLabelGenerated = (label: LabelDesign) => {
    setGeneratedLabel(label);
  };

  const primaryLogoSvg = generatedLogos?.find(l => l.type === 'badge')?.svg
    ?? generatedLogos?.[0]?.svg
    ?? '';

  const handleSaveKit = async () => {
    if (brandKit.brandName) {
      const fullKit: CompleteBrandKit = {
        ...(brandKit as CompleteBrandKit),
        brandName: brandKit.brandName,
        status: 'draft',
        createdAt: brandKit.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      await saveCompleteBrandKit(fullKit);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <SectionHeader
            title="Complete Brand Kit Builder"
            subtitle="4 phases to launch-ready branding"
          />
        </View>

        {/* Progress Overview */}
        <AppCard style={styles.progressCard}>
          <Text style={styles.progressLabel}>Your Progress</Text>
          <View style={styles.phaseList}>
            {phases.map(phase => (
              <TouchableOpacity
                key={phase.id}
                style={[
                  styles.phaseItem,
                  currentPhase === phase.id && styles.phaseItemActive,
                ]}
                onPress={() => setCurrentPhase(phase.id)}
              >
                <View style={styles.phaseHeader}>
                  <Text style={styles.phaseIcon}>{phase.icon}</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.phaseName}>
                      {phase.id}. {phase.name}
                    </Text>
                    <Text style={styles.phaseDesc}>{phase.description}</Text>
                  </View>
                  {phase.completed ? (
                    <StatusBadge variant="success" label="✓" />
                  ) : (
                    <View style={styles.phaseNumber}>{phase.id}</View>
                  )}
                </View>
                {currentPhase === phase.id && (
                  <View style={styles.phaseComponents}>
                    {phase.components.map(comp => (
                      <Text key={comp} style={styles.component}>
                        • {comp}
                      </Text>
                    ))}
                  </View>
                )}
              </TouchableOpacity>
            ))}
          </View>
        </AppCard>

        {/* Phase Content */}
        <View style={styles.phaseContent}>
          {currentPhase === 1 && (
            <>
              <BrandStoryCard onStoryCreated={handleStoryCreated} />
              <View style={{ marginTop: DS.sectionGap }}>
                <ColorSystemBuilder onPaletteGenerated={handlePaletteGenerated} />
              </View>
            </>
          )}

          {currentPhase === 2 && (
            <>
              {brandKit.story && brandKit.colors ? (
                <TypographySystemBuilder
                  style={brandKit.story.personality ?? 'Premium'}
                  onSystemGenerated={handleTypographyGenerated}
                />
              ) : (
                <AppCard>
                  <Text style={styles.placeholderText}>
                    Complete Phase 1 (Story + Colors) first.
                  </Text>
                </AppCard>
              )}
              <View style={{ marginTop: DS.sectionGap }}>
                <BrandGuidelinesExporter kit={brandKit} />
              </View>
            </>
          )}

          {currentPhase === 3 && (
            <>
              {brandKit.story && brandKit.colors ? (
                <>
                  <AdvancedLogoGenerator
                    story={brandKit.story}
                    colors={brandKit.colors}
                    typography={typography ?? undefined}
                    onLogosGenerated={handleLogosGenerated}
                  />
                  {primaryLogoSvg ? (
                    <View style={{ marginTop: DS.sectionGap }}>
                      <AdvancedLabelGenerator
                        story={brandKit.story}
                        colors={brandKit.colors}
                        typography={typography ?? brandKit.typography!}
                        logoSvg={primaryLogoSvg}
                        packageType={packageType}
                        onLabelGenerated={handleLabelGenerated}
                      />
                    </View>
                  ) : (
                    <AppCard style={{ marginTop: DS.sectionGap }}>
                      <Text style={styles.placeholderText}>
                        Generate logos above first — label will use your badge logo.
                      </Text>
                    </AppCard>
                  )}
                  <View style={{ marginTop: DS.sectionGap }}>
                    <DesignExportManager kit={brandKit} />
                  </View>
                </>
              ) : (
                <AppCard>
                  <Text style={styles.placeholderText}>
                    Complete Phase 1 (Story + Colors) first.
                  </Text>
                </AppCard>
              )}
            </>
          )}

          {currentPhase === 4 && (
            <>
              {/* Sub-tab bar */}
              <View style={styles.phase4Tabs}>
                {(['exports', 'compliance', 'amazon', 'rollout'] as const).map(tab => (
                  <TouchableOpacity
                    key={tab}
                    style={[styles.phase4Tab, phase4Tab === tab && styles.phase4TabActive]}
                    onPress={() => setPhase4Tab(tab)}
                  >
                    <Text style={[styles.phase4TabText, phase4Tab === tab && styles.phase4TabTextActive]}>
                      {tab === 'exports' ? 'Exports' : tab === 'compliance' ? 'Legal' : tab === 'amazon' ? 'Amazon' : 'Launch'}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
              {phase4Tab === 'exports' && <DesignExportManager kit={brandKit} />}
              {phase4Tab === 'compliance' && <ComplianceDashboard kit={brandKit} />}
              {phase4Tab === 'amazon' && <AmazonListingPreview kit={brandKit} />}
              {phase4Tab === 'rollout' && <BrandRolloutPlan kit={brandKit} />}
            </>
          )}
        </View>

        {/* Navigation Buttons */}
        <View style={styles.navigationButtons}>
          {currentPhase > 1 && (
            <SecondaryButton
              label="← Previous Phase"
              onPress={() => setCurrentPhase(currentPhase - 1)}
            />
          )}
          {currentPhase < phases.length && (
            <PrimaryButton
              label="Next Phase →"
              onPress={() => setCurrentPhase(currentPhase + 1)}
              disabled={!phases[currentPhase - 1]?.completed}
            />
          )}
        </View>

        {/* Actions */}
        <View style={styles.actions}>
          <PrimaryButton
            label="Save Brand Kit"
            onPress={handleSaveKit}
            disabled={loading}
          />
          <SecondaryButton
            label="Export Complete Kit (ZIP)"
            onPress={() => {
              /* TODO: Export all assets */
            }}
            disabled={!phases.every(p => p.completed)}
          />
        </View>

        {/* Status Summary */}
        {brandKit.story && (
          <AppCard style={styles.summaryCard}>
            <SectionHeader title="Kit Summary" />
            <View style={styles.summaryItem}>
              <Text style={styles.summaryLabel}>Brand Name:</Text>
              <Text style={styles.summaryValue}>{brandKit.story.brandName}</Text>
            </View>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryLabel}>Status:</Text>
              <StatusBadge variant="info" label={brandKit.status || 'Draft'} />
            </View>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryLabel}>Phases Completed:</Text>
              <Text style={styles.summaryValue}>
                {phases.filter(p => p.completed).length} of {phases.length}
              </Text>
            </View>
          </AppCard>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: DS.bgCanvas,
  },
  header: {
    paddingHorizontal: DS.pagePadding,
    paddingVertical: DS.sectionGap,
  },
  progressCard: {
    marginHorizontal: DS.pagePadding,
    marginVertical: DS.cardGap,
  },
  progressLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: DS.textPrimary,
    marginBottom: DS.cardGap,
  },
  phaseList: {
    gap: DS.cardGap,
  },
  phaseItem: {
    backgroundColor: DS.bgElevated,
    borderRadius: DS.radiusCard,
    borderWidth: 1.5,
    borderColor: DS.border,
    padding: 12,
  },
  phaseItemActive: {
    borderColor: DS.accent,
    backgroundColor: DS.accent + '08',
  },
  phaseHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  phaseIcon: {
    fontSize: 20,
  },
  phaseName: {
    fontSize: 13,
    fontWeight: '700',
    color: DS.textPrimary,
  },
  phaseDesc: {
    fontSize: 11,
    color: DS.textSecondary,
    marginTop: 2,
  },
  phaseNumber: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: DS.accent,
    justifyContent: 'center',
    alignItems: 'center',
  },
  phaseNumberText: {
    fontSize: 12,
    fontWeight: '700',
    color: 'white',
  },
  phaseComponents: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: DS.border,
    gap: 6,
  },
  component: {
    fontSize: 11,
    color: DS.textSecondary,
  },
  phaseContent: {
    paddingHorizontal: DS.pagePadding,
    paddingVertical: DS.sectionGap,
  },
  placeholderText: {
    fontSize: 13,
    color: DS.textSecondary,
    lineHeight: 20,
    marginVertical: 6,
  },
  navigationButtons: {
    flexDirection: 'row',
    gap: DS.cardGap,
    paddingHorizontal: DS.pagePadding,
    marginVertical: DS.sectionGap,
  },
  actions: {
    gap: DS.cardGap,
    paddingHorizontal: DS.pagePadding,
    marginVertical: DS.sectionGap,
  },
  summaryCard: {
    marginHorizontal: DS.pagePadding,
    marginBottom: DS.sectionGap,
  },
  summaryItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: DS.border,
  },
  summaryLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: DS.textSecondary,
  },
  summaryValue: {
    fontSize: 13,
    fontWeight: '700',
    color: DS.textPrimary,
  },
  phase4Tabs: {
    flexDirection: 'row',
    marginHorizontal: DS.pagePadding,
    marginBottom: DS.cardGap,
    gap: DS.cardGap,
  },
  phase4Tab: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: DS.radiusChip,
    backgroundColor: DS.bgElevated,
    alignItems: 'center',
  },
  phase4TabActive: {
    backgroundColor: DS.accent,
  },
  phase4TabText: {
    fontSize: 11,
    fontWeight: '600',
    color: DS.textSecondary,
  },
  phase4TabTextActive: {
    color: '#FFFFFF',
  },
});
