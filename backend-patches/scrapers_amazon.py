"""
Product research using Amazon's autocomplete API + Google Trends, with a
real-data path via DataForSEO when credentials are configured.

All major e-commerce sites (Amazon, eBay, Google Shopping, Alibaba) block
datacenter IPs from Railway. Amazon's autocomplete API is NOT blocked and
returns real search demand data — exactly what FBA sellers need.

When DATAFORSEO_LOGIN/DATAFORSEO_PASSWORD are configured (see dataforseo.py),
search_amazon() delegates to real DataForSEO product listings instead of the
keyword-derived price/competition guesses below. Every result is tagged with
a "source" field ("dataforseo" = real, "keyword_estimate" = guessed price
from a hardcoded category table) so the frontend can show this honestly
instead of presenting guessed prices as real listings.

When DataForSEO SERP API is unavailable (e.g. not enabled on the account),
keyword_estimate results are still enriched with real monthly search volumes
from the DataForSEO Labs bulk_search_volume endpoint (which IS accessible).
This means the "search demand" claim on keyword_estimate banners is accurate.
"""
import asyncio
import hashlib
import logging
from typing import Optional
import httpx

from backend.scrapers.keywords import to_query_string, to_keywords
from backend.scrapers import dataforseo

log = logging.getLogger("siftly")

AMAZON_SUGGEST = "https://completion.amazon.com/api/2017/suggestions"

# Estimated retail price ranges by product keyword, drawn from typical FBA products
PRICE_RANGES: dict[str, tuple[float, float]] = {
    "cutting board": (18, 55),
    "knife": (15, 80),
    "pan": (20, 90),
    "pot": (25, 80),
    "mug": (12, 35),
    "bottle": (14, 40),
    "organizer": (15, 45),
    "mat": (20, 70),
    "yoga": (25, 80),
    "posture": (20, 60),
    "resistance band": (12, 35),
    "foam roller": (15, 50),
    "massager": (25, 100),
    "phone case": (8, 30),
    "charger": (12, 40),
    "stand": (15, 60),
    "headphone": (25, 150),
    "speaker": (20, 120),
    "dog": (10, 50),
    "cat": (8, 40),
    "skin": (12, 50),
    "hair": (10, 40),
    "toy": (10, 45),
    "puzzle": (12, 40),
    "baby": (10, 50),
    "hiking": (25, 100),
    "camping": (20, 80),
    "desk": (40, 200),
    "chair": (50, 300),
}
DEFAULT_PRICE_RANGE = (15, 60)


def _estimate_price(keyword: str) -> Optional[float]:
    kw_lower = keyword.lower()
    for k, (lo, hi) in PRICE_RANGES.items():
        if k in kw_lower:
            return round((lo + hi) / 2, 2)
    lo, hi = DEFAULT_PRICE_RANGE
    return round((lo + hi) / 2, 2)


def _competition_from_words(kw: str) -> str:
    words = len(kw.split())
    return "Low" if words >= 4 else "Medium" if words >= 3 else "High"


def _stable_id(keyword: str) -> str:
    """Stable synthetic ID from keyword — keeps FlatList keys unique across re-renders."""
    return "KW" + hashlib.md5(keyword.lower().strip().encode()).hexdigest()[:8].upper()


def _opportunity(competition: str, price: Optional[float]) -> str:
    p = price or 0
    if competition == "Low" and p > 18:
        return "Good"
    if competition == "High" or p < 12:
        return "Saturated"
    return "Moderate"


async def _fetch_suggestions(prefix: str, client: httpx.AsyncClient) -> list[str]:
    try:
        r = await client.get(
            AMAZON_SUGGEST,
            params={
                "limit": 11,
                "prefix": prefix,
                "suggestion-type": "KEYWORD",
                "page-type": "Search",
                "alias": "aps",
                "site-variant": "desktop",
                "version": 3,
                "event": "onKeyPress",
                "lop": "en_US",
                "mid": "ATVPDKIKX0DER",
                "plain-mid": 1,
                "client-info": "amazon-search-ui",
            },
            timeout=6.0,
        )
        return [s["value"] for s in r.json().get("suggestions", [])]
    except Exception:
        return []


