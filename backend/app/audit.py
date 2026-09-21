from sqlalchemy.orm import Session

from app.models import AuditEvent


def log(db: Session, request_id: str, event: str, details: dict | None = None):
    entry = AuditEvent(request_id=request_id, event=event, details=details)
    db.add(entry)
    db.flush()
    return entry
