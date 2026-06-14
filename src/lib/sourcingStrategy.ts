import { PLATFORMS, SourcingPlatform } from '../data/sourcingPlatforms';
import { PipelineProduct, PipelineSupplier } from '../context/PipelineContext';

export type FreightSensitivity = 'Low' | 'Medium' | 'High' | 'Extreme';
export type SourcingDifficulty = 'Beginner' | 'Intermediate' | 'Advanced';
export type MarginRisk = 'Low' | 'Medium' | 'High';
export type FreightMode = 'sea' | 'air' | 'local' | 'hybrid';

export interface SourcingStrategyInputs {
  product:                 PipelineProduct | null;
  selectedSupplier:        PipelineSupplier | null;
  supplierQuotes:          PipelineSupplier[];
  confirmedFreightPerUnit: number | null;
  weightKgEstimate?:       number;
  marketplace:             string;
  isBeginnerSeller?:       boolean;
}

export interface RecommendedPlatform {
  platform:    SourcingPlatform;
  score:       number;
  why:         string;
  difficulty:  SourcingDifficulty;
  marginFit:   'Great' | 'Good' | 'Fair';
  freightFit:  'Great' | 'Good' | 'Fair' | 'Poor';
  isLive:      boolean;
}

export interface RecommendedRegion {
  id:                string;
  name:              string;
  flag:              string;
  shippingSpeed:     'Fast' | 'Medium' | 'Slow';
  freightRisk:       'Low' | 'Medium' | 'High';
  tariffExposure:    'Low' | 'Medium' | 'High';
  qualityNote:       string;
  beginnerFriendly:  boolean;
  why:               string;
}

export interface SourcingStrategyResult {
  recommendedPlatforms:  RecommendedPlatform[];
  recommendedRegions:    RecommendedRegion[];
  freightSensitivity:    FreightSensitivity;
  freightStrategy:       string;
  freightStrategyMode:   FreightMode;
  sourcingDifficulty:    SourcingDifficulty;
  sourcingSummary:       string;
  riskWarnings:          string[];
  beginnerNotes:         string[];
  advancedNotes:         string[];
  estimatedMarginRisk:   MarginRisk;
  estimatedFreightRisk:  MarginRisk;
  usingConfirmedFreight: boolean;
  certificationRisk:     boolean;
  fragilityRisk:         boolean;
}

export type CategoryFlags = {
  // Electronics (split by radio vs passive for certification accuracy)
  electronics:         boolean;  // union: radioElectronics || nonRadioElectronics
  radioElectronics:    boolean;  // intentional radiators → FCC Part 15A / Complex
  nonRadioElectronics: boolean;  // passive electronics → FCC Part 15B / Standard self-decl
  // Physical attributes
  fragile:             boolean;
  large:               boolean;
  textile:             boolean;
  // Food categories (split for compliance accuracy)
  food:                boolean;  // broad backward-compat flag
  foodContact:         boolean;  // kitchen/tableware needing FDA food-contact docs
  supplement:          boolean;  // vitamins/protein/nutraceuticals
  cosmetic:            boolean;  // beauty/personal care products
  // Child/toy
  toy:                 boolean;
  babyProduct:         boolean;  // baby/child items (broader than toy)
  // Fitness
  fitness:             boolean;  // resistance bands, gym equipment
  smallGoods:          boolean;
};

// Intentional radiators — require FCC Part 15A lab testing ($3k–$6k)
const RADIO_KEYWORDS = [
  'bluetooth','wireless','wifi','wi-fi','zigbee','cellular','smart plug',
  'smart bulb','smart switch','smart hub','smart home','smart watch',
  'smartwatch','rf transmitter','rf receiver','nfc enabled',
];

// Passive electronics — FCC Part 15B self-declaration only (~$800–$1,500)
const NON_RADIO_ELECTRONICS_KEYWORDS = [
  'usb','led','charger','wired speaker','desk lamp','table lamp','floor lamp',
  'power bank','battery pack','battery charger','adapter','digital display',
  'electronic','device','camera','headphone','cable','converter','transformer',
];

