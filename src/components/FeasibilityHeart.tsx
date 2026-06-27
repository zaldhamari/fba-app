import React, { useState } from 'react';
import {
  TouchableOpacity, Modal, View, Text, StyleSheet,
  FlatList, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { DS } from './ds';
import { useFeasibilityTags } from '../hooks/useFeasibilityTags';
import { useVault } from '../hooks/useVault';
import type { FeasibilityTagType } from '../types/feasibilityReport';

interface Props {
  type: FeasibilityTagType;
  label: string;
  data: Record<string, unknown>;
  size?: number;
}

export default function FeasibilityHeart({ type, label, data, size = 22 }: Props) {
  const { addTag, hasTag } = useFeasibilityTags();
  const { entries } = useVault();
  const [pickerOpen, setPickerOpen] = useState(false);
  const [taggedAsin, setTaggedAsin]  = useState<string | null>(null);

  if (entries.length === 0) return null;

  const isTagged = taggedAsin != null || entries.some(e => hasTag(e.asin, type));

  function doTag(asin: string, title: string) {
    addTag(asin, title, type, label, data);
    setTaggedAsin(asin);
  }

  function handlePress() {
    if (entries.length === 0) {
      Alert.alert('No products saved', 'Research a product and save it to your vault first, then tag this item to it.');
      return;
    }

    if (isTagged) {
      const existingEntry = entries.find(e => hasTag(e.asin, type));
      const productName   = existingEntry?.product.title ?? 'a product';
      Alert.alert(
        'Already saved',
        `You already have a ${type} tagged to "${productName}". Replace it with this one?`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Replace',
            onPress: () => {
              if (entries.length === 1) { doTag(entries[0].asin, entries[0].product.title); }
              else { setPickerOpen(true); }
            },
          },
        ],
      );
      return;
    }

    if (entries.length === 1) {
      doTag(entries[0].asin, entries[0].product.title);
      return;
    }
    setPickerOpen(true);
  }

  function handlePick(asin: string, title: string) {
    addTag(asin, title, type, label, data);
    setTaggedAsin(asin);
    setPickerOpen(false);
  }

  return (
    <>
      <TouchableOpacity
        style={[s.btn, isTagged && s.btnActive]}
        onPress={handlePress}
        activeOpacity={0.75}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        accessibilityRole="button"
        accessibilityLabel={isTagged ? `Remove ${label} from feasibility report` : `Save ${label} to feasibility report`}
        accessibilityState={{ selected: isTagged }}
      >
        <Text style={[s.heart, { fontSize: size }, isTagged && s.heartActive]}>
          {isTagged ? '♥' : '♡'}
        </Text>
        <Text style={[s.label, isTagged && s.labelActive]}>
          {isTagged ? 'Saved' : 'Save to report'}
        </Text>
      </TouchableOpacity>

      <Modal
        visible={pickerOpen}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setPickerOpen(false)}
      >
        <SafeAreaView style={m.safe} edges={['top', 'bottom']}>
          <View style={m.header}>
            <View style={m.headerIcon}>
              <Text style={{ fontSize: 16 }}>♥</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={m.heading}>Tag to Product</Text>
              <Text style={m.sub}>Which product is this {type} for?</Text>
            </View>
            <TouchableOpacity onPress={() => setPickerOpen(false)} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
              <Text style={m.close}>✕</Text>
            </TouchableOpacity>
          </View>

          <FlatList
            data={entries}
            keyExtractor={e => e.asin}
            contentContainerStyle={m.list}
            ItemSeparatorComponent={() => <View style={m.sep} />}
            initialNumToRender={8}
            maxToRenderPerBatch={8}
            windowSize={5}
            removeClippedSubviews={true}
            renderItem={({ item }) => {
              const verdict = item.analysis?.verdict;
              const vc = verdict === 'LAUNCH' ? DS.success : verdict === 'TEST' ? DS.warning : DS.danger;
              return (
                <TouchableOpacity
                  style={m.row}
                  onPress={() => handlePick(item.asin, item.product.title)}
                  activeOpacity={0.75}
                >
                  <View style={{ flex: 1, gap: 3 }}>
                    <Text style={m.rowTitle} numberOfLines={2}>{item.product.title}</Text>
                    <Text style={m.rowAsin}>{item.asin}</Text>
                  </View>
                  {verdict && (
                    <View style={[m.badge, { backgroundColor: vc + '20' }]}>
                      <Text style={[m.badgeText, { color: vc }]}>{verdict}</Text>
                    </View>
                  )}
                  <Text style={m.rowArrow}>›</Text>
                </TouchableOpacity>
              );
            }}
          />
        </SafeAreaView>
      </Modal>
    </>
  );
}

const s = StyleSheet.create({
  btn:         { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12, borderWidth: 1, borderColor: DS.border, backgroundColor: DS.bgSubtle },
  btnActive:   { borderColor: '#FDA4AF', backgroundColor: '#FFF1F2' },
  heart:       { color: DS.textMuted },
  heartActive: { color: '#E11D48' },
  label:       { fontSize: 11, fontWeight: '700', color: DS.textMuted },
  labelActive: { color: '#E11D48' },
});

const m = StyleSheet.create({
  safe:       { flex: 1, backgroundColor: DS.bgCanvas },
  header:     { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 20, borderBottomWidth: 1, borderBottomColor: DS.border },
  headerIcon: { width: 38, height: 38, borderRadius: 10, backgroundColor: '#FFF1F2', alignItems: 'center', justifyContent: 'center' },
  heading:    { fontSize: 16, fontWeight: '800', color: DS.textPrimary, letterSpacing: -0.3 },
  sub:        { fontSize: 12, color: DS.textSecondary, marginTop: 1 },
  close:      { fontSize: 20, color: DS.textMuted, fontWeight: '300' },
  list:       { padding: 16, gap: 0 },
  sep:        { height: 1, backgroundColor: DS.border },
  row:        { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14 },
  rowTitle:   { fontSize: 14, fontWeight: '700', color: DS.textPrimary, lineHeight: 20 },
  rowAsin:    { fontSize: 10, color: DS.textMuted },
  badge:      { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 },
  badgeText:  { fontSize: 9, fontWeight: '900' },
  rowArrow:   { fontSize: 20, color: DS.textMuted, fontWeight: '300' },
});