async def _enrich_with_search_volumes(products: list[dict]) -> list[dict]:
    """
    Annotate keyword_estimate results with real monthly Amazon search volumes
    from DataForSEO Labs bulk_search_volume endpoint.

    Cost: ~$0.0001 per keyword. Only called when DataForSEO credentials are set.
    Falls back silently if the API call fails — search_volume field is simply absent.
    """
    if not dataforseo._is_configured():
        return products
    if not dataforseo.budget_ok(estimated_cost=0.01 + len(products) * 0.0001):
        return products

    keywords = [p["title"] for p in products]
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.post(
                "https://api.dataforseo.com/v3/dataforseo_labs/amazon/bulk_search_volume/live",
                headers={
                    "Authorization": dataforseo._auth_header(),
                    "Content-Type": "application/json",
                },
                json=[{
                    "keywords": keywords,
                    "location_code": 2840,
                    "language_code": "en",
                }],
            )
            data = resp.json()
            task = data.get("tasks", [{}])[0]
            dataforseo.record_spend(task.get("cost", 0))
            items = (
                task
                .get("result", [{}])[0]
                .get("items", [])
            )
            vol_map: dict[str, Optional[int]] = {
                item["keyword"]: item.get("keyword_info", {}).get("search_volume")
                for item in items
                if "keyword" in item
            }
            enriched = 0
            for p in products:
                title = p["title"]
                sv = vol_map.get(title.lower()) or vol_map.get(title)
                if sv is not None:
                    p["search_volume"] = sv
                    enriched += 1
            log.info("Labs search volumes: enriched %d/%d keyword_estimate results", enriched, len(products))
    except Exception as exc:
        log.warning("DataForSEO Labs bulk_search_volume failed: %s", exc)

    return products


async def search_amazon(keyword: str, category: str = "all") -> list[dict]:
    """
    Returns Amazon product results.

    Uses real DataForSEO listing data when DATAFORSEO_LOGIN/PASSWORD are
    configured AND the SERP Amazon API is accessible. Otherwise falls back to
    keyword-autocomplete-derived opportunities — real search-demand signal, but
    price/competition per result is an estimate from a hardcoded category table,
    not the actual product. Every result carries a "source" field so callers
    can tell which path produced it.

    keyword_estimate results are enriched with real monthly search volumes from
    the DataForSEO Labs API (separate endpoint, always accessible with valid creds).
    """
    if dataforseo._is_configured():
        try:
            real = await dataforseo.search_amazon_products(keyword, marketplace="US", max_results=15)
            if real:
                return real
        except Exception as exc:
            log.warning("DataForSEO SERP Amazon failed (%s) — falling back to keyword estimates", exc)

    base = " ".join(to_keywords(keyword)[:3])
    alphabet = "abcdefghijklmnopqrstuvwxyz"
    queries = [base] + [f"{base} {c}" for c in alphabet[:12]]

    all_kws: list[str] = []
    async with httpx.AsyncClient(
        headers={"User-Agent": "Mozilla/5.0", "Accept": "application/json"},
    ) as client:
        results = await asyncio.gather(*[_fetch_suggestions(q, client) for q in queries])
        for r in results:
            all_kws.extend(r)

    seen: set[str] = set()
    unique: list[str] = []
    for kw in all_kws:
        kl = kw.lower().strip()
        if kl not in seen and len(kl) > 4:
            seen.add(kl)
            unique.append(kw.strip())

    # Sort: longer (more specific = lower competition) first
    unique.sort(key=lambda x: (-len(x.split()), len(x)))
    products = []

    for kw in unique[:15]:
        comp = _competition_from_words(kw)
        price = _estimate_price(kw)
        products.append({
            "title": kw,
            "price": price,
            "rating": None,
            "review_count": None,
            "asin": _stable_id(kw),
            "image": "",
            "competition": comp,
            "opportunity": _opportunity(comp, price),
            "url": f"https://www.amazon.com/s?k={kw.replace(' ', '+')}",
            "source": "keyword_estimate",
        })

    # Enrich with real monthly search volumes from DataForSEO Labs
    products = await _enrich_with_search_volumes(products)

    return products
