/**
 * useBrandingSystem Hook
 * Complete branding workflow management
 * Covers: story, colors, typography, guidelines, exports, compliance, mockups, Amazon integration
 */

import { useState, useCallback } from 'react';
import { DS } from '../theme/ds';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { STORAGE_KEYS } from '../constants/storage';
import { api } from '../services/api';
import {
  generateBrandGuidelinesPDF,
  generateCompleteExportPackage,
  checkTrademarkAvailability,
  checkDomainAvailability,
  checkSocialHandleAvailability,
} from '../services/brandExportService';
import type {
  BrandStory,
  ColorPalette,
  TypographyScale,
  BrandGuidelines,
  ExportPackage,
  PackagingMockup,
  ComplianceDashboard,
  AmazonListingPreview,
  RolloutPlan,
  CompleteBrandKit,
  CustomerPersona,
  TrademarkCheck,
  DomainCheck,
} from '../types/branding';

interface BrandingState {
  loading: boolean;
  error: string | null;
  kit: CompleteBrandKit | null;
}

export function useBrandingSystem() {
  const [state, setState] = useState<BrandingState>({
    loading: false,
    error: null,
    kit: null,
  });

  // ──────────────────────────────────────────────────────────────────────────
  // BRAND STORY
  // ──────────────────────────────────────────────────────────────────────────

  const createBrandStory = useCallback(
    async (story: Omit<BrandStory, 'createdAt' | 'elevatorPitch' | 'positioningStatement'>) => {
      setState(prev => ({ ...prev, loading: true, error: null }));
      try {
        // Generate elevator pitch via Claude API
        const elevatorPitch = await generateElevatorPitch(story);
        const positioningStatement = await generatePositioningStatement(story);

        const fullStory: BrandStory = {
          ...story,
          elevatorPitch,
          positioningStatement,
          createdAt: new Date().toISOString(),
        };

        // Save to storage
        const key = `brand_story_${story.brandName}`;
        await AsyncStorage.setItem(key, JSON.stringify(fullStory));

        setState(prev => ({ ...prev, loading: false }));
        return fullStory;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to create brand story';
        setState(prev => ({ ...prev, loading: false, error: message }));
        throw err;
      }
    },
    [],
  );

  const getBrandStory = useCallback(async (brandName: string) => {
    const key = `brand_story_${brandName}`;
    const data = await AsyncStorage.getItem(key);
    return data ? (JSON.parse(data) as BrandStory) : null;
  }, []);

  // ──────────────────────────────────────────────────────────────────────────
  // COLOR SYSTEM
  // ──────────────────────────────────────────────────────────────────────────

  const generateColorPalette = useCallback(async (primaryColor: string): Promise<ColorPalette> => {
    setState(prev => ({ ...prev, loading: true, error: null }));
    try {
      // Call Claude API to generate palette
      const palette = await generateColorSystem(primaryColor);
      setState(prev => ({ ...prev, loading: false }));
      return palette;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to generate color palette';
      setState(prev => ({ ...prev, loading: false, error: message }));
      throw err;
    }
  }, []);

  const checkColorContrast = useCallback((color1: string, color2: string) => {
    // Calculate WCAG contrast ratio
    const ratio = calculateContrastRatio(color1, color2);
    const level: 'AA' | 'AAA' | 'Fail' = ratio >= 7 ? 'AAA' : ratio >= 4.5 ? 'AA' : 'Fail';
    return { ratio, level };
  }, []);

  // ──────────────────────────────────────────────────────────────────────────
  // TYPOGRAPHY
  // ──────────────────────────────────────────────────────────────────────────

  const generateTypographySystem = useCallback(
    async (style: string): Promise<TypographyScale> => {
      setState(prev => ({ ...prev, loading: true, error: null }));
      try {
        const typography = await generateTypography(style);
        setState(prev => ({ ...prev, loading: false }));
        return typography;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to generate typography';
        setState(prev => ({ ...prev, loading: false, error: message }));
        throw err;
      }
    },
    [],
  );

  // ──────────────────────────────────────────────────────────────────────────
  // BRAND GUIDELINES PDF
  // ──────────────────────────────────────────────────────────────────────────

  const generateBrandGuidelines = useCallback(
    async (kit: Partial<CompleteBrandKit>): Promise<string> => {
      setState(prev => ({ ...prev, loading: true, error: null }));
      try {
        // Generate PDF guidelines
        const pdfBuffer = await generateBrandGuidelinesPDF(kit);
        setState(prev => ({ ...prev, loading: false }));
        return pdfBuffer; // Base64 string
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to generate guidelines';
        setState(prev => ({ ...prev, loading: false, error: message }));
        throw err;
      }
    },
    [],
  );

  // ──────────────────────────────────────────────────────────────────────────
  // DESIGN EXPORTS
  // ──────────────────────────────────────────────────────────────────────────

  const exportDesignAssets = useCallback(
    async (logo_svg: string, label_svg: string): Promise<ExportPackage> => {
      setState(prev => ({ ...prev, loading: true, error: null }));
      try {
        // Generate multiple formats and sizes
        const exportPackage = await generateExportsImpl(logo_svg, label_svg);
        setState(prev => ({ ...prev, loading: false }));
        return exportPackage;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to export assets';
        setState(prev => ({ ...prev, loading: false, error: message }));
        throw err;
      }
    },
    [],
  );

  // ──────────────────────────────────────────────────────────────────────────
  // PACKAGING MOCKUPS
  // ──────────────────────────────────────────────────────────────────────────

  const generatePackagingMockup = useCallback(
    async (
      productName: string,
      packageType: string,
      logo_svg: string,
      label_svg: string,
    ): Promise<PackagingMockup> => {
      setState(prev => ({ ...prev, loading: true, error: null }));
      try {
        // Generate 3D mockups
        const mockup = await generateMockups(productName, packageType, logo_svg, label_svg);
        setState(prev => ({ ...prev, loading: false }));
        return mockup;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to generate mockup';
        setState(prev => ({ ...prev, loading: false, error: message }));
        throw err;
      }
    },
    [],
  );

  // ──────────────────────────────────────────────────────────────────────────
  // COMPLIANCE CHECKS
  // ──────────────────────────────────────────────────────────────────────────

  const checkTrademarkAvailability = useCallback(
    async (brandName: string): Promise<TrademarkCheck> => {
      setState(prev => ({ ...prev, loading: true, error: null }));
      try {
        // Check USPTO + international databases
        const check = await checkTrademark(brandName);
        setState(prev => ({ ...prev, loading: false }));
        return check;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to check trademark';
        setState(prev => ({ ...prev, loading: false, error: message }));
        throw err;
      }
    },
    [],
  );

  const checkDomainAvailability = useCallback(
    async (brandName: string): Promise<DomainCheck> => {
      setState(prev => ({ ...prev, loading: true, error: null }));
      try {
        // Check domain + suggest alternatives
        const check = await checkDomain(brandName);
        setState(prev => ({ ...prev, loading: false }));
        return check;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to check domain';
        setState(prev => ({ ...prev, loading: false, error: message }));
        throw err;
      }
    },
    [],
  );

  const checkSocialHandles = useCallback(
    async (brandName: string) => {
      setState(prev => ({ ...prev, loading: true, error: null }));
      try {
        // Check Instagram, Twitter, TikTok, etc.
        const checks = await checkSocial(brandName);
        setState(prev => ({ ...prev, loading: false }));
        return checks;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to check social handles';
        setState(prev => ({ ...prev, loading: false, error: message }));
        throw err;
      }
    },
    [],
  );

  // ──────────────────────────────────────────────────────────────────────────
  // AMAZON INTEGRATION
  // ──────────────────────────────────────────────────────────────────────────

  const generateAmazonPreview = useCallback(
    async (
      productName: string,
      logo_svg: string,
      label_svg: string,
      title: string,
      bullets: string[],
    ): Promise<AmazonListingPreview> => {
      setState(prev => ({ ...prev, loading: true, error: null }));
      try {
        // Generate Amazon listing preview with logo/label
        const preview = await generateAmazonPreview(
          productName,
          logo_svg,
          label_svg,
          title,
          bullets,
        );
        setState(prev => ({ ...prev, loading: false }));
        return preview;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to generate Amazon preview';
        setState(prev => ({ ...prev, loading: false, error: message }));
        throw err;
      }
    },
    [],
  );

  // ──────────────────────────────────────────────────────────────────────────
  // ROLLOUT PLAN
  // ──────────────────────────────────────────────────────────────────────────

  const generateRolloutPlan = useCallback(
    async (story: BrandStory): Promise<RolloutPlan> => {
      setState(prev => ({ ...prev, loading: true, error: null }));
      try {
        // Generate 30-day launch plan
        const plan = await generateLaunchPlan(story);
        setState(prev => ({ ...prev, loading: false }));
        return plan;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to generate rollout plan';
        setState(prev => ({ ...prev, loading: false, error: message }));
        throw err;
      }
    },
    [],
  );

  // ──────────────────────────────────────────────────────────────────────────
  // SAVE & LOAD COMPLETE KIT
  // ──────────────────────────────────────────────────────────────────────────

  const saveCompleteBrandKit = useCallback(
    async (kit: CompleteBrandKit) => {
      const key = `brand_kit_${kit.brandName}`;
      await AsyncStorage.setItem(key, JSON.stringify(kit));
      setState(prev => ({ ...prev, kit }));
    },
    [],
  );

  const loadCompleteBrandKit = useCallback(async (brandName: string) => {
    setState(prev => ({ ...prev, loading: true, error: null }));
    try {
      const key = `brand_kit_${brandName}`;
      const data = await AsyncStorage.getItem(key);
      const kit = data ? (JSON.parse(data) as CompleteBrandKit) : null;
      setState(prev => ({ ...prev, loading: false, kit }));
      return kit;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load brand kit';
      setState(prev => ({ ...prev, loading: false, error: message }));
      return null;
    }
  }, []);

  return {
    // State
    loading: state.loading,
    error: state.error,
    kit: state.kit,

    // Brand Story
    createBrandStory,
    getBrandStory,

    // Color System
    generateColorPalette,
    checkColorContrast,

    // Typography
    generateTypographySystem,

    // Guidelines
    generateBrandGuidelines,

    // Exports
    exportDesignAssets,

    // Mockups
    generatePackagingMockup,

    // Compliance
    checkTrademarkAvailability,
    checkDomainAvailability,
    checkSocialHandles,

    // Amazon
    generateAmazonPreview,

    // Rollout
    generateRolloutPlan,

    // Save/Load
    saveCompleteBrandKit,
    loadCompleteBrandKit,
  };
}

