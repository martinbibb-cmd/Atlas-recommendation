/**
 * SystemFitMap
 *
 * Renders a gradient "fit landscape" that visually positions the user's home
 * on a 2-D axis:
 *   X — simultaneous hot-water demand intensity (low → high)
 *   Y — low-temperature / stored-system suitability (low → high)
 *
 * The white dot shows where the household sits.  A callout near the dot names
 * the nearest system and offers a "Show me why" action to trigger an explainer.
 */

import type { FitPosition } from '../../logic/fit-map/computeFitPosition';
import './SystemFitMap.css';

// ─── Constants ────────────────────────────────────────────────────────────────

const SYSTEM_LABELS: Record<FitPosition['nearestSystem'], string> = {
  combi:      'On-demand (combi)',
  system:     'System & Cylinder',
  heat_pump:  'Heat Pump',
};

// ─── Props ────────────────────────────────────────────────────────────────────

interface Props {
  fitPosition: FitPosition;
  /**
   * Called when the user taps "Show me why".
   * The parent chooses how to surface the relevant explainer.
   */
  onShowExplainer?: (system: FitPosition['nearestSystem']) => void;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function SystemFitMap({ fitPosition, onShowExplainer }: Props) {
  const { x, y, nearestSystem } = fitPosition;

  return (
    <div className="fit-map" aria-label="System fit landscape">
      {/* Gradient background */}
      <div className="fit-map__gradient" aria-hidden="true" />

      {/* User position dot */}
      <div
        className="fit-map__dot"
        style={{
          left: `${x * 100}%`,
          top:  `${(1 - y) * 100}%`,
        }}
        aria-label={`Your home position: ${SYSTEM_LABELS[nearestSystem]}`}
      />

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
          Closest fit: {SYSTEM_LABELS[nearestSystem]}
        </span>
        {onShowExplainer && (
          <button
            className="fit-map__callout-btn"
            onClick={() => onShowExplainer(nearestSystem)}
            aria-label={`Show explainer for ${SYSTEM_LABELS[nearestSystem]}`}
          >
            Show me why
          </button>
        )}
      </div>
    </div>
  );
}
