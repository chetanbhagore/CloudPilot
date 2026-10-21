import { useNavigate } from 'react-router-dom';
import { ArrowRight, ShieldCheck } from 'lucide-react';
import PassportView from '../components/PassportView';
import { useDemo } from '../context/useDemo';
import { type SafetyPassport } from '../data/mockData';
import { sound } from '../utils/soundEngine';

export default function PassportPage() {
  const navigate = useNavigate();
  const { getActiveFinding, activeScenario, isRemediated } = useDemo();
  const currentFinding = getActiveFinding();
  const isStudent = activeScenario === 'student';

  const generatedAt = currentFinding.detectedAt;
  const expiresAt = '2026-10-21T18:00:00Z';

  // Construct dynamic Safety Passport based on active finding
  const dynamicPassport: SafetyPassport = isStudent ? {
    findingId: currentFinding.id,
    generatedAt,
    expiresAt,
    findingEvidence: currentFinding.evidence,
    resourceIdentity: {
      id: currentFinding.resource.id,
      type: currentFinding.resource.type,
      region: currentFinding.resource.region,
      account: '987654321098'
    },
    operation: 'ec2:StopInstances',
    operationParams: {
      InstanceIds: `["${currentFinding.resource.id}"]`,
      Hibernate: 'false',
      Force: 'false'
    },
    preconditions: [
      { label: 'Target GPU instance confirmed running in us-east-1', passed: true, detail: 'Status: 2/2 system and instance health checks passed' },
      { label: 'Zero active PyTorch / CUDA jobs executing', passed: true, detail: 'GPU utilization verified < 1.5% for 144 hours' },
      { label: 'EBS root volume snapshot ready for rollback', passed: true, detail: 'Snapshot snap-0student99 ready' },
      { label: 'CloudPilot Remediation Role has ec2:StopInstances permission', passed: true, detail: 'IAM policy simulation passed' },
      { label: 'No conflicting auto-scaling lifecycle hooks active', passed: true, detail: 'Standalone research instance verified' }
    ],
    sideEffects: [
      'The GPU instance will enter the stopped state; per-second compute billing ($3.06/hr) halts immediately.',
      'Attached EBS root volume storage ($0.10/GB-month) will continue to incur standard volume preservation fees.',
      'Elastic IP association will be retained without reallocation.',
      'Instance can be powered back on at any moment via console or CLI in under 45 seconds.'
    ],
    approvalStatus: isRemediated ? 'approved' : 'pending',
    verificationPlan: [
      'Call ec2:DescribeInstances for instance ID immediately after stop call.',
      'Confirm instance state has transitioned to "stopped".',
      'Verify hourly run-rate drops from $3.06/hr to $0.00/hr.'
    ],
    recoveryGuidance: [
      `To power the GPU instance back on, run: aws ec2 start-instances --instance-ids ${currentFinding.resource.id} --region us-east-1`,
      'All local SSD scratch files and training notebooks on EBS remain intact.'
    ]
  } : {
    findingId: currentFinding.id,
    generatedAt,
    expiresAt,
    findingEvidence: currentFinding.evidence,
    resourceIdentity: {
      id: currentFinding.resource.id,
      type: currentFinding.resource.type,
      region: currentFinding.resource.region,
      account: '123456789012'
    },
    operation: 'ec2:RevokeSecurityGroupIngress',
    operationParams: {
      GroupId: currentFinding.resource.id,
      IpProtocol: 'tcp',
      FromPort: '22',
      ToPort: '22',
      CidrIp: '0.0.0.0/0'
    },
    preconditions: [
      { label: 'Security group exists and is reachable', passed: true, detail: `${currentFinding.resource.id} confirmed present in ${currentFinding.resource.region}` },
      { label: 'Target rule still present (re-checked)', passed: true, detail: 'TCP:22 from 0.0.0.0/0 confirmed in current ruleset' },
      { label: 'CloudPilot role has ec2:RevokeSecurityGroupIngress permission', passed: true, detail: 'IAM policy simulation passed' },
      { label: 'Security group is not the default VPC group', passed: true, detail: `${currentFinding.resource.id} is custom application security group` },
      { label: 'Zero active SSH connections will be dropped', passed: true, detail: 'Existing TCP established socket states persist undisturbed' }
    ],
    sideEffects: [
      'Active SSH sessions to instances will NOT be terminated — existing TCP connections persist.',
      'New SSH connection attempts from untrusted IPs will be blocked immediately.',
      'All other inbound rules (port 80, port 443) on this security group are completely unaffected.',
      'No instance reboot or network interruption occurs.'
    ],
    approvalStatus: isRemediated ? 'approved' : 'pending',
    verificationPlan: [
      `Call ec2:DescribeSecurityGroups for ${currentFinding.resource.id} immediately after execution.`,
      'Confirm that no inbound rule with port=22 and source=0.0.0.0/0 is present in the response.',
      'Record the full rule list as the verified after-state.'
    ],
    recoveryGuidance: [
      `To restore SSH access, run: aws ec2 authorize-security-group-ingress --group-id ${currentFinding.resource.id} --protocol tcp --port 22 --cidr <YOUR_IP>/32`,
      'Replace <YOUR_IP> with your trusted CIDR block — not 0.0.0.0/0.'
    ]
  };

  return (
    <div className="page-container">
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, marginBottom: 28, flexWrap: 'wrap' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
            <span className="badge badge-info">STAGE 3 OF 5</span>
            <span style={{ fontSize: 13, color: 'var(--text-tertiary)' }}>Verification Protocol • {currentFinding.id}</span>
          </div>
          <h1 className="display-title" style={{ marginBottom: 6 }}>
            The Safety Passport™
          </h1>
          <p className="body-lead" style={{ maxWidth: 760 }}>
            Every remediation in CloudPilot requires an immutable Safety Passport. Review the 5 automated preconditions, blast radius simulation, and guaranteed rollback CLI command before proceeding.
          </p>
        </div>

        <button
          onClick={() => {
            sound.playClick();
            navigate('/approve');
          }}
          className="btn btn-primary btn-lg"
        >
          <ShieldCheck size={16} />
          <span>{isRemediated ? 'View Authorization Status' : 'Proceed to Authorize'}</span>
          <ArrowRight size={16} />
        </button>
      </div>

      {/* Safety Passport Component */}
      <div style={{ maxWidth: 940, margin: '0 auto' }}>
        <PassportView
          passport={dynamicPassport}
          showApproveButton={!isRemediated}
          onApprove={() => {
            sound.playClick();
            navigate('/approve');
          }}
        />
      </div>
    </div>
  );
}
