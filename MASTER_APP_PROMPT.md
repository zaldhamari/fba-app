# Master App Build Prompt
## Reusable template for commerce intelligence mobile apps

Replace every `[PLATFORM]`, `[BRAND]`, `[MARKET]` token with your target (Shopify, Etsy, TikTok Shop, etc.) and hand this to an AI coding assistant to build a production-quality app.

---

## PART 1 — CONCEPT & POSITIONING

Build a premium mobile app called **[BRAND]** for **[PLATFORM]** sellers.

**Primary tagline:** Built for modern independence.

**Core positioning:**
- Intelligent opportunity discovery for [PLATFORM] commerce
- AI-assisted decisions — not guesswork
- Calm confidence, modern ambition, intelligent independence
- Future-aware commerce building — NOT hustle culture

**Tone rules (critical):**
- DO: premium, intelligent, modern, aspirational, subtle
- DO NOT: passive income language, "get rich quick", hustle culture, guru tone, "financial freedom" clichés
- Emotional direction: calm confidence · modern ambition · intelligent independence

---

## PART 2 — TECH STACK

```
Framework:     React Native + Expo SDK 54 (managed workflow, no ios/android dirs)
Language:      TypeScript (strict)
Navigation:    React Navigation v6 — Stack Navigator wrapping a Bottom Tab Navigator
Storage:       AsyncStorage (@react-native-async-storage/async-storage)
Safe area:     react-native-safe-area-context
Export/share:  React Native built-in Share API only (no expo-print, no expo-sharing — breaks Expo Go)
Testing:       Expo Go compatible throughout (no native-only modules)
```

**File structure:**
```
src/
  screens/          — one file per screen
  components/       — reusable UI components
  hooks/            — custom React hooks (state + AsyncStorage)
  context/          — React Context providers
  services/         — API layer (single api.ts file)
  types/            — shared TypeScript interfaces
  utils/            — pure logic utilities (no UI imports)
  theme/            — single index.ts design system
  navigation/       — RootNavigator.tsx + TabNavigator.tsx
```

---

## PART 3 — DESIGN SYSTEM (copy exactly)

Create `src/theme/index.ts` with this exact system:

```typescript
export const colors = {
  // Canvas layers (blue-tinted light theme — NOT white/gray)
  bg:         '#ECF1FB',   // Richer blue-tinted canvas
  bgCard:     '#FFFFFF',   // White card surface
  bgElevated: '#E3EBF7',   // Recessed inputs, chips
  bgSubtle:   '#F4F8FF',
  bgHero:     '#D8E8FF',   // Atmospheric hero sections

  // Primary action color — [PLATFORM] accent (use cyan #0284C7 as default)
  cyan:       '#0284C7',
  cyanLight:  '#E0F2FE',
  cyanDim:    'rgba(2,132,199,0.09)',
  cyanBorder: 'rgba(2,132,199,0.22)',

  // Secondary — AI/intelligence color
  purple:       '#5B50E8',
  purpleLight:  '#EEF2FF',
  purpleDim:    'rgba(91,80,232,0.10)',
  purpleBorder: 'rgba(91,80,232,0.22)',

  // Supporting palette
  pink:       '#DB2777',   pinkLight:  '#FCE7F3',   pinkDim:    'rgba(219,39,119,0.09)',
  amber:      '#D97706',   amberLight: '#FEF3C7',   amberDim:   'rgba(217,119,6,0.10)',
  green:      '#059669',   greenLight: '#D1FAE5',   greenDim:   'rgba(5,150,105,0.10)',
  red:        '#DC2626',   redLight:   '#FEE2E2',

  // Text — blue-tinted, NOT gray
  textPrimary:   '#091428',
  textSecondary: '#375170',
  textMuted:     '#6D8DAF',

  // Borders — visible but subtle
  border:       '#C8D5EA',
  borderBright: '#B0C4DF',

  white: '#FFFFFF',
  black: '#091428',
  bgInput: '#E3EBF7',
};

export const shadow = {
  // ALL shadows use deep chromatic blue — never gray
  sm:   { shadowColor: '#0D1E3A', shadowOffset: { width: 0, height: 1  }, shadowOpacity: 0.10, shadowRadius: 5,  elevation: 2  },
  md:   { shadowColor: '#0D1E3A', shadowOffset: { width: 0, height: 4  }, shadowOpacity: 0.13, shadowRadius: 14, elevation: 5  },
  lg:   { shadowColor: '#0D1E3A', shadowOffset: { width: 0, height: 8  }, shadowOpacity: 0.17, shadowRadius: 24, elevation: 9  },
  card: { shadowColor: '#0D1E3A', shadowOffset: { width: 0, height: 3  }, shadowOpacity: 0.12, shadowRadius: 12, elevation: 5  },
  float:{ shadowColor: '#0D1E3A', shadowOffset: { width: 0, height: 12 }, shadowOpacity: 0.22, shadowRadius: 32, elevation: 14 },
  // Chromatic glows for primary CTAs and verdict moments
  glowCyan:   { shadowColor: '#0284C7', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.28, shadowRadius: 22, elevation: 11 },
  glowPurple: { shadowColor: '#5B50E8', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.28, shadowRadius: 22, elevation: 11 },
  glowGreen:  { shadowColor: '#059669', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.32, shadowRadius: 24, elevation: 12 },
  glowRed:    { shadowColor: '#DC2626', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.26, shadowRadius: 20, elevation: 10 },
  glowAmber:  { shadowColor: '#D97706', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.26, shadowRadius: 20, elevation: 10 },
};

export const spacing = { xs: 4, sm: 8, md: 16, lg: 24, xl: 32, xxl: 52 };
export const radius  = { sm: 6, md: 10, lg: 14, xl: 18, xxl: 24, full: 999 };

export const motion = {
  snap:    150,   // Tap feedback, dismiss, toggle
  flow:    250,   // Navigation, expand/collapse
  reveal:  420,   // Content entrance
  verdict: 580,   // Cinematic reveal moments (slow = weight)
  fill:    950,   // Progress bar slow fill (anticipation)
  stagger: 55,    // Per-item list entrance delay
  spring:  { tension: 120, friction: 7 },
};
```

