import React, { useState } from 'react';
import { View, StyleSheet, ScrollView, Text, TouchableOpacity, Share, Alert } from 'react-native';
import { DS } from '../theme/ds';
import { AppCard } from './ds/AppCard';
import { SectionHeader } from './ds/SectionHeader';
import { PrimaryButton } from './ds/Buttons';
import { StatusBadge } from './ds/StatusBadge';
import { SvgXml } from 'react-native-svg';
import type { CompleteBrandKit } from '../types/branding';

function isValidSvg(s?: string | null): boolean {
  return typeof s === 'string' && s.trimStart().startsWith('<svg');
}

// ════════════════════════════════════════════════════════════════════════════
// PHASE 3: DESIGN EXPORT MANAGER
// ════════════════════════════════════════════════════════════════════════════

export function DesignExportManager({ kit }: { kit: Partial<CompleteBrandKit> }) {
  const [sharing, setSharing] = useState<string | null>(null);

  const brandName  = kit.story?.brandName || 'Your Brand';
  const logoSvg    = kit.mockups?.[0]?.logo_svg ?? kit.amazonPreview?.logo_svg;
  const labelSvg   = kit.mockups?.[0]?.label_svg ?? kit.amazonPreview?.label_svg;
  const hasPrimary = isValidSvg(logoSvg);
  const hasColors  = !!kit.colors;
  const hasTypo    = !!kit.typography;

  async function shareAsset(name: string, content: string) {
    setSharing(name);
    try {
      await Share.share({ message: content, title: name });
    } catch {
      Alert.alert('Share failed', 'Could not open share sheet on this device.');
    } finally {
      setSharing(null);
    }
  }

  function colorTokens(): string {
    if (!kit.colors) return '';
    const c = kit.colors;
    return [
      `Brand: ${c.primary.main}`,
      c.secondary ? `Secondary: ${c.secondary.main}` : '',
      c.border ? `Border: ${c.border}` : '',
    ].filter(Boolean).join('\n');
  }

  const headingFont = kit.typography?.h1?.font?.name ?? kit.typography?.h2?.font?.name;
  const bodyFont    = kit.typography?.body?.font?.name;

  const assets: { icon: string; name: string; desc: string; ready: boolean; onShare?: () => void }[] = [
    {
      icon: '🎨',
      name: 'Logo SVG',
      desc: hasPrimary ? 'Logo generated — tap Share to export' : 'Generate logos in Phase 3 first',
      ready: hasPrimary,
      onShare: hasPrimary ? () => shareAsset('Logo SVG', logoSvg!) : undefined,
    },
    {
      icon: '🎨',
      name: 'Color Palette',
      desc: hasColors ? `Primary ${kit.colors!.primary.main}${kit.colors!.secondary ? ` · Secondary ${kit.colors!.secondary.main}` : ''}` : 'Set colors in Phase 1',
      ready: hasColors,
      onShare: hasColors ? () => shareAsset(`${brandName} — Color Palette`, colorTokens()) : undefined,
    },
    {
      icon: '🔤',
      name: 'Typography',
      desc: hasTypo ? `${headingFont ?? 'Heading'} / ${bodyFont ?? 'Body'}` : 'Set typography in Phase 2',
      ready: hasTypo,
      onShare: hasTypo
        ? () => shareAsset(`${brandName} — Typography`, `Heading: ${headingFont ?? 'n/a'}\nBody: ${bodyFont ?? 'n/a'}`)
        : undefined,
    },
    {
      icon: '📦',
      name: 'Product Label',
      desc: isValidSvg(labelSvg) ? 'Label SVG ready to export' : 'Generate label in Phase 3',
      ready: isValidSvg(labelSvg),
      onShare: isValidSvg(labelSvg) ? () => shareAsset('Product Label SVG', labelSvg!) : undefined,
    },
  ];

  const readyCount = assets.filter(a => a.ready).length;

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      <AppCard>
        <SectionHeader
          title="Design Assets"
          subtitle={`${readyCount} of ${assets.length} assets ready`}
        />

        <View style={{ backgroundColor: DS.bgElevated, borderRadius: DS.radiusCard, padding: 12, marginBottom: DS.sectionGap }}>
          <Text style={{ fontSize: 12, color: DS.textSecondary, lineHeight: 18 }}>
            Complete Phases 1–3 to unlock all assets. Tap Share on any ready asset to export it to your files or design tool.
          </Text>
        </View>

        {assets.map((asset, idx) => (
          <View key={idx} style={styles.assetRow}>
            <Text style={styles.assetIcon}>{asset.icon}</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.assetName}>{asset.name}</Text>
              <Text style={styles.assetDesc}>{asset.desc}</Text>
            </View>
            {asset.ready && asset.onShare ? (
              <TouchableOpacity
                style={styles.shareBtn}
                onPress={asset.onShare}
                disabled={sharing === asset.name}
                activeOpacity={0.8}
              >
                <Text style={styles.shareBtnTxt}>{sharing === asset.name ? '…' : 'Share'}</Text>
              </TouchableOpacity>
            ) : (
              <StatusBadge variant={asset.ready ? 'success' : 'neutral'} label={asset.ready ? '✓' : 'Pending'} />
            )}
          </View>
        ))}

        {hasPrimary && (
          <View style={{ marginTop: DS.sectionGap }}>
            <Text style={styles.sectionTitle}>Logo Preview</Text>
            <View style={{ backgroundColor: DS.bgSubtle, borderRadius: DS.radiusCard, padding: 16, alignItems: 'center' }}>
              <SvgXml xml={logoSvg!} width={180} height={90} />
            </View>
          </View>
        )}
      </AppCard>
    </ScrollView>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// PHASE 4: COMPLIANCE CHECKLIST
