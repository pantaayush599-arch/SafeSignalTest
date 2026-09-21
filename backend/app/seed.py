"""
Seeds the demo requester and pre-registered trusted contacts, matching the
contract's own worked example (requester_id="user_102", contact_101 as the
Tier 1 primary contact). Optional per the contract ("/contacts ... can be
skipped if trusted contacts are pre-seeded in the database for the demo"),
but /contacts endpoints are still implemented for completeness.
"""
from sqlalchemy.orm import Session

from app.models import Requester, TrustedContact


def seed_demo_data(db: Session):
    if db.query(Requester).filter(Requester.requester_id == "user_102").first():
        return  # already seeded

    requester = Requester(
        requester_id="user_102",
        name="Aarav Sharma",
        auth_token="demo-requester-token-user102",
    )
    db.add(requester)

    primary = TrustedContact(
        contact_id="contact_101",
        requester_id="user_102",
        contact_name="Priya Sharma (Mom)",
        phone_number="+919876500101",
        contact_type="PRIMARY",
        auth_token="demo-contact-token-contact101",
    )
    secondary = TrustedContact(
        contact_id="contact_202",
        requester_id="user_102",
        contact_name="Rohan Sharma (Uncle)",
        phone_number="+919876500202",
        contact_type="SECONDARY",
        auth_token="demo-contact-token-contact202",
    )
    db.add(primary)
    db.add(secondary)
    db.commit()