---

## PART 4 — NAVIGATION ARCHITECTURE

```
RootNavigator (Stack)
├── Onboarding   (shown once, stored in AsyncStorage)
├── Paywall      (subscription gate)
└── Main (Tab Navigator)
    ├── Co-Pilot   — journey/progress hub (tab 1, purple)
    ├── Research   — main discovery screen (tab 2, cyan)
    ├── Brand      — brand + listing builder (tab 3, pink)
    ├── Keywords   — SEO intelligence (tab 4, amber)
    ├── Suppliers  — sourcing + outreach (tab 5, green)
    ├── Calculator — profit modeling (tab 6, purple)
    └── Launch     — checklist + ideas (tab 7, green)
```

**Tab bar pattern:** Custom floating pill tab bar. Active tab shows icon + label in a colored chip (`${tab.color}22` bg). Inactive shows icon only in `textMuted`. No default React Navigation tab bar.

---

## PART 5 — SCREEN BLUEPRINTS

### 5A. OnboardingScreen

3-slide animated walkthrough. Each slide: animated icon orb (breathing rings) + eyebrow + title + body + optional verdict badge.

**Slide structure:**
```
Slide 1 — DISCOVER · 1 OF 3
  "Find what's worth building."
  "Real [PLATFORM] signals. [Metric 1]. [Metric 2]. One search reveals genuine demand."
  accentColor: cyan

Slide 2 — DECIDE · 2 OF 3
  "AI tells you: build or move on."
  "Tap any opportunity. Margin, demand, and risk — clear signal in seconds."
  accentColor: green
  badge: { label: 'LAUNCH', sub: '87% confidence · 34% margin · Rising' }

Slide 3 — BUILD · 3 OF 3
  "From signal to business."
  "Brand, listing, keywords, supplier — your full commerce stack in one place."
  accentColor: purple
```

**Top bar pattern:** Row with brand wordmark left + Skip button right.
```
Siftly                              Skip
Built for modern independence.
```

**Animations:** Slide entrance uses `Animated.spring` for the content view. Icon orb uses `Animated.loop` breathing (scale 1.0 → 1.10 → 1.0 over 2s). Transition between slides: fade out + translateY up, then fade in + spring back.

**Bottom:** Progress dots (active dot expands width to 28, colored with slide accent) + full-width CTA pill button.

### 5B. PaywallScreen

