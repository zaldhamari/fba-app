"""
Supplier Management Backend Module
Handles all supplier operations: vetting, communication, samples, ratings, negotiations, comparisons
Ready for Alibaba API integration
"""

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel, Field
from datetime import datetime
from typing import Optional, List, Dict, Any
import json
from enum import Enum

# ──────────────────────────────────────────────────────────────────────────────
# DATA MODELS
# ──────────────────────────────────────────────────────────────────────────────

class VettingChecklistUpdate(BaseModel):
    supplierId: str
    supplierName: str
    product: str
    businessRegistered: Optional[bool] = None
    licenseProvided: Optional[bool] = None
    tradeAssuranceEnabled: Optional[bool] = None
    yearsInBusiness: Optional[int] = None
    sampleRequested: Optional[bool] = None
    qualificationsCertifications: Optional[List[str]] = None
    referenceCustomerContact: Optional[bool] = None
    factoryVisitCompleted: Optional[bool] = None
    ndaSigned: Optional[bool] = None


class SupplierMessage(BaseModel):
    supplierId: str
    direction: str  # 'outbound' | 'inbound'
    type: str  # 'email' | 'note' | 'phone' | 'chat'
    subject: Optional[str] = None
    body: str
    attachments: Optional[List[str]] = None
    tags: Optional[List[str]] = None


class SampleRequest(BaseModel):
    supplierId: str
    supplierName: str
    productName: str
    dateRequested: str
    quantity: int
    cost: float
    trackingNumber: Optional[str] = None


class SampleUpdate(BaseModel):
    status: Optional[str] = None  # 'requested' | 'in_transit' | 'received' | 'rejected' | 'lost'
    actualArrivalDate: Optional[str] = None
    qualityRating: Optional[int] = None  # 1-5
    qualityNotes: Optional[str] = None
    issues: Optional[List[str]] = None
    decision: Optional[str] = None  # 'approved' | 'rejected' | 'needs_modification' | 'pending'
    decisionNote: Optional[str] = None


class SupplierRatingSubmit(BaseModel):
    supplierId: str
    productName: str
    overallRating: int  # 1-5
    communicationRating: int
    qualityRating: int
    reliabilityRating: int
    valueForMoneyRating: int
    personalNotes: str
    pros: List[str]
    cons: List[str]
    wouldRecommend: bool


class LeadTimeRecord(BaseModel):
    supplierId: str
    productName: str
    requestedLeadTime: int
    promisedLeadTime: int
    orderDate: Optional[str] = None
    deliveryDate: Optional[str] = None
    delayReason: Optional[str] = None
    seasonalFactor: Optional[str] = None
    reliable: bool


class BulkPricingTier(BaseModel):
    minQuantity: int
    maxQuantity: Optional[int] = None
    pricePerUnit: float
    discount: Optional[float] = None
    leadTimeAdjustment: Optional[int] = None


class NegotiatedTermsSubmit(BaseModel):
    supplierId: str
    productName: str
    negotiationStatus: str  # 'pending' | 'agreed' | 'signed' | 'order_placed'

    agreedPricePerUnit: float
    originalAskedPrice: Optional[float] = None

    moq: int
    bulkPricingTiers: Optional[List[BulkPricingTier]] = None

    leadTimeDays: int
    earliestShipDate: Optional[str] = None

    qualityStandards: List[str]
    inspectionRequired: bool
    certifications: List[str]

    paymentTerms: str  # 'TT_advance' | 'TT_50_50' | 'LC' | 'DA' | 'other'
    depositPercentage: Optional[float] = None

    sampleFree: bool
    minimumOrderValue: Optional[float] = None
    shippingTerms: Optional[str] = None  # 'FOB', 'CIF', 'DDP'
    warranty: Optional[str] = None
    returnPolicy: Optional[str] = None

    contractSigned: bool
    ndaSigned: bool

    specialConditions: Optional[List[str]] = None
    nextSteps: Optional[str] = None


class SupplierComparisonRequest(BaseModel):
    productName: str
    supplierId1: str
    supplierId2: str
    supplierId3: Optional[str] = None


class SupplierProfileUpdate(BaseModel):
    status: Optional[str] = None  # 'prospect' | 'vetting' | 'qualified' | 'rejected' | 'ordered' | 'active' | 'archived'
    notes: Optional[str] = None


