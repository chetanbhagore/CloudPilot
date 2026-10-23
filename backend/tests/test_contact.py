"""Tests for Contact & Support Router."""

import unittest
from app.routers.contact import (
    ContactSubmissionRequest,
    get_contact_categories,
    submit_contact_form,
)
from app.db.database import get_db_connection, init_database_schema
from fastapi import HTTPException


class TestContactRouter(unittest.TestCase):
    def setUp(self):
        init_database_schema()

    def test_get_categories(self):
        res = get_contact_categories()
        self.assertIn("categories", res)
        cat_ids = [c["id"] for c in res["categories"]]
        self.assertIn("enterprise_pilot", cat_ids)
        self.assertIn("technical_support", cat_ids)
        self.assertIn("security_disclosure", cat_ids)

    def test_submit_valid_contact_form(self):
        req = ContactSubmissionRequest(
            name="Alice CloudArchitect",
            email="alice@acmetech.io",
            organization="Acme Technologies",
            category="enterprise_pilot",
            subject="Interested in Azure & AWS multi-cloud trial",
            message="We would like to test the Safety Passport feature with 50 cloud accounts."
        )
        res = submit_contact_form(req)
        self.assertTrue(res.success)
        self.assertTrue(res.ticket_id.startswith("CP-TICK-"))
        self.assertEqual(res.category, "enterprise_pilot")

        # Verify recorded in SQLite database
        conn = get_db_connection()
        try:
            row = conn.execute("SELECT * FROM contact_submissions WHERE id = ?", (res.ticket_id,)).fetchone()
            self.assertIsNotNone(row)
            self.assertEqual(row["email"], "alice@acmetech.io")
            self.assertEqual(row["name"], "Alice CloudArchitect")
        finally:
            conn.close()

    def test_submit_invalid_email(self):
        req = ContactSubmissionRequest(
            name="Bob Attacker",
            email="not-an-email",
            subject="Spam",
            message="This is a test spam message with invalid email format."
        )
        with self.assertRaises(HTTPException) as ctx:
            submit_contact_form(req)
        self.assertEqual(ctx.exception.status_code, 400)


if __name__ == "__main__":
    unittest.main()
