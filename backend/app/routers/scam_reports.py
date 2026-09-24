"""
Crowd-reported scam-number database (team scope: marked optional/future,
added back on explicit request). Self-contained community-reports table --
no external dataset wired in since none was provided. Any authenticated
requester or trusted contact can file a report; the count feeds
app.context_checks.check_scam_number, which /analyze-request uses as a real
risk signal for future requests carrying that number.
"""
import uuid

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.auth import get_current_identity
from app.context_checks import normalize_phone
from app.database import get_db
from app.models import Request, ScamReport
from app.schemas import ScamNumberLookupOut, ScamReportIn, ScamReportOut

router = APIRouter()


@router.post("/scam-reports", response_model=ScamReportOut, status_code=201)
def report_scam_number(
    body: ScamReportIn,
    db: Session = Depends(get_db),
    identity=Depends(get_current_identity),
):
    normalized = normalize_phone(body.phone_number)
    if not normalized:
        raise HTTPException(status_code=422, detail={"error": {
            "code": "INVALID_INPUT", "message": "phone_number must contain at least some digits."}})

    if body.request_id:
        req = db.query(Request).filter(Request.request_id == body.request_id).first()
        if not req:
            raise HTTPException(status_code=404, detail={"error": {
                "code": "REQUEST_NOT_FOUND", "message": "No request with this id.", "request_id": body.request_id}})

    kind, obj = identity
    reporter_id = obj.requester_id if kind == "requester" else obj.contact_id

    report = ScamReport(
        report_id=f"scamreport_{uuid.uuid4().hex[:10]}",
        phone_number=normalized,
        raw_phone_number=body.phone_number,
        reason=body.reason,
        reporter_role=kind,
        reporter_id=reporter_id,
        request_id=body.request_id,
    )
    db.add(report)
    db.commit()
    db.refresh(report)
    return ScamReportOut(
        report_id=report.report_id, phone_number=report.raw_phone_number,
        reason=report.reason, created_at=report.created_at,
    )


@router.get("/scam-reports/lookup", response_model=ScamNumberLookupOut)
def lookup_scam_number(
    phone_number: str = Query(..., min_length=1),
    db: Session = Depends(get_db),
    identity=Depends(get_current_identity),
):
    normalized = normalize_phone(phone_number)
    if not normalized:
        raise HTTPException(status_code=422, detail={"error": {
            "code": "INVALID_INPUT", "message": "phone_number must contain at least some digits."}})
    count = db.query(ScamReport).filter(ScamReport.phone_number == normalized).count()
    return ScamNumberLookupOut(phone_number=phone_number, reported=count > 0, report_count=count)
