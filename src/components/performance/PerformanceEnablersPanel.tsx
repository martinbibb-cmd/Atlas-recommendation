/**
 * PerformanceEnablersPanel.tsx
 *
 * Displays a checklist of conditions that must be met for a recommended
 * heating system to operate at its rated efficiency.
 *
 * Each enabler has a status: "ok", "warning", or "missing".
 * The panel transforms Atlas from a pure recommendation tool into
 * a diagnostic surface — showing the installer exactly what needs
 * confirming before the system will perform as specified.
 *
 * Data model:
 *
 *   PerformanceEnabler {
 *     id:     unique identifier
 *     label:  human-readable description
 *     status: "ok" | "warning" | "missing"
 *   }
 *
 * Usage:
 *   <PerformanceEnablersPanel enablers={enablers} />
 *
 * A future PR will derive enablers from live engine output.
 * Until then, placeholder data is exported from this module.
 */

import './performance.css';

// ─── Data model ───────────────────────────────────────────────────────────────

export type PerformanceEnablerStatus = 'ok' | 'warning' | 'missing';

export interface PerformanceEnabler {
  id:     string;
  label:  string;
  status: PerformanceEnablerStatus;
}

// ─── Default placeholder enablers ────────────────────────────────────────────

export const PLACEHOLDER_ENABLERS: PerformanceEnabler[] = [
  { id: 'mains_flow',       label: 'Adequate mains flow rate (≥ 12 L/min)',        status: 'ok'      },
  { id: 'boiler_sizing',    label: 'Correct boiler sizing for heat loss',           status: 'ok'      },
  { id: 'radiator_sizing',  label: 'Radiators sufficient for condensing operation', status: 'warning' },
  { id: 'gas_pressure',     label: 'Gas inlet pressure confirmed',                  status: 'missing' },
  { id: 'magnetic_filter',  label: 'Magnetic filter present and serviced',          status: 'ok'      },
];

// ─── Status icons and labels ──────────────────────────────────────────────────

const STATUS_ICON: Record<PerformanceEnablerStatus, string> = {
  ok:      '✓',
  warning: '⚠',
  missing: '✕',
};

const STATUS_LABEL: Record<PerformanceEnablerStatus, string> = {
  ok:      'OK',
  warning: 'Check',
  missing: 'Missing',
};

// ─── Component ────────────────────────────────────────────────────────────────

interface Props {
  enablers?: PerformanceEnabler[];
}

/**
 * PerformanceEnablersPanel
 *
 * Renders a compact checklist of performance enablers for the recommended
 * heating system.  Designed to sit alongside the System Lab summary.
 */
export default function PerformanceEnablersPanel({ enablers = PLACEHOLDER_ENABLERS }: Props) {
  const okCount      = enablers.filter(e => e.status === 'ok').length;
  const warningCount = enablers.filter(e => e.status === 'warning').length;
  const missingCount = enablers.filter(e => e.status === 'missing').length;

  return (
    <div className="perf-enablers" aria-label="Performance enablers">
      <h3 className="perf-enablers__title">Performance Enablers</h3>
      <p className="perf-enablers__subtitle">
        Conditions required for the system to operate at rated efficiency.
      </p>

      <ul className="perf-enablers__list" role="list">
        {enablers.map(enabler => (
          <li
            key={enabler.id}
            className={`perf-enablers__item perf-enablers__item--${enabler.status}`}
            aria-label={`${enabler.label}: ${STATUS_LABEL[enabler.status]}`}
          >
            <span
              className={`perf-enablers__icon perf-enablers__icon--${enabler.status}`}
              aria-hidden="true"
            >
              {STATUS_ICON[enabler.status]}
            </span>
            <span className="perf-enablers__label">{enabler.label}</span>
            <span
              className={`perf-enablers__chip perf-enablers__chip--${enabler.status}`}
              aria-hidden="true"
            >
              {STATUS_LABEL[enabler.status]}
            </span>
          </li>
        ))}
      </ul>

      <div className="perf-enablers__summary" aria-live="polite">
        <span className="perf-enablers__summary-item perf-enablers__summary-item--ok">
          {okCount} confirmed
        </span>
        {warningCount > 0 && (
          <span className="perf-enablers__summary-item perf-enablers__summary-item--warning">
            {warningCount} to check
          </span>
        )}
        {missingCount > 0 && (
          <span className="perf-enablers__summary-item perf-enablers__summary-item--missing">
            {missingCount} missing
          </span>
        )}
      </div>
    </div>
  );
}
