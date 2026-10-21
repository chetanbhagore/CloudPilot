import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard, Search, ShieldCheck, CheckSquare,
  BookOpen, Cloud, Zap
} from 'lucide-react';
import { mockAccount } from '../data/mockData';
import { sound } from '../utils/soundEngine';

const navItems = [
  { to: '/',          icon: LayoutDashboard, label: 'Overview',        badge: null },
  { to: '/connect',   icon: Cloud,           label: 'Connect Account', badge: null },
  { to: '/discover',  icon: Search,          label: 'Discover',        badge: '5' },
  { to: '/passport',  icon: ShieldCheck,     label: 'Safety Passport', badge: '1' },
  { to: '/approve',   icon: CheckSquare,     label: 'Approve & Act',   badge: 'Action', badgeWarn: true },
  { to: '/audit',     icon: BookOpen,        label: 'Audit Trail',     badge: null },
];

export default function Sidebar() {
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
            {mockAccount.alias}
          </div>
        </div>
        <div style={{ fontSize: 11, color: 'var(--text-tertiary)', fontFamily: 'var(--font-mono)' }}>
          {mockAccount.accountId} • {mockAccount.region}
        </div>
        <div style={{ fontSize: 11, color: 'var(--apple-emerald-dark)', marginTop: 6, fontWeight: 500 }}>
          ✓ Read-Only IAM Session
        </div>
      </div>
    </nav>
  );
}
