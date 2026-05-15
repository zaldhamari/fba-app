export type Marketplace = 'US' | 'UK' | 'DE' | 'CA' | 'AU';
export type ExperienceLevel = 'beginner' | 'some' | 'selling';
export type CompetitionThreshold = 100 | 300 | 500 | 1000;

export interface SellerProfile {
  marketplace:          Marketplace;
  experience:           ExperienceLevel;
  budget:               number;          // total inventory budget in USD equivalent
  priceMin:             number;          // target selling price min
  priceMax:             number;          // target selling price max
  maxTopSellerReviews:  CompetitionThreshold;
  completedAt:          string;
}

export interface ResearchFilters {
  marketplace:        Marketplace;
  priceMin:           number;
  priceMax:           number;
  maxTopSellerReviews:number;
  category:           string;
  minRating:          number;
  maxRating:          number;
  maxMOQ:             number;
  maxUnitPrice:       number;
  sourcingPlatforms:  string[];
}

export const MARKETPLACE_LABELS: Record<Marketplace, { flag: string; label: string; currency: string }> = {
  US: { flag: '🇺🇸', label: 'United States', currency: 'USD' },
  UK: { flag: '🇬🇧', label: 'United Kingdom', currency: 'GBP' },
  DE: { flag: '🇩🇪', label: 'Germany',        currency: 'EUR' },
  CA: { flag: '🇨🇦', label: 'Canada',         currency: 'CAD' },
  AU: { flag: '🇦🇺', label: 'Australia',      currency: 'AUD' },
};

export function profileToFilters(p: SellerProfile): ResearchFilters {
  const maxUnitPrice = Math.round(p.priceMin * 0.28); // 28% of min sell price = unit cost target
  const maxMOQ       = p.budget > 2500 ? 500 : p.budget > 1000 ? 200 : 100;
  return {
    marketplace:         p.marketplace,
    priceMin:            p.priceMin,
    priceMax:            p.priceMax,
    maxTopSellerReviews: p.maxTopSellerReviews,
    category:            '',
    minRating:           0,
    maxRating:           5,
    maxMOQ,
    maxUnitPrice,
    sourcingPlatforms:   ['Alibaba', 'DHgate', '1688 (Domestic China)'],
  };
}
