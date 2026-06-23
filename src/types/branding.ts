/**
 * Comprehensive Branding System Types
 * Covers: story, colors, typography, guidelines, exports, compliance, mockups, Amazon integration
 */

// ────────────────────────────────────────────────────────────────────────────
// BRAND STORY
// ────────────────────────────────────────────────────────────────────────────

export interface CustomerPersona {
  name: string;
  age: string;
  location?: string;
  occupation?: string;
  painPoints: string[];
  goals: string[];
  values: string[];
  Income?: string;
}

export interface BrandStory {
  brandName: string;
  origin: string; // "Started because..."
  mission: string; // "Our mission is..."
  uniqueValue: string; // "Unlike competitors..."
  brandPromise: string; // "We guarantee..."
  customerPersona: CustomerPersona;
  elevatorPitch?: string; // Auto-generated 30-second
  positioningStatement?: string; // Auto-generated
  tagline?: string; // Short brand tagline
  personality?: string; // Brand voice / personality descriptor
  createdAt: string;
}

// ────────────────────────────────────────────────────────────────────────────
// COLOR SYSTEM
// ────────────────────────────────────────────────────────────────────────────

export interface ColorShade {
  name: string; // "Primary Light", "Primary Dark", etc
  hex: string;
  rgb: string;
  usage: string; // "Backgrounds", "Text", "Accents"
}

export interface ColorPalette {
  primary: {
    main: string;
    light: string;
    lighter: string;
    dark: string;
    darker: string;
    shades: ColorShade[];
  };
  secondary?: {
    main: string;
    shades: ColorShade[];
  };
  neutrals: {
    white: string;
    light: string;
    gray: string;
    darkGray: string;
    black: string;
  };
  semantics: {
    success: string;
    warning: string;
    danger: string;
    info: string;
  };
  usage: {
    backgrounds: string[];
    text: string[];
    accents: string[];
    borders: string[];
  };
  border?: string; // Convenience alias for a primary border color
  textMuted?: string; // Convenience alias for muted text color
  contrast: {
    color1: string;
    color2: string;
    ratio: number; // 4.5+ for AA, 7+ for AAA
    wcagLevel: 'AA' | 'AAA' | 'Fail';
  }[];
  createdAt: string;
}

// ────────────────────────────────────────────────────────────────────────────
// TYPOGRAPHY SYSTEM
// ────────────────────────────────────────────────────────────────────────────

export interface FontDefinition {
  name: string; // "Poppins", "Playfair Display", etc
  category: 'sans-serif' | 'serif' | 'display' | 'handwriting';
  weight: ('100' | '300' | '400' | '500' | '600' | '700' | '800' | '900')[];
  lineHeight: number; // 1.2, 1.5, 1.8
  letterSpacing: number; // -0.5, 0, 0.5
  url?: string; // Google Fonts URL
}

export interface TypographyScale {
  h1: {
    font: FontDefinition;
    size: number; // in pixels
    weight: '700' | '800' | '900';
    lineHeight: number;
    letterSpacing: number;
  };
  h2: {
    font: FontDefinition;
    size: number;
    weight: '600' | '700' | '800';
    lineHeight: number;
    letterSpacing: number;
  };
  h3: {
    font: FontDefinition;
    size: number;
    weight: '600' | '700';
    lineHeight: number;
    letterSpacing: number;
  };
  body: {
    font: FontDefinition;
    size: number;
    weight: '400' | '500';
    lineHeight: number;
    letterSpacing: number;
  };
  small: {
    font: FontDefinition;
    size: number;
    weight: '400' | '500';
    lineHeight: number;
    letterSpacing: number;
  };
  caption: {
    font: FontDefinition;
    size: number;
    weight: '400';
    lineHeight: number;
    letterSpacing: number;
  };
  label: {
    font: FontDefinition;
    size: number;
    weight: '600' | '700';
    lineHeight: number;
    letterSpacing: number;
  };
}

// ────────────────────────────────────────────────────────────────────────────
// BRAND GUIDELINES
// ────────────────────────────────────────────────────────────────────────────

export interface BrandGuidelines {
  brandName: string;
  story: BrandStory;
  colors: ColorPalette;
  typography: TypographyScale;
  logos: {
    icon_svg: string;
    wordmark_svg: string;
    badge_svg: string;
  };
  labels: {
    standard_svg: string;
    bottle_svg?: string;
    pouch_svg?: string;
    box_svg?: string;
  };
  usageRules: {
    logo: string[]; // "Minimum 1 inch", "Clear space 20px", etc
    colors: string[];
    typography: string[];
    dosDonts: {
      dos: string[];
      donts: string[];
    };
  };
  tone: {
    voice: string; // "Friendly, trustworthy, premium"
    samples: string[]; // Example sentences
  };
  createdAt: string;
  updatedAt: string;
}

// ────────────────────────────────────────────────────────────────────────────
// DESIGN EXPORTS
// ────────────────────────────────────────────────────────────────────────────

export type ExportFormat = 'svg' | 'png' | 'jpg' | 'pdf' | 'webp';
export type ExportDPI = 72 | 150 | 300 | 600 | 1200;
export type ExportAssetType = 'logo' | 'label' | 'favicon' | 'social' | 'email';