Full-screen subscription selection. Three tiers.

**Header:**
```
◎  [BRAND NAME]                 (badge pill, cyanDim bg)
One platform.
Full independence.               (38px, weight 900, cyan color)
From first opportunity to a self-sustaining commerce operation — powered by AI.
```

**Tiers:**
| Tier | Price | Description |
|------|-------|-------------|
| Explorer | Free | "Explore the platform and experience the signal before committing a cent." |
| Builder  | $17/mo ($9.92 annual) | "Everything you need to find, validate, and launch with confidence." |
| Operator | $39/mo ($24 annual) | "No limits. Built for commerce operators already moving at scale." |

**Annual toggle:** Switch + "SAVE 40%" green badge pill.

**Feature comparison table:** Scrollable, alternating row colors. Explorer/Builder/Operator columns.

**One-time purchase upsell:** "Launch Pack" card at bottom — $79, lists what's included.

**Footer copy:** "Payments processed securely. Subscriptions auto-renew. Cancel anytime."

### 5C. Research Screen (main screen)

**Hero section:**
```
[3 atmospheric orbs — layered, different sizes, low opacity, positioned off-screen edges]

Siftly                                  [CurrencySelector pill]
Built for modern independence.          [Usage pill — free users only]
OPPORTUNITY INTELLIGENCE                [Vault button]
Find what's
worth building.
Real demand · AI signal · [N] markets
```

**Mode tabs:** Pill-shaped segmented control. "Search [PLATFORM]" | "[Platform-specific mode]"

**Search row:** TextInput (flex 1) + arrow button (cyan bg + glowCyan shadow).

**Result cards:** For each product:
- Left color accent strip (3px, verdict-colored when analyzed)
- Product image (44×44 thumbnail)
- Title (2 lines max), price, competition level, marketplace
- Competition bar (visual width = 30%/60%/90% for Low/Med/High)
- Review count + trend direction
- Action row: "Analyze ⚡" CTA + "Save" toggle + "Compare" checkbox

**AI Verdict reveal (cinematic):** Animated card that appears below product card after analysis:
- Verdict badge: LAUNCH / TEST / AVOID (colored: green/amber/red) with glow shadow matching verdict
- Animated confidence bar (fills from 0% over 950ms — creates anticipation)
- Stats grid: Margin % · Risk level · Trend
- Summary text (AI-generated)
- Next step recommendation
- "Save to Vault →" button

**Opportunity Vault (toggleable panel):**
Replaces the search results. Accessible via "Vault (N)" button in hero top-right.

Vault toolbar (always visible when vault shown):
```
OPPORTUNITY VAULT          [↓ Export button]
N opportunities saved
```

VaultFilterBar: TextInput search + horizontal scrollable status chips.

VaultCard per entry:
- Verdict-colored 3px left accent strip
- Product image + title + price + marketplace + competition color
- Verdict stamp (bordered box, colored text: LAUNCH/TEST/AVOID + confidence %)
- Status pill (tap to open dropdown: Researching / Supplier Sent / Testing / Ready to Launch / Rejected)
- AI summary quote (italic)
- Note field (tap to edit inline)
- Actions: "↗ Share" pill + "✕ Remove" text

Export modal (bottom sheet):
- Spreadsheet (CSV) — 11 columns, React Native Share API
- Full Report (Text) — ASCII formatted, React Native Share API

Share opportunity modal (full screen, fade animation):
- Brand header (SIFTLY · COMMERCE INTELLIGENCE)
- Large verdict badge + confidence %
- Product title
- AI summary
- Stats grid (price / competition / marketplace)
- Status badge
- Footer: "Discovered with Siftly · [date]"
- "↗ Share Opportunity" button

### 5D. Co-Pilot Screen

Step-by-step journey tracker. Shows user's progress across the full workflow.

**Header:**
```
Siftly                    [Tier pill — pulsing dot + tier name]
YOUR PATH
```

**Progress card:**
- Large number (N/7 steps complete)
- Animated progress bar

**Step cards (7):**
Each step: numbered badge (01–07) + colored icon + title + description + "→ Go" button that deep-links to the relevant tab.
```
01 ◎ Discover Your Opportunity      → Research tab
02 ✦ Build Your Brand               → Brand tab
03 ≋ Research Keywords              → Keywords tab
04 ⬡ Source Your Supplier           → Suppliers tab
05 ◈ Model Your Economics           → Calculator tab
06 ≡ Create Your Listing            → Brand tab
07 ↑ Launch with Confidence         → Launch tab
```