# ──────────────────────────────────────────────────────────────────────────────
# IN-MEMORY STORAGE (Replace with DB later)
# ──────────────────────────────────────────────────────────────────────────────

supplier_database: Dict[str, Any] = {}


def get_or_create_supplier(supplier_id: str) -> Dict[str, Any]:
    """Get or create supplier record"""
    if supplier_id not in supplier_database:
        supplier_database[supplier_id] = {
            'id': supplier_id,
            'vetting': None,
            'communication': [],
            'samples': [],
            'rating': None,
            'leadTimes': [],
            'negotiatedTerms': None,
            'profile': {'status': 'prospect', 'addedAt': datetime.utcnow().isoformat()},
        }
    return supplier_database[supplier_id]


# ──────────────────────────────────────────────────────────────────────────────
# ROUTES
# ──────────────────────────────────────────────────────────────────────────────

router = APIRouter(prefix="/supplier", tags=["supplier"])


# ── VETTING ───────────────────────────────────────────────────────────────────

@router.post("/{supplier_id}/vetting")
async def update_vetting_checklist(
    supplier_id: str,
    vetting: VettingChecklistUpdate,
) -> Dict[str, Any]:
    """Update supplier vetting checklist"""
    supplier = get_or_create_supplier(supplier_id)

    checklist = {
        'supplierId': supplier_id,
        'supplierName': vetting.supplierName,
        'product': vetting.product,
        'businessRegistered': vetting.businessRegistered or False,
        'licenseProvided': vetting.licenseProvided or False,
        'tradeAssuranceEnabled': vetting.tradeAssuranceEnabled or False,
        'yearsInBusiness': vetting.yearsInBusiness,
        'sampleRequested': vetting.sampleRequested or False,
        'qualificationsCertifications': vetting.qualificationsCertifications or [],
        'referenceCustomerContact': vetting.referenceCustomerContact or False,
        'factoryVisitCompleted': vetting.factoryVisitCompleted or False,
        'ndaSigned': vetting.ndaSigned or False,
        'vettingDate': datetime.utcnow().isoformat(),
    }

    # Calculate risk
    checks = [
        vetting.businessRegistered,
        vetting.licenseProvided,
        vetting.tradeAssuranceEnabled,
        vetting.sampleRequested,
        vetting.referenceCustomerContact,
        vetting.factoryVisitCompleted,
        vetting.ndaSigned,
    ]
    passed = sum(1 for c in checks if c)
    total = len(checks)
    pass_rate = passed / total if total > 0 else 0

    checklist['overallRisk'] = 'low' if pass_rate >= 0.8 else 'medium' if pass_rate >= 0.5 else 'high'
    checklist['vettingStatus'] = 'passed' if pass_rate == 1 else 'in_progress' if pass_rate >= 0.5 else 'not_started'

    supplier['vetting'] = checklist
    return {'success': True, 'vetting': checklist}


@router.get("/{supplier_id}/vetting")
async def get_vetting_checklist(supplier_id: str) -> Dict[str, Any]:
    """Get supplier vetting checklist"""
    supplier = get_or_create_supplier(supplier_id)
    if not supplier.get('vetting'):
        raise HTTPException(status_code=404, detail="Vetting not found")
    return {'vetting': supplier['vetting']}


# ── COMMUNICATION ─────────────────────────────────────────────────────────────

@router.post("/{supplier_id}/communication")
async def add_communication_message(
    supplier_id: str,
    message: SupplierMessage,
) -> Dict[str, Any]:
    """Add message to communication history"""
    supplier = get_or_create_supplier(supplier_id)

    msg = {
        'id': f"msg_{datetime.utcnow().timestamp()}",
        'supplierId': supplier_id,
        'timestamp': datetime.utcnow().isoformat(),
        'direction': message.direction,
        'type': message.type,
        'subject': message.subject,
        'body': message.body,
        'attachments': message.attachments or [],
        'tags': message.tags or [],
    }

    supplier['communication'].append(msg)

    # Update status based on latest message
    status = 'initial_inquiry'
    if any(t == 'quote_received' for m in supplier['communication'] for t in m.get('tags', [])):
        status = 'quote_received'
    elif any(t == 'negotiation' for m in supplier['communication'] for t in m.get('tags', [])):
        status = 'negotiating'
    elif any(t == 'sample_request' for m in supplier['communication'] for t in m.get('tags', [])):
        status = 'awaiting_quote'

    return {'success': True, 'message': msg, 'communication_status': status}


