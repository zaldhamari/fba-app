"""
Supplier Intelligence Analyzer
AI-powered verdict engine for supplier evaluation.
POST /research/analyze-supplier → { verdict, confidence, summary, reasons, risk, next_step, signals, negotiation_tips }
POST /research/freight-intel    → { verdict, risk_level, signals, recommendations }
"""

from fastapi import APIRouter
from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
import math

router = APIRouter(tags=["supplier_intelligence"])


# ── Request models ────────────────────────────────────────────────────────────

class AnalyzeSupplierRequest(BaseModel):
    product_name:      str
    platform:          str                    # Alibaba, DHgate, 1688, etc.
    unit_cost:         float
    moq:               int
    selling_price:     Optional[float] = None
    lead_time_days:    Optional[int]   = None
    country:           Optional[str]   = None
    is_gold_supplier:  bool            = False
    trade_assurance:   bool            = False
    recon_complaints:  Optional[List[str]] = None  # buyer complaints from Recon
    marketplace:       str             = "US"


class FreightIntelRequest(BaseModel):
    product_name:       str
    unit_cost:          float
    units:              int             = 200
    weight_kg_per_unit: float           = 0.5
    length_cm:          float           = 20.0
    width_cm:           float           = 15.0
    height_cm:          float           = 10.0
    selling_price:      Optional[float] = None
    marketplace:        str             = "US"


# ── Scoring helpers ───────────────────────────────────────────────────────────

def _fba_fee_est(price: float) -> float:
    """Rough FBA fee estimate by price tier (US marketplace)."""
    if price <= 10:   return 3.22
    if price <= 20:   return 4.75
    if price <= 40:   return 5.70
    if price <= 60:   return 6.90
    if price <= 100:  return 8.40
    return price * 0.10 + 5.00


def _roi(selling_price: float, unit_cost: float, freight_per_unit: float = 0.0) -> float:
    """ROI = (revenue - landed - FBA fees) / landed × 100."""
    landed  = unit_cost + freight_per_unit
    fba     = _fba_fee_est(selling_price)
    profit  = selling_price - landed - fba
    return round(profit / landed * 100, 1) if landed > 0 else 0.0


def _margin(selling_price: float, unit_cost: float, freight_per_unit: float = 0.0) -> float:
    landed = unit_cost + freight_per_unit
    fba    = _fba_fee_est(selling_price)
    profit = selling_price - landed - fba
    return round(profit / selling_price * 100, 1) if selling_price > 0 else 0.0


def _rough_freight(unit_cost: float) -> float:
    """Conservative rough freight: unit_cost × 0.35, min $1.20."""
    return max(1.20, unit_cost * 0.35)


def _moq_risk(moq: int) -> str:
    if moq >= 500:  return "High"
    if moq >= 200:  return "Medium"
    return "Low"


def _lead_risk(lead_time_days: Optional[int]) -> str:
    if lead_time_days is None:  return "Unknown"
    if lead_time_days > 45:     return "High"
    if lead_time_days > 30:     return "Medium"
    return "Low"


def _cashflow_stress(moq: int, unit_cost: float) -> str:
    """Estimated inventory investment risk."""
    investment = moq * unit_cost
    if investment >= 10000: return "High"
    if investment >= 3000:  return "Medium"
    return "Low"


def _platform_trust_score(platform: str, is_gold: bool, trade_assurance: bool) -> int:
    """0-100 platform trust signal."""
    base = {
        "alibaba":               70,
        "dhgate":                55,
        "global sources":        72,
        "made-in-china":         60,
        "1688":                  48,   # domestic China — language/trust barrier
        "1688 (domestic china)": 48,
        "aliexpress wholesale":  52,
        "indiamart":             50,
    }.get(platform.lower(), 55)
    bonus = 0
    if is_gold:         bonus += 12
    if trade_assurance: bonus += 8
    return min(100, base + bonus)


# ── Verdict engine ────────────────────────────────────────────────────────────

