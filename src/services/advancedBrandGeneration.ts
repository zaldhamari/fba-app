/**
 * Advanced Brand Generation Service
 * Significantly improved logo and label generation
 * Creates production-quality SVG assets with:
 * - Multiple design variations
 * - Proper typography integration
 * - Color system usage
 * - Professional layouts
 * - Scalable vector graphics
 * - Real design principles
 */

import { api } from './api';
import type { BrandStory, ColorPalette, TypographyScale } from '../types/branding';

interface LogoVariation {
  type: 'icon' | 'wordmark' | 'badge' | 'combined' | 'monochrome';
  svg: string;
  name: string;
  usage: string;
  minSize: string;
  bestFor: string;
}

interface LabelDesign {
  svg: string;
  title: string;
  description: string;
  packageType: string;
}

// ────────────────────────────────────────────────────────────────────────────
// ADVANCED LOGO GENERATION
// ────────────────────────────────────────────────────────────────────────────

export async function generateAdvancedLogos(
  story: BrandStory,
  colors: ColorPalette,
  typography?: TypographyScale,
): Promise<LogoVariation[]> {
  /**
   * Generate 5 professional logo variations:
   * 1. Icon Mark — Standalone symbol (use on favicon, profiles, small spaces)
   * 2. Wordmark — Text-only logo (use for titles, headers)
   * 3. Badge — Icon + text combined (use on packaging, labels)
   * 4. Combined — Full horizontal lockup (use on websites, marketing)
   * 5. Monochrome — Single color version (use for printing, limitations)
   */

  const primaryColor = colors.primary.main;
  const accentColor = colors.primary.dark;
  const neutralColor = colors.neutrals.black;

  const brandName = story.brandName.toUpperCase();
  const initials = story.brandName
    .split(' ')
    .map(w => w[0])
    .join('');

  const variations: LogoVariation[] = [];

  // ── 1. ICON MARK ──────────────────────────────────────────────────────────
  // Abstract geometric symbol based on brand personality
  const iconSvg = await generateIconMark(
    initials,
    brandName,
    primaryColor,
    accentColor,
    story,
  );
  variations.push({
    type: 'icon',
    svg: iconSvg,
    name: 'Icon Mark',
    usage: 'Standalone symbol for favicon, app icon, social profiles',
    minSize: '64px × 64px',
    bestFor: 'Small spaces, digital platforms, quick recognition',
  });

  // ── 2. WORDMARK ───────────────────────────────────────────────────────────
  // Premium typography-based logo
  const wordmarkSvg = await generateWordmark(
    brandName,
    story.tagline,
    primaryColor,
    typography,
    story,
  );
  variations.push({
    type: 'wordmark',
    svg: wordmarkSvg,
    name: 'Wordmark',
    usage: 'Text-only branding for headers, titles, marketing',
    minSize: '120px width',
    bestFor: 'Websites, social media headers, printed materials',
  });

  // ── 3. BADGE ──────────────────────────────────────────────────────────────
  // Icon + text in circular badge format
  const badgeSvg = await generateBadge(
    initials,
    brandName,
    primaryColor,
    accentColor,
    story,
  );
  variations.push({
    type: 'badge',
    svg: badgeSvg,
    name: 'Badge Logo',
    usage: 'Icon + text combined for packaging, labels, certifications',
    minSize: '100px × 100px',
    bestFor: 'Product packaging, labels, email signatures',
  });

  // ── 4. COMBINED LOCKUP ────────────────────────────────────────────────────
  // Horizontal layout with icon + wordmark side by side
  const combinedSvg = await generateCombinedLockup(
    initials,
    brandName,
    story.tagline,
    primaryColor,
    accentColor,
    story,
  );
  variations.push({
    type: 'combined',
    svg: combinedSvg,
    name: 'Combined Lockup',
    usage: 'Full horizontal layout for websites, advertisements',
    minSize: '200px width',
    bestFor: 'Website headers, business cards, advertisements',
  });

  // ── 5. MONOCHROME ─────────────────────────────────────────────────────────
  // Single color black version for printing
  const monochromeSvg = await generateMonochromeLogo(
    initials,
    brandName,
    neutralColor,
    story,
  );
  variations.push({
    type: 'monochrome',
    svg: monochromeSvg,
    name: 'Monochrome',
    usage: 'Black & white version for printing, embossing, limitations',
    minSize: '100px × 100px',
    bestFor: 'Print production, embroidery, single-color applications',
  });

  return variations;
}

