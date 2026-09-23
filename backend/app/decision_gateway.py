"""
Decision Gateway (Role 1's core logic) — turns a RiskResult into the
decision / verification_required / request_status triple defined by the
frozen API contract.

  LOW    -> decision=ALLOW,  verification_required=false, request_status=VERIFIED
  HIGH   -> decision=PAUSE,  verification_required=true,  request_status=STAYS-PAUSED
  MEDIUM -> decision=REVIEW, verification_required=false, request_status=PENDING
            (placeholder -- see the MEDIUM block below)

Core safety invariant preserved: no HIGH-risk request can reach
request_status=VERIFIED except through a positive Tier verification result
or an explicit, logged MANUAL-OVERRIDE. MEDIUM under the policy below never
reaches VERIFIED either -- it stays PENDING, which is a non-terminal,
non-unlocking state.
"""
from dataclasses import dataclass

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

    # TODO: pending official sign-off, see API contract review item #1
    # (risk_level=MEDIUM's decision/verification_required/request_status
    # were left formally undefined). Placeholder per the task brief:
    # STAYS-PAUSED is "too strict" (nothing about a MEDIUM signal set
    # justifies a full action lock) and VERIFIED is "too loose" (that
    # would silently auto-allow a request the system is only partially
    # confident about). Landed here instead: decision=REVIEW (advisory,
    # not a Tier-verification outcome) and request_status=PENDING -- the
    # one status in the frozen five-value set that is neither a lock
    # (STAYS-PAUSED) nor an unlock (VERIFIED), so the frontend renders a
    # distinct "review before you proceed" screen rather than reusing
    # either the paused or the unlocked treatment. The action is not
    # forced open and not forced shut; the user decides, and it's logged
    # either way via MEDIUM_RISK_REVIEW.
    assert risk.risk_level == RiskLevel.MEDIUM
    return GatewayResult(
        decision=Decision.REVIEW,
        verification_required=False,
        request_status=RequestStatus.PENDING,
    )
