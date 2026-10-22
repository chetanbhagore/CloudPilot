import { useState, type ReactNode } from 'react';
import {
  AuthContext,
  type UserProfile,
  type TeamMember,
  type CloudNotification
} from './authDefinition';

const DEFAULT_USER: UserProfile = {
  id: 'usr_cp_883921',
  name: 'Chetan Bhagore',
  email: 'chetan@cloudpilot.io',
  role: 'Owner',
  organization: 'Acme Cloud Technologies',
  organizationSlug: 'acme-cloud',
  avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
  plan: 'Startup Pro',
  mfaEnabled: true,
  joinedDate: 'Jan 2026',
  activeAwsAccounts: 2,
  maxAwsAccounts: 10
};

const INITIAL_TEAM: TeamMember[] = [
  {
    id: 'tm_1',
    name: 'Chetan Bhagore',
    email: 'chetan@cloudpilot.io',
    role: 'Owner',
    avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
    status: 'active',
    lastActive: 'Just now'
  },
  {
    id: 'tm_2',
    name: 'Sarah Jenkins',
    email: 'sarah.j@acmecloud.io',
    role: 'DevOps Lead',
    avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&auto=format&fit=crop&q=80',
    status: 'active',
    lastActive: '14m ago'
  },
  {
    id: 'tm_3',
    name: 'Alex Rivera',
    email: 'alex.r@acmecloud.io',
    role: 'Security Analyst',
    avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80',
    status: 'active',
    lastActive: '2h ago'
  },
  {
    id: 'tm_4',
    name: 'Priya Sharma',
    email: 'priya.s@acmecloud.io',
    role: 'Admin',
    avatar: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=150&auto=format&fit=crop&q=80',
    status: 'invited',
    lastActive: 'Invited 1d ago'
  }
];

const INITIAL_NOTIFICATIONS: CloudNotification[] = [
  {
    id: 'notif_1',
    title: 'Critical Security Exposure',
    message: 'Port 22 SSH ingress open to 0.0.0.0/0 on production security group sg-0a81b2c3d4e5f6789.',
    severity: 'critical',
    timestamp: '2m ago',
    read: false,
    findingId: 'SEC-001',
    accountId: '8392-1049-2819'
  },
  {
    id: 'notif_2',
    title: 'Idle Resource Spend Alert',
    message: '500 GiB gp3 EBS volume has had 0 IOPS for 23 consecutive days (~$40.00/mo waste).',
    severity: 'warning',
    timestamp: '1h ago',
    read: false,
    findingId: 'COST-002',
    accountId: '8392-1049-2819'
  },
  {
    id: 'notif_3',
    title: 'Audit Ledger Receipt Generated',
    message: 'Cryptographic SHA-256 receipt verified for remediation operation on Mumbai cluster.',
    severity: 'info',
    timestamp: 'Yesterday',
    read: true,
    accountId: '8392-1049-2819'
  }
];

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserProfile>(() => {
    const saved = localStorage.getItem('cloudpilot_user');
    return saved ? JSON.parse(saved) : DEFAULT_USER;
  });

  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => {
    const savedAuth = localStorage.getItem('cloudpilot_authenticated');
    return savedAuth !== null ? JSON.parse(savedAuth) : true;
  });

  const [teamMembers, setTeamMembers] = useState<TeamMember[]>(INITIAL_TEAM);
  const [notifications, setNotifications] = useState<CloudNotification[]>(INITIAL_NOTIFICATIONS);

  const unreadCount = notifications.filter(n => !n.read).length;

  const login = (email: string, _password?: string) => {
    setIsAuthenticated(true);
    localStorage.setItem('cloudpilot_authenticated', JSON.stringify(true));
    if (email && email.includes('@')) {
      const updatedUser: UserProfile = {
        ...user,
        email,
        name: email.split('@')[0].replace(/[._]/g, ' ').replace(/\b\w/g, l => l.toUpperCase())
      };
      setUser(updatedUser);
      localStorage.setItem('cloudpilot_user', JSON.stringify(updatedUser));
    }
    return true;
  };

  const logout = () => {
    setIsAuthenticated(false);
    localStorage.setItem('cloudpilot_authenticated', JSON.stringify(false));
  };

  const markNotificationRead = (id: string) => {
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
  };

  const markAllNotificationsRead = () => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
  };

  const updateUser = (updates: Partial<UserProfile>) => {
    setUser(prev => {
      const updated = { ...prev, ...updates };
      localStorage.setItem('cloudpilot_user', JSON.stringify(updated));
      return updated;
    });
  };

  const inviteTeamMember = (email: string, role: TeamMember['role']) => {
    const newMember: TeamMember = {
      id: `tm_${Date.now()}`,
      name: email.split('@')[0].replace(/[._]/g, ' '),
      email,
      role,
      avatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&auto=format&fit=crop&q=80',
      status: 'invited',
      lastActive: 'Pending invitation'
    };
    setTeamMembers(prev => [...prev, newMember]);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        teamMembers,
        notifications,
        unreadCount,
        isAuthenticated,
        login,
        logout,
        markNotificationRead,
        markAllNotificationsRead,
        updateUser,
        inviteTeamMember
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
