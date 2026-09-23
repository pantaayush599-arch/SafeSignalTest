from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.database import get_db
from app.firebase_auth import verify_firebase_token, FirebaseTokenError
from app.models import Requester
from app.schemas import LoginIn, LoginOut

router = APIRouter()


def _display_name(identity) -> str:
    return identity.name or identity.phone_number or identity.email or identity.uid


@router.post("/auth/login", response_model=LoginOut)
def login(body: LoginIn, db: Session = Depends(get_db)):
    try:
        identity = verify_firebase_token(body.id_token)
    except FirebaseTokenError as exc:
        raise HTTPException(status_code=401, detail={"error": {
            "code": "INVALID_FIREBASE_TOKEN", "message": str(exc)}})

    # Idempotent get-or-create by Firebase uid. Logging in again just
    # returns the existing row (task Part 1) rather than erroring or
    # duplicating the user.
    existing = db.query(Requester).filter(Requester.requester_id == identity.uid).first()
    created = False
    if existing is None:
        requester = Requester(
            requester_id=identity.uid,
            name=_display_name(identity),
            auth_provider=identity.provider,
            phone_number=identity.phone_number,
            email=identity.email,
        )
        db.add(requester)
        try:
            db.commit()
            created = True
        except IntegrityError:
            # Two concurrent logins raced to create the same uid -- the
            # other one won; fall back to it rather than surfacing a raw
            # 500 (acceptance checklist: clean error/idempotent response,
            # never an unhandled IntegrityError).
            db.rollback()
            requester = db.query(Requester).filter(Requester.requester_id == identity.uid).first()
            if requester is None:
                raise HTTPException(status_code=500, detail={"error": {
                    "code": "INTERNAL_ERROR", "message": "Could not create or find user after a write conflict."}})
    else:
        requester = existing
        # Keep contact info fresh without discarding an existing display name.
        requester.phone_number = identity.phone_number or requester.phone_number
        requester.email = identity.email or requester.email
        db.commit()

    db.refresh(requester)
    return LoginOut(
        requester_id=requester.requester_id,
        name=requester.name,
        auth_provider=requester.auth_provider,
        phone_number=requester.phone_number,
        email=requester.email,
        session_token=requester.auth_token,
        created=created,
    )