// ────────────────────────────────────────────────────────────────────────────
// ADVANCED LABEL GENERATION
// ────────────────────────────────────────────────────────────────────────────

export async function generateAdvancedLabel(
  story: BrandStory,
  colors: ColorPalette,
  typography: TypographyScale,
  packageType: string,
  logoSvg: string,
): Promise<LabelDesign> {
  /**
   * Generate professional product label with:
   * - Proper typography hierarchy (headline, subheadline, body)
   * - Color palette integration (brand colors for visual hierarchy)
   * - Logo placement and sizing (left/top with proper spacing)
   * - Benefit bullets (with icons for scanability)
   * - Material/size info (footer area)
   * - Barcode ready area (bottom)
   * - Print-safe margins and bleeds
   */

  const svg = await buildAdvancedLabel(
    story,
    colors,
    typography,
    packageType,
    logoSvg,
  );

  return {
    svg,
    title: `${packageType.charAt(0).toUpperCase() + packageType.slice(1)} Label`,
    description: `Professional label design for ${story.brandName}`,
    packageType,
  };
}

// ────────────────────────────────────────────────────────────────────────────
// LOGO GENERATION IMPLEMENTATIONS
// ────────────────────────────────────────────────────────────────────────────

async function generateIconMark(
  initials: string,
  brandName: string,
  primaryColor: string,
  accentColor: string,
  story: BrandStory,
): Promise<string> {
  /**
   * Create abstract icon mark with geometric shapes
   * Factors in: brand personality, color, shape harmony
   */

  const prompt = `
    Create a professional, modern icon mark as SVG for the brand "${brandName}" (${initials}).

    Brand personality: ${story.personality}
    Brand promise: ${story.brandPromise}
    Target audience: ${story.customerPersona.age} year olds interested in ${story.customerPersona.goals[0]}

    Design requirements:
    - 500x500px square canvas
    - Minimalist geometric design (use circles, triangles, squares, or combinations)
    - Primary color: ${primaryColor}
    - Accent color: ${accentColor}
    - Include or suggest the initials "${initials}" subtly
    - Professional, memorable, scalable to 16px minimum
    - White/transparent background
    - No text labels

    Output ONLY valid SVG XML code that starts with <svg and ends with </svg>.
    Use ${primaryColor} for main shapes, ${accentColor} for accents.
    Ensure perfect proportions and balance.
  `;

  const response = await api.generateBrandAsset({ prompt, type: 'logo_icon' });
  return response.svg || createFallbackIconMark(initials, primaryColor, accentColor);
}

async function generateWordmark(
  brandName: string,
  tagline: string,
  primaryColor: string,
  typography: TypographyScale | undefined,
  story: BrandStory,
): Promise<string> {
  /**
   * Create typography-focused wordmark
   * Uses letter-spacing, weight, and color to create visual hierarchy
   */

  const prompt = `
    Create a premium wordmark logo as SVG for "${brandName}".
    Tagline: "${tagline}"

    Design requirements:
    - 600x300px canvas
    - Headline: "${brandName}" (uppercase or title case, spaced out, heavy weight 700-900)
    - Subheadline: "${tagline}" (smaller, elegant, lighter weight 300-400)
    - Accent color: ${primaryColor}
    - Professional, sophisticated typography
    - Use letter-spacing to create elegance
    - Optional: decorative line or underline in primary color
    - White background
    - Proper typography hierarchy

    Brand style: ${story.personality}
    For audience: ${story.customerPersona.age}-year-olds

    Output ONLY valid SVG XML code.
    Use ${primaryColor} for brand name and accents.
    Make it ready for websites and headers.
  `;

  const response = await api.generateBrandAsset({ prompt, type: 'wordmark' });
  return response.svg || createFallbackWordmark(brandName, tagline, primaryColor);
}

