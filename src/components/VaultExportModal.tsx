import React, { useState } from 'react';
import { DS } from '../theme/ds';
import {
  View, Text, StyleSheet, TouchableOpacity, Modal, Share, ActivityIndicator,
} from 'react-native';
import { colors, spacing, radius } from '../theme';
import { VaultEntry, STATUS_CONFIG } from '../types/vault';

interface Props {
  visible: boolean;
  entries: VaultEntry[];
  onClose: () => void;
}

function buildReport(entries: VaultEntry[]): string {
  const date = new Date().toLocaleDateString('en-US', {
    month: 'long', day: 'numeric', year: 'numeric',
  });
  const launches   = entries.filter(e => e.analysis?.verdict === 'LAUNCH').length;
  const tests      = entries.filter(e => e.analysis?.verdict === 'TEST').length;
  const avoids     = entries.filter(e => e.analysis?.verdict === 'AVOID').length;

  const lines: string[] = [
    '═══════════════════════════════',
    '  SIFTLY — OPPORTUNITY VAULT REPORT',
    `  ${date}`,
    '═══════════════════════════════',
    '',
    `  ${entries.length} products  ·  ${launches} LAUNCH  ·  ${tests} TEST  ·  ${avoids} AVOID`,
    '',
    '───────────────────────────────',
    '',
  ];

  entries.forEach((e, i) => {
    const verdict = e.analysis?.verdict ?? 'UNANALYZED';
    const conf    = e.analysis?.confidence != null ? ` (${e.analysis.confidence}%)` : '';
    const status  = STATUS_CONFIG[e.status].label;
    lines.push(`${i + 1}. ${e.product.title}`);
    lines.push(`   ${verdict}${conf}  ·  ${status}`);
    if (e.product.price != null) lines.push(`   $${e.product.price.toFixed(2)}  ·  ${e.product.competition} comp  ·  ${e.marketplace}`);
    if (e.analysis?.summary)    lines.push(`   "${e.analysis.summary}"`);
    if (e.analysis?.risk)       lines.push(`   Risk: ${e.analysis.risk}`);
    if (e.analysis?.next_step)  lines.push(`   Next: ${e.analysis.next_step}`);
    if (e.note)                 lines.push(`   Note: ${e.note}`);
    lines.push('');
  });

  lines.push('───────────────────────────────');
  lines.push('  SIFTLY · COMMERCE INTELLIGENCE');
  return lines.join('\n');
}

function buildCSV(entries: VaultEntry[]): string {
  const header = 'Title,ASIN,Verdict,Confidence,Status,Price,Competition,Marketplace,Currency,Saved Date,Note';
  const rows = entries.map(e => [
    `"${e.product.title.replace(/"/g, '""')}"`,
    e.asin,
    e.analysis?.verdict ?? '',
    e.analysis?.confidence ?? '',
    e.status,
    e.product.price ?? '',
    e.product.competition,
    e.marketplace,
    e.currency,
    e.savedAt.slice(0, 10),
    `"${(e.note ?? '').replace(/"/g, '""')}"`,
  ].join(','));
  return [header, ...rows].join('\n');
}

