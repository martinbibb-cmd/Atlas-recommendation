/**
 * SystemFitMap
 *
 * Renders a gradient "fit landscape" that visually positions the user's home
 * on a 2-D axis:
 *   X — simultaneous hot-water demand intensity (low → high)
 *   Y — low-temperature / stored-system suitability (low → high)
 *
 * The pulsing dot ("Your home") shows where the household sits.  A callout
 * names the nearest system.  Tapping "Show me why" slides up an inline
 * explainer panel — the map stays visible behind it.
 */

import { useState } from 'react';
import type { FitPosition } from '../../logic/fit-map/computeFitPosition';
import './SystemFitMap.css';

// ─── Constants ────────────────────────────────────────────────────────────────

const SYSTEM_LABELS: Record<FitPosition['nearestSystem'], string> = {
  combi:      'On-demand systems',
  system:     'Stored water systems',
  heat_pump:  'Heat Pump',
};

/** Short explainer surfaced in the inline drawer when "Show me why" is tapped. */
const SYSTEM_EXPLAINER: Record<FitPosition['nearestSystem'], string> = {
  combi:
    "Your home has lower simultaneous demand and adequate mains pressure, so there's no need to pre-store hot water. A combi fires only when needed — no standing losses, no cylinder space.",
  system:
    "Your home's demand profile or pressure measurement suggests that stored hot water will outperform on-demand supply. A cylinder buffers peak draw, protects flow rate under load, and lets the boiler run at its most efficient condensing range.",
  heat_pump:
    "Your building's thermal characteristics — lower heat loss rate and slower temperature swing — allow a heat pump to run at the low flow temperatures where it is most efficient. Stored cylinder supply handles the DHW lift without affecting space-heating COP.",
};

// ─── Props ────────────────────────────────────────────────────────────────────

interface Props {
  fitPosition: FitPosition;
  /**
   * Optional fallback called when the user wants the full physics explainer
   * tab.  The inline drawer is always shown first; this is surfaced as a
   * secondary "See full physics" link inside the drawer.
   */
  onShowExplainer?: (system: FitPosition['nearestSystem']) => void;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function SystemFitMap({ fitPosition, onShowExplainer }: Props) {
  const { x, y, nearestSystem } = fitPosition;
  const [explainerOpen, setExplainerOpen] = useState(false);

  return (
    <div className="fit-map-section">
      {/* Faint subtitle — sets expectation before the map */}
      <p className="fit-map-section__subtitle" aria-hidden="true">
        All systems can work — this shows which fits your home best
      </p>

      <div className="fit-map" aria-label="System fit landscape">
        {/* Gradient background */}
        <div className="fit-map__gradient" aria-hidden="true" />

        {/* User position dot + "Your home" label */}
        <div
          className="fit-map__dot-anchor"
          style={{
            left: `${x * 100}%`,
            top:  `${(1 - y) * 100}%`,
          }}
          aria-label={`Your home position: ${SYSTEM_LABELS[nearestSystem]}`}
        >
          <span className="fit-map__home-label" aria-hidden="true">Your home</span>
          <div className="fit-map__dot" />
        </div>

        {/* Zone labels */}
        <div className="fit-map__labels" aria-hidden="true">
          <span className="fit-map__label fit-map__label--combi">Combi</span>
          <span className="fit-map__label fit-map__label--system">System &amp; Cylinder</span>
          <span className="fit-map__label fit-map__label--heat-pump">Heat Pump</span>
        </div>

        {/* Axis captions */}
        <span className="fit-map__axis fit-map__axis--x" aria-hidden="true">
          Demand →
        </span>
        <span className="fit-map__axis fit-map__axis--y" aria-hidden="true">
          Low-temp fit ↑
        </span>

        {/* Nearest-system callout */}
        <div className="fit-map__callout">
          <span className="fit-map__callout-text">
            Your home sits closest to: <strong>{SYSTEM_LABELS[nearestSystem]}</strong>
          </span>
          <button
            className="fit-map__callout-btn"
            onClick={() => setExplainerOpen(open => !open)}
            aria-expanded={explainerOpen}
            aria-controls="fit-map-explainer"
            aria-label={`${explainerOpen ? 'Hide' : 'Show'} why ${SYSTEM_LABELS[nearestSystem]} fits your home`}
          >
            {explainerOpen ? 'Hide ↑' : 'Show me why'}
          </button>
        </div>
      </div>

      {/* Inline explainer drawer — slides out below the map */}
      <div
        id="fit-map-explainer"
        className={`fit-map__explainer${explainerOpen ? ' fit-map__explainer--open' : ''}`}
        aria-hidden={!explainerOpen}
        role="region"
        aria-label="Why this system fits your home"
      >
        <p className="fit-map__explainer-text">
          {SYSTEM_EXPLAINER[nearestSystem]}
        </p>
        {onShowExplainer && (
          <button
            className="fit-map__explainer-link"
            onClick={() => onShowExplainer(nearestSystem)}
            aria-label="Open full physics explainer"
          >
            See full physics ↗
          </button>
        )}
      </div>
    </div>
  );
}
