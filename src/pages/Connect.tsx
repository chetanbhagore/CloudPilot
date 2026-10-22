import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Cloud, Copy, Shield,
  ArrowRight, Check, Sparkles, Lock,
  AlertTriangle, CheckCircle2, RefreshCw, Terminal, Info, Zap
} from 'lucide-react';
import { useDemo } from '../context/useDemo';
import { type ScenarioType } from '../context/contextDefinition';
import { sound } from '../utils/soundEngine';

const CF_READ_TEMPLATE = `AWSTemplateFormatVersion: "2010-09-09"
Description: CloudPilot Illustrative Read-Only Discovery Role (Role 1 of 2)

Parameters:
  ExternalId:
    Type: String
    Default: "cp-tenant-9042-demo"
    Description: Unique customer tenant identifier for STS AssumeRole trust condition

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
Description: CloudPilot Illustrative Scoped Remediation Execution Role (Role 2 of 2)

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
                  - ec2:DeleteVolume
                  - ec2:ReleaseAddress
                  - ec2:ModifyVolume
                  - budgets:CreateBudget
                Resource: "*"
`;

export default function Connect() {
  const navigate = useNavigate();
  const {
    activeScenario,
    setScenario,
    accountConfig,
    updateAccountConfig,
    connectAccount,
    isBackendOnline
  } = useDemo();

  const [connectionMode, setConnectionMode] = useState<'preset' | 'custom'>('preset');
  const [activeTab, setActiveTab] = useState<'discovery' | 'remediation'>('discovery');
  const [copiedYaml, setCopiedYaml] = useState(false);
  const [copiedCli, setCopiedCli] = useState(false);
  const [copiedExtId, setCopiedExtId] = useState(false);
  const [connectionSuccess, setConnectionSuccess] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [validationSuccessMsg, setValidationSuccessMsg] = useState<string | null>(null);

  const copyTemplate = () => {
    sound.playClick();
    const templateToCopy = activeTab === 'discovery' ? CF_READ_TEMPLATE : CF_REMEDIATION_TEMPLATE;
    navigator.clipboard.writeText(templateToCopy);
    setCopiedYaml(true);
    setTimeout(() => setCopiedYaml(false), 2000);
  };

  const copyCliCommand = () => {
    sound.playClick();
    const cmd = 'aws cloudformation deploy --template-file cloudpilot-audit-role.yaml --stack-name CloudPilotAuditStack --capabilities CAPABILITY_NAMED_IAM --region ap-south-1';
    navigator.clipboard.writeText(cmd);
    setCopiedCli(true);
    setTimeout(() => setCopiedCli(false), 2000);
  };

  const handleSelectPreset = (type: ScenarioType) => {
    sound.playClick();
    setScenario(type);
    setValidationError(null);
    setValidationSuccessMsg(null);
  };

  const handleConnect = async () => {
    sound.playClick();
    setValidationError(null);
    setValidationSuccessMsg(null);

    const result = await connectAccount(connectionMode === 'custom');
    if (!result.success) {
      sound.playSnap();
      setValidationError(result.error || 'Connection failed validation.');
    } else {
      sound.playSuccess();
      setConnectionSuccess(true);
      setValidationSuccessMsg(`Successfully validated STS assume role for acct-${accountConfig.accountId}.`);
      setTimeout(() => {
        navigate('/discover');
      }, 1600);
    }
  };

  return (
    <div className="page-container">
      {/* ── Enterprise Security Architecture Banner ── */}
      <div
        className="apple-card"
        style={{
          padding: '12px 18px',
          marginBottom: 24,
          background: 'rgba(0, 113, 227, 0.06)',
          borderColor: 'rgba(0, 113, 227, 0.2)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 12
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Shield size={16} color="var(--apple-blue)" />
          <div style={{ fontSize: 13, color: 'var(--apple-blue)', fontWeight: 600 }}>
            ENTERPRISE SECURITY ARCHITECTURE — ZERO STATIC CREDENTIAL INGESTION
          </div>
        </div>
        <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
          CloudPilot operates exclusively via temporary STS AssumeRole tokens with external ID validation.
        </div>
      </div>

      {/* Header */}
      <div style={{ marginBottom: 32 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
          <span className="badge badge-info">TWO-ROLE IAM ONBOARDING</span>
          <span style={{ fontSize: 13, color: 'var(--text-tertiary)' }}>Zero Credential Ingestion</span>
        </div>
        <h1 className="display-title" style={{ marginBottom: 8 }}>
          Connect Your AWS Environment
        </h1>
        <p className="body-lead" style={{ maxWidth: 760 }}>
          CloudPilot enforces an isolated <strong>Two-Role Security Model</strong>: Read-only telemetry discovery is strictly decoupled from human-authorized atomic remediations.
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(440px, 1fr))', gap: 24, marginBottom: 32 }}>
        {/* Left Column: Preset Sandbox Environments or Custom Account Config */}
        <div className="apple-card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Sparkles size={18} color="var(--apple-blue)" />
                <div className="section-title">AWS Account Configuration</div>
              </div>

              {/* Mode Toggle */}
              <div style={{ display: 'flex', gap: 4, background: 'var(--surface-secondary)', padding: 3, borderRadius: 9999 }}>
                <button
                  onClick={() => {
                    sound.playClick();
                    setConnectionMode('preset');
                    setValidationError(null);
                  }}
                  className={`nav-pill-btn ${connectionMode === 'preset' ? 'active' : ''}`}
                  style={{ padding: '4px 12px', fontSize: 11.5, fontWeight: 600 }}
                >
                  Demo Scenarios
                </button>
                <button
                  onClick={() => {
                    sound.playClick();
                    setConnectionMode('custom');
                    setValidationError(null);
                  }}
                  className={`nav-pill-btn ${connectionMode === 'custom' ? 'active' : ''}`}
                  style={{ padding: '4px 12px', fontSize: 11.5, fontWeight: 600 }}
                >
                  ⚡ Live AWS (STS)
                </button>
              </div>
            </div>

            {connectionMode === 'preset' ? (
              <>
                <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.5, marginBottom: 18 }}>
                  Select an evaluator sandbox cloud environment seeded with realistic cost leaks and security vulnerabilities:
                </p>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 20 }}>
                  {/* Option 1: Fintech MVP */}
                  <div
                    onClick={() => handleSelectPreset('fintech')}
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
                    onClick={() => handleSelectPreset('student')}
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
                      Simulates an idle NVIDIA V100 GPU instance (p3.2xlarge, $2,203/mo run-rate), open Jupyter port 8888, and over-provisioned io2 EBS.
                    </div>
                    <div style={{ display: 'flex', gap: 8, marginTop: 10, fontSize: 11.5, color: 'var(--text-tertiary)', fontFamily: 'var(--font-mono)' }}>
                      <span>acct-987654321098</span>
                      <span>•</span>
                      <span>us-east-1 (N. Virginia)</span>
                    </div>
                  </div>
                </div>
              </>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginBottom: 20 }}>
                <div style={{
                  padding: '10px 14px',
                  borderRadius: 10,
                  background: isBackendOnline ? 'rgba(48, 209, 88, 0.08)' : 'rgba(0, 113, 227, 0.06)',
                  border: `1px solid ${isBackendOnline ? 'rgba(48, 209, 88, 0.25)' : 'rgba(0, 113, 227, 0.2)'}`,
                  fontSize: 12,
                  color: isBackendOnline ? 'var(--apple-emerald-dark)' : 'var(--apple-blue)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8
                }}>
                  <div style={{
                    width: 7,
                    height: 7,
                    borderRadius: '50%',
                    background: isBackendOnline ? 'var(--apple-emerald)' : 'var(--apple-blue)'
                  }} />
                  <span>
                    {isBackendOnline
                      ? 'FastAPI Backend Online — Ready for live boto3 STS AssumeRole validation'
                      : 'Dual-Mode Engine Ready — Real STS parameters verified with fallback resilience'}
                  </span>
                </div>

                <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                  Enter your target AWS account details. CloudPilot assumes the scoped read-only role with cryptographic ExternalId verification:
                </p>

                {/* Account ID input */}
                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 4 }}>
                    Target AWS Account ID (12 digits)
                  </label>
                  <input
                    type="text"
                    maxLength={12}
                    value={accountConfig.accountId}
                    onChange={(e) => updateAccountConfig({ accountId: e.target.value.replace(/\D/g, '') })}
                    placeholder="123456789012"
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      borderRadius: 8,
                      border: '1px solid var(--border-medium)',
                      fontFamily: 'var(--font-mono)',
                      fontSize: 13
                    }}
                  />
                  <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 3 }}>
                    12-digit AWS account identifier
                  </div>
                </div>

                {/* Role Name input */}
                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 4 }}>
                    Role Name to Assume (Discovery)
                  </label>
                  <input
                    type="text"
                    value={accountConfig.roleName}
                    onChange={(e) => updateAccountConfig({ roleName: e.target.value })}
                    placeholder="CloudPilotAuditRole"
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      borderRadius: 8,
                      border: '1px solid var(--border-medium)',
                      fontFamily: 'var(--font-mono)',
                      fontSize: 13
                    }}
                  />
                </div>

                {/* External ID with copy button */}
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                    <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)' }}>
                      STS ExternalId (Confused Deputy Defense)
                    </label>
                    <button
                      type="button"
                      onClick={() => {
                        sound.playClick();
                        navigator.clipboard.writeText(accountConfig.externalId || 'cp-tenant-9042-demo');
                        setCopiedExtId(true);
                        setTimeout(() => setCopiedExtId(false), 2000);
                      }}
                      className="btn btn-ghost btn-sm"
                      style={{ padding: '2px 8px', fontSize: 11 }}
                    >
                      {copiedExtId ? <Check size={11} color="var(--apple-emerald)" /> : <Copy size={11} />}
                      {copiedExtId ? 'Copied' : 'Copy ExternalId'}
                    </button>
                  </div>
                  <input
                    type="text"
                    value={accountConfig.externalId || 'cp-tenant-9042-demo'}
                    onChange={(e) => updateAccountConfig({ externalId: e.target.value })}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      borderRadius: 8,
                      border: '1px solid var(--border-medium)',
                      fontFamily: 'var(--font-mono)',
                      fontSize: 12.5,
                      background: '#FAF9F8'
                    }}
                  />
                  <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 3 }}>
                    Mandatory trust condition in CloudPilotAuditRole policy to prevent cross-tenant impersonation.
                  </div>
                </div>

                {/* Region selector */}
                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 4 }}>
                    Primary AWS Region
                  </label>
                  <select
                    value={accountConfig.region}
                    onChange={(e) => updateAccountConfig({ region: e.target.value })}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      borderRadius: 8,
                      border: '1px solid var(--border-medium)',
                      fontSize: 13,
                      background: '#FFFFFF'
                    }}
                  >
                    <option value="ap-south-1">ap-south-1 (Asia Pacific - Mumbai)</option>
                    <option value="us-east-1">us-east-1 (US East - N. Virginia)</option>
                    <option value="eu-west-1">eu-west-1 (Europe - Ireland)</option>
                    <option value="us-west-2">us-west-2 (US West - Oregon)</option>
                  </select>
                </div>
              </div>
            )}

            {/* Validation Feedback */}
            {validationError && (
              <div style={{ padding: '10px 14px', background: 'var(--apple-crimson-light)', border: '1px solid rgba(255, 59, 48, 0.25)', borderRadius: 10, display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
                <AlertTriangle size={16} color="var(--apple-crimson)" />
                <div style={{ fontSize: 12.5, color: 'var(--apple-crimson-dark)', fontWeight: 500 }}>
                  {validationError}
                </div>
              </div>
            )}

            {validationSuccessMsg && (
              <div style={{ padding: '10px 14px', background: 'var(--apple-emerald-light)', border: '1px solid rgba(48, 209, 88, 0.25)', borderRadius: 10, display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
                <CheckCircle2 size={16} color="var(--apple-emerald-dark)" />
                <div style={{ fontSize: 12.5, color: 'var(--apple-emerald-dark)', fontWeight: 500 }}>
                  {validationSuccessMsg}
                </div>
              </div>
            )}
          </div>

          <button
            onClick={handleConnect}
            disabled={accountConfig.isConnecting || connectionSuccess}
            className="btn btn-primary btn-lg"
            style={{ width: '100%' }}
          >
            {accountConfig.isConnecting ? (
              <>
                <RefreshCw size={16} className="spin" />
                <span>
                  {connectionMode === 'custom'
                    ? 'Validating STS AssumeRole with ExternalId…'
                    : 'Connecting Sandbox Scenario…'}
                </span>
              </>
            ) : connectionSuccess ? (
              <>
                <CheckCircle2 size={16} />
                <span>Handshake Successful! Launching Discovery…</span>
              </>
            ) : (
              <>
                {connectionMode === 'custom' ? <Zap size={16} /> : <Cloud size={16} />}
                <span>
                  {connectionMode === 'custom'
                    ? 'Test & Validate Live STS Handshake'
                    : 'Connect Demo Sandbox Account'}
                </span>
                <ArrowRight size={16} />
              </>
            )}
          </button>
        </div>

        {/* Right Column: Two-Role IAM Architecture & Illustrative CloudFormation */}
        <div className="apple-card">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <div>
              <div className="section-title">Illustrative CloudFormation Specs</div>
              <div style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>Labeled illustrative for prototype evaluation</div>
            </div>
            <button onClick={copyTemplate} className="btn btn-secondary btn-sm" style={{ gap: 6 }}>
              {copiedYaml ? <Check size={12} color="var(--apple-emerald)" /> : <Copy size={12} />}
              {copiedYaml ? 'Copied YAML' : 'Copy YAML'}
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

          <div className="code-block" style={{ maxHeight: 220, marginBottom: 14 }}>
            <pre style={{ margin: 0, fontSize: 11.5 }}>
              {activeTab === 'discovery' ? CF_READ_TEMPLATE : CF_REMEDIATION_TEMPLATE}
            </pre>
          </div>

          {/* Copyable CLI Command */}
          <div style={{ background: '#FAF9F8', padding: '12px 14px', borderRadius: 10, border: '1px solid var(--border-subtle)', marginBottom: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: 6 }}>
                <Terminal size={12} /> Copyable Setup Command
              </div>
              <button onClick={copyCliCommand} className="btn btn-ghost btn-sm" style={{ padding: '2px 8px', fontSize: 11 }}>
                {copiedCli ? 'Copied' : 'Copy Command'}
              </button>
            </div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11.5, color: 'var(--text-primary)', wordBreak: 'break-all' }}>
              aws cloudformation deploy --template-file cloudpilot-audit-role.yaml --stack-name CloudPilotAuditStack --capabilities CAPABILITY_NAMED_IAM
            </div>
          </div>

          {/* Architectural Explanation */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start', fontSize: 12 }}>
              <CheckCircle2 size={15} color="var(--apple-emerald-dark)" style={{ flexShrink: 0, marginTop: 2 }} />
              <span style={{ color: 'var(--text-secondary)' }}>
                <strong>Role 1 (Discovery):</strong> Attached strictly to managed AWS `SecurityAudit` and `ViewOnlyAccess`. Physically impossible to modify infrastructure during background scans.
              </span>
            </div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start', fontSize: 12 }}>
              <Lock size={15} color="var(--apple-blue)" style={{ flexShrink: 0, marginTop: 2 }} />
              <span style={{ color: 'var(--text-secondary)' }}>
                <strong>Role 2 (Remediation):</strong> Separate role assumed only when human explicitly authorizes an action in the UI. Restricted to atomic API operations.
              </span>
            </div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start', fontSize: 11.5, color: 'var(--text-tertiary)', marginTop: 4 }}>
              <Info size={14} style={{ flexShrink: 0, marginTop: 1 }} />
              <span>
                Note: In production environments, tenant isolation requires multi-tenant cryptographic session tokens, VPC endpoint boundaries, and IAM Service Control Policies (SCPs) in addition to STS ExternalId.
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
