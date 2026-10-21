import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import {
  Cloud, Copy, Shield,
  ArrowRight, Check, Sparkles, Lock, Layers
} from 'lucide-react';
import { useDemo } from '../context/useDemo';
import { type ScenarioType } from '../context/contextDefinition';
import { sound } from '../utils/soundEngine';

const CF_READ_TEMPLATE = `AWSTemplateFormatVersion: "2010-09-09"
Description: CloudPilot Safe Read-Only Discovery Role (Role 1 of 2)

Parameters:
  ExternalId:
    Type: String
    Default: "cp-tenant-9042-demo"
    Description: Unique external ID protecting against Confused Deputy attacks

Resources:
  CloudPilotDiscoveryRole:
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

const CF_REMEDIATION_TEMPLATE = `AWSTemplateFormatVersion: "2010-09-09"
Description: CloudPilot Scoped Remediation Execution Role (Role 2 of 2)

Resources:
  CloudPilotRemediationRole:
    Type: AWS::IAM::Role
    Properties:
      RoleName: CloudPilotRemediationRole
      AssumeRolePolicyDocument:
        Version: "2012-10-17"
        Statement:
          - Effect: Allow
            Principal:
              AWS: "arn:aws:iam::999888777666:root"
            Action: sts:AssumeRole
      Policies:
        - PolicyName: AtomicRemediationWhitelist
          PolicyDocument:
            Version: "2012-10-17"
            Statement:
              - Effect: Allow
                Action:
                  - ec2:RevokeSecurityGroupIngress
                  - ec2:StopInstances
                Resource: "*"
`;

export default function Connect() {
  const navigate = useNavigate();
  const { activeScenario, setScenario } = useDemo();
  const [activeTab, setActiveTab] = useState<'discovery' | 'remediation'>('discovery');
  const [copied, setCopied] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [connected, setConnected] = useState(false);

  const copyTemplate = () => {
    sound.playClick();
    const templateToCopy = activeTab === 'discovery' ? CF_READ_TEMPLATE : CF_REMEDIATION_TEMPLATE;
    navigator.clipboard.writeText(templateToCopy);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSelectScenario = (type: ScenarioType) => {
    sound.playClick();
    setScenario(type);
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
          CloudPilot enforces an isolated <strong>Two-Role Security Model</strong>: Read-only telemetry discovery is strictly decoupled from human-authorized atomic remediations.
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
              Select a sample AWS cloud environment with realistic cost leaks and security vulnerabilities:
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 24 }}>
              {/* Option 1: Fintech MVP */}
              <div
                onClick={() => handleSelectScenario('fintech')}
                style={{
                  padding: 16,
                  borderRadius: 14,
                  border: `2px solid ${activeScenario === 'fintech' ? 'var(--apple-blue)' : 'var(--border-subtle)'}`,
                  background: activeScenario === 'fintech' ? 'rgba(0, 113, 227, 0.04)' : '#FFFFFF',
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
                onClick={() => handleSelectScenario('student')}
                style={{
                  padding: 16,
                  borderRadius: 14,
                  border: `2px solid ${activeScenario === 'student' ? 'var(--apple-blue)' : 'var(--border-subtle)'}`,
                  background: activeScenario === 'student' ? 'rgba(0, 113, 227, 0.04)' : '#FFFFFF',
                  cursor: 'pointer',
                  transition: 'all 160ms ease'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                  <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--text-primary)' }}>
                    Student ML Research Sandbox
                  </div>
                  <span className="badge badge-high">High Cost Leak</span>
                </div>
                <div style={{ fontSize: 12.5, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                  Simulates an idle NVIDIA V100 GPU instance (p3.2xlarge, $2,203/mo run-rate), open port 8888, and over-provisioned io2 EBS.
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

        {/* Right Column: Two-Role IAM Architecture */}
        <div className="apple-card">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <div className="section-title">Verified CloudFormation Policies</div>
            <button onClick={copyTemplate} className="btn btn-secondary btn-sm" style={{ gap: 6 }}>
              {copied ? <Check size={12} color="var(--apple-emerald)" /> : <Copy size={12} />}
              {copied ? 'Copied YAML' : 'Copy YAML'}
            </button>
          </div>

          {/* Role Tabs */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
            <button
              onClick={() => {
                sound.playClick();
                setActiveTab('discovery');
              }}
              className={`btn btn-sm ${activeTab === 'discovery' ? 'btn-primary' : 'btn-secondary'}`}
              style={{ padding: '5px 12px', fontSize: 12 }}
            >
              Role 1: Read-Only Discovery
            </button>
            <button
              onClick={() => {
                sound.playClick();
                setActiveTab('remediation');
              }}
              className={`btn btn-sm ${activeTab === 'remediation' ? 'btn-primary' : 'btn-secondary'}`}
              style={{ padding: '5px 12px', fontSize: 12 }}
            >
              Role 2: Scoped Remediation
            </button>
          </div>

          <div className="code-block" style={{ maxHeight: 210, marginBottom: 14 }}>
            <pre style={{ margin: 0, fontSize: 11.5 }}>
              {activeTab === 'discovery' ? CF_READ_TEMPLATE : CF_REMEDIATION_TEMPLATE}
            </pre>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start', fontSize: 12 }}>
              <Shield size={15} color="var(--apple-emerald)" style={{ flexShrink: 0, marginTop: 2 }} />
              <div>
                <strong>Role 1 (Discovery):</strong> Scoped to <code>SecurityAudit</code>. Can never alter or delete cloud infrastructure.
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start', fontSize: 12 }}>
              <Layers size={15} color="var(--apple-blue)" style={{ flexShrink: 0, marginTop: 2 }} />
              <div>
                <strong>Role 2 (Remediation):</strong> Narrowly whitelists atomic changes, assumed exclusively upon explicit user authorization.
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start', fontSize: 12 }}>
              <Lock size={15} color="var(--apple-emerald)" style={{ flexShrink: 0, marginTop: 2 }} />
              <div>
                <strong>Confused Deputy Defense:</strong> Guaranteed unique <code>sts:ExternalId</code> for every tenant.
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
