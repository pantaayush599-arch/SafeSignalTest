import uuid
from datetime import datetime

from sqlalchemy import (
    Column, String, Integer, Float, Boolean, DateTime, ForeignKey, Text, JSON
)
from sqlalchemy.orm import relationship

from app.database import Base


def now_utc():
    # Naive UTC on purpose: SQLite round-trips DateTime columns as naive
    # values, so every datetime used for DB storage/comparison in this app
    # is naive UTC for consistency (see verification_service._now()).
    return datetime.utcnow()


def gen_token():
    return uuid.uuid4().hex


class Requester(Base):
    __tablename__ = "requesters"

    requester_id = Column(String, primary_key=True)
    name = Column(String, nullable=False)
    auth_token = Column(String, unique=True, nullable=False, default=gen_token)
    created_at = Column(DateTime, default=now_utc)

    contacts = relationship("TrustedContact", back_populates="requester")
    requests = relationship("Request", back_populates="requester")


class TrustedContact(Base):
    __tablename__ = "trusted_contacts"

    contact_id = Column(String, primary_key=True)
    requester_id = Column(String, ForeignKey("requesters.requester_id"), nullable=False)
    contact_name = Column(String, nullable=False)
    phone_number = Column(String, nullable=False)
    contact_type = Column(String, nullable=False)  # PRIMARY | SECONDARY
    push_token = Column(String, nullable=False, default=gen_token)  # server-side only, never sent by caller
    auth_token = Column(String, unique=True, nullable=False, default=gen_token)
    created_at = Column(DateTime, default=now_utc)

    requester = relationship("Requester", back_populates="contacts")


class Request(Base):
    __tablename__ = "requests"

    request_id = Column(String, primary_key=True)
    requester_id = Column(String, ForeignKey("requesters.requester_id"), nullable=False)
    action_type = Column(String, nullable=False)
    channel = Column(String, nullable=False)
    claimed_identity = Column(String, nullable=True)
    input_type = Column(String, nullable=False)
    transcript_or_text = Column(Text, nullable=True)
    amount = Column(Float, nullable=True)
    deepfake_signal_score = Column(Float, nullable=True)

    risk_score = Column(Integer, nullable=True)
    risk_level = Column(String, nullable=True)
    decision = Column(String, nullable=True)
    reason_codes = Column(JSON, nullable=True, default=list)
    verification_required = Column(Boolean, nullable=False, default=False)
    request_status = Column(String, nullable=False, default="PENDING")
    current_tier = Column(Integer, nullable=True)

    override_reason = Column(Text, nullable=True)
    override_at = Column(DateTime, nullable=True)

    created_at = Column(DateTime, default=now_utc)
    updated_at = Column(DateTime, default=now_utc, onupdate=now_utc)

    requester = relationship("Requester", back_populates="requests")
    verifications = relationship("Verification", back_populates="request", order_by="Verification.sent_at")
    audit_events = relationship("AuditEvent", back_populates="request", order_by="AuditEvent.timestamp")


class Verification(Base):
    __tablename__ = "verifications"

    verification_id = Column(String, primary_key=True)
    request_id = Column(String, ForeignKey("requests.request_id"), nullable=False)
    tier = Column(Integer, nullable=False)
    status = Column(String, nullable=False, default="PENDING")

    trusted_contact_id = Column(String, ForeignKey("trusted_contacts.contact_id"), nullable=True)
    secondary_contact_id = Column(String, ForeignKey("trusted_contacts.contact_id"), nullable=True)
    escalation_reason = Column(String, nullable=True)
    callback_number = Column(String, nullable=True)

    code_hash = Column(String, nullable=True)
    code_salt = Column(String, nullable=True)
    demo_code = Column(String, nullable=True)  # see note in routers/verify.py
    attempts_remaining = Column(Integer, nullable=True)

    sent_at = Column(DateTime, default=now_utc)
    responded_at = Column(DateTime, nullable=True)
    expires_at = Column(DateTime, nullable=False)

    request = relationship("Request", back_populates="verifications")


class AuditEvent(Base):
    __tablename__ = "audit_events"

    id = Column(Integer, primary_key=True, autoincrement=True)
    request_id = Column(String, ForeignKey("requests.request_id"), nullable=False)
    event = Column(String, nullable=False)
    timestamp = Column(DateTime, default=now_utc)
    details = Column(JSON, nullable=True)

    request = relationship("Request", back_populates="audit_events")
