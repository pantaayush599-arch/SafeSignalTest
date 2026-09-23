from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, WebSocket, WebSocketDisconnect
from sqlalchemy.orm import Session

from app.auth import get_current_identity, get_current_requester
from app.audit import log as audit_log
from app.database import get_db
from app import database
from app.enums import RequestStatus
from app.models import Request, TrustedContact, Requester
from app.schemas import (
    RequestStateOut, ManualOverrideIn, ManualOverrideOut, AuditTrailOut, AuditEventOut,
    VerificationSummary, ContactInboxItem, DashboardOut, DashboardEntry,
)
from app.auth import get_current_contact
from app.ws_manager import manager

router = APIRouter()


def _owns_request(identity, request: Request) -> bool:
    kind, obj = identity
    if kind == "requester":
        return obj.requester_id == request.requester_id
    # trusted contact: must be assigned to at least one verification on this request
    return any(v.trusted_contact_id == obj.contact_id or v.secondary_contact_id == obj.contact_id
               for v in request.verifications)


def _get_owned_request(db: Session, request_id: str, identity) -> Request:
    req = db.query(Request).filter(Request.request_id == request_id).first()
    if not req:
        raise HTTPException(status_code=404, detail={"error": {
            "code": "REQUEST_NOT_FOUND", "message": "No request with this id.", "request_id": request_id}})
    if not _owns_request(identity, req):
        raise HTTPException(status_code=403, detail={"error": {
            "code": "FORBIDDEN", "message": "You do not have access to this request."}})
    return req


@router.get("/requests/{request_id}", response_model=RequestStateOut)
def get_request(request_id: str, db: Session = Depends(get_db), identity=Depends(get_current_identity)):
    req = _get_owned_request(db, request_id, identity)
    return RequestStateOut(
        request_id=req.request_id,
        risk_score=req.risk_score,
        risk_level=req.risk_level,
        decision=req.decision,
        reason_codes=req.reason_codes or [],
        transcript_or_text=req.transcript_or_text,
        amount=req.amount,
        claimed_identity=req.claimed_identity,
        channel=req.channel,
        verification_required=req.verification_required,
        request_status=req.request_status,
        current_tier=req.current_tier,
        override_reason=req.override_reason,
        override_at=req.override_at,
        created_at=req.created_at,
        verifications=[
            VerificationSummary(
                verification_id=v.verification_id, tier=v.tier, status=v.status,
                sent_at=v.sent_at, expires_at=v.expires_at, responded_at=v.responded_at,
            ) for v in req.verifications
        ],
    )


@router.get("/contacts/{contact_id}/inbox", response_model=list[ContactInboxItem])
def contact_inbox(contact_id: str, db: Session = Depends(get_db), contact: TrustedContact = Depends(get_current_contact)):
    """DEMO-ADDITIVE endpoint (see routers/demo.py note): lets a trusted
    contact discover verifications assigned to them without needing to
    already know a request_id out of band. Not part of the frozen
    contract; purely additive."""
    if contact_id != contact.contact_id:
        raise HTTPException(status_code=403, detail={"error": {"code": "FORBIDDEN", "message": "Cannot view another contact's inbox."}})

    from app.models import Verification
    items = db.query(Verification).filter(
        (Verification.trusted_contact_id == contact_id) | (Verification.secondary_contact_id == contact_id)
    ).order_by(Verification.sent_at.desc()).all()

    out = []
    for v in items:
        req = db.query(Request).filter(Request.request_id == v.request_id).first()
        if not req:
            continue
        out.append(ContactInboxItem(
            verification_id=v.verification_id, request_id=v.request_id, tier=v.tier, status=v.status,
            sent_at=v.sent_at, expires_at=v.expires_at, escalation_reason=v.escalation_reason,
            demo_code=v.demo_code if v.tier == 3 else None,
            request_status=req.request_status, claimed_identity=req.claimed_identity, amount=req.amount,
            channel=req.channel, risk_level=req.risk_level, risk_score=req.risk_score,
            reason_codes=req.reason_codes or [], transcript_or_text=req.transcript_or_text,
        ))
    return out


