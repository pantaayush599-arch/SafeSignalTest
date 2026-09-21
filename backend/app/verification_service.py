"""
Core verification/escalation/state-machine logic shared by the /verify/*
routers, the auto-escalation triggered from /analyze-request, and the
background timeout sweeper. Centralizing this avoids the routers
re-implementing tier-transition rules differently.

State machine (request_status): PENDING -> VERIFIED | STAYS-PAUSED ->
  VERIFIED | TIMED-OUT | MANUAL-OVERRIDE. VERIFIED, TIMED-OUT and
  MANUAL-OVERRIDE are all terminal for a given request.
"""
import hashlib
import os
import secrets
from datetime import datetime, timedelta

from sqlalchemy.orm import Session

from app import config
from app.audit import log as audit_log
from app.enums import RequestStatus, VerificationStatus, EscalationReason
from app.models import Request, Verification, TrustedContact
from app.ws_manager import manager


def _now():
    return datetime.utcnow()  # naive UTC; see models.now_utc() for why


def _hash_code(code: str, salt: str) -> str:
    return hashlib.sha256((salt + code).encode("utf-8")).hexdigest()


async def start_tier1(db: Session, request: Request, verification_id: str, trusted_contact_id: str):
    contact = db.query(TrustedContact).filter(
        TrustedContact.contact_id == trusted_contact_id,
        TrustedContact.requester_id == request.requester_id,
    ).first()
    if not contact:
        raise ValueError("trusted_contact_id does not belong to this requester")

    v = Verification(
        verification_id=verification_id,
        request_id=request.request_id,
        tier=1,
        status=VerificationStatus.PENDING.value,
        trusted_contact_id=contact.contact_id,
        sent_at=_now(),
        expires_at=_now() + timedelta(seconds=config.TIER1_EXPIRY_SECONDS),
    )
    db.add(v)
    request.current_tier = 1
    db.flush()
    audit_log(db, request.request_id, "TIER1_STARTED", {"trusted_contact_id": contact.contact_id})
    db.commit()
    await manager.broadcast(request.request_id, "VERIFICATION_UPDATED", request.request_status,
                             {"tier": 1, "verification_status": v.status, "verification_id": v.verification_id})
    return v


async def start_tier2(db: Session, request: Request, verification_id: str, escalation_reason: str):
    secondary = db.query(TrustedContact).filter(
        TrustedContact.requester_id == request.requester_id,
        TrustedContact.contact_type == "SECONDARY",
    ).first()

    v = Verification(
        verification_id=verification_id,
        request_id=request.request_id,
        tier=2,
        status=VerificationStatus.PENDING.value,
        secondary_contact_id=secondary.contact_id if secondary else None,
        escalation_reason=escalation_reason,
        callback_number=secondary.phone_number if secondary else None,
        sent_at=_now(),
        expires_at=_now() + timedelta(seconds=config.TIER2_EXPIRY_SECONDS),
    )
    db.add(v)
    request.current_tier = 2
    db.flush()
    audit_log(db, request.request_id, "TIER2_STARTED", {"escalation_reason": escalation_reason,
                                                          "secondary_contact_id": v.secondary_contact_id})
    db.commit()
    await manager.broadcast(request.request_id, "VERIFICATION_UPDATED", request.request_status,
                             {"tier": 2, "verification_status": v.status, "verification_id": v.verification_id,
                              "escalation_reason": escalation_reason})
    return v


