// WorkflowBreadcrumb — shows which step of the Discover→Verify flow is active
interface Step { label: string; done?: boolean; active?: boolean }

interface Props { steps: Step[] }

export default function WorkflowBreadcrumb({ steps }: Props) {
  return (
    <div className="workflow-steps">
      {steps.map((s, i) => (
        <>
          <div
            key={s.label}
            className={`workflow-step${s.done ? ' done' : s.active ? ' active' : ''}`}
          >
            {s.done ? '✓' : i + 1}. {s.label}
          </div>
          {i < steps.length - 1 && (
            <div key={`arrow-${i}`} className="workflow-arrow">›</div>
          )}
        </>
      ))}
    </div>
  );
}
