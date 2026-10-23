import { Link } from 'react-router-dom';
import { Shield, Lock, EyeOff, FileText, ArrowRight } from 'lucide-react';
import { usePageSEO } from '../hooks/usePageSEO';
import Breadcrumbs from '../components/Breadcrumbs';

export default function PrivacyPolicy() {
  usePageSEO({
    title: 'Privacy & Security Policy',
    description: 'CloudPilot Enterprise Privacy Policy: Zero secret retention, temporary STS IAM assumption, client-side encryption, and GDPR compliance.',
    canonicalPath: '/privacy',
  });

  return (
    <div className="page-container" style={{ maxWidth: 960, margin: '0 auto', paddingBottom: 80 }}>
      <Breadcrumbs />

      {/* Header */}
      <div style={{ marginBottom: 36 }}>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 12px', borderRadius: 9999, background: 'rgba(0, 113, 227, 0.08)', border: '1px solid rgba(0, 113, 227, 0.2)', marginBottom: 12 }}>
          <Shield size={14} color="var(--apple-blue)" />
          <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--apple-blue)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            Security &amp; Data Transparency
          </span>
        </div>

        <h1
          className="display-title"
          style={{
            fontSize: 34,
            fontWeight: 700,
            letterSpacing: '-0.025em',
            color: 'var(--text-primary)',
            margin: '0 0 10px 0',
          }}
        >
          CloudPilot Enterprise Privacy &amp; Data Security Policy
        </h1>

        <p style={{ fontSize: 15, color: 'var(--text-secondary)', margin: 0 }}>
          Effective Date: October 24, 2026 &bull; Version 2.4.0 &bull; Applies to all AWS &amp; Azure CloudPilot Workspaces
        </p>
      </div>

      {/* Policy Card 1: Zero Secret Retention */}
      <div className="card-ambient" style={{ padding: 28, borderRadius: 20, marginBottom: 24, border: '1px solid var(--border-medium)', background: '#FFFFFF' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
          <div style={{ width: 40, height: 40, borderRadius: 12, background: 'rgba(48, 209, 88, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <EyeOff size={22} color="var(--apple-emerald)" />
          </div>
          <div>
            <h2 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
              1. Zero-Secret Retention Architecture
            </h2>
            <span style={{ fontSize: 13, color: 'var(--text-tertiary)' }}>No long-term cloud root keys are ever stored on CloudPilot infrastructure</span>
          </div>
        </div>

        <p style={{ fontSize: 14, lineHeight: 1.7, color: 'var(--text-secondary)', marginBottom: 14 }}>
          CloudPilot is engineered on a <strong>zero-secret-retention principle</strong>. When you connect an AWS account or Azure Subscription, CloudPilot authenticates exclusively using ephemeral, short-lived tokens:
        </p>
        <ul style={{ fontSize: 14, lineHeight: 1.8, color: 'var(--text-secondary)', paddingLeft: 22, margin: 0 }}>
          <li><strong>AWS STS AssumeRole:</strong> Credentials expire automatically after a maximum of 1 hour with cryptographically random <code>ExternalId</code> conditions to eliminate Confused Deputy vulnerabilities.</li>
          <li><strong>Microsoft Entra ID:</strong> Azure subscriptions are inspected via OAuth2 Bearer tokens cached only in volatile memory with 5-minute pre-expiry invalidation.</li>
          <li><strong>Non-Persistent Passwords:</strong> Sensitive credentials entered during session onboarding are never written to plain-text logs or persistent disk tables.</li>
        </ul>
      </div>

      {/* Policy Card 2: Tenant Isolation & Cryptographic Proof */}
      <div className="card-ambient" style={{ padding: 28, borderRadius: 20, marginBottom: 24, border: '1px solid var(--border-medium)', background: '#FFFFFF' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
          <div style={{ width: 40, height: 40, borderRadius: 12, background: 'rgba(0, 113, 227, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Lock size={22} color="var(--apple-blue)" />
          </div>
          <div>
            <h2 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
              2. Strict Multi-Tenant Isolation &amp; Audit Integrity
            </h2>
            <span style={{ fontSize: 13, color: 'var(--text-tertiary)' }}>Cryptographically bounded per-organization databases and ledgers</span>
          </div>
        </div>

        <p style={{ fontSize: 14, lineHeight: 1.7, color: 'var(--text-secondary)', marginBottom: 14 }}>
          Every enterprise tenant operates in strict logical isolation. Cross-tenant queries are blocked fail-closed with <code>HTTP 403 Forbidden</code>:
        </p>
        <ul style={{ fontSize: 14, lineHeight: 1.8, color: 'var(--text-secondary)', paddingLeft: 22, margin: 0 }}>
          <li><strong>Safety Passport™ Locks:</strong> All remediation actions require a pre-flight cryptographic hash calculation. If any parameter is mutated post-approval, execution immediately terminates.</li>
          <li><strong>SHA-256 Ledger Chaining:</strong> All remediation outcomes are committed to an append-only hash chain where prior event integrity hashes are linked to the next event. Any database record alteration triggers tamper alerts.</li>
        </ul>
      </div>

      {/* Policy Card 3: Data Subject Rights & GDPR */}
      <div className="card-ambient" style={{ padding: 28, borderRadius: 20, marginBottom: 32, border: '1px solid var(--border-medium)', background: '#FFFFFF' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
          <div style={{ width: 40, height: 40, borderRadius: 12, background: 'rgba(175, 82, 222, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <FileText size={22} color="var(--apple-purple)" />
          </div>
          <div>
            <h2 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
              3. Data Ownership, GDPR &amp; CCPA Compliance
            </h2>
            <span style={{ fontSize: 13, color: 'var(--text-tertiary)' }}>Full customer ownership, exportability, and immediate right to deletion</span>
          </div>
        </div>

        <p style={{ fontSize: 14, lineHeight: 1.7, color: 'var(--text-secondary)', marginBottom: 14 }}>
          Customers retain full ownership of all cloud topology metadata, finding records, and remediation passports:
        </p>
        <ul style={{ fontSize: 14, lineHeight: 1.8, color: 'var(--text-secondary)', paddingLeft: 22, margin: 0 }}>
          <li><strong>Right to Portability:</strong> Tenants can export their complete cryptographically attested audit history anytime via CSV or JSON format from the <Link to="/audit" style={{ color: 'var(--apple-blue)', fontWeight: 600 }}>Audit Ledger</Link>.</li>
          <li><strong>Right to Erasure:</strong> Upon account disconnection or deletion request, all tenant finding records and cached sessions are purged completely from the relational database via cascading foreign key drops.</li>
        </ul>
      </div>

      {/* Contact / Inquiries Banner */}
      <div
        style={{
          background: 'linear-gradient(135deg, rgba(0, 113, 227, 0.06), rgba(48, 209, 88, 0.06))',
          border: '1px solid rgba(0, 113, 227, 0.2)',
          borderRadius: 20,
          padding: 24,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 16,
        }}
      >
        <div>
          <h3 style={{ fontSize: 17, fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 4px 0' }}>
            Have Security or Compliance Questions?
          </h3>
          <p style={{ fontSize: 14, color: 'var(--text-secondary)', margin: 0 }}>
            Reach out to our Security &amp; Data Protection Officer directly for enterprise questionnaires.
          </p>
        </div>

        <Link
          to="/contact"
          className="btn-primary"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
            padding: '10px 20px',
            borderRadius: 9999,
            textDecoration: 'none',
            fontSize: 14,
            fontWeight: 600,
          }}
        >
          <span>Contact Security Team</span>
          <ArrowRight size={16} />
        </Link>
      </div>
    </div>
  );
}
