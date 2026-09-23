"""
DEMO-ONLY convenience endpoint, not part of the frozen API contract.

The prototype has no real login/SMS/push infrastructure. The frontend needs
some way to obtain the seeded demo bearer tokens for the requester persona
and the two trusted-contact personas so it can authenticate against the
real, auth-enforcing endpoints. This endpoint exists purely to make the
prototype's role-picker screen work; it is additive (a new path, not a
change to any existing endpoint) and clearly out of scope of the reviewed
contract.
"""
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Requester, TrustedContact
from app.schemas import DemoLoginOut

router = APIRouter()


@router.get("/demo/identities", response_model=list[DemoLoginOut])
def demo_identities(db: Session = Depends(get_db)):
    out = []
    for r in db.query(Requester).all():
        out.append(DemoLoginOut(role="requester", id=r.requester_id, name=r.name, token=r.auth_token))
    for c in db.query(TrustedContact).all():
        out.append(DemoLoginOut(role="contact", id=c.contact_id, name=c.contact_name, token=c.auth_token,
                                 requester_id=c.requester_id))
    return out
