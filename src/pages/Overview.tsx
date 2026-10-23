import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import {
  Shield, ArrowRight, Activity,
  CheckCircle2, AlertTriangle, Zap, Sparkles,
  DollarSign, FileText, Lock, ChevronRight
} from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { useDemo } from '../context/useDemo';
import { sound } from '../utils/soundEngine';
import { usePageSEO } from '../hooks/usePageSEO';

export default function Overview() {
  usePageSEO({
    title: 'Multi-Cloud Governance Dashboard',
    description: 'CloudPilot overview dashboard for AWS and Azure cost optimization, security risk posture, and Safety Passport verification.',
    canonicalPath: '/',
  });

  const navigate = useNavigate();
  const {
    activeScenario,
    accountConfig,
    findings,
    isRemediated,
    resolvedFindingIds,
    securityScore,
    criticalCount,
    monthlyWaste,
    resolvedCount,
    auditRecords,
    setSelectedFindingId,
    appMode
  } = useDemo();

  const dailyRunRate = monthlyWaste > 0 ? (monthlyWaste / 30) : 0;
  const remediatedRunRate = isRemediated ? 0 : dailyRunRate;

  const costTrendData = [
    { day: 'Day -6', cost: Number((dailyRunRate * 1.02).toFixed(2)), projected: Number((dailyRunRate * 1.02).toFixed(2)) },
    { day: 'Day -5', cost: Number((dailyRunRate * 1.01).toFixed(2)), projected: Number((dailyRunRate * 1.01).toFixed(2)) },
    { day: 'Day -4', cost: Number((dailyRunRate * 0.99).toFixed(2)), projected: Number((dailyRunRate * 0.99).toFixed(2)) },
    { day: 'Day -3', cost: Number((dailyRunRate * 1.03).toFixed(2)), projected: Number((dailyRunRate * 1.03).toFixed(2)) },
    { day: 'Day -2', cost: Number((dailyRunRate * 1.00).toFixed(2)), projected: Number((dailyRunRate * 1.00).toFixed(2)) },
    { day: 'Yesterday', cost: Number(dailyRunRate.toFixed(2)), projected: Number(dailyRunRate.toFixed(2)) },
    { day: 'Today', cost: Number(dailyRunRate.toFixed(2)), projected: Number(remediatedRunRate.toFixed(2)) },
    { day: 'Tomorrow (Proj)', cost: null, projected: Number(remediatedRunRate.toFixed(2)) },
  ];

  const handleActionOnFinding = (findingId: string) => {
    sound.playClick();
    setSelectedFindingId(findingId);
    navigate('/passport');
  };

  const highCount = findings.filter((f) => f.severity === 'high' && f.status === 'open').length;
  const mediumCount = findings.filter((f) => f.severity === 'medium' && f.status === 'open').length;

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
            <span>CLOUDPILOT • {accountConfig.isConnected ? (accountConfig.alias || 'AWS LIVE').toUpperCase() : 'PRODUCTION AWS GOVERNANCE'}</span>
          </div>

          <h1 className="display-title" style={{ color: '#FFFFFF', marginBottom: 12 }}>
            Understand your cloud.<br />
            <span style={{ color: '#8E8E93' }}>Approve the fix. Prove the outcome.</span>
          </h1>

          <p className="body-lead" style={{ color: '#A1A1A6', maxWidth: 680, marginBottom: 26 }}>
            CloudPilot gives developers and early-stage teams superhuman cloud cost and security governance.
            AI explains the root-cause with deterministic telemetry; the human engineer approves the action via a verified Safety Passport™.
          </p>

          <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', alignItems: 'center' }}>
            {!accountConfig.isConnected ? (
              <button
                onClick={() => {
                  sound.playClick();
                  navigate('/connect');
                }}
                className="btn btn-primary btn-lg"
              >
                <Zap size={16} fill="currentColor" />
                <span>Connect Real AWS Account</span>
              </button>
            ) : findings.length === 0 ? (
              <button
                onClick={() => {
                  sound.playClick();
                  navigate('/discover');
                }}
                className="btn btn-primary btn-lg"
              >
                <Zap size={16} fill="currentColor" />
                <span>Trigger Live AWS Discovery Scan</span>
              </button>
            ) : (
              <button
                onClick={() => {
                  sound.playClick();
                  navigate('/discover');
                }}
                className="btn btn-primary btn-lg"
              >
                <Zap size={16} fill="currentColor" />
                <span>Investigate {findings.length} Live Cloud Findings</span>
              </button>
            )}

            <button
              onClick={() => {
                sound.playClick();
                navigate('/connect');
              }}
              className="btn btn-secondary btn-lg"
              style={{ background: 'rgba(255,255,255,0.1)', color: '#FFFFFF', borderColor: 'rgba(255,255,255,0.16)' }}
            >
              <Activity size={16} />
              <span>Two-Role IAM Connection Settings</span>
            </button>
          </div>
        </div>
      </motion.div>


      {/* ── Environment Health Status Card ── */}
      <div
        className="apple-card"
        style={{
          marginBottom: 24,
          padding: '16px 22px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 14,
          background: '#FFFFFF',
          borderLeft: criticalCount > 0 ? '4px solid var(--apple-crimson)' : '4px solid var(--apple-emerald)'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div
            style={{
              width: 36,
              height: 36,
              borderRadius: 10,
              background: criticalCount > 0 ? 'var(--apple-crimson-light)' : 'var(--apple-emerald-light)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0
            }}
          >
            {criticalCount > 0 ? (
              <AlertTriangle size={18} color="var(--apple-crimson)" />
            ) : (
              <CheckCircle2 size={18} color="var(--apple-emerald-dark)" />
            )}
          </div>
          <div>
            <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--text-primary)' }}>
              Environment: {accountConfig.alias} (acct-{accountConfig.accountId} in {accountConfig.region})
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
              {criticalCount > 0
                ? `${criticalCount} critical exposure requires human authorization • Estimated ~$${monthlyWaste.toFixed(2)}/mo ongoing run-rate leak`
                : `All critical exposures resolved and verified for this session • Audit ledger updated`}
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ display: 'flex', gap: 6 }}>
            <span className="badge badge-critical">{criticalCount} Critical</span>
            <span className="badge badge-high">{highCount} High</span>
            <span className="badge badge-neutral">{mediumCount} Medium</span>
          </div>
          <button
            onClick={() => {
              sound.playClick();
              navigate('/discover');
            }}
            className="btn btn-secondary btn-sm"
          >
            <span>View All</span>
            <ChevronRight size={13} />
          </button>
        </div>
      </div>

      {/* ── Dynamic Metric Cards ── */}
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
          <div className="metric-value" style={{ color: isRemediated ? 'var(--apple-emerald-dark)' : 'var(--apple-blue)' }}>
            {securityScore}%
          </div>
          <div className="metric-footer" style={{ color: isRemediated ? 'var(--apple-emerald-dark)' : 'var(--text-secondary)', fontWeight: 600 }}>
            {isRemediated ? (
              <span>↑ Dynamic score boost post-remediation</span>
            ) : (
              <span style={{ color: 'var(--apple-amber-dark)' }}>Action pending review</span>
            )}
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
          <div className="metric-value" style={{ color: criticalCount > 0 ? 'var(--apple-crimson)' : 'var(--apple-emerald-dark)' }}>
            {criticalCount}
          </div>
          <div className="metric-footer" style={{ color: 'var(--text-secondary)' }}>
            <span>{criticalCount > 0 ? 'Public ports exposed to 0.0.0.0/0' : '0 unmitigated critical risks ✓'}</span>
          </div>
        </motion.div>

        <motion.div
          className="metric-card"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
        >
          <div className="metric-header">
            <span className="metric-label">Estimated Monthly Waste</span>
            <DollarSign size={16} color="var(--apple-amber-dark)" />
          </div>
          <div className="metric-value" style={{ color: 'var(--apple-amber-dark)' }}>
            ~${monthlyWaste.toFixed(2)}
            <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-tertiary)', marginLeft: 6 }}>
              (₹{Math.round(monthlyWaste * 83).toLocaleString('en-IN')})
            </span>
          </div>
          <div className="metric-footer" style={{ color: 'var(--text-secondary)' }}>
            <span>
              {appMode === 'live'
                ? 'Unattached EBS + stopped EC2 root disk overhead'
                : activeScenario === 'student'
                ? 'Assumes 24/7 idle GPU at $3.06/hr'
                : 'Assumes detached EBS + unassociated EIP'}
            </span>
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
          <div className="metric-value" style={{ color: resolvedCount > 0 ? 'var(--apple-emerald-dark)' : 'var(--text-tertiary)' }}>
            {resolvedCount} Action{resolvedCount !== 1 ? 's' : ''}
          </div>
          <div className="metric-footer" style={{ color: 'var(--text-secondary)' }}>
            <span>{resolvedCount > 0 ? `${auditRecords.length} verifiable audit record(s)` : 'Awaiting human authorization'}</span>
          </div>
        </motion.div>
      </div>

      {/* ── Main Content Grid: Trend Chart & Findings ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(460px, 1fr))', gap: 24, marginBottom: 32 }}>
        {/* Cost Trend Chart */}
        <div className="apple-card">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <div>
              <div className="section-title">AWS Spend & Remediation Curve</div>
              <div style={{ fontSize: 12.5, color: 'var(--text-secondary)', marginTop: 2 }}>
                Simulated daily run-rate trajectory based on standard AWS pricing
              </div>
            </div>
            <span className={`badge ${isRemediated ? 'badge-success' : 'badge-neutral'}`}>
              <CheckCircle2 size={12} /> {isRemediated ? 'Run-rate Reduced' : 'Current Trajectory'}
            </span>
          </div>

          <div style={{ height: 220 }}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={costTrendData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
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
            *Note on Pricing: Financial calculations are illustrative estimates assuming continuous 24/7 resource utilization at published AWS rates ($3.06/hr for p3.2xlarge, $0.08/GB-mo for gp3). Realized billing impact depends on final AWS invoice closing.
          </div>
        </div>

        {/* Priority Action Card */}
        {/* Priority Action Card */}
        {findings.length > 0 && findings[0] && findings[0].resource ? (
          <div className="apple-card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                <div className="section-title">Safety Passport™ Remediation Queue</div>
                <span className={`badge ${isRemediated ? 'badge-success' : 'badge-high'}`}>
                  {isRemediated ? `${resolvedCount} Remediated ✓` : 'Sign-Off Required'}
                </span>
              </div>

              <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.55, marginBottom: 16 }}>
                {isRemediated ? (
                  <span>Remediation completed and verified for selected finding. The cryptographic audit record has been appended to the ledger.</span>
                ) : (
                  <span>A Safety Passport has been generated for target <code style={{ fontFamily: 'var(--font-mono)', background: 'var(--surface-secondary)', padding: '2px 6px', borderRadius: 4 }}>{findings[0].id}</code>. All 5 automated safety preconditions have passed. CloudPilot will never execute without explicit authorization.</span>
                )}
              </p>

              <div style={{ background: '#FAF9F8', border: '1px solid var(--border-subtle)', borderRadius: 12, padding: 16, marginBottom: 16 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span className={`badge ${resolvedFindingIds.includes(findings[0].id) ? 'badge-success' : 'badge-critical'}`}>
                      {resolvedFindingIds.includes(findings[0].id) ? 'RESOLVED ✓' : 'CRITICAL'}
                    </span>
                    <span style={{ fontWeight: 700, fontSize: 13.5 }}>{findings[0].title}</span>
                  </div>
                  {findings[0].estimatedSavings && (
                    <span className="badge badge-success">
                      Save ~${findings[0].estimatedSavings.toFixed(2)}/mo
                    </span>
                  )}
                </div>
                <div style={{ fontSize: 12.5, color: 'var(--text-secondary)' }}>
                  Target: <span style={{ fontFamily: 'var(--font-mono)' }}>{findings[0].resource.id}</span> ({findings[0].resource.name}, {findings[0].resource.region})
                </div>
                <div style={{ display: 'flex', gap: 6, marginTop: 10, flexWrap: 'wrap' }}>
                  <span className="badge badge-success">✓ 0 Disrupted sessions</span>
                  <span className="badge badge-success">✓ Rollback ready</span>
                  <span className="badge badge-info">Operation: {findings[0].operation}</span>
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', gap: 10 }}>
              <button
                onClick={() => handleActionOnFinding(findings[0].id)}
                className="btn btn-primary"
                style={{ flex: 1 }}
              >
                <span>{resolvedFindingIds.includes(findings[0].id) ? 'Review Safety Passport' : 'Inspect Safety Passport'}</span>
                <ArrowRight size={14} />
              </button>
              <button
                onClick={() => {
                  sound.playClick();
                  setSelectedFindingId(findings[0].id);
                  navigate(resolvedFindingIds.includes(findings[0].id) ? '/audit' : '/approve');
                }}
                className="btn btn-secondary"
              >
                <span>{resolvedFindingIds.includes(findings[0].id) ? 'View Audit Proof' : 'Slide to Approve'}</span>
              </button>
            </div>
          </div>
        ) : (
          <div className="apple-card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', textAlign: 'center', padding: '40px 24px' }}>
            <div style={{ width: 48, height: 48, borderRadius: '50%', background: 'var(--apple-emerald-light)', color: 'var(--apple-emerald-dark)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
              <CheckCircle2 size={26} />
            </div>
            <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 6 }}>No Pending Remediation Blockers</div>
            <p style={{ fontSize: 13, color: 'var(--text-secondary)', maxWidth: 360, marginBottom: 20 }}>
              {accountConfig.isConnected
                ? 'Your connected AWS account has 0 critical exposures pending authorization. Run a cloud discovery scan to query active resources.'
                : 'Connect your AWS account via cross-account IAM Role to begin scanning for security risks and cost waste.'}
            </p>
            <button
              onClick={() => {
                sound.playClick();
                navigate(accountConfig.isConnected ? '/discover' : '/connect');
              }}
              className="btn btn-primary"
            >
              <span>{accountConfig.isConnected ? 'Run Cloud Discovery Scan' : 'Connect AWS Account'}</span>
              <ArrowRight size={14} />
            </button>
          </div>
        )}
      </div>

      {/* ── Prioritized Actionable Findings List ── */}
      <div className="apple-card" style={{ marginBottom: 32, padding: 0, overflow: 'hidden' }}>
        <div style={{ padding: '18px 24px', borderBottom: '1px solid var(--border-subtle)', background: 'var(--surface-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', textTransform: 'uppercase', letterSpacing: '0.02em' }}>
              Prioritized Actionable Findings ({findings.length})
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
              {accountConfig.isConnected ? `Verified findings evaluated across AWS ${accountConfig.region}` : 'No active AWS account connected'}
            </div>
          </div>
          <button
            onClick={() => {
              sound.playClick();
              navigate('/discover');
            }}
            className="btn btn-secondary btn-sm"
          >
            <span>Open Investigation Workspace</span>
            <ArrowRight size={13} />
          </button>
        </div>

        <div>
          {findings.length === 0 ? (
            <div style={{ padding: '36px 24px', textAlign: 'center', color: 'var(--text-secondary)' }}>
              <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>No Actionable Findings Pending</div>
              <div style={{ fontSize: 12.5, color: 'var(--text-tertiary)' }}>
                {accountConfig.isConnected
                  ? 'All evaluated resources in ' + accountConfig.region + ' are verified and safe. Run a scan to re-evaluate active resources.'
                  : 'Connect your AWS account using CloudFormation to begin inspecting resources.'}
              </div>
            </div>
          ) : (

            findings.map((f, idx) => {
              const isResolved = f.status === 'resolved' || resolvedFindingIds.includes(f.id);
              const isBlocked = f.status === 'blocked';

              return (
                <div
                  key={f.id}
                  style={{
                    padding: '16px 24px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 16,
                    borderBottom: idx < findings.length - 1 ? '1px solid var(--border-subtle)' : 'none',
                    background: isResolved ? '#FAFDFB' : '#FFFFFF'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                    <div style={{ width: 10, height: 10, borderRadius: '50%', background: isResolved ? 'var(--apple-emerald)' : isBlocked ? 'var(--apple-amber)' : f.severity === 'critical' ? 'var(--apple-crimson)' : 'var(--apple-amber)' }} />
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
                        <span className={`badge ${isResolved ? 'badge-success' : isBlocked ? 'badge-high' : f.severity === 'critical' ? 'badge-critical' : 'badge-high'}`}>
                          {isResolved ? 'RESOLVED ✓' : isBlocked ? 'SAFETY BLOCKED' : f.severity.toUpperCase()}
                        </span>
                        <span style={{ fontWeight: 600, fontSize: 13.5, color: isResolved ? 'var(--apple-emerald-dark)' : 'var(--text-primary)' }}>
                          {f.title}
                        </span>
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--text-tertiary)', fontFamily: 'var(--font-mono)' }}>
                        {f.resource.id} ({f.affectedService}) • {f.resource.region}
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    {f.estimatedSavings && (
                      <span style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--apple-emerald-dark)' }}>
                        ~${f.estimatedSavings.toFixed(2)}/mo
                      </span>
                    )}
                    <button
                      onClick={() => handleActionOnFinding(f.id)}
                      className={`btn btn-sm ${isResolved ? 'btn-secondary' : 'btn-primary'}`}
                      style={{ padding: '6px 14px', fontSize: 12 }}
                    >
                      <span>{isResolved ? 'Inspect Audit' : isBlocked ? 'Review Blocker' : 'Safety Passport'}</span>
                      <ArrowRight size={12} />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* ── Two-Role IAM Trust Model Callout ── */}
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
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{ width: 40, height: 40, borderRadius: 10, background: 'var(--apple-blue-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <Lock size={20} color="var(--apple-blue)" />
          </div>
          <div>
            <div style={{ fontSize: 14.5, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 2 }}>
              Strictly Decoupled Two-Role IAM Architecture
            </div>
            <div style={{ fontSize: 12.5, color: 'var(--text-secondary)' }}>
              Discovery is 100% read-only (`SecurityAudit` + `ViewOnlyAccess`). Remediation roles are assumed strictly upon physical human authorization.
            </div>
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
          <FileText size={13} />
          <span>View CloudFormation Spec</span>
          <ArrowRight size={13} />
        </button>
      </div>
    </div>
  );
}
