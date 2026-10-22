import { useState } from 'react';
import { motion } from 'framer-motion';
import {
  CheckCircle2, XCircle, Clock, ShieldCheck, Copy,
  Check, ArrowRight, Terminal, AlertTriangle, ShieldAlert, Info
} from 'lucide-react';
import { type SafetyPassport } from '../data/mockData';
import { sound } from '../utils/soundEngine';

interface Props {
  passport: SafetyPassport;
  onApprove?: () => void;
  showApproveButton?: boolean;
}

export default function PassportView({ passport, onApprove, showApproveButton = false }: Props) {
  const [copiedRollback, setCopiedRollback] = useState(false);
  const allPassed = passport.preconditions.every((p) => p.passed);
  const approved = passport.approvalStatus === 'approved';
  const isBlocked = passport.isSafetyBlocked || !allPassed || passport.approvalStatus === 'blocked';
  const hasResult = !!passport.executionResult;

  const copyRollback = () => {
    sound.playClick();
    const text = passport.recoveryGuidance.join('\n');
    navigator.clipboard.writeText(text);
    setCopiedRollback(true);
    setTimeout(() => setCopiedRollback(false), 2000);
  };

  return (
    <motion.div
      className="passport-container"
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: 'spring', damping: 26, stiffness: 280 }}
    >
      {/* High-End Apple Header Ribbon */}
      <div className="passport-top-ribbon">
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, zIndex: 2 }}>
          <div className="passport-seal">
            <ShieldCheck size={24} />
          </div>
          <div>
            <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#A1A1A6', fontWeight: 700 }}>
              Cloud Operations Safety Protocol
            </div>
            <div style={{ fontSize: 20, fontWeight: 800, letterSpacing: '-0.02em', color: '#FFFFFF' }}>
              CloudPilot Safety Passport™
            </div>
            <div style={{ fontSize: 12, color: '#8E8E93', marginTop: 2 }}>
              Target: {passport.resourceIdentity.id} • Verified Pre-Flight State
            </div>
          </div>
        </div>

        <div style={{ zIndex: 2, display: 'flex', alignItems: 'center', gap: 10 }}>
          {approved ? (
            <span className="badge badge-success" style={{ padding: '6px 14px', fontSize: 12 }}>
              <CheckCircle2 size={13} /> APPROVED & LIVE VERIFICATION CONFIRMED
            </span>
          ) : isBlocked ? (
            <span className="badge badge-high" style={{ padding: '6px 14px', fontSize: 12, background: 'rgba(255,159,10,0.22)', color: '#FFB340' }}>
              <ShieldAlert size={13} /> BLOCKED BY SAFETY CHECK
            </span>
          ) : (
            <span className="badge badge-info" style={{ padding: '6px 14px', fontSize: 12, background: 'rgba(0,113,227,0.18)', color: '#64D2FF' }}>
              <Clock size={13} /> READY FOR HUMAN REVIEW
            </span>
          )}
        </div>
      </div>

      <div className="passport-body">
        {/* Blocker Callout if action is unsafe */}
        {isBlocked && (
          <div
            style={{
              padding: '16px 20px',
              borderRadius: 12,
              background: 'rgba(255, 159, 10, 0.08)',
              border: '1px solid rgba(255, 159, 10, 0.35)',
              display: 'flex',
              gap: 12,
              alignItems: 'flex-start'
            }}
          >
            <AlertTriangle size={20} color="var(--apple-amber-dark)" style={{ flexShrink: 0, marginTop: 2 }} />
            <div>
              <div style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--apple-amber-dark)', marginBottom: 4 }}>
                Execution Blocked by Pre-Flight Safety Engine
              </div>
              <div style={{ fontSize: 12.5, color: 'var(--text-primary)', lineHeight: 1.55 }}>
                {passport.blockedReason || 'One or more automated pre-flight checks failed. CloudPilot has blocked this action to protect dependent services or prevent account lockout.'}
              </div>
            </div>
          </div>
        )}

        {/* §1 — Finding Evidence & Target Identity */}
        <div className="passport-section-card">
          <div className="passport-section-label">
            <span className="passport-section-badge">1</span>
            Target Identity & Verified Evidence
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 10, marginBottom: 14 }}>
            <div style={{ padding: 10, background: '#FFFFFF', borderRadius: 8, border: '1px solid var(--border-subtle)' }}>
              <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>Target Resource</div>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>
                {passport.resourceIdentity.id}
              </div>
            </div>
            <div style={{ padding: 10, background: '#FFFFFF', borderRadius: 8, border: '1px solid var(--border-subtle)' }}>
              <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>Resource Type</div>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>
                {passport.resourceIdentity.type}
              </div>
            </div>
            <div style={{ padding: 10, background: '#FFFFFF', borderRadius: 8, border: '1px solid var(--border-subtle)' }}>
              <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>Target Region</div>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>
                {passport.resourceIdentity.region}
              </div>
            </div>
            <div style={{ padding: 10, background: '#FFFFFF', borderRadius: 8, border: '1px solid var(--border-subtle)' }}>
              <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>AWS Account</div>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>
                {passport.resourceIdentity.account}
              </div>
            </div>
          </div>

          <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 6 }}>
            Observed Telemetry Evidence:
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {passport.findingEvidence.map((e, i) => (
              <div key={i} style={{ display: 'flex', gap: 8, fontSize: 12.5, color: 'var(--text-primary)' }}>
                <span style={{ color: 'var(--apple-blue)', fontWeight: 700 }}>▸</span>
                <span>{e}</span>
              </div>
            ))}
          </div>
        </div>

        {/* §2 — Exact Proposed Operation */}
        <div className="passport-section-card">
          <div className="passport-section-label">
            <span className="passport-section-badge">2</span>
            Exact Atomic Operation (Deterministic Payload)
          </div>
          <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 10 }}>
            Only this specific AWS API call will be executed under CloudPilotRemediationRole upon approval. No wildcard permissions or cascade modifications.
          </div>

          <div className="code-block">
            <div style={{ color: 'var(--apple-blue)', fontWeight: 600, marginBottom: 6 }}>
              // AWS SDK Call Definition
            </div>
            <div style={{ fontWeight: 600 }}>{passport.operation} (</div>
            <div style={{ paddingLeft: 18 }}>
              {Object.entries(passport.operationParams).map(([k, v]) => (
                <div key={k}>
                  <span style={{ color: '#0550AE' }}>{k}</span>: <span style={{ color: '#0A3069' }}>"{v}"</span>,
                </div>
              ))}
            </div>
            <div>)</div>
          </div>
        </div>

        {/* §3 — Preconditions (The 5 Pre-Flight Checks) */}
        <div className="passport-section-card">
          <div className="passport-section-label">
            <span className="passport-section-badge">3</span>
            Safety Preconditions ({passport.preconditions.filter(p => p.passed).length}/{passport.preconditions.length} Pre-Flight Checks Passed)
            <span style={{ marginLeft: 'auto' }}>
              {allPassed ? (
                <span className="badge badge-success">All Preconditions Met</span>
              ) : (
                <span className="badge badge-critical">Safety Failure Detected</span>
              )}
            </span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 10 }}>
            {passport.preconditions.map((p, i) => (
              <div
                key={i}
                style={{
                  padding: 12,
                  background: p.passed ? '#FFFFFF' : 'rgba(255, 59, 48, 0.05)',
                  borderRadius: 10,
                  border: `1px solid ${p.passed ? 'var(--border-subtle)' : 'rgba(255, 59, 48, 0.3)'}`,
                  display: 'flex',
                  gap: 10,
                  alignItems: 'flex-start'
                }}
              >
                {p.passed ? (
                  <CheckCircle2 size={16} color="var(--apple-emerald-dark)" style={{ flexShrink: 0, marginTop: 2 }} />
                ) : (
                  <XCircle size={16} color="var(--apple-crimson)" style={{ flexShrink: 0, marginTop: 2 }} />
                )}
                <div>
                  <div style={{ fontSize: 12.5, fontWeight: 600, color: p.passed ? 'var(--text-primary)' : 'var(--apple-crimson-dark)' }}>
                    {p.label}
                  </div>
                  <div style={{ fontSize: 11.5, color: 'var(--text-tertiary)', marginTop: 2 }}>
                    {p.detail}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* §4 — Side Effects & Blast Radius Evaluation */}
        <div className="passport-section-card">
          <div className="passport-section-label">
            <span className="passport-section-badge">4</span>
            Blast Radius & Side-Effects Analysis
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {passport.sideEffects.map((effect, idx) => (
              <div key={idx} style={{ display: 'flex', gap: 10, fontSize: 12.5, color: 'var(--text-primary)', alignItems: 'flex-start' }}>
                <span style={{ color: 'var(--apple-amber-dark)', fontWeight: 800 }}>•</span>
                <span>{effect}</span>
              </div>
            ))}
          </div>
        </div>

        {/* §5 — Recovery Guidance & Honest Limitations */}
        <div className="passport-section-card" style={{ background: '#FFFDF9', borderColor: 'rgba(255, 159, 10, 0.25)' }}>
          <div className="passport-section-label" style={{ color: 'var(--apple-amber-dark)' }}>
            <span className="passport-section-badge" style={{ background: 'var(--apple-amber-dark)' }}>5</span>
            Recovery Guidance & Reversible Commands
            <button
              onClick={copyRollback}
              className="btn btn-secondary btn-sm"
              style={{ marginLeft: 'auto', gap: 6, fontSize: 11.5 }}
            >
              {copiedRollback ? <Check size={12} color="var(--apple-emerald)" /> : <Copy size={12} />}
              {copiedRollback ? 'Copied' : 'Copy Recovery Command'}
            </button>
          </div>

          <div style={{ fontSize: 12.5, color: 'var(--text-secondary)', marginBottom: 10 }}>
            If you need to restore previous behavior, CloudPilot provides this explicit CLI command:
          </div>

          <div className="code-block" style={{ background: '#FFFFFF', borderColor: 'rgba(255, 159, 10, 0.2)', marginBottom: 12 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {passport.recoveryGuidance.map((cmd, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--text-primary)', fontSize: 12 }}>
                  {i === 0 && <Terminal size={14} color="var(--apple-amber-dark)" />}
                  <span style={{ fontFamily: 'var(--font-mono)' }}>{cmd}</span>
                </div>
              ))}
            </div>
          </div>

          {passport.recoveryLimitations && (
            <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start', fontSize: 12, color: 'var(--text-secondary)' }}>
              <Info size={14} color="var(--apple-amber-dark)" style={{ flexShrink: 0, marginTop: 2 }} />
              <div>
                <strong>Recovery Limitation:</strong> {passport.recoveryLimitations}
              </div>
            </div>
          )}
        </div>

        {/* §6 — Execution Result (If executed) */}
        {hasResult && passport.executionResult && (
          <div className="passport-section-card" style={{ background: '#F8FFF9', borderColor: 'rgba(48, 209, 88, 0.3)' }}>
            <div className="passport-section-label" style={{ color: 'var(--apple-emerald-dark)' }}>
              <span className="passport-section-badge" style={{ background: 'var(--apple-emerald-dark)' }}>6</span>
              Verified Outcome & State Diff
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
              <div style={{ background: '#FFFFFF', padding: 12, borderRadius: 8, border: '1px solid var(--border-subtle)' }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--apple-crimson-dark)', marginBottom: 6 }}>
                  BEFORE EXECUTION:
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }}>
                  {passport.executionResult.beforeState}
                </div>
              </div>

              <div style={{ background: '#FFFFFF', padding: 12, borderRadius: 8, border: '1px solid var(--border-subtle)' }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--apple-emerald-dark)', marginBottom: 6 }}>
                  VERIFIED AFTER EXECUTION:
                </div>
                <div style={{ fontSize: 12, color: 'var(--apple-emerald-dark)', fontWeight: 600, fontFamily: 'var(--font-mono)' }}>
                  {passport.executionResult.afterState}
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', gap: 12, marginTop: 12, fontSize: 11.5, color: 'var(--text-tertiary)', fontFamily: 'var(--font-mono)' }}>
              <span>AWS RequestId: {passport.executionResult.awsRequestId}</span>
              <span>•</span>
              <span>Audit ID: {passport.executionResult.auditId}</span>
            </div>
          </div>
        )}

        {/* Action Call to Action */}
        {showApproveButton && !approved && onApprove && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: 12, borderTop: '1px solid var(--border-subtle)' }}>
            <div style={{ fontSize: 12.5, color: isBlocked ? 'var(--apple-crimson-dark)' : 'var(--text-secondary)' }}>
              {isBlocked
                ? 'Authorization is disabled because automated safety preconditions were not met.'
                : 'All automated preconditions passed. Proceed to explicit authorization.'}
            </div>

            <button
              onClick={() => {
                if (isBlocked) return;
                sound.playClick();
                onApprove();
              }}
              disabled={isBlocked}
              className="btn btn-primary btn-lg"
              style={{ opacity: isBlocked ? 0.4 : 1, cursor: isBlocked ? 'not-allowed' : 'pointer' }}
            >
              <span>{isBlocked ? 'Blocked by Safety Engine' : 'Proceed to Authorization'}</span>
              <ArrowRight size={16} />
            </button>
          </div>
        )}
      </div>
    </motion.div>
  );
}