def _compute_verdict(
    roi: float,
    margin: float,
    moq_risk: str,
    lead_risk: str,
    cashflow: str,
    trust: int,
    selling_price: Optional[float],
) -> tuple[str, int]:
    """
    Returns (verdict, confidence) where verdict ∈ {'GO', 'NEGOTIATE', 'AVOID'}.
    Scores each dimension then buckets the total.
    """
    score = 0

    # ROI (0–35 pts)
    if roi >= 40:    score += 35
    elif roi >= 25:  score += 28
    elif roi >= 15:  score += 18
    elif roi >= 0:   score += 8
    else:            score += 0   # negative ROI is a hard signal

    # Margin (0–20 pts)
    if margin >= 30:   score += 20
    elif margin >= 20: score += 14
    elif margin >= 10: score += 8
    else:              score += 2

    # MOQ risk (0–15 pts)
    score += {"Low": 15, "Medium": 8, "High": 2}[moq_risk]

    # Lead time risk (0–10 pts)
    score += {"Low": 10, "Medium": 6, "High": 2, "Unknown": 4}[lead_risk]

    # Cashflow stress (0–10 pts)
    score += {"Low": 10, "Medium": 6, "High": 2}[cashflow]

    # Platform trust (0–10 pts)
    score += int(trust / 10)

    # Selling price sanity (0–5 pts)
    if selling_price and selling_price >= 20:  score += 5
    elif selling_price and selling_price >= 12: score += 3

    total = min(100, score)

    if roi < 0:
        return "AVOID", min(75, 40 + abs(roi))
    if total >= 68:
        verdict    = "GO"
        confidence = min(95, 60 + (total - 68))
    elif total >= 42:
        verdict    = "NEGOTIATE"
        confidence = min(88, 55 + (total - 42) // 2)
    else:
        verdict    = "AVOID"
        confidence = min(90, 50 + (68 - total))

    return verdict, confidence


def _build_reasons(
    verdict: str,
    roi: float,
    margin: float,
    moq: int,
    moq_risk: str,
    lead_time_days: Optional[int],
    cashflow: str,
    trust: int,
    is_gold: bool,
    trade_assurance: bool,
    selling_price: Optional[float],
) -> List[str]:
    reasons: List[str] = []

    if roi >= 30:
        reasons.append(f"Strong ROI of ~{roi:.0f}% — margin buffer survives PPC spend and fee changes")
    elif roi >= 15:
        reasons.append(f"Viable ROI of ~{roi:.0f}% — keep ad spend under 15% of revenue to stay profitable")
    elif roi >= 0:
        reasons.append(f"Thin ROI of ~{roi:.0f}% — any cost increase or ad spend will erode profit quickly")
    else:
        reasons.append(f"Negative ROI of ~{roi:.0f}% at current prices — unit economics don't work yet")

    if margin >= 25:
        reasons.append(f"Net margin ~{margin:.0f}% — strong enough to absorb FBA fee adjustments")
    elif margin < 15 and selling_price:
        reasons.append(f"Net margin ~{margin:.0f}% — below the 15% floor needed for sustainable FBA sales")

    if moq_risk == "Low":
        reasons.append(f"Low MOQ of {moq:,} units — manageable launch capital and easy to test before scaling")
    elif moq_risk == "Medium":
        reasons.append(f"MOQ of {moq:,} units is moderate — validate demand before committing full inventory")
    else:
        reasons.append(f"High MOQ of {moq:,} units — ties up significant capital before you've proven sales")

    if lead_time_days and lead_time_days <= 25:
        reasons.append(f"Fast {lead_time_days}-day lead time — reduces stockout risk and lets you react to demand faster")
    elif lead_time_days and lead_time_days > 40:
        reasons.append(f"Long {lead_time_days}-day lead time — plan reorders 6+ weeks ahead to avoid stockouts")

    if is_gold and trade_assurance:
        reasons.append("Gold Supplier with Trade Assurance — highest trust tier on the platform")
    elif is_gold:
        reasons.append("Gold Supplier badge — indicates established track record on the platform")
    elif trade_assurance:
        reasons.append("Trade Assurance enabled — payment protection available for this supplier")
    elif trust < 60:
        reasons.append("Unverified supplier — request business license and sample before placing any order")

    if cashflow == "High":
        reasons.append(f"High inventory investment required (MOQ × cost) — ensure cash reserves before committing")

    return reasons[:5]


def _build_risk(roi: float, moq_risk: str, lead_risk: str, cashflow: str) -> str:
    if roi < 5:
        return "Margin is too thin to survive normal FBA cost variability — price must rise or cost must fall before launch"
    if moq_risk == "High" and cashflow == "High":
        return "Large MOQ paired with high unit cost creates serious capital lock-up risk — negotiate lower initial order"
    if lead_risk == "High":
        return "Long lead time increases stockout probability — run inventory forecasting before first order"
    if cashflow == "High":
        return "Initial inventory investment is significant — confirm your runway before committing"
    return "Verify quality with a sample order before placing full MOQ — assume nothing until you've held the product"


def _build_next_step(verdict: str, roi: float, moq: int, trust: int) -> str:
    if verdict == "GO":
        if trust < 65:
            return "Request a sample first — supplier trust signals are low; confirm quality before the MOQ order"
        return f"Request a sample at minimum quantity, then negotiate terms and place MOQ of {moq:,} units"
    if verdict == "NEGOTIATE":
        if roi < 20:
            return f"Negotiate unit cost down — you need ROI ≥ 25% before committing; target a 15–20% price reduction"
        if moq >= 300:
            return f"Negotiate MOQ down to 100–200 units for your first test order, with a path to {moq:,} at scale"
        return "Request a sample and counter-offer on price or payment terms before committing"
    return "Walk away from this configuration — find a supplier with lower MOQ or higher ROI before investing"


def _build_negotiation_tips(
    moq: int, unit_cost: float, roi: float, lead_time_days: Optional[int],
    is_gold: bool, trade_assurance: bool
) -> List[str]:
    tips: List[str] = []

    # MOQ negotiation
    if moq >= 200:
        target_moq = max(50, moq // 3)
        tips.append(f"Open with a {target_moq}-unit trial order — frame it as a 'market test before scale'. Most suppliers accept 30–50% of quoted MOQ for first orders.")

    # Price negotiation
    target_price = round(unit_cost * 0.82, 2)
    tips.append(f"Counter-offer at ${target_price} (≈18% below ask). Anchor with 3 competing quotes — even estimated ones shift the dynamic.")

    # Payment terms
    if not trade_assurance:
        tips.append("Insist on Trade Assurance or escrow — never pay 100% upfront to an unvetted supplier. Offer 30% deposit, 70% on shipping confirmation.")
    else:
        tips.append("Trade Assurance is enabled — use it. Propose 30% deposit, 70% on goods dispatch with a QC inspection clause.")

    # Sample
    tips.append("Ask for a free or low-cost sample ($30–$80) before any bulk discussion. Framing: 'We need to validate quality before presenting to our team'.")

    # Lead time
    if lead_time_days and lead_time_days > 30:
        tips.append(f"Negotiate lead time down from {lead_time_days} days — ask for a production schedule and offer a non-refundable deposit to prioritise your order.")

    # Leverage
    tips.append("Use seasonal timing as leverage — Q1 (Jan–Mar) and Q3 (Jul–Sep) are slow for Chinese factories; they're more flexible on price and MOQ.")

    return tips[:5]


# ── Routes ────────────────────────────────────────────────────────────────────

@router.post("/research/analyze-supplier")
async def analyze_supplier(req: AnalyzeSupplierRequest) -> Dict[str, Any]:
    """
    AI-powered supplier verdict: GO / NEGOTIATE / AVOID.
    Mirrors analyzeProduct endpoint contract for plug-and-play frontend wiring.
    """
    freight      = _rough_freight(req.unit_cost)
    roi          = _roi(req.selling_price, req.unit_cost, freight) if req.selling_price else 0.0
    margin       = _margin(req.selling_price, req.unit_cost, freight) if req.selling_price else 0.0
    moq_risk     = _moq_risk(req.moq)
    lead_risk    = _lead_risk(req.lead_time_days)
    cashflow     = _cashflow_stress(req.moq, req.unit_cost)
    trust        = _platform_trust_score(req.platform, req.is_gold_supplier, req.trade_assurance)
    investment   = round(req.moq * req.unit_cost, 2)
    landed_cost  = round(req.unit_cost + freight, 2)

    verdict, confidence = _compute_verdict(
        roi, margin, moq_risk, lead_risk, cashflow, trust, req.selling_price
    )

    reasons = _build_reasons(
        verdict, roi, margin, req.moq, moq_risk, req.lead_time_days,
        cashflow, trust, req.is_gold_supplier, req.trade_assurance, req.selling_price
    )
    risk           = _build_risk(roi, moq_risk, lead_risk, cashflow)
    next_step      = _build_next_step(verdict, roi, req.moq, trust)
    neg_tips       = _build_negotiation_tips(
        req.moq, req.unit_cost, roi, req.lead_time_days,
        req.is_gold_supplier, req.trade_assurance
    )

    # Recon complaints alignment: flag if buyer complaints could be solved by supplier spec
    recon_alignment: Optional[str] = None
    if req.recon_complaints and len(req.recon_complaints) > 0:
        recon_alignment = (
            f"Recon identified {len(req.recon_complaints)} buyer complaints. "
            f"Include these as spec requirements: \"{req.recon_complaints[0]}\""
            + (f", \"{req.recon_complaints[1]}\"" if len(req.recon_complaints) > 1 else "")
            + ". Ask your supplier to address them explicitly in the sample stage."
        )

    return {
        "verdict":    verdict,
        "confidence": confidence,
        "summary":    _build_summary(verdict, roi, req.unit_cost, req.moq, req.platform),
        "reasons":    reasons,
        "risk":       risk,
        "next_step":  next_step,
        "negotiation_tips": neg_tips,
        "recon_alignment":  recon_alignment,
        "signals": {
            "roi_pct":           roi,
            "margin_pct":        margin,
            "moq_risk":          moq_risk,
            "lead_time_risk":    lead_risk,
            "cashflow_stress":   cashflow,
            "platform_trust":    trust,
            "investment_usd":    investment,
            "landed_cost_usd":   landed_cost,
            "rough_freight_usd": round(freight, 2),
            "fba_fee_est_usd":   round(_fba_fee_est(req.selling_price or 0), 2) if req.selling_price else None,
        },
    }


def _build_summary(verdict: str, roi: float, unit_cost: float, moq: int, platform: str) -> str:
    if verdict == "GO":
        return (
            f"Solid sourcing option. ~{roi:.0f}% ROI at ${unit_cost}/unit from {platform} "
            f"with a {moq:,}-unit MOQ — economics work, proceed to sample stage."
        )
    if verdict == "NEGOTIATE":
        return (
            f"Viable but negotiation required. At ${unit_cost}/unit the margin is tight "
            f"— push for a lower price or smaller trial order before committing to {moq:,} units."
        )
    return (
        f"Unit economics don't work at ${unit_cost}/unit from {platform}. "
        f"MOQ of {moq:,} units at current pricing creates too much risk — find alternatives first."
    )


# ── Freight intelligence ──────────────────────────────────────────────────────

def _cbm(length_cm: float, width_cm: float, height_cm: float) -> float:
    return (length_cm / 100) * (width_cm / 100) * (height_cm / 100)


def _air_cost(total_weight_kg: float, total_cbm: float, units: int) -> Dict[str, Any]:
    chargeable_kg = max(total_weight_kg, total_cbm * 167)  # air volumetric ratio 1:167
    rate_per_kg   = 6.50   # USD/kg door-to-door air freight (China → US)
    total         = round(chargeable_kg * rate_per_kg, 2)
    return {
        "mode": "Air Freight",
        "total_cost": total,
        "cost_per_unit": round(total / units, 2),
        "transit_days": 7,
        "notes": "Fastest but most expensive. Best for high-value, low-weight products under 200 kg.",
    }


def _sea_lcl_cost(total_weight_kg: float, total_cbm: float, units: int) -> Dict[str, Any]:
    base_cbm_rate = 180   # USD/CBM for LCL (China → US)
    min_cbm       = 1.0
    billable_cbm  = max(min_cbm, total_cbm)
    total         = round(billable_cbm * base_cbm_rate + 150, 2)  # + origin/dest charges
    return {
        "mode": "Sea LCL",
        "total_cost": total,
        "cost_per_unit": round(total / units, 2),
        "transit_days": 35,
        "notes": "Share a container — best for shipments under 10 CBM. Slower but cost-effective.",
    }


def _sea_fcl_cost(total_cbm: float, units: int) -> Optional[Dict[str, Any]]:
    if total_cbm < 8:
        return None   # FCL doesn't make sense under 8 CBM
    rate_20ft = 2200  # USD per 20ft container (China → US West Coast)
    rate_40ft = 3200
    if total_cbm <= 25:
        total = rate_20ft
        label = "20ft Container"
    else:
        total = rate_40ft
        label = "40ft Container"
    return {
        "mode": f"Sea FCL ({label})",
        "total_cost": total,
        "cost_per_unit": round(total / units, 2),
        "transit_days": 28,
        "notes": f"Full container ({label}). Most cost-effective at high volume.",
    }


def _express_cost(total_weight_kg: float, units: int) -> Dict[str, Any]:
    base  = max(45, total_weight_kg * 9.50)
    total = round(base, 2)
    return {
        "mode": "Express (DHL/FedEx)",
        "total_cost": total,
        "cost_per_unit": round(total / units, 2),
        "transit_days": 4,
        "notes": "Door-to-door express. Only viable for samples or urgent orders under 50 kg.",
    }


def _recommend_mode(cbm: float, total_kg: float) -> str:
    if total_kg < 50:   return "express"
    if cbm < 1.5:       return "air"
    if cbm < 8:         return "sea_lcl"
    return "sea_fcl"


def _freight_risk_signals(
    cpu_air: float, cpu_sea: float, unit_cost: float,
    selling_price: Optional[float]
) -> List[Dict[str, str]]:
    signals = []
    if unit_cost > 0 and cpu_air / unit_cost > 0.5:
        signals.append({
            "type":   "warning",
            "label":  "High freight-to-cost ratio (air)",
            "detail": f"Air freight at ${cpu_air:.2f}/unit = {cpu_air/unit_cost*100:.0f}% of COGS — sea freight is essential for this product.",
        })
    if selling_price and cpu_sea / selling_price > 0.15:
        signals.append({
            "type":   "warning",
            "label":  "Sea freight is still expensive vs. price",
            "detail": f"Sea LCL at ${cpu_sea:.2f}/unit = {cpu_sea/selling_price*100:.0f}% of selling price — check if heavier packaging or higher selling price can offset this.",
        })
    if cpu_sea < 1.50:
        signals.append({
            "type":   "positive",
            "label":  "Very low freight cost",
            "detail": f"Sea LCL at ${cpu_sea:.2f}/unit — excellent ratio. Freight will not constrain margin.",
        })
    return signals


@router.post("/research/freight-intel")
async def freight_intelligence(req: FreightIntelRequest) -> Dict[str, Any]:
    """
    Freight mode comparison + risk signals.
    Mirrors the existing /research/freight endpoint shape but adds intelligence layer.
    """
    total_kg   = req.weight_kg_per_unit * req.units
    total_cbm  = _cbm(req.length_cm, req.width_cm, req.height_cm) * req.units

    air     = _air_cost(total_kg, total_cbm, req.units)
    sea_lcl = _sea_lcl_cost(total_kg, total_cbm, req.units)
    sea_fcl = _sea_fcl_cost(total_cbm, req.units)
    express = _express_cost(total_kg, req.units)
    rec     = _recommend_mode(total_cbm, total_kg)

    fba_inbound_est = round(req.units * 0.35, 2)  # rough FBA inbound per unit
    prep_cost       = round(req.units * 0.55, 2)  # rough prep + label per unit

    signals = _freight_risk_signals(
        air["cost_per_unit"], sea_lcl["cost_per_unit"],
        req.unit_cost, req.selling_price
    )

    # Volatility signal — freight rates fluctuate 20-40% seasonally
    signals.append({
        "type":   "neutral",
        "label":  "Freight volatility",
        "detail": "Sea rates fluctuate 20–40% seasonally. Lock in a quote 8–10 weeks before planned ship date. Q4 rates are typically 35% higher.",
    })

    return {
        "product":         req.product_name,
        "marketplace":     req.marketplace,
        "units":           req.units,
        "total_weight_kg": round(total_kg, 2),
        "total_cbm":       round(total_cbm, 4),
        "recommended":     rec,
        "fba_inbound_est": fba_inbound_est,
        "prep_cost":       prep_cost,
        "modes": {
            "air":     air,
            "sea_lcl": sea_lcl,
            "sea_fcl": sea_fcl,
            "express": express,
        },
        "risk_signals": signals,
        "negotiation_note": (
            "Use sea LCL quotes from 3 forwarders to benchmark — Flexport, Freightos, and a local broker. "
            "Always get an all-in quote (origin charges + ocean + destination + customs) to avoid surprises."
        ),
    }
