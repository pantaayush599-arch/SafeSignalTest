"""
Risk Detection Engine — Role 6's rule-based keyword/context scorer.

Internal pipeline (per STT/Architecture doc):
  Transcript -> Context/Keyword Analysis -> Optional Deepfake Signal -> Risk Score

The deepfake_signal_score is an OPTIONAL ADVISORY input only. Its weight is
capped low enough that it can never by itself push a request from 0 into the
HIGH band (60+) -- it can only nudge an already-suspicious transcript. This
directly implements the contract's repeated rule: "must never be the sole
trigger."
"""
import re
from dataclasses import dataclass, field
from typing import List

from app.config import RISK_LOW_MAX, RISK_MEDIUM_MAX
from app.enums import RiskLevel

# reason_code -> (regex patterns, weight)
SIGNAL_RULES = [
    ("money_request", [
        r"\bsend\b.*\b(money|rs\.?|rupees|inr|₹|cash)\b",
        r"\btransfer\b.*\b(money|amount|funds?)\b",
        r"\b(rs\.?|inr|₹)\s?\d",
        r"\bpay\b.*\bnow\b",
        r"\bneed\b.*\bmoney\b",
        r"\bsend\b.{0,15}\d",  # e.g. "send 80000", "send me 80,000"
    ], 30),
    ("credential_otp_request", [
        r"\botp\b", r"\bone[- ]time password\b", r"\bpin\b", r"\bcvv\b",
        r"\bpassword\b", r"\bverification code\b", r"\bshare.*code\b",
    ], 25),
    ("emergency_claim", [
        r"\barrested\b", r"\baccident\b", r"\bhospital\b", r"\bemergency\b",
        r"\bpolice\b", r"\bdetained\b", r"\bbail\b", r"\bkidnap",
    ], 20),
    ("secrecy_request", [
        r"(don'?t|do not)\s+tell", r"\bkeep.{0,10}secret\b", r"(don'?t|do not).{0,10}anyone\b",
        r"\bonly you\b.{0,15}\bknow\b",
    ], 20),
    ("urgency_keyword", [
        r"\bright now\b", r"\bimmediately\b", r"\burgent(ly)?\b",
        r"\bas soon as possible\b", r"\basap\b", r"\bquick(ly)?\b",
        r"\bhurry\b",
    ], 15),
    ("unusual_amount_flag", [
        r"\b(\d{2,3}[,.]?\d{3})\b",  # 5-6 digit-ish amounts, e.g. 80,000
    ], 15),
]

DEEPFAKE_ADVISORY_THRESHOLD = 0.6
DEEPFAKE_ADVISORY_WEIGHT = 10


@dataclass
class RiskResult:
    risk_score: int
    risk_level: RiskLevel
    reason_codes: List[str] = field(default_factory=list)


def score_transcript(transcript: str, deepfake_signal_score: float | None = None) -> RiskResult:
    text = (transcript or "").lower()
    total = 0
    reasons: List[str] = []

    for code, patterns, weight in SIGNAL_RULES:
        if any(re.search(p, text) for p in patterns):
            total += weight
            reasons.append(code)

    # Deepfake signal is advisory-only: only counted if the transcript
    # already triggered at least one real risk signal, and capped low.
    if deepfake_signal_score is not None and deepfake_signal_score >= DEEPFAKE_ADVISORY_THRESHOLD and reasons:
        total += DEEPFAKE_ADVISORY_WEIGHT
        reasons.append("deepfake_signal_advisory")

    total = max(0, min(100, total))

    if total <= RISK_LOW_MAX:
        level = RiskLevel.LOW
    elif total <= RISK_MEDIUM_MAX:
        level = RiskLevel.MEDIUM
    else:
        level = RiskLevel.HIGH

    return RiskResult(risk_score=total, risk_level=level, reason_codes=reasons)