// ════════════════════════════════════════════════════════════════════════════

const TRADEMARK_STEPS = [
  { label: 'Search USPTO (US)', url: 'tmsearch.uspto.gov', icon: '™️' },
  { label: 'Search EUIPO (EU)', url: 'euipo.europa.eu/eSearch', icon: '🇪🇺' },
  { label: 'Search IP Australia', url: 'search.ipaustralia.gov.au', icon: '🇦🇺' },
  { label: 'Search CIPO (Canada)', url: 'ic.gc.ca/app/opic-cipo/trdmrks', icon: '🇨🇦' },
];

const COMPLIANCE_CATEGORIES = [
  {
    icon: '⚠️',
    title: 'Product Safety',
    items: [
      'Check if your category needs safety certifications (CE, UL, FCC, CPSC)',
      'Supplements: FDA compliance + disclaimer required on label',
      "Children's products: CPSC testing mandatory",
      'Electronics: FCC Part 15 certification required',
    ],
  },
  {
    icon: '📋',
    title: 'Amazon Requirements',
    items: [
      "Verify your product category isn't gated (requires approval)",
      'Check if brand registry is available for your brand name',
      "Confirm images meet Amazon's main image requirements (white background)",
      'Review prohibited product list for your category',
    ],
  },
  {
    icon: '🏷️',
    title: 'Label Requirements',
    items: [
      'Country of origin must appear on label',
      'Net weight/quantity in standard units',
      'Manufacturer name & address (or importer)',
      'Category-specific: ingredients, warnings, directions',
    ],
  },
  {
    icon: '©️',
    title: 'IP & Ownership',
    items: [
      'Confirm AI-generated logos are cleared for commercial use (check your plan)',
      'Do not use trademarked names or logos in your brand',
      'Register your brand name as a trademark before scaling',
      'Document your brand assets and creation date',
    ],
  },
];