async def start_tier3(db: Session, request: Request, verification_id: str):
    code = f"{secrets.randbelow(1_000_000):06d}"
    salt = secrets.token_hex(16)

    # Tier 3 is the last resort after both Tier 1 and Tier 2 failed to
    # resolve over their normal channel. The rotating code still needs a
    # human to relay it through an independent channel (a phone call), so
    # it is surfaced to the requester's primary trusted contact -- reusing
    # trusted_contact_id so it naturally appears in that contact's inbox
    # alongside their Tier 1 history. Not specified by the contract; a
    # reasonable interpretation given "a channel the caller does not
    # control" (presentation deck) and no dedicated Tier 3 delivery channel
    # in the source documents.
    primary = db.query(TrustedContact).filter(
        TrustedContact.requester_id == request.requester_id,
        TrustedContact.contact_type == "PRIMARY",
    ).first()

    v = Verification(
        verification_id=verification_id,
        request_id=request.request_id,
        tier=3,
        status=VerificationStatus.PENDING.value,
        trusted_contact_id=primary.contact_id if primary else None,
        code_hash=_hash_code(code, salt),
        code_salt=salt,
        # DEMO-ONLY addition, not part of the frozen contract: in production
        # this code is delivered out-of-band (SMS/voice) to whichever
        # channel the team decides; the prototype has no SMS/telephony
        # integration, so the plaintext is surfaced here once so the demo
        # is actually operable end-to-end. This is an additive field, not a
        # modification of any existing contract field.
        demo_code=code,
        attempts_remaining=config.TIER3_MAX_ATTEMPTS,
        sent_at=_now(),
        expires_at=_now() + timedelta(seconds=config.TIER3_EXPIRY_SECONDS),
    )
    db.add(v)
    request.current_tier = 3
    db.flush()
    audit_log(db, request.request_id, "TIER3_STARTED", {})
    db.commit()
    await manager.broadcast(request.request_id, "VERIFICATION_UPDATED", request.request_status,
                             {"tier": 3, "verification_status": v.status, "verification_id": v.verification_id})
    return v


async def mark_verified(db: Session, request: Request, event: str):
    request.request_status = RequestStatus.VERIFIED.value
    db.flush()
    audit_log(db, request.request_id, event, {})
    audit_log(db, request.request_id, "ACTION_UNLOCKED", {})
    db.commit()
    await manager.broadcast(request.request_id, "STATUS_CHANGED", request.request_status)


async def escalate_or_timeout(db: Session, request: Request, from_tier: int, reason: str):
    """Called after a tier ends in REJECTED/TIMED_OUT. Moves to the next
    tier, or to a final TIMED-OUT if Tier 3 was the last resort."""
    import uuid
    if from_tier == 1:
        v = await start_tier2(db, request, f"ver_{uuid.uuid4().hex[:8]}", reason)
        return v
    if from_tier == 2:
        v = await start_tier3(db, request, f"ver_{uuid.uuid4().hex[:8]}")
        return v
    # Tier 3 exhausted / expired / rejected with no further tier available.
    request.request_status = RequestStatus.TIMED_OUT.value
    db.flush()
    audit_log(db, request.request_id, "REQUEST_TIMED_OUT", {"reason": reason})
    db.commit()
    await manager.broadcast(request.request_id, "STATUS_CHANGED", request.request_status)
    return None


_TIMEOUT_EVENT = {1: "TIER1_TIMEOUT", 2: "TIER2_TIMEOUT", 3: "TIER3_EXPIRED"}
_TIMEOUT_REASON = {
    1: EscalationReason.TIER1_TIMEOUT.value,
    2: EscalationReason.TIER2_TIMEOUT.value,
    3: "TIER3_EXPIRED",
}


async def sweep_timeouts(db: Session):
    """Background sweeper: finds any PENDING verification (tier 1, 2 or 3)
    whose expiry has passed with no response, marks it TIMED_OUT, and
    escalates (or, for tier 3, finalizes the request as TIMED-OUT). This
    runs even if the frontend never polls/submits again, so the WS pushes a
    live update the moment a window lapses."""
    now = _now()
    pending = db.query(Verification).filter(
        Verification.status == VerificationStatus.PENDING.value,
        Verification.tier.in_([1, 2, 3]),
        Verification.expires_at <= now,
    ).all()

    for v in pending:
        request = db.query(Request).filter(Request.request_id == v.request_id).first()
        if not request or request.request_status != RequestStatus.STAYS_PAUSED.value:
            continue
        v.status = VerificationStatus.TIMED_OUT.value
        db.flush()
        audit_log(db, request.request_id, _TIMEOUT_EVENT[v.tier], {})
        db.commit()
        await manager.broadcast(request.request_id, "VERIFICATION_UPDATED", request.request_status,
                                 {"tier": v.tier, "verification_status": v.status, "verification_id": v.verification_id})
        await escalate_or_timeout(db, request, v.tier, _TIMEOUT_REASON[v.tier])
