import { useState, useEffect, type ReactNode } from 'react';
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
  type ScenarioType,
  type AccountConfig,
  type FilterCategory,
  type StatusFilter,
  type SortOption
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
  const [activeScenario, setActiveScenarioState] = useState<ScenarioType>('fintech');
  const [findings, setFindings] = useState<Finding[]>(() => cloneFindings(FINTECH_FINDINGS));
  const [resolvedFindingIds, setResolvedFindingIds] = useState<string[]>([]);
  const [auditRecords, setAuditRecords] = useState<AuditRecord[]>([]);
  const [activeHash, setActiveHash] = useState<string>('sha256-pending-authorization');
  const [selectedFindingId, setSelectedFindingId] = useState<string>('finding-001');

  // Account configuration & simulation onboarding
  const [accountConfig, setAccountConfig] = useState<AccountConfig>({
    accountId: FINTECH_ACCOUNT.accountId,
    alias: FINTECH_ACCOUNT.alias,
    roleName: 'CloudPilotAuditRole',
    region: FINTECH_ACCOUNT.region,
    isConnected: true,
    isConnecting: false,
    connectionError: null
  });

  // Search & filter state
  const [categoryFilter, setCategoryFilter] = useState<FilterCategory>('all');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [sortOption, setSortOption] = useState<SortOption>('severity');

  // Switch scenario datasets cleanly
  const setScenario = (scenario: ScenarioType) => {
    setActiveScenarioState(scenario);
    setResolvedFindingIds([]);
    setAuditRecords([]);
    setActiveHash('sha256-pending-authorization');

    if (scenario === 'student') {
      setFindings(cloneFindings(STUDENT_FINDINGS));
      setSelectedFindingId('finding-student-001');
      setAccountConfig({
        accountId: STUDENT_ACCOUNT.accountId,
        alias: STUDENT_ACCOUNT.alias,
        roleName: 'CloudPilotAuditRole',
        region: STUDENT_ACCOUNT.region,
        isConnected: true,
        isConnecting: false,
        connectionError: null
      });
    } else {
      setFindings(cloneFindings(FINTECH_FINDINGS));
      setSelectedFindingId('finding-001');
      setAccountConfig({
        accountId: FINTECH_ACCOUNT.accountId,
        alias: FINTECH_ACCOUNT.alias,
        roleName: 'CloudPilotAuditRole',
        region: FINTECH_ACCOUNT.region,
        isConnected: true,
        isConnecting: false,
        connectionError: null
      });
    }
  };

  const updateAccountConfig = (cfg: Partial<AccountConfig>) => {
    setAccountConfig((prev) => ({ ...prev, ...cfg }));
  };

  const connectAccount = async (custom = false): Promise<{ success: boolean; error?: string }> => {
    updateAccountConfig({ isConnecting: true, connectionError: null });

    // Validate account ID
    const sanitizedId = accountConfig.accountId.replace(/\D/g, '');
    if (sanitizedId.length !== 12) {
      const err = 'AWS Account ID must be exactly 12 numeric digits (e.g. 123456789012).';
      updateAccountConfig({ isConnecting: false, connectionError: err, isConnected: false });
      return { success: false, error: err };
    }

    if (!accountConfig.roleName.trim()) {
      const err = 'IAM Role name is required (e.g. CloudPilotAuditRole).';
      updateAccountConfig({ isConnecting: false, connectionError: err, isConnected: false });
      return { success: false, error: err };
    }

    // Simulate STS AssumeRole network handshake
    await new Promise((resolve) => setTimeout(resolve, 1400));

    updateAccountConfig({
      accountId: sanitizedId,
      alias: custom ? `${accountConfig.alias || 'Custom AWS Account'}` : accountConfig.alias,
      isConnecting: false,
      isConnected: true,
      connectionError: null
    });

    return { success: true };
  };

  const disconnectAccount = () => {
    updateAccountConfig({ isConnected: false });
  };

  // ─── Dynamic Metrics derived from active state ──────────────────────────────
  const isStudent = activeScenario === 'student';
  const isRemediated = resolvedFindingIds.length > 0;
  const resolvedCount = resolvedFindingIds.length;

  const openFindings = findings.filter((f) => f.status === 'open' || f.status === 'blocked');
  const criticalCount = findings.filter((f) => f.severity === 'critical' && f.status === 'open').length;

  // Monthly waste: sum of open cost findings
  const monthlyWaste = openFindings
    .filter((f) => f.category === 'cost' && f.estimatedMonthlyCost)
    .reduce((sum, f) => sum + (f.estimatedMonthlyCost || 0), 0);

  // Security score: dynamic jump based on resolved high/critical issues
  const baseScore = isStudent ? 42 : 34;
  const scoreBoost = resolvedFindingIds.reduce((boost, id) => {
    if (id === 'finding-001') return boost + 38;
    if (id === 'finding-002') return boost + 8;
    if (id === 'finding-003') return boost + 6;
    if (id === 'finding-student-001') return boost + 46;
    if (id === 'finding-student-002') return boost + 35;
    if (id === 'finding-student-003') return boost + 12;
    return boost + 10;
  }, 0);
  const securityScore = Math.min(98, baseScore + scoreBoost);

  const getActiveFinding = (): Finding => {
    return findings.find((f) => f.id === selectedFindingId) || findings[0];
  };

  const getFindingById = (id: string): Finding | undefined => {
    return findings.find((f) => f.id === id);
  };

  // Approve action: actively updates finding status, computes genuine SHA-256 hash, creates audit record
  const approveRemediation = async (targetId?: string) => {
    const findingToApprove = targetId
      ? findings.find((f) => f.id === targetId) || getActiveFinding()
      : getActiveFinding();

    if (findingToApprove.isSafetyBlocked) {
      throw new Error(`Cannot authorize: ${findingToApprove.blockedReason || 'Blocked by safety check'}`);
    }

    const now = new Date().toISOString();
    const requestId = `req-aws-${Math.random().toString(36).substring(2, 8)}-${Date.now().toString(36)}`;

    // Canonical representation for data integrity verification
    const canonicalPayload = `${findingToApprove.id}|${findingToApprove.resource.id}|${now}|${requestId}|chetan@cloudpilot.io`;
    const computedHash = await computeSHA256(canonicalPayload);
    setActiveHash(computedHash);

    // Update findings array to resolved
    setFindings((prev) =>
      prev.map((f) =>
        f.id === findingToApprove.id
          ? { ...f, status: 'resolved' as const }
          : f
      )
    );

    setResolvedFindingIds((prev) => Array.from(new Set([...prev, findingToApprove.id])));

    // Create real audit record
    const newRecord: AuditRecord = {
      id: `audit-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${Math.floor(1000 + Math.random() * 9000)}`,
      findingId: findingToApprove.id,
      scenario: isStudent ? 'Student ML Research Sandbox' : 'FinTech MVP Dev',
      action: `${findingToApprove.operation} — ${findingToApprove.title}`,
      resource: `${findingToApprove.resource.id} (${findingToApprove.resource.name}, ${findingToApprove.resource.region})`,
      authorizedBy: 'chetan@cloudpilot.io',
      authorizedAt: now,
      executedAt: new Date(Date.now() + 3200).toISOString(),
      awsResponse: `200 OK — RequestId: ${requestId}`,
      outcome: 'success',
      beforeState: findingToApprove.beforeState,
      afterState: findingToApprove.afterState,
      canonicalPayload,
      integrityHash: computedHash
    };

    setAuditRecords((prev) => [newRecord, ...prev]);
  };

  // Full demo reset back to original state
  const resetDemo = () => {
    setResolvedFindingIds([]);
    setAuditRecords([]);
    setActiveHash('sha256-pending-authorization');
    setCategoryFilter('all');
    setStatusFilter('all');
    setSearchQuery('');
    setSortOption('severity');

    if (activeScenario === 'student') {
      setFindings(cloneFindings(STUDENT_FINDINGS));
      setSelectedFindingId('finding-student-001');
      setAccountConfig({
        accountId: STUDENT_ACCOUNT.accountId,
        alias: STUDENT_ACCOUNT.alias,
        roleName: 'CloudPilotAuditRole',
        region: STUDENT_ACCOUNT.region,
        isConnected: true,
        isConnecting: false,
        connectionError: null
      });
    } else {
      setFindings(cloneFindings(FINTECH_FINDINGS));
      setSelectedFindingId('finding-001');
      setAccountConfig({
        accountId: FINTECH_ACCOUNT.accountId,
        alias: FINTECH_ACCOUNT.alias,
        roleName: 'CloudPilotAuditRole',
        region: FINTECH_ACCOUNT.region,
        isConnected: true,
        isConnecting: false,
        connectionError: null
      });
    }
  };

  // Genuine CSV Exporter (downloads real file via Blob)
  const exportAuditCSV = () => {
    const scenarioName = isStudent ? 'Student ML Research Sandbox' : 'FinTech MVP Dev';
    const recordsToExport: AuditRecord[] = auditRecords.length > 0 ? auditRecords : [
      {
        id: 'audit-demo-initial',
        findingId: 'finding-001',
        scenario: scenarioName,
        action: 'ec2:RevokeSecurityGroupIngress — TCP:22 from 0.0.0.0/0',
        resource: 'sg-0a1b2c3d4e5f (launch-wizard-1, ap-south-1)',
        authorizedBy: 'chetan@cloudpilot.io',
        authorizedAt: new Date().toISOString(),
        executedAt: new Date().toISOString(),
        awsResponse: '200 OK — RequestId: req-aws-9042b-fintech-mumbai',
        outcome: 'success',
        beforeState: 'TCP:22 from 0.0.0.0/0: PRESENT',
        afterState: 'TCP:22 from 0.0.0.0/0: REMOVED (verified)',
        canonicalPayload: 'finding-001|sg-0a1b2c3d4e5f|initial-seed|chetan@cloudpilot.io',
        integrityHash: activeHash
      }
    ];

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
    link.setAttribute('download', `cloudpilot-audit-report-${activeScenario}-${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Generate initial seed hash
  useEffect(() => {
    if (activeHash === 'sha256-pending-authorization') {
      computeSHA256(`cloudpilot-initial-ledger-${activeScenario}-2026`).then((h) => {
        setActiveHash(h);
      });
    }
  }, [activeHash, activeScenario]);

  return (
    <DemoContext.Provider
      value={{
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
