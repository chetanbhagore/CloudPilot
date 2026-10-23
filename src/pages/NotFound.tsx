import { Link, useNavigate } from 'react-router-dom';
import { AlertCircle, ArrowLeft, Home, Rocket, ShieldCheck, Mail } from 'lucide-react';
import { usePageSEO } from '../hooks/usePageSEO';
import { sound } from '../utils/soundEngine';

export default function NotFound() {
  const navigate = useNavigate();

  usePageSEO({
    title: '404 Page Not Found',
    description: 'The requested CloudPilot resource, route, or telemetry view does not exist or has moved.',
    canonicalPath: '/404',
  });

  return (
    <div className="page-container" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '65vh', textAlign: 'center' }}>
      <div
        style={{
          width: 80,
          height: 80,
          borderRadius: 24,
          background: 'rgba(255, 69, 58, 0.1)',
          border: '1px solid rgba(255, 69, 58, 0.25)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: 24,
        }}
      >
        <AlertCircle size={40} color="var(--apple-red)" />
      </div>

      <span
        style={{
          fontSize: 13,
          fontWeight: 700,
          textTransform: 'uppercase',
          letterSpacing: '0.08em',
          color: 'var(--apple-red)',
          marginBottom: 8,
        }}
      >
        HTTP 404 • Resource Not Found
      </span>

      <h1
        className="display-title"
        style={{
          fontSize: 36,
          fontWeight: 700,
          letterSpacing: '-0.025em',
          color: 'var(--text-primary)',
          margin: '0 0 12px 0',
        }}
      >
        This Cloud Route Does Not Exist
      </h1>

      <p
        style={{
          fontSize: 16,
          color: 'var(--text-secondary)',
          maxWidth: 520,
          lineHeight: 1.6,
          marginBottom: 32,
        }}
      >
        The page you are looking for may have been decommissioned, renamed, or requires different tenant permissions.
      </p>

      {/* Primary Action Button */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 44, flexWrap: 'wrap', justifyContent: 'center' }}>
        <button
          onClick={() => {
            sound.playClick();
            navigate(-1);
          }}
          className="btn-secondary"
          style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '10px 20px', borderRadius: 9999, cursor: 'pointer', fontSize: 14, fontWeight: 600 }}
        >
          <ArrowLeft size={16} />
          <span>Go Back</span>
        </button>

        <button
          onClick={() => {
            sound.playSnap();
            navigate('/');
          }}
          className="btn-primary"
          style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '10px 22px', borderRadius: 9999, cursor: 'pointer', fontSize: 14, fontWeight: 600 }}
        >
          <Home size={16} />
          <span>Return to Dashboard</span>
        </button>
      </div>

      {/* Helpful Internal Links Directory */}
      <div
        style={{
          background: '#FFFFFF',
          border: '1px solid var(--border-medium)',
          borderRadius: 20,
          padding: 24,
          maxWidth: 640,
          width: '100%',
          boxShadow: 'var(--shadow-sm)',
          textAlign: 'left',
        }}
      >
        <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
          Recommended Internal Destinations
        </span>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 14, marginTop: 14 }}>
          <Link
            to="/deploy"
            style={{ display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none', color: 'var(--text-primary)', padding: '10px 14px', borderRadius: 12, background: 'var(--surface-secondary)', fontSize: 13, fontWeight: 600 }}
          >
            <Rocket size={16} color="var(--apple-blue)" />
            <span>Deploy Center</span>
          </Link>
          <Link
            to="/audit"
            style={{ display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none', color: 'var(--text-primary)', padding: '10px 14px', borderRadius: 12, background: 'var(--surface-secondary)', fontSize: 13, fontWeight: 600 }}
          >
            <ShieldCheck size={16} color="var(--apple-emerald)" />
            <span>Audit Ledger</span>
          </Link>
          <Link
            to="/contact"
            style={{ display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none', color: 'var(--text-primary)', padding: '10px 14px', borderRadius: 12, background: 'var(--surface-secondary)', fontSize: 13, fontWeight: 600 }}
          >
            <Mail size={16} color="var(--apple-purple)" />
            <span>Contact Support</span>
          </Link>
        </div>
      </div>
    </div>
  );
}