async function generateBadge(
  initials: string,
  brandName: string,
  primaryColor: string,
  accentColor: string,
  story: BrandStory,
): Promise<string> {
  /**
   * Create circular/rounded badge with icon + text
   * Compact format for packaging and small spaces
   */

  const prompt = `
    Create a circular badge logo as SVG combining icon and text for "${brandName}".

    Design requirements:
    - 400x400px square canvas (circle centered inside)
    - Outer circle border in ${primaryColor}
    - Background: light tint of ${primaryColor} (10% opacity)
    - Center: abstract icon or ${initials}
    - Bottom: "${brandName}" text (bold, centered)
    - Colors: ${primaryColor} (primary), ${accentColor} (accents)
    - Style: modern, professional, compact
    - White background outside circle

    Make it perfect for packaging, stickers, and email signatures.
    Output ONLY valid SVG XML code.
  `;

  const response = await api.generateBrandAsset({ prompt, type: 'badge' });
  return response.svg || createFallbackBadge(initials, brandName, primaryColor, accentColor);
}

async function generateCombinedLockup(
  initials: string,
  brandName: string,
  tagline: string,
  primaryColor: string,
  accentColor: string,
  story: BrandStory,
): Promise<string> {
  /**
   * Create full horizontal lockup with icon + wordmark
   * Professional layout for websites and marketing
   */

  const prompt = `
    Create a complete horizontal logo lockup as SVG.

    Layout:
    - 800x300px canvas
    - LEFT: Icon/symbol (300x300) with ${initials} or abstract mark
    - RIGHT: Text stacked vertically
      - Line 1: "${brandName}" (large, bold, ${primaryColor})
      - Line 2: "${tagline}" (smaller, lighter, muted)
    - Spacing: 20px gap between icon and text
    - White background

    Design requirements:
    - Icon in ${primaryColor}
    - Brand name in ${primaryColor}
    - Tagline in ${accentColor} (lighter tone)
    - Professional, scalable layout
    - Proper alignment and hierarchy

    This is for websites, business cards, and print materials.
    Output ONLY valid SVG XML code.
  `;

  const response = await api.generateBrandAsset({ prompt, type: 'combined_lockup' });
  return response.svg || createFallbackCombined(initials, brandName, tagline, primaryColor);
}

async function generateMonochromeLogo(
  initials: string,
  brandName: string,
  neutralColor: string,
  story: BrandStory,
): Promise<string> {
  /**
   * Create single-color black version
   * For printing, embossing, monochrome applications
   */

  const prompt = `
    Create a monochrome (black & white only) logo as SVG for "${brandName}".

    Design requirements:
    - 500x500px canvas
    - Color: ONLY black (${neutralColor}) and white
    - Design must work at ANY size (16px to 1000px+)
    - Include icon and text or wordmark
    - High contrast, clean lines
    - No gradients or multiple colors
    - Perfect for:
      * Professional printing (embroidery, engraving)
      * Monochrome applications
      * Black & white reproduction
      * Fax quality
    - White background

    Output ONLY valid SVG XML code with black (#000000) and white only.
  `;

  const response = await api.generateBrandAsset({ prompt, type: 'monochrome' });
  return response.svg || createFallbackMonochrome(initials, brandName);
}

// ────────────────────────────────────────────────────────────────────────────
// LABEL GENERATION IMPLEMENTATION
// ────────────────────────────────────────────────────────────────────────────

