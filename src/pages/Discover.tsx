import { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import {
  RefreshCw, Shield, DollarSign,
  ArrowRight, Activity, Search, Filter,
  CheckCircle2, ShieldAlert, X, Zap,
  AlertTriangle, AlertCircle, CloudOff
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
    setSortOption,
    appMode,
    isBackendOnline,
    scanLiveAWS,
    liveScanStatus,
    liveConnectionStatus,
    liveErrorMessage,
    lastScannedAt,
    isStaleData,
    checkBackendHealth
  } = useDemo();

  const [selectedFinding, setSelectedFinding] = useState<Finding | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [scanMessage, setScanMessage] = useState<string | null>(null);

  // Trigger discovery scan
  const handleRunScan = async () => {
    sound.playClick();
    setIsScanning(true);
    setScanMessage(`Querying AWS APIs via STS AssumeRole in ${accountConfig.region}...`);
    const scanRes = await scanLiveAWS();
    if (scanRes.success) {
      sound.playSuccess();
    } else {
      sound.playSnap();
    }
    setIsScanning(false);
    setScanMessage(null);
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
        f.resource?.id?.toLowerCase().includes(q) ||
        f.resource?.name?.toLowerCase().includes(q) ||
        f.rule?.toLowerCase().includes(q) ||
        f.affectedService?.toLowerCase().includes(q)
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
              {accountConfig.isConnected ? `AWS Account: ${accountConfig.accountId} (${accountConfig.region})` : 'No AWS Account Connected'}
            </span>
          </div>
          <h1 className="display-title" style={{ marginBottom: 6 }}>
            Live AWS Investigation Workspace
          </h1>
          <p className="body-lead">
            {accountConfig.isConnected
              ? `${findings.length} live findings queried from active AWS resources. Click any card to inspect evidence and review the pre-generated Safety Passport.`
              : 'Connect your AWS account via cross-account IAM Role to inspect live EC2 instances, EBS volumes, and security groups.'}
          </p>
        </div>

        {accountConfig.isConnected ? (
          <button
            onClick={handleRunScan}
            disabled={isScanning || !isBackendOnline}
            className="btn btn-secondary"
            title="Scan live AWS resources via STS AssumeRole"
          >
            <RefreshCw size={14} className={isScanning ? 'spin' : ''} />
            <span>{isScanning ? 'Querying AWS APIs…' : 'Trigger Live AWS Scan'}</span>
          </button>
        ) : (
          <button
            onClick={() => {
              sound.playClick();
              navigate('/connect');
            }}
            className="btn btn-primary"
          >
            <Zap size={14} />
            <span>Connect Real AWS Account</span>
          </button>
        )}
      </div>

      {/* ── Mode Status Ribbon ── */}
      <div
        className="apple-card"
        style={{
          padding: '12px 18px',
          marginBottom: 20,
          background: accountConfig.isConnected ? 'rgba(0, 113, 227, 0.05)' : 'rgba(142, 142, 147, 0.05)',
          borderColor: accountConfig.isConnected ? 'rgba(0, 113, 227, 0.2)' : 'var(--border-medium)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 12
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Zap size={16} color="var(--apple-blue)" fill="currentColor" />
          <div style={{ fontSize: 13, fontWeight: 600, color: accountConfig.isConnected ? 'var(--apple-blue)' : 'var(--text-primary)' }}>
            {accountConfig.isConnected
              ? `LIVE AWS MODE — Scoped read-only telemetry queried via STS AssumeRole (acct-${accountConfig.accountId})`
              : 'LIVE AWS MODE — Ready to connect target AWS account'}
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: 'var(--text-secondary)' }}>
          {accountConfig.isConnected ? (
            <span>
              Role: <code style={{ fontFamily: 'var(--font-mono)' }}>{accountConfig.roleName}</code>
              {` • Region: ${accountConfig.region}`}
              {` • Status: ${liveConnectionStatus.toUpperCase()}`}
              {isBackendOnline ? ' • Backend API: Online' : ' • Backend API: Offline'}
            </span>
          ) : (
            <span>Status: {liveConnectionStatus.toUpperCase()} • Zero static AWS keys stored • Cryptographic ExternalId verified</span>
          )}
        </div>
      </div>


      {/* ── Stale Data Warning Banner ── */}
      {isStaleData && lastScannedAt && (
        <div
          className="apple-card"
          style={{
            padding: '10px 16px',
            marginBottom: 16,
            background: 'rgba(255, 159, 10, 0.08)',
            borderColor: 'rgba(255, 159, 10, 0.3)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            fontSize: 12.5,
            color: 'var(--text-primary)'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <AlertTriangle size={15} color="var(--apple-amber-dark)" />
            <span>Cached live findings displayed. Last verified from AWS at {new Date(lastScannedAt).toLocaleTimeString()}.</span>
          </div>
          <button onClick={handleRunScan} className="btn btn-ghost btn-sm" style={{ color: 'var(--apple-blue)', padding: 0 }}>
            Re-verify now
          </button>
        </div>
      )}

      {/* ── Backend Outage / Service Unavailable in Live Mode ── */}
      {appMode === 'live' && !isBackendOnline && (
        <div
          className="apple-card"
          style={{
            padding: '28px 24px',
            marginBottom: 24,
            background: 'rgba(255, 59, 48, 0.04)',
            border: '2px solid rgba(255, 59, 48, 0.25)',
            textAlign: 'center'
          }}
        >
          <CloudOff size={36} color="var(--apple-red)" style={{ margin: '0 auto 12px' }} />
          <h3 style={{ fontSize: 17, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 6 }}>
            CloudPilot Backend Service Unavailable
          </h3>
          <p style={{ fontSize: 13.5, color: 'var(--text-secondary)', maxWidth: 580, margin: '0 auto 16px', lineHeight: 1.6 }}>
            In live mode, CloudPilot communicates directly with AWS via the secure FastAPI backend. The backend service at <code>http://localhost:8000</code> is currently offline or unreachable. No live AWS telemetry can be gathered until the backend is active.
          </p>
          <div style={{ display: 'flex', justifyContent: 'center', gap: 12 }}>
            <button
              onClick={() => checkBackendHealth()}
              className="btn btn-primary btn-sm"
            >
              <RefreshCw size={13} />
              <span>Retry Backend Connection</span>
            </button>
          </div>
        </div>
      )}

      {/* ── Scan Failed Alert ── */}
      {appMode === 'live' && liveScanStatus === 'failed' && (
        <div
          className="apple-card"
          style={{
            padding: '20px 24px',
            marginBottom: 24,
            background: 'rgba(255, 59, 48, 0.04)',
            border: '2px solid rgba(255, 59, 48, 0.25)',
            display: 'flex',
            gap: 16,
            alignItems: 'flex-start'
          }}
        >
          <AlertCircle size={22} color="var(--apple-red)" style={{ flexShrink: 0, marginTop: 2 }} />
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--apple-red)', marginBottom: 4 }}>
              Live AWS Scan Failed
            </div>
            <div style={{ fontSize: 13, color: 'var(--text-primary)', marginBottom: 12, lineHeight: 1.5 }}>
              {liveErrorMessage || 'An error occurred while querying AWS APIs. Check your STS role permissions and trust configuration.'}
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={handleRunScan} className="btn btn-secondary btn-sm">
                <RefreshCw size={12} />
                <span>Retry Live Scan</span>
              </button>
              <button onClick={() => navigate('/connect')} className="btn btn-ghost btn-sm" style={{ color: 'var(--apple-blue)' }}>
                <span>Review IAM Role & ExternalId</span>
                <ArrowRight size={12} />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Live Mode Scanning In-Progress ── */}
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
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--apple-blue)' }}>
              {scanMessage || 'Scanning AWS telemetry endpoints…'}
            </div>
            <div style={{ fontSize: 11.5, color: 'var(--text-secondary)', marginTop: 2 }}>
              Running read-only STS queries. Zero changes will be made to your cloud.
            </div>
          </div>
        </motion.div>
      )}

      {/* Filter and Search Bar */}
      <div className="apple-card" style={{ padding: '16px 20px', marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, marginBottom: 16, flexWrap: 'wrap' }}>
          {/* Category Tabs */}
          <div style={{ display: 'flex', gap: 8 }}>
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
              placeholder="Search by title, resource ID (e.g. sg-0a1b, vol-0918), service, or rule..."
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

      {/* ── Disconnected Account State ── */}
      {!accountConfig.isConnected ? (
        <div className="apple-card" style={{ textAlign: 'center', padding: '56px 24px', background: '#FFFFFF' }}>
          <div style={{ width: 52, height: 52, borderRadius: '50%', background: 'var(--apple-blue-light)', color: 'var(--apple-blue)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
            <Zap size={26} fill="currentColor" />
          </div>
          <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 8 }}>No AWS Account Connected</h2>
          <p style={{ fontSize: 13.5, color: 'var(--text-secondary)', maxWidth: 520, margin: '0 auto 24px', lineHeight: 1.6 }}>
            Connect your target AWS environment using our CloudFormation IAM template. Once connected, CloudPilot will run live read-only queries to detect unattached EBS storage and open security group exposures.
          </p>
          <button
            onClick={() => {
              sound.playClick();
              navigate('/connect');
            }}
            className="btn btn-primary btn-lg"
            style={{ margin: '0 auto' }}
          >
            <Zap size={16} />
            <span>Connect Real AWS Account</span>
            <ArrowRight size={14} />
          </button>
        </div>
      ) : liveScanStatus === 'empty' && findings.length === 0 ? (
        <div className="apple-card" style={{ textAlign: 'center', padding: '48px 24px', background: '#FAFDFB', borderColor: 'rgba(48, 209, 88, 0.35)' }}>
          <CheckCircle2 size={36} color="var(--apple-emerald)" style={{ margin: '0 auto 12px' }} />
          <h3 style={{ fontSize: 18, fontWeight: 700, color: 'var(--apple-emerald-dark)', marginBottom: 6 }}>
            Zero Cost Leaks or Security Exposures Found
          </h3>
          <p style={{ fontSize: 13.5, color: 'var(--text-secondary)', maxWidth: 520, margin: '0 auto 16px', lineHeight: 1.6 }}>
            A live discovery scan was successfully completed for account <strong>{accountConfig.accountId}</strong> in region <strong>{accountConfig.region}</strong>.
            All unattached volume and public SSH ingress rules passed with zero open exposures.
          </p>
          {lastScannedAt && (
            <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginBottom: 16 }}>
              Scan completed at: {new Date(lastScannedAt).toLocaleString()}
            </div>
          )}
          <button onClick={handleRunScan} className="btn btn-secondary btn-sm">
            <RefreshCw size={13} />
            <span>Re-scan AWS Environment</span>
          </button>
        </div>
      ) : filteredAndSortedFindings.length === 0 ? (
        <div className="apple-card" style={{ textAlign: 'center', padding: '48px 24px' }}>
          <Search size={32} color="var(--text-tertiary)" style={{ margin: '0 auto 12px' }} />
          <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 4 }}>
            {liveScanStatus === 'idle'
              ? 'Ready to Run Live AWS Scan'
              : 'No findings match your search or filter'}
          </h3>
          <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 16 }}>
            {liveScanStatus === 'idle'
              ? 'Click below to query AWS APIs in ' + accountConfig.region + ' for unattached EBS volumes and open security groups.'
              : 'Try clearing the search query or resetting the status and category filters.'}
          </p>
          {liveScanStatus === 'idle' ? (
            <button onClick={handleRunScan} className="btn btn-primary btn-sm">
              <RefreshCw size={13} />
              <span>Trigger Live AWS Scan</span>
            </button>
          ) : (
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
          )}
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
                    <span className="badge" style={{ background: 'rgba(0, 113, 227, 0.12)', color: 'var(--apple-blue)', fontWeight: 700, border: '1px solid rgba(0, 113, 227, 0.25)' }}>
                      <Zap size={11} fill="currentColor" /> LIVE AWS TELEMETRY
                    </span>
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
                      {finding.rule?.split(':')[0]}
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

                {/* Evidence Snippets */}
                <div style={{ background: '#FAF9F8', padding: '12px 14px', borderRadius: 10, marginBottom: 16, border: '1px solid var(--border-subtle)' }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Activity size={12} color="var(--apple-blue)" />
                    Live Verified Telemetry Evidence:
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    {(finding.evidence || []).slice(0, 2).map((ev, i) => (
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
                    Resource: {finding.resource?.id} ({finding.resource?.name}) • {finding.resource?.region}
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