export function ComplianceDashboard({ kit }: { kit: Partial<CompleteBrandKit> }) {
  const [expanded, setExpanded] = useState<number | null>(null);
  const brandName = kit.story?.brandName;

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      <AppCard>
        <SectionHeader title="Compliance Checklist" subtitle="What you must verify before launch" />

        <View style={{ backgroundColor: DS.warningBg, borderRadius: DS.radiusCard, padding: 12, marginBottom: DS.sectionGap, borderWidth: 1, borderColor: DS.warning + '40' }}>
          <Text style={{ fontSize: 12, color: DS.textSecondary, lineHeight: 18 }}>
            <Text style={{ fontWeight: '700', color: DS.warning }}>Important: </Text>
            Trademark and domain availability cannot be checked automatically — these databases require real-time lookups. Use the links below to search each one manually before you launch.
          </Text>
        </View>

        <View style={{ marginBottom: DS.sectionGap }}>
          <Text style={styles.sectionTitle}>
            {'™'} Trademark Search{brandName ? ` for "${brandName}"` : ''}
          </Text>
          <Text style={{ fontSize: 11, color: DS.textMuted, marginBottom: 10, lineHeight: 16 }}>
            Search with your brand name. A similar mark does not automatically block you — check with a trademark attorney if you find conflicts.
          </Text>
          {TRADEMARK_STEPS.map((step, i) => (
            <View key={i} style={styles.trademarkRow}>
              <Text style={{ fontSize: 16, width: 26 }}>{step.icon}</Text>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 13, fontWeight: '600', color: DS.textPrimary }}>{step.label}</Text>
                <Text style={{ fontSize: 11, color: DS.accent, marginTop: 2 }}>{step.url}</Text>
              </View>
            </View>
          ))}
        </View>

        {COMPLIANCE_CATEGORIES.map((cat, idx) => (
          <TouchableOpacity
            key={idx}
            style={[styles.catCard, expanded === idx && styles.catCardOpen]}
            onPress={() => setExpanded(prev => prev === idx ? null : idx)}
            activeOpacity={0.8}
          >
            <View style={styles.catHeader}>
              <Text style={{ fontSize: 18, width: 26 }}>{cat.icon}</Text>
              <Text style={{ flex: 1, fontSize: 13, fontWeight: '700', color: DS.textPrimary }}>{cat.title}</Text>
              <Text style={{ fontSize: 14, color: DS.textMuted }}>{expanded === idx ? '▲' : '▼'}</Text>
            </View>
            {expanded === idx && (
              <View style={{ gap: 8, marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: DS.border }}>
                {cat.items.map((item, i) => (
                  <View key={i} style={{ flexDirection: 'row', gap: 8 }}>
                    <Text style={{ fontSize: 12, color: DS.accent, fontWeight: '700', marginTop: 1 }}>{'□'}</Text>
                    <Text style={{ flex: 1, fontSize: 12, color: DS.textSecondary, lineHeight: 18 }}>{item}</Text>
                  </View>
                ))}
              </View>
            )}
          </TouchableOpacity>
        ))}

        <View style={{ marginTop: DS.sectionGap, padding: 12, backgroundColor: DS.bgElevated, borderRadius: DS.radiusCard }}>
          <Text style={{ fontSize: 11, color: DS.textMuted, lineHeight: 17 }}>
            {'💡'} For full compliance guidance, consult an Amazon FBA attorney or your freight forwarder's compliance team before your first shipment.
          </Text>
        </View>
      </AppCard>
    </ScrollView>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// PHASE 4: AMAZON LISTING PREVIEW
// ════════════════════════════════════════════════════════════════════════════

