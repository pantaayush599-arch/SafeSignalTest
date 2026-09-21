import uuid
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.auth import get_current_requester, get_current_contact
from app.audit import log as audit_log
from app.database import get_db
from app.enums import RequestStatus, VerificationStatus
from app.models import Request, Verification, TrustedContact, Requester
from app.schemas import (
    Tier1StartIn, Tier2StartIn, Tier3StartIn, Tier3StartOut,
    VerificationOut, VerifyRespondIn, VerifyRespondOut,
    Tier3SubmitIn, Tier3SubmitOut,
)
from app.verification_service import (
    start_tier1, start_tier2, start_tier3, mark_verified, escalate_or_timeout, _hash_code,
)

router = APIRouter()


def _get_request_owned_by(db: Session, request_id: str, requester: Requester) -> Request:
    req = db.query(Request).filter(Request.request_id == request_id).first()
    if not req:
        raise HTTPException(status_code=404, detail={"error": {"code": "REQUEST_NOT_FOUND", "message": "No request with this id.", "request_id": request_id}})
    if req.requester_id != requester.requester_id:
        raise HTTPException(status_code=403, detail={"error": {"code": "FORBIDDEN", "message": "Not your request."}})
    return req


def _to_verification_out(v: Verification) -> VerificationOut:
    return VerificationOut(
        verification_id=v.verification_id, request_id=v.request_id, tier=v.tier,
        status=v.status, sent_at=v.sent_at, responded_at=v.responded_at, expires_at=v.expires_at,
    )


# ------------------------------------------------------------------ Tier 1
@router.post("/verify/tier1", response_model=VerificationOut)
async def verify_tier1(body: Tier1StartIn, db: Session = Depends(get_db), requester: Requester = Depends(get_current_requester)):
    req = _get_request_owned_by(db, body.request_id, requester)
    existing = db.query(Verification).filter(
        Verification.request_id == req.request_id, Verification.tier == 1,
        Verification.status == VerificationStatus.PENDING.value,
    ).first()
    if existing:
        return _to_verification_out(existing)
    v = await start_tier1(db, req, body.verification_id, body.trusted_contact_id)
    return _to_verification_out(v)


@router.post("/verify/tier1/respond", response_model=VerifyRespondOut)
async def verify_tier1_respond(body: VerifyRespondIn, db: Session = Depends(get_db), contact: TrustedContact = Depends(get_current_contact)):
    return await _respond(db, body, tier=1, contact=contact)


# ------------------------------------------------------------------ Tier 2
@router.post("/verify/tier2", response_model=VerificationOut)
async def verify_tier2(body: Tier2StartIn, db: Session = Depends(get_db), requester: Requester = Depends(get_current_requester)):
    req = _get_request_owned_by(db, body.request_id, requester)
    existing = db.query(Verification).filter(
        Verification.request_id == req.request_id, Verification.tier == 2,
        Verification.status == VerificationStatus.PENDING.value,
    ).first()
    if existing:
        return _to_verification_out(existing)
    v = await start_tier2(db, req, body.verification_id, body.escalation_reason)
    return _to_verification_out(v)


@router.post("/verify/tier2/respond", response_model=VerifyRespondOut)
async def verify_tier2_respond(body: VerifyRespondIn, db: Session = Depends(get_db), contact: TrustedContact = Depends(get_current_contact)):
    return await _respond(db, body, tier=2, contact=contact)


async def _respond(db: Session, body: VerifyRespondIn, tier: int, contact: TrustedContact) -> VerifyRespondOut:
    v = db.query(Verification).filter(Verification.verification_id == body.verification_id, Verification.tier == tier).first()
    if not v:
        raise HTTPException(status_code=404, detail={"error": {"code": "VERIFICATION_NOT_FOUND", "message": "No such verification."}})

    assigned_id = v.trusted_contact_id if tier == 1 else v.secondary_contact_id
    if assigned_id != contact.contact_id:
        raise HTTPException(status_code=403, detail={"error": {
            "code": "FORBIDDEN", "message": "This verification is not assigned to you."}})

    if v.status != VerificationStatus.PENDING.value:
        raise HTTPException(status_code=409, detail={"error": {
            "code": "WRONG_TIER_STATE", "message": f"Verification already {v.status}."}})

    if body.response not in ("CONFIRMED", "REJECTED"):
        raise HTTPException(status_code=400, detail={"error": {"code": "INVALID_INPUT", "message": "response must be CONFIRMED or REJECTED."}})

    request = db.query(Request).filter(Request.request_id == v.request_id).first()
    now = datetime.utcnow()
    v.responded_at = now

    if body.response == "CONFIRMED":
        v.status = VerificationStatus.CONFIRMED.value
        db.flush()
        db.commit()
        event = "TIER1_CONFIRMED" if tier == 1 else "TIER2_CONFIRMED"
        await mark_verified(db, request, event)
    else:
        v.status = VerificationStatus.REJECTED.value
        db.flush()
        event = "TIER1_REJECTED" if tier == 1 else "TIER2_REJECTED"
        audit_log(db, request.request_id, event, {})
        db.commit()
        reason = "TIER1_REJECTED" if tier == 1 else "TIER2_REJECTED"
        await escalate_or_timeout(db, request, tier, reason)

    db.refresh(v)
    db.refresh(request)
    return VerifyRespondOut(
        verification_id=v.verification_id, request_id=v.request_id, tier=v.tier,
        status=v.status, request_status=request.request_status, responded_at=v.responded_at,
    )


