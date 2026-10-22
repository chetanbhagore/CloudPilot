import { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X, ArrowRight, Activity, AlertTriangle, Info, CheckCircle2, ShieldAlert
} from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { type Finding } from '../data/mockData';
import { sound } from '../utils/soundEngine';

interface DrawerProps {
  finding: Finding | null;
  onClose: () => void;
  onViewPassport: (finding: Finding) => void;
}

export default function FindingDetailDrawer({ finding, onClose, onViewPassport }: DrawerProps) {
  // Listen for Escape key to close drawer smoothly
  useEffect(() => {
    const handleKeyDown = (e: globalThis.KeyboardEvent) => {
      if (e.key === 'Escape') {
        sound.playClick();
        onClose();
      }
    };
    if (finding) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [finding, onClose]);

  if (!finding) return null;

  const isCost = finding.category === 'cost';
  const isBlocked = finding.status === 'blocked' || finding.isSafetyBlocked;
  const isResolved = finding.status === 'resolved';

  return (
    <AnimatePresence>
      <div className="drawer-backdrop" onClick={onClose}>
        <motion.div
          className="drawer-panel"
          role="dialog"
          aria-modal="true"
          aria-label={finding.title}
          initial={{ x: '100%' }}
          animate={{ x: 0 }}
          exit={{ x: '100%' }}
          transition={{ type: 'spring', damping: 30, stiffness: 320 }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Drawer Header */}
          <div
            style={{
              padding: '20px 28px',
              borderBottom: '1px solid var(--border-subtle)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              position: 'sticky',
              top: 0,
              background: '#FFFFFF',
              zIndex: 10
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              {finding.id.startsWith('live-') && (
                <span className="badge" style={{ background: 'rgba(0, 113, 227, 0.12)', color: 'var(--apple-blue)', fontWeight: 700, border: '1px solid rgba(0, 113, 227, 0.25)' }}>
                  ⚡ LIVE AWS
                </span>
              )}
              {isResolved ? (
                <span className="badge badge-success">
                  <CheckCircle2 size={12} /> RESOLVED ✓
                </span>
              ) : isBlocked ? (
                <span className="badge badge-high" style={{ background: 'rgba(255, 159, 10, 0.15)', color: '#C67800' }}>
                  <ShieldAlert size={12} /> BLOCKED BY SAFETY CHECK
                </span>
              ) : (
                <span className={`badge ${finding.severity === 'critical' ? 'badge-critical' : finding.severity === 'high' ? 'badge-high' : 'badge-neutral'}`}>
                  {finding.severity.toUpperCase()}
                </span>
              )}
              <span style={{ fontSize: 12, color: 'var(--text-tertiary)', fontFamily: 'var(--font-mono)' }}>
                {finding.rule.split(':')[0]}
              </span>
              <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>•</span>
              <span style={{ fontSize: 12, color: 'var(--text-secondary)', fontWeight: 500 }}>
                {finding.affectedService}
              </span>
            </div>

            <button
              onClick={() => {
                sound.playClick();
                onClose();
              }}
              className="btn btn-ghost btn-sm"
              style={{ width: 32, height: 32, padding: 0, borderRadius: '50%' }}
              aria-label="Close drawer"
              title="Close drawer (Esc)"
            >
              <X size={16} />
            </button>
          </div>

          {/* Drawer Content */}
          <div style={{ padding: '24px 28px', display: 'flex', flexDirection: 'column', gap: 24 }}>
            {/* Finding Title & Overview */}
            <div>
              <h2 style={{ fontSize: 20, fontWeight: 700, letterSpacing: '-0.02em', marginBottom: 8, color: isResolved ? 'var(--apple-emerald-dark)' : 'var(--text-primary)' }}>
                {finding.title}
              </h2>
              <p style={{ fontSize: 13.5, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                {finding.description}
              </p>
            </div>

            {/* Blocked Safety Alert (if applicable) */}
            {isBlocked && (
              <div
                style={{
                  padding: 16,
                  borderRadius: 12,
                  background: 'rgba(255, 159, 10, 0.08)',
                  border: '1px solid rgba(255, 159, 10, 0.3)',
                  display: 'flex',
                  gap: 12,
                  alignItems: 'flex-start'
                }}
              >
                <AlertTriangle size={18} color="var(--apple-amber-dark)" style={{ flexShrink: 0, marginTop: 2 }} />
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--apple-amber-dark)', marginBottom: 4 }}>
                    Automated Pre-Flight Check Blocked This Action
                  </div>
                  <div style={{ fontSize: 12.5, color: 'var(--text-primary)', lineHeight: 1.55 }}>
                    {finding.blockedReason}
                  </div>
                </div>
              </div>
            )}

            {/* Target Resource Summary */}
            <div style={{ background: 'var(--surface-secondary)', padding: 16, borderRadius: 12 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', marginBottom: 8 }}>
                Target Cloud Infrastructure
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 12.5 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Resource Identifier:</span>
                  <span style={{ fontWeight: 600, fontFamily: 'var(--font-mono)' }}>{finding.resource.id}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Resource Type:</span>
                  <span>{finding.resource.type}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Resource Name:</span>
                  <span style={{ fontWeight: 500 }}>{finding.resource.name}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>AWS Region:</span>
                  <span>{finding.resource.region}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Observed Duration / Age:</span>
                  <span style={{ color: 'var(--apple-amber-dark)', fontWeight: 600 }}>{finding.resource.age}</span>
                </div>
                {finding.estimatedMonthlyCost && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid var(--border-subtle)', paddingTop: 6, marginTop: 2 }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Estimated Monthly Run-Rate:</span>
                    <span style={{ color: 'var(--apple-crimson-dark)', fontWeight: 700 }}>~${finding.estimatedMonthlyCost.toFixed(2)} USD (₹{Math.round(finding.estimatedMonthlyCost * 83).toLocaleString('en-IN')}/mo)</span>
                  </div>
                )}
              </div>
            </div>

            {/* Simulated Telemetry Evidence */}
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                <div style={{ fontSize: 12.5, fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Activity size={14} color="var(--apple-blue)" /> Simulated Telemetry Evidence
                </div>
                <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>Deterministic Sandbox Feed</span>
              </div>

              {/* Evidence Bullets */}
              <div style={{ background: '#FAF9F8', border: '1px solid var(--border-subtle)', borderRadius: 12, padding: 14, marginBottom: 14 }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {finding.evidence.map((ev, i) => (
                    <div key={i} style={{ display: 'flex', gap: 8, fontSize: 12.5, color: 'var(--text-primary)' }}>
                      <span style={{ color: 'var(--apple-blue)', fontWeight: 700 }}>▸</span>
                      <span>{ev}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Dynamic Telemetry Graph */}
              <div style={{ background: '#FAF9F8', border: '1px solid var(--border-subtle)', borderRadius: 12, padding: '16px 12px 8px' }}>
                <div style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 8, paddingLeft: 8 }}>
                  Metric: {finding.telemetryMetricName} ({finding.telemetryUnit})
                </div>
                <div style={{ height: 160 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={finding.telemetryData}>
                      <defs>
                        <linearGradient id="telemetryGradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor={isCost ? '#FF9F0A' : '#FF3B30'} stopOpacity={0.25} />
                          <stop offset="95%" stopColor={isCost ? '#FF9F0A' : '#FF3B30'} stopOpacity={0.0} />
                        </linearGradient>
                      </defs>
                      <XAxis dataKey="label" stroke="#86868B" fontSize={11} tickLine={false} />
                      <YAxis stroke="#86868B" fontSize={11} tickLine={false} />
                      <Tooltip
                        contentStyle={{
                          background: 'rgba(29, 29, 31, 0.94)',
                          border: 'none',
                          borderRadius: 8,
                          color: '#FFFFFF',
                          fontSize: 12
                        }}
                      />
                      <Area
                        type="monotone"
                        dataKey="value"
                        name={finding.telemetryMetricName}
                        stroke={isCost ? '#FF9F0A' : '#FF3B30'}
                        strokeWidth={2}
                        fill="url(#telemetryGradient)"
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-tertiary)', textAlign: 'right', marginTop: 6 }}>
                  *Simulated historical telemetry curve for demonstration
                </div>
              </div>
            </div>

            {/* Proposed Remediation & Preconditions */}
            <div style={{ background: '#FFFFFF', border: '1px solid var(--border-subtle)', borderRadius: 12, padding: 16 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', marginBottom: 6 }}>
                Recommended Remediation & Safety Plan
              </div>
              <div style={{ fontSize: 13, color: 'var(--text-primary)', lineHeight: 1.55, marginBottom: 12 }}>
                {finding.recommendedAction}
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 10, fontSize: 12 }}>
                <div style={{ background: 'var(--surface-secondary)', padding: 10, borderRadius: 8 }}>
                  <div style={{ color: 'var(--text-tertiary)', fontSize: 11 }}>Atomic Operation</div>
                  <div style={{ fontWeight: 600, fontFamily: 'var(--font-mono)' }}>{finding.operation}</div>
                </div>
                <div style={{ background: 'var(--surface-secondary)', padding: 10, borderRadius: 8 }}>
                  <div style={{ color: 'var(--text-tertiary)', fontSize: 11 }}>Pre-Flight Safety Checks</div>
                  <div style={{ fontWeight: 600, color: isBlocked ? 'var(--apple-amber-dark)' : 'var(--apple-emerald-dark)' }}>
                    {isBlocked ? '1 Blocked Check ⚠️' : '5/5 Passed ✓'}
                  </div>
                </div>
              </div>
            </div>

            {/* Recovery Limitations Disclosure */}
            <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start', fontSize: 12, color: 'var(--text-secondary)' }}>
              <Info size={15} color="var(--apple-blue)" style={{ flexShrink: 0, marginTop: 2 }} />
              <div>
                <strong>Recovery Limitation:</strong> {finding.recoveryLimitations}
              </div>
            </div>
          </div>

          {/* Drawer Sticky Footer with CTA */}
          <div
            style={{
              padding: '16px 28px',
              borderTop: '1px solid var(--border-subtle)',
              position: 'sticky',
              bottom: 0,
              background: '#FFFFFF',
              zIndex: 10,
              display: 'flex',
              gap: 12
            }}
          >
            <button
              onClick={() => {
                sound.playClick();
                onClose();
              }}
              className="btn btn-secondary"
              style={{ flex: 1 }}
            >
              Close
            </button>
            <button
              onClick={() => onViewPassport(finding)}
              className="btn btn-primary"
              style={{ flex: 2 }}
            >
              <span>{isResolved ? 'Inspect Audit Record' : isBlocked ? 'Inspect Safety Blocker' : 'Open Safety Passport'}</span>
              <ArrowRight size={14} />
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
