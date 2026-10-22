import unittest
from unittest.mock import MagicMock, patch
import os
import sys

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.schemas import DiscoveryRequest
from app.services.aws_discovery import scan_account_live
from app.routers.discovery import run_discovery_scan, _cached_findings, _active_scans
from app.routers.accounts import _connected_accounts

class TestPhase3RealDiscovery(unittest.TestCase):
    def setUp(self):
        _cached_findings.clear()
        _active_scans.clear()
        _connected_accounts.clear()

    # ── Test 1: Real AWS responses are the only source of findings ──────────────
    def test_real_aws_response_generates_verified_finding(self):
        mock_ec2 = MagicMock()
        # Mock volumes paginator with 1 unattached volume
        mock_vol_paginator = MagicMock()
        mock_vol_paginator.paginate.return_value = [
            {
                "Volumes": [
                    {
                        "VolumeId": "vol-0123456789abcdef0",
                        "Size": 100,
                        "VolumeType": "gp3",
                        "status": "available",
                        "AvailabilityZone": "ap-south-1a",
                        "Tags": [{"Key": "Env", "Value": "Production"}]
                    }
                ]
            }
        ]

        # Mock security groups paginator with 0 open groups
        mock_sg_paginator = MagicMock()
        mock_sg_paginator.paginate.return_value = [{"SecurityGroups": []}]

        def paginator_side_effect(service_name):
            if service_name == "describe_volumes":
                return mock_vol_paginator
            return mock_sg_paginator

        mock_ec2.get_paginator.side_effect = paginator_side_effect

        live_creds = {
            "access_key_id": "AKIAEXAMPLE",
            "secret_access_key": "SECRETEXAMPLE",
            "session_token": "TOKENEXAMPLE",
            "is_simulated": False,
            "execution_mode": "live"
        }

        with patch("app.services.aws_discovery.get_ec2_client", return_value=mock_ec2):
            findings, count, successful, failed, errors = scan_account_live(
                account_id="123456789012",
                region="ap-south-1",
                credentials=live_creds,
                scan_id="scan-test-101"
            )

            self.assertEqual(len(findings), 1)
            finding = findings[0]
            self.assertEqual(finding.id, "live-ebs-vol-0123456789abcdef0")
            self.assertEqual(finding.resource.id, "vol-0123456789abcdef0")
            self.assertEqual(finding.scan_id, "scan-test-101")
            self.assertEqual(finding.account_id, "123456789012")
            self.assertEqual(finding.estimatedMonthlyCost, 8.0)  # 100 GiB * 0.08
            self.assertEqual(count, 1)
            self.assertEqual(successful, ["ap-south-1"])
            self.assertEqual(failed, [])

    # ── Test 2: Pagination across multiple pages ────────────────────────────────
    def test_pagination_across_multiple_pages(self):
        mock_ec2 = MagicMock()
        mock_vol_paginator = MagicMock()
        # Page 1: 2 volumes; Page 2: 1 volume
        mock_vol_paginator.paginate.return_value = [
            {
                "Volumes": [
                    {"VolumeId": "vol-1", "Size": 10, "VolumeType": "gp3", "status": "available"},
                    {"VolumeId": "vol-2", "Size": 20, "VolumeType": "gp3", "status": "available"}
                ]
            },
            {
                "Volumes": [
                    {"VolumeId": "vol-3", "Size": 30, "VolumeType": "gp3", "status": "available"}
                ]
            }
        ]

        mock_sg_paginator = MagicMock()
        mock_sg_paginator.paginate.return_value = [{"SecurityGroups": []}]

        mock_ec2.get_paginator.side_effect = lambda name: mock_vol_paginator if name == "describe_volumes" else mock_sg_paginator

        live_creds = {
            "access_key_id": "AKIAEXAMPLE",
            "secret_access_key": "SECRET",
            "is_simulated": False,
            "execution_mode": "live"
        }

        with patch("app.services.aws_discovery.get_ec2_client", return_value=mock_ec2):
            findings, count, successful, failed, errors = scan_account_live(
                account_id="123456789012",
                region="ap-south-1",
                credentials=live_creds
            )
            self.assertEqual(len(findings), 3)
            self.assertEqual(count, 3)

    # ── Test 3: Multi-region partial scan failure ───────────────────────────────
    def test_multi_region_partial_scan(self):
        # Region 1: ap-south-1 succeeds with 0 volumes
        mock_ec2_mumbai = MagicMock()
        mock_paginator_ok = MagicMock()
        mock_paginator_ok.paginate.return_value = [{"Volumes": []}, {"SecurityGroups": []}]
        mock_ec2_mumbai.get_paginator.return_value = mock_paginator_ok

        # Region 2: us-east-1 fails with UnauthorizedOperation
        mock_ec2_virginia = MagicMock()
        from botocore.exceptions import ClientError
        mock_ec2_virginia.get_paginator.side_effect = ClientError(
            {"Error": {"Code": "UnauthorizedOperation", "Message": "You are not authorized to perform this operation."}},
            "DescribeVolumes"
        )

        def client_by_region(creds, region):
            if region == "ap-south-1":
                return mock_ec2_mumbai
            elif region == "us-east-1":
                return mock_ec2_virginia
            return None

        live_creds = {
            "access_key_id": "AKIAEXAMPLE",
            "secret_access_key": "SECRET",
            "is_simulated": False,
            "execution_mode": "live"
        }

        with patch("app.services.aws_discovery.get_ec2_client", side_effect=client_by_region):
            findings, count, successful, failed, errors = scan_account_live(
                account_id="123456789012",
                region="ap-south-1",
                credentials=live_creds,
                regions=["ap-south-1", "us-east-1"]
            )
            self.assertEqual(successful, ["ap-south-1"])
            self.assertEqual(failed, ["us-east-1"])
            self.assertIn("us-east-1", errors)

    # ── Test 4: Concurrency protection blocks overlapping scans ─────────────────
    def test_concurrent_scan_protection(self):
        from fastapi import HTTPException
        _active_scans.add("live:123456789012")

        req = DiscoveryRequest(
            account_id="123456789012",
            region="ap-south-1",
            mode="live"
        )
        with self.assertRaises(HTTPException) as ctx:
            run_discovery_scan(req)
        self.assertEqual(ctx.exception.status_code, 409)

if __name__ == "__main__":
    unittest.main()
