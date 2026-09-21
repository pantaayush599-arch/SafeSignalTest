import uuid

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.auth import get_current_requester
from app.database import get_db
from app.models import Requester, TrustedContact
from app.schemas import ContactIn, ContactOut

router = APIRouter()


@router.post("/contacts", response_model=ContactOut)
def create_contact(body: ContactIn, db: Session = Depends(get_db), requester: Requester = Depends(get_current_requester)):
    if body.requester_id != requester.requester_id:
        raise HTTPException(status_code=403, detail={"error": {"code": "FORBIDDEN", "message": "Cannot register a contact for another requester."}})
    contact = TrustedContact(
        contact_id=f"contact_{uuid.uuid4().hex[:6]}",
        requester_id=body.requester_id,
        contact_name=body.contact_name,
        phone_number=body.phone_number,
        contact_type=body.contact_type.value,
    )
    db.add(contact)
    db.commit()
    db.refresh(contact)
    return ContactOut(
        contact_id=contact.contact_id, requester_id=contact.requester_id,
        contact_name=contact.contact_name, phone_number=contact.phone_number,
        contact_type=contact.contact_type, auth_token=contact.auth_token,
    )


@router.get("/contacts/{requester_id}", response_model=list[ContactOut])
def list_contacts(requester_id: str, db: Session = Depends(get_db), requester: Requester = Depends(get_current_requester)):
    if requester_id != requester.requester_id:
        raise HTTPException(status_code=403, detail={"error": {"code": "FORBIDDEN", "message": "Cannot view another requester's contacts."}})
    contacts = db.query(TrustedContact).filter(TrustedContact.requester_id == requester_id).all()
    return [ContactOut(contact_id=c.contact_id, requester_id=c.requester_id, contact_name=c.contact_name,
                        phone_number=c.phone_number, contact_type=c.contact_type) for c in contacts]
