// ─── Feature Help Registry ────────────────────────────────────────────────────
// Centralised content for every major feature and sub-feature in Siftly.
// Each entry drives the short description beneath screen titles and the
// detailed help modal opened by the ? button.

export type FeatureKey =
  // Main screens
  | 'advisor'
  | 'copilot'
  | 'research'
  | 'profit_lab'
  | 'brand_studio'
  | 'launch_checklist'
  | 'launchpad'
  | 'winner_vault'
  // Research sub-features
  | 'smart_search'
  | 'seo_keywords'
  | 'suppliers'
  | 'compare'
  | 'vault'
  | 'freight_tab'
  // Feasibility pipeline (in CalculatorScreen)
  | 'feasibility'
  | 'risk_assessment'
  | 'capital_estimator'
  | 'go_no_go'
  | 'launch_readiness'
  // Profit Lab calculators
  | 'calc_fba'
  | 'calc_landed'
  | 'calc_breakeven'
  | 'calc_ppc'
  | 'calc_freight'
  | 'calc_duties'
  | 'calc_reorder'
  | 'calc_roi'
  | 'calc_unit_econ'
  // Brand Studio tabs
  | 'brand_logo'
  | 'brand_label'
  | 'brand_insert'
  // Launch Checklist phases
  | 'checklist_discover'
  | 'checklist_brand'
  | 'checklist_keywords'
  | 'checklist_supplier'
  | 'checklist_listing'
  | 'checklist_inventory'
  | 'checklist_go'
  // System
  | 'paywall';

export interface HelpSection {
  title: string;
  content: string;
}

export interface FeatureHelpEntry {
  name:           string;
  tagline:        string;       // ≤ 20 words — shown beneath screen title
  quickTip?:      string;       // one sentence shown at the top of the help modal
  recommendation?: string;      // 2-3 step workflow shown at the bottom of the help modal
  sections:       HelpSection[];
}

