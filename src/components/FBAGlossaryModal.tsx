import React, { useState } from 'react';
import {
  Modal, View, Text, ScrollView, TouchableOpacity,
  StyleSheet, TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { DS } from '../theme/ds';

interface GlossaryTerm {
  term: string;
  definition: string;
  category: 'Operations' | 'Financial' | 'Listing' | 'Sourcing';
}

const TERMS: GlossaryTerm[] = [
  { term: 'ASIN',         category: 'Listing',    definition: "Amazon Standard Identification Number — unique 10-character ID assigned to every product on Amazon." },
  { term: 'BSR',          category: 'Listing',    definition: "Best Sellers Rank — Amazon's real-time ranking of a product's sales within its category. Lower = more sales." },
  { term: 'FBA',          category: 'Operations', definition: "Fulfillment by Amazon — you send inventory to Amazon warehouses; Amazon picks, packs, and ships orders." },
  { term: 'FBM',          category: 'Operations', definition: "Fulfillment by Merchant — you store, pack, and ship orders yourself. Higher control, higher workload." },
  { term: 'FBA Fee',      category: 'Financial',  definition: "Per-unit fee Amazon charges for picking, packing, shipping, and customer service. Varies by size and weight." },
  { term: 'Referral Fee', category: 'Financial',  definition: "Commission Amazon takes on each sale — typically 15% of the selling price, varies by category." },
  { term: 'FNSKU',        category: 'Operations', definition: "Fulfillment Network SKU — Amazon-specific barcode placed on each unit so Amazon can track it in their warehouse." },
  { term: 'GTIN / UPC',   category: 'Operations', definition: "Global Trade Item Number / Universal Product Code — industry barcode required to create a new Amazon listing." },
  { term: 'GS1',          category: 'Operations', definition: "The global standards body that issues legitimate GTINs/UPCs. Amazon requires GS1-sourced barcodes for new listings." },
  { term: 'MOQ',          category: 'Sourcing',   definition: "Minimum Order Quantity — the smallest batch a supplier will sell. Lower MOQ = less capital risk to test a product." },
  { term: 'Lead Time',    category: 'Sourcing',   definition: "Time from placing a purchase order to goods arriving at the Amazon warehouse. Typically 30–60 days from China." },
  { term: 'Landed Cost',  category: 'Financial',  definition: "Total cost per unit including product cost + freight + customs duties + any prep fees. The true cost before Amazon fees." },
  { term: 'Net Margin',   category: 'Financial',  definition: "Profit after ALL costs (landed cost + Amazon fees) as a % of selling price. Siftly targets 30%+ for healthy products." },
  { term: 'ROI',          category: 'Financial',  definition: "Return on Investment — net profit as a % of total capital invested. 50%+ ROI is strong for a single PO cycle." },
  { term: 'PPC',          category: 'Listing',    definition: "Pay-Per-Click — Amazon Sponsored Ads. You bid on keywords; charged only when a shopper clicks. Key to launching ranking." },
  { term: 'ACoS',         category: 'Financial',  definition: "Advertising Cost of Sale — PPC spend ÷ PPC revenue. 20–30% is often sustainable at launch; aim lower at scale." },
  { term: 'TACoS',        category: 'Financial',  definition: "Total ACoS — total ad spend ÷ total revenue (organic + paid). A truer picture of advertising efficiency than ACoS." },
  { term: 'LQS',          category: 'Listing',    definition: "Listing Quality Score — internal Amazon score based on title, bullets, images, A+ content, and keywords." },
  { term: 'A+ Content',   category: 'Listing',    definition: "Enhanced Brand Content (EBC) — visually rich product description modules available to Brand Registered sellers." },
  { term: 'Brand Registry', category: 'Listing',  definition: "Amazon program that gives brand owners control over their listing content and access to A+ Content and Transparency." },
  { term: 'Hazmat',       category: 'Operations', definition: "Hazardous Materials — products like lithium batteries or aerosols that require special FBA handling and approval." },
  { term: 'Reorder Point', category: 'Operations', definition: "The inventory level that triggers a new purchase order, calculated to avoid stockouts during lead time." },
  { term: 'IPI Score',    category: 'Operations', definition: "Inventory Performance Index — Amazon score (0–1000) measuring how well you manage FBA stock. Below 450 limits storage." },
  { term: 'Private Label', category: 'Sourcing',  definition: "Selling a manufacturer's product under your own brand name. The dominant model for FBA sellers building long-term assets." },
  { term: 'Wholesale',    category: 'Sourcing',   definition: "Buying branded products in bulk and reselling them on Amazon. Lower margins but less brand-building required." },
];

const CATEGORIES = ['All', 'Financial', 'Operations', 'Listing', 'Sourcing'] as const;
type CategoryFilter = typeof CATEGORIES[number];

const CAT_COLOR: Record<GlossaryTerm['category'], string> = {
  Financial:  DS.accent,
  Operations: DS.success,
  Listing:    DS.indigo ?? '#6366F1',
  Sourcing:   DS.warning,
};

interface Props {
  visible: boolean;
  onClose: () => void;
}

export function FBAGlossaryModal({ visible, onClose }: Props) {
  const [query,  setQuery]  = useState('');
  const [filter, setFilter] = useState<CategoryFilter>('All');

  const filtered = TERMS.filter(t => {
    const matchCat   = filter === 'All' || t.category === filter;
    const matchQuery = !query || t.term.toLowerCase().includes(query.toLowerCase()) || t.definition.toLowerCase().includes(query.toLowerCase());
    return matchCat && matchQuery;
  });

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={{ flex: 1, backgroundColor: DS.bgCanvas }}>
        <View style={g.header}>
          <View style={{ flex: 1 }}>
            <Text style={g.title}>FBA Glossary</Text>
            <Text style={g.subtitle}>{TERMS.length} key terms for Amazon sellers</Text>
          </View>
          <TouchableOpacity onPress={onClose} style={g.closeBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Text style={g.closeText}>✕</Text>
          </TouchableOpacity>
        </View>

        <View style={g.searchWrap}>
          <TextInput
            style={g.searchInput}
            placeholder="Search terms…"
            placeholderTextColor={DS.textMuted}
            value={query}
            onChangeText={setQuery}
            autoCorrect={false}
          />
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={g.catScroll} contentContainerStyle={g.catRow}>
          {CATEGORIES.map(c => (
            <TouchableOpacity key={c} style={[g.catChip, filter === c && g.catChipActive]} onPress={() => setFilter(c)}>
              <Text style={[g.catChipText, filter === c && g.catChipTextActive]}>{c}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        <ScrollView contentContainerStyle={g.list} showsVerticalScrollIndicator={false}>
          {filtered.length === 0 && (
            <Text style={g.empty}>No terms match "{query}"</Text>
          )}
          {filtered.map(t => (
            <View key={t.term} style={g.termCard}>
              <View style={g.termHeader}>
                <Text style={g.termText}>{t.term}</Text>
                <View style={[g.catBadge, { backgroundColor: CAT_COLOR[t.category] + '22' }]}>
                  <Text style={[g.catBadgeText, { color: CAT_COLOR[t.category] }]}>{t.category}</Text>
                </View>
              </View>
              <Text style={g.defText}>{t.definition}</Text>
            </View>
          ))}
          <View style={{ height: 40 }} />
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

const g = StyleSheet.create({
  header:          { flexDirection: 'row', alignItems: 'flex-start', paddingHorizontal: 20, paddingTop: 20, paddingBottom: 12, gap: 12 },
  title:           { fontSize: 20, fontWeight: '800', color: DS.textPrimary },
  subtitle:        { fontSize: 13, color: DS.textMuted, marginTop: 2 },
  closeBtn:        { width: 32, height: 32, borderRadius: 16, backgroundColor: DS.bgElevated, alignItems: 'center', justifyContent: 'center' },
  closeText:       { fontSize: 14, color: DS.textSecondary, fontWeight: '600' },
  searchWrap:      { paddingHorizontal: 20, marginBottom: 10 },
  searchInput:     { backgroundColor: DS.bgCard, borderWidth: 1, borderColor: DS.border, borderRadius: DS.radiusInput, paddingHorizontal: 14, paddingVertical: 10, fontSize: 14, color: DS.textPrimary },
  catScroll:       { flexGrow: 0, height: 48, marginBottom: 12 },
  catRow:          { paddingHorizontal: 20, gap: 8, flexDirection: 'row', alignItems: 'center' },
  catChip:         { paddingHorizontal: 16, paddingVertical: 10, borderRadius: DS.radiusBadge, backgroundColor: DS.bgElevated, borderWidth: 1, borderColor: DS.border, justifyContent: 'center' },
  catChipActive:   { backgroundColor: DS.accent, borderColor: DS.accent },
  catChipText:     { fontSize: 14, color: DS.textSecondary, fontWeight: '700' },
  catChipTextActive: { color: DS.textInverse },
  list:            { paddingHorizontal: 20, gap: 10 },
  empty:           { textAlign: 'center', color: DS.textMuted, marginTop: 40, fontSize: 14 },
  termCard:        { backgroundColor: DS.bgCard, borderRadius: DS.radiusChip, padding: 14, borderWidth: 1, borderColor: DS.border, gap: 6 },
  termHeader:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  termText:        { fontSize: 15, fontWeight: '700', color: DS.textPrimary, flex: 1 },
  catBadge:        { paddingHorizontal: 8, paddingVertical: 3, borderRadius: DS.radiusBadge },
  catBadgeText:    { fontSize: 10, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
  defText:         { fontSize: 13, color: DS.textSecondary, lineHeight: 19 },
});
