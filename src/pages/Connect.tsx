import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import {
  Cloud, Copy, Shield,
  ArrowRight, Check, Sparkles, Lock
} from 'lucide-react';
import { sound } from '../utils/soundEngine';

const CF_TEMPLATE = `AWSTemplateFormatVersion: "2010-09-09"
Description: CloudPilot Safe Read-Only Audit Role

Parameters:
  ExternalId:
    Type: String
    Default: "cp-tenant-9042-demo"
    Description: Unique external ID protecting against Confused Deputy attacks

Resources:
  CloudPilotReadRole:
    Type: AWS::IAM::Role
    Properties:
      RoleName: CloudPilotAuditRole
      AssumeRolePolicyDocument:
        Version: "2012-10-17"
        Statement:
          - Effect: Allow
            Principal:
              AWS: "arn:aws:iam::999888777666:root"
            Action: sts:AssumeRole
            Condition:
              StringEquals:
                sts:ExternalId: !Ref ExternalId
      ManagedPolicyArns:
        - arn:aws:iam::aws:policy/SecurityAudit
        - arn:aws:iam::aws:policy/job-function/ViewOnlyAccess
`;

export default function Connect() {
  const navigate = useNavigate();
  const [selectedPreset, setSelectedPreset] = useState<'fintech' | 'student'>('fintech');
  const [copied, setCopied] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [connected, setConnected] = useState(false);

  const copyTemplate = () => {
    sound.playClick();
    navigator.clipboard.writeText(CF_TEMPLATE);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleStartConnect = () => {
    sound.playClick();
    setConnecting(true);
    setTimeout(() => {
      sound.playSuccess();
      setConnecting(false);
      setConnected(true);
      setTimeout(() => {
        navigate('/discover');
      }, 1500);
    }, 1800);
  };

  return (
    <div className="page-container">
      {/* Header */}
      <div style={{ marginBottom: 32 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
          <span className="badge badge-info">STAGE 1 OF 5</span>
          <span style={{ fontSize: 13, color: 'var(--text-tertiary)' }}>Zero Credential Ingestion</span>
        </div>
        <h1 className="display-title" style={{ marginBottom: 8 }}>
          Connect Your AWS Environment
        </h1>
        <p className="body-lead" style={{ maxWidth: 720 }}>
          CloudPilot operates using standard AWS IAM Cross-Account Roles. No AWS secret keys or administrative passwords are ever required or stored.
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(420px, 1fr))', gap: 24, marginBottom: 32 }}>
        {/* Left Column: Preset Sandbox Environments */}
        <div className="apple-card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
              <Sparkles size={18} color="var(--apple-blue)" />
              <div className="section-title">One-Click Demo Sandbox</div>
            </div>
            <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.5, marginBottom: 20 }}>
              Select a pre-configured sample AWS cloud environment with realistic cost leaks and security misconfigurations for your pitch presentation:
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 24 }}>
              {/* Option 1: Fintech MVP */}
              <div
                onClick={() => {
                  sound.playClick();
                  setSelectedPreset('fintech');
                }}
                style={{
                  padding: 16,
                  borderRadius: 14,
                  border: `2px solid ${selectedPreset === 'fintech' ? 'var(--apple-blue)' : 'var(--border-subtle)'}`,
                  background: selectedPreset === 'fintech' ? 'rgba(0, 113, 227, 0.04)' : '#FFFFFF',
                  cursor: 'pointer',
                  transition: 'all 160ms ease'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                  <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--text-primary)' }}>
                    Early-Stage FinTech Startup (MVP)
                  </div>
                  <span className="badge badge-critical">1 Critical Vuln</span>
                </div>
                <div style={{ fontSize: 12.5, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                  Simulates a 47-resource stack: 1 exposed SSH port 22 to 0.0.0.0/0, unattached gp3 EBS volume, and unassociated Elastic IP.
                </div>
                <div style={{ display: 'flex', gap: 8, marginTop: 10, fontSize: 11.5, color: 'var(--text-tertiary)', fontFamily: 'var(--font-mono)' }}>
                  <span>acct-123456789012</span>
                  <span>•</span>
                  <span>ap-south-1 (Mumbai)</span>
                </div>
              </div>

              {/* Option 2: Student ML Project */}
              <div
                onClick={() => {
                  sound.playClick();
                  setSelectedPreset('student');
                }}
                style={{
                  padding: 16,
                  borderRadius: 14,
                  border: `2px solid ${selectedPreset === 'student' ? 'var(--apple-blue)' : 'var(--border-subtle)'}`,
                  background: selectedPreset === 'student' ? 'rgba(0, 113, 227, 0.04)' : '#FFFFFF',
                  cursor: 'pointer',
                  transition: 'all 160ms ease'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                  <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--text-primary)' }}>
                    Student ML Research Sandbox
                  </div>
                  <span className="badge badge-high">High Waste</span>
                </div>
                <div style={{ fontSize: 12.5, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                  Simulates a research lab with an idle GPU p3.2xlarge instance running over weekend and unconfigured budget alerts.
                </div>
                <div style={{ display: 'flex', gap: 8, marginTop: 10, fontSize: 11.5, color: 'var(--text-tertiary)', fontFamily: 'var(--font-mono)' }}>
                  <span>acct-987654321098</span>
                  <span>•</span>
                  <span>us-east-1 (N. Virginia)</span>
                </div>
              </div>
            </div>
          </div>

          <button
            onClick={handleStartConnect}
            disabled={connecting || connected}
            className="btn btn-primary btn-lg"
            style={{ width: '100%' }}
          >
            {connecting ? (
              <span>Assuming Read-Only IAM Role…</span>
            ) : connected ? (
              <span>Connected! Launching Discovery…</span>
            ) : (
              <>
                <Cloud size={16} />
                <span>Connect Selected Sandbox Account</span>
                <ArrowRight size={16} />
              </>
            )}
          </button>
        </div>

        {/* Right Column: Zero-Trust Security Guarantees */}
        <div className="apple-card">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
            <div className="section-title">Verified CloudFormation Template</div>
            <button onClick={copyTemplate} className="btn btn-secondary btn-sm" style={{ gap: 6 }}>
              {copied ? <Check size={12} color="var(--apple-emerald)" /> : <Copy size={12} />}
              {copied ? 'Copied YAML' : 'Copy YAML'}
            </button>
          </div>

          <p style={{ fontSize: 12.5, color: 'var(--text-secondary)', marginBottom: 12 }}>
            In production, customers deploy this 1-click template in their AWS CloudFormation console. Notice the strictly scoped read-only policies:
          </p>

          <div className="code-block" style={{ maxHeight: 220, marginBottom: 16 }}>
            <pre style={{ margin: 0, fontSize: 11.5 }}>{CF_TEMPLATE}</pre>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start', fontSize: 12.5 }}>
              <Shield size={16} color="var(--apple-emerald)" style={{ flexShrink: 0, marginTop: 2 }} />
              <div>
                <strong style={{ color: 'var(--text-primary)' }}>SecurityAudit Read-Only:</strong> CloudPilot can never modify infrastructure during scans.
              </div>
            </div>
            <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start', fontSize: 12.5 }}>
              <Lock size={16} color="var(--apple-emerald)" style={{ flexShrink: 0, marginTop: 2 }} />
              <div>
                <strong style={{ color: 'var(--text-primary)' }}>Confused Deputy Defense:</strong> Guaranteed unique <code>sts:ExternalId</code> for every tenant.
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Progress Dialog when connecting */}
      <AnimatePresence>
        {connecting && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            className="apple-card"
            style={{
              maxWidth: 500,
              margin: '0 auto',
              textAlign: 'center',
              padding: '28px 24px',
              border: '1px solid var(--apple-blue)',
              background: '#FFFFFF'
            }}
          >
            <div style={{ width: 48, height: 48, margin: '0 auto 16px', borderRadius: '50%', background: 'var(--apple-blue-light)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Cloud size={24} color="var(--apple-blue)" />
            </div>
            <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 6 }}>
              Verifying STS AssumeRole Handshake
            </h3>
            <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
              Checking external ID condition and confirming SecurityAudit policy attachment...
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
