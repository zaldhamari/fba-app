/**
 * Lightweight runtime validators for backend API responses.
 *
 * Goal: prevent crashes when the backend returns an unexpected shape.
 * Strategy: check that critical fields exist and have the right type;
 * throw a typed ApiValidationError so callers can show a friendly message.
 */

export class ApiValidationError extends Error {
  constructor(endpoint: string, detail: string) {
    super(`[${endpoint}] Unexpected response shape: ${detail}`);
    this.name = 'ApiValidationError';
  }
}

function has(obj: unknown, key: string): boolean {
  return typeof obj === 'object' && obj !== null && key in obj;
}

function isArr(obj: unknown, key: string): boolean {
  return has(obj, key) && Array.isArray((obj as Record<string, unknown>)[key]);
}

function isObj(obj: unknown, key: string): boolean {
  return has(obj, key) && typeof (obj as Record<string, unknown>)[key] === 'object'
    && (obj as Record<string, unknown>)[key] !== null;
}

export function validateSearchAmazon(data: unknown): asserts data is { products: unknown[]; trends: unknown; keyword: string } {
  if (!isArr(data, 'products')) throw new ApiValidationError('/research/amazon', 'missing products array');
}

export function validateSearchNiche(data: unknown): asserts data is object {
  if (!has(data, 'verdict')) throw new ApiValidationError('/research/niche', 'missing verdict');
  if (!isObj(data, 'market_snapshot')) throw new ApiValidationError('/research/niche', 'missing market_snapshot');
}

export function validateCreateBrand(data: unknown): asserts data is { brand_name: string; logo_svg: string; tagline: string; listing: object; name_options: string[] } {
  if (!has(data, 'brand_name') || typeof (data as Record<string, unknown>)['brand_name'] !== 'string')
    throw new ApiValidationError('/brand/create', 'missing brand_name string');
  if (!has(data, 'logo_svg') || typeof (data as Record<string, unknown>)['logo_svg'] !== 'string')
    throw new ApiValidationError('/brand/create', 'missing logo_svg string');
  if (!isObj(data, 'listing')) throw new ApiValidationError('/brand/create', 'missing listing object');
}

export function validateCreateLabel(data: unknown): asserts data is { label_svg: string; insert_svg: string } {
  if (!has(data, 'label_svg') || typeof (data as Record<string, unknown>)['label_svg'] !== 'string')
    throw new ApiValidationError('/brand/label', 'missing label_svg string');
  if (!has(data, 'insert_svg') || typeof (data as Record<string, unknown>)['insert_svg'] !== 'string')
    throw new ApiValidationError('/brand/label', 'missing insert_svg string');
}

export function validateAnalyzeCopilot(data: unknown): asserts data is { verdict: string; summary: string } {
  if (!has(data, 'verdict')) throw new ApiValidationError('/ai/copilot', 'missing verdict');
  if (!has(data, 'summary')) throw new ApiValidationError('/ai/copilot', 'missing summary');
}

export function validateAnalyzeReviews(data: unknown): asserts data is { top_complaints: string[]; opportunities: string[] } {
  if (!isArr(data, 'top_complaints')) throw new ApiValidationError('/ai/reviews', 'missing top_complaints array');
  if (!isArr(data, 'opportunities'))  throw new ApiValidationError('/ai/reviews', 'missing opportunities array');
}

export function validateEstimateFreight(data: unknown): asserts data is { modes: object; recommended: string } {
  if (!isObj(data, 'modes'))    throw new ApiValidationError('/research/freight', 'missing modes object');
  if (!has(data, 'recommended')) throw new ApiValidationError('/research/freight', 'missing recommended');
}

export function validateSearchSuppliers(data: unknown): asserts data is { suppliers: unknown[] } {
  if (!isArr(data, 'suppliers')) throw new ApiValidationError('/research/suppliers', 'missing suppliers array');
}

export function validateAnalyzeProduct(data: unknown): asserts data is { verdict: string; summary: string } {
  if (!has(data, 'verdict')) throw new ApiValidationError('/ai/analyze-product', 'missing verdict');
  if (!has(data, 'summary')) throw new ApiValidationError('/ai/analyze-product', 'missing summary');
}

export function validateAnalyticsIngest(data: unknown): asserts data is { accepted: number } {
  if (!has(data, 'accepted')) throw new ApiValidationError('/analytics/events', 'missing accepted count');
}
