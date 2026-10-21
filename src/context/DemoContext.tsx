import { useState, useEffect, type ReactNode } from 'react';
import { type Finding, type AuditRecord } from '../data/mockData';

// ─── Scenario Data Definitions ────────────────────────────────────────────────

const FINTECH_FINDINGS: Finding[] = [
  {
    id: 'finding-001',
    category: 'security',
    severity: 'critical',
    title: 'SSH (port 22) open to entire internet',
    description: 'Security group sg-0a1b2c3d4e5f allows inbound TCP traffic on port 22 from 0.0.0.0/0. Any IP address on the internet can attempt to connect.',
    rule: 'SEC-SG-001: SSH must not be reachable from 0.0.0.0/0',
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
      'Security group attached to 2 running EC2 instances',
      'Instance i-0abc123 has public IP (3.109.45.22)',
      '1,679 automated port-scan attempts logged in last 24h'
    ],
    status: 'open',
    detectedAt: '2026-10-21T14:45:12Z',
    affectedService: 'EC2 / Security Groups',
    recommendedAction: 'Restrict the SSH rule to a trusted corporate CIDR or revoke inbound rule entirely.'
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
      'Volume state: available (detached)',
      'Volume size: 50 GiB gp3',
      'Zero IOPS activity for 23 consecutive days',
      'Estimated monthly run-rate leak: ~$4.00 USD'
    ],
    estimatedMonthlyCost: 4.0,
    estimatedSavings: 4.0,
    status: 'open',
    detectedAt: '2026-10-21T14:45:15Z',
    affectedService: 'EC2 / EBS',
    recommendedAction: 'Create a final recovery snapshot if needed, then terminate the orphaned volume.'
  },
  {
    id: 'finding-003',
    category: 'cost',
    severity: 'high',
    title: 'Unassociated Elastic IP incurring idle fee',
    description: 'Elastic IP 52.66.18.43 is allocated but unassociated with any EC2 instance or ENI.',
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
      'Elastic IP: 52.66.18.43 (unassociated)',
      'Allocated 15 days ago with zero network throughput',
      'Estimated monthly run-rate leak: ~$3.65 USD'
    ],
    estimatedMonthlyCost: 3.65,
    estimatedSavings: 3.65,
    status: 'open',
    detectedAt: '2026-10-21T14:45:18Z',
    affectedService: 'EC2 / Elastic IPs',
    recommendedAction: 'Release the unallocated Elastic IP to eliminate idle reservation fees.'
  },
  {
    id: 'finding-004',
    category: 'security',
    severity: 'medium',
    title: 'S3 bucket missing S3 Block Public Access',
    description: 'S3 bucket "dev-assets-ravi-2024" lacks full S3 Block Public Access enforcement.',
    rule: 'SEC-S3-001: All four S3 Block Public Access flags should be active',
    resource: {
      id: 'dev-assets-ravi-2024',
      type: 'AWS::S3::Bucket',
      name: 'dev-assets-ravi-2024',
      region: 'ap-south-1',
      age: '62 days',
      tags: { Environment: 'dev' }
    },
    evidence: [
      'BlockPublicAcls: false',
      'IgnorePublicAcls: false',
      'Bucket contains 1,240 object assets'
    ],
    status: 'open',
    detectedAt: '2026-10-21T14:45:20Z',
    affectedService: 'S3',
    recommendedAction: 'Enable all 4 Block Public Access parameters at the bucket level.'
  },
  {
    id: 'finding-005',
    category: 'security',
    severity: 'medium',
    title: 'Zero AWS Budget alerts configured',
    description: 'No AWS Budgets or anomaly alerts exist for this account.',
    rule: 'SEC-BUDGET-001: Monthly cost budgets with notification thresholds required',
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
      'No SNS notification topics configured'
    ],
    status: 'open',
    detectedAt: '2026-10-21T14:45:22Z',
    affectedService: 'AWS Budgets',
    recommendedAction: 'Set up an 80% monthly spend alert threshold.'
  }
];

