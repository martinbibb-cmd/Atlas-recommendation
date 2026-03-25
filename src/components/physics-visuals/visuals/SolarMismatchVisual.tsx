/**
 * SolarMismatchVisual.tsx
 *
 * Visualises the timing gap between:
 *   - solar generation (peaks midday, hours 10–14)
 *   - household demand (peaks morning 6–8 and evening 17–20)
 *
 * A simplified 24-bar chart (one bar per hour) is used to keep the component
 * self-contained without an external chart library. The sun arc is a CSS
 * animation that sweeps across the top of the chart.
 *
 * reducedMotion: the sun arc animation is disabled; bars remain static.
 */

import { useMemo } from 'react';
import type { SolarMismatchVisualProps } from '../physicsVisualTypes';
import './SolarMismatchVisual.css';

// ─── Data helpers ──────────────────────────────────────────────────────────────

/** Generation profile: W per hour (0–23). Peaks at midday. */
function generationProfile(): number[] {
  return [
    0, 0, 0, 0, 0, 0,         // 00–05
    10, 30, 80, 150, 220, 270, // 06–11
    290, 260, 220, 160, 90, 40,// 12–17
    10, 0, 0, 0, 0, 0,         // 18–23
  ];
}

/** Demand profile: W per hour (0–23). Morning + evening peaks. */
function demandProfile(): number[] {
  return [
    30, 20, 15, 15, 20, 60,    // 00–05
    200, 280, 260, 180, 100, 80,// 06–11
    70, 60, 70, 80, 140, 280,  // 12–17
    300, 260, 180, 120, 60, 40,// 18–23
  ];
}

const MAX_VALUE = 300;

function normalise(v: number): number {
  return Math.min(1, v / MAX_VALUE);
}

// ─── Component ─────────────────────────────────────────────────────────────────

export default function SolarMismatchVisual({
  highlightHour,
  reducedMotion = false,
  emphasis = 'medium',
  caption,
}: SolarMismatchVisualProps) {
  const gen = useMemo(() => generationProfile(), []);
  const dem = useMemo(() => demandProfile(), []);

  return (
    <div
      className={`smv smv--emphasis-${emphasis}${reducedMotion ? ' smv--reduced-motion' : ''}`}
      role="img"
      aria-label="Solar generation peaks at midday; household demand peaks in the morning and evening"
    >
      {/* Sun arc track */}
      <div className="smv__sun-track" aria-hidden="true">
        <div className={`smv__sun${reducedMotion ? '' : ' smv__sun--animated'}`} />
      </div>

      {/* Chart */}
      <div className="smv__chart" aria-hidden="true">
        {gen.map((g, hour) => {
          const d = dem[hour];
          const isHighlighted = highlightHour === hour;
          return (
            <div
              key={hour}
              className={`smv__col${isHighlighted ? ' smv__col--highlight' : ''}`}
            >
              {/* Generation bar (green, behind demand) */}
              <div
                className="smv__bar smv__bar--gen"
                style={{ '--smv-h': normalise(g) } as React.CSSProperties}
              />
              {/* Demand bar (amber, overlaid) */}
              <div
                className="smv__bar smv__bar--dem"
                style={{ '--smv-h': normalise(d) } as React.CSSProperties}
              />
            </div>
          );
        })}
      </div>

      {/* X-axis labels */}
      <div className="smv__xaxis" aria-hidden="true">
        <span>00</span>
        <span>06</span>
        <span>12</span>
        <span>18</span>
        <span>23</span>
      </div>

      {/* Legend */}
      <div className="smv__legend" aria-hidden="true">
        <span className="smv__legend-item smv__legend-item--gen">
          <span className="smv__legend-swatch" />
          Generation
        </span>
        <span className="smv__legend-item smv__legend-item--dem">
          <span className="smv__legend-swatch" />
          Demand
        </span>
      </div>

      {caption && <p className="smv__caption">{caption}</p>}
    </div>
  );
}
