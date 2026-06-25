import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { DS } from '../theme/ds';

export type DataSourceType = 'stub' | 'ai_estimate' | 'fallback_estimate' | 'keyword_estimate' | 'confirmed';

interface DataSourceBannerProps {
  source?: DataSourceType;
  context?: 'niche' | 'suppliers' | 'products';
  onActionPress?: () => void;
}

const CONFIG: Record<DataSourceType, { bg?: string; text: string; label: string; action?: string }> = {
  stub: {
    bg: DS.warning,
    text: '#fff',
    label: '⚠ SIMULATED DATA — Real market data not connected',
    action: 'Connect real data',
  },
  ai_estimate: {
    bg: DS.warningBg,
    text: DS.warning,
    label: '✓ AI-estimated attributes (based on product title)',
    action: undefined,
  },
  fallback_estimate: {
    bg: DS.warningBg,
    text: DS.warning,
    label: '~ Estimated values (for preview only)',
    action: undefined,
  },
  keyword_estimate: {
    bg: DS.bgElevated,
    text: DS.textMuted,
    label: '~ Estimated prices · real Amazon search demand',
    action: undefined,
  },
  confirmed: {
    bg: undefined,
    text: DS.success,
    label: '✓ Real data from live source',
    action: undefined,
  },
};

export function DataSourceBanner({ source, context, onActionPress }: DataSourceBannerProps) {
  if (!source || source === 'confirmed') return null;
  const cfg = CONFIG[source];
  if (!cfg) return null;

  const isStub = source === 'stub';
  const backgroundColor = cfg.bg || (isStub ? DS.warning + '15' : DS.bgElevated);

  let description = '';
  if (source === 'stub') {
    if (context === 'niche') {
      description = 'All prices, competition levels, and review counts below are simulated. Connect to DataForSEO for live Amazon data.';
    } else if (context === 'suppliers') {
      description = 'All supplier prices, MOQs, and ratings below are simulated. Connect to Alibaba API for real supplier data.';
    } else if (context === 'products') {
      description = 'These product results are fully simulated. Real Amazon product data requires live API access.';
    }
  } else if (source === 'keyword_estimate') {
    if (context === 'niche') {
      description = 'Market scoring is based on real Amazon search demand. Prices and review counts are category-level estimates.';
    } else if (context === 'products') {
      description = 'Results ranked by real Amazon search demand. Prices and competition levels are category estimates, not live listings.';
    }
  }

  return (
    <View style={[s.banner, { backgroundColor }]}>
      <View style={s.content}>
        <Text style={[s.label, { color: cfg.text }]}>{cfg.label}</Text>
        {description && (
          <Text style={[s.description, { color: cfg.text, opacity: 0.9 }]}>{description}</Text>
        )}
      </View>
      {cfg.action && onActionPress && (
        <TouchableOpacity style={[s.action, { borderColor: cfg.text }]} onPress={onActionPress} activeOpacity={0.7}>
          <Text style={[s.actionText, { color: cfg.text }]}>{cfg.action}</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  banner: {
    paddingVertical: 12,
    paddingHorizontal: DS.pagePadding,
    gap: 10,
    borderBottomWidth: 1,
    borderBottomColor: DS.border,
  },
  content: {
    gap: 6,
  },
  label: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  description: {
    fontSize: 11,
    lineHeight: 15,
  },
  action: {
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderRadius: DS.radiusButton,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginTop: 6,
  },
  actionText: {
    fontSize: 11,
    fontWeight: '700',
  },
});
