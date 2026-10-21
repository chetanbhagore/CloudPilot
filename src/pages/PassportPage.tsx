import { useNavigate } from 'react-router-dom';
import { ArrowRight, ShieldCheck } from 'lucide-react';
import PassportView from '../components/PassportView';
import { mockSafetyPassport } from '../data/mockData';
import { sound } from '../utils/soundEngine';

export default function PassportPage() {
  const navigate = useNavigate();

  return (
    <div className="page-container">
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, marginBottom: 28, flexWrap: 'wrap' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
            <span className="badge badge-info">STAGE 3 OF 5</span>
            <span style={{ fontSize: 13, color: 'var(--text-tertiary)' }}>Verification Protocol</span>
          </div>
          <h1 className="display-title" style={{ marginBottom: 6 }}>
            The Safety Passport™
          </h1>
          <p className="body-lead" style={{ maxWidth: 760 }}>
            Every remediation in CloudPilot requires an immutable Safety Passport. Review the 5 automated preconditions, blast radius simulation, and guaranteed rollback CLI command before proceeding.
          </p>
        </div>

        <button
          onClick={() => {
            sound.playClick();
            navigate('/approve');
          }}
          className="btn btn-primary btn-lg"
        >
          <ShieldCheck size={16} />
          <span>Proceed to Authorize</span>
          <ArrowRight size={16} />
        </button>
      </div>

      {/* Safety Passport Component */}
      <div style={{ maxWidth: 940, margin: '0 auto' }}>
        <PassportView
          passport={mockSafetyPassport}
          showApproveButton={true}
          onApprove={() => {
            sound.playClick();
            navigate('/approve');
          }}
        />
      </div>
    </div>
  );
}
