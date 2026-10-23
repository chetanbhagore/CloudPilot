from typing import Optional, List, Dict, Any, Literal
from pydantic import BaseModel, Field

# ─── Execution Modes & Status Types ─────────────────────────────────────────────
ExecutionMode = Literal["demo", "live"]
DataSource = Literal["live_aws", "live_azure", "demo_fixture"]
ScanStatus = Literal["idle", "scanning", "completed", "failed", "empty", "partial"]
ConnectionStatus = Literal["disconnected", "connecting", "connected", "failed"]
CloudProvider = Literal["aws", "azure"]

# ─── Health & System Schemas ───────────────────────────────────────────────────
class HealthResponse(BaseModel):
    status: str = "ok"
    version: str = "1.0.0"
    app_name: str = "CloudPilot Backend"
    mode: str = "production-ready"
    timestamp: str

# ─── Account Connection Schemas ────────────────────────────────────────────────
class AccountConnectRequest(BaseModel):
    account_id: Optional[str] = Field(default="", description="12-digit AWS Account ID or Azure Subscription ID")
    role_arn: Optional[str] = Field(default="", description="Full ARN of CloudPilotAuditRole (AWS)")
    external_id: Optional[str] = Field(default="", description="Unique tenant ExternalId condition (AWS)")
    region: str = Field(default="ap-south-1", description="AWS/Azure Primary Region")
    mode: ExecutionMode = Field(default="live", description="Explicit execution mode ('live' or 'demo')")
    connection_type: Optional[str] = Field(default="role_arn", description="Connection type: 'role_arn' | 'localstack' | 'azure_sp'")
    endpoint_url: Optional[str] = Field(default=None, description="Custom endpoint URL for LocalStack")
    cloud_provider: str = Field(default="aws", description="Cloud provider ('aws' or 'azure')")
    azure_tenant_id: Optional[str] = Field(default=None, description="Microsoft Entra Directory (tenant) ID")
    azure_client_id: Optional[str] = Field(default=None, description="Azure App Registration (client) ID")
    azure_client_secret: Optional[str] = Field(default=None, description="Azure Service Principal Client Secret")
    azure_subscription_id: Optional[str] = Field(default=None, description="Target Azure Subscription ID")
    aws_access_key_id: Optional[str] = Field(default=None, description="Direct AWS IAM Access Key ID")
    aws_secret_access_key: Optional[str] = Field(default=None, description="Direct AWS IAM Secret Access Key")
    aws_session_token: Optional[str] = Field(default=None, description="Optional temporary session token")

class AccountConnectResponse(BaseModel):
    success: bool
    account_id: str
    alias: str
    region: str
    role_arn: str
    cloud_provider: str = "aws"
    assumed_role_user_arn: Optional[str] = None
    session_expiration: Optional[str] = None
    is_live: bool = True
    execution_mode: ExecutionMode = "live"
    connection_status: ConnectionStatus = "connected"
    message: str
    error_details: Optional[str] = None

# ─── Finding & Telemetry Schemas (Matching Frontend Models) ────────────────────
CheckType = Literal["aws_api", "local_policy", "assumption", "unsupported_placeholder"]
CheckStatus = Literal["passed", "failed", "blocked", "stale", "unknown"]

class SafetyCheck(BaseModel):
    label: str
    passed: bool
    status: CheckStatus = "passed"
    check_type: CheckType = "aws_api"
    detail: str
    isBlocking: Optional[bool] = False
    evidence_source: Optional[str] = None
    evaluated_at: Optional[str] = None
    account_id: Optional[str] = None
    region: Optional[str] = None
    resource_id: Optional[str] = None
    freshness_limit_seconds: int = 300

class SafetyPassportModel(BaseModel):
    passport_id: str
    passport_version: int = 1
    passport_hash: str
    finding_id: str
    account_id: str
    region: str
    resource_id: str
    resource_type: str
    operation: str
    operation_params: Dict[str, str] = {}
    canonical_param_hash: str
    checks: List[SafetyCheck] = []
    is_safety_blocked: bool = False
    blocked_reason: Optional[str] = None
    risk_level: Literal["low", "medium", "high", "critical"] = "low"
    risk_factors: List[str] = []
    generated_at: str
    expires_at: str
    freshness_limit_seconds: int = 300
    is_stale: bool = False
    rollback_guidance: List[str] = []
    unverified_conditions: List[str] = []
    execution_mode: ExecutionMode = "live"

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
    metadata: Optional[Dict[str, Any]] = None
    
    # ── Strict Provenance & Mode Isolation ──
    execution_mode: ExecutionMode = "live"
    data_source: DataSource = "live_aws"
    is_stale: bool = False
    verified_at: Optional[str] = None
    account_id: Optional[str] = None
    scan_id: Optional[str] = None
    passport: Optional[SafetyPassportModel] = None
    organization_id: Optional[str] = "org-acme-prod"

class DiscoveryRequest(BaseModel):
    account_id: str
    region: str = "ap-south-1"
    regions: Optional[List[str]] = None
    mode: ExecutionMode = Field(default="live", description="Explicit execution mode ('live' or 'demo')")
    organization_id: Optional[str] = "org-acme-prod"
    cloud_provider: str = Field(default="aws", description="Cloud provider ('aws' or 'azure')")

class DiscoveryResponse(BaseModel):
    success: bool
    account_id: str
    region: str
    scanned_at: str
    resource_count: int
    findings: List[FindingModel]
    cloud_provider: str = "aws"
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

# ─── Authentication & RBAC Schemas ─────────────────────────────────────────────
UserRole = Literal["Viewer", "SecurityAnalyst", "DevOpsLead", "Admin", "Owner"]

class UserProfileModel(BaseModel):
    id: str
    email: str
    name: str
    role: UserRole
    organization_id: str
    organization_name: str
    is_active: bool = True

class LoginRequest(BaseModel):
    email: str
    password: str

class LoginResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expires_in: int
    user: UserProfileModel

class AuthenticatedUser(BaseModel):
    user_id: str
    email: str
    organization_id: str
    role: UserRole
    permissions: List[str]
    is_demo: bool = False

class SignupRequest(BaseModel):
    name: str = Field(..., min_length=2, max_length=100)
    email: str = Field(..., min_length=5, max_length=150)
    password: str = Field(..., min_length=8, max_length=128)
    organization_name: str = Field(..., min_length=2, max_length=100)

class ForgotPasswordRequest(BaseModel):
    email: str

class ForgotPasswordResponse(BaseModel):
    success: bool
    message: str
    reset_token: Optional[str] = None

# ─── Standardized API Error Schemas ───────────────────────────────────────────
class StandardErrorResponse(BaseModel):
    error_code: str
    category: str  # 'validation_error' | 'authentication_error' | 'authorization_error' | 'aws_permission_error' | 'aws_throttling_error' | 'timeout_error' | 'internal_error' | 'resource_not_found'
    message: str
    detail: Optional[str] = None
    retryable: bool = False
    timestamp: str
    correlation_id: Optional[str] = None
