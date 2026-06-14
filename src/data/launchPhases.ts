import { DS } from '../theme/ds';
export interface CLItem { id: string; text: string; aiKey: string }
export interface CLPhase {
  id: string; num: string; icon: string; title: string; desc: string;
  time: string; color: string; items: CLItem[];
}

export const LAUNCH_CHECKLIST_KEY = 'fba_launch_checklist';

export const PHASES: CLPhase[] = [
  {
    id: 'discover', num: '01', icon: '◎', title: 'Discover Your Opportunity',
    desc: 'Find products with real demand and strong profit potential using AI.',
    time: '~30 min', color: DS.accent,
    items: [
      { id: 'p1', text: 'Research product with 3+ demand signals (search volume, trends, BSR)', aiKey: 'bsr' },
      { id: 'p2', text: 'Verify profit margin > 30% after all fees and shipping', aiKey: 'margin' },
      { id: 'p3', text: 'Confirm top 3 competitors have < 1,000 reviews', aiKey: 'competitors' },
      { id: 'p4', text: 'Check product is not restricted, hazmat, or seasonal only', aiKey: 'restrictions' },
      { id: 'p5', text: 'Order samples from 2–3 suppliers and test quality', aiKey: 'samples' },
    ],
  },
  {
    id: 'brand', num: '02', icon: '✦', title: 'Build Your Brand',
    desc: 'Create a memorable brand identity with AI-powered name and kit generation.',
    time: '~45 min', color: DS.accent,
    items: [
      { id: 'b1', text: 'Choose brand name and create logo', aiKey: 'brandname' },
      { id: 'b2', text: 'Register Amazon Seller Central (Professional — $39.99/mo)', aiKey: 'seller_central' },
      { id: 'b3', text: 'Complete tax interview and add bank account', aiKey: 'tax' },
      { id: 'b4', text: 'Purchase GS1 UPC barcode for your product', aiKey: 'barcode' },
      { id: 'b5', text: 'Apply for Amazon Brand Registry (requires trademark)', aiKey: 'brand_registry' },
    ],
  },
  {
    id: 'keywords', num: '03', icon: '≋', title: 'Research Keywords',
    desc: 'Uncover the exact search terms buyers use to find your product.',
    time: '~30 min', color: DS.accent,
    items: [
      { id: 'k1', text: 'Find top 10 keywords with high search volume, low competition', aiKey: 'keyword_research' },
      { id: 'k2', text: 'Research competitor keyword strategies and index terms', aiKey: 'competitor_kw' },
      { id: 'k3', text: 'Build backend keyword list (249 bytes max)', aiKey: 'backend_kw' },
      { id: 'k4', text: 'Validate main keyword drives real purchase intent', aiKey: 'intent' },
    ],
  },
  {
    id: 'supplier', num: '04', icon: '⬡', title: 'Source Your Supplier',
    desc: 'Find vetted global suppliers and negotiate the best terms.',
    time: '~45 min', color: DS.accent,
    items: [
      { id: 's1', text: 'Approve final sample — check packaging and labelling', aiKey: 'sample_approval' },
      { id: 's2', text: 'Negotiate MOQ, price per unit, and lead time', aiKey: 'negotiate' },
      { id: 's3', text: 'Get sea and air freight quotes, choose shipping method', aiKey: 'freight' },
      { id: 's4', text: 'Place production order and pay deposit', aiKey: 'order' },
      { id: 's5', text: 'Confirm production timeline with supplier', aiKey: 'timeline' },
    ],
  },
  {
    id: 'listing', num: '05', icon: '≡', title: 'Listing & SEO',
    desc: 'Write a fully optimised listing that ranks and converts.',
    time: '~45 min', color: DS.accent,
    items: [
      { id: 'l1', text: 'Create product ASIN in Seller Central', aiKey: 'asin' },
      { id: 'l2', text: 'Write keyword-optimised title (150–200 chars)', aiKey: 'listing_title' },
      { id: 'l3', text: 'Write 5 benefit-focused bullet points', aiKey: 'bullets' },
      { id: 'l4', text: 'Write A+ product description', aiKey: 'description' },
      { id: 'l5', text: 'Upload 7+ professional images (white background for main)', aiKey: 'images' },
      { id: 'l6', text: 'Add backend search keywords (249 bytes max)', aiKey: 'backend_seo' },
    ],
  },
  {
    id: 'inventory', num: '06', icon: '📦', title: 'Inventory Planning',
    desc: 'Prepare and ship your inventory to Amazon fulfilment centres.',
    time: '~30 min', color: DS.accent,
    items: [
      { id: 'sh1', text: 'Create FBA inbound shipment plan in Seller Central', aiKey: 'shipment_plan' },
      { id: 'sh2', text: 'Print and apply FNSKU labels to each unit', aiKey: 'fnsku' },
      { id: 'sh3', text: 'Print box content labels and ship to Amazon warehouse', aiKey: 'box_labels' },
      { id: 'sh4', text: 'Track shipment and confirm inventory received', aiKey: 'tracking' },
    ],
  },
  {
    id: 'go', num: '07', icon: '🚀', title: 'Launch Product',
    desc: 'Execute your launch strategy and build sales velocity from day one.',
    time: '~30 min', color: DS.accent,
    items: [
      { id: 'la1', text: 'Set a competitive launch price (mid-range, not cheapest)', aiKey: 'pricing' },
      { id: 'la2', text: 'Launch Sponsored Products auto campaign ($20–30/day)', aiKey: 'ppc' },
      { id: 'la3', text: 'Send product to 5–10 people for honest verified reviews', aiKey: 'reviews_launch' },
      { id: 'la4', text: 'Use "Request a Review" button on every order', aiKey: 'request_review' },
      { id: 'la5', text: 'Monitor daily: sessions, conversion rate, ACoS, inventory', aiKey: 'monitoring' },
      { id: 'la6', text: 'After 2 weeks: mine search term report, add manual campaigns', aiKey: 'campaigns' },
    ],
  },
];

