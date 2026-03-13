/**
 * PerformanceEnablerRow.tsx
 *
 * A single row inside the PerformanceEnablersPanel.
 *
 * Displays the enabler status icon, label, one-line detail, and a status chip.
 * Intended to be consumed exclusively by PerformanceEnablersPanel.
 */
import type { PerformanceEnabler, PerformanceEnablerStatus } from '../../types/performance';

// ─── Static maps ─────────────────────────────────────────────────────────────

const STATUS_ICON: Record<PerformanceEnablerStatus, string> = {
  ok:      '✓',
  warning: '⚠',
  missing: '✕',
};

/** UI-facing status copy (3 states as specified). */
export const STATUS_LABEL: Record<PerformanceEnablerStatus, string> = {
  ok:      'OK',
  warning: 'Needs attention',
  missing: 'Not confirmed',
};

// ─── Component ────────────────────────────────────────────────────────────────

interface Props {
  enabler: PerformanceEnabler;
}

export default function PerformanceEnablerRow({ enabler }: Props) {
  const { label, status, detail } = enabler;
  const icon  = STATUS_ICON[status];
  const chip  = STATUS_LABEL[status];

  return (
    <li
      className={`perf-enablers__item perf-enablers__item--${status}`}
      aria-label={`${label}: ${chip}`}
    >
      <span
        className={`perf-enablers__icon perf-enablers__icon--${status}`}
        aria-hidden="true"
      >
        {icon}
      </span>
      <span className="perf-enablers__label-group">
        <span className="perf-enablers__label">{label}</span>
        {detail && (
          <span className="perf-enablers__detail">{detail}</span>
        )}
      </span>
      <span
        className={`perf-enablers__chip perf-enablers__chip--${status}`}
        aria-hidden="true"
      >
        {chip}
      </span>
    </li>
  );
}
