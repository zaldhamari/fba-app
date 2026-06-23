/**
 * SupplierMessageForm Component
 * Hybrid communication logging: manual reply + auto-logged outbound
 * Allows users to log emails, calls, and notes with suppliers
 */

import React, { useState } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  Text,
  TouchableOpacity,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { DS } from '../theme/ds';
import { AppCard } from './ds/AppCard';
import { SectionHeader } from './ds/SectionHeader';
import { InputField } from './ds/InputField';
import { PrimaryButton, SecondaryButton } from './ds/Buttons';
import { StatusBadge } from './ds/StatusBadge';
import { useSupplierManagement } from '../hooks/useSupplierManagement';
import { shadow as Shadows } from '../theme/shadows';

interface SupplierMessageFormProps {
  supplierId: string;
  supplierName: string;
  onSuccess?: () => void;
  onClose: () => void;
  autoLogOutbound?: boolean; // Set when auto-logging sent email
}

type MessageType = 'email' | 'call' | 'note';
type MessageDirection = 'inbound' | 'outbound';

const MESSAGE_TYPES: { label: string; value: MessageType; icon: string }[] = [
  { label: 'Email', value: 'email', icon: '✉️' },
  { label: 'Phone Call', value: 'call', icon: '☎️' },
  { label: 'Note', value: 'note', icon: '📝' },
];

const MESSAGE_DIRECTIONS: { label: string; value: MessageDirection }[] = [
  { label: 'They Replied', value: 'inbound' },
  { label: 'I Sent/Called', value: 'outbound' },
];

const AVAILABLE_TAGS = [
  { label: 'Initial Inquiry', value: 'initial_inquiry', color: DS.accent },
  { label: 'Price Discussion', value: 'price_discussion', color: DS.warning },
  { label: 'Quote Received', value: 'quote_received', color: DS.success },
  { label: 'Negotiation', value: 'negotiation', color: DS.accent },
  { label: 'Sample Request', value: 'sample_request', color: DS.warning },
  { label: 'Terms Agreed', value: 'terms_agreed', color: DS.success },
  { label: 'Follow-up', value: 'followup', color: DS.warning },
  { label: 'Issues', value: 'issues', color: DS.danger },
];