// All electronics (union — kept for backward compat in freightSensitivity)
const ELECTRONICS_KEYWORDS = [...RADIO_KEYWORDS, ...NON_RADIO_ELECTRONICS_KEYWORDS, 'speaker','headphone','camera','digital','device'];

const FRAGILE_KEYWORDS     = ['glass','ceramic','porcelain','mirror','crystal','vase'];
const LARGE_KEYWORDS       = ['furniture','chair','table','desk','shelf','cabinet','sofa','mattress','lamp','ladder'];
const TEXTILE_KEYWORDS     = ['clothing','shirt','dress','pants','jacket','fabric','garment','apparel','bag','backpack'];

// Food-contact kitchen/tableware items — need FDA 21 CFR food-contact docs from supplier
const FOOD_CONTACT_KEYWORDS = [
  'spatula','spoon','ladle','tong','tongs','food container','meal prep',
  'lunch box','bento box','baking mat','baking mold','silicone mold',
  'cutting board','chopping board','colander','strainer','mixing bowl',
  'salad bowl','food storage','water bottle','sippy cup','food prep',
  'cookware','dinnerware','tableware','silicone baking','silicone kitchen',
  'food grade','kitchen utensil','utensil set',
];

// Vitamins, protein, nutraceuticals — need GMP/COA, NOT $0 FDA registration
const SUPPLEMENT_KEYWORDS = [
  'supplement','vitamin','protein powder','probiotic','collagen','omega',
  'garcinia','fat burner','pre-workout','pre workout','creatine','bcaa',
  'whey','keto','magnesium supplement','zinc supplement','iron supplement',
  'melatonin','turmeric capsule','fish oil',
];

const FOOD_KEYWORDS = [...SUPPLEMENT_KEYWORDS, 'food','snack','drink','health','nutrition'];

// Toys & children
const TOY_KEYWORDS = ['toy','game','puzzle','kids','children','play','educational'];

// Baby/infant — broader than toy, includes non-toy items
const BABY_KEYWORDS = [
  'baby','infant','toddler','newborn','nursery','teething','pacifier',
  'swaddle','diaper','stroller','baby bottle','baby monitor','baby gate',
  'baby carrier','baby wipes','baby food',
];

// Fitness equipment — resistance bands etc.
const FITNESS_KEYWORDS = [
  'resistance band','fitness band','workout band','exercise band','latex band',
  'loop band','yoga band','gym band','resistance tube','pull up band',
  'pull-up band','booty band','mini band','resistance set','exercise loop',
  'stretch band','resistance loop',
];

const COSMETIC_KEYWORDS = [
  'serum','moisturizer','moisturiser','face cream','facial cream','toner',
  'face wash','cleanser','concealer','mascara','lipstick','foundation',
  'blush','eyeliner','eyeshadow','nail polish','shampoo','conditioner',
  'sunscreen','face mask','body lotion','body butter',
];

const SMALL_GOODS_KEYWORDS = ['silicone','plastic','rubber','kitchen','organizer','hook','clip','strap'];

