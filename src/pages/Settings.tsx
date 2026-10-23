import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  User, Users, Shield, Cloud, CreditCard,
  CheckCircle2, Plus, Check, Zap
} from 'lucide-react';
import { useAuth, type TeamMember } from '../context/useAuth';
import { useDemo } from '../context/useDemo';
import { sound } from '../utils/soundEngine';

export default function Settings() {
  const navigate = useNavigate();
  const { user, teamMembers, updateUser, inviteTeamMember } = useAuth();
  const { accountConfig, disconnectAccount } = useDemo();
  const [activeTab, setActiveTab] = useState<'profile' | 'team' | 'aws' | 'billing'>('profile');


  // Form states
  const [name, setName] = useState(user.name);
  const [email, setEmail] = useState(user.email);
  const [org, setOrg] = useState(user.organization);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Invite modal state
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<TeamMember['role']>('DevOps Lead');
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [twoPersonRule, setTwoPersonRule] = useState(true);

  const handleSaveProfile = (e: React.FormEvent) => {
    e.preventDefault();
    sound.playClick();
    updateUser({ name, email, organization: org });
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 2500);
  };

  const handleSendInvite = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteEmail) return;
    sound.playSnap();
    inviteTeamMember(inviteEmail, inviteRole);
    setInviteEmail('');
    setShowInviteModal(false);
  };

  return (
    <div className="page-container">
      {/* ── Page Header ── */}
      <div className="page-header">
        <div>
          <div className="page-eyebrow">Organization & Governance</div>
          <h1 className="page-title">Workspace Settings</h1>
          <p className="page-subtitle">
            Manage your user identity, team permissions, multi-account AWS integrations, and subscription billing.
          </p>
        </div>
      </div>

      {/* ── Settings Tabs ── */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        borderBottom: '1px solid var(--border-medium)',
        marginBottom: 28,
        overflowX: 'auto'
      }}>
        <button
          onClick={() => { sound.playClick(); setActiveTab('profile'); }}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '10px 16px',
            border: 'none',
            background: 'none',
            fontSize: 14,
            fontWeight: 600,
            color: activeTab === 'profile' ? 'var(--apple-blue)' : 'var(--text-secondary)',
            borderBottom: activeTab === 'profile' ? '2px solid var(--apple-blue)' : '2px solid transparent',
            cursor: 'pointer',
            whiteSpace: 'nowrap'
          }}
        >
          <User size={16} />
          <span>Profile & Security</span>
        </button>

        <button
          onClick={() => { sound.playClick(); setActiveTab('team'); }}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '10px 16px',
            border: 'none',
            background: 'none',
            fontSize: 14,
            fontWeight: 600,
            color: activeTab === 'team' ? 'var(--apple-blue)' : 'var(--text-secondary)',
            borderBottom: activeTab === 'team' ? '2px solid var(--apple-blue)' : '2px solid transparent',
            cursor: 'pointer',
            whiteSpace: 'nowrap'
          }}
        >
          <Users size={16} />
          <span>Team & Access Control ({teamMembers.length})</span>
        </button>

        <button
          onClick={() => { sound.playClick(); setActiveTab('aws'); }}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '10px 16px',
            border: 'none',
            background: 'none',
            fontSize: 14,
            fontWeight: 600,
            color: activeTab === 'aws' ? 'var(--apple-blue)' : 'var(--text-secondary)',
            borderBottom: activeTab === 'aws' ? '2px solid var(--apple-blue)' : '2px solid transparent',
            cursor: 'pointer',
            whiteSpace: 'nowrap'
          }}
        >
          <Cloud size={16} />
          <span>AWS Two-Role IAM Integrations</span>
        </button>

        <button
          onClick={() => { sound.playClick(); setActiveTab('billing'); }}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '10px 16px',
            border: 'none',
            background: 'none',
            fontSize: 14,
            fontWeight: 600,
            color: activeTab === 'billing' ? 'var(--apple-blue)' : 'var(--text-secondary)',
            borderBottom: activeTab === 'billing' ? '2px solid var(--apple-blue)' : '2px solid transparent',
            cursor: 'pointer',
            whiteSpace: 'nowrap'
          }}
        >
          <CreditCard size={16} />
          <span>Plan & Billing</span>
        </button>
      </div>

      {/* ── Tab Content ── */}

      {/* TAB 1: Profile & Security */}
      {activeTab === 'profile' && (
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 24 }}>
          <div className="card" style={{ padding: 24 }}>
            <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 18 }}>Personal Identity & Workspace</h3>

            <form onSubmit={handleSaveProfile}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 6 }}>
                    Full Name
                  </label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '10px 14px',
                      borderRadius: 8,
                      border: '1px solid var(--border-medium)',
                      fontSize: 14,
                      fontFamily: 'inherit'
                    }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 6 }}>
                    Work Email
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '10px 14px',
                      borderRadius: 8,
                      border: '1px solid var(--border-medium)',
                      fontSize: 14,
                      fontFamily: 'inherit'
                    }}
                  />
                </div>
              </div>

              <div style={{ marginBottom: 20 }}>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 6 }}>
                  Organization Name
                </label>
                <input
                  type="text"
                  value={org}
                  onChange={(e) => setOrg(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '10px 14px',
                    borderRadius: 8,
                    border: '1px solid var(--border-medium)',
                    fontSize: 14,
                    fontFamily: 'inherit'
                  }}
                />
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <button
                  type="submit"
                  className="btn btn-primary btn-md"
                >
                  Save Profile Changes
                </button>
                {saveSuccess && (
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: 'var(--apple-emerald-dark)', fontSize: 13, fontWeight: 600 }}>
                    <Check size={16} /> Saved to workspace
                  </span>
                )}
              </div>
            </form>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* Identity Badge */}
            <div className="card" style={{ padding: 20 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
                <div style={{
                  width: 44,
                  height: 44,
                  borderRadius: '50%',
                  background: 'var(--apple-blue)',
                  color: '#FFFFFF',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 16,
                  fontWeight: 700
                }}>
                  {user.name.split(' ').map(n => n[0]).join('')}
                </div>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 15 }}>{user.name}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{user.role}</div>
                </div>
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-tertiary)', borderTop: '1px solid var(--border-subtle)', paddingTop: 12 }}>
                <div>Member since: <strong>{user.joinedDate}</strong></div>
                <div style={{ marginTop: 4 }}>Workspace: <strong>{user.organization}</strong></div>
              </div>
            </div>

            {/* MFA Security Status */}
            <div className="card" style={{ padding: 20 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--apple-emerald-dark)', fontWeight: 600, fontSize: 13, marginBottom: 8 }}>
                <CheckCircle2 size={16} />
                <span>Hardware MFA Active</span>
              </div>
              <p style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                Your account is bound to a FIDO2 hardware token for high-privilege remediation approvals.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: Team & RBAC */}
      {activeTab === 'team' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
            <div>
              <h3 style={{ fontSize: 18, fontWeight: 700 }}>Workspace Members</h3>
              <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                Users authorized to inspect discovery findings and participate in remediation approvals.
              </p>
            </div>
            <button
              onClick={() => setShowInviteModal(true)}
              className="btn btn-primary btn-sm"
              style={{ display: 'flex', alignItems: 'center', gap: 6 }}
            >
              <Plus size={15} />
              <span>Invite Team Member</span>
            </button>
          </div>

          {/* Members Table */}
          <div className="card" style={{ padding: 0, overflow: 'hidden', marginBottom: 24 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: 13 }}>
              <thead>
                <tr style={{ background: 'var(--surface-secondary)', borderBottom: '1px solid var(--border-medium)', color: 'var(--text-secondary)', fontSize: 12, fontWeight: 600 }}>
                  <th style={{ padding: '12px 18px' }}>User</th>
                  <th style={{ padding: '12px 18px' }}>Role</th>
                  <th style={{ padding: '12px 18px' }}>Status</th>
                  <th style={{ padding: '12px 18px' }}>Last Active</th>
                </tr>
              </thead>
              <tbody>
                {teamMembers.map((member) => (
                  <tr key={member.id} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                    <td style={{ padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{
                        width: 32,
                        height: 32,
                        borderRadius: '50%',
                        background: 'var(--surface-tertiary)',
                        color: 'var(--text-primary)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: 12,
                        fontWeight: 700
                      }}>
                        {member.name.split(' ').map(n => n[0]).join('')}
                      </div>
                      <div>
                        <div style={{ fontWeight: 600 }}>{member.name}</div>
                        <div style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>{member.email}</div>
                      </div>
                    </td>
                    <td style={{ padding: '14px 18px' }}>
                      <span style={{
                        padding: '3px 8px',
                        borderRadius: 9999,
                        fontSize: 11,
                        fontWeight: 600,
                        background: member.role === 'Owner' ? 'var(--apple-blue-light)' : 'var(--surface-secondary)',
                        color: member.role === 'Owner' ? 'var(--apple-blue)' : 'var(--text-secondary)'
                      }}>
                        {member.role}
                      </span>
                    </td>
                    <td style={{ padding: '14px 18px' }}>
                      <span style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 6,
                        color: member.status === 'active' ? 'var(--apple-emerald-dark)' : 'var(--apple-amber-dark)',
                        fontWeight: 500,
                        fontSize: 12
                      }}>
                        <div style={{
                          width: 6,
                          height: 6,
                          borderRadius: '50%',
                          background: member.status === 'active' ? 'var(--apple-emerald)' : 'var(--apple-amber)'
                        }} />
                        {member.status === 'active' ? 'Active' : 'Pending Invite'}
                      </span>
                    </td>
                    <td style={{ padding: '14px 18px', color: 'var(--text-secondary)' }}>
                      {member.lastActive}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Two-Person Approval Governance Setting */}
          <div className="card" style={{ padding: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 700, fontSize: 14 }}>
                  <Shield size={16} color="var(--apple-blue)" />
                  <span>Enforce Two-Person Approval on Critical Fixes</span>
                </div>
                <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 4, maxWidth: 600 }}>
                  When enabled, remediation actions with severity level "Critical" require authorization signatures from at least two distinct DevOps or Owner accounts before API dispatch.
                </p>
              </div>
              <input
                type="checkbox"
                checked={twoPersonRule}
                onChange={(e) => setTwoPersonRule(e.target.checked)}
                style={{ width: 20, height: 20, accentColor: 'var(--apple-blue)', cursor: 'pointer' }}
              />
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: AWS Accounts & Integrations */}
      {activeTab === 'aws' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div className="card" style={{ padding: 24 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <div>
                <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 4 }}>
                  Connected AWS Accounts ({accountConfig.isConnected ? '1 Active' : '0 Connected'})
                </h3>
                <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                  CloudPilot establishes least-privilege access using our Two-Role IAM architecture via CloudFormation stacks.
                </p>
              </div>
              <button
                onClick={() => {
                  sound.playClick();
                  navigate('/connect');
                }}
                className="btn btn-primary btn-sm"
              >
                <Plus size={14} />
                <span>Connect AWS Account</span>
              </button>
            </div>

            {accountConfig.isConnected ? (
              <div style={{ padding: 18, borderRadius: 12, border: '1px solid var(--border-medium)', background: 'var(--surface-secondary)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--apple-emerald)' }} />
                    <span style={{ fontWeight: 700, fontSize: 15 }}>{accountConfig.alias || `AWS Account ${accountConfig.accountId}`}</span>
                  </div>
                  <span style={{ fontSize: 11, padding: '3px 8px', borderRadius: 9999, background: 'var(--apple-emerald-light)', color: 'var(--apple-emerald-dark)', fontWeight: 700 }}>
                    STS CONNECTED
                  </span>
                </div>
                <div style={{ fontSize: 12.5, color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }}>
                  AWS Account ID: {accountConfig.accountId}
                </div>
                <div style={{ fontSize: 12.5, color: 'var(--text-secondary)', marginTop: 4 }}>
                  Target Region: <strong>{accountConfig.region}</strong>
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 10 }}>
                  Assumed Role: <code>arn:aws:iam::{accountConfig.accountId}:role/{accountConfig.roleName}</code>
                </div>
                <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
                  <button
                    onClick={() => {
                      sound.playSnap();
                      disconnectAccount();
                    }}
                    className="btn btn-secondary btn-sm"
                    style={{ color: 'var(--apple-red)' }}
                  >
                    Disconnect Account
                  </button>
                </div>
              </div>
            ) : (
              <div style={{ padding: 36, textAlign: 'center', borderRadius: 12, border: '1px dashed var(--border-medium)', background: '#FAF9F8' }}>
                <Zap size={28} color="var(--text-tertiary)" style={{ margin: '0 auto 10px' }} />
                <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 4 }}>No AWS Accounts Connected Yet</div>
                <div style={{ fontSize: 13, color: 'var(--text-secondary)', maxWidth: 460, margin: '0 auto 16px' }}>
                  Deploy our CloudFormation template to create the CloudPilotAuditRole, then connect your account using STS AssumeRole.
                </div>
                <button
                  onClick={() => {
                    sound.playClick();
                    navigate('/connect');
                  }}
                  className="btn btn-primary btn-sm"
                >
                  <Plus size={13} />
                  <span>Connect Real AWS Account</span>
                </button>
              </div>
            )}
          </div>
        </div>
      )}


      {/* TAB 4: Plan & Billing */}
      {activeTab === 'billing' && (
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 24 }}>
          <div className="card" style={{ padding: 24 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <div>
                <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--apple-blue)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  Current Subscription
                </span>
                <h3 style={{ fontSize: 24, fontWeight: 800, marginTop: 4 }}>Startup Pro Tier</h3>
                <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                  $149 / month • Billed annually • Next renewal on Nov 21, 2026
                </p>
              </div>
              <span style={{ padding: '6px 12px', borderRadius: 9999, background: 'var(--apple-emerald-light)', color: 'var(--apple-emerald-dark)', fontWeight: 700, fontSize: 12 }}>
                ACTIVE
              </span>
            </div>

            <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: 18, marginBottom: 20 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 8 }}>
                <span>AWS Accounts Usage</span>
                <strong>2 of 10 Accounts Active</strong>
              </div>
              <div style={{ height: 8, borderRadius: 4, background: 'var(--surface-tertiary)', overflow: 'hidden' }}>
                <div style={{ width: '20%', height: '100%', background: 'var(--apple-blue)' }} />
              </div>
            </div>

            <div style={{ display: 'flex', gap: 10 }}>
              <button className="btn btn-secondary btn-sm">Change Plan</button>
              <button className="btn btn-secondary btn-sm">Update Payment Method</button>
            </div>
          </div>

          <div className="card" style={{ padding: 20 }}>
            <h4 style={{ fontSize: 14, fontWeight: 700, marginBottom: 12 }}>Payment Method</h4>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
              <CreditCard size={20} color="var(--apple-blue)" />
              <div>
                <div style={{ fontSize: 13, fontWeight: 600 }}>Mastercard ending in 4092</div>
                <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>Expires 08/29</div>
              </div>
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)', borderTop: '1px solid var(--border-subtle)', paddingTop: 12 }}>
              Need custom invoicing for enterprise procurement? <span style={{ color: 'var(--apple-blue)', cursor: 'pointer', fontWeight: 600 }}>Contact sales</span>
            </div>
          </div>
        </div>
      )}

      {/* Invite Team Member Modal */}
      {showInviteModal && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0, 0, 0, 0.45)',
          backdropFilter: 'blur(4px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000
        }}>
          <div style={{
            width: '100%',
            maxWidth: 440,
            background: '#FFFFFF',
            borderRadius: 16,
            padding: 24,
            boxShadow: 'var(--shadow-floating)'
          }}>
            <h3 style={{ fontSize: 18, fontWeight: 800, marginBottom: 8 }}>Invite Team Member</h3>
            <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 20 }}>
              They will receive an invitation link to collaborate on finding discoveries and sign off on Safety Passports.
            </p>

            <form onSubmit={handleSendInvite}>
              <div style={{ marginBottom: 16 }}>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 6 }}>
                  Colleague's Work Email
                </label>
                <input
                  type="email"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  placeholder="alex@acmecloud.io"
                  required
                  style={{
                    width: '100%',
                    padding: '10px 14px',
                    borderRadius: 8,
                    border: '1px solid var(--border-medium)',
                    fontSize: 14
                  }}
                />
              </div>

              <div style={{ marginBottom: 24 }}>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 6 }}>
                  Role & Permissions
                </label>
                <select
                  value={inviteRole}
                  onChange={(e) => setInviteRole(e.target.value as any)}
                  style={{
                    width: '100%',
                    padding: '10px 14px',
                    borderRadius: 8,
                    border: '1px solid var(--border-medium)',
                    fontSize: 14,
                    background: '#FFFFFF'
                  }}
                >
                  <option value="DevOps Lead">DevOps Lead (Can review & approve remediation)</option>
                  <option value="Security Analyst">Security Analyst (Can inspect & verify findings)</option>
                  <option value="Admin">Admin (Full access to all accounts & settings)</option>
                  <option value="Viewer">Viewer (Read-only discovery audit)</option>
                </select>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                <button
                  type="button"
                  onClick={() => setShowInviteModal(false)}
                  className="btn btn-secondary btn-sm"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary btn-sm"
                >
                  Send Invitation
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