const STUDENT_FINDINGS: Finding[] = [
  {
    id: 'finding-student-001',
    category: 'cost',
    severity: 'critical',
    title: 'Idle GPU instance (p3.2xlarge) running 24/7',
    description: 'Instance i-0gpu998877 (p3.2xlarge, $3.06/hr) has remained under 1.5% GPU utilization for 6 consecutive days.',
    rule: 'COST-EC2-002: Idle high-cost GPU instances should be stopped',
    resource: {
      id: 'i-0gpu998877',
      type: 'AWS::EC2::Instance',
      name: 'pytorch-research-vm',
      region: 'us-east-1',
      age: '6 days idle',
      tags: { Project: 'thesis-vision', Course: 'cs682' }
    },
    evidence: [
      'Instance type: p3.2xlarge (1x NVIDIA V100 GPU)',
      'GPU CloudWatch utilization < 1.5% for 144 hours',
      'Estimated monthly run-rate leak: ~$2,203.20 USD'
    ],
    estimatedMonthlyCost: 2203.20,
    estimatedSavings: 2203.20,
    status: 'open',
    detectedAt: '2026-10-21T14:45:12Z',
    affectedService: 'EC2 / GPU Instances',
    recommendedAction: 'Stop or downscale the instance to an on-demand CPU VM when experiments are not running.'
  },
  {
    id: 'finding-student-002',
    category: 'security',
    severity: 'critical',
    title: 'Jupyter notebook port 8888 publicly exposed',
    description: 'Security group sg-0student99 allows inbound TCP 8888 from 0.0.0.0/0 without authentication token guard.',
    rule: 'SEC-SG-003: Interactive development ports must not be open to 0.0.0.0/0',
    resource: {
      id: 'sg-0student99',
      type: 'AWS::EC2::SecurityGroup',
      name: 'jupyter-sg',
      region: 'us-east-1',
      age: '12 days',
      tags: { Project: 'thesis' }
    },
    evidence: [
      'Inbound rule: protocol=TCP, port=8888, source=0.0.0.0/0',
      'Instance has public DNS accessible over WAN',
      'Risk: Remote code execution via unauthenticated notebook kernel'
    ],
    status: 'open',
    detectedAt: '2026-10-21T14:45:15Z',
    affectedService: 'EC2 / Security Groups',
    recommendedAction: 'Restrict port 8888 to your personal IP (/32) or SSH tunnel via localhost:8888.'
  },
  {
    id: 'finding-student-003',
    category: 'cost',
    severity: 'high',
    title: 'Training checkpoints saved on provisioned io2 EBS',
    description: 'EBS volume vol-0io2fast (200 GiB, 5000 IOPS) provisioned for batch inference is idle.',
    rule: 'COST-EBS-003: Extreme IOPS provisioned volumes should be downscaled',
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
      'Actual IOPS consumed < 20 IOPS',
      'Estimated monthly run-rate leak: ~$310.00 USD'
    ],
    estimatedMonthlyCost: 310.0,
    estimatedSavings: 280.0,
    status: 'open',
    detectedAt: '2026-10-21T14:45:18Z',
    affectedService: 'EC2 / EBS',
    recommendedAction: 'Migrate volume to standard gp3 storage with 300 baseline IOPS.'
  }
];

// Helper to compute genuine SHA-256 in browser
async function computeSHA256(message: string): Promise<string> {
  const msgUint8 = new TextEncoder().encode(message);
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgUint8);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

// ─── Context Interface ────────────────────────────────────────────────────────

import { DemoContext, type ScenarioType } from './contextDefinition';