export function AmazonListingPreview({ kit }: { kit: Partial<CompleteBrandKit> }) {
  const brandName    = kit.story?.brandName   || 'Your Brand';
  const tagline      = kit.story?.tagline      || '';
  const logoSvg      = kit.mockups?.[0]?.logo_svg ?? kit.amazonPreview?.logo_svg;
  const listingTitle = kit.amazonPreview?.title;
  const bullets      = kit.amazonPreview?.bullets ?? [];
  const hasLogo      = isValidSvg(logoSvg);
  const isComplete   = !!kit.story?.brandName && !!kit.colors && !!kit.typography;

  const tips = [
    { ok: !!kit.story?.brandName,        text: 'Brand name set' },
    { ok: !!kit.colors?.primary?.main,   text: 'Primary color defined' },
    { ok: !!kit.typography,              text: 'Typography selected' },
    { ok: hasLogo,                       text: 'Logo generated' },
    { ok: bullets.length > 0,           text: 'Listing bullets populated' },
  ];

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      <AppCard>
        <SectionHeader title="Amazon Listing Preview" subtitle="How your brand appears on Amazon" />

        {!isComplete && (
          <View style={{ backgroundColor: DS.bgElevated, borderRadius: DS.radiusCard, padding: 12, marginBottom: DS.sectionGap }}>
            <Text style={{ fontSize: 12, color: DS.textSecondary, lineHeight: 18 }}>
              Complete Phases 1–3 to see your real brand data here. Fields below reflect what has been filled in so far.
            </Text>
          </View>
        )}

        <View style={styles.amazonFrame}>
          <View style={{ borderBottomWidth: 1, borderBottomColor: '#E3E6E6', paddingBottom: 8, marginBottom: 12 }}>
            <Text style={{ fontSize: 11, color: '#FF9900', fontWeight: '800' }}>amazon</Text>
          </View>

          {hasLogo ? (
            <View style={{ backgroundColor: '#f7f8f8', borderRadius: 8, padding: 12, alignItems: 'center', marginBottom: 12 }}>
              <SvgXml xml={logoSvg!} width={160} height={80} />
            </View>
          ) : (
            <View style={styles.imgPlaceholder}>
              <Text style={{ fontSize: 28 }}>{'📦'}</Text>
              <Text style={{ fontSize: 11, color: DS.textMuted, marginTop: 6 }}>Generate logo to preview</Text>
            </View>
          )}

          <Text style={styles.amzTitle} numberOfLines={3}>
            {listingTitle ?? `${brandName !== 'Your Brand' ? brandName + ' — ' : ''}[Add product title in Step 6 — Listing Preparation]`}
          </Text>

          {tagline ? (
            <Text style={{ fontSize: 11, color: DS.textMuted, marginBottom: 8 }}>{tagline}</Text>
          ) : null}

          <Text style={{ fontSize: 13, fontWeight: '700', color: DS.success, marginBottom: 4 }}>Price: set in Profit Lab</Text>

          {bullets.length > 0 ? (
            <View style={{ gap: 6, marginTop: 8 }}>
              {bullets.slice(0, 5).map((b, i) => (
                <Text key={i} style={{ fontSize: 12, color: DS.textSecondary, lineHeight: 17 }}>{'•'} {b}</Text>
              ))}
            </View>
          ) : (
            <View style={{ backgroundColor: DS.bgElevated, borderRadius: 8, padding: 10, marginTop: 8 }}>
              <Text style={{ fontSize: 11, color: DS.textMuted, lineHeight: 17 }}>
                Bullet points appear here after logo generation in Phase 3. They come from the AI listing builder.
              </Text>
            </View>
          )}
        </View>

        <View style={{ marginTop: DS.sectionGap }}>
          <Text style={styles.sectionTitle}>Kit Readiness</Text>
          {tips.map((t, i) => (
            <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 7, borderBottomWidth: 1, borderBottomColor: DS.border }}>
              <StatusBadge variant={t.ok ? 'success' : 'neutral'} label={t.ok ? '✓' : '○'} />
              <Text style={{ fontSize: 12, color: t.ok ? DS.textPrimary : DS.textMuted }}>{t.text}</Text>
            </View>
          ))}
        </View>

        <View style={{ marginTop: DS.sectionGap, padding: 12, backgroundColor: DS.bgElevated, borderRadius: DS.radiusCard }}>
          <Text style={{ fontSize: 11, color: DS.textMuted, lineHeight: 17 }}>
            {'💡'} Listing title and bullets come from Phase 3 (Logo Concepts). Price comes from Profit Lab. Complete those steps to see a full preview.
          </Text>
        </View>
      </AppCard>
    </ScrollView>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// PHASE 4: BRAND ROLLOUT PLAN
