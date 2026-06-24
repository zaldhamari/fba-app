/**
 * SupplierComparisonTool Component
 * Side-by-side comparison of 2-3 suppliers with auto-scoring
 * Ready to use: integrated with useSupplierManagement hook
 */

import React, { useEffect, useState } from 'react';
import { View, StyleSheet, ScrollView, Text } from 'react-native';
import { DS } from '../theme/ds';
import { AppCard } from './ds/AppCard';
import { SectionHeader } from './ds/SectionHeader';
import { PrimaryButton, SecondaryButton } from './ds/Buttons';
import { StatusBadge } from './ds/StatusBadge';
import { useSupplierManagement } from '../hooks/useSupplierManagement';
import type { SupplierProfile } from '../types/supplier';

interface SupplierComparisonToolProps {
  productName: string;
  supplierIds: string[];
  onSelectWinner?: (supplierId: string) => void;
}

interface SupplierMetrics {
  id: string;
  name: string;
  price: number;
  moq: number;
  leadTime: number;
  qualityRating: number;
  trustScore: number;
  reliabilityScore: number;
  score: number;
}

export function SupplierComparisonTool({
  productName,
  supplierIds,
  onSelectWinner,
}: SupplierComparisonToolProps) {
  const { getProfile } = useSupplierManagement();
  const [suppliers, setSuppliers] = useState<SupplierMetrics[]>([]);
  const [winner, setWinner] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadSuppliers = async () => {
      try {
        const profiles = await Promise.all(supplierIds.map(id => getProfile(id)));

        const metrics = profiles
          .filter((p): p is SupplierProfile => p !== null)
          .map(profile => ({
            id: profile.id,
            name: profile.name,
            price: profile.negotiatedTerms?.agreedPricePerUnit || 0,
            moq: profile.negotiatedTerms?.moq || 0,
            leadTime: profile.negotiatedTerms?.leadTimeDays || 0,
            qualityRating: profile.rating?.qualityRating || 0,
            trustScore: profile.rating?.overallRating || 0,
            reliabilityScore: profile.rating?.reliabilityRating || 0,
            score: calculateScore(profile),
          }));

        setSuppliers(metrics.sort((a, b) => b.score - a.score));
        if (metrics.length > 0) {
          setWinner(metrics[0].id);
        }
      } finally {
        setLoading(false);
      }
    };

    loadSuppliers();
  }, [supplierIds]);

  const calculateScore = (profile: SupplierProfile): number => {
    const terms = profile.negotiatedTerms;
    const rating = profile.rating;

    // Scoring: price (25%), MOQ (15%), lead time (15%), quality (20%), trust (15%), reliability (10%)
    let score = 0;

    if (terms?.agreedPricePerUnit) {
      // Lower price = higher score (max score at $1, min at $10)
      const priceScore = Math.max(0, 100 - (terms.agreedPricePerUnit / 10) * 100);
      score += priceScore * 0.25;
    }

    if (terms?.moq) {
      // Lower MOQ = higher score (max score at 100, min at 5000)
      const moqScore = Math.max(0, 100 - (terms.moq / 5000) * 100);
      score += moqScore * 0.15;
    }

    if (terms?.leadTimeDays) {
      // Shorter lead = higher score (max at 30 days, min at 120 days)
      const leadScore = Math.max(0, 100 - ((terms.leadTimeDays - 30) / 90) * 100);
      score += leadScore * 0.15;
    }

    if (rating?.qualityRating) {
      score += rating.qualityRating * 20 * 0.2; // 1-5 → 0-100
    }

    if (rating?.overallRating) {
      score += rating.overallRating * 20 * 0.15;
    }

    if (rating?.reliabilityRating) {
      score += rating.reliabilityRating * 20 * 0.1;
    }

    return Math.round(score);
  };

  if (loading) {
    return (
      <AppCard>
        <Text style={styles.loadingText}>Loading suppliers...</Text>
      </AppCard>
    );
  }

  if (suppliers.length === 0) {
    return (
      <AppCard>
        <Text style={styles.emptyText}>No suppliers to compare</Text>
      </AppCard>
    );
  }

  return (
    <ScrollView style={styles.container} horizontal showsHorizontalScrollIndicator={false}>
      <AppCard style={styles.card}>
        <SectionHeader
          title={`Compare Suppliers: ${productName}`}
          subtitle={`${suppliers.length} suppliers`}
        />

        {/* Comparison Table */}
        <View style={styles.table}>
          {/* Header */}
          <View style={styles.tableRow}>
            <Text style={[styles.tableCell, styles.headerCell, styles.nameCell]}>Supplier</Text>
            {suppliers.map(s => (
              <View key={s.id} style={styles.supplierColumn}>
                <Text
                  style={[
                    styles.tableCell,
                    styles.headerCell,
                    s.id === winner && styles.winnerColumn,
                  ]}
                  numberOfLines={2}
                >
                  {s.name}
                  {s.id === winner && '\n⭐'}
                </Text>
              </View>
            ))}
          </View>

          {/* Rows */}
          <ComparisonRow label="Price/Unit" metric="price" suppliers={suppliers} winner={winner} />
          <ComparisonRow label="MOQ" metric="moq" suppliers={suppliers} winner={winner} />
          <ComparisonRow
            label="Lead Time"
            metric="leadTime"
            suppliers={suppliers}
            winner={winner}
            suffix=" days"
          />
          <ComparisonRow
            label="Quality Rating"
            metric="qualityRating"
            suppliers={suppliers}
            winner={winner}
            suffix=" / 5"
          />
          <ComparisonRow
            label="Trust Score"
            metric="trustScore"
            suppliers={suppliers}
            winner={winner}
            suffix=" / 5"
          />
          <ComparisonRow
            label="Reliability"
            metric="reliabilityScore"
            suppliers={suppliers}
            winner={winner}
            suffix=" / 5"
          />

          {/* Score Row */}
          <View style={[styles.tableRow, styles.scoreRow]}>
            <Text style={[styles.tableCell, styles.scoreLabel]}>Overall Score</Text>
            {suppliers.map(s => (
              <View
                key={s.id}
                style={[
                  styles.supplierColumn,
                  s.id === winner && {
                    backgroundColor: DS.success,
                    borderRadius: DS.radiusCard,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.tableCell,
                    styles.scoreValue,
                    s.id === winner && styles.winnerScore,
                  ]}
                >
                  {s.score}/100
                </Text>
              </View>
            ))}
          </View>
        </View>

        {/* Recommendation */}
        <View style={styles.recommendation}>
          <StatusBadge variant="info" label="🏆 Top Choice" />
          <Text style={styles.recommendationText}>
            {suppliers[0].name} is the best option based on price, quality, and reliability
          </Text>
        </View>

        {/* Actions */}
        <View style={styles.actions}>
          <PrimaryButton
            label={`Choose ${suppliers[0].name}`}
            onPress={() => onSelectWinner?.(suppliers[0].id)}
          />
          <SecondaryButton label="Add Another Supplier" onPress={() => onSelectWinner?.('')} />
        </View>
      </AppCard>
    </ScrollView>
  );
}