export const FEATURE_HELP: Record<FeatureKey, FeatureHelpEntry> = {

  // ─── MAIN SCREENS ──────────────────────────────────────────────────────────

  advisor: {
    name:    'Launch Advisor',
    tagline: 'Your GO / NO-GO command centre — verdict, pipeline, insights, and AI in one place.',
    quickTip: 'Follow the flow top to bottom: check your streak, review your launch verdict, scan today\'s insight, then ask Co-Pilot anything you\'re unsure about.',
    recommendation: '1. Go to Research, find a product, and save it to your Vault.\n2. Open the Feasibility Check (◈ tab) and run the full pipeline — profit, risk, readiness.\n3. Return here — your GO / NO-GO verdict will appear in the Launch Advisor card.',
    sections: [
      {
        title:   'Streak Counter',
        content: 'The 🔥 flame badge in the top-right shows your consecutive daily app opens. Opening the app each day keeps your streak alive — it resets if you miss a day. Streaks don\'t unlock features, they\'re a momentum signal.',
      },
      {
        title:   'Top Product / Get Started',
        content: 'If you have products saved in your Vault, this shows your highest-scored pick with its verdict, price, margin, and AI score. Tap "Open in Research" to jump straight to that product. If your Vault is empty, you\'ll see the 3-step onboarding card — tap step 1 to start researching.',
      },
      {
        title:   'Launch Advisor Card (GO / NO-GO)',
        content: 'Your central launch verdict. Once you\'ve run the Feasibility Check in the ◈ tab, this card shows your product\'s decision (GO / TEST / WAIT / NO-GO), a plain-English summary, readiness score, risk score, and plan progress. Tap "Review ›" to go back to the Feasibility Check. Tap "↑ Share" to export the verdict as text.',
      },
      {
        title:   'Today\'s Insight',
        content: 'A curated FBA tip that rotates daily. The insight is filtered to your product\'s competition level — low competition products see listing and pricing tips, high competition products see PPC and review strategies. If you have a product saved, tap "✦ Personalize" to ask AI for a tip specific to your exact product.',
      },
      {
        title:   'Your Pipeline',
        content: 'A summary of every product you\'ve saved to your Vault, broken down into LAUNCH / TEST / AVOID counts. Your top 3 picks are ranked by margin or AI score. Products saved more than 60 days ago are flagged as stale — Amazon markets shift fast, so re-research anything older than 2 months.',
      },
      {
        title:   'Last Profit Calculation',
        content: 'Shows your most recent Profit Lab result — profit per unit, margin %, and ROI. If you haven\'t run a calculation yet, tap the button to open the Profit Lab. This card refreshes automatically whenever you save a new calculation.',
      },
      {
        title:   'Ask Co-Pilot',
        content: 'Type any FBA question and get an instant AI answer. Ask about margins, supplier negotiations, listing tactics, PPC bids, import duties — anything. The answer is generated fresh each time; Co-Pilot doesn\'t have memory between questions, so include your product details in each query for the most specific advice.',
      },
    ],
  },

  copilot: {
    name:    'Copilot',
    tagline: 'Your FBA command centre — AI tools, live pipeline, Winner Vault, and launch checklist.',
    quickTip: 'Use the three AI tools at the top for quick answers, then scroll down to track your active build or review your vault entries.',
    recommendation: '1. Tap "Analyze a Product" to get an instant AI verdict on any keyword before opening Research.\n2. Start a build in LaunchPad — your active build progress appears here automatically.\n3. When you publish from LaunchPad, your product appears in the Winner Vault. Tap any card to view the full breakdown and export a report.',
    sections: [
      {
        title:   'Analyze a Product',
        content: 'Tap the 🔍 card to open the AI product analyser. Enter any keyword — Siftly pulls live Amazon data, checks competition, and returns a LAUNCH / TEST / AVOID verdict with a confidence score, reasons, and review gaps you can exploit. Try one of the example chips to see it in action.',
      },
      {
        title:   'Find Opportunities',
        content: 'Tap 💡 to generate AI-curated product niches matched to your seller profile — budget, marketplace, experience, and price range. Switch to "Search" to run a custom niche report on any keyword: verdict, market snapshot, the gap, and affordability check.',
      },
      {
        title:   'Ask Copilot',
        content: 'Tap 🤖 to ask any FBA question and get an instant AI answer. Use the quick-question chips or type anything — margins, supplier negotiation, PPC strategy, listing copy, import duties. Each answer is generated fresh; include your product details for the most specific advice.',
      },
      {
        title:   'Active Build Card',
        content: 'If you have an active LaunchPad build, a progress card appears below the AI tools showing your current stage and overall completion %. Tap it to jump directly into your pipeline. There is only ever one active build at a time.',
      },
      {
        title:   'Winner Vault',
        content: 'Every product you publish from LaunchPad appears here as a vault card — colour-coded by margin (green = strong, amber = viable, red = review). Tap any card to open the full detail view: unit economics, P&L waterfall, supply chain, and PDF export. Tap "?" next to the section title for more.',
      },
      {
        title:   'Quick Actions',
        content: 'Four shortcut buttons to the main tools: Start a Build (LaunchPad), Research Market, Profit Lab, and Brand Studio. These are the same tabs in the bottom navigation — just faster to reach from here.',
      },
      {
        title:   'Launch Checklist',
        content: 'A 7-phase, 35-task launch roadmap that lives at the bottom of this screen. Tap any phase tab to see its tasks and check them off as you complete them. Progress saves automatically and feeds into your overall readiness score.',
      },
      {
        title:   'Seller Profile',
        content: 'Tap your profile strip (marketplace, budget, price range) to open profile settings. Your profile controls the AI\'s product suggestions, the "For You" niche recommendations, and the LaunchPad discovery fit check. Keep it up to date as your business grows.',
      },
    ],
  },

  research: {
    name:    'Research',
    tagline: 'Search Amazon live data — products, suppliers, and freight — all in one workspace.',
    quickTip: 'Amazon tab searches by keyword. Lookup fetches a product by ASIN. Suppliers finds sourcing options. Freight estimates your shipping cost. Run all four for the same idea before committing to a product.',
    sections: [
      {
        title:   'Amazon Tab',
        content: 'Live Amazon keyword search. Enter any product keyword and tap Search Amazon — results return matching listings with price, reviews, rating, and a competition badge. Low competition + under 300 reviews is your entry window. Each card has Analyse (AI verdict), Compare (side-by-side), and Select (attach to LaunchPad).',
      },
      {
        title:   'Lookup Tab',
        content: 'Fetch a single Amazon product by ASIN or URL. Use this to deep-dive a specific listing you found manually. Results show the same detail as Amazon tab cards — price, review count, competition, and all three action buttons.',
      },
      {
        title:   'Suppliers Tab',
        content: 'Sourcing search across Alibaba, DHgate, and 1688. Enter a product keyword to find matching suppliers. Each card shows platform, unit price range, MOQ, and a Private Label badge when OEM/ODM is available. Attach the best match before running the LaunchPad pipeline.',
      },
      {
        title:   'Freight Tab',
        content: 'Instant freight cost estimates for sea, air, express, and sea FCL. Enter product dimensions and order quantity — results show cost per unit and transit time for each mode. Use the output as your "freight per unit" input in LaunchPad Calculations.',
      },
      {
        title:   'Compare Feature',
        content: 'Tap ⊞ Compare on any Amazon result to add it to the compare tray. A floating pill appears once you add at least one product — add a second and tap it to open the side-by-side comparison table. Highlighted cells show which product wins each metric.',
      },
      {
        title:   'Analyse Feature',
        content: 'Tap ⊛ Analyse on any Amazon card to instantly run an AI verdict — pulls live Amazon data, checks competition, and returns a LAUNCH / TEST / AVOID decision with reasons. Same engine as the Copilot "Analyze a Product" tool.',
      },
    ],
  },

  profit_lab: {
    name:    'Profit Lab',
    tagline: '9 standalone financial calculators for every stage of your FBA business.',
    quickTip: 'Run Landed Cost first, then FBA Profit using that landed cost as your product cost — this single sequence fixes the most common financial error in FBA planning.',
    sections: [
      {
        title:   'Calculator Grid',
        content: 'Nine tiles at the top — tap any to open it: FBA Profit, Landed Cost, Break-even, PPC/ACoS, Freight, Import Duties, Reorder Point, ROI, Unit Economics. Your inputs in the current calculator are preserved until you switch.',
      },
      {
        title:   'Input Fields',
        content: 'Enter numbers in the fields below the active calculator. Results update live as you type — no submit button. Use the landed cost output (from Landed Cost calculator) as the product cost input in FBA Profit and Feasibility Check.',
      },
      {
        title:   'Results Display',
        content: 'Key metrics shown prominently below the inputs. Sensitivity analysis appears beneath some calculators — FBA Profit shows how ±10% changes in selling price affect your margin. Read the sensitivity table before committing to a price.',
      },
      {
        title:   'Save Button',
        content: 'FBA Profit has a Save button — tap it to store the result permanently. The AI Co-Pilot reads your latest saved result and gives product-specific analysis. Without a saved result, AI output is generic.',
      },
      {
        title:   'Recommended order',
        content: 'Landed Cost → FBA Profit → Break-even → PPC. Use Reorder Point only after 30+ days of real sales data. Freight and Import Duties when planning your first order. ROI and Unit Economics to evaluate the full picture before committing.',
      },
    ],
  },

  brand_studio: {
    name:    'Brand Studio',
    tagline: 'AI-generates logos, product labels, and packaging inserts as exportable SVG files.',
    quickTip: 'Fill Brand Identity once, then generate all three assets — logo, label, insert — using the same inputs for a consistent brand kit.',
    sections: [
      {
        title:   'Asset Tabs',
        content: 'Three tabs at the top: Logo, Label, Insert. Each generates a different brand asset. Switch between them freely — your Brand Identity inputs are shared across all three tabs, so you only fill them in once.',
      },
      {
        title:   'Brand Identity Form',
        content: 'Brand name, target audience, and brand tone. Be specific with tone — "clean and sustainable" produces a different result than "bold and energetic." These inputs drive the AI\'s content, color, and typography decisions.',
      },
      {
        title:   'Style Selector',
        content: 'Five styles: Minimal, Premium, Eco, Bold, Luxury. Choose what fits your product category — Eco for sustainable goods, Bold for sports/outdoor, Premium for cosmetics. Eco and Minimal scale best at thumbnail size, which is how most Amazon buyers see your product.',
      },
      {
        title:   'Generate & Preview',
        content: 'Tap the Generate button on any tab. SVG renders on screen in 5–15 seconds. If the output misses the mark, adjust one input (style or tone) and regenerate. Each generation is independent — previous outputs are not saved.',
      },
      {
        title:   'Export',
        content: 'Tap Export to share the SVG file. SVGs are vector files — they scale without quality loss. Send to your listing designer or print supplier. Assets are not saved between sessions — export before closing the app.',
      },
    ],
  },

  launch_checklist: {
    name:    'Launch Checklist',
    tagline: '7-phase, 35-step structured launch roadmap with milestone tracking and AI guidance.',
    quickTip: 'Work phases in order — skipping ahead is the most common cause of failed launches. Select a phase to see its specific tasks and guidance.',
    recommendation: '1. Select Phase 01 from the stage chips and complete all 5 research tasks before anything else.\n2. Use the ✦ AI button on any task you\'re unsure about — it gives step-specific guidance.\n3. Complete Phases 01 and 04 fully before ordering inventory — these two phases prevent the most expensive mistakes.',
    sections: [
      {
        title:   'Stage Chips',
        content: 'Seven phase tabs at the top: Research, Brand, Keywords, Source, Listing, Logistics, Launch. Tap any chip to jump to that phase. The chip shows your completion % for each phase — aim for 100% before moving to the next.',
      },
      {
        title:   'Task List',
        content: '35 tasks across 7 phases. Each task has a checkbox — tap to mark complete. Progress saves automatically. The two highest-impact phases are Research (Phase 01) and Sourcing (Phase 04) — do not skip steps in either.',
      },
      {
        title:   'AI Guidance Button',
        content: 'Every task has a ✦ AI button. Tap it for step-specific direction from the AI advisor — not generic advice, but instruction tailored to exactly that task. Most useful in Phase 03 (Keywords) and Phase 05 (Listing), where the guidance is especially detailed.',
      },
      {
        title:   'Milestone Cards',
        content: 'Five milestones unlock automatically when their required tasks are complete: Product Selected (Phase 01), Brand Setup, Keyword Strategy, Supplier Confirmed, Listing Live. Each milestone feeds into your Launch Readiness Score in Feasibility Check.',
      },
      {
        title:   'Launch Readiness connection',
        content: 'Completing 50%+ of the checklist (18 tasks) adds +15 to your Launch Readiness Score and can upgrade the Go/No-Go decision from WAIT to TEST. At 100%, execute Phase 07 — the structured launch plan.',
      },
    ],
  },

  // ─── RESEARCH SUB-FEATURES ─────────────────────────────────────────────────

  smart_search: {
    name:    'Market & Product Search',
    tagline: 'Search Amazon product data to evaluate demand, competition, and price range.',
    quickTip: 'Market mode searches by keyword. Lookup mode fetches one product by ASIN or URL. Try both for the same idea — results differ between them.',
    recommendation: '1. Search 2-3 keyword variants of the same idea in Market mode — competition varies significantly.\n2. Save products with Low competition and under 300 reviews to your Vault.\n3. Switch to Suppliers and find a source. Then open Calculate → Feasibility Check.',
    sections: [
      {
        title:   'Search Bar',
        content: 'Type a keyword and tap Search. In Market mode it returns matching Amazon listings. In Lookup mode, paste an ASIN or Amazon product URL to fetch a single product directly.',
      },
      {
        title:   'Mode Switcher',
        content: 'Three modes at the top — Market (keyword search across listings), Lookup (single product by ASIN or URL), Suppliers (find sourcing options). Switch freely; your results stay until you run a new search.',
      },
      {
        title:   'Smart Search Summary',
        content: 'Appears below results automatically. Shows how many keyword variants were searched, the detected category, the aggregated competition signal, and the price range across all variants. More reliable than any single search result.',
      },
      {
        title:   'Product Cards',
        content: 'Each card shows: price, star rating, review count, and a competition badge (Low / Medium / High / Saturated). Low competition with under 300 reviews is a strong entry signal. Scroll past the first few — the best opportunities are rarely at the top.',
      },
      {
        title:   'Compare',
        content: 'Tap ⊞ Compare on 2–3 cards to add them to the comparison tray, then tap the Compare button to open a side-by-side table. Highlighted cells show which product wins each metric.',
      },
      {
        title:   'Save to Vault',
        content: 'Tap ✦ Save on any card to store it permanently. Saved products can be loaded into Feasibility Check and are visible in Recent Ideas on the Advisor tab.',
      },
    ],
  },

  seo_keywords: {
    name:    'SEO Keywords',
    tagline: 'Find strong Amazon keywords, save the best ones, and export them for listing optimization.',
    quickTip: 'Head terms drive volume; long-tail terms win lower-competition placement. Save the best ones with ★ — they persist between sessions so you can build your list across multiple searches.',
    recommendation: '1. Search a product keyword in Market mode — up to 10 keywords appear automatically after results load.\n2. Tap ☆ on any keyword to save it. Saved keywords survive restarts and stack across searches.\n3. When your list is ready, tap "Export CSV" to download a spreadsheet with phrase, SEO score, search volume, trend, type, and placement hint.',
    sections: [
      {
        title:   'How It Works',
        content: 'Every market search automatically runs a keyword research query in parallel. Up to 10 keywords are returned — scored, typed, and ranked — so you don\'t need a separate step. Keywords appear below Product Opportunities each time you search.',
      },
      {
        title:   'Keyword List (Up to 10)',
        content: 'Each search returns up to 10 keywords: a mix of head terms (broad, high volume) and long-tail terms (specific, lower competition). Sorted strongest-first. Head terms go in your title; long-tail in bullets; backend terms in Amazon\'s Search Terms field.',
      },
      {
        title:   'SEO Score & Volume',
        content: 'Each keyword shows a score from 0–10 and an estimated search volume. Both are estimated from the API\'s overall keyword strength and adjusted by position and type — treat them as relative rankings. Labels clearly show "est." so you always know.',
      },
      {
        title:   'Keyword Types & Placement Hints',
        content: 'Head Term: 1–2 word phrases with broad reach. Long-tail: 3+ word phrases, easier to rank. PPC Candidate: high commercial intent — good for Sponsored Products. Backend: too long for visible fields, but valid in Amazon Search Terms. Each row shows a placement hint (Title / Bullet / Backend / PPC) as a starting point.',
      },
      {
        title:   'Trend',
        content: 'Rising ↑, Stable →, or Declining ↓ — taken from Google Trends data for your search query. "Stable" is the safest entry signal; "Rising" is high upside but may be seasonal; "Declining" warrants extra caution before investing.',
      },
      {
        title:   'Save Keywords',
        content: 'Tap ☆ to save any keyword. Saved keywords persist in the app between sessions — they do not reset when you close or restart. Run multiple searches across related terms and save the strongest from each. Saved keywords always show ★ in yellow.',
      },
      {
        title:   'Export to CSV',
        content: 'Tap "Export CSV" to share your keyword list as a .csv file. Columns: keyword, SEO score, search volume, trend, keyword type, usage hint, source query, saved date. Opens in Numbers, Excel, or Google Sheets. Use it to build your listing copy outside the app.',
      },
    ],
  },

  suppliers: {
    name:    'Supplier Search',
    tagline: 'Search Alibaba, DHgate, and 1688 for suppliers with pricing and MOQ.',
    quickTip: 'Attach a supplier before opening Feasibility Check — without one, unit cost is assumed $0 and every projection will be wrong.',
    recommendation: '1. Select a product in Market mode first — suppliers tab will pre-fill the search.\n2. Open 2-3 supplier listings and compare unit price at the same MOQ tier.\n3. Tap the purple Attach button on the best match before running Feasibility Check.',
    sections: [
      {
        title:   'Search Bar',
        content: 'Enter a product keyword. Returns matching suppliers from Alibaba, DHgate, and 1688, deduplicated across multiple keyword searches so you see unique suppliers rather than the same listing repeated.',
      },
      {
        title:   'Supplier Cards',
        content: 'Each card shows: platform, unit price range, MOQ (minimum order quantity), and a Private Label Friendly badge when OEM/ODM signals are detected in the supplier\'s listing.',
      },
      {
        title:   'Platform Risk',
        content: 'Alibaba has Trade Assurance — recommended for first orders. DHgate has partial buyer protection. 1688 is the Chinese domestic market: lowest price, highest communication risk, no buyer protection.',
      },
      {
        title:   'Private Label Badge',
        content: 'Confirms the supplier can produce under your brand name. Required if you plan to launch as your own brand on Amazon. Without this, you\'re reselling, not building a brand.',
      },
      {
        title:   'Open Supplier',
        content: 'Taps through to the live listing on the supplier\'s platform. Compare at least 2–3 suppliers at the same MOQ tier before committing to one.',
      },
      {
        title:   'Attach to Feasibility Check',
        content: 'The purple button links this supplier\'s unit cost and MOQ to your saved product. Do this before opening Calculate → Feasibility Check. One attachment at a time — attaching a new supplier replaces the previous one.',
      },
    ],
  },

  compare: {
    name:    'Compare',
    tagline: 'Side-by-side view of up to 3 products across price, margin, ROI, and competition.',
    quickTip: 'The product with fewer reviews but a similar price to its competitors is the entry window most sellers miss — that\'s what Compare is designed to surface.',
    sections: [
      {
        title:   'Add to Tray',
        content: 'Tap ⊞ Compare on any product card in Market or Lookup mode — the button shows ✓ Added when active. Add 2–3 products. Tap the Compare button at the top to open the comparison view. Tap ⊞ Compare again on a different product to swap one out.',
      },
      {
        title:   'Comparison Table',
        content: 'Side-by-side grid showing: selling price, star rating, review count, competition level, estimated margin %, and estimated ROI %. Each row highlights the winning value — the highest rating, lowest competition, best margin. Read highlighted cells as your shortlist filter.',
      },
      {
        title:   'Column Headers',
        content: 'Tap any column header card to drill into that product\'s full detail view. Use this to verify the data before saving — the comparison table shows estimates, the detail view shows the raw product data.',
      },
      {
        title:   'What to look for',
        content: 'Low competition badge + under 300 reviews + similar price to higher-review competitors = entry window. A product that wins on margin % but has high competition is harder to enter than a lower-margin product with low competition. Prioritise competition level over margin when shortlisting.',
      },
    ],
  },

  vault: {
    name:    'Vault',
    tagline: 'Saved product research library with filtering, sorting, and CSV export.',
    quickTip: 'Unsave products you\'ve ruled out — a Vault with 5 strong candidates is more useful than one with 40 unfiltered saves.',
    sections: [
      {
        title:   'Saved Product Cards',
        content: 'Every product you\'ve tapped ✦ Save on in Research appears here. Each card shows price, rating, review count, and competition badge. Saved products persist across sessions — they\'re not lost when you close the app.',
      },
      {
        title:   'Filter Bar',
        content: 'Filter by competition level: Low / Medium / High. Use Low to surface your strongest candidates quickly. Filter resets when you close the Vault — it\'s a view filter, not a permanent sort.',
      },
      {
        title:   'Export to CSV',
        content: 'Tap the export button to download your full Vault as a CSV file. Share with a business partner or import into a spreadsheet for deeper analysis. Useful when presenting shortlist options to investors or co-founders.',
      },
      {
        title:   'Save limits',
        content: 'Explorer tier: limited saves. Builder and Operator: expanded limits. Unsaving products you\'ve ruled out keeps your Vault clean and below the limit. Tap any saved product card → unsave to remove it.',
      },
    ],
  },

  // ─── FEASIBILITY PIPELINE ──────────────────────────────────────────────────

  feasibility: {
    name:     'Feasibility Check',
    tagline:  'Full financial analysis: margin, ROI, FBA fees, landed cost, break-even, and verdict.',
    quickTip: 'Save a product from Research and attach a supplier from Supplier Search first — both are required before Feasibility Check can show accurate numbers.',
    recommendation: '1. Enter the product\'s packed weight and your freight quote — these two inputs change the verdict most.\n2. Read the Verdict, then scroll through Risk Assessment and Capital Estimator.\n3. Check Go/No-Go last. If it says WAIT, the reason tells you exactly what to fix.',
    sections: [
      {
        title:   'Product & Supplier',
        content: 'Shown at the top automatically — your saved product (price, competition, reviews) and attached supplier (unit cost, MOQ, platform). If either shows missing, go back to Research or Supplier Search and complete that step first.',
      },
      {
        title:   'Three Adjustable Inputs',
        content: 'Packed unit weight (lbs) — use the product in its retail packaging, not unboxed. Shipping per unit ($) — from your freight quote. Import duty % — look up your HS code in the Duties calculator. Everything else is computed automatically.',
      },
      {
        title:   'Financial Breakdown',
        content: 'Updates live as you type: referral fee (15%), FBA fulfillment fee (weight-based), landed cost, profit per unit, margin %, and ROI %. The most common mistake is leaving weight at the default — a heavier product underestimates the FBA fee by $1–$3+ per unit.',
      },
      {
        title:   'Verdict',
        content: 'Four outcomes: Excellent Opportunity / Worth Testing / High Risk / Avoid — based on margin and ROI thresholds. "Missing data" means a required input is zero or null — check product price and supplier cost.',
      },
      {
        title:   'Risk Assessment',
        content: 'Scrolls directly below the verdict. Scores five dimensions: market competition, financial risk, supplier risk, data confidence, and product complexity. Each bar shows your score. Red dots = high severity — fix those first.',
      },
      {
        title:   'Capital Estimator',
        content: 'Full launch capital table: inventory, freight, customs, packaging, samples, PPC, and a 10% contingency. Adjust the packaging/unit, sample cost, and PPC budget fields. Total updates live.',
      },
      {
        title:   'Go / No-Go Decision',
        content: 'The final card. Combines margin, ROI, risk score, and readiness into one decision: GO / TEST / WAIT / NO-GO. Each outcome includes the specific reasons that triggered it — read them before acting.',
      },
    ],
  },

  risk_assessment: {
    name:    'Risk Assessment',
    tagline: 'Scores your product across 5 risk categories with weighted overall score and mitigations.',
    quickTip: 'Fix red (High severity) risk factors first — one resolved High factor drops your score more than clearing three Low factors.',
    sections: [
      {
        title:   'Overall Score Badge',
        content: 'A 0–100 score with a label: Low Risk (0–24), Moderate (25–49), High (50–74), Extreme (75–100). A product can have good margin and still score High risk — the score captures what raw numbers miss, like supplier platform trust and data confidence.',
      },
      {
        title:   'Category Bars',
        content: 'Five horizontal bars showing your score in each dimension: Market Competition (30% weight), Financial Risk (30%), Supplier Risk (20%), Data Confidence (10%), Product Complexity (10%). The longest bar is your weakest area — address it first.',
      },
      {
        title:   'Risk Factor List',
        content: 'Top risk factors shown with severity dots: red = High, amber = Medium, blue = Low. Each factor includes a specific mitigation action — read the mitigation, not just the label. A null supplier price alone adds +25 to Supplier Risk.',
      },
      {
        title:   'What to fix',
        content: 'Data Confidence risk drops when you replace default inputs with actual values — weight, shipping, duty rate. Supplier Risk drops when you confirm a unit price and use Alibaba (Trade Assurance) over 1688. Financial Risk drops when margin exceeds 28% and ROI exceeds 55%.',
      },
    ],
  },

  capital_estimator: {
    name:    'Capital Estimator',
    tagline: 'Full launch capital breakdown: inventory, freight, customs, packaging, samples, PPC, and contingency.',
    quickTip: 'Most sellers underestimate launch capital by 40–60% because they count only inventory — this table forces the full picture before you commit.',
    sections: [
      {
        title:   'Capital Table',
        content: 'Eight-line breakdown: Inventory (unit cost × MOQ), Freight (shipping/unit × MOQ), Customs/Duties (duty rate × MOQ), Packaging/Labelling, Sample Order, Launch PPC/Marketing, Contingency Reserve (10%), and Total. Inventory, freight, and customs are computed automatically from your product and supplier data.',
      },
      {
        title:   'Editable Fields',
        content: 'Three fields you can adjust: packaging per unit ($), sample order cost ($), and PPC budget ($). PPC pre-fills at 15× selling price, capped $300–$1,500 — adjust up if you\'re in a competitive niche. Total updates live as you type.',
      },
      {
        title:   'Contingency Line',
        content: 'The 10% contingency is added automatically — it covers supplier delays, unexpected reorders, and cost overruns. Do not remove it from your planning. It is based on the subtotal of all other lines, not just inventory.',
      },
      {
        title:   'Launch Readiness connection',
        content: 'Editing any editable field marks the "Capital estimate reviewed" checkpoint — this adds +10 to your Launch Readiness Score. Scroll to the readiness card after adjusting inputs to see the updated score.',
      },
    ],
  },

  go_no_go: {
    name:    'Go / No-Go Decision',
    tagline: 'Combines margin, ROI, risk score, data completeness, and readiness into a single decision.',
    quickTip: 'Read the reasons, not just the badge — a WAIT with one fixable reason is very different from a NO-GO with five hard failures.',
    sections: [
      {
        title:   'Decision Badge',
        content: 'Four outcomes, colour-coded: GO (green) — all thresholds cleared. TEST (blue) — viable but not exceptional, validate with a small batch. WAIT (amber) — not ready, missing data or low readiness. NO-GO (red) — hard stop: profit negative, extreme risk, or unresolvable data gap.',
      },
      {
        title:   'Threshold Summary',
        content: 'GO requires: margin ≥ 28%, ROI ≥ 55%, risk score < 40, readiness ≥ 65%. Missing data is checked first — a $0 selling price makes every downstream calculation meaningless. Fill in your product price and supplier cost before interpreting the decision.',
      },
      {
        title:   'Reason List',
        content: 'Below the badge, each reason states exactly which threshold triggered the outcome. "Readiness is 30%" means: complete more checklist tasks. "Risk score is 62" means: address the top risk factors. Reasons are actionable — each one maps to a specific fix.',
      },
      {
        title:   'What to do next',
        content: 'GO → proceed to Launch Checklist and place a full MOQ order. TEST → negotiate a smaller trial batch with your supplier. WAIT → fix the stated reasons, then return to this screen — the decision updates automatically. NO-GO → evaluate a different product or renegotiate unit cost with your supplier.',
      },
    ],
  },

  launch_readiness: {
    name:    'Launch Readiness',
    tagline: '7-checkpoint preparation score (0–100) showing what\'s done and what\'s still missing.',
    quickTip: 'The fastest +35 points: attach a supplier (+15) and enter real weight and shipping values to clear the feasibility checkpoint (+20).',
    sections: [
      {
        title:   'Readiness Score',
        content: 'A 0–100 score based on 7 checkpoints. Updates automatically as you complete steps — no refresh needed. A score below 35% triggers a WAIT outcome in the Go/No-Go Decision. 65%+ can trigger a GO.',
      },
      {
        title:   'Checkpoint List',
        content: 'Seven items with ✓ (done) or ○ (outstanding): Product selected (+15), Supplier attached (+15), Feasibility complete — no missing data (+20), Risk reviewed (+10), Capital reviewed (+10), Product financially viable — margin ≥ 15% (+15), Checklist ≥ 50% done (+15). Each outstanding item shows its specific next action.',
      },
      {
        title:   'Outstanding Actions',
        content: 'Each ○ checkpoint shows the exact step needed to complete it. "Attach a supplier" → go to Supplier Search and tap the attach button. "Enter real weight and shipping" → update those two fields at the top of Feasibility Check. Follow these actions in score-value order, largest points first.',
      },
      {
        title:   'Score and Go/No-Go connection',
        content: 'Readiness feeds directly into the Go/No-Go Decision. You don\'t need 100% to proceed — a TEST decision can move forward at 50–65%. 100% readiness means preparation is complete, not that the launch will succeed.',
      },
    ],
  },

  // ─── PROFIT LAB CALCULATORS ────────────────────────────────────────────────

  calc_fba: {
    name:    'FBA Profit',
    tagline: 'Full P&L per unit: selling price, all Amazon fees, costs, net profit, margin, and ROI.',
    quickTip: 'Run this first, before any other calculator. Use your landed cost (from Landed Cost) as product cost — never the raw supplier quote.',
    recommendation: '1. Run Landed Cost first — take the sea freight result as your product cost here.\n2. Enter all fields, check that margin is above 25% before continuing.\n3. Tap Save to unlock product-specific AI Co-Pilot analysis, then open Feasibility Check.',
    sections: [
      {
        title:   'Inputs',
        content: 'Selling price ($), product cost ($), unit weight (oz), dimensions (inches), and referral fee category. Referral fees vary: 8% for electronics accessories, 15% standard, 20%+ for some categories — adjust if needed.',
      },
      {
        title:   'Results',
        content: 'Net profit per unit, margin %, ROI %, and a confidence score — all update live as you type. Below the main results, a sensitivity table shows how ±10% changes in selling price affect your margin.',
      },
      {
        title:   'Save Result',
        content: 'Tap Save to store this calculation permanently. The AI Co-Pilot reads your latest saved result and gives a product-specific analysis — without a saved result it gives generic output.',
      },
      {
        title:   'Feasibility Check CTA',
        content: 'The purple banner below the results opens Feasibility Check with this product pre-loaded. Use it after confirming margin > 20% to run the full pipeline: Risk Assessment, Capital Estimator, and Go/No-Go Decision.',
      },
    ],
  },

  calc_landed: {
    name:    'Landed Cost',
    tagline: 'True unit cost across sea, air, and express shipping — freight and customs included.',
    quickTip: 'Always run this before FBA Profit. Freight + customs typically add 20–40% on top of the supplier quote.',
    recommendation: '1. Enter supplier unit cost, order quantity, weight, and duty % — all four fields matter.\n2. Use the sea freight landed cost as the product cost in FBA Profit and Feasibility Check.\n3. Revisit this when you get actual freight quotes — the estimate can differ by 20-30%.',
    sections: [
      {
        title:   'Inputs',
        content: 'Supplier unit cost ($), order quantity (units), unit weight (kg), product dimensions (cm), and import duty %. Fill all fields — missing weight or duty produces an underestimate.',
      },
      {
        title:   'Results',
        content: 'Landed cost per unit for three shipping modes: sea (28 days), air (7 days), and express (3 days). Displayed side by side so you can compare true unit cost vs transit time.',
      },
      {
        title:   'Which mode to use',
        content: 'Sea freight for orders over 200kg — it\'s 5–10× cheaper than air. Air makes sense when stockout risk outweighs the premium. Always get actual freight quotes to validate these estimates.',
      },
      {
        title:   'Where to use the output',
        content: 'Take the sea freight landed cost → enter it as "product cost" in FBA Profit and Feasibility Check. This single input affects every margin and profit calculation downstream.',
      },
    ],
  },

  calc_breakeven: {
    name:    'Break-even',
    tagline: 'Units required to recover total investment — inventory, shipping, fees, and launch costs.',
    quickTip: 'Use conservative sales velocity — new listings take 30–60 days to build traction. The top competitor\'s velocity is not your launch velocity.',
    recommendation: '1. Get total investment from Capital Estimator and profit per unit from FBA Profit.\n2. Enter a conservative launch velocity — 30-50% of what the top competitor sells.\n3. If break-even exceeds 80% of your first order quantity, renegotiate MOQ or improve margin before ordering.',
    sections: [
      {
        title:   'Inputs',
        content: 'Total investment ($) — from Capital Estimator; profit per unit ($) — from FBA Profit; estimated monthly sales velocity (units/month) — your realistic new-listing estimate.',
      },
      {
        title:   'Results',
        content: 'Break-even unit count, break-even revenue ($), and time to break-even in months at your stated velocity. If velocity is 0, time shows as infinite — enter a non-zero estimate.',
      },
      {
        title:   'What the number means',
        content: 'Break-even under 50% of your first order quantity is a healthy signal. Over 80% means either your margin is too thin or your MOQ is too large — revisit the supplier negotiation before ordering.',
      },
    ],
  },

  calc_ppc: {
    name:    'PPC / ACoS',
    tagline: 'Ad spend calculator: break-even ACoS, daily budget, and profit at each spend level.',
    quickTip: 'Accept 30–40% ACoS for the first 30 days to build ranking velocity, then optimise bids down once you have sales history.',
    recommendation: '1. Enter selling price, product cost, and your target margin % to get your break-even ACoS.\n2. Take the recommended monthly budget → enter it as the PPC line in Capital Estimator.\n3. At launch, set Sponsored Products auto campaigns at break-even ACoS. Optimise at day 7 and 14.',
    sections: [
      {
        title:   'Inputs',
        content: 'Selling price ($), product cost ($), target profit margin %. The calculator derives your break-even ACoS from these three numbers.',
      },
      {
        title:   'Break-even ACoS',
        content: 'The ACoS above which your ads cost more than they contribute. This is your hard ceiling — never run campaigns consistently above it. Displayed prominently in the results.',
      },
      {
        title:   'Daily Budget & Scenarios',
        content: 'Recommended daily budget for your launch period, plus a table showing profit at 20%, 30%, 40%, and 50% ACoS. Use the scenario table to plan conservatively, not optimistically.',
      },
      {
        title:   'Where to use the output',
        content: 'Take the recommended monthly ad spend → enter it as the PPC budget in Capital Estimator. This is often the most underestimated launch cost.',
      },
    ],
  },

  calc_freight: {
    name:    'Freight',
    tagline: 'Estimate and compare sea, air, and express shipping costs for your shipment.',
    quickTip: 'These are estimates — always get real quotes from 2–3 freight forwarders before placing an order. Rates vary 20–30%.',
    recommendation: '1. Enter total shipment weight, CBM volume, and unit count.\n2. Use the cost-per-unit result → enter into Landed Cost as "shipping per unit."\n3. Get real quotes from 2-3 forwarders and update Landed Cost when you have actual numbers.',
    sections: [
      {
        title:   'Inputs',
        content: 'Total shipment weight (kg), CBM volume (cubic metres), and number of units in the shipment.',
      },
      {
        title:   'Results',
        content: 'Cost per unit ($) and total shipment cost ($) for sea freight (28 days), air freight (7 days), and express courier (3 days). All three shown side by side.',
      },
      {
        title:   'Decision guide',
        content: 'Sea: any order over 150kg — cheapest by far. Air: fast-moving SKUs where a stockout would cost more than the freight premium. Express: urgent restocks only — rarely cost-effective for full orders.',
      },
      {
        title:   'Where to use the output',
        content: 'Cost per unit → enter into Landed Cost calculator. Also use as the "shipping per unit" input in Feasibility Check.',
      },
    ],
  },

  calc_duties: {
    name:    'Import Duties',
    tagline: 'Estimate import duty and tax by country and HS tariff code.',
    quickTip: 'Get the correct HS code before using this — wrong codes produce wrong rates and misclassification carries customs penalties.',
    recommendation: '1. Look up your HS code first — use the link inside the calculator or consult a customs broker.\n2. Enter declared shipment value, country, and HS code to get the duty % and total payable.\n3. Take the duty % → enter into Feasibility Check and Landed Cost.',
    sections: [
      {
        title:   'Inputs',
        content: 'Total declared shipment value ($), import country, and HS tariff code. If you don\'t know your HS code yet, use 0% as a placeholder — but resolve it before placing an order.',
      },
      {
        title:   'Results',
        content: 'Total duty payable ($), any VAT/GST applicable, and cost per unit. All based on your declared value and the duty rate for your HS code and country.',
      },
      {
        title:   'HS Code lookup',
        content: 'Use the lookup resources linked inside the calculator. For orders over $2,500, consult a licensed customs broker — misclassification carries penalties and can delay shipments.',
      },
      {
        title:   'Where to use the output',
        content: 'Import duty % → enter into Feasibility Check and Landed Cost for accurate per-unit cost projections.',
      },
    ],
  },

  calc_reorder: {
    name:    'Reorder Point',
    tagline: 'Calculate when to place your next order to avoid running out of stock.',
    quickTip: 'Only use this after 30+ days of live sales. Launch-week velocity is inflated and will produce a dangerously optimistic reorder point.',
    recommendation: '1. Pull your actual daily sales velocity from Seller Central (30-day average, not launch week).\n2. Enter current inventory, velocity, and your supplier lead time including production + shipping.\n3. Set a calendar reminder for the reorder point date — don\'t rely on memory.',
    sections: [
      {
        title:   'Inputs',
        content: 'Current inventory (units), daily sales velocity (units/day), supplier lead time (days), and safety stock buffer (days). Sea freight lead time is 28–35 days from order placement — not from departure.',
      },
      {
        title:   'Results',
        content: 'Reorder point (the unit count at which you must place a new order), recommended reorder date, and estimated days of stock remaining at your current velocity.',
      },
      {
        title:   'Safety stock guidance',
        content: 'Add 7–10 days for sea freight orders. During Q4 (peak season), double your safety stock — delays and velocity spikes are common. Running out of stock resets your BSR ranking and takes weeks to recover.',
      },
    ],
  },

  calc_roi: {
    name:    'ROI',
    tagline: 'Return on capital invested — profit as a percentage of total launch investment.',
    quickTip: 'A 30% margin product that turns inventory 4× per year has a 120% annualised ROI. Turn rate matters as much as margin.',
    recommendation: '1. Get total investment from Capital Estimator and profit per unit from FBA Profit.\n2. Estimate inventory turns — most FBA sellers achieve 3-5 cycles per year at steady state.\n3. If annualised ROI is below 50%, either cut costs (landed cost, PPC) or raise selling price and re-run.',
    sections: [
      {
        title:   'Inputs',
        content: 'Total investment ($) — include inventory, freight, duties, PPC, and samples; net profit per unit ($); expected sales volume (units); inventory turn rate (times/year).',
      },
      {
        title:   'Results',
        content: 'ROI % per inventory cycle and annualised ROI at your stated turn rate. Target ≥ 50% per cycle as a minimum. Above 100% annually is strong for FBA.',
      },
      {
        title:   'ROI vs Margin',
        content: 'Margin % measures profitability per sale. ROI measures how efficiently you deploy capital. A high-margin, slow-moving product can have worse ROI than a lower-margin product that turns 6× per year.',
      },
    ],
  },

  calc_unit_econ: {
    name:    'Unit Economics',
    tagline: 'Per-unit cost waterfall showing exactly where your revenue goes.',
    quickTip: 'Any cost category consuming more than 25% of revenue is your primary optimisation target.',
    recommendation: '1. Enter selling price, landed cost (not supplier quote), weight, and PPC per unit.\n2. Read the waterfall — find the single biggest cost category as a % of revenue.\n3. That category is your optimisation target: negotiate cost, reduce weight, or adjust bid strategy.',
    sections: [
      {
        title:   'Inputs',
        content: 'Selling price ($), product cost (use landed cost, not supplier quote), unit weight (oz), and PPC allocation per unit ($). PPC per unit = monthly ad spend ÷ monthly units sold.',
      },
      {
        title:   'Cost Waterfall',
        content: 'Shows the full path from selling price to net profit: selling price → referral fee → FBA fee → landed cost → PPC allocation → net profit. Each step shows the dollar amount and % of revenue it consumes.',
      },
      {
        title:   'Contribution Margin',
        content: 'Shown before PPC — your margin if you ran no ads. Useful for understanding the structural profitability of the product separate from launch costs.',
      },
      {
        title:   'What to look for',
        content: 'FBA fee over 25%: a lighter or smaller product variant could transform your margin. PPC over 20%: your ACoS or bid strategy needs work. Landed cost over 40%: renegotiate with your supplier or switch to sea freight.',
      },
    ],
  },

  // ─── BRAND STUDIO TABS ────────────────────────────────────────────────────

  brand_logo: {
    name:    'Logo Maker',
    tagline: 'Generate a brand logo from your name, tone, and style as an exportable SVG.',
    quickTip: 'Run Logo first, then Label and Insert with the same inputs — you get a matching brand kit in one session.',
    recommendation: '1. Complete Brand Identity first — brand name, audience, tone. Be specific.\n2. Select the style that fits your product category, then tap Generate.\n3. Export immediately after reviewing — assets are not saved between sessions.',
    sections: [
      {
        title:   'Brand Identity Inputs',
        content: 'Brand name, target audience, and tone. Be specific — "eco-conscious millennial buyers" produces a different result than "buyers." Tone examples: "clean and minimal," "bold and energetic," "premium and understated." These inputs are shared across all three asset tabs.',
      },
      {
        title:   'Style Selector',
        content: 'Five styles: Minimal (clean lines, whitespace), Premium (refined, sophisticated), Eco (earthy, sustainable signals), Bold (high contrast, strong shapes), Luxury (dark palette, high-end typography). Choose what matches your product category, not personal taste.',
      },
      {
        title:   'Generate & Preview',
        content: 'Tap "Generate Logo" — SVG renders directly on screen in 5–15 seconds. If the result misses the mark, change one input (try a different style or refine the tone) and regenerate. Each generation is independent — previous outputs are not saved.',
      },
      {
        title:   'Export',
        content: 'Tap Export to share the SVG file. SVGs are vector files — they scale to any size without quality loss. Send directly to your listing designer or print supplier. Assets are not saved between sessions — export before closing.',
      },
    ],
  },

  brand_label: {
    name:    'Label Generator',
    tagline: 'Create a product label with your brand elements as an exportable SVG.',
    quickTip: 'Use the exact same Brand Identity inputs as Logo Maker — consistency between logo and label is the foundation of brand recognition.',
    recommendation: '1. Generate your Logo first, note the style, then switch to this tab.\n2. Keep brand name, audience, tone, and style identical to Logo — consistency is the goal.\n3. Export and send to your supplier as the packaging spec alongside the product order.',
    sections: [
      {
        title:   'Brand Identity Inputs',
        content: 'Same fields as Logo: brand name, audience, tone. The label generator uses these to match color palette and typography with the logo output. Enter them identically across tabs for a cohesive brand kit.',
      },
      {
        title:   'Style Selector',
        content: 'Match style to product category: Eco for sustainable goods, Bold for sports/outdoor, Premium for cosmetics and skincare, Minimal for tech accessories, Luxury for high-end goods. The style that photographs best at thumbnail scale matters most — most Amazon buyers see your label at 60×60px.',
      },
      {
        title:   'Generate & Preview',
        content: 'Tap "Generate Label." SVG preview shows the label at full scale. Check legibility at small size — if typography is hard to read, switch to Minimal or Bold and regenerate. Each generation takes 5–15 seconds.',
      },
      {
        title:   'Export + Print Spec',
        content: 'Export the SVG and share with your supplier or 3PL as the packaging spec. For physical print: 300gsm matte card stock for inserts, 90gsm gloss for adhesive labels. SVG is not saved between sessions — export before closing the app.',
      },
    ],
  },

  brand_insert: {
    name:    'Packaging Insert',
    tagline: 'Design a post-purchase insert card to drive reviews and repeat buys.',
    quickTip: 'A well-designed insert that invites honest feedback (without incentivising reviews) is one of the highest-ROI brand assets for new FBA sellers.',
    recommendation: '1. Generate Logo and Label first so your insert matches the same brand kit.\n2. Generate with the same inputs — the insert copy will match your brand voice.\n3. Export and include in every shipment unit. Print on 300gsm matte card stock.',
    sections: [
      {
        title:   'Brand Identity Inputs',
        content: 'Brand name, audience, and tone — same fields as Logo and Label. The insert generator adapts the message to match your brand voice. "Friendly and approachable" produces different copy than "premium and exclusive."',
      },
      {
        title:   'Style Selector',
        content: 'Minimal and Premium perform best for inserts — they feel intentional rather than generic. Eco works well for sustainable brands. The insert is small (typically 85×55mm) — simpler styles read better at that scale.',
      },
      {
        title:   'Generate & Preview',
        content: 'Tap "Generate Insert." Preview shows the card at full size, including brand statement, review invitation, and contact information. Regenerate if the copy tone doesn\'t match your brand voice — it takes 5–15 seconds.',
      },
      {
        title:   'Export + Policy Note',
        content: 'Export the SVG. Include the insert in every shipment unit. Critical: Amazon prohibits review incentivisation — the insert must not offer discounts, gifts, or compensation in exchange for reviews. An honest invitation to leave a review is permitted. Assets are not saved between sessions.',
      },
    ],
  },

  // ─── LAUNCH CHECKLIST PHASES ──────────────────────────────────────────────

  checklist_discover: {
    name:    'Phase 01 · Research',
    tagline: '5 tasks to validate product demand before committing to a niche.',
    quickTip: 'This phase has the highest ROI of any checklist phase — skipping it is the single biggest cause of failed FBA launches.',
    recommendation: '1. Go to Research → Market mode and search 3 keyword variants of your product idea.\n2. Save a product with Low competition and under 300 reviews.\n3. Return here and check all 5 tasks — do not move to Phase 02 until all are done.',
    sections: [
      {
        title:   'Task List',
        content: 'Five tasks: (1) Run a market search for your product idea. (2) Evaluate competition level and review counts. (3) Identify your target selling price range. (4) Estimate monthly demand. (5) Save a shortlisted product to Vault. Tap the checkbox to mark each task complete — progress saves automatically.',
      },
      {
        title:   'AI Guidance Button',
        content: 'Tap ✦ AI on any task for step-specific direction — not generic advice. For task 1: keyword search suggestions. For task 4: how to estimate demand from competitor review velocity. For task 5: what to look for before saving.',
      },
      {
        title:   'Phase Milestone',
        content: 'Completing all 5 tasks unlocks the Phase 01 milestone: Product Selected. This is required before Feasibility Check can show accurate analysis. Saving a product to Vault (task 5) also triggers the first Launch Readiness checkpoint.',
      },
      {
        title:   'What to look for',
        content: 'Low competition with under 300 reviews is your entry window. A price range of $20–$60 is the FBA sweet spot: high enough for margin, low enough for impulse buying. Confirm estimated monthly demand is at least 200–300 units before proceeding to Phase 02.',
      },
    ],
  },

  checklist_brand: {
    name:    'Phase 02 · Branding',
    tagline: '5 tasks to set up your brand infrastructure before ordering inventory.',
    quickTip: 'Register your brand name as early as possible — Brand Registry takes 2–4 weeks and unlocks A+ Content and sponsored brand ads.',
    recommendation: '1. Start the trademark application now — Brand Registry requires it and it takes weeks.\n2. Open Brand Studio and generate Logo, Label, and Insert in one session.\n3. Check all 5 tasks before moving to Phase 03 — Seller Central access is required for barcode/FNSKU.',
    sections: [
      {
        title:   'Task List',
        content: 'Five tasks: (1) Choose and verify your brand name. (2) Create or access your Amazon Seller Central account. (3) Purchase a UPC/EAN barcode or get an FNSKU from Seller Central. (4) Apply for Amazon Brand Registry. (5) Generate brand assets in Brand Studio.',
      },
      {
        title:   'AI Guidance Button',
        content: 'Tap ✦ AI on any task. For task 3 (barcode): when to use a UPC vs FNSKU and where to purchase GS1-certified barcodes. For task 4 (Brand Registry): what the application requires, how long it takes, and what to prepare.',
      },
      {
        title:   'Phase Milestone',
        content: 'Completing all 5 tasks unlocks the Brand Setup milestone. Task 5 (Brand Studio) is the fastest — open Brand Studio from Quick Actions and generate logo, label, and insert in one session using the same brand inputs.',
      },
      {
        title:   'What to prepare',
        content: 'Seller Central requires a government ID, bank account, and credit card. Brand Registry requires a registered trademark — start the application now even if still in early research. GS1-issued barcodes are required; third-party barcode resellers are no longer accepted by Amazon.',
      },
    ],
  },

  checklist_keywords: {
    name:    'Phase 03 · Keywords',
    tagline: '4 keyword research tasks to anchor your listing before writing a single word.',
    quickTip: 'Do this before writing a single word of your listing — keywords must come first, copy second.',
    recommendation: '1. Use Research → Market mode to identify your top 5 keywords by volume and competition.\n2. Map them to placement: top 2-3 in title, secondary in bullets, rest in backend.\n3. Check all 4 tasks. Do not start Phase 05 (Listing) until this phase is 100% done.',
    sections: [
      {
        title:   'Task List',
        content: 'Four tasks: (1) Research primary keywords by volume and competition. (2) Identify 3–5 long-tail keyword opportunities. (3) Compile your backend search term list. (4) Map keyword placement across title, bullets, and backend.',
      },
      {
        title:   'AI Guidance Button',
        content: 'Tap ✦ AI on any task. For task 1: how to evaluate keyword volume and difficulty using the Research workspace. For task 4: which keywords to place where and how Amazon\'s indexing algorithm weights each location.',
      },
      {
        title:   'Phase Milestone',
        content: 'Completing all 4 tasks unlocks the Keyword Strategy milestone — the prerequisite for Phase 05 (Listing & SEO). Do not start writing your listing without completing this phase first.',
      },
      {
        title:   'Keyword placement rules',
        content: 'Title: highest indexed weight — your top 2–3 primary keywords go here. Bullets: secondary keywords in the first 200 characters of each. Backend: misspellings, synonyms, and related terms not in the listing copy. Amazon does not index duplicate keywords — use each term once across all placements.',
      },
    ],
  },

  checklist_supplier: {
    name:    'Phase 04 · Sourcing',
    tagline: '5 tasks to select, sample, and confirm a supplier before placing any order.',
    quickTip: 'Never place a production order without an approved sample — this is the phase that protects you from the costliest FBA mistake.',
    recommendation: '1. Go to Research → Suppliers and find 2-3 candidates. Attach the best one for Feasibility Check.\n2. Request samples from your top 2 suppliers before deciding. Approve quality before production.\n3. Confirm MOQ, price, and lead time in writing, then check all 5 tasks before placing the order.',
    sections: [
      {
        title:   'Task List',
        content: 'Five tasks: (1) Contact and qualify 2–3 suppliers from Supplier Search. (2) Request product samples from your top 2 candidates. (3) Approve sample quality. (4) Confirm final MOQ, unit price, and lead time. (5) Place the production order.',
      },
      {
        title:   'AI Guidance Button',
        content: 'Tap ✦ AI on any task. For task 1: how to evaluate supplier quality signals — Trade Assurance, years active, response rate. For task 4: how to negotiate MOQ and price. For task 5: what to confirm in writing before sending payment.',
      },
      {
        title:   'Phase Milestone',
        content: 'Completing all 5 tasks unlocks the Supplier Confirmed milestone. Attaching your supplier in Supplier Search (before completing this phase) also improves your Launch Readiness Score in Feasibility Check.',
      },
      {
        title:   'Quality inspection',
        content: 'Approving a sample spec (task 3) does not guarantee production batch quality. For orders over $2,000, hire a third-party inspection company to check the batch before shipping. Cost: $150–$300. Always cheaper than returning a failed batch.',
      },
    ],
  },

  checklist_listing: {
    name:    'Phase 05 · Listing & SEO',
    tagline: '6 tasks to build a fully optimised Amazon listing before inventory arrives.',
    quickTip: 'Build your listing while inventory is in transit — you want to go live the day stock is confirmed received at the FBA warehouse.',
    recommendation: '1. Use your Phase 03 keyword map — write your title first, using your top 2-3 primary keywords.\n2. Write 5 bullets (benefit → feature → proof), then commission images, then write A+ Content.\n3. Create the Seller Central draft now. Set listing to Active the day FBA confirms stock received.',
    sections: [
      {
        title:   'Task List',
        content: 'Six tasks: (1) Write a keyword-optimised title using your Phase 03 keyword map. (2) Write 5 benefit-led bullet points. (3) Create or commission main and lifestyle images. (4) Write A+ Content (if Brand Registry approved). (5) Submit backend search terms. (6) Activate listing (status: Active).',
      },
      {
        title:   'AI Guidance Button',
        content: 'Tap ✦ AI on any task. For task 1 (title): formatting rules and keyword placement. For task 2 (bullets): how to structure benefit-led copy. For task 4 (A+ Content): which modules convert best and what to avoid.',
      },
      {
        title:   'Phase Milestone',
        content: 'Completing all 6 tasks unlocks the Listing Live milestone. Task 6 (listing active) requires inventory to be received at an FBA warehouse — create the draft listing in Seller Central now and activate it when stock is confirmed.',
      },
      {
        title:   'Image requirements',
        content: 'Main image: pure white background, product fills 85% of frame, no text or graphics — mandatory per Amazon policy. Lifestyle image: at least one showing the product in use — highest-converting secondary image type. Minimum 1000×1000px for zoom capability.',
      },
    ],
  },

  checklist_inventory: {
    name:    'Phase 06 · Logistics',
    tagline: '4 tasks to prepare, ship, and receive your first FBA inventory.',
    quickTip: 'Create your inbound shipment plan in Seller Central before your supplier ships — the FBA shipment ID and labels must be ready when the factory packs the order.',
    recommendation: '1. Create the Seller Central inbound shipment plan before production is complete — get the FBA labels to your supplier while factory is packing.\n2. Confirm FNSKU labels are applied correctly before shipment departs.\n3. Track delivery and verify received units in Seller Central within 30 days — dispute discrepancies immediately.',
    sections: [
      {
        title:   'Task List',
        content: 'Four tasks: (1) Create the inbound shipment plan in Seller Central. (2) Arrange FNSKU labelling — supplier-applied or via 3PL. (3) Book freight forwarder confirmed from Phase 04. (4) Track shipment and confirm FBA receipt.',
      },
      {
        title:   'AI Guidance Button',
        content: 'Tap ✦ AI on any task. For task 1 (shipment plan): step-by-step guide to creating an inbound shipment in Seller Central. For task 2 (labelling): supplier-applied vs 3PL labelling trade-offs. For task 4 (tracking): how to dispute missing units within the 30-day dispute window.',
      },
      {
        title:   'Phase Milestone',
        content: 'Completing all 4 tasks unlocks the Inventory Ready milestone. Amazon typically takes 3–5 business days to receive and process a shipment after delivery — account for this in your launch timing.',
      },
      {
        title:   'Labelling rules',
        content: 'Each unit must have a scannable FNSKU label, not the UPC barcode. Supplier-applied labelling is cheaper but requires a quality check — one wrong label mixes your inventory with another seller\'s. Use Amazon\'s Partnered Carrier programme for shipments under 150 lbs — often 20–30% cheaper than third-party freight.',
      },
    ],
  },

  checklist_go: {
    name:    'Phase 07 · Launch',
    tagline: '6 tasks to execute a structured product launch from day one.',
    quickTip: 'Your first 30 days on Amazon determine your long-term ranking trajectory — execute the launch plan, do not improvise.',
    recommendation: '1. Set a competitive launch price (at or below the average competitor) and activate Auto PPC on day one.\n2. Check PPC performance at day 7 and day 14 — pause underperforming keywords, raise bids on converters.\n3. At day 30, compare actual velocity against your Phase 01 estimate. That gap is your real product signal.',
    sections: [
      {
        title:   'Task List',
        content: 'Six tasks: (1) Set your launch price — competitive for first 30 days. (2) Activate Auto PPC campaign with your Phase 03 keyword list. (3) Enrol in Amazon Vine (if Brand Registry approved). (4) Monitor CTR, conversion, and ACoS in Seller Central. (5) Optimise PPC bids at day 7 and day 14. (6) Compare day-30 actual velocity against your Phase 01 demand estimate.',
      },
      {
        title:   'AI Guidance Button',
        content: 'Tap ✦ AI on any task. For task 2 (PPC): campaign structure, bid setting, and keyword match types for a new listing. For task 5 (bid optimisation): how to read the Search Term Report and which bids to raise or cut at day 7.',
      },
      {
        title:   'Phase Milestone',
        content: 'Completing all 6 tasks closes out the 35-task roadmap. Task 6 (day-30 review) is the most important — if actual velocity is below your Phase 01 estimate, adjust price or PPC before month 2, not after.',
      },
      {
        title:   'Launch pricing strategy',
        content: 'Set at or slightly below the average competitor price for the first 30 days. Accept 30–40% ACoS during launch — you\'re buying ranking velocity, not profit. After day 30, raise price by $0.50–$1.00 every 7 days until conversion rate drops, then hold.',
      },
    ],
  },

  // ─── LAUNCHPAD & WINNER VAULT ─────────────────────────────────────────────

  launchpad: {
    name:    'LaunchPad',
    tagline: 'Your guided 7-stage pipeline from product idea to launch-ready brand.',
    quickTip: 'Work stage by stage — every collapsed card saves your choices and you can tap any completed stage to revisit or change a decision.',
    recommendation: '1. Start with Discovery — paste an Amazon search or use one from Research. AI Analysis runs automatically.\n2. Lock in your Supplier and Freight, then run Calculations to get your margin and ROI.\n3. Build your Brand, then tap Publish to Winner Vault to save the full product record.',
    sections: [
      {
        title:   'Stage Pipeline',
        content: 'Seven sequential stages: Discovery → AI Analysis → Supplier → Freight → Calculations → Brand → Complete. Each stage locks the previous one and unlocks the next. Complete stages collapse into a summary card showing your key choices — tap any to expand and edit.',
      },
      {
        title:   'Discovery Stage',
        content: 'Enter a product idea or paste a keyword from Research. Siftly fetches live Amazon data — top result price, reviews, rating, and competition level. Your seller profile (budget, marketplace, price range) is checked for fit automatically. Tap "Use this product" to advance.',
      },
      {
        title:   'AI Analysis Stage',
        content: 'AI runs a verdict on the product — LAUNCH, TEST, or AVOID — with a confidence score and reasons. If you disagree with the verdict, tap "Override and continue" to proceed anyway (stage is marked soft pass). You can always revisit.',
      },
      {
        title:   'Supplier Stage',
        content: 'Enter your supplier details: name, unit cost, MOQ, and platform. These flow directly into the Calculations stage. If you found a supplier in Research → Suppliers, copy the unit cost across here.',
      },
      {
        title:   'Freight Stage',
        content: 'Enter product dimensions and quantity — Siftly calculates sea, air, express, and FCL costs instantly using industry rates. Select the mode you plan to use. Cost per unit feeds directly into the profit calculation.',
      },
      {
        title:   'Calculations Stage',
        content: 'Full unit economics waterfall: selling price → FBA fee → COGS → freight → net profit. Shows margin %, ROI %, and estimated monthly profit. Verdict: Profitable / Viable / Marginal / Unprofitable. You can override a Marginal result and continue.',
      },
      {
        title:   'Brand Stage',
        content: 'Name your brand, choose a style, describe your audience and colour tone. Siftly generates: logo SVG, product label SVG, packaging insert SVG, Amazon listing title, bullet points, product description, and backend SEO keywords. All in one tap.',
      },
      {
        title:   'Publish to Winner Vault',
        content: 'Once the Brand stage is complete, tap "Publish to Winner Vault." The full product record — financials, brand, supplier, freight — is saved permanently. It appears on your Copilot dashboard and can be exported as a PDF report.',
      },
    ],
  },

  winner_vault: {
    name:    'Winner Vault',
    tagline: 'Your completed product builds — full financials, brand details, and exportable PDF reports.',
    quickTip: 'Tap any vault card on Copilot to open the full detail view — margin breakdown, unit economics, supply chain, and one-tap PDF export.',
    sections: [
      {
        title:   'What gets saved',
        content: 'When you publish from LaunchPad, the vault stores: product title, brand name, marketplace, selling price, unit cost, margin %, ROI %, estimated monthly profit, supplier name, freight mode, and freight per unit. All derived from your actual pipeline choices — not estimates.',
      },
      {
        title:   'Vault Cards (Copilot)',
        content: 'Each card on the Copilot dashboard shows a colour-coded top bar (green = strong margin, amber = viable, red = review), verdict badge, margin %, ROI %, and monthly profit estimate. Tap any card to open the full detail view.',
      },
      {
        title:   'Detail View',
        content: 'The full breakdown includes: verdict with confidence bar, full P&L waterfall (selling price → COGS → freight → FBA fees → net profit per unit), estimated units per month, supplier info, freight mode, and session metadata. All in a clean card layout.',
      },
      {
        title:   'PDF Export',
        content: 'Tap "Export PDF Report" at the bottom of the detail view. Siftly generates a branded PDF with your full product report — hero metrics, P&L waterfall, supply chain grid — and opens the share sheet so you can save to Files, AirDrop to a partner, or email it.',
      },
      {
        title:   'What to do with a vault entry',
        content: 'Use the PDF to share with a business partner, investor, or accountant. The data is the output of your full research, analysis, and financial pipeline — it\'s a complete decision document. For active products, return to Research to monitor competition and price shifts.',
      },
    ],
  },

  freight_tab: {
    name:    'Freight Estimator',
    tagline: 'Instant sea, air, express, and FCL cost estimates — cost per unit and transit time.',
    quickTip: 'Use sea freight for orders over 150 kg. Air makes sense when a stockout costs more than the freight premium. Always get real quotes to validate these estimates.',
    recommendation: '1. Enter dimensions and order quantity, then tap Search Freight.\n2. Select the mode you plan to use and note the cost per unit.\n3. Use cost per unit as "freight per unit" in LaunchPad → Freight stage or Profit Lab → Landed Cost.',
    sections: [
      {
        title:   'Inputs',
        content: 'Length, width, and height of a single unit in cm; unit weight in kg; total units in the order. The calculator uses chargeable weight (the greater of actual weight and volumetric weight) to match how real freight forwarders charge.',
      },
      {
        title:   'Results — 4 modes',
        content: 'Sea LCL (Less than Container Load): cheapest for orders under 10 CBM, ~30 day transit. Sea FCL (Full Container): best value for large orders over 10 CBM, ~28 day transit. Air freight: 7–10 day transit, roughly 8× sea LCL cost. Express courier: 3–5 day transit, premium rate, for urgent restocks only.',
      },
      {
        title:   'Cost per unit',
        content: 'The most useful output for your financial model. Take the sea LCL cost per unit → enter into LaunchPad → Freight stage or Profit Lab → Landed Cost. This single input changes your margin projection more than most other variables.',
      },
      {
        title:   'Important caveat',
        content: 'These are industry-rate estimates using published carrier rate benchmarks. Actual freight quotes from a licensed forwarder will differ by 10–30% depending on route, season, and surcharges. Always get 2–3 real quotes before placing an order.',
      },
    ],
  },

  // ─── SYSTEM ────────────────────────────────────────────────────────────────

  paywall: {
    name:    'Plans & Upgrade',
    tagline: 'Explorer (free), Builder, and Operator — progressively unlocking more features.',
    quickTip: 'Explorer is enough to validate a niche idea. Upgrade to Builder when you have a shortlisted product and need Feasibility Check.',
    sections: [
      {
        title:   'Tier Cards',
        content: 'Three tiers: Explorer (free) — Market Search, Supplier Search, Vault with limited saves, all Profit Lab calculators. Builder — adds Feasibility Check, Risk Assessment, Capital Estimator, Go/No-Go Decision, Launch Readiness, and full Brand Studio output. Operator — removes all limits: unlimited saves, full AI context, and priority analysis.',
      },
      {
        title:   'Feature Comparison',
        content: 'Locked features show a ✕ in your account settings (tier badge → top right). Tap any locked feature anywhere in the app to see the upgrade prompt for that specific feature — it shows exactly which plan unlocks it.',
      },
      {
        title:   'Upgrade Button',
        content: 'Tap the tier badge (top right in the header) to open account settings. Tap "Upgrade to Operator" or "Unlock Full Access" to open the paywall. Subscriptions are managed through your App Store or Google Play account.',
      },
      {
        title:   'Which plan to choose',
        content: 'Explorer: use Market Search to validate 3 product ideas first — free. Builder: the right upgrade when you have a shortlisted product and need full analysis. Operator: for sellers managing two or more products simultaneously — unlimited saves and full AI context pay for themselves quickly.',
      },
    ],
  },
};
