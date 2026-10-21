import { createContext } from 'react';
import { type Finding, type AuditRecord } from '../data/mockData';

export type ScenarioType = 'fintech' | 'student';

export interface DemoContextType {
  activeScenario: ScenarioType;
  setScenario: (scenario: ScenarioType) => void;
  findings: Finding[];
  isRemediated: boolean;
  securityScore: number;
  criticalCount: number;
  monthlyWaste: number;
  resolvedCount: number;
  auditRecords: AuditRecord[];
  activeHash: string;
  selectedFindingId: string;
  setSelectedFindingId: (id: string) => void;
  getActiveFinding: () => Finding;
  approveRemediation: () => Promise<void>;
  resetDemo: () => void;
  exportAuditCSV: () => void;
}

export const DemoContext = createContext<DemoContextType | null>(null);
