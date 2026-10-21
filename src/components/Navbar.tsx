import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  Volume2, VolumeX, RotateCcw, Play
} from 'lucide-react';
import { sound } from '../utils/soundEngine';

interface NavbarProps {
  onResetDemo?: () => void;
}

const STORY_STEPS = [
  { path: '/connect', label: '1. Connect' },
  { path: '/discover', label: '2. Discover' },
  { path: '/passport', label: '3. Passport' },
  { path: '/approve', label: '4. Approve' },
  { path: '/audit', label: '5. Audit & Proof' },
];

export default function Navbar({ onResetDemo }: NavbarProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const [soundEnabled, setSoundEnabled] = useState(sound.enabled);

  const toggleSound = () => {
    const newState = sound.toggle();
    setSoundEnabled(newState);
  };

  const handleStepClick = (path: string) => {
    sound.playClick();
    navigate(path);
  };

  return (
    <header className="top-nav">
      {/* Left: Mode / Story Stepper */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
        <div className="nav-pill-group">
          <button
            className={`nav-pill-btn ${location.pathname === '/' ? 'active' : ''}`}
            onClick={() => {
              sound.playClick();
              navigate('/');
            }}
          >
            Overview
          </button>
          {STORY_STEPS.map((step) => {
            const isActive = location.pathname === step.path;
            return (
              <button
                key={step.path}
                className={`nav-pill-btn ${isActive ? 'active' : ''}`}
                onClick={() => handleStepClick(step.path)}
              >
                {step.label}
              </button>
            );
          })}
        </div>

        {location.pathname !== '/' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--text-tertiary)' }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: 'var(--apple-blue)', fontWeight: 600 }}>
              <Play size={10} fill="currentColor" /> Interactive Storyline
            </span>
          </div>
        )}
      </div>

      {/* Right: Quick Controls */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        {/* Sandbox Indicator */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '5px 12px',
            background: 'var(--surface-secondary)',
            borderRadius: 9999,
            fontSize: 12,
            fontWeight: 500,
            color: 'var(--text-secondary)'
          }}
        >
          <div className="account-dot" />
          <span>acct-123456789012</span>
          <span style={{ color: 'var(--text-tertiary)' }}>•</span>
          <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>ap-south-1</span>
        </div>

        {/* Audio Sound Toggle */}
        <button
          onClick={toggleSound}
          className="btn btn-ghost btn-sm"
          style={{
            width: 34,
            height: 34,
            padding: 0,
            borderRadius: '50%',
            color: soundEnabled ? 'var(--apple-blue)' : 'var(--text-tertiary)',
            background: soundEnabled ? 'var(--apple-blue-light)' : 'transparent'
          }}
          title={soundEnabled ? 'Mute synthesized UI audio' : 'Enable synthesized UI audio'}
        >
          {soundEnabled ? <Volume2 size={16} /> : <VolumeX size={16} />}
        </button>

        {/* Replay / Reset Button */}
        <button
          onClick={() => {
            sound.playSnap();
            if (onResetDemo) {
              onResetDemo();
            } else {
              navigate('/connect');
            }
          }}
          className="btn btn-secondary btn-sm"
          title="Restart interactive demo story from beginning"
        >
          <RotateCcw size={13} />
          <span>Reset Demo</span>
        </button>
      </div>
    </header>
  );
}