Completed steps show at 65% opacity with strikethrough styling.

**Tip of the day:** Rotating insight card below steps.

**Stats row:** "N done · N remaining · Est. X weeks"

### 5E. Brand Screen

Two tabs: Brand Creator | Listing Builder.

**Brand Creator inputs:** Product type + optional brand name + style selector (Minimal / Modern / Premium / Playful) → "Generate Brand ✦" button.

**Brand Creator output:**
- Brand name options (5 clickable chips) or single name
- Tagline
- Keyword tag cloud
- Product title (copyable)
- Description (copyable + char count)
- Backend keywords (copyable + char count)
- Bullet points (5)

**Listing Builder output:**
- Listing quality score (0–100 circle, green/amber/red) with 5 pass/fail checks
- Title + char count
- Bullets with individual char counts
- Description + char count
- Backend keywords

### 5F. Keywords Screen

**Hero:**
```
Siftly
KEYWORD INTELLIGENCE
Find what
buyers search.
[Search input] [→ button + glowCyan]
```

Atmosphere: amber + cyan orbs behind hero (bgHero background).

**Results layout (top → bottom):**

1. Stats row: Total found · SEO Score ring · Top PPC count
2. SEO score reason (1-line explanation)
3. Strategy Insights (4 bullets, expandable)
4. Listing Recommendations (5 rows: Title suggestion / PPC keyword / Backend terms / Long-tail / Buyer intent)
5. Keyword Clusters (5 sections):
   - High Intent Buyers
   - Long-tail Opportunities
   - PPC Targets
   - Low Competition
   - Backend Search Terms

**Per keyword card:**
- Keyword text + type badge (Head/Long-tail/Buyer Intent/PPC)
- Competition bar (visual)
- Opportunity score (0–96)
- Ranking difficulty + conversion intent pills
- Recommended usage chips (Title / Bullet / PPC / Backend)

**Export:** CSV via React Native Share (10 columns).

**SEO Scoring algorithm (deterministic, no Math.random):**
```
Local score = diversity(15%) + competition(28%) + intent(27%) + longTail(20%) + buyer(10%)
Final score = local * 0.65 + apiScore * 0.35
Clamped: 22–95
```

**Keyword enrichment (deterministic):**
Use a string hash function `strHash(s) = s.split('').reduce((h,c) => (h*31 + c.charCodeAt(0)) & 0xffff, 0)` to add ±6 consistent variation to opportunity scores. Never use Math.random for scores — they must be stable across renders.

### 5G. Suppliers Screen

**Hero:**
```
Siftly
SUPPLIER SOURCING
Find the right
supplier.
Surface vetted global suppliers and send professional outreach — ranked by quality signals
```

**Search:** Product input → returns supplier cards.

**Supplier card:**
- Supplier name + country flag
- Confidence Index (score 0–100)
- Min order / price range / lead time stats
- "Send Outreach" button → generates professional email template
- "View on [Platform]" link

**Supplier Confidence Index scoring card:** Shows breakdown of quality signals (verified status, response rate, years active, sample availability).

**Email template generator:** Modal with pre-filled professional outreach. User edits and shares via Share API.

**Empty state:** "Enter a product — we surface suppliers ranked by quality signals, globally."

### 5H. Calculator Screen

**Modes (tab-scrollable or segmented, 9 total):**
```
1. FBA Calculator    — Revenue − COGS − FBA fees − shipping = Net profit
2. Margin Finder     — Given target margin, find max COGS
3. Break-even        — Units needed to cover fixed costs
4. PPC Estimator     — ACoS, CPC, conversion rate
5. Landed Cost       — Product + freight + duties + prep
6. ROI Calculator    — Cash-on-cash return on inventory investment
7. Reorder Planner   — Days of stock remaining + reorder point
8. Bundle Analyzer   — Multi-unit bundle vs single-unit economics
9. VAT/Tax           — Market-specific tax calculations
```

**Header:**
```
Siftly                    [Currency Selector]
PROFIT CALCULATOR
Know your
numbers.
```

