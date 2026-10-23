import { useState } from 'react';
import { Mail, Send, CheckCircle2, AlertCircle, Shield, Building, Clock } from 'lucide-react';
import { usePageSEO } from '../hooks/usePageSEO';
import Breadcrumbs from '../components/Breadcrumbs';
import { sound } from '../utils/soundEngine';

export default function Contact() {
  usePageSEO({
    title: 'Contact Support & Enterprise Inquiries',
    description: 'Get in touch with the CloudPilot engineering and enterprise support team for pilots, security disclosures, or deployment assistance.',
    canonicalPath: '/contact',
  });

  const [formData, setFormData] = useState({
    name: '',
    email: '',
    organization: '',
    category: 'enterprise_pilot',
    subject: '',
    message: '',
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submissionSuccess, setSubmissionSuccess] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    sound.playClick();
    setErrorMessage(null);
    setIsSubmitting(true);

    try {
      const endpoints = ['/contact', 'http://127.0.0.1:8000/contact', '/api/v1/contact'];
      let res: Response | null = null;
      let data: any = null;

      for (const endpoint of endpoints) {
        try {
          res = await fetch(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(formData),
          });
          if (res.ok) {
            data = await res.json();
            break;
          }
        } catch {
          // Try next endpoint
        }
      }

      if (data && data.success) {
        sound.playSuccess();
        setSubmissionSuccess(data.ticket_id);
        setFormData({
          name: '',
          email: '',
          organization: '',
          category: 'enterprise_pilot',
          subject: '',
          message: '',
        });
      } else {
        const errorDetail = data?.detail || 'Unable to submit ticket. Please check your inputs or try again.';
        setErrorMessage(errorDetail);
        sound.playWarning();
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Network connection failed. Please try again.');
      sound.playWarning();
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="page-container" style={{ maxWidth: 960, margin: '0 auto', paddingBottom: 80 }}>
      <Breadcrumbs />

      {/* Header */}
      <div style={{ marginBottom: 36 }}>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 12px', borderRadius: 9999, background: 'rgba(0, 113, 227, 0.08)', border: '1px solid rgba(0, 113, 227, 0.2)', marginBottom: 12 }}>
          <Mail size={14} color="var(--apple-blue)" />
          <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--apple-blue)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            Enterprise Inquiries &amp; Support
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
          Contact CloudPilot Operations &amp; Engineering
        </h1>

        <p style={{ fontSize: 15, color: 'var(--text-secondary)', margin: 0 }}>
          Submit enterprise pilot requests, report security disclosures, or ask deployment questions. Our engineering team responds within 24 hours.
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 32 }}>
        {/* Contact Form Card */}
        <div
          className="card-ambient"
          style={{
            background: '#FFFFFF',
            border: '1px solid var(--border-medium)',
            borderRadius: 24,
            padding: 32,
            boxShadow: 'var(--shadow-sm)',
          }}
        >
          {submissionSuccess ? (
            <div style={{ textAlign: 'center', padding: '24px 8px' }}>
              <div
                style={{
                  width: 64,
                  height: 64,
                  borderRadius: '50%',
                  background: 'rgba(48, 209, 88, 0.12)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  margin: '0 auto 18px',
                }}
              >
                <CheckCircle2 size={36} color="var(--apple-emerald)" />
              </div>

              <h2 style={{ fontSize: 22, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 8 }}>
                Ticket Created Successfully!
              </h2>

              <p style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: 20 }}>
                Your inquiry has been routed to our technical support team. A receipt has been registered with ticket ID:
              </p>

              <div
                style={{
                  display: 'inline-block',
                  background: 'var(--surface-secondary)',
                  border: '1px solid var(--border-medium)',
                  borderRadius: 12,
                  padding: '8px 18px',
                  fontFamily: 'var(--font-mono)',
                  fontSize: 15,
                  fontWeight: 700,
                  color: 'var(--apple-blue)',
                  marginBottom: 24,
                }}
              >
                {submissionSuccess}
              </div>

              <div>
                <button
                  onClick={() => setSubmissionSuccess(null)}
                  className="btn-secondary"
                  style={{ borderRadius: 9999, padding: '10px 24px', cursor: 'pointer' }}
                >
                  Submit Another Inquiry
                </button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
              {errorMessage && (
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    padding: '12px 16px',
                    borderRadius: 12,
                    background: 'rgba(255, 69, 58, 0.08)',
                    border: '1px solid rgba(255, 69, 58, 0.25)',
                    color: 'var(--apple-red)',
                    fontSize: 13,
                    fontWeight: 500,
                  }}
                >
                  <AlertCircle size={18} style={{ flexShrink: 0 }} />
                  <span>{errorMessage}</span>
                </div>
              )}

              {/* Name & Email Row */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 16 }}>
                <div>
                  <label htmlFor="contact-name" style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 6 }}>
                    Full Name <span style={{ color: 'var(--apple-red)' }}>*</span>
                  </label>
                  <input
                    id="contact-name"
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="Jane Doe"
                    style={{
                      width: '100%',
                      padding: '10px 14px',
                      borderRadius: 12,
                      border: '1px solid var(--border-medium)',
                      fontSize: 14,
                      outline: 'none',
                      boxSizing: 'border-box',
                    }}
                  />
                </div>

                <div>
                  <label htmlFor="contact-email" style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 6 }}>
                    Work Email <span style={{ color: 'var(--apple-red)' }}>*</span>
                  </label>
                  <input
                    id="contact-email"
                    type="email"
                    required
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    placeholder="jane@company.com"
                    style={{
                      width: '100%',
                      padding: '10px 14px',
                      borderRadius: 12,
                      border: '1px solid var(--border-medium)',
                      fontSize: 14,
                      outline: 'none',
                      boxSizing: 'border-box',
                    }}
                  />
                </div>
              </div>

              {/* Organization & Category */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 16 }}>
                <div>
                  <label htmlFor="contact-org" style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 6 }}>
                    Organization / Cloud Account
                  </label>
                  <input
                    id="contact-org"
                    type="text"
                    value={formData.organization}
                    onChange={(e) => setFormData({ ...formData, organization: e.target.value })}
                    placeholder="Acme Cloud Technologies"
                    style={{
                      width: '100%',
                      padding: '10px 14px',
                      borderRadius: 12,
                      border: '1px solid var(--border-medium)',
                      fontSize: 14,
                      outline: 'none',
                      boxSizing: 'border-box',
                    }}
                  />
                </div>

                <div>
                  <label htmlFor="contact-category" style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 6 }}>
                    Inquiry Category
                  </label>
                  <select
                    id="contact-category"
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    style={{
                      width: '100%',
                      padding: '10px 14px',
                      borderRadius: 12,
                      border: '1px solid var(--border-medium)',
                      fontSize: 14,
                      background: '#FFFFFF',
                      outline: 'none',
                      boxSizing: 'border-box',
                    }}
                  >
                    <option value="enterprise_pilot">Enterprise Pilot Request</option>
                    <option value="technical_support">Technical Support</option>
                    <option value="security_disclosure">Security Disclosure</option>
                    <option value="billing_inquiry">Billing / Licensing</option>
                    <option value="general">General Question</option>
                  </select>
                </div>
              </div>

              {/* Subject */}
              <div>
                <label htmlFor="contact-subject" style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 6 }}>
                  Subject <span style={{ color: 'var(--apple-red)' }}>*</span>
                </label>
                <input
                  id="contact-subject"
                  type="text"
                  required
                  value={formData.subject}
                  onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                  placeholder="Need assistance with Azure Subscription live scan"
                  style={{
                    width: '100%',
                    padding: '10px 14px',
                    borderRadius: 12,
                    border: '1px solid var(--border-medium)',
                    fontSize: 14,
                    outline: 'none',
                    boxSizing: 'border-box',
                  }}
                />
              </div>

              {/* Message */}
              <div>
                <label htmlFor="contact-message" style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 6 }}>
                  Message <span style={{ color: 'var(--apple-red)' }}>*</span>
                </label>
                <textarea
                  id="contact-message"
                  required
                  rows={4}
                  value={formData.message}
                  onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                  placeholder="Provide context regarding your environment, questions, or cloud architecture requirements..."
                  style={{
                    width: '100%',
                    padding: '12px 14px',
                    borderRadius: 12,
                    border: '1px solid var(--border-medium)',
                    fontSize: 14,
                    outline: 'none',
                    boxSizing: 'border-box',
                    fontFamily: 'inherit',
                    resize: 'vertical',
                  }}
                />
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="btn-primary"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                  padding: '12px 24px',
                  borderRadius: 9999,
                  fontSize: 15,
                  fontWeight: 600,
                  cursor: isSubmitting ? 'not-allowed' : 'pointer',
                  opacity: isSubmitting ? 0.7 : 1,
                  marginTop: 6,
                }}
              >
                {isSubmitting ? (
                  <span>Transmitting Ticket...</span>
                ) : (
                  <>
                    <Send size={16} />
                    <span>Submit Inquiry</span>
                  </>
                )}
              </button>
            </form>
          )}
        </div>

        {/* Enterprise Context / SLA Sidebar */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div
            style={{
              background: '#FFFFFF',
              border: '1px solid var(--border-medium)',
              borderRadius: 20,
              padding: 24,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
              <Clock size={18} color="var(--apple-blue)" />
              <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>
                Response Time SLA
              </h3>
            </div>
            <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6, margin: 0 }}>
              All inquiries received via the official contact form are assigned a cryptographic ticket ID and dispatched directly to on-call cloud engineers. Typical first response is under 4 hours for enterprise pilot inquiries.
            </p>
          </div>

          <div
            style={{
              background: '#FFFFFF',
              border: '1px solid var(--border-medium)',
              borderRadius: 20,
              padding: 24,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
              <Shield size={18} color="var(--apple-emerald)" />
              <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>
                Security Vulnerability Disclosure
              </h3>
            </div>
            <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6, margin: 0 }}>
              For responsible security disclosures, select <strong>Security Disclosure</strong> in the category dropdown or email <code>security@cloudpilot.io</code> with PGP encryption details.
            </p>
          </div>

          <div
            style={{
              background: '#FFFFFF',
              border: '1px solid var(--border-medium)',
              borderRadius: 20,
              padding: 24,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
              <Building size={18} color="var(--apple-purple)" />
              <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>
                Open-Source Repository
              </h3>
            </div>
            <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6, margin: 0 }}>
              Found a bug or feature request? You can also contribute or inspect code directly on <a href="https://github.com/chetanbhagore/CloudPilot" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--apple-blue)', fontWeight: 600 }}>GitHub</a>.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
