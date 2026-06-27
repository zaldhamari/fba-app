"""
Brand generation module — replaces the existing /brand/create and /brand/label endpoints.

Drop this at backend/modules/brand_generator.py and register the router in routes.py:
    from modules.brand_generator import router as brand_router
    app.include_router(brand_router)

Key change vs original: uses chat_creative (Sonnet + 6000 tokens) instead of Haiku.
This produces significantly richer SVG logos with real design structure, proper
color handling, layered elements, and enough token budget to never truncate mid-SVG.
"""

import re
import json
import textwrap
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional

from modules.ai_client import chat_creative, chat_creative_json, chat, chat_json

router = APIRouter(prefix="/brand", tags=["brand"])


# ─── Colour palette → hex mapping ────────────────────────────────────────────

PALETTES: dict[str, dict] = {
    "blue":     {"primary": "#2563EB", "secondary": "#1E40AF", "accent": "#DBEAFE", "text": "#1E3A5F"},
    "green":    {"primary": "#059669", "secondary": "#047857", "accent": "#D1FAE5", "text": "#064E3B"},
    "purple":   {"primary": "#7C3AED", "secondary": "#6D28D9", "accent": "#EDE9FE", "text": "#4C1D95"},
    "red":      {"primary": "#DC2626", "secondary": "#B91C1C", "accent": "#FEE2E2", "text": "#7F1D1D"},
    "orange":   {"primary": "#EA580C", "secondary": "#C2410C", "accent": "#FFEDD5", "text": "#7C2D12"},
    "gold":     {"primary": "#B45309", "secondary": "#92400E", "accent": "#FEF3C7", "text": "#451A03"},
    "navy":     {"primary": "#1E3A8A", "secondary": "#1E40AF", "accent": "#DBEAFE", "text": "#0F172A"},
    "teal":     {"primary": "#0D9488", "secondary": "#0F766E", "accent": "#CCFBF1", "text": "#134E4A"},
    "pink":     {"primary": "#DB2777", "secondary": "#BE185D", "accent": "#FCE7F3", "text": "#831843"},
    "slate":    {"primary": "#475569", "secondary": "#334155", "accent": "#F1F5F9", "text": "#0F172A"},
    "black":    {"primary": "#111827", "secondary": "#374151", "accent": "#F3F4F6", "text": "#111827"},
    "white":    {"primary": "#FFFFFF", "secondary": "#E5E7EB", "accent": "#F9FAFB", "text": "#111827"},
}

DIRECTION_MOODS: dict[str, str] = {
    "bold_geometric":   "bold geometric shapes, strong lines, high contrast, angular",
    "minimal_clean":    "clean whitespace, single icon mark, ultra-minimal, refined",
    "natural_organic":  "organic curves, nature motifs, earthy feel, flowing",
    "luxury_premium":   "gold accents, elegant serifs, refined spacing, prestige",
    "playful_modern":   "rounded shapes, vibrant, friendly, approachable, fun",
    "tech_futuristic":  "circuit-inspired, sharp angles, gradient, modern tech",
    "heritage_classic": "traditional, established, trustworthy, vintage-inspired",
    "artisan_craft":    "handcrafted feel, badge-style, detailed textures, warm",
}

STYLE_MOODS: dict[str, str] = {
    "premium":      "luxury, sophisticated, understated elegance",
    "minimal":      "clean, simple, refined, lots of breathing room",
    "bold":         "strong, confident, high-impact, memorable",
    "playful":      "fun, approachable, energetic, colourful",
    "organic":      "natural, eco-friendly, earthy, wholesome",
    "professional": "trustworthy, corporate, polished, reliable",
    "modern":       "contemporary, sleek, forward-thinking",
    "vintage":      "retro, nostalgic, heritage, timeless",
}


def _palette(color_palette: str) -> dict:
    return PALETTES.get(color_palette.lower(), PALETTES["blue"])


def _direction_context(brand_direction: str | None, packaging_mood: str | None) -> str:
    parts = []
    if brand_direction and brand_direction in DIRECTION_MOODS:
        parts.append(f"Direction: {DIRECTION_MOODS[brand_direction]}")
    if packaging_mood:
        parts.append(f"Mood: {packaging_mood}")
    return ". ".join(parts) if parts else ""


# ─── Logo generation ─────────────────────────────────────────────────────────

