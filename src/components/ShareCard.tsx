import React from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Modal, Share,
} from 'react-native';
import { colors, spacing, radius } from '../theme';
import { VaultEntry, STATUS_CONFIG } from '../types/vault';

function compColor(c: string) {
  return c === 'Low' ? colors.green : c === 'High' ? colors.red : colors.amber;
}

interface Props {
  entry: VaultEntry;
  onClose: () => void;
}

export default function ShareCard({ entry, onClose }: Props) {
  const { analysis, product, status, marketplace, savedAt, note } = entry;
  const verdictColor = analysis?.verdict === 'LAUNCH' ? colors.green
    : analysis?.verdict === 'AVOID' ? colors.red : colors.amber;
  const statusCfg = STATUS_CONFIG[status];
  const fmtDate = new Date(savedAt).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  });

  async function handleShare() {
    const lines = [
      `FBA Opportunity: ${product.title}`,
      '',
      analysis
        ? `Verdict: ${analysis.verdict} — ${analysis.confidence}% confidence`
        : 'Not yet analyzed',
      analysis?.summary ? `"${analysis.summary}"` : '',
      '',
      `Price: $${product.price?.toFixed(2) ?? 'N/A'}`,
      `Competition: ${product.competition}`,
      `Marketplace: ${marketplace}`,
      `Status: ${statusCfg.label}`,
      note ? `Note: ${note}` : '',
      '',
      `Discovered with Siftly · ${fmtDate}`,
    ].filter(l => l !== undefined && (l !== '' || true));
    // Remove trailing empty lines
    const trimmed = lines.join('\n').trimEnd();
    await Share.share({ message: trimmed });
  }

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <View style={s.overlay}>
        <TouchableOpacity style={s.backdrop} onPress={onClose} activeOpacity={1} />

        {/* ── The shareable card (screenshot-optimized) */}
        <View style={s.card}>
          {/* Brand header */}
          <View style={s.brandRow}>
            <Text style={s.brandName}>SIFTLY</Text>
            <Text style={s.brandSub}>COMMERCE INTELLIGENCE</Text>
          </View>

          <View style={s.cardDivider} />

          {/* Verdict hero */}
          {analysis ? (
            <View style={s.verdictSection}>
              <View style={[s.verdictBadge, { borderColor: verdictColor }]}>
                <Text style={[s.verdictBig, { color: verdictColor }]}>{analysis.verdict}</Text>
              </View>
              <View style={s.confBlock}>
                <Text style={[s.confNum, { color: verdictColor }]}>{analysis.confidence}%</Text>
                <Text style={s.confLabel}>CONFIDENCE</Text>
              </View>
            </View>
          ) : (
            <View style={s.noAnalysisRow}>
              <Text style={s.noAnalysisText}>Awaiting analysis</Text>
            </View>
          )}

          {/* Product */}
          <Text style={s.productTitle} numberOfLines={2}>{product.title}</Text>

          {analysis?.summary ? (
            <Text style={s.summaryText}>"{analysis.summary}"</Text>
          ) : null}

          <View style={s.cardDivider} />

          {/* Stats grid */}
          <View style={s.statsRow}>
            <View style={s.stat}>
              <Text style={s.statNum}>${product.price?.toFixed(2) ?? '—'}</Text>
              <Text style={s.statLabel}>PRICE</Text>
            </View>
            <View style={s.statDivider} />
            <View style={s.stat}>
              <Text style={[s.statNum, { color: compColor(product.competition) }]}>
                {product.competition}
              </Text>
              <Text style={s.statLabel}>COMPETITION</Text>
            </View>
            <View style={s.statDivider} />
            <View style={s.stat}>
              <Text style={s.statNum}>{marketplace}</Text>
              <Text style={s.statLabel}>MARKET</Text>
            </View>
          </View>

          <View style={s.cardDivider} />

          {/* Status */}
          <View style={s.statusRow}>
            <View style={[s.statusDot, { backgroundColor: statusCfg.color }]} />
            <Text style={[s.statusLabel, { color: statusCfg.color }]}>{statusCfg.label}</Text>
          </View>

          {/* Footer */}
          <Text style={s.footer}>Discovered with Siftly · {fmtDate}</Text>
        </View>

        {/* ── Actions */}
        <TouchableOpacity style={s.shareBtn} onPress={handleShare} activeOpacity={0.85}>
          <Text style={s.shareBtnText}>↗  Share Opportunity</Text>
        </TouchableOpacity>
        <TouchableOpacity style={s.closeBtn} onPress={onClose} activeOpacity={0.7}>
          <Text style={s.closeBtnText}>Close</Text>
        </TouchableOpacity>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.72)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
  },
  backdrop: { ...StyleSheet.absoluteFillObject },

  // ── Card
  card: {
    width: '100%',
    backgroundColor: colors.bgCard,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
    zIndex: 1,
  },
  brandRow: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: spacing.sm,
  },
  brandName: {
    fontSize: 11,
    fontWeight: '900',
    color: colors.cyan,
    letterSpacing: 2.5,
  },
  brandSub: {
    fontSize: 8,
    fontWeight: '700',
    color: colors.textMuted,
    letterSpacing: 1.5,
  },
  cardDivider: { height: 1, backgroundColor: colors.border },

  // ── Verdict hero
  verdictSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  verdictBadge: {
    borderWidth: 2,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
  },
  verdictBig: {
    fontSize: 22,
    fontWeight: '900',
    letterSpacing: 2,
  },
  confBlock: { alignItems: 'flex-start' },
  confNum: { fontSize: 32, fontWeight: '900', letterSpacing: -1.5 },
  confLabel: { fontSize: 7, fontWeight: '800', color: colors.textMuted, letterSpacing: 2 },
  noAnalysisRow: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  noAnalysisText: { fontSize: 13, color: colors.textMuted, fontStyle: 'italic' },

  productTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.textPrimary,
    lineHeight: 21,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.sm,
  },
  summaryText: {
    fontSize: 12,
    color: colors.textSecondary,
    fontStyle: 'italic',
    lineHeight: 18,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.sm,
  },

  // ── Stats
  statsRow: {
    flexDirection: 'row',
    paddingVertical: spacing.md,
  },
  stat: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  statNum: { fontSize: 16, fontWeight: '800', color: colors.textPrimary, letterSpacing: -0.5 },
  statLabel: { fontSize: 7, fontWeight: '800', color: colors.textMuted, letterSpacing: 1.5, marginTop: 2 },
  statDivider: { width: 1, backgroundColor: colors.border },

  // ── Status row
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  statusDot: { width: 7, height: 7, borderRadius: 3.5 },
  statusLabel: { fontSize: 11, fontWeight: '700', letterSpacing: 0.3 },

  footer: {
    fontSize: 9,
    color: colors.textMuted,
    letterSpacing: 0.3,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
    paddingTop: 2,
  },

  // ── Bottom actions
  shareBtn: {
    backgroundColor: colors.cyan,
    borderRadius: radius.lg,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    marginTop: spacing.lg,
    zIndex: 1,
    alignSelf: 'stretch',
    alignItems: 'center',
  },
  shareBtnText: {
    fontSize: 15,
    fontWeight: '800',
    color: colors.bg,
    letterSpacing: 0.3,
  },
  closeBtn: {
    paddingVertical: spacing.md,
    alignSelf: 'center',
    zIndex: 1,
    marginTop: spacing.xs,
  },
  closeBtnText: { fontSize: 13, color: colors.textMuted },
});