**CurrencySelector:** Converts all inputs/outputs to selected currency in real time. Supports 6 currencies (USD/CAD/GBP/EUR/AED/SAR) with live exchange rates (24h cache) and fallback hardcoded rates.

### 5I. Launch Screen

Two tabs: Launch Checklist | Product Ideas.

**Header:**
```
Siftly
LAUNCH CONTROL
Idea to income.
Step by step.
```

**Checklist tab:**
Progress card (% complete + N/total + Reset button + progress bar).
6 phases, each with 4–6 checkbox items:
Product Validation / Supplier & Sourcing / Brand & Account / Listing Creation / Shipping to Amazon / Launch.

Completed items: strikethrough + green checkmark + subtle green tint.

Hint: "Work through each phase in order — methodical execution is the most reliable path to a successful launch."

**Product Ideas tab:**
Filters: Budget range chips + Weight chips + Competition tolerance.
"Generate Ideas" → shows up to 8 matching product cards.

Product idea card:
- Name + category + "↑ TRENDING" badge (if trending)
- Why this product (1 sentence)
- Stats: Price / Margin / Competition / Min. Budget

---

## PART 6 — DATA MODELS

### Subscription / Tier System
```typescript
type Tier = 'explorer' | 'builder' | 'operator';

const PLANS = {
  explorer: { name: 'Explorer', monthly: 0,  annual: 0,   annualMonthly: 0     },
  builder:  { name: 'Builder',  monthly: 17, annual: 119, annualMonthly: 9.92  },
  operator: { name: 'Operator', monthly: 39, annual: 288, annualMonthly: 24.00 },
};

// Usage limits per tier — enforce in each screen with `can(feature)` check
const LIMITS = {
  explorer: { research: 3, suppliers: 1, keywords: 0, brands: 1, saves: 0 },
  builder:  { research: 50, suppliers: 20, keywords: 20, brands: 5, saves: 10 },
  operator: { research: 9999, suppliers: 9999, keywords: 9999, brands: 9999, saves: 9999 },
};
```

### Opportunity Vault Entry
```typescript
type VaultStatus = 'researching' | 'supplier_contacted' | 'testing' | 'ready_to_launch' | 'rejected';

interface VaultEntry {
  asin: string;            // unique product ID (adapt to platform: SKU, ASIN, listing ID)
  product: Product;
  analysis: AnalysisSnapshot | null;
  status: VaultStatus;
  note: string;
  marketplace: string;
  currency: string;
  savedAt: string;         // ISO string
  updatedAt: string;
}
```

### Currency System
```typescript
type CurrencyCode = 'USD' | 'CAD' | 'GBP' | 'EUR' | 'AED' | 'SAR';

// Live rates from open.er-api.com/v6/latest/USD
// Cache for 24 hours in AsyncStorage
// Hardcoded fallback rates for offline use
// All prices stored in local currency, converted on display
```

### Keyword Enrichment
```typescript
interface EnrichedKeyword {
  keyword: string;
  type: 'Head' | 'Long-tail' | 'Buyer Intent' | 'PPC';
  competition: 'Low' | 'Medium' | 'High';
  opportunity_score: number;           // 18–96, deterministic via strHash
  search_intent: 'Informational' | 'Commercial' | 'Transactional';
  ranking_difficulty: 'Easy' | 'Medium' | 'Hard';
  conversion_intent: 'Low' | 'Medium' | 'High';
  recommended_usage: ('Title' | 'Bullet' | 'Backend' | 'PPC')[];
}
```

---

## PART 7 — COMPONENT PATTERNS

### Hero Section (every screen)
```
Structure:
  View (bgHero bg, paddingH: 24, overflow: hidden)
    View (heroOrb1 — absolute, 220–260px circle, cyanDim, opacity 0.45–0.55, top-right)
    View (heroOrb2 — absolute, 90–100px circle, purpleDim, opacity 0.35–0.45, mid-right)
    View (heroOrb3 — absolute, 130–160px circle, cyanDim, opacity 0.25–0.35, bottom-left)
    View (heroTop — row, space-between)
      View (left column)
        Text (brandWord — "Siftly", 20px, weight 900, textPrimary, letterSpacing -0.8)
        Text (brandTagline — "Built for modern independence.", 10px, textMuted) [main screen only]
        Text (eyebrow — "SECTION NAME", 9px, weight 800, cyan, letterSpacing 2.8)
        Text (title — main headline, 26–30px, weight 900, textPrimary, letterSpacing -1.2)
        Text (titleSub — supporting line, 11px, textSecondary) [optional]
      View (right column — controls)
    [Search row if applicable]
  borderBottom: 1px cyanBorder
```

