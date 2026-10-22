import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import {
  CheckCircle2,
  ArrowRight, Lock, AlertTriangle,
  FileText, Check
} from 'lucide-react';
import SlideToApprove from '../components/SlideToApprove';
import { useDemo } from '../context/useDemo';
import { useAuth } from '../context/useAuth';
import { sound } from '../utils/soundEngine';

type Phase = 'review' | 'executing' | 'verified' | 'failed';

export default function Approve() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const {
    getActiveFinding,
    accountConfig,
    resolvedFindingIds,
    securityScore,
    approveRemediation,
    appMode
  } = useDemo();

  const currentFinding = getActiveFinding();
  const isAlreadyResolved = currentFinding.status === 'resolved' || resolvedFindingIds.includes(currentFinding.id);
  const isBlocked = currentFinding.status === 'blocked' || currentFinding.isSafetyBlocked;

  const [phase, setPhase] = useState<Phase>('review');
  const [confirmedFriction, setConfirmedFriction] = useState(false);
  const [executionStep, setExecutionStep] = useState(0);
  const [remediationError, setRemediationError] = useState<string | null>(null);

  const effectivePhase: Phase = isAlreadyResolved ? 'verified' : phase;

  // 6 Believable Execution Stages
  const executionStages = [
    { title: 'Rechecking Preconditions', detail: `Asserting target resource ${currentFinding.resource?.id} state in ${currentFinding.resource?.region}` },
    { title: 'Validating Human Cryptographic Signature', detail: `Cryptographic author attribution: ${user.name} (${user.email})` },
    { title: 'Assuming Scoped IAM Remediation Role', detail: `STS AssumeRole: arn:aws:iam::${accountConfig.accountId}:role/CloudPilotRemediationRole (ExternalId=${accountConfig.externalId || 'cp-tenant-9042-demo'})` },
    { title: 'Dispatching Atomic AWS API Call', detail: `Executing ${currentFinding.operation} with verified parameter payload` },
    { title: 'Reading Back Verified Cloud State', detail: `Calling verification Describe query for ${currentFinding.resource?.id}` },
    { title: 'Stamping Cryptographic Audit Ledger', detail: 'Computing WebCrypto SHA-256 seal and appending tamper-evident record' },
  ];

  const startExecution = async () => {
    if (isBlocked) return;
    setPhase('executing');
    setExecutionStep(0);
    setRemediationError(null);

    try {
      setExecutionStep(1);
      await new Promise((r) => setTimeout(r, 250));
      setExecutionStep(2);
      await new Promise((r) => setTimeout(r, 250));
      setExecutionStep(3);
      await new Promise((r) => setTimeout(r, 250));
      setExecutionStep(4);

      // Trigger real execution & independent verification via DemoContext -> Backend API
      await approveRemediation(currentFinding.id);

      setExecutionStep(5);
      await new Promise((r) => setTimeout(r, 250));
      setExecutionStep(6);
      await new Promise((r) => setTimeout(r, 200));

      sound.playSuccess();
      setPhase('verified');
    } catch (err: unknown) {
      sound.playSnap();
      const msg = err instanceof Error ? err.message : String(err);
      setRemediationError(msg);
      setPhase('failed');
    }
  };

  return (
    <div className="page-container">
      {/* Header */}
      <div style={{ marginBottom: 28 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
          <span className="badge badge-info">STAGE 4 OF 5</span>
          <span style={{ fontSize: 13, color: 'var(--text-tertiary)' }}>
            Human-in-the-Loop Governance • {currentFinding.id}
          </span>
        </div>
        <h1 className="display-title" style={{ marginBottom: 6 }}>
          Explicit Authorization & Execution
        </h1>
        <p className="body-lead" style={{ maxWidth: 760 }}>
          CloudPilot enforces intentional friction. No automated script or AI agent can alter your cloud without explicit sign-off. Review the proposed action and authorize execution.
        </p>
      </div>

      <div style={{ maxWidth: 880, margin: '0 auto' }}>
        <AnimatePresence mode="wait">
          {/* Phase 1: Review & Slide to Authorize */}
          {effectivePhase === 'review' && (
            <motion.div
              key="review"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -16 }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              style={{ display: 'flex', flexDirection: 'column', gap: 20 }}
            >
              {/* Safety Blocker Notice if finding failed checks */}
              {isBlocked && (
                <div
                  className="apple-card"
                  style={{
                    background: 'rgba(255, 159, 10, 0.08)',
                    border: '2px solid rgba(255, 159, 10, 0.4)',
                    padding: 20
                  }}
                >
                  <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
                    <AlertTriangle size={24} color="var(--apple-amber-dark)" style={{ flexShrink: 0, marginTop: 2 }} />
                    <div>
                      <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--apple-amber-dark)', marginBottom: 4 }}>
                        Remediation Blocked by Pre-Flight Safety Engine
                      </div>
                      <div style={{ fontSize: 13, color: 'var(--text-primary)', lineHeight: 1.6, marginBottom: 12 }}>
                        {currentFinding.blockedReason || 'Automated safety checks failed. CloudPilot prevents executing this remediation because dependent services would be impacted.'}
                      </div>
                      <button
                        onClick={() => {
                          sound.playClick();
                          navigate('/passport');
                        }}
                        className="btn btn-secondary btn-sm"
                      >
                        <span>Inspect Precondition Details in Safety Passport</span>
                        <ArrowRight size={12} />
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Action Disclosure Card */}
              <div
                className="apple-card"
                style={{
                  borderLeft: `4px solid ${isBlocked ? 'var(--apple-amber)' : 'var(--apple-blue)'}`,
                  background: '#FFFFFF'
                }}
              >
                <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
                  <div
                    style={{
                      width: 44,
                      height: 44,
                      borderRadius: 12,
                      background: isBlocked ? 'var(--apple-amber-light)' : 'var(--apple-blue-light)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0
                    }}
                  >
                    {isBlocked ? (
                      <AlertTriangle size={24} color="var(--apple-amber-dark)" />
                    ) : (
                      <Lock size={22} color="var(--apple-blue)" />
                    )}
                  </div>

                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4, flexWrap: 'wrap', gap: 8 }}>
                      <div style={{ fontSize: 17, fontWeight: 700, color: 'var(--text-primary)' }}>
                        Proposed AWS Action: {currentFinding.operation}
                      </div>
                      <span className={`badge ${currentFinding.severity === 'critical' ? 'badge-critical' : 'badge-high'}`}>
                        {currentFinding.severity.toUpperCase()}
                      </span>
                    </div>

                    <div style={{ fontSize: 13.5, color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: 14 }}>
                      <strong>Target Infrastructure:</strong> <code style={{ fontFamily: 'var(--font-mono)' }}>{currentFinding.resource.id}</code> ({currentFinding.resource.name}, {currentFinding.resource.region})<br />
                      <strong>Scope:</strong> {currentFinding.title}<br />
                      <strong>Remediation:</strong> {currentFinding.recommendedAction}
                    </div>

                    {/* Before vs Expected State Preview */}
                    <div style={{ background: '#FAF9F8', padding: 14, borderRadius: 10, border: '1px solid var(--border-subtle)', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 12 }}>
                      <div>
                        <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--apple-crimson-dark)', textTransform: 'uppercase' }}>
                          Current Simulated State
                        </div>
                        <div style={{ fontSize: 12.5, color: 'var(--text-secondary)', marginTop: 2, fontFamily: 'var(--font-mono)' }}>
                          {currentFinding.beforeState}
                        </div>
                      </div>

                      <div>
                        <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--apple-emerald-dark)', textTransform: 'uppercase' }}>
                          Expected Verified State
                        </div>
                        <div style={{ fontSize: 12.5, color: 'var(--apple-emerald-dark)', fontWeight: 600, marginTop: 2, fontFamily: 'var(--font-mono)' }}>
                          {currentFinding.afterState}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Friction Protection: Checkbox */}
              <div
                className="apple-card"
                onClick={() => {
                  if (isBlocked) return;
                  sound.playClick();
                  setConfirmedFriction(!confirmedFriction);
                }}
                style={{
                  cursor: isBlocked ? 'not-allowed' : 'pointer',
                  opacity: isBlocked ? 0.5 : 1,
                  borderColor: confirmedFriction ? 'var(--apple-blue)' : 'var(--border-subtle)',
                  background: confirmedFriction ? 'rgba(0, 113, 227, 0.03)' : '#FFFFFF',
                  padding: 18,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 14
                }}
              >
                <div
                  style={{
                    width: 22,
                    height: 22,
                    borderRadius: 6,
                    border: `2px solid ${confirmedFriction ? 'var(--apple-blue)' : 'var(--border-strong)'}`,
                    background: confirmedFriction ? 'var(--apple-blue)' : 'transparent',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#FFFFFF',
                    flexShrink: 0,
                    transition: 'all 150ms ease'
                  }}
                >
                  {confirmedFriction && <CheckCircle2 size={14} />}
                </div>

                <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)', lineHeight: 1.5 }}>
                  I confirm that I have reviewed the Safety Passport, verified that no active user traffic will be lost, and understand the deterministic rollback CLI command.
                </div>
              </div>

              {/* Slide to Approve Interaction (Mouse, Touch, Keyboard) */}
              <div className="apple-card" style={{ padding: 26, textAlign: 'center' }}>
                <div style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-secondary)', marginBottom: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                  <Lock size={14} /> Explicit Authorization Gate (Press Enter or Slide to Sign)
                </div>

                <SlideToApprove
                  disabled={!confirmedFriction || isBlocked}
                  onApprove={startExecution}
                  text={isBlocked ? 'Blocked by Safety Engine' : confirmedFriction ? 'Slide or Press Enter to Authorize' : 'Confirm Checkbox Above to Unlock Slider'}
                />

                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 16, marginTop: 14, fontSize: 11.5, color: 'var(--text-tertiary)' }}>
                  <span>Authorized by: <strong>{user.name}</strong> ({user.email})</span>
                  <span>•</span>
                  <button
                    onClick={() => {
                      sound.playClick();
                      navigate('/passport');
                    }}
                    className="btn btn-ghost btn-sm"
                    style={{ fontSize: 11.5, color: 'var(--text-secondary)', padding: '2px 8px' }}
                  >
                    Cancel & Return to Passport
                  </button>
                </div>
              </div>
            </motion.div>
          )}

          {/* Phase 2: Live Execution Stages Simulation */}
          {effectivePhase === 'executing' && (
            <motion.div
              key="executing"
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.96 }}
              className="apple-card"
              style={{ padding: 28 }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
                <div className="account-dot" style={{ width: 12, height: 12 }} />
                <div>
                  <h3 style={{ fontSize: 18, fontWeight: 700 }}>
                    {appMode === 'live' || currentFinding.id.startsWith('live-')
                      ? 'Executing Live AWS STS Remediation Pipeline…'
                      : 'Executing Authenticated Remediation Pipeline…'}
                  </h3>
                  <div style={{ fontSize: 12.5, color: 'var(--text-secondary)' }}>
                    Dispatched under scoped role arn:aws:iam::{accountConfig.accountId}:role/CloudPilotRemediationRole
                  </div>
                </div>
              </div>

              {/* Progress Steps */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 24 }}>
                {executionStages.map((stage, i) => {
                  const isDone = executionStep > i;
                  const isCurrent = executionStep === i;

                  return (
                    <div
                      key={i}
                      style={{
                        padding: 12,
                        borderRadius: 10,
                        border: `1px solid ${isDone ? 'rgba(48, 209, 88, 0.3)' : isCurrent ? 'var(--apple-blue)' : 'var(--border-subtle)'}`,
                        background: isDone ? 'rgba(48, 209, 88, 0.05)' : isCurrent ? 'rgba(0, 113, 227, 0.04)' : '#FFFFFF',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 12,
                        transition: 'all 200ms ease'
                      }}
                    >
                      <div
                        style={{
                          width: 24,
                          height: 24,
                          borderRadius: '50%',
                          background: isDone ? 'var(--apple-emerald)' : isCurrent ? 'var(--apple-blue)' : 'var(--surface-secondary)',
                          color: isDone || isCurrent ? '#FFFFFF' : 'var(--text-tertiary)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: 11,
                          fontWeight: 700,
                          flexShrink: 0
                        }}
                      >
                        {isDone ? <Check size={14} /> : i + 1}
                      </div>

                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 13, fontWeight: 600, color: isDone ? 'var(--apple-emerald-dark)' : isCurrent ? 'var(--apple-blue)' : 'var(--text-primary)' }}>
                          {stage.title}
                        </div>
                        <div style={{ fontSize: 11.5, color: 'var(--text-tertiary)' }}>
                          {stage.detail}
                        </div>
                      </div>

                      {isCurrent && (
                        <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--apple-blue)', animation: 'radar-pulse 1s infinite' }} />
                      )}
                    </div>
                  );
                })}
              </div>
            </motion.div>
          )}

          {/* Phase 3: Verified Outcome & State Diff */}
          {effectivePhase === 'verified' && (
            <motion.div
              key="verified"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              style={{ display: 'flex', flexDirection: 'column', gap: 24 }}
            >
              <div className="apple-card" style={{ textAlign: 'center', padding: '36px 24px' }}>
                <div style={{ width: 64, height: 64, margin: '0 auto 16px', borderRadius: '50%', background: 'var(--apple-emerald-light)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <CheckCircle2 size={36} color="var(--apple-emerald-dark)" />
                </div>
                <h2 style={{ fontSize: 24, fontWeight: 800, letterSpacing: '-0.025em', marginBottom: 6 }}>
                  Remediation Successfully Executed & Verified
                </h2>
                <p style={{ fontSize: 14, color: 'var(--text-secondary)', maxWidth: 580, margin: '0 auto 24px', lineHeight: 1.6 }}>
                  Target <code style={{ fontFamily: 'var(--font-mono)' }}>{currentFinding.resource.id}</code> has been safely remediated. Verified via independent post-execution describe query.
                </p>

                {/* Score & Savings Impact Banner */}
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: 24, padding: '16px 32px', background: 'var(--surface-secondary)', borderRadius: 16, marginBottom: 24, flexWrap: 'wrap', justifyContent: 'center' }}>
                  <div>
                    <div style={{ fontSize: 11, color: 'var(--text-tertiary)', textTransform: 'uppercase', fontWeight: 700 }}>Security Health Score</div>
                    <div style={{ fontSize: 26, fontWeight: 800, color: 'var(--apple-emerald-dark)' }}>
                      {securityScore}% ✓
                    </div>
                  </div>

                  {currentFinding.estimatedSavings && (
                    <>
                      <div style={{ width: 1, height: 36, background: 'var(--border-medium)' }} />
                      <div>
                        <div style={{ fontSize: 11, color: 'var(--text-tertiary)', textTransform: 'uppercase', fontWeight: 700 }}>Projected Run-Rate Reduction</div>
                        <div style={{ fontSize: 26, fontWeight: 800, color: 'var(--apple-emerald-dark)' }}>
                          ~${currentFinding.estimatedSavings.toFixed(2)}/mo
                          <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-tertiary)', marginLeft: 6 }}>
                            (₹{Math.round(currentFinding.estimatedSavings * 83).toLocaleString('en-IN')}/mo)
                          </span>
                        </div>
                      </div>
                    </>
                  )}
                </div>

                {/* Verified Before vs After State Diff */}
                <div style={{ textAlign: 'left', background: '#FAF9F8', padding: 20, borderRadius: 14, border: '1px solid var(--border-subtle)', marginBottom: 28, maxWidth: 680, margin: '0 auto 28px' }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: 12 }}>
                    Verified State Transition Diff
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 14 }}>
                    <div style={{ padding: 12, background: '#FFFFFF', borderRadius: 8, border: '1px solid var(--border-subtle)' }}>
                      <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--apple-crimson-dark)', marginBottom: 4 }}>
                        BEFORE (Pre-Remediation State):
                      </div>
                      <div style={{ fontSize: 12.5, color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }}>
                        {currentFinding.beforeState}
                      </div>
                    </div>
                    <div style={{ padding: 12, background: '#FFFFFF', borderRadius: 8, border: '1px solid rgba(48, 209, 88, 0.4)' }}>
                      <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--apple-emerald-dark)', marginBottom: 4 }}>
                        AFTER (Independently Verified via Describe Query):
                      </div>
                      <div style={{ fontSize: 12.5, color: 'var(--apple-emerald-dark)', fontWeight: 600, fontFamily: 'var(--font-mono)' }}>
                        {currentFinding.afterState}
                      </div>
                    </div>
                  </div>
                </div>

                {/* CTAs */}
                <div style={{ display: 'flex', gap: 14, justifyContent: 'center', flexWrap: 'wrap' }}>
                  <button
                    onClick={() => {
                      sound.playSuccess();
                      navigate('/audit');
                    }}
                    className="btn btn-primary btn-lg"
                  >
                    <FileText size={16} />
                    <span>Inspect Cryptographic Audit Proof</span>
                    <ArrowRight size={16} />
                  </button>

                  <button
                    onClick={() => {
                      sound.playClick();
                      navigate('/discover');
                    }}
                    className="btn btn-secondary btn-lg"
                  >
                    <span>Return to Investigation Workspace</span>
                  </button>
                </div>
              </div>
            </motion.div>
          )}

          {/* Phase 4: Execution Failed / Verification Rejected */}
          {effectivePhase === 'failed' && (
            <motion.div
              key="failed"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              style={{ display: 'flex', flexDirection: 'column', gap: 24 }}
            >
              <div className="apple-card" style={{ textAlign: 'center', padding: '36px 24px', background: 'rgba(255, 59, 48, 0.03)', borderColor: 'rgba(255, 59, 48, 0.3)' }}>
                <div style={{ width: 64, height: 64, margin: '0 auto 16px', borderRadius: '50%', background: 'rgba(255, 59, 48, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <AlertTriangle size={34} color="var(--apple-red)" />
                </div>
                <h2 style={{ fontSize: 22, fontWeight: 800, color: 'var(--apple-red)', marginBottom: 6 }}>
                  Remediation Failed — Resource Unaltered
                </h2>
                <p style={{ fontSize: 14, color: 'var(--text-secondary)', maxWidth: 580, margin: '0 auto 16px', lineHeight: 1.6 }}>
                  CloudPilot fails closed: the requested AWS operation or post-execution verification checks did not succeed. To ensure your cloud is not left in an uncertain state, this finding remains open.
                </p>
                {remediationError && (
                  <div style={{ background: '#FFFFFF', padding: '12px 16px', borderRadius: 10, border: '1px solid var(--border-medium)', maxWidth: 620, margin: '0 auto 24px', textAlign: 'left', fontFamily: 'var(--font-mono)', fontSize: 12.5, color: 'var(--apple-red)' }}>
                    {remediationError}
                  </div>
                )}
                <div style={{ display: 'flex', gap: 14, justifyContent: 'center', flexWrap: 'wrap' }}>
                  <button
                    onClick={() => {
                      sound.playClick();
                      setPhase('review');
                    }}
                    className="btn btn-secondary btn-lg"
                  >
                    <span>Retry Authorization</span>
                  </button>
                  <button
                    onClick={() => {
                      sound.playClick();
                      navigate('/discover');
                    }}
                    className="btn btn-ghost btn-lg"
                  >
                    <span>Return to Investigation Workspace</span>
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