interface ComparisonRowProps {
  label: string;
  metric: keyof SupplierMetrics;
  suppliers: SupplierMetrics[];
  winner: string | null;
  suffix?: string;
}

function ComparisonRow({
  label,
  metric,
  suppliers,
  winner,
  suffix = '',
}: ComparisonRowProps) {
  // Determine best value (for some metrics lower is better)
  const lowerIsBetter = ['price', 'moq', 'leadTime'].includes(metric);
  let bestSupplier = suppliers[0];

  for (const s of suppliers) {
    const currentVal = s[metric] as number;
    const bestVal = bestSupplier[metric] as number;
    if (lowerIsBetter) {
      if (currentVal < bestVal && currentVal > 0) bestSupplier = s;
    } else {
      if (currentVal > bestVal) bestSupplier = s;
    }
  }

  return (
    <View style={styles.tableRow}>
      <Text style={[styles.tableCell, styles.label]}>{label}</Text>
      {suppliers.map(s => {
        const isBest = s.id === bestSupplier.id;
        const value = s[metric];
        return (
          <View
            key={s.id}
            style={[
              styles.supplierColumn,
              isBest && {
                backgroundColor: DS.bgElevated,
                borderLeftWidth: 3,
                borderLeftColor: DS.accent,
              },
            ]}
          >
            <Text style={[styles.tableCell, styles.value]}>
              {metric === 'price' && '$'}
              {value}
              {suffix}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: DS.bgCanvas,
  },
  card: {
    marginRight: DS.pagePadding,
  },
  loadingText: {
    fontSize: 14,
    color: DS.textSecondary,
    textAlign: 'center',
    paddingVertical: DS.cardPadding,
  },
  emptyText: {
    fontSize: 14,
    color: DS.textMuted,
    textAlign: 'center',
    paddingVertical: DS.cardPadding,
  },
  table: {
    marginVertical: DS.sectionGap,
    borderWidth: 1,
    borderColor: DS.border,
    borderRadius: DS.radiusCard,
    overflow: 'hidden',
  },
  tableRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: DS.border,
  },
  tableCell: {
    fontSize: 12,
    padding: 10,
    color: DS.textPrimary,
  },
  headerCell: {
    fontWeight: '600',
    backgroundColor: DS.bgElevated,
    color: DS.textPrimary,
  },
  nameCell: {
    minWidth: 100,
    fontWeight: '600',
  },
  supplierColumn: {
    flex: 1,
    minWidth: 100,
  },
  label: {
    fontWeight: '500',
    color: DS.textSecondary,
  },
  value: {
    fontWeight: '600',
  },
  winnerColumn: {
    backgroundColor: DS.success,
    color: 'white',
  },
  scoreRow: {
    backgroundColor: DS.bgElevated,
  },
  scoreLabel: {
    fontWeight: '700',
    fontSize: 13,
    color: DS.textPrimary,
  },
  scoreValue: {
    fontWeight: '700',
    fontSize: 13,
  },
  winnerScore: {
    color: 'white',
  },
  recommendation: {
    backgroundColor: DS.bgElevated,
    padding: DS.cardPadding,
    borderRadius: DS.radiusCard,
    marginVertical: DS.sectionGap,
  },
  recommendationText: {
    fontSize: 12,
    color: DS.textSecondary,
    marginTop: 8,
    lineHeight: 18,
  },
  actions: {
    gap: DS.cardGap,
  },
});