// ════════════════════════════════════════════════════════════════════════════
// HELPER FUNCTIONS (Stubs - implement with actual APIs)
// ════════════════════════════════════════════════════════════════════════════

async function generateElevatorPitch(story: Partial<BrandStory>): Promise<string> {
  try {
    const res = await api.askAI(
      `Write a punchy 2-sentence elevator pitch for this Amazon FBA brand. Return ONLY the pitch text — no labels, no quotes, no preamble.`,
      {
        brand_name:    story.brandName,
        mission:       story.mission,
        unique_value:  story.uniqueValue,
        brand_promise: story.brandPromise,
        origin:        story.origin,
        target_customer: story.customerPersona?.name,
      },
    );
    return res.answer?.trim() || `${story.brandName} — ${story.mission}. ${story.uniqueValue}.`;
  } catch {
    return `${story.brandName} — ${story.mission}. ${story.uniqueValue}.`;
  }
}

async function generatePositioningStatement(story: Partial<BrandStory>): Promise<string> {
  try {
    const res = await api.askAI(
      `Write a single positioning statement for this brand using the format: "For [target customer], [brand name] is the [category] brand that [key benefit] because [reason to believe]." Return ONLY the statement — no labels, no quotes, no preamble.`,
      {
        brand_name:      story.brandName,
        target_customer: story.customerPersona?.name || 'value-conscious shoppers',
        pain_points:     story.customerPersona?.painPoints?.join(', '),
        unique_value:    story.uniqueValue,
        brand_promise:   story.brandPromise,
        mission:         story.mission,
      },
    );
    return res.answer?.trim() || `For ${story.customerPersona?.name || 'customers'}, ${story.brandName} is the brand that ${story.brandPromise}.`;
  } catch {
    return `For ${story.customerPersona?.name || 'customers'}, ${story.brandName} is the brand that ${story.brandPromise}.`;
  }
}

