"""
Lightweight demo authentication/authorization.

The API Contract Review flags authentication/authorization as an unaddressed
hardening gap with three concrete holes to close:
  (a) manual-override must be callable only by the requester
  (b) a trusted contact must only respond to a verification assigned to them
  (c) GET /requests/{id} and the WebSocket must check ownership, not just
      knowledge of the UUID

No source document specifies a concrete auth mechanism (only "role-based
access" as a tech-stack line item), so this module implements the simplest
mechanism that actually closes those three holes for a prototype: opaque
per-identity bearer tokens issued at contact/requester creation (seeded for
the demo), checked via the Authorization header. This is additive
hardening, not a contract change -- no existing field, endpoint or enum is
renamed or removed.
"""
from fastapi import Header, HTTPException, Depends
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Requester, TrustedContact


def _extract_token(authorization: str | None) -> str:
    if not authorization:
        raise HTTPException(status_code=401, detail={"error": {"code": "UNAUTHORIZED", "message": "Missing Authorization header"}})
    parts = authorization.split()
    if len(parts) == 2 and parts[0].lower() == "bearer":
        return parts[1]
    return authorization


def get_current_requester(
    authorization: str | None = Header(default=None),
    db: Session = Depends(get_db),
) -> Requester:
    token = _extract_token(authorization)
    requester = db.query(Requester).filter(Requester.auth_token == token).first()
    if not requester:
        raise HTTPException(status_code=401, detail={"error": {"code": "UNAUTHORIZED", "message": "Invalid requester token"}})
    return requester


def get_current_contact(
    authorization: str | None = Header(default=None),
    db: Session = Depends(get_db),
) -> TrustedContact:
    token = _extract_token(authorization)
    contact = db.query(TrustedContact).filter(TrustedContact.auth_token == token).first()
    if not contact:
        raise HTTPException(status_code=401, detail={"error": {"code": "UNAUTHORIZED", "message": "Invalid trusted-contact token"}})
    return contact


def get_current_identity(
    authorization: str | None = Header(default=None),
    db: Session = Depends(get_db),
):
    """Either a requester or a trusted contact. Used by read-only endpoints
    (GET /requests/{id}, WS) that both roles may legitimately access, so
    long as they own/are-assigned-to that specific request."""
    token = _extract_token(authorization)
    requester = db.query(Requester).filter(Requester.auth_token == token).first()
    if requester:
        return ("requester", requester)
    contact = db.query(TrustedContact).filter(TrustedContact.auth_token == token).first()
    if contact:
        return ("contact", contact)
    raise HTTPException(status_code=401, detail={"error": {"code": "UNAUTHORIZED", "message": "Invalid token"}})
