import uuid
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.auth import get_current_requester
from app.database import get_db
from app.enums import ContactType
from app.models import Requester, TrustedContact
from app.schemas import ContactIn, ContactOut

router = APIRouter()


def _to_out(c: TrustedContact, include_token: bool = False) -> ContactOut:
    return ContactOut(
        contact_id=c.contact_id, requester_id=c.requester_id, contact_name=c.contact_name,
        relationship=c.relationship_label, phone_number=c.phone_number, contact_type=c.contact_type,
        auth_token=c.auth_token if include_token else None,
    )


@router.post("/contacts", response_model=ContactOut)
def create_contact(body: ContactIn, db: Session = Depends(get_db), requester: Requester = Depends(get_current_requester)):
    if body.requester_id != requester.requester_id:
        raise HTTPException(status_code=403, detail={"error": {"code": "FORBIDDEN", "message": "Cannot register a contact for another requester."}})
    contact = TrustedContact(
        contact_id=f"contact_{uuid.uuid4().hex[:6]}",
        requester_id=body.requester_id,
        contact_name=body.contact_name,
        relationship_label=body.relationship,
        phone_number=body.phone_number,
        contact_type=body.contact_type.value,
    )
    db.add(contact)
    db.commit()
    db.refresh(contact)
    return _to_out(contact, include_token=True)


@router.get("/contacts/{requester_id}", response_model=list[ContactOut])
def list_contacts(requester_id: str, db: Session = Depends(get_db), requester: Requester = Depends(get_current_requester)):
    if requester_id != requester.requester_id:
        raise HTTPException(status_code=403, detail={"error": {"code": "FORBIDDEN", "message": "Cannot view another requester's contacts."}})
    contacts = db.query(TrustedContact).filter(TrustedContact.requester_id == requester_id).all()
    return [_to_out(c) for c in contacts]


class ContactUpdateIn(BaseModel):
    contact_name: Optional[str] = None
    relationship: Optional[str] = None
    phone_number: Optional[str] = None
    contact_type: Optional[ContactType] = None


def _get_owned_contact(db: Session, contact_id: str, requester: Requester) -> TrustedContact:
    contact = db.query(TrustedContact).filter(TrustedContact.contact_id == contact_id).first()
    if not contact:
        raise HTTPException(status_code=404, detail={"error": {"code": "REQUEST_NOT_FOUND", "message": "No such contact."}})
    if contact.requester_id != requester.requester_id:
        raise HTTPException(status_code=403, detail={"error": {"code": "FORBIDDEN", "message": "Not your contact."}})
    return contact


@router.patch("/contacts/detail/{contact_id}", response_model=ContactOut)
def update_contact(contact_id: str, body: ContactUpdateIn, db: Session = Depends(get_db), requester: Requester = Depends(get_current_requester)):
    """Edit a trusted contact, or reassign their tier (task spec: 'Set as Tier 1' / 'Set as Tier 2'). Only changed fields are applied."""
    contact = _get_owned_contact(db, contact_id, requester)
    if body.contact_name is not None:
        contact.contact_name = body.contact_name
    if body.relationship is not None:
        contact.relationship_label = body.relationship
    if body.phone_number is not None:
        contact.phone_number = body.phone_number
    if body.contact_type is not None:
        contact.contact_type = body.contact_type.value
    db.commit()
    db.refresh(contact)
    return _to_out(contact)


@router.delete("/contacts/detail/{contact_id}", status_code=204)
def delete_contact(contact_id: str, db: Session = Depends(get_db), requester: Requester = Depends(get_current_requester)):
    contact = _get_owned_contact(db, contact_id, requester)
    db.delete(contact)
    db.commit()
    return None