async function generateColorSystem(primaryColor: string): Promise<ColorPalette> {
  // TODO: Call color API or Claude
  const palette: ColorPalette = {
    primary: {
      main: primaryColor,
      light: lightenColor(primaryColor, 40),
      lighter: lightenColor(primaryColor, 70),
      dark: darkenColor(primaryColor, 30),
      darker: darkenColor(primaryColor, 60),
      shades: [],
    },
    neutrals: {
      white: DS.bgCard,
      light: '#F5F5F5',
      gray: '#999999',
      darkGray: '#333333',
      black: '#000000',
    },
    semantics: {
      success: DS.success,
      warning: DS.warning,
      danger: DS.danger,
      info: '#3B82F6',
    },
    usage: {
      backgrounds: [primaryColor],
      text: ['#000000'],
      accents: [primaryColor],
      borders: ['#E5E5E5'],
    },
    contrast: [],
    createdAt: new Date().toISOString(),
  };
  return palette;
}

async function generateTypography(style: string): Promise<TypographyScale> {
  // TODO: Call typography API
  const defaultFont = {
    name: 'Inter',
    category: 'sans-serif' as const,
    weight: ['400', '600', '700'] as ('100' | '300' | '400' | '500' | '600' | '700' | '800' | '900')[],
    lineHeight: 1.5,
    letterSpacing: 0,
  };

  return {
    h1: { font: defaultFont, size: 32, weight: '800', lineHeight: 1.2, letterSpacing: -0.5 },
    h2: { font: defaultFont, size: 24, weight: '700', lineHeight: 1.3, letterSpacing: -0.3 },
    h3: { font: defaultFont, size: 18, weight: '700', lineHeight: 1.4, letterSpacing: 0 },
    body: { font: defaultFont, size: 14, weight: '400', lineHeight: 1.6, letterSpacing: 0 },
    small: { font: defaultFont, size: 12, weight: '400', lineHeight: 1.5, letterSpacing: 0 },
    caption: { font: defaultFont, size: 10, weight: '400', lineHeight: 1.4, letterSpacing: 0.5 },
    label: { font: defaultFont, size: 12, weight: '600', lineHeight: 1.5, letterSpacing: 0.5 },
  };
}

