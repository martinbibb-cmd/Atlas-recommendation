/**
 * CylinderChargeVisual.tsx
 *
 * Demonstrates stored hot water behaviour for two distinct cylinder types:
 *
 *   Standard (mixergyMode=false):
 *     The whole cylinder body warms progressively. The top region becomes
 *     useful first due to natural thermal stratification, but there is no
 *     hard hot/cold boundary — the visual language is "diffuse body warming".
 *
 *   Mixergy (mixergyMode=true):
 *     Heat is directed to the top of the cylinder, building a usable hot zone
 *     that expands downward. A sharp thermocline boundary separates the hot
 *     zone (top) from the cooler stored volume (bottom). Visual language is
 *     "stratified top-down charge front".
 *
 * The fillLevel prop (0–1) drives the degree of warmth (standard) or the
 * fraction of the cylinder that forms the usable hot zone (Mixergy).
 * reducedMotion suppresses all animations.
 */

import type { CylinderChargeVisualProps } from '../physicsVisualTypes';
import './CylinderChargeVisual.css';

// ─── Component ─────────────────────────────────────────────────────────────────

export default function CylinderChargeVisual({
  fillLevel = 0.6,
  mixergyMode = false,
  reducedMotion = false,
  emphasis = 'medium',
  displayMode = 'preview',
  caption,
}: CylinderChargeVisualProps) {
  const clampedLevel = Math.max(0, Math.min(1, fillLevel));
  const fillPercent = Math.round(clampedLevel * 100);
  const badgeLevel = clampedLevel >= 0.7 ? 'high' : clampedLevel >= 0.4 ? 'mid' : 'low';

  // Labels differ by mode
  let chargeLabel: string;
  if (mixergyMode) {
    chargeLabel = `Hot zone: ${fillPercent}%`;
  } else {
    if (clampedLevel >= 0.7) chargeLabel = 'Well charged';
    else if (clampedLevel >= 0.4) chargeLabel = 'Partially charged';
    else chargeLabel = 'Low charge';
  }

  return (
    <div
      className={`ccv ccv--emphasis-${emphasis} ccv--mode-${displayMode}${mixergyMode ? ' ccv--mixergy' : ' ccv--standard'}${reducedMotion ? ' ccv--reduced-motion' : ''}`}
      role="img"
      aria-label={
        mixergyMode
          ? `Mixergy cylinder: usable hot zone ${fillPercent}%`
          : `Standard cylinder: charge level ${fillPercent}%`
      }
    >
      {/* Energy input indicator */}
      <div className="ccv__input" aria-hidden="true">
        <div className={`ccv__energy-arrow${reducedMotion ? '' : ' ccv__energy-arrow--animated'}`} />
        <span className="ccv__input-label">Energy in</span>
      </div>

      {/* Cylinder body */}
      <div className="ccv__cylinder" aria-hidden="true">
        {mixergyMode ? (
          <>
            {/* Mixergy: targeted top-down hot zone with sharp thermocline boundary */}
            <div
              className={`ccv__mx-hot${reducedMotion ? '' : ' ccv__mx-hot--animated'}`}
              style={{ '--ccv-fill': clampedLevel } as React.CSSProperties}
            />
            <div
              className={`ccv__mx-boundary${reducedMotion ? '' : ' ccv__mx-boundary--animated'}`}
              style={{ '--ccv-fill': clampedLevel } as React.CSSProperties}
            />
            <div
              className="ccv__mx-cold"
              style={{ '--ccv-fill': clampedLevel } as React.CSSProperties}
            />
          </>
        ) : (
          <>
            {/* Standard: diffuse full-body warming — top warms first, no sharp boundary */}
            <div className="ccv__std-cool-base" />
            <div
              className={`ccv__std-warm-overlay${reducedMotion ? '' : ' ccv__std-warm-overlay--animated'}`}
              style={{ '--ccv-fill': clampedLevel } as React.CSSProperties}
            />
          </>
        )}

        {/* Charge percentage label */}
        <div className="ccv__level-label">{fillPercent}%</div>
      </div>

      {/* Charge status badge */}
      <div className="ccv__status">
        <span className={`ccv__charge-badge ccv__charge-badge--${badgeLevel}`}>
          {chargeLabel}
        </span>
      </div>

      {/* Demand output indicator */}
      <div className="ccv__output" aria-hidden="true">
        <div className={`ccv__demand-arrow${reducedMotion ? '' : ' ccv__demand-arrow--animated'}`} />
        <span className="ccv__output-label">
          {mixergyMode ? 'Hot water ready' : 'Heat to home'}
        </span>
      </div>

      {/* Behaviour note */}
      {mixergyMode ? (
        <div className="ccv__mixergy-note">
          Usable hot water builds from the top down
        </div>
      ) : (
        <div className="ccv__standard-note">
          Whole body warms — top first
        </div>
      )}

      {caption && <p className="ccv__caption">{caption}</p>}
    </div>
  );
}
