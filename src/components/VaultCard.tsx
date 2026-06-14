import React, { useState } from 'react';
import { DS } from '../theme/ds';
import {
  View, Text, StyleSheet, TouchableOpacity, TextInput,
} from 'react-native';
import { Image } from 'expo-image';
import { colors, spacing, radius, shadow } from '../theme';
import { VaultEntry, VaultStatus, VAULT_STATUSES, STATUS_CONFIG } from '../types/vault';

function compColor(c: string) {
  return c === 'Low' ? colors.green : c === 'High' ? colors.red : colors.amber;
}

interface Props {
  entry: VaultEntry;
  onRemove: () => void;
  onStatusChange: (s: VaultStatus) => void;
  onNoteChange: (note: string) => void;
  onShare: () => void;
}

function VaultCard({ entry, onRemove, onStatusChange, onNoteChange, onShare }: Props) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const [editingNote, setEditingNote] = useState(false);
  const [noteText, setNoteText] = useState(entry.note);

  // Sync note text if external update comes in
  React.useEffect(() => { setNoteText(entry.note); }, [entry.note]);

  const statusCfg   = STATUS_CONFIG[entry.status];
  const hasAnalysis = !!entry.analysis;
  const verdictColor = entry.analysis?.verdict === 'LAUNCH' ? colors.green
    : entry.analysis?.verdict === 'AVOID' ? colors.red : colors.amber;

  const savedDate = new Date(entry.savedAt).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric',
  });

  return (
    <View style={s.card}>
      {/* Verdict accent strip on left edge */}
      {hasAnalysis && (
        <View style={[s.accentStrip, { backgroundColor: verdictColor }]} />
      )}
      {/* ── Header: image + info + verdict stamp */}
      <View style={s.header}>
        <View style={s.infoRow}>
          {entry.product.image ? (
            <Image source={{ uri: entry.product.image }} style={s.thumb} contentFit="cover" transition={150} accessibilityRole="image" accessibilityLabel={`Product photo: ${entry.product.title}`} />
          ) : (
            <View style={[s.thumb, s.thumbFallback]}>
              <Text style={s.thumbIcon}>◎</Text>
            </View>
          )}
          <View style={s.titleBlock}>
            <Text style={s.title} numberOfLines={2}>{entry.product.title}</Text>
            <View style={s.metaRow}>
              {entry.product.price != null && (
                <Text style={s.meta}>${entry.product.price.toFixed(2)}</Text>
              )}
              <Text style={s.metaDot}>·</Text>
              <Text style={s.meta}>{entry.marketplace}</Text>
              <Text style={s.metaDot}>·</Text>
              <Text style={[s.meta, { color: compColor(entry.product.competition) }]}>
                {entry.product.competition}
              </Text>
            </View>
          </View>
        </View>

        {hasAnalysis && (
          <View style={[s.verdictStamp, { borderColor: verdictColor }]}>
            <Text style={[s.verdictText, { color: verdictColor }]}>
              {entry.analysis!.verdict}
            </Text>
            <Text style={[s.verdictConf, { color: verdictColor }]}>
              {entry.analysis!.confidence}%
            </Text>
          </View>
        )}
      </View>

      <View style={s.divider} />

      {/* ── Status row */}
      <View style={s.statusRow}>
        <TouchableOpacity
          style={[s.statusPill, { borderColor: statusCfg.color }]}
          onPress={() => setPickerOpen(v => !v)}
          activeOpacity={0.8}
        >
          <View style={[s.statusDot, { backgroundColor: statusCfg.color }]} />
          <Text style={[s.statusLabel, { color: statusCfg.color }]}>{statusCfg.label}</Text>
          <Text style={[s.statusCaret, { color: statusCfg.color }]}>▾</Text>
        </TouchableOpacity>
        <Text style={s.savedDate}>{savedDate}</Text>
      </View>

      {/* ── Status picker dropdown */}
      {pickerOpen && (
        <View style={s.picker}>
          {VAULT_STATUSES.map(vs => {
            const cfg = STATUS_CONFIG[vs];
            const active = entry.status === vs;
            return (
              <TouchableOpacity
                key={vs}
                style={[s.pickerItem, active && s.pickerItemActive]}
                onPress={() => { onStatusChange(vs); setPickerOpen(false); }}
                activeOpacity={0.7}
              >
                <View style={[s.pickerDot, { backgroundColor: cfg.color }]} />
                <Text style={[s.pickerLabel, active && { color: cfg.color, fontWeight: '700' }]}>
                  {cfg.label}
                </Text>
                {active && <Text style={[s.pickerCheck, { color: cfg.color }]}>✓</Text>}
              </TouchableOpacity>
            );
          })}
        </View>
      )}

      {/* ── AI summary */}
      {entry.analysis?.summary ? (
        <Text style={s.summary} numberOfLines={2}>
          "{entry.analysis.summary}"
        </Text>
      ) : (
        <Text style={s.noAnalysis}>No AI analysis yet — analyze from search results to unlock insights.</Text>
      )}

      {/* ── Note field */}
      {editingNote ? (
        <TextInput
          style={s.noteInput}
          value={noteText}
          onChangeText={setNoteText}
          onBlur={() => { onNoteChange(noteText); setEditingNote(false); }}
          placeholder="Add a note about this opportunity…"
          placeholderTextColor={colors.textMuted}
          autoFocus
          multiline
          maxLength={200}
        />
      ) : (
        <TouchableOpacity
          style={s.noteTap}
          onPress={() => setEditingNote(true)}
          activeOpacity={0.7}
        >
          <Text style={[s.noteText, entry.note ? s.noteTextFilled : s.noteTextEmpty]}>
            {entry.note || '+ Add a note…'}
          </Text>
        </TouchableOpacity>
      )}

      <View style={s.divider} />

      {/* ── Actions */}
      <View style={s.actions}>
        <TouchableOpacity style={s.shareBtn} onPress={onShare} activeOpacity={0.8}>
          <Text style={s.shareBtnText}>↗ Share</Text>
        </TouchableOpacity>
        <TouchableOpacity style={s.removeBtn} onPress={onRemove} activeOpacity={0.7}>
          <Text style={s.removeBtnText}>✕ Remove</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  card: {
    backgroundColor: colors.bgCard,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
    ...shadow.card,
  },
  accentStrip: {
    position: 'absolute',
    left: 0, top: 0, bottom: 0,
    width: 3,
    zIndex: 1,
  },

  // ── Header
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: spacing.md,
    gap: spacing.sm,
  },
  infoRow: { flex: 1, flexDirection: 'row', gap: spacing.sm, alignItems: 'flex-start' },
  thumb: { width: 44, height: 44, borderRadius: radius.sm, backgroundColor: colors.bgElevated },
  thumbFallback: { alignItems: 'center', justifyContent: 'center' },
  thumbIcon: { fontSize: 20, color: colors.textMuted },
  titleBlock: { flex: 1 },
  title: { fontSize: 13, fontWeight: '700', color: colors.textPrimary, lineHeight: 18, marginBottom: 4 },
  metaRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 3 },
  meta: { fontSize: 11, color: colors.textSecondary, fontWeight: '600' },
  metaDot: { fontSize: 11, color: colors.textMuted },

  // ── Verdict stamp
  verdictStamp: {
    borderWidth: 2,
    borderRadius: radius.sm,
    paddingHorizontal: 7,
    paddingVertical: 5,
    alignItems: 'center',
    minWidth: 56,
  },
  verdictText: { fontSize: 10, fontWeight: '900', letterSpacing: 1.2 },
  verdictConf: { fontSize: 14, fontWeight: '900', letterSpacing: -0.5, marginTop: 1 },

  divider: { height: 1, backgroundColor: colors.border, marginHorizontal: spacing.md },

  // ── Status row
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderWidth: 1,
    borderRadius: radius.full,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  statusLabel: { fontSize: 10, fontWeight: '700', letterSpacing: 0.3 },
  statusCaret: { fontSize: 8, fontWeight: '700' },
  savedDate: { fontSize: 10, color: colors.textMuted, fontWeight: '500' },

  // ── Picker dropdown
  picker: {
    backgroundColor: colors.bgElevated,
    marginHorizontal: spacing.md,
    marginBottom: spacing.sm,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  pickerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  pickerItemActive: { backgroundColor: colors.bgCard },
  pickerDot: { width: 8, height: 8, borderRadius: 4 },
  pickerLabel: { flex: 1, fontSize: 13, color: colors.textSecondary },
  pickerCheck: { fontSize: 12, fontWeight: '800' },

  // ── Summary
  summary: {
    fontSize: 12,
    color: colors.textSecondary,
    lineHeight: 18,
    fontStyle: 'italic',
    letterSpacing: 0.1,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xs,
  },
  noAnalysis: {
    fontSize: 11,
    color: colors.textMuted,
    lineHeight: 16,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xs,
  },

  // ── Note
  noteTap: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.xs,
    paddingBottom: spacing.sm,
  },
  noteText: { fontSize: 12, lineHeight: 17 },
  noteTextEmpty: { color: colors.textMuted, fontStyle: 'italic' },
  noteTextFilled: { color: colors.textSecondary },
  noteInput: {
    marginHorizontal: spacing.md,
    marginVertical: spacing.xs,
    backgroundColor: colors.bgElevated,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: 'rgba(37,99,235,0.22)',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs + 2,
    fontSize: 12,
    color: colors.textPrimary,
    lineHeight: 17,
    minHeight: 52,
    textAlignVertical: 'top',
  },

  // ── Actions
  actions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  shareBtn: {
    backgroundColor: 'rgba(37,99,235,0.10)',
    borderRadius: radius.full,
    paddingHorizontal: spacing.md,
    paddingVertical: 5,
    borderWidth: 1,
    borderColor: 'rgba(37,99,235,0.22)',
  },
  shareBtnText: { fontSize: 11, fontWeight: '700', color: DS.accent },
  removeBtn: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 5,
  },
  removeBtnText: { fontSize: 11, fontWeight: '600', color: colors.textMuted },
});

// Memoized: vault rows skip re-render when unrelated entries or parent state change.
export default React.memo(VaultCard);
