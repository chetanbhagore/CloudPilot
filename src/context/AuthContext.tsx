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
  const backendUrl = typeof window !== 'undefined'
    ? (import.meta.env.VITE_BACKEND_URL || 'http://localhost:8000')
    : 'http://localhost:8000';

  const [user, setUser] = useState<UserProfile>(() => {
    const saved = localStorage.getItem('cloudpilot_user');
    return saved ? JSON.parse(saved) : DEFAULT_USER;
  });

  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => {
    const savedAuth = localStorage.getItem('cloudpilot_authenticated');
    const token = localStorage.getItem('cloudpilot_jwt_token');
    return savedAuth !== null ? JSON.parse(savedAuth) : !!token;
  });

  // Verify server identity on startup
  useState(() => {
    if (typeof window !== 'undefined') {
      const token = localStorage.getItem('cloudpilot_jwt_token');
      if (token) {
        fetch(`${backendUrl}/auth/me`, {
          headers: { Authorization: `Bearer ${token}` }
        })
          .then((res) => (res.ok ? res.json() : null))
          .then((me) => {
            if (me && me.id) {
              setUser((prev) => ({
                ...prev,
                id: me.id,
                email: me.email,
                name: me.name,
                role: me.role,
                organization: me.organization_id,
                permissions: me.permissions,
                isServerVerified: true
              }));
              setIsAuthenticated(true);
            } else if (localStorage.getItem('cloudpilot_app_mode') === 'live') {
              // Stale or revoked token in live mode fails closed
              localStorage.removeItem('cloudpilot_jwt_token');
              setIsAuthenticated(false);
            }
          })
          .catch(() => {});
      }
    }
  });

  const [teamMembers, setTeamMembers] = useState<TeamMember[]>(INITIAL_TEAM);
  const [notifications, setNotifications] = useState<CloudNotification[]>(INITIAL_NOTIFICATIONS);

  const unreadCount = notifications.filter(n => !n.read).length;

  const login = async (email: string, password?: string): Promise<boolean> => {
    try {
      const res = await fetch(`${backendUrl}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password: password || '' })
      });

      if (res.ok) {
        const data = await res.json();
        localStorage.setItem('cloudpilot_jwt_token', data.access_token);
        localStorage.setItem('cloudpilot_authenticated', JSON.stringify(true));
        const verifiedUser: UserProfile = {
          ...user,
          id: data.user.id,
          email: data.user.email,
          name: data.user.name,
          role: data.user.role,
          organization: data.user.organization_id,
          permissions: data.user.permissions,
          isServerVerified: true
        };
        setUser(verifiedUser);
        localStorage.setItem('cloudpilot_user', JSON.stringify(verifiedUser));
        setIsAuthenticated(true);
        return true;
      }
    } catch (_err) {
      // Backend unavailable fallback
    }

    // In explicit demo mode, allow simulated persona
    const isDemo = typeof window !== 'undefined' && localStorage.getItem('cloudpilot_app_mode') === 'demo';
    if (isDemo && email && email.includes('@')) {
      setIsAuthenticated(true);
      localStorage.setItem('cloudpilot_authenticated', JSON.stringify(true));
      const demoUser: UserProfile = {
        ...user,
        email,
        name: email.split('@')[0].replace(/[._]/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
        role: 'DevOps Lead',
        isServerVerified: false
      };
      setUser(demoUser);
      localStorage.setItem('cloudpilot_user', JSON.stringify(demoUser));
      return true;
    }

    return false;
  };

  const logout = () => {
    setIsAuthenticated(false);
    localStorage.removeItem('cloudpilot_authenticated');
    localStorage.removeItem('cloudpilot_jwt_token');
    localStorage.removeItem('cloudpilot_user');
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
