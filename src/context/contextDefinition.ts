import { createContext } from 'react';
import { type Finding, type AuditRecord } from '../data/mockData';

export type ScenarioType = 'fintech' | 'student';
export type FilterCategory = 'all' | 'security' | 'cost';
export type StatusFilter = 'all' | 'open' | 'resolved' | 'blocked';
export type SortOption = 'severity' | 'savings' | 'newest';

export interface AccountConfig {
  accountId: string;
  alias: string;
  roleName: string;
  region: string;
  isConnected: boolean;
  isConnecting: boolean;
  connectionError: string | null;
}

export interface DemoContextType {
  activeScenario: ScenarioType;
  setScenario: (scenario: ScenarioType) => void;
  findings: Finding[];
  isRemediated: boolean; // true if any finding has been remediated in this session
  resolvedFindingIds: string[];
  securityScore: number;
  criticalCount: number;
  monthlyWaste: number;
  resolvedCount: number;
  auditRecords: AuditRecord[];
  activeHash: string;
  selectedFindingId: string;
  setSelectedFindingId: (id: string) => void;
  getActiveFinding: () => Finding;
  getFindingById: (id: string) => Finding | undefined;
  approveRemediation: (findingId?: string) => Promise<void>;
  resetDemo: () => void;
  exportAuditCSV: () => void;
  
  // Account onboarding & simulation connection
  accountConfig: AccountConfig;
  updateAccountConfig: (cfg: Partial<AccountConfig>) => void;
  connectAccount: (custom?: boolean) => Promise<{ success: boolean; error?: string }>;
  disconnectAccount: () => void;

  // Search & Filter state for Discover
  categoryFilter: FilterCategory;
  setCategoryFilter: (cat: FilterCategory) => void;
  statusFilter: StatusFilter;
  setStatusFilter: (status: StatusFilter) => void;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  sortOption: SortOption;
  setSortOption: (sort: SortOption) => void;
}

export const DemoContext = createContext<DemoContextType | null>(null);
