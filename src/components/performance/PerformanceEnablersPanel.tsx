/**
 * PerformanceEnablersPanel.tsx
 *
 * Displays a checklist of conditions that must be met for a recommended
 * heating system to operate at its rated efficiency.
 *
 * Each enabler has:
 *   status  — 'ok' | 'warning' | 'missing'
 *   label   — short heading
 *   detail  — one-line explanation of current status
 *
 * When `result` is supplied the panel derives real enablers via
 * derivePerformanceEnablers.  Otherwise it falls back to the static
 * PLACEHOLDER_ENABLERS (used in the lab and print stubs).
 *
 * Usage:
 *   <PerformanceEnablersPanel result={result} input={input} />
 *   <PerformanceEnablersPanel />   ← shows placeholder data
 */
import type { FullEngineResult } from '../../engine/schema/EngineInputV2_3';
import type { EngineInputV2_3 } from '../../engine/schema/EngineInputV2_3';
import type { PerformanceEnabler } from '../../types/performance';
import { derivePerformanceEnablers } from '../../lib/performance/derivePerformanceEnablers';
import PerformanceEnablerRow, { STATUS_LABEL } from './PerformanceEnablerRow';
import './performance.css';

// ─── Placeholder data (used when no live result is supplied) ──────────────────

export const PLACEHOLDER_ENABLERS: PerformanceEnabler[] = [
  {
    id: 'mains_water_suitability',
    label: 'Mains water suitability',
    status: 'ok',
    detail: 'Mains flow confirmed adequate for the selected system.',
    category: 'hydraulic',
  },
  {
    id: 'emitter_suitability',
    label: 'Emitter suitability',
    status: 'warning',
    detail: 'Condensing mode may not be achievable — check radiator sizing and flow temperature.',
    category: 'emitters',
  },
  {
    id: 'controls_quality',
    label: 'Controls quality',
    status: 'ok',
    detail: 'Full installation with upgraded controls — system will operate at best efficiency.',
    category: 'controls',
  },
  {
    id: 'system_protection',
    label: 'System protection',
    status: 'ok',
    detail: 'Magnetic / laminar filtration recorded.',
    category: 'system_health',
  },
  {
    id: 'hot_water_fit',
    label: 'Hot water suitability',
    status: 'ok',
    detail: 'Hot water arrangement appears suitable for confirmed occupancy.',
    category: 'dhw',
  },
];

// ─── Component ────────────────────────────────────────────────────────────────

interface Props {
  /** When supplied, enablers are derived from live engine data. */
  result?: FullEngineResult;
  /** Optional survey input — improves derivation quality for filter / occupancy fields. */
  input?: EngineInputV2_3;
  /** Override the enabler list entirely (e.g. for testing or placeholder display). */
  enablers?: PerformanceEnabler[];
}

/**
 * PerformanceEnablersPanel
 *
 * Renders a compact checklist of performance enablers for the recommended
 * heating system.  Designed to sit alongside the System Lab summary.
 */
export default function PerformanceEnablersPanel({ result, input, enablers }: Props) {
  const derived: PerformanceEnabler[] =
    enablers ??
    (result ? derivePerformanceEnablers(result, input) : PLACEHOLDER_ENABLERS);

  const okCount      = derived.filter(e => e.status === 'ok').length;
  const warningCount = derived.filter(e => e.status === 'warning').length;
  const missingCount = derived.filter(e => e.status === 'missing').length;

  return (
    <div className="perf-enablers" aria-label="Performance enablers">
      <h3 className="perf-enablers__title">Performance Enablers</h3>
      <p className="perf-enablers__subtitle">
        Conditions required for the system to operate at rated efficiency.
      </p>

      <ul className="perf-enablers__list" role="list">
        {derived.map(enabler => (
          <PerformanceEnablerRow key={enabler.id} enabler={enabler} />
        ))}
      </ul>

      <div className="perf-enablers__summary" aria-live="polite">
        <span className="perf-enablers__summary-item perf-enablers__summary-item--ok">
          {okCount} {STATUS_LABEL.ok.toLowerCase()}
        </span>
        {warningCount > 0 && (
          <span className="perf-enablers__summary-item perf-enablers__summary-item--warning">
            {warningCount} {STATUS_LABEL.warning.toLowerCase()}
          </span>
        )}
        {missingCount > 0 && (
          <span className="perf-enablers__summary-item perf-enablers__summary-item--missing">
            {missingCount} {STATUS_LABEL.missing.toLowerCase()}
          </span>
        )}
      </div>
    </div>
  );
}
