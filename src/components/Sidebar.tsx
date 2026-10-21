import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard, Search, ShieldCheck, CheckSquare,
  BookOpen, Cloud, Zap
} from 'lucide-react';
import { useDemo } from '../context/useDemo';
import { sound } from '../utils/soundEngine';

export default function Sidebar() {
  const { activeScenario, findings, isRemediated } = useDemo();
  const isStudent = activeScenario === 'student';

  const navItems = [
    { to: '/',          icon: LayoutDashboard, label: 'Overview',        badge: null, badgeWarn: false },
    { to: '/connect',   icon: Cloud,           label: 'Connect Account', badge: null, badgeWarn: false },
    { to: '/discover',  icon: Search,          label: 'Discover',        badge: String(findings.length), badgeWarn: false },
    { to: '/passport',  icon: ShieldCheck,     label: 'Safety Passport', badge: '1', badgeWarn: false },
    { to: '/approve',   icon: CheckSquare,     label: 'Approve & Act',   badge: isRemediated ? 'Done ✓' : 'Action', badgeWarn: !isRemediated },
    { to: '/audit',     icon: BookOpen,        label: 'Audit Trail',     badge: isRemediated ? '1 Record' : null, badgeWarn: false },
  ];

  return (
    <nav className="layout-sidebar">
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
          <div className="sidebar-brand-tag">Safe Cloud Ops</div>
        </div>
      </NavLink>

      <div className="nav-section-title">Operations</div>

      {navItems.map(({ to, icon: Icon, label, badge, badgeWarn }) => (
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

      {/* Account Info Pill */}
      <div className="sidebar-account-card">
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
          <div className="account-dot" />
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>
            {isStudent ? 'Student ML Research' : 'FinTech MVP Dev'}
          </div>
        </div>
        <div style={{ fontSize: 11, color: 'var(--text-tertiary)', fontFamily: 'var(--font-mono)' }}>
          {isStudent ? 'acct-987654321098 • us-east-1' : 'acct-123456789012 • ap-south-1'}
        </div>
        <div style={{ fontSize: 11, color: 'var(--apple-emerald-dark)', marginTop: 6, fontWeight: 500 }}>
          ✓ Two-Role IAM Model Active
        </div>
      </div>
    </nav>
  );
}
