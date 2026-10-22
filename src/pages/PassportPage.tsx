import { useNavigate } from 'react-router-dom';
import { ArrowRight, ShieldCheck } from 'lucide-react';
import PassportView from '../components/PassportView';
import { useDemo } from '../context/useDemo';
import { useAuth } from '../context/useAuth';
import { type SafetyPassport } from '../data/mockData';
import { sound } from '../utils/soundEngine';

export default function PassportPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const {
    getActiveFinding,
    findings,
    setSelectedFindingId,
    resolvedFindingIds,
    accountConfig,
    auditRecords
  } = useDemo();

  const currentFinding = getActiveFinding();

  if (!currentFinding || !currentFinding.id || !currentFinding.resource) {
    return (
      <div className="page-container">
        <div className="apple-card" style={{ maxWidth: 600, margin: '80px auto', textAlign: 'center', padding: '48px 32px' }}>
          <div style={{ width: 48, height: 48, borderRadius: '50%', background: 'var(--apple-blue-light)', color: 'var(--apple-blue)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
            <ShieldCheck size={24} />
          </div>
          <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 8 }}>No Finding Selected</h2>
          <p style={{ fontSize: 14, color: 'var(--text-secondary)', marginBottom: 24, lineHeight: 1.5 }}>
            Every Safety Passport is generated dynamically for a specific cloud risk. Select a finding from the Discover page or initiate a cloud scan to review automated preconditions.
          </p>
          <button
            onClick={() => {
              sound.playClick();
              navigate('/discover');
            }}
            className="btn btn-primary"
            style={{ margin: '0 auto' }}
          >
            <span>Go to Discover Workspace</span>
            <ArrowRight size={14} />
          </button>
        </div>
      </div>
    );
  }

  const isResolved = currentFinding.status === 'resolved' || resolvedFindingIds.includes(currentFinding.id);
  const isBlocked = currentFinding.status === 'blocked' || currentFinding.isSafetyBlocked;

  // Find matching audit record if resolved
  const matchingAudit = auditRecords.find((a) => a.findingId === currentFinding.id);

  // Construct dynamic Safety Passport directly from the rich finding model
  const dynamicPassport: SafetyPassport = {
    findingId: currentFinding.id,
    generatedAt: currentFinding.detectedAt,
    expiresAt: '2026-10-21T18:00:00Z',
    findingEvidence: currentFinding.evidence,
    resourceIdentity: {
      id: currentFinding.resource.id,
      type: currentFinding.resource.type,
      region: currentFinding.resource.region,
      account: accountConfig.accountId
    },
    operation: currentFinding.operation,
    operationParams: currentFinding.operationParams,
    preconditions: currentFinding.preconditions,
    sideEffects: currentFinding.sideEffects,
    approvalStatus: isResolved ? 'approved' : isBlocked ? 'blocked' : 'pending',
    approvedBy: isResolved ? user.email : undefined,
    approvedAt: matchingAudit?.authorizedAt,
    verificationPlan: currentFinding.verificationPlan,
    recoveryGuidance: currentFinding.recoveryGuidance,
    recoveryLimitations: currentFinding.recoveryLimitations,
    isSafetyBlocked: isBlocked,
    blockedReason: currentFinding.blockedReason,
    executionResult: isResolved
      ? {
          status: 'success',
          awsRequestId: matchingAudit?.awsResponse.split('RequestId: ')[1] || 'req-aws-simulated-ok',
          attemptedAt: matchingAudit?.authorizedAt || currentFinding.detectedAt,
          verifiedAt: matchingAudit?.executedAt || '2026-10-21T15:04:38Z',
          beforeState: currentFinding.beforeState,
          afterState: currentFinding.afterState,
          auditId: matchingAudit?.id || 'audit-simulated'
        }
      : undefined
  };

  const handleSelectDifferentFinding = (id: string) => {
    sound.playClick();
    setSelectedFindingId(id);
  };

  return (
    <div className="page-container">
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, marginBottom: 24, flexWrap: 'wrap' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
            <span className="badge badge-info">STAGE 3 OF 5</span>
            <span style={{ fontSize: 13, color: 'var(--text-tertiary)' }}>
              Safety Assessment • {currentFinding.id}
            </span>
          </div>
          <h1 className="display-title" style={{ marginBottom: 6 }}>
            The Safety Passport™
          </h1>
          <p className="body-lead" style={{ maxWidth: 780 }}>
            Every remediation in CloudPilot requires an explicit Safety Passport. Review the 5 automated preconditions, blast radius analysis, and recovery instructions before proceeding to authorization.
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {/* Finding Selector Dropdown */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 12, color: 'var(--text-tertiary)', fontWeight: 600 }}>Inspect Finding:</span>
            <select
              value={currentFinding.id}
              onChange={(e) => handleSelectDifferentFinding(e.target.value)}
              style={{
                padding: '8px 12px',
                borderRadius: 8,
                border: '1px solid var(--border-medium)',
                background: '#FFFFFF',
                fontSize: 12.5,
                fontWeight: 600,
                color: 'var(--text-primary)',
                cursor: 'pointer'
              }}
            >
              {findings.map((f) => (
                <option key={f.id} value={f.id}>
                  {resolvedFindingIds.includes(f.id) ? '✓ ' : f.isSafetyBlocked ? '⚠️ ' : ''}{f.title} ({f.resource.id})
                </option>
              ))}
            </select>
          </div>

          <button
            onClick={() => {
              if (isBlocked) return;
              sound.playClick();
              navigate(isResolved ? '/audit' : '/approve');
            }}
            disabled={isBlocked}
            className="btn btn-primary btn-lg"
            style={{ opacity: isBlocked ? 0.45 : 1, cursor: isBlocked ? 'not-allowed' : 'pointer' }}
          >
            <ShieldCheck size={16} />
            <span>{isResolved ? 'Inspect Audit Ledger' : isBlocked ? 'Blocked by Precondition' : 'Proceed to Authorize'}</span>
            <ArrowRight size={16} />
          </button>
        </div>
      </div>

      {/* Safety Passport Component */}
      <div style={{ maxWidth: 940, margin: '0 auto' }}>
        <PassportView
          passport={dynamicPassport}
          showApproveButton={!isResolved}
          onApprove={() => {
            sound.playClick();
            navigate('/approve');
          }}
        />
      </div>
    </div>
  );
}