export function SupplierMessageForm({
  supplierId,
  supplierName,
  onSuccess,
  onClose,
  autoLogOutbound = false,
}: SupplierMessageFormProps) {
  const { logMessage, loading, error } = useSupplierManagement();

  const [messageType, setMessageType] = useState<MessageType>('email');
  const [direction, setDirection] = useState<MessageDirection>(autoLogOutbound ? 'outbound' : 'inbound');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);

  const handleToggleTag = (tag: string) => {
    setSelectedTags(prev =>
      prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]
    );
  };

  const handleSubmit = async () => {
    // Validation
    if (!body.trim()) {
      Alert.alert('Missing Information', 'Please enter the message body');
      return;
    }

    if (messageType === 'email' && !subject.trim()) {
      Alert.alert('Missing Information', 'Please enter the email subject');
      return;
    }

    setSubmitting(true);
    try {
      await logMessage(supplierId, {
        type: messageType,
        direction,
        subject: messageType === 'email' ? subject : undefined,
        body: body.trim(),
        tags: selectedTags.length > 0 ? selectedTags : undefined,
      });

      Alert.alert(
        'Success',
        `Message logged with ${supplierName}`,
        [
          {
            text: 'OK',
            onPress: () => {
              onSuccess?.();
              onClose();
            },
          },
        ]
      );
    } catch (err) {
      Alert.alert('Error', error || 'Failed to log message');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        <AppCard style={styles.card}>
          {/* Header */}
          <SectionHeader
            title="Log Communication"
            subtitle={`With: ${supplierName}`}
          />

          {error && (
            <View style={[styles.errorBanner, { backgroundColor: DS.danger }]}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}

          {/* Message Type Selector */}
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Message Type</Text>
            <View style={styles.typeGrid}>
              {MESSAGE_TYPES.map(type => (
                <TouchableOpacity
                  key={type.value}
                  style={[
                    styles.typeButton,
                    messageType === type.value && styles.typeButtonActive,
                  ]}
                  onPress={() => setMessageType(type.value)}
                >
                  <Text style={styles.typeIcon}>{type.icon}</Text>
                  <Text
                    style={[
                      styles.typeLabel,
                      messageType === type.value && styles.typeLabel_active,
                    ]}
                  >
                    {type.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Direction Selector */}
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Direction</Text>
            <View style={styles.directionGrid}>
              {MESSAGE_DIRECTIONS.map(dir => (
                <TouchableOpacity
                  key={dir.value}
                  style={[
                    styles.directionButton,
                    direction === dir.value && styles.directionButtonActive,
                  ]}
                  onPress={() => setDirection(dir.value)}
                >
                  <Text
                    style={[
                      styles.directionLabel,
                      direction === dir.value && styles.directionLabel_active,
                    ]}
                  >
                    {dir.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Subject (Email Only) */}
          {messageType === 'email' && (
            <View style={styles.section}>
              <InputField
                label="Email Subject"
                value={subject}
                onChangeText={setSubject}
                placeholder="e.g., Re: Premium Yoga Mat Quote"
              />
            </View>
          )}

          {/* Message Body */}
          <View style={styles.section}>
            <InputField
              label={
                messageType === 'email'
                  ? 'Email Body'
                  : messageType === 'call'
                    ? 'Call Notes'
                    : 'Notes'
              }
              value={body}
              onChangeText={setBody}
              placeholder={
                direction === 'inbound'
                  ? 'Paste or type supplier\'s message...'
                  : 'Type your message...'
              }
              multiline
              numberOfLines={8}
              textAlignVertical="top"
            />
            <Text style={styles.characterCount}>{body.length} characters</Text>
          </View>

          {/* Tags */}
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Tags (Optional)</Text>
            <Text style={styles.tagsHint}>
              Help categorize this communication for follow-up
            </Text>
            <View style={styles.tagsContainer}>
              {AVAILABLE_TAGS.map(tag => {
                const isSelected = selectedTags.includes(tag.value);
                return (
                  <TouchableOpacity
                    key={tag.value}
                    style={[
                      styles.tagButton,
                      isSelected && [
                        styles.tagButton_selected,
                        { borderColor: tag.color, backgroundColor: `${tag.color}15` },
                      ],
                    ]}
                    onPress={() => handleToggleTag(tag.value)}
                  >
                    <Text
                      style={[
                        styles.tagLabel,
                        isSelected && { color: tag.color, fontWeight: '600' },
                      ]}
                    >
                      {isSelected ? '✓ ' : ''}{tag.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          {/* Summary */}
          <View style={styles.summary}>
            <StatusBadge
              variant={direction === 'inbound' ? 'success' : 'info'}
              label={`${direction === 'inbound' ? '📩' : '📤'} ${direction === 'inbound' ? 'Reply' : 'Outbound'}`}
            />
            <Text style={styles.summaryText}>
              This {messageType === 'email' ? 'email' : messageType === 'call' ? 'call' : 'note'} will be logged in
              your supplier history and help track negotiation progress.
            </Text>
          </View>

          {/* Actions */}
          <View style={styles.actions}>
            <PrimaryButton
              label={loading || submitting ? 'Logging...' : 'Log Message'}
              onPress={handleSubmit}
              disabled={loading || submitting}
            />
            <SecondaryButton
              label="Cancel"
              onPress={onClose}
              disabled={loading || submitting}
            />
          </View>
        </AppCard>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

// ── AUTO-LOG HELPER ──────────────────────────────────────────────────────────

/**
 * Helper to auto-log an outbound email when generated
 * Called automatically when user clicks "Generate Email"
 */
export async function autoLogOutboundEmail(
  logMessageFn: (supplierId: string, message: any) => Promise<any>,
  supplierId: string,
  email: { subject: string; body: string }
) {
  try {
    await logMessageFn(supplierId, {
      type: 'email',
      direction: 'outbound',
      subject: email.subject,
      body: email.body,
      tags: ['initial_inquiry'],
    });
    return { success: true };
  } catch (error) {
    console.error('Failed to auto-log email:', error);
    return { success: false, error };
  }
}

// ── STYLES ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: DS.bgCanvas,
  },
  scrollView: {
    flex: 1,
  },
  card: {
    marginBottom: DS.sectionGap,
  },
  errorBanner: {
    padding: DS.cardPadding,
    borderRadius: DS.radiusCard,
    marginBottom: DS.sectionGap,
  },
  errorText: {
    fontSize: 13,
    color: 'white',
    fontWeight: '500',
  },

  // ── SECTION ──
  section: {
    marginBottom: DS.sectionGap,
  },
  sectionLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: DS.textPrimary,
    marginBottom: 12,
  },
  tagsHint: {
    fontSize: 12,
    color: DS.textSecondary,
    marginBottom: 10,
  },

  // ── TYPE SELECTOR ──
  typeGrid: {
    flexDirection: 'row',
    gap: DS.cardGap,
    justifyContent: 'space-around',
  },
  typeButton: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 8,
    borderWidth: 1.5,
    borderColor: DS.border,
    borderRadius: DS.radiusCard,
    backgroundColor: DS.bgElevated,
  },
  typeButtonActive: {
    borderColor: DS.accent,
    backgroundColor: `${DS.accent}15`,
  },
  typeIcon: {
    fontSize: 24,
    marginBottom: 6,
  },
  typeLabel: {
    fontSize: 12,
    fontWeight: '500',
    color: DS.textSecondary,
  },
  typeLabel_active: {
    color: DS.accent,
    fontWeight: '600',
  },

  // ── DIRECTION SELECTOR ──
  directionGrid: {
    flexDirection: 'row',
    gap: DS.cardGap,
  },
  directionButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderWidth: 1.5,
    borderColor: DS.border,
    borderRadius: DS.radiusButton,
    backgroundColor: DS.bgElevated,
    alignItems: 'center',
  },
  directionButtonActive: {
    borderColor: DS.accent,
    backgroundColor: DS.accent,
  },
  directionLabel: {
    fontSize: 13,
    fontWeight: '500',
    color: DS.textPrimary,
  },
  directionLabel_active: {
    color: 'white',
  },

  // ── CHARACTER COUNT ──
  characterCount: {
    fontSize: 11,
    color: DS.textMuted,
    marginTop: 6,
    textAlign: 'right',
  },

  // ── TAGS ──
  tagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  tagButton: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: DS.border,
    borderRadius: DS.radiusChip,
    backgroundColor: DS.bgElevated,
  },
  tagButton_selected: {
    borderWidth: 1.5,
  },
  tagLabel: {
    fontSize: 12,
    color: DS.textSecondary,
    fontWeight: '400',
  },

  // ── SUMMARY ──
  summary: {
    backgroundColor: DS.bgElevated,
    padding: DS.cardPadding,
    borderRadius: DS.radiusCard,
    marginVertical: DS.sectionGap,
    ...Shadows.card,
  },
  summaryText: {
    fontSize: 13,
    color: DS.textSecondary,
    marginTop: 8,
    lineHeight: 18,
  },

  // ── ACTIONS ──
  actions: {
    gap: DS.cardGap,
    marginBottom: DS.sectionGap,
  },
});
