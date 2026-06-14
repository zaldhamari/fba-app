export const APP_VERSION = '1.0.0';
export const BUILD_NUMBER = 1;
export const APP_ENV: 'development' | 'production' = __DEV__ ? 'development' : 'production';

export type FeatureFlag =
  | 'brand_generation'
  | 'label_generation'
  | 'supplier_search'
  | 'ai_copilot'
  | 'ai_recon'
  | 'data_export'
  | 'niche_research';

// Kill switches — set to false to disable a feature if it's broken in production.
// All flags default to true (features enabled).
export const FEATURE_FLAGS: Record<FeatureFlag, boolean> = {
  brand_generation:  true,
  label_generation:  true,
  supplier_search:   true,
  ai_copilot:        true,
  ai_recon:          true,
  data_export:       true,
  niche_research:    true,
};

export function isFeatureEnabled(flag: FeatureFlag): boolean {
  return FEATURE_FLAGS[flag] ?? true;
}