async function generateBrandGuidelinesPDFImpl(kit: Partial<CompleteBrandKit>): Promise<string> {
  // Use actual PDF generation service
  return await generateBrandGuidelinesPDF(kit);
}

async function generateExportsImpl(logo_svg: string, label_svg: string, kit?: CompleteBrandKit): Promise<ExportPackage> {
  // Use actual export service to generate all formats
  if (!kit) {
    throw new Error('Brand kit required for export generation');
  }
  return await generateCompleteExportPackage(kit, logo_svg, label_svg);
}

async function generateMockups(
  productName: string,
  packageType: string,
  logo_svg: string,
  label_svg: string,
): Promise<PackagingMockup> {
  // Generate mockup SVGs for package previews
  const mockups = {
    front: createMockupSVG(logo_svg, label_svg, packageType, 'front'),
    back: createMockupSVG(logo_svg, label_svg, packageType, 'back'),
    side: createMockupSVG(logo_svg, label_svg, packageType, 'side'),
    angle_45: createMockupSVG(logo_svg, label_svg, packageType, 'angle_45'),
    lifestyle: [
      createMockupSVG(logo_svg, label_svg, packageType, 'shelf'),
      createMockupSVG(logo_svg, label_svg, packageType, 'hand'),
    ],
  };

  return {
    productName,
    packageType: packageType as any,
    logo_svg,
    label_svg,
    mockups,
    dimensions: getDimensionsForPackageType(packageType),
    createdAt: new Date().toISOString(),
  };
}

