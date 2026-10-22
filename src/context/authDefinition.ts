import { createContext } from 'react';

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  role: 'Owner' | 'Admin' | 'DevOps Lead' | 'DevOpsLead' | 'Security Analyst' | 'SecurityAnalyst' | 'Viewer';
  organization: string;
  organizationSlug: string;
  avatar: string;
  plan: 'Startup Pro' | 'Enterprise Scale' | 'Starter';
  mfaEnabled: boolean;
  joinedDate: string;
  activeAwsAccounts: number;
  maxAwsAccounts: number;
  permissions?: string[];
  token?: string;
  isServerVerified?: boolean;
}

export interface TeamMember {
  id: string;
  name: string;
  email: string;
  role: 'Owner' | 'Admin' | 'DevOps Lead' | 'Security Analyst' | 'Viewer';
  avatar: string;
  status: 'active' | 'invited';
  lastActive: string;
}

export interface CloudNotification {
  id: string;
  title: string;
  message: string;
  severity: 'critical' | 'warning' | 'info';
  timestamp: string;
  read: boolean;
  findingId?: string;
  accountId: string;
}

export interface AuthContextType {
  user: UserProfile;
  teamMembers: TeamMember[];
  notifications: CloudNotification[];
  unreadCount: number;
  isAuthenticated: boolean;
  login: (email: string, password?: string) => Promise<boolean> | boolean;
  logout: () => void;
  markNotificationRead: (id: string) => void;
  markAllNotificationsRead: () => void;
  updateUser: (updates: Partial<UserProfile>) => void;
  inviteTeamMember: (email: string, role: TeamMember['role']) => void;
}

export const AuthContext = createContext<AuthContextType | null>(null);
