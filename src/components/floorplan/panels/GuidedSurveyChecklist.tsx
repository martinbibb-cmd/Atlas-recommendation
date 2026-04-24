/**
 * GuidedSurveyChecklist.tsx — PR24 guided survey checklist rail.
 *
 * Renders an ordered checklist of capture steps for the surveyor.  Each step
 * shows:
 *   • Status badge (done / needs checking / missing / optional)
 *   • Step label and description
 *   • One primary action button that activates the correct tool or panel
 *
 * On desktop the checklist is rendered as a sidebar panel/rail.
 * On mobile it is rendered as a collapsible bottom sheet.
 *
 * Rules
 * ─────
 * - All step progress is derived from existing plan state — no second source.
 * - No hard blocking — informs the surveyor without preventing any action.
 * - No new object types, no new recommendation logic.
 */

import type { GuidedStep, GuidedStepAction } from '../../../features/floorplan/guidedSurveySteps';

// ─── Status config ────────────────────────────────────────────────────────────

const STATUS_CONFIG = {
  done: {
    icon: '✓',
    colour: '#15803d',
    bg: '#f0fdf4',
    border: '#86efac',
    label: 'Done',
  },
  needs_checking: {
    icon: '⚠',
    colour: '#92400e',
    bg: '#fffbeb',
    border: '#fcd34d',
    label: 'Check',
  },
  missing: {
    icon: '✗',
    colour: '#b91c1c',
    bg: '#fef2f2',
    border: '#fca5a5',
    label: 'Missing',
  },
  optional: {
    icon: '○',
    colour: '#64748b',
    bg: '#f8fafc',
    border: '#e2e8f0',
    label: 'Optional',
  },
} as const;

// ─── Props ────────────────────────────────────────────────────────────────────

export interface GuidedSurveyChecklistProps {
  steps: GuidedStep[];
  /** Fired when the user clicks a step's primary action button. */
  onAction: (action: GuidedStepAction) => void;
  /** Close / hide the checklist panel. */
  onClose: () => void;
  /**
   * When true, the component renders in mobile bottom-sheet mode with a
   * collapsible header toggle.  Defaults to false.
   */
  isMobile?: boolean;
}

// ─── Step row sub-component ───────────────────────────────────────────────────

interface StepRowProps {
  step: GuidedStep;
  index: number;
  onAction: (action: GuidedStepAction) => void;
}

function StepRow({ step, index, onAction }: StepRowProps) {
  const cfg = STATUS_CONFIG[step.status];
  const isDone = step.status === 'done';

  return (
    <div
      className="fpb__guided-step"
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: 8,
        padding: '8px 10px',
        borderRadius: 6,
        background: cfg.bg,
        border: `1px solid ${cfg.border}`,
        marginBottom: 4,
        opacity: isDone ? 0.75 : 1,
      }}
    >
      {/* Step number + status badge */}
      <div
        className="fpb__guided-step-badge"
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          flexShrink: 0,
          minWidth: 24,
        }}
      >
        <span
          style={{
            fontSize: 11,
            fontWeight: 700,
            color: cfg.colour,
            lineHeight: '1.2',
          }}
          aria-label={`Step ${index + 1}: ${cfg.label}`}
        >
          {cfg.icon}
        </span>
        <span
          style={{
            fontSize: 9,
            color: cfg.colour,
            textTransform: 'uppercase',
            letterSpacing: '0.04em',
            lineHeight: '1.2',
            marginTop: 1,
          }}
        >
          {index + 1}
        </span>
      </div>

      {/* Label + description */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <p
          style={{
            margin: 0,
            fontSize: 12,
            fontWeight: 600,
            color: '#1e293b',
            lineHeight: '1.4',
            textDecoration: isDone ? 'line-through' : undefined,
          }}
        >
          {step.label}
        </p>
        {!isDone && (
          <p style={{ margin: '1px 0 0', fontSize: 11, color: '#64748b', lineHeight: '1.4' }}>
            {step.description}
          </p>
        )}
      </div>

      {/* Primary action button — hidden when done */}
      {!isDone && (
        <button
          className="fpb__guided-step-btn"
          onClick={() => onAction(step.action)}
          title={step.actionLabel}
          style={{
            flexShrink: 0,
            padding: '3px 8px',
            fontSize: 11,
            fontWeight: 600,
            borderRadius: 4,
            border: `1px solid ${cfg.border}`,
            background: '#fff',
            color: cfg.colour,
            cursor: 'pointer',
            whiteSpace: 'nowrap',
          }}
        >
          {step.actionLabel}
        </button>
      )}
    </div>
  );
}

// ─── Progress summary bar ─────────────────────────────────────────────────────

function ProgressBar({ steps }: { steps: GuidedStep[] }) {
  const total = steps.length;
  const done  = steps.filter((s) => s.status === 'done').length;
  const pct   = total > 0 ? Math.round((done / total) * 100) : 0;
  const allDone = done === total;

  return (
    <div style={{ marginBottom: 8 }}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          fontSize: 11,
          color: '#64748b',
          marginBottom: 4,
        }}
      >
        <span>{done} of {total} steps complete</span>
        <span style={{ fontWeight: 600, color: allDone ? '#15803d' : '#64748b' }}>
          {pct}%
        </span>
      </div>
      <div
        style={{
          height: 4,
          background: '#e2e8f0',
          borderRadius: 2,
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            height: '100%',
            width: `${pct}%`,
            background: allDone ? '#15803d' : '#2563eb',
            borderRadius: 2,
            transition: 'width 0.3s ease',
          }}
        />
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function GuidedSurveyChecklist({
  steps,
  onAction,
  onClose,
  isMobile = false,
}: GuidedSurveyChecklistProps) {
  const content = (
    <>
      {/* Panel header */}
      <div
        className="fpb__guided-header"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 10,
        }}
      >
        <div>
          <p
            style={{
              margin: 0,
              fontSize: 13,
              fontWeight: 700,
              color: '#0f172a',
            }}
          >
            📋 Guided survey
          </p>
          <p style={{ margin: '1px 0 0', fontSize: 11, color: '#64748b' }}>
            Follow these steps to capture a complete plan.
          </p>
        </div>
        <button
          className="fpb__guided-close-btn"
          onClick={onClose}
          title="Close guided survey"
          aria-label="Close guided survey checklist"
        >
          ✕
        </button>
      </div>

      {/* Progress summary */}
      <ProgressBar steps={steps} />

      {/* Step list */}
      <div role="list" aria-label="Survey steps">
        {steps.map((step, i) => (
          <div key={step.key} role="listitem">
            <StepRow step={step} index={i} onAction={onAction} />
          </div>
        ))}
      </div>
    </>
  );

  if (isMobile) {
    return (
      <div
        className="fpb__guided-mobile-sheet"
        style={{
          padding: '12px 12px 16px',
          background: '#fff',
        }}
      >
        {content}
      </div>
    );
  }

  return (
    <aside
      className="fpb__guided-rail"
      aria-label="Guided survey checklist"
      style={{
        width: 220,
        flexShrink: 0,
        overflowY: 'auto',
        padding: '12px 10px',
        background: '#fff',
        borderRight: '1px solid #e2e8f0',
      }}
    >
      {content}
    </aside>
  );
}
