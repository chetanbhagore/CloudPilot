import re
import uuid
import logging
from datetime import datetime, timezone
from typing import Dict, Any, Optional, List, Callable, Literal
from pydantic import BaseModel, Field

try:
    import boto3
    from botocore.exceptions import ClientError
except ImportError:
    boto3 = None
    ClientError = Exception

logger = logging.getLogger("cloudpilot.remediation")

ExecutionState = Literal[
    "pending_approval",
    "approved",
    "executing",
    "verification_pending",
    "succeeded",
    "failed",
    "verification_failed",
    "cancelled"
]

class RemediationExecutionRecord(BaseModel):
    execution_id: str
    idempotency_key: str
    finding_id: str
    action_type: str
    target_resource_id: str
    account_id: str
    region: str
    parameters: Dict[str, Any]
    state: ExecutionState
    actor_email: str
    execution_mode: str = "live"
    created_at: str
    executed_at: Optional[str] = None
    verified_at: Optional[str] = None
    aws_request_id: Optional[str] = None
    error_message: Optional[str] = None
    before_state: Optional[str] = None
    after_state: Optional[str] = None
    verification_evidence: List[str] = []
    rollback_guidance: Optional[str] = None

class RemediationActionDefinition(BaseModel):
    action_type: str
    resource_type: str
    required_permissions: List[str]
    risk_level: str  # 'low' | 'medium' | 'high'
    is_reversible: bool
    parameter_validators: Dict[str, Any] = {}
    description: str

# ── Action Registry ─────────────────────────────────────────────────────────────
class ActionRegistry:
    def __init__(self):
        self._actions: Dict[str, RemediationActionDefinition] = {}

    def register(self, action_def: RemediationActionDefinition):
        self._actions[action_def.action_type] = action_def

    def get(self, action_type: str) -> Optional[RemediationActionDefinition]:
        return self._actions.get(action_type)

action_registry = ActionRegistry()

# Register initial low-risk, reversible remediation vertical slice:
# ec2:RevokeSecurityGroupIngress (Port 22 0.0.0.0/0)
action_registry.register(
    RemediationActionDefinition(
        action_type="ec2:RevokeSecurityGroupIngress",
        resource_type="AWS::EC2::SecurityGroup",
        required_permissions=[
            "ec2:RevokeSecurityGroupIngress",
            "ec2:DescribeSecurityGroups"
        ],
        risk_level="low",
        is_reversible=True,
        description="Revokes public 0.0.0.0/0 inbound rule on TCP port 22 for a target Security Group."
    )
)

SG_ID_REGEX = re.compile(r"^sg-[0-9a-fA-F]{8,17}$")

def validate_action_parameters(action_type: str, resource_id: str, params: Dict[str, Any]):
    """Validates parameters against strict canonical schema for the registered action."""
    action_def = action_registry.get(action_type)
    if not action_def:
        raise ValueError(f"Action '{action_type}' is not registered in CloudPilot remediation registry.")

    if action_type == "ec2:RevokeSecurityGroupIngress":
        group_id = params.get("GroupId") or resource_id
        if not SG_ID_REGEX.match(group_id):
            raise ValueError(f"Invalid Security Group ID '{group_id}'. Expected format: sg-xxxxxxxx or sg-xxxxxxxxxxxxxxxxx.")
        
        protocol = str(params.get("IpProtocol") or params.get("Protocol") or "tcp").lower()
        if protocol not in ["tcp", "-1"]:
            raise ValueError(f"Invalid protocol '{protocol}'. Expected 'tcp'.")
        
        from_port = int(params.get("FromPort") or params.get("Port") or 22)
        to_port = int(params.get("ToPort") or params.get("Port") or 22)
        if from_port != 22 or to_port != 22:
            raise ValueError(f"Port range must be exact port 22 (SSH). Received {from_port}-{to_port}.")
            
        cidr = params.get("CidrIp", "0.0.0.0/0")
        if cidr != "0.0.0.0/0":
            raise ValueError(f"CidrIp must be exactly '0.0.0.0/0'. Received '{cidr}'.")