export function inferCategories(title: string): CategoryFlags {
  const lower = title.toLowerCase();
  const radio    = RADIO_KEYWORDS.some(k => lower.includes(k));
  const nonRadio = NON_RADIO_ELECTRONICS_KEYWORDS.some(k => lower.includes(k));
  const isBaby   = BABY_KEYWORDS.some(k => lower.includes(k));
  const isToy    = TOY_KEYWORDS.some(k => lower.includes(k));
  return {
    radioElectronics:    radio,
    nonRadioElectronics: nonRadio,
    electronics:         radio || nonRadio || ELECTRONICS_KEYWORDS.some(k => lower.includes(k)),
    fragile:             FRAGILE_KEYWORDS.some(k => lower.includes(k)),
    large:               LARGE_KEYWORDS.some(k => lower.includes(k)),
    textile:             TEXTILE_KEYWORDS.some(k => lower.includes(k)),
    food:                FOOD_KEYWORDS.some(k => lower.includes(k)),
    foodContact:         FOOD_CONTACT_KEYWORDS.some(k => lower.includes(k)),
    supplement:          SUPPLEMENT_KEYWORDS.some(k => lower.includes(k)),
    cosmetic:            COSMETIC_KEYWORDS.some(k => lower.includes(k)),
    toy:                 isToy || isBaby,  // babies always get toy-level cert scrutiny
    babyProduct:         isBaby,
    fitness:             FITNESS_KEYWORDS.some(k => lower.includes(k)),
    smallGoods:          SMALL_GOODS_KEYWORDS.some(k => lower.includes(k)),
  };
}

export function computeFreightSensitivity(
  weight: number | undefined,
  price: number | undefined,
  categories: CategoryFlags,
): FreightSensitivity {
  let score = 30;

  if (weight !== undefined) {
    if (weight < 0.3)      score = 10;
    else if (weight < 0.8) score = 25;
    else if (weight < 2.0) score = 50;
    else                   score = 80;
  }

  if (price !== undefined) {
    if (price > 50)      score -= 15;
    else if (price > 30) score -= 8;
    else if (price < 15) score += 20;
  }

  if (categories.fragile) score += 25;
  if (categories.large)   score += 40;
  if (categories.electronics) score += 5;
  if (categories.smallGoods)  score -= 10;

  if (score < 20)  return 'Low';
  if (score < 45)  return 'Medium';
  if (score < 70)  return 'High';
  return 'Extreme';
}

function platformDifficulty(p: SourcingPlatform): SourcingDifficulty {
  if (!p.beginnerFriendly) return 'Advanced';
  if (p.communicationDifficulty === 'Difficult') return 'Advanced';
  if (p.communicationDifficulty === 'Moderate')  return 'Intermediate';
  return 'Beginner';
}

function platformMarginFit(p: SourcingPlatform, price: number | undefined): 'Great' | 'Good' | 'Fair' {
  if (p.id === '1688' || p.id === 'yiwugo') return 'Great';
  if (p.id === 'aliexpress' || p.id === 'dhgate') {
    if (price !== undefined && price < 20) return 'Fair';
    return 'Good';
  }
  if (p.premiumQuality) return 'Good';
  return 'Good';
}

function platformFreightFit(p: SourcingPlatform, sensitivity: FreightSensitivity): 'Great' | 'Good' | 'Fair' | 'Poor' {
  if (p.id === 'local-wholesalers') {
    return sensitivity === 'Extreme' ? 'Great' : 'Good';
  }
  const riskMap: Record<string, number> = { Low: 0, Medium: 1, High: 2, Extreme: 3 };
  const sensMap: Record<FreightSensitivity, number> = { Low: 0, Medium: 1, High: 2, Extreme: 3 };
  const diff = riskMap[p.freightRisk] + sensMap[sensitivity];
  if (diff <= 1) return 'Great';
  if (diff <= 2) return 'Good';
  if (diff <= 4) return 'Fair';
  return 'Poor';
}