### Atmospheric Orb Pattern
```typescript
// 3 orbs create layered depth — never a single orb
heroOrb1: { position:'absolute', top:-60, right:-50, width:220, height:220, borderRadius:110, backgroundColor:colors.cyanDim, opacity:0.55 }
heroOrb2: { position:'absolute', top:20,  right:60,  width:90,  height:90,  borderRadius:45,  backgroundColor:colors.purpleDim, opacity:0.45 }
heroOrb3: { position:'absolute', bottom:-40,left:-30,width:130, height:130, borderRadius:65,  backgroundColor:colors.cyanDim, opacity:0.35 }
```

### Primary CTA Button
```typescript
// Always: cyan bg + glowCyan shadow + radius.md + centered text
searchBtn: {
  backgroundColor: colors.cyan,
  borderRadius: radius.md,
  paddingHorizontal: spacing.lg,
  justifyContent: 'center', alignItems: 'center',
  ...shadow.glowCyan,  // the glow is what makes it feel premium
}
```

### Card Pattern
```typescript
// Shadow wrapper (no overflow:hidden — needed for shadow)
cardShadow: { marginHorizontal: 24, borderRadius: radius.xl, backgroundColor: colors.bgCard, ...shadow.card }
// Inner card (overflow:hidden clips image corners)
card: { backgroundColor: colors.bgCard, borderRadius: radius.xl, overflow:'hidden', borderWidth:1, borderColor:colors.border, borderTopWidth:3 /* colored accent */ }
```

### Paywall Gate Pattern
```typescript
// In every feature screen:
const { can, increment } = useSubscription();

async function runFeature() {
  if (!can('featureName')) { setShowPaywall(true); return; }
  // do the thing
  await increment('featureName');
}
```

### Loading State
Use `PulseDots` component instead of ActivityIndicator on primary buttons:
```typescript
// 3 dots that animate opacity in sequence
// Pass color={colors.white} for dark buttons
```

### Empty State
```typescript
<View style={{ alignItems:'center', paddingTop:80, gap: spacing.sm }}>
  <Text style={{ fontSize:48, color:colors.textMuted }}>◎</Text>
  <Text style={{ fontSize:14, color:colors.textSecondary, textAlign:'center', lineHeight:22 }}>
    [Single sentence. Discovery-oriented. Never apologetic.]
  </Text>
</View>
```

### Bottom Sheet Modal
```typescript
// animationType="slide", transparent, overlay with backdrop touchable
// Sheet: bgCard bg, borderTopLeft/Right 28, borderTopWidth 1, cyanBorder
// Handle bar: 40x4, bgElevated, alignSelf center, marginBottom 24
// Max height: 90%
```

---

## PART 8 — STATE MANAGEMENT PATTERNS

### AsyncStorage Key Naming
```
[app_name]_[feature]_v[version]

Examples:
  siftly_vault_v2
  siftly_tier_v3
  siftly_usage_v3
  siftly_currency_v1
  siftly_fx_rates_v1
  siftly_fx_ts_v1
```

Always version your keys. On app update, migrate old data rather than wiping it.

### Vault Hook Pattern
```typescript
export function useVault() {
  const [entries, setEntries] = useState<VaultEntry[]>([]);

  // Load on mount — with legacy migration
  useEffect(() => { loadVault(); }, []);

  // IMPORTANT: persist inside setEntries callback so you always write the latest state
  async function addEntry(product, analysis, marketplace, currency) {
    setEntries(prev => {
      const existing = prev.findIndex(e => e.asin === product.asin);
      let next: VaultEntry[];
      if (existing >= 0) {
        next = prev.map((e, i) => i === existing
          ? { ...e, analysis: analysis ?? e.analysis, updatedAt: new Date().toISOString() }
          : e
        );
      } else {
        next = [newEntry, ...prev];
      }
      AsyncStorage.setItem(VAULT_KEY, JSON.stringify(next));  // inside callback = latest state
      return next;
    });
  }

  return { entries, addEntry, removeEntry, updateStatus, updateNote, updateAnalysis, hasEntry, getEntry };
}
```

