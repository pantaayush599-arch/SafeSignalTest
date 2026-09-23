"""
Centralized enums for SafeSignal.

Every allowed value for every enum field lives here (API Contract Review,
hardening item #6: "Enums aren't fully centralized"). No role/module should
define its own copy of a status string.

Naming convention note (hardening item #3 in the contract review): the
source contract is explicit that verification.status uses underscores
(PENDING / CONFIRMED / REJECTED / TIMED_OUT) while request_status uses
hyphens (STAYS-PAUSED / TIMED-OUT / MANUAL-OVERRIDE). That inconsistency is
preserved here exactly as frozen in the contract rather than silently
"fixed" by one implementer.
"""
from enum import Enum


class InputType(str, Enum):
    TEXT = "TEXT"
    AUDIO = "AUDIO"


class Channel(str, Enum):
    VOICE_CALL = "voice_call"
    VIDEO_CALL = "video_call"
    TEXT = "text"


class ActionType(str, Enum):
    WALLET_TRANSFER = "wallet_transfer"
    OTP_SHARE = "otp_share"
    OTHER = "other"


class ContactType(str, Enum):
    PRIMARY = "PRIMARY"
    SECONDARY = "SECONDARY"


class AuthProvider(str, Enum):
    PHONE = "PHONE"
    GOOGLE = "GOOGLE"


class RiskLevel(str, Enum):
    LOW = "LOW"
    MEDIUM = "MEDIUM"
    HIGH = "HIGH"


class Decision(str, Enum):
    ALLOW = "ALLOW"
    PAUSE = "PAUSE"
    BLOCK = "BLOCK"
    # Added for the MEDIUM-risk placeholder (task Part 5): advisory only,
    # never pauses the action and never auto-unlocks it. See
    # decision_gateway.py's TODO for the pending official sign-off.
    REVIEW = "REVIEW"


class RequestStatus(str, Enum):
    """Matches the frozen contract's five values exactly. No sixth value."""
    PENDING = "PENDING"
    VERIFIED = "VERIFIED"
    STAYS_PAUSED = "STAYS-PAUSED"
    TIMED_OUT = "TIMED-OUT"
    MANUAL_OVERRIDE = "MANUAL-OVERRIDE"


class VerificationStatus(str, Enum):
    PENDING = "PENDING"
    CONFIRMED = "CONFIRMED"
    REJECTED = "REJECTED"
    TIMED_OUT = "TIMED_OUT"


class EscalationReason(str, Enum):
    TIER1_TIMEOUT = "TIER1_TIMEOUT"
    TIER1_REJECTED = "TIER1_REJECTED"
    TIER1_UNAVAILABLE = "TIER1_UNAVAILABLE"
    TIER2_TIMEOUT = "TIER2_TIMEOUT"
    TIER2_REJECTED = "TIER2_REJECTED"


class ErrorCode(str, Enum):
    AUDIO_UNPROCESSABLE = "AUDIO_UNPROCESSABLE"
    STT_FAILED = "STT_FAILED"
    REQUEST_NOT_FOUND = "REQUEST_NOT_FOUND"
    VERIFICATION_EXPIRED = "VERIFICATION_EXPIRED"
    VERIFICATION_NOT_FOUND = "VERIFICATION_NOT_FOUND"
    MAX_ATTEMPTS_EXCEEDED = "MAX_ATTEMPTS_EXCEEDED"
    UNAUTHORIZED = "UNAUTHORIZED"
    FORBIDDEN = "FORBIDDEN"
    INVALID_INPUT = "INVALID_INPUT"
    WRONG_TIER_STATE = "WRONG_TIER_STATE"
    INVALID_FIREBASE_TOKEN = "INVALID_FIREBASE_TOKEN"
    INTEGRITY_ERROR = "INTEGRITY_ERROR"


AUDIT_EVENTS = [
    "REQUEST_RECEIVED",
    "LOW_RISK_ALLOWED",
    "MEDIUM_RISK_REVIEW",
    "HIGH_RISK_DETECTED",
    "AUDIO_UNPROCESSABLE",
    "STT_FAILED",
    "TIER1_STARTED",
    "TIER1_CONFIRMED",
    "TIER1_REJECTED",
    "TIER1_TIMEOUT",
    "TIER2_STARTED",
    "TIER2_CONFIRMED",
    "TIER2_REJECTED",
    "TIER2_TIMEOUT",
    "TIER3_STARTED",
    "TIER3_CONFIRMED",
    "TIER3_WRONG_CODE",
    "TIER3_EXPIRED",
    "TIER3_ATTEMPTS_EXHAUSTED",
    "ACTION_ALLOWED",
    "ACTION_PAUSED",
    "ACTION_ADVISORY_REVIEW",
    "ACTION_UNLOCKED",
    "MANUAL_OVERRIDE",
    "REQUEST_TIMED_OUT",
    "PANIC_TRIGGERED",
]
