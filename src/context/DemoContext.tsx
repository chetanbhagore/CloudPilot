import { useState, useEffect, useCallback, type ReactNode } from 'react';
import {
  type Finding,
  type AuditRecord,
  FINTECH_FINDINGS,
  STUDENT_FINDINGS,
  FINTECH_ACCOUNT,
  STUDENT_ACCOUNT
} from '../data/mockData';
import {
  DemoContext,
  type AppMode,
  type ScenarioType,
  type AccountConfig,
  type FilterCategory,
  type StatusFilter,
  type SortOption,
  type LiveScanStatus,
  type LiveConnectionStatus
} from './contextDefinition';

// ─── Native WebCrypto SHA-256 Hash Generator ──────────────────────────────────
async function computeSHA256(message: string): Promise<string> {
  const msgUint8 = new TextEncoder().encode(message);
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgUint8);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

function cloneFindings(list: Finding[]): Finding[] {
  return JSON.parse(JSON.stringify(list));
}

export function DemoProvider({ children }: { children: ReactNode }) {
  const backendUrl = import.meta.env.VITE_BACKEND_URL || 'http://localhost:8000';

  // App Mode: 'demo' (mock scenarios) vs 'live' (real AWS via FastAPI backend)
  const [appMode, setAppModeState] = useState<AppMode>(() => {
    try {
      if (typeof window !== 'undefined') {
        const saved = localStorage.getItem('cloudpilot_app_mode');
        if (saved === 'live' || saved === 'demo') return saved;
      }
    } catch {}
    return 'demo';
  });

  const [isBackendOnline, setIsBackendOnline] = useState<boolean>(false);
  const [activeScenario, setActiveScenarioState] = useState<ScenarioType>('fintech');
  
  // ── Live Execution State (Strictly Isolated from Demo) ───────────────────────
  const [liveFindings, setLiveFindings] = useState<Finding[]>([]);
  const [liveScanStatus, setLiveScanStatus] = useState<LiveScanStatus>('idle');
  const [liveConnectionStatus, setLiveConnectionStatus] = useState<LiveConnectionStatus>('disconnected');
  const [liveErrorMessage, setLiveErrorMessage] = useState<string | null>(null);
  const [lastScannedAt, setLastScannedAt] = useState<string | null>(null);
  const [isStaleData, setIsStaleData] = useState<boolean>(false);

  // Active findings displayed in the UI
  const [findings, setFindings] = useState<Finding[]>(() => {
    try {
      if (typeof window !== 'undefined') {
        const saved = localStorage.getItem('cloudpilot_app_mode');
        if (saved === 'live') {
          return [];
        }
      }
    } catch {}
    return cloneFindings(FINTECH_FINDINGS);
  });

  const [resolvedFindingIds, setResolvedFindingIds] = useState<string[]>([]);
  const [auditRecords, setAuditRecords] = useState<AuditRecord[]>([]);
  const [activeHash, setActiveHash] = useState<string>('sha256-pending-authorization');
  const [selectedFindingId, setSelectedFindingId] = useState<string>('finding-001');

  // Account configuration
  const [accountConfig, setAccountConfig] = useState<AccountConfig>({
    accountId: FINTECH_ACCOUNT.accountId,
    alias: FINTECH_ACCOUNT.alias,
    roleName: 'CloudPilotAuditRole',
    region: FINTECH_ACCOUNT.region,
    isConnected: true,
    isConnecting: false,
    connectionError: null,
    externalId: 'cp-tenant-9042-demo',
    isLive: false
  });

  // Check backend health periodically
  const checkBackendHealth = useCallback(async (): Promise<boolean> => {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 1800);
      const res = await fetch(`${backendUrl}/health`, { signal: controller.signal });
      clearTimeout(timeoutId);
      const online = res.ok;
      setIsBackendOnline(online);
      if (!online && appMode === 'live') {
        setLiveScanStatus('service_unavailable');
      }
      return online;
    } catch {
      setIsBackendOnline(false);
      if (appMode === 'live') {
        setLiveScanStatus('service_unavailable');
      }
      return false;
    }
  }, [backendUrl, appMode]);

  useEffect(() => {
    const timer = setTimeout(() => {
      checkBackendHealth();
    }, 50);
    const interval = setInterval(checkBackendHealth, 10000);
    return () => {
      clearTimeout(timer);
      clearInterval(interval);
    };
  }, [checkBackendHealth]);

  // Mode Switcher: Strict Partitioning between Demo and Live
  const setAppMode = (mode: AppMode) => {
    setAppModeState(mode);
    if (typeof window !== 'undefined') {
      localStorage.setItem('cloudpilot_app_mode', mode);
    }
    
    if (mode === 'live') {
      checkBackendHealth();
      // In live mode: Display only real live findings. Never inject demo fixtures!
      setFindings(liveFindings);
      if (liveFindings.length > 0) {
        setSelectedFindingId(liveFindings[0].id);
      } else {
        setSelectedFindingId('');
      }

      // If backend is online and account connected, fetch fresh live findings
      if (accountConfig.isLive && accountConfig.isConnected) {
        fetch(`${backendUrl}/findings?mode=live`)
          .then((res) => (res.ok ? res.json() : null))
          .then((data) => {
            if (data && Array.isArray(data)) {
              setLiveFindings(data);
              setFindings(data);
              if (data.length > 0) {
                setSelectedFindingId(data[0].id);
                setLiveScanStatus('completed');
              } else {
                setLiveScanStatus('empty');
              }
            }
          })
          .catch(() => {
            setIsStaleData(true);
          });
      }
    } else {
      // Demo mode: Return to active scenario demo data
      setLiveErrorMessage(null);
      if (activeScenario === 'student') {
        const studentData = cloneFindings(STUDENT_FINDINGS);
        setFindings(studentData);
        setSelectedFindingId(studentData[0]?.id || 'finding-student-001');
      } else {
        const fintechData = cloneFindings(FINTECH_FINDINGS);
        setFindings(fintechData);
        setSelectedFindingId(fintechData[0]?.id || 'finding-001');
      }
    }
  };

  // Search & filter state
  const [categoryFilter, setCategoryFilter] = useState<FilterCategory>('all');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [sortOption, setSortOption] = useState<SortOption>('severity');

  // Switch demo scenarios (applicable in demo mode)
  const setScenario = (scenario: ScenarioType) => {
    setActiveScenarioState(scenario);
    setResolvedFindingIds([]);
    setAuditRecords([]);
    setActiveHash('sha256-pending-authorization');

    if (appMode === 'demo') {
      if (scenario === 'student') {
        const data = cloneFindings(STUDENT_FINDINGS);
        setFindings(data);
        setSelectedFindingId(data[0]?.id || 'finding-student-001');
        setAccountConfig({
          accountId: STUDENT_ACCOUNT.accountId,
          alias: STUDENT_ACCOUNT.alias,
          roleName: 'CloudPilotAuditRole',
          region: STUDENT_ACCOUNT.region,
          isConnected: true,
          isConnecting: false,
          connectionError: null,
          isLive: false
        });
      } else {
        const data = cloneFindings(FINTECH_FINDINGS);
        setFindings(data);
        setSelectedFindingId(data[0]?.id || 'finding-001');
        setAccountConfig({
          accountId: FINTECH_ACCOUNT.accountId,
          alias: FINTECH_ACCOUNT.alias,
          roleName: 'CloudPilotAuditRole',
          region: FINTECH_ACCOUNT.region,
          isConnected: true,
          isConnecting: false,
          connectionError: null,
          isLive: false
        });
      }
    }
  };

  const updateAccountConfig = (cfg: Partial<AccountConfig>) => {
    setAccountConfig((prev) => ({ ...prev, ...cfg }));
  };

  // Connect AWS Account: Real STS connection with fail-closed semantics in live mode
  const connectAccount = async (custom = false): Promise<{ success: boolean; error?: string }> => {
    updateAccountConfig({ isConnecting: true, connectionError: null });
    setLiveErrorMessage(null);

    const sanitizedId = accountConfig.accountId.replace(/\D/g, '');
    if (sanitizedId.length !== 12) {
      const err = 'AWS Account ID must be exactly 12 numeric digits (e.g. 123456789012).';
      updateAccountConfig({ isConnecting: false, connectionError: err, isConnected: false });
      setLiveConnectionStatus('failed');
      return { success: false, error: err };
    }

    if (!accountConfig.roleName.trim()) {
      const err = 'IAM Role name is required (e.g. CloudPilotAuditRole).';
      updateAccountConfig({ isConnecting: false, connectionError: err, isConnected: false });
      setLiveConnectionStatus('failed');
      return { success: false, error: err };
    }

    const isLiveAttempt = appMode === 'live' || custom;

    // ── Live Mode Connection ──
    if (isLiveAttempt) {
      setLiveConnectionStatus('connecting');

      if (!isBackendOnline) {
        const err = 'CloudPilot backend service is unreachable. Live AWS connection cannot be established.';
        updateAccountConfig({ isConnecting: false, connectionError: err, isConnected: false, isLive: false });
        setLiveConnectionStatus('failed');
        setLiveErrorMessage(err);
        return { success: false, error: err };
      }

      try {
        const res = await fetch(`${backendUrl}/accounts/connect`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            account_id: sanitizedId,
            role_arn: `arn:aws:iam::${sanitizedId}:role/${accountConfig.roleName}`,
            external_id: accountConfig.externalId || 'cp-tenant-9042-demo',
            region: accountConfig.region,
            mode: 'live'
          })
        });

        if (res.ok) {
          const data = await res.json();
          updateAccountConfig({
            accountId: sanitizedId,
            alias: data.alias || accountConfig.alias || `AWS Live (${accountConfig.region})`,
            isConnecting: false,
            isConnected: true,
            connectionError: null,
            isLive: true
          });
          setLiveConnectionStatus('connected');
          setAppMode('live');
          return { success: true };
        } else {
          const errorData = await res.json().catch(() => ({ detail: 'AWS STS AssumeRole handshake failed.' }));
          const errMsg = errorData.detail || `AWS Connection failed with status ${res.status}.`;
          updateAccountConfig({
            isConnecting: false,
            connectionError: errMsg,
            isConnected: false,
            isLive: false
          });
          setLiveConnectionStatus('failed');
          setLiveErrorMessage(errMsg);
          return { success: false, error: errMsg };
        }
      } catch (err) {
        const errMsg = `Network error connecting to CloudPilot backend: ${err instanceof Error ? err.message : String(err)}`;
        updateAccountConfig({
          isConnecting: false,
          connectionError: errMsg,
          isConnected: false,
          isLive: false
        });
        setLiveConnectionStatus('failed');
        setLiveErrorMessage(errMsg);
        return { success: false, error: errMsg };
      }
    }

    // ── Explicit Demo Mode Handshake ──
    await new Promise((resolve) => setTimeout(resolve, 800));
    updateAccountConfig({
      accountId: sanitizedId,
      alias: accountConfig.alias,
      isConnecting: false,
      isConnected: true,
      connectionError: null,
      isLive: false
    });
    return { success: true };
  };

  // Scan Live AWS: Queries real AWS via backend. Never falls back to mock findings in live mode.
  const scanLiveAWS = async (): Promise<{ success: boolean; count?: number; error?: string }> => {
    if (appMode !== 'live') {
      return { success: true, count: findings.length };
    }

    setLiveScanStatus('scanning');
    setLiveErrorMessage(null);

    if (!isBackendOnline) {
      const err = 'CloudPilot backend service is unreachable. Unable to trigger live scan.';
      setLiveScanStatus('service_unavailable');
      setLiveErrorMessage(err);
      return { success: false, error: err };
    }

    try {
      const sanitizedId = accountConfig.accountId.replace(/\D/g, '');
      const res = await fetch(`${backendUrl}/discovery/scan`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          account_id: sanitizedId,
          region: accountConfig.region,
          mode: 'live'
        })
      });

      if (res.ok) {
        const data = await res.json();
        const discovered = data.findings || [];
        setLiveFindings(discovered);
        setFindings(discovered);
        setLastScannedAt(data.scanned_at || new Date().toISOString());
        setIsStaleData(false);

        if (discovered.length === 0) {
          setLiveScanStatus('empty');
          setSelectedFindingId('');
          return { success: true, count: 0 };
        }

        setLiveScanStatus('completed');
        setSelectedFindingId(discovered[0].id);
        return { success: true, count: discovered.length };
      } else {
        const errorData = await res.json().catch(() => ({ detail: 'Live scan request rejected by backend.' }));
        const errMsg = errorData.detail || `Scan failed with HTTP ${res.status}`;
        setLiveScanStatus('failed');
        setLiveErrorMessage(errMsg);
        setLiveFindings([]);
        setFindings([]);
        setSelectedFindingId('');
        return { success: false, error: errMsg };
      }
    } catch (err) {
      const errMsg = `Scan failed: ${err instanceof Error ? err.message : String(err)}`;
      setLiveScanStatus('failed');
      setLiveErrorMessage(errMsg);
      setLiveFindings([]);
      setFindings([]);
      setSelectedFindingId('');
      return { success: false, error: errMsg };
    }
  };

  const disconnectAccount = () => {
    updateAccountConfig({ isConnected: false, isLive: false });
    setLiveConnectionStatus('disconnected');
    setLiveFindings([]);
    if (appMode === 'live') {
      setFindings([]);
      setSelectedFindingId('');
    }
  };

  // ─── Dynamic Metrics derived from active state ──────────────────────────────
  const isStudent = activeScenario === 'student';
  const isLive = appMode === 'live';
  const isRemediated = resolvedFindingIds.length > 0;
  const resolvedCount = resolvedFindingIds.length;

  const openFindings = findings.filter((f) => f.status === 'open' || f.status === 'blocked');
  const criticalCount = findings.filter((f) => f.severity === 'critical' && f.status === 'open').length;

  // Monthly waste: sum of open cost findings
  const monthlyWaste = openFindings
    .filter((f) => f.category === 'cost' && f.estimatedMonthlyCost)
    .reduce((sum, f) => sum + (f.estimatedMonthlyCost || 0), 0);

  // Security score
  const baseScore = isLive ? (findings.length === 0 ? 100 : 45) : (isStudent ? 42 : 34);
  const scoreBoost = resolvedFindingIds.length * 15;
  const securityScore = Math.min(100, baseScore + scoreBoost);

  const getActiveFinding = (): Finding => {
    return findings.find((f) => f.id === selectedFindingId) || findings[0] || ({} as Finding);
  };

  const getFindingById = (id: string): Finding | undefined => {
    return findings.find((f) => f.id === id);
  };

  // Approve action: dispatches to real remediation engine in live mode
  const approveRemediation = async (targetId?: string) => {
    const findingToApprove = targetId
      ? findings.find((f) => f.id === targetId) || getActiveFinding()
      : getActiveFinding();

    if (!findingToApprove || !findingToApprove.id) {
      throw new Error('No finding selected for approval.');
    }

    if (findingToApprove.isSafetyBlocked) {
      throw new Error(`Cannot authorize: ${findingToApprove.blockedReason || 'Blocked by safety check'}`);
    }

    const now = new Date().toISOString();
    const actorEmail = 'operator@cloudpilot.io';

    // ── Live Mode Execution Path ──
    if (appMode === 'live') {
      if (!isBackendOnline) {
        throw new Error('CloudPilot backend service is unreachable. Live remediation cannot be executed.');
      }

      const res = await fetch(`${backendUrl}/findings/${findingToApprove.id}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          finding_id: findingToApprove.id,
          user_email: actorEmail,
          mode: 'live'
        })
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success || data.outcome !== 'success') {
        const errorDetail = data.error_details || data.detail || 'Remediation failed or state verification rejected.';
        throw new Error(`Live remediation failed: ${errorDetail}`);
      }

      // Live mutation and verification SUCCEEDED!
      setActiveHash(data.integrity_hash);
      setFindings((prev) =>
        prev.map((f) =>
          f.id === findingToApprove.id
            ? { ...f, status: 'resolved' as const, afterState: data.after_state || f.afterState }
            : f
        )
      );
      setResolvedFindingIds((prev) => Array.from(new Set([...prev, findingToApprove.id])));

      const newRecord: AuditRecord = {
        id: `audit-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${Math.floor(1000 + Math.random() * 9000)}`,
        findingId: findingToApprove.id,
        scenario: 'AWS Live (STS AssumeRole)',
        action: data.action || `${findingToApprove.operation} — ${findingToApprove.title}`,
        resource: `${findingToApprove.resource?.id} (${findingToApprove.resource?.name}, ${findingToApprove.resource?.region})`,
        authorizedBy: actorEmail,
        authorizedAt: now,
        executedAt: data.timestamp || now,
        awsResponse: `200 OK — RequestId: ${data.aws_request_id}`,
        outcome: 'success',
        beforeState: data.before_state || findingToApprove.beforeState,
        afterState: data.after_state || findingToApprove.afterState,
        canonicalPayload: data.canonical_payload,
        integrityHash: data.integrity_hash
      };
      setAuditRecords((prev) => [newRecord, ...prev]);
      return;
    }

    // ── Demo Mode Execution Path ──
    const requestId = `demo-req-${Math.random().toString(36).substring(2, 8)}-${Date.now().toString(36)}`;
    const canonicalPayload = `${findingToApprove.id}|${findingToApprove.resource?.id}|${now}|${requestId}|${actorEmail}`;
    const computedHash = await computeSHA256(canonicalPayload);
    setActiveHash(computedHash);

    setFindings((prev) =>
      prev.map((f) =>
        f.id === findingToApprove.id
          ? { ...f, status: 'resolved' as const }
          : f
      )
    );
    setResolvedFindingIds((prev) => Array.from(new Set([...prev, findingToApprove.id])));

    const newRecord: AuditRecord = {
      id: `audit-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${Math.floor(1000 + Math.random() * 9000)}`,
      findingId: findingToApprove.id,
      scenario: isStudent ? 'Student ML Research Sandbox' : 'FinTech MVP Dev',
      action: `${findingToApprove.operation} — ${findingToApprove.title}`,
      resource: `${findingToApprove.resource?.id} (${findingToApprove.resource?.name}, ${findingToApprove.resource?.region})`,
      authorizedBy: actorEmail,
      authorizedAt: now,
      executedAt: new Date(Date.now() + 1500).toISOString(),
      awsResponse: `200 OK — RequestId: ${requestId}`,
      outcome: 'success',
      beforeState: findingToApprove.beforeState,
      afterState: findingToApprove.afterState,
      canonicalPayload,
      integrityHash: computedHash
    };
    setAuditRecords((prev) => [newRecord, ...prev]);
  };

  const resetDemo = () => {
    setResolvedFindingIds([]);
    setAuditRecords([]);
    setActiveHash('sha256-pending-authorization');
    setCategoryFilter('all');
    setStatusFilter('all');
    setSearchQuery('');
    setSortOption('severity');

    if (appMode === 'live') {
      setLiveFindings([]);
      setFindings([]);
      setSelectedFindingId('');
      setLiveScanStatus('idle');
      setLiveConnectionStatus('disconnected');
      setLiveErrorMessage(null);
    } else {
      if (activeScenario === 'student') {
        const data = cloneFindings(STUDENT_FINDINGS);
        setFindings(data);
        setSelectedFindingId(data[0]?.id || 'finding-student-001');
      } else {
        const data = cloneFindings(FINTECH_FINDINGS);
        setFindings(data);
        setSelectedFindingId(data[0]?.id || 'finding-001');
      }
    }
  };

  const exportAuditCSV = () => {
    const scenarioName = isStudent ? 'Student ML Research Sandbox' : 'FinTech MVP Dev';
    const recordsToExport: AuditRecord[] = auditRecords;
    if (recordsToExport.length === 0) return;

    const headers = [
      'Audit ID',
      'Scenario',
      'Finding ID',
      'AWS Action',
      'Target Resource',
      'Authorized By',
      'Authorized At',
      'Executed At',
      'AWS Response',
      'Outcome',
      'Before State',
      'After State',
      'Canonical Payload',
      'SHA-256 Integrity Hash'
    ];

    const rows = recordsToExport.map((r) => [
      `"${r.id}"`,
      `"${r.scenario}"`,
      `"${r.findingId}"`,
      `"${r.action}"`,
      `"${r.resource}"`,
      `"${r.authorizedBy}"`,
      `"${r.authorizedAt}"`,
      `"${r.executedAt}"`,
      `"${r.awsResponse}"`,
      `"${r.outcome}"`,
      `"${r.beforeState.replace(/"/g, '""')}"`,
      `"${r.afterState.replace(/"/g, '""')}"`,
      `"${r.canonicalPayload}"`,
      `"${r.integrityHash}"`
    ]);

    const csvContent = [headers.join(','), ...rows.map((row) => row.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `cloudpilot-audit-report-${appMode}-${scenarioName.toLowerCase().replace(/\s+/g, '-')}-${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  useEffect(() => {
    if (activeHash === 'sha256-pending-authorization') {
      computeSHA256(`cloudpilot-initial-ledger-${appMode}-${activeScenario}-2026`).then((h) => {
        setActiveHash(h);
      });
    }
  }, [activeHash, activeScenario, appMode]);

  return (
    <DemoContext.Provider
      value={{
        appMode,
        setAppMode,
        isBackendOnline,
        backendUrl,
        checkBackendHealth,
        scanLiveAWS,
        liveScanStatus,
        liveConnectionStatus,
        liveErrorMessage,
        lastScannedAt,
        isStaleData,
        activeScenario,
        setScenario,
        findings,
        isRemediated,
        resolvedFindingIds,
        securityScore,
        criticalCount,
        monthlyWaste,
        resolvedCount,
        auditRecords,
        activeHash,
        selectedFindingId,
        setSelectedFindingId,
        getActiveFinding,
        getFindingById,
        approveRemediation,
        resetDemo,
        exportAuditCSV,
        accountConfig,
        updateAccountConfig,
        connectAccount,
        disconnectAccount,
        categoryFilter,
        setCategoryFilter,
        statusFilter,
        setStatusFilter,
        searchQuery,
        setSearchQuery,
        sortOption,
        setSortOption
      }}
    >
      {children}
    </DemoContext.Provider>
  );
}