### Currency Context Pattern
```typescript
// Always guard against corrupted AsyncStorage values:
const safeCurrency = CURRENCIES[currency] ? currency : 'USD';
const rate = rates[safeCurrency] ?? FALLBACK_RATES[safeCurrency] ?? 1;

// Provide: currency, marketplace, rates, symbol, flag, fmt, fmtLocal, fromUSD, toUSD, setCurrency, setMarketplace
// fmt(usdAmount) → converts USD to selected currency string with symbol
// fmtLocal(localAmount) → just adds symbol, no conversion
```

---

## PART 9 — COPY SYSTEM

### Eyebrow labels (9px, weight 800, cyan, letterSpacing 2.8, ALL CAPS)
These sit below the brand wordmark. They name the section:
```
Research screen:   OPPORTUNITY INTELLIGENCE
Co-Pilot screen:   YOUR PATH
Brand screen:      BRAND BUILDER
Keywords screen:   KEYWORD INTELLIGENCE
Suppliers screen:  SUPPLIER SOURCING
Calculator screen: PROFIT CALCULATOR
Launch screen:     LAUNCH CONTROL
```

### Headline style (weight 900, letterSpacing -1.2)
```
Research:   "Find what's worth building."
Co-Pilot:   "Your Journey"
Brand:      "Build your brand identity."
Keywords:   "Find what buyers search."
Suppliers:  "Find the right supplier."
Calculator: "Know your numbers."
Launch:     "Idea to income. Step by step."
```

### Paywall contextual headlines (when feature is locked)
```typescript
const CONTEXT_HEADLINES = {
  research:  'You\'ve used your free searches.',
  suppliers: 'Supplier sourcing is a Builder feature.',
  keywords:  'Keyword intelligence is a Builder feature.',
  brands:    'You\'ve used your free brand kits.',
  saves:     'Opportunity vault is a Builder feature.',
  default:   'Unlock the full platform.',
};
```

### AI verdict copy
```
LAUNCH — "Strong opportunity. Margin and demand align."
TEST   — "Promising signal. Validate before scaling."
AVOID  — "Risk outweighs opportunity here."
```

---

## PART 10 — API SERVICE LAYER

Create `src/services/api.ts` with one class/object. All API calls go here. Never call fetch directly from screens.

```typescript
const API_BASE = 'https://your-backend.com';

export const api = {
  searchProducts: (query, marketplace, currency) => fetch(...),
  analyzeProduct:  (product, marketplace, currency) => fetch(...),
  researchKeywords:(query, marketplace) => fetch(...),
  searchSuppliers: (query) => fetch(...),
  createBrand:     (product, style, name) => fetch(...),
  analyzeCopilot:  (params) => fetch(...),
  analyzeReviews:  (title, category) => fetch(...),
  estimateBSR:     (category, rank, marketplace) => fetch(...),
};
```

Use `AbortSignal.timeout(8000)` on all fetches. Never let a network call hang indefinitely.

---

## PART 11 — PLATFORM ADAPTATION GUIDE

To adapt this for a different platform, replace these tokens:

| Token | Amazon FBA | Shopify | Etsy | TikTok Shop |
|-------|-----------|---------|------|-------------|
| Product ID | ASIN | SKU / Handle | Listing ID | SKU |
| Market metric | BSR Rank | Search volume / traffic | Listing views | Video views |
| Competition | Review count | Domain authority | Listing count | Creator count |
| Fee structure | FBA fees | Shopify % + payment | Etsy listing + % | TikTok % |
| Supplier source | Alibaba / Global Sources | Printify / Faire | Handmade / Faire | Alibaba |
| Keyword tool | Amazon search terms | Google / Shopify | Etsy search | TikTok hashtags |
| Analytics label | BSR Estimator | Traffic Estimator | Listing Score | View Rate |
| Marketplace label | US / UK / DE / CA / AE / SA | Stores (by country) | US / UK / AU / CA | Regions |

**Screen-level platform adaptations:**