# ------------------------------------------------------------------ Tier 3
@router.post("/verify/tier3", response_model=Tier3StartOut)
async def verify_tier3(body: Tier3StartIn, db: Session = Depends(get_db), requester: Requester = Depends(get_current_requester)):
    req = _get_request_owned_by(db, body.request_id, requester)
    existing = db.query(Verification).filter(
        Verification.request_id == req.request_id, Verification.tier == 3,
        Verification.status == VerificationStatus.PENDING.value,
    ).first()
    v = existing or await start_tier3(db, req, body.verification_id)
    return Tier3StartOut(
        verification_id=v.verification_id, request_id=v.request_id, tier=3,
        status=v.status, expires_at=v.expires_at, attempts_remaining=v.attempts_remaining,
        demo_code=v.demo_code,
    )


@router.post("/verify/tier3/submit", response_model=Tier3SubmitOut)
async def verify_tier3_submit(body: Tier3SubmitIn, db: Session = Depends(get_db), requester: Requester = Depends(get_current_requester)):
    v = db.query(Verification).filter(Verification.verification_id == body.verification_id, Verification.tier == 3).first()
    if not v:
        raise HTTPException(status_code=404, detail={"error": {"code": "VERIFICATION_NOT_FOUND", "message": "No such verification."}})

    request = db.query(Request).filter(Request.request_id == v.request_id).first()
    if request.requester_id != requester.requester_id:
        raise HTTPException(status_code=403, detail={"error": {"code": "FORBIDDEN", "message": "Not your request."}})

    # Attempts-exhausted takes priority over the generic "wrong state" 409
    # so a caller who keeps retrying after exhaustion consistently gets 429
    # (the contract's own "Max attempts -> HTTP 429"), not a generic 409.
    if v.attempts_remaining is not None and v.attempts_remaining <= 0:
        raise HTTPException(status_code=429, detail={"error": {
            "code": "MAX_ATTEMPTS_EXCEEDED", "message": "Maximum verification attempts exceeded.", "request_id": request.request_id}})

    if v.status != VerificationStatus.PENDING.value:
        raise HTTPException(status_code=409, detail={"error": {"code": "WRONG_TIER_STATE", "message": f"Verification already {v.status}."}})

    now = datetime.utcnow()
    if now > v.expires_at:
        v.status = VerificationStatus.TIMED_OUT.value
        db.flush()
        audit_log(db, request.request_id, "TIER3_EXPIRED", {})
        db.commit()
        await escalate_or_timeout(db, request, 3, "TIER3_EXPIRED")
        raise HTTPException(status_code=410, detail={"error": {
            "code": "VERIFICATION_EXPIRED", "message": "This verification request has expired.", "request_id": request.request_id}})

    if _hash_code(body.code, v.code_salt) == v.code_hash:
        v.status = VerificationStatus.CONFIRMED.value
        v.responded_at = now
        db.flush()
        db.commit()
        await mark_verified(db, request, "TIER3_CONFIRMED")
        db.refresh(v)
        return Tier3SubmitOut(verification_id=v.verification_id, request_id=v.request_id, tier=3,
                               status=v.status, request_status=request.request_status)

    # wrong code
    v.attempts_remaining = (v.attempts_remaining or 1) - 1
    db.flush()
    audit_log(db, request.request_id, "TIER3_WRONG_CODE", {"attempts_remaining": v.attempts_remaining})

    if v.attempts_remaining <= 0:
        # Verification stays PENDING (no EXHAUSTED value exists in the
        # shared VerificationStatus enum); attempts_remaining==0 is itself
        # the gate that gives further submits 429 above. The overall
        # REQUEST is what finalizes to TIMED-OUT, since Tier 3 was the
        # last resort.
        audit_log(db, request.request_id, "TIER3_ATTEMPTS_EXHAUSTED", {})
        db.commit()
        await escalate_or_timeout(db, request, 3, "TIER3_ATTEMPTS_EXHAUSTED")
    else:
        db.commit()

    db.refresh(v)
    return Tier3SubmitOut(verification_id=v.verification_id, request_id=v.request_id, tier=3,
                           status=v.status, attempts_remaining=v.attempts_remaining)