function buildPlatformWhy(
  p: SourcingPlatform,
  productTitle: string,
  categories: CategoryFlags,
  sensitivity: FreightSensitivity,
  price: number | undefined,
  marketplace: string,
  hasSupplier: boolean,
): string {
  const titleSnippet = productTitle.length > 40 ? productTitle.slice(0, 40) + '…' : productTitle;

  if (p.id === 'alibaba') {
    return `Alibaba's Trade Assurance escrow makes it the safest starting point for "${titleSnippet}". Largest verified manufacturer directory regardless of category.`;
  }
  if (p.id === '1688') {
    const priceNote = price !== undefined && price < 25
      ? 'factory-direct pricing can recover 20–40% margin on a low-price product like this'
      : 'factory-direct pricing significantly undercuts export-listed Alibaba prices';
    return `1688 offers ${priceNote}. Requires a sourcing agent but is the highest-leverage cost move for "${titleSnippet}".`;
  }
  if (p.id === 'global-sources') {
    return `Global Sources has stricter supplier vetting than Alibaba and is the leading directory for electronics like "${titleSnippet}". Reduces compliance and quality risk.`;
  }
  if (p.id === 'indiamart') {
    return `IndiaMART suppliers specialise in textiles and handcrafted goods — a strong fit for "${titleSnippet}". English-speaking and export-oriented with lower tariff exposure than China.`;
  }
  if (p.id === 'turkey-suppliers') {
    return `Turkey's proximity to ${marketplace} cuts lead times to 2–3 weeks versus 6–8 from China — a meaningful freight advantage for "${titleSnippet}".`;
  }
  if (p.id === 'local-wholesalers') {
    return `With ${sensitivity} freight sensitivity, local wholesalers eliminate overseas shipping entirely — zero freight cost and no customs duties for "${titleSnippet}".`;
  }
  if (p.id === 'sourcing-agents') {
    return `High freight sensitivity on "${titleSnippet}" increases sourcing complexity — a sourcing agent handles factory negotiations, QC, and export logistics to reduce risk.`;
  }
  if (p.id === 'dhgate' || p.id === 'aliexpress') {
    const phase = hasSupplier ? 'Use for competitive price benchmarking' : 'Ideal for ordering samples';
    return `${phase} of "${titleSnippet}" before committing to a bulk order. Ultra-low MOQ removes upfront risk.`;
  }
  if (p.id === 'vietnam-suppliers') {
    return `Vietnam carries significantly lower US tariff exposure than China — a direct margin benefit for "${titleSnippet}" shipped to the ${marketplace} marketplace.`;
  }

  return `${p.name} is a strong fit for "${titleSnippet}" — ${p.whyChoose.toLowerCase()}`;
}

function scorePlatform(
  p: SourcingPlatform,
  inputs: SourcingStrategyInputs,
  categories: CategoryFlags,
  sensitivity: FreightSensitivity,
): number {
  const { product, selectedSupplier, isBeginnerSeller, marketplace } = inputs;
  const price = product?.price;
  const hasSupplier = selectedSupplier !== null;
  let score = 40;

  if (p.id === 'alibaba') {
    score = 60;
  }

  if (p.id === '1688') {
    if ((price !== undefined && price < 25) || !isBeginnerSeller) score += 20;
  }

  if (p.id === 'global-sources' && categories.electronics) {
    score += 30;
  }

  if (p.id === 'indiamart' && categories.textile) {
    score += 30;
  }

  if (p.id === 'vietnam-suppliers' && marketplace === 'US') {
    score += 25;
  }

  const euMarkets = ['UK', 'DE', 'EU', 'FR', 'IT', 'ES'];
  if (p.id === 'turkey-suppliers' && euMarkets.includes(marketplace)) {
    score += 25;
  }

  if (p.id === 'local-wholesalers' && sensitivity === 'Extreme') {
    score += 40;
  }

  if (p.id === 'sourcing-agents' && (sensitivity === 'High' || sensitivity === 'Extreme')) {
    score += 20;
  }

  if ((p.id === 'dhgate' || p.id === 'aliexpress') && hasSupplier) {
    score -= 20;
  }

  if (isBeginnerSeller && !p.beginnerFriendly) {
    score -= 30;
  }

  return Math.max(0, Math.min(100, score));
}

