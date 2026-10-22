import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Zap, Shield, Lock, Mail, ArrowRight,
  Building, User, KeyRound, Sparkles
} from 'lucide-react';
import { useAuth } from '../context/useAuth';
import { sound } from '../utils/soundEngine';

export default function Login() {
  const navigate = useNavigate();
  const { login } = useAuth();

  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('chetan@cloudpilot.io');
  const [password, setPassword] = useState('••••••••••••');
  const [name, setName] = useState('Chetan Bhagore');
  const [org, setOrg] = useState('Acme Cloud Technologies');
  const [rememberMe, setRememberMe] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) {
      setError('Please enter your work email.');
      return;
    }
    setError(null);
    setIsLoading(true);
    sound.playClick();

    setTimeout(() => {
      login(email, password);
      sound.playSnap();
      setIsLoading(false);
      navigate('/');
    }, 600);
  };

  const handleQuickLogin = (roleEmail: string, roleName: string) => {
    setEmail(roleEmail);
    setName(roleName);
    setError(null);
    setIsLoading(true);
    sound.playClick();

    setTimeout(() => {
      login(roleEmail);
      sound.playSnap();
      setIsLoading(false);
      navigate('/');
    }, 450);
  };

  return (
    <div style={{
      minHeight: '100vh',
      width: '100vw',
      display: 'flex',
      backgroundColor: '#F5F5F7',
      fontFamily: 'var(--font-sans)',
      color: 'var(--text-primary)'
    }}>
      {/* ── Left Hero Side ── */}
      <div style={{
        flex: '1 1 50%',
        background: 'linear-gradient(145deg, #12141A 0%, #1A1D26 50%, #0F1117 100%)',
        color: '#FFFFFF',
        padding: '60px 80px',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        position: 'relative',
        overflow: 'hidden'
      }}>
        {/* Subtle background glow */}
        <div style={{
          position: 'absolute',
          top: '-15%',
          left: '-10%',
          width: '500px',
          height: '500px',
          background: 'radial-gradient(circle, rgba(0, 113, 227, 0.15) 0%, transparent 70%)',
          pointerEvents: 'none'
        }} />

        {/* Brand */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, position: 'relative', zIndex: 1 }}>
          <div style={{
            width: 38,
            height: 38,
            borderRadius: 10,
            background: 'var(--apple-blue)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 4px 14px rgba(0, 113, 227, 0.4)'
          }}>
            <Zap size={22} fill="#FFFFFF" color="#FFFFFF" />
          </div>
          <div>
            <div style={{ fontSize: 20, fontWeight: 700, letterSpacing: '-0.02em', color: '#FFFFFF' }}>
              CloudPilot
            </div>
            <div style={{ fontSize: 11, color: 'rgba(255, 255, 255, 0.6)', fontWeight: 500, letterSpacing: '0.04em', textTransform: 'uppercase' }}>
              Cloud Operations & Governance
            </div>
          </div>
        </div>

        {/* Central Proposition */}
        <div style={{ maxWidth: 520, margin: '60px 0', position: 'relative', zIndex: 1 }}>
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
            padding: '6px 14px',
            borderRadius: 9999,
            background: 'rgba(255, 255, 255, 0.08)',
            border: '1px solid rgba(255, 255, 255, 0.12)',
            fontSize: 12,
            fontWeight: 600,
            color: 'var(--apple-emerald)',
            marginBottom: 24
          }}>
            <Shield size={14} />
            <span>Two-Role IAM Cryptographic Safety Architecture</span>
          </div>

          <h1 style={{
            fontSize: '2.75rem',
            fontWeight: 800,
            letterSpacing: '-0.035em',
            lineHeight: 1.12,
            color: '#FFFFFF',
            marginBottom: 20
          }}>
            Understand your cloud.<br />
            <span style={{ color: 'var(--apple-blue)' }}>Approve the fix.</span><br />
            Prove the outcome.
          </h1>

          <p style={{
            fontSize: 16,
            color: 'rgba(255, 255, 255, 0.75)',
            lineHeight: 1.6,
            marginBottom: 36
          }}>
            The autonomous cloud cost and security operations platform that never makes destructive changes without your explicit, verified authorization.
          </p>

          {/* Social Proof Metric Pillars */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: 16,
            paddingTop: 24,
            borderTop: '1px solid rgba(255, 255, 255, 0.1)'
          }}>
            <div>
              <div style={{ fontSize: 22, fontWeight: 700, color: '#FFFFFF' }}>99.98%</div>
              <div style={{ fontSize: 12, color: 'rgba(255, 255, 255, 0.6)', marginTop: 4 }}>Remediation Safety</div>
            </div>
            <div>
              <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--apple-emerald)' }}>$48K+</div>
              <div style={{ fontSize: 12, color: 'rgba(255, 255, 255, 0.6)', marginTop: 4 }}>Monthly Waste Cut</div>
            </div>
            <div>
              <div style={{ fontSize: 22, fontWeight: 700, color: '#FFFFFF' }}>SHA-256</div>
              <div style={{ fontSize: 12, color: 'rgba(255, 255, 255, 0.6)', marginTop: 4 }}>Tamper-Proof Audit</div>
            </div>
          </div>
        </div>

        {/* Footer Quote */}
        <div style={{
          padding: '18px 22px',
          borderRadius: 14,
          background: 'rgba(255, 255, 255, 0.05)',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          position: 'relative',
          zIndex: 1
        }}>
          <p style={{ fontSize: 13, color: 'rgba(255, 255, 255, 0.85)', fontStyle: 'italic', lineHeight: 1.5, marginBottom: 8 }}>
            "CloudPilot eliminated the fear of automated cloud tools breaking customer services. The Safety Passport gives our team total visibility before any API runs."
          </p>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'var(--apple-blue)', color: '#FFF', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700 }}>
              ER
            </div>
            <div>
              <div style={{ fontSize: 12, fontWeight: 600, color: '#FFFFFF' }}>Elena Rostova</div>
              <div style={{ fontSize: 11, color: 'rgba(255, 255, 255, 0.5)' }}>VP of Platform Engineering, ScaleOps</div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Right Auth Form Side ── */}
      <div style={{
        flex: '1 1 50%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '60px 40px',
        backgroundColor: '#FFFFFF'
      }}>
        <div style={{ width: '100%', maxWidth: 440 }}>
          {/* Header */}
          <div style={{ marginBottom: 28 }}>
            <h2 style={{ fontSize: 26, fontWeight: 800, letterSpacing: '-0.02em', marginBottom: 8 }}>
              {mode === 'signin' ? 'Sign in to your workspace' : 'Create your CloudPilot workspace'}
            </h2>
            <p style={{ fontSize: 14, color: 'var(--text-secondary)' }}>
              {mode === 'signin'
                ? 'Enter your organization credentials to manage your connected AWS accounts.'
                : 'Start safely discovering and remediating cloud risks in minutes.'}
            </p>
          </div>

          {/* Quick-Access Persona Banner */}
          <div style={{
            padding: 14,
            borderRadius: 12,
            background: 'var(--surface-secondary)',
            border: '1px solid var(--border-subtle)',
            marginBottom: 24
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Quick 1-Click Access
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: 'var(--apple-blue)', fontWeight: 600 }}>
                <Sparkles size={12} /> Pre-configured
              </span>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                type="button"
                onClick={() => handleQuickLogin('chetan@cloudpilot.io', 'Chetan Bhagore')}
                style={{
                  flex: 1,
                  padding: '8px 12px',
                  borderRadius: 8,
                  border: '1px solid var(--border-medium)',
                  background: '#FFFFFF',
                  fontSize: 12,
                  fontWeight: 600,
                  color: 'var(--text-primary)',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6
                }}
              >
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--apple-emerald)' }} />
                <span>Chetan (Owner)</span>
              </button>
              <button
                type="button"
                onClick={() => handleQuickLogin('sarah.j@acmecloud.io', 'Sarah Jenkins')}
                style={{
                  flex: 1,
                  padding: '8px 12px',
                  borderRadius: 8,
                  border: '1px solid var(--border-medium)',
                  background: '#FFFFFF',
                  fontSize: 12,
                  fontWeight: 600,
                  color: 'var(--text-primary)',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6
                }}
              >
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--apple-blue)' }} />
                <span>Sarah (DevOps)</span>
              </button>
            </div>
          </div>

          {/* SSO Buttons */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 20 }}>
            <button
              type="button"
              onClick={() => handleQuickLogin('chetan@cloudpilot.io', 'Chetan Bhagore')}
              style={{
                width: '100%',
                padding: '10px 16px',
                borderRadius: 10,
                border: '1px solid var(--border-medium)',
                background: '#FFFFFF',
                fontSize: 13,
                fontWeight: 600,
                color: 'var(--text-primary)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 10,
                transition: 'all 0.15s ease'
              }}
            >
              <KeyRound size={16} color="var(--apple-amber)" />
              <span>Continue with AWS IAM Identity Center (SSO)</span>
            </button>
          </div>

          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 14,
            margin: '20px 0',
            color: 'var(--text-tertiary)',
            fontSize: 12
          }}>
            <div style={{ flex: 1, height: 1, background: 'var(--border-subtle)' }} />
            <span>or continue with email</span>
            <div style={{ flex: 1, height: 1, background: 'var(--border-subtle)' }} />
          </div>

          {error && (
            <div style={{
              padding: '10px 14px',
              borderRadius: 8,
              background: 'var(--apple-crimson-light)',
              color: 'var(--apple-crimson-dark)',
              fontSize: 13,
              fontWeight: 500,
              marginBottom: 16
            }}>
              {error}
            </div>
          )}

          {/* Email / Password Form */}
          <form onSubmit={handleSubmit}>
            {mode === 'signup' && (
              <>
                <div style={{ marginBottom: 16 }}>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 6 }}>
                    Full Name
                  </label>
                  <div style={{ position: 'relative' }}>
                    <User size={16} style={{ position: 'absolute', left: 12, top: 12, color: 'var(--text-tertiary)' }} />
                    <input
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Chetan Bhagore"
                      style={{
                        width: '100%',
                        padding: '10px 12px 10px 38px',
                        borderRadius: 10,
                        border: '1px solid var(--border-medium)',
                        fontSize: 14,
                        fontFamily: 'inherit'
                      }}
                    />
                  </div>
                </div>

                <div style={{ marginBottom: 16 }}>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 6 }}>
                    Organization / Company
                  </label>
                  <div style={{ position: 'relative' }}>
                    <Building size={16} style={{ position: 'absolute', left: 12, top: 12, color: 'var(--text-tertiary)' }} />
                    <input
                      type="text"
                      value={org}
                      onChange={(e) => setOrg(e.target.value)}
                      placeholder="Acme Cloud Technologies"
                      style={{
                        width: '100%',
                        padding: '10px 12px 10px 38px',
                        borderRadius: 10,
                        border: '1px solid var(--border-medium)',
                        fontSize: 14,
                        fontFamily: 'inherit'
                      }}
                    />
                  </div>
                </div>
              </>
            )}

            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 6 }}>
                Work Email Address
              </label>
              <div style={{ position: 'relative' }}>
                <Mail size={16} style={{ position: 'absolute', left: 12, top: 12, color: 'var(--text-tertiary)' }} />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@company.com"
                  required
                  style={{
                    width: '100%',
                    padding: '10px 12px 10px 38px',
                    borderRadius: 10,
                    border: '1px solid var(--border-medium)',
                    fontSize: 14,
                    fontFamily: 'inherit'
                  }}
                />
              </div>
            </div>

            <div style={{ marginBottom: 20 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)' }}>
                  Password
                </label>
                {mode === 'signin' && (
                  <span style={{ fontSize: 12, color: 'var(--apple-blue)', cursor: 'pointer', fontWeight: 500 }}>
                    Forgot password?
                  </span>
                )}
              </div>
              <div style={{ position: 'relative' }}>
                <Lock size={16} style={{ position: 'absolute', left: 12, top: 12, color: 'var(--text-tertiary)' }} />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  required
                  style={{
                    width: '100%',
                    padding: '10px 12px 10px 38px',
                    borderRadius: 10,
                    border: '1px solid var(--border-medium)',
                    fontSize: 14,
                    fontFamily: 'inherit'
                  }}
                />
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--text-secondary)', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  style={{ accentColor: 'var(--apple-blue)' }}
                />
                <span>Remember this workstation</span>
              </label>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              style={{
                width: '100%',
                padding: '12px 16px',
                borderRadius: 10,
                border: 'none',
                background: 'var(--apple-blue)',
                color: '#FFFFFF',
                fontSize: 14,
                fontWeight: 600,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                boxShadow: '0 2px 8px rgba(0, 113, 227, 0.3)'
              }}
            >
              {isLoading ? (
                <span>Authenticating with Workspace...</span>
              ) : (
                <>
                  <span>{mode === 'signin' ? 'Sign In to Workspace' : 'Create Organization Workspace'}</span>
                  <ArrowRight size={16} />
                </>
              )}
            </button>
          </form>

          {/* Toggle Mode */}
          <div style={{ marginTop: 24, textAlign: 'center', fontSize: 13, color: 'var(--text-secondary)' }}>
            {mode === 'signin' ? (
              <>
                Don't have an organization workspace?{' '}
                <button
                  type="button"
                  onClick={() => {
                    setMode('signup');
                    sound.playClick();
                  }}
                  style={{ background: 'none', border: 'none', color: 'var(--apple-blue)', fontWeight: 600, cursor: 'pointer' }}
                >
                  Create one now
                </button>
              </>
            ) : (
              <>
                Already registered with an organization?{' '}
                <button
                  type="button"
                  onClick={() => {
                    setMode('signin');
                    sound.playClick();
                  }}
                  style={{ background: 'none', border: 'none', color: 'var(--apple-blue)', fontWeight: 600, cursor: 'pointer' }}
                >
                  Sign in here
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