@router.get("/{supplier_id}/communication")
async def get_communication_history(supplier_id: str) -> Dict[str, Any]:
    """Get communication history for supplier"""
    supplier = get_or_create_supplier(supplier_id)
    messages = supplier.get('communication', [])
    return {
        'supplierId': supplier_id,
        'messages': messages,
        'totalMessages': len(messages),
        'lastContact': messages[-1]['timestamp'] if messages else None,
    }


# ── SAMPLES ───────────────────────────────────────────────────────────────────

@router.post("/{supplier_id}/samples")
async def request_sample(
    supplier_id: str,
    sample: SampleRequest,
) -> Dict[str, Any]:
    """Request sample from supplier"""
    supplier = get_or_create_supplier(supplier_id)

    sample_record = {
        'id': f"sample_{datetime.utcnow().timestamp()}",
        'supplierId': supplier_id,
        'supplierName': sample.supplierName,
        'productName': sample.productName,
        'dateRequested': sample.dateRequested,
        'quantity': sample.quantity,
        'cost': sample.cost,
        'status': 'requested',
        'decision': 'pending',
        'trackingNumber': sample.trackingNumber,
    }

    supplier['samples'].append(sample_record)
    return {'success': True, 'sample': sample_record}


@router.put("/{supplier_id}/samples/{sample_id}")
async def update_sample(
    supplier_id: str,
    sample_id: str,
    update: SampleUpdate,
) -> Dict[str, Any]:
    """Update sample status and details"""
    supplier = get_or_create_supplier(supplier_id)
    samples = supplier.get('samples', [])

    sample = next((s for s in samples if s['id'] == sample_id), None)
    if not sample:
        raise HTTPException(status_code=404, detail="Sample not found")

    if update.status:
        sample['status'] = update.status
    if update.actualArrivalDate:
        sample['actualArrivalDate'] = update.actualArrivalDate
    if update.qualityRating is not None:
        sample['qualityRating'] = update.qualityRating
    if update.qualityNotes:
        sample['qualityNotes'] = update.qualityNotes
    if update.issues:
        sample['issues'] = update.issues
    if update.decision:
        sample['decision'] = update.decision
    if update.decisionNote:
        sample['decisionNote'] = update.decisionNote

    return {'success': True, 'sample': sample}


@router.get("/{supplier_id}/samples")
async def get_samples(supplier_id: str) -> Dict[str, Any]:
    """Get all samples for supplier"""
    supplier = get_or_create_supplier(supplier_id)
    return {
        'supplierId': supplier_id,
        'samples': supplier.get('samples', []),
        'totalSamples': len(supplier.get('samples', [])),
    }


# ── RATINGS ───────────────────────────────────────────────────────────────────

@router.post("/{supplier_id}/rating")
async def rate_supplier(
    supplier_id: str,
    rating: SupplierRatingSubmit,
) -> Dict[str, Any]:
    """Submit rating for supplier"""
    supplier = get_or_create_supplier(supplier_id)

    rating_record = {
        'supplierId': supplier_id,
        'productName': rating.productName,
        'overallRating': rating.overallRating,
        'communicationRating': rating.communicationRating,
        'qualityRating': rating.qualityRating,
        'reliabilityRating': rating.reliabilityRating,
        'valueForMoneyRating': rating.valueForMoneyRating,
        'personalNotes': rating.personalNotes,
        'pros': rating.pros,
        'cons': rating.cons,
        'wouldRecommend': rating.wouldRecommend,
        'dateRated': datetime.utcnow().isoformat(),
    }

    supplier['rating'] = rating_record
    return {'success': True, 'rating': rating_record}


@router.get("/{supplier_id}/rating")
async def get_supplier_rating(supplier_id: str) -> Dict[str, Any]:
    """Get rating for supplier"""
    supplier = get_or_create_supplier(supplier_id)
    if not supplier.get('rating'):
        raise HTTPException(status_code=404, detail="Rating not found")
    return {'rating': supplier['rating']}


# ── LEAD TIMES ────────────────────────────────────────────────────────────────

