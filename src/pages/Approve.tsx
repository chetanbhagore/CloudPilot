import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import {
  ShieldAlert, CheckCircle2,
  Terminal, ArrowRight, Lock, Sparkles
} from 'lucide-react';
import SlideToApprove from '../components/SlideToApprove';
import { mockSafetyPassportApproved } from '../data/mockData';
import { sound } from '../utils/soundEngine';

type Phase = 'review' | 'executing' | 'verified';

const TERMINAL_LOGS = [
  '[0.10s] Initializing verified execution runner...',
  '[0.35s] Assuming role arn:aws:iam::123456789012:role/CloudPilotReadRole via STS...',
  '[0.68s] Checking pre-flight preconditions: Target sg-0a1b2c3d4e5f presence confirmed.',
  '[1.15s] Executing atomic call: ec2:RevokeSecurityGroupIngress (IpProtocol: tcp, FromPort: 22, CidrIp: 0.0.0.0/0)...',
  '[1.82s] AWS Response 200 OK. AWS RequestId: a1b2c3d4-5678-90ab-cdef-1234567890ab',
  '[2.30s] Running independent verification query: ec2:DescribeSecurityGroups...',
  '[2.75s] Rule 0.0.0.0/0:22 successfully revoked. Inbound rules 80 and 443 remain unaffected.',
  '[3.15s] Ephemeral rollback checkpoint preserved in audit ledger.',
  '[3.40s] Verification complete. Security Health Score recalculated: 72% (+38 pts).'
];