@router.get("/requesters/{requester_id}/dashboard", response_model=DashboardOut)
def family_dashboard(requester_id: str, db: Session = Depends(get_db), identity=Depends(get_current_identity)):
    """Simple family dashboard (team scope discussion, item C): a read view
    over requests + their outcomes for one requester, visible to the
    requester themselves or any of their registered trusted contacts
    ("family"). No new state-machine logic -- just an aggregating query
    over the existing Request rows."""
    kind, obj = identity
    if kind == "requester":
        if obj.requester_id != requester_id:
            raise HTTPException(status_code=403, detail={"error": {"code": "FORBIDDEN", "message": "Cannot view another requester's dashboard."}})
        requester = obj
    else:  # trusted contact -- must belong to this requester's family
        if obj.requester_id != requester_id:
            raise HTTPException(status_code=403, detail={"error": {"code": "FORBIDDEN", "message": "You are not a registered contact for this requester."}})
        requester = db.query(Requester).filter(Requester.requester_id == requester_id).first()
        if not requester:
            raise HTTPException(status_code=404, detail={"error": {"code": "REQUEST_NOT_FOUND", "message": "No such requester."}})

    rows = db.query(Request).filter(Request.requester_id == requester_id).order_by(Request.created_at.desc()).limit(50).all()
    entries = [
        DashboardEntry(
            request_id=r.request_id, risk_level=r.risk_level, risk_score=r.risk_score,
            request_status=r.request_status, claimed_identity=r.claimed_identity, amount=r.amount,
            triggered_by_panic=r.triggered_by_panic, created_at=r.created_at,
        )
        for r in rows
    ]
    return DashboardOut(requester_id=requester.requester_id, requester_name=requester.name, entries=entries)


@router.post("/requests/{request_id}/manual-override", response_model=ManualOverrideOut)
def manual_override(
    request_id: str,
    body: ManualOverrideIn,
    db: Session = Depends(get_db),
    requester: Requester = Depends(get_current_requester),
):
    """Requester-only. Never triggered automatically. Always logged and
    visibly distinct from VERIFIED (request_status=MANUAL-OVERRIDE, not
    VERIFIED) so it can never be confused with a positive verification."""
    req = db.query(Request).filter(Request.request_id == request_id).first()
    if not req:
        raise HTTPException(status_code=404, detail={"error": {
            "code": "REQUEST_NOT_FOUND", "message": "No request with this id.", "request_id": request_id}})
    if req.requester_id != requester.requester_id:
        raise HTTPException(status_code=403, detail={"error": {
            "code": "FORBIDDEN", "message": "Manual override may only be triggered by the requester who owns this request."}})
    if req.request_status in (RequestStatus.VERIFIED.value, RequestStatus.MANUAL_OVERRIDE.value):
        raise HTTPException(status_code=409, detail={"error": {
            "code": "WRONG_TIER_STATE", "message": f"Request is already {req.request_status}; override not applicable."}})

    now = datetime.utcnow()
    req.request_status = RequestStatus.MANUAL_OVERRIDE.value
    req.override_reason = body.reason
    req.override_at = now
    db.flush()
    audit_log(db, req.request_id, "MANUAL_OVERRIDE", {"reason": body.reason})
    db.commit()
    db.refresh(req)
    return ManualOverrideOut(request_id=req.request_id, request_status=req.request_status, override_at=req.override_at)


@router.get("/requests/{request_id}/audit", response_model=AuditTrailOut)
def get_audit(request_id: str, db: Session = Depends(get_db), identity=Depends(get_current_identity)):
    req = _get_owned_request(db, request_id, identity)
    events = [AuditEventOut(event=e.event, timestamp=e.timestamp, details=e.details) for e in req.audit_events]
    return AuditTrailOut(request_id=req.request_id, events=events)


@router.websocket("/ws/requests/{request_id}")
async def ws_request(websocket: WebSocket, request_id: str):
    token = websocket.query_params.get("token")
    db = database.SessionLocal()
    try:
        requester = db.query(Requester).filter(Requester.auth_token == token).first()
        identity = ("requester", requester) if requester else None
        if not identity:
            contact = db.query(TrustedContact).filter(TrustedContact.auth_token == token).first()
            identity = ("contact", contact) if contact else None
        if not identity:
            await websocket.close(code=4401)
            return

        req = db.query(Request).filter(Request.request_id == request_id).first()
        if not req or not _owns_request(identity, req):
            await websocket.close(code=4403)
            return
    finally:
        db.close()

    await manager.connect(request_id, websocket)
    try:
        while True:
            # Client doesn't need to send anything; just keep the socket open.
            await websocket.receive_text()
    except WebSocketDisconnect:
        pass
    finally:
        await manager.disconnect(request_id, websocket)
