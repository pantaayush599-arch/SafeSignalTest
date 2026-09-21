"""
Decision Gateway (Role 1's core logic) — turns a RiskResult into the
decision / verification_required / request_status triple defined by the
frozen API contract.

  LOW    -> decision=ALLOW, verification_required=false, request_status=VERIFIED
  HIGH   -> decision=PAUSE, verification_required=true,  request_status=STAYS-PAUSED
  MEDIUM -> see app.config.MEDIUM_RISK_POLICY -- unresolved team decision,
            isolated to one constant rather than invented here.

Core safety invariant preserved: no HIGH-risk or MEDIUM-under-the-current-
policy request can reach request_status=VERIFIED except through a positive
Tier verification result or an explicit, logged MANUAL-OVERRIDE.
"""
from dataclasses import dataclass

from app.config import MEDIUM_RISK_POLICY
from app.enums import RiskLevel, Decision, RequestStatus
from app.risk_engine import RiskResult


@dataclass
class GatewayResult:
    decision: Decision
    verification_required: bool
    request_status: RequestStatus


def gate(risk: RiskResult) -> GatewayResult:
    if risk.risk_level == RiskLevel.LOW:
        return GatewayResult(
            decision=Decision.ALLOW,
            verification_required=False,
            request_status=RequestStatus.VERIFIED,
        )

    if risk.risk_level == RiskLevel.HIGH:
        return GatewayResult(
            decision=Decision.PAUSE,
            verification_required=True,
            request_status=RequestStatus.STAYS_PAUSED,
        )

    # MEDIUM
    if MEDIUM_RISK_POLICY == "SAME_AS_HIGH":
        return GatewayResult(
            decision=Decision.PAUSE,
            verification_required=True,
            request_status=RequestStatus.STAYS_PAUSED,
        )

    # No other policy is implemented; fail loudly rather than silently
    # inventing behavior if the constant is ever changed to something
    # unhandled here.
    raise NotImplementedError(f"Unhandled MEDIUM_RISK_POLICY: {MEDIUM_RISK_POLICY}")
