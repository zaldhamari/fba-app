/**
 * SupplierVettingCard Component
 * Displays supplier vetting checklist with risk assessment
 * Ready to use: integrated with useSupplierManagement hook
 */

import React, { useEffect, useState } from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { DS } from '../theme/ds';
import { AppCard } from './ds/AppCard';
import { SectionHeader } from './ds/SectionHeader';
import { StatusBadge } from './ds/StatusBadge';
import { Checkbox } from './ds/Checkbox';
import { useSupplierManagement } from '../hooks/useSupplierManagement';
import type { SupplierVettingChecklist } from '../types/supplier';

interface SupplierVettingCardProps {
  supplierId: string;
  supplierName: string;
  productName: string;
}

export function SupplierVettingCard({
  supplierId,
  supplierName,
  productName,
}: SupplierVettingCardProps) {
  const { startVetting, getVetting, updateVetting, loading } = useSupplierManagement();
  const [vetting, setVetting] = useState<SupplierVettingChecklist | null>(null);

  useEffect(() => {
    const init = async () => {
      const existing = await getVetting(supplierId);
      if (existing) {
        setVetting(existing);
      } else {
        const newChecklist = await startVetting(supplierId, supplierName, productName);
        setVetting(newChecklist);
      }
    };
    init();
  }, [supplierId]);

  const handleCheck = async (field: keyof typeof vetting.checklist, value: boolean) => {
    if (!vetting) return;
    const updated = await updateVetting(supplierId, {
      ...vetting,
      checklist: {
        ...vetting.checklist,
        [field]: value,
      },
    });
    setVetting(updated);
  };

  if (!vetting) {
    return null;
  }

  const riskColors = {
    low: DS.success,
    medium: DS.warning,
    high: DS.danger,
    unknown: DS.textMuted,
  };

  return (
    <ScrollView style={styles.container}>
      <AppCard>
        <SectionHeader title={`Vet ${supplierName}`} subtitle={`For: ${productName}`} />

        {/* Risk Summary */}
        <View style={styles.riskSummary}>
          <StatusBadge
            status={vetting.overallRisk}
            label={`Risk Level: ${vetting.overallRisk}`}
            bg={riskColors[vetting.overallRisk]}
          />
          <StatusBadge
            status={vetting.vettingStatus}
            label={`Status: ${vetting.vettingStatus}`}
          />
        </View>

        {/* Checklist Items */}
        <View style={styles.checklistSection}>
          <SectionHeader title="Compliance Checklist" size="sm" />

          <CheckItem
            label="Business Registered"
            description="Company is officially registered"
            checked={vetting.checklist.businessRegistered}
            onChange={v => handleCheck('businessRegistered', v)}
          />

          <CheckItem
            label="License Provided"
            description="Business license on file"
            checked={vetting.checklist.licenseProvided}
            onChange={v => handleCheck('licenseProvided', v)}
          />

          <CheckItem
            label="Trade Assurance Enabled"
            description="Alibaba Trade Assurance protection"
            checked={vetting.checklist.tradeAssuranceEnabled}
            onChange={v => handleCheck('tradeAssuranceEnabled', v)}
          />

          <CheckItem
            label="Sample Requested"
            description="Sample sent for quality check"
            checked={vetting.checklist.sampleRequested}
            onChange={v => handleCheck('sampleRequested', v)}
          />

          <CheckItem
            label="Reference Customer Contact"
            description="Verified past customer reference"
            checked={vetting.checklist.referenceCustomerContact}
            onChange={v => handleCheck('referenceCustomerContact', v)}
          />

          <CheckItem
            label="Factory Visit Completed"
            description="Video tour or in-person visit"
            checked={vetting.checklist.factoryVisitCompleted}
            onChange={v => handleCheck('factoryVisitCompleted', v)}
          />

          <CheckItem
            label="NDA Signed"
            description="Non-disclosure agreement"
            checked={vetting.checklist.ndaSigned}
            onChange={v => handleCheck('ndaSigned', v)}
          />
        </View>

        {/* Years in Business */}
        <View style={styles.section}>
          <SectionHeader title="Years in Business" size="sm" />
          <View style={styles.yearsDisplay}>
            {vetting.checklist.yearsInBusiness ? (
              <>
                <View
                  style={[
                    styles.yearsBadge,
                    {
                      backgroundColor:
                        vetting.checklist.yearsInBusiness >= 5
                          ? DS.success
                          : vetting.checklist.yearsInBusiness >= 3
                            ? DS.warning
                            : DS.danger,
                    },
                  ]}
                >
                  <Text style={styles.yearsNumber}>{vetting.checklist.yearsInBusiness}</Text>
                </View>
                <Text style={styles.yearsLabel}>
                  {vetting.checklist.yearsInBusiness >= 5
                    ? 'Established'
                    : 'Relatively new'}
                </Text>
              </>
            ) : (
              <Text style={styles.muted}>Not recorded</Text>
            )}
          </View>
        </View>

        {/* Summary */}
        <View style={styles.summary}>
          <Text style={styles.summaryText}>
            {vetting.overallRisk === 'low'
              ? '✅ Supplier passed vetting - safe to proceed'
              : vetting.overallRisk === 'medium'
                ? '⚠️ Complete remaining checks before ordering'
                : '❌ High risk - resolve issues or find alternative'}
          </Text>
        </View>
      </AppCard>
    </ScrollView>
  );
}

function CheckItem({
  label,
  description,
  checked,
  onChange,
}: {
  label: string;
  description: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <View style={styles.checkItem}>
      <Checkbox checked={checked} onToggle={onChange} />
      <View style={styles.checkItemText}>
        <Text style={styles.checkLabel}>{label}</Text>
        <Text style={styles.checkDescription}>{description}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: DS.bgCanvas,
  },
  riskSummary: {
    flexDirection: 'row',
    gap: DS.cardGap,
    marginBottom: DS.sectionGap,
  },
  checklistSection: {
    marginBottom: DS.sectionGap,
  },
  section: {
    marginBottom: DS.sectionGap,
    backgroundColor: DS.bgElevated,
    padding: DS.cardPadding,
    borderRadius: DS.radiusCard,
  },
  checkItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: DS.border,
  },
  checkItemText: {
    flex: 1,
  },
  checkLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: DS.textPrimary,
    marginBottom: 4,
  },
  checkDescription: {
    fontSize: 12,
    color: DS.textSecondary,
  },
  yearsDisplay: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  yearsBadge: {
    width: 60,
    height: 60,
    borderRadius: DS.radiusBadge,
    justifyContent: 'center',
    alignItems: 'center',
  },
  yearsNumber: {
    fontSize: 24,
    fontWeight: '700',
    color: 'white',
  },
  yearsLabel: {
    fontSize: 14,
    color: DS.textSecondary,
  },
  muted: {
    fontSize: 14,
    color: DS.textMuted,
  },
  summary: {
    backgroundColor: DS.bgElevated,
    padding: DS.cardPadding,
    borderRadius: DS.radiusCard,
    marginTop: DS.sectionGap,
  },
  summaryText: {
    fontSize: 14,
    color: DS.textPrimary,
    fontWeight: '500',
    lineHeight: 20,
  },
});
