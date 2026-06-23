/**
 * BrandStoryCard Component
 * Phase 1: Brand story input + elevator pitch generation
 */

import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, Text, TouchableOpacity } from 'react-native';
import { DS } from '../theme/ds';
import { AppCard } from './ds/AppCard';
import { SectionHeader } from './ds/SectionHeader';
import { InputField } from './ds/InputField';
import { PrimaryButton, SecondaryButton } from './ds/Buttons';
import { StatusBadge } from './ds/StatusBadge';
import { useBrandingSystem } from '../hooks/useBrandingSystem';
import type { BrandStory, CustomerPersona } from '../types/branding';

interface BrandStoryCardProps {
  onStoryCreated?: (story: BrandStory) => void;
}

export function BrandStoryCard({ onStoryCreated }: BrandStoryCardProps) {
  const { createBrandStory, loading, error } = useBrandingSystem();

  const [brandName, setBrandName] = useState('');
  const [origin, setOrigin] = useState('');
  const [mission, setMission] = useState('');
  const [uniqueValue, setUniqueValue] = useState('');
  const [brandPromise, setBrandPromise] = useState('');

  const [persona, setPersona] = useState<CustomerPersona>({
    name: '',
    age: '',
    location: '',
    occupation: '',
    painPoints: [],
    goals: [],
    values: [],
  });

  const [story, setStory] = useState<BrandStory | null>(null);

  const handleCreateStory = async () => {
    try {
      const newStory = await createBrandStory({
        brandName,
        origin,
        mission,
        uniqueValue,
        brandPromise,
        customerPersona: persona,
      });
      setStory(newStory);
      onStoryCreated?.(newStory);
    } catch (err) {
      console.error('Failed to create brand story:', err);
    }
  };

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      <AppCard>
        <SectionHeader title="Brand Story" subtitle="Define your brand narrative and customer" />

        {error && (
          <View style={styles.errorBanner}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        {/* Brand Name */}
        <InputField
          label="Brand / Product Name"
          value={brandName}
          onChangeText={setBrandName}
          placeholder="e.g. Premium Yoga Mat Co"
          leadingIcon="✦"
        />

        {/* Origin */}
        <InputField
          label="Origin Story"
          value={origin}
          onChangeText={setOrigin}
          placeholder="Started because..."
          multiline
          numberOfLines={3}
          leadingIcon="📖"
        />

        {/* Mission */}
        <InputField
          label="Mission Statement"
          value={mission}
          onChangeText={setMission}
          placeholder="Our mission is to..."
          multiline
          numberOfLines={3}
          leadingIcon="🎯"
        />

        {/* Unique Value */}
        <InputField
          label="Unique Value Proposition"
          value={uniqueValue}
          onChangeText={setUniqueValue}
          placeholder="Unlike competitors, we..."
          multiline
          numberOfLines={3}
          leadingIcon="💎"
        />

        {/* Brand Promise */}
        <InputField
          label="Brand Promise"
          value={brandPromise}
          onChangeText={setBrandPromise}
          placeholder="We guarantee..."
          multiline
          numberOfLines={3}
          leadingIcon="🤝"
        />

        {/* Customer Persona */}
        <View style={styles.section}>
          <SectionHeader title="Target Customer Persona" size="sm" />

          <InputField
            label="Persona Name"
            value={persona.name}
            onChangeText={name => setPersona({ ...persona, name })}
            placeholder="e.g. Sarah, the busy professional"
          />

          <InputField
            label="Age Range"
            value={persona.age}
            onChangeText={age => setPersona({ ...persona, age })}
            placeholder="e.g. 25-45"
          />

          <InputField
            label="Occupation"
            value={persona.occupation || ''}
            onChangeText={occupation => setPersona({ ...persona, occupation })}
            placeholder="e.g. Marketing Manager"
          />

          <InputField
            label="Pain Points (comma-separated)"
            value={persona.painPoints.join(', ')}
            onChangeText={text =>
              setPersona({
                ...persona,
                painPoints: text.split(',').map(p => p.trim()),
              })
            }
            placeholder="e.g. Back pain, busy schedule, want eco-friendly"
            multiline
            numberOfLines={2}
          />

          <InputField
            label="Goals (comma-separated)"
            value={persona.goals.join(', ')}
            onChangeText={text =>
              setPersona({
                ...persona,
                goals: text.split(',').map(g => g.trim()),
              })
            }
            placeholder="e.g. Improve flexibility, reduce stress"
            multiline
            numberOfLines={2}
          />
        </View>

        {/* Preview */}
        {story && (
          <View style={styles.previewSection}>
            <SectionHeader title="Generated Story Elements" size="sm" />

            <View style={styles.previewCard}>
              <Text style={styles.previewLabel}>30-Second Elevator Pitch:</Text>
              <Text style={styles.previewText}>{story.elevatorPitch}</Text>
            </View>

            <View style={styles.previewCard}>
              <Text style={styles.previewLabel}>Positioning Statement:</Text>
              <Text style={styles.previewText}>{story.positioningStatement}</Text>
            </View>

            <StatusBadge status="success" label="✓ Brand Story Ready" />
          </View>
        )}

        {/* Actions */}
        <View style={styles.actions}>
          <PrimaryButton
            label={loading ? 'Generating...' : 'Generate Story'}
            onPress={handleCreateStory}
            disabled={!brandName || !mission || loading}
          />
          <SecondaryButton
            label="Save for Later"
            onPress={() => {
              /* TODO: Save to vault */
            }}
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
    marginTop: DS.sectionGap,
    paddingTop: DS.sectionGap,
    borderTopWidth: 1,
    borderTopColor: DS.border,
  },
  previewSection: {
    marginTop: DS.sectionGap,
    paddingTop: DS.sectionGap,
    borderTopWidth: 1,
    borderTopColor: DS.border,
  },
  previewCard: {
    backgroundColor: DS.bgElevated,
    borderRadius: DS.radiusCard,
    padding: DS.cardPadding,
    marginVertical: DS.cardGap,
  },
  previewLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: DS.textPrimary,
    marginBottom: 8,
  },
  previewText: {
    fontSize: 13,
    color: DS.textSecondary,
    lineHeight: 18,
  },
  actions: {
    gap: DS.cardGap,
    marginTop: DS.sectionGap,
  },
});
