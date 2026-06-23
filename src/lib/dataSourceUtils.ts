/**
 * Utilities for determining and displaying data source information across the app.
 */

export type DataSourceType = 'stub' | 'ai_estimate' | 'fallback_estimate' | 'keyword_estimate' | 'confirmed' | 'dataforseo' | 'alibaba_api';

/**
 * Determines the overall "data source category" for a screen or result set.
 *
 * Real data sources (dataforseo, alibaba_api) → 'confirmed'
 * AI estimates → 'ai_estimate'
 * Fallback/stub estimates → 'stub' or 'keyword_estimate'
 *
 * If mixed sources in an array, returns the "worst" (least trustworthy) source:
 * real > ai > fallback > stub > keyword_estimate
 */
export function determineOverallDataSource(sources: (string | undefined)[]): DataSourceType {
  if (sources.length === 0) return 'stub';

  const unique = Array.from(new Set(sources.filter(Boolean)));
  if (unique.length === 0) return 'stub';

  // Priority: anything real is best
  if (unique.includes('dataforseo') || unique.includes('alibaba_api')) return 'confirmed';
  if (unique.includes('ai_estimate')) return 'ai_estimate';
  if (unique.includes('fallback_estimate')) return 'fallback_estimate';
  if (unique.includes('keyword_estimate')) return 'keyword_estimate';
  return 'stub';
}

/**
 * Returns true if data source should show a prominent warning banner to the user.
 * (Real data doesn't need a banner; estimates and stubs do.)
 */
export function shouldShowDataSourceBanner(source: DataSourceType): boolean {
  return source !== 'confirmed';
}

/**
 * Returns true if data is real/confirmed (from a real API source).
 */
export function isRealData(source?: string): boolean {
  return source === 'dataforseo' || source === 'alibaba_api';
}

/**
 * Returns true if data is an AI estimate (vs stub/fallback).
 */
export function isAIEstimate(source?: string): boolean {
  return source === 'ai_estimate';
}

/**
 * Returns true if data is fabricated/stub.
 */
export function isStubData(source?: string): boolean {
  return !source || source === 'stub' || source === 'keyword_estimate' || source === 'fallback_estimate';
}
