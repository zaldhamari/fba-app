import type { CurrencyCode, MarketplaceId } from '../context/CurrencyContext';

export interface FreightRateProfile {
  sea:     number; // USD / kg  (LCL / bulk)
  air:     number; // USD / kg
  express: number; // USD / kg
}

export interface DutyRate {
  label: string;
  rate:  number;
}

export interface MarketplaceProfile {
  id:                    MarketplaceId;
  countryLabel:          string;
  currency:              CurrencyCode;
  amazonMarketplace:     string;
  importDutyLabel:       string;
  taxLabel:              string;
  dutyDisclaimer:        string;
  marketplaceDisclaimer: string;
  freightRateProfile:    FreightRateProfile;
  fbaFeeDisclaimer:      string;
  supportsSection301:    boolean;
  vatRate:               number | null; // null = no single rate (e.g. US sales tax)
}

// ─── Per-marketplace import duty rates ───────────────────────────────────────
// Sources: US HTS (USITC), UK Global Tariff (HMRC), EU TARIC, CBSA, GCC tariff schedule.
// All rates are MFN (Most Favoured Nation) — i.e. standard rates for Chinese imports.
// US rates include Section 301 China surcharges where applicable.
// Always verify with a licensed customs broker before importing.

export const DUTY_RATES_BY_MARKET: Record<MarketplaceId, DutyRate[]> = {
  US: [
    { label: 'General',     rate: 0.075 }, // HTS 3926 + Section 301
    { label: 'Kitchen',     rate: 0.075 },
    { label: 'Electronics', rate: 0.150 }, // Section 301 List 3
    { label: 'Clothing',    rate: 0.270 }, // HTS chapter 61/62
    { label: 'Sporting',    rate: 0.100 },
    { label: 'Tools',       rate: 0.090 },
    { label: 'Beauty',      rate: 0.100 },
    { label: 'Pet',         rate: 0.075 },
    { label: 'Toys',        rate: 0.000 }, // HTS 9503 duty-free
    { label: 'Baby',        rate: 0.000 },
  ],
  UK: [
    { label: 'General',     rate: 0.040 }, // UK Global Tariff
    { label: 'Kitchen',     rate: 0.040 },
    { label: 'Electronics', rate: 0.000 }, // Most electronics duty-free under UK GTT
    { label: 'Clothing',    rate: 0.120 }, // UK GTT chapter 61/62
    { label: 'Sporting',    rate: 0.040 },
    { label: 'Tools',       rate: 0.040 },
    { label: 'Beauty',      rate: 0.040 },
    { label: 'Pet',         rate: 0.040 },
    { label: 'Toys',        rate: 0.000 }, // UK GTT 9503 duty-free
    { label: 'Baby',        rate: 0.000 },
  ],
  DE: [
    { label: 'General',     rate: 0.035 }, // EU TARIC MFN
    { label: 'Kitchen',     rate: 0.035 },
    { label: 'Electronics', rate: 0.000 }, // ITA agreement — duty-free
    { label: 'Clothing',    rate: 0.120 }, // EU TARIC chapter 61/62
    { label: 'Sporting',    rate: 0.040 },
    { label: 'Tools',       rate: 0.040 },
    { label: 'Beauty',      rate: 0.065 },
    { label: 'Pet',         rate: 0.035 },
    { label: 'Toys',        rate: 0.000 }, // EU TARIC 9503 duty-free
    { label: 'Baby',        rate: 0.000 },
  ],
  CA: [
    { label: 'General',     rate: 0.065 }, // CBSA MFN — Chinese imports not covered by CPTPP
    { label: 'Kitchen',     rate: 0.065 },
    { label: 'Electronics', rate: 0.000 }, // Duty-free under ITA
    { label: 'Clothing',    rate: 0.180 }, // CBSA chapter 61/62
    { label: 'Sporting',    rate: 0.000 },
    { label: 'Tools',       rate: 0.000 },
    { label: 'Beauty',      rate: 0.000 },
    { label: 'Pet',         rate: 0.000 },
    { label: 'Toys',        rate: 0.000 },
    { label: 'Baby',        rate: 0.000 },
  ],
  AE: [
    { label: 'General',     rate: 0.050 }, // GCC Common External Tariff — flat 5%
    { label: 'Kitchen',     rate: 0.050 },
    { label: 'Electronics', rate: 0.050 },
    { label: 'Clothing',    rate: 0.050 },
    { label: 'Sporting',    rate: 0.050 },
    { label: 'Tools',       rate: 0.050 },
    { label: 'Beauty',      rate: 0.050 },
    { label: 'Pet',         rate: 0.050 },
    { label: 'Toys',        rate: 0.050 },
    { label: 'Baby',        rate: 0.000 }, // Baby goods typically exempt
  ],
  SA: [
    { label: 'General',     rate: 0.050 }, // GCC Common External Tariff — flat 5%
    { label: 'Kitchen',     rate: 0.050 },
    { label: 'Electronics', rate: 0.050 },
    { label: 'Clothing',    rate: 0.050 },
    { label: 'Sporting',    rate: 0.050 },
    { label: 'Tools',       rate: 0.050 },
    { label: 'Beauty',      rate: 0.050 },
    { label: 'Pet',         rate: 0.050 },
    { label: 'Toys',        rate: 0.050 },
    { label: 'Baby',        rate: 0.000 },
  ],
};

export function getDutyRates(marketplace: MarketplaceId): DutyRate[] {
  return DUTY_RATES_BY_MARKET[marketplace] ?? DUTY_RATES_BY_MARKET.US;
}