# In-memory execution store and idempotency cache
_execution_records: Dict[str, RemediationExecutionRecord] = {}
_idempotency_index: Dict[str, str] = {}  # idempotency_key -> execution_id

def execute_live_remediation(
    account_id: str,
    region: str,
    resource_id: str,
    action_type: str,
    parameters: Dict[str, Any],
    actor_email: str,
    finding_id: str,
    credentials: Dict[str, Any],
    idempotency_key: str,
    mode: str = "live"
) -> RemediationExecutionRecord:
    """
    Executes a registered remediation action against AWS.
    End-to-End Workflow:
      1. Idempotency Check: prevent duplicate calls.
      2. Server-side validation against Action Registry.
      3. Pre-flight state verification via Describe API.
      4. AWS mutation call. Capture real RequestId.
      5. Independent read verification via Describe API.
      6. Record outcome in state machine.
    """
    # ── 1. Idempotency Check ──
    if idempotency_key in _idempotency_index:
        existing_id = _idempotency_index[idempotency_key]
        existing = _execution_records.get(existing_id)
        if existing:
            logger.warning(f"[Remediation] Idempotency key collision '{idempotency_key}'. Returning existing record.")
            return existing

    # ── Demo Mode Handling ──
    if mode == "demo" or credentials.get("is_simulated", False):
        exec_id = f"exec-demo-{uuid.uuid4().hex[:8]}"
        now_iso = datetime.now(timezone.utc).isoformat()
        demo_record = RemediationExecutionRecord(
            execution_id=exec_id,
            idempotency_key=idempotency_key,
            finding_id=finding_id,
            action_type=action_type,
            target_resource_id=resource_id,
            account_id=account_id,
            region=region,
            parameters=parameters,
            state="succeeded",
            actor_email=actor_email,
            execution_mode="demo",
            created_at=now_iso,
            executed_at=now_iso,
            verified_at=now_iso,
            aws_request_id=f"demo-req-{uuid.uuid4().hex[:8]}",
            before_state="[DEMO SIMULATION] TCP:22 from 0.0.0.0/0: ACTIVE",
            after_state="[DEMO SIMULATION] TCP:22 from 0.0.0.0/0: REVOKED (VERIFIED ✓)",
            verification_evidence=["[DEMO] Simulated verification Describe check passed."],
            rollback_guidance=f"aws ec2 authorize-security-group-ingress --group-id {resource_id} --protocol tcp --port 22 --cidr 0.0.0.0/0 --region {region}"
        )
        _execution_records[exec_id] = demo_record
        _idempotency_index[idempotency_key] = exec_id
        return demo_record

    # ── 2. Parameter Validation ──
    validate_action_parameters(action_type, resource_id, parameters)

    exec_id = f"exec-{uuid.uuid4().hex[:10]}"
    now_iso = datetime.now(timezone.utc).isoformat()
    record = RemediationExecutionRecord(
        execution_id=exec_id,
        idempotency_key=idempotency_key,
        finding_id=finding_id,
        action_type=action_type,
        target_resource_id=resource_id,
        account_id=account_id,
        region=region,
        parameters=parameters,
        state="executing",
        actor_email=actor_email,
        execution_mode="live",
        created_at=now_iso,
        rollback_guidance=f"aws ec2 authorize-security-group-ingress --group-id {resource_id} --protocol tcp --port 22 --cidr 0.0.0.0/0 --region {region}"
    )
    _execution_records[exec_id] = record
    _idempotency_index[idempotency_key] = exec_id

    # ── 3. Initialize AWS EC2 Client with Temporary Remediation Credentials ──
    from app.services.aws_sts import get_ec2_client
    ec2_client = get_ec2_client(credentials, region=region)
    if not ec2_client:
        record.state = "failed"
        record.error_message = "Failed to initialize live boto3 EC2 client for remediation."
        return record

    # ── 4. Pre-Flight Verification: Does the target rule still exist? ──
    try:
        sgs = ec2_client.describe_security_groups(GroupIds=[resource_id]).get("SecurityGroups", [])
        if not sgs:
            record.state = "failed"
            record.error_message = f"Pre-flight failed: Target Security Group '{resource_id}' does not exist in {region}."
            return record

        sg = sgs[0]
        rule_found = False
        for perm in sg.get("IpPermissions", []):
            from_p = perm.get("FromPort")
            to_p = perm.get("ToPort")
            proto = perm.get("IpProtocol", "")
            if (proto == "tcp" and from_p <= 22 <= to_p) or proto == "-1":
                for ip_range in perm.get("IpRanges", []):
                    if ip_range.get("CidrIp") == "0.0.0.0/0":
                        rule_found = True
                        break
        
        if not rule_found:
            # Rule was already removed or does not exist
            record.state = "succeeded"
            record.before_state = "TCP:22 from 0.0.0.0/0: NOT FOUND"
            record.after_state = "TCP:22 from 0.0.0.0/0: ABSENT (ALREADY SECURE ✓)"
            record.verified_at = datetime.now(timezone.utc).isoformat()
            record.verification_evidence = ["Pre-flight check confirmed rule was already absent in security group."]
            return record

        record.before_state = "TCP:22 from 0.0.0.0/0: ACTIVE (CRITICAL EXPOSURE)"

    except Exception as e:
        record.state = "failed"
        record.error_message = f"Pre-flight verification error: {str(e)}"
        return record

    # ── 5. Dispatch Live AWS Mutation API ──
    try:
        logger.info(f"[Remediation] Executing live {action_type} on {resource_id} in {region}")
        mutate_res = ec2_client.revoke_security_group_ingress(
            GroupId=resource_id,
            IpProtocol="tcp",
            FromPort=22,
            ToPort=22,
            CidrIp="0.0.0.0/0"
        )
        record.executed_at = datetime.now(timezone.utc).isoformat()
        resp_metadata = mutate_res.get("ResponseMetadata", {})
        record.aws_request_id = resp_metadata.get("RequestId")
        record.state = "verification_pending"
        logger.info(f"[Remediation] Mutation succeeded. RequestId: {record.aws_request_id}")

    except ClientError as e:
        code = e.response.get("Error", {}).get("Code", "Unknown")
        msg = e.response.get("Error", {}).get("Message", str(e))
        record.state = "failed"
        record.error_message = f"AWS API execution rejected [{code}]: {msg}"
        logger.error(f"[Remediation] Execution failed: {record.error_message}")
        return record
    except Exception as e:
        record.state = "failed"
        record.error_message = f"Unexpected execution error: {str(e)}"
        return record

    # ── 6. Independent Read Verification via Describe API ──
    try:
        verify_sgs = ec2_client.describe_security_groups(GroupIds=[resource_id]).get("SecurityGroups", [])
        if not verify_sgs:
            record.state = "verification_failed"
            record.error_message = "Verification failed: Security Group could not be re-read after mutation."
            return record

        verify_sg = verify_sgs[0]
        still_present = False
        for perm in verify_sg.get("IpPermissions", []):
            from_p = perm.get("FromPort")
            to_p = perm.get("ToPort")
            proto = perm.get("IpProtocol", "")
            if (proto == "tcp" and from_p <= 22 <= to_p) or proto == "-1":
                for ip_range in perm.get("IpRanges", []):
                    if ip_range.get("CidrIp") == "0.0.0.0/0":
                        still_present = True
                        break

        if still_present:
            record.state = "verification_failed"
            record.error_message = "Verification failed: 0.0.0.0/0:22 ingress rule is still present after revoke call."
            logger.error(f"[Remediation] {record.error_message}")
            return record

        record.state = "succeeded"
        record.after_state = "TCP:22 from 0.0.0.0/0: REVOKED (VERIFIED ✓)"
        record.verified_at = datetime.now(timezone.utc).isoformat()
        record.verification_evidence = [
            f"Independent ec2:DescribeSecurityGroups read completed at {record.verified_at}",
            "Asserted 0.0.0.0/0:22 rule is absent from active IpPermissions list",
            f"AWS RequestId: {record.aws_request_id}"
        ]
        logger.info(f"[Remediation] Verification PASSED for {resource_id}. Finding can be marked resolved.")
        return record

    except Exception as e:
        record.state = "verification_failed"
        record.error_message = f"Verification read error: {str(e)}"
        return record
