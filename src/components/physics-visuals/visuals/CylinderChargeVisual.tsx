/**
 * CylinderChargeVisual.tsx
 *
 * Demonstrates stored hot water behaviour:
 *   1. Energy enters the cylinder (animated fill rising from bottom)
 *   2. Cylinder holds the charge
 *   3. Demand draws it down (animated level dropping)
 *
 * mixergyMode adds a top-down fill indicator that represents stratified heating
 * (Mixergy charges from the top, unlike standard cylinders).
 *
 * The fillLevel prop (0–1) drives the animated water column height.
 * reducedMotion: the fill animation is replaced with a static level bar.
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

  // Derive a label from level
  let chargeLabel = 'Low charge';
  if (clampedLevel >= 0.7) chargeLabel = 'Well charged';
  else if (clampedLevel >= 0.4) chargeLabel = 'Partially charged';

  return (
    <div
      className={`ccv ccv--emphasis-${emphasis} ccv--mode-${displayMode}${mixergyMode ? ' ccv--mixergy' : ''}${reducedMotion ? ' ccv--reduced-motion' : ''}`}
      role="img"
      aria-label={`Cylinder charge: ${chargeLabel} (${fillPercent}%)`}
    >
      {/* Energy input indicator */}
      <div className="ccv__input" aria-hidden="true">
        <div className={`ccv__energy-arrow${reducedMotion ? '' : ' ccv__energy-arrow--animated'}`} />
        <span className="ccv__input-label">Energy in</span>
      </div>

      {/* Cylinder body */}
      <div className="ccv__cylinder" aria-hidden="true">
        {/* Mixergy top-down charge band */}
        {mixergyMode && (
          <div
            className={`ccv__mixergy-band${reducedMotion ? '' : ' ccv__mixergy-band--animated'}`}
            style={{ '--ccv-fill': clampedLevel } as React.CSSProperties}
          />
        )}

        {/* Water fill level */}
        <div
          className={`ccv__fill${reducedMotion ? '' : ' ccv__fill--animated'}`}
          style={{ '--ccv-fill': clampedLevel } as React.CSSProperties}
        />

        {/* Percentage label inside cylinder */}
        <div className="ccv__level-label">{fillPercent}%</div>

        {/* Temperature gradient overlay */}
        <div className="ccv__gradient-overlay" />
      </div>

      {/* Charge label */}
      <div className="ccv__status">
        <span className={`ccv__charge-badge ccv__charge-badge--${clampedLevel >= 0.7 ? 'high' : clampedLevel >= 0.4 ? 'mid' : 'low'}`}>
          {chargeLabel}
        </span>
      </div>

      {/* Demand output indicator */}
      <div className="ccv__output" aria-hidden="true">
        <div className={`ccv__demand-arrow${reducedMotion ? '' : ' ccv__demand-arrow--animated'}`} />
        <span className="ccv__output-label">Heat to home</span>
      </div>

      {mixergyMode && (
        <div className="ccv__mixergy-note">
          Mixergy: charges from top down
        </div>
      )}

      {caption && <p className="ccv__caption">{caption}</p>}
    </div>
  );
}
