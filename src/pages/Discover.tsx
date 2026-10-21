import { useState } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import {
  RefreshCw, Shield, DollarSign,
  ArrowRight, Activity, Search
} from 'lucide-react';
import { useDemo } from '../context/useDemo';
import { type Finding } from '../data/mockData';
import FindingDetailDrawer from '../components/FindingDetailDrawer';
import { sound } from '../utils/soundEngine';

export default function Discover() {
  const navigate = useNavigate();
  const { findings, setSelectedFindingId, activeScenario } = useDemo();
  const [filter, setFilter] = useState<'all' | 'security' | 'cost'>('all');
  const [selectedFinding, setSelectedFinding] = useState<Finding | null>(null);
  const [isScanning, setIsScanning] = useState(false);

  const displayedFindings = filter === 'all'
    ? findings
    : findings.filter((f) => f.category === filter);

  const handleRunScan = () => {
    sound.playClick();
    setIsScanning(true);
    setTimeout(() => {
      sound.playSuccess();
      setIsScanning(false);
    }, 1800);
  };

  const handleOpenFinding = (f: Finding) => {
    sound.playClick();
    setSelectedFindingId(f.id);
    setSelectedFinding(f);
  };

  const handleViewPassport = (f: Finding) => {
    sound.playClick();
    setSelectedFindingId(f.id);
    setSelectedFinding(null);
    navigate('/passport');
  };

  return (
    <div className="page-container">
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, marginBottom: 24, flexWrap: 'wrap' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
            <span className="badge badge-info">STAGE 2 OF 5</span>
            <span style={{ fontSize: 13, color: 'var(--text-tertiary)' }}>Telemetry Radar • {activeScenario === 'student' ? 'us-east-1' : 'ap-south-1'}</span>
          </div>
          <h1 className="display-title" style={{ marginBottom: 6 }}>
            Resource Discovery & Evidence
          </h1>
          <p className="body-lead">
            {findings.length} findings verified across active AWS resources ({activeScenario === 'student' ? 'Student ML Sandbox' : 'FinTech MVP'}).
          </p>
        </div>

        <button
          onClick={handleRunScan}
          disabled={isScanning}
          className="btn btn-secondary"
        >
          <RefreshCw size={14} className={isScanning ? 'spin' : ''} />
          <span>{isScanning ? 'Scanning Telemetry…' : 'Trigger Deep Scan'}</span>
        </button>
      </div>

      {/* Scanning status banner */}
      {isScanning && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="apple-card"
          style={{
            background: 'var(--apple-blue-light)',
            borderColor: 'rgba(0, 113, 227, 0.25)',
            marginBottom: 24,
            display: 'flex',
            alignItems: 'center',
            gap: 14
          }}
        >
          <div className="account-dot" style={{ width: 10, height: 10 }} />
          <div style={{ fontSize: 13.5, color: 'var(--apple-blue)' }}>
            Polling AWS CloudWatch metric streams, CloudTrail session history, and Security Group ingress rules...
          </div>
        </motion.div>
      )}

      {/* Filter Tabs */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 24 }}>
        {(['all', 'security', 'cost'] as const).map((tab) => {
          const isActive = filter === tab;
          const count = tab === 'all'
            ? findings.length
            : findings.filter((x) => x.category === tab).length;

          return (
            <button
              key={tab}
              onClick={() => {
                sound.playClick();
                setFilter(tab);
              }}
              className={`btn btn-sm ${isActive ? 'btn-primary' : 'btn-secondary'}`}
              style={{ padding: '7px 16px' }}
            >
              {tab === 'security' && <Shield size={13} />}
              {tab === 'cost' && <DollarSign size={13} />}
              {tab === 'all' && <Search size={13} />}
              <span>{tab === 'all' ? 'All Findings' : tab === 'security' ? 'Security Exposures' : 'Cost Opportunities'}</span>
              <span
                style={{
                  fontSize: 11,
                  padding: '1px 6px',
                  borderRadius: 999,
                  background: isActive ? 'rgba(255,255,255,0.25)' : 'var(--surface-secondary)',
                  color: isActive ? '#FFFFFF' : 'var(--text-secondary)'
                }}
              >
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Finding Cards List */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {displayedFindings.map((finding) => {
          const isCritical = finding.severity === 'critical';
          const isHigh = finding.severity === 'high';
          const isResolved = finding.status === 'resolved';

          return (
            <motion.div
              key={finding.id}
              className="apple-card interactive"
              onClick={() => handleOpenFinding(finding)}
              style={{
                cursor: 'pointer',
                borderColor: isResolved ? 'rgba(48, 209, 88, 0.4)' : 'var(--border-subtle)',
                background: isResolved ? '#FAFDFB' : '#FFFFFF'
              }}
              whileHover={{ y: -2 }}
              whileTap={{ scale: 0.995 }}
            >
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, marginBottom: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  {isResolved ? (
                    <span className="badge badge-success">RESOLVED ✓</span>
                  ) : (
                    <span className={`badge ${isCritical ? 'badge-critical' : isHigh ? 'badge-high' : 'badge-neutral'}`}>
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

                {finding.estimatedSavings && (
                  <span className="badge badge-success">
                    Est. ~${finding.estimatedSavings.toFixed(2)}/mo
                  </span>
                )}
              </div>

              <h2 style={{ fontSize: 17, fontWeight: 700, letterSpacing: '-0.02em', marginBottom: 6, color: isResolved ? 'var(--apple-emerald-dark)' : 'var(--text-primary)' }}>
                {finding.title}
              </h2>
              <p style={{ fontSize: 13.5, color: 'var(--text-secondary)', lineHeight: 1.55, marginBottom: 16 }}>
                {finding.description}
              </p>

              {/* Verified Evidence Snippets */}
              <div style={{ background: '#FAF9F8', padding: '12px 14px', borderRadius: 10, marginBottom: 16, border: '1px solid var(--border-subtle)' }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', marginBottom: 6 }}>
                  Verified Telemetry Evidence:
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {finding.evidence.slice(0, 2).map((ev, i) => (
                    <div key={i} style={{ display: 'flex', gap: 6, fontSize: 12.5, color: 'var(--text-primary)' }}>
                      <span style={{ color: 'var(--apple-blue)', fontWeight: 700 }}>▸</span>
                      <span>{ev}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Card Footer */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: 8, borderTop: '1px solid var(--border-subtle)' }}>
                <div style={{ fontSize: 12, color: 'var(--text-tertiary)', fontFamily: 'var(--font-mono)' }}>
                  Resource: {finding.resource.id} ({finding.resource.name})
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: isResolved ? 'var(--apple-emerald-dark)' : 'var(--apple-blue)', fontWeight: 600, fontSize: 13 }}>
                  <Activity size={14} />
                  <span>{isResolved ? 'Inspect Audit Proof' : 'Inspect Evidence & Passport'}</span>
                  <ArrowRight size={14} />
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* Slide-over Inspection Sheet */}
      <FindingDetailDrawer
        finding={selectedFinding}
        onClose={() => setSelectedFinding(null)}
        onViewPassport={handleViewPassport}
      />
    </div>
  );
}
