import uuid

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.auth import get_current_requester
from app.audit import log as audit_log
from app.database import get_db
from app.decision_gateway import gate
from app.enums import RequestStatus, RiskLevel
from app.models import Request, Requester, TrustedContact
from app.risk_engine import score_transcript
from app.schemas import AnalyzeRequestIn, AnalyzeRequestOut, ErrorOut
from app.stt_service import decode_and_validate, transcriber, AudioUnprocessableError, STTFailedError
from app.verification_service import start_tier1

router = APIRouter()


def _to_out(req: Request) -> AnalyzeRequestOut:
    return AnalyzeRequestOut(
        request_id=req.request_id,
        transcript_or_text=req.transcript_or_text,
        risk_score=req.risk_score or 0,
        risk_level=req.risk_level,
        decision=req.decision,
        reason_codes=req.reason_codes or [],
        verification_required=req.verification_required,
        request_status=req.request_status,
    )


@router.post("/analyze-request", response_model=AnalyzeRequestOut)
async def analyze_request(
    body: AnalyzeRequestIn,
    db: Session = Depends(get_db),
    requester: Requester = Depends(get_current_requester),
):
    if body.requester_id != requester.requester_id:
        raise HTTPException(status_code=403, detail={"error": {
            "code": "FORBIDDEN", "message": "requester_id does not match the authenticated requester."}})

    # Idempotency: duplicate /analyze-request calls for the same request_id
    # return the existing result rather than creating a second active
    # request (API Contract Review, hardening item #4, recommended answer).
    existing = db.query(Request).filter(Request.request_id == body.request_id).first()
    if existing:
        return _to_out(existing)

    req = Request(
        request_id=body.request_id,
        requester_id=body.requester_id,
        action_type=body.action_type,
        channel=body.channel,
        claimed_identity=body.claimed_identity,
        input_type=body.input_type.value,
        amount=body.amount,
        deepfake_signal_score=body.deepfake_signal_score,
        request_status=RequestStatus.PENDING.value,
        verification_required=False,
        reason_codes=[],
    )
    db.add(req)
    db.flush()
    audit_log(db, req.request_id, "REQUEST_RECEIVED", {"channel": body.channel, "input_type": body.input_type.value})
    db.commit()

    # --- Resolve transcript (TEXT passthrough, or AUDIO via STT) ---------
    transcript = body.transcript_or_text
    if body.input_type.value == "AUDIO":
        try:
            decoded = decode_and_validate(body.audio)
            transcript = transcriber.transcribe(decoded)
        except AudioUnprocessableError as exc:
            req.request_status = RequestStatus.STAYS_PAUSED.value
            db.flush()
            audit_log(db, req.request_id, "AUDIO_UNPROCESSABLE", {"message": str(exc)})
            db.commit()
            raise HTTPException(status_code=422, detail=ErrorOut(
                error={"code": "AUDIO_UNPROCESSABLE", "message": str(exc), "request_id": req.request_id},
                request_status=RequestStatus.STAYS_PAUSED,
            ).model_dump(mode="json"))
        except STTFailedError as exc:
            req.request_status = RequestStatus.STAYS_PAUSED.value
            db.flush()
            audit_log(db, req.request_id, "STT_FAILED", {"message": str(exc)})
            db.commit()
            raise HTTPException(status_code=502, detail=ErrorOut(
                error={"code": "STT_FAILED", "message": str(exc), "request_id": req.request_id},
                request_status=RequestStatus.STAYS_PAUSED,
            ).model_dump(mode="json"))

    req.transcript_or_text = transcript

    # --- Score + gate ------------------------------------------------
    risk = score_transcript(transcript, body.deepfake_signal_score)
    result = gate(risk)

    req.risk_score = risk.risk_score
    req.risk_level = risk.risk_level.value
    req.reason_codes = risk.reason_codes
    req.decision = result.decision.value
    req.verification_required = result.verification_required
    req.request_status = result.request_status.value
    db.flush()

    event = {
        RiskLevel.LOW: "LOW_RISK_ALLOWED",
        RiskLevel.MEDIUM: "MEDIUM_RISK_DETECTED",
        RiskLevel.HIGH: "HIGH_RISK_DETECTED",
    }[risk.risk_level]
    audit_log(db, req.request_id, event, {"risk_score": risk.risk_score, "reason_codes": risk.reason_codes})
    audit_log(db, req.request_id, "ACTION_ALLOWED" if result.decision.value == "ALLOW" else "ACTION_PAUSED", {})
    db.commit()

    # --- Auto-orchestrate Tier 1 when verification is required --------
    if result.verification_required:
        primary = db.query(TrustedContact).filter(
            TrustedContact.requester_id == req.requester_id,
            TrustedContact.contact_type == "PRIMARY",
        ).first()
        if primary:
            await start_tier1(db, req, f"ver_{uuid.uuid4().hex[:8]}", primary.contact_id)

    db.refresh(req)
    return _to_out(req)