LOGO_SYSTEM = textwrap.dedent("""
You are an elite SVG logo designer. You create professional, publication-quality SVG logos
that look like they were designed by a senior brand identity studio.

Rules for every logo you generate:
1. Output ONLY the raw SVG — no markdown, no explanation, no code fences.
2. Use viewBox="0 0 400 200" always. Never use width/height attributes on the root <svg>.
3. Every logo must have at least THREE distinct visual layers:
   - A background shape or field (rectangle, circle, badge, banner, shield — never plain white)
   - An icon or symbol mark (geometric, iconographic, or lettermark — never just text alone)
   - The brand name in SVG <text>, styled to match the brand personality
4. Use the exact hex colours provided. Never use named colours like "blue" or "red".
5. Typography: use font-family from: Georgia, Palatino, Garamond (serif/premium),
   Arial, Helvetica, Futura (clean/modern), Impact, Oswald (bold), Courier (retro).
   Match font personality to brand style.
6. Add depth: shadows (use <filter> with feDropShadow), gradients (<linearGradient> or
   <radialGradient>), or texture overlays where appropriate.
7. Tagline (if provided) goes below the brand name in a smaller, lighter weight.
8. The logo must be balanced and well-proportioned — test mentally: would a designer be
   proud to show this to a client?
9. Icon mark must be UNIQUE to the brand concept — do not use generic circles or squares
   as the sole icon. Design something that relates to the product category.
10. Never truncate the SVG. The closing </svg> tag must always appear.
""").strip()


def _logo_prompt(
    brand_name: str,
    product_type: str,
    style: str,
    palette: dict,
    tagline: str | None,
    direction_context: str,
    target_audience: str | None,
    brand_tone: str | None,
) -> str:
    style_desc = STYLE_MOODS.get(style.lower(), style)
    lines = [
        f"Create a professional SVG logo for '{brand_name}'.",
        f"Product category: {product_type}",
        f"Brand style: {style} — {style_desc}",
        f"Colour palette — primary: {palette['primary']}, secondary: {palette['secondary']}, "
        f"accent fill: {palette['accent']}, text: {palette['text']}",
    ]
    if direction_context:
        lines.append(f"Design direction: {direction_context}")
    if tagline:
        lines.append(f"Tagline to include: \"{tagline}\"")
    if target_audience:
        lines.append(f"Target audience: {target_audience}")
    if brand_tone:
        lines.append(f"Brand tone: {brand_tone}")
    lines.append(
        "Design a distinctive icon mark that relates to the product category. "
        "Use gradients and/or a drop shadow filter for depth. "
        "The result must look polished, professional, and brand-ready."
    )
    return "\n".join(lines)


# ─── Listing + keywords ───────────────────────────────────────────────────────

LISTING_SYSTEM = textwrap.dedent("""
You are an Amazon listing copywriter. Write keyword-rich, conversion-optimised copy.
Respond ONLY with valid JSON — no markdown, no explanation.

JSON shape:
{
  "title": "...",
  "bullet_points": ["...", "...", "...", "...", "..."],
  "description": "...",
  "backend_keywords": ["...", "..."],
  "name_options": ["...", "...", "..."],
  "tagline": "..."
}
""").strip()


def _listing_prompt(brand_name: str, product_type: str, style: str, keywords: list[str]) -> str:
    kw_str = ", ".join(keywords[:10]) if keywords else product_type
    return (
        f"Brand: {brand_name}\n"
        f"Product: {product_type}\n"
        f"Style/positioning: {style}\n"
        f"Seed keywords: {kw_str}\n\n"
        "Write an Amazon listing with:\n"
        "- title: 150-200 chars, keyword-rich, starts with brand name\n"
        "- 5 bullet points: lead with benefit, include keywords naturally, 200 chars each max\n"
        "- description: 1000 chars, brand story + features\n"
        "- 10 backend_keywords: long-tail, no brand name, no repeats\n"
        "- 3 name_options: alternative brand name ideas\n"
        "- tagline: punchy 5-7 word brand tagline\n"
        "Return valid JSON only."
    )


# ─── Request / response models ────────────────────────────────────────────────

class CreateBrandRequest(BaseModel):
    product_type:     str
    style:            Optional[str] = "premium"
    brand_name:       Optional[str] = None
    brand_direction:  Optional[str] = None
    color_palette:    Optional[str] = "blue"
    font_style:       Optional[str] = "modern"
    packaging_mood:   Optional[str] = None
    tagline:          Optional[str] = None
    target_audience:  Optional[str] = None
    brand_tone:       Optional[str] = None
    keywords:         Optional[list[str]] = []
    use_premium:      Optional[bool] = True  # True → Sonnet; False → Haiku


