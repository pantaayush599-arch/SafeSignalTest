from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel, Field, model_validator

from app.enums import (
    InputType, Channel, ActionType, ContactType, RiskLevel, Decision,
    RequestStatus, VerificationStatus,
)


# ---------------------------------------------------------------- analyze
class AnalyzeRequestIn(BaseModel):
    request_id: str
    requester_id: str
    action_type: str = ActionType.WALLET_TRANSFER.value
    channel: str
    input_type: InputType
    transcript_or_text: Optional[str] = None
    audio: Optional[str] = None  # base64
    claimed_identity: Optional[str] = None
    amount: Optional[float] = None
    deepfake_signal_score: Optional[float] = Field(default=None, ge=0.0, le=1.0)
    timestamp: Optional[datetime] = None

    @model_validator(mode="after")
    def check_input(self):
        if self.input_type == InputType.TEXT and not self.transcript_or_text:
            raise ValueError("transcript_or_text is required when input_type=TEXT")
        if self.input_type == InputType.AUDIO and not self.audio:
            raise ValueError("audio is required when input_type=AUDIO")
        return self


class AnalyzeRequestOut(BaseModel):
    request_id: str
    transcript_or_text: Optional[str] = None
    risk_score: int
    risk_level: RiskLevel
    decision: Decision
    reason_codes: List[str]
    verification_required: bool
    request_status: RequestStatus


# ---------------------------------------------------------------- tier1
class Tier1StartIn(BaseModel):
    verification_id: str
    request_id: str
    tier: int = 1
    trusted_contact_id: str


class VerificationOut(BaseModel):
    verification_id: str
    request_id: str
    tier: int
    status: VerificationStatus
    sent_at: datetime
    responded_at: Optional[datetime] = None
    expires_at: datetime


class VerifyRespondIn(BaseModel):
    verification_id: str
    response: str  # CONFIRMED | REJECTED


class VerifyRespondOut(BaseModel):
    verification_id: str
    request_id: str
    tier: int
    status: VerificationStatus
    request_status: RequestStatus
    responded_at: Optional[datetime] = None


# ---------------------------------------------------------------- tier2
class Tier2StartIn(BaseModel):
    verification_id: str
    request_id: str
    tier: int = 2
    secondary_contact_id: str
    escalation_reason: str
    callback_number: Optional[str] = None


# ---------------------------------------------------------------- tier3
class Tier3StartIn(BaseModel):
    verification_id: str
    request_id: str
    tier: int = 3


class Tier3StartOut(BaseModel):
    verification_id: str
    request_id: str
    tier: int
    status: VerificationStatus
    expires_at: datetime
    attempts_remaining: int
    demo_code: Optional[str] = None  # see note in routers/verify.py


class Tier3SubmitIn(BaseModel):
    verification_id: str
    code: str


class Tier3SubmitOut(BaseModel):
    verification_id: str
    request_id: str
    tier: int
    status: VerificationStatus
    request_status: Optional[RequestStatus] = None
    attempts_remaining: Optional[int] = None


# ---------------------------------------------------------------- requests
class VerificationSummary(BaseModel):
    verification_id: str
    tier: int
    status: VerificationStatus
    sent_at: datetime
    expires_at: datetime
    responded_at: Optional[datetime] = None


class RequestStateOut(BaseModel):
    request_id: str
    risk_score: Optional[int] = None
    risk_level: Optional[RiskLevel] = None
    decision: Optional[Decision] = None
    reason_codes: List[str] = []
    transcript_or_text: Optional[str] = None
    amount: Optional[float] = None
    claimed_identity: Optional[str] = None
    channel: Optional[str] = None
    verification_required: bool = False
    request_status: RequestStatus
    current_tier: Optional[int] = None
    override_reason: Optional[str] = None
    override_at: Optional[datetime] = None
    created_at: datetime
    verifications: List[VerificationSummary] = []


# ------------------------------------------------------- contact inbox (demo-additive)
class ContactInboxItem(BaseModel):
    verification_id: str
    request_id: str
    tier: int
    status: VerificationStatus
    sent_at: datetime
    expires_at: datetime
    escalation_reason: Optional[str] = None
    demo_code: Optional[str] = None
    request_status: RequestStatus
    claimed_identity: Optional[str] = None
    amount: Optional[float] = None
    channel: Optional[str] = None
    risk_level: Optional[RiskLevel] = None
    risk_score: Optional[int] = None
    reason_codes: List[str] = []
    transcript_or_text: Optional[str] = None


# ---------------------------------------------------------------- override
class ManualOverrideIn(BaseModel):
    reason: str = Field(min_length=1)
    confirmation: bool

    @model_validator(mode="after")
    def check_confirmation(self):
        if not self.confirmation:
            raise ValueError("confirmation must be true")
        return self


class ManualOverrideOut(BaseModel):
    request_id: str
    request_status: RequestStatus
    override_at: datetime


# ---------------------------------------------------------------- audit
class AuditEventOut(BaseModel):
    event: str
    timestamp: datetime
    details: Optional[dict] = None


class AuditTrailOut(BaseModel):
    request_id: str
    events: List[AuditEventOut]


# ---------------------------------------------------------------- contacts
class ContactIn(BaseModel):
    requester_id: str
    contact_name: str
    phone_number: str
    contact_type: ContactType


class ContactOut(BaseModel):
    contact_id: str
    requester_id: str
    contact_name: str
    phone_number: str
    contact_type: ContactType
    auth_token: Optional[str] = None  # only returned at creation, for demo login


# ---------------------------------------------------------------- error
class ErrorDetail(BaseModel):
    code: str
    message: str
    request_id: Optional[str] = None


class ErrorOut(BaseModel):
    error: ErrorDetail
    request_status: Optional[RequestStatus] = None


# ---------------------------------------------------------------- health
class HealthOut(BaseModel):
    status: str = "ok"
    service: str = "safesignal-api"
    version: str = "1.0.0"


# ---------------------------------------------------------------- auth / demo
class DemoLoginOut(BaseModel):
    role: str
    id: str
    name: str
    token: str