const ALL_REGIONS: RecommendedRegion[] = [
  {
    id: 'china',
    name: 'China',
    flag: '🇨🇳',
    shippingSpeed: 'Slow',
    freightRisk: 'Medium',
    tariffExposure: 'High',
    qualityNote: 'Largest manufacturing base with full supply chain infrastructure',
    beginnerFriendly: true,
    why: 'Default sourcing hub for most FBA products — widest platform coverage',
  },
  {
    id: 'vietnam',
    name: 'Vietnam',
    flag: '🇻🇳',
    shippingSpeed: 'Slow',
    freightRisk: 'Medium',
    tariffExposure: 'Low',
    qualityNote: 'Growing manufacturing base with strong apparel, furniture, and electronics assembly capability',
    beginnerFriendly: false,
    why: 'Significantly lower US tariff exposure than China — key advantage for US marketplace sellers',
  },
  {
    id: 'india',
    name: 'India',
    flag: '🇮🇳',
    shippingSpeed: 'Medium',
    freightRisk: 'Medium',
    tariffExposure: 'Low',
    qualityNote: 'World-class textiles, leather, and handcrafted goods with English-speaking suppliers',
    beginnerFriendly: true,
    why: 'Strong for textile and handcraft categories with competitive pricing and lower tariff risk',
  },
  {
    id: 'turkey',
    name: 'Turkey',
    flag: '🇹🇷',
    shippingSpeed: 'Fast',
    freightRisk: 'Low',
    tariffExposure: 'Low',
    qualityNote: 'Premium textile and leather quality; geographic proximity makes it the fastest supplier region for EU sellers',
    beginnerFriendly: true,
    why: '2–3 week delivery to EU versus 6–8 weeks from China — ideal for EU Amazon sellers',
  },
  {
    id: 'local',
    name: 'Local / Domestic',
    flag: '🏪',
    shippingSpeed: 'Fast',
    freightRisk: 'Low',
    tariffExposure: 'Low',
    qualityNote: 'No international freight or customs — best for bulky, heavy, or perishable goods',
    beginnerFriendly: true,
    why: 'Eliminates overseas shipping costs entirely — the only viable option when freight would destroy margin',
  },
];

function buildRegions(
  categories: CategoryFlags,
  sensitivity: FreightSensitivity,
  marketplace: string,
): RecommendedRegion[] {
  const regions: RecommendedRegion[] = [];
  const euMarkets = ['UK', 'DE', 'EU', 'FR', 'IT', 'ES'];

  regions.push(ALL_REGIONS.find(r => r.id === 'china')!);

  if (marketplace === 'US' && !categories.electronics) {
    regions.push(ALL_REGIONS.find(r => r.id === 'vietnam')!);
  }

  if (categories.textile) {
    regions.push(ALL_REGIONS.find(r => r.id === 'india')!);
  }

  if (euMarkets.includes(marketplace)) {
    regions.push(ALL_REGIONS.find(r => r.id === 'turkey')!);
  } else if (categories.textile && !regions.find(r => r.id === 'india')) {
    regions.push(ALL_REGIONS.find(r => r.id === 'india')!);
  }

  if (sensitivity === 'Extreme' && categories.large) {
    regions.push(ALL_REGIONS.find(r => r.id === 'local')!);
  }

  const unique = regions.filter((r, i, arr) => arr.findIndex(x => x.id === r.id) === i);
  return unique.slice(0, 4);
}

