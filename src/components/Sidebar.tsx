import { NavLink, useNavigate, Link } from 'react-router-dom';
import {
  LayoutDashboard, Search, ShieldCheck, CheckSquare,
  BookOpen, Cloud, Zap, Settings, LogOut, Layers, Mail
} from 'lucide-react';
import { useDemo } from '../context/useDemo';
import { useAuth } from '../context/useAuth';
import { sound } from '../utils/soundEngine';

export default function Sidebar() {
  const navigate = useNavigate();
  const { accountConfig, findings, isRemediated, resolvedCount } = useDemo();
  const { user, logout } = useAuth();

  const operationsNav = [
    { to: '/',          icon: LayoutDashboard, label: 'Overview',        badge: null, badgeWarn: false },
    { to: '/discover',  icon: Search,          label: 'Discover',        badge: String(findings.length), badgeWarn: false },
    { to: '/deploy',    icon: Layers,          label: 'Workloads & Deploy', badge: 'Beta', badgeWarn: false },
    { to: '/passport',  icon: ShieldCheck,     label: 'Safety Passport', badge: 'Active', badgeWarn: false },
    { to: '/approve',   icon: CheckSquare,     label: 'Approve & Act',   badge: isRemediated ? `${resolvedCount} Done ✓` : '1 Ready', badgeWarn: !isRemediated },
    { to: '/audit',     icon: BookOpen,        label: 'Audit Trail',     badge: resolvedCount > 0 ? `${resolvedCount} Records` : null, badgeWarn: false },
  ];

  const governanceNav = [
    { to: '/connect',   icon: Cloud,           label: 'Cloud Accounts',  badge: '2 Active', badgeWarn: false },
    { to: '/settings',  icon: Settings,        label: 'Settings & Team', badge: null, badgeWarn: false },
    { to: '/contact',   icon: Mail,            label: 'Contact & Support', badge: null, badgeWarn: false },
  ];

  const handleLogout = () => {
    sound.playSnap();
    logout();
    navigate('/login');
  };

  return (
    <nav className="layout-sidebar" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Brand */}
      <NavLink
        to="/"
        className="sidebar-brand"
        onClick={() => sound.playClick()}
      >
        <div className="sidebar-logo-mark">
          <Zap size={18} fill="#FFFFFF" color="#FFFFFF" />
        </div>
        <div>
          <div className="sidebar-brand-name">CloudPilot</div>
          <div className="sidebar-brand-tag">Cloud Operations Platform</div>
        </div>
      </NavLink>

      {/* Main Operations Navigation */}
      <div className="nav-section-title">Operations</div>
      {operationsNav.map(({ to, icon: Icon, label, badge, badgeWarn }) => (
        <NavLink
          key={to}
          to={to}
          end={to === '/'}
          onClick={() => sound.playClick()}
          className={({ isActive }) => `sidebar-link${isActive ? ' active' : ''}`}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Icon size={16} />
            <span>{label}</span>
          </div>
          {badge && (
            <span className={`sidebar-badge${badgeWarn ? ' highlight' : ''}`}>
              {badge}
            </span>
          )}
        </NavLink>
      ))}

      {/* Governance & Configuration */}
      <div className="nav-section-title" style={{ marginTop: 20 }}>Governance</div>
      {governanceNav.map(({ to, icon: Icon, label, badge, badgeWarn }) => (
        <NavLink
          key={to}
          to={to}
          onClick={() => sound.playClick()}
          className={({ isActive }) => `sidebar-link${isActive ? ' active' : ''}`}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Icon size={16} />
            <span>{label}</span>
          </div>
          {badge && (
            <span className={`sidebar-badge${badgeWarn ? ' highlight' : ''}`}>
              {badge}
            </span>
          )}
        </NavLink>
      ))}

      {/* Spacer */}
      <div style={{ flex: 1 }} />

      {/* Connected Account Mini-Card */}
      <div className="sidebar-account-card" style={{ marginBottom: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
          <div className="account-dot" />
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>
            {accountConfig.alias}
          </div>
        </div>
        <div style={{ fontSize: 11, color: 'var(--text-tertiary)', fontFamily: 'var(--font-mono)' }}>
          {accountConfig.accountId} • {accountConfig.region}
        </div>
      </div>

      {/* Quick Internal Footer Links */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 6px', marginBottom: 10, fontSize: 11 }}>
        <Link to="/privacy" style={{ color: 'var(--text-tertiary)', textDecoration: 'none' }} onMouseEnter={e => e.currentTarget.style.color = 'var(--apple-blue)'} onMouseLeave={e => e.currentTarget.style.color = 'var(--text-tertiary)'}>
          Privacy Policy
        </Link>
        <span style={{ color: 'var(--border-strong)' }}>•</span>
        <Link to="/contact" style={{ color: 'var(--text-tertiary)', textDecoration: 'none' }} onMouseEnter={e => e.currentTarget.style.color = 'var(--apple-blue)'} onMouseLeave={e => e.currentTarget.style.color = 'var(--text-tertiary)'}>
          Support Ticket
        </Link>
      </div>

      {/* Identified User Footer Card */}
      <div style={{
        padding: '12px 14px',
        borderRadius: 12,
        background: 'var(--surface-secondary)',
        border: '1px solid var(--border-subtle)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, overflow: 'hidden' }}>
          <div style={{
            width: 32,
            height: 32,
            borderRadius: '50%',
            background: 'var(--apple-blue)',
            color: '#FFFFFF',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 12,
            fontWeight: 700,
            flexShrink: 0
          }}>
            {user.name.split(' ').map(n => n[0]).join('')}
          </div>
          <div style={{ overflow: 'hidden' }}>
            <div style={{ fontSize: 12.5, fontWeight: 700, whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>
              {user.name}
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-tertiary)', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>
              {user.role}
            </div>
          </div>
        </div>
        <button
          onClick={handleLogout}
          className="btn btn-ghost btn-sm"
          style={{ width: 28, height: 28, padding: 0, color: 'var(--text-tertiary)' }}
          title="Sign Out"
          aria-label="Sign Out"
        >
          <LogOut size={14} />
        </button>
      </div>
    </nav>
  );
}
