// ─── CloudPilot Mock Data ────────────────────────────────────────────────────

export type Severity = 'critical' | 'high' | 'medium' | 'low';
export type FindingCategory = 'security' | 'cost';
export type FindingStatus = 'open' | 'in_review' | 'approved' | 'executing' | 'resolved' | 'failed';

export interface Resource {
  id: string;
  type: string;
  name: string;
  region: string;
  age: string;
  tags: Record<string, string>;
}

export interface Finding {
  id: string;
  category: FindingCategory;
  severity: Severity;
  title: string;
  description: string;
  rule: string;
  resource: Resource;
  evidence: string[];
  estimatedMonthlyCost?: number;
  estimatedSavings?: number;
  status: FindingStatus;
  detectedAt: string;
  affectedService: string;
  recommendedAction: string;
}

export interface SafetyCheck {
  label: string;
  passed: boolean;
  detail: string;
}

export interface SafetyPassport {
  findingId: string;
  generatedAt: string;
  expiresAt: string;

  // Section 1 — Evidence
  findingEvidence: string[];
  resourceIdentity: {
    id: string;
    type: string;
    region: string;
    account: string;
  };

  // Section 2 — Proposed action
  operation: string;
  operationParams: Record<string, string>;

  // Section 3 — Preconditions
  preconditions: SafetyCheck[];

  // Section 4 — Side effects
  sideEffects: string[];

  // Section 5 — Approval
  approvalStatus: 'pending' | 'approved' | 'expired';
  approvedBy?: string;
  approvedAt?: string;

  // Section 6 — Verification
  verificationPlan: string[];

  // Section 7 — Recovery
  recoveryGuidance: string[];

  // Section 8 — Execution result
  executionResult?: {
    status: 'success' | 'failed';
    awsRequestId: string;
    attemptedAt: string;
    verifiedAt: string;
    beforeState: Record<string, string>;
    afterState: Record<string, string>;
    auditId: string;
  };
}

export interface AuditRecord {
  id: string;
  findingId: string;
  action: string;
  resource: string;
  authorizedBy: string;
  authorizedAt: string;
  executedAt: string;
  awsResponse: string;
  outcome: 'success' | 'failed';
  beforeState: string;
  afterState: string;
}

export interface ConnectedAccount {
  id: string;
  alias: string;
  accountId: string;
  roleArn: string;
  status: 'connected' | 'scanning' | 'error';
  lastScanned: string;
  region: string;
  findingsCount: { critical: number; high: number; medium: number; low: number };
  estimatedMonthlyCost: number;
}

// ─── Connected Account ────────────────────────────────────────────────────────

export const mockAccount: ConnectedAccount = {
  id: 'acc-001',
  alias: 'CloudPilot Test Account',
  accountId: '123456789012',
  roleArn: 'arn:aws:iam::123456789012:role/CloudPilotReadRole',
  status: 'connected',
  lastScanned: '2026-10-21T14:45:00Z',
  region: 'ap-south-1',
  findingsCount: { critical: 1, high: 2, medium: 3, low: 2 },
  estimatedMonthlyCost: 247.80,
};

// ─── Findings ─────────────────────────────────────────────────────────────────

