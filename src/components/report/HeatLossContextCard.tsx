/**
 * HeatLossContextCard
 *
 * Contextualises a home's heat demand against reference benchmarks so the
 * customer understands why a higher-output system and stored hot water have
 * been recommended.
 *
 * Reference bands (BS EN 12831 / SAP 2012 typical values):
 *   New build (post-2010 fabric standards):  4–6 kW
 *   Typical UK home (pre-2010 mixed stock):  8–12 kW
 *
 * This home's actual heat loss is supplied via the heatLossKw prop and must
 * come from the engine input (EngineInputV2_3.heatLossWatts / 1000).
 */

import './HeatLossContextCard.css';

interface Props {
  /** Calculated peak heat loss for this property in kW. */
  heatLossKw: number;
}

/** Reference benchmarks — new build and typical UK home. */
const BENCHMARKS = [
  { label: 'New build',     range: '4–6 kW',   minKw: 4,  maxKw: 6  },
  { label: 'Typical home',  range: '8–12 kW',  minKw: 8,  maxKw: 12 },
] as const;

/** Compute a visual bar width percentage based on a 0–20 kW scale. */
function barWidth(kw: number, scale = 20): number {
  return Math.min(100, Math.round((kw / scale) * 100));
}

/** Returns a human-readable demand band label for this home's heat loss. */
function demandBandLabel(kw: number): string {
  if (kw <= 6)  return 'low demand — well-insulated home';
  if (kw <= 12) return 'moderate demand — typical UK home';
  if (kw <= 18) return 'higher demand — older or larger property';
  return 'high demand — significant heat loss';
}

export default function HeatLossContextCard({ heatLossKw }: Props) {
  const thisHomeKw = Math.round(heatLossKw * 10) / 10;
  const demandBand = demandBandLabel(thisHomeKw);

  return (
    <div className="hlcc" aria-label="Heat demand context">
      <h3 className="hlcc__title">Understanding your heat demand</h3>

      <div className="hlcc__benchmarks" role="list" aria-label="Heat demand benchmarks">
        {BENCHMARKS.map(b => (
          <div key={b.label} className="hlcc__row" role="listitem">
            <span className="hlcc__row-label">{b.label}</span>
            <div className="hlcc__bar-track" aria-hidden="true">
              <div
                className="hlcc__bar hlcc__bar--ref"
                style={{ width: `${barWidth(b.maxKw)}%` }}
              />
            </div>
            <span className="hlcc__row-value">{b.range}</span>
          </div>
        ))}

        <div className="hlcc__row hlcc__row--this-home" role="listitem" aria-current="true">
          <span className="hlcc__row-label hlcc__row-label--this-home">This home</span>
          <div className="hlcc__bar-track" aria-hidden="true">
            <div
              className="hlcc__bar hlcc__bar--this-home"
              style={{ width: `${barWidth(thisHomeKw)}%` }}
            />
          </div>
          <span className="hlcc__row-value hlcc__row-value--this-home">{thisHomeKw} kW</span>
        </div>
      </div>

      <p className="hlcc__band-label" aria-label="Demand band">
        {thisHomeKw} kW — <span className="hlcc__band-text">{demandBand}</span>
      </p>

      <p className="hlcc__summary">
        This level of heat demand is why higher output and stored hot water are recommended.
      </p>
    </div>
  );
}
