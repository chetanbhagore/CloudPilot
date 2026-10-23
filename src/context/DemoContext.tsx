import { useState, useEffect, useCallback, type ReactNode } from 'react';
import {
  type Finding,
  type AuditRecord,
  FINTECH_FINDINGS,
  STUDENT_FINDINGS,
  mockAuditRecords
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

function getDemoFixtures(scenario: ScenarioType): Finding[] {
  const base = scenario === 'student' ? STUDENT_FINDINGS : FINTECH_FINDINGS;
  return base.map((f) => ({
    ...f,
    title: f.title.startsWith('[DEMO SIMULATION]') ? f.title : `[DEMO SIMULATION] ${f.title}`,
    executionMode: 'demo' as const,
    dataSource: 'demo_fixture' as const
  }));
}

function getDemoAccount(scenario: ScenarioType): AccountConfig {
  if (scenario === 'student') {
    return {
      accountId: '987654321098',
      alias: '[DEMO] Student ML Sandbox',
      roleName: 'CloudPilotAuditRole',
      region: 'us-east-1',
      isConnected: true,
      isConnecting: false,
      connectionError: null,
      externalId: 'cp-demo-student-ext-9876',
      isLive: false
    };
  }
  return {
    accountId: '123456789012',
    alias: '[DEMO] FinTech Core MVP',
    roleName: 'CloudPilotAuditRole',
    region: 'ap-south-1',
    isConnected: true,
    isConnecting: false,
    connectionError: null,
    externalId: 'cp-demo-fintech-ext-1234',
    isLive: false
  };
}

export function DemoProvider({ children }: { children: ReactNode }) {
  const backendUrl = import.meta.env.VITE_BACKEND_URL || (typeof window !== 'undefined' && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1' ? 'https://cloudpilot-l3ht.onrender.com' : 'http://localhost:8000');

  // App mode: defaults to 'live'. Stored in localStorage.
  const [appMode, setAppModeState] = useState<AppMode>(() => {
    try {
      if (typeof window !== 'undefined') {
        const saved = localStorage.getItem('cloudpilot_app_mode');
        if (saved === 'demo' || saved === 'live') return saved;
      }
    } catch {}
    return 'live';
  });

  const [isBackendOnline, setIsBackendOnline] = useState<boolean>(false);
  const [activeScenario, setActiveScenarioState] = useState<ScenarioType>('fintech');

  // ── Live AWS Execution State (Strictly Empty & Disconnected by Default) ──────
  const [liveFindings, setLiveFindings] = useState<Finding[]>([]);
  const [liveResolvedFindingIds, setLiveResolvedFindingIds] = useState<string[]>([]);
  const [liveAuditRecords, setLiveAuditRecords] = useState<AuditRecord[]>([]);
  const [liveSelectedFindingId, setLiveSelectedFindingId] = useState<string>('');
  const [liveScanStatus, setLiveScanStatus] = useState<LiveScanStatus>('idle');
  const [liveConnectionStatus, setLiveConnectionStatus] = useState<LiveConnectionStatus>('disconnected');
  const [liveErrorMessage, setLiveErrorMessage] = useState<string | null>(null);
  const [lastScannedAt, setLastScannedAt] = useState<string | null>(null);
  const [isStaleData, setIsStaleData] = useState<boolean>(false);

  const [liveAccountConfig, setLiveAccountConfig] = useState<AccountConfig>({
    accountId: '',
    alias: '',
    roleName: 'CloudPilotAuditRole',
    region: 'ap-south-1',
    isConnected: false,
    isConnecting: false,
    connectionError: null,
    externalId: '',
    isLive: true
  });

  // ── Demo Fixture State (Clearly Labeled Sandbox) ─────────────────────────────
  const [demoFindings, setDemoFindings] = useState<Finding[]>(() => getDemoFixtures('fintech'));
  const [demoResolvedFindingIds, setDemoResolvedFindingIds] = useState<string[]>(['finding-001']);
  const [demoAuditRecords, setDemoAuditRecords] = useState<AuditRecord[]>(() =>
    mockAuditRecords.map((r) => ({
      ...r,
      scenario: `[DEMO SIMULATION] ${r.scenario}`,
      awsResponse: `SIMULATED 200 OK (${r.awsResponse})`
    }))
  );
  const [demoAccountConfig, setDemoAccountConfig] = useState<AccountConfig>(() => getDemoAccount('fintech'));
  const [demoSelectedFindingId, setDemoSelectedFindingId] = useState<string>('finding-001');

  // Ledger hash representation
  const [activeHash, setActiveHash] = useState<string>('sha256-genesis-ledger');

  // Discover search & filter state
  const [categoryFilter, setCategoryFilter] = useState<FilterCategory>('all');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [sortOption, setSortOption] = useState<SortOption>('severity');

  // Check backend health periodically
  const checkBackendHealth = useCallback(async (): Promise<boolean> => {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 12000);
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

  // Sync real state from FastAPI backend for Live Mode
  const syncFromBackend = useCallback(async () => {
    try {
      const token = typeof window !== 'undefined' ? localStorage.getItem('cloudpilot_jwt_token') : null;
      const headers: Record<string, string> = {};
      if (token && token !== 'undefined') {
        headers['Authorization'] = `Bearer ${token}`;
      }

      // 1. Fetch connected live AWS accounts for this authenticated tenant
      const accRes = await fetch(`${backendUrl}/accounts?mode=live`, { headers });
      if (accRes.ok) {
        const accounts = await accRes.json();
        if (Array.isArray(accounts) && accounts.length > 0) {
          const acc = accounts[0];
          setLiveAccountConfig((prev) => ({
            ...prev,
            accountId: acc.account_id,
            alias: acc.alias || `AWS Live (${acc.region})`,
            roleName: acc.role_arn ? acc.role_arn.split('/').pop() || 'CloudPilotAuditRole' : 'CloudPilotAuditRole',
            region: acc.region || 'ap-south-1',
            externalId: acc.external_id || prev.externalId,
            isConnected: true,
            isLive: true,
            connectionError: null
          }));
          setLiveConnectionStatus('connected');
        } else {
          setLiveConnectionStatus('disconnected');
        }
      }

      // 2. Fetch live findings from database for this authenticated tenant
      const findRes = await fetch(`${backendUrl}/findings?mode=live`, { headers });
      if (findRes.ok) {
        const data = await findRes.json();
        if (Array.isArray(data)) {
          setLiveFindings(data);
          if (data.length > 0) {
            setLiveSelectedFindingId(data[0].id);
            setLiveScanStatus('completed');
          } else {
            setLiveScanStatus('empty');
          }
        }
      }

      // 3. Fetch real live audit records for this authenticated tenant
      const auditRes = await fetch(`${backendUrl}/audit/events?mode=live`, { headers });
      if (auditRes.ok) {
        const auditData = await auditRes.json();
        if (Array.isArray(auditData) && auditData.length > 0) {
          const mapped: AuditRecord[] = auditData.map((e: any) => ({
            id: e.id,
            findingId: e.finding_id,
            scenario: `AWS Account ${e.account_id || ''} (${e.region || 'ap-south-1'})`,
            action: e.action,
            resource: e.resource_id,
            authorizedBy: e.actor_email,
            authorizedAt: e.timestamp,
            executedAt: e.timestamp,
            awsResponse: e.aws_request_id && e.aws_request_id !== 'none'
              ? `200 OK — RequestId: ${e.aws_request_id}`
              : e.outcome,
            outcome: (e.outcome === 'succeeded' || e.outcome === 'success') ? ('success' as const) : ('failed' as const),
            beforeState: 'Pre-flight verified',
            afterState: `Verification: ${e.verification_status || e.outcome}`,
            canonicalPayload: e.canonical_payload,
            integrityHash: e.integrity_hash
          }));
          setLiveAuditRecords(mapped);
          if (mapped[0]?.integrityHash) {
            setActiveHash(mapped[0].integrityHash);
          }
        }
      }

      // 4. Pre-fill cryptographic External ID if empty
      const extRes = await fetch(`${backendUrl}/accounts/external-id`, { headers });
      if (extRes.ok) {
        const extData = await extRes.json();
        if (extData.external_id) {
          setLiveAccountConfig((prev) => {
            if (!prev.externalId) {
              return { ...prev, externalId: extData.external_id };
            }
            return prev;
          });
        }
      }
    } catch {
      // Backend offline
    }
  }, [backendUrl]);

  useEffect(() => {
    checkBackendHealth().then((online) => {
      if (online && appMode === 'live') {
        syncFromBackend();
      }
    });

    const interval = setInterval(() => {
      checkBackendHealth();
    }, 15000);
    return () => clearInterval(interval);
  }, [checkBackendHealth, syncFromBackend, appMode]);

  // Mode Switcher: Clean boundary, never leaks demo into live or vice-versa
  const setAppMode = (mode: AppMode) => {
    setAppModeState(mode);
    try {
      if (typeof window !== 'undefined') {
        localStorage.setItem('cloudpilot_app_mode', mode);
      }
    } catch {}

    if (mode === 'live') {
      checkBackendHealth().then((online) => {
        if (online) syncFromBackend();
      });
    }
  };

  const setScenario = (scenario: ScenarioType) => {
    setActiveScenarioState(scenario);
    if (appMode === 'demo') {
      const fixtures = getDemoFixtures(scenario);
      setDemoFindings(fixtures);
      setDemoAccountConfig(getDemoAccount(scenario));
      if (fixtures.length > 0) {
        setDemoSelectedFindingId(fixtures[0].id);
      }
    }
  };

  const updateAccountConfig = (cfg: Partial<AccountConfig>) => {
    if (appMode === 'live') {
      setLiveAccountConfig((prev) => ({ ...prev, ...cfg }));
    } else {
      setDemoAccountConfig((prev) => ({ ...prev, ...cfg }));
    }
  };

  // Connect AWS Account: Real STS AssumeRole in live mode
  const connectAccount = async (_custom = false): Promise<{ success: boolean; error?: string }> => {
    if (appMode === 'demo') {
      setDemoAccountConfig((prev) => ({ ...prev, isConnected: true, isConnecting: false, connectionError: null }));
      return { success: true };
    }

    setLiveAccountConfig((prev) => ({ ...prev, isConnecting: true, connectionError: null }));
    setLiveErrorMessage(null);

    const isAzure = liveAccountConfig.cloudProvider === 'azure';

    if (isAzure) {
      const subId = (liveAccountConfig.azureSubscriptionId || liveAccountConfig.accountId || '').trim();
      if (!subId || !liveAccountConfig.azureTenantId || !liveAccountConfig.azureClientId || !liveAccountConfig.azureClientSecret) {
        const err = 'Azure connection requires Subscription ID, Tenant ID, Client ID, and Client Secret.';
        setLiveAccountConfig((prev) => ({ ...prev, isConnecting: false, connectionError: err, isConnected: false }));
        setLiveConnectionStatus('failed');
        return { success: false, error: err };
      }
    } else {
      const sanitizedId = liveAccountConfig.accountId.replace(/\D/g, '');
      if (sanitizedId.length !== 12) {
        const err = 'AWS Account ID must be exactly 12 numeric digits (e.g. 123456789012).';
        setLiveAccountConfig((prev) => ({ ...prev, isConnecting: false, connectionError: err, isConnected: false }));
        setLiveConnectionStatus('failed');
        return { success: false, error: err };
      }

      if (!liveAccountConfig.roleName.trim()) {
        const err = 'IAM Role name is required (e.g. CloudPilotAuditRole).';
        setLiveAccountConfig((prev) => ({ ...prev, isConnecting: false, connectionError: err, isConnected: false }));
        setLiveConnectionStatus('failed');
        return { success: false, error: err };
      }
    }

    setLiveConnectionStatus('connecting');

    if (!isBackendOnline) {
      const err = `CloudPilot backend service is unreachable at ${backendUrl}. Ensure the backend server is running.`;
      setLiveAccountConfig((prev) => ({ ...prev, isConnecting: false, connectionError: err, isConnected: false }));
      setLiveConnectionStatus('failed');
      setLiveErrorMessage(err);
      return { success: false, error: err };
    }

    try {
      const token = typeof window !== 'undefined' ? localStorage.getItem('cloudpilot_jwt_token') : null;
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const sanitizedId = isAzure
        ? (liveAccountConfig.azureSubscriptionId || liveAccountConfig.accountId || '').trim()
        : liveAccountConfig.accountId.replace(/\D/g, '');

      const requestPayload = isAzure
        ? {
            account_id: sanitizedId,
            cloud_provider: 'azure',
            region: liveAccountConfig.region || 'eastus',
            mode: 'live',
            azure_tenant_id: liveAccountConfig.azureTenantId,
            azure_client_id: liveAccountConfig.azureClientId,
            azure_client_secret: liveAccountConfig.azureClientSecret,
            azure_subscription_id: sanitizedId
          }
        : {
            account_id: sanitizedId,
            role_arn: `arn:aws:iam::${sanitizedId}:role/${liveAccountConfig.roleName}`,
            external_id: liveAccountConfig.externalId || `cp-tenant-${sanitizedId.slice(-4)}`,
            region: liveAccountConfig.region,
            mode: 'live',
            cloud_provider: 'aws',
            connection_type: liveAccountConfig.connectionType || (sanitizedId === '000000000000' ? 'localstack' : 'role_arn'),
            endpoint_url: liveAccountConfig.endpointUrl
          };

      const res = await fetch(`${backendUrl}/accounts/connect`, {
        method: 'POST',
        headers,
        body: JSON.stringify(requestPayload)
      });

      if (res.ok) {
        const data = await res.json();
        setLiveAccountConfig((prev) => ({
          ...prev,
          accountId: sanitizedId,
          alias: data.alias || (isAzure ? `Azure Subscription (${sanitizedId.slice(0, 8)}...)` : `AWS Account ${sanitizedId.slice(0, 4)}... (${prev.region})`),
          isConnecting: false,
          isConnected: true,
          connectionError: null,
          isLive: true
        }));
        setLiveConnectionStatus('connected');

        // Automatically trigger genuine live discovery scan upon verified connection
        setTimeout(() => {
          scanLiveAWS();
        }, 500);

        return { success: true };
      } else {
        const errorData = await res.json().catch(() => ({ detail: 'AWS STS AssumeRole handshake failed.' }));
        const errMsg = errorData.detail || `AWS Connection failed with status ${res.status}.`;
        setLiveAccountConfig((prev) => ({
          ...prev,
          isConnecting: false,
          connectionError: errMsg,
          isConnected: false
        }));
        setLiveConnectionStatus('failed');
        setLiveErrorMessage(errMsg);
        return { success: false, error: errMsg };
      }
    } catch (err) {
      const errMsg = `Network error connecting to CloudPilot backend: ${err instanceof Error ? err.message : String(err)}`;
      setLiveAccountConfig((prev) => ({
        ...prev,
        isConnecting: false,
        connectionError: errMsg,
        isConnected: false
      }));
      setLiveConnectionStatus('failed');
      setLiveErrorMessage(errMsg);
      return { success: false, error: errMsg };
    }
  };

  // Scan Live AWS: Queries real AWS via backend. Never fabricates findings.
  const scanLiveAWS = async (): Promise<{ success: boolean; count?: number; error?: string }> => {
    if (appMode === 'demo') {
      const fixtures = getDemoFixtures(activeScenario);
      setDemoFindings(fixtures);
      return { success: true, count: fixtures.length };
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
      const isAzure = liveAccountConfig.cloudProvider === 'azure';
      const sanitizedId = isAzure
        ? (liveAccountConfig.azureSubscriptionId || liveAccountConfig.accountId || '').trim()
        : liveAccountConfig.accountId.replace(/\D/g, '');
      const token = typeof window !== 'undefined' ? localStorage.getItem('cloudpilot_jwt_token') : null;
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const res = await fetch(`${backendUrl}/discovery/scan`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          account_id: sanitizedId,
          region: liveAccountConfig.region || (isAzure ? 'eastus' : 'ap-south-1'),
          cloud_provider: isAzure ? 'azure' : 'aws',
          mode: 'live'
        })
      });

      if (res.ok) {
        const data = await res.json();
        const discovered: Finding[] = data.findings || [];
        setLiveFindings(discovered);
        setLastScannedAt(data.scanned_at || new Date().toISOString());
        setIsStaleData(false);

        if (discovered.length === 0) {
          setLiveScanStatus('empty');
          setLiveSelectedFindingId('');
          return { success: true, count: 0 };
        }

        setLiveScanStatus('completed');
        setLiveSelectedFindingId(discovered[0].id);
        return { success: true, count: discovered.length };
      } else {
        const errorData = await res.json().catch(() => ({ detail: 'Live scan request rejected by backend.' }));
        const errMsg = errorData.detail || `Scan failed with HTTP ${res.status}`;
        setLiveScanStatus('failed');
        setLiveErrorMessage(errMsg);
        return { success: false, error: errMsg };
      }
    } catch (err) {
      const errMsg = `Scan failed: ${err instanceof Error ? err.message : String(err)}`;
      setLiveScanStatus('failed');
      setLiveErrorMessage(errMsg);
      return { success: false, error: errMsg };
    }
  };

  const disconnectAccount = async () => {
    if (appMode === 'live') {
      if (liveAccountConfig.accountId) {
        try {
          const token = typeof window !== 'undefined' ? localStorage.getItem('cloudpilot_jwt_token') : null;
          const headers: Record<string, string> = {};
          if (token) headers['Authorization'] = `Bearer ${token}`;
          await fetch(`${backendUrl}/accounts/${liveAccountConfig.accountId}?mode=live`, {
            method: 'DELETE',
            headers
          });
        } catch {}
      }
      setLiveAccountConfig({
        accountId: '',
        alias: '',
        roleName: 'CloudPilotAuditRole',
        region: 'ap-south-1',
        isConnected: false,
        isConnecting: false,
        connectionError: null,
        externalId: '',
        isLive: true
      });
      setLiveConnectionStatus('disconnected');
      setLiveFindings([]);
      setLiveSelectedFindingId('');
      setLiveScanStatus('idle');
    } else {
      setDemoAccountConfig((prev) => ({ ...prev, isConnected: false }));
      setDemoFindings([]);
      setDemoSelectedFindingId('');
    }
  };

  // Active findings and configs resolved strictly by appMode
  const findings: Finding[] = appMode === 'live' ? liveFindings : demoFindings;
  const accountConfig: AccountConfig = appMode === 'live' ? liveAccountConfig : demoAccountConfig;
  const auditRecords: AuditRecord[] = appMode === 'live' ? liveAuditRecords : demoAuditRecords;
  const resolvedFindingIds: string[] = appMode === 'live' ? liveResolvedFindingIds : demoResolvedFindingIds;
  const selectedFindingId: string = appMode === 'live' ? liveSelectedFindingId : demoSelectedFindingId;

  const setSelectedFindingId = (id: string) => {
    if (appMode === 'live') {
      setLiveSelectedFindingId(id);
    } else {
      setDemoSelectedFindingId(id);
    }
  };

  // Dynamic Metrics derived strictly from real state
  const resolvedCount = resolvedFindingIds.length;
  const isRemediated = resolvedCount > 0;
  const openFindings = findings.filter((f) => f.status === 'open' || f.status === 'blocked');
  const criticalCount = openFindings.filter((f) => f.severity === 'critical').length;
  const highCount = openFindings.filter((f) => f.severity === 'high').length;
  const mediumCount = openFindings.filter((f) => f.severity === 'medium').length;

  const monthlyWaste = openFindings
    .filter((f) => f.category === 'cost' && f.estimatedMonthlyCost)
    .reduce((sum, f) => sum + (f.estimatedMonthlyCost || 0), 0);

  let securityScore = 100;
  if (findings.length > 0) {
    const penalty = criticalCount * 25 + highCount * 15 + mediumCount * 5;
    const boost = resolvedCount * 20;
    securityScore = Math.max(20, Math.min(100, 100 - penalty + boost));
  }

  const getActiveFinding = (): Finding | null => {
    if (findings.length === 0) return null;
    return findings.find((f) => f.id === selectedFindingId) || findings[0] || null;
  };

  const getFindingById = (id: string): Finding | undefined => {
    return findings.find((f) => f.id === id);
  };

  // Approve action: dispatches to real remediation engine on FastAPI backend
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

    // Demo Mode Simulated Approval
    if (appMode === 'demo') {
      setDemoFindings((prev) =>
        prev.map((f) =>
          f.id === findingToApprove.id
            ? { ...f, status: 'resolved' as const }
            : f
        )
      );
      setDemoResolvedFindingIds((prev) => Array.from(new Set([...prev, findingToApprove.id])));
      const now = new Date().toISOString();
      const simRecord: AuditRecord = {
        id: `demo-aud-${Date.now()}`,
        findingId: findingToApprove.id,
        scenario: `[DEMO SIMULATION] ${accountConfig.alias}`,
        action: `${findingToApprove.operation} — ${findingToApprove.title}`,
        resource: `${findingToApprove.resource?.id} (${findingToApprove.resource?.name})`,
        authorizedBy: 'demo-user@cloudpilot.io',
        authorizedAt: now,
        executedAt: now,
        awsResponse: 'SIMULATED 200 OK — RequestId: demo-simulated-req-001',
        outcome: 'success',
        beforeState: findingToApprove.beforeState,
        afterState: findingToApprove.afterState,
        canonicalPayload: `DEMO|${findingToApprove.id}|${now}`,
        integrityHash: 'demo-sha256-receipt'
      };
      setDemoAuditRecords((prev) => [simRecord, ...prev]);
      return;
    }

    // Live Mode: Genuine Server-Side Execution with Independent Verification
    if (!isBackendOnline) {
      throw new Error('CloudPilot backend service is unreachable. Live remediation cannot be executed.');
    }

    const token = typeof window !== 'undefined' ? localStorage.getItem('cloudpilot_jwt_token') : null;
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const res = await fetch(`${backendUrl}/findings/${findingToApprove.id}/approve`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        finding_id: findingToApprove.id,
        mode: 'live'
      })
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.success || data.outcome !== 'success') {
      const errorDetail = data.error_details || data.detail || 'Remediation failed or state verification rejected by AWS.';
      throw new Error(`Live remediation failed: ${errorDetail}`);
    }

    if (data.integrity_hash) {
      setActiveHash(data.integrity_hash);
    }

    setLiveFindings((prev) =>
      prev.map((f) =>
        f.id === findingToApprove.id
          ? { ...f, status: 'resolved' as const, afterState: data.after_state || f.afterState }
          : f
      )
    );
    setLiveResolvedFindingIds((prev) => Array.from(new Set([...prev, findingToApprove.id])));

    const now = new Date().toISOString();
    const newRecord: AuditRecord = {
      id: data.execution_id || `audit-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${Math.floor(1000 + Math.random() * 9000)}`,
      findingId: findingToApprove.id,
      scenario: `AWS Live (${accountConfig.region})`,
      action: data.action || `${findingToApprove.operation} — ${findingToApprove.title}`,
      resource: `${findingToApprove.resource?.id} (${findingToApprove.resource?.name}, ${findingToApprove.resource?.region})`,
      authorizedBy: data.authorized_by || 'Verified Caller',
      authorizedAt: now,
      executedAt: data.timestamp || now,
      awsResponse: `200 OK — RequestId: ${data.aws_request_id || 'none'}`,
      outcome: 'success',
      beforeState: data.before_state || findingToApprove.beforeState,
      afterState: data.after_state || findingToApprove.afterState,
      canonicalPayload: data.canonical_payload || `${findingToApprove.id}|${now}`,
      integrityHash: data.integrity_hash || activeHash
    };
    setLiveAuditRecords((prev) => [newRecord, ...prev]);
  };

  const resetDemo = () => {
    setCategoryFilter('all');
    setStatusFilter('all');
    setSearchQuery('');
    setSortOption('severity');
    if (appMode === 'demo') {
      setDemoFindings(getDemoFixtures(activeScenario));
      setDemoResolvedFindingIds([]);
    } else {
      syncFromBackend();
    }
  };

  const exportAuditCSV = () => {
    const recordsToExport: AuditRecord[] = auditRecords;
    if (recordsToExport.length === 0) return;

    const headers = [
      'Audit ID',
      'Environment',
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
      `"${(r.beforeState || '').replace(/"/g, '""')}"`,
      `"${(r.afterState || '').replace(/"/g, '""')}"`,
      `"${r.canonicalPayload}"`,
      `"${r.integrityHash}"`
    ]);

    const csvContent = [headers.join(','), ...rows.map((row) => row.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `cloudpilot-${appMode}-audit-report-${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

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