async function buildAdvancedLabel(
  story: BrandStory,
  colors: ColorPalette,
  typography: TypographyScale,
  packageType: string,
  logoSvg: string,
): Promise<string> {
  /**
   * Build professional product label with:
   * - Logo placement (top-left or centered)
   * - Product name (headline)
   * - Tagline (subheadline)
   * - Benefit bullets (3-5 key points)
   * - Material/size info (footer)
   * - Barcode area (bottom)
   */

  const prompt = `
    Create a professional product label as SVG for packaging type: "${packageType}".

    Brand information:
    - Name: "${story.brandName}"
    - Tagline: "${story.tagline}"
    - Primary color: ${colors.primary.main}
    - Accent color: ${colors.primary.dark}

    Label design requirements:
    - Dimensions: 600x800px (vertical label format)
    - Top section (header):
      * Logo/brand mark (left side, 100x100px)
      * Decorative line accent in primary color
    - Middle section (content):
      * Product name in LARGE, BOLD text (primary color)
      * Tagline in smaller, accent color text
      * 3-4 benefit bullets (✓ marks with benefits)
      * Professional spacing and hierarchy
    - Bottom section (footer):
      * Material/composition info (small text, gray)
      * Reserved barcode area (dashed border, labeled "UPC")
    - Color scheme:
      * Primary color for headlines: ${colors.primary.main}
      * Accent color for secondary elements: ${colors.primary.dark}
      * Neutral for body text: ${colors.neutrals.darkGray}
    - Professional design elements:
      * Proper white space (padding 20px)
      * Clean typography hierarchy
      * Print-safe (no RGB colors if possible)
      * Aligned to 8px grid

    This label will be printed on ${packageType} packaging.
    Make it professional, premium, and shelf-ready.

    Output ONLY valid SVG XML code starting with <svg and ending with </svg>.
  `;

  const response = await api.generateBrandAsset({ prompt, type: 'label', packageType });
  return response.svg || createFallbackLabel(story, colors, packageType);
}

// ────────────────────────────────────────────────────────────────────────────
// FALLBACK SVG GENERATORS (if Claude API fails)
// ────────────────────────────────────────────────────────────────────────────

function createFallbackIconMark(
  initials: string,
  primaryColor: string,
  accentColor: string,
): string {
  // Fallback: Simple geometric icon with initials
  return `
    <svg viewBox="0 0 500 500" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="grad1" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" style="stop-color:${primaryColor};stop-opacity:1" />
          <stop offset="100%" style="stop-color:${accentColor};stop-opacity:1" />
        </linearGradient>
      </defs>

      <!-- Outer circle border -->
      <circle cx="250" cy="250" r="240" fill="none" stroke="${primaryColor}" stroke-width="8"/>

      <!-- Background -->
      <circle cx="250" cy="250" r="230" fill="${primaryColor}" opacity="0.08"/>

      <!-- Main shape - abstract -->
      <circle cx="250" cy="250" r="180" fill="url(#grad1)"/>

      <!-- Center text -->
      <text x="250" y="270" font-size="120" font-weight="900" text-anchor="middle"
            fill="white" font-family="system-ui, -apple-system, sans-serif">
        ${initials}
      </text>
    </svg>
  `;
}

function createFallbackWordmark(
  brandName: string,
  tagline: string,
  primaryColor: string,
): string {
  return `
    <svg viewBox="0 0 600 300" xmlns="http://www.w3.org/2000/svg">
      <!-- Brand name -->
      <text x="300" y="100" font-size="72" font-weight="900" text-anchor="middle"
            fill="${primaryColor}" font-family="system-ui, -apple-system, sans-serif"
            letter-spacing="8">
        ${brandName.toUpperCase()}
      </text>

      <!-- Accent line -->
      <line x1="150" y1="130" x2="450" y2="130" stroke="${primaryColor}" stroke-width="3"/>

      <!-- Tagline -->
      <text x="300" y="200" font-size="28" font-weight="300" text-anchor="middle"
            fill="${primaryColor}" opacity="0.7" font-family="system-ui, -apple-system, sans-serif"
            letter-spacing="4">
        ${tagline}
      </text>
    </svg>
  `;
}

function createFallbackBadge(
  initials: string,
  brandName: string,
  primaryColor: string,
  accentColor: string,
): string {
  return `
    <svg viewBox="0 0 400 400" xmlns="http://www.w3.org/2000/svg">
      <!-- Outer circle -->
      <circle cx="200" cy="200" r="190" fill="${primaryColor}" opacity="0.1" stroke="${primaryColor}" stroke-width="6"/>

      <!-- Inner circle -->
      <circle cx="200" cy="200" r="170" fill="none" stroke="${accentColor}" stroke-width="4"/>

      <!-- Center initials -->
      <text x="200" y="180" font-size="100" font-weight="900" text-anchor="middle"
            fill="${primaryColor}" font-family="system-ui, -apple-system, sans-serif">
        ${initials}
      </text>

      <!-- Brand name bottom -->
      <text x="200" y="280" font-size="36" font-weight="700" text-anchor="middle"
            fill="${primaryColor}" font-family="system-ui, -apple-system, sans-serif">
        ${brandName}
      </text>
    </svg>
  `;
}

