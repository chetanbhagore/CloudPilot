import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import {
  Shield, ArrowRight, Activity,
  CheckCircle2, AlertTriangle, Play, Sparkles
} from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { mockSummaryStats, mockFindings } from '../data/mockData';
import { sound } from '../utils/soundEngine';

const COST_TREND_DATA = [
  { day: 'Oct 15', cost: 8.20, projected: 8.20 },
  { day: 'Oct 16', cost: 8.90, projected: 8.90 },
  { day: 'Oct 17', cost: 9.40, projected: 9.40 },
  { day: 'Oct 18', cost: 10.10, projected: 10.10 },
  { day: 'Oct 19', cost: 9.30, projected: 9.30 },
  { day: 'Oct 20', cost: 9.80, projected: 9.80 },
  { day: 'Oct 21 (Today)', cost: 8.25, projected: 6.90 },
  { day: 'Oct 22 (Proj)', cost: null, projected: 6.80 },
];

export default function Overview() {
  const navigate = useNavigate();
  const s = mockSummaryStats;

  return (
    <div className="page-container">
      {/* ── Dark Product Showcase Hero (Apple Keynote Style) ── */}
      <motion.div
        className="keynote-hero"
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: 'spring', damping: 25, stiffness: 280 }}
      >
        <div style={{ position: 'relative', zIndex: 2 }}>
          <div className="keynote-badge">
            <Sparkles size={12} color="#0071E3" />
            <span>CLOUDPILOT • AWS OPERATIONS PLATFORM</span>
          </div>

          <h1 className="display-title" style={{ color: '#FFFFFF', marginBottom: 12 }}>
            Understand your cloud.<br />
            <span style={{ color: '#8E8E93' }}>Approve the fix. Prove the outcome.</span>
          </h1>

          <p className="body-lead" style={{ color: '#A1A1A6', maxWidth: 680, marginBottom: 28 }}>
            CloudPilot gives developers and early-stage teams superhuman cloud cost and security governance.
            AI explains the root-cause with deterministic telemetry; the human engineer approves the action via a verified Safety Passport™.
          </p>

          <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', alignItems: 'center' }}>
            <button
              onClick={() => {
                sound.playSuccess();
                navigate('/connect');
              }}
              className="btn btn-primary btn-lg"
            >
              <Play size={16} fill="currentColor" />
              <span>Start Interactive Demo Walkthrough</span>
            </button>

            <button
              onClick={() => {
                sound.playClick();
                navigate('/discover');
              }}
              className="btn btn-secondary btn-lg"
              style={{ background: 'rgba(255,255,255,0.1)', color: '#FFFFFF', borderColor: 'rgba(255,255,255,0.16)' }}
            >
              <Activity size={16} />
              <span>Inspect {mockFindings.length} Live Findings</span>
            </button>
          </div>
        </div>
      </motion.div>

      {/* ── Metric Cards ── */}
      <div className="metric-grid">
        <motion.div
          className="metric-card"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
        >
          <div className="metric-header">
            <span className="metric-label">Security Health</span>
            <Shield size={16} color="var(--apple-blue)" />
          </div>
          <div className="metric-value" style={{ color: 'var(--apple-blue)' }}>
            {s.securityScoreAfter}%
          </div>
          <div className="metric-footer" style={{ color: 'var(--apple-emerald-dark)', fontWeight: 600 }}>
            <span>↑ +{s.securityScoreAfter - s.securityScore} pts</span>
            <span style={{ color: 'var(--text-tertiary)', fontWeight: 400 }}>post-SSH remediation</span>
          </div>
        </motion.div>

        <motion.div
          className="metric-card"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <div className="metric-header">
            <span className="metric-label">Critical Vulnerabilities</span>
            <AlertTriangle size={16} color="var(--apple-crimson)" />
          </div>
          <div className="metric-value" style={{ color: 'var(--apple-crimson)' }}>
            {s.criticalFindings}
          </div>
          <div className="metric-footer" style={{ color: 'var(--text-secondary)' }}>
            <span>SSH Port 22 open to 0.0.0.0/0</span>
          </div>
        </motion.div>

        <motion.div
          className="metric-card"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
        >
          <div className="metric-header">
            <span className="metric-label">Projected Monthly Waste</span>
            <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--apple-amber-dark)' }}>$</span>
          </div>
          <div className="metric-value" style={{ color: 'var(--apple-amber-dark)' }}>
            ~${s.estimatedMonthlyWaste.toFixed(2)}
          </div>
          <div className="metric-footer" style={{ color: 'var(--text-secondary)' }}>
            <span>Unattached EBS + Idle Elastic IP</span>
          </div>
        </motion.div>

        <motion.div
          className="metric-card"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <div className="metric-header">
            <span className="metric-label">Remediated & Verified</span>
            <CheckCircle2 size={16} color="var(--apple-emerald)" />
          </div>
          <div className="metric-value" style={{ color: 'var(--apple-emerald-dark)' }}>
            {s.resolvedThisSession} Action
          </div>
          <div className="metric-footer" style={{ color: 'var(--text-secondary)' }}>
            <span>Immutable Audit Hash logged</span>
          </div>
        </motion.div>
      </div>

      {/* ── Main Content Grid: Trend Chart & Findings ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(450px, 1fr))', gap: 24, marginBottom: 32 }}>
        {/* Cost Trend Chart */}
        <div className="apple-card">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <div>
              <div className="section-title">AWS Spend & Remediation Curve</div>
              <div style={{ fontSize: 12.5, color: 'var(--text-secondary)', marginTop: 2 }}>
                Simulated daily run-rate before and after applying CloudPilot proposed fixes
              </div>
            </div>
            <span className="badge badge-success">
              <CheckCircle2 size={12} /> Projected Run-rate Down
            </span>
          </div>

          <div style={{ height: 220 }}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={COST_TREND_DATA} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="spendGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#0071E3" stopOpacity={0.28} />
                    <stop offset="95%" stopColor="#0071E3" stopOpacity={0.0} />
                  </linearGradient>
                  <linearGradient id="projectedGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#30D158" stopOpacity={0.28} />
                    <stop offset="95%" stopColor="#30D158" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="day" stroke="#86868B" fontSize={11} tickLine={false} />
                <YAxis stroke="#86868B" fontSize={11} tickLine={false} tickFormatter={(val) => `$${val}`} />
                <Tooltip
                  content={({ active, payload, label }) => {
                    if (active && payload && payload.length) {
                      return (
                        <div style={{ background: 'rgba(29, 29, 31, 0.94)', padding: '8px 12px', borderRadius: 8, color: '#FFFFFF', fontSize: 12 }}>
                          <div style={{ fontWeight: 600, marginBottom: 4 }}>{label}</div>
                          {payload.map((p, idx) => (
                            <div key={idx} style={{ color: p.color, fontSize: 11.5 }}>
                              {p.name}: ${Number(p.value).toFixed(2)}/day
                            </div>
                          ))}
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="cost"
                  name="Historical Daily Spend"
                  stroke="#0071E3"
                  strokeWidth={2.5}
                  fill="url(#spendGradient)"
                />
                <Area
                  type="monotone"
                  dataKey="projected"
                  name="Projected Optimized"
                  stroke="#30D158"
                  strokeWidth={2}
                  strokeDasharray="4 4"
                  fill="url(#projectedGradient)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          <div style={{ fontSize: 11.5, color: 'var(--text-tertiary)', marginTop: 12, borderTop: '1px solid var(--border-subtle)', paddingTop: 10 }}>
            *Disclaimer: Run-rate estimates reflect simulated reductions based on AWS standard pricing. Realized totals depend on monthly billing cycles.
          </div>
        </div>

        {/* Priority Action Card */}
        <div className="apple-card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <div className="section-title">Safety Passport™ Awaiting Sign-Off</div>
              <span className="badge badge-high">Action Required</span>
            </div>

            <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.55, marginBottom: 16 }}>
              A Safety Passport has been pre-generated for finding <code style={{ fontFamily: 'var(--font-mono)', background: 'var(--surface-secondary)', padding: '2px 6px', borderRadius: 4 }}>finding-001</code>.
              All 5 automated safety preconditions have passed. CloudPilot will never execute without your explicit authorization.
            </p>

            <div style={{ background: '#FAF9F8', border: '1px solid var(--border-subtle)', borderRadius: 12, padding: 16, marginBottom: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                <span className="badge badge-critical">CRITICAL</span>
                <span style={{ fontWeight: 700, fontSize: 13.5 }}>SSH (port 22) open to entire internet</span>
              </div>
              <div style={{ fontSize: 12.5, color: 'var(--text-secondary)' }}>
                Target: <span style={{ fontFamily: 'var(--font-mono)' }}>sg-0a1b2c3d4e5f</span> (launch-wizard-1, ap-south-1)
              </div>
              <div style={{ display: 'flex', gap: 6, marginTop: 10 }}>
                <span className="badge badge-success">✓ 0 Active SSH sessions</span>
                <span className="badge badge-success">✓ Rollback ready</span>
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 10 }}>
            <button
              onClick={() => {
                sound.playClick();
                navigate('/passport');
              }}
              className="btn btn-primary"
              style={{ flex: 1 }}
            >
              <span>Inspect Passport</span>
              <ArrowRight size={14} />
            </button>
            <button
              onClick={() => {
                sound.playClick();
                navigate('/approve');
              }}
              className="btn btn-secondary"
            >
              <span>Slide to Approve</span>
            </button>
          </div>
        </div>
      </div>

      {/* ── Philosophy Banner ── */}
      <div
        className="apple-card"
        style={{
          background: 'linear-gradient(135deg, rgba(0, 113, 227, 0.04) 0%, rgba(48, 209, 88, 0.04) 100%)',
          borderColor: 'rgba(0, 113, 227, 0.12)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 20
        }}
      >
        <div>
          <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 4 }}>
            Zero Credential Exposure • Zero Autonomous Execution
          </div>
          <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
            CloudPilot operates strictly on read-only IAM assume role permissions. Remediation actions are simulated, signed, and proven with cryptographic audit receipts.
          </div>
        </div>
        <button
          onClick={() => {
            sound.playClick();
            navigate('/connect');
          }}
          className="btn btn-secondary btn-sm"
          style={{ flexShrink: 0 }}
        >
          <span>View IAM Policy</span>
          <ArrowRight size={13} />
        </button>
      </div>
    </div>
  );
}
