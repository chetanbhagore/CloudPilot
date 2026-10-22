import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Volume2, VolumeX, RotateCw, ChevronDown, Bell,
  Settings, LogOut, CheckCircle2, Shield,
  AlertTriangle, Info, Plus, Zap
} from 'lucide-react';
import { useDemo } from '../context/useDemo';
import { useAuth } from '../context/useAuth';
import { sound } from '../utils/soundEngine';

export default function Navbar() {
  const navigate = useNavigate();
  const { activeScenario, setScenario, accountConfig, appMode, setAppMode, isBackendOnline } = useDemo();
  const { user, logout, notifications, unreadCount, markNotificationRead, markAllNotificationsRead } = useAuth();

  const [soundEnabled, setSoundEnabled] = useState(sound.enabled);
  const [showAccountMenu, setShowAccountMenu] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);

  const accountMenuRef = useRef<HTMLDivElement>(null);
  const userMenuRef = useRef<HTMLDivElement>(null);
  const notifMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (accountMenuRef.current && !accountMenuRef.current.contains(e.target as Node)) {
        setShowAccountMenu(false);
      }
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setShowUserMenu(false);
      }
      if (notifMenuRef.current && !notifMenuRef.current.contains(e.target as Node)) {
        setShowNotifications(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const toggleSound = () => {
    const newState = sound.toggle();
    setSoundEnabled(newState);
  };

  const handleSyncState = () => {
    sound.playClick();
    setIsSyncing(true);
    setTimeout(() => {
      setIsSyncing(false);
      sound.playSnap();
    }, 800);
  };

  const handleSwitchAccount = (s: 'fintech' | 'student') => {
    sound.playClick();
    setScenario(s);
    setShowAccountMenu(false);
  };

  const handleLogout = () => {
    sound.playSnap();
    logout();
    navigate('/login');
  };

  return (
    <header className="top-nav">
      {/* ── Left: Active Account & Environment Switcher ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
        <div style={{ position: 'relative' }} ref={accountMenuRef}>
          <button
            onClick={() => {
              sound.playClick();
              setShowAccountMenu(!showAccountMenu);
            }}
            className="sandbox-pill"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '6px 14px',
              background: '#FFFFFF',
              border: '1px solid var(--border-medium)',
              borderRadius: 9999,
              fontSize: 13,
              fontWeight: 600,
              color: 'var(--text-primary)',
              cursor: 'pointer',
              boxShadow: 'var(--shadow-sm)'
            }}
          >
            <div style={{
              width: 8,
              height: 8,
              borderRadius: '50%',
              background: 'var(--apple-emerald)',
              boxShadow: '0 0 0 2px rgba(48, 209, 88, 0.2)'
            }} />
            <span>{accountConfig.alias}</span>
            <span style={{ color: 'var(--text-tertiary)', fontSize: 12, fontWeight: 400 }}>•</span>
            <span style={{ color: 'var(--text-secondary)', fontSize: 12, fontFamily: 'var(--font-mono)' }}>
              {accountConfig.region}
            </span>
            <ChevronDown size={14} color="var(--text-tertiary)" />
          </button>

          {/* Account Dropdown Menu */}
          {showAccountMenu && (
            <div
              style={{
                position: 'absolute',
                top: 'calc(100% + 8px)',
                left: 0,
                width: 320,
                background: '#FFFFFF',
                borderRadius: 14,
                boxShadow: 'var(--shadow-floating)',
                border: '1px solid var(--border-medium)',
                padding: 8,
                zIndex: 100,
                display: 'flex',
                flexDirection: 'column',
                gap: 4
              }}
            >
              <div style={{ padding: '6px 10px', fontSize: 11, fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Connected AWS Accounts
              </div>

              {/* Account 1 */}
              <button
                onClick={() => handleSwitchAccount('fintech')}
                style={{
                  padding: '10px 12px',
                  borderRadius: 10,
                  border: 'none',
                  background: activeScenario === 'fintech' ? 'var(--apple-blue-light)' : 'transparent',
                  color: activeScenario === 'fintech' ? 'var(--apple-blue)' : 'var(--text-primary)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  textAlign: 'left',
                  cursor: 'pointer'
                }}
              >
                <div>
                  <div style={{ fontWeight: 600, fontSize: 13 }}>Production Core (FinTech MVP)</div>
                  <div style={{ fontSize: 11, color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)', marginTop: 2 }}>
                    AWS: 8392-1049-2819 • ap-south-1
                  </div>
                </div>
                {activeScenario === 'fintech' && <CheckCircle2 size={16} color="var(--apple-blue)" />}
              </button>

              {/* Account 2 */}
              <button
                onClick={() => handleSwitchAccount('student')}
                style={{
                  padding: '10px 12px',
                  borderRadius: 10,
                  border: 'none',
                  background: activeScenario === 'student' ? 'var(--apple-blue-light)' : 'transparent',
                  color: activeScenario === 'student' ? 'var(--apple-blue)' : 'var(--text-primary)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  textAlign: 'left',
                  cursor: 'pointer'
                }}
              >
                <div>
                  <div style={{ fontWeight: 600, fontSize: 13 }}>Research & ML Lab Sandbox</div>
                  <div style={{ fontSize: 11, color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)', marginTop: 2 }}>
                    AWS: 9182-4729-1039 • us-east-1
                  </div>
                </div>
                {activeScenario === 'student' && <CheckCircle2 size={16} color="var(--apple-blue)" />}
              </button>

              <div style={{ height: 1, background: 'var(--border-subtle)', margin: '4px 0' }} />

              <button
                onClick={() => {
                  sound.playClick();
                  setShowAccountMenu(false);
                  navigate('/connect');
                }}
                style={{
                  padding: '8px 12px',
                  borderRadius: 8,
                  border: 'none',
                  background: 'transparent',
                  color: 'var(--apple-blue)',
                  fontSize: 12,
                  fontWeight: 600,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  cursor: 'pointer'
                }}
              >
                <Plus size={14} />
                <span>Connect New AWS Account</span>
              </button>
            </div>
          )}
        </div>

        {/* Live IAM Audit Status */}
        <div style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          fontSize: 12,
          fontWeight: 500,
          color: 'var(--text-secondary)',
          background: 'var(--surface-secondary)',
          padding: '4px 10px',
          borderRadius: 9999
        }}>
          <Shield size={13} color="var(--apple-emerald-dark)" />
          <span>Two-Role IAM Active</span>
        </div>

        {/* ── Mode Switcher: Demo Mode ↔ Live AWS Mode ── */}
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            background: 'var(--surface-secondary)',
            padding: '3px',
            borderRadius: 9999,
            border: '1px solid var(--border-medium)',
            gap: 2
          }}
        >
          <button
            onClick={() => {
              sound.playClick();
              setAppMode('demo');
            }}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '4px 10px',
              borderRadius: 9999,
              border: 'none',
              background: appMode === 'demo' ? '#FFFFFF' : 'transparent',
              color: appMode === 'demo' ? 'var(--text-primary)' : 'var(--text-tertiary)',
              fontWeight: appMode === 'demo' ? 600 : 500,
              fontSize: 11.5,
              cursor: 'pointer',
              boxShadow: appMode === 'demo' ? 'var(--shadow-sm)' : 'none',
              transition: 'all 160ms ease'
            }}
            title="Demo Mode: Presentation fallback using deterministic scenarios"
          >
            <span
              style={{
                width: 7,
                height: 7,
                borderRadius: '50%',
                background: 'var(--apple-emerald)',
                boxShadow: appMode === 'demo' ? '0 0 0 2px rgba(48, 209, 88, 0.25)' : 'none'
              }}
            />
            <span>Demo Mode</span>
          </button>

          <button
            onClick={() => {
              sound.playClick();
              setAppMode('live');
            }}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 5,
              padding: '4px 10px',
              borderRadius: 9999,
              border: 'none',
              background: appMode === 'live' ? 'var(--apple-blue)' : 'transparent',
              color: appMode === 'live' ? '#FFFFFF' : 'var(--text-tertiary)',
              fontWeight: appMode === 'live' ? 600 : 500,
              fontSize: 11.5,
              cursor: 'pointer',
              boxShadow: appMode === 'live' ? '0 2px 8px rgba(0, 113, 227, 0.35)' : 'none',
              transition: 'all 160ms ease'
            }}
            title="Live AWS Mode: Query real AWS account via STS AssumeRole"
          >
            <Zap size={12} fill={appMode === 'live' ? '#FFFFFF' : 'none'} />
            <span>Live Mode</span>
            {isBackendOnline ? (
              <span
                style={{
                  fontSize: 9,
                  background: appMode === 'live' ? 'rgba(255,255,255,0.25)' : 'var(--apple-emerald-light)',
                  color: appMode === 'live' ? '#FFFFFF' : 'var(--apple-emerald-dark)',
                  padding: '1px 5px',
                  borderRadius: 9999,
                  fontWeight: 700
                }}
              >
                ONLINE
              </span>
            ) : (
              <span
                style={{
                  fontSize: 9,
                  background: appMode === 'live' ? 'rgba(255,255,255,0.25)' : 'rgba(0,0,0,0.05)',
                  color: appMode === 'live' ? '#FFFFFF' : 'var(--text-tertiary)',
                  padding: '1px 5px',
                  borderRadius: 9999
                }}
              >
                STANDBY
              </span>
            )}
          </button>
        </div>
      </div>

      {/* ── Right: Sync Button, Sound, Notifications, & User Profile ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        {/* Sync / Refresh Cloud Telemetry */}
        <button
          onClick={handleSyncState}
          className="btn btn-ghost btn-sm"
          style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--text-secondary)' }}
          title="Poll latest AWS telemetry and re-evaluate preconditions"
        >
          <RotateCw size={14} className={isSyncing ? 'spin-anim' : ''} />
          <span style={{ fontSize: 12 }}>{isSyncing ? 'Syncing AWS...' : 'Sync Cloud'}</span>
        </button>

        {/* UI Audio Sound Toggle */}
        <button
          onClick={toggleSound}
          className="btn btn-ghost btn-sm"
          style={{
            width: 32,
            height: 32,
            padding: 0,
            borderRadius: '50%',
            color: soundEnabled ? 'var(--apple-blue)' : 'var(--text-tertiary)',
            background: soundEnabled ? 'var(--apple-blue-light)' : 'transparent'
          }}
          title={soundEnabled ? 'Mute synthesized UI audio' : 'Enable synthesized UI audio'}
          aria-label={soundEnabled ? 'Mute sound' : 'Unmute sound'}
        >
          {soundEnabled ? <Volume2 size={15} /> : <VolumeX size={15} />}
        </button>

        {/* Notification Bell Center */}
        <div style={{ position: 'relative' }} ref={notifMenuRef}>
          <button
            onClick={() => {
              sound.playClick();
              setShowNotifications(!showNotifications);
            }}
            className="btn btn-ghost btn-sm"
            style={{
              width: 32,
              height: 32,
              padding: 0,
              borderRadius: '50%',
              position: 'relative',
              color: showNotifications ? 'var(--apple-blue)' : 'var(--text-secondary)'
            }}
            title="Cloud Security & Cost Notifications"
            aria-label="View notifications"
          >
            <Bell size={16} />
            {unreadCount > 0 && (
              <span style={{
                position: 'absolute',
                top: 2,
                right: 2,
                width: 8,
                height: 8,
                borderRadius: '50%',
                background: 'var(--apple-crimson)',
                boxShadow: '0 0 0 2px #FFFFFF'
              }} />
            )}
          </button>

          {/* Notifications Flyout */}
          {showNotifications && (
            <div
              style={{
                position: 'absolute',
                top: 'calc(100% + 8px)',
                right: 0,
                width: 340,
                background: '#FFFFFF',
                borderRadius: 14,
                boxShadow: 'var(--shadow-floating)',
                border: '1px solid var(--border-medium)',
                padding: 12,
                zIndex: 100
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <span style={{ fontWeight: 700, fontSize: 13 }}>Cloud Notifications ({unreadCount} unread)</span>
                {unreadCount > 0 && (
                  <button
                    onClick={markAllNotificationsRead}
                    style={{ background: 'none', border: 'none', color: 'var(--apple-blue)', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}
                  >
                    Mark all read
                  </button>
                )}
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 280, overflowY: 'auto' }}>
                {notifications.map((n) => (
                  <div
                    key={n.id}
                    onClick={() => {
                      markNotificationRead(n.id);
                      if (n.findingId) navigate('/discover');
                      setShowNotifications(false);
                    }}
                    style={{
                      padding: 10,
                      borderRadius: 8,
                      background: n.read ? 'transparent' : 'var(--surface-secondary)',
                      cursor: 'pointer',
                      display: 'flex',
                      gap: 10,
                      alignItems: 'flex-start'
                    }}
                  >
                    {n.severity === 'critical' ? (
                      <AlertTriangle size={16} color="var(--apple-crimson)" style={{ marginTop: 2, flexShrink: 0 }} />
                    ) : (
                      <Info size={16} color="var(--apple-blue)" style={{ marginTop: 2, flexShrink: 0 }} />
                    )}
                    <div>
                      <div style={{ fontSize: 12, fontWeight: 600 }}>{n.title}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 2, lineHeight: 1.4 }}>
                        {n.message}
                      </div>
                      <div style={{ fontSize: 10, color: 'var(--text-tertiary)', marginTop: 4 }}>
                        {n.timestamp}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* ── User Profile Dropdown ── */}
        <div style={{ position: 'relative' }} ref={userMenuRef}>
          <button
            onClick={() => {
              sound.playClick();
              setShowUserMenu(!showUserMenu);
            }}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '4px 8px 4px 4px',
              borderRadius: 9999,
              border: '1px solid var(--border-medium)',
              background: '#FFFFFF',
              cursor: 'pointer',
              boxShadow: 'var(--shadow-sm)'
            }}
          >
            <div style={{
              width: 26,
              height: 26,
              borderRadius: '50%',
              background: 'var(--apple-blue)',
              color: '#FFFFFF',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 11,
              fontWeight: 700
            }}>
              {user.name.split(' ').map(n => n[0]).join('')}
            </div>
            <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>
              {user.name.split(' ')[0]}
            </span>
            <ChevronDown size={12} color="var(--text-tertiary)" />
          </button>

          {/* User Flyout */}
          {showUserMenu && (
            <div
              style={{
                position: 'absolute',
                top: 'calc(100% + 8px)',
                right: 0,
                width: 240,
                background: '#FFFFFF',
                borderRadius: 14,
                boxShadow: 'var(--shadow-floating)',
                border: '1px solid var(--border-medium)',
                padding: 8,
                zIndex: 100,
                display: 'flex',
                flexDirection: 'column',
                gap: 4
              }}
            >
              <div style={{ padding: '8px 10px', borderBottom: '1px solid var(--border-subtle)' }}>
                <div style={{ fontWeight: 700, fontSize: 13 }}>{user.name}</div>
                <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{user.email}</div>
                <div style={{ display: 'inline-block', marginTop: 6, padding: '2px 6px', borderRadius: 4, background: 'var(--apple-blue-light)', color: 'var(--apple-blue)', fontSize: 10, fontWeight: 700 }}>
                  {user.organization} • {user.role}
                </div>
              </div>

              <button
                onClick={() => {
                  sound.playClick();
                  setShowUserMenu(false);
                  navigate('/settings');
                }}
                style={{
                  padding: '8px 10px',
                  borderRadius: 8,
                  border: 'none',
                  background: 'transparent',
                  color: 'var(--text-primary)',
                  fontSize: 12,
                  fontWeight: 500,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  cursor: 'pointer',
                  textAlign: 'left'
                }}
              >
                <Settings size={14} color="var(--text-secondary)" />
                <span>Workspace Settings & Team</span>
              </button>

              <button
                onClick={() => {
                  sound.playClick();
                  setShowUserMenu(false);
                  navigate('/connect');
                }}
                style={{
                  padding: '8px 10px',
                  borderRadius: 8,
                  border: 'none',
                  background: 'transparent',
                  color: 'var(--text-primary)',
                  fontSize: 12,
                  fontWeight: 500,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  cursor: 'pointer',
                  textAlign: 'left'
                }}
              >
                <Shield size={14} color="var(--text-secondary)" />
                <span>AWS IAM Role Config</span>
              </button>

              <div style={{ height: 1, background: 'var(--border-subtle)', margin: '4px 0' }} />

              <button
                onClick={handleLogout}
                style={{
                  padding: '8px 10px',
                  borderRadius: 8,
                  border: 'none',
                  background: 'transparent',
                  color: 'var(--apple-crimson-dark)',
                  fontSize: 12,
                  fontWeight: 600,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  cursor: 'pointer',
                  textAlign: 'left'
                }}
              >
                <LogOut size={14} color="var(--apple-crimson)" />
                <span>Sign Out of Workspace</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
