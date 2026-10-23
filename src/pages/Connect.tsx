import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Copy, Shield, ArrowRight, Check,
  AlertTriangle, CheckCircle2, RefreshCw, Terminal, Zap
} from 'lucide-react';
import { useDemo } from '../context/useDemo';
import { sound } from '../utils/soundEngine';

const CF_READ_TEMPLATE = `AWSTemplateFormatVersion: "2010-09-09"
Description: CloudPilot Production Read-Only Discovery Role (Role 1 of 2)

Parameters:
  ExternalId:
    Type: String
    MinLength: 16
    MaxLength: 128
    AllowedPattern: "^[a-zA-Z0-9_-]+$"
    Description: Unique customer tenant identifier for STS AssumeRole trust condition

Resources:
  CloudPilotDiscoveryRole:
    Type: AWS::IAM::Role
    Properties:
      RoleName: CloudPilotAuditRole
      AssumeRolePolicyDocument:
        Version: "2012-10-17"
        Statement:
          - Sid: EnforceOperatorPrincipalWithExternalId
            Effect: Allow
            Principal:
              AWS: "arn:aws:iam::999888777666:role/CloudPilotOperatorRole"
            Action: sts:AssumeRole
            Condition:
              StringEquals:
                sts:ExternalId: !Ref ExternalId
      ManagedPolicyArns:
        - arn:aws:iam::aws:policy/SecurityAudit
        - arn:aws:iam::aws:policy/job-function/ViewOnlyAccess
`;

const CF_REMEDIATION_TEMPLATE = `AWSTemplateFormatVersion: "2010-09-09"
Description: CloudPilot Hardened Scoped Remediation Execution Role (Role 2 of 2)

Parameters:
  ExternalId:
    Type: String
    MinLength: 16
    MaxLength: 128
    AllowedPattern: "^[a-zA-Z0-9_-]+$"
    Description: Unique customer tenant ExternalId matching Role 1 trust condition

Resources:
  CloudPilotRemediationRole:
    Type: AWS::IAM::Role
    Properties:
      RoleName: CloudPilotRemediationRole
      AssumeRolePolicyDocument:
        Version: "2012-10-17"
        Statement:
          - Sid: EnforceOperatorPrincipalWithExternalIdRemediation
            Effect: Allow
            Principal:
              AWS: "arn:aws:iam::999888777666:role/CloudPilotOperatorRole"
            Action: sts:AssumeRole
            Condition:
              StringEquals:
                sts:ExternalId: !Ref ExternalId
      Policies:
        - PolicyName: AtomicRemediationPermissions
          PolicyDocument:
            Version: "2012-10-17"
            Statement:
              - Sid: DescribeSecurityGroupsVerification
                Effect: Allow
                Action:
                  - ec2:DescribeSecurityGroups
                Resource: "*"
              - Sid: ScopedRevokeSecurityGroupIngress
                Effect: Allow
                Action:
                  - ec2:RevokeSecurityGroupIngress
                Resource: !Sub "arn:aws:ec2:*:\${AWS::AccountId}:security-group/*"
`;

