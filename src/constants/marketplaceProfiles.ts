import type { CurrencyCode, MarketplaceId } from '../context/CurrencyContext';

export interface FreightRateProfile {
  sea:     number; // USD / kg  (LCL / bulk)
  air:     number; // USD / kg
  express: number; // USD / kg
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

export const MARKETPLACE_PROFILES: Record<MarketplaceId, MarketplaceProfile> = {
  US: {
    id:                    'US',
    countryLabel:          'United States',
    currency:              'USD',
    amazonMarketplace:     'Amazon.com',
    importDutyLabel:       'Estimated US import duty',
    taxLabel:              'Sales tax varies by state',
    dutyDisclaimer:        'Includes Section 301 China tariffs where applicable. Verify HS/HTS code and actual rate with a customs broker before ordering.',
    marketplaceDisclaimer: 'FBA fees are estimates. Verify actual Amazon.com fees in Seller Central — fees vary by size tier and category.',
    freightRateProfile:    { sea: 2.50, air: 7.00, express: 16.00 },
    fbaFeeDisclaimer:      'Verify actual Amazon.com FBA fees in Seller Central.',
    supportsSection301:    true,
    vatRate:               null,
  },
  CA: {
    id:                    'CA',
    countryLabel:          'Canada',
    currency:              'CAD',
    amazonMarketplace:     'Amazon.ca',
    importDutyLabel:       'Estimated Canada import duty',
    taxLabel:              'GST / HST may apply',
    dutyDisclaimer:        'Canadian import duty and GST/HST planning estimate. Rates are based on CBSA schedules and differ from US Section 301 tariffs. Verify HS code and CBSA rules before ordering.',
    marketplaceDisclaimer: 'FBA fees are estimates. Amazon.ca fees differ from Amazon.com. Verify actual fees in Seller Central.',
    freightRateProfile:    { sea: 2.75, air: 7.50, express: 17.00 },
    fbaFeeDisclaimer:      'Verify actual Amazon.ca FBA fees in Seller Central — they differ from Amazon.com.',
    supportsSection301:    false,
    vatRate:               0.05,
  },
  UK: {
    id:                    'UK',
    countryLabel:          'United Kingdom',
    currency:              'GBP',
    amazonMarketplace:     'Amazon.co.uk',
    importDutyLabel:       'Estimated UK import duty',
    taxLabel:              'UK VAT may apply (20%)',
    dutyDisclaimer:        'UK import duty and VAT planning estimate. Verify commodity code and HMRC rules before ordering.',
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
    importDutyLabel:       'Estimated EU import duty',
    taxLabel:              'EU VAT may apply',
    dutyDisclaimer:        'EU import duty and VAT planning estimate. Rates vary by member state and HS code. Verify before ordering.',
    marketplaceDisclaimer: 'FBA fees are estimates. Verify actual Amazon EU fees in Seller Central.',
    freightRateProfile:    { sea: 3.00, air: 8.00, express: 18.00 },
    fbaFeeDisclaimer:      'Verify actual Amazon EU FBA fees in Seller Central.',
    supportsSection301:    false,
    vatRate:               0.20,
  },
  AE: {
    id:                    'AE',
    countryLabel:          'UAE',
    currency:              'AED',
    amazonMarketplace:     'Amazon.ae',
    importDutyLabel:       'Estimated UAE import duty',
    taxLabel:              'UAE VAT may apply (5%)',
    dutyDisclaimer:        'UAE customs duty and VAT planning estimate. Verify HS code and UAE FTA rules before ordering.',
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
    importDutyLabel:       'Estimated Saudi import duty',
    taxLabel:              'VAT may apply (15%)',
    dutyDisclaimer:        'Saudi customs duty and VAT planning estimate. Verify HS code and ZATCA rules before ordering.',
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