export const ALL_IDS = PHASES.flatMap(p => p.items.map(i => i.id));

export interface Milestone { id: string; label: string; icon: string; requiredIds: string[] }
export const MILESTONES: Milestone[] = [
  { id: 'product_selected',   label: 'Product Selected',   icon: '◎', requiredIds: ['p1','p2','p3','p4','p5'] },
  { id: 'supplier_confirmed', label: 'Supplier Confirmed', icon: '⬡', requiredIds: ['s1','s2','s3','s4','s5'] },
  { id: 'inventory_ordered',  label: 'Inventory Ordered',  icon: '📦', requiredIds: ['sh1','sh2','sh3','sh4'] },
  { id: 'listing_published',  label: 'Listing Published',  icon: '≡', requiredIds: ['l1','l2','l3','l4','l5','l6'] },
  { id: 'first_sale',         label: 'First Sale',         icon: '🏆', requiredIds: ['la1','la2','la3','la4','la5','la6'] },
];

// ── Dynamic sourcing tasks (injected into Phase 04 based on sourcingStrategy) ─

export interface SourcingTaskSpec {
  id:      string;  // prefixed with 'src_' to avoid static ID collisions
  text:    string;
  aiKey:   string;
  trigger: string;  // which platform/condition triggered it
}

export function buildSourcingPhaseTasks(
  recommendedPlatforms: string[],
  freightSensitivity:   'Low' | 'Medium' | 'High' | 'Extreme',
  sourcingDifficulty:   'Beginner' | 'Intermediate' | 'Advanced',
): SourcingTaskSpec[] {
  const tasks: SourcingTaskSpec[] = [];
  const platforms = new Set(recommendedPlatforms);

  if (platforms.has('1688')) {
    tasks.push({ id: 'src_1688_agent',   text: 'Find a sourcing agent to access 1688 factory-direct pricing', aiKey: 'sourcing_agent', trigger: '1688' });
    tasks.push({ id: 'src_1688_specs',   text: 'Translate product specs to Chinese for 1688 supplier communication', aiKey: 'translate_specs', trigger: '1688' });
    tasks.push({ id: 'src_1688_compare', text: 'Compare 1688 unit cost against Alibaba quote to verify savings', aiKey: 'price_compare', trigger: '1688' });
  }

  if (platforms.has('taobao') || platforms.has('yiwugo')) {
    tasks.push({ id: 'src_cn_domestic_agent', text: 'Engage sourcing agent for domestic Chinese platform access', aiKey: 'sourcing_agent', trigger: 'taobao/yiwugo' });
  }

  if (platforms.has('global-sources')) {
    tasks.push({ id: 'src_gs_cert',   text: 'Request supplier certification documents on Global Sources', aiKey: 'certifications', trigger: 'global-sources' });
    tasks.push({ id: 'src_gs_export', text: 'Confirm export documentation and compliance with Global Sources supplier', aiKey: 'export_docs', trigger: 'global-sources' });
  }

  if (platforms.has('vietnam-suppliers')) {
    tasks.push({ id: 'src_vn_tariff', text: 'Research Vietnam supplier to reduce US tariff exposure vs China sourcing', aiKey: 'tariff_research', trigger: 'vietnam' });
    tasks.push({ id: 'src_vn_compare', text: 'Compare Vietnam vs China total landed cost including tariff difference', aiKey: 'landed_cost', trigger: 'vietnam' });
  }

  if (platforms.has('local-wholesalers')) {
    tasks.push({ id: 'src_local_1', text: 'Contact 3 local wholesalers and request pricing for your product', aiKey: 'local_research', trigger: 'local' });
    tasks.push({ id: 'src_local_2', text: 'Compare local landed cost against China import cost (unit cost + freight + duties)', aiKey: 'cost_compare', trigger: 'local' });
  }

  if (platforms.has('indiamart')) {
    tasks.push({ id: 'src_india_1', text: 'Request samples from IndiaMART supplier — verify export packaging quality', aiKey: 'india_sample', trigger: 'indiamart' });
  }

  if (freightSensitivity === 'High' || freightSensitivity === 'Extreme') {
    tasks.push({ id: 'src_frt_quote', text: 'Get confirmed freight quote from forwarder before committing to supplier order', aiKey: 'freight_quote', trigger: 'high_freight' });
  }

  if (freightSensitivity === 'Extreme') {
    tasks.push({ id: 'src_frt_local', text: 'Evaluate local/regional sourcing to eliminate overseas freight cost entirely', aiKey: 'local_eval', trigger: 'extreme_freight' });
  }

  if (sourcingDifficulty === 'Advanced') {
    tasks.push({ id: 'src_cert_check', text: 'Confirm all required certifications (CE, FCC, CPSC etc.) and budget compliance costs', aiKey: 'cert_budget', trigger: 'advanced' });
  }

  return tasks;
}