@router.post("/{supplier_id}/leadtimes")
async def record_lead_time(
    supplier_id: str,
    record: LeadTimeRecord,
) -> Dict[str, Any]:
    """Record lead time for supplier"""
    supplier = get_or_create_supplier(supplier_id)

    lead_time = {
        'id': f"leadtime_{datetime.utcnow().timestamp()}",
        'supplierId': supplier_id,
        'productName': record.productName,
        'requestedLeadTime': record.requestedLeadTime,
        'promisedLeadTime': record.promisedLeadTime,
        'orderDate': record.orderDate,
        'deliveryDate': record.deliveryDate,
        'delayReason': record.delayReason,
        'seasonalFactor': record.seasonalFactor,
        'reliable': record.reliable,
    }

    if record.deliveryDate and record.orderDate:
        from datetime import datetime as dt
        order = dt.fromisoformat(record.orderDate)
        delivery = dt.fromisoformat(record.deliveryDate)
        lead_time['actualLeadTime'] = (delivery - order).days

    supplier['leadTimes'].append(lead_time)
    return {'success': True, 'leadTime': lead_time}


@router.get("/{supplier_id}/leadtimes")
async def get_lead_times(supplier_id: str) -> Dict[str, Any]:
    """Get lead time history for supplier"""
    supplier = get_or_create_supplier(supplier_id)
    records = supplier.get('leadTimes', [])

    # Calculate average actual lead time
    actual_times = [r.get('actualLeadTime') for r in records if r.get('actualLeadTime')]
    avg_actual = sum(actual_times) / len(actual_times) if actual_times else None

    # Calculate reliability
    reliability_score = 0
    if records:
        on_time = sum(1 for r in records if r.get('actualLeadTime', 999) <= r['promisedLeadTime'])
        reliability_score = (on_time / len(records)) * 100

    return {
        'supplierId': supplier_id,
        'records': records,
        'averageActualLeadTime': avg_actual,
        'reliabilityScore': reliability_score,
    }


# ── NEGOTIATIONS ──────────────────────────────────────────────────────────────

@router.post("/{supplier_id}/terms")
async def save_negotiated_terms(
    supplier_id: str,
    terms: NegotiatedTermsSubmit,
) -> Dict[str, Any]:
    """Save negotiated terms with supplier"""
    supplier = get_or_create_supplier(supplier_id)

    terms_record = {
        'supplierId': supplier_id,
        'productName': terms.productName,
        'negotiationStatus': terms.negotiationStatus,
        'agreedPricePerUnit': terms.agreedPricePerUnit,
        'originalAskedPrice': terms.originalAskedPrice,
        'discountPercentage': (
            ((terms.originalAskedPrice - terms.agreedPricePerUnit) / terms.originalAskedPrice * 100)
            if terms.originalAskedPrice else None
        ),
        'moq': terms.moq,
        'bulkPricingTiers': [t.dict() for t in terms.bulkPricingTiers] if terms.bulkPricingTiers else None,
        'leadTimeDays': terms.leadTimeDays,
        'earliestShipDate': terms.earliestShipDate,
        'qualityStandards': terms.qualityStandards,
        'inspectionRequired': terms.inspectionRequired,
        'certifications': terms.certifications,
        'paymentTerms': terms.paymentTerms,
        'depositPercentage': terms.depositPercentage,
        'sampleFree': terms.sampleFree,
        'minimumOrderValue': terms.minimumOrderValue,
        'shippingTerms': terms.shippingTerms,
        'warranty': terms.warranty,
        'returnPolicy': terms.returnPolicy,
        'contractSigned': terms.contractSigned,
        'ndaSigned': terms.ndaSigned,
        'specialConditions': terms.specialConditions,
        'nextSteps': terms.nextSteps,
        'dateAgreed': datetime.utcnow().isoformat(),
    }

    supplier['negotiatedTerms'] = terms_record
    return {'success': True, 'terms': terms_record}


@router.get("/{supplier_id}/terms")
async def get_negotiated_terms(supplier_id: str) -> Dict[str, Any]:
    """Get negotiated terms for supplier"""
    supplier = get_or_create_supplier(supplier_id)
    if not supplier.get('negotiatedTerms'):
        raise HTTPException(status_code=404, detail="Terms not found")
    return {'terms': supplier['negotiatedTerms']}


# ── SUPPLIER PROFILE ──────────────────────────────────────────────────────────

