import AsyncStorage from '@react-native-async-storage/async-storage';
import { enqueueEvent } from './analyticsTransmit';

const EVENTS_KEY = 'siftly_analytics_v1';
const MAX_EVENTS = 500;

export type FunnelEvent =
  // Onboarding
  | 'onboarding_started'
  | 'onboarding_completed'
  | 'seller_profile_saved'
  // Niche discovery
  | 'niche_search_started'
  | 'niche_selected'
  | 'niche_cleared'
  // Product validation
  | 'product_search_started'
  | 'product_selected'
  | 'product_analyzed'
  | 'product_cleared'
  // Sourcing
  | 'supplier_search_started'
  | 'supplier_selected'
  | 'supplier_quote_added'
  | 'supplier_quote_removed'
  | 'freight_calculated'
  // Costs
  | 'cost_model_built'
  | 'cost_model_cleared'
  // Brand
  | 'brand_name_generated'
  | 'brand_listing_generated'
  | 'brand_data_saved'
  // Launch
  | 'launch_decision_viewed'
  | 'launch_checklist_opened'
  | 'launch_checklist_item_toggled'
  // Verdict feedback (Reality Check — measures trust/utility/influence)
  | 'verdict_feedback'
  // Pipeline
  | 'pipeline_cleared'
  // Errors / limits
  | 'quota_exceeded'
  | 'brand_generation_failed'
  // Paywall
  | 'paywall_shown'
  | 'paywall_dismissed'
  | 'subscription_purchased';

interface AnalyticsEvent {
  event: FunnelEvent;
  properties?: Record<string, unknown>;
  ts: string;
}

export async function track(event: FunnelEvent, properties?: Record<string, unknown>): Promise<void> {
  try {
    const raw    = await AsyncStorage.getItem(EVENTS_KEY);
    const events: AnalyticsEvent[] = raw ? JSON.parse(raw) : [];
    events.push({ event, properties, ts: new Date().toISOString() });
    await AsyncStorage.setItem(EVENTS_KEY, JSON.stringify(events.slice(-MAX_EVENTS)));
    if (__DEV__) console.log('[Analytics]', event, properties ?? '');
    enqueueEvent(event, properties);
  } catch {}
}

export async function getEvents(): Promise<AnalyticsEvent[]> {
  try {
    const raw = await AsyncStorage.getItem(EVENTS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export async function clearEvents(): Promise<void> {
  try {
    await AsyncStorage.removeItem(EVENTS_KEY);
  } catch {}
}

// Convenience: funnel completion rate helper
export async function getFunnelStats(): Promise<{
  nicheSet: boolean;
  productSet: boolean;
  supplierSet: boolean;
  costModelSet: boolean;
  brandSet: boolean;
  totalEvents: number;
}> {
  const events = await getEvents();
  const has = (e: FunnelEvent) => events.some(ev => ev.event === e);
  return {
    nicheSet:     has('niche_selected'),
    productSet:   has('product_selected'),
    supplierSet:  has('supplier_selected'),
    costModelSet: has('cost_model_built'),
    brandSet:     has('brand_data_saved'),
    totalEvents:  events.length,
  };
}