export default function Approve() {
  const navigate = useNavigate();
  const [phase, setPhase] = useState<Phase>('review');
  const [confirmedFriction, setConfirmedFriction] = useState(false);
  const [logIndex, setLogIndex] = useState(0);

  const startExecution = () => {
    setPhase('executing');
    setLogIndex(0);

    // Stream terminal lines
    let currentLine = 0;
    const interval = setInterval(() => {
      currentLine++;
      setLogIndex(currentLine);
      if (currentLine >= TERMINAL_LOGS.length) {
        clearInterval(interval);
        setTimeout(() => {
          sound.playSuccess();
          setPhase('verified');
        }, 800);
      }
    }, 400);
  };

  return (
    <div className="page-container">
      {/* Header */}
      <div style={{ marginBottom: 28 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
          <span className="badge badge-info">STAGE 4 OF 5</span>
          <span style={{ fontSize: 13, color: 'var(--text-tertiary)' }}>Human-in-the-Loop Governance</span>
        </div>
        <h1 className="display-title" style={{ marginBottom: 6 }}>
          Explicit Authorization & Execution
        </h1>
        <p className="body-lead" style={{ maxWidth: 740 }}>
          CloudPilot enforces intentional friction. No AI agent or script can execute remediations autonomously. You explicitly sign and authorize the change.
        </p>
      </div>

      <div style={{ maxWidth: 860, margin: '0 auto' }}>
        <AnimatePresence mode="wait">
          {/* Phase 1: Review & Slide to Authorize */}
          {phase === 'review' && (
            <motion.div
              key="review"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -16 }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              style={{ display: 'flex', flexDirection: 'column', gap: 20 }}
            >
              {/* Action Disclosure Card */}
              <div
                className="apple-card"
                style={{
                  borderLeft: '4px solid var(--apple-crimson)',
                  background: '#FFFFFF'
                }}
              >
                <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
                  <div style={{ width: 40, height: 40, borderRadius: 10, background: 'var(--apple-crimson-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <ShieldAlert size={22} color="var(--apple-crimson)" />
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 4 }}>
                      Authorized AWS Operation: Revoke Security Group Ingress
                    </div>
                    <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                      Target: <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600 }}>sg-0a1b2c3d4e5f</span> (launch-wizard-1, ap-south-1)<br />
                      Remediation: Remove inbound rule for TCP Port 22 from <span style={{ fontFamily: 'var(--font-mono)' }}>0.0.0.0/0</span>.<br />
                      Impact: New SSH connections from untrusted IPs will be blocked immediately. Existing active TCP sessions remain uninterrupted.
                    </div>
                  </div>
                </div>
              </div>

              {/* Friction Protection: Checkbox */}
              <div
                className="apple-card"
                onClick={() => {
                  sound.playClick();
                  setConfirmedFriction(!confirmedFriction);
                }}
                style={{
                  cursor: 'pointer',
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
                  I confirm that I have reviewed the Safety Passport, verified that zero active SSH connections will be severed, and note the deterministic rollback CLI command.
                </div>
              </div>

              {/* Apple Physical Slide to Approve Component */}
              <div className="apple-card" style={{ padding: 24, textAlign: 'center' }}>
                <div style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-secondary)', marginBottom: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                  <Lock size={14} /> Slide to Sign & Authorize Execution
                </div>

                <SlideToApprove
                  disabled={!confirmedFriction}
                  onApprove={startExecution}
                  text={confirmedFriction ? 'Slide to Sign & Execute Remediation' : 'Confirm Checkbox Above to Unlock Slider'}
                />

                <div style={{ fontSize: 11.5, color: 'var(--text-tertiary)', marginTop: 12 }}>
                  Protected by CloudPilot Non-Repudiation Policy • Signed by demo@cloudpilot.dev
                </div>
              </div>
            </motion.div>
          )}

          {/* Phase 2: Live Execution Terminal Simulation */}
          {phase === 'executing' && (
            <motion.div
              key="executing"
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.96 }}
              className="apple-card"
              style={{ padding: 0, overflow: 'hidden' }}
            >
              <div className="terminal-header">
                <div className="terminal-dot" style={{ background: '#FF5F56' }} />
                <div className="terminal-dot" style={{ background: '#FFBD2E' }} />
                <div className="terminal-dot" style={{ background: '#27C93F' }} />
                <div style={{ fontSize: 12, color: '#A1A1A6', marginLeft: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Terminal size={13} />
                  <span>CloudPilot Execution Agent • Verified Pipeline</span>
                </div>
              </div>

              <div className="terminal-body">
                {TERMINAL_LOGS.slice(0, logIndex + 1).map((log, i) => (
                  <div key={i} style={{ color: log.includes('200 OK') || log.includes('complete') ? '#30D158' : '#E2E8F0' }}>
                    {log}
                  </div>
                ))}
                <div style={{ display: 'inline-block', width: 8, height: 14, background: '#0071E3', marginLeft: 4, verticalAlign: 'middle', animation: 'radar-pulse 1s infinite' }} />
              </div>
            </motion.div>
          )}

          {/* Phase 3: Verified Outcome & Score Jump */}
          {phase === 'verified' && (
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
                <p style={{ fontSize: 14, color: 'var(--text-secondary)', maxWidth: 540, margin: '0 auto 24px' }}>
                  The insecure SSH rule has been removed from <code style={{ fontFamily: 'var(--font-mono)' }}>sg-0a1b2c3d4e5f</code>. Verified via independent post-execution describe call.
                </p>

                {/* Score Jump Highlight */}
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: 20, padding: '14px 28px', background: 'var(--surface-secondary)', borderRadius: 16, marginBottom: 24 }}>
                  <div>
                    <div style={{ fontSize: 11, color: 'var(--text-tertiary)', textTransform: 'uppercase', fontWeight: 700 }}>Previous Security Score</div>
                    <div style={{ fontSize: 24, fontWeight: 800, color: 'var(--apple-crimson)' }}>34%</div>
                  </div>
                  <ArrowRight size={20} color="var(--text-tertiary)" />
                  <div>
                    <div style={{ fontSize: 11, color: 'var(--text-tertiary)', textTransform: 'uppercase', fontWeight: 700 }}>New Security Score</div>
                    <div style={{ fontSize: 24, fontWeight: 800, color: 'var(--apple-emerald-dark)' }}>72% (+38 pts)</div>
                  </div>
                </div>

                <div>
                  <button
                    onClick={() => {
                      sound.playClick();
                      navigate('/audit');
                    }}
                    className="btn btn-primary btn-lg"
                  >
                    <Sparkles size={16} />
                    <span>View Cryptographic Audit Trail & Proof</span>
                    <ArrowRight size={16} />
                  </button>
                </div>
              </div>

              {/* State Diff Card */}
              <div className="apple-card">
                <div className="section-title" style={{ marginBottom: 12 }}>
                  Verified Rule State Diff
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                  <div style={{ padding: 14, background: '#FAF9F8', borderRadius: 10, border: '1px solid var(--border-subtle)' }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--apple-crimson-dark)', marginBottom: 6 }}>
                      BEFORE EXECUTION
                    </div>
                    {Object.entries(mockSafetyPassportApproved.executionResult!.beforeState).map(([k, v]) => (
                      <div key={k} style={{ fontSize: 12.5, display: 'flex', justifyContent: 'space-between', padding: '3px 0' }}>
                        <span style={{ color: 'var(--text-secondary)' }}>{k}</span>
                        <span style={{ color: 'var(--apple-crimson)', fontWeight: 600 }}>{v}</span>
                      </div>
                    ))}
                  </div>

                  <div style={{ padding: 14, background: '#FAF9F8', borderRadius: 10, border: '1px solid var(--border-subtle)' }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--apple-emerald-dark)', marginBottom: 6 }}>
                      VERIFIED AFTER EXECUTION
                    </div>
                    {Object.entries(mockSafetyPassportApproved.executionResult!.afterState).map(([k, v]) => (
                      <div key={k} style={{ fontSize: 12.5, display: 'flex', justifyContent: 'space-between', padding: '3px 0' }}>
                        <span style={{ color: 'var(--text-secondary)' }}>{k}</span>
                        <span style={{ color: 'var(--apple-emerald-dark)', fontWeight: 600 }}>{v}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