// ════════════════════════════════════════════════════════════════════════════

export function BrandRolloutPlan({ kit }: { kit: Partial<CompleteBrandKit> }) {
  const brand    = kit.story?.brandName                               || 'your brand';
  const tagline  = kit.story?.tagline                                 || 'quality you can trust';
  const audience = kit.story?.customerPersona?.occupation             || 'your target audience';
  const handle   = brand.replace(/\s+/g, '').toLowerCase();

  const WEEKS = [
    {
      title: 'Week 1: Foundation',
      tasks: [
        { day: 'Day 1–2', task: 'Brand assets live', desc: `Upload logo, colors, and fonts to Amazon Seller Central brand registry and storefront.` },
        { day: 'Day 3–4', task: 'Listing live', desc: `Publish your first product with optimised title, bullets, and A+ content using your ${brand} branding.` },
        { day: 'Day 5–7', task: 'Social setup', desc: `Create @${handle} on Instagram and TikTok. Pin your brand story as the first post.` },
      ],
    },
    {
      title: 'Week 2: First Traffic',
      tasks: [
        { day: 'Day 8–10', task: 'Amazon PPC launch', desc: `Start auto campaign at $10–15/day. Let it run 7 days before optimising. Target ACoS 30–40% is acceptable in launch.` },
        { day: 'Day 11–12', task: 'Influencer outreach', desc: `DM 10–20 micro-influencers (5k–50k followers) in your niche. Offer free product for honest review.` },
        { day: 'Day 13–14', task: 'Insert cards', desc: `Pack your insert card in every unit shipped. Include your review link and support email for post-purchase follow-up.` },
      ],
    },
    {
      title: 'Week 3–4: Amplify',
      tasks: [
        { day: 'Day 15–18', task: 'Review velocity', desc: `Follow up with early buyers via Amazon's Request a Review tool. Do not request feedback outside Amazon policy.` },
        { day: 'Day 19–24', task: 'Keyword optimisation', desc: `Check Search Term Report in Seller Central. Move converting keywords to exact match. Pause non-performers.` },
        { day: 'Day 25–30', task: 'Review & scale', desc: `If ACoS < 35% and BSR trending up, increase daily budget 20%. If not, diagnose listing vs. price vs. reviews first.` },
      ],
    },
  ];

  const TEMPLATES = [
    {
      title: 'Instagram Bio',
      copy: `✦ ${brand} | ${tagline} | Trusted by ${audience} | Free shipping on first order → link in bio`,
    },
    {
      title: 'Launch Email Subject',
      copy: `Introducing ${brand} — ${tagline}`,
    },
    {
      title: 'First Social Post',
      copy: `Meet ${brand}. We exist for ${audience} who deserve better. ${tagline}. Link in bio ↗`,
    },
    {
      title: 'Review Request Insert',
      copy: `Thank you for choosing ${brand}! If you love your purchase, a quick review on Amazon takes under 60 seconds and means the world to us. Scan the QR code or visit your orders page. Questions? We reply within 24h.`,
    },
  ];

  async function sharePlan() {
    const lines = [
      `${brand} — 30-Day Launch Plan`,
      '',
      ...WEEKS.flatMap(w => [
        w.title,
        ...w.tasks.map(t => `${t.day}: ${t.task} — ${t.desc}`),
        '',
      ]),
      'Copy Templates',
      ...TEMPLATES.map(t => `${t.title}:\n${t.copy}`),
    ];
    try {
      await Share.share({ message: lines.join('\n'), title: `${brand} Launch Plan` });
    } catch {
      Alert.alert('Share failed', 'Could not open share sheet.');
    }
  }

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      <AppCard>
        <SectionHeader title="30-Day Launch Plan" subtitle={`Customised for ${brand}`} />

        {WEEKS.map((week, wi) => (
          <View key={wi} style={{ marginBottom: DS.sectionGap }}>
            <Text style={styles.sectionTitle}>{week.title}</Text>
            {week.tasks.map((t, ti) => (
              <View key={ti} style={styles.taskRow}>
                <Text style={styles.taskDay}>{t.day}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={styles.taskName}>{t.task}</Text>
                  <Text style={styles.taskDesc}>{t.desc}</Text>
                </View>
              </View>
            ))}
          </View>
        ))}

        <View style={{ marginBottom: DS.sectionGap }}>
          <Text style={styles.sectionTitle}>Copy Templates</Text>
          <Text style={{ fontSize: 11, color: DS.textMuted, marginBottom: 10 }}>
            Personalised for {brand}. Tap and hold any template to copy.
          </Text>
          {TEMPLATES.map((t, i) => (
            <View key={i} style={styles.templateCard}>
              <Text style={styles.templateTitle}>{t.title}</Text>
              <Text style={styles.templateText} selectable>{t.copy}</Text>
            </View>
          ))}
        </View>

        <PrimaryButton label="Share Launch Plan" onPress={sharePlan} />
      </AppCard>
    </ScrollView>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// STYLES
// ════════════════════════════════════════════════════════════════════════════

const styles = StyleSheet.create({
  container:    { flex: 1, backgroundColor: DS.bgCanvas, padding: DS.pagePadding },
  sectionTitle: { fontSize: 13, fontWeight: '700', color: DS.textPrimary, marginBottom: 10 },
  assetRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: DS.border,
  },
  assetIcon:    { fontSize: 18, width: 24 },
  assetName:    { fontSize: 12, fontWeight: '700', color: DS.textPrimary },
  assetDesc:    { fontSize: 11, color: DS.textSecondary, marginTop: 2 },
  shareBtn: {
    backgroundColor: DS.accent + '15', borderWidth: 1.5, borderColor: DS.accent + '40',
    borderRadius: DS.radiusBadge, paddingHorizontal: 12, paddingVertical: 5,
  },
  shareBtnTxt:  { fontSize: 12, fontWeight: '700', color: DS.accent },
  trademarkRow: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 10,
    paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: DS.border,
  },
  catCard: {
    borderWidth: 1.5, borderColor: DS.border, borderRadius: DS.radiusCard,
    padding: 14, marginBottom: 10, backgroundColor: DS.bgCard,
  },
  catCardOpen:  { borderColor: DS.accent, backgroundColor: DS.accent + '06' },
  catHeader:    { flexDirection: 'row', alignItems: 'center', gap: 10 },
  amazonFrame: {
    backgroundColor: DS.bgCard, borderRadius: DS.radiusCard,
    borderWidth: 1, borderColor: '#DDD', padding: 16,
    marginVertical: DS.sectionGap,
  },
  imgPlaceholder: {
    height: 160, backgroundColor: '#f7f8f8', borderRadius: 8,
    borderWidth: 1.5, borderStyle: 'dashed', borderColor: DS.border,
    justifyContent: 'center', alignItems: 'center', marginBottom: 12,
  },
  amzTitle:     { fontSize: 15, fontWeight: '700', color: '#0F1111', marginBottom: 6, lineHeight: 21 },
  taskRow: {
    flexDirection: 'row', gap: 12, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: DS.border,
  },
  taskDay:      { fontSize: 11, fontWeight: '700', color: DS.accent, minWidth: 54 },
  taskName:     { fontSize: 12, fontWeight: '700', color: DS.textPrimary },
  taskDesc:     { fontSize: 11, color: DS.textSecondary, marginTop: 3, lineHeight: 17 },
  templateCard: {
    backgroundColor: DS.bgElevated, borderRadius: DS.radiusCard,
    padding: 12, marginBottom: 10,
  },
  templateTitle: { fontSize: 12, fontWeight: '700', color: DS.textPrimary, marginBottom: 6 },
  templateText:  { fontSize: 11, color: DS.textSecondary, lineHeight: 17 },
});