export const MARKETPLACE_PROFILES: Record<MarketplaceId, MarketplaceProfile> = {
  US: {
    id:                    'US',
    countryLabel:          'United States',
    currency:              'USD',
    amazonMarketplace:     'Amazon.com',
    importDutyLabel:       'US import duty (incl. Section 301)',
    taxLabel:              'Sales tax varies by state',
    dutyDisclaimer:        'Includes Section 301 China tariffs where applicable. Verify HS/HTS code and actual rate with a customs broker before ordering.',
    marketplaceDisclaimer: 'FBA fees are estimates. Verify actual Amazon.com fees in Seller Central — fees vary by size tier and category.',
    freightRateProfile:    { sea: 3.50, air: 7.00, express: 16.00 },
    fbaFeeDisclaimer:      'Verify actual Amazon.com FBA fees in Seller Central.',
    supportsSection301:    true,
    vatRate:               null,
  },
  CA: {
    id:                    'CA',
    countryLabel:          'Canada',
    currency:              'CAD',
    amazonMarketplace:     'Amazon.ca',
    importDutyLabel:       'Estimated Canada import duty (CBSA MFN)',
    taxLabel:              'GST / HST may apply',
    dutyDisclaimer:        'Canadian MFN import duty for goods from China (not covered by CPTPP). GST/HST is collected at point of sale, not import. Verify HS code and CBSA rules before ordering.',
    marketplaceDisclaimer: 'FBA fees are estimates. Amazon.ca fees differ from Amazon.com. Verify actual fees in Seller Central.',
    freightRateProfile:    { sea: 3.50, air: 7.50, express: 17.00 },
    fbaFeeDisclaimer:      'Verify actual Amazon.ca FBA fees in Seller Central — they differ from Amazon.com.',
    supportsSection301:    false,
    vatRate:               0.05,
  },
  UK: {
    id:                    'UK',
    countryLabel:          'United Kingdom',
    currency:              'GBP',
    amazonMarketplace:     'Amazon.co.uk',
    importDutyLabel:       'Estimated UK import duty (UK Global Tariff)',
    taxLabel:              'UK VAT may apply (20%)',
    dutyDisclaimer:        'UK Global Tariff MFN rates. VAT at 20% applies on top of duty at import. Verify commodity code and HMRC rules before ordering.',
    marketplaceDisclaimer: 'FBA fees are estimates. Verify actual Amazon.co.uk fees in Seller Central.',
    freightRateProfile:    { sea: 3.00, air: 7.50, express: 17.00 },
    fbaFeeDisclaimer:      'Verify actual Amazon.co.uk FBA fees in Seller Central.',
    supportsSection301:    false,
    vatRate:               0.20,
  },
  DE: {
    id:                    'DE',
    countryLabel:          'Europe',
    currency:              'EUR',
    amazonMarketplace:     'Amazon EU',
    importDutyLabel:       'Estimated EU import duty (TARIC MFN)',
    taxLabel:              'EU VAT may apply (DE: 19%)',
    dutyDisclaimer:        'EU TARIC MFN rates. German VAT is 19%. Other EU member states vary (FR/IT: 20%, ES: 21%). Verify HS code via EU TARIC before ordering.',
    marketplaceDisclaimer: 'FBA fees are estimates. Verify actual Amazon EU fees in Seller Central.',
    freightRateProfile:    { sea: 3.00, air: 8.00, express: 18.00 },
    fbaFeeDisclaimer:      'Verify actual Amazon EU FBA fees in Seller Central.',
    supportsSection301:    false,
    vatRate:               0.19,
  },
  AE: {
    id:                    'AE',
    countryLabel:          'UAE',
    currency:              'AED',
    amazonMarketplace:     'Amazon.ae',
    importDutyLabel:       'Estimated UAE import duty (GCC tariff — 5%)',
    taxLabel:              'UAE VAT may apply (5%)',
    dutyDisclaimer:        'UAE applies a flat 5% GCC Common External Tariff on most goods. Baby goods are typically exempt. Verify HS code and UAE FTA rules before ordering.',
    marketplaceDisclaimer: 'FBA fees are estimates. Verify actual Amazon.ae fees in Seller Central.',
    freightRateProfile:    { sea: 2.50, air: 6.50, express: 15.00 },
    fbaFeeDisclaimer:      'Verify actual Amazon.ae FBA fees in Seller Central.',
    supportsSection301:    false,
    vatRate:               0.05,
  },
  SA: {
    id:                    'SA',
    countryLabel:          'Saudi Arabia',
    currency:              'SAR',
    amazonMarketplace:     'Amazon.sa',
    importDutyLabel:       'Estimated Saudi import duty (GCC tariff — 5%)',
    taxLabel:              'VAT may apply (15%)',
    dutyDisclaimer:        'Saudi Arabia applies a flat 5% GCC Common External Tariff on most goods. VAT at 15% applies separately. Verify HS code and ZATCA rules before ordering.',
    marketplaceDisclaimer: 'FBA fees are estimates. Verify actual Amazon.sa fees in Seller Central.',
    freightRateProfile:    { sea: 2.50, air: 6.50, express: 15.00 },
    fbaFeeDisclaimer:      'Verify actual Amazon.sa FBA fees in Seller Central.',
    supportsSection301:    false,
    vatRate:               0.15,
  },
};

export function getMarketplaceProfile(id: MarketplaceId): MarketplaceProfile {
  return MARKETPLACE_PROFILES[id] ?? MARKETPLACE_PROFILES.US;
}