export default function Connect() {
  const navigate = useNavigate();
  const {
    accountConfig,
    updateAccountConfig,
    connectAccount,
    isBackendOnline
  } = useDemo();

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
    const cmd = 'aws cloudformation deploy --template-file backend/cloudformation/cloudpilot-roles.yaml --stack-name CloudPilotAuditStack --capabilities CAPABILITY_NAMED_IAM';
    navigator.clipboard.writeText(cmd);
    setCopiedCli(true);
    setTimeout(() => setCopiedCli(false), 2000);
  };

  const handleConnect = async () => {
    sound.playClick();
    setValidationError(null);
    setValidationSuccessMsg(null);

    const result = await connectAccount(true);
    if (!result.success) {
      sound.playSnap();
      setValidationError(result.error || 'Connection failed validation.');
    } else {
      sound.playSuccess();
      setConnectionSuccess(true);
      setValidationSuccessMsg(`Successfully validated STS AssumeRole session for acct-${accountConfig.accountId}.`);
      setTimeout(() => {
        navigate('/discover');
      }, 1500);
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
            REAL AWS STS INTEGRATION — ZERO LONG-LIVED CREDENTIAL INGESTION
          </div>
        </div>
        <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
          CloudPilot operates strictly via temporary AWS STS AssumeRole credentials with ExternalId validation.
        </div>
      </div>

      {/* Header */}
      <div style={{ marginBottom: 32 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
          <span className="badge badge-info">LIVE AWS ONBOARDING</span>
          <span style={{ fontSize: 13, color: 'var(--text-tertiary)' }}>Two-Role IAM Model</span>
        </div>
        <h1 className="display-title" style={{ marginBottom: 8 }}>
          Connect Your AWS Account
        </h1>
        <p className="body-lead" style={{ maxWidth: 760 }}>
          Connect your AWS account via cross-account IAM Role with STS AssumeRole. Read-only discovery telemetry is strictly isolated from human-approved atomic remediations.
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(440px, 1fr))', gap: 24, marginBottom: 32 }}>
        {/* Left Column: Real AWS Account Connection Form */}
        <div className="apple-card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Zap size={18} color="var(--apple-blue)" />
                <div className="section-title">AWS STS Connection Credentials</div>
              </div>

              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                padding: '4px 10px',
                borderRadius: 9999,
                fontSize: 11.5,
                fontWeight: 600,
                background: isBackendOnline ? 'var(--apple-emerald-light)' : 'rgba(255, 59, 48, 0.1)',
                color: isBackendOnline ? 'var(--apple-emerald-dark)' : 'var(--apple-red)'
              }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'currentColor' }} />
                <span>{isBackendOnline ? 'FastAPI Online' : 'FastAPI Offline'}</span>
              </div>
            </div>

            {/* Connection Method Selector */}
            <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
              <button
                type="button"
                onClick={() => {
                  sound.playClick();
                  updateAccountConfig({
                    cloudProvider: 'aws',
                    connectionType: 'role_arn',
                    accountId: '',
                    roleName: 'CloudPilotAuditRole',
                    region: 'ap-south-1',
                    endpointUrl: undefined
                  });
                }}
                className={`btn btn-sm ${accountConfig.cloudProvider !== 'azure' && accountConfig.connectionType !== 'localstack' ? 'btn-primary' : 'btn-secondary'}`}
                style={{ flex: 1, fontSize: 11.5 }}
              >
                AWS IAM Role
              </button>
              <button
                type="button"
                onClick={() => {
                  sound.playClick();
                  updateAccountConfig({
                    cloudProvider: 'azure',
                    connectionType: 'azure_sp',
                    accountId: '',
                    roleName: 'ServicePrincipal',
                    region: 'eastus',
                    azureSubscriptionId: '',
                    azureTenantId: '',
                    azureClientId: '',
                    azureClientSecret: ''
                  });
                }}
                className={`btn btn-sm ${accountConfig.cloudProvider === 'azure' ? 'btn-primary' : 'btn-secondary'}`}
                style={{ flex: 1, fontSize: 11.5 }}
              >
                Microsoft Azure (Student / SP)
              </button>
              <button
                type="button"
                onClick={() => {
                  sound.playClick();
                  updateAccountConfig({
                    cloudProvider: 'aws',
                    connectionType: 'localstack',
                    accountId: '000000000000',
                    roleName: 'LocalStackRole',
                    region: 'us-east-1',
                    endpointUrl: 'http://localhost:4566',
                    externalId: 'localstack-tenant-0000'
                  });
                }}
                className={`btn btn-sm ${accountConfig.cloudProvider !== 'azure' && accountConfig.connectionType === 'localstack' ? 'btn-primary' : 'btn-secondary'}`}
                style={{ flex: 1, fontSize: 11.5 }}
              >
                LocalStack (Offline)
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginBottom: 20 }}>
              <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                {accountConfig.cloudProvider === 'azure'
                  ? 'Connect your Azure Student or Enterprise Subscription using a scoped Service Principal. Performs real ARM REST scans against NSGs, Disks, Public IPs, and Storage Accounts:'
                  : accountConfig.connectionType === 'localstack'
                    ? 'Connect directly to your local LocalStack emulator on http://localhost:4566. Performs real boto3 calls against local EC2/S3/VPC with zero AWS cloud costs.'
                    : 'Deploy the CloudFormation template on your target AWS account, then enter your account ID and role name below. CloudPilot will perform a live STS AssumeRole handshake:'}
              </p>

              {accountConfig.cloudProvider === 'azure' ? (
                <>
                  {/* Azure Subscription ID input */}
                  <div>
                    <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 4 }}>
                      Azure Subscription ID (GUID) *
                    </label>
                    <input
                      type="text"
                      value={accountConfig.azureSubscriptionId || accountConfig.accountId || ''}
                      onChange={(e) => updateAccountConfig({ azureSubscriptionId: e.target.value.trim(), accountId: e.target.value.trim() })}
                      placeholder="e.g. 00000000-0000-0000-0000-000000000000"
                      style={{
                        width: '100%',
                        padding: '9px 12px',
                        borderRadius: 8,
                        border: '1px solid var(--border-medium)',
                        fontFamily: 'var(--font-mono)',
                        fontSize: 12.5
                      }}
                    />
                    <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 3 }}>
                      Found in Azure Portal ➔ Subscriptions (e.g. Azure for Students)
                    </div>
                  </div>

                  {/* Azure Tenant ID input */}
                  <div>
                    <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 4 }}>
                      Directory (Tenant) ID (GUID) *
                    </label>
                    <input
                      type="text"
                      value={accountConfig.azureTenantId || ''}
                      onChange={(e) => updateAccountConfig({ azureTenantId: e.target.value.trim() })}
                      placeholder="e.g. 11111111-1111-1111-1111-111111111111"
                      style={{
                        width: '100%',
                        padding: '9px 12px',
                        borderRadius: 8,
                        border: '1px solid var(--border-medium)',
                        fontFamily: 'var(--font-mono)',
                        fontSize: 12.5
                      }}
                    />
                    <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 3 }}>
                      Microsoft Entra ID ➔ Overview ➔ Tenant ID
                    </div>
                  </div>

                  {/* Azure Client ID input */}
                  <div>
                    <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 4 }}>
                      Application (Client) ID (GUID) *
                    </label>
                    <input
                      type="text"
                      value={accountConfig.azureClientId || ''}
                      onChange={(e) => updateAccountConfig({ azureClientId: e.target.value.trim() })}
                      placeholder="e.g. 22222222-2222-2222-2222-222222222222"
                      style={{
                        width: '100%',
                        padding: '9px 12px',
                        borderRadius: 8,
                        border: '1px solid var(--border-medium)',
                        fontFamily: 'var(--font-mono)',
                        fontSize: 12.5
                      }}
                    />
                    <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 3 }}>
                      Microsoft Entra ID ➔ App Registrations ➔ Application ID
                    </div>
                  </div>

                  {/* Azure Client Secret input */}
                  <div>
                    <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 4 }}>
                      Client Secret (Value) *
                    </label>
                    <input
                      type="password"
                      value={accountConfig.azureClientSecret || ''}
                      onChange={(e) => updateAccountConfig({ azureClientSecret: e.target.value.trim() })}
                      placeholder="Enter Client Secret Value"
                      style={{
                        width: '100%',
                        padding: '9px 12px',
                        borderRadius: 8,
                        border: '1px solid var(--border-medium)',
                        fontFamily: 'var(--font-mono)',
                        fontSize: 12.5
                      }}
                    />
                    <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 3 }}>
                      App Registrations ➔ Certificates & Secrets ➔ Value
                    </div>
                  </div>

                  {/* Azure Region */}
                  <div>
                    <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 4 }}>
                      Primary Azure Region
                    </label>
                    <select
                      value={accountConfig.region}
                      onChange={(e) => updateAccountConfig({ region: e.target.value })}
                      style={{
                        width: '100%',
                        padding: '9px 12px',
                        borderRadius: 8,
                        border: '1px solid var(--border-medium)',
                        fontSize: 13,
                        background: '#FFFFFF'
                      }}
                    >
                      <option value="eastus">eastus (US East)</option>
                      <option value="centralindia">centralindia (Central India - Pune)</option>
                      <option value="westeurope">westeurope (West Europe - Netherlands)</option>
                      <option value="southeastasia">southeastasia (Southeast Asia - Singapore)</option>
                      <option value="westus2">westus2 (US West 2)</option>
                    </select>
                  </div>
                </>
              ) : (
                <>
                  {/* Account ID input */}
                  <div>
                    <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 4 }}>
                      AWS Account ID (12 digits) *
                    </label>
                    <input
                      type="text"
                      maxLength={12}
                      value={accountConfig.accountId}
                      onChange={(e) => updateAccountConfig({ accountId: e.target.value.replace(/\D/g, '') })}
                      placeholder="e.g. 123456789012"
                      style={{
                        width: '100%',
                        padding: '9px 12px',
                        borderRadius: 8,
                        border: '1px solid var(--border-medium)',
                        fontFamily: 'var(--font-mono)',
                        fontSize: 13
                      }}
                    />
                    <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 3 }}>
                      Your 12-digit AWS account number found in the AWS Management Console
                    </div>
                  </div>

                  {/* Role Name input */}
                  <div>
                    <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 4 }}>
                      IAM Role Name to Assume (Discovery) *
                    </label>
                    <input
                      type="text"
                      value={accountConfig.roleName}
                      onChange={(e) => updateAccountConfig({ roleName: e.target.value })}
                      placeholder="CloudPilotAuditRole"
                      style={{
                        width: '100%',
                        padding: '9px 12px',
                        borderRadius: 8,
                        border: '1px solid var(--border-medium)',
                        fontFamily: 'var(--font-mono)',
                        fontSize: 13
                      }}
                    />
                    <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 3 }}>
                      Role configured in your AWS IAM with SecurityAudit and ViewOnlyAccess
                    </div>
                  </div>

                  {/* External ID with copy button */}
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                      <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)' }}>
                        STS ExternalId (Confused Deputy Defense) *
                      </label>
                      <button
                        type="button"
                        onClick={() => {
                          sound.playClick();
                          navigator.clipboard.writeText(accountConfig.externalId || 'cp-tenant-live');
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
                      value={accountConfig.externalId || ''}
                      onChange={(e) => updateAccountConfig({ externalId: e.target.value })}
                      placeholder="cp-tenant-..."
                      style={{
                        width: '100%',
                        padding: '9px 12px',
                        borderRadius: 8,
                        border: '1px solid var(--border-medium)',
                        fontFamily: 'var(--font-mono)',
                        fontSize: 12.5,
                        background: '#FAF9F8'
                      }}
                    />
                    <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 3 }}>
                      Required condition parameter in trust policy to prevent cross-tenant confused deputy attacks.
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
                        padding: '9px 12px',
                        borderRadius: 8,
                        border: '1px solid var(--border-medium)',
                        fontSize: 13,
                        background: '#FFFFFF'
                      }}
                    >
                      <option value="us-east-1">us-east-1 (US East - N. Virginia)</option>
                      <option value="ap-south-1">ap-south-1 (Asia Pacific - Mumbai)</option>
                      <option value="us-west-2">us-west-2 (US West - Oregon)</option>
                      <option value="eu-west-1">eu-west-1 (Europe - Ireland)</option>
                      <option value="eu-central-1">eu-central-1 (Europe - Frankfurt)</option>
                      <option value="ap-southeast-1">ap-southeast-1 (Asia Pacific - Singapore)</option>
                    </select>
                  </div>
                </>
              )}
            </div>

            {/* Validation Feedback */}
            {validationError && (
              <div style={{ padding: '12px 14px', background: 'var(--apple-crimson-light)', border: '1px solid rgba(255, 59, 48, 0.25)', borderRadius: 10, display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 16 }}>
                <AlertTriangle size={18} color="var(--apple-crimson)" style={{ flexShrink: 0, marginTop: 2 }} />
                <div>
                  <div style={{ fontSize: 13, color: 'var(--apple-crimson-dark)', fontWeight: 600, marginBottom: 2 }}>
                    {accountConfig.cloudProvider === 'azure' ? 'Azure Connection Failed' : 'AWS STS Connection Failed'}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-primary)', lineHeight: 1.4 }}>
                    {validationError}
                  </div>
                </div>
              </div>
            )}

            {validationSuccessMsg && (
              <div style={{ padding: '12px 14px', background: 'var(--apple-emerald-light)', border: '1px solid rgba(48, 209, 88, 0.25)', borderRadius: 10, display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
                <CheckCircle2 size={18} color="var(--apple-emerald-dark)" />
                <div style={{ fontSize: 12.5, color: 'var(--apple-emerald-dark)', fontWeight: 600 }}>
                  {validationSuccessMsg}
                </div>
              </div>
            )}
          </div>

          <button
            onClick={handleConnect}
            disabled={accountConfig.isConnecting || connectionSuccess || (!accountConfig.accountId && !accountConfig.azureSubscriptionId) || !isBackendOnline}
            className="btn btn-primary btn-lg"
            style={{ width: '100%', marginTop: 8 }}
          >
            {accountConfig.isConnecting ? (
              <>
                <RefreshCw size={16} className="spin" />
                <span>{accountConfig.cloudProvider === 'azure' ? 'Authenticating with Microsoft Entra ID…' : 'Performing AWS STS AssumeRole Handshake…'}</span>
              </>
            ) : connectionSuccess ? (
              <>
                <CheckCircle2 size={16} />
                <span>{accountConfig.cloudProvider === 'azure' ? 'Azure Subscription Verified! Launching Live Scan…' : 'STS Handshake Verified! Launching Live Scan…'}</span>
              </>
            ) : (
              <>
                <Zap size={16} />
                <span>{accountConfig.cloudProvider === 'azure' ? 'Verify & Connect Azure Subscription' : accountConfig.connectionType === 'localstack' ? 'Verify & Connect LocalStack' : 'Initiate Live STS Connection'}</span>
                <ArrowRight size={16} />
              </>
            )}
          </button>
        </div>

        {/* Right Column: Deployment Templates / CLI Onboarding */}
        <div className="apple-card">
          {accountConfig.cloudProvider === 'azure' ? (
            <>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                <div>
                  <div className="section-title">Azure Service Principal Setup</div>
                  <div style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>Create a scoped Reader role in your Azure Student Account</div>
                </div>
                <button
                  onClick={() => {
                    sound.playClick();
                    const subId = accountConfig.azureSubscriptionId || '<YOUR_SUBSCRIPTION_ID>';
                    const cmd = `az ad sp create-for-rbac --name "CloudPilotAudit" --role "Reader" --scopes /subscriptions/${subId}`;
                    navigator.clipboard.writeText(cmd);
                    setCopiedCli(true);
                    setTimeout(() => setCopiedCli(false), 2000);
                  }}
                  className="btn btn-secondary btn-sm"
                  style={{ gap: 6 }}
                >
                  {copiedCli ? <Check size={12} color="var(--apple-emerald)" /> : <Copy size={12} />}
                  {copiedCli ? 'Copied' : 'Copy Azure CLI'}
                </button>
              </div>

              {/* Instructions */}
              <div style={{ background: '#FAF9F8', padding: '14px 16px', borderRadius: 10, border: '1px solid var(--border-subtle)', marginBottom: 16 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--apple-blue)', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Terminal size={14} /> 1-Command Setup (Azure Cloud Shell or Local Terminal)
                </div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11.5, color: 'var(--text-primary)', wordBreak: 'break-all', background: '#FFFFFF', padding: '10px 12px', borderRadius: 8, border: '1px solid var(--border-medium)', marginBottom: 10 }}>
                  az ad sp create-for-rbac --name "CloudPilotAudit" --role "Reader" --scopes /subscriptions/{accountConfig.azureSubscriptionId || '&lt;YOUR_SUBSCRIPTION_ID&gt;'}
                </div>
                <div style={{ fontSize: 11.5, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                  This command outputs a JSON with <strong>appId</strong> (Client ID), <strong>password</strong> (Client Secret), and <strong>tenant</strong> (Tenant ID). Paste those values into the form on the left.
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                  <strong>Real OAuth2 Bearer Handshake:</strong> CloudPilot communicates directly with Microsoft Entra ID (<code>login.microsoftonline.com</code>). Tokens are strictly ephemeral and refreshed before 1-hour expiry.
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                  <strong>Scoped Reader Permissions:</strong> Scoped exclusively to your subscription with read-only access to discover open NSGs, idle disks, and public blobs.
                </div>
              </div>
            </>
          ) : (
            <>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                <div>
                  <div className="section-title">Production IAM CloudFormation Templates</div>
                  <div style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>Deploy to your AWS account before connecting</div>
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
                    <Terminal size={12} /> AWS CLI One-Line Deploy Command
                  </div>
                  <button onClick={copyCliCommand} className="btn btn-ghost btn-sm" style={{ padding: '2px 8px', fontSize: 11 }}>
                    {copiedCli ? 'Copied' : 'Copy Command'}
                  </button>
                </div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11.5, color: 'var(--text-primary)', wordBreak: 'break-all' }}>
                  aws cloudformation deploy --template-file backend/cloudformation/cloudpilot-roles.yaml --stack-name CloudPilotAuditStack --capabilities CAPABILITY_NAMED_IAM
                </div>
              </div>

              {/* Architectural Explanation */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                  <strong>Zero Long-Lived Secrets:</strong> CloudPilot never requests or stores AWS Access Keys. Communication is established exclusively using AWS STS AssumeRole temporary credentials.
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                  <strong>ExternalId Protection:</strong> The trust policy requires matching your tenant ExternalId, eliminating the confused-deputy vulnerability.
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
