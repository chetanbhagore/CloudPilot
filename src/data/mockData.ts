// ─── CloudPilot Mock Data & Types ───────────────────────────────────────────

export type Severity = 'critical' | 'high' | 'medium' | 'low';
export type FindingCategory = 'security' | 'cost';
export type FindingStatus = 'open' | 'in_review' | 'approved' | 'executing' | 'resolved' | 'failed' | 'blocked';

export interface Resource {
  id: string;
  type: string;
  name: string;
  region: string;
  age: string;
  tags: Record<string, string>;
}

export interface SafetyCheck {
  label: string;
  passed: boolean;
  detail: string;
  isBlocking?: boolean;
}

export interface TelemetryPoint {
  time: string;
  label: string;
  value: number;
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
  
  // Specific Safety Passport Definition
  operation: string;
  operationParams: Record<string, string>;
  preconditions: SafetyCheck[];
  sideEffects: string[];
  verificationPlan: string[];
  recoveryGuidance: string[];
  recoveryLimitations: string;
  beforeState: string;
  afterState: string;
  
  // Blocking details if safety check fails
  isSafetyBlocked?: boolean;
  blockedReason?: string;
  
  // Deterministic Telemetry for Drawer
  telemetryMetricName: string;
  telemetryUnit: string;
  telemetryData: TelemetryPoint[];
}

export interface SafetyPassport {
  findingId: string;
  generatedAt: string;
  expiresAt: string;
  findingEvidence: string[];
  resourceIdentity: {
    id: string;
    type: string;
    region: string;
    account: string;
  };
  operation: string;
  operationParams: Record<string, string>;
  preconditions: SafetyCheck[];
  sideEffects: string[];
  approvalStatus: 'pending' | 'approved' | 'blocked' | 'expired';
  approvedBy?: string;
  approvedAt?: string;
  verificationPlan: string[];
  recoveryGuidance: string[];
  recoveryLimitations?: string;
  isSafetyBlocked?: boolean;
  blockedReason?: string;
  executionResult?: {
    status: 'success' | 'failed';
    awsRequestId: string;
    attemptedAt: string;
    verifiedAt: string;
    beforeState: string;
    afterState: string;
    auditId: string;
  };
}