function buildRiskWarnings(
  sensitivity: FreightSensitivity,
  inputs: SourcingStrategyInputs,
  certRisk: boolean,
  fragRisk: boolean,
  categories: CategoryFlags,
): string[] {
  const warnings: string[] = [];

  if (sensitivity === 'High' || sensitivity === 'Extreme') {
    warnings.push('Freight costs are a significant margin factor for this product — get confirmed quotes before committing to a supplier.');
  }

  if (inputs.confirmedFreightPerUnit === null) {
    warnings.push('Using estimated freight costs — actual landed cost may differ. Confirm with a freight forwarder before ordering.');
  }

  if (certRisk) {
    warnings.push('Electronics and toy products may require certifications (CE, FCC, CPSC) — factor compliance costs into your margin model.');
  }

  if (fragRisk) {
    warnings.push('Fragile products carry elevated transit damage risk — budget for breakage and request reinforced packaging from your supplier.');
  }

  if (
    inputs.product?.competition === 'High' &&
    inputs.supplierQuotes.length < 2
  ) {
    warnings.push('High competition market detected — get at least 2–3 supplier quotes to ensure your unit cost is competitive.');
  }

  if (inputs.selectedSupplier && inputs.selectedSupplier.moq > 500) {
    warnings.push(`Selected supplier MOQ is ${inputs.selectedSupplier.moq} units — significant capital commitment. Validate demand before placing the order.`);
  }

  return warnings.slice(0, 4);
}

function buildFreightStrategy(sensitivity: FreightSensitivity, categories: CategoryFlags): { text: string; mode: FreightMode } {
  switch (sensitivity) {
    case 'Low':
      return {
        text: 'Sea freight recommended — lightweight product makes sea the cost-effective default.',
        mode: 'sea',
      };
    case 'Medium':
      return {
        text: 'Sea freight for cost, air freight for speed. Confirm per-unit cost with forwarder.',
        mode: 'sea',
      };
    case 'High':
      return {
        text: 'Freight is a significant margin factor. Get confirmed quotes before committing to a supplier.',
        mode: 'hybrid',
      };
    case 'Extreme':
      if (categories.large) {
        return {
          text: 'Local sourcing or regional suppliers may outperform overseas. Sea freight only — air would destroy margin.',
          mode: 'local',
        };
      }
      return {
        text: 'Local sourcing or regional suppliers may outperform overseas. Sea freight only — air would destroy margin.',
        mode: 'sea',
      };
  }
}

function buildDifficulty(
  sensitivity: FreightSensitivity,
  certRisk: boolean,
  fragRisk: boolean,
  categories: CategoryFlags,
): SourcingDifficulty {
  if (
    sensitivity === 'High' ||
    sensitivity === 'Extreme' ||
    certRisk ||
    fragRisk ||
    categories.electronics
  ) {
    return 'Advanced';
  }
  if (sensitivity === 'Low' && !certRisk && !fragRisk) {
    return 'Beginner';
  }
  return 'Intermediate';
}

function buildSummary(
  inputs: SourcingStrategyInputs,
  sensitivity: FreightSensitivity,
  difficulty: SourcingDifficulty,
  categories: CategoryFlags,
): string {
  const title = inputs.product?.title ?? 'this product';
  const short = title.length > 35 ? title.slice(0, 35) + '…' : title;
  const mktLabel = inputs.marketplace || 'your marketplace';

  let categoryNote = '';
  if (categories.electronics) categoryNote = 'Electronics sourcing adds certification requirements. ';
  else if (categories.textile) categoryNote = 'Textiles offer strong multi-region sourcing options. ';
  else if (categories.fragile) categoryNote = 'Fragile items require careful packaging planning. ';
  else if (categories.large)   categoryNote = 'Bulky products make freight the primary cost lever. ';

  return `"${short}" is a ${difficulty.toLowerCase()}-level sourcing project for the ${mktLabel} marketplace with ${sensitivity.toLowerCase()} freight sensitivity. ${categoryNote}Focus on confirming landed cost before placing your first bulk order.`.trim();
}

function buildBeginnerNotes(
  sensitivity: FreightSensitivity,
  categories: CategoryFlags,
  marketplace: string,
): string[] {
  const notes = [
    'Start with 1–3 supplier samples from Alibaba or DHgate before placing any bulk order — never skip sample validation.',
    'Request an all-in landed cost quote (product + freight + duties) from your freight forwarder before committing to a MOQ.',
  ];
  return notes;
}

