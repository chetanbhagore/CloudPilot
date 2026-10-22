from typing import Optional, List, Dict, Any, Literal
from pydantic import BaseModel, Field

# ─── Execution Modes & Status Types ─────────────────────────────────────────────
ExecutionMode = Literal["demo", "live"]
DataSource = Literal["live_aws", "demo_fixture"]
ScanStatus = Literal["idle", "scanning", "completed", "failed", "empty", "partial"]
ConnectionStatus = Literal["disconnected", "connecting", "connected", "failed"]

# ─── Health & System Schemas ───────────────────────────────────────────────────
class HealthResponse(BaseModel):
    status: str = "ok"
    version: str = "1.0.0"
    app_name: str = "CloudPilot Backend"
    mode: str = "production-ready"
    timestamp: str

# ─── Account Connection Schemas ────────────────────────────────────────────────
class AccountConnectRequest(BaseModel):
    account_id: str = Field(..., description="12-digit AWS Account ID")
    role_arn: str = Field(..., description="Full ARN of CloudPilotAuditRole")
    external_id: str = Field(..., description="Unique tenant ExternalId condition")
    region: str = Field(default="ap-south-1", description="AWS Primary Region")
    mode: ExecutionMode = Field(default="live", description="Explicit execution mode ('live' or 'demo')")

class AccountConnectResponse(BaseModel):
    success: bool
    account_id: str
    alias: str
    region: str
    role_arn: str
    assumed_role_user_arn: Optional[str] = None
    session_expiration: Optional[str] = None
    is_live: bool = True
    execution_mode: ExecutionMode = "live"
    connection_status: ConnectionStatus = "connected"
    message: str
    error_details: Optional[str] = None

# ─── Finding & Telemetry Schemas (Matching Frontend Models) ────────────────────
class SafetyCheck(BaseModel):
    label: str
    passed: bool
    detail: str
    isBlocking: Optional[bool] = False
    evidence_source: Optional[str] = None
    evaluated_at: Optional[str] = None

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
    account_id: Optional[str] = None
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
    status: str = "open"  # 'open' | 'in_review' | 'approved' | 'executing' | 'resolved' | 'failed' | 'blocked'
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
    
    # ── Strict Provenance & Mode Isolation ──
    execution_mode: ExecutionMode = "live"
    data_source: DataSource = "live_aws"
    is_stale: bool = False
    verified_at: Optional[str] = None
    account_id: Optional[str] = None
    scan_id: Optional[str] = None

class DiscoveryRequest(BaseModel):
    account_id: str
    region: str = "ap-south-1"
    regions: Optional[List[str]] = None
    mode: ExecutionMode = Field(default="live", description="Explicit execution mode ('live' or 'demo')")

class DiscoveryResponse(BaseModel):
    success: bool
    account_id: str
    region: str
    scanned_at: str
    resource_count: int
    findings: List[FindingModel]
    execution_mode: ExecutionMode = "live"
    scan_status: ScanStatus = "completed"
    error_message: Optional[str] = None
    scanned_regions: List[str] = ["ap-south-1"]
    failed_regions: List[str] = []
    scan_id: Optional[str] = None

# ─── Approval & Remediation Schemas ────────────────────────────────────────────
class ApproveRequest(BaseModel):
    finding_id: Optional[str] = None
    user_email: str = Field(default="operator@cloudpilot.io", description="Authenticated actor email")
    mode: ExecutionMode = Field(default="live", description="Explicit execution mode ('live' or 'demo')")
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
    execution_mode: ExecutionMode = "live"
    verification_status: str = "verified"
    verified_at: Optional[str] = None
    error_details: Optional[str] = None