export default function VaultExportModal({ visible, entries, onClose }: Props) {
  const [csvLoading, setCsvLoading]       = useState(false);
  const [reportLoading, setReportLoading] = useState(false);
  const empty = entries.length === 0;

  async function handleCSV() {
    if (empty) return;
    setCsvLoading(true);
    try {
      await Share.share({
        message: buildCSV(entries),
        title: 'Siftly — Opportunity Vault.csv',
      });
    } finally {
      setCsvLoading(false);
    }
  }

  async function handleReport() {
    if (empty) return;
    setReportLoading(true);
    try {
      await Share.share({
        message: buildReport(entries),
        title: 'Siftly — Opportunity Vault Report',
      });
    } finally {
      setReportLoading(false);
    }
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={s.overlay}>
        <TouchableOpacity style={s.backdrop} onPress={onClose} activeOpacity={1} />
        <View style={s.sheet}>
          <View style={s.handle} />

          <Text style={s.title}>Export Vault</Text>
          <Text style={s.subtitle}>
            {empty
              ? 'Save some products first — then export.'
              : `${entries.length} product${entries.length !== 1 ? 's' : ''} ready to export`}
          </Text>

          {/* ── CSV option */}
          <TouchableOpacity
            style={[s.optionCard, empty && s.optionDisabled]}
            onPress={handleCSV}
            disabled={empty || csvLoading}
            activeOpacity={0.85}
          >
            <View style={s.optionIcon}>
              <Text style={s.optionIconText}>⊞</Text>
            </View>
            <View style={s.optionBody}>
              <Text style={[s.optionTitle, empty && s.dimText]}>Spreadsheet (CSV)</Text>
              <Text style={s.optionDesc}>Open in Excel, Google Sheets or Numbers</Text>
            </View>
            {csvLoading
              ? <ActivityIndicator color={DS.accent} size="small" />
              : <Text style={[s.arrow, empty && s.dimText]}>↗</Text>}
          </TouchableOpacity>

          {/* ── Report option */}
          <TouchableOpacity
            style={[s.optionCard, s.optionCardReport, empty && s.optionDisabled]}
            onPress={handleReport}
            disabled={empty || reportLoading}
            activeOpacity={0.85}
          >
            <View style={[s.optionIcon, s.optionIconReport]}>
              <Text style={s.optionIconText}>⊟</Text>
            </View>
            <View style={s.optionBody}>
              <Text style={[s.optionTitle, s.optionTitleReport, empty && s.dimText]}>Full Report (Text)</Text>
              <Text style={[s.optionDesc, s.optionDescReport]}>
                Verdicts, AI analysis &amp; notes — share to Notes, email, Slack
              </Text>
            </View>
            {reportLoading
              ? <ActivityIndicator color={colors.bg} size="small" />
              : <Text style={[s.arrow, s.arrowReport, empty && s.dimText]}>↗</Text>}
          </TouchableOpacity>

          <TouchableOpacity style={s.closeBtn} onPress={onClose} activeOpacity={0.7}>
            <Text style={s.closeBtnText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.5)' },
  backdrop: { ...StyleSheet.absoluteFillObject },
  sheet: {
    backgroundColor: colors.bgCard,
    borderTopLeftRadius: radius.xxl,
    borderTopRightRadius: radius.xxl,
    paddingHorizontal: spacing.lg,
    paddingBottom: 36,
    zIndex: 1,
    borderWidth: 1,
    borderBottomWidth: 0,
    borderColor: colors.border,
  },
  handle: {
    width: 36, height: 4, backgroundColor: colors.border,
    borderRadius: 2, alignSelf: 'center',
    marginTop: spacing.sm, marginBottom: spacing.md,
  },
  title:    { fontSize: 22, fontWeight: '900', color: colors.textPrimary, letterSpacing: -0.5, marginBottom: 4 },
  subtitle: { fontSize: 13, color: colors.textMuted, marginBottom: spacing.lg },

  optionCard: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.md,
    backgroundColor: colors.bgElevated,
    borderRadius: radius.lg, padding: spacing.md,
    marginBottom: spacing.sm,
    borderWidth: 1, borderColor: colors.border,
  },
  optionCardReport: { backgroundColor: DS.accent, borderColor: DS.accent },
  optionDisabled: { opacity: 0.4 },
  optionIcon: {
    width: 44, height: 44, borderRadius: radius.md,
    backgroundColor: colors.bgCard,
    alignItems: 'center', justifyContent: 'center',
  },
  optionIconReport: { backgroundColor: 'rgba(255,255,255,0.2)' },
  optionIconText: { fontSize: 22, color: DS.accent },
  optionBody:       { flex: 1 },
  optionTitle:      { fontSize: 15, fontWeight: '800', color: colors.textPrimary, marginBottom: 2 },
  optionTitleReport:{ color: colors.bg },
  optionDesc:       { fontSize: 12, color: colors.textMuted },
  optionDescReport: { color: 'rgba(255,255,255,0.7)' },
  arrow:            { fontSize: 20, color: colors.textMuted, fontWeight: '700' },
  arrowReport:      { color: 'rgba(255,255,255,0.7)' },
  dimText:          { color: colors.textMuted },

  closeBtn:     { alignItems: 'center', paddingVertical: spacing.md, marginTop: spacing.xs },
  closeBtnText: { fontSize: 15, color: colors.textMuted },
});