export function DemoProvider({ children }: { children: ReactNode }) {
  const [activeScenario, setActiveScenarioState] = useState<ScenarioType>('fintech');
  const [findings, setFindings] = useState<Finding[]>(FINTECH_FINDINGS);
  const [isRemediated, setIsRemediated] = useState<boolean>(false);
  const [auditRecords, setAuditRecords] = useState<AuditRecord[]>([]);
  const [activeHash, setActiveHash] = useState<string>('sha256-pending-authorization');
  const [selectedFindingId, setSelectedFindingId] = useState<string>('finding-001');

  // Switch scenario datasets cleanly
  const setScenario = (scenario: ScenarioType) => {
    setActiveScenarioState(scenario);
    setIsRemediated(false);
    setAuditRecords([]);
    setActiveHash('sha256-pending-authorization');

    if (scenario === 'student') {
      setFindings(STUDENT_FINDINGS);
      setSelectedFindingId('finding-student-001');
    } else {
      setFindings(FINTECH_FINDINGS);
      setSelectedFindingId('finding-001');
    }
  };

  // Dynamic calculations based on remediation state
  const isStudent = activeScenario === 'student';
  const initialScore = isStudent ? 42 : 34;
  const postRemediationScore = isStudent ? 88 : 72;
  const securityScore = isRemediated ? postRemediationScore : initialScore;

  const initialWaste = isStudent ? 2513.20 : 7.65;
  const postRemediationWaste = isStudent ? 310.00 : 0.00;
  const monthlyWaste = isRemediated ? postRemediationWaste : initialWaste;

  const criticalCount = findings.filter((f) => f.severity === 'critical' && f.status === 'open').length;
  const resolvedCount = isRemediated ? 1 : 0;

  const getActiveFinding = (): Finding => {
    return findings.find((f) => f.id === selectedFindingId) || findings[0];
  };

  // Approve action: actively updates finding status, computes genuine SHA-256 hash, creates audit record
  const approveRemediation = async () => {
    const targetFinding = getActiveFinding();
    const now = new Date().toISOString();
    const requestId = `aws-req-${Math.random().toString(36).substring(2, 10)}-${Date.now().toString(36)}`;

    // Genuine SHA-256 calculation
    const rawDataToSign = `${targetFinding.id}|${targetFinding.resource.id}|${now}|${requestId}|demo@cloudpilot.dev`;
    const computedHash = await computeSHA256(rawDataToSign);
    setActiveHash(computedHash);

    // Update findings array
    setFindings((prev) =>
      prev.map((f) =>
        f.id === targetFinding.id
          ? { ...f, status: 'resolved' as const }
          : f
      )
    );

    // Create real audit record
    const newRecord: AuditRecord = {
      id: `audit-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${Math.floor(1000 + Math.random() * 9000)}`,
      findingId: targetFinding.id,
      action: isStudent
        ? 'ec2:StopInstances — Stop idle GPU instance i-0gpu998877'
        : 'ec2:RevokeSecurityGroupIngress — TCP:22 from 0.0.0.0/0',
      resource: `${targetFinding.resource.id} (${targetFinding.resource.name}, ${targetFinding.resource.region})`,
      authorizedBy: 'demo@cloudpilot.dev',
      authorizedAt: now,
      executedAt: new Date(Date.now() + 3200).toISOString(),
      awsResponse: `200 OK — RequestId: ${requestId}`,
      outcome: 'success',
      beforeState: isStudent ? 'i-0gpu998877 state: RUNNING (idle 1.2% GPU)' : 'TCP:22 from 0.0.0.0/0: PRESENT',
      afterState: isStudent ? 'i-0gpu998877 state: STOPPED (verified)' : 'TCP:22 from 0.0.0.0/0: REMOVED (verified)'
    };

    setAuditRecords([newRecord]);
    setIsRemediated(true);
  };

  // Full demo reset back to original state
  const resetDemo = () => {
    setIsRemediated(false);
    setAuditRecords([]);
    setActiveHash('sha256-pending-authorization');
    if (activeScenario === 'student') {
      setFindings(STUDENT_FINDINGS);
      setSelectedFindingId('finding-student-001');
    } else {
      setFindings(FINTECH_FINDINGS);
      setSelectedFindingId('finding-001');
    }
  };

  // Genuine CSV Exporter (downloads real file)
  const exportAuditCSV = () => {
    const recordsToExport = auditRecords.length > 0 ? auditRecords : [
      {
        id: 'audit-demo-initial',
        findingId: 'finding-001',
        action: 'ec2:RevokeSecurityGroupIngress — TCP:22 from 0.0.0.0/0',
        resource: 'sg-0a1b2c3d4e5f (launch-wizard-1, ap-south-1)',
        authorizedBy: 'demo@cloudpilot.dev',
        authorizedAt: new Date().toISOString(),
        executedAt: new Date().toISOString(),
        awsResponse: '200 OK — RequestId: a1b2c3d4-5678-90ab-cdef-1234567890ab',
        outcome: 'success' as const,
        beforeState: 'TCP:22 from 0.0.0.0/0: PRESENT',
        afterState: 'TCP:22 from 0.0.0.0/0: REMOVED (verified)'
      }
    ];

    const headers = ['Audit ID', 'Finding ID', 'AWS Action', 'Target Resource', 'Authorized By', 'Authorized At', 'Executed At', 'AWS Response', 'Outcome', 'Before State', 'After State', 'Integrity Hash'];
    const rows = recordsToExport.map((r) => [
      `"${r.id}"`,
      `"${r.findingId}"`,
      `"${r.action}"`,
      `"${r.resource}"`,
      `"${r.authorizedBy}"`,
      `"${r.authorizedAt}"`,
      `"${r.executedAt}"`,
      `"${r.awsResponse}"`,
      `"${r.outcome}"`,
      `"${r.beforeState}"`,
      `"${r.afterState}"`,
      `"${activeHash}"`
    ]);

    const csvContent = [headers.join(','), ...rows.map((row) => row.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `cloudpilot-audit-report-${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Generate initial hash if empty
  useEffect(() => {
    if (activeHash === 'sha256-pending-authorization') {
      computeSHA256('cloudpilot-ledger-initial-seed-2026').then((h) => {
        setActiveHash(h);
      });
    }
  }, [activeHash]);

  return (
    <DemoContext.Provider
      value={{
        activeScenario,
        setScenario,
        findings,
        isRemediated,
        securityScore,
        criticalCount,
        monthlyWaste,
        resolvedCount,
        auditRecords,
        activeHash,
        selectedFindingId,
        setSelectedFindingId,
        getActiveFinding,
        approveRemediation,
        resetDemo,
        exportAuditCSV
      }}
    >
      {children}
    </DemoContext.Provider>
  );
}
