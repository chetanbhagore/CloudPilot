import { useState, useEffect, useCallback } from 'react';
import {
  Terminal, Play, StopCircle, RefreshCw, Layers,
  ExternalLink, Copy, Check, AlertTriangle, Cpu,
  GitBranch, Server, Zap
} from 'lucide-react';
import { useAuth } from '../context/useAuth';
import { sound } from '../utils/soundEngine';

interface ScanData {
  framework: string;
  language: string;
  is_worker: boolean;
  default_port: number;
  entrypoint: string;
  detected_files: string[];
}

interface DeploymentRecord {
  id: string;
  app_name: string;
  repo_url: string;
  branch: string;
  framework: string;
  language: string;
  target: string;
  host_port: number;
  container_port: number;
  container_id: string;
  status: string;
  error_message: string | null;
  logs: string;
  created_at: string;
}

export default function DeployCenter() {
  const { user } = useAuth();
  const backendUrl = import.meta.env.VITE_BACKEND_URL || (typeof window !== 'undefined' && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1' ? 'https://cloudpilot-l3ht.onrender.com' : 'http://localhost:8000');

  // Input state
  const [repoUrl, setRepoUrl] = useState('https://github.com/fastapi/fastapi');
  const [branch, setBranch] = useState('master');
  const [appName, setAppName] = useState('cloudpilot-fastapi-service');
  const [target, setTarget] = useState<'local' | 'aws' | 'azure'>('local');
  const [preferredPort, setPreferredPort] = useState<number>(8000);

  // Operation state
  const [isScanning, setIsScanning] = useState(false);
  const [scanResult, setScanResult] = useState<ScanData | null>(null);
  const [dockerfileContent, setDockerfileContent] = useState<string>('');
  const [isDeploying, setIsDeploying] = useState(false);
  const [deployments, setDeployments] = useState<DeploymentRecord[]>([]);
  const [activeDeployment, setActiveDeployment] = useState<DeploymentRecord | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [portStatus, setPortStatus] = useState<{ checked: boolean; inUse: boolean; port: number } | null>(null);

  const getHeaders = useCallback(() => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('cloudpilot_jwt_token') : null;
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;
    return headers;
  }, []);

  const fetchDeployments = useCallback(async () => {
    try {
      const res = await fetch(`${backendUrl}/api/v1/workloads/deployments`, { headers: getHeaders() });
      if (res.ok) {
        const data = await res.json();
        setDeployments(data);
        if (data.length > 0 && !activeDeployment) {
          setActiveDeployment(data[0]);
        }
      }
    } catch {
      // Backend offline
    }
  }, [backendUrl, getHeaders, activeDeployment]);

  useEffect(() => {
    fetchDeployments();
  }, [fetchDeployments]);

  const handleScanAndSynthesize = async () => {
    sound.playClick();
    setIsScanning(true);
    setErrorMessage(null);
    setScanResult(null);

    try {
      // 1. Scan Repository
      const scanRes = await fetch(`${backendUrl}/api/v1/workloads/scan`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ repo_url: repoUrl, branch })
      });

      if (!scanRes.ok) {
        const err = await scanRes.json().catch(() => ({ detail: 'Failed to scan repository' }));
        throw new Error(err.detail || `Scan failed with status ${scanRes.status}`);
      }

      const scanData = await scanRes.json();
      const detected: ScanData = scanData.scan;
      setScanResult(detected);
      setPreferredPort(detected.default_port || 8080);

      // 2. Synthesize Dockerfile
      const synthRes = await fetch(`${backendUrl}/api/v1/workloads/synthesize`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({
          app_name: appName,
          framework: detected.framework,
          language: detected.language,
          entrypoint: detected.entrypoint,
          is_worker: detected.is_worker,
          default_port: detected.default_port,
          custom_port: detected.default_port
        })
      });

      if (synthRes.ok) {
        const synthData = await synthRes.json();
        setDockerfileContent(synthData.dockerfile);
        sound.playSnap();
      }
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : String(err));
    } finally {
      setIsScanning(false);
    }
  };

  const handleCheckPort = async () => {
    sound.playClick();
    try {
      const res = await fetch(`${backendUrl}/api/v1/workloads/ports/check?port=${preferredPort}`, {
        headers: getHeaders()
      });
      if (res.ok) {
        const data = await res.json();
        setPortStatus({ checked: true, inUse: data.in_use, port: preferredPort });
      }
    } catch (err) {
      setErrorMessage(`Failed to check port: ${err}`);
    }
  };

  const handleAllocatePort = async () => {
    sound.playClick();
    try {
      const res = await fetch(`${backendUrl}/api/v1/workloads/ports/allocate?preferred_port=${preferredPort}`, {
        method: 'POST',
        headers: getHeaders()
      });
      if (res.ok) {
        const data = await res.json();
        setPreferredPort(data.allocated_port);
        setPortStatus({ checked: true, inUse: false, port: data.allocated_port });
        sound.playSnap();
      }
    } catch (err) {
      setErrorMessage(`Port allocation failed: ${err}`);
    }
  };

  const handleDeploy = async () => {
    sound.playClick();
    setIsDeploying(true);
    setErrorMessage(null);

    try {
      const res = await fetch(`${backendUrl}/api/v1/workloads/deploy`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({
          app_name: appName,
          repo_url: repoUrl,
          branch,
          framework: scanResult?.framework || 'generic',
          language: scanResult?.language || 'python',
          target,
          port: preferredPort,
          dockerfile_override: dockerfileContent
        })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.detail || 'Deployment initiation failed.');
      }

      const rec: DeploymentRecord = data.deployment;
      setActiveDeployment(rec);
      setDeployments((prev) => [rec, ...prev.filter((d) => d.id !== rec.id)]);
      sound.playSnap();
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : String(err));
    } finally {
      setIsDeploying(false);
    }
  };

  const handleStop = async (id: string) => {
    sound.playClick();
    try {
      const res = await fetch(`${backendUrl}/api/v1/workloads/${id}/stop`, {
        method: 'POST',
        headers: getHeaders()
      });
      if (res.ok) {
        const data = await res.json();
        setActiveDeployment(data.deployment);
        setDeployments((prev) => prev.map((d) => (d.id === id ? data.deployment : d)));
      }
    } catch (err) {
      setErrorMessage(`Failed to stop workload: ${err}`);
    }
  };

  const copyDockerfile = () => {
    navigator.clipboard.writeText(dockerfileContent);
    setCopied(true);
    sound.playSnap();
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="layout-content" style={{ maxWidth: 1280, margin: '0 auto', paddingBottom: 60 }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 28 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
            <span className="badge badge-blue">CloudPilot Workloads</span>
            <span className="badge badge-outline">Production Deploy Engine</span>
          </div>
          <h1 style={{ fontSize: 28, fontWeight: 700, letterSpacing: '-0.026em', color: '#1D1D1F', margin: 0 }}>
            Git-to-Container Deploy Center
          </h1>
          <p style={{ fontSize: 14, color: '#86868B', marginTop: 6, margin: 0 }}>
            Deep-scan arbitrary repositories, synthesize multi-stage Dockerfiles, prevent host port collisions, and deploy to Local Docker, AWS App Runner, or Azure Container Apps.
          </p>
        </div>
        <button
          onClick={fetchDeployments}
          className="btn-secondary"
          style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', fontSize: 13 }}
        >
          <RefreshCw size={14} /> Refresh Runtimes
        </button>
      </div>

      {/* Error Alert Box */}
      {errorMessage && (
        <div style={{
          backgroundColor: '#FFF1F2',
          border: '1px solid #FECDD3',
          borderRadius: 12,
          padding: '14px 18px',
          marginBottom: 24,
          display: 'flex',
          alignItems: 'center',
          gap: 12
        }}>
          <AlertTriangle size={18} color="#E11D48" />
          <div style={{ fontSize: 13, color: '#9F1239', fontWeight: 500, flex: 1 }}>{errorMessage}</div>
          <button onClick={() => setErrorMessage(null)} style={{ background: 'none', border: 'none', color: '#9F1239', cursor: 'pointer', fontSize: 16 }}>×</button>
        </div>
      )}

      {/* Main Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.1fr 0.9fr', gap: 24, alignItems: 'start' }}>
        {/* Left Column: Repository & Pipeline Controls */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          {/* Repository Ingestion Card */}
          <div className="card" style={{ padding: 24 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
              <div style={{ width: 32, height: 32, borderRadius: 8, backgroundColor: '#F5F5F7', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <GitBranch size={16} color="#0071E3" />
              </div>
              <h2 style={{ fontSize: 16, fontWeight: 600, margin: 0, color: '#1D1D1F' }}>1. Repository Ingestion & Framework Detection</h2>
            </div>

            {/* Presets */}
            <div style={{ marginBottom: 14 }}>
              <label style={{ fontSize: 12, fontWeight: 500, color: '#86868B', display: 'block', marginBottom: 6 }}>
                Quick Presets:
              </label>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <button
                  type="button"
                  className="badge badge-outline"
                  style={{ cursor: 'pointer', padding: '4px 10px', fontSize: 12 }}
                  onClick={() => {
                    setRepoUrl('https://github.com/fastapi/fastapi');
                    setBranch('master');
                    setAppName('fastapi-microservice');
                  }}
                >
                  ⚡ FastAPI (Python)
                </button>
                <button
                  type="button"
                  className="badge badge-outline"
                  style={{ cursor: 'pointer', padding: '4px 10px', fontSize: 12 }}
                  onClick={() => {
                    setRepoUrl('https://github.com/pallets/flask');
                    setBranch('main');
                    setAppName('flask-api');
                  }}
                >
                  🌶️ Flask
                </button>
                <button
                  type="button"
                  className="badge badge-outline"
                  style={{ cursor: 'pointer', padding: '4px 10px', fontSize: 12 }}
                  onClick={() => {
                    setRepoUrl('https://github.com/expressjs/express');
                    setBranch('master');
                    setAppName('express-node-api');
                  }}
                >
                  🟢 Express.js (Node)
                </button>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: '#1D1D1F', display: 'block', marginBottom: 4 }}>
                  Git Repository URL
                </label>
                <input
                  type="text"
                  className="input-field"
                  style={{ width: '100%', padding: '10px 12px', fontSize: 13, borderRadius: 8, border: '1px solid #D2D2D7' }}
                  value={repoUrl}
                  onChange={(e) => setRepoUrl(e.target.value)}
                  placeholder="https://github.com/org/repo"
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: '#1D1D1F', display: 'block', marginBottom: 4 }}>
                    Branch
                  </label>
                  <input
                    type="text"
                    className="input-field"
                    style={{ width: '100%', padding: '10px 12px', fontSize: 13, borderRadius: 8, border: '1px solid #D2D2D7' }}
                    value={branch}
                    onChange={(e) => setBranch(e.target.value)}
                    placeholder="main"
                  />
                </div>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: '#1D1D1F', display: 'block', marginBottom: 4 }}>
                    Application Name
                  </label>
                  <input
                    type="text"
                    className="input-field"
                    style={{ width: '100%', padding: '10px 12px', fontSize: 13, borderRadius: 8, border: '1px solid #D2D2D7' }}
                    value={appName}
                    onChange={(e) => setAppName(e.target.value)}
                    placeholder="app-service"
                  />
                </div>
              </div>

              <button
                onClick={handleScanAndSynthesize}
                disabled={isScanning || !repoUrl}
                className="btn-primary"
                style={{
                  marginTop: 6,
                  padding: '11px 18px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                  fontSize: 14,
                  fontWeight: 600,
                  borderRadius: 8,
                  backgroundColor: '#0071E3',
                  color: '#FFFFFF',
                  border: 'none',
                  cursor: isScanning ? 'not-allowed' : 'pointer'
                }}
              >
                {isScanning ? (
                  <>
                    <RefreshCw size={16} className="spin" /> Scanning AST & Files...
                  </>
                ) : (
                  <>
                    <Zap size={16} fill="#FFFFFF" /> Deep-Scan & Synthesize Dockerfile
                  </>
                )}
              </button>
            </div>

            {/* Scan Result Card */}
            {scanResult && (
              <div style={{
                marginTop: 18,
                padding: '14px 16px',
                backgroundColor: '#F5F5F7',
                borderRadius: 10,
                border: '1px solid #E5E5EA'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span className="badge badge-green" style={{ textTransform: 'uppercase', fontWeight: 700 }}>
                      ✓ {scanResult.framework}
                    </span>
                    <span style={{ fontSize: 12, color: '#86868B' }}>Language: {scanResult.language}</span>
                  </div>
                  <span style={{ fontSize: 12, fontWeight: 600, color: '#1D1D1F' }}>
                    Default Port: {scanResult.default_port}
                  </span>
                </div>
                {scanResult.entrypoint && (
                  <div style={{ fontSize: 12, fontFamily: 'monospace', color: '#1D1D1F', backgroundColor: '#FFFFFF', padding: '6px 10px', borderRadius: 6, border: '1px solid #E5E5EA' }}>
                    Entrypoint: {scanResult.entrypoint}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Port Collision Manager Card */}
          <div className="card" style={{ padding: 24 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
              <div style={{ width: 32, height: 32, borderRadius: 8, backgroundColor: '#F5F5F7', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Server size={16} color="#0071E3" />
              </div>
              <h2 style={{ fontSize: 16, fontWeight: 600, margin: 0, color: '#1D1D1F' }}>2. Host Port Collision Manager</h2>
            </div>
            <p style={{ fontSize: 13, color: '#86868B', marginTop: 0, marginBottom: 14 }}>
              Checks in-use TCP sockets on the server to prevent port binding collisions and race conditions.
            </p>

            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <input
                type="number"
                min={1}
                max={65535}
                className="input-field"
                style={{ width: 130, padding: '9px 12px', fontSize: 13, borderRadius: 8, border: '1px solid #D2D2D7' }}
                value={preferredPort}
                onChange={(e) => setPreferredPort(parseInt(e.target.value) || 8080)}
              />
              <button
                type="button"
                onClick={handleCheckPort}
                className="btn-secondary"
                style={{ padding: '9px 14px', fontSize: 13, borderRadius: 8 }}
              >
                Check Port
              </button>
              <button
                type="button"
                onClick={handleAllocatePort}
                className="btn-secondary"
                style={{ padding: '9px 14px', fontSize: 13, borderRadius: 8 }}
              >
                Auto-Allocate Safe Port
              </button>
            </div>

            {portStatus && (
              <div style={{ marginTop: 12, fontSize: 13, display: 'flex', alignItems: 'center', gap: 8 }}>
                {portStatus.inUse ? (
                  <span style={{ color: '#E11D48', fontWeight: 600 }}>
                    ⚠️ Port {portStatus.port} is currently BOUND. Click 'Auto-Allocate Safe Port' to prevent failure.
                  </span>
                ) : (
                  <span style={{ color: '#16A34A', fontWeight: 600 }}>
                    ✓ Port {portStatus.port} is FREE and available for container binding.
                  </span>
                )}
              </div>
            )}
          </div>

          {/* Deployment Execution Target Card */}
          <div className="card" style={{ padding: 24 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
              <div style={{ width: 32, height: 32, borderRadius: 8, backgroundColor: '#F5F5F7', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Cpu size={16} color="#0071E3" />
              </div>
              <h2 style={{ fontSize: 16, fontWeight: 600, margin: 0, color: '#1D1D1F' }}>3. Execution Target & Launch</h2>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 18 }}>
              <button
                type="button"
                onClick={() => setTarget('local')}
                style={{
                  padding: '12px 14px',
                  borderRadius: 10,
                  border: target === 'local' ? '2px solid #0071E3' : '1px solid #D2D2D7',
                  backgroundColor: target === 'local' ? '#F0F7FF' : '#FFFFFF',
                  cursor: 'pointer',
                  textAlign: 'left'
                }}
              >
                <div style={{ fontSize: 13, fontWeight: 700, color: '#1D1D1F' }}>Local Docker</div>
                <div style={{ fontSize: 11, color: '#86868B', marginTop: 2 }}>Container daemon on host</div>
              </button>

              <button
                type="button"
                onClick={() => setTarget('aws')}
                style={{
                  padding: '12px 14px',
                  borderRadius: 10,
                  border: target === 'aws' ? '2px solid #0071E3' : '1px solid #D2D2D7',
                  backgroundColor: target === 'aws' ? '#F0F7FF' : '#FFFFFF',
                  cursor: 'pointer',
                  textAlign: 'left'
                }}
              >
                <div style={{ fontSize: 13, fontWeight: 700, color: '#1D1D1F' }}>AWS App Runner</div>
                <div style={{ fontSize: 11, color: '#86868B', marginTop: 2 }}>Managed container runtime</div>
              </button>

              <button
                type="button"
                onClick={() => setTarget('azure')}
                style={{
                  padding: '12px 14px',
                  borderRadius: 10,
                  border: target === 'azure' ? '2px solid #0071E3' : '1px solid #D2D2D7',
                  backgroundColor: target === 'azure' ? '#F0F7FF' : '#FFFFFF',
                  cursor: 'pointer',
                  textAlign: 'left'
                }}
              >
                <div style={{ fontSize: 13, fontWeight: 700, color: '#1D1D1F' }}>Azure ACA</div>
                <div style={{ fontSize: 11, color: '#86868B', marginTop: 2 }}>Container Apps Serverless</div>
              </button>
            </div>

            <button
              onClick={handleDeploy}
              disabled={isDeploying || !repoUrl}
              className="btn-primary"
              style={{
                width: '100%',
                padding: '13px 20px',
                fontSize: 14,
                fontWeight: 700,
                borderRadius: 10,
                backgroundColor: '#0071E3',
                color: '#FFFFFF',
                border: 'none',
                cursor: isDeploying ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8
              }}
            >
              {isDeploying ? (
                <>
                  <RefreshCw size={16} className="spin" /> Executing Pre-flight & Build...
                </>
              ) : (
                <>
                  <Play size={16} fill="#FFFFFF" /> Launch Workload on {target.toUpperCase()}
                </>
              )}
            </button>
          </div>
        </div>

        {/* Right Column: Synthesized Dockerfile & Active Deployment Status */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          {/* Synthesized Dockerfile Viewer */}
          <div className="card" style={{ padding: 24 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Layers size={16} color="#0071E3" />
                <h3 style={{ fontSize: 15, fontWeight: 600, margin: 0, color: '#1D1D1F' }}>Synthesized Dockerfile</h3>
              </div>
              {dockerfileContent && (
                <button
                  onClick={copyDockerfile}
                  className="btn-secondary"
                  style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '4px 10px', fontSize: 12 }}
                >
                  {copied ? <Check size={12} color="#16A34A" /> : <Copy size={12} />}
                  {copied ? 'Copied' : 'Copy'}
                </button>
              )}
            </div>

            <div style={{
              backgroundColor: '#1E1E1E',
              borderRadius: 8,
              padding: 16,
              fontFamily: 'SF Mono, Menlo, monospace',
              fontSize: 12,
              lineHeight: 1.5,
              color: '#D4D4D4',
              maxHeight: 280,
              overflowY: 'auto'
            }}>
              {dockerfileContent ? (
                <pre style={{ margin: 0 }}>{dockerfileContent}</pre>
              ) : (
                <div style={{ color: '#86868B', fontStyle: 'italic' }}>
                  Click 'Deep-Scan & Synthesize' to generate multi-stage, non-root Dockerfile for your workload.
                </div>
              )}
            </div>
          </div>

          {/* Active Workload Status & Logs */}
          <div className="card" style={{ padding: 24 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Terminal size={16} color="#0071E3" />
                <h3 style={{ fontSize: 15, fontWeight: 600, margin: 0, color: '#1D1D1F' }}>Runtime Status & Logs</h3>
              </div>
              {activeDeployment && (
                <span className={`badge ${
                  activeDeployment.status === 'RUNNING' ? 'badge-green' :
                  activeDeployment.status === 'BLOCKED' ? 'badge-orange' :
                  activeDeployment.status === 'PENDING_APPROVAL' ? 'badge-blue' : 'badge-red'
                }`}>
                  {activeDeployment.status}
                </span>
              )}
            </div>

            {activeDeployment ? (
              <div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12, fontSize: 12 }}>
                  <div><strong>ID:</strong> {activeDeployment.id}</div>
                  <div><strong>Target:</strong> {activeDeployment.target.toUpperCase()}</div>
                  <div><strong>Host Port:</strong> {activeDeployment.host_port || 'N/A'}</div>
                  <div><strong>Container Port:</strong> {activeDeployment.container_port}</div>
                </div>

                {/* Honest Blocked State Alert */}
                {activeDeployment.status === 'BLOCKED' && (
                  <div style={{
                    backgroundColor: '#FFFBEB',
                    border: '1px solid #FCD34D',
                    borderRadius: 8,
                    padding: '12px 14px',
                    marginBottom: 12,
                    fontSize: 12,
                    color: '#92400E'
                  }}>
                    <strong>BLOCKED REASON (Fails Closed):</strong> {activeDeployment.error_message}
                  </div>
                )}

                {/* Logs Terminal */}
                <div style={{
                  backgroundColor: '#0F172A',
                  color: '#38BDF8',
                  borderRadius: 8,
                  padding: '12px 14px',
                  fontFamily: 'monospace',
                  fontSize: 11,
                  maxHeight: 180,
                  overflowY: 'auto'
                }}>
                  <pre style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{activeDeployment.logs || 'No logs recorded.'}</pre>
                </div>

                {activeDeployment.status === 'RUNNING' && (
                  <div style={{ marginTop: 14, display: 'flex', gap: 8 }}>
                    <button
                      onClick={() => handleStop(activeDeployment.id)}
                      className="btn-secondary"
                      style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', fontSize: 12, color: '#E11D48' }}
                    >
                      <StopCircle size={14} /> Stop Workload
                    </button>
                    <a
                      href={`http://localhost:${activeDeployment.host_port}`}
                      target="_blank"
                      rel="noreferrer"
                      className="btn-secondary"
                      style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', fontSize: 12 }}
                    >
                      <ExternalLink size={14} /> Open App
                    </a>
                  </div>
                )}
              </div>
            ) : (
              <div style={{ fontSize: 13, color: '#86868B', fontStyle: 'italic', padding: '20px 0', textAlign: 'center' }}>
                No active deployment selected. Launch a workload to see real container status and logs.
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Deployments History Table */}
      <div className="card" style={{ marginTop: 28, padding: 24 }}>
        <h3 style={{ fontSize: 16, fontWeight: 600, color: '#1D1D1F', marginBottom: 16 }}>
          Tenant Workload Deployments ({deployments.length})
        </h3>
        {deployments.length === 0 ? (
          <div style={{ fontSize: 13, color: '#86868B', padding: '24px 0', textAlign: 'center' }}>
            Zero workloads recorded for tenant '{user?.organization || 'Acme'}'. Deploy your first Git repository above.
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #E5E5EA', textAlign: 'left', color: '#86868B' }}>
                  <th style={{ padding: '8px 12px' }}>App Name</th>
                  <th style={{ padding: '8px 12px' }}>Framework</th>
                  <th style={{ padding: '8px 12px' }}>Target</th>
                  <th style={{ padding: '8px 12px' }}>Port</th>
                  <th style={{ padding: '8px 12px' }}>Status</th>
                  <th style={{ padding: '8px 12px' }}>Created</th>
                  <th style={{ padding: '8px 12px' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {deployments.map((d) => (
                  <tr
                    key={d.id}
                    onClick={() => setActiveDeployment(d)}
                    style={{
                      borderBottom: '1px solid #F5F5F7',
                      cursor: 'pointer',
                      backgroundColor: activeDeployment?.id === d.id ? '#F0F7FF' : 'transparent'
                    }}
                  >
                    <td style={{ padding: '10px 12px', fontWeight: 600, color: '#1D1D1F' }}>{d.app_name}</td>
                    <td style={{ padding: '10px 12px', textTransform: 'capitalize' }}>{d.framework}</td>
                    <td style={{ padding: '10px 12px', textTransform: 'uppercase' }}>{d.target}</td>
                    <td style={{ padding: '10px 12px' }}>{d.host_port || d.container_port}</td>
                    <td style={{ padding: '10px 12px' }}>
                      <span className={`badge ${
                        d.status === 'RUNNING' ? 'badge-green' :
                        d.status === 'BLOCKED' ? 'badge-orange' :
                        d.status === 'PENDING_APPROVAL' ? 'badge-blue' : 'badge-red'
                      }`}>
                        {d.status}
                      </span>
                    </td>
                    <td style={{ padding: '10px 12px', color: '#86868B' }}>{new Date(d.created_at).toLocaleTimeString()}</td>
                    <td style={{ padding: '10px 12px' }}>
                      {d.status === 'RUNNING' && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleStop(d.id);
                          }}
                          style={{ background: 'none', border: 'none', color: '#E11D48', cursor: 'pointer', fontSize: 12, fontWeight: 600 }}
                        >
                          Stop
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
