"""
Phase 11: Defensible Cost Intelligence & AWS Regional Pricing Tests
Non-negotiable Rules:
- Transparent, reproducible formulas based on AWS regional price tables.
- Defensible distinction between potential, approved, verified resource change, and realized billing savings.
- Never claim a resource change caused a billing reduction without evidence.
- Regional and resource-type calculations are fully tested.
"""

import unittest
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from app.services.cost_engine import (
    calculate_ebs_cost_estimate,
    calculate_ec2_cost_estimate,
    calculate_savings_summary,
    get_ebs_rate,
    EBS_STORAGE_RATES,
    EC2_ON_DEMAND_HOURLY
)
from app.services.auth import AuthenticatedUser
from app.routers.cost import (
    get_cost_savings_summary,
    estimate_resource_cost,
    EstimateResourceCostRequest
)
from app.db.database import (
    FindingRepository,
    init_database_schema,
    get_db_transaction
)


class TestPhase11CostIntelligence(unittest.IsolatedAsyncioTestCase):
    def setUp(self):
        init_database_schema()
        self.org_id = "org-cost-test"
        with get_db_transaction() as conn:
            conn.execute("DELETE FROM findings WHERE organization_id = ?", (self.org_id,))
            conn.execute(
                "INSERT OR IGNORE INTO organizations (id, name, created_at) VALUES (?, 'Cost Test Org', datetime('now'))",
                (self.org_id,)
            )

        self.user = AuthenticatedUser(
            user_id="usr-cost-eng",
            organization_id=self.org_id,
            email="finops@cost-test.com",
            role="DevOpsLead",
            permissions=["view:findings", "approve:remediation"]
        )

    def test_ebs_pricing_by_region_and_volume_type(self):
        """Verifies reproducible calculations for different storage tiers and AWS regions."""
        # Test 1: gp3 in ap-south-1 (100 GiB * $0.080 = $8.00)
        est_gp3_mumbai = calculate_ebs_cost_estimate(
            region="ap-south-1",
            volume_type="gp3",
            size_gb=100.0,
            resource_id="vol-test-01"
        )
        self.assertEqual(est_gp3_mumbai.estimated_monthly_cost, 8.0)
        self.assertEqual(est_gp3_mumbai.rate_applied, 0.080)
        self.assertIn("100.0 GiB * $0.0800/GiB-mo", est_gp3_mumbai.formula)
        self.assertEqual(est_gp3_mumbai.savings_stage, "potential_unverified")
        self.assertEqual(est_gp3_mumbai.confidence_level, "high")

        # Test 2: gp2 in us-east-1 (50 GiB * $0.100 = $5.00)
        est_gp2_useast = calculate_ebs_cost_estimate(
            region="us-east-1",
            volume_type="gp2",
            size_gb=50.0,
            resource_id="vol-test-02"
        )
        self.assertEqual(est_gp2_useast.estimated_monthly_cost, 5.0)
        self.assertEqual(est_gp2_useast.rate_applied, 0.100)

        # Test 3: io1 in eu-west-1 (200 GiB * $0.138 = $27.60)
        est_io1_eu = calculate_ebs_cost_estimate(
            region="eu-west-1",
            volume_type="io1",
            size_gb=200.0,
            resource_id="vol-test-03"
        )
        self.assertEqual(est_io1_eu.estimated_monthly_cost, 27.6)

    def test_ebs_provisioned_iops_and_throughput(self):
        """gp3 extra IOPS (>3000) and extra throughput (>125 MB/s) are factored into formulas."""
        # 100 GiB gp3 ($8.00) + 2,000 extra IOPS ($10.00) + 125 MB/s extra throughput ($5.00) = $23.00
        est_provisioned = calculate_ebs_cost_estimate(
            region="us-east-1",
            volume_type="gp3",
            size_gb=100.0,
            iops=5000,
            throughput_mbps=250,
            resource_id="vol-high-perf"
        )
        self.assertEqual(est_provisioned.estimated_monthly_cost, 23.0)
        self.assertIn("2000 extra IOPS", est_provisioned.formula)
        self.assertIn("125 MB/s extra", est_provisioned.formula)

    def test_ec2_pricing_by_instance_type_and_region(self):
        """Verifies compute hourly rates and 730 hours/month baseline extrapolation."""
        # t3.micro in ap-south-1 ($0.0114/hr * 730 = $8.32)
        est_t3 = calculate_ec2_cost_estimate(
            region="ap-south-1",
            instance_type="t3.micro",
            resource_id="i-test-01"
        )
        self.assertEqual(est_t3.rate_applied, 0.0114)
        self.assertEqual(est_t3.estimated_monthly_cost, 8.32)
        self.assertIn("730 hrs/month", est_t3.formula)

    def test_savings_summary_defensible_stages(self):
        """Savings summary separates potential, approved, verified resource, and realized billing."""
        mock_findings = [
            # Open cost finding -> Potential ($8.00)
            {
                "id": "find-1",
                "category": "cost",
                "status": "open",
                "estimatedMonthlyCost": 8.0,
                "affectedService": "Amazon EC2 (Elastic Block Store)"
            },
            # Approved cost finding -> Approved ($50.00)
            {
                "id": "find-2",
                "category": "cost",
                "status": "approved",
                "estimatedMonthlyCost": 50.0,
                "affectedService": "Amazon EC2"
            },
            # Resolved finding -> Verified Resource Change ($15.00)
            {
                "id": "find-3",
                "category": "cost",
                "status": "resolved",
                "estimatedMonthlyCost": 15.0,
                "affectedService": "Amazon EC2 (Elastic Block Store)"
            },
            # Security finding -> should NOT be included in cost totals
            {
                "id": "find-4",
                "category": "security",
                "status": "open",
                "estimatedMonthlyCost": None,
                "affectedService": "Amazon VPC"
            }
        ]

        summary = calculate_savings_summary(mock_findings)
        stages = summary["stages"]

        self.assertEqual(stages["potential_savings"]["amount_usd"], 8.0)
        self.assertEqual(stages["approved_savings"]["amount_usd"], 50.0)
        self.assertEqual(stages["verified_resource_savings"]["amount_usd"], 15.0)

        # Realized billing CANNOT be claimed without billing integration!
        self.assertEqual(stages["realized_billing_confirmed"]["amount_usd"], 0.0)
        self.assertFalse(stages["realized_billing_confirmed"]["has_billing_integration"])
        self.assertIn("Cost Explorer", stages["realized_billing_confirmed"]["description"])

    async def test_cost_api_endpoints(self):
        """Tests /cost/summary and /cost/estimate API endpoints."""
        # Seed 1 open finding into DB for test tenant
        FindingRepository.save_finding(self.org_id, {
            "id": "find-db-cost-1",
            "category": "cost",
            "status": "open",
            "estimatedMonthlyCost": 25.0,
            "estimatedSavings": 25.0,
            "affectedService": "Amazon EC2 (Elastic Block Store)",
            "title": "Unattached volume",
            "execution_mode": "live",
            "detectedAt": "2026-10-23T01:00:00Z",
            "resource": {"id": "vol-123", "type": "AWS::EC2::Volume", "region": "ap-south-1"}
        })

        # 1. GET /cost/summary
        summary = await get_cost_savings_summary(mode="live", current_user=self.user)
        self.assertEqual(summary["organization_id"], self.org_id)
        self.assertEqual(summary["stages"]["potential_savings"]["amount_usd"], 25.0)
        self.assertEqual(summary["findings_analyzed"], 1)

        # 2. POST /cost/estimate (EBS)
        ebs_req = EstimateResourceCostRequest(
            service="ebs",
            region="us-east-1",
            volume_type="gp3",
            size_gb=200.0
        )
        ebs_est = await estimate_resource_cost(ebs_req, current_user=self.user)
        self.assertEqual(ebs_est.estimated_monthly_cost, 16.0)  # 200 * 0.08

        # 3. POST /cost/estimate (EC2)
        ec2_req = EstimateResourceCostRequest(
            service="ec2",
            region="us-east-1",
            instance_type="t3.micro"
        )
        ec2_est = await estimate_resource_cost(ec2_req, current_user=self.user)
        self.assertEqual(ec2_est.rate_applied, 0.0104)
        self.assertEqual(ec2_est.estimated_monthly_cost, 7.59)  # 0.0104 * 730


if __name__ == "__main__":
    unittest.main()
