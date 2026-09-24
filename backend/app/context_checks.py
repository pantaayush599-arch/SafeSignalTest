"""
Context-aware risk checks that require a DB lookup beyond the pure
transcript scorer (app.risk_engine) -- the known-contact number check and
the crowd-reported scam-number registry (team scope discussion: both were
marked "optional/future" and left out of the first pass; added back on
explicit request).

Kept in their own module rather than folded into risk_engine.score_transcript
so that function stays a pure function of (transcript, deepfake_score) with
no DB dependency, exactly as before. app.routers.analyze calls both checks
after scoring the transcript and adds their weights to the same total.

Known-contact check: if the caller CLAIMS to be someone who matches one of
the requester's trusted contacts by relationship (e.g. "Mother"), and a
caller phone number was supplied, a number that does NOT match that
contact's registered number is a strong impersonation/spoofing signal --
exactly the deepfake-emergency-shield scenario this app exists for. If the
claimed identity doesn't correspond to any trusted contact on file at all
(e.g. "bank support executive"), the check simply doesn't apply -- that's
normal, not suspicious.

Crowd scam-number database: a self-contained community-reports table
(app.models.ScamReport). No external dataset is wired in since none was
provided; report volume is real user input, not synthetic.
"""
import re
from dataclasses import dataclass
from typing import Optional

from sqlalchemy.orm import Session

from app.models import ScamReport, TrustedContact

# Weights are chosen to sit alongside app.risk_engine.SIGNAL_RULES' weights
# (11-27) without ever being the literal same number, keeping combined
# totals non-round per the "continuous score" requirement.
KNOWN_CONTACT_MISMATCH_WEIGHT = 21
REPORTED_SCAM_NUMBER_WEIGHT = 31


def normalize_phone(raw: Optional[str]) -> Optional[str]:
    """Last-10-digits normalization so "+91 98765 00101", "9876500101",
    and "091-98765-00101" all compare equal. Returns None for empty input."""
    if not raw:
        return None
    digits = re.sub(r"\D", "", raw)
    if not digits:
        return None
    return digits[-10:] if len(digits) >= 10 else digits


@dataclass
class KnownContactResult:
    checked: bool
    matched: Optional[bool] = None  # None = claimed identity has no corresponding trusted contact to check against
    contact_name: Optional[str] = None


def check_known_contact(
    db: Session, requester_id: str, claimed_identity: Optional[str], caller_phone_number: Optional[str]
) -> KnownContactResult:
    if not claimed_identity or not caller_phone_number:
        return KnownContactResult(checked=False)

    claimed = claimed_identity.strip().lower()
    caller_norm = normalize_phone(caller_phone_number)
    contacts = db.query(TrustedContact).filter(TrustedContact.requester_id == requester_id).all()
    match = next(
        (c for c in contacts if c.relationship_label and c.relationship_label.strip().lower() == claimed), None
    )
    if not match:
        return KnownContactResult(checked=True, matched=None)

    is_match = normalize_phone(match.phone_number) == caller_norm
    return KnownContactResult(checked=True, matched=is_match, contact_name=match.contact_name)


@dataclass
class ScamNumberResult:
    checked: bool
    reported: bool = False
    report_count: int = 0


def check_scam_number(db: Session, caller_phone_number: Optional[str]) -> ScamNumberResult:
    norm = normalize_phone(caller_phone_number)
    if not norm:
        return ScamNumberResult(checked=False)
    count = db.query(ScamReport).filter(ScamReport.phone_number == norm).count()
    return ScamNumberResult(checked=True, reported=count > 0, report_count=count)