export const mockFindings: Finding[] = [
  {
    id: 'finding-001',
    category: 'security',
    severity: 'critical',
    title: 'SSH (port 22) open to entire internet',
    description:
      'Security group sg-0a1b2c3d4e5f allows inbound TCP traffic on port 22 from 0.0.0.0/0. Any IP address on the internet can attempt to connect to instances using this security group.',
    rule: 'SEC-SG-001: SSH must not be reachable from 0.0.0.0/0',
    resource: {
      id: 'sg-0a1b2c3d4e5f',
      type: 'AWS::EC2::SecurityGroup',
      name: 'launch-wizard-1',
      region: 'ap-south-1',
      age: '47 days',
      tags: { Environment: 'dev', Project: 'backend-api' },
    },
    evidence: [
      'Inbound rule: protocol=TCP, port=22, source=0.0.0.0/0',
      'Security group attached to 2 running EC2 instances',
      'Instance i-0abc123 has a public IP address (3.109.45.22)',
      'No VPN or bastion host detected in the VPC',
    ],
    status: 'open',
    detectedAt: '2026-10-21T14:45:12Z',
    affectedService: 'EC2 / Security Groups',
    recommendedAction:
      'Restrict the SSH inbound rule to a specific trusted CIDR block (e.g., your office IP or VPN range) or remove the rule entirely if SSH access is not required.',
  },
  {
    id: 'finding-002',
    category: 'cost',
    severity: 'high',
    title: 'Unattached EBS volume accumulating cost',
    description:
      'EBS volume vol-0f1e2d3c4b5a6789 (50 GiB, gp3) has not been attached to any EC2 instance for 23 days. It continues to incur storage charges.',
    rule: 'COST-EBS-001: Unattached EBS volumes older than 7 days should be reviewed',
    resource: {
      id: 'vol-0f1e2d3c4b5a6789',
      type: 'AWS::EC2::Volume',
      name: 'data-backup-vol',
      region: 'ap-south-1',
      age: '23 days unattached',
      tags: { Environment: 'dev', Owner: 'ravi' },
    },
    evidence: [
      'Volume state: available (not attached)',
      'Volume size: 50 GiB, type: gp3',
      'Last attached: 2026-09-28 (23 days ago)',
      'No snapshot taken in the last 30 days',
      'Estimated monthly cost: $4.00 USD at $0.08/GiB-month (ap-south-1)',
    ],
    estimatedMonthlyCost: 4.0,
    estimatedSavings: 4.0,
    status: 'open',
    detectedAt: '2026-10-21T14:45:15Z',
    affectedService: 'EC2 / EBS',
    recommendedAction:
      'Snapshot the volume if data may be needed, then delete it. Review whether data should be migrated to S3 for long-term storage.',
  },
  {
    id: 'finding-003',
    category: 'cost',
    severity: 'high',
    title: 'Elastic IP not associated with any resource',
    description:
      'Elastic IP 52.66.18.43 (eipalloc-0abc123def) is allocated but not associated with any EC2 instance or network interface. AWS charges for unassociated Elastic IPs.',
    rule: 'COST-EIP-001: Unassociated Elastic IPs should be released',
    resource: {
      id: 'eipalloc-0abc123def',
      type: 'AWS::EC2::EIP',
      name: '52.66.18.43',
      region: 'ap-south-1',
      age: '15 days unassociated',
      tags: {},
    },
    evidence: [
      'Elastic IP: 52.66.18.43',
      'Association status: unassociated',
      'Allocated: 2026-10-06',
      'Estimated monthly cost: $3.65 USD (unassociated EIP)',
    ],
    estimatedMonthlyCost: 3.65,
    estimatedSavings: 3.65,
    status: 'open',
    detectedAt: '2026-10-21T14:45:18Z',
    affectedService: 'EC2 / Elastic IPs',
    recommendedAction:
      'Release the Elastic IP if it is no longer required. If it is needed for a future deployment, document the reason in resource tags.',
  },
  {
    id: 'finding-004',
    category: 'security',
    severity: 'medium',
    title: 'S3 bucket has public access not explicitly blocked',
    description:
      'S3 bucket "dev-assets-ravi-2024" does not have all four S3 Block Public Access settings enabled. Public access is not confirmed but is not explicitly blocked.',
    rule: 'SEC-S3-001: All four S3 Block Public Access settings should be enabled',
    resource: {
      id: 'dev-assets-ravi-2024',
      type: 'AWS::S3::Bucket',
      name: 'dev-assets-ravi-2024',
      region: 'ap-south-1',
      age: '62 days',
      tags: { Environment: 'dev' },
    },
    evidence: [
      'BlockPublicAcls: false',
      'IgnorePublicAcls: false',
      'BlockPublicPolicy: true',
      'RestrictPublicBuckets: true',
      'Bucket region: ap-south-1',
    ],
    status: 'open',
    detectedAt: '2026-10-21T14:45:20Z',
    affectedService: 'S3',
    recommendedAction:
      'Enable all four S3 Block Public Access settings at the bucket level unless you have an explicit, documented reason for public access.',
  },
  {
    id: 'finding-005',
    category: 'security',
    severity: 'medium',
    title: 'No AWS Budget alerts configured',
    description:
      'No AWS Budgets have been configured for this account. Without budget alerts, unexpected spending increases will not trigger any notification.',
    rule: 'SEC-BUDGET-001: At least one cost budget with an alert should be configured',
    resource: {
      id: 'account-123456789012',
      type: 'AWS::Account',
      name: 'CloudPilot Test Account',
      region: 'global',
      age: '—',
      tags: {},
    },
    evidence: [
      'AWS Budgets API returned 0 configured budgets',
      'No SNS topics associated with budget alerts found',
    ],
    status: 'open',
    detectedAt: '2026-10-21T14:45:22Z',
    affectedService: 'AWS Budgets',
    recommendedAction:
      'Create at least one monthly cost budget with an alert threshold (e.g., 80% of expected spend) and configure email notifications.',
  },
];

// ─── Safety Passport ──────────────────────────────────────────────────────────