function createMockupSVG(logo: string, label: string, packageType: string, view: string): string {
  // Create SVG mockup combining logo and label
  const width = 400;
  const height = 600;
  return `<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <filter id="shadow">
        <feDropShadow dx="2" dy="2" stdDeviation="3" flood-opacity="0.3"/>
      </filter>
    </defs>
    <rect width="${width}" height="${height}" fill=DS.bgCanvas/>
    <g transform="translate(20, 50)" filter="url(#shadow)">
      <rect width="360" height="500" rx="8" fill="white" stroke=DS.border stroke-width="1"/>
      <g transform="translate(30, 30)">
        ${logo.replace(/<svg[^>]*>|<\/svg>/g, '')}
      </g>
      <g transform="translate(30, 150)">
        ${label.replace(/<svg[^>]*>|<\/svg>/g, '')}
      </g>
      <text x="180" y="480" text-anchor="middle" font-size="12" fill="#999">${view}</text>
    </g>
  </svg>`;
}

function getDimensionsForPackageType(packageType: string): { width: number; height: number; depth?: number; unit: 'cm' | 'inch' } {
  const dimensions: Record<string, any> = {
    standard: { width: 20, height: 30, depth: 10, unit: 'cm' },
    bottle: { width: 8, height: 25, unit: 'cm' },
    pouch: { width: 15, height: 20, unit: 'cm' },
    box: { width: 25, height: 25, depth: 25, unit: 'cm' },
    supplement: { width: 10, height: 15, unit: 'cm' },
    cosmetic: { width: 12, height: 12, depth: 8, unit: 'cm' },
    eco: { width: 18, height: 28, unit: 'cm' },
  };
  return dimensions[packageType] || dimensions.standard;
}

async function checkTrademark(brandName: string): Promise<TrademarkCheck> {
  // Use actual trademark checking service
  return await checkTrademarkAvailability(brandName);
}

async function checkDomain(brandName: string): Promise<DomainCheck> {
  // Use actual domain availability checking service
  return await checkDomainAvailability(brandName);
}

async function checkSocial(brandName: string) {
  // Use actual social handle availability checking service
  return await checkSocialHandleAvailability(brandName);
}

async function generateAmazonPreview(
  productName: string,
  logo_svg: string,
  label_svg: string,
  title: string,
  bullets: string[],
): Promise<AmazonListingPreview> {
  // Generate Amazon listing preview
  const mobilePreview = createAmazonMobilePreview(logo_svg, label_svg, title, bullets);
  const desktopPreview = createAmazonDesktopPreview(logo_svg, label_svg, title, bullets);

  return {
    productName,
    logo_svg,
    label_svg,
    title,
    bullets,
    images: {
      main: label_svg,
      gallery: [label_svg, logo_svg],
    },
    preview: {
      mobile: mobilePreview,
      desktop: desktopPreview,
    },
    proportionCheck: {
      logoSize: calculateLogoSize(logo_svg) === 'good' ? 'good' : 'too_small',
      labelSize: calculateLabelSize(label_svg) === 'good' ? 'good' : 'too_large',
      contrast: calculateContrast(logo_svg, label_svg),
      recommendations: getAmazonRecommendations(logo_svg, label_svg, title),
    },
  };
}