class CreateLabelRequest(BaseModel):
    brand_name:       str
    product_name:     str
    weight:           str
    style:            Optional[str] = "premium"
    brand_direction:  Optional[str] = None
    color_palette:    Optional[str] = "blue"
    font_style:       Optional[str] = "modern"
    packaging_type:   Optional[str] = "bottle"
    tagline:          Optional[str] = None
    ingredients:      Optional[str] = None
    warnings:         Optional[str] = None
    directions:       Optional[str] = None
    support_url:      Optional[str] = None
    qr_text:          Optional[str] = None
    manufacturer:     Optional[str] = None


# ─── Endpoints ───────────────────────────────────────────────────────────────

@router.post("/create")
async def create_brand(body: CreateBrandRequest):
    palette  = _palette(body.color_palette or "blue")
    dir_ctx  = _direction_context(body.brand_direction, body.packaging_mood)
    name     = body.brand_name or body.product_type.title()

    # 1. Generate SVG logo — Sonnet for premium quota, Haiku for standard
    use_premium = body.use_premium if body.use_premium is not None else True
    logo_prompt = _logo_prompt(
        brand_name        = name,
        product_type      = body.product_type,
        style             = body.style or "premium",
        palette           = palette,
        tagline           = body.tagline,
        direction_context = dir_ctx,
        target_audience   = body.target_audience,
        brand_tone        = body.brand_tone,
    )
    try:
        if use_premium:
            logo_svg = chat_creative(LOGO_SYSTEM, logo_prompt, max_tokens=6000)
        else:
            # Haiku with a generous-but-cheaper token budget
            logo_svg = chat(LOGO_SYSTEM, logo_prompt, max_tokens=2000)
        logo_svg = re.sub(r"```[a-z]*\n?", "", logo_svg).strip()
        if not logo_svg.strip().startswith("<svg"):
            raise ValueError("Response is not valid SVG")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Logo generation failed: {e}")

    # 2. Generate listing + metadata using Haiku (cheaper, text only)
    listing_prompt = _listing_prompt(name, body.product_type, body.style or "premium", body.keywords or [])
    try:
        listing_data = chat_json(LISTING_SYSTEM, listing_prompt, max_tokens=1200)
    except Exception:
        listing_data = {
            "title": f"{name} – Premium {body.product_type}",
            "bullet_points": [],
            "description": "",
            "backend_keywords": [],
            "name_options": [name],
            "tagline": body.tagline or "",
        }

    return {
        "brand_name":          name,
        "name_options":        listing_data.get("name_options", [name]),
        "tagline":             listing_data.get("tagline", body.tagline or ""),
        "style":               body.style or "premium",
        "logo_svg":            logo_svg,
        "quality_tier":        "premium" if use_premium else "standard",
        "generated_keywords":  listing_data.get("backend_keywords", []),
        "listing": {
            "title":            listing_data.get("title", ""),
            "bullet_points":    listing_data.get("bullet_points", []),
            "description":      listing_data.get("description", ""),
            "backend_keywords": listing_data.get("backend_keywords", []),
        },
    }


LABEL_SYSTEM = textwrap.dedent("""
You are a professional packaging designer. You create print-ready SVG product labels
and packaging inserts.

Rules:
1. Output ONLY raw SVG — no markdown, no explanation, no code fences.
2. Label: viewBox="0 0 300 400". Include: brand name, product name, weight/volume,
   tagline, ingredients section, warnings section, directions section, manufacturer info,
   barcode placeholder rectangle, all legally required text areas.
3. Use professional packaging typography — clear hierarchy: brand > product > details.
4. Use the provided colours. Add subtle background texture or gradient.
5. Never truncate. </svg> must always appear.
""").strip()

INSERT_SYSTEM = textwrap.dedent("""
You are a packaging insert designer. Create warm, conversion-focused thank-you inserts.

Rules:
1. Output ONLY raw SVG. viewBox="0 0 300 200".
2. Include: brand name, thank-you headline, 1-2 sentence message, review request CTA,
   QR code placeholder (rectangle with 'Scan to Review' label), support contact.
3. Warm, brand-aligned design. Not clinical or corporate.
4. Never truncate. </svg> must always appear.
""").strip()


