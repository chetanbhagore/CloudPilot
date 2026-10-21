import { type Finding, type Severity } from '../data/mockData';
import { Shield, DollarSign, ChevronRight } from 'lucide-react';

const severityOrder: Record<Severity, number> = { critical: 0, high: 1, medium: 2, low: 3 };

interface Props {
  findings: Finding[];
  onSelect: (f: Finding) => void;
  selected?: string;
}

export default function FindingList({ findings, onSelect, selected }: Props) {
  const sorted = [...findings].sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);

  return (
    <div className="finding-list">
      {sorted.map((f) => (
        <div
          key={f.id}
          className={`finding-card ${f.severity}${selected === f.id ? ' active' : ''}`}
          onClick={() => onSelect(f)}
        >
          <div className="finding-card-header">
            <div className="finding-card-title">{f.title}</div>
            <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
              <span className={`badge badge-${f.severity}`}>{f.severity.toUpperCase()}</span>
              <span className={`badge badge-${f.category}`}>
                {f.category === 'security' ? <Shield size={9} /> : <DollarSign size={9} />}
                {f.category}
              </span>
            </div>
          </div>

          <div className="finding-card-meta">
            <span className="finding-card-resource">{f.resource.id}</span>
            <span className="text-xs text-muted">·</span>
            <span className="text-xs text-muted">{f.resource.region}</span>
            <span className="text-xs text-muted">·</span>
            <span className="text-xs text-muted">{f.affectedService}</span>
            {f.estimatedSavings && (
              <span className="finding-card-cost">
                ~${f.estimatedSavings.toFixed(2)}/mo savings
              </span>
            )}
          </div>

          <div style={{ marginTop: 10, fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.5 }}>
            {f.description.slice(0, 120)}…
          </div>

          <div style={{ marginTop: 10, display: 'flex', justifyContent: 'flex-end' }}>
            <button className="btn btn-ghost btn-sm" onClick={(e) => { e.stopPropagation(); onSelect(f); }}>
              View details <ChevronRight size={12} />
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
