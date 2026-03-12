/**
 * RadiatorUpgradeAnimation.tsx
 *
 * Animated diagram showing the effect of upsizing radiators on system
 * efficiency and condensing operation.
 *
 * Larger radiators offer greater surface area which allows the same heat
 * output at a lower flow temperature.  Lower flow temperature enables the
 * boiler to condense, recovering latent heat from flue gases and improving
 * seasonal efficiency by up to 15 %.
 *
 * No engine calculations — display-model only.
 */

import './whatif-animations.css';

interface TempBarProps {
  label:    string;
  tempC:    number;
  maxTempC: number;
  variant:  'high' | 'low';
}

function TempBar({ label, tempC, maxTempC, variant }: TempBarProps) {
  const pct = Math.round((tempC / maxTempC) * 100);
  return (
    <div className="wia-rads__row">
      <span className="wia-rads__label">{label}</span>
      <div className="wia-rads__track">
        <div
          className={`wia-rads__fill wia-rads__fill--${variant}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="wia-rads__temp">{tempC} °C</span>
    </div>
  );
}

/** Animated radiator upgrade — flow temperature comparison. */
export default function RadiatorUpgradeAnimation() {
  return (
    <div className="wia-rads" aria-label="Radiator upgrade flow temperature animation">
      <div className="wia-rads__title">Flow temperature needed</div>
      <TempBar label="Current radiators"  tempC={75} maxTempC={80} variant="high" />
      <TempBar label="Upsized radiators"  tempC={50} maxTempC={80} variant="low"  />
      <div className="wia-rads__condensing-badge" aria-label="Condensing operation enabled">
        ✓ Below 55 °C → boiler condenses
      </div>
      <p className="wia-rads__caption">
        Larger surface area → lower flow temp needed → return stays below 55 °C dewpoint
        → boiler recovers latent heat → efficiency improves ~10–15 %.
      </p>
    </div>
  );
}
