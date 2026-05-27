/**
 * PerformanceGraphicView — bar chart showing capacity vs restriction vs thermal limit.
 *
 * Highlights the limiting component (bottleneck) in a distinct colour.
 * Takes a computed CapacityChainResult and renders three summary bars:
 *   - Supply capacity (mains flow or tank head)
 *   - Thermal capacity (combi HEX limit)
 *   - Distribution capacity (smallest pipe / outlet in chain)
 *
 * All data comes from the computed props; no engine calls.
 */

import type { LegoScenario } from '../schema/legoTypes';
import type { CapacityChainResult } from '../model/dhwModel';

// ─── Props ────────────────────────────────────────────────────────────────────

interface Props {
  scenario: LegoScenario;
  computed: CapacityChainResult;
  /** Concurrent outlets selector (1–3). */
  outlets?: number;
  /** Demand flow per outlet (L/min). */
  demandFlowLpm?: number;
}

// ─── Bar scale ────────────────────────────────────────────────────────────────

/** Scale factor so bars never clip at 100 % when at-limit. */
const SCALE = 1.4;

// ─── Component ────────────────────────────────────────────────────────────────

export default function PerformanceGraphicView({
  scenario,
  computed,
  outlets = 1,
  demandFlowLpm = 10,
}: Props) {
  const { maxFlowLpm, limitingComponent, perComponentCaps, notes } = computed;
  const totalDemand = outlets * demandFlowLpm;
  const scale = maxFlowLpm ?? totalDemand * SCALE;

  return (
    <div className="perf-view">
      <h3 className="perf-view__title">{scenario.meta.name}</h3>
      <p className="perf-view__desc">{scenario.meta.description}</p>

      {/* ── Capacity bars ─────────────────────────────────────────────────── */}
      <div className="perf-view__bars" role="img" aria-label="Performance capacity chart">
        {perComponentCaps.map(comp => {
          const cap = comp.maxFlowLpm;
          const isLimiting = comp.label === limitingComponent;
          const pct = cap !== undefined
            ? Math.min(100, (cap / (scale * SCALE)) * 100)
            : 0;
          return (
            <div key={comp.label} className="perf-bar-row">
              <span className="perf-bar-row__label">
                {comp.label}
                {isLimiting && (
                  <span className="perf-bar-row__badge perf-bar-row__badge--limit"> ← limit</span>
                )}
              </span>
              <div className="perf-bar-row__track">
                {cap !== undefined ? (
                  <div
                    className={`perf-bar-row__fill${isLimiting ? ' perf-bar-row__fill--limit' : ''}`}
                    style={{ width: `${pct}%` }}
                  />
                ) : (
                  <span className="perf-bar-row__unknown">—</span>
                )}
              </div>
              <span className="perf-bar-row__value">
                {cap !== undefined ? `${cap.toFixed(1)} L/min` : 'unknown'}
              </span>
            </div>
          );
        })}
      </div>

      {/* ── Demand vs capacity summary ─────────────────────────────────────── */}
      <div className="perf-view__summary">
        <div className="perf-view__demand-row">
          <span className="perf-view__demand-label">
            Total demand ({outlets} outlet{outlets !== 1 ? 's' : ''} × {demandFlowLpm} L/min)
          </span>
          <span className="perf-view__demand-value">{totalDemand.toFixed(1)} L/min</span>
        </div>
        {maxFlowLpm !== undefined && (
          <div
            className={`perf-view__verdict ${totalDemand <= maxFlowLpm ? 'perf-view__verdict--ok' : 'perf-view__verdict--warn'}`}
          >
            {totalDemand <= maxFlowLpm
              ? `✅ Within capacity (${maxFlowLpm.toFixed(1)} L/min available)`
              : `⚠️ Over limit — demand (${totalDemand.toFixed(1)}) exceeds capacity (${maxFlowLpm.toFixed(1)} L/min)`}
          </div>
        )}
      </div>

      {/* ── Notes ─────────────────────────────────────────────────────────── */}
      {notes.length > 0 && (
        <ul className="perf-view__notes">
          {notes.map((n, i) => <li key={i}>{n}</li>)}
        </ul>
      )}
    </div>
  );
}
