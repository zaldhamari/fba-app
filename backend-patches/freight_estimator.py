"""
Freight cost estimator — China to Amazon FBA warehouse.

Provides estimates for air, sea, and express freight without any external
freight API — flat rate-table benchmarks, not a live carrier quote.

Rates last verified: June 2026 market benchmarks (China → destination,
door-to-door, standard/non-peak). Sources consulted: Freightos China→US
shipping rate guide, Suaid Global air/LCL/FCL rate guides, BSI Freight
China→world air rate guide (all June 2026 editions). US-route figures are
taken directly from these guides; UK/DE/CA/AU figures are scaled from the
US benchmark using the same relative route premiums as the prior rate card,
since per-route 2026 data wasn't consistently published for every lane —
flagged here rather than presented as independently verified for each route.

Ocean and air freight rates are inherently volatile (fuel surcharges, peak
season, capacity) — treat this as a planning estimate, not a quote. A
shipment's actual cost should always be confirmed with a freight forwarder
before committing money. Re-verify this table periodically.

When a real freight API is integrated (e.g. Flexport, Freightos):
  1. Set env vars for the API credentials
  2. Replace _calculate_rates() with a real API call
  3. Keep the response shape identical
"""
from typing import Optional


# ── Rate tables (USD, June 2026 benchmarks — see module docstring for sources) ──

# Air freight: $/kg — China → US/UK/DE/CA/AU (standard service, non-peak)
AIR_RATES: dict[str, float] = {
    "US": 5.50, "UK": 5.95, "DE": 6.20, "CA": 6.40, "AU": 7.80,
}

# Sea freight (LCL): $/CBM — China → destination
SEA_LCL_RATES: dict[str, float] = {
    "US": 110, "UK": 127, "DE": 145, "CA": 122, "AU": 150,
}

# Sea freight (FCL 20ft container): flat rate USD
SEA_FCL_RATES: dict[str, float] = {
    "US": 2200, "UK": 2570, "DE": 2930, "CA": 2380, "AU": 3420,
}

# DHL/FedEx express: $/kg
EXPRESS_RATES: dict[str, float] = {
    "US": 7.50, "UK": 8.05, "DE": 8.55, "CA": 8.30, "AU": 9.80,
}

# Amazon FBA prep / labeling (China 3PL): flat per shipment
PREP_COST = 75

# FBA inbound placement service fee estimate: $/unit. Amazon's 2026 rate card
# runs $0.21-$1.58/unit for standard-size items depending on shipment-split
# strategy; this assumes "minimal splits" (single inbound location), the
# simplest and most common path for small/new sellers, near the lower-middle
# of that range. Sellers using Amazon-optimized splits pay less.
FBA_INBOUND_PER_UNIT = 0.35

# Transit times in days
TRANSIT_DAYS: dict[str, dict[str, int]] = {
    "air":     {"US": 7,  "UK": 8,  "DE": 9,  "CA": 8,  "AU": 10},
    "sea_lcl": {"US": 35, "UK": 38, "DE": 40, "CA": 37, "AU": 42},
    "sea_fcl": {"US": 30, "UK": 33, "DE": 35, "CA": 32, "AU": 38},
    "express": {"US": 4,  "UK": 5,  "DE": 5,  "CA": 5,  "AU": 6},
}


def estimate_freight(
    product_name: str,
    marketplace: str,
    units: int,
    weight_kg_per_unit: float,
    length_cm: float,
    width_cm: float,
    height_cm: float,
) -> dict:
    """
    Returns freight cost estimates for all shipping modes.
    All inputs in metric (kg, cm).
    """
    vol_weight_kg = (length_cm * width_cm * height_cm) / 5000  # IATA volumetric
    chargeable_kg = max(weight_kg_per_unit, vol_weight_kg) * units
    cbm           = (length_cm * width_cm * height_cm / 1_000_000) * units

    air     = _calc_air(chargeable_kg, marketplace, units)
    express = _calc_express(chargeable_kg, marketplace, units)
    sea_lcl = _calc_sea_lcl(cbm, marketplace, units)
    sea_fcl = _calc_sea_fcl(marketplace, units)

    recommended = _recommend(air, sea_lcl, units)

    return {
        "product":     product_name,
        "marketplace": marketplace,
        "units":       units,
        "total_weight_kg": round(chargeable_kg, 2),
        "total_cbm":   round(cbm, 4),
        "modes": {
            "air":     air,
            "sea_lcl": sea_lcl,
            "sea_fcl": sea_fcl if cbm > 2 else None,  # FCL only makes sense > 2 CBM
            "express": express,
        },
        "recommended":     recommended,
        "fba_inbound_est": round(FBA_INBOUND_PER_UNIT * units, 2),
        "prep_cost":       PREP_COST,
    }


def _calc_air(chargeable_kg: float, marketplace: str, units: int) -> dict:
    rate     = AIR_RATES.get(marketplace, 5.0)
    cost     = round(rate * chargeable_kg + PREP_COST + FBA_INBOUND_PER_UNIT * units, 2)
    per_unit = round(cost / units, 2)
    return {
        "mode":            "Air Freight",
        "total_cost":      cost,
        "cost_per_unit":   per_unit,
        "transit_days":    TRANSIT_DAYS["air"].get(marketplace, 8),
        "notes":           "Best for first orders and time-sensitive restocks",
    }


def _calc_express(chargeable_kg: float, marketplace: str, units: int) -> dict:
    rate     = EXPRESS_RATES.get(marketplace, 10.0)
    cost     = round(rate * chargeable_kg + PREP_COST, 2)
    per_unit = round(cost / units, 2)
    return {
        "mode":            "Express (DHL/FedEx)",
        "total_cost":      cost,
        "cost_per_unit":   per_unit,
        "transit_days":    TRANSIT_DAYS["express"].get(marketplace, 5),
        "notes":           "Fastest — use only for urgent restocks under 50kg",
    }


def _calc_sea_lcl(cbm: float, marketplace: str, units: int) -> dict:
    rate     = SEA_LCL_RATES.get(marketplace, 100)
    cost     = round(max(cbm, 1) * rate + PREP_COST + FBA_INBOUND_PER_UNIT * units, 2)
    per_unit = round(cost / units, 2)
    return {
        "mode":            "Sea Freight (LCL)",
        "total_cost":      cost,
        "cost_per_unit":   per_unit,
        "transit_days":    TRANSIT_DAYS["sea_lcl"].get(marketplace, 37),
        "notes":           "Lowest cost for 1–10 CBM shipments",
    }


def _calc_sea_fcl(marketplace: str, units: int) -> dict:
    cost     = SEA_FCL_RATES.get(marketplace, 2000) + PREP_COST + FBA_INBOUND_PER_UNIT * units
    per_unit = round(cost / units, 2)
    return {
        "mode":            "Sea Freight (FCL 20ft)",
        "total_cost":      round(cost, 2),
        "cost_per_unit":   per_unit,
        "transit_days":    TRANSIT_DAYS["sea_fcl"].get(marketplace, 32),
        "notes":           "Best per-unit cost for large orders (10+ CBM)",
    }


def _recommend(air: dict, sea_lcl: dict, units: int) -> str:
    if units < 200:
        return "air"
    if sea_lcl["cost_per_unit"] < air["cost_per_unit"] * 0.6:
        return "sea_lcl"
    return "air"