function createAmazonMobilePreview(logo: string, label: string, title: string, bullets: string[]): string {
  return `<svg width="375" height="667" viewBox="0 0 375 667" xmlns="http://www.w3.org/2000/svg">
    <rect width="375" height="667" fill="white"/>
    <g transform="translate(0, 60)">
      <rect width="375" height="300" fill=DS.bgCanvas/>
      <g transform="translate(50, 50)">${label.replace(/<svg[^>]*>|<\/svg>/g, '')}</g>
    </g>
    <text x="20" y="380" font-size="18" font-weight="bold" fill=DS.textPrimary>${title}</text>
    <text x="20" y="410" font-size="12" fill=DS.textSecondary>★★★★★ 124 reviews</text>
    ${bullets.map((b, i) => `<text x="35" y="${430 + i * 25}" font-size="12" fill="#333">• ${b}</text>`).join('')}
    <rect x="20" y="${480 + bullets.length * 25}" width="335" height="50" rx="4" fill="#FF9900"/>
    <text x="187.5" y="${510 + bullets.length * 25}" text-anchor="middle" font-size="16" font-weight="bold" fill="white">Add to Cart</text>
  </svg>`;
}

function createAmazonDesktopPreview(logo: string, label: string, title: string, bullets: string[]): string {
  return `<svg width="1200" height="800" viewBox="0 0 1200 800" xmlns="http://www.w3.org/2000/svg">
    <rect width="1200" height="800" fill="white"/>
    <g transform="translate(50, 100)">
      <rect width="400" height="500" fill=DS.bgCanvas rx="4"/>
      <g transform="translate(50, 50)">${label.replace(/<svg[^>]*>|<\/svg>/g, '')}</g>
    </g>
    <g transform="translate(500, 100)">
      <text x="0" y="30" font-size="24" font-weight="bold" fill=DS.textPrimary>${title}</text>
      <text x="0" y="60" font-size="14" fill=DS.textSecondary>★★★★★ 124 reviews</text>
      <text x="0" y="100" font-size="20" font-weight="bold" fill="#FF9900">$29.99</text>
      ${bullets.map((b, i) => `<text x="0" y="${140 + i * 25}" font-size="14" fill="#333">✓ ${b}</text>`).join('')}
      <rect x="0" y="${500}" width="300" height="60" rx="4" fill="#FF9900"/>
      <text x="150" y="540" text-anchor="middle" font-size="18" font-weight="bold" fill="white">Add to Cart</text>
    </g>
  </svg>`;
}

function calculateLogoSize(logo: string): string {
  // Simple heuristic: logo should be 100-300px minimum
  return 'good';
}

function calculateLabelSize(label: string): string {
  // Label should take 50-70% of image
  return 'good';
}

function calculateContrast(logo: string, label: string): number {
  // Calculate contrast ratio between logo and label
  // For now, return high score
  return 85;
}

function getAmazonRecommendations(logo: string, label: string, title: string): string[] {
  const recs: string[] = [];
  if (title.length < 20) recs.push('Product title could be more descriptive');
  if (title.length > 200) recs.push('Product title is too long (max 200 chars)');
  recs.push('Ensure logo and product label are clearly visible');
  recs.push('Use high-contrast colors for better visibility on mobile');
  return recs;
}

async function generateLaunchPlan(story: BrandStory): Promise<RolloutPlan> {
  const startDate = new Date();
  const endDate = new Date(Date.now() + 30 * 86400000);

  const tasks = generateLaunchTasks(story.brandName, 30);
  const timeline = generateTimeline(startDate, endDate);

  return {
    brandName: story.brandName,
    startDate: startDate.toISOString(),
    endDate: endDate.toISOString(),
    tasks,
    copyTemplates: {
      socialPost: `Introducing ${story.brandName}! ${story.brandPromise} #NewBrand #${story.brandName.replace(/\s/g, '')}`,
      emailAnnouncement: `Subject: Introducing ${story.brandName}\n\nWe're excited to announce the launch of ${story.brandName}. ${story.mission}\n\nVisit us to learn more!`,
      aboutUs: `${story.brandName} is committed to ${story.uniqueValue}. We believe in ${story.brandPromise}.`,
      taglineVariations: [
        story.brandPromise,
        `${story.brandName}: ${story.uniqueValue}`,
        `Experience ${story.brandName}`,
      ],
    },
    timeline,
  };
}

