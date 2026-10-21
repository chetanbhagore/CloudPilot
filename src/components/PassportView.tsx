import { useState } from 'react';
import { motion } from 'framer-motion';
import {
  CheckCircle2, XCircle, Clock, ShieldCheck, Copy,
  Check, ArrowRight, Terminal
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
              ID: SP-2026-9042 • SHA-256 Verified Preconditions
            </div>
          </div>
        </div>

        <div style={{ zIndex: 2, display: 'flex', alignItems: 'center', gap: 10 }}>
          {approved ? (
            <span className="badge badge-success" style={{ padding: '6px 14px', fontSize: 12 }}>
              <CheckCircle2 size={13} /> APPROVED & SIGNED
            </span>
          ) : (
            <span className="badge badge-high" style={{ padding: '6px 14px', fontSize: 12, background: 'rgba(255,159,10,0.18)', color: '#FFB340' }}>
              <Clock size={13} /> PENDING HUMAN SIGN-OFF
            </span>
          )}
        </div>
      </div>

      <div className="passport-body">
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
            Only this specific AWS SDK call will be permitted. No wildcards, no cascade deletes.
          </div>

          <div className="code-block">
            <div style={{ color: 'var(--apple-blue)', fontWeight: 600, marginBottom: 6 }}>
              // AWS API Call Definition
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
            Safety Preconditions (5/5 Automated Pre-Flight Checks)
            <span style={{ marginLeft: 'auto' }}>
              {allPassed ? (
                <span className="badge badge-success">All Checks Passed</span>
              ) : (
                <span className="badge badge-critical">Safety Failure</span>
              )}
            </span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 10 }}>
            {passport.preconditions.map((p, i) => (
              <div
                key={i}
                style={{
                  padding: 12,
                  background: '#FFFFFF',
                  borderRadius: 10,
                  border: '1px solid var(--border-subtle)',
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
                  <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--text-primary)' }}>
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

        {/* §5 — Guaranteed Recovery / Rollback Guidance */}
        <div className="passport-section-card" style={{ background: '#FFFDF9', borderColor: 'rgba(255, 159, 10, 0.25)' }}>
          <div className="passport-section-label" style={{ color: 'var(--apple-amber-dark)' }}>
            <span className="passport-section-badge" style={{ background: 'var(--apple-amber-dark)' }}>5</span>
            Deterministic Rollback Guarantee
            <button
              onClick={copyRollback}
              className="btn btn-secondary btn-sm"
              style={{ marginLeft: 'auto', gap: 6, fontSize: 11.5 }}
            >
              {copiedRollback ? <Check size={12} color="var(--apple-emerald)" /> : <Copy size={12} />}
              {copiedRollback ? 'Copied' : 'Copy Rollback Command'}
            </button>
          </div>

          <div style={{ fontSize: 12.5, color: 'var(--text-secondary)', marginBottom: 8 }}>
            If you ever need to restore previous behavior, CloudPilot provides this exact reversible CLI command:
          </div>

          <div className="code-block" style={{ background: '#FFFFFF', borderColor: 'rgba(255, 159, 10, 0.2)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--text-primary)', fontWeight: 600 }}>
              <Terminal size={14} color="var(--apple-amber-dark)" />
              <span>aws ec2 authorize-security-group-ingress --group-id {passport.resourceIdentity.id} --protocol tcp --port 22 --cidr &lt;YOUR_IP&gt;/32</span>
            </div>
          </div>
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
                {Object.entries(passport.executionResult.beforeState).map(([rule, state]) => (
                  <div key={rule} style={{ fontSize: 12, color: 'var(--text-secondary)', display: 'flex', justifyContent: 'space-between' }}>
                    <span>{rule}</span>
                    <span style={{ fontWeight: 600, color: 'var(--apple-crimson)' }}>{state}</span>
                  </div>
                ))}
              </div>

              <div style={{ background: '#FFFFFF', padding: 12, borderRadius: 8, border: '1px solid var(--border-subtle)' }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--apple-emerald-dark)', marginBottom: 6 }}>
                  VERIFIED AFTER EXECUTION:
                </div>
                {Object.entries(passport.executionResult.afterState).map(([rule, state]) => (
                  <div key={rule} style={{ fontSize: 12, color: 'var(--text-secondary)', display: 'flex', justifyContent: 'space-between' }}>
                    <span>{rule}</span>
                    <span style={{ fontWeight: 600, color: 'var(--apple-emerald-dark)' }}>{state}</span>
                  </div>
                ))}
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
          <div style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: 12 }}>
            <button
              onClick={() => {
                sound.playClick();
                onApprove();
              }}
              className="btn btn-primary btn-lg"
            >
              <span>Proceed to Authorization</span>
              <ArrowRight size={16} />
            </button>
          </div>
        )}
      </div>
    </motion.div>
  );
}