function buildAdvancedNotes(
  categories: CategoryFlags,
  sensitivity: FreightSensitivity,
  marketplace: string,
): string[] {
  const notes: string[] = [];

  if (marketplace === 'US' && !categories.electronics) {
    notes.push('Vietnam sourcing can reduce US import tariff exposure by 30–60% compared to equivalent Chinese-made goods — worth modelling if margins are tight.');
  } else {
    notes.push('1688 factory-direct pricing typically undercuts Alibaba by 20–40% for the same product — use a sourcing agent to bridge the language and export gap.');
  }

  if (sensitivity === 'High' || sensitivity === 'Extreme') {
    notes.push('Negotiate DDP (Delivered Duty Paid) terms with your freight forwarder to fix total landed cost and eliminate currency and tariff surprises.');
  }

  return notes.slice(0, 2);
}

export function computeSourcingStrategy(inputs: SourcingStrategyInputs): SourcingStrategyResult {
  const { product, selectedSupplier, supplierQuotes, confirmedFreightPerUnit, weightKgEstimate, marketplace, isBeginnerSeller } = inputs;

  const categories = inferCategories(product?.title ?? '');

  const sensitivity = computeFreightSensitivity(
    weightKgEstimate,
    product?.price,
    categories,
  );

  const certificationRisk = categories.electronics || categories.toy;
  const fragilityRisk     = categories.fragile;

  const scoredPlatforms = PLATFORMS
    .map(p => {
      const raw = scorePlatform(p, inputs, categories, sensitivity);
      const why = buildPlatformWhy(
        p,
        product?.title ?? 'this product',
        categories,
        sensitivity,
        product?.price,
        marketplace,
        selectedSupplier !== null,
      );
      const diff = platformDifficulty(p);
      const recPlat: RecommendedPlatform = {
        platform:   p,
        score:      raw,
        why,
        difficulty: diff,
        marginFit:  platformMarginFit(p, product?.price),
        freightFit: platformFreightFit(p, sensitivity),
        isLive:     p.liveIntegration,
      };
      return recPlat;
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, 4);

  const regions = buildRegions(categories, sensitivity, marketplace);

  const { text: freightStrategy, mode: freightStrategyMode } = buildFreightStrategy(sensitivity, categories);

  const difficulty = buildDifficulty(sensitivity, certificationRisk, fragilityRisk, categories);

  const riskWarnings = buildRiskWarnings(sensitivity, inputs, certificationRisk, fragilityRisk, categories);

  const summary = buildSummary(inputs, sensitivity, difficulty, categories);

  const beginnerNotes = buildBeginnerNotes(sensitivity, categories, marketplace);
  const advancedNotes = buildAdvancedNotes(categories, sensitivity, marketplace);

  const estimatedFreightRisk: MarginRisk =
    sensitivity === 'Low'   ? 'Low'  :
    sensitivity === 'Medium' ? 'Low'  :
    sensitivity === 'High'   ? 'Medium' : 'High';

  const estimatedMarginRisk: MarginRisk = (() => {
    const price = product?.price ?? 0;
    const unitCost = selectedSupplier?.unitCost ?? supplierQuotes[0]?.unitCost ?? 0;
    if (price > 0 && unitCost > 0) {
      const roughMargin = (price - unitCost) / price;
      if (roughMargin > 0.55) return 'Low';
      if (roughMargin > 0.35) return 'Medium';
      return 'High';
    }
    return estimatedFreightRisk;
  })();

  return {
    recommendedPlatforms:  scoredPlatforms,
    recommendedRegions:    regions,
    freightSensitivity:    sensitivity,
    freightStrategy,
    freightStrategyMode,
    sourcingDifficulty:    difficulty,
    sourcingSummary:       summary,
    riskWarnings,
    beginnerNotes,
    advancedNotes,
    estimatedMarginRisk,
    estimatedFreightRisk,
    usingConfirmedFreight: confirmedFreightPerUnit !== null,
    certificationRisk,
    fragilityRisk,
  };
}