- **Research:** Replace "Amazon search" with "[Platform] search". Replace BSR with platform-specific demand signal.
- **Suppliers:** For Shopify/Etsy handmade — replace with "Source Materials" or "Printify Integration".
- **Calculator:** Replace FBA fee structure with platform's fee structure. Keep the 9-mode pattern.
- **Keywords:** Replace Amazon search intent with platform-specific search behavior (Google for Shopify, Etsy search for Etsy, hashtags/sounds for TikTok).
- **Launch Checklist:** Swap out Amazon-specific steps for platform-specific launch steps.
- **Co-Pilot steps:** Same 7-step structure, rename steps to fit platform workflow.

---

## PART 12 — SUBSCRIPTION PLAN FEATURE COPY TEMPLATE

```typescript
PLAN_FEATURES = {
  explorer: [
    '[N] product searches / month',
    '[N] supplier searches / month',
    '[N] AI [brand/listing] generations',
    'Full profit calculator',
    'Full journey guide',
    'Launch checklist',
  ],
  builder: [
    'Discover opportunities — [N] searches/mo',
    'Source suppliers — [N] searches/mo',
    'Keyword intelligence — [N] searches/mo',
    'Brand kits & listings — [N]/mo',
    'Save up to [N] opportunities',
    'Supplier outreach templates',
    'Opportunity scoring',
    'All [N] calculator modes',
  ],
  operator: [
    'Unlimited opportunity discovery',
    'Unlimited supplier sourcing',
    'Unlimited keyword intelligence',
    'Unlimited brand kits & listings',
    'Unlimited opportunity vault',
    'Priority AI generation',
    'Export data to CSV',
    'Everything in Builder',
  ],
};
```

---

## PART 13 — APP STORE METADATA

```
App name:       Siftly
Subtitle:       Commerce intelligence platform
Short desc:     Discover, validate, and launch [PLATFORM] products — guided by AI.
Category:       Business / Productivity
Keywords:       [platform] seller, product research, [platform] analytics, opportunity finder

Marketing headline:
"The intelligent [PLATFORM] commerce platform. Built for modern independence."

Splash tagline:
"Built for modern independence."

Website hero (if applicable):
"[PLATFORM] commerce intelligence. Find the signal in the noise."
```

---

## PART 14 — IMPORTANT CONSTRAINTS TO GIVE THE AI

When prompting an AI coding assistant with this document, also include these hard rules:

```
TECHNICAL CONSTRAINTS:
- Expo managed workflow — no custom native modules
- All exports use React Native Share API only (no expo-print, expo-sharing)
- AsyncStorage for all persistence (no SQLite, no Realm)
- No Math.random() for scores or enrichment — use deterministic hash functions
- AbortSignal.timeout(8000) on every fetch call
- Currency context must guard against corrupted AsyncStorage with fallback to USD
- Shadow must be on a separate wrapper View from overflow:hidden cards

DESIGN CONSTRAINTS:
- Light theme only — NOT dark mode
- Shadow color always #0D1E3A (chromatic deep blue) — NEVER #64748B or gray
- Three orbs in hero sections — never a single orb
- Primary CTA buttons always have matching glow shadow (glowCyan, glowGreen, etc.)
- All text colors from theme tokens — never hardcode #000 or #fff for text
- bgHero (#D8E8FF) for all hero sections — not bgCard white

COPY CONSTRAINTS:
- Never use: "win", "crush", "dominate", "passive income", "financial freedom", "boss", "hustle"
- Always use: discover, opportunity, intelligence, signal, independence, scalable, build
- Tone: calm confidence, not aggressive excitement
- Empty states: discovery-oriented, never apologetic
```

---

## HOW TO USE THIS PROMPT

1. Copy this entire document
2. Replace `[PLATFORM]` with your target (Shopify / Etsy / TikTok Shop / Walmart / etc.)
3. Replace `[BRAND]` with your app name
4. Replace `[MARKET]` with your target market
5. In Part 11, fill in the platform adaptation table for your specific platform
6. Hand to Claude Code or any AI coding assistant with:

> "Build this app following the spec in MASTER_APP_PROMPT.md. Start with the tech stack setup, then the theme system, then navigation, then screens in order. Ask me before making any architectural decisions not covered in the spec."

7. The AI will implement screen by screen. The design system, patterns, and copy system are all self-contained — no ambiguity.

---

*Generated from Siftly (Amazon FBA) — a production React Native / Expo app built with ~9,500 lines of TypeScript across 25 files. All patterns tested on iOS via Expo Go.*
