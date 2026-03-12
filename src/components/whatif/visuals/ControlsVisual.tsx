/**
 * ControlsVisual.tsx
 *
 * Animated diagram showing the effect of better boiler control.
 *
 * Before: fixed higher flow temperature — blocky on/off bursts that overshoot
 * and cycle more than necessary.
 *
 * After: lower, steadier modulation — reduced cycling and improved condensing
 * potential without requiring a full weather-compensation upgrade.
 *
 * Animations use pure CSS keyframes.  No engine calculations are performed.
 */

import '../whatif-animations.css';

interface BlockProps {
  variant: 'on' | 'off' | 'steady';
  delay?: number;
}

function Block({ variant, delay = 0 }: BlockProps) {
  return (
    <div
      className={`wia-controls__bar wia-controls__bar--${variant}`}
      style={delay > 0 ? { animationDelay: `${delay}s` } : undefined}
      role="presentation"
    />
  );
}

/** Animated boiler control diagram — before/after comparison. */
export default function ControlsVisual() {
  const blockyPattern: Array<'on' | 'off'> = [
    'on', 'on', 'off', 'off', 'on', 'on', 'off', 'off',
  ];
  const steadyPattern: Array<'steady'> = [
    'steady', 'steady', 'steady', 'steady', 'steady', 'steady', 'steady', 'steady',
  ];

  return (
    <div className="wia-controls" aria-label="Fixed higher flow vs lower steadier running">

      <div className="wia-controls__section">
        <div className="wia-controls__section-label wia-controls__section-label--before">
          Fixed higher flow
        </div>
        <div className="wia-controls__track">
          {blockyPattern.map((variant, i) => (
            <Block
              key={i}
              variant={variant}
              delay={variant === 'on' ? i * 0.1 : 0}
            />
          ))}
        </div>
      </div>

      <div className="wia-controls__arrow" aria-hidden="true">↓ better control</div>

      <div className="wia-controls__section">
        <div className="wia-controls__section-label wia-controls__section-label--after">
          Lower, steadier flow
        </div>
        <div className="wia-controls__track">
          {steadyPattern.map((_, i) => (
            <Block key={i} variant="steady" delay={i * 0.05} />
          ))}
        </div>
      </div>

      <div className="wia-controls__badge" aria-label="Cycling reduced">
        ✓ Less cycling · lower temperature · better condensing
      </div>

      <p className="wia-controls__caption">
        Correct boiler control setup reduces stop-start cycling and helps the boiler
        run lower and steadier — improving both efficiency and comfort.
      </p>

    </div>
  );
}