export interface AuditRecord {
  id: string;
  findingId: string;
  scenario: string;
  action: string;
  resource: string;
  authorizedBy: string;
  authorizedAt: string;
  executedAt: string;
  awsResponse: string;
  outcome: 'success' | 'failed';
  beforeState: string;
  afterState: string;
  canonicalPayload: string;
  integrityHash: string;
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

// ─── Scenario Connected Accounts ──────────────────────────────────────────────

export const FINTECH_ACCOUNT: ConnectedAccount = {
  id: 'acc-fintech-01',
  alias: 'FinTech MVP Dev',
  accountId: '123456789012',
  roleArn: 'arn:aws:iam::123456789012:role/CloudPilotAuditRole',
  status: 'connected',
  lastScanned: '2026-10-21T14:45:00Z',
  region: 'ap-south-1',
  findingsCount: { critical: 1, high: 2, medium: 2, low: 0 },
  estimatedMonthlyCost: 148.50,
};

export const STUDENT_ACCOUNT: ConnectedAccount = {
  id: 'acc-student-02',
  alias: 'Student ML Research Sandbox',
  accountId: '987654321098',
  roleArn: 'arn:aws:iam::987654321098:role/CloudPilotAuditRole',
  status: 'connected',
  lastScanned: '2026-10-21T14:45:00Z',
  region: 'us-east-1',
  findingsCount: { critical: 2, high: 1, medium: 1, low: 0 },
  estimatedMonthlyCost: 2680.00,
};

// ─── FinTech Startup Findings (ap-south-1) ───────────────────────────────────

export const FINTECH_FINDINGS: Finding[] = [
  {
    id: 'finding-001',
    category: 'security',
    severity: 'critical',
    title: 'SSH (port 22) open to entire internet',
    description: 'Security group sg-0a1b2c3d4e5f allows inbound TCP traffic on port 22 from 0.0.0.0/0. Any IP on the internet can attempt brute-force authentication.',
    rule: 'SEC-SG-001: SSH ingress must not allow 0.0.0.0/0',
    resource: {
      id: 'sg-0a1b2c3d4e5f',
      type: 'AWS::EC2::SecurityGroup',
      name: 'launch-wizard-1',
      region: 'ap-south-1',
      age: '47 days',
      tags: { Environment: 'dev', Project: 'fintech-api' }
    },
    evidence: [
      'Inbound rule: protocol=TCP, port=22, source=0.0.0.0/0',
      'Attached to 2 running EC2 instances with public IPs (e.g. 3.109.45.22)',
      '1,679 automated intrusion attempts recorded in simulated VPC flow telemetry',
      'No bastion host, VPN, or Session Manager configured'
    ],
    status: 'open',
    detectedAt: '2026-10-21T14:45:12Z',
    affectedService: 'EC2 / Security Groups',
    recommendedAction: 'Revoke the unrestricted 0.0.0.0/0 ingress rule. Authorize individual engineer IP/32 addresses or switch to AWS Systems Manager.',
    operation: 'ec2:RevokeSecurityGroupIngress',
    operationParams: {
      GroupId: 'sg-0a1b2c3d4e5f',
      IpProtocol: 'tcp',
      FromPort: '22',
      ToPort: '22',
      CidrIp: '0.0.0.0/0'
    },
    preconditions: [
      { label: 'Security group exists and is reachable', passed: true, detail: 'sg-0a1b2c3d4e5f confirmed in ap-south-1' },
      { label: 'Target rule still present in active ruleset', passed: true, detail: 'TCP:22 from 0.0.0.0/0 verified' },
      { label: 'CloudPilot role has ec2:RevokeSecurityGroupIngress permission', passed: true, detail: 'IAM policy simulation passed' },
      { label: 'Security group is not the VPC default group', passed: true, detail: 'Non-default group confirmed' },
      { label: 'Zero active SSH sessions will be terminated', passed: true, detail: 'Existing TCP socket connections persist undisturbed' }
    ],
    sideEffects: [
      'Active SSH sessions will persist without interruption until closed.',
      'New SSH connection attempts from non-whitelisted IPs will immediately fail.',
      'Inbound HTTP (port 80) and HTTPS (port 443) rules remain completely unaffected.'
    ],
    verificationPlan: [
      'Call ec2:DescribeSecurityGroups for sg-0a1b2c3d4e5f.',
      'Confirm port 22 with CIDR 0.0.0.0/0 is absent from IpPermissions.',
      'Confirm ports 80 and 443 remain untouched.'
    ],
    recoveryGuidance: [
      'To restore SSH access from a specific IP, run:',
      'aws ec2 authorize-security-group-ingress --group-id sg-0a1b2c3d4e5f --protocol tcp --port 22 --cidr <YOUR_IP>/32 --region ap-south-1'
    ],
    recoveryLimitations: 'Recovery requires manually supplying your specific IP address. CloudPilot deliberately does not auto-restore 0.0.0.0/0 rules.',
    beforeState: 'Inbound Rule: TCP:22 from 0.0.0.0/0 (PRESENT)',
    afterState: 'Inbound Rule: TCP:22 from 0.0.0.0/0 (REMOVED ✓)',
    telemetryMetricName: 'Simulated WAN Port Probes / Hour',
    telemetryUnit: 'probes',
    telemetryData: [
      { time: '00:00', label: '12 AM', value: 142 },
      { time: '04:00', label: '4 AM', value: 98 },
      { time: '08:00', label: '8 AM', value: 284 },
      { time: '12:00', label: '12 PM', value: 412 },
      { time: '16:00', label: '4 PM', value: 360 },
      { time: '20:00', label: '8 PM', value: 210 },
      { time: '23:59', label: 'Now', value: 173 }
    ]
  },
  {
    id: 'finding-002',
    category: 'cost',
    severity: 'high',
    title: 'Unattached gp3 EBS volume accumulating cost',
    description: 'EBS volume vol-0f1e2d3c4b5a6789 (50 GiB, gp3) has been detached for 23 days while incurring storage fees.',
    rule: 'COST-EBS-001: Detached EBS volumes older than 7 days should be reviewed',
    resource: {
      id: 'vol-0f1e2d3c4b5a6789',
      type: 'AWS::EC2::Volume',
      name: 'data-backup-vol',
      region: 'ap-south-1',
      age: '23 days unattached',
      tags: { Environment: 'dev', Owner: 'ravi' }
    },
    evidence: [
      'Volume state: available (detached from all EC2 instances)',
      'Volume size: 50 GiB gp3 storage',
      'Zero IOPS activity for 23 consecutive days',
      'Estimated monthly run-rate leak: ~$4.00 USD ($0.08/GiB-mo standard gp3 rate)'
    ],
    estimatedMonthlyCost: 4.00,
    estimatedSavings: 4.00,
    status: 'open',
    detectedAt: '2026-10-21T14:45:15Z',
    affectedService: 'EC2 / EBS Storage',
    recommendedAction: 'Verify that backup snapshot exists, then terminate the unattached volume.',
    operation: 'ec2:DeleteVolume',
    operationParams: {
      VolumeId: 'vol-0f1e2d3c4b5a6789'
    },
    preconditions: [
      { label: 'Volume state confirmed as available (detached)', passed: true, detail: 'Not attached to any active instance' },
      { label: 'Pre-flight recovery snapshot exists', passed: true, detail: 'Snapshot snap-0f1e2d3c4b5a created 1 hour ago' },
      { label: 'No pending snapshot in progress', passed: true, detail: 'Snapshot status: completed' },
      { label: 'CloudPilot role has ec2:DeleteVolume permission', passed: true, detail: 'IAM policy simulation passed' },
      { label: 'Volume is not tagged DoNotDelete', passed: true, detail: 'No retention tags found' }
    ],
    sideEffects: [
      'The physical EBS volume will be permanently deleted.',
      'Ongoing $4.00/month storage charges cease immediately upon termination.',
      'Data remains restorable from pre-flight snapshot snap-0f1e2d3c4b5a.'
    ],
    verificationPlan: [
      'Call ec2:DescribeVolumes for vol-0f1e2d3c4b5a6789.',
      'Confirm AWS returns InvalidVolume.NotFound error indicating deletion.'
    ],
    recoveryGuidance: [
      'To restore the volume from the safety snapshot, run:',
      'aws ec2 create-volume --snapshot-id snap-0f1e2d3c4b5a --availability-zone ap-south-1a --volume-type gp3'
    ],
    recoveryLimitations: 'Volume deletion is irreversible. Data recovery relies entirely on the pre-flight snapshot.',
    beforeState: 'Volume vol-0f1e2d3c4b5a: AVAILABLE (detached, billing active)',
    afterState: 'Volume vol-0f1e2d3c4b5a: DELETED (storage charges halted ✓)',
    telemetryMetricName: 'Read/Write IOPS Activity (23 Days)',
    telemetryUnit: 'IOPS',
    telemetryData: [
      { time: 'Day -21', label: 'Oct 01', value: 0 },
      { time: 'Day -14', label: 'Oct 07', value: 0 },
      { time: 'Day -7', label: 'Oct 14', value: 0 },
      { time: 'Day -3', label: 'Oct 18', value: 0 },
      { time: 'Day 0', label: 'Today', value: 0 }
    ]
  },
  {
    id: 'finding-003',
    category: 'cost',
    severity: 'high',
    title: 'Unassociated Elastic IP incurring idle fee',
    description: 'Elastic IP 52.66.18.43 is allocated to account but unassociated with any EC2 instance or network interface.',
    rule: 'COST-EIP-001: Unassociated Elastic IPs should be released',
    resource: {
      id: 'eipalloc-0abc123def',
      type: 'AWS::EC2::EIP',
      name: '52.66.18.43',
      region: 'ap-south-1',
      age: '15 days unassociated',
      tags: {}
    },
    evidence: [
      'Elastic IP: 52.66.18.43 (AllocationId: eipalloc-0abc123def)',
      'Association status: null (unattached for 15 days)',
      'AWS charges $0.005/hour for in-use and idle IPv4 addresses',
      'Estimated monthly run-rate leak: ~$3.65 USD ($0.005/hr * 730 hrs)'
    ],
    estimatedMonthlyCost: 3.65,
    estimatedSavings: 3.65,
    status: 'open',
    detectedAt: '2026-10-21T14:45:18Z',
    affectedService: 'EC2 / Elastic IPs',
    recommendedAction: 'Release the unallocated IPv4 address to the public AWS pool.',
    operation: 'ec2:ReleaseAddress',
    operationParams: {
      AllocationId: 'eipalloc-0abc123def'
    },
    preconditions: [
      { label: 'EIP is not associated with an EC2 instance', passed: true, detail: 'InstanceId is null' },
      { label: 'EIP is not bound to a Network Interface (ENI)', passed: true, detail: 'NetworkInterfaceId is null' },
      { label: 'No DNS records in Route53 target 52.66.18.43', passed: true, detail: 'Hosted zone query returned 0 matches' },
      { label: 'CloudPilot role has ec2:ReleaseAddress permission', passed: true, detail: 'IAM policy simulation passed' },
      { label: 'Allocation ID confirmed valid in ap-south-1', passed: true, detail: 'eipalloc-0abc123def active' }
    ],
    sideEffects: [
      'IP address 52.66.18.43 is returned to the public AWS IPv4 address pool.',
      'Idle address reservation charges cease immediately.'
    ],
    verificationPlan: [
      'Call ec2:DescribeAddresses with AllocationId eipalloc-0abc123def.',
      'Confirm AWS returns InvalidAllocationID.NotFound.'
    ],
    recoveryGuidance: [
      'Released public IPs return to the general AWS pool and cannot be re-reserved with certainty.',
      'To allocate a new random Elastic IP in the future, run:',
      'aws ec2 allocate-address --domain vpc --region ap-south-1'
    ],
    recoveryLimitations: 'IPv4 addresses cannot be re-acquired once released. Ensure no external hardcoded references exist.',
    beforeState: 'EIP 52.66.18.43: ALLOCATED (unassociated, billing $3.65/mo)',
    afterState: 'EIP 52.66.18.43: RELEASED (returned to pool, charge eliminated ✓)',
    telemetryMetricName: 'Simulated Ingress/Egress Throughput',
    telemetryUnit: 'MB/s',
    telemetryData: [
      { time: 'Day -14', label: '14d ago', value: 0 },
      { time: 'Day -7', label: '7d ago', value: 0 },
      { time: 'Day -3', label: '3d ago', value: 0 },
      { time: 'Day 0', label: 'Today', value: 0 }
    ]
  },
  {
    id: 'finding-004',
    category: 'security',
    severity: 'medium',
    title: 'S3 bucket missing S3 Block Public Access',
    description: 'S3 bucket "dev-assets-ravi-2024" lacks full S3 Block Public Access enforcement, but contains active frontend CDN assets.',
    rule: 'SEC-S3-001: All four S3 Block Public Access settings should be active',
    resource: {
      id: 'dev-assets-ravi-2024',
      type: 'AWS::S3::Bucket',
      name: 'dev-assets-ravi-2024',
      region: 'ap-south-1',
      age: '62 days',
      tags: { Environment: 'dev', Stage: 'staging-cdn' }
    },
    evidence: [
      'BlockPublicAcls: false, IgnorePublicAcls: false',
      'Bucket contains 1,240 object assets',
      '14 asset URLs are actively linked in frontend client application'
    ],
    status: 'blocked',
    isSafetyBlocked: true,
    blockedReason: 'Safety check blocked: 14 public asset objects are actively queried by CloudFront distribution E298ABC. Blocking public access without migrating to CloudFront Origin Access Control (OAC) will break public image delivery.',
    detectedAt: '2026-10-21T14:45:20Z',
    affectedService: 'S3 Object Storage',
    recommendedAction: 'Migrate assets to CloudFront OAC first before enabling bucket-level Block Public Access.',
    operation: 's3:PutPublicAccessBlock',
    operationParams: {
      Bucket: 'dev-assets-ravi-2024',
      PublicAccessBlockConfiguration: '{"BlockPublicAcls":true,"IgnorePublicAcls":true,"BlockPublicPolicy":true,"RestrictPublicBuckets":true}'
    },
    preconditions: [
      { label: 'S3 bucket exists and is accessible', passed: true, detail: 'Bucket present in ap-south-1' },
      { label: 'Bucket policy allows PutPublicAccessBlock', passed: true, detail: 'IAM simulation passed' },
      { label: 'Active public asset dependency check', passed: false, detail: '14 public image URLs currently routed via CDN without OAC', isBlocking: true },
      { label: 'Replication configuration unaffected', passed: true, detail: 'No cross-region replication configured' },
      { label: 'Zero unencrypted public PII detected', passed: true, detail: 'All assets are web PNG/CSS bundles' }
    ],
    sideEffects: [
      'Direct anonymous HTTP GET requests to S3 URLs will return 403 Forbidden.',
      'Active website assets without OAC will fail to load.'
    ],
    verificationPlan: [
      'Call s3:GetPublicAccessBlock for dev-assets-ravi-2024.',
      'Verify all 4 boolean flags return true.'
    ],
    recoveryGuidance: [
      'To roll back Block Public Access settings, run:',
      'aws s3api put-public-access-block --bucket dev-assets-ravi-2024 --public-access-block-configuration "BlockPublicAcls=false,IgnorePublicAcls=false,BlockPublicPolicy=false,RestrictPublicBuckets=false"'
    ],
    recoveryLimitations: 'Enabling this prematurely will break production website styling and images.',
    beforeState: 'BlockPublicAcls: false (Unrestricted public read risk)',
    afterState: 'Blocked by Precondition Check (Action Halted for Safety)',
    telemetryMetricName: 'Simulated Anonymous S3 GET Requests',
    telemetryUnit: 'requests/hr',
    telemetryData: [
      { time: '00:00', label: '12 AM', value: 85 },
      { time: '06:00', label: '6 AM', value: 140 },
      { time: '12:00', label: '12 PM', value: 520 },
      { time: '18:00', label: '6 PM', value: 430 }
    ]
  },
  {
    id: 'finding-005',
    category: 'security',
    severity: 'medium',
    title: 'Zero AWS Budget alerts configured for account',
    description: 'No AWS Budgets or anomaly alerts exist for this account. Billing spikes will go undetected until invoice generation.',
    rule: 'SEC-BUDGET-001: At least one cost budget with email alert threshold required',
    resource: {
      id: 'account-123456789012',
      type: 'AWS::Account',
      name: 'FinTech MVP Dev',
      region: 'global',
      age: '—',
      tags: {}
    },
    evidence: [
      'AWS Budgets API returned 0 active alert policies',
      'No SNS notification topics configured for cost anomalies',
      'Account has uncapped spending capability'
    ],
    status: 'open',
    detectedAt: '2026-10-21T14:45:22Z',
    affectedService: 'AWS Budgets & Cost Governance',
    recommendedAction: 'Create a monthly budget of $150.00 with email notifications at 80% threshold.',
    operation: 'budgets:CreateBudget',
    operationParams: {
      AccountId: '123456789012',
      BudgetName: 'FinTech-Dev-Monthly-Guardrail',
      BudgetLimit: '150.00',
      Threshold: '80%'
    },
    preconditions: [
      { label: 'AWS Budgets API enabled on account', passed: true, detail: 'Budgets endpoint verified' },
      { label: 'Target email address verified for notification', passed: true, detail: 'ops@fintech-dev.internal verified' },
      { label: 'CloudPilot role has budgets:ModifyBudget permission', passed: true, detail: 'IAM simulation passed' },
      { label: 'No existing conflicting budget with identical name', passed: true, detail: 'Name unique' },
      { label: 'Zero impact on running infrastructure', passed: true, detail: 'Non-disruptive governance policy' }
    ],
    sideEffects: [
      'Automated email notifications triggered if monthly spend projects to exceed $120.00 (80%).',
      'No infrastructure changes or interruptions.'
    ],
    verificationPlan: [
      'Call budgets:DescribeBudget for FinTech-Dev-Monthly-Guardrail.',
      'Confirm status is ACTIVE.'
    ],
    recoveryGuidance: [
      'To remove the budget guardrail, run:',
      'aws budgets delete-budget --account-id 123456789012 --budget-name FinTech-Dev-Monthly-Guardrail'
    ],
    recoveryLimitations: 'Deleting a budget removes alert protection but has zero impact on cloud resources.',
    beforeState: 'Active Budgets: 0 (No threshold protection)',
    afterState: 'Active Budgets: 1 ($150/mo limit with 80% alert ✓)',
    telemetryMetricName: 'Simulated Monthly Accrued Spend',
    telemetryUnit: 'USD',
    telemetryData: [
      { time: 'Day 1', label: 'Oct 01', value: 8 },
      { time: 'Day 7', label: 'Oct 07', value: 42 },
      { time: 'Day 14', label: 'Oct 14', value: 88 },
      { time: 'Day 21', label: 'Oct 21', value: 148 }
    ]
  }
];

// ─── Student ML Lab Findings (us-east-1) ──────────────────────────────────────

export const STUDENT_FINDINGS: Finding[] = [
  {
    id: 'finding-student-001',
    category: 'cost',
    severity: 'critical',
    title: 'Idle GPU instance (p3.2xlarge) running 24/7',
    description: 'Instance i-0gpu998877 (p3.2xlarge with 1x NVIDIA V100 GPU, $3.06/hr) has remained under 1.5% GPU utilization for 6 consecutive days.',
    rule: 'COST-EC2-002: Idle high-cost GPU instances should be stopped',
    resource: {
      id: 'i-0gpu998877',
      type: 'AWS::EC2::Instance',
      name: 'pytorch-research-vm',
      region: 'us-east-1',
      age: '6 days idle',
      tags: { Project: 'thesis-vision', Course: 'cs682', Student: 'ananya' }
    },
    evidence: [
      'Instance type: p3.2xlarge (1x NVIDIA Tesla V100 GPU)',
      'GPU CloudWatch utilization < 1.5% for 144 consecutive hours',
      'On-demand pricing: $3.06/hour ($73.44/day)',
      'Estimated monthly run-rate leak: ~$2,203.20 USD (assuming 24/7 unstopped execution)'
    ],
    estimatedMonthlyCost: 2203.20,
    estimatedSavings: 2203.20,
    status: 'open',
    detectedAt: '2026-10-21T14:45:12Z',
    affectedService: 'EC2 / Accelerated Computing',
    recommendedAction: 'Stop the GPU instance now to halt per-second compute fees. Restart in 45s when ready to resume training.',
    operation: 'ec2:StopInstances',
    operationParams: {
      InstanceIds: '["i-0gpu998877"]',
      Hibernate: 'false',
      Force: 'false'
    },
    preconditions: [
      { label: 'Target GPU instance confirmed running in us-east-1', passed: true, detail: 'Status: 2/2 system and instance health checks passed' },
      { label: 'Zero active PyTorch/CUDA training jobs executing', passed: true, detail: 'GPU utilization verified < 1.5% for 144 hours' },
      { label: 'EBS root volume snapshot ready for rollback', passed: true, detail: 'Snapshot snap-0student99 verified' },
      { label: 'CloudPilot role has ec2:StopInstances permission', passed: true, detail: 'IAM policy simulation passed' },
      { label: 'Standalone research instance verified', passed: true, detail: 'No conflicting auto-scaling lifecycle hooks active' }
    ],
    sideEffects: [
      'The GPU instance transitions to the STOPPED state; per-second compute billing ($3.06/hr) halts immediately.',
      'Attached EBS root volume storage ($0.10/GB-month) continues to incur standard volume preservation fees.',
      'Instance can be powered back on at any moment in under 45 seconds.'
    ],
    verificationPlan: [
      'Call ec2:DescribeInstances for i-0gpu998877.',
      'Confirm instance state has transitioned to "stopped".',
      'Verify hourly run-rate drops from $3.06/hr to $0.00/hr.'
    ],
    recoveryGuidance: [
      'To power the GPU instance back on when training resumes, run:',
      'aws ec2 start-instances --instance-ids i-0gpu998877 --region us-east-1'
    ],
    recoveryLimitations: 'Stopping halts volatile RAM state. All saved notebooks, models, and checkpoints on the EBS volume persist intact.',
    beforeState: 'i-0gpu998877 state: RUNNING ($3.06/hr, 1.2% GPU load)',
    afterState: 'i-0gpu998877 state: STOPPED ($0.00/hr compute fee halted ✓)',
    telemetryMetricName: 'Simulated NVIDIA V100 GPU Load (144 Hours)',
    telemetryUnit: '%',
    telemetryData: [
      { time: 'Day -6', label: 'Oct 15', value: 1.1 },
      { time: 'Day -4', label: 'Oct 17', value: 1.4 },
      { time: 'Day -2', label: 'Oct 19', value: 0.9 },
      { time: 'Day -1', label: 'Oct 20', value: 1.2 },
      { time: 'Now', label: 'Today', value: 1.0 }
    ]
  },
  {
    id: 'finding-student-002',
    category: 'security',
    severity: 'critical',
    title: 'Jupyter notebook port 8888 publicly exposed',
    description: 'Security group sg-0student99 allows inbound TCP traffic on port 8888 from 0.0.0.0/0 without authentication token requirement.',
    rule: 'SEC-SG-003: Interactive development ports must not be reachable from 0.0.0.0/0',
    resource: {
      id: 'sg-0student99',
      type: 'AWS::EC2::SecurityGroup',
      name: 'jupyter-dev-sg',
      region: 'us-east-1',
      age: '12 days',
      tags: { Project: 'thesis' }
    },
    evidence: [
      'Inbound rule: protocol=TCP, port=8888, source=0.0.0.0/0',
      'Host instance has public DNS accessible over WAN',
      'Severe Risk: Arbitrary remote code execution via unauthenticated Jupyter Python kernel'
    ],
    status: 'open',
    detectedAt: '2026-10-21T14:45:15Z',
    affectedService: 'EC2 / Security Groups',
    recommendedAction: 'Revoke the public 0.0.0.0/0 ingress rule. Connect to Jupyter securely via SSH port forwarding on localhost:8888.',
    operation: 'ec2:RevokeSecurityGroupIngress',
    operationParams: {
      GroupId: 'sg-0student99',
      IpProtocol: 'tcp',
      FromPort: '8888',
      ToPort: '8888',
      CidrIp: '0.0.0.0/0'
    },
    preconditions: [
      { label: 'Security group sg-0student99 confirmed in us-east-1', passed: true, detail: 'Group active' },
      { label: 'Target rule TCP:8888 verified present', passed: true, detail: 'Inbound rule confirmed' },
      { label: 'CloudPilot role has ec2:RevokeSecurityGroupIngress permission', passed: true, detail: 'IAM simulation passed' },
      { label: 'No conflicting ingress rules exist', passed: true, detail: 'Single port 8888 rule identified' },
      { label: 'SSH port 22 access maintained for port forwarding', passed: true, detail: 'SSH rule remains available' }
    ],
    sideEffects: [
      'Direct browser connections to http://<PUBLIC_IP>:8888 will be blocked.',
      'Secure access via SSH tunnel (ssh -L 8888:localhost:8888) is required and protected.'
    ],
    verificationPlan: [
      'Call ec2:DescribeSecurityGroups for sg-0student99.',
      'Confirm port 8888 with 0.0.0.0/0 is absent.'
    ],
    recoveryGuidance: [
      'To safely access Jupyter via SSH tunnel without exposing port 8888, run on your laptop:',
      'ssh -i key.pem -L 8888:localhost:8888 ec2-user@<INSTANCE_PUBLIC_IP>'
    ],
    recoveryLimitations: 'CloudPilot will not restore 0.0.0.0/0 ingress because public Jupyter ports are an active attack vector.',
    beforeState: 'TCP:8888 from 0.0.0.0/0 (EXPOSED - Remote Kernel Risk)',
    afterState: 'TCP:8888 from 0.0.0.0/0 (REMOVED - SSH Tunnel Required ✓)',
    telemetryMetricName: 'Simulated Inbound Port 8888 Scans',
    telemetryUnit: 'scans/hr',
    telemetryData: [
      { time: '00:00', label: '12 AM', value: 45 },
      { time: '06:00', label: '6 AM', value: 120 },
      { time: '12:00', label: '12 PM', value: 310 },
      { time: '18:00', label: '6 PM', value: 240 }
    ]
  },
  {
    id: 'finding-student-003',
    category: 'cost',
    severity: 'high',
    title: 'Training checkpoints saved on provisioned io2 EBS',
    description: 'EBS volume vol-0io2fast (200 GiB, 5,000 provisioned IOPS, $310/mo) is only consuming 18 IOPS during idle batch runs.',
    rule: 'COST-EBS-003: Extreme provisioned IOPS volumes with idle activity should be downscaled',
    resource: {
      id: 'vol-0io2fast',
      type: 'AWS::EC2::Volume',
      name: 'dataset-io2-vol',
      region: 'us-east-1',
      age: '8 days',
      tags: { Project: 'thesis' }
    },
    evidence: [
      'Volume type: io2 with 5,000 provisioned IOPS',
      'Actual IOPS consumed < 20 IOPS over 8 days',
      'Estimated monthly run-rate leak: ~$280.00 USD ($310 io2 cost vs $30 gp3 equivalent)'
    ],
    estimatedMonthlyCost: 310.00,
    estimatedSavings: 280.00,
    status: 'open',
    detectedAt: '2026-10-21T14:45:18Z',
    affectedService: 'EC2 / EBS Storage',
    recommendedAction: 'Modify volume type from io2 to standard gp3 with 300 baseline IOPS.',
    operation: 'ec2:ModifyVolume',
    operationParams: {
      VolumeId: 'vol-0io2fast',
      VolumeType: 'gp3'
    },
    preconditions: [
      { label: 'Volume state confirmed as in-use or available', passed: true, detail: 'vol-0io2fast ready for live modification' },
      { label: 'EBS Elastic Volumes supported on volume', passed: true, detail: 'No downtime required' },
      { label: 'Snapshot snap-0io2backup created', passed: true, detail: 'Safety checkpoint verified' },
      { label: 'CloudPilot role has ec2:ModifyVolume permission', passed: true, detail: 'IAM simulation passed' },
      { label: 'No conflicting volume modification in progress', passed: true, detail: 'Modification state: none' }
    ],
    sideEffects: [
      'Volume type seamlessly transitions to gp3 without detaching or rebooting the instance.',
      'Monthly volume cost decreases from $310.00 to $30.00 immediately.'
    ],
    verificationPlan: [
      'Call ec2:DescribeVolumesModifications for vol-0io2fast.',
      'Confirm TargetVolumeType is gp3 and Progress is OPTIMIZING or COMPLETED.'
    ],
    recoveryGuidance: [
      'To modify the volume back to io2 if high IOPS are ever required:',
      'aws ec2 modify-volume --volume-id vol-0io2fast --volume-type io2 --iops 5000 --region us-east-1'
    ],
    recoveryLimitations: 'AWS permits modifying an EBS volume once every 6 hours.',
    beforeState: 'Volume Type: io2 (5000 IOPS, $310.00/mo)',
    afterState: 'Volume Type: gp3 (300 IOPS baseline, $30.00/mo ✓)',
    telemetryMetricName: 'Actual IOPS Consumed (Last 7 Days)',
    telemetryUnit: 'IOPS',
    telemetryData: [
      { time: 'Day -7', label: 'Oct 14', value: 12 },
      { time: 'Day -5', label: 'Oct 16', value: 18 },
      { time: 'Day -3', label: 'Oct 18', value: 14 },
      { time: 'Day 0', label: 'Today', value: 16 }
    ]
  },
  {
    id: 'finding-student-004',
    category: 'security',
    severity: 'medium',
    title: 'Student IAM user lacks Virtual MFA enrollment',
    description: 'IAM user "student-ananya" has console password access without a registered Multi-Factor Authentication (MFA) device.',
    rule: 'SEC-IAM-004: All console-enabled IAM users must have MFA enforced',
    resource: {
      id: 'user-student-ananya',
      type: 'AWS::IAM::User',
      name: 'student-ananya',
      region: 'global',
      age: '45 days',
      tags: { Project: 'thesis' }
    },
    evidence: [
      'MFADevices list returned 0 active tokens',
      'PasswordLastUsed: 2 hours ago from campus IP'
    ],
    status: 'blocked',
    isSafetyBlocked: true,
    blockedReason: 'Safety check blocked: Enforcing an IAM policy requiring MFA before user "student-ananya" registers a TOTP device in the AWS console would immediately lock the student out of their AWS account.',
    detectedAt: '2026-10-21T14:45:20Z',
    affectedService: 'IAM Identity Governance',
    recommendedAction: 'Have the student register an Authenticator App (Google Authenticator / 1Password) before applying the MFA-enforcement policy.',
    operation: 'iam:AttachUserPolicy',
    operationParams: {
      UserName: 'student-ananya',
      PolicyArn: 'arn:aws:iam::aws:policy/MFAEnforcedAccess'
    },
    preconditions: [
      { label: 'IAM user exists', passed: true, detail: 'User verified in account 987654321098' },
      { label: 'Active MFA device registered', passed: false, detail: 'User has 0 MFA devices. Applying policy will lock user out.', isBlocking: true },
      { label: 'Console access enabled', passed: true, detail: 'Password active' },
      { label: 'Access keys rotated in last 90 days', passed: true, detail: 'No stale keys' },
      { label: 'Root account access disabled', passed: true, detail: 'Root account secured' }
    ],
    sideEffects: [
      'Applying this policy immediately blocks all AWS console and CLI access until MFA is authenticated.'
    ],
    verificationPlan: [
      'Call iam:ListMFADevices for student-ananya.',
      'Confirm SerialNumber is present.'
    ],
    recoveryGuidance: [
      'Log into the AWS Management Console, navigate to IAM -> Users -> Security Credentials, and click "Assign MFA device".'
    ],
    recoveryLimitations: 'MFA assignment requires physical user participation with an authenticator app.',
    beforeState: 'MFA Status: UNENROLLED (Account Takeover Risk)',
    afterState: 'Blocked by Precondition Check (Prevented User Lockout)',
    telemetryMetricName: 'Simulated Console Logins',
    telemetryUnit: 'logins',
    telemetryData: [
      { time: 'Day -7', label: 'Oct 14', value: 2 },
      { time: 'Day -4', label: 'Oct 17', value: 1 },
      { time: 'Day -1', label: 'Oct 20', value: 3 }
    ]
  }
];

// Backwards-compatible exports
export const mockAccount = FINTECH_ACCOUNT;
export const mockFindings = FINTECH_FINDINGS;

export const mockSafetyPassport: SafetyPassport = {
  findingId: 'finding-001',
  generatedAt: '2026-10-21T15:00:00Z',
  expiresAt: '2026-10-21T16:00:00Z',
  findingEvidence: FINTECH_FINDINGS[0].evidence,
  resourceIdentity: {
    id: FINTECH_FINDINGS[0].resource.id,
    type: FINTECH_FINDINGS[0].resource.type,
    region: FINTECH_FINDINGS[0].resource.region,
    account: '123456789012'
  },
  operation: FINTECH_FINDINGS[0].operation,
  operationParams: FINTECH_FINDINGS[0].operationParams,
  preconditions: FINTECH_FINDINGS[0].preconditions,
  sideEffects: FINTECH_FINDINGS[0].sideEffects,
  approvalStatus: 'pending',
  verificationPlan: FINTECH_FINDINGS[0].verificationPlan,
  recoveryGuidance: FINTECH_FINDINGS[0].recoveryGuidance,
  recoveryLimitations: FINTECH_FINDINGS[0].recoveryLimitations
};

export const mockAuditRecords: AuditRecord[] = [
  {
    id: 'audit-rec-0091',
    findingId: 'finding-001',
    scenario: 'Production Core (FinTech)',
    action: 'ec2:RevokeSecurityGroupIngress — TCP:22 from 0.0.0.0/0',
    resource: 'sg-0a1b2c3d4e5f (launch-wizard-1, ap-south-1)',
    authorizedBy: 'chetan@cloudpilot.io',
    authorizedAt: '2026-10-21T15:04:32Z',
    executedAt: '2026-10-21T15:04:35Z',
    awsResponse: '200 OK — RequestId: req-aws-9042b-fintech-mumbai',
    outcome: 'success',
    beforeState: 'TCP:22 from 0.0.0.0/0: PRESENT',
    afterState: 'TCP:22 from 0.0.0.0/0: REMOVED (verified)',
    canonicalPayload: 'finding-001|sg-0a1b2c3d4e5f|2026-10-21T15:04:32Z|req-aws-9042b-fintech-mumbai|chetan@cloudpilot.io',
    integrityHash: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855'
  }
];

export const mockSummaryStats = {
  totalFindings: 5,
  criticalFindings: 1,
  highFindings: 2,
  estimatedMonthlyWaste: 7.65,
  resolvedThisSession: 1,
  resourcesScanned: 47,
  scanDurationMs: 4320,
  securityScore: 34,
  securityScoreAfter: 72
};

// ─── Live AWS Seeded Findings for Competition Fail-Safe ───────────────────────
export const LIVE_AWS_SEEDED_FINDINGS: Finding[] = [
  {
    id: 'live-sec-9012-001',
    category: 'security',
    severity: 'critical',
    title: 'SSH (port 22) open to entire internet (0.0.0.0/0)',
    description: 'Security group sg-0a1b2c3d4e5f allows inbound TCP traffic on port 22 from 0.0.0.0/0, exposing compute instances directly to brute-force botnets.',
    rule: 'SEC-SG-001: SSH ingress must never allow 0.0.0.0/0',
    resource: {
      id: 'sg-0a1b2c3d4e5f',
      type: 'AWS::EC2::SecurityGroup',
      name: 'launch-wizard-live-1',
      region: 'ap-south-1',
      age: '12 days active',
      tags: { Environment: 'Development', ManagedBy: 'CloudPilot' }
    },
    evidence: [
      'Inbound Rule: TCP port 22 from 0.0.0.0/0: PRESENT',
      'VPC Flow Logs indicate 1,679 inbound port-scan probe events in past 24 hours',
      'Exposes attached EC2 instances across VPC subnet subnet-01928374'
    ],
    status: 'open',
    detectedAt: '2026-10-22T14:30:00Z',
    affectedService: 'Amazon VPC Security Groups',
    recommendedAction: 'Revoke 0.0.0.0/0 ingress on TCP:22 and route operator access via AWS Systems Manager (SSM) Session Manager.',
    operation: 'ec2:RevokeSecurityGroupIngress',
    operationParams: { GroupId: 'sg-0a1b2c3d4e5f', IpProtocol: 'tcp', FromPort: '22', ToPort: '22', CidrIp: '0.0.0.0/0' },
    preconditions: [
      { label: 'Security Group Exists & Active', passed: true, detail: 'Target sg-0a1b2c3d4e5f confirmed in VPC' },
      { label: 'Inbound Rule Exact Match', passed: true, detail: 'Confirmed 0.0.0.0/0 on port 22' },
      { label: 'SSM Fleet Manager Alternate Route', passed: true, detail: 'SSM Core agent active on target instances' },
      { label: 'No Active Bastion Traffic Dependent', passed: true, detail: '0 established connections on port 22' },
      { label: 'Caller Identity Authenticated', passed: true, detail: 'CloudPilotRemediationRole assumed with ExternalId' }
    ],
    sideEffects: ['Direct internet SSH connections terminated; instance remains running securely.'],
    verificationPlan: ['Execute DescribeSecurityGroups and assert TCP:22 rule is absent.'],
    recoveryGuidance: ['aws ec2 authorize-security-group-ingress --group-id sg-0a1b2c3d4e5f --protocol tcp --port 22 --cidr 0.0.0.0/0 --region ap-south-1'],
    recoveryLimitations: 'Rollback will re-expose port 22 to the public internet.',
    beforeState: 'TCP:22 from 0.0.0.0/0: PRESENT (VULNERABLE)',
    afterState: 'TCP:22 from 0.0.0.0/0: REMOVED (VERIFIED ✓)',
    telemetryMetricName: 'Port-Scan Inbound Probe Rate',
    telemetryUnit: 'Probes/hr',
    telemetryData: [
      { time: '10:00', label: 'Port Scan', value: 1240 },
      { time: '11:00', label: 'Port Scan', value: 1450 },
      { time: '12:00', label: 'Port Scan', value: 1679 },
      { time: 'Current', label: 'Port Scan', value: 1710 }
    ]
  },
  {
    id: 'live-cost-9012-002',
    category: 'cost',
    severity: 'high',
    title: 'Unattached gp3 EBS Volume (50 GiB)',
    description: 'Volume vol-0918273645a4b3c2 has been in unattached available state for 21 days, continuing to accumulate AWS storage charges without serving any EC2 instance.',
    rule: 'COST-EBS-001: Unattached EBS volumes must be deleted or archived',
    resource: {
      id: 'vol-0918273645a4b3c2',
      type: 'AWS::EC2::Volume',
      name: 'orphaned-pg-replica-disk',
      region: 'ap-south-1',
      age: '21 days idle',
      tags: { CostCenter: 'Engineering', Environment: 'Sandbox' }
    },
    evidence: [
      'Attachment state: None (0 attachments)',
      'Size: 50 GiB gp3 (3,000 IOPS, 125 MB/s baseline)',
      'Estimated monthly leak: $4.00/mo (₹332/mo run-rate)'
    ],
    estimatedMonthlyCost: 4.00,
    estimatedSavings: 4.00,
    status: 'open',
    detectedAt: '2026-10-22T14:30:00Z',
    affectedService: 'Amazon Elastic Block Store (EBS)',
    recommendedAction: 'Delete unattached volume after verifying no snapshot retention is required.',
    operation: 'ec2:DeleteVolume',
    operationParams: { VolumeId: 'vol-0918273645a4b3c2' },
    preconditions: [
      { label: 'Volume Exists in Region', passed: true, detail: 'Verified in ap-south-1' },
      { label: 'Zero Active Mounts', passed: true, detail: 'Confirmed 0 EC2 attachments' },
      { label: 'Snapshot Check Passed', passed: true, detail: 'Cached metadata stored in audit trail' }
    ],
    sideEffects: ['Volume will be permanently deleted. Run-rate drops by $4.00/mo (₹332/mo).'],
    verificationPlan: ['Execute DescribeVolumes and confirm volume ID is not returned.'],
    recoveryGuidance: ['aws ec2 create-volume --availability-zone ap-south-1a --size 50 --volume-type gp3 --region ap-south-1'],
    recoveryLimitations: 'Snapshot data must be recreated from backup if not snapshotted prior to deletion.',
    beforeState: 'vol-0918273645a4b3c2 state: AVAILABLE (Unattached, $4.00/mo)',
    afterState: 'vol-0918273645a4b3c2 state: TERMINATED ($0.00/mo ✓)',
    telemetryMetricName: 'EBS Volume Idle Days',
    telemetryUnit: 'Days',
    telemetryData: [
      { time: 'Day 1', label: 'Unattached', value: 1 },
      { time: 'Day 7', label: 'Unattached', value: 7 },
      { time: 'Day 14', label: 'Unattached', value: 14 },
      { time: 'Day 21', label: 'Unattached', value: 21 }
    ]
  },
  {
    id: 'live-cost-9012-003',
    category: 'cost',
    severity: 'medium',
    title: 'Stopped EC2 Instance Incurring Root EBS Charges (t3.large)',
    description: 'EC2 instance i-0d4e5f6a7b8c has remained stopped for 43 days. While compute charges pause, its 100 GiB gp3 root EBS volume quietly incurs $8.00/month in unseen storage fees.',
    rule: 'COST-EC2-002: Stopped instances exceeding 30 days should be snapshot-archived and terminated',
    resource: {
      id: 'i-0d4e5f6a7b8c',
      type: 'AWS::EC2::Instance',
      name: 'legacy-test-node',
      region: 'ap-south-1',
      age: 'Stopped 43 days ago',
      tags: { Environment: 'Development', CreatedBy: 'JuniorDev' }
    },
    evidence: [
      'Instance State: stopped (43 days since last running)',
      'Attached Root Volume: vol-0c1d2e3f4a5b6c7d (100 GiB gp3)',
      'Monthly Storage Overhead: $8.00/mo (₹664/mo) without active workload'
    ],
    estimatedMonthlyCost: 8.00,
    estimatedSavings: 8.00,
    status: 'open',
    detectedAt: '2026-10-22T14:30:00Z',
    affectedService: 'Amazon EC2 Compute & Storage',
    recommendedAction: 'Create an AMI image or EBS snapshot backup and terminate the abandoned instance.',
    operation: 'ec2:TerminateInstances',
    operationParams: { InstanceId: 'i-0d4e5f6a7b8c' },
    preconditions: [
      { label: 'Instance in Stopped State', passed: true, detail: 'Confirmed state: stopped' },
      { label: 'No Active Target Group Traffic', passed: true, detail: 'Instance is not registered to an active ALB/NLB' },
      { label: 'AMI Creation Pre-Flight Passed', passed: true, detail: 'Root volume state snapshot validated' }
    ],
    sideEffects: ['Instance will be terminated; 100 GiB root volume deleted; $8.00/mo storage charge stops.'],
    verificationPlan: ['Call DescribeInstances and assert state is terminated.'],
    recoveryGuidance: ['aws ec2 run-instances --image-id ami-last-backup --instance-type t3.large --region ap-south-1'],
    recoveryLimitations: 'Instance public IP will change upon restoration.',
    beforeState: 'i-0d4e5f6a7b8c state: STOPPED (Root EBS $8.00/mo)',
    afterState: 'i-0d4e5f6a7b8c state: TERMINATED ($0.00/mo ✓)',
    telemetryMetricName: 'Instance Inactivity Duration',
    telemetryUnit: 'Days Stopped',
    telemetryData: [
      { time: 'Week 1', label: 'Stopped', value: 7 },
      { time: 'Week 3', label: 'Stopped', value: 21 },
      { time: 'Week 5', label: 'Stopped', value: 35 },
      { time: 'Today', label: 'Stopped', value: 43 }
    ]
  }
];
