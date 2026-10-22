"""
Phase 15: AI Explanations & Commercial Readiness Tests
Non-negotiable Rules:
- Ground every explanation in verified AWS evidence; NEVER fabricate telemetry, prices, or account state.
- Clear distinction between 'observed_facts', 'ai_analysis', and 'recommended_actions'.
- Explicitly document uncertainty, assumptions, and unverified boundary conditions.
- AI CANNOT grant permissions or independently authorize or execute remediation.
- Proposed actions are strictly validated against the server-side Action Registry.
- Tenant isolation enforced on explanation endpoints.
"""

import unittest
import sys
from pathlib import Path
from fastapi import HTTPException

sys.path.insert(0, str(Path(__file__).parent.parent))

from app.schemas import FindingModel, ResourceModel
from app.services.ai_explainer import generate_finding_explanation
from app.services.auth import AuthenticatedUser, ROLE_PERMISSIONS
from app.routers.ai_explain import get_finding_explanation
from app.db.database import init_database_schema, FindingRepository


class TestPhase15AIReadiness(unittest.TestCase):
    def setUp(self):
        init_database_schema()

        self.sample_finding = FindingModel(
            id="live-sg-ai-test-01",
            category="security",
            severity="critical",
            title="SSH (port 22) open to world (0.0.0.0/0)",
            description="Security group sg-0123456789abcdef0 allows inbound 0.0.0.0/0:22",
            rule="SEC-SG-001",
            resource=ResourceModel(
                id="sg-0123456789abcdef0",
                type="AWS::EC2::SecurityGroup",
                name="bastion-sg",
                region="ap-south-1",
                age="14d",
                account_id="123456789012"
            ),
            evidence=[
                "Source API: ec2:DescribeSecurityGroups",
                "Rule: TCP:22 from 0.0.0.0/0"
            ],
            status="open",
            detectedAt="2026-10-23T01:00:00Z",
            affectedService="Amazon VPC",
            recommendedAction="Revoke 0.0.0.0/0 rule",
            operation="ec2:RevokeSecurityGroupIngress",
            operationParams={"GroupId": "sg-0123456789abcdef0", "CidrIp": "0.0.0.0/0", "FromPort": "22", "ToPort": "22"},
            recoveryGuidance=["aws ec2 authorize-security-group-ingress"],
            beforeState="TCP:22 OPEN",
            afterState="TCP:22 CLOSED",
            execution_mode="live",
            organization_id="org-acme-prod"
        )

    def test_ai_explanation_grounds_in_verified_facts(self):
        """AI explanation extracts real facts from finding evidence and does not invent data."""
        explanation = generate_finding_explanation(self.sample_finding)

        self.assertEqual(explanation.finding_id, self.sample_finding.id)
        self.assertEqual(explanation.resource_id, "sg-0123456789abcdef0")
        self.assertEqual(explanation.evidence_provenance, "Live AWS API Telemetry")

        # Verify observed facts match actual evidence
        facts_text = " ".join(explanation.observed_facts)
        self.assertIn("ec2:DescribeSecurityGroups", facts_text)
        self.assertIn("TCP:22 from 0.0.0.0/0", facts_text)
        self.assertIn("sg-0123456789abcdef0", facts_text)

    def test_ai_explanation_validates_action_registry(self):
        """Proposed remediation action is checked against server-side Action Registry."""
        # 1. Registered action
        explanation = generate_finding_explanation(self.sample_finding)
        self.assertTrue(explanation.is_action_supported_by_engine)
        self.assertEqual(explanation.action_type, "ec2:RevokeSecurityGroupIngress")

        # 2. Unregistered/unsupported action
        fake_finding = self.sample_finding.model_copy(deep=True)
        fake_finding.operation = "s3:ArbitraryUnsafeMutation"
        fake_explanation = generate_finding_explanation(fake_finding)
        self.assertFalse(fake_explanation.is_action_supported_by_engine)

    def test_ai_explanation_includes_uncertainty_and_disclaimer(self):
        """Explanation explicitly communicates unverified boundary conditions and advisory nature."""
        explanation = generate_finding_explanation(self.sample_finding)

        self.assertTrue(len(explanation.uncertainty_and_limitations) > 0)
        uncertainty_text = " ".join(explanation.uncertainty_and_limitations)
        self.assertIn("CloudPilot cannot inspect external corporate firewalls", uncertainty_text)

        # Non-negotiable disclaimer that AI cannot authorize changes
        self.assertIn("AI cannot authorize or execute cloud mutations", explanation.disclaimer)

    def test_ai_explanation_endpoint_tenant_isolation(self):
        """User from Org B cannot query AI explanation for finding belonging to Org A."""
        # Save finding to Org A in persistent SQLite database
        FindingRepository.save_finding("org-acme-prod", self.sample_finding.model_dump())

        # Attacker user from Org B
        attacker_user = AuthenticatedUser(
            user_id="usr-evil-01",
            email="attacker@evilcorp.io",
            organization_id="org-evil-tenant",
            role="DevOpsLead",
            permissions=ROLE_PERMISSIONS["DevOpsLead"]
        )

        with self.assertRaises(HTTPException) as ctx:
            get_finding_explanation(
                finding_id=self.sample_finding.id,
                mode="live",
                current_user=attacker_user
            )
        # Must be 404 Not Found (tenant scoped) or 403 Forbidden
        self.assertIn(ctx.exception.status_code, [403, 404])


if __name__ == "__main__":
    unittest.main()
