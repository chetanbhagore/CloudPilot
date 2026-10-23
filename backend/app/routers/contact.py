"""Contact and Support Ticket Router for CloudPilot.

Handles user inquiries, enterprise pilot requests, security disclosures, and support tickets.
Stores submissions in SQLite and sends structured acknowledgements.
"""

from __future__ import annotations

import logging
import re
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel, Field

from app.db.database import get_db_transaction

logger = logging.getLogger("cloudpilot.contact")

router = APIRouter(prefix="/contact", tags=["Contact & Support"])

EMAIL_REGEX = re.compile(r"^[\w\.-]+@([\w-]+\.)+[\w-]{2,63}$")

VALID_CATEGORIES = [
    "enterprise_pilot",
    "technical_support",
    "security_disclosure",
    "billing_inquiry",
    "general"
]


class ContactSubmissionRequest(BaseModel):
    name: str = Field(..., min_length=2, max_length=100, description="Full name of requester")
    email: str = Field(..., min_length=5, max_length=150, description="Contact email address")
    organization: Optional[str] = Field(default="", max_length=120, description="Organization / Company name")
    category: str = Field(default="general", description="Inquiry category")
    subject: str = Field(..., min_length=3, max_length=150, description="Short summary of inquiry")
    message: str = Field(..., min_length=10, max_length=3000, description="Detailed inquiry or ticket message")


class ContactSubmissionResponse(BaseModel):
    success: bool
    ticket_id: str
    message: str
    category: str
    received_at: str


@router.get("/categories", summary="List supported contact inquiry categories")
def get_contact_categories() -> Dict[str, Any]:
    return {
        "categories": [
            {"id": "enterprise_pilot", "label": "Enterprise Multi-Cloud Pilot Request"},
            {"id": "technical_support", "label": "Technical & Deployment Support"},
            {"id": "security_disclosure", "label": "Vulnerability & Security Disclosure"},
            {"id": "billing_inquiry", "label": "Billing & Licensing Questions"},
            {"id": "general", "label": "General Question or Feedback"}
        ]
    }


@router.post("", response_model=ContactSubmissionResponse, status_code=status.HTTP_201_CREATED, summary="Submit a contact or support inquiry")
@router.post("/submit", response_model=ContactSubmissionResponse, status_code=status.HTTP_201_CREATED)
def submit_contact_form(payload: ContactSubmissionRequest) -> ContactSubmissionResponse:
    # 1. Validate email format
    clean_email = payload.email.strip().lower()
    if not EMAIL_REGEX.match(clean_email):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid email address '{payload.email}'. Please provide a valid email."
        )

    # 2. Validate category
    cat = payload.category.strip().lower()
    if cat not in VALID_CATEGORIES:
        cat = "general"

    # 3. Generate Ticket ID
    ticket_id = f"CP-TICK-{uuid.uuid4().hex[:8].upper()}"
    now_iso = datetime.now(timezone.utc).isoformat()

    # 4. Record to SQLite database
    try:
        with get_db_transaction() as conn:
            conn.execute("""
            INSERT INTO contact_submissions (
                id, name, email, organization, category, subject, message, status, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, 'received', ?)
            """, (
                ticket_id,
                payload.name.strip(),
                clean_email,
                (payload.organization or "").strip(),
                cat,
                payload.subject.strip(),
                payload.message.strip(),
                now_iso
            ))
    except Exception as e:
        logger.error(f"[Contact] Failed to store contact submission: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Unable to record support ticket. Please reach out directly to support@cloudpilot.io."
        )

    logger.info(f"[Contact] New {cat} inquiry received from {clean_email} [Ticket: {ticket_id}]")

    return ContactSubmissionResponse(
        success=True,
        ticket_id=ticket_id,
        message="Thank you for reaching out to CloudPilot! Our team has received your inquiry and will respond shortly.",
        category=cat,
        received_at=now_iso
    )