function generateLaunchTasks(brandName: string, days: number): any[] {
  const tasks = [];
  const categories = ['website', 'social', 'amazon', 'marketing', 'operations'];

  for (let day = 1; day <= days; day++) {
    const category = categories[day % categories.length];
    tasks.push({
      day,
      title: `${category.charAt(0).toUpperCase() + category.slice(1)} Day ${Math.ceil(day / 6)}`,
      description: `${category} task for ${brandName}`,
      category,
      completed: false,
    });
  }

  return tasks;
}

function generateTimeline(startDate: Date, endDate: Date): any[] {
  return [
    {
      phase: 'pre_launch' as const,
      startDate: startDate.toISOString(),
      endDate: new Date(startDate.getTime() + 7 * 86400000).toISOString(),
      goals: [
        'Set up website and social accounts',
        'Create marketing content',
        'Build email list',
      ],
    },
    {
      phase: 'launch' as const,
      startDate: new Date(startDate.getTime() + 7 * 86400000).toISOString(),
      endDate: new Date(startDate.getTime() + 14 * 86400000).toISOString(),
      goals: ['Launch product', 'Run paid ads', 'Send launch email'],
    },
    {
      phase: 'post_launch' as const,
      startDate: new Date(startDate.getTime() + 14 * 86400000).toISOString(),
      endDate: endDate.toISOString(),
      goals: ['Gather reviews', 'Optimize listings', 'Scale marketing'],
    },
  ];
}

// ────────────────────────────────────────────────────────────────────────────
// COLOR UTILITIES
// ────────────────────────────────────────────────────────────────────────────

function lightenColor(hex: string, percent: number): string {
  const num = parseInt(hex.replace('#', ''), 16);
  const amt = Math.round(2.55 * percent);
  const R = Math.min(255, (num >> 16) + amt);
  const G = Math.min(255, (num >> 8 & 0x00FF) + amt);
  const B = Math.min(255, (num & 0x0000FF) + amt);
  return `#${(0x1000000 + R * 0x10000 + G * 0x100 + B).toString(16).slice(1).toUpperCase()}`;
}

function darkenColor(hex: string, percent: number): string {
  const num = parseInt(hex.replace('#', ''), 16);
  const amt = Math.round(2.55 * percent);
  const R = Math.max(0, (num >> 16) - amt);
  const G = Math.max(0, (num >> 8 & 0x00FF) - amt);
  const B = Math.max(0, (num & 0x0000FF) - amt);
  return `#${(0x1000000 + R * 0x10000 + G * 0x100 + B).toString(16).slice(1).toUpperCase()}`;
}

function calculateContrastRatio(color1: string, color2: string): number {
  // WCAG contrast ratio calculation
  const getLuminance = (hex: string) => {
    const rgb = parseInt(hex.replace('#', ''), 16);
    const r = ((rgb >> 16) & 255) / 255;
    const g = ((rgb >> 8) & 255) / 255;
    const b = (rgb & 255) / 255;

    const [rs, gs, bs] = [r, g, b].map(val =>
      val <= 0.03928 ? val / 12.92 : Math.pow((val + 0.055) / 1.055, 2.4),
    );

    return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
  };

  const lum1 = getLuminance(color1);
  const lum2 = getLuminance(color2);
  const lighter = Math.max(lum1, lum2);
  const darker = Math.min(lum1, lum2);

  return (lighter + 0.05) / (darker + 0.05);
}
