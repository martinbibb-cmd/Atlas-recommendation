/**
 * CopBreakEvenChart.tsx
 *
 * Pure CSS/div chart (no heavy charting library) showing:
 *   X-axis: gas-to-electricity power-station efficiency (%)
 *   Y-axis: break-even COP required to match boiler efficiency
 *
 * Overlays:
 *   - "comfort zone" band for typical good UK heat pump installs (COP 3–4)
 *   - marker at current UK grid average efficiency
 *
 * All maths from energyMath.ts.
 */

import EnergyExplainerCard from './EnergyExplainerCard';
import { estimateBreakEvenCopAgainstBoiler } from '../lib/energyMath';
import { ENERGY_COPY } from '../data/energyExplainerCopy';
import { SCENARIO_BASELINE } from '../data/energyScenarioDefaults';
import './CopBreakEvenChart.css';

// ─── Chart configuration ──────────────────────────────────────────────────────

const BOILER_EFFICIENCY = SCENARIO_BASELINE.boilerEfficiencyPct / 100;

/**
 * Gas-to-electricity efficiency range for the X-axis.
 * 30 % represents an old open-cycle gas turbine (OCGT) / peaker plant.
 * 47 % is the current UK average CCGT fleet.
 * 65 % is the upper bound for advanced combined-cycle technology.
 */
const GAS_EFFICIENCIES = [0.30, 0.35, 0.40, 0.45, 0.47, 0.50, 0.55, 0.60, 0.65];
const COMFORT_COP_LOW = 2.5;
const COMFORT_COP_HIGH = 4.0;
const MAX_COP_AXIS = 5.0;

// ─── Component ────────────────────────────────────────────────────────────────

export default function CopBreakEvenChart() {
  const currentEfficiency = SCENARIO_BASELINE.gasToElectricEfficiencyPct / 100;

  const points = GAS_EFFICIENCIES.map((eff) => ({
    eff,
    breakEvenCop: estimateBreakEvenCopAgainstBoiler(BOILER_EFFICIENCY, eff),
  }));

  const minEff = GAS_EFFICIENCIES[0];
  const maxEff = GAS_EFFICIENCIES[GAS_EFFICIENCIES.length - 1];
  const effRange = maxEff - minEff;

  const toXPct = (eff: number) => ((eff - minEff) / effRange) * 100;
  const toYPct = (cop: number) => (1 - cop / MAX_COP_AXIS) * 100;

  const comfortTopPct = toYPct(COMFORT_COP_HIGH);
  const comfortBottomPct = toYPct(COMFORT_COP_LOW);
  const comfortHeightPct = comfortBottomPct - comfortTopPct;
  const currentXPct = toXPct(currentEfficiency);

  return (
    <EnergyExplainerCard
      title={ENERGY_COPY.copChart.title}
      badge="Phase 1"
      className="cop-chart"
    >
      <p className="cop-chart__subtitle">{ENERGY_COPY.copChart.subtitle}</p>

      {/* ── Chart area ──────────────────────────────────────────────────────── */}
      <div className="cop-chart__wrap" aria-label="COP break-even chart">

        {/* Y-axis labels */}
        <div className="cop-chart__yaxis" aria-hidden="true">
          {[5, 4, 3, 2, 1].map((v) => (
            <span key={v} className="cop-chart__ylabel">{v}</span>
          ))}
        </div>

        <div className="cop-chart__plot">

          {/* Comfort zone band */}
          <div
            className="cop-chart__comfort-band"
            style={{
              top: `${comfortTopPct}%`,
              height: `${comfortHeightPct}%`,
            }}
            aria-label={`Comfort zone: COP ${COMFORT_COP_LOW}–${COMFORT_COP_HIGH}`}
          >
            <span className="cop-chart__comfort-label">
              {ENERGY_COPY.copChart.comfortZoneLabel}
            </span>
          </div>

          {/* Current UK grid efficiency marker */}
          <div
            className="cop-chart__current-line"
            style={{ left: `${currentXPct}%` }}
            aria-label={`Current UK grid: ${Math.round(currentEfficiency * 100)}%`}
          >
            <span className="cop-chart__current-label">
              UK today ({Math.round(currentEfficiency * 100)}%)
            </span>
          </div>

          {/* Break-even curve (CSS polyline via SVG) */}
          <svg className="cop-chart__svg" viewBox="0 0 100 100" preserveAspectRatio="none">
            <polyline
              className="cop-chart__curve"
              points={points
                .map((p) => `${toXPct(p.eff).toFixed(1)},${toYPct(p.breakEvenCop).toFixed(1)}`)
                .join(' ')}
            />
          </svg>

          {/* X-axis labels */}
          <div className="cop-chart__xaxis" aria-hidden="true">
            {[30, 40, 50, 60].map((pct) => (
              <span
                key={pct}
                className="cop-chart__xlabel"
                style={{ left: `${toXPct(pct / 100)}%` }}
              >
                {pct}%
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* ── Axis labels ─────────────────────────────────────────────────────── */}
      <div className="cop-chart__axis-labels" aria-hidden="true">
        <span className="cop-chart__axis-label cop-chart__axis-label--x">
          {ENERGY_COPY.copChart.xAxisLabel}
        </span>
        <span className="cop-chart__axis-label cop-chart__axis-label--y">
          {ENERGY_COPY.copChart.yAxisLabel}
        </span>
      </div>

      <p className="cop-chart__note">{ENERGY_COPY.copChart.note}</p>
    </EnergyExplainerCard>
  );
}