export interface ExportAsset {
  name: string;
  format: ExportFormat;
  dpi: ExportDPI;
  width: number;
  height: number;
  assetType: ExportAssetType;
  data: string; // base64 or URL
}

export interface ExportPackage {
  brandName: string;
  assets: ExportAsset[];
  socialAssets: {
    instagram_profile: string; // 1080x1080
    instagram_post: string; // 1080x1350
    tiktok_cover: string; // 1080x1440
    facebook_cover: string; // 820x312
    twitter_header: string; // 1500x500
    youtube_banner: string; // 2560x1440
  };
  faviconSizes: {
    '16x16': string;
    '32x32': string;
    '64x64': string;
    '128x128': string;
    '180x180': string;
  };
  emailTemplate: {
    header_600x200: string;
    signature_240x120: string;
  };
  createdAt: string;
}

// ────────────────────────────────────────────────────────────────────────────
// PACKAGING MOCKUPS
// ────────────────────────────────────────────────────────────────────────────

export interface PackagingMockup {
  productName: string;
  packageType: 'standard' | 'bottle' | 'pouch' | 'box' | 'supplement' | 'cosmetic' | 'eco';
  logo_svg: string;
  label_svg: string;
  mockups: {
    front: string; // Image URL
    back?: string;
    side?: string;
    angle_45?: string;
    lifestyle?: string[]; // Multiple lifestyle photos
  };
  dimensions: {
    width: number;
    height: number;
    depth?: number;
    unit: 'cm' | 'inch';
  };
  shelfContext?: string; // Image with competitors on shelf
  createdAt: string;
}

// ────────────────────────────────────────────────────────────────────────────
// COMPLIANCE & LEGAL
// ────────────────────────────────────────────────────────────────────────────

export interface TrademarkCheck {
  brandName: string;
  status: 'available' | 'taken' | 'similar' | 'unknown';
  conflicts: Array<{
    name: string;
    owner: string;
    registrationNumber: string;
    status: string;
  }>;
  checkedAt: string;
}

export interface DomainCheck {
  domain: string;
  available: boolean;
  price?: number; // Annual price if available
  alternatives: string[];
  checkedAt: string;
}

export interface SocialHandleCheck {
  handle: string;
  platform: 'instagram' | 'twitter' | 'tiktok' | 'facebook' | 'youtube';
  available: boolean;
  checkedAt: string;
}

export interface ComplianceDashboard {
  brandName: string;
  trademark: TrademarkCheck;
  domain: DomainCheck;
  socialHandles: SocialHandleCheck[];
  ipOwnership: {
    aiDisclaimer: string;
    ownership: 'user' | 'app' | 'shared';
    terms: string;
  };
  checklist: {
    item: string;
    completed: boolean;
    notes?: string;
  }[];
  createdAt: string;
}

// ────────────────────────────────────────────────────────────────────────────
// AMAZON INTEGRATION
// ────────────────────────────────────────────────────────────────────────────

export interface AmazonListingPreview {
  productName: string;
  asin?: string;
  logo_svg: string;
  label_svg: string;
  title: string;
  bullets: string[];
  images: {
    main: string;
    gallery: string[];
  };
  preview: {
    mobile: string; // Rendered preview
    desktop: string;
  };
  proportionCheck: {
    logoSize: 'too_small' | 'good' | 'too_large';
    labelSize: 'too_small' | 'good' | 'too_large';
    contrast: number; // 0-100
    recommendations: string[];
  };
}

// ────────────────────────────────────────────────────────────────────────────
// ROLLOUT PLAN
// ────────────────────────────────────────────────────────────────────────────

export interface RolloutTask {
  day: number;
  title: string;
  description: string;
  category: 'website' | 'social' | 'amazon' | 'marketing' | 'operations';
  completed: boolean;
}

export interface RolloutPlan {
  brandName: string;
  startDate: string;
  endDate: string; // 30 days later
  tasks: RolloutTask[];
  copyTemplates: {
    socialPost: string;
    emailAnnouncement: string;
    aboutUs: string;
    taglineVariations: string[];
  };
  timeline: {
    phase: 'pre_launch' | 'launch' | 'post_launch';
    startDate: string;
    endDate: string;
    goals: string[];
  }[];
}

// ────────────────────────────────────────────────────────────────────────────
// LABEL & LOGO VARIATIONS
// ────────────────────────────────────────────────────────────────────────────

export interface LabelDesign {
  svg: string;
  title: string;
  description: string;
  packageType: string;
}

export interface LogoVariation {
  type: 'icon' | 'wordmark' | 'badge' | 'combined' | 'monochrome' | 'stacked';
  svg: string;
  name: string;
  usage: string;
  minSize: string;
  bestFor: string;
}

// ────────────────────────────────────────────────────────────────────────────
// COMPLETE BRAND KIT
// ────────────────────────────────────────────────────────────────────────────

export interface CompleteBrandKit {
  brandName: string;
  story: BrandStory;
  colors: ColorPalette;
  typography: TypographyScale;
  guidelines: BrandGuidelines;
  exports: ExportPackage;
  mockups: PackagingMockup[];
  compliance: ComplianceDashboard;
  amazonPreview: AmazonListingPreview;
  rolloutPlan: RolloutPlan;
  status: 'draft' | 'review' | 'approved' | 'launched';
  createdAt: string;
  updatedAt: string;
  sharedWith?: string[]; // User IDs for collaboration
}
