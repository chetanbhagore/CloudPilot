import { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X, ArrowRight, DollarSign,
  Activity, CheckCircle2
} from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { type Finding } from '../data/mockData';
import { sound } from '../utils/soundEngine';

interface DrawerProps {
  finding: Finding | null;
  onClose: () => void;
  onViewPassport: (finding: Finding) => void;
}

const TELEMETRY_DATA = [
  { time: '00:00', ingressHits: 142, metricVal: 1.2 },
  { time: '04:00', ingressHits: 98, metricVal: 0.9 },
  { time: '08:00', ingressHits: 284, metricVal: 2.1 },
  { time: '12:00', ingressHits: 412, metricVal: 3.4 },
  { time: '16:00', ingressHits: 360, metricVal: 2.8 },
  { time: '20:00', ingressHits: 210, metricVal: 1.6 },
  { time: '23:59', ingressHits: 175, metricVal: 1.1 },
];

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
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span className={`badge ${finding.severity === 'critical' ? 'badge-critical' : finding.severity === 'high' ? 'badge-high' : 'badge-neutral'}`}>
                {finding.severity.toUpperCase()}
              </span>
              <span style={{ fontSize: 12, color: 'var(--text-tertiary)', fontFamily: 'var(--font-mono)' }}>
                {finding.rule.split(':')[0]}
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
            >
              <X size={16} />
            </button>
          </div>

          {/* Drawer Content */}
          <div style={{ padding: '24px 28px', display: 'flex', flexDirection: 'column', gap: 24 }}>
            <div>
              <h2 style={{ fontSize: 20, fontWeight: 700, letterSpacing: '-0.02em', marginBottom: 8 }}>
                {finding.title}
              </h2>
              <p style={{ fontSize: 13.5, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                {finding.description}
              </p>
            </div>

            {/* Target Resource Summary */}
            <div style={{ background: 'var(--surface-secondary)', padding: 16, borderRadius: 12 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', marginBottom: 8 }}>
                Target Infrastructure
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12.5 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Resource ID:</span>
                  <span style={{ fontWeight: 600, fontFamily: 'var(--font-mono)' }}>{finding.resource.id}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Resource Type:</span>
                  <span>{finding.resource.type}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Region:</span>
                  <span>{finding.resource.region}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Age / Idle duration:</span>
                  <span style={{ color: 'var(--apple-amber-dark)', fontWeight: 600 }}>{finding.resource.age}</span>
                </div>
              </div>
            </div>

            {/* Live Telemetry Evidence Graph */}
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                <div style={{ fontSize: 12.5, fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Activity size={14} color="var(--apple-blue)" /> CloudWatch Telemetry
                </div>
                <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>Last 24 Hours (Press Esc to close)</span>
              </div>

              <div style={{ background: '#FAF9F8', border: '1px solid var(--border-subtle)', borderRadius: 12, padding: '16px 12px 8px' }}>
                <div style={{ height: 160 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={TELEMETRY_DATA}>
                      <defs>
                        <linearGradient id="telemetryGradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor={isCost ? '#06b6d4' : '#FF3B30'} stopOpacity={0.25} />
                          <stop offset="95%" stopColor={isCost ? '#06b6d4' : '#FF3B30'} stopOpacity={0.0} />
                        </linearGradient>
                      </defs>
                      <XAxis dataKey="time" stroke="#86868B" fontSize={11} tickLine={false} />
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
                        dataKey={isCost ? 'metricVal' : 'ingressHits'}
                        name={isCost ? 'Resource Metric Utilization %' : 'Inbound Connection Attempts'}
                        stroke={isCost ? '#0071E3' : '#FF3B30'}
                        strokeWidth={2}
                        fill="url(#telemetryGradient)"
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-tertiary)', textAlign: 'center', marginTop: 8 }}>
                  {isCost
                    ? 'Average activity metric has remained under 2.5% for consecutive days'
                    : '1,679 automated external probe attempts registered on target port'}
                </div>
              </div>
            </div>

            {/* Why AI Flagged This */}
            <div>
              <div style={{ fontSize: 12.5, fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-secondary)', marginBottom: 8 }}>
                Verified Deterministic Proof
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {finding.evidence.map((ev, i) => (
                  <div key={i} style={{ display: 'flex', gap: 8, fontSize: 13, color: 'var(--text-primary)' }}>
                    <CheckCircle2 size={15} color="var(--apple-blue)" style={{ flexShrink: 0, marginTop: 2 }} />
                    <span>{ev}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Impact / Savings disclosure */}
            {finding.estimatedSavings && (
              <div style={{ padding: 14, background: 'var(--apple-emerald-light)', borderRadius: 10, border: '1px solid rgba(48, 209, 88, 0.25)' }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--apple-emerald-dark)', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <DollarSign size={15} /> Projected Run-Rate Impact
                </div>
                <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--apple-emerald-dark)', margin: '4px 0' }}>
                  ~${finding.estimatedSavings.toFixed(2)} / month
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
                  *Financial estimate based on published AWS on-demand pricing. Not claimed as actual realized savings until billing cycle closes.
                </div>
              </div>
            )}
          </div>

          {/* Drawer Footer Action */}
          <div
            style={{
              padding: '20px 28px',
              borderTop: '1px solid var(--border-subtle)',
              marginTop: 'auto',
              background: '#FFFFFF',
              position: 'sticky',
              bottom: 0
            }}
          >
            <button
              onClick={() => {
                sound.playSuccess();
                onViewPassport(finding);
              }}
              className="btn btn-primary"
              style={{ width: '100%', padding: '12px 20px', fontSize: 14 }}
            >
              <span>Inspect Safety Passport™</span>
              <ArrowRight size={16} />
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