function createFallbackCombined(
  initials: string,
  brandName: string,
  tagline: string,
  primaryColor: string,
): string {
  return `
    <svg viewBox="0 0 800 300" xmlns="http://www.w3.org/2000/svg">
      <!-- Icon -->
      <circle cx="150" cy="150" r="120" fill="${primaryColor}" opacity="0.15"/>
      <circle cx="150" cy="150" r="100" fill="${primaryColor}"/>
      <text x="150" y="180" font-size="80" font-weight="900" text-anchor="middle"
            fill="white" font-family="system-ui, -apple-system, sans-serif">
        ${initials}
      </text>

      <!-- Text -->
      <text x="350" y="100" font-size="64" font-weight="900"
            fill="${primaryColor}" font-family="system-ui, -apple-system, sans-serif">
        ${brandName}
      </text>
      <text x="350" y="180" font-size="28" font-weight="300"
            fill="${primaryColor}" opacity="0.6" font-family="system-ui, -apple-system, sans-serif">
        ${tagline}
      </text>
    </svg>
  `;
}

function createFallbackMonochrome(initials: string, brandName: string): string {
  return `
    <svg viewBox="0 0 500 500" xmlns="http://www.w3.org/2000/svg">
      <!-- Outer border -->
      <circle cx="250" cy="250" r="240" fill="none" stroke="black" stroke-width="8"/>

      <!-- Inner circle -->
      <circle cx="250" cy="250" r="220" fill="white"/>

      <!-- Initials -->
      <text x="250" y="270" font-size="120" font-weight="900" text-anchor="middle"
            fill="black" font-family="system-ui, -apple-system, sans-serif">
        ${initials}
      </text>

      <!-- Brand name -->
      <text x="250" y="380" font-size="36" font-weight="700" text-anchor="middle"
            fill="black" font-family="system-ui, -apple-system, sans-serif">
        ${brandName}
      </text>
    </svg>
  `;
}

function createFallbackLabel(
  story: BrandStory,
  colors: ColorPalette,
  packageType: string,
): string {
  return `
    <svg viewBox="0 0 600 800" xmlns="http://www.w3.org/2000/svg">
      <!-- Background -->
      <rect width="600" height="800" fill="white"/>

      <!-- Header band -->
      <rect width="600" height="120" fill="${colors.primary.main}"/>
      <text x="300" y="70" font-size="48" font-weight="900" text-anchor="middle"
            fill="white" font-family="system-ui, -apple-system, sans-serif">
        ${story.brandName.toUpperCase()}
      </text>

      <!-- Tagline -->
      <text x="300" y="180" font-size="28" text-anchor="middle"
            fill="${colors.primary.main}" font-family="system-ui, -apple-system, sans-serif">
        ${story.tagline}
      </text>

      <!-- Benefits -->
      <text x="50" y="250" font-size="18" font-weight="700"
            fill="${colors.primary.main}" font-family="system-ui, -apple-system, sans-serif">
        ✓ Premium Quality
      </text>
      <text x="50" y="300" font-size="18" font-weight="700"
            fill="${colors.primary.main}" font-family="system-ui, -apple-system, sans-serif">
        ✓ Eco-Friendly
      </text>
      <text x="50" y="350" font-size="18" font-weight="700"
            fill="${colors.primary.main}" font-family="system-ui, -apple-system, sans-serif">
        ✓ Trusted Brand
      </text>

      <!-- Footer -->
      <text x="50" y="700" font-size="12" fill="${colors.neutrals.gray}">
        Made with care • ${packageType}
      </text>

      <!-- Barcode area -->
      <rect x="450" y="700" width="120" height="80" fill="none" stroke="${colors.border}" stroke-dasharray="5,5"/>
      <text x="510" y="745" font-size="12" text-anchor="middle" fill="${colors.textMuted}">
        UPC
      </text>
    </svg>
  `;
}
