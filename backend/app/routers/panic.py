"""
Manual in-call panic button (team scope discussion, item A -- HIGH
priority). Independent of the automatic risk-detection path: the user
decides they're suspicious and jumps straight into the same PAUSE + VERIFY
flow, without needing the risk engine to agree first.

This still goes through the same frozen verification layer (start_tier1)
as the automatic path -- it's a different way to reach PAUSE, not a
different verification mechanism.
"""
import uuid

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.audit import log as audit_log
from app.auth import get_current_requester
from app.database import get_db
from app.enums import Decision, RequestStatus, RiskLevel
from app.models import Request, Requester, TrustedContact
from app.routers.analyze import _to_out
from app.schemas import AnalyzeRequestOut, PanicIn
from app.verification_service import start_tier1

router = APIRouter()


@router.post("/panic", response_model=AnalyzeRequestOut)
async def panic(
    body: PanicIn,
    db: Session = Depends(get_db),
    requester: Requester = Depends(get_current_requester),
):
    request_id = body.request_id or f"req_panic_{uuid.uuid4().hex[:8]}"

    existing = db.query(Request).filter(Request.request_id == request_id).first()
    if existing:
        # Same idempotency contract as /analyze-request: never silently
        # spin up a second active request for an id already in play.
        return _to_out(existing)

    req = Request(
        request_id=request_id,
        requester_id=requester.requester_id,
        action_type="wallet_transfer",
        channel="voice_call",
        claimed_identity=None,
        input_type="TEXT",
        transcript_or_text=body.note or "User manually triggered the panic button during a call they're suspicious of.",
        risk_score=100,
        risk_level=RiskLevel.HIGH.value,
        decision=Decision.PAUSE.value,
        reason_codes=["manual_panic_trigger"],
        verification_required=True,
        request_status=RequestStatus.STAYS_PAUSED.value,
        triggered_by_panic=True,
    )
    db.add(req)
    db.flush()
    audit_log(db, req.request_id, "REQUEST_RECEIVED", {"channel": "voice_call", "source": "panic_button"})
    audit_log(db, req.request_id, "PANIC_TRIGGERED", {"note": body.note})
    audit_log(db, req.request_id, "ACTION_PAUSED", {})
    db.commit()

    primary = db.query(TrustedContact).filter(
        TrustedContact.requester_id == requester.requester_id,
        TrustedContact.contact_type == "PRIMARY",
    ).first()
    if not primary:
        raise HTTPException(status_code=409, detail={"error": {
            "code": "WRONG_TIER_STATE", "message": "No primary trusted contact is registered for this requester."}})

    await start_tier1(db, req, f"ver_{uuid.uuid4().hex[:8]}", primary.contact_id)

    db.refresh(req)
    return _to_out(req)
