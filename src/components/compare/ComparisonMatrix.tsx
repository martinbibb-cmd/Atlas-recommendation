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
                  const band   = s.performance[key];
                  const marker = bandToMarker(band);
                  const desc   = bandToLabel(band);
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