@router.post("/label")
async def create_label(body: CreateLabelRequest):
    palette  = _palette(body.color_palette or "blue")
    dir_ctx  = _direction_context(body.brand_direction, None)

    label_prompt = (
        f"Brand: {body.brand_name}\n"
        f"Product: {body.product_name}\n"
        f"Weight/Volume: {body.weight}\n"
        f"Packaging type: {body.packaging_type}\n"
        f"Style: {body.style}\n"
        f"Colours — primary: {palette['primary']}, secondary: {palette['secondary']}, text: {palette['text']}\n"
        + (f"Direction: {dir_ctx}\n" if dir_ctx else "")
        + (f"Tagline: {body.tagline}\n" if body.tagline else "")
        + (f"Ingredients: {body.ingredients}\n" if body.ingredients else "")
        + (f"Warnings: {body.warnings}\n" if body.warnings else "")
        + (f"Directions for use: {body.directions}\n" if body.directions else "")
        + (f"Manufacturer: {body.manufacturer}\n" if body.manufacturer else "")
        + (f"Support: {body.support_url}\n" if body.support_url else "")
        + "\nGenerate a professional, print-ready product label SVG."
    )

    insert_prompt = (
        f"Brand: {body.brand_name}\n"
        f"Product: {body.product_name}\n"
        f"Style: {body.style}\n"
        f"Colours — primary: {palette['primary']}, text: {palette['text']}\n"
        + (f"QR text: {body.qr_text}\n" if body.qr_text else "")
        + (f"Support: {body.support_url}\n" if body.support_url else "")
        + "\nGenerate a warm packaging insert SVG asking for a review."
    )

    try:
        label_svg = chat_creative(LABEL_SYSTEM, label_prompt, max_tokens=8000)
        label_svg = re.sub(r"```[a-z]*\n?", "", label_svg).strip()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Label generation failed: {e}")

    try:
        insert_svg = chat_creative(INSERT_SYSTEM, insert_prompt, max_tokens=4000)
        insert_svg = re.sub(r"```[a-z]*\n?", "", insert_svg).strip()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Insert generation failed: {e}")

    return {
        "label_svg":  label_svg,
        "insert_svg": insert_svg,
    }


# ─── Brand asset generation (used by Brand Identity / AdvancedLogoGenerator) ──

class AssetRequest(BaseModel):
    prompt: str
    type: str  # logo_icon | wordmark | badge | combined_lockup | monochrome | label_*


@router.post("/asset")
async def generate_brand_asset(body: AssetRequest):
    """
    Generic SVG asset generator used by the Brand Identity tab.
    The frontend constructs a detailed prompt and sends it with a type hint.
    Returns a single SVG string.
    """
    try:
        svg = chat_creative(LOGO_SYSTEM, body.prompt, max_tokens=6000)
        svg = re.sub(r"```[a-z]*\n?", "", svg).strip()
        return {"svg": svg}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Asset generation failed: {e}")


# ─── Insert-only endpoint (avoids regenerating label when only insert needed) ─

class CreateInsertRequest(BaseModel):
    brand_name:       str
    product_name:     str
    weight:           str = "0.5kg"
    style:            str = "premium"
    brand_direction:  Optional[str] = None
    color_palette:    str = "blue"
    font_style:       Optional[str] = None
    packaging_type:   str = "standard"
    tagline:          Optional[str] = None
    support_url:      Optional[str] = None
    qr_text:          Optional[str] = None


@router.post("/insert")
async def create_insert(body: CreateInsertRequest):
    """
    Generates only the packaging insert SVG without touching the label.
    Called by Quick Tools → Insert and Make Assets → Insert step.
    """
    palette = _palette(body.color_palette)

    insert_prompt = (
        f"Brand: {body.brand_name}\n"
        f"Product: {body.product_name}\n"
        f"Style: {body.style}\n"
        f"Colours — primary: {palette['primary']}, text: {palette['text']}\n"
        + (f"QR text: {body.qr_text}\n" if body.qr_text else "")
        + (f"Support: {body.support_url}\n" if body.support_url else "")
        + "\nGenerate a warm packaging insert SVG asking for a review."
    )

    try:
        insert_svg = chat_creative(INSERT_SYSTEM, insert_prompt, max_tokens=4000)
        insert_svg = re.sub(r"```[a-z]*\n?", "", insert_svg).strip()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Insert generation failed: {e}")

    return {"insert_svg": insert_svg}
