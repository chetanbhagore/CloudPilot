import { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import {
  RefreshCw, Shield, DollarSign,
  ArrowRight, Activity, Search, Filter,
  CheckCircle2, ShieldAlert, X
} from 'lucide-react';
import { useDemo } from '../context/useDemo';
import { type Finding, type Severity } from '../data/mockData';
import { type StatusFilter, type SortOption } from '../context/contextDefinition';
import FindingDetailDrawer from '../components/FindingDetailDrawer';
import { sound } from '../utils/soundEngine';

export default function Discover() {
  const navigate = useNavigate();
  const {
    findings,
    resolvedFindingIds,
    setSelectedFindingId,
    accountConfig,
    categoryFilter,
    setCategoryFilter,
    statusFilter,
    setStatusFilter,
    searchQuery,
    setSearchQuery,
    sortOption,
    setSortOption
  } = useDemo();

  const [selectedFinding, setSelectedFinding] = useState<Finding | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [scanMessage, setScanMessage] = useState<string | null>(null);

  // Trigger simulated deep telemetry scan
  const handleRunScan = () => {
    sound.playClick();
    setIsScanning(true);
    setScanMessage('Scanning 47 active resources across VPC, EC2, S3, EBS, and IAM...');
    setTimeout(() => {
      setScanMessage('Analyzing CloudTrail session history and evaluating security rulesets...');
    }, 900);
    setTimeout(() => {
      sound.playSuccess();
      setIsScanning(false);
      setScanMessage(null);
    }, 1900);
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

  // Filter and sort execution
  const filteredAndSortedFindings = useMemo(() => {
    let result = findings.slice();

    // 1. Category Filter
    if (categoryFilter !== 'all') {
      result = result.filter((f) => f.category === categoryFilter);
    }

    // 2. Status Filter
    if (statusFilter === 'open') {
      result = result.filter((f) => f.status === 'open' && !resolvedFindingIds.includes(f.id));
    } else if (statusFilter === 'resolved') {
      result = result.filter((f) => f.status === 'resolved' || resolvedFindingIds.includes(f.id));
    } else if (statusFilter === 'blocked') {
      result = result.filter((f) => f.status === 'blocked' || f.isSafetyBlocked);
    }

    // 3. Search query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter((f) =>
        f.title.toLowerCase().includes(q) ||
        f.description.toLowerCase().includes(q) ||
        f.resource.id.toLowerCase().includes(q) ||
        f.resource.name.toLowerCase().includes(q) ||
        f.rule.toLowerCase().includes(q) ||
        f.affectedService.toLowerCase().includes(q)
      );
    }

    // 4. Sorting
    const severityWeight: Record<Severity, number> = {
      critical: 4,
      high: 3,
      medium: 2,
      low: 1
    };

    result.sort((a, b) => {
      if (sortOption === 'severity') {
        const diff = severityWeight[b.severity] - severityWeight[a.severity];
        if (diff !== 0) return diff;
        return (b.estimatedSavings || 0) - (a.estimatedSavings || 0);
      }
      if (sortOption === 'savings') {
        return (b.estimatedSavings || 0) - (a.estimatedSavings || 0);
      }
      if (sortOption === 'newest') {
        return new Date(b.detectedAt).getTime() - new Date(a.detectedAt).getTime();
      }
      return 0;
    });

    return result;
  }, [findings, categoryFilter, statusFilter, searchQuery, sortOption, resolvedFindingIds]);

  const securityCount = findings.filter((f) => f.category === 'security').length;
  const costCount = findings.filter((f) => f.category === 'cost').length;
  const resolvedCountTotal = findings.filter((f) => f.status === 'resolved' || resolvedFindingIds.includes(f.id)).length;

  return (
    <div className="page-container">
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, marginBottom: 24, flexWrap: 'wrap' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
            <span className="badge badge-info">STAGE 2 OF 5</span>
            <span style={{ fontSize: 13, color: 'var(--text-tertiary)' }}>
              Discovery & Evidence • {accountConfig.alias} ({accountConfig.region})
            </span>
          </div>
          <h1 className="display-title" style={{ marginBottom: 6 }}>
            Cloud Investigation Workspace
          </h1>
          <p className="body-lead">
            {findings.length} findings evaluated across 47 active cloud assets. Click any card to inspect telemetry evidence and review the pre-generated Safety Passport.
          </p>
        </div>

        <button
          onClick={handleRunScan}
          disabled={isScanning}
          className="btn btn-secondary"
          title="Simulate refreshing telemetry queries from CloudWatch and CloudTrail"
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
          <div style={{ fontSize: 13.5, color: 'var(--apple-blue)', fontWeight: 500 }}>
            {scanMessage || 'Scanning simulated CloudWatch metrics and Security Group ingress rules...'}
          </div>
        </motion.div>
      )}

      {/* Filter, Search & Sorting Controls Toolbar */}
      <div
        className="apple-card"
        style={{
          marginBottom: 24,
          padding: 16,
          display: 'flex',
          flexDirection: 'column',
          gap: 14,
          background: '#FFFFFF'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
          {/* Category Tabs */}
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            <button
              onClick={() => {
                sound.playClick();
                setCategoryFilter('all');
              }}
              className={`btn btn-sm ${categoryFilter === 'all' ? 'btn-primary' : 'btn-secondary'}`}
              style={{ padding: '6px 14px' }}
            >
              <span>All Findings</span>
              <span className="badge-bubble">{findings.length}</span>
            </button>

            <button
              onClick={() => {
                sound.playClick();
                setCategoryFilter('security');
              }}
              className={`btn btn-sm ${categoryFilter === 'security' ? 'btn-primary' : 'btn-secondary'}`}
              style={{ padding: '6px 14px' }}
            >
              <Shield size={13} />
              <span>Security Exposures</span>
              <span className="badge-bubble">{securityCount}</span>
            </button>

            <button
              onClick={() => {
                sound.playClick();
                setCategoryFilter('cost');
              }}
              className={`btn btn-sm ${categoryFilter === 'cost' ? 'btn-primary' : 'btn-secondary'}`}
              style={{ padding: '6px 14px' }}
            >
              <DollarSign size={13} />
              <span>Cost Opportunities</span>
              <span className="badge-bubble">{costCount}</span>
            </button>
          </div>

          {/* Sorting Dropdown */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 12, color: 'var(--text-tertiary)', fontWeight: 600 }}>Sort by:</span>
            <select
              value={sortOption}
              onChange={(e) => {
                sound.playClick();
                setSortOption(e.target.value as SortOption);
              }}
              style={{
                padding: '6px 10px',
                borderRadius: 8,
                border: '1px solid var(--border-medium)',
                background: '#FFFFFF',
                fontSize: 12.5,
                color: 'var(--text-primary)',
                cursor: 'pointer'
              }}
            >
              <option value="severity">Severity (Critical → Low)</option>
              <option value="savings">Estimated Savings ($ High → Low)</option>
              <option value="newest">Detection Time (Newest First)</option>
            </select>
          </div>
        </div>

        {/* Search Bar & Status Filter Row */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          {/* Text Search Input */}
          <div style={{ flex: 1, minWidth: 260, position: 'relative' }}>
            <Search
              size={15}
              color="var(--text-tertiary)"
              style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)' }}
            />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by title, resource ID (e.g. sg-0a1b, i-0gpu), service, or rule code..."
              style={{
                width: '100%',
                padding: '8px 12px 8px 36px',
                borderRadius: 8,
                border: '1px solid var(--border-medium)',
                fontSize: 13,
                background: '#FFFFFF'
              }}
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="btn btn-ghost btn-sm"
                style={{ position: 'absolute', right: 6, top: '50%', transform: 'translateY(-50%)', padding: 4, width: 22, height: 22, borderRadius: '50%' }}
              >
                <X size={12} />
              </button>
            )}
          </div>

          {/* Status Filter */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <Filter size={13} color="var(--text-tertiary)" />
            <span style={{ fontSize: 12, color: 'var(--text-tertiary)', fontWeight: 600 }}>Status:</span>
            <select
              value={statusFilter}
              onChange={(e) => {
                sound.playClick();
                setStatusFilter(e.target.value as StatusFilter);
              }}
              style={{
                padding: '6px 10px',
                borderRadius: 8,
                border: '1px solid var(--border-medium)',
                background: '#FFFFFF',
                fontSize: 12.5,
                color: 'var(--text-primary)',
                cursor: 'pointer'
              }}
            >
              <option value="all">All Statuses ({findings.length})</option>
              <option value="open">Open / Action Required</option>
              <option value="resolved">Resolved ✓ ({resolvedCountTotal})</option>
              <option value="blocked">Blocked by Safety Check</option>
            </select>
          </div>
        </div>
      </div>

      {/* Showing Results Summary */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
          Showing <strong>{filteredAndSortedFindings.length}</strong> of {findings.length} evaluated findings
          {searchQuery && <span> matching "<strong>{searchQuery}</strong>"</span>}
        </div>
        {(categoryFilter !== 'all' || statusFilter !== 'all' || searchQuery) && (
          <button
            onClick={() => {
              sound.playClick();
              setCategoryFilter('all');
              setStatusFilter('all');
              setSearchQuery('');
            }}
            className="btn btn-ghost btn-sm"
            style={{ fontSize: 12, color: 'var(--apple-blue)' }}
          >
            Clear all filters
          </button>
        )}
      </div>

      {/* Findings List */}
      {filteredAndSortedFindings.length === 0 ? (
        <div className="apple-card" style={{ textAlign: 'center', padding: '48px 24px' }}>
          <Search size={32} color="var(--text-tertiary)" style={{ margin: '0 auto 12px' }} />
          <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 4 }}>No findings match your search or filter</h3>
          <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 16 }}>
            Try clearing the search query or resetting the status and category filters.
          </p>
          <button
            onClick={() => {
              sound.playClick();
              setCategoryFilter('all');
              setStatusFilter('all');
              setSearchQuery('');
            }}
            className="btn btn-secondary btn-sm"
          >
            Reset Filters
          </button>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {filteredAndSortedFindings.map((finding) => {
            const isResolved = finding.status === 'resolved' || resolvedFindingIds.includes(finding.id);
            const isBlocked = finding.status === 'blocked' || finding.isSafetyBlocked;
            const isCritical = finding.severity === 'critical';
            const isHigh = finding.severity === 'high';

            return (
              <motion.div
                key={finding.id}
                className="apple-card interactive"
                onClick={() => handleOpenFinding(finding)}
                style={{
                  cursor: 'pointer',
                  borderColor: isResolved ? 'rgba(48, 209, 88, 0.4)' : isBlocked ? 'rgba(255, 159, 10, 0.35)' : 'var(--border-subtle)',
                  background: isResolved ? '#FAFDFB' : isBlocked ? '#FFFDF8' : '#FFFFFF'
                }}
                whileHover={{ y: -2 }}
                whileTap={{ scale: 0.995 }}
              >
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, marginBottom: 12 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                    {isResolved ? (
                      <span className="badge badge-success">
                        <CheckCircle2 size={12} /> RESOLVED ✓
                      </span>
                    ) : isBlocked ? (
                      <span className="badge badge-high" style={{ background: 'rgba(255, 159, 10, 0.15)', color: '#C67800' }}>
                        <ShieldAlert size={12} /> BLOCKED BY SAFETY CHECK
                      </span>
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
                      Save ~${finding.estimatedSavings.toFixed(2)}/mo
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
                  <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Activity size={12} color="var(--apple-blue)" /> Simulated Telemetry Evidence:
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
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: 8, borderTop: '1px solid var(--border-subtle)', flexWrap: 'wrap', gap: 8 }}>
                  <div style={{ fontSize: 12, color: 'var(--text-tertiary)', fontFamily: 'var(--font-mono)' }}>
                    Resource: {finding.resource.id} ({finding.resource.name}) • {finding.resource.region}
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleViewPassport(finding);
                      }}
                      className="btn btn-secondary btn-sm"
                    >
                      <span>{isResolved ? 'Inspect Audit Proof' : isBlocked ? 'Review Safety Blocker' : 'Open Safety Passport'}</span>
                      <ArrowRight size={12} />
                    </button>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* Slide-over Inspection Sheet */}
      <FindingDetailDrawer
        finding={selectedFinding}
        onClose={() => setSelectedFinding(null)}
        onViewPassport={handleViewPassport}
      />
    </div>
  );
}
