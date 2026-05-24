export interface NicheVerdict {
  label: string;
  color: string;
  score: number;
  reasons: string[];
  warnings: string[];
}

export interface NicheReport {
  keyword: string;
  marketplace: string;
  verdict: NicheVerdict;
  market_snapshot: {
    avg_price: number;
    avg_reviews: number;
    avg_rating: number;
    top_reviews: number;
    total_products: number;
    in_price_range: number;
    low_competition: number;
  };
  the_gap: string[];
  products_to_model: {
    title: string;
    price: number;
    rating: number;
    review_count: number;
    asin: string;
    url: string;
  }[];
  can_you_afford_it: {
    budget: number;
    target_unit_cost: number;
    min_order_cost: number;
    can_afford: boolean;
    verdict: string;
  };
}
