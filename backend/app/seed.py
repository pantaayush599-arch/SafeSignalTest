"""
Seeds the demo requester and pre-registered trusted contacts, matching the
contract's own worked example (requester_id="user_102", contact_101 as the
Tier 1 primary contact). Optional per the contract ("/contacts ... can be
skipped if trusted contacts are pre-seeded in the database for the demo"),
but /contacts endpoints are still implemented for completeness.
"""
from sqlalchemy.orm import Session

from app.context_checks import normalize_phone
from app.models import Requester, ScamReport, TrustedContact


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
        contact_name="Priya Sharma",
        relationship_label="Mother",
        phone_number="+919876500101",
        contact_type="PRIMARY",
        auth_token="demo-contact-token-contact101",
    )
    secondary = TrustedContact(
        contact_id="contact_202",
        requester_id="user_102",
        contact_name="Rohan Sharma",
        relationship_label="Uncle",
        phone_number="+919876500202",
        contact_type="SECONDARY",
        auth_token="demo-contact-token-contact202",
    )
    db.add(primary)
    db.add(secondary)

    # Seed one crowd-reported scam number (community-reports table, team
    # scope: optional/future, added back on request) -- matches the demo
    # mode "OTP / credential scam" scenario's caller_phone_number so it's
    # visibly flagged in the demo, not just a silent empty table.
    scam_number = "+911800000666"
    db.add(ScamReport(
        report_id="scamreport_seed1",
        phone_number=normalize_phone(scam_number),
        raw_phone_number=scam_number,
        reason="Claimed to be bank support, demanded OTP under urgency/threat of account block.",
        reporter_role="requester",
        reporter_id="user_102",
    ))
    db.add(ScamReport(
        report_id="scamreport_seed2",
        phone_number=normalize_phone(scam_number),
        raw_phone_number=scam_number,
        reason="Same number, second report -- OTP phishing call.",
        reporter_role="contact",
        reporter_id="contact_101",
    ))
    db.commit()
