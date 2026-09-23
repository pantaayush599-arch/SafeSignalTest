"""
DEMO-ONLY convenience endpoints, not part of the frozen API contract.

The prototype has no real login/SMS/push infrastructure. The frontend needs
some way to obtain the seeded demo bearer tokens for the requester persona
and the two trusted-contact personas so it can authenticate against the
real, auth-enforcing endpoints; it also needs a way to demo the TIMEOUT
outcome on one device without waiting out the real 120s window. These
endpoints exist purely to make the prototype's demo mode work; they are
additive (new paths, not changes to any existing endpoint) and clearly out
of scope of the reviewed contract. The timeout endpoint does not fabricate
the timeout itself -- it only sets `expires_at` into the past, and the
real background sweeper (verification_service.sweep_timeouts) is what
actually performs the escalation/finalization, exactly as it would for a
real expiry.
"""
from datetime import datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.auth import get_current_requester
from app.database import get_db
from app.enums import VerificationStatus
from app.models import Requester, TrustedContact, Verification, Request
from app.schemas import DemoLoginOut

router = APIRouter()


@router.get("/demo/identities", response_model=list[DemoLoginOut])
def demo_identities(db: Session = Depends(get_db)):
    out = []
    for r in db.query(Requester).all():
        out.append(DemoLoginOut(role="requester", id=r.requester_id, name=r.name, token=r.auth_token))
    for c in db.query(TrustedContact).all():
        out.append(DemoLoginOut(role="contact", id=c.contact_id, name=c.contact_name, token=c.auth_token,
                                 requester_id=c.requester_id, relationship=c.relationship_label))
    return out


@router.post("/demo/expire/{verification_id}", status_code=204)
def demo_force_expire(verification_id: str, db: Session = Depends(get_db), requester: Requester = Depends(get_current_requester)):
    """Demo-mode 'simulate timeout' control: backdates expires_at by one
    second so the real sweeper (which runs every ~2s) finalizes it exactly
    as it would for a genuine expiry. Requester-only, and only for a
    verification on one of their own requests."""
    v = db.query(Verification).filter(Verification.verification_id == verification_id).first()
    if not v:
        raise HTTPException(status_code=404, detail={"error": {"code": "VERIFICATION_NOT_FOUND", "message": "No such verification."}})
    req = db.query(Request).filter(Request.request_id == v.request_id).first()
    if not req or req.requester_id != requester.requester_id:
        raise HTTPException(status_code=403, detail={"error": {"code": "FORBIDDEN", "message": "Not your request."}})
    if v.status != VerificationStatus.PENDING.value:
        raise HTTPException(status_code=409, detail={"error": {"code": "WRONG_TIER_STATE", "message": f"Verification already {v.status}."}})

    v.expires_at = datetime.utcnow() - timedelta(seconds=1)
    db.commit()
    return None
