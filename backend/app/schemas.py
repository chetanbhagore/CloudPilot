from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field

# ─── Health & System Schemas ───────────────────────────────────────────────────
class HealthResponse(BaseModel):
    status: str = "ok"
    version: str = "1.0.0"
    app_name: str = "CloudPilot Backend"
    mode: str = "hybrid-aws"
    timestamp: str

# ─── Account Connection Schemas ────────────────────────────────────────────────
class AccountConnectRequest(BaseModel):
    account_id: str = Field(..., description="12-digit AWS Account ID")
    role_arn: str = Field(..., description="Full ARN of CloudPilotAuditRole")
    external_id: str = Field(..., description="Unique tenant ExternalId condition")
    region: str = Field(default="ap-south-1", description="AWS Primary Region")

class AccountConnectResponse(BaseModel):
    success: bool
    account_id: str
    alias: str
    region: str
    role_arn: str
    assumed_role_user_arn: Optional[str] = None
    session_expiration: Optional[str] = None
    is_live: bool = True
    message: str

# ─── Finding & Telemetry Schemas (Matching Frontend Models) ────────────────────
class SafetyCheck(BaseModel):
    label: str
    passed: bool
    detail: str
    isBlocking: Optional[bool] = False

class TelemetryPoint(BaseModel):
    time: str
    label: str
    value: float

class ResourceModel(BaseModel):
    id: str
    type: str
    name: str
    region: str
    age: str
    tags: Dict[str, str] = {}

class FindingModel(BaseModel):
    id: str
    category: str  # 'cost' | 'security'
    severity: str  # 'critical' | 'high' | 'medium' | 'low'
    title: str
    description: str
    rule: str
    resource: ResourceModel
    evidence: List[str]
    estimatedMonthlyCost: Optional[float] = None
    estimatedSavings: Optional[float] = None
    status: str = "open"
    detectedAt: str
    affectedService: str
    recommendedAction: str
    operation: str
    operationParams: Dict[str, str] = {}
    preconditions: List[SafetyCheck] = []
    sideEffects: List[str] = []
    verificationPlan: List[str] = []
    recoveryGuidance: List[str] = []
    recoveryLimitations: str = "Rollback can be applied via AWS CLI using provided command."
    beforeState: str
    afterState: str
    isSafetyBlocked: Optional[bool] = False
    blockedReason: Optional[str] = None
    telemetryMetricName: str = "Volume Utilization"
    telemetryUnit: str = "IOPS"
    telemetryData: List[TelemetryPoint] = []

class DiscoveryRequest(BaseModel):
    account_id: str
    region: str = "ap-south-1"

class DiscoveryResponse(BaseModel):
    success: bool
    account_id: str
    region: str
    scanned_at: str
    resource_count: int
    findings: List[FindingModel]

# ─── Approval & Remediation Schemas ────────────────────────────────────────────
class ApproveRequest(BaseModel):
    finding_id: str
    user_email: str = "chetan@cloudpilot.io"
    simulate_only: bool = False

class ApproveResponse(BaseModel):
    success: bool
    finding_id: str
    action: str
    resource_id: str
    outcome: str
    before_state: str
    after_state: str
    aws_request_id: str
    canonical_payload: str
    integrity_hash: str
    timestamp: str