export const mockSafetyPassport: SafetyPassport = {
  findingId: 'finding-001',
  generatedAt: '2026-10-21T15:00:00Z',
  expiresAt: '2026-10-21T16:00:00Z',

  findingEvidence: [
    'Inbound rule: protocol=TCP, port=22, source=0.0.0.0/0',
    'Security group attached to 2 running EC2 instances',
    'Instance i-0abc123 has a public IP (3.109.45.22)',
    'No VPN or bastion host detected in VPC vpc-0123abc',
  ],
  resourceIdentity: {
    id: 'sg-0a1b2c3d4e5f',
    type: 'AWS::EC2::SecurityGroup',
    region: 'ap-south-1',
    account: '123456789012',
  },

  operation: 'ec2:RevokeSecurityGroupIngress',
  operationParams: {
    GroupId: 'sg-0a1b2c3d4e5f',
    IpProtocol: 'tcp',
    FromPort: '22',
    ToPort: '22',
    CidrIp: '0.0.0.0/0',
  },

  preconditions: [
    { label: 'Security group exists and is reachable', passed: true, detail: 'sg-0a1b2c3d4e5f confirmed present in ap-south-1' },
    { label: 'Target rule still present (re-checked)', passed: true, detail: 'TCP:22 from 0.0.0.0/0 confirmed in current ruleset' },
    { label: 'CloudPilot role has ec2:RevokeSecurityGroupIngress permission', passed: true, detail: 'IAM policy simulation passed' },
    { label: 'Security group is not the default group', passed: true, detail: 'sg-0a1b2c3d4e5f is not vpc default' },
    { label: 'No active approval exists for a conflicting action', passed: true, detail: 'No conflicting approvals found' },
  ],

  sideEffects: [
    'Active SSH sessions to instances using this security group will NOT be terminated — existing TCP connections persist.',
    'New SSH connection attempts from any IP will fail after this rule is removed.',
    'If you need SSH access in the future, you must add a new restricted inbound rule (e.g., your IP/32).',
    'All other inbound and outbound rules on this security group are unaffected.',
    'Other security groups attached to the same instances are not modified.',
  ],

  approvalStatus: 'pending',

  verificationPlan: [
    'Call ec2:DescribeSecurityGroups for sg-0a1b2c3d4e5f immediately after execution.',
    'Confirm that no inbound rule with port=22 and source=0.0.0.0/0 is present in the response.',
    'Record the full rule list as the verified after-state.',
    'If the rule is still present, mark execution as failed and preserve the audit record.',
  ],

  recoveryGuidance: [
    'To restore SSH access, run: aws ec2 authorize-security-group-ingress --group-id sg-0a1b2c3d4e5f --protocol tcp --port 22 --cidr <YOUR_IP>/32',
    'Replace <YOUR_IP> with your trusted CIDR block — not 0.0.0.0/0.',
    'CloudPilot does not automatically restore removed rules. Recovery is a manual action.',
    'The audit record contains the exact original rule parameters for reference.',
  ],
};

export const mockSafetyPassportApproved: SafetyPassport = {
  ...mockSafetyPassport,
  approvalStatus: 'approved',
  approvedBy: 'demo@cloudpilot.dev',
  approvedAt: '2026-10-21T15:04:32Z',
  executionResult: {
    status: 'success',
    awsRequestId: 'a1b2c3d4-5678-90ab-cdef-1234567890ab',
    attemptedAt: '2026-10-21T15:04:35Z',
    verifiedAt: '2026-10-21T15:04:38Z',
    beforeState: {
      'TCP:22 from 0.0.0.0/0': 'PRESENT',
      'TCP:443 from 0.0.0.0/0': 'PRESENT',
      'TCP:80 from 0.0.0.0/0': 'PRESENT',
    },
    afterState: {
      'TCP:22 from 0.0.0.0/0': 'REMOVED ✓',
      'TCP:443 from 0.0.0.0/0': 'PRESENT',
      'TCP:80 from 0.0.0.0/0': 'PRESENT',
    },
    auditId: 'audit-20261021-0042',
  },
};

// ─── Audit Records ────────────────────────────────────────────────────────────

export const mockAuditRecords: AuditRecord[] = [
  {
    id: 'audit-20261021-0042',
    findingId: 'finding-001',
    action: 'ec2:RevokeSecurityGroupIngress — TCP:22 from 0.0.0.0/0',
    resource: 'sg-0a1b2c3d4e5f (launch-wizard-1, ap-south-1)',
    authorizedBy: 'demo@cloudpilot.dev',
    authorizedAt: '2026-10-21T15:04:32Z',
    executedAt: '2026-10-21T15:04:35Z',
    awsResponse: '200 OK — RequestId: a1b2c3d4-5678-90ab-cdef-1234567890ab',
    outcome: 'success',
    beforeState: 'TCP:22 from 0.0.0.0/0: PRESENT',
    afterState: 'TCP:22 from 0.0.0.0/0: REMOVED (verified)',
  },
];

// ─── Summary Stats ────────────────────────────────────────────────────────────

export const mockSummaryStats = {
  totalFindings: 5,
  criticalFindings: 1,
  highFindings: 2,
  estimatedMonthlyWaste: 7.65,
  resolvedThisSession: 1,
  resourcesScanned: 47,
  scanDurationMs: 4320,
  securityScore: 34,     // out of 100 — before remediation
  securityScoreAfter: 72, // after SSH fix
};
