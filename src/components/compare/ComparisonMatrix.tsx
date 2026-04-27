/**
 * ComparisonMatrix.tsx — Surveyor-facing status matrix.
 *
 * Compares evaluated scenarios side-by-side using status markers:
 *   ✅ = fit / good
 *   ⚠️ = warning / moderate
 *   ❌ = unsuitable / fail
 *   ❓ = needs more info / unknown
 *
 * Rules:
 *   - No recommendation logic — content flows from ScenarioResult only.
 *   - Audience: surveyor.
 *   - No Math.random().
 */

import type { ScenarioResult, PerformanceBand } from '../../contracts/ScenarioResult';
import './ComparisonMatrix.css';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ComparisonMatrixProps {
  scenarios: ScenarioResult[];
  recommendedScenarioId: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function bandToMarker(band: PerformanceBand): string {
  switch (band) {
    case 'excellent':
    case 'very_good':
    case 'good':
      return '✅';
    case 'needs_setup':
      return '⚠️';
    case 'poor':
      return '❌';
    default:
      return '❓';
  }
}

function bandToLabel(band: PerformanceBand): string {
  switch (band) {
    case 'excellent':   return 'Excellent';
    case 'very_good':   return 'Very good';
    case 'good':        return 'Good';
    case 'needs_setup': return 'Needs setup';
    case 'poor':        return 'Poor';
    default:            return 'Unknown';
  }
}

function flagToMarker(flag: boolean | undefined): string {
  return flag ? '❌' : '✅';
}

function flagToLabel(flag: boolean | undefined): string {
  return flag ? 'Risk present' : 'No issue';
}

/**
 * Derive a status marker from a numeric efficiency metric.
 *
 * COP thresholds (ASHP):
 *   ✅ ≥ 3.2 — heat pump operating well within efficient range
 *   ⚠️ 2.0 – 3.2 — acceptable but constrained
 *   ❌ < 2.0 — poor COP; high standing losses or high flow temp
 *
 * η thresholds (boiler, percentage points):
 *   ✅ ≥ 94 — ErP A-rated condensing (best in class)
 *   ⚠️ 80 – 93 — condensing but below peak seasonal efficiency
 *   ❌ < 80 — non-condensing or heavily degraded
 */
function efficiencyMetricToMarker(metric: ScenarioResult['efficiencyMetric']): string {
  if (!metric) return '❓';
  if (metric.kind === 'cop') {
    if (metric.value >= 3.2) return '✅';
    if (metric.value >= 2.0) return '⚠️';
    return '❌';
  }
  // kind === 'eta'
  if (metric.value >= 94) return '✅';
  if (metric.value >= 80) return '⚠️';
  return '❌';
}

/**
 * Human-readable efficiency label combining the numeric value and kind.
 */
function efficiencyMetricToLabel(metric: ScenarioResult['efficiencyMetric']): string {
  if (!metric) return 'Unknown';
  if (metric.kind === 'cop') return `COP ${metric.value.toFixed(1)}`;
  return `${metric.value} % efficiency`;
}

// ─── Row definitions ──────────────────────────────────────────────────────────

type PerformanceRowKey = keyof ScenarioResult['performance'];
type PhysicsFlagRowKey = keyof ScenarioResult['physicsFlags'];

const PERFORMANCE_ROWS: { key: PerformanceRowKey; label: string }[] = [
  { key: 'hotWater', label: 'Hot water' },
  { key: 'heating',  label: 'Heating'   },
  { key: 'efficiency', label: 'Efficiency' },
  { key: 'reliability', label: 'Reliability' },
];

const PHYSICS_FLAG_ROWS: { key: PhysicsFlagRowKey; label: string }[] = [
  { key: 'combiFlowRisk',       label: 'Simultaneous demand risk'    },
  { key: 'hydraulicLimit',      label: 'Hydraulic limit'             },
  { key: 'highTempRequired',    label: 'High-temperature required'   },
  { key: 'pressureConstraint',  label: 'Mains pressure constraint'   },
];

// ─── Component ────────────────────────────────────────────────────────────────

/**
 * ComparisonMatrix
 *
 * Surveyor-facing status matrix. Rows = performance dimensions + physics flags.
 * Columns = evaluated scenarios. Recommended column is tinted green.
 */
export function ComparisonMatrix({ scenarios, recommendedScenarioId }: ComparisonMatrixProps) {
  if (scenarios.length === 0) {
    return (
      <div className="comparison-matrix comparison-matrix--empty">
        <p>No scenarios to compare.</p>
      </div>
    );
  }

  return (
    <div className="comparison-matrix" role="region" aria-label="System comparison matrix">
      <div className="comparison-matrix__scroll-wrap">
        <table className="comparison-matrix__table">
          <thead>
            <tr>
              <th className="comparison-matrix__row-label" scope="col">Feature</th>
              {scenarios.map((s) => (
                <th
                  key={s.scenarioId}
                  scope="col"
                  className={`comparison-matrix__col-header${s.scenarioId === recommendedScenarioId ? ' comparison-matrix__col-header--recommended' : ''}`}
                >
                  <span className="comparison-matrix__system-name">{s.system.summary}</span>
                  {s.scenarioId === recommendedScenarioId && (
                    <span className="comparison-matrix__recommended-badge" aria-label="Atlas recommended">
                      Recommended
                    </span>
                  )}
                </th>
              ))}
            </tr>
          </thead>

          <tbody>
            {/* ── Performance rows ── */}
            {PERFORMANCE_ROWS.map(({ key, label }) => (
              <tr key={key} className="comparison-matrix__row comparison-matrix__row--performance">
                <th className="comparison-matrix__row-label" scope="row">{label}</th>
                {scenarios.map((s) => {
                  const band = s.performance[key];
                  // For the Efficiency dimension, prefer the numeric efficiencyMetric
                  // (COP or η %) over the generic PerformanceBand label when available.
                  const hasEfficiencyMetric = key === 'efficiency' && s.efficiencyMetric !== undefined;
                  const marker = hasEfficiencyMetric
                    ? efficiencyMetricToMarker(s.efficiencyMetric)
                    : bandToMarker(band);
                  const desc = hasEfficiencyMetric
                    ? efficiencyMetricToLabel(s.efficiencyMetric)
                    : bandToLabel(band);
                  return (
                    <td
                      key={s.scenarioId}
                      className={`comparison-matrix__cell${s.scenarioId === recommendedScenarioId ? ' comparison-matrix__cell--recommended' : ''}`}
                      aria-label={`${label}: ${desc}`}
                    >
                      <span className="comparison-matrix__marker" aria-hidden="true">{marker}</span>
                      <span className="comparison-matrix__cell-label">{desc}</span>
                    </td>
                  );
                })}
              </tr>
            ))}

            {/* ── Physics flag rows ── */}
            {PHYSICS_FLAG_ROWS.map(({ key, label }) => (
              <tr key={key} className="comparison-matrix__row comparison-matrix__row--physics">
                <th className="comparison-matrix__row-label comparison-matrix__row-label--physics" scope="row">{label}</th>
                {scenarios.map((s) => {
                  const flag   = s.physicsFlags[key];
                  const marker = flagToMarker(flag);
                  const desc   = flagToLabel(flag);
                  return (
                    <td
                      key={s.scenarioId}
                      className={`comparison-matrix__cell comparison-matrix__cell--physics${s.scenarioId === recommendedScenarioId ? ' comparison-matrix__cell--recommended' : ''}`}
                      aria-label={`${label}: ${desc}`}
                    >
                      <span className="comparison-matrix__marker" aria-hidden="true">{marker}</span>
                      <span className="comparison-matrix__cell-label">{desc}</span>
                    </td>
                  );
                })}
              </tr>
            ))}

            {/* ── Summary row ── */}
            <tr className="comparison-matrix__row comparison-matrix__row--summary">
              <th className="comparison-matrix__row-label" scope="row">Atlas verdict</th>
              {scenarios.map((s) => (
                <td
                  key={s.scenarioId}
                  className={`comparison-matrix__cell comparison-matrix__cell--summary${s.scenarioId === recommendedScenarioId ? ' comparison-matrix__cell--recommended' : ''}`}
                >
                  {s.scenarioId === recommendedScenarioId ? (
                    <span className="comparison-matrix__verdict-badge comparison-matrix__verdict-badge--recommended">
                      ✅ Recommended
                    </span>
                  ) : (
                    <span className="comparison-matrix__verdict-badge">—</span>
                  )}
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
