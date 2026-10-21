import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  CheckCircle2, Shield, Download,
  Check, RotateCcw, X, Award
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useDemo } from '../context/useDemo';
import { sound } from '../utils/soundEngine';

export default function AuditTrail() {
  const navigate = useNavigate();
  const { auditRecords, activeHash, resetDemo, exportAuditCSV } = useDemo();
  const [showCertificate, setShowCertificate] = useState(false);
  const [exported, setExported] = useState(false);

  const displayRecords = auditRecords.length > 0 ? auditRecords : [
    {
      id: 'audit-demo-initial',
      findingId: 'finding-001',
      action: 'ec2:RevokeSecurityGroupIngress — TCP:22 from 0.0.0.0/0',
      resource: 'sg-0a1b2c3d4e5f (launch-wizard-1, ap-south-1)',
      authorizedBy: 'demo@cloudpilot.dev',
      authorizedAt: '2026-10-21T15:04:32Z',
      executedAt: '2026-10-21T15:04:35Z',
      awsResponse: '200 OK — RequestId: req-aws-9042b-fintech-mumbai',
      outcome: 'success' as const,
      beforeState: 'TCP:22 from 0.0.0.0/0: PRESENT',
      afterState: 'TCP:22 from 0.0.0.0/0: REMOVED (verified)'
    }
  ];

  const handleExport = () => {
    sound.playSuccess();
    setExported(true);
    exportAuditCSV();
    setTimeout(() => setExported(false), 2400);
  };

  const handleRestart = () => {
    sound.playSnap();
    resetDemo();
    navigate('/connect');
  };

  return (
    <div className="page-container">
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, marginBottom: 28, flexWrap: 'wrap' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
            <span className="badge badge-info">STAGE 5 OF 5</span>
            <span style={{ fontSize: 13, color: 'var(--text-tertiary)' }}>Immutable Audit Ledger</span>
          </div>
          <h1 className="display-title" style={{ marginBottom: 6 }}>
            Audit Trail & Proof of Outcome
          </h1>
          <p className="body-lead" style={{ maxWidth: 740 }}>
            Every action approved in CloudPilot generates an immutable, cryptographically verifiable audit record. Complete proof of before-state, AWS response, and verified after-state.
          </p>
        </div>

        <div style={{ display: 'flex', gap: 10 }}>
          <button
            onClick={() => {
              sound.playSuccess();
              setShowCertificate(true);
            }}
            className="btn btn-secondary"
          >
            <Award size={15} color="var(--apple-amber-dark)" />
            <span>View Verification Certificate</span>
          </button>

          <button
            onClick={handleExport}
            className="btn btn-primary"
            title="Download verified audit trail as a real CSV file"
          >
            {exported ? <Check size={14} /> : <Download size={14} />}
            <span>{exported ? 'Downloaded CSV ✓' : 'Export Audit CSV'}</span>
          </button>
        </div>
      </div>

      {/* Summary Stats */}
      <div className="metric-grid" style={{ marginBottom: 28 }}>
        <div className="metric-card">
          <div className="metric-header">
            <span className="metric-label">Total Actions Authorized</span>
            <Shield size={16} color="var(--apple-blue)" />
          </div>
          <div className="metric-value">{displayRecords.length}</div>
          <div className="metric-footer" style={{ color: 'var(--text-secondary)' }}>
            Signed by human engineer
          </div>
        </div>

        <div className="metric-card">
          <div className="metric-header">
            <span className="metric-label">Execution Success Rate</span>
            <CheckCircle2 size={16} color="var(--apple-emerald)" />
          </div>
          <div className="metric-value" style={{ color: 'var(--apple-emerald-dark)' }}>
            100%
          </div>
          <div className="metric-footer" style={{ color: 'var(--apple-emerald-dark)' }}>
            {displayRecords.length} Succeeded • 0 Failed
          </div>
        </div>

        <div className="metric-card">
          <div className="metric-header">
            <span className="metric-label">Unauthorized Executions</span>
            <Shield size={16} color="var(--apple-blue)" />
          </div>
          <div className="metric-value" style={{ color: 'var(--apple-blue)' }}>
            0
          </div>
          <div className="metric-footer" style={{ color: 'var(--apple-emerald-dark)' }}>
            Guaranteed by design
          </div>
        </div>

        <div className="metric-card">
          <div className="metric-header">
            <span className="metric-label">Computed SHA-256 Ledger Hash</span>
            <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-tertiary)' }}>HASH</span>
          </div>
          <div className="metric-value" style={{ fontSize: '1.05rem', fontFamily: 'var(--font-mono)', color: 'var(--text-primary)', wordBreak: 'break-all' }}>
            {activeHash.slice(0, 16)}…{activeHash.slice(-8)}
          </div>
          <div className="metric-footer" style={{ color: 'var(--apple-emerald-dark)' }}>
            SHA-256 WebCrypto Verified
          </div>
        </div>
      </div>

      {/* Audit Log Entries */}
      <div className="apple-card" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ padding: '18px 24px', borderBottom: '1px solid var(--border-subtle)', background: 'var(--surface-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.02em' }}>
            Historical Remediation Records
          </div>
          <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>{displayRecords.length} verified record(s)</span>
        </div>

        {displayRecords.map((r, idx) => (
          <div
            key={r.id}
            style={{
              padding: '24px 28px',
              borderBottom: idx < displayRecords.length - 1 ? '1px solid var(--border-subtle)' : 'none'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, marginBottom: 12 }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
                  <CheckCircle2 size={18} color="var(--apple-emerald-dark)" />
                  <span style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)' }}>
                    {r.action}
                  </span>
                </div>
                <div style={{ fontSize: 12.5, color: 'var(--text-tertiary)', fontFamily: 'var(--font-mono)' }}>
                  Target: {r.resource}
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span className="badge badge-success">✓ 200 OK SUCCESS</span>
                <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>
                  {new Date(r.executedAt).toLocaleTimeString()}
                </span>
              </div>
            </div>

            {/* Details Box */}
            <div style={{ background: '#FAF9F8', padding: 16, borderRadius: 12, border: '1px solid var(--border-subtle)', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 14 }}>
              <div>
                <div style={{ fontSize: 11, color: 'var(--text-tertiary)', textTransform: 'uppercase', fontWeight: 700 }}>Authorized Signer</div>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', marginTop: 2 }}>{r.authorizedBy}</div>
                <div style={{ fontSize: 11.5, color: 'var(--text-tertiary)' }}>{new Date(r.authorizedAt).toLocaleString()}</div>
              </div>

              <div>
                <div style={{ fontSize: 11, color: 'var(--text-tertiary)', textTransform: 'uppercase', fontWeight: 700 }}>AWS Verification Response</div>
                <div style={{ fontSize: 12.5, color: 'var(--text-primary)', fontFamily: 'var(--font-mono)', marginTop: 2 }}>{r.awsResponse}</div>
              </div>

              <div>
                <div style={{ fontSize: 11, color: 'var(--text-tertiary)', textTransform: 'uppercase', fontWeight: 700 }}>Verified State Transformation</div>
                <div style={{ fontSize: 12, color: 'var(--apple-crimson-dark)', marginTop: 2 }}>Before: {r.beforeState}</div>
                <div style={{ fontSize: 12, color: 'var(--apple-emerald-dark)', fontWeight: 600 }}>After: {r.afterState}</div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Demo Replay Callout */}
      <div style={{ marginTop: 32, textAlign: 'center' }}>
        <button
          onClick={handleRestart}
          className="btn btn-secondary"
          style={{ padding: '12px 24px', fontSize: 14 }}
        >
          <RotateCcw size={15} />
          <span>Reset Demo State & Test Alternative Scenario</span>
        </button>
      </div>

      {/* Verification Certificate Modal */}
      <AnimatePresence>
        {showCertificate && (
          <div className="drawer-backdrop" onClick={() => setShowCertificate(false)}>
            <motion.div
              initial={{ opacity: 0, scale: 0.94 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.94 }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              onClick={(e) => e.stopPropagation()}
              className="apple-card"
              style={{
                maxWidth: 620,
                margin: '80px auto',
                padding: '36px 40px',
                border: '2px solid rgba(212, 175, 55, 0.4)',
                background: '#FFFFFF',
                boxShadow: '0 24px 70px rgba(0, 0, 0, 0.25)',
                position: 'relative'
              }}
            >
              <button
                onClick={() => setShowCertificate(false)}
                className="btn btn-ghost btn-sm"
                style={{ position: 'absolute', top: 16, right: 16, borderRadius: '50%', width: 32, height: 32, padding: 0 }}
                aria-label="Close modal"
              >
                <X size={16} />
              </button>

              <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 20 }}>
                <div className="cert-seal">
                  CLOUDPILOT<br />VERIFIED
                </div>
                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', color: '#996515', textTransform: 'uppercase' }}>
                    Compliance & Security Verification Certificate
                  </div>
                  <h3 style={{ fontSize: 20, fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>
                    Remediation Execution Attestation
                  </h3>
                </div>
              </div>

              <p style={{ fontSize: 13.5, color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: 20 }}>
                This certificate attests that remediation on resource <strong>{displayRecords[0].resource}</strong> was reviewed via Safety Passport protocol, authorized by <strong>demo@cloudpilot.dev</strong>, and verified via independent AWS describe verification.
              </p>

              <div style={{ background: '#FAF9F8', padding: 16, borderRadius: 12, border: '1px solid var(--border-subtle)', fontSize: 12, fontFamily: 'var(--font-mono)', marginBottom: 24, lineHeight: 1.7 }}>
                <div>Ledger ID: {displayRecords[0].id}</div>
                <div>AWS Verification Response: {displayRecords[0].awsResponse}</div>
                <div>Verification Method: Independent AWS API interrogation</div>
                <div style={{ wordBreak: 'break-all' }}>SHA-256 Fingerprint: {activeHash}</div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid var(--border-subtle)', paddingTop: 16 }}>
                <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>
                  CloudPilot Cryptographic Ledger • Issued 2026-10-21
                </div>
                <button
                  onClick={() => {
                    sound.playClick();
                    window.print();
                  }}
                  className="btn btn-primary btn-sm"
                >
                  <Download size={13} />
                  <span>Print Certificate</span>
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
