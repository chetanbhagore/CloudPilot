import { useState, useEffect, type ReactNode } from 'react';
import {
  AuthContext,
  type UserProfile,
  type TeamMember,
  type CloudNotification
} from './authDefinition';

function safeGetStorageJSON<T>(key: string, fallback: T): T {
  try {
    if (typeof window === 'undefined') return fallback;
    const item = localStorage.getItem(key);
    if (!item || item === 'undefined' || item === 'null') return fallback;
    return JSON.parse(item) as T;
  } catch {
    return fallback;
  }
}

const UNAUTHENTICATED_USER: UserProfile = {
  id: '',
  name: 'Unauthenticated User',
  email: '',
  role: 'Viewer',
  organization: '',
  organizationSlug: '',
  avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
  plan: 'Starter',
  mfaEnabled: false,
  joinedDate: '',
  activeAwsAccounts: 0,
  maxAwsAccounts: 10,
  isServerVerified: false
};

const INITIAL_TEAM: TeamMember[] = [
  {
    id: 'tm_1',
    name: 'Sarah Jenkins',
    email: 'admin@acmecloud.io',
    role: 'Owner',
    avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
    status: 'active',
    lastActive: 'Just now'
  },
  {
    id: 'tm_2',
    name: 'Marcus Vance',
    email: 'devops@acmecloud.io',
    role: 'DevOps Lead',
    avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&auto=format&fit=crop&q=80',
    status: 'active',
    lastActive: '14m ago'
  },
  {
    id: 'tm_3',
    name: 'Elena Rostova',
    email: 'analyst@acmecloud.io',
    role: 'Security Analyst',
    avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80',
    status: 'active',
    lastActive: '2h ago'
  },
  {
    id: 'tm_4',
    name: 'Tom Bradley',
    email: 'viewer@acmecloud.io',
    role: 'Viewer',
    avatar: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=150&auto=format&fit=crop&q=80',
    status: 'invited',
    lastActive: 'Invited 1d ago'
  }
];

const INITIAL_NOTIFICATIONS: CloudNotification[] = [
  {
    id: 'notif_1',
    title: 'Critical Security Exposure',
    message: 'Port 22 SSH ingress open to 0.0.0.0/0 on production security group.',
    severity: 'critical',
    timestamp: '2m ago',
    read: false,
    findingId: 'SEC-001',
    accountId: '1234-5678-9012'
  },
  {
    id: 'notif_2',
    title: 'Idle Resource Spend Alert',
    message: '500 GiB gp3 EBS volume has had 0 IOPS for 23 consecutive days.',
    severity: 'warning',
    timestamp: '1h ago',
    read: false,
    findingId: 'COST-002',
    accountId: '1234-5678-9012'
  },
  {
    id: 'notif_3',
    title: 'Audit Ledger Receipt Generated',
    message: 'Cryptographic SHA-256 receipt verified for remediation operation.',
    severity: 'info',
    timestamp: 'Yesterday',
    read: true,
    accountId: '1234-5678-9012'
  }
];

export function AuthProvider({ children }: { children: ReactNode }) {
  const backendUrl = typeof window !== 'undefined'
    ? (import.meta.env.VITE_BACKEND_URL || 'http://localhost:8000')
    : 'http://localhost:8000';

  const [user, setUser] = useState<UserProfile>(() => {
    return safeGetStorageJSON<UserProfile>('cloudpilot_user', UNAUTHENTICATED_USER);
  });

  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => {
    try {
      if (typeof window === 'undefined') return false;
      const savedAuth = localStorage.getItem('cloudpilot_authenticated');
      const token = localStorage.getItem('cloudpilot_jwt_token');
      if (savedAuth === 'true' && token && token !== 'undefined') {
        return true;
      }
      return false;
    } catch {
      return false;
    }
  });

  // Verify server identity on startup safely
  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        const token = localStorage.getItem('cloudpilot_jwt_token');
        if (token && token !== 'undefined') {
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
                  organization: me.organization_name || me.organization_id,
                  organizationSlug: me.organization_id.replace(/^org-/, ''),
                  permissions: me.permissions,
                  isServerVerified: true
                }));
                setIsAuthenticated(true);
              } else {
                // Stale or revoked token fails closed
                localStorage.removeItem('cloudpilot_jwt_token');
                localStorage.setItem('cloudpilot_authenticated', 'false');
                setIsAuthenticated(false);
                setUser(UNAUTHENTICATED_USER);
              }
            })
            .catch(() => {
              // Network error or backend offline
            });
        }
      } catch {}
    }
  }, [backendUrl]);

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
        localStorage.setItem('cloudpilot_authenticated', 'true');
        const verifiedUser: UserProfile = {
          ...user,
          id: data.user.id,
          email: data.user.email,
          name: data.user.name,
          role: data.user.role,
          organization: data.user.organization_name || data.user.organization_id,
          organizationSlug: data.user.organization_id.replace(/^org-/, ''),
          permissions: data.user.permissions,
          isServerVerified: true
        };
        setUser(verifiedUser);
        localStorage.setItem('cloudpilot_user', JSON.stringify(verifiedUser));
        setIsAuthenticated(true);
        return true;
      }
    } catch {
      // Backend unavailable or network error
    }

    return false;
  };

  const signup = async (
    name: string,
    email: string,
    password: string,
    organizationName: string
  ): Promise<{ success: boolean; error?: string }> => {
    try {
      const res = await fetch(`${backendUrl}/auth/signup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          email,
          password,
          organization_name: organizationName
        })
      });

      if (res.ok) {
        const data = await res.json();
        localStorage.setItem('cloudpilot_jwt_token', data.access_token);
        localStorage.setItem('cloudpilot_authenticated', 'true');
        const newUser: UserProfile = {
          id: data.user.id,
          email: data.user.email,
          name: data.user.name,
          role: data.user.role,
          organization: data.user.organization_name || data.user.organization_id,
          organizationSlug: data.user.organization_id.replace(/^org-/, ''),
          avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
          plan: 'Startup Pro',
          mfaEnabled: false,
          joinedDate: 'Just now',
          activeAwsAccounts: 0,
          maxAwsAccounts: 10,
          permissions: data.user.permissions,
          token: data.access_token,
          isServerVerified: true
        };
        setUser(newUser);
        localStorage.setItem('cloudpilot_user', JSON.stringify(newUser));
        setIsAuthenticated(true);
        return { success: true };
      } else {
        const errData = await res.json().catch(() => ({}));
        return {
          success: false,
          error: errData.detail || 'Sign-up failed. Please verify credentials.'
        };
      }
    } catch {
      return {
        success: false,
        error: 'Authentication service unreachable. Ensure backend server is running.'
      };
    }
  };

  const logout = () => {
    setIsAuthenticated(false);
    setUser(UNAUTHENTICATED_USER);
    try {
      localStorage.setItem('cloudpilot_authenticated', 'false');
      localStorage.removeItem('cloudpilot_jwt_token');
      localStorage.removeItem('cloudpilot_user');
    } catch {}
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
        signup,
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