@router.get("/{supplier_id}/profile")
async def get_supplier_profile(supplier_id: str) -> Dict[str, Any]:
    """Get complete supplier profile"""
    supplier = get_or_create_supplier(supplier_id)

    return {
        'supplierId': supplier_id,
        'profile': supplier.get('profile'),
        'vetting': supplier.get('vetting'),
        'communication': supplier.get('communication'),
        'samples': supplier.get('samples'),
        'rating': supplier.get('rating'),
        'leadTimes': supplier.get('leadTimes'),
        'negotiatedTerms': supplier.get('negotiatedTerms'),
        'lastUpdated': datetime.utcnow().isoformat(),
    }


@router.put("/{supplier_id}/profile")
async def update_supplier_profile(
    supplier_id: str,
    update: SupplierProfileUpdate,
) -> Dict[str, Any]:
    """Update supplier profile"""
    supplier = get_or_create_supplier(supplier_id)

    if update.status:
        supplier['profile']['status'] = update.status
    if update.notes:
        supplier['profile']['notes'] = update.notes

    supplier['profile']['lastUpdated'] = datetime.utcnow().isoformat()

    return {'success': True, 'profile': supplier['profile']}


# ── COMPARISONS ───────────────────────────────────────────────────────────────

@router.post("/comparison")
async def create_comparison(request: SupplierComparisonRequest) -> Dict[str, Any]:
    """Create comparison between suppliers"""
    suppliers = []
    metrics = {}

    for supplier_id in [request.supplierId1, request.supplierId2, request.supplierId3]:
        if not supplier_id:
            continue

        supplier = get_or_create_supplier(supplier_id)
        suppliers.append(supplier_id)

        # Extract metrics
        terms = supplier.get('negotiatedTerms')
        rating = supplier.get('rating')
        lead_times = supplier.get('leadTimes', [])

        avg_lead_time = None
        if lead_times:
            actual_times = [r.get('actualLeadTime', r['promisedLeadTime']) for r in lead_times]
            avg_lead_time = sum(actual_times) / len(actual_times)

        metrics[supplier_id] = {
            'pricePerUnit': terms['agreedPricePerUnit'] if terms else 0,
            'moq': terms['moq'] if terms else 0,
            'leadTimeDays': avg_lead_time or (terms['leadTimeDays'] if terms else 0),
            'qualityRating': rating['qualityRating'] if rating else 0,
            'trustScore': rating['overallRating'] if rating else 0,
            'reliabilityRating': rating['reliabilityRating'] if rating else 0,
        }

    # Simple scoring: weighted average
    comparison = {
        'productName': request.productName,
        'suppliersComparing': suppliers,
        'metrics': metrics,
        'createdAt': datetime.utcnow().isoformat(),
        'updatedAt': datetime.utcnow().isoformat(),
    }

    # Find winner
    if suppliers:
        scores = {}
        for supplier_id in suppliers:
            m = metrics[supplier_id]
            price_score = 100 - min(m['pricePerUnit'] / 10 * 100, 100)  # Lower price = higher score
            moq_score = 100 - min(m['moq'] / 1000 * 100, 100)  # Lower MOQ = higher score
            lead_score = 100 - min(m['leadTimeDays'] / 100 * 100, 100)  # Shorter lead = higher score
            quality_score = m['qualityRating'] * 20  # 1-5 → 0-100
            trust_score = m['trustScore'] * 20
            reliability_score = m['reliabilityRating'] * 20

            weighted = (price_score * 0.25 + moq_score * 0.15 + lead_score * 0.15 +
                       quality_score * 0.15 + trust_score * 0.15 + reliability_score * 0.15)
            scores[supplier_id] = weighted

        winner = max(scores, key=scores.get)
        comparison['winner'] = winner
        comparison['winnerScore'] = scores[winner]

    return {'success': True, 'comparison': comparison}


@router.get("/{supplier_id}/all")
async def get_all_supplier_data(supplier_id: str) -> Dict[str, Any]:
    """Get all data for a supplier (for export/vault)"""
    supplier = get_or_create_supplier(supplier_id)
    return {
        'supplierId': supplier_id,
        'data': supplier,
        'exportDate': datetime.utcnow().isoformat(),
    }


@router.delete("/{supplier_id}")
async def delete_supplier(supplier_id: str) -> Dict[str, Any]:
    """Delete supplier and all associated data"""
    if supplier_id in supplier_database:
        del supplier_database[supplier_id]
        return {'success': True, 'message': f'Supplier {supplier_id} deleted'}
    return {'success': False, 'message': 'Supplier not found'}
