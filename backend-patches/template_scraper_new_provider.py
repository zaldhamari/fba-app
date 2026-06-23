"""
TEMPLATE: Add a new supplier provider (e.g., Global Sources, Made-in-China, TradeKey)

Follow these steps to add a new provider:
1. Copy this file to backend/scrapers/newprovider.py
2. Replace "TEMPLATE" and "NewProvider" with your actual provider name
3. Implement the API calls to that provider
4. Register in data_source_router.py
5. Done! All screens automatically use the new provider.

Example providers to implement:
- Global Sources (globalsources.com) — verified suppliers, trade shows
- Made-in-China (made-in-china.com) — direct factory listings
- TradeKey (tradekey.com) — B2B supplier network
- DHgate (dhgate.com) — wholesale (low MOQ)
"""

from typing import List, Dict, Any, Optional
import logging

logger = logging.getLogger(__name__)


def _is_configured() -> bool:
    """
    Check if provider credentials are configured.

    Template:
    - Look for an environment variable like PROVIDER_API_KEY
    - Return True only if configured
    - Return False otherwise (will fall back to next provider in chain)
    """
    import os
    api_key = os.getenv("NEWPROVIDER_API_KEY")
    return bool(api_key)


async def search_suppliers(
    product: str,
    marketplace: str = "US",
    max_unit_price: Optional[float] = None,
    max_moq: Optional[int] = None,
    max_results: int = 10,
) -> List[Dict[str, Any]]:
    """
    Search for suppliers on NewProvider.

    Args:
        product: Product name to search for
        marketplace: Marketplace code (e.g., "US", "CN")
        max_unit_price: Filter suppliers by max unit price
        max_moq: Filter suppliers by max MOQ
        max_results: Number of results to return

    Returns: List of supplier dicts with standardized keys
    """
    if not _is_configured():
        logger.warning("NewProvider API key not configured")
        raise RuntimeError("NewProvider not configured")

    try:
        # Step 1: Call provider's API
        results = await _call_provider_api(
            product=product,
            marketplace=marketplace,
            max_results=max_results,
        )

        # Step 2: Filter by price/MOQ if requested
        filtered = results
        if max_unit_price:
            filtered = [r for r in filtered if (r.get("price_min") or 0) <= max_unit_price]
        if max_moq:
            filtered = [r for r in filtered if (r.get("moq_num") or 0) <= max_moq]

        # Step 3: Standardize response format
        suppliers = [_normalize_supplier(s) for s in filtered[:max_results]]

        logger.info(f"NewProvider: found {len(suppliers)} suppliers for '{product}'")
        return suppliers

    except Exception as e:
        logger.error(f"NewProvider search failed: {str(e)}")
        raise


async def _call_provider_api(
    product: str,
    marketplace: str,
    max_results: int,
) -> List[Dict[str, Any]]:
    """
    Call the actual provider API.

    IMPORTANT: Standardize the response to match this shape:
    {
        "title": "Product name - Supplier name",
        "supplier": "Company Name",
        "price_range": (min_price, max_price) or single price,
        "price_min": 1.50,
        "price_max": 3.50,
        "price_display": "$1.50–$3.50",
        "moq": "100",
        "moq_num": 100,
        "rating": 4.5,
        "verified": True,  # if provider supports verification
        "years_on_platform": 8,
        "country": "China",
        "url": "https://...",
        # Any additional provider-specific fields
    }
    """
    # TODO: Replace with actual provider API call
    # Example structure:
    # 1. Build request (auth headers, params, etc)
    # 2. Make HTTP request (httpx.AsyncClient or similar)
    # 3. Parse response
    # 4. Return list of supplier dicts

    import httpx

    async with httpx.AsyncClient(timeout=10.0) as client:
        # Example API call (replace with real provider endpoint)
        response = await client.get(
            f"https://api.newprovider.com/suppliers/search",
            params={
                "q": product,
                "marketplace": marketplace,
                "limit": max_results,
                "api_key": __get_api_key(),
            },
        )
        response.raise_for_status()
        return response.json().get("results", [])


def _normalize_supplier(raw: Dict[str, Any]) -> Dict[str, Any]:
    """
    Convert provider's native response format to Siftly standard.

    Every supplier dict must have these fields (even if null):
    - title, supplier, price_range, moq, rating, verified, url, source

    Add these if the provider supplies them:
    - years_on_platform, trade_assurance, country

    Example conversion:
    {
        "title": raw.get("productTitle"),
        "supplier": raw.get("companyName"),
        "price_range": (raw.get("minPrice"), raw.get("maxPrice")),
        "moq": str(raw.get("minOrderQty")),
        "moq_num": raw.get("minOrderQty"),
        "rating": raw.get("sellerRating"),
        "verified": raw.get("certified", False),
        "url": raw.get("supplierUrl"),
        "source": "newprovider",  # REQUIRED
    }
    """
    # TODO: Map raw provider response to standard format
    # This is the critical function for making a new provider work
    return {
        "title": raw.get("title", ""),
        "supplier": raw.get("supplier", ""),
        "price_min": raw.get("price_min"),
        "price_max": raw.get("price_max"),
        "price_display": raw.get("price_display", ""),
        "moq": str(raw.get("moq", "")),
        "moq_num": raw.get("moq_num", 0),
        "rating": raw.get("rating"),
        "verified": raw.get("verified", False),
        "trade_assurance": raw.get("trade_assurance"),
        "years_on_platform": raw.get("years_on_platform"),
        "country": raw.get("country", ""),
        "url": raw.get("url"),
        "source": "newprovider",  # MUST BE SET
    }


def __get_api_key() -> str:
    """Get API key from environment."""
    import os
    key = os.getenv("NEWPROVIDER_API_KEY")
    if not key:
        raise ValueError("NEWPROVIDER_API_KEY not configured")
    return key


# ── Integration Checklist ──────────────────────────────────────────────────────

"""
After implementing this scraper, register it in data_source_router.py:

1. Add to ProviderType enum (if not already there):
   NEWPROVIDER = "newprovider"

2. Add to DataSourceRouterImpl.__init__():
   ProviderType.NEWPROVIDER: DataSourceConfig(
       provider=ProviderType.NEWPROVIDER,
       enabled=_is_newprovider_configured(),
       priority=2,  # Adjust based on where in chain this provider fits
       rate_limit_per_day=500,
       cost_per_request=0.0,  # Usually free
       fallback_chain=[
           ProviderType.FALLBACK_ESTIMATE,
           ProviderType.STUB,
       ],
   ),

3. Add to DataSourceRouterImpl._search_suppliers_with_provider():
   elif provider_type == ProviderType.NEWPROVIDER:
       if not self.configs[provider_type].is_available():
           raise RuntimeError("NewProvider rate limit reached")
       from backend.scrapers.newprovider import search_suppliers as np_search
       suppliers = await np_search(
           product, marketplace, max_unit_price, max_moq, max_results
       )
       return {"suppliers": suppliers, "data_source": "newprovider"}

4. Set environment variable for testing:
   export NEWPROVIDER_API_KEY=<your-api-key>

5. Test:
   python -m pytest tests/test_search_orchestrator.py -k newprovider

6. That's it! All screens automatically get access to the new provider.
"""
